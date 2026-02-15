
import fetch from 'node-fetch'; // Use built-in fetch in Node 18+, but for safety in older envs/types
// Note: Node 18+ has global fetch.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Cache is in ../cache relative to this file (server/agent -> server/cache)
const CACHE_DIR = path.join(__dirname, '../cache');
const CACHE_FILE = path.join(CACHE_DIR, 'social_metrics.json');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

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
const MENTIONS_CACHE_FILE = path.join(CACHE_DIR, 'mentions_cache.json');
const MENTIONS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const getMentionsCache = (brandName) => {
    try {
        if (!fs.existsSync(MENTIONS_CACHE_FILE)) return null;
        const cache = JSON.parse(fs.readFileSync(MENTIONS_CACHE_FILE, 'utf8'));
        const entry = cache[brandName.toLowerCase()];
        if (!entry) return null;
        const age = Date.now() - new Date(entry.fetchedAt).getTime();
        if (age > MENTIONS_TTL_MS) return null; // Expired
        return entry.data;
    } catch {
        return null;
    }
};

const setMentionsCache = (brandName, data) => {
    try {
        let cache = {};
        if (fs.existsSync(MENTIONS_CACHE_FILE)) {
            cache = JSON.parse(fs.readFileSync(MENTIONS_CACHE_FILE, 'utf8'));
        }
        cache[brandName.toLowerCase()] = { fetchedAt: new Date().toISOString(), data };
        fs.writeFileSync(MENTIONS_CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (e) {
        console.warn("[Agent/Ingest] Failed to write mentions cache:", e.message);
    }
};

export const fetchMentions = async (apiKey, brandName = 'ENKI') => {
    if (!apiKey) return [];

    // Check TTL cache first — skip Apify if we have fresh data
    const cached = getMentionsCache(brandName);
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
                timestamp: item.timestamp || new Date().toISOString()
            };
        });

        // Save to cache
        setMentionsCache(brandName, result);
        return result;

    } catch (e) {
        console.error("[Agent/Ingest] Mentions Fetch Error:", e.message);
        return [];
    }
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

    // Initialize Supabase (Server-side)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    // We try to use supabase if available, otherwise just cache
    // Dynamic import to avoid issues if sdk is missing in some envs
    let supabase = null;
    if (supabaseUrl && supabaseKey) {
        try {
            const { createClient } = await import('@supabase/supabase-js');
            supabase = createClient(supabaseUrl, supabaseKey);
        } catch (e) {
            console.warn("[Agent/Ingest] Supabase SDK not found, skipping DB sync.");
        }
    }

    let results = {};
    if (fs.existsSync(CACHE_FILE)) {
        try {
            results = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        } catch (e) {
            console.warn("[Agent/Ingest] corrupted cache, starting fresh.");
        }
    }

    const ACTOR_TWITTER = 'VsTreSuczsXhhRIqa'; // New unified Twitter actor

    // Only sync brands that are actually registered in the DB.
    // The hardcoded TRACKED_BRANDS fallback was syncing 5 demo brands even when the user only has 1 real brand.
    const registry = brands.length > 0
        ? brands.map((brand) => ({ key: brand.id.toLowerCase(), handle: brand.xHandle || brand.name, originalId: brand.id }))
        : [];

    if (registry.length === 0) {
        console.log("[Agent/Ingest] No active brands found in DB. Skipping social sync (add a brand via onboarding first).");
        return;
    }

    for (const { key, handle } of registry) {
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
                    // New actor format - estimate followers from engagement
                    const avgLikes = items.reduce((sum, t) => sum + (t.likes || 0), 0) / items.length;
                    const followers = Math.floor(avgLikes * 50); // Estimate based on ~2% engagement

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

        } catch (e) {
            console.error(`[Agent/Ingest] Error syncing ${key}:`, e.message);
        }
    }

    // Save to Cache
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(results, null, 2));
        console.log("[Agent/Ingest] Daily Sync Complete. Cache updated.");
    } catch (e) {
        console.error("[Agent/Ingest] Failed to write cache:", e.message);
    }
};

export const fetchPulseTrends = async (_apiKey) => {
    // LunarCrush integration removed — returning empty array
    // Trends are now sourced via Web3 News (Apify) on the frontend
    return [];
};
