import { CampaignLog, ComputedMetrics, GrowthInput, SocialMetrics, SocialPost } from "../types";
import { getIntegrationConfig } from "../config/integrations";


/**
 * APIFY INTEGRATION
 */
const DEFAULT_APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';
// Ensure APIFY token is present; if missing, operations will fallback to cache.
if (!process.env.APIFY_API_TOKEN) {
    console.warn('[Apify] APIFY_API_TOKEN is not set. Social metrics will rely on cache or fallback data.');
}

// Actor IDs
const ACTOR_PROFILE = 'wbpC5fjeAxy06bonV';
const ACTOR_TWEETS = '61RPP7dywgiy0JPD0';


export const getHandle = (brandName: string) => {
    const config = getIntegrationConfig(brandName);
    return config?.apify?.twitterHandle || 'MetisL2';
};

/**
 * Helper to run an Apify Actor and wait for results
 */
const runApifyActor = async (actorId: string, input: any, token: string) => {
    try {
        // 1. Start Execution
        // Increased wait time to 90s to avoid timeouts on cold starts
        const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&waitForFinish=90`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        const runData = await response.json();

        // Check for success
        if (!runData.data || (runData.data.status !== 'SUCCEEDED' && runData.data.status !== 'RUNNING')) {
            // If 401/403, throw specific error
            if (response.status === 401 || response.status === 403) {
                throw new Error("Invalid API Key");
            }
            console.warn(`[Apify] Actor ${actorId} failed:`, runData.data?.status);
            throw new Error(`Actor Status: ${runData.data?.status || 'Unknown'}`);
        }

        // 2. Fetch Results
        const datasetId = runData.data.defaultDatasetId;
        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
        const items = await itemsRes.json();
        return items;

    } catch (e: any) {
        console.error(`[Apify] Error running actor ${actorId}:`, e);
        throw e;
    }
};

export const fetchSocialMetrics = async (brandName: string, userApiKey?: string): Promise<SocialMetrics> => {
    const handle = getHandle(brandName);
    const fallback = getSocialMetrics(brandName);

    // 1. Try Fetching Cached Daily Stats (Server-Side)
    let cachedStats: any = null;
    try {
        const cacheRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/social-metrics/${brandName}`);
        if (cacheRes.ok) {
            cachedStats = await cacheRes.json();
            if (cachedStats.totalFollowers) {
                console.log(`[Analytics] Using Cached Follower Count: ${cachedStats.totalFollowers}`);
            }
        }
    } catch (e) {
        console.warn("[Analytics] Cache fetch failed. Backend might be offline.", e);
        // Explicitly track that backend failed
        cachedStats = { error: "BACKEND_OFFLINE" };
    }

    // LOGIC: Use user key if it looks valid (starts with apify_api_), otherwise default
    const token = (userApiKey && userApiKey.startsWith('apify_api_')) ? userApiKey : DEFAULT_APIFY_TOKEN;

    // If no valid token AND no cache, return fallback immediately
    if (!token && (!cachedStats || !cachedStats.totalFollowers)) {
        console.log("[Apify] No valid API key provided and no cache available. Returning fallback data.");
        return {
            ...fallback,
            isLive: false,
            // Pass the specific error if we caught one
            error: cachedStats?.error === "BACKEND_OFFLINE" ? "BACKEND_OFFLINE" : undefined
        };
    }

    console.log(`[Apify] Starting fresh fetch for @${handle} using token ending in ...${token ? token.slice(-4) : 'NONE'}`);

    // If cache provided a valid follower count, we can skip live profile fetch.
    if (cachedStats && typeof cachedStats.totalFollowers === 'number' && cachedStats.totalFollowers > 0) {

        // OPTIMIZATION: Use Cached Posts if available (from Daily Sync)
        if (cachedStats.recentPosts && cachedStats.recentPosts.length > 0) {
            console.log(`[Analytics] Using ${cachedStats.recentPosts.length} Cached Tweets.`);
            // Map cached posts to SocialPost type (ensure impressions calculated)
            const posts: SocialPost[] = cachedStats.recentPosts.map((p: any) => ({
                id: p.id,
                content: p.content,
                date: p.date,
                likes: p.likes,
                comments: p.comments,
                retweets: p.retweets,
                impressions: Math.floor((p.likes + p.retweets + p.comments) * 20) || Math.floor(cachedStats.totalFollowers * 0.1), // Est
                engagementRate: parseFloat((((p.likes + p.comments) / cachedStats.totalFollowers) * 100).toFixed(2))
            }));

            return {
                totalFollowers: cachedStats.totalFollowers,
                weeklyImpressions: cachedStats.weeklyImpressions ?? posts.reduce((a, b) => a + b.impressions, 0) * 2,
                engagementRate: cachedStats.engagementRate ?? parseFloat((posts.reduce((a, b) => a + b.engagementRate, 0) / posts.length).toFixed(2)),
                mentions: cachedStats.mentions ?? 0,
                topPost: posts[0]?.content || "No recent posts found",
                recentPosts: posts,
                engagementHistory: cachedStats.engagementHistory ?? [],
                comparison: cachedStats.comparison ?? { period: 'vs Last Week', followersChange: 0, engagementChange: 0, impressionsChange: 0 },
                isLive: true
            };
        }

        // Fallback: Still fetch recent tweets for activity if cache is missing posts
        try {
            const tweetItems = await runApifyActor(ACTOR_TWEETS, {
                "twitterHandles": [handle],
                "maxItems": 10,
                "sort": "Latest",
                "tweetLanguage": "en",
                "author": handle,
                "proxy": { "useApifyProxy": true }
            }, token);
            // Process tweets as before (omitted for brevity) – reuse existing tweet processing logic.
            const realRecentPosts: SocialPost[] = tweetItems.map((item: any) => {
                const likes = item.favorite_count || item.likes || 0;
                const comments = item.reply_count || item.replies || 0;
                const retweets = item.retweet_count || item.retweets || 0;
                const views = item.view_count || item.views || 0;
                const impressions = views > 0 ? views : (cachedStats.totalFollowers * 0.15);
                const engagementRate = cachedStats.totalFollowers > 0 ? ((likes + comments + retweets) / cachedStats.totalFollowers) * 100 : 0;
                return {
                    id: item.id_str || item.id || Math.random().toString(),
                    content: item.full_text || item.text || "Media Post",
                    date: item.created_at ? new Date(item.created_at).toLocaleDateString() : "Recent",
                    likes,
                    comments,
                    retweets,
                    impressions: Math.floor(impressions),
                    engagementRate: parseFloat(engagementRate.toFixed(2))
                };
            });
            return {
                totalFollowers: cachedStats.totalFollowers,
                weeklyImpressions: cachedStats.weeklyImpressions ?? 0,
                engagementRate: cachedStats.engagementRate ?? 0,
                mentions: cachedStats.mentions ?? 0,
                topPost: realRecentPosts[0]?.content || cachedStats.topPost || "No recent posts found",
                recentPosts: realRecentPosts,
                engagementHistory: cachedStats.engagementHistory ?? [],
                comparison: cachedStats.comparison ?? { period: 'vs Last Week', followersChange: 0, engagementChange: 0, impressionsChange: 0 },
                isLive: true
            };
        } catch (e) {
            console.warn('[Apify] Tweet fetch failed while using cache fallback:', e);
            // Return cache data with minimal live flag.
            return {
                ...cachedStats,
                isLive: true,
                recentPosts: []
            };
        }
    }

    // No usable cache – proceed with live profile + tweet fetch as originally implemented.
    try {
        // PARALLEL EXECUTION: Fetch Profile (if no cache) AND Tweets simultaneously
        const promises = [];

        // Only fetch profile from Apify if we DON'T have a cache
        if (!cachedStats?.totalFollowers) {
            promises.push(
                runApifyActor(ACTOR_PROFILE, {
                    "startUrls": [`https://twitter.com/${handle}`],
                    "maxTweetsPerUser": 3,
                    "onlyUserInfo": false, // We just want the user info primarily
                    "addUserInfo": true,
                    "proxy": { "useApifyProxy": true }
                }, token).catch(e => { console.warn("Profile fetch failed", e); return []; })
            );
        } else {
            promises.push(Promise.resolve([])); // resolve empty if cached
        }

        // Always fetch tweets for "Recent Activity" (or we could cache this too, but live is better for feed)
        promises.push(
            runApifyActor(ACTOR_TWEETS, {
                "twitterHandles": [handle],
                "maxItems": 10,
                "sort": "Latest",
                "tweetLanguage": "en",
                "author": handle,
                "proxy": { "useApifyProxy": true }
            }, token).catch(e => { console.warn("Tweet fetch failed", e); return []; })
        );

        const [profileItems, tweetItems] = await Promise.all(promises);

        // PROCESS PROFILE
        let realFollowers = cachedStats?.totalFollowers || 0; // Default to Cache logic
        let foundProfile = !!cachedStats?.totalFollowers;

        if (!foundProfile && profileItems && profileItems.length > 0) {
            const item = profileItems[0];
            const user = item.user || item.author || (item.username ? item : null);
            if (user) {
                realFollowers = user.followers_count || user.followers || 0;
                foundProfile = true;
            }
        }

        // Backup: Extract user info from tweets
        if (!foundProfile && tweetItems && tweetItems.length > 0) {
            const firstTweet = tweetItems[0];
            const user = firstTweet.user || firstTweet.author;
            if (user) {
                realFollowers = user.followers_count || user.followers || 0;
                foundProfile = true;
            }
        }

        // PROCESS TWEETS
        let realRecentPosts: SocialPost[] = [];

        if (tweetItems && tweetItems.length > 0) {
            realRecentPosts = tweetItems.map((item: any) => {
                const likes = item.favorite_count || item.likes || 0;
                const comments = item.reply_count || item.replies || 0;
                const retweets = item.retweet_count || item.retweets || 0;
                const views = item.view_count || item.views || 0;

                const impressions = views > 0 ? views : (realFollowers * 0.15);

                const engagementRate = realFollowers > 0
                    ? ((likes + comments + retweets) / realFollowers) * 100
                    : 0;

                return {
                    id: item.id_str || item.id || Math.random().toString(),
                    content: item.full_text || item.text || "Media Post",
                    date: item.created_at ? new Date(item.created_at).toLocaleDateString() : "Recent",
                    likes,
                    comments,
                    retweets,
                    impressions: Math.floor(impressions),
                    engagementRate: parseFloat(engagementRate.toFixed(2))
                };
            });
        }

        if (!foundProfile && realRecentPosts.length === 0) {
            throw new Error("No data returned (Empty Dataset)");
        }

        const avgEng = realRecentPosts.length > 0
            ? realRecentPosts.reduce((acc, p) => acc + p.engagementRate, 0) / realRecentPosts.length
            : 0;

        const totalImpressions = realRecentPosts.reduce((acc, p) => acc + p.impressions, 0);

        return {
            totalFollowers: realFollowers,
            weeklyImpressions: totalImpressions > 0 ? totalImpressions * 2 : fallback.weeklyImpressions,
            engagementRate: parseFloat(avgEng.toFixed(2)),
            mentions: fallback.mentions,
            topPost: realRecentPosts[0]?.content || "No recent posts found",
            recentPosts: realRecentPosts,
            engagementHistory: fallback.engagementHistory,
            comparison: {
                period: 'vs Last Week',
                followersChange: 0,
                engagementChange: 0,
                impressionsChange: 0
            },
            isLive: true
        };

    } catch (error: any) {
        console.error("[Apify] Fetch failed, using fallback:", error);
        return {
            ...fallback,
            totalFollowers: cachedStats?.totalFollowers || 0, // Keep cached followers if available
            isLive: false,
            error: error.message || "Connection Failed"
        };
    }
};

export const getSocialMetrics = (brandName: string): SocialMetrics => {
    // Return Empty structure. Live data is required.
    return {
        totalFollowers: 0,
        weeklyImpressions: 0,
        engagementRate: 0,
        mentions: 0,
        topPost: "Connect Data Source",
        recentPosts: [],
        engagementHistory: [],
        comparison: { period: 'vs Last Week', followersChange: 0, engagementChange: 0, impressionsChange: 0 },
        isLive: false,
        error: "Connect Data Source"
    };
};

/**
 * SIMULATION ENGINE
 * Note: In a production environment, this would call the Dune API or a specialized Indexer.
 */




/**
 * DUNE ANALYTICS INTEGRATION (ENHANCED)
 */

type DuneResult<T> = T[];

// 1. Define strict interfaces for expected Dune Data
interface DuneVolumeRow {
    block_time: string;
    amount_usd: number;
    tx_hash: string;
}

interface DuneUserRow {
    wallet_address: string;
    first_seen: string;
    last_seen: string;
    tx_count: number;
}

interface DuneRetentionRow {
    week: string;
    cohort_size: number;
    retained_users: number;
    retention_rate: number;
}

const fetchDuneQuery = async <T>(queryId: string, apiKey: string): Promise<DuneResult<T>> => {
    if (!queryId || queryId === '3467812') throw new Error("Invalid or Placeholder Query ID");

    const response = await fetch(`https://api.dune.com/api/v1/query/${queryId}/results?api_key=${apiKey}`, {
        method: 'GET',
    });

    if (!response.ok) {
        // Handle specific Dune errors
        if (response.status === 401) throw new Error("Invalid Dune API Key");
        if (response.status === 404) throw new Error("Dune Query Not Found");
        throw new Error(`Dune API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result?.rows || [];
};

export const computeGrowthMetrics = async (input: GrowthInput): Promise<ComputedMetrics> => {
    const duneKey = input.duneApiKey || process.env.DUNE_API_KEY;
    const queryIds = input.duneQueryIds || {};

    let totalVolume = 0;
    let netNewWallets = 0;
    let activeWallets = 0;
    let retentionRate = 0;
    let tvlChange = 0;

    // --- 1. FETCH REAL DATA IF CONFIGURED ---
    if (duneKey) {
        try {
            console.log("Fetching On-Chain Data from Dune...");

            // A. VOLUME & TVL (Parallel Promise if IDs exist)
            const promises = [];

            if (queryIds.volume) {
                promises.push(fetchDuneQuery<DuneVolumeRow>(queryIds.volume, duneKey).then(rows => {
                    totalVolume = rows.reduce((sum, r) => sum + (r.amount_usd || 0), 0);
                    tvlChange = totalVolume * 0.85; // Simple heuristic for now
                }).catch(e => console.warn("Failed to fetch Volume:", e)));
            }

            if (queryIds.users) {
                promises.push(fetchDuneQuery<DuneUserRow>(queryIds.users, duneKey).then(rows => {
                    netNewWallets = rows.filter(r => {
                        const firstSeen = new Date(r.first_seen).getTime();
                        return (Date.now() - firstSeen) < (30 * 24 * 60 * 60 * 1000); // New in last 30d
                    }).length;
                    activeWallets = rows.length; // Assuming query returns all active
                }).catch(e => console.warn("Failed to fetch Users:", e)));
            }

            if (queryIds.retention) {
                promises.push(fetchDuneQuery<DuneRetentionRow>(queryIds.retention, duneKey).then(rows => {
                    // Average the last 4 weeks
                    if (rows.length > 0) {
                        const recent = rows.slice(0, 4);
                        retentionRate = recent.reduce((sum, r) => sum + (r.retention_rate || 0), 0) / recent.length;
                    }
                }).catch(e => console.warn("Failed to fetch Retention:", e)));
            }

            if (promises.length > 0) {
                await Promise.all(promises);
            } else {
                throw new Error("No specific Query IDs configured.");
            }

        } catch (e) {
            console.warn("Dune data fetch failed. Returning zero metrics (Live Mode).", e);
            // No simulation fallback
            totalVolume = 0;
            netNewWallets = 0;
            activeWallets = 0;
            retentionRate = 0;
            tvlChange = 0;
        }
    } else {
        // No Key = Return Zeros
        console.warn("No Dune API Key provided. Returning zero metrics.");
        totalVolume = 0;
        netNewWallets = 0;
        activeWallets = 0;
        retentionRate = 0;
        tvlChange = 0;
    }

    // --- 2. CAMPAIGN ATTRIBUTION ---
    // Return empty attribution until granular wallet data is fully implemented.
    const campaignPerformance: any[] = [];


    return {
        totalVolume,
        netNewWallets,
        activeWallets,
        retentionRate,
        tvlChange,
        campaignPerformance
    };
};

export interface Mention {
    id: string;
    text: string;
    author: string;
    timestamp: string;
}

export const fetchMentions = async (brandName: string, apiKey?: string): Promise<Mention[]> => {
    // Real Implementation
    const token = apiKey || DEFAULT_APIFY_TOKEN;
    if (!token) return [];

    try {
        console.log(`[Apify] Fetching mentions for @${brandName}...`);
        const items = await runApifyActor(ACTOR_TWEETS, {
            "searchTerms": [`@${brandName}`, brandName],
            "maxItems": 5,
            "sort": "Latest",
            "tweetLanguage": "en",
            "proxy": { "useApifyProxy": true }
        }, token);

        if (!items || items.length === 0) return [];

        return items.map((item: any) => ({
            id: item.id_str || item.id,
            author: item.user?.screen_name || item.author || "Unknown",
            text: item.full_text || item.text || "",
            timestamp: item.created_at || new Date().toISOString()
        }));

    } catch (e) {
        console.warn("[Apify] Mentions fetch failed:", e);
        return [];
    }
};
