
import fetch from 'node-fetch';

/**
 * WEB3 NEWS SERVICE (Server-Side)
 * Primary: RSS feeds from major crypto news sites (free, no token needed)
 * Fallback: Apify crypto-news-scraper actor (requires token)
 */

const ACTOR_CRYPTO_NEWS = 'pGMem7q7HCa1dUbN2';
const NEWS_RUN_WAIT_SECONDS = 30;
const NEWS_STORAGE_KEY = 'defia_web3_news_cache_v1';

// RSS feeds from major crypto news sources
const RSS_FEEDS = [
    { url: 'https://cointelegraph.com/rss', source: 'cointelegraph.com' },
    { url: 'https://decrypt.co/feed', source: 'decrypt.co' },
    { url: 'https://thedefiant.io/feed', source: 'thedefiant.io' },
    { url: 'https://blockworks.co/feed', source: 'blockworks.co' },
];

/**
 * Parse RSS XML into news items (lightweight, no external dependency)
 */
const parseRSSItems = (xml, sourceName) => {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        const getTag = (tag) => {
            // Handle CDATA
            const cdataMatch = itemXml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i'));
            if (cdataMatch) return cdataMatch[1].trim();
            const simpleMatch = itemXml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
            return simpleMatch ? simpleMatch[1].trim() : '';
        };

        const title = getTag('title');
        const link = getTag('link') || getTag('guid');
        const pubDate = getTag('pubDate') || getTag('dc:date') || getTag('atom:updated');
        const description = getTag('description').replace(/<[^>]+>/g, '').substring(0, 300);
        const creator = getTag('dc:creator') || getTag('author');

        // Extract image from media:content, enclosure, or description
        let imageUrl = null;
        const mediaMatch = itemXml.match(/<media:content[^>]*url=["']([^"']+)["']/i);
        if (mediaMatch) imageUrl = mediaMatch[1];
        if (!imageUrl) {
            const encMatch = itemXml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
            if (encMatch) imageUrl = encMatch[1];
        }
        if (!imageUrl) {
            const imgMatch = itemXml.match(/<img[^>]*src=["']([^"']+)["']/i);
            if (imgMatch) imageUrl = imgMatch[1];
        }

        // Extract source from news_provider or use feed source
        const newsProvider = getTag('source') || sourceName;

        if (title && link) {
            items.push({
                title,
                url: link,
                description,
                publishedAt: pubDate,
                createdAt: pubDate,
                source: newsProvider,
                news_provider: newsProvider,
                thumbnail_image: imageUrl,
                image: imageUrl,
                creator,
            });
        }
    }

    return items;
};

/**
 * Fetch news from RSS feeds (free, no API key required)
 */
export const fetchRSSNews = async (limit = 10) => {
    console.log('[Web3News] Fetching from RSS feeds...');
    const allItems = [];

    const feedResults = await Promise.allSettled(
        RSS_FEEDS.map(async (feed) => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);
                const res = await fetch(feed.url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Defia/1.0)' },
                    signal: controller.signal,
                    redirect: 'follow',
                });
                clearTimeout(timeout);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const xml = await res.text();
                const items = parseRSSItems(xml, feed.source);
                console.log(`[Web3News] RSS ${feed.source}: ${items.length} items`);
                return items;
            } catch (e) {
                console.warn(`[Web3News] RSS ${feed.source} failed:`, e.message);
                return [];
            }
        })
    );

    for (const result of feedResults) {
        if (result.status === 'fulfilled' && result.value.length > 0) {
            allItems.push(...result.value);
        }
    }

    // Sort by publish date (newest first) and deduplicate by URL
    const seen = new Set();
    const unique = allItems.filter(item => {
        const key = item.url?.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort by date
    unique.sort((a, b) => {
        const dateA = new Date(a.publishedAt || 0).getTime();
        const dateB = new Date(b.publishedAt || 0).getTime();
        return dateB - dateA;
    });

    console.log(`[Web3News] RSS total: ${unique.length} unique items, returning top ${limit}`);
    return unique.slice(0, limit);
};

/**
 * Extract og:image from an article URL (fallback when feeds don't provide images)
 */
const fetchOgImage = async (url) => {
    if (!url) return null;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Defia/1.0)' },
            redirect: 'follow',
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const html = await res.text();
        const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        if (ogMatch?.[1]) return ogMatch[1];
        const twMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
        return twMatch?.[1] || null;
    } catch {
        return null;
    }
};

// Default search terms for web3/crypto news
const DEFAULT_SEARCH_TERMS = 'bitcoin,ethereum,solana,defi,nft,web3,crypto';

/**
 * Run the Apify crypto news scraper actor (optional, requires token)
 */
export const runCryptoNewsScraper = async (searchQuery, limit, token) => {
    try {
        console.log(`[Web3News] Fetching crypto news via Apify for: ${searchQuery}`);

        const runRes = await fetch(
            `https://api.apify.com/v2/acts/${ACTOR_CRYPTO_NEWS}/runs?token=${token}&waitForFinish=${NEWS_RUN_WAIT_SECONDS}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ search_query: searchQuery, limit }),
            }
        );

        const runData = await runRes.json();

        if (runData.error) {
            throw new Error(`Apify error: ${runData.error.message || runData.error.type || 'Unknown'}`);
        }

        if (!runData.data || (runData.data.status !== 'SUCCEEDED' && runData.data.status !== 'RUNNING')) {
            throw new Error(`Actor Status: ${runData.data?.status || 'Unknown'}`);
        }
        if (runData.data.status === 'RUNNING') {
            throw new Error('Actor still running');
        }

        const datasetId = runData.data.defaultDatasetId;
        const itemsRes = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`
        );
        const items = await itemsRes.json();

        console.log(`[Web3News] Apify fetched ${items?.length || 0} news items`);
        return items || [];

    } catch (e) {
        console.error(`[Web3News] Apify scraper error:`, e.message);
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

        // Parse timestamp — check multiple date fields
        let timestamp = 'Recent';
        let createdAt = now;
        const dateStr = item.publishedAt || item.createdAt || item.pubDate || item.date || item.published;
        if (dateStr) {
            try {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    createdAt = date.getTime();
                    const hoursAgo = Math.floor((now - createdAt) / (1000 * 60 * 60));
                    if (hoursAgo < 1) timestamp = 'Just now';
                    else if (hoursAgo < 24) timestamp = `${hoursAgo}h ago`;
                    else {
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        timestamp = `${monthNames[date.getMonth()]} ${date.getDate()}`;
                    }
                }
            } catch {
                // Keep defaults
            }
        }

        // Extract source domain from URL for display
        let sourceName = item.source || item.news_provider || 'Web3 News';
        if (sourceName === 'Web3 News' && item.url) {
            try {
                sourceName = new URL(item.url).hostname.replace('www.', '');
            } catch { /* keep default */ }
        }

        return {
            id: `news-${index}-${now}`,
            source: sourceName,
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
            imageUrl: item.image || item.imageUrl || item.image_url || item.thumbnail || item.thumbnailUrl
                || item.thumbnail_image || item.media || item.og_image || item.ogImage || item.img || item.picture
                || item.photo || item.heroImage || item.featuredImage || item.cover || null,
            rawData: item
        };
    });
};

/**
 * Fetch and cache Web3 news
 * Strategy: RSS feeds first (free), Apify as fallback if token available
 */
export const fetchWeb3News = async (supabase, brandName, options = {}) => {
    const {
        searchQuery = DEFAULT_SEARCH_TERMS,
        limit = 10,
        forceRefresh = false,
        cacheDurationMs = 4 * 60 * 60 * 1000 // 4 hours
    } = options;

    const cacheKey = `${NEWS_STORAGE_KEY}_${(brandName || 'global').toLowerCase()}`;

    // Check cache first (unless force refresh)
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

    // Try fetching fresh news
    let rawItems = null;
    let fetchSource = null;

    // 1. Try RSS feeds first (free, always available)
    try {
        rawItems = await fetchRSSNews(limit);
        if (rawItems?.length > 0) {
            fetchSource = 'rss';
            console.log(`[Web3News] Got ${rawItems.length} items from RSS feeds`);
        }
    } catch (e) {
        console.warn('[Web3News] RSS fetch failed:', e.message);
    }

    // 2. If RSS failed or returned nothing, try Apify
    if (!rawItems?.length) {
        const token = process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_API_TOKEN || '';
        if (token) {
            try {
                rawItems = await runCryptoNewsScraper(searchQuery, limit, token);
                if (rawItems?.length > 0) {
                    fetchSource = 'apify';
                    console.log(`[Web3News] Got ${rawItems.length} items from Apify`);
                }
            } catch (e) {
                console.warn('[Web3News] Apify fallback also failed:', e.message);
            }
        }
    }

    // If we got fresh items, transform and cache
    if (rawItems?.length > 0) {
        const newsItems = transformNewsItems(rawItems, brandName);

        // Fill in missing images via og:image extraction (best-effort, parallel)
        const needsImage = newsItems.filter(item => !item.imageUrl && item.url);
        if (needsImage.length > 0) {
            console.log(`[Web3News] Fetching og:image for ${needsImage.length} articles without images`);
            const ogResults = await Promise.allSettled(
                needsImage.slice(0, 8).map(item => fetchOgImage(item.url))
            );
            needsImage.slice(0, 8).forEach((item, i) => {
                if (ogResults[i]?.status === 'fulfilled' && ogResults[i].value) {
                    item.imageUrl = ogResults[i].value;
                }
            });
            const filled = ogResults.filter(r => r.status === 'fulfilled' && r.value).length;
            console.log(`[Web3News] og:image extracted for ${filled}/${needsImage.length} articles`);
        }

        // Cache the results
        if (supabase) {
            try {
                await supabase
                    .from('app_storage')
                    .upsert({
                        key: cacheKey,
                        value: { items: newsItems, lastFetched: Date.now(), source: fetchSource },
                        updated_at: new Date().toISOString()
                    });
            } catch (e) {
                console.warn('[Web3News] Failed to save cache:', e.message);
            }
        }

        return { items: newsItems, cached: false, source: fetchSource };
    }

    // All fetches failed — return stale cache if available
    console.warn('[Web3News] All news sources failed, checking stale cache...');
    if (supabase) {
        try {
            const { data } = await supabase
                .from('app_storage')
                .select('value')
                .eq('key', cacheKey)
                .maybeSingle();

            if (data?.value?.items?.length) {
                console.log('[Web3News] Returning stale cache as last resort');
                return { items: data.value.items, cached: true, stale: true };
            }
        } catch {
            // Ignore
        }
    }

    return { items: [], error: 'All news sources unavailable' };
};

/**
 * Scheduled news fetch for all active brands
 */
export const scheduledNewsFetch = async (supabase, brands = []) => {
    console.log('[Web3News] Running scheduled news fetch...');

    const results = [];

    // Fetch global news first
    const globalResult = await fetchWeb3News(supabase, 'global', { forceRefresh: true });
    results.push({ brand: 'global', count: globalResult.items?.length || 0, source: globalResult.source || 'cache' });

    // Fetch for each brand (they all share the same RSS feeds, but cache separately)
    for (const brand of brands) {
        try {
            const brandName = brand.name || brand.id;
            const result = await fetchWeb3News(supabase, brandName, { forceRefresh: true });
            results.push({ brand: brandName, count: result.items?.length || 0, source: result.source || 'cache' });
            // Rate limit between brands
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.error(`[Web3News] Scheduled fetch failed for ${brand.name || brand.id}:`, e.message);
            results.push({ brand: brand.name || brand.id, error: e.message });
        }
    }

    return results;
};
