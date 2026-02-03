import cron from 'node-cron';
import { fetchDuneMetrics, fetchLunarCrushTrends, fetchMentions, fetchPulseTrends, updateAllBrands, TRACKED_BRANDS } from './ingest.js'; // Legacy fallback
import { analyzeState } from './brain.js';
import { generateDailyBriefing } from './generator.js'; // Import Generator
import { fetchAutomationSettings, fetchBrandProfile, getSupabaseClient } from './brandContext.js';
import { fetchActiveBrands } from './brandRegistry.js';

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

export const startAgent = () => {
    console.log("🤖 Agent Scheduled: Online & Monitoring...");
    const supabase = getSupabaseClient();

    const runBrainCycle = async (label) => {
        console.log(`\n[${new Date().toISOString()}] 🧠 Agent Cycle: ${label}`);

        const duneKey = process.env.DUNE_API_KEY;
        const lunarKey = process.env.VITE_LUNARCRUSH_API_KEY || process.env.LUNARCRUSH_API_KEY;
        const apifyKey = process.env.APIFY_API_TOKEN;

        try {
            // A. Global Context (Fetch Once)
            console.log("   - Scanning global market trends...");
            const [pulse, lunarTrends] = await Promise.all([
                fetchPulseTrends(lunarKey),
                fetchLunarCrushTrends(lunarKey, 'ETH') // Global sentiment
            ]);

            const activeBrands = supabase ? await fetchActiveBrands(supabase) : [];
            const registry = activeBrands.length > 0
                ? activeBrands
                : Object.entries(TRACKED_BRANDS).map(([brandId, handle]) => ({
                    id: brandId,
                    name: brandId,
                    xHandle: handle
                }));

            // B. Per-Brand Analysis (Multi-Tenant)
            for (const brand of registry) {
                const brandId = brand.id;
                const handle = brand.xHandle || brand.name;
                console.log(`   > Analyzing Brand: ${brandId} (@${handle})...`);
                if (supabase) {
                    const automation = await fetchAutomationSettings(supabase, brandId);
                    if (!automation.enabled) {
                        console.log(`     - ⏸️ Automation disabled for ${brandId}. Skipping.`);
                        continue;
                    }
                }

                const brandProfile = supabase ? await fetchBrandProfile(supabase, brandId) : null;

                // 1. Brand Specific Data
                const [dune, mentions] = await Promise.all([
                    fetchDuneMetrics(duneKey), // TODO: Pass brandId to fetch specific dune query
                    fetchMentions(apifyKey, handle)
                ]);

                // 2. Analyze
                const decision = await analyzeState(dune, lunarTrends, mentions, pulse, brandProfile || {});

                // 3. Act & Save
                if (decision.action !== 'NO_ACTION') {
                    const icon = decision.action === 'REPLY' ? '↩️' : decision.action === 'TREND_JACK' ? '⚡' : '📢';
                    console.log(`     - ${icon} [${brandId}] ACTION: ${decision.action}`);

                    const record = { ...decision, brandId };
                    saveDecisionToFile(record);
                    await saveDecisionToDb(supabase, decision, brandId);
                }
            }
            console.log("   - 💤 Agent Cycle Complete.");

        } catch (error) {
            console.error("   - ❌ Agent Loop Failed:", error.message);
        }
    };

    // 0. Initial Run (Bootup) - Run once immediately after 5s
    setTimeout(async () => {
        console.log("🚀 Bootup Sequence: Initializing Social Sync...");
        const apifyKey = process.env.APIFY_API_TOKEN;
        const activeBrands = supabase ? await fetchActiveBrands(supabase) : [];
        if (apifyKey) await updateAllBrands(apifyKey, activeBrands);
    }, 5000);

    setTimeout(async () => {
        await runBrainCycle('Bootup Decision Scan');
    }, 8000);

    // 1. Core Agent Loop (Decision Making) - Hourly
    cron.schedule('0 * * * *', async () => {
        await runBrainCycle('Hourly Decision Scan');
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
    const lunarKey = process.env.VITE_LUNARCRUSH_API_KEY || process.env.LUNARCRUSH_API_KEY;
    const apifyKey = process.env.APIFY_API_TOKEN;

    const [pulse, lunarTrends] = await Promise.all([
        fetchPulseTrends(lunarKey),
        fetchLunarCrushTrends(lunarKey, target.lunarSymbol || 'ETH')
    ]);

    const [dune, mentions] = await Promise.all([
        fetchDuneMetrics(duneKey),
        fetchMentions(apifyKey, target.xHandle || target.name || target.id)
    ]);

    const brandProfile = await fetchBrandProfile(supabase, target.id);
    const decision = await analyzeState(dune, lunarTrends, mentions, pulse, brandProfile || { name: target.name });

    if (decision?.action && decision.action !== 'NO_ACTION' && decision.action !== 'ERROR') {
        const record = { ...decision, brandId: target.id };
        saveDecisionToFile(record);
        await saveDecisionToDb(supabase, decision, target.id);
    }

    return { brand: target, decision };
};
