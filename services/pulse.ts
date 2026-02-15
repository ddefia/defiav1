
import { TrendItem } from "../types";
import { getSupabase } from './supabaseClient';
import { fetchWeb3News } from './web3News';

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

export const fetchMarketPulse = async (brandName: string): Promise<TrendItem[]> => {
    let items: TrendItem[] = [];

    // Web3 News only — Twitter data comes from server-side cache (fetched by scheduler every 6h).
    // Previously this also ran a separate Apify Twitter actor call, which was burning credits
    // since the server already fetches the same data via the brain cycle cron.
    try {
        const web3NewsItems = await fetchWeb3News(brandName, {
            limit: 10,
            cacheDurationMs: 24 * 60 * 60 * 1000 // 24 hour cache
        });
        if (web3NewsItems && web3NewsItems.length > 0) {
            items = [...items, ...web3NewsItems];
        }
    } catch (e) {
        console.warn("Web3 News fetch failed:", e);
    }

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
