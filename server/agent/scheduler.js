import cron from 'node-cron';
import { fetchDuneMetrics, fetchMentions, updateAllBrands, TRACKED_BRANDS } from './ingest.js';
import { analyzeState } from './brain.js';
import { generateDailyBriefing } from './generator.js'; // Import Generator
import { fetchAutomationSettings, fetchBrandProfile, getSupabaseClient } from './brandContext.js';
import { fetchActiveBrands } from './brandRegistry.js';
import { scheduledNewsFetch, fetchWeb3News } from '../services/web3News.js';
import { notifyLinkedChats } from '../telegram/notifier.js';

/**
 * SCHEDULER SERVICE
 * "The Heartbeat"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '../cache');
const DECISIONS_FILE = path.join(CACHE_DIR, 'decisions.json');

// Helper to save decision
const saveDecisionToFile = (decision) => {
    try {
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

        // Read existing
        let history = [];
        if (fs.existsSync(DECISIONS_FILE)) {
            history = JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8'));
        }

        const newRecord = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            ...decision,
            status: 'pending' // pending | approved | rejected
        };

        // Prepend and keep last 50
        history.unshift(newRecord);
        fs.writeFileSync(DECISIONS_FILE, JSON.stringify(history.slice(0, 50), null, 2));
        console.log("   - 💾 Decision Saved to Storage.");

    } catch (e) {
        console.error("   - ❌ Save Failed:", e);
    }
};

const saveDecisionToDb = async (supabase, decision, brandId) => {
    if (!supabase || !brandId) return;
    try {
        const payload = {
            brand_id: brandId,
            action: decision.action,
            target_id: decision.targetId || null,
            reason: decision.reason || null,
            draft: decision.draft || null,
            status: 'pending',
            metadata: decision.metadata || null
        };

        const { error } = await supabase.from('agent_decisions').insert(payload);
        if (error) {
            console.warn("[Agent] Failed to save decision to DB:", error.message);
        }
    } catch (e) {
        console.warn("[Agent] Decision DB insert failed:", e.message);
    }
};

const backupAgentDecisions = async (supabase) => {
    if (!supabase) return;
    try {
        const { data, error } = await supabase
            .from('agent_decisions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) {
            console.warn("[Agent] Backup fetch failed:", error.message);
            return;
        }

        await supabase
            .from('app_storage')
            .upsert({
                key: 'backup_agent_decisions_v1',
                value: { capturedAt: new Date().toISOString(), decisions: data || [] },
                updated_at: new Date().toISOString()
            });
    } catch (e) {
        console.warn("[Agent] Backup failed:", e.message);
    }
};

const pruneOldDecisions = async (supabase, days = 30) => {
    if (!supabase) return;
    try {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const { error } = await supabase
            .from('agent_decisions')
            .delete()
            .lt('created_at', cutoff);

        if (error) {
            console.warn("[Agent] Decision pruning failed:", error.message);
        }
    } catch (e) {
        console.warn("[Agent] Decision pruning error:", e.message);
    }
};

const normalize = (value) => String(value || '').toLowerCase();

export const runBrainCycle = async ({ label = 'Manual Decision Scan', brandIdentifier, supabaseOverride } = {}) => {
    console.log(`\n[${new Date().toISOString()}] 🧠 Agent Cycle: ${label}`);

    const supabase = supabaseOverride || getSupabaseClient();
    const duneKey = process.env.DUNE_API_KEY;
    const apifyKey = process.env.APIFY_API_TOKEN;

    try {
        // A. Global Context (Fetch Once)
        console.log("   - Scanning global market trends...");

        // Fetch web3 news as market context (replaces deprecated LunarCrush/Pulse)
        let pulseTrends = [];
        try {
            const newsResult = await fetchWeb3News(supabase, 'global', { limit: 8 });
            pulseTrends = (newsResult.items || []).map(item => ({
                headline: item.headline || item.topic || 'Unknown',
                summary: item.summary || '',
                sentiment: item.sentiment || 'Neutral',
                relevanceScore: item.relevanceScore || 70,
            }));
            console.log(`   - Loaded ${pulseTrends.length} market trends from web3 news`);
        } catch (e) {
            console.warn("   - Web3 news fetch failed, brain will run without trends:", e.message);
        }

        const activeBrands = supabase ? await fetchActiveBrands(supabase) : [];
        let registry = activeBrands.length > 0
            ? activeBrands
            : Object.entries(TRACKED_BRANDS).map(([brandId, handle]) => ({
                id: brandId,
                name: brandId,
                xHandle: handle
            }));

        if (brandIdentifier) {
            registry = registry.filter(b =>
                normalize(b.id) === normalize(brandIdentifier)
                || normalize(b.name) === normalize(brandIdentifier)
                || normalize(b.xHandle) === normalize(brandIdentifier)
            );
        }

        const results = [];

        // B. Per-Brand Analysis (Multi-Tenant)
        for (const brand of registry) {
            const brandId = brand.id;
            const handle = brand.xHandle || brand.name;
            console.log(`   > Analyzing Brand: ${brandId} (@${handle})...`);
            if (supabase) {
                const automation = await fetchAutomationSettings(supabase, brandId);
                if (!automation.enabled) {
                    console.log(`     - ⏸️ Automation disabled for ${brandId}. Skipping.`);
                    results.push({ brandId, skipped: true, reason: 'Automation disabled' });
                    continue;
                }
            }

            const rawProfile = supabase ? await fetchBrandProfile(supabase, brandId) : null;
            // Ensure brand name is always set (profile may have name: undefined)
            const brandProfile = { ...(rawProfile || {}), name: rawProfile?.name || brandId };

            // 1. Brand Specific Data
            const [dune, mentions] = await Promise.all([
                fetchDuneMetrics(duneKey), // TODO: Pass brandId to fetch specific dune query
                fetchMentions(apifyKey, handle)
            ]);

            // 2. Analyze (returns { actions: [...] })
            const decisionResult = await analyzeState(dune, [], mentions, pulseTrends, brandProfile);
            const decisions = decisionResult.actions || [decisionResult];

            // 3. Act & Save — process all actions
            let savedAny = false;
            for (const decision of decisions) {
                if (decision.action && decision.action !== 'NO_ACTION' && decision.action !== 'ERROR') {
                    const icon = decision.action === 'REPLY' ? '↩️' : decision.action === 'TREND_JACK' ? '⚡' : decision.action === 'CAMPAIGN' ? '📢' : decision.action === 'GAP_FILL' ? '🎯' : '💬';
                    console.log(`     - ${icon} [${brandId}] ACTION: ${decision.action}`);

                    const record = { ...decision, brandId };
                    saveDecisionToFile(record);
                    await saveDecisionToDb(supabase, decision, brandId);

                    // Notify linked Telegram chats about new decision
                    try {
                        await notifyLinkedChats(supabase, brandId, 'decision', decision);
                    } catch (tgErr) {
                        console.warn(`     - Telegram decision notification failed:`, tgErr.message);
                    }

                    if (!savedAny) {
                        results.push({ brandId, decision });
                        savedAny = true;
                    }
                }
            }
            if (!savedAny) {
                results.push({ brandId, decision: decisions[0] || { action: 'NO_ACTION' }, skipped: true });
            }
        }
        console.log("   - 💤 Agent Cycle Complete.");
        return { label, processed: registry.length, results };

    } catch (error) {
        console.error("   - ❌ Agent Loop Failed:", error.message);
        return { label, error: error.message };
    }
};

export const startAgent = () => {
    console.log("🤖 Agent Scheduled: Online & Monitoring...");
    const supabase = getSupabaseClient();

    // 0. Initial Run (Bootup) - Run once immediately after 5s
    setTimeout(async () => {
        console.log("🚀 Bootup Sequence: Initializing Social Sync...");
        const apifyKey = process.env.APIFY_API_TOKEN;
        const activeBrands = supabase ? await fetchActiveBrands(supabase) : [];
        if (apifyKey) await updateAllBrands(apifyKey, activeBrands);
    }, 5000);

    // Bootup brain cycle removed — the scheduled cron (every 6h) handles this.
    // Running it on every deploy was burning Apify credits (1 actor run per brand per restart).

    // 1. Core Agent Loop (Decision Making) - Every 6 hours (was hourly — reduced to save Apify credits)
    cron.schedule('0 */6 * * *', async () => {
        await runBrainCycle({ label: 'Scheduled Decision Scan', supabaseOverride: supabase });
    });

    // 2. Data Sync Loop (Data Freshness) - Daily at Noon
    cron.schedule('0 12 * * *', async () => {
        console.log(`\n[${new Date().toISOString()}] 🔄 Hourly Sync: Updating Social Cache...`);
        try {
            const apifyKey = process.env.APIFY_API_TOKEN;
            const activeBrands = supabase ? await fetchActiveBrands(supabase) : [];
            await updateAllBrands(apifyKey, activeBrands);
        } catch (e) {
            console.error("   - Sync Failed:", e.message);
        }
    });

    // 3. DAILY BRIEFING GENERATION (06:00 AM)
    cron.schedule('0 6 * * *', async () => {
        console.log(`\n[${new Date().toISOString()}] 🌤️ Morning Briefing: Generating Reports...`);
        try {
            // Generate for all tracked brands
            const activeBrands = supabase ? await fetchActiveBrands(supabase) : [];
            const registry = activeBrands.length > 0
                ? activeBrands
                : Object.keys(TRACKED_BRANDS).map((brandId) => ({ id: brandId }));

            for (const brand of registry) {
                const brandId = brand.id;
                if (supabase) {
                    const automation = await fetchAutomationSettings(supabase, brandId);
                    if (!automation.enabled) {
                        console.log(`   - ⏸️ Automation disabled for ${brandId}. Skipping briefing.`);
                        continue;
                    }
                }
                await generateDailyBriefing(brandId);

                // Send briefing to linked Telegram groups
                try {
                    await notifyLinkedChats(supabase, brandId, 'briefing');
                } catch (tgErr) {
                    console.warn(`   - Telegram briefing notification failed for ${brandId}:`, tgErr.message);
                }
            }
        } catch (e) {
            console.error("   - Morning Generation Failed:", e.message);
        }
    });

    // 4. Retention (Decision Cleanup) - Daily at 01:00 AM
    cron.schedule('0 1 * * *', async () => {
        await pruneOldDecisions(supabase, 30);
    });

    // 5. Nightly backup for decisions (02:00 AM)
    cron.schedule('0 2 * * *', async () => {
        await backupAgentDecisions(supabase);
    });

    // 6. Daily Web3 News Fetch (08:00 AM) - Once per day
    cron.schedule('0 8 * * *', async () => {
        console.log(`\n[${new Date().toISOString()}] 📰 Daily News Sync: Fetching Web3 News...`);
        try {
            const activeBrands = supabase ? await fetchActiveBrands(supabase) : [];
            await scheduledNewsFetch(supabase, activeBrands);
            console.log("   - 📰 Web3 News Sync Complete.");
        } catch (e) {
            console.error("   - News Sync Failed:", e.message);
        }
    });
};

export const triggerAgentRun = async (brandIdentifier) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return { error: 'Supabase not configured' };
    }

    const normalized = (value) => String(value || '').toLowerCase();
    const registry = await fetchActiveBrands(supabase);
    if (!registry || registry.length === 0) {
        return { error: 'No brands registered' };
    }

    const target = registry.find(b => normalized(b.id) === normalized(brandIdentifier))
        || registry.find(b => normalized(b.name) === normalized(brandIdentifier));

    if (!target) {
        return { error: 'Brand not found' };
    }

    const automation = await fetchAutomationSettings(supabase, target.id);
    if (!automation.enabled) {
        return { skipped: true, reason: 'Automation disabled' };
    }

    const duneKey = process.env.DUNE_API_KEY;
    const apifyKey = process.env.APIFY_API_TOKEN;

    // Fetch web3 news as market context
    let pulseTrends = [];
    try {
        const newsResult = await fetchWeb3News(supabase, 'global', { limit: 8 });
        pulseTrends = (newsResult.items || []).map(item => ({
            headline: item.headline || item.topic || 'Unknown',
            summary: item.summary || '',
            sentiment: item.sentiment || 'Neutral',
            relevanceScore: item.relevanceScore || 70,
        }));
    } catch { /* brain runs without trends */ }

    const [dune, mentions] = await Promise.all([
        fetchDuneMetrics(duneKey),
        fetchMentions(apifyKey, target.xHandle || target.name || target.id)
    ]);

    const rawProfile = await fetchBrandProfile(supabase, target.id);
    const brandProfile = { ...(rawProfile || {}), name: rawProfile?.name || target.name || target.id };
    const decisionResult = await analyzeState(dune, [], mentions, pulseTrends, brandProfile);
    const decisions = decisionResult.actions || [decisionResult];

    for (const decision of decisions) {
        if (decision?.action && decision.action !== 'NO_ACTION' && decision.action !== 'ERROR') {
            const record = { ...decision, brandId: target.id };
            saveDecisionToFile(record);
            await saveDecisionToDb(supabase, decision, target.id);

            // Notify linked Telegram chats about new decision
            try {
                await notifyLinkedChats(supabase, target.id, 'decision', decision);
            } catch (tgErr) {
                console.warn(`     - Telegram notification failed:`, tgErr.message);
            }
        }
    }

    return { brand: target, decision: decisions[0] || { action: 'NO_ACTION' } };
};

/**
 * Run briefing generation for all active brands.
 * Called by Vercel cron via /api/agent/briefing endpoint.
 */
export const runBriefingCycle = async ({ label = 'Briefing Cycle' } = {}) => {
    const supabase = getSupabaseClient();
    console.log(`\n[${new Date().toISOString()}] 🌤️ ${label}: Generating Reports...`);

    try {
        const activeBrands = supabase ? await fetchActiveBrands(supabase) : [];
        const registry = activeBrands.length > 0
            ? activeBrands
            : Object.keys(TRACKED_BRANDS).map((brandId) => ({ id: brandId }));

        const results = [];
        for (const brand of registry) {
            const brandId = brand.id;
            if (supabase) {
                const automation = await fetchAutomationSettings(supabase, brandId);
                if (!automation.enabled) {
                    console.log(`   - ⏸️ Automation disabled for ${brandId}. Skipping briefing.`);
                    results.push({ brandId, skipped: true });
                    continue;
                }
            }

            try {
                await generateDailyBriefing(brandId);

                // Notify linked Telegram chats
                try {
                    await notifyLinkedChats(supabase, brandId, 'briefing');
                } catch (tgErr) {
                    console.warn(`   - Telegram briefing notification failed for ${brandId}:`, tgErr.message);
                }

                results.push({ brandId, success: true });
            } catch (e) {
                console.error(`   - Briefing failed for ${brandId}:`, e.message);
                results.push({ brandId, error: e.message });
            }
        }

        console.log(`   - 🌤️ ${label} Complete.`);
        return { label, processed: registry.length, results };
    } catch (e) {
        console.error(`   - ❌ ${label} Failed:`, e.message);
        return { label, error: e.message };
    }
};
