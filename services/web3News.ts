
import { TrendItem } from "../types";
import { getSupabase } from './supabaseClient';

/**
 * WEB3 NEWS SERVICE
 * Fetches crypto/web3 news from Apify's crypto-news-scraper actor
 * Actor: apipi~crypto-news-scraper (pGMem7q7HCa1dUbN2)
 */

const ACTOR_CRYPTO_NEWS = 'pGMem7q7HCa1dUbN2';
const NEWS_RUN_WAIT_SECONDS = 30;
const NEWS_STORAGE_KEY = 'defia_web3_news_cache_v1';

// Default search terms for web3/crypto news
const DEFAULT_SEARCH_TERMS = 'bitcoin,ethereum,solana,defi,nft,web3,crypto';

interface CryptoNewsItem {
    title: string;
    description?: string;
    url: string;
    source?: string;
    publishedAt?: string;
    image?: string;
    category?: string;
}

interface NewsCache {
    items: TrendItem[];
    lastFetched: number;
}

/**
 * Run the Apify crypto news scraper actor
 */
const runCryptoNewsScraper = async (
    searchQuery: string,
    limit: number,
    token: string
): Promise<CryptoNewsItem[]> => {
    try {
        console.log(`[Web3News] Fetching crypto news for: ${searchQuery}`);

        // 1. Start the actor run
        const runRes = await fetch(
            `https://api.apify.com/v2/acts/${ACTOR_CRYPTO_NEWS}/runs?token=${token}&waitForFinish=${NEWS_RUN_WAIT_SECONDS}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    search_query: searchQuery,
                    limit: limit
                })
            }
        );

        const runData = await runRes.json();

        if (!runData.data || (runData.data.status !== 'SUCCEEDED' && runData.data.status !== 'RUNNING')) {
            console.warn(`[Web3News] Actor run failed:`, runData.data?.status);
            throw new Error(`Actor Status: ${runData.data?.status || 'Unknown'}`);
        }
        if (runData.data.status === 'RUNNING') {
            throw new Error('Actor still running');
        }

        // 2. Fetch results from dataset
        const datasetId = runData.data.defaultDatasetId;
        const itemsRes = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
        );
        const items = await itemsRes.json();

        console.log(`[Web3News] Fetched ${items?.length || 0} news items`);
        return items || [];

    } catch (e: any) {
        console.error(`[Web3News] Scraper error:`, e.message);
        throw e;
    }
};

/**
 * Transform raw news items to TrendItem format
 */
const transformNewsToTrends = (items: CryptoNewsItem[], brandName?: string): TrendItem[] => {
    const now = Date.now();

    return items.map((item, index) => {
        // Categorize based on keywords in title/description
        const text = `${item.title} ${item.description || ''}`.toLowerCase();
        let category = 'crypto';
        if (text.includes('defi') || text.includes('yield') || text.includes('liquidity')) category = 'defi';
        else if (text.includes('nft') || text.includes('collectible')) category = 'nfts';
        else if (text.includes('solana') || text.includes('sol')) category = 'solana';
        else if (text.includes('regulation') || text.includes('sec') || text.includes('law')) category = 'regulations';
        else if (text.includes('ai') || text.includes('artificial intelligence')) category = 'ai';
        else if (text.includes('bitcoin') || text.includes('btc')) category = 'bitcoin';
        else if (text.includes('ethereum') || text.includes('eth')) category = 'ethereum';

        // Calculate relevance score
        let relevanceScore = 70; // Base score
        const brandLower = brandName?.toLowerCase() || '';
        if (brandLower && text.includes(brandLower)) relevanceScore += 20;
        if (text.includes('breaking') || text.includes('urgent')) relevanceScore += 10;
        if (index < 5) relevanceScore += 5; // Boost recent items

        // Parse timestamp
        let timestamp = 'Recent';
        let createdAt = now;
        if (item.publishedAt) {
            try {
                const date = new Date(item.publishedAt);
                if (!isNaN(date.getTime())) {
                    createdAt = date.getTime();
                    const hoursAgo = Math.floor((now - createdAt) / (1000 * 60 * 60));
                    if (hoursAgo < 1) timestamp = 'Just now';
                    else if (hoursAgo < 24) timestamp = `${hoursAgo}h ago`;
                    else timestamp = date.toLocaleDateString();
                }
            } catch {
                // Keep defaults
            }
        }

        return {
            id: `news-${index}-${now}`,
            source: item.source || 'Web3 News',
            topic: category,
            headline: item.title,
            summary: item.description || item.title,
            relevanceScore: Math.min(99, relevanceScore),
            relevanceReason: relevanceScore > 85 ? 'High Priority News' :
                            relevanceScore > 75 ? 'Trending Topic' : 'Market Update',
            sentiment: 'Neutral' as const,
            timestamp,
            createdAt,
            url: item.url,
            imageUrl: item.image
                || (item as any).imageUrl
                || (item as any).image_url
                || (item as any).thumbnail
                || (item as any).thumbnailUrl
                || (item as any).media
                || (item as any).og_image
                || (item as any).ogImage
                || (item as any).img
                || (item as any).picture
                || (item as any).photo
                || (item as any).heroImage
                || (item as any).featuredImage
                || undefined,
            rawData: item
        };
    });
};

/**
 * Load cached news from Supabase
 */
const loadNewsCache = async (brandName: string): Promise<NewsCache | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
        const key = `${NEWS_STORAGE_KEY}_${brandName.toLowerCase()}`;
        const { data, error } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        if (error || !data?.value) return null;
        return data.value as NewsCache;
    } catch {
        return null;
    }
};

/**
 * Save news cache to Supabase
 */
const saveNewsCache = async (brandName: string, cache: NewsCache): Promise<void> => {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
        const key = `${NEWS_STORAGE_KEY}_${brandName.toLowerCase()}`;
        await supabase
            .from('app_storage')
            .upsert({
                key,
                value: cache,
                updated_at: new Date().toISOString()
            });
    } catch (e) {
        console.warn('[Web3News] Failed to save cache:', e);
    }
};

/**
 * Fetch Web3 news - main exported function
 * Fetches fresh news or returns cached data if recent enough
 */
export const fetchWeb3News = async (
    brandName: string,
    options: {
        searchQuery?: string;
        limit?: number;
        forceRefresh?: boolean;
        cacheDurationMs?: number;
    } = {}
): Promise<TrendItem[]> => {
    const {
        searchQuery = DEFAULT_SEARCH_TERMS,
        limit = 10,
        forceRefresh = false,
        cacheDurationMs = 24 * 60 * 60 * 1000 // 24 hours default
    } = options;

    const token = process.env.VITE_APIFY_API_TOKEN ||
                  (import.meta as any).env?.VITE_APIFY_API_TOKEN ||
                  process.env.APIFY_API_TOKEN || '';

    if (!token) {
        console.warn('[Web3News] No Apify token available');
        return [];
    }

    // Check cache first
    if (!forceRefresh) {
        const cache = await loadNewsCache(brandName);
        if (cache && (Date.now() - cache.lastFetched) < cacheDurationMs) {
            console.log(`[Web3News] Using cached news (${cache.items.length} items)`);
            return cache.items;
        }
    }

    try {
        // Fetch fresh news
        const rawItems = await runCryptoNewsScraper(searchQuery, limit, token);
        const trendItems = transformNewsToTrends(rawItems, brandName);

        // Cache the results
        const cache: NewsCache = {
            items: trendItems,
            lastFetched: Date.now()
        };
        await saveNewsCache(brandName, cache);

        return trendItems;

    } catch (e) {
        console.error('[Web3News] Fetch failed:', e);

        // Try to return stale cache on error
        const cache = await loadNewsCache(brandName);
        if (cache?.items?.length) {
            console.log('[Web3News] Returning stale cache on error');
            return cache.items;
        }

        return [];
    }
};

/**
 * Server-side scheduled news fetch
 * Call this from a cron job to keep news fresh
 */
export const scheduledNewsFetch = async (brandNames: string[]): Promise<void> => {
    console.log('[Web3News] Running scheduled news fetch...');

    for (const brandName of brandNames) {
        try {
            await fetchWeb3News(brandName, { forceRefresh: true });
            // Rate limit between brands
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.error(`[Web3News] Scheduled fetch failed for ${brandName}:`, e);
        }
    }
};

export default fetchWeb3News;
