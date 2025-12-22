import cron from 'node-cron';
import { fetchDuneMetrics, fetchLunarCrushTrends, fetchMentions, fetchPulseTrends, updateAllBrands } from './ingest.js';
import { analyzeState } from './brain.js';

/**
 * SCHEDULER SERVICE
 * "The Heartbeat"
 */

export const startAgent = () => {
    console.log("🤖 Agent Scheduled: Running every 15 minutes...");

    // 1. Core Agent Loop (Decision Making) - Every 15 mins
    cron.schedule('*/15 * * * *', async () => {
        console.log(`\n[${new Date().toISOString()}] 🧠 Agent Waking Up...`);

        const duneKey = process.env.DUNE_API_KEY;
        const lunarKey = process.env.VITE_LUNARCRUSH_API_KEY; // Or standard env
        const apifyKey = process.env.APIFY_API_TOKEN;

        // 1. Ingest
        if (decision.action !== 'NO_ACTION') {
            const icon = decision.action === 'REPLY' ? '↩️' : decision.action === 'TREND_JACK' ? '⚡' : '📢';
            console.log(`   - ${icon} ACTION: ${decision.action} (${decision.reason})`);
            console.log(`   - 📝 DRAFT: "${decision.draft}"`);
        } else {
            console.log(`   - 💤 Mode: Sleep (No high-priority triggers)`);
        }
    });
};
