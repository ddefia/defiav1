
import React, { useState, useEffect, useRef } from 'react';
import { TrendItem, BrandConfig } from '../types';
import { fetchMarketPulse } from '../services/pulse';
import { loadPulseCache, savePulseCache } from '../services/storage';
import { getSupabase } from '../services/supabaseClient';

interface Web3NewsFeedProps {
    brandName: string;
    brandConfig: BrandConfig;
    onCreateContent?: (newsItem: TrendItem) => void;
    onSelectArticle?: (article: NewsItem) => void;
}

type CategoryFilter = 'all' | 'defi' | 'nfts' | 'solana' | 'regulations' | 'ai';

export interface NewsItem extends TrendItem {
    imageUrl?: string;
    sourceName?: string;
    category?: string;
    relevanceBadge?: string;
}

interface AIInsight {
    type: string;
    icon: string;
    color: string;
    title: string;
    description: string;
}

interface TrendingTopic {
    hashtag: string;
    count: number;
}

const NEWS_SUPABASE_KEY = 'defia_web3_news_cache_v1';

/**
 * Try to load news from the Supabase cache that the server cron populates every 6 hours.
 * This is the fastest path — no Apify actors, just a DB read.
 */
const loadServerNewsCache = async (brandName: string): Promise<{ items: TrendItem[]; lastFetched: number } | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
        const key = `${NEWS_SUPABASE_KEY}_${brandName.toLowerCase()}`;
        const { data, error } = await supabase
            .from('app_storage')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        if (error || !data?.value) return null;
        const cache = data.value as { items: TrendItem[]; lastFetched: number };
        if (cache.items && cache.items.length > 0) {
            return cache;
        }
        return null;
    } catch {
        return null;
    }
};

export const Web3NewsFeed: React.FC<Web3NewsFeedProps> = ({ brandName, brandConfig, onCreateContent, onSelectArticle }) => {
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [lastUpdated, setLastUpdated] = useState<number>(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch news data — prioritize server cache (Supabase), then localStorage, then live fetch
    useEffect(() => {
        let cancelled = false;

        const loadData = async () => {
            // 1. INSTANT: Show localStorage cache immediately (if any)
            const localCache = loadPulseCache(brandName);
            if (localCache.items.length > 0 && !cancelled) {
                setNewsItems(transformToNewsItems(localCache.items));
                setLastUpdated(localCache.lastUpdated);
                setIsLoading(false);
            }

            // 2. FAST: Try Supabase server cache (populated by cron every 6h)
            try {
                const serverCache = await loadServerNewsCache(brandName);
                if (serverCache && serverCache.items.length > 0 && !cancelled) {
                    const transformed = transformToNewsItems(serverCache.items);
                    setNewsItems(transformed);
                    setLastUpdated(serverCache.lastFetched);
                    setIsLoading(false);

                    // Sync server cache → localStorage for next instant load
                    savePulseCache(brandName, { lastUpdated: serverCache.lastFetched, items: serverCache.items });

                    // If server cache is fresh enough (< 12 hours), don't bother with live fetch
                    const cacheAge = Date.now() - serverCache.lastFetched;
                    if (cacheAge < 12 * 60 * 60 * 1000) {
                        return; // Server cache is fresh, no need for Apify
                    }
                }
            } catch (e) {
                console.warn('[Web3News] Server cache load failed:', e);
            }

            // 3. SLOW (only if no fresh cache): Live fetch via Apify
            const now = Date.now();
            const CACHE_DURATION = 30 * 60 * 1000; // 30 min — much more conservative than before (was 10min)
            const shouldFetch = (now - (lastUpdated || localCache.lastUpdated)) > CACHE_DURATION || newsItems.length === 0;

            if (shouldFetch && !cancelled) {
                await handleRefresh();
            } else if (!cancelled) {
                setIsLoading(false);
            }
        };

        loadData();

        // Auto-refresh every 30 minutes (not 10 — server cron handles freshness)
        intervalRef.current = setInterval(() => {
            handleRefresh();
        }, 30 * 60 * 1000);

        return () => {
            cancelled = true;
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [brandName]);

    const transformToNewsItems = (items: TrendItem[]): NewsItem[] => {
        return items
            .filter(item => {
                // Filter out LunarCrush items and items with no real headline
                if (item.source === 'LunarCrush') return false;
                const h = (item.headline || '').trim().toLowerCase();
                if (!h || h === 'trend' || h === 'trending' || h.endsWith(' trending')) return false;
                return true;
            })
            .map(item => ({
                ...item,
                sourceName: item.source === 'Twitter' ? 'X / Twitter' : (item.source || 'Web3 News'),
                category: item.topic?.toLowerCase() || 'defi',
                relevanceBadge: item.relevanceScore > 80 ? `High relevance to ${brandName}` :
                               item.relevanceScore > 60 ? 'Direct competitor analysis' :
                               'May affect compliance strategy'
            }));
    };

    const handleRefresh = async () => {
        setIsLoading(true);
        try {
            const newItems = await fetchMarketPulse(brandName);
            const now = Date.now();

            const cache = loadPulseCache(brandName);
            const existingMap = new Map(cache.items.map(i => [i.id, i]));
            newItems.forEach(item => existingMap.set(item.id, item));

            const mergedItems = Array.from(existingMap.values());
            mergedItems.sort((a, b) => b.createdAt - a.createdAt);

            setNewsItems(transformToNewsItems(mergedItems));
            setLastUpdated(now);
            savePulseCache(brandName, { lastUpdated: now, items: mergedItems });
        } catch (e) {
            console.error("News fetch failed", e);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter news items
    const filteredNews = newsItems.filter(item => {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (searchQuery && !item.headline.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    // Derive trending topics from actual news categories
    const derivedTrending: TrendingTopic[] = (() => {
        const categoryCount = new Map<string, number>();
        newsItems.forEach(item => {
            const cat = (item.category || 'crypto').toLowerCase();
            categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
        });
        const topicMap: Record<string, string> = {
            defi: '#DeFi', nfts: '#NFTs', solana: '#Solana', ai: '#AIxCrypto',
            regulations: '#CryptoRegulation', bitcoin: '#Bitcoin', ethereum: '#Ethereum', crypto: '#Crypto'
        };
        return Array.from(categoryCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([cat, count]) => ({
                hashtag: topicMap[cat] || `#${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
                count
            }));
    })();

    // Derive AI insights from actual news data
    const derivedInsights: AIInsight[] = (() => {
        const insights: AIInsight[] = [];
        const defiCount = newsItems.filter(i => i.category === 'defi').length;
        const regCount = newsItems.filter(i => i.category === 'regulations').length;
        const highRelevance = newsItems.filter(i => i.relevanceScore > 80);

        if (highRelevance.length > 0) {
            insights.push({
                type: 'opportunity',
                icon: 'trending_up',
                color: '#22C55E',
                title: 'Content Opportunity',
                description: `${highRelevance.length} high-relevance article${highRelevance.length > 1 ? 's' : ''} found. "${highRelevance[0].headline?.slice(0, 60)}..." could be great for brand content.`
            });
        }
        if (defiCount >= 2) {
            insights.push({
                type: 'trend',
                icon: 'visibility',
                color: '#3B82F6',
                title: 'DeFi Trending',
                description: `${defiCount} DeFi-related stories today. Consider creating content that positions ${brandName} within this narrative.`
            });
        }
        if (regCount > 0) {
            insights.push({
                type: 'compliance',
                icon: 'shield',
                color: '#F59E0B',
                title: 'Regulation Watch',
                description: `${regCount} regulation-related article${regCount > 1 ? 's' : ''} detected. Review for potential compliance implications.`
            });
        }
        if (insights.length === 0 && newsItems.length > 0) {
            insights.push({
                type: 'overview',
                icon: 'newspaper',
                color: '#9CA3AF',
                title: 'Market Overview',
                description: `${newsItems.length} news items tracked. Browse the feed to find content creation opportunities for ${brandName}.`
            });
        }
        return insights;
    })();

    // Derive suggested action from top news item
    const suggestedAction = filteredNews.length > 0
        ? `Create content about "${filteredNews[0].headline?.slice(0, 80)}..." — this story has a ${filteredNews[0].relevanceScore}% relevance score to ${brandName}.`
        : `Browse the latest Web3 news to find content creation opportunities for ${brandName}.`;

    const categories: { id: CategoryFilter; label: string }[] = [
        { id: 'all', label: 'All News' },
        { id: 'defi', label: 'DeFi' },
        { id: 'nfts', label: 'NFTs' },
        { id: 'solana', label: 'Solana' },
        { id: 'regulations', label: 'Regulations' },
        { id: 'ai', label: 'AI & Crypto' },
    ];

    const getTimeAgo = (timestamp: string | number) => {
        if (typeof timestamp === 'string') return timestamp;
        const now = Date.now();
        const diff = now - timestamp;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        if (hours === 1) return '1 hour ago';
        if (hours < 24) return `${hours} hours ago`;
        const days = Math.floor(hours / 24);
        if (days === 1) return '1 day ago';
        return `${days} days ago`;
    };

    const getCategoryBadge = (category?: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            defi: { bg: 'bg-[#3B82F622]', text: 'text-[#3B82F6]' },
            nfts: { bg: 'bg-[#A855F722]', text: 'text-[#A855F7]' },
            solana: { bg: 'bg-[#14F19522]', text: 'text-[#14F195]' },
            regulations: { bg: 'bg-[#F59E0B22]', text: 'text-[#F59E0B]' },
            ai: { bg: 'bg-[#EC489922]', text: 'text-[#EC4899]' },
        };
        return badges[category || 'defi'] || badges.defi;
    };

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-6 border-b border-[#1F1F23]">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-white">Web3 News Feed</h1>
                    <p className="text-sm text-[#6B6B70]">
                        Stay informed on crypto trends that matter to your brand
                        {lastUpdated > 0 && (
                            <span className="ml-2 text-[#4B4B50]">· Updated {getTimeAgo(lastUpdated)}</span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Search Box */}
                    <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#111113] border border-[#2E2E2E] rounded-lg">
                        <span className="material-symbols-sharp text-[#6B6B70] text-base" style={{ fontVariationSettings: "'wght' 300" }}>search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search news..."
                            className="bg-transparent border-none outline-none text-sm text-white placeholder-[#6B6B70] w-32"
                        />
                    </div>
                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 bg-transparent border border-[#2E2E2E] rounded-lg text-white text-sm font-medium hover:bg-[#1F1F23] transition-colors disabled:opacity-50"
                    >
                        <span className={`material-symbols-sharp text-base ${isLoading ? 'animate-spin' : ''}`} style={{ fontVariationSettings: "'wght' 300" }}>refresh</span>
                        {isLoading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-8 px-10 py-7 overflow-hidden">
                {/* News Column */}
                <div className="flex-1 flex flex-col gap-5 overflow-y-auto">
                    {/* Category Tabs */}
                    <div className="flex items-center gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setCategoryFilter(cat.id)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                    categoryFilter === cat.id
                                        ? 'bg-[#FF5C00] text-white'
                                        : 'bg-transparent border border-[#2E2E2E] text-[#94A3B8] hover:text-white hover:border-[#3E3E3E]'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* News Cards */}
                    <div className="flex flex-col gap-4">
                        {isLoading && newsItems.length === 0 ? (
                            // Loading skeletons
                            [...Array(3)].map((_, i) => (
                                <div key={i} className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5 animate-pulse">
                                    <div className="flex gap-5">
                                        <div className="w-[120px] h-[80px] bg-[#1F1F23] rounded-lg"></div>
                                        <div className="flex-1 space-y-3">
                                            <div className="h-4 bg-[#1F1F23] rounded w-1/4"></div>
                                            <div className="h-5 bg-[#1F1F23] rounded w-3/4"></div>
                                            <div className="h-4 bg-[#1F1F23] rounded w-1/3"></div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : filteredNews.length === 0 ? (
                            <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-10 text-center">
                                <span className="material-symbols-sharp text-4xl text-[#64748B] mb-3 block" style={{ fontVariationSettings: "'wght' 300" }}>newspaper</span>
                                <p className="text-white font-medium mb-1">No news found</p>
                                <p className="text-sm text-[#64748B]">Try adjusting your filters or check back later</p>
                            </div>
                        ) : (
                            filteredNews.map((item, index) => {
                                const badge = getCategoryBadge(item.category);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => onSelectArticle?.(item)}
                                        className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5 hover:border-[#2E2E2E] transition-colors cursor-pointer group"
                                    >
                                        <div className="flex gap-5">
                                            {/* Thumbnail */}
                                            {index % 2 === 0 && (
                                                <div className="w-[120px] h-[80px] rounded-lg bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] flex-shrink-0 overflow-hidden">
                                                    <div className="w-full h-full bg-[url('/placeholder-news.jpg')] bg-cover bg-center opacity-70"></div>
                                                </div>
                                            )}

                                            {/* Content */}
                                            <div className="flex-1 flex flex-col gap-2.5">
                                                {/* Meta */}
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-[#FF5C00] font-medium">{item.sourceName}</span>
                                                    <span className="text-[#64748B]">&bull;</span>
                                                    <span className="text-[#64748B]">{getTimeAgo(item.timestamp)}</span>
                                                    <span className="text-[#64748B]">&bull;</span>
                                                    <span className={`px-2 py-0.5 rounded ${badge.bg} ${badge.text} text-[11px] font-medium`}>
                                                        {item.category?.charAt(0).toUpperCase() + (item.category?.slice(1) || '')}
                                                    </span>
                                                </div>

                                                {/* Headline */}
                                                <h3 className="text-[15px] font-semibold text-white leading-snug group-hover:text-[#FF5C00] transition-colors">
                                                    {item.headline}
                                                </h3>

                                                {/* Relevance Badge */}
                                                {item.relevanceBadge && item.relevanceScore > 60 && (
                                                    <div className="flex items-center justify-between mt-1">
                                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FF5C0015] rounded-full">
                                                            <span className="material-symbols-sharp text-[#FF5C00] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>link</span>
                                                            <span className="text-[#FF5C00] text-xs font-medium">{item.relevanceBadge}</span>
                                                        </div>
                                                        <span className="material-symbols-sharp text-[#64748B] text-lg group-hover:text-white transition-colors" style={{ fontVariationSettings: "'wght' 300" }}>arrow_forward</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* AI Insights Sidebar */}
                <div className="w-[380px] flex flex-col gap-5 flex-shrink-0 overflow-y-auto">
                    {/* AI News Analysis Card */}
                    <div
                        className="rounded-[14px] p-5 border border-[#FF5C0044]"
                        style={{ background: 'linear-gradient(135deg, #111113 0%, #1A120D 100%)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-[#FF5C00] flex items-center justify-center">
                                <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>psychology</span>
                            </div>
                            <span className="text-white font-semibold">AI News Analysis</span>
                        </div>
                        <p className="text-[#9CA3AF] text-[13px] mb-4">How today's news impacts your brand:</p>

                        {/* Insights - derived from real data */}
                        <div className="flex flex-col gap-3">
                            {derivedInsights.length === 0 ? (
                                <div className="bg-[#1A1A1D] rounded-lg p-3 space-y-1.5">
                                    <p className="text-[#9CA3AF] text-xs leading-relaxed">Loading news analysis...</p>
                                </div>
                            ) : (
                                derivedInsights.map((insight, i) => (
                                    <div key={i} className="bg-[#1A1A1D] rounded-lg p-3 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-sharp text-sm" style={{ color: insight.color, fontVariationSettings: "'wght' 300" }}>{insight.icon}</span>
                                            <span className="text-sm font-medium" style={{ color: insight.color }}>{insight.title}</span>
                                        </div>
                                        <p className="text-[#9CA3AF] text-xs leading-relaxed">{insight.description}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Trending Topics Card - derived from real news categories */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-sharp text-[#FF5C00] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>local_fire_department</span>
                            <span className="text-white font-semibold">Trending in Web3</span>
                        </div>

                        <div className="flex flex-col gap-3.5">
                            {derivedTrending.length === 0 ? (
                                <p className="text-[#64748B] text-sm">No trending topics yet</p>
                            ) : (
                                derivedTrending.map((topic, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#FF5C00] text-sm font-semibold">{i + 1}</span>
                                            <span className="text-white text-sm font-medium">{topic.hashtag}</span>
                                        </div>
                                        <span className="text-[#64748B] text-xs">{topic.count} article{topic.count !== 1 ? 's' : ''}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Suggested Action Card */}
                    <div className="bg-[#111113] border border-[#22C55E44] rounded-[14px] p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-sharp text-[#22C55E] text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>auto_awesome</span>
                            <span className="text-[#22C55E] font-semibold">AI Suggested Action</span>
                        </div>

                        <p className="text-[#D1D5DB] text-[13px] leading-relaxed mb-4">
                            {suggestedAction}
                        </p>

                        <button
                            onClick={() => {
                                if (onCreateContent && filteredNews.length > 0) {
                                    onCreateContent(filteredNews[0]);
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-semibold"
                            style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                        >
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>edit</span>
                            Create Content from News
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
