
import { fetchMarketPulse } from './pulse';
import { computeGrowthMetrics } from './analytics';
import { ingestContext } from './rag';
import { TrendItem, CampaignLog } from '../types';
import { loadIntegrationKeys, loadBrandProfiles } from './storage';

/**
 * INGESTION ORCHESTRATOR
 * Bridges the "Scanning" services (Pulse, Analytics) with the "Memory" service (RAG).
 */

export const runMarketScan = async (brandName: string, campaigns: CampaignLog[] = [], brandId?: string) => {
    console.log(`[Ingestion] Starting market scan for ${brandName}...`);
    let count = 0;

    // 1. PROCESS TRENDS (Pulse)
    try {
        const trends = await fetchMarketPulse(brandName);
        for (const trend of trends.slice(0, 5)) { // Top 5 only
            const content = `Trend Alert: "${trend.headline}" is trending. Summary: ${trend.summary}. Relevance: ${trend.relevanceReason}`;
            await ingestContext(content, 'Pulse/LunarCrush', { url: trend.url, score: trend.relevanceScore }, brandId);
            count++;
        }
    } catch (e) {
        console.error("Trend ingestion failed", e);
    }

    // 2. PROCESS ON-CHAIN METRICS (Analytics/Dune)
    try {
        const integrationKeys = loadIntegrationKeys(brandName);
        const brandProfiles = loadBrandProfiles();
        const brand = brandProfiles[brandName];
        const metrics = await computeGrowthMetrics({
            campaigns,
            duneApiKey: process.env.DUNE_API_KEY || integrationKeys.dune,
            duneQueryIds: integrationKeys.duneQueryIds,
            contracts: brand?.blockchain?.contracts || [],
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
            await ingestContext(fact, 'Dune/OnChain', { timestamp: Date.now() }, brandId);
            count++;
        }
    } catch (e) {
        console.error("Metrics ingestion failed", e);
    }

    return count;
};

/**
 * DEEP SOCIAL INGESTION
 * Fetches historical tweets for specific handles and ingests them into Brain Memory.
 */
import { runApifyActor } from './analytics';
import { fetchBrainHistoryEvents } from './storage';
// NOTE: ReferenceImage, BrandConfig, loadBrandProfiles, saveBrandProfiles
// were used for auto-saving images - now disabled to prevent bloat

export const ingestTwitterHistory = async (handles: string[]) => {
    console.log(`[Ingestion] Starting Deep Social Ingestion for: ${handles.join(', ')}`);
    const results = [];
    const ACTOR_TWITTER = 'VsTreSuczsXhhRIqa'; // New unified actor
    const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN
        || (import.meta as any).env?.VITE_APIFY_API_TOKEN
        || process.env.APIFY_API_TOKEN;

    if (!APIFY_TOKEN) {
        throw new Error("Missing APIFY Token");
    }

    for (const handle of handles) {
        try {
            console.log(`[Ingestion] Fetching history for @${handle}...`);
            // Fetch ~30 items per handle for history using new actor
            const tweetItems = await runApifyActor(ACTOR_TWITTER, {
                "handles": [handle],
                "tweetsDesired": 30,
                "profilesDesired": 1,
                "withReplies": false,
                "includeUserInfo": true,
                "proxyConfig": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
            }, APIFY_TOKEN);

            let ingestedCount = 0;
            if (tweetItems && Array.isArray(tweetItems)) {
                for (const item of tweetItems) {
                    // New actor output format
                    const text = item.text;
                    const id = item.id;
                    const date = item.timestamp;

                    // Stats from new actor format
                    const likes = item.likes || 0;
                    const retweets = item.retweets || 0;
                    const replies = item.replies || 0;
                    const quotes = item.quotes || 0;
                    // Estimate engagement rate based on likes (assuming ~2% baseline)
                    const estimatedFollowers = likes > 0 ? likes * 50 : 1000;
                    const engagementRate = ((likes + retweets + replies) / estimatedFollowers) * 100;

                    // Extract Media from new actor format (images array)
                    const mediaUrl = (item.images && item.images.length > 0) ? item.images[0] : null;

                    if (text && text.length > 20) {
                        const content = `Tweet by @${handle}: "${text}"`;
                        const metadata = {
                            type: 'social_history',
                            platform: 'twitter',
                            handle,
                            tweetId: id,
                            date,
                            mediaUrl, // Store image URL
                            stats: { likes, retweets, replies, views },
                            engagementRate: parseFloat(engagementRate.toFixed(2))
                        };

                        // Map handle to Brand ID
                        const brandMap: Record<string, string> = {
                            'EnkiProtocol': 'ENKI Protocol',
                            'NetswapOfficial': 'Netswap',
                            'MetisL2': 'Metis',
                            'LazAINetwork': 'LazAI',
                            'LazaNetwork': 'LazAI'
                        };
                        const brandId = brandMap[handle] || handle;

                        // INGEST
                        await ingestContext(content, `Twitter/@${handle}`, metadata, brandId);
                        ingestedCount++;

                        // NOTE: Auto-save of tweet images to Brand Kit DISABLED
                        // Images should only be added to referenceImages when explicitly:
                        // 1. Saved by user from generated content
                        // 2. Added to a campaign
                        // 3. Posted/published
                        // This prevents referenceImages from bloating with every scraped tweet
                    }
                }
            }
            results.push({ handle, status: 'success', count: ingestedCount });

        } catch (e: any) {
            console.error(`[Ingestion] Failed for @${handle}`, e);
            results.push({ handle, status: 'failed', error: e.message });
        }
    }

    return results;
};

/**
 * BACKFILL: Sync History Images to Reference Images
 * DEPRECATED: This function is disabled to prevent referenceImages bloat.
 * Images should only be added when explicitly saved/posted by the user.
 * Kept for backwards compatibility but returns 0.
 */
export const syncHistoryToReferenceImages = async (brandName: string) => {
    console.log(`[Ingestion] syncHistoryToReferenceImages DISABLED - images should only be added explicitly`);
    // NOTE: Auto-sync of history images to Brand Kit DISABLED
    // Images should only be added to referenceImages when explicitly:
    // 1. Saved by user from generated content
    // 2. Added to a campaign
    // 3. Posted/published
    // This prevents referenceImages from bloating with every historical tweet
    return 0;
};

/**
 * FETCH AGENT DECISIONS (Backend Bridge)
 * Retrieves pending decisions made by the autonomous agent (server/brain.js).
 */
export const fetchAgentDecisions = async (brandName: string): Promise<any[]> => {
    try {
        // We use the proxy endpoint in server.js
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await fetch(`${baseUrl}/api/decisions`);
        if (!response.ok) return [];

        const allDecisions = await response.json();
        if (!Array.isArray(allDecisions)) return [];

        // Filter for this brand
        // Note: The backend agent currently might not save brandId nicely in the flat file or logic needs check.
        // But assuming the saveDecision in scheduler.js saves 'brandId', we filter.
        return allDecisions.filter((d: any) =>
            d.brandId && d.brandId.toLowerCase() === brandName.toLowerCase() && d.status === 'pending'
        );
    } catch (e) {
        console.warn("Agent bridge offline (is server.js running?)", e);
        return [];
    }
};
