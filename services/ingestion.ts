
import { fetchMarketPulse } from './pulse';
import { computeGrowthMetrics } from './analytics';
import { ingestContext } from './rag';
import { TrendItem, CampaignLog } from '../types';

/**
 * INGESTION ORCHESTRATOR
 * Bridges the "Scanning" services (Pulse, Analytics) with the "Memory" service (RAG).
 */

export const runMarketScan = async (brandName: string, campaigns: CampaignLog[] = []) => {
    console.log(`[Ingestion] Starting market scan for ${brandName}...`);
    let count = 0;

    // 1. PROCESS TRENDS (Pulse)
    try {
        const trends = await fetchMarketPulse(brandName);
        for (const trend of trends.slice(0, 5)) { // Top 5 only
            const content = `Trend Alert: "${trend.headline}" is trending. Summary: ${trend.summary}. Relevance: ${trend.relevanceReason}`;
            await ingestContext(content, 'Pulse/LunarCrush', { url: trend.url, score: trend.relevanceScore });
            count++;
        }
    } catch (e) {
        console.error("Trend ingestion failed", e);
    }

    // 2. PROCESS ON-CHAIN METRICS (Analytics/Dune)
    try {
        const metrics = await computeGrowthMetrics({
            campaigns,
            duneApiKey: process.env.DUNE_API_KEY,
            contracts: [],
            excludedWallets: []
        });

        // Break down metrics into digestible facts
        const facts = [
            `Current Total Volume for ${brandName} ecosystem is $${metrics.totalVolume.toLocaleString()}.`,
            `Net New Wallets acquired recently: ${metrics.netNewWallets}.`,
            `Active Wallet count is ${metrics.activeWallets}, with a retention rate of ${metrics.retentionRate.toFixed(1)}%.`,
            `TVL Change is estimated at $${metrics.tvlChange.toLocaleString()}.`
        ];

        for (const fact of facts) {
            await ingestContext(fact, 'Dune/OnChain', { timestamp: Date.now() });
            count++;
        }
    } catch (e) {
        console.error("Metrics ingestion failed", e);
    }

    return count;
};
