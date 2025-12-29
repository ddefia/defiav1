import cron from 'node-cron';
import { fetchDuneMetrics, fetchLunarCrushTrends, fetchMentions, fetchPulseTrends, updateAllBrands } from './ingest.js';
import { analyzeState } from './brain.js';

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
const saveDecision = (decision) => {
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

export const startAgent = () => {
    console.log("🤖 Agent Scheduled: Online & Monitoring...");

    // 0. Initial Run (Bootup) - Run once immediately after 5s
    setTimeout(async () => {
        console.log("🚀 Bootup Sequence: Initializing Social Sync...");
        const apifyKey = process.env.APIFY_API_TOKEN;
        if (apifyKey) await updateAllBrands(apifyKey);
    }, 5000);

    // 1. Core Agent Loop (Decision Making) - Every 6 Hours (Testing Mode)
    cron.schedule('0 */6 * * *', async () => {
        console.log(`\n[${new Date().toISOString()}] 🧠 Agent Waking Up (Testing Mode)...`);

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

            // B. Per-Brand Analysis (Multi-Tenant)
            // Import dynamically or use the one we just exported if in same file structure (It is)
            const { TRACKED_BRANDS } = await import('./ingest.js');

            for (const [brandId, handle] of Object.entries(TRACKED_BRANDS)) {
                console.log(`   > Analyzing Brand: ${brandId} (@${handle})...`);

                // 1. Brand Specific Data
                const [dune, mentions] = await Promise.all([
                    fetchDuneMetrics(duneKey), // TODO: Pass brandId to fetch specific dune query
                    fetchMentions(apifyKey, handle)
                ]);

                // 2. Analyze
                const decision = await analyzeState(dune, lunarTrends, mentions, pulse);

                // 3. Act & Save
                if (decision.action !== 'NO_ACTION') {
                    const icon = decision.action === 'REPLY' ? '↩️' : decision.action === 'TREND_JACK' ? '⚡' : '📢';
                    console.log(`     - ${icon} [${brandId}] ACTION: ${decision.action}`);

                    saveDecision({
                        ...decision,
                        brandId: brandId // Critical for Isolation
                    });
                }
            }
            console.log("   - 💤 Agent Cycle Complete.");

        } catch (error) {
            console.error("   - ❌ Agent Loop Failed:", error.message);
        }
    });

    // 2. Data Sync Loop (Data Freshness) - Every Hour
    cron.schedule('0 * * * *', async () => {
        console.log(`\n[${new Date().toISOString()}] 🔄 Hourly Sync: Updating Social Cache...`);
        try {
            const apifyKey = process.env.APIFY_API_TOKEN;
            await updateAllBrands(apifyKey);
        } catch (e) {
            console.error("   - Sync Failed:", e.message);
        }
    });
};
