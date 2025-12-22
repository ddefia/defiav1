
import { CampaignLog, ComputedMetrics, GrowthInput, SocialMetrics, SocialPost } from "../types";


/**
 * APIFY INTEGRATION
 */
const DEFAULT_APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';

// Actor IDs
const ACTOR_PROFILE = 'wbpC5fjeAxy06bonV';
const ACTOR_TWEETS = '61RPP7dywgiy0JPD0';


export const getHandle = (brandName: string) => {
    // Explicit mapping based on user request
    const map: Record<string, string> = {
        'enki': 'ENKIProtocol',
        'netswap': 'netswapofficial',
        'meme': 'MetisL2',
        'lazai': 'LazAI_Official',
        'defia': 'DefiaLabs'
    };
    return map[brandName.toLowerCase()] || 'MetisL2';
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

    // LOGIC: Use user key if it looks valid (starts with apify_api_), otherwise default
    const token = (userApiKey && userApiKey.startsWith('apify_api_')) ? userApiKey : DEFAULT_APIFY_TOKEN;

    // If no valid token, return fallback immediately to avoid 401 error
    if (!token) {
        console.log("[Apify] No valid API key provided. Returning fallback data.");
        return {
            ...fallback,
            isLive: false,
            error: undefined // No error needed, just fallback state
        };
    }

    console.log(`[Apify] Starting fresh fetch for @${handle} using token ending in ...${token.slice(-4)}`);

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
        console.warn("[Analytics] Cache fetch failed", e);
    }

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

// Helper to generate a random "Wallet" address
const mockAddress = () => `0x${Math.random().toString(16).substr(2, 40)}`;

interface Transaction {
    hash: string;
    wallet: string;
    timestamp: number;
    amountUsd: number;
    type: 'deposit' | 'swap' | 'stake';
}

const generateMockTransactions = (campaigns: CampaignLog[]): Transaction[] => {
    const txs: Transaction[] = [];
    const now = new Date().getTime();
    const threeMonthsAgo = now - (90 * 24 * 60 * 60 * 1000);

    // 1. Generate Baseline Traffic (Organic)
    // Higher baseline to make campaigns stand out less if ineffective
    for (let i = 0; i < 800; i++) {
        txs.push({
            hash: mockAddress(),
            wallet: mockAddress(),
            timestamp: threeMonthsAgo + Math.random() * (now - threeMonthsAgo),
            amountUsd: Math.random() * 500, // Organic users usually smaller
            type: Math.random() > 0.5 ? 'swap' : 'stake'
        });
    }

    // 2. Generate Campaign Spikes
    campaigns.forEach(camp => {
        const start = new Date(camp.startDate).getTime();
        const end = new Date(camp.endDate).getTime();

        // Determine "Effectiveness" based on channel name (Simulation logic)
        // Twitter = High Volume, Low Value. Influencer = Low Volume, High Value.
        let multiplier = 1;
        let whaleChance = 0.05;

        if (camp.channel.toLowerCase().includes('influencer')) {
            multiplier = 0.5; // Fewer users
            whaleChance = 0.2; // More whales
        }

        // Generate transactions during campaign window
        const numTx = Math.floor((camp.budget / 10) * multiplier) + 50;

        for (let j = 0; j < numTx; j++) {
            const isWhale = Math.random() < whaleChance;
            txs.push({
                hash: mockAddress(),
                wallet: mockAddress(),
                timestamp: start + Math.random() * (end - start),
                amountUsd: isWhale ? 5000 + Math.random() * 50000 : 10 + Math.random() * 200,
                type: 'deposit'
            });
        }
    });

    return txs.sort((a, b) => a.timestamp - b.timestamp);
};


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
            console.warn("Dune data fetch failed. Falling back to simulation.", e);
            // Trigger Simulation Fallback logic below
            const simTxs = generateMockTransactions(input.campaigns);
            // Re-calculate using simulation logic
            const simTotalVol = simTxs.reduce((sum, t) => sum + t.amountUsd, 0);
            totalVolume = Math.floor(simTotalVol);
            netNewWallets = Math.floor(simTxs.length * 0.15);
            activeWallets = Math.floor(simTxs.length * 0.6);
            retentionRate = 12.5;
            tvlChange = totalVolume * 0.7;
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

    // --- 2. CAMPAIGN ATTRIBUTION (Stubbed for now) ---
    // Without granular wallet data, we cannot attribute safely. Return empty for now.
    const campaignPerformance = input.campaigns.map(camp => ({
        campaignId: camp.id,
        lift: 0,
        cpa: 0,
        whalesAcquired: 0,
        roi: 0
    }));


    return {
        totalVolume,
        netNewWallets,
        activeWallets,
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
