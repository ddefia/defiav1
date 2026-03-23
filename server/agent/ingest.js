
import fetch from 'node-fetch'; // Use built-in fetch in Node 18+, but for safety in older envs/types
// Note: Node 18+ has global fetch.

import { getSupabaseClient } from './brandContext.js';

const SOCIAL_METRICS_KEY = 'defia_social_metrics_cache_v1';
const MENTIONS_CACHE_KEY = 'defia_mentions_cache_v1';

/**
 * INGESTION SERVICE (Server-Side)
 * "The Eyes"
 */

export const fetchDuneMetrics = async (apiKey) => {
    if (!apiKey || apiKey === 'your_dune_api_key_here') {
        console.log("[Agent/Ingest] No Dune Key. Skipping on-chain metrics.");
        return null;
    }
    // Dune key present but no brand-specific queries configured yet.
    // Returns null so brain knows on-chain data is unavailable rather than faking zeros.
    console.log("[Agent/Ingest] Dune key present but no brand queries configured.");
    return null;
};

export const fetchLunarCrushTrends = async (_apiKey, _symbol = 'ETH') => {
    // LunarCrush integration removed — returning empty array
    return [];
};

// TTL cache for mentions — avoids redundant Apify calls from overlapping cron/client/bootup triggers
const MENTIONS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// In-memory fallback for when Supabase is unavailable
let mentionsMemCache = {};

const getMentionsCache = async (brandName) => {
    const key = brandName.toLowerCase();
    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            const { data, error } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', MENTIONS_CACHE_KEY)
                .maybeSingle();
            if (!error && data?.value) {
                const entry = data.value[key];
                if (entry) {
                    const age = Date.now() - new Date(entry.fetchedAt).getTime();
                    if (age <= MENTIONS_TTL_MS) return entry.data;
                }
            }
        }
    } catch { /* fall through */ }

    // In-memory fallback
    const entry = mentionsMemCache[key];
    if (entry) {
        const age = Date.now() - new Date(entry.fetchedAt).getTime();
        if (age <= MENTIONS_TTL_MS) return entry.data;
    }
    return null;
};

const setMentionsCache = async (brandName, data) => {
    const key = brandName.toLowerCase();
    const entry = { fetchedAt: new Date().toISOString(), data };

    // Always update in-memory
    mentionsMemCache[key] = entry;

    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            // Read existing, merge, write back
            let cache = {};
            const { data: existing } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', MENTIONS_CACHE_KEY)
                .maybeSingle();
            if (existing?.value) cache = existing.value;

            cache[key] = entry;
            await supabase.from('app_storage').upsert({
                key: MENTIONS_CACHE_KEY,
                value: cache,
                updated_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn("[Agent/Ingest] Failed to write mentions cache to DB:", e.message);
    }
};

export const fetchMentions = async (apiKey, brandName = 'ENKI') => {
    if (!apiKey) return [];

    // Check TTL cache first — skip Apify if we have fresh data
    const cached = await getMentionsCache(brandName);
    if (cached) {
        console.log(`[Agent/Ingest] Using cached mentions for ${brandName} (< 6h old)`);
        return cached;
    }

    try {
        // Direct Apify Call - Using new unified Twitter actor
        const ACTOR_ID = 'VsTreSuczsXhhRIqa';

        console.log(`[Agent/Ingest] Fetching fresh mentions for ${brandName} via Apify...`);

        // 1. Run with new actor input format
        const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${apiKey}&waitForFinish=90`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "handles": [brandName],
                "tweetsDesired": 3,
                "profilesDesired": 0,
                "withReplies": true,
                "includeUserInfo": false,
                "proxyConfig": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
            })
        });

        const runData = await runRes.json();
        if (!runData.data || runData.data.status !== 'SUCCEEDED') {
            throw new Error(`Run Status: ${runData.data?.status}`);
        }

        // 2. Get Items
        const datasetId = runData.data.defaultDatasetId;
        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`);
        const items = await itemsRes.json();

        // Map new actor output format
        const result = items.map(item => {
            // Extract author from URL (format: https://x.com/USERNAME/status/...)
            const urlMatch = item.url?.match(/x\.com\/([^\/]+)\//);
            const author = urlMatch?.[1] || "Unknown";

            return {
                id: item.id,
                author: author,
                text: item.text || "",
                timestamp: item.timestamp || new Date().toISOString(),
                images: item.images || [],
                tweetUrl: item.url || null,
            };
        });

        // Save to cache
        await setMentionsCache(brandName, result);
        return result;

    } catch (e) {
        console.error("[Agent/Ingest] Mentions Fetch Error:", e.message);
        return [];
    }
};

// ━━━ Competitor Tweet Monitoring ━━━

const COMPETITOR_TWEETS_CACHE_KEY = 'defia_competitor_tweets_v1';
const competitorMemCache = {};

const getCompetitorTweetsCache = async (brandName, competitorHandle) => {
    const key = `${brandName.toLowerCase()}_${competitorHandle.toLowerCase().replace('@', '')}`;

    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            const { data } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', COMPETITOR_TWEETS_CACHE_KEY)
                .maybeSingle();
            if (data?.value) {
                const entry = data.value[key];
                if (entry) {
                    const age = Date.now() - new Date(entry.fetchedAt).getTime();
                    if (age <= MENTIONS_TTL_MS) return entry.data;
                }
            }
        }
    } catch { /* fall through */ }

    const entry = competitorMemCache[key];
    if (entry) {
        const age = Date.now() - new Date(entry.fetchedAt).getTime();
        if (age <= MENTIONS_TTL_MS) return entry.data;
    }
    return null;
};

const setCompetitorTweetsCache = async (brandName, competitorHandle, data) => {
    const key = `${brandName.toLowerCase()}_${competitorHandle.toLowerCase().replace('@', '')}`;
    const entry = { fetchedAt: new Date().toISOString(), data };

    competitorMemCache[key] = entry;

    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            let cache = {};
            const { data: existing } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', COMPETITOR_TWEETS_CACHE_KEY)
                .maybeSingle();
            if (existing?.value) cache = existing.value;

            cache[key] = entry;
            await supabase.from('app_storage').upsert({
                key: COMPETITOR_TWEETS_CACHE_KEY,
                value: cache,
                updated_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn("[Agent/Ingest] Failed to write competitor tweets cache:", e.message);
    }
};

export const fetchCompetitorTweets = async (apiKey, brandName, competitorHandle) => {
    if (!apiKey || !competitorHandle) return [];

    const cleanHandle = competitorHandle.replace('@', '');
    const cached = await getCompetitorTweetsCache(brandName, cleanHandle);
    if (cached) {
        console.log(`[Agent/Ingest] Using cached competitor tweets for @${cleanHandle} (< 6h old)`);
        return cached;
    }

    try {
        const ACTOR_ID = 'VsTreSuczsXhhRIqa';
        console.log(`[Agent/Ingest] Fetching competitor tweets for @${cleanHandle}...`);

        const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${apiKey}&waitForFinish=90`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "handles": [cleanHandle],
                "tweetsDesired": 3,
                "profilesDesired": 0,
                "withReplies": false,
                "includeUserInfo": false,
                "proxyConfig": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
            })
        });

        const runData = await runRes.json();
        if (!runData.data || runData.data.status !== 'SUCCEEDED') {
            throw new Error(`Run Status: ${runData.data?.status}`);
        }

        const datasetId = runData.data.defaultDatasetId;
        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`);
        const items = await itemsRes.json();

        const result = items.map(item => ({
            id: item.id,
            competitor: cleanHandle,
            text: item.text || "",
            timestamp: item.timestamp || new Date().toISOString(),
            likes: item.likes || 0,
            retweets: item.retweets || 0,
            images: item.images || [],
            tweetUrl: item.url || null,
        }));

        await setCompetitorTweetsCache(brandName, cleanHandle, result);
        console.log(`[Agent/Ingest] Cached ${result.length} competitor tweets for @${cleanHandle}`);
        return result;
    } catch (e) {
        console.error(`[Agent/Ingest] Competitor tweets fetch error (@${competitorHandle}):`, e.message);
        return [];
    }
};

// ━━━ Trending KOL Tweet Feed ━━━
// High-signal crypto Twitter accounts whose tweets drive narratives.
// One batched Apify call fetches latest tweets from all handles — cost = 1 actor run.

const KOL_TWEETS_CACHE_KEY = 'defia_kol_tweets_cache_v1';
let kolMemCache = null;

const CRYPTO_KOLS = [
    'brian_armstrong', 'VitalikButerin', 'DefiIgnas', 'Route2FI',
    'lookonchain', 'WuBlockchain', 'CryptoHayes', 'MustStopMurad',
    'zachxbt', 'punk6529', 'AutismCapital', 'tier10k',
];

const getKOLTweetsCache = async () => {
    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            const { data } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', KOL_TWEETS_CACHE_KEY)
                .maybeSingle();
            if (data?.value) {
                const age = Date.now() - new Date(data.value.fetchedAt).getTime();
                if (age <= MENTIONS_TTL_MS) return data.value.data;
            }
        }
    } catch { /* fall through */ }

    if (kolMemCache) {
        const age = Date.now() - new Date(kolMemCache.fetchedAt).getTime();
        if (age <= MENTIONS_TTL_MS) return kolMemCache.data;
    }
    return null;
};

const setKOLTweetsCache = async (data) => {
    const entry = { fetchedAt: new Date().toISOString(), data };
    kolMemCache = entry;

    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            await supabase.from('app_storage').upsert({
                key: KOL_TWEETS_CACHE_KEY,
                value: entry,
                updated_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn("[Agent/Ingest] Failed to write KOL tweets cache:", e.message);
    }
};

// Cache-only read — returns whatever is cached (even slightly stale) without calling Apify.
// Used by the recommendations cron to avoid Apify timeout issues.
export const getCachedKOLTweets = async () => {
    try {
        const supabase = getSupabaseClient();
        if (supabase) {
            const { data } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', KOL_TWEETS_CACHE_KEY)
                .maybeSingle();
            if (data?.value?.data) return data.value.data;
        }
    } catch { /* fall through */ }
    if (kolMemCache?.data) return kolMemCache.data;
    return [];
};

const KOL_RUN_KEY = 'defia_kol_run_id';

// Parse Apify dataset items into our tweet format
// Filters out tweets older than 3 days to prevent stale recommendations
const MAX_TWEET_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const parseKOLItems = (items) => {
    const now = Date.now();
    const result = items
        .map(item => {
            const urlMatch = item.url?.match(/x\.com\/([^\/]+)\//);
            const author = urlMatch?.[1] || 'unknown';
            const timestamp = item.timestamp || item.createdAt || new Date().toISOString();
            return {
                author,
                text: item.text || '',
                likes: item.likes || 0,
                retweets: item.retweets || 0,
                tweetUrl: item.url || null,
                timestamp,
                images: item.images || [],
            };
        })
        .filter(t => {
            // Filter out tweets older than 3 days
            const tweetAge = now - new Date(t.timestamp).getTime();
            return tweetAge < MAX_TWEET_AGE_MS;
        });
    // Sort by recency first (newest first), then by engagement as tiebreaker
    result.sort((a, b) => {
        const ageDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (Math.abs(ageDiff) > 6 * 60 * 60 * 1000) return ageDiff; // If >6h apart, prefer newer
        return (b.likes + b.retweets) - (a.likes + a.retweets); // Within same window, prefer engagement
    });
    return result;
};

// Two-phase KOL tweet fetching for Vercel's 120s limit:
// Phase 1 (startKOLTweetRun): Fires off the Apify actor and stores the run ID — returns in <5s
// Phase 2 (collectKOLTweetRun): Checks if the run completed, fetches results, caches them
// The refresh cron calls both phases: start, wait briefly, then collect.

export const startKOLTweetRun = async (apiKey) => {
    if (!apiKey) return null;

    // Don't start a new run if cache is fresh
    const cached = await getKOLTweetsCache();
    if (cached) {
        console.log(`[Agent/Ingest] KOL cache fresh (${cached.length} tweets), skipping new run`);
        return null;
    }

    try {
        const ACTOR_ID = 'VsTreSuczsXhhRIqa';
        console.log(`[Agent/Ingest] Starting KOL tweet run for ${CRYPTO_KOLS.length} handles...`);

        // Fire-and-forget: don't wait for completion (waitForFinish=0)
        const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                handles: CRYPTO_KOLS,
                tweetsDesired: 3,
                profilesDesired: 0,
                withReplies: false,
                includeUserInfo: false,
                proxyConfig: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] }
            })
        });

        const runData = await runRes.json();
        const runId = runData.data?.id;
        if (!runId) throw new Error('No run ID returned');

        // Store run ID in Supabase so we can check it later
        const supabase = getSupabaseClient();
        if (supabase) {
            await supabase.from('app_storage').upsert({
                key: KOL_RUN_KEY,
                value: { runId, startedAt: new Date().toISOString(), apiKey },
                updated_at: new Date().toISOString()
            });
        }

        console.log(`[Agent/Ingest] KOL run started: ${runId}`);
        return runId;
    } catch (e) {
        console.error("[Agent/Ingest] Failed to start KOL run:", e.message);
        return null;
    }
};

export const collectKOLTweetRun = async (apiKey) => {
    if (!apiKey) return [];

    // Check if there's a pending run
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data: runData } = await supabase
        .from('app_storage')
        .select('value')
        .eq('key', KOL_RUN_KEY)
        .maybeSingle();

    const runId = runData?.value?.runId;
    if (!runId) {
        console.log('[Agent/Ingest] No pending KOL run to collect');
        return [];
    }

    try {
        // Check run status
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`);
        const statusData = await statusRes.json();
        const status = statusData.data?.status;

        if (status === 'SUCCEEDED') {
            const datasetId = statusData.data.defaultDatasetId;
            const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`);
            const items = await itemsRes.json();
            const result = parseKOLItems(items);

            await setKOLTweetsCache(result);
            // Clear the pending run
            await supabase.from('app_storage').delete().eq('key', KOL_RUN_KEY);
            console.log(`[Agent/Ingest] Collected ${result.length} KOL tweets (top: ${result[0]?.likes || 0} likes)`);
            return result;
        } else if (status === 'RUNNING' || status === 'READY') {
            console.log(`[Agent/Ingest] KOL run ${runId} still ${status}, will collect next time`);
            return [];
        } else {
            // Failed/aborted — clear it
            console.warn(`[Agent/Ingest] KOL run ${runId} ended with status: ${status}`);
            await supabase.from('app_storage').delete().eq('key', KOL_RUN_KEY);
            return [];
        }
    } catch (e) {
        console.error("[Agent/Ingest] Failed to collect KOL run:", e.message);
        return [];
    }
};

// Convenience wrapper: returns cached tweets, or starts a new run if needed
export const fetchTrendingKOLTweets = async (apiKey) => {
    if (!apiKey) return [];

    const cached = await getKOLTweetsCache();
    if (cached) {
        console.log(`[Agent/Ingest] Using cached KOL tweets (${cached.length} tweets, < 6h old)`);
        return cached;
    }

    // Try to collect a previously started run
    const collected = await collectKOLTweetRun(apiKey);
    if (collected.length > 0) return collected;

    // Start a new run for next collection
    await startKOLTweetRun(apiKey);
    return [];
};

export const TRACKED_BRANDS = {
    'enki': 'ENKIProtocol',
    'netswap': 'netswapofficial',
    'lazai': 'LazAINetwork',
    'defia': 'DefiaLabs',
    'metis': 'MetisL2'
};

export const updateAllBrands = async (apiKey, brands = []) => {
    if (!apiKey) {
        console.log("[Agent/Ingest] No API Key for daily sync.");
        return;
    }

    console.log("[Agent/Ingest] Starting Daily Social Sync for all brands...");

    const supabase = getSupabaseClient();

    // Load existing metrics from Supabase (or start fresh)
    let results = {};
    if (supabase) {
        try {
            const { data } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', SOCIAL_METRICS_KEY)
                .maybeSingle();
            if (data?.value) results = data.value;
        } catch (e) {
            console.warn("[Agent/Ingest] Failed to load existing metrics from DB:", e.message);
        }
    }

    const ACTOR_TWITTER = 'VsTreSuczsXhhRIqa'; // New unified Twitter actor

    // Only sync brands that are actually registered in the DB.
    // The hardcoded TRACKED_BRANDS fallback was syncing 5 demo brands even when the user only has 1 real brand.
    const registry = brands.length > 0
        ? brands.map((brand) => ({ key: brand.id.toLowerCase(), handle: brand.xHandle || brand.name, originalId: brand.id, config: brand.config }))
        : [];

    if (registry.length === 0) {
        console.log("[Agent/Ingest] No active brands found in DB. Skipping social sync (add a brand via onboarding first).");
        return;
    }

    for (const { key, handle, config: brandConfig } of registry) {
        try {
            console.log(`[Agent/Ingest] Syncing ${key} (@${handle})...`);

            // 1. Run new unified actor
            const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR_TWITTER}/runs?token=${apiKey}&waitForFinish=90`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "handles": [handle],
                    "tweetsDesired": 5,
                    "profilesDesired": 1,
                    "withReplies": false,
                    "includeUserInfo": true,
                    "proxyConfig": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
                })
            });

            const runData = await runRes.json();

            if (runData.data && runData.data.status === 'SUCCEEDED') {
                const datasetId = runData.data.defaultDatasetId;
                const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`);
                const items = await itemsRes.json();

                if (items.length > 0) {
                    // Extract real follower count from actor user data (profilesDesired=1 returns user object)
                    const userInfo = items[0]?.user;
                    const realFollowers = userInfo?.totalFollowers || 0;
                    // Fallback: estimate from engagement if user data missing
                    const avgLikes = items.reduce((sum, t) => sum + (t.likes || 0), 0) / items.length;
                    const followers = realFollowers || Math.floor(avgLikes * 50);

                    // Update Cache with new actor output format + pre-computed derived metrics
                    const totalEngagements = items.reduce((sum, t) => sum + (t.likes || 0) + (t.retweets || 0) + (t.replies || 0), 0);
                    const avgEngPerPost = items.length > 0 ? totalEngagements / items.length : 0;
                    const computedEngRate = followers > 0 ? parseFloat(((avgEngPerPost / followers) * 100).toFixed(2)) : 0;

                    results[key] = {
                        totalFollowers: followers,
                        lastUpdated: new Date().toISOString(),
                        handle: handle,
                        recentPosts: items.map(item => ({
                            id: item.id,
                            content: item.text || "",
                            date: item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "Recent",
                            likes: item.likes || 0,
                            comments: item.replies || 0,
                            retweets: item.retweets || 0
                        })),
                        // Pre-computed metrics so the fallback cache path has real data
                        engagementRate: computedEngRate,
                        weeklyImpressions: items.reduce((sum, t) => {
                            const eng = (t.likes || 0) + (t.retweets || 0) + (t.replies || 0);
                            return sum + Math.floor(eng * 50);
                        }, 0),
                        mentions: items.reduce((sum, t) => sum + (t.replies || 0), 0),
                        engagementHistory: items.map(t => ({
                            date: t.timestamp ? new Date(t.timestamp).toLocaleDateString() : 'Recent',
                            rate: followers > 0 ? parseFloat((((t.likes || 0) + (t.retweets || 0) + (t.replies || 0)) / followers * 100).toFixed(2)) : 0,
                            impressions: Math.floor(((t.likes || 0) + (t.retweets || 0) + (t.replies || 0)) * 50),
                            engagements: (t.likes || 0) + (t.retweets || 0) + (t.replies || 0)
                        })).reverse()
                    };
                    console.log(`   > Success: ${followers} followers, ${computedEngRate}% eng rate for ${key}.`);

                    // SYNC TO BRAND_MEMORY (If Supabase is active)
                    if (supabase) {
                        let newCount = 0;
                        for (const item of items) {
                            const tweetId = item.id;
                            // Check existence
                            const { data: exist } = await supabase
                                .from('brand_memory')
                                .select('id')
                                .eq('brand_id', key)
                                .contains('metadata', { external_id: tweetId })
                                .limit(1);

                            if (!exist || exist.length === 0) {
                                // Insert
                                const content = item.text;
                                if (!content) continue;

                                // Extract author from URL
                                const urlMatch = item.url?.match(/x\.com\/([^\/]+)\//);
                                const author = urlMatch?.[1] || handle;

                                await supabase.from('brand_memory').insert({
                                    brand_id: key,
                                    content: content,
                                    source: 'social_history',
                                    metadata: {
                                        external_id: tweetId,
                                        author: author,
                                        date: item.timestamp,
                                        metrics: {
                                            likes: item.likes || 0,
                                            retweets: item.retweets || 0,
                                            replies: item.replies || 0,
                                            quotes: item.quotes || 0,
                                            media_urls: item.images || []
                                        },
                                        mediaUrl: (item.images && item.images.length > 0) ? item.images[0] : null
                                    }
                                });
                                newCount++;
                            }
                        }
                        console.log(`   > [DB Sync] Added ${newCount} new tweets to brand_memory.`);
                    }

                } else {
                    console.log(`   > No tweets found for ${key}.`);
                }
            } else {
                console.warn(`[Agent/Ingest] Failed run for ${key}:`, JSON.stringify(runData));
            }

            // Nice delay to not hit rate limits
            await new Promise(r => setTimeout(r, 2000));

            // ━━━ Competitor Tweet Monitoring ━━━
            const competitors = brandConfig?.competitors || [];
            const competitorHandles = competitors.map(c => c.handle).filter(Boolean);
            if (competitorHandles.length > 0) {
                console.log(`   > Fetching tweets for ${competitorHandles.length} competitor(s) of ${key}...`);
                for (const compHandle of competitorHandles) {
                    try {
                        await fetchCompetitorTweets(apiKey, key, compHandle);
                    } catch (e) {
                        console.warn(`   > Competitor tweet fetch failed for @${compHandle}:`, e.message);
                    }
                    await new Promise(r => setTimeout(r, 1500)); // Rate limit courtesy
                }
            }

        } catch (e) {
            console.error(`[Agent/Ingest] Error syncing ${key}:`, e.message);
        }
    }

    // Save to Supabase
    if (supabase) {
        try {
            await supabase.from('app_storage').upsert({
                key: SOCIAL_METRICS_KEY,
                value: results,
                updated_at: new Date().toISOString()
            });
            console.log("[Agent/Ingest] Daily Sync Complete. Metrics saved to DB.");
        } catch (e) {
            console.error("[Agent/Ingest] Failed to save metrics to DB:", e.message);
        }
    } else {
        console.warn("[Agent/Ingest] No Supabase — metrics not persisted.");
    }
};

export const fetchPulseTrends = async (_apiKey) => {
    // LunarCrush integration removed — returning empty array
    // Trends are now sourced via Web3 News (Apify) on the frontend
    return [];
};
