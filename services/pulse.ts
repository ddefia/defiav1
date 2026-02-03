
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

const fetchLunarCrushTrends = async (focusSymbol?: string, brandName?: string): Promise<TrendItem[]> => {
    const token = process.env.VITE_LUNARCRUSH_API_KEY || (import.meta as any).env?.VITE_LUNARCRUSH_API_KEY;
    if (!token) return [];

    try {
        console.log("Fetching LunarCrush TOPICS (Smart Trends)...");
        // 1. Fetch Trending TOPICS (Meta-Narratives) instead of Coins
        const response = await fetch("https://lunarcrush.com/api4/public/topics/list/v1", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.warn(`LunarCrush API Error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        let topics = data.data || [];
        const now = Date.now();

        // 2. Sort by INTERACTIONS (Vol is often null for topics)
        topics.sort((a: any, b: any) => (b.interactions_24h || 0) - (a.interactions_24h || 0));

        // 3. Take Top 5 Actionable Topics (e.g. AI, Gaming, Tech)
        // Filter out generic filler if needed (e.g. "Country" names if they appear and aren't relevant), 
        // but broadly topics are good signals.
        // 3. Take Top 10 Topics (Increased from 5 to allow filtering)
        const candidates = topics.slice(0, 15);

        // STRICT WEB3 FILTERING
        // 1. BLACKLIST: Kill mainstream tech/finance spam
        const BLACKLIST = [
            'roblox', 'fortnite', 'minecraft', 'youtube', 'tiktok', 'netflix', 'disney', 'marvel', 'taylor swift',
            'nvidia', 'samsung', 'apple', 'google', 'microsoft', 'meta', 'stock', 'shares', 'earnings', 'revenue',
            'nasdaq', 'sp500', 'dow jones', 'interest rates', 'fed', 'inflation', 'gdp'
        ];

        // 2. WHITELIST: Content MUST contain one of these to be considered "Web3"
        const WEB3_KEYWORDS = [
            'crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'memecoin', 'pepe', 'doge', 'shib',
            'bonk', 'wif', 'defi', 'nft', 'airdrop', 'token', 'altcoin', 'bull', 'bear', 'wallet', 'chain',
            'l2', 'rollup', 'meme', 'gm', 'wagmi', 'dao', 'yield', 'staking', 'pixel', 'ordinals', 'runes',
            'base', 'optimism', 'arb', 'sui', 'aptos', 'sei', 'injective', 'cosmos', 'atom', 'blast', 'pump'
        ];

        const focusTerms = [focusSymbol, brandName].filter(Boolean).map(term => term!.toLowerCase());

        const filteredTopics = candidates.filter((t: any) => {
            const topic = (t.topic || '').toLowerCase();
            if (!topic) return false;

            // A. CHECK BLACKLIST
            if (BLACKLIST.some(b => topic.includes(b))) {
                return false;
            }

            // B. CHECK WHITELIST (Strict Mode)
            // If the topic is just "AI", it's risky. But "AI Agent" or "Crypto AI" is fine.
            // We check if the topic matches a keyword OR if the topic itself is a known coin symbol (often length 3-4).
            // Simplest robust check:
            const isWeb3 = WEB3_KEYWORDS.some(k => topic.includes(k));
            const isFocusMatch = focusTerms.some(term => term && topic.includes(term));

            // Allow symbols naturally (length 3-4 uppercase in raw, but logical here) 
            // Broaden: If it's not blacklisted, and passed LunarCrush crypto topics filter...
            // Wait, LC "Topics" endpoint mixes everything. So we MUST enforce whitelist.

            return isWeb3 || isFocusMatch;
        }).sort((a: any, b: any) => {
            const aTopic = (a.topic || '').toLowerCase();
            const bTopic = (b.topic || '').toLowerCase();
            const aFocus = focusTerms.some(term => term && aTopic.includes(term));
            const bFocus = focusTerms.some(term => term && bTopic.includes(term));
            if (aFocus !== bFocus) return aFocus ? -1 : 1;
            return (b.interactions_24h || 0) - (a.interactions_24h || 0);
        }).slice(0, 5); // Take top 5 VALID ones

        // 4. Enrich with REAL NEWS (The "Why")
        const enrichedTrends = await Promise.all(filteredTopics.map(async (t: any) => {
            const topicName = t.topic;
            let context = `Market Movement: High social volume detected for ${topicName}.`;
            let headline = `${topicName} Trending`;

            try {
                // Fetch TOP NEWS for this topic
                const newsRes = await fetch(`https://lunarcrush.com/api4/public/topic/${topicName}/news/v1`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (newsRes.ok) {
                    const newsData = await newsRes.json();
                    const stories = newsData.data || [];

                    if (stories.length > 0) {
                        const topStory = stories[0];
                        // Use the News Title as the HEADLINE (Fixing the "ai" issue)
                        headline = topStory.post_title;

                        // Use the rest as context
                        context = `Source: ${topStory.creator_display_name || 'Market Wire'}`;

                        // If title is too short, fall back
                        if (headline.length < 10) headline = `${topicName}: Market Movement Detected`;
                    }
                }
            } catch (e) {
                console.warn(`News fetch failed for ${topicName}`, e);
            }

            let aiReasoning = "GAIA: Monitoring emerging narrative.";
            const volume = t.interactions_24h || 0;
            if (volume > 100000) aiReasoning = "GAIA: High Velocity Event (Viral)";
            else if (volume > 50000) aiReasoning = "GAIA: Strong Sector Momentum";
            else if (volume > 10000) aiReasoning = "GAIA: Growing Interest Signal";

            return {
                id: `lc-topic-${topicName}`,
                source: 'LunarCrush',
                topic: topicName, // New: The high-level category
                headline: headline, // Now the Real News Title or a better fallback
                summary: context,
                relevanceScore: Math.min(99, 75 + Math.floor(volume / 5000)), // Base score higher for valid topics
                relevanceReason: aiReasoning,
                sentiment: 'Neutral',
                timestamp: 'Live',
                createdAt: now,
                url: `https://lunarcrush.com/topics/${topicName}`,
                rawData: t
            };
        }));

        // FINAL FILTER: Remove items where we couldn't find a real headline and it's just "Topic Trending"
        // This prevents the "ai" issue where no news was found.
        const validTrends = enrichedTrends.filter(t => !t.headline.endsWith(' Trending') || t.relevanceScore > 90);

        return validTrends;

    } catch (e) {
        console.warn("LunarCrush fetch failed", e);
        return [];
    }
};

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
    const lunarSymbol = integrationKeys.lunarCrush;
    const now = Date.now();
    let items: TrendItem[] = [];

    // Parallel Fetching - Web3 News (primary), Twitter, and LunarCrush (fallback)
    const [web3NewsItems, apifyItems, lunarItems] = await Promise.all([
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
        })(),

        // 3. LunarCrush (fallback/supplementary)
        fetchLunarCrushTrends(lunarSymbol, brandName)
    ]);

    // Combine results - Web3 News first (primary), then Twitter, then LunarCrush
    if (web3NewsItems && web3NewsItems.length > 0) {
        items = [...items, ...web3NewsItems];
    }
    if (apifyItems) items = [...items, ...apifyItems];
    if (lunarItems) items = [...items, ...lunarItems];

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
