
import fetch from 'node-fetch';

/**
 * WEB3 NEWS SERVICE (Server-Side)
 * Fetches crypto/web3 news from Apify's crypto-news-scraper actor
 * Actor: apipi~crypto-news-scraper (pGMem7q7HCa1dUbN2)
 */

const ACTOR_CRYPTO_NEWS = 'pGMem7q7HCa1dUbN2';
const NEWS_RUN_WAIT_SECONDS = 30;
const NEWS_STORAGE_KEY = 'defia_web3_news_cache_v1';

// Default search terms for web3/crypto news
const DEFAULT_SEARCH_TERMS = 'bitcoin,ethereum,solana,defi,nft,web3,crypto';

/**
 * Run the Apify crypto news scraper actor
 */
export const runCryptoNewsScraper = async (searchQuery, limit, token) => {
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

    } catch (e) {
        console.error(`[Web3News] Scraper error:`, e.message);
        throw e;
    }
};

/**
 * Transform raw news items to a standard format
 */
export const transformNewsItems = (items, brandName) => {
    const now = Date.now();

    return items.map((item, index) => {
        // Categorize based on keywords in title/description
        const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
        let category = 'crypto';
        if (text.includes('defi') || text.includes('yield') || text.includes('liquidity')) category = 'defi';
        else if (text.includes('nft') || text.includes('collectible')) category = 'nfts';
        else if (text.includes('solana') || text.includes('sol')) category = 'solana';
        else if (text.includes('regulation') || text.includes('sec') || text.includes('law')) category = 'regulations';
        else if (text.includes('ai') || text.includes('artificial intelligence')) category = 'ai';
        else if (text.includes('bitcoin') || text.includes('btc')) category = 'bitcoin';
        else if (text.includes('ethereum') || text.includes('eth')) category = 'ethereum';

        // Calculate relevance score
        let relevanceScore = 70;
        const brandLower = (brandName || '').toLowerCase();
        if (brandLower && text.includes(brandLower)) relevanceScore += 20;
        if (text.includes('breaking') || text.includes('urgent')) relevanceScore += 10;
        if (index < 5) relevanceScore += 5;

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
            headline: item.title || 'Untitled',
            summary: item.description || item.title || '',
            relevanceScore: Math.min(99, relevanceScore),
            relevanceReason: relevanceScore > 85 ? 'High Priority News' :
                            relevanceScore > 75 ? 'Trending Topic' : 'Market Update',
            sentiment: 'Neutral',
            timestamp,
            createdAt,
            url: item.url || '',
            imageUrl: item.image || null,
            rawData: item
        };
    });
};

/**
 * Fetch and cache Web3 news
 */
export const fetchWeb3News = async (supabase, brandName, options = {}) => {
    const {
        searchQuery = DEFAULT_SEARCH_TERMS,
        limit = 10,
        forceRefresh = false,
        cacheDurationMs = 24 * 60 * 60 * 1000 // 24 hours
    } = options;

    const token = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN || '';

    if (!token) {
        console.warn('[Web3News] No Apify token available');
        return { items: [], error: 'Missing API token' };
    }

    const cacheKey = `${NEWS_STORAGE_KEY}_${(brandName || 'global').toLowerCase()}`;

    // Check cache first
    if (!forceRefresh && supabase) {
        try {
            const { data, error } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', cacheKey)
                .maybeSingle();

            if (!error && data?.value) {
                const cache = data.value;
                if (cache.lastFetched && (Date.now() - cache.lastFetched) < cacheDurationMs) {
                    console.log(`[Web3News] Using cached news (${cache.items?.length || 0} items)`);
                    return { items: cache.items || [], cached: true };
                }
            }
        } catch (e) {
            console.warn('[Web3News] Cache check failed:', e.message);
        }
    }

    try {
        // Fetch fresh news
        const rawItems = await runCryptoNewsScraper(searchQuery, limit, token);
        const newsItems = transformNewsItems(rawItems, brandName);

        // Cache the results
        if (supabase) {
            try {
                await supabase
                    .from('app_storage')
                    .upsert({
                        key: cacheKey,
                        value: { items: newsItems, lastFetched: Date.now() },
                        updated_at: new Date().toISOString()
                    });
            } catch (e) {
                console.warn('[Web3News] Failed to save cache:', e.message);
            }
        }

        return { items: newsItems, cached: false };

    } catch (e) {
        console.error('[Web3News] Fetch failed:', e.message);

        // Try to return stale cache on error
        if (supabase) {
            try {
                const { data } = await supabase
                    .from('app_storage')
                    .select('value')
                    .eq('key', cacheKey)
                    .maybeSingle();

                if (data?.value?.items?.length) {
                    console.log('[Web3News] Returning stale cache on error');
                    return { items: data.value.items, cached: true, stale: true };
                }
            } catch {
                // Ignore
            }
        }

        return { items: [], error: e.message };
    }
};

/**
 * Scheduled news fetch for all active brands
 */
export const scheduledNewsFetch = async (supabase, brands = []) => {
    console.log('[Web3News] Running scheduled news fetch...');

    const results = [];

    // Fetch global news first
    const globalResult = await fetchWeb3News(supabase, 'global', { forceRefresh: true });
    results.push({ brand: 'global', count: globalResult.items?.length || 0 });

    // Fetch for each brand
    for (const brand of brands) {
        try {
            const brandName = brand.name || brand.id;
            const result = await fetchWeb3News(supabase, brandName, { forceRefresh: true });
            results.push({ brand: brandName, count: result.items?.length || 0 });
            // Rate limit between brands
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.error(`[Web3News] Scheduled fetch failed for ${brand.name || brand.id}:`, e.message);
            results.push({ brand: brand.name || brand.id, error: e.message });
        }
    }

    return results;
};
