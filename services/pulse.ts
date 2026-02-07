
import { TrendItem } from "../types";
import { getSupabase } from './supabaseClient';
import { loadIntegrationKeys } from './storage';
import { fetchWeb3News } from './web3News';


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

// LunarCrush integration removed — trends are now sourced via Web3 News (Apify)

// --- LunarCrush Creator Endpoints (Proxy to Backend) ---

const PROXY_BASE = process.env.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_BASE_URL || '/api/lunarcrush';

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

const cleanHandle = (handle?: string) => handle?.replace(/^@/, '').trim() || '';

const buildSearchTerms = (brandName: string, handle?: string, focusSymbol?: string) => {
    const keywords = new Set<string>();
    if (brandName) keywords.add(`"${brandName}"`);
    const normalizedHandle = cleanHandle(handle);
    if (normalizedHandle) {
        keywords.add(normalizedHandle);
        keywords.add(`@${normalizedHandle}`);
    }
    if (focusSymbol) {
        const normalizedSymbol = focusSymbol.replace(/^#/, '').trim();
        if (normalizedSymbol) {
            keywords.add(normalizedSymbol);
            keywords.add(`#${normalizedSymbol}`);
        }
    }
    ['#web3', '#crypto', 'Ethereum', 'Bitcoin'].forEach(term => keywords.add(term));
    return Array.from(keywords).join(' OR ');
};

export const fetchMarketPulse = async (brandName: string): Promise<TrendItem[]> => {
    const integrationKeys = loadIntegrationKeys(brandName);
    const apifyToken = process.env.VITE_APIFY_API_TOKEN || (import.meta as any).env?.VITE_APIFY_API_TOKEN || process.env.APIFY_API_TOKEN;
    const apifyHandle = integrationKeys.apify;
    const now = Date.now();
    let items: TrendItem[] = [];

    // Parallel Fetching - Web3 News (primary) + Twitter (Apify only, no LunarCrush)
    const [web3NewsItems, apifyItems] = await Promise.all([
        // 1. Web3 News from Apify crypto-news-scraper (PRIMARY SOURCE)
        fetchWeb3News(brandName, {
            limit: 10,
            cacheDurationMs: 24 * 60 * 60 * 1000 // 24 hour cache
        }).catch(e => {
            console.warn("Web3 News fetch failed:", e);
            return [] as TrendItem[];
        }),

        // 2. Twitter trends via unified actor
        (async () => {
            if (apifyToken) {
                try {
                    console.log("Fetching live trends via Apify Twitter...");
                    const handle = cleanHandle(apifyHandle) || brandName;
                    const tweetItems = await runApifyActor('VsTreSuczsXhhRIqa', {
                        "handles": [handle],
                        "tweetsDesired": 5,
                        "profilesDesired": 0,
                        "withReplies": false,
                        "includeUserInfo": false,
                        "proxyConfig": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
                    }, apifyToken);

                    if (tweetItems && tweetItems.length > 0) {
                        return tweetItems.map((item: any) => {
                            const engagement = (item.retweets || 0) * 2 + (item.likes || 0) + (item.replies || 0);
                            const calcScore = Math.min(99, 60 + Math.ceil(engagement / 100));

                            return {
                                id: item.id || `trend-${Math.random()}`,
                                source: 'Twitter',
                                headline: item.text ? item.text.substring(0, 50) + "..." : "Trend",
                                summary: item.text || "No summary",
                                relevanceScore: calcScore,
                                relevanceReason: engagement > 1000 ? "High Engagement Velocity" : "Emerging Conversation",
                                sentiment: 'Neutral' as const,
                                timestamp: 'Live',
                                createdAt: now,
                                url: item.url,
                                rawData: item
                            };
                        });
                    }
                } catch (e) {
                    console.warn("Apify Twitter fetch failed:", e);
                }
            }
            return null;
        })()
    ]);

    // Combine results - Web3 News first (primary), then Twitter
    if (web3NewsItems && web3NewsItems.length > 0) {
        items = [...items, ...web3NewsItems];
    }
    if (apifyItems) items = [...items, ...apifyItems];

    // Sort by relevance score then recency
    items.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
        }
        return b.createdAt - a.createdAt;
    });

    return items;
};

// --- DEEP BRAIN CONTEXT (RAG/SUPABASE) ---
export const getBrainContext = async (brandId?: string): Promise<{ context: string, strategyCount: number, memoryCount: number }> => {
    const supabase = getSupabase();
    if (!supabase || !brandId) return { context: "", strategyCount: 0, memoryCount: 0 };

    try {
        console.log(`[Pulse] Fetching Deep Context for ${brandId}...`);

        // 1. Fetch Strategy Docs (Goals/Mandates)
        const { data: strategies } = await supabase
            .from('strategy_docs')
            .select('title, content, category')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false }) // Prioritize Newest Mandates
            .limit(3);

        // 2. Fetch Top Performing Past Tweets (Memory)
        // Note: metrics is jsonb, so we cast to compare. Or just sort by created_at for now if simple.
        // Doing a simple "Recent" fetch for now as 'metrics->likes' sorting might tricky without index in raw SQL setup.
        const { data: memories } = await supabase
            .from('brand_memory')
            .select('content, metrics, created_at')
            .eq('brand_id', brandId)
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
