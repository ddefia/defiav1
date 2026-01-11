
import { TrendItem } from "../types";
import { getSupabase } from './supabaseClient';


// Real-time market data fetching



// Helper for Apify (Simulated import if we refactored, but defining here for safety)
const runApifyActor = async (actorId: string, input: any, token: string) => {
    const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&waitForFinish=90`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });
    const runData = await response.json();
    if (!runData.data || (runData.data.status !== 'SUCCEEDED' && runData.data.status !== 'RUNNING')) {
        throw new Error(`Actor Status: ${runData.data?.status}`);
    }
    const datasetId = runData.data.defaultDatasetId;
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
    return await itemsRes.json();
};

const fetchLunarCrushTrends = async (): Promise<TrendItem[]> => {
    const token = import.meta.env.VITE_LUNARCRUSH_API_KEY;
    if (!token) return [];

    try {
        console.log("Fetching LunarCrush trends (v1)...");
        // Using v1 endpoint which is more likely to be accessible on free tier
        // Pass params, but also sort client-side to be safe
        const response = await fetch("https://lunarcrush.com/api4/public/coins/list/v1", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.warn(`LunarCrush API Error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        let coins = data.data || [];
        const now = Date.now();

        // Client-side sort by social volume
        coins.sort((a: any, b: any) => (b.social_volume_24h || 0) - (a.social_volume_24h || 0));

        // Take top 10 for "Deep Dive" (Expanded coverage)
        const topCoins = coins.slice(0, 10);

        const enrichedTrends = await Promise.all(topCoins.map(async (coin: any) => {
            let context = `High social volume for ${coin.name}. 24h Interactions: ${coin.interactions_24h || 0}.`;

            try {
                // Fetch context tweets
                const postsRes = await fetch(`https://lunarcrush.com/api4/public/creator/twitter/${coin.symbol}/posts/v1`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (postsRes.ok) {
                    const postsData = await postsRes.json();
                    const topPost = (postsData.data || [])[0];
                    if (topPost && topPost.body) {
                        context = topPost.body.substring(0, 140) + "...";
                    }
                }
            } catch (e) { console.warn("Context fetch failed", e); }

            return {
                id: `lc-${coin.id}`,
                source: 'LunarCrush',
                headline: `${coin.name} (${coin.symbol}) Trending`,
                summary: context,
                relevanceScore: Math.min(99, Math.floor((coin.social_score_24h || 50) + 20)),
                relevanceReason: "High News Activity",
                sentiment: (coin.sentiment || 0) > 50 ? 'Positive' : 'Neutral',
                timestamp: 'Live',
                createdAt: now,
                url: `https://lunarcrush.com/coins/${coin.symbol.toLowerCase()}`,
                rawData: coin
            };
        }));

        return enrichedTrends;

    } catch (e) {
        console.warn("LunarCrush fetch failed", e);
        return [];
    }
};

// --- LunarCrush Creator Endpoints (Proxy to Backend) ---

const PROXY_BASE = import.meta.env.VITE_API_BASE_URL || '/api/lunarcrush';

export const getCreator = async (screenName: string): Promise<any> => {
    try {
        const response = await fetch(`${PROXY_BASE}/creator/${screenName}`);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const data = await response.json();
        return data.data;
    } catch (e) {
        console.warn(`Failed to fetch creator ${screenName} from proxy`, e);
        return null;
    }
};

export const getCreatorTimeSeries = async (screenName: string, interval: string = '1d'): Promise<any[]> => {
    try {
        const response = await fetch(`${PROXY_BASE}/time-series/${screenName}?interval=${interval}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.data || [];
    } catch (e) {
        console.warn("Failed to fetch creator time series from proxy", e);
        return [];
    }
};

export const getCreatorPosts = async (screenName: string): Promise<any[]> => {
    try {
        const response = await fetch(`${PROXY_BASE}/posts/${screenName}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.data || [];
    } catch (e) {
        console.warn("Failed to fetch creator posts from proxy", e);
        return [];
    }
};

export const fetchMarketPulse = async (brandName: string): Promise<TrendItem[]> => {
    const apifyToken = process.env.APIFY_API_TOKEN;
    const now = Date.now();
    let items: TrendItem[] = [];

    // Parallel Fetching
    const [apifyItems, lunarItems] = await Promise.all([
        (async () => {
            // 1. Try Real API Fetch if Token Exists
            if (apifyToken) {
                try {
                    console.log("Fetching live trends via Apify...");
                    // Using a generic Twitter Scraper for "Crypto Trends" or specific brand keywords
                    // Actor: 'quacker/twitter-scraper' or similar (using the one from analytics for consistency: 61RPP7dywgiy0JPD0)
                    const keywords = ['#web3', '#crypto', brandName, 'Ethereum', 'Bitcoin'].join(' OR ');

                    const items = await runApifyActor('61RPP7dywgiy0JPD0', {
                        "searchTerms": [keywords],
                        "maxItems": 5,
                        "sort": "Latest"
                    }, apifyToken);

                    if (items && items.length > 0) {
                        return items.map((item: any) => ({
                            id: item.id_str || `trend-${Math.random()}`,
                            source: 'Twitter',
                            headline: item.full_text ? item.full_text.substring(0, 50) + "..." : "Trend",
                            summary: item.full_text || "No summary",
                            relevanceScore: 85, // Simple default
                            relevanceReason: "Live market topic",
                            sentiment: 'Neutral',
                            timestamp: 'Live',
                            createdAt: now
                        }));
                    }
                } catch (e) {
                    console.warn("Apify fetch failed for Pulse, falling back to mock.", e);
                }
            }
            return null;
        })(),
        fetchLunarCrushTrends()
    ]);

    if (apifyItems) items = [...items, ...apifyItems];
    if (lunarItems) items = [...items, ...lunarItems];


    // 2. Return what we found (real data only)
    return items;

    return items;
};

// --- DEEP BRAIN CONTEXT (RAG/SUPABASE) ---
export const getBrainContext = async (brandName: string): Promise<{ context: string, strategyCount: number, memoryCount: number }> => {
    const supabase = getSupabase();
    if (!supabase) return { context: "", strategyCount: 0, memoryCount: 0 };

    try {
        console.log(`[Pulse] Fetching Deep Context for ${brandName}...`);

        // 1. Fetch Strategy Docs (Goals/Mandates)
        const { data: strategies } = await supabase
            .from('strategy_docs')
            .select('title, content, category')
            .eq('brand_id', brandName)
            .order('created_at', { ascending: false }) // Prioritize Newest Mandates
            .limit(3);

        // 2. Fetch Top Performing Past Tweets (Memory)
        // Note: metrics is jsonb, so we cast to compare. Or just sort by created_at for now if simple.
        // Doing a simple "Recent" fetch for now as 'metrics->likes' sorting might tricky without index in raw SQL setup.
        const { data: memories } = await supabase
            .from('brand_memory')
            .select('content, metrics, created_at')
            .eq('brand_id', brandName)
            .order('created_at', { ascending: false })
            .limit(5);

        let context = "";

        if (strategies && strategies.length > 0) {
            context += `STRATEGIC DOCS:\n${strategies.map((s: any) => `- [${s.category}] ${s.title}: ${s.content.substring(0, 200)}...`).join('\n')}\n\n`;
        }

        if (memories && memories.length > 0) {
            context += `RECENT HIGH-PERFORMANCE MEMORY:\n${memories.map((m: any) => `- (${new Date(m.created_at).toLocaleDateString()}) "${m.content.substring(0, 50)}..." [Likes: ${m.metrics?.likes || 0}]`).join('\n')}`;
        }

        return {
            context,
            strategyCount: strategies?.length || 0,
            memoryCount: memories?.length || 0
        };
    } catch (e) {
        console.warn("[Pulse] Brain Context Fetch Failed:", e);
        return { context: "", strategyCount: 0, memoryCount: 0 };
    }
};

