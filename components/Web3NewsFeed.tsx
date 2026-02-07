
import React, { useState, useEffect, useRef } from 'react';
import { TrendItem, BrandConfig } from '../types';
import { fetchMarketPulse } from '../services/pulse';
import { loadPulseCache, savePulseCache } from '../services/storage';

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

// Mock trending topics
const TRENDING_TOPICS = [
    { hashtag: '#SolanaDeFi', posts: '24.5k' },
    { hashtag: '#YieldFarming', posts: '18.2k' },
    { hashtag: '#AITrading', posts: '12.8k' },
    { hashtag: '#CryptoRegulation', posts: '9.4k' },
];

// Mock AI insights
const AI_INSIGHTS = [
    {
        type: 'opportunity',
        icon: 'trending_up',
        color: '#22C55E',
        title: 'Market Opportunity',
        description: 'Solana DeFi growth aligns with SolanaFi\'s positioning. Consider content highlighting your yield features.'
    },
    {
        type: 'competitor',
        icon: 'visibility',
        color: '#3B82F6',
        title: 'Competitor Watch',
        description: 'AI trading bot growth indicates rising competition. Differentiate with your automated strategy features.'
    },
    {
        type: 'compliance',
        icon: 'shield',
        color: '#F59E0B',
        title: 'Compliance Alert',
        description: 'SEC guidelines may require updated disclosures. Review your documentation by Q2.'
    }
];

export const Web3NewsFeed: React.FC<Web3NewsFeedProps> = ({ brandName, brandConfig, onCreateContent, onSelectArticle }) => {
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [lastUpdated, setLastUpdated] = useState<number>(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fetch news data
    useEffect(() => {
        const cache = loadPulseCache(brandName);
        if (cache.items.length > 0) {
            setNewsItems(transformToNewsItems(cache.items));
            setLastUpdated(cache.lastUpdated);
            setIsLoading(false); // Show cached data immediately
        }

        const now = Date.now();
        const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache — no need to re-fetch on every tab switch
        const shouldFetch = (now - cache.lastUpdated) > CACHE_DURATION || cache.items.length === 0;

        if (shouldFetch) {
            handleRefresh();
        } else {
            setIsLoading(false);
        }

        // Auto-refresh every 10 minutes
        intervalRef.current = setInterval(() => {
            handleRefresh();
        }, CACHE_DURATION);

        return () => {
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
                sourceName: item.source === 'Twitter' ? 'The Block' : 'Decrypt',
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
        return `${hours} hours ago`;
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
                    <p className="text-sm text-[#6B6B70]">Stay informed on crypto trends that matter to your brand</p>
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
                    {/* Filter Button */}
                    <button className="flex items-center gap-1.5 px-3.5 py-2.5 bg-transparent border border-[#2E2E2E] rounded-lg text-white text-sm font-medium hover:bg-[#1F1F23] transition-colors">
                        <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>tune</span>
                        Filter
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
                                                    <span className="text-[#64748B]">•</span>
                                                    <span className="text-[#64748B]">{getTimeAgo(item.timestamp)}</span>
                                                    <span className="text-[#64748B]">•</span>
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

                        {/* Insights */}
                        <div className="flex flex-col gap-3">
                            {AI_INSIGHTS.map((insight, i) => (
                                <div key={i} className="bg-[#1A1A1D] rounded-lg p-3 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-sharp text-sm" style={{ color: insight.color, fontVariationSettings: "'wght' 300" }}>{insight.icon}</span>
                                        <span className="text-sm font-medium" style={{ color: insight.color }}>{insight.title}</span>
                                    </div>
                                    <p className="text-[#9CA3AF] text-xs leading-relaxed">{insight.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Trending Topics Card */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="material-symbols-sharp text-[#FF5C00] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>local_fire_department</span>
                            <span className="text-white font-semibold">Trending in Web3</span>
                        </div>

                        <div className="flex flex-col gap-3.5">
                            {TRENDING_TOPICS.map((topic, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[#FF5C00] text-sm font-semibold">{i + 1}</span>
                                        <span className="text-white text-sm font-medium">{topic.hashtag}</span>
                                    </div>
                                    <span className="text-[#64748B] text-xs">{topic.posts} posts</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Suggested Action Card */}
                    <div className="bg-[#111113] border border-[#22C55E44] rounded-[14px] p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-sharp text-[#22C55E] text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>auto_awesome</span>
                            <span className="text-[#22C55E] font-semibold">AI Suggested Action</span>
                        </div>

                        <p className="text-[#D1D5DB] text-[13px] leading-relaxed mb-4">
                            Create a thread about {brandName}'s yield optimization in response to the DeFi TVL surge news.
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
