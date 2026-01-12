
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

/**
 * DEEP SOCIAL INGESTION
 * Fetches historical tweets for specific handles and ingests them into Brain Memory.
 */
import { runApifyActor } from './analytics';

export const ingestTwitterHistory = async (handles: string[]) => {
    console.log(`[Ingestion] Starting Deep Social Ingestion for: ${handles.join(', ')}`);
    const results = [];
    const ACTOR_TWEETS = '61RPP7dywgiy0JPD0';
    const APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN || (import.meta as any).env?.VITE_APIFY_API_TOKEN;

    if (!APIFY_TOKEN) {
        throw new Error("Missing APIFY Token");
    }

    for (const handle of handles) {
        try {
            console.log(`[Ingestion] Fetching history for @${handle}...`);
            // Fetch ~30 items per handle for history
            const tweetItems = await runApifyActor(ACTOR_TWEETS, {
                "twitterHandles": [handle],
                "maxItems": 30,
                "sort": "Latest",
                "tweetLanguage": "en",
                "author": handle,
                "proxy": { "useApifyProxy": true }
            }, APIFY_TOKEN);

            let ingestedCount = 0;
            if (tweetItems && Array.isArray(tweetItems)) {
                for (const item of tweetItems) {
                    const text = item.full_text || item.text;
                    const id = item.id_str || item.id;
                    const date = item.created_at || item.createdAt;

                    // Stats
                    const likes = item.favorite_count || item.likeCount || 0;
                    const retweets = item.retweet_count || item.retweetCount || 0;
                    const replies = item.reply_count || item.replyCount || 0;
                    const views = item.view_count || item.viewCount || 0;
                    const engagementRate = ((likes + retweets + replies) / (item.user?.followers_count || 1000)) * 100;

                    // Extract Media
                    const mediaUrl = item.entities?.media?.[0]?.media_url_https
                        || item.extended_entities?.media?.[0]?.media_url_https
                        || item.media?.[0]?.media_url_https
                        || (item.media && item.media.length > 0 ? item.media[0].media_url_https : null)
                        || null;

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
