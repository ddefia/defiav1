import { CampaignLog, ComputedMetrics, GrowthInput, SocialMetrics, SocialPost, SocialSignals, TrendItem, Mention, DashboardCampaign } from "../types";
import { getIntegrationConfig } from "../config/integrations";
import { loadIntegrationKeys } from "./storage";


/**
 * APIFY INTEGRATION
 */
const DEFAULT_APIFY_TOKEN = process.env.VITE_APIFY_API_TOKEN || (import.meta as any).env?.VITE_APIFY_API_TOKEN || '';
// Ensure APIFY token is present; if missing, operations will fallback to cache.
if (!DEFAULT_APIFY_TOKEN) {
    console.warn('[Apify] VITE_APIFY_API_TOKEN is not set. Social metrics will rely on cache or fallback data.');
}

// Actor IDs - Using new unified Twitter scraper
const ACTOR_TWITTER = 'VsTreSuczsXhhRIqa'; // New unified actor for tweets + profiles


export const getHandle = (brandName: string) => {
    const config = getIntegrationConfig(brandName);
    const localKeys = loadIntegrationKeys(brandName);
    return localKeys.apify || config?.apify?.twitterHandle || 'MetisL2';
};

/**
 * Helper to run an Apify Actor and wait for results
 */
export const runApifyActor = async (actorId: string, input: any, token: string) => {
    try {
        // 1. Start Execution
        // Increased wait time to 90s to avoid timeouts on cold starts
        const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&waitForFinish=90`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });

        const runData = await response.json();

        // Check for specific platform errors (e.g. Limit Exceeded)
        if (runData.error) {
            console.error(`[Apify] Platform Error: ${runData.error.type} - ${runData.error.message}`);
            throw new Error(runData.error.message || "Apify Platform Error");
        }

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
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const cacheRes = await fetch(`${baseUrl}/api/social-metrics/${brandName}`);
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
            const tweetItems = await runApifyActor(ACTOR_TWITTER, {
                "handles": [handle],
                "tweetsDesired": 10,
                "profilesDesired": 1,
                "withReplies": false,
                "includeUserInfo": true,
                "proxyConfig": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
            }, token);
            // Process tweets using new actor output format
            const realRecentPosts: SocialPost[] = tweetItems.map((item: any) => {
                const likes = item.likes || 0;
                const comments = item.replies || 0;
                const retweets = item.retweets || 0;
                const quotes = item.quotes || 0;
                const impressions = (likes + comments + retweets + quotes) * 20 || (cachedStats.totalFollowers * 0.15);
                const engagementRate = cachedStats.totalFollowers > 0 ? ((likes + comments + retweets) / cachedStats.totalFollowers) * 100 : 0;
                return {
                    id: item.id || Math.random().toString(),
                    content: item.text || "Media Post",
                    date: item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "Recent",
                    likes,
                    comments,
                    retweets,
                    impressions: Math.floor(impressions),
                    engagementRate: parseFloat(engagementRate.toFixed(2)),
                    url: item.url,
                    mediaUrl: item.images?.[0]
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

        // Fetch tweets AND profile info using new unified actor
        // The new actor returns both tweets and user info in one call
        promises.push(
            runApifyActor(ACTOR_TWITTER, {
                "handles": [handle],
                "tweetsDesired": 10,
                "profilesDesired": 1,
                "withReplies": false,
                "includeUserInfo": true,
                "proxyConfig": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
            }, token).catch(e => { console.warn("Twitter fetch failed", e); return []; })
        );

        // Add empty promise for backwards compatibility with destructuring
        promises.push(Promise.resolve([]));

        // NEW: Fetch Mentions in same batch
        promises.push(fetchMentions(brandName, token));

        const [tweetItems, _unused, mentionItems] = await Promise.all(promises);

        // PROCESS PROFILE - Use cached followers or estimate from engagement
        let realFollowers = cachedStats?.totalFollowers || 0;
        let foundProfile = !!cachedStats?.totalFollowers;

        // The new actor doesn't return profile info directly in tweet items
        // We'll use cached followers or estimate based on engagement
        if (!foundProfile && tweetItems && tweetItems.length > 0) {
            // Estimate followers based on average engagement (rough heuristic)
            const avgLikes = tweetItems.reduce((sum: number, t: any) => sum + (t.likes || 0), 0) / tweetItems.length;
            if (avgLikes > 0) {
                // Assuming ~2% engagement rate as baseline
                realFollowers = Math.floor(avgLikes * 50);
                foundProfile = true;
            }
        }

        // PROCESS TWEETS - Using new actor output format
        let realRecentPosts: SocialPost[] = [];

        if (tweetItems && tweetItems.length > 0) {
            realRecentPosts = tweetItems.map((item: any) => {
                // New actor format: id, images, text, likes, replies, retweets, quotes, timestamp, url
                const likes = item.likes || 0;
                const comments = item.replies || 0;
                const retweets = item.retweets || 0;
                const quotes = item.quotes || 0;

                // Estimate impressions from engagement (no view count in new format)
                const totalEngagement = likes + comments + retweets + quotes;
                const impressions = totalEngagement > 0 ? totalEngagement * 20 : Math.floor(realFollowers * 0.15);

                const engagementRate = realFollowers > 0
                    ? ((likes + comments + retweets) / realFollowers) * 100
                    : 0;

                // Media from images array
                const mediaUrl = item.images?.[0];

                // URL is provided directly by new actor
                const tweetUrl = item.url || '';

                // Parse timestamp
                const dateDisplay = item.timestamp
                    ? new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : "Recent";

                return {
                    id: item.id || Math.random().toString(),
                    content: item.text || "Media Post",
                    date: dateDisplay,
                    likes,
                    comments,
                    retweets,
                    impressions,
                    engagementRate: parseFloat(engagementRate.toFixed(2)),
                    url: tweetUrl,
                    mediaUrl: mediaUrl
                };
            });
        }

        if (!foundProfile && realRecentPosts.length === 0) {
            console.warn("[Apify] Empty dataset returned. Falling back to simulation.");
            throw new Error("No data returned (Empty Dataset)");
        }

        // FAILSAFE: If tweets failed to load (empty), use fallback mock data so the UI isn't broken
        if (realRecentPosts.length === 0) {
            console.warn("[Apify] Live tweets empty. Using fallback posts.");
            realRecentPosts = fallback.recentPosts;
        }

        const avgEng = realRecentPosts.length > 0
            ? realRecentPosts.reduce((acc, p) => acc + p.engagementRate, 0) / realRecentPosts.length
            : 0;

        const totalImpressions = realRecentPosts.reduce((acc, p) => acc + p.impressions, 0);

        return {
            totalFollowers: realFollowers,
            weeklyImpressions: totalImpressions > 0 ? totalImpressions * 2 : fallback.weeklyImpressions,
            engagementRate: parseFloat(avgEng.toFixed(2)),
            mentions: mentionItems ? mentionItems.length : fallback.mentions, // Use actual count if available
            recentMentions: mentionItems || [], // Pass the array
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
            error: error.message // Pass the actual error (e.g. "Monthly usage hard limit exceeded")
        };
    }
};

export const getSocialMetrics = (brandName: string): SocialMetrics => {
    // Brand-Specific Simulation Data
    const mocks: Record<string, any> = {
        'Enki': {
            posts: [
                { id: 'e1', content: "Metis Liquid Staking is live! 🌿 Stake your METIS and earn rewards while keeping liquidity.", stats: { likes: 145, retweets: 45 } },
                { id: 'e2', content: "Deep dive into the sequence architecture of Enki Protocol. 🧵", stats: { likes: 89, retweets: 23 } }
            ]
        },
        'Netswap': {
            posts: [
                { id: 'n1', content: "New Farm Rewards are up! 🌾 Provide liquidity to NETT/METIS now.", stats: { likes: 210, retweets: 55 } },
                { id: 'n2', content: "Netswap V2 adds concentrated liquidity features. Trade smarter.", stats: { likes: 134, retweets: 32 } }
            ]
        },
        'Metis': {
            posts: [
                { id: 'm1', content: "Metis Sequencer Decentralization is a major milestone for L2 security.", stats: { likes: 560, retweets: 230 } },
                { id: 'm2', content: "Ecosystem Grant applications are open. Build on Metis!", stats: { likes: 340, retweets: 120 } }
            ]
        }
    };

    const brandMock = mocks[brandName] || {
        posts: [
            { id: 'd1', content: `Latest updates from ${brandName}. Innovation is key! 🚀`, stats: { likes: 124, retweets: 32 } },
            { id: 'd2', content: "Community request implemented. Check out the new dashboard.", stats: { likes: 89, retweets: 12 } }
        ]
    };

    // Construct the metrics object
    return {
        totalFollowers: 0,
        weeklyImpressions: 0,
        engagementRate: 0,
        mentions: 12,
        topPost: brandMock.posts[0].content,
        recentPosts: brandMock.posts.map((p: any) => ({
            id: p.id,
            content: p.content,
            date: "2d ago",
            likes: p.stats.likes,
            comments: Math.floor(p.stats.likes * 0.1),
            retweets: p.stats.retweets,
            impressions: p.stats.likes * 25,
            engagementRate: 4.8
        })),
        engagementHistory: [],
        comparison: { period: 'vs Last Week', followersChange: 2.4, engagementChange: 1.5, impressionsChange: 5.2 },
        isLive: false,
        error: "Connect Data Source (Simulated Mode)"
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



export const fetchMentions = async (brandName: string, apiKey?: string): Promise<Mention[]> => {
    // Real Implementation using new unified actor
    const token = apiKey || DEFAULT_APIFY_TOKEN;
    if (!token) return [];

    try {
        const handle = getHandle(brandName);
        console.log(`[Apify] Fetching mentions for @${handle}...`);

        // New actor uses handles array - search for brand mentions
        const items = await runApifyActor(ACTOR_TWITTER, {
            "handles": [handle],
            "tweetsDesired": 5,
            "profilesDesired": 0,
            "withReplies": true, // Include replies to find mentions
            "includeUserInfo": false,
            "proxyConfig": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
        }, token);

        if (!items || items.length === 0) return [];

        // Map new actor output format to Mention type
        return items.map((item: any) => {
            // Extract author from URL (format: https://x.com/USERNAME/status/...)
            const urlMatch = item.url?.match(/x\.com\/([^\/]+)\//);
            const author = urlMatch?.[1] || "Unknown";

            return {
                id: item.id,
                author: author,
                text: item.text || "",
                timestamp: item.timestamp || new Date().toISOString()
            };
        });

    } catch (e) {
        console.warn("[Apify] Mentions fetch failed:", e);
        return [];
    }
};

export const computeSocialSignals = (trends: TrendItem[], mentions: Mention[], socialMetrics?: SocialMetrics): SocialSignals => {
    // 1. Calculate Sentiment
    // Simple heuristic: Trend Sentiment (Positive=80, Neutral=50, Negative=20) + Engagement Bonus
    let baseScore = 50;
    let positiveCount = 0;

    trends.forEach(t => {
        if (t.sentiment === 'Positive') positiveCount++;
        if (t.sentiment === 'Negative') baseScore -= 10;
        else if (t.sentiment === 'Positive') baseScore += 5;
    });

    if (socialMetrics && socialMetrics.engagementRate > 2.0) baseScore += 10;
    if (socialMetrics && socialMetrics.engagementRate > 5.0) baseScore += 10;

    const sentimentScore = Math.min(100, Math.max(0, baseScore));

    // 2. Determine Trend
    let sentimentTrend: 'up' | 'down' | 'stable' = 'stable';
    if (socialMetrics?.comparison) {
        if (socialMetrics.comparison.engagementChange > 5) sentimentTrend = 'up';
        else if (socialMetrics.comparison.engagementChange < -5) sentimentTrend = 'down';
    }

    // 3. Extract Narratives (Hashtags from headlines/summaries)
    const narratives = new Set<string>();
    trends.forEach(t => {
        const match = t.headline.match(/#\w+/g);
        if (match) match.forEach(m => narratives.add(m));

        // Fallback: Use headline keywords if no hashtags
        if (!match) {
            const words = t.headline.split(' ').filter(w => w.length > 5 && !['Trending', 'Volume'].includes(w));
            if (words.length > 0) narratives.add(words[0]);
        }
    });

    // 4. Identify KOLs
    const kols = new Set<string>();
    mentions.forEach(m => {
        if (m.author && m.author !== 'Unknown') kols.add(`@${m.author}`);
    });

    return {
        sentimentScore,
        sentimentTrend,
        activeNarratives: Array.from(narratives).slice(0, 5), // Top 5
        topKols: Array.from(kols).slice(0, 5) // Top 5
    };
};

import { getSupabase } from './supabaseClient';

/**
 * CAMPAIGN PERFORMANCE (REAL DATA FROM SUPABASE)
 */
export const fetchCampaignPerformance = async (): Promise<DashboardCampaign[]> => {
    // 1. Fetch from Supabase
    const supabase = getSupabase();
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('campaign_performance')
            .select('*');

        if (error || !data) {
            console.warn("Supabase Campaign Fetch Failed (or table empty):", error);
            return [];
        }

        // 2. Transform DB Rows -> DashboardCampaign
        // Note: Assumes DB columns are snake_case matching the types or need mapping.
        return data.map((d: any) => ({
            id: d.id,
            name: d.name,
            channel: d.channel,
            spend: d.spend,
            attributedWallets: d.attributed_wallets,
            cpa: d.cpa,
            retention: d.retention,
            valueCreated: d.value_created,
            roi: d.roi,
            status: d.status_label,
            trendSignal: d.trend_signal,
            confidence: d.confidence,
            aiSummary: d.ai_summary || [],
            anomalies: d.anomalies || [],

            // New Action Card Fields (Simulated if missing in DB)
            priorityScore: d.priority_score || Math.min(10, Math.max(1, Math.round(d.roi * 1.5))),
            type: d.campaign_type || (d.channel === 'Twitter' ? 'Newsjack' : 'Alpha'),
            expectedImpact: d.expected_impact || (d.roi > 2 ? '↑ volume, ↑ active wallets' : 'Optimize retention'),

            // GENERATE SMART RATIONALE IF MISSING
            recommendation: d.recommendation || {
                action: d.status_label === 'Scale' ? 'Scale' : d.roi > 3 ? 'Scale' : 'Test',
                confidence: d.confidence || (d.roi > 2 ? 'High' : 'Med'),
                reasoning: generateSmartRationale(d.roi, d.cpa, d.retention, d.status_label)
            },

            // Media URL (Mocking for Demo)
            mediaUrl: d.media_url || (d.channel === 'Twitter' ? 'https://pbs.twimg.com/media/F_ueyJ6XsAAv8X_.jpg' : undefined)
        }));
    } catch (e) {
        console.error("Campaign Fetch Error", e);
        return [];
    }
};

// --- HELPER: GENERATE SMART REASONING ---
const generateSmartRationale = (roi: number, cpa: number, retention: number, status: string): string[] => {
    const reasoning = [];

    // ROI Logic
    if (roi > 4.0) reasoning.push(`ROI of ${roi}x significantly outperforms sector benchmark (2.5x).`);
    else if (roi > 1.5) reasoning.push(`Positive ROI (${roi}x) indicates sustainable acquisition model.`);

    // CPA Logic
    if (cpa < 15) reasoning.push(`CPA of $${cpa} is highly efficient (Target: <$25).`);
    else if (cpa > 50) reasoning.push(`CPA ($${cpa}) is elevated; primarily targeting high-value wallets.`);

    // Retention Logic
    if (retention > 30) reasoning.push(`${retention}% retention signals strong product-market fit.`);
    else if (retention < 10) reasoning.push(`Retention (${retention}%) suggests low wallet quality; monitor closely.`);

    // Signal Consistency
    if (roi > 2 && retention > 15) reasoning.push("Convergence of High ROI and Retention confirms 'Alpha' status.");

    // Fallback
    if (reasoning.length === 0) reasoning.push("Metric stability warrants continued observation.");

    return reasoning.slice(0, 3); // Top 3 reasons
};
