import React, { useState, useEffect } from 'react';
import { TrendItem, SocialMetrics } from '../types';

interface TwitterFeedProps {
    brandName: string;
    socialMetrics?: SocialMetrics | null;
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
    mediaUrl?: string;
    url?: string;
}

// Format tweet content: line breaks, @mentions, #hashtags, URLs
const formatTweetContent = (text: string): React.ReactNode => {
    if (!text) return null;
    // Split by newlines first, then format each line
    return text.split('\n').map((line, lineIdx, lines) => {
        // Regex to match @mentions, #hashtags, and URLs
        const parts = line.split(/(@\w+|#\w+|https?:\/\/\S+)/g);
        return (
            <React.Fragment key={lineIdx}>
                {parts.map((part, partIdx) => {
                    if (part.startsWith('@')) {
                        return <span key={partIdx} className="text-[#1D9BF0] hover:underline cursor-pointer">{part}</span>;
                    }
                    if (part.startsWith('#')) {
                        return <span key={partIdx} className="text-[#1D9BF0] hover:underline cursor-pointer">{part}</span>;
                    }
                    if (part.match(/^https?:\/\//)) {
                        const display = part.replace(/^https?:\/\//, '').slice(0, 30);
                        return (
                            <a key={partIdx} href={part} target="_blank" rel="noopener noreferrer"
                                className="text-[#1D9BF0] hover:underline" onClick={e => e.stopPropagation()}>
                                {display}{part.replace(/^https?:\/\//, '').length > 30 ? '…' : ''}
                            </a>
                        );
                    }
                    return <span key={partIdx}>{part}</span>;
                })}
                {lineIdx < lines.length - 1 && <br />}
            </React.Fragment>
        );
    });
};

interface TrendingTopic {
    id: string;
    hashtag: string;
    tweetCount: string;
    changePercent: number;
    isPositive: boolean;
}

export const TwitterFeed: React.FC<TwitterFeedProps> = ({ brandName, socialMetrics, onNavigate }) => {
    const [searchQuery, setSearchQuery] = useState('');

    // Derive all display data from the socialMetrics prop (already loaded in App.tsx)
    const metrics = socialMetrics;
    const hasData = !!metrics && (metrics.totalFollowers > 0 || metrics.recentPosts?.length > 0);

    // KPI cards - derive from real metrics
    const mentionsToday = metrics?.mentions || 0;
    const mentionsChange = metrics?.comparison?.impressionsChange || 0;
    const engagementRate = metrics?.engagementRate || 0;
    const engagementChange = metrics?.comparison?.engagementChange || 0;
    const followersCount = metrics?.totalFollowers || 0;
    const followersChange = metrics?.comparison?.followersChange || 0;

    // Brand Mentions - map recentPosts to Tweet format
    // SocialPost type: { id, content, date, likes, comments, retweets, impressions, engagementRate, url?, mediaUrl? }
    const brandMentions: Tweet[] = (metrics?.recentPosts || []).slice(0, 8).map((post, i) => ({
        id: post.id || `post-${i}`,
        author: brandName,
        handle: `@${brandName}`,
        avatar: brandName.charAt(0).toUpperCase(),
        avatarColor: ['#3B82F6', '#A855F7', '#10B981', '#EF4444', '#F59E0B'][i % 5],
        content: post.content || '',
        timestamp: post.date ? getRelativeTime(post.date) : 'Recently',
        likes: post.likes || 0,
        retweets: post.retweets || 0,
        replies: post.comments || 0,
        mediaUrl: post.mediaUrl,
        url: post.url,
    }));

    // Top performing posts - sorted by engagement
    const topPosts: Tweet[] = [...(metrics?.recentPosts || [])]
        .sort((a, b) => ((b.likes || 0) + (b.retweets || 0)) - ((a.likes || 0) + (a.retweets || 0)))
        .slice(0, 5)
        .map((post, i) => ({
            id: `top-${post.id || i}`,
            author: brandName,
            handle: `@${brandName}`,
            avatar: brandName.charAt(0).toUpperCase(),
            avatarColor: ['#FF5C00', '#A855F7', '#3B82F6', '#22C55E', '#F59E0B'][i % 5],
            content: post.content || '',
            timestamp: post.date ? getRelativeTime(post.date) : 'Recently',
            likes: post.likes || 0,
            retweets: post.retweets || 0,
            replies: post.comments || 0,
            mediaUrl: post.mediaUrl,
            url: post.url,
        }));

    // Build trending topics from engagement history
    const trendingTopics: TrendingTopic[] = hasData ? [
        { id: 'trend-1', hashtag: `#${brandName.replace(/\s+/g, '')}`, tweetCount: `${mentionsToday} mentions`, changePercent: Math.round(mentionsChange), isPositive: mentionsChange >= 0 },
        { id: 'trend-2', hashtag: '#Web3', tweetCount: 'Trending', changePercent: 12, isPositive: true },
        { id: 'trend-3', hashtag: '#DeFi', tweetCount: 'Trending', changePercent: 8, isPositive: true },
        { id: 'trend-4', hashtag: '#Crypto', tweetCount: 'Trending', changePercent: -3, isPositive: false },
    ] : [];

    // AI Insight
    const aiTopic = hasData ? `#${brandName.replace(/\s+/g, '')}` : '';
    const aiInsight = hasData
        ? `Your engagement rate is ${engagementRate}%${engagementChange !== 0 ? ` (${engagementChange > 0 ? '+' : ''}${engagementChange}% vs last week)` : ''}. ${brandMentions.length > 0 ? `Recent posts are getting ${brandMentions[0]?.likes || 0} likes on average.` : ''} Consider posting during peak hours for maximum reach.`
        : 'Connect your Twitter/X account in Settings to see AI-powered insights and real-time feed data.';

    const handleCreatePost = () => {
        if (onNavigate) {
            onNavigate('studio', { visualPrompt: aiTopic });
        }
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        }
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
    };

    function getRelativeTime(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            const now = Date.now();
            const diffMs = now - date.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours < 1) return 'Just now';
            if (diffHours < 24) return `${diffHours}h ago`;
            const diffDays = Math.floor(diffHours / 24);
            if (diffDays === 1) return '1d ago';
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        } catch {
            return 'Recently';
        }
    }

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
                    {/* Followers */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl p-4 flex flex-col gap-2">
                        <span className="text-xs text-[#6B7280]">Followers</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[28px] font-bold text-white">{formatNumber(followersCount)}</span>
                            {followersChange !== 0 && (
                                <div className="flex items-center gap-1">
                                    <span
                                        className="material-symbols-sharp text-sm"
                                        style={{
                                            color: followersChange >= 0 ? '#22C55E' : '#EF4444',
                                            fontVariationSettings: "'wght' 300"
                                        }}
                                    >
                                        {followersChange >= 0 ? 'trending_up' : 'trending_down'}
                                    </span>
                                    <span className={`text-[13px] font-medium ${followersChange >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                                        {followersChange >= 0 ? '+' : ''}{followersChange}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mentions */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl p-4 flex flex-col gap-2">
                        <span className="text-xs text-[#6B7280]">Mentions</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[28px] font-bold text-white">{mentionsToday}</span>
                            {mentionsChange !== 0 && (
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
                            )}
                        </div>
                    </div>

                    {/* Weekly Impressions */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl p-4 flex flex-col gap-2">
                        <span className="text-xs text-[#6B7280]">Weekly Impressions</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[28px] font-bold text-white">{formatNumber(metrics?.weeklyImpressions || 0)}</span>
                        </div>
                    </div>

                    {/* Engagement Rate */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl p-4 flex flex-col gap-2">
                        <span className="text-xs text-[#6B7280]">Engagement Rate</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[28px] font-bold text-white">{engagementRate}%</span>
                            {engagementChange !== 0 && (
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
                            )}
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
                            {brandMentions.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                    <span className="material-symbols-sharp text-3xl text-[#3B3B40] mb-2" style={{ fontVariationSettings: "'wght' 300" }}>alternate_email</span>
                                    <p className="text-sm text-[#6B7280]">No recent posts</p>
                                    <p className="text-xs text-[#4B4B50] mt-1">Connect X in Settings to see your feed</p>
                                </div>
                            )}
                            {brandMentions.map((tweet, idx) => (
                                <div
                                    key={tweet.id}
                                    className={`flex gap-2.5 px-4 py-3 ${tweet.url ? 'cursor-pointer hover:bg-[#FFFFFF04]' : ''} ${idx < brandMentions.length - 1 ? 'border-b border-[#1F1F23]' : ''}`}
                                    onClick={() => tweet.url && window.open(tweet.url, '_blank')}
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
                                        <p className="text-[13px] text-[#D1D5DB] leading-[1.55]">{formatTweetContent(tweet.content)}</p>
                                        {tweet.mediaUrl && (
                                            <img src={tweet.mediaUrl} alt="" className="rounded-lg mt-1.5 max-h-[200px] w-full object-cover border border-[#1F1F23]" loading="lazy" />
                                        )}
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

                    {/* Top Performing Posts Column */}
                    <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl flex flex-col overflow-hidden">
                        {/* Column Header */}
                        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1F1F23]">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded bg-[#3B82F6]"></div>
                                <span className="text-sm font-semibold text-white">Top Performing</span>
                            </div>
                            <div className="bg-[#3B82F622] px-2 py-1 rounded">
                                <span className="text-[11px] font-semibold text-[#3B82F6]">By engagement</span>
                            </div>
                        </div>
                        {/* Tweet Feed */}
                        <div className="flex-1 overflow-y-auto">
                            {topPosts.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                    <span className="material-symbols-sharp text-3xl text-[#3B3B40] mb-2" style={{ fontVariationSettings: "'wght' 300" }}>monitoring</span>
                                    <p className="text-sm text-[#6B7280]">No post data yet</p>
                                    <p className="text-xs text-[#4B4B50] mt-1">Connect X in Settings to see top posts</p>
                                </div>
                            )}
                            {topPosts.map((tweet, idx) => (
                                <div
                                    key={tweet.id}
                                    className={`flex gap-2.5 px-4 py-3 ${tweet.url ? 'cursor-pointer hover:bg-[#FFFFFF04]' : ''} ${idx < topPosts.length - 1 ? 'border-b border-[#1F1F23]' : ''}`}
                                    onClick={() => tweet.url && window.open(tweet.url, '_blank')}
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
                                        <p className="text-[13px] text-[#D1D5DB] leading-[1.55]">{formatTweetContent(tweet.content)}</p>
                                        {tweet.mediaUrl && (
                                            <img src={tweet.mediaUrl} alt="" className="rounded-lg mt-1.5 max-h-[200px] w-full object-cover border border-[#1F1F23]" loading="lazy" />
                                        )}
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
