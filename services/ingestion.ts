
import { fetchMarketPulse } from './pulse';
import { computeGrowthMetrics } from './analytics';
import { ingestContext } from './rag';
import { TrendItem, CampaignLog } from '../types';
import { loadIntegrationKeys } from './storage';

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
        const metrics = await computeGrowthMetrics({
            campaigns,
            duneApiKey: process.env.DUNE_API_KEY,
            duneQueryIds: integrationKeys.duneQueryIds,
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
import { loadBrandProfiles, saveBrandProfiles, fetchBrainHistoryEvents } from './storage';
import { ReferenceImage, BrandConfig } from '../types';

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

                        // --- AUTO-SAVE HIGH QUALITY IMAGES TO BRAND KIT ---
                        // Criteria: Has Media + Decent Engagement (Rate > 1% OR > 50 Likes)
                        if (mediaUrl && (engagementRate > 1.0 || likes > 50)) {
                            // De-duplicate check happens inside brands
                            try {
                                const profiles = loadBrandProfiles();
                                const config = profiles[brandId];

                                if (config) {
                                    const existingImages = config.referenceImages || [];
                                    // Check if we already have this image (by ID check or naive check)
                                    // We'll use a simple "Source ID" check effectively stored as ID
                                    const alreadySaved = existingImages.some(img => img.id === `tweet-${id}`);

                                    if (!alreadySaved) {
                                        console.log(`[Ingestion] Auto-saving Tweet Image to Brand Kit: ${id}`);

                                        // Fetch and Convert
                                        const imgRes = await fetch(mediaUrl);
                                        const blob = await imgRes.blob();
                                        const base64 = await new Promise<string>((resolve) => {
                                            const reader = new FileReader();
                                            reader.onloadend = () => resolve(reader.result as string);
                                            reader.readAsDataURL(blob);
                                        });

                                        const newRefImage: ReferenceImage = {
                                            id: `tweet-${id}`,
                                            url: mediaUrl,
                                            data: base64,
                                            name: `Tweet ${date.substring(0, 10)}`
                                        };

                                        // Update and Save
                                        config.referenceImages = [...existingImages, newRefImage];
                                        profiles[brandId] = config;
                                        saveBrandProfiles(profiles);
                                    }
                                }
                            } catch (err) {
                                console.warn("Failed to auto-save tweet image", err);
                            }
                        }
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
 * Scans all "History" events for a brand and adds any images found to the Brand Kit.
 */
export const syncHistoryToReferenceImages = async (brandName: string) => {
    console.log(`[Ingestion] Syncing history images for ${brandName}...`);
    try {
        const events = await fetchBrainHistoryEvents(brandName);
        const profiles = loadBrandProfiles();
        const config = profiles[brandName];
        let addedCount = 0;

        if (config) {
            const existingImages = config.referenceImages || [];

            for (const event of events) {
                // Must have image + be from history
                if (event.image && event.id.startsWith('history-')) {
                    const tweetId = event.id.replace('history-', '');
                    const refId = `tweet-${tweetId}`;

                    // Use existing check logic
                    const alreadySaved = existingImages.some(img => img.id === refId);

                    if (!alreadySaved) {
                        try {
                            // Fetch and Convert
                            const imgRes = await fetch(event.image);
                            const blob = await imgRes.blob();
                            const base64 = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result as string);
                                reader.readAsDataURL(blob);
                            });

                            const newRefImage: ReferenceImage = {
                                id: refId,
                                url: event.image,
                                data: base64,
                                name: `History ${event.date}`
                            };

                            existingImages.push(newRefImage);
                            addedCount++;
                        } catch (e) {
                            console.warn(`Failed to process history image ${event.id}`, e);
                        }
                    }
                }
            }

            if (addedCount > 0) {
                config.referenceImages = existingImages;
                profiles[brandName] = config;
                saveBrandProfiles(profiles);
                console.log(`[Ingestion] Added ${addedCount} historical images to Brand Kit.`);
            }
        }
        return addedCount;
    } catch (e) {
        console.error("Failed to sync history images", e);
        throw e;
    }
};

/**
 * FETCH AGENT DECISIONS (Backend Bridge)
 * Retrieves pending decisions made by the autonomous agent (server/brain.js).
 */
export const fetchAgentDecisions = async (brandName: string): Promise<any[]> => {
    try {
        // We use the proxy endpoint in server.js
        const response = await fetch('http://localhost:3001/api/decisions');
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
