
import { TrendItem } from "../types";

// In a real app, this would call a backend scraping service (Apify/Twitter API)
// For this demo, we simulate "Live" data fetching based on the Brand's niche.


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

        // Client-side sort by social volume to ensure we get trends, not just top market cap
        coins.sort((a: any, b: any) => (b.social_volume_24h || 0) - (a.social_volume_24h || 0));
        coins = coins.slice(0, 50);

        return coins.map((coin: any) => ({
            id: `lc-${coin.id}`,
            source: 'LunarCrush',
            headline: `${coin.name} (${coin.symbol}) Trending`,
            summary: `High social volume for ${coin.name}. 24h Interactions: ${coin.interactions_24h || 0}. 24h Volume: ${coin.social_volume_24h || 0}`,
            relevanceScore: Math.min(99, Math.floor((coin.social_score_24h || 50) + 20)), // Normalize score
            relevanceReason: "High social activity detected.",
            sentiment: (coin.sentiment || 0) > 50 ? 'Positive' : 'Neutral',
            timestamp: 'Live',
            createdAt: now,
            url: `https://lunarcrush.com/coins/${coin.symbol.toLowerCase()}`,
            rawData: coin // Store full object for backend readiness
        }));

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

