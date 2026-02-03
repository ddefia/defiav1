import React, { useState, useEffect } from 'react';
import { fetchMentions, fetchSocialMetrics } from '../services/analytics';
import { fetchMarketPulse } from '../services/pulse';
import { TrendItem, SocialMetrics } from '../types';

interface TwitterFeedProps {
    brandName: string;
    onNavigate?: (section: string, params?: any) => void;
}

interface Tweet {
    id: string;
    author: string;
    handle: string;
    avatar: string;
    avatarColor: string;
    content: string;
    timestamp: string;
    likes: number;
    retweets: number;
    replies?: number;
}

interface TrendingTopic {
    id: string;
    hashtag: string;
    tweetCount: string;
    changePercent: number;
    isPositive: boolean;
}

export const TwitterFeed: React.FC<TwitterFeedProps> = ({ brandName, onNavigate }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Metrics state - default to 0/empty, will be populated from real data
    const [mentionsToday, setMentionsToday] = useState(0);
    const [mentionsChange, setMentionsChange] = useState(0);
    const [sentimentScore, setSentimentScore] = useState(0);
    const [competitorMentions, setCompetitorMentions] = useState(0);
    const [competitorChange, setCompetitorChange] = useState(0);
    const [engagementRate, setEngagementRate] = useState(0);
    const [engagementChange, setEngagementChange] = useState(0);

    // Feed state
    const [brandMentions, setBrandMentions] = useState<Tweet[]>([]);
    const [competitorActivity, setCompetitorActivity] = useState<Tweet[]>([]);
    const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
    const [aiInsight, setAiInsight] = useState<string>('');
    const [aiTopic, setAiTopic] = useState<string>('');

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Fetch real data from services
                const [mentions, trends, metrics] = await Promise.all([
                    fetchMentions(brandName).catch(() => []),
                    fetchMarketPulse(brandName).catch(() => []),
                    fetchSocialMetrics(brandName).catch(() => null)
                ]);

                // Update metrics from real data if available
                if (metrics) {
                    if (metrics.followerCount) {
                        setMentionsToday(Math.floor(metrics.followerCount / 100));
                    }
                    if (metrics.engagementRate) {
                        setEngagementRate(metrics.engagementRate);
                    }
                }

                // Map mentions to brand mentions feed
                if (mentions && mentions.length > 0) {
                    const mappedMentions: Tweet[] = mentions.slice(0, 5).map((m: any, i: number) => ({
                        id: m.id || `mention-${i}`,
                        author: m.author || 'Unknown User',
                        handle: m.handle || '@unknown',
                        avatar: (m.author || 'U').charAt(0).toUpperCase(),
                        avatarColor: ['#3B82F6', '#A855F7', '#10B981', '#EF4444', '#F59E0B'][i % 5],
                        content: m.text || m.content || '',
                        timestamp: m.timestamp || 'Recently',
                        likes: m.likes || 0,
                        retweets: m.retweets || 0,
                        replies: m.replies || 0
                    }));
                    setBrandMentions(mappedMentions);
                } else {
                    // No data - show empty state
                    setBrandMentions([]);
                }

                // Competitor activity - show empty if no real data
                setCompetitorActivity([]);

                // Map trends to trending topics
                if (trends && trends.length > 0) {
                    const mappedTrends: TrendingTopic[] = trends.slice(0, 4).map((t: TrendItem, i: number) => ({
                        id: `trend-${i}`,
                        hashtag: t.headline?.startsWith('#') || t.headline?.startsWith('$')
                            ? t.headline
                            : `#${t.headline?.replace(/\s+/g, '')}`,
                        tweetCount: t.relevanceScore ? `${(t.relevanceScore * 0.5).toFixed(1)}K tweets` : 'Trending',
                        changePercent: t.relevanceScore ? Math.floor(t.relevanceScore - 50) : 0,
                        isPositive: (t.relevanceScore || 0) >= 50
                    }));
                    setTrendingTopics(mappedTrends);

                    // Set AI insight based on top trend
                    if (mappedTrends.length > 0) {
                        setAiTopic(mappedTrends[0].hashtag);
                        setAiInsight(`High engagement opportunity: ${mappedTrends[0].hashtag} is gaining momentum. Consider posting content about this topic in the next 2 hours.`);
                    }
                } else {
                    // No trending topics - show empty state
                    setTrendingTopics([]);
                    setAiTopic('');
                    setAiInsight('Connect your Twitter account to see AI-powered insights and trending topics.');
                }

            } catch (error) {
                console.error('Failed to load Twitter feed data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [brandName]);

    const handleCreatePost = () => {
        if (onNavigate) {
            onNavigate('studio', { visualPrompt: aiTopic });
        }
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-[#1F1F23]">
                <div className="flex flex-col gap-1">
                    <h1 className="text-[22px] font-bold text-white">Twitter Feed</h1>
                    <p className="text-sm text-[#6B7280]">Monitor mentions, competitors, and trending conversations</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Search Box */}
                    <div className="flex items-center gap-2 bg-[#111113] border border-[#2E2E2E] rounded-lg px-3 py-2 w-[200px]">
                        <span className="material-symbols-sharp text-[#6B7280] text-base" style={{ fontVariationSettings: "'wght' 300" }}>
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Search tweets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent text-[13px] text-white placeholder-[#6B7280] outline-none flex-1"
                        />
                    </div>
                    {/* Filter Button */}
                    <button className="flex items-center gap-1.5 border border-[#2E2E2E] rounded-lg px-3.5 py-2">
                        <span className="material-symbols-sharp text-[#9CA3AF] text-base" style={{ fontVariationSettings: "'wght' 300" }}>
                            filter_list
                        </span>
                        <span className="text-[13px] text-[#9CA3AF]">Filter</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col gap-6 p-8 overflow-auto">
                {/* Metrics Row */}
                <div className="flex gap-4">
                    {/* Mentions Today */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl p-4 flex flex-col gap-2">
                        <span className="text-xs text-[#6B7280]">Mentions Today</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[28px] font-bold text-white">{mentionsToday}</span>
                            <div className="flex items-center gap-1">
                                <span
                                    className="material-symbols-sharp text-sm"
                                    style={{
                                        color: mentionsChange >= 0 ? '#22C55E' : '#EF4444',
                                        fontVariationSettings: "'wght' 300"
                                    }}
                                >
                                    {mentionsChange >= 0 ? 'trending_up' : 'trending_down'}
                                </span>
                                <span className={`text-[13px] font-medium ${mentionsChange >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                                    {mentionsChange >= 0 ? '+' : ''}{mentionsChange}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Sentiment Score */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl p-4 flex flex-col gap-2">
                        <span className="text-xs text-[#6B7280]">Sentiment Score</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[28px] font-bold text-[#22C55E]">{sentimentScore}</span>
                            <span className="text-base text-[#6B7280]">/ 10</span>
                        </div>
                    </div>

                    {/* Competitor Mentions */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl p-4 flex flex-col gap-2">
                        <span className="text-xs text-[#6B7280]">Competitor Mentions</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[28px] font-bold text-white">{competitorMentions}</span>
                            <div className="flex items-center gap-1">
                                <span
                                    className="material-symbols-sharp text-sm"
                                    style={{
                                        color: competitorChange >= 0 ? '#22C55E' : '#EF4444',
                                        fontVariationSettings: "'wght' 300"
                                    }}
                                >
                                    {competitorChange >= 0 ? 'trending_up' : 'trending_down'}
                                </span>
                                <span className={`text-[13px] font-medium ${competitorChange >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                                    {competitorChange >= 0 ? '+' : ''}{competitorChange}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Engagement Rate */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl p-4 flex flex-col gap-2">
                        <span className="text-xs text-[#6B7280]">Engagement Rate</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[28px] font-bold text-white">{engagementRate}%</span>
                            <div className="flex items-center gap-1">
                                <span
                                    className="material-symbols-sharp text-sm"
                                    style={{
                                        color: engagementChange >= 0 ? '#22C55E' : '#EF4444',
                                        fontVariationSettings: "'wght' 300"
                                    }}
                                >
                                    {engagementChange >= 0 ? 'trending_up' : 'trending_down'}
                                </span>
                                <span className={`text-[13px] font-medium ${engagementChange >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                                    {engagementChange >= 0 ? '+' : ''}{engagementChange}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Columns */}
                <div className="flex gap-5 flex-1 min-h-0">
                    {/* Brand Mentions Column */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl flex flex-col overflow-hidden">
                        {/* Column Header */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1F1F23]">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded bg-[#22C55E]"></div>
                                <span className="text-sm font-semibold text-white">Brand Mentions</span>
                            </div>
                            <div className="bg-[#22C55E22] px-2 py-1 rounded">
                                <span className="text-[11px] font-semibold text-[#22C55E]">{brandMentions.length} new</span>
                            </div>
                        </div>
                        {/* Tweet Feed */}
                        <div className="flex-1 overflow-y-auto">
                            {brandMentions.map((tweet, idx) => (
                                <div
                                    key={tweet.id}
                                    className={`flex gap-2.5 px-4 py-3 ${idx < brandMentions.length - 1 ? 'border-b border-[#1F1F23]' : ''}`}
                                >
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                                        style={{ backgroundColor: tweet.avatarColor }}
                                    >
                                        {tweet.avatar}
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[13px] font-semibold text-white">{tweet.handle}</span>
                                            <span className="text-xs text-[#6B7280]">· {tweet.timestamp}</span>
                                        </div>
                                        <p className="text-[13px] text-[#D1D5DB] leading-[1.4]">{tweet.content}</p>
                                        <div className="flex items-center gap-4 pt-1.5">
                                            <span className="text-[11px] text-[#6B7280]">❤️ {formatNumber(tweet.likes)}</span>
                                            <span className="text-[11px] text-[#6B7280]">🔄 {formatNumber(tweet.retweets)}</span>
                                            {tweet.replies !== undefined && (
                                                <span className="text-[11px] text-[#6B7280]">💬 {tweet.replies}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Competitor Activity Column */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl flex flex-col overflow-hidden">
                        {/* Column Header */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1F1F23]">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded bg-[#3B82F6]"></div>
                                <span className="text-sm font-semibold text-white">Competitor Activity</span>
                            </div>
                            <div className="bg-[#3B82F622] px-2 py-1 rounded">
                                <span className="text-[11px] font-semibold text-[#3B82F6]">{competitorActivity.length} new</span>
                            </div>
                        </div>
                        {/* Tweet Feed */}
                        <div className="flex-1 overflow-y-auto">
                            {competitorActivity.map((tweet, idx) => (
                                <div
                                    key={tweet.id}
                                    className={`flex gap-2.5 px-4 py-3 ${idx < competitorActivity.length - 1 ? 'border-b border-[#1F1F23]' : ''}`}
                                >
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                                        style={{ backgroundColor: tweet.avatarColor }}
                                    >
                                        {tweet.avatar}
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[13px] font-semibold text-white">{tweet.handle}</span>
                                            <span className="text-xs text-[#6B7280]">· {tweet.timestamp}</span>
                                        </div>
                                        <p className="text-[13px] text-[#D1D5DB] leading-[1.4]">{tweet.content}</p>
                                        <div className="flex items-center gap-4 pt-1.5">
                                            <span className="text-[11px] text-[#6B7280]">❤️ {formatNumber(tweet.likes)}</span>
                                            <span className="text-[11px] text-[#6B7280]">🔄 {formatNumber(tweet.retweets)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Trending Topics Column */}
                    <div className="w-[280px] bg-[#111113] border border-[#1F1F23] rounded-xl flex flex-col overflow-hidden shrink-0">
                        {/* Column Header */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1F1F23]">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded bg-[#FF5C00]"></div>
                                <span className="text-sm font-semibold text-white">Trending Topics</span>
                            </div>
                        </div>
                        {/* Topics List */}
                        <div className="flex-1 overflow-y-auto">
                            {trendingTopics.map((topic, idx) => (
                                <div
                                    key={topic.id}
                                    className={`flex flex-col gap-1 px-4 py-3 ${idx < trendingTopics.length - 1 ? 'border-b border-[#1F1F23]' : ''}`}
                                >
                                    <span className="text-sm font-semibold text-white">{topic.hashtag}</span>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-[#6B7280]">{topic.tweetCount}</span>
                                        <div className="flex items-center gap-1">
                                            <span
                                                className="material-symbols-sharp text-xs"
                                                style={{
                                                    color: topic.isPositive ? '#22C55E' : '#EF4444',
                                                    fontVariationSettings: "'wght' 300"
                                                }}
                                            >
                                                {topic.isPositive ? 'trending_up' : 'trending_down'}
                                            </span>
                                            <span className={`text-[11px] font-medium ${topic.isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                                                {topic.isPositive ? '+' : ''}{topic.changePercent}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* AI Insight Card */}
                        <div
                            className="flex flex-col gap-3 p-4 border-t border-[#FF5C0044]"
                            style={{
                                background: 'linear-gradient(180deg, #111113 0%, #1A120D 100%)'
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-6 h-6 rounded-md flex items-center justify-center"
                                    style={{
                                        background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)'
                                    }}
                                >
                                    <span className="material-symbols-sharp text-white text-sm" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
                                        auto_awesome
                                    </span>
                                </div>
                                <span className="text-xs font-semibold text-[#FF5C00]">AI Insight</span>
                            </div>
                            <p className="text-xs text-[#D1D5DB] leading-[1.4]">{aiInsight}</p>
                            <button
                                onClick={handleCreatePost}
                                className="flex items-center justify-center gap-1.5 bg-[#FF5C00] hover:bg-[#FF6B1A] transition-colors rounded-md px-3 py-2"
                            >
                                <span className="text-xs font-semibold text-white">Create Post</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
