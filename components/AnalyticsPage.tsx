
import React, { useState, useEffect, useCallback } from 'react';
import { SocialMetrics, ComputedMetrics } from '../types';
import { getAuthToken } from '../services/auth';
import { getBrandRegistryEntry } from '../services/storage';

interface AnalyticsPageProps {
    brandName: string;
    metrics: SocialMetrics | null;
    chainMetrics: ComputedMetrics | null;
}

type ChartTab = 'impressions' | 'engagements' | 'followers';
type SortField = 'engagement' | 'impressions' | 'date' | 'rate';

interface ContentRow {
    id: string;
    content: string;
    platform: string;
    impressions: number;
    engagement: number;
    rate: number;
    date?: string;
    likes?: number;
    retweets?: number;
    comments?: number;
    url?: string;
    mediaUrl?: string;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ brandName, metrics, chainMetrics }) => {
    const [chartTab, setChartTab] = useState<ChartTab>('impressions');
    const [sortField, setSortField] = useState<SortField>('engagement');
    const [sortAsc, setSortAsc] = useState(false);
    const [selectedPost, setSelectedPost] = useState<ContentRow | null>(null);
    const [contentLogs, setContentLogs] = useState<ContentRow[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Fetch content_logs from Supabase
    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const registry = getBrandRegistryEntry(brandName);
                const brandId = registry?.brandId || brandName;
                const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
                const token = await getAuthToken();
                const res = await fetch(`${baseUrl}/api/content-logs/${encodeURIComponent(brandId)}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                });
                if (res.ok) {
                    const { logs } = await res.json();
                    if (logs?.length) {
                        setContentLogs(logs.map((log: any) => ({
                            id: log.id?.toString() || Math.random().toString(),
                            content: log.content || '',
                            platform: log.platform || 'twitter',
                            impressions: log.metrics?.impressions || 0,
                            engagement: (log.metrics?.likes || 0) + (log.metrics?.retweets || 0) + (log.metrics?.comments || 0),
                            rate: log.metrics?.engagementRate || 0,
                            date: log.posted_at ? new Date(log.posted_at).toLocaleDateString() : undefined,
                            likes: log.metrics?.likes,
                            retweets: log.metrics?.retweets,
                            comments: log.metrics?.comments,
                            url: log.url,
                            mediaUrl: log.media_url,
                        })));
                    }
                }
            } catch (e) {
                console.warn('[Analytics] Content logs fetch failed:', e);
            }
        };
        fetchLogs();
    }, [brandName]);

    // Derived history for chart
    const engagementHistory = metrics?.engagementHistory || [];
    const historyData = engagementHistory.map(h => h.rate);
    const hasEngagementHistory = historyData.length > 1;

    // Stats from real data
    const totalFollowers = metrics?.totalFollowers || 0;
    const engagementRate = metrics?.engagementRate || 0;
    const impressions = metrics?.weeklyImpressions || 0;
    const totalEngagements = impressions > 0 ? Math.round(impressions * (engagementRate / 100)) : 0;

    const followersChange = metrics?.comparison?.followersChange || 0;
    const impressionsChange = metrics?.comparison?.impressionsChange || 0;
    const engagementChange = metrics?.comparison?.engagementChange || 0;

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
        return num.toString();
    };

    const formatDelta = (value: number) => {
        const numeric = Number(value || 0);
        const sign = numeric > 0 ? '+' : '';
        return `${sign}${numeric.toFixed(1)}%`;
    };

    const getDeltaTone = (value: number) => {
        if (value > 0) return { icon: 'trending_up', className: 'text-[#22C55E]' };
        if (value < 0) return { icon: 'trending_down', className: 'text-red-400' };
        return { icon: 'trending_flat', className: 'text-[#6B6B70]' };
    };

    const engagementPeak = hasEngagementHistory
        ? engagementHistory.reduce((max, item) => (item.rate > max.rate ? item : max), engagementHistory[0])
        : null;
    const engagementAvg = hasEngagementHistory
        ? historyData.reduce((acc, val) => acc + val, 0) / historyData.length
        : 0;
    const engagementGrowth = hasEngagementHistory
        ? ((historyData[historyData.length - 1] - historyData[0]) / Math.max(historyData[0], 0.01)) * 100
        : 0;

    const engagementSeriesPath = () => {
        if (!hasEngagementHistory) return '';
        const values = historyData;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const range = max - min || 1;
        return values.map((val, idx) => {
            const x = (idx / (values.length - 1)) * 100;
            const y = 100 - ((val - min) / range) * 80 - 10;
            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    };

    const engagementAreaPath = () => {
        if (!hasEngagementHistory) return '';
        const linePath = engagementSeriesPath();
        return `${linePath} L 100 100 L 0 100 Z`;
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'twitter':
                return { icon: 'alternate_email', color: '#1DA1F2', name: 'Twitter' };
            case 'discord':
                return { icon: 'forum', color: '#5865F2', name: 'Discord' };
            case 'telegram':
                return { icon: 'send', color: '#0088CC', name: 'Telegram' };
            default:
                return { icon: 'public', color: '#6B6B70', name: platform };
        }
    };

    // Build content rows from recent posts
    const recentContent: ContentRow[] = (metrics?.recentPosts || []).map(post => ({
        id: post.id,
        content: post.content,
        platform: 'twitter',
        impressions: post.impressions,
        engagement: post.likes + post.retweets + (post.comments || 0),
        rate: post.engagementRate,
        date: post.date,
        likes: post.likes,
        retweets: post.retweets,
        comments: post.comments,
        url: post.url,
        mediaUrl: post.mediaUrl,
    }));

    // Merge & deduplicate
    const allContent = showHistory ? [...recentContent, ...contentLogs] : recentContent;
    const deduped = allContent.filter((item, idx, arr) =>
        arr.findIndex(a => a.id === item.id || (a.content && a.content === item.content)) === idx
    );

    // Sort
    const sortedContent = [...deduped].sort((a, b) => {
        let diff = 0;
        switch (sortField) {
            case 'engagement': diff = b.engagement - a.engagement; break;
            case 'impressions': diff = b.impressions - a.impressions; break;
            case 'rate': diff = b.rate - a.rate; break;
            case 'date':
                const da = a.date ? new Date(a.date).getTime() : 0;
                const db = b.date ? new Date(b.date).getTime() : 0;
                diff = db - da;
                break;
        }
        return sortAsc ? -diff : diff;
    });

    const handleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortAsc(prev => !prev);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    }, [sortField]);

    const SortIcon = ({ field }: { field: SortField }) => (
        <span
            className="material-symbols-sharp text-[10px] ml-0.5"
            style={{ fontVariationSettings: "'wght' 300", opacity: sortField === field ? 1 : 0.3 }}
        >
            {sortField === field ? (sortAsc ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
        </span>
    );

    // AI Insights
    const aiInsights: { num: number; text: string }[] = [];
    if (metrics) {
        if (recentContent.length > 0) {
            const best = [...recentContent].sort((a, b) => b.engagement - a.engagement)[0];
            aiInsights.push({ num: 1, text: `Your top performing post has ${best.engagement} engagements and a ${best.rate.toFixed(2)}% engagement rate. Analyze what made it resonate and replicate that format.` });
        }
        if (engagementRate > 0) {
            const benchmark = engagementRate >= 2 ? 'above' : 'below';
            aiInsights.push({ num: aiInsights.length + 1, text: `Your average engagement rate is ${engagementRate.toFixed(2)}%, which is ${benchmark} the typical 2% benchmark for crypto accounts. ${benchmark === 'below' ? 'Focus on threads and visual content to boost interaction.' : 'Keep leveraging your current content mix.'}` });
        }
        if (totalFollowers > 0 && impressions > 0) {
            const reachRate = ((impressions / totalFollowers) * 100).toFixed(0);
            aiInsights.push({ num: aiInsights.length + 1, text: `Your content reached ~${reachRate}% of your followers this week. ${Number(reachRate) < 30 ? 'Try posting during peak hours (9-11 AM UTC) to improve reach.' : 'Solid reach — consider expanding to new audiences with trend-jacking.'}` });
        }
    }

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-5 border-b border-[#1F1F23] shrink-0">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-white">Analytics</h1>
                    <p className="text-sm text-[#6B6B70]">Track your marketing performance and growth metrics</p>
                </div>
                <span className="text-[#6B6B70] text-sm">Based on recent X/Twitter data for {brandName}</span>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-5 p-6 px-10 overflow-y-auto min-h-0">
                {/* Metrics Row */}
                <div className="grid grid-cols-4 gap-4">
                    {/* Weekly Impressions */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[#9CA3AF] text-[13px]">Weekly Impressions</span>
                            <div className="w-8 h-8 rounded-lg bg-[#3B82F622] flex items-center justify-center">
                                <span className="material-symbols-sharp text-[#3B82F6] text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>visibility</span>
                            </div>
                        </div>
                        <span className="text-white text-[28px] font-bold">{formatNumber(impressions)}</span>
                        <div className="flex items-center gap-1.5">
                            <span className={`material-symbols-sharp text-sm ${getDeltaTone(impressionsChange).className}`} style={{ fontVariationSettings: "'wght' 300" }}>
                                {getDeltaTone(impressionsChange).icon}
                            </span>
                            <span className={`${getDeltaTone(impressionsChange).className} text-xs font-medium`}>
                                {metrics ? `${formatDelta(impressionsChange)} vs last period` : 'No change data'}
                            </span>
                        </div>
                    </div>

                    {/* Total Engagements */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[#9CA3AF] text-[13px]">Total Engagements</span>
                            <div className="w-8 h-8 rounded-lg bg-[#22C55E22] flex items-center justify-center">
                                <span className="material-symbols-sharp text-[#22C55E] text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>favorite</span>
                            </div>
                        </div>
                        <span className="text-white text-[28px] font-bold">{formatNumber(totalEngagements)}</span>
                        <div className="flex items-center gap-1.5">
                            <span className={`material-symbols-sharp text-sm ${getDeltaTone(engagementChange).className}`} style={{ fontVariationSettings: "'wght' 300" }}>
                                {getDeltaTone(engagementChange).icon}
                            </span>
                            <span className={`${getDeltaTone(engagementChange).className} text-xs font-medium`}>
                                {metrics ? `${formatDelta(engagementChange)} vs last period` : 'No change data'}
                            </span>
                        </div>
                    </div>

                    {/* Total Followers */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[#9CA3AF] text-[13px]">Total Followers</span>
                            <div className="w-8 h-8 rounded-lg bg-[#FF5C0022] flex items-center justify-center">
                                <span className="material-symbols-sharp text-[#FF5C00] text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>group</span>
                            </div>
                        </div>
                        <span className="text-white text-[28px] font-bold">{formatNumber(totalFollowers)}</span>
                        <div className="flex items-center gap-1.5">
                            <span className={`material-symbols-sharp text-sm ${getDeltaTone(followersChange).className}`} style={{ fontVariationSettings: "'wght' 300" }}>
                                {getDeltaTone(followersChange).icon}
                            </span>
                            <span className={`${getDeltaTone(followersChange).className} text-xs font-medium`}>
                                {metrics ? `${formatDelta(followersChange)} vs last period` : 'No change data'}
                            </span>
                        </div>
                    </div>

                    {/* Engagement Rate */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[#9CA3AF] text-[13px]">Engagement Rate</span>
                            <div className="w-8 h-8 rounded-lg bg-[#A855F722] flex items-center justify-center">
                                <span className="material-symbols-sharp text-[#A855F7] text-base" style={{ fontVariationSettings: "'wght' 300" }}>percent</span>
                            </div>
                        </div>
                        <span className="text-white text-[28px] font-bold">{engagementRate.toFixed(2)}%</span>
                        <div className="flex items-center gap-1.5">
                            <span className={`material-symbols-sharp text-sm ${getDeltaTone(engagementChange).className}`} style={{ fontVariationSettings: "'wght' 300" }}>
                                {getDeltaTone(engagementChange).icon}
                            </span>
                            <span className={`${getDeltaTone(engagementChange).className} text-xs font-medium`}>
                                {metrics ? `${formatDelta(engagementChange)} vs last period` : 'No change data'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* On-Chain Metrics — only when chain data exists */}
                {chainMetrics && (chainMetrics.netNewWallets > 0 || chainMetrics.totalVolume > 0 || chainMetrics.activeWallets > 0) && (
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#1F1F23] flex items-center gap-2.5">
                            <span className="material-symbols-sharp text-base text-[#8B5CF6]" style={{ fontVariationSettings: "'wght' 300" }}>token</span>
                            <span className="text-white text-sm font-semibold">On-Chain Analytics</span>
                        </div>
                        <div className="grid grid-cols-4 gap-4 p-6">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[#9CA3AF] text-[13px]">New Wallets</span>
                                    <div className="w-8 h-8 rounded-lg bg-[#8B5CF622] flex items-center justify-center">
                                        <span className="material-symbols-sharp text-[#8B5CF6] text-base" style={{ fontVariationSettings: "'wght' 300" }}>person_add</span>
                                    </div>
                                </div>
                                <span className="text-white text-[28px] font-bold">{formatNumber(chainMetrics.netNewWallets)}</span>
                                <span className="text-[#6B6B70] text-xs">net new (30d)</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[#9CA3AF] text-[13px]">Active Wallets</span>
                                    <div className="w-8 h-8 rounded-lg bg-[#06B6D422] flex items-center justify-center">
                                        <span className="material-symbols-sharp text-[#06B6D4] text-base" style={{ fontVariationSettings: "'wght' 300" }}>account_balance_wallet</span>
                                    </div>
                                </div>
                                <span className="text-white text-[28px] font-bold">{formatNumber(chainMetrics.activeWallets)}</span>
                                <span className="text-[#6B6B70] text-xs">currently active</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[#9CA3AF] text-[13px]">Volume</span>
                                    <div className="w-8 h-8 rounded-lg bg-[#22C55E22] flex items-center justify-center">
                                        <span className="material-symbols-sharp text-[#22C55E] text-base" style={{ fontVariationSettings: "'wght' 300" }}>bar_chart</span>
                                    </div>
                                </div>
                                <span className="text-white text-[28px] font-bold">
                                    {chainMetrics.totalVolume > 1_000_000 ? `$${(chainMetrics.totalVolume / 1_000_000).toFixed(1)}M` : chainMetrics.totalVolume > 1000 ? `$${(chainMetrics.totalVolume / 1000).toFixed(0)}K` : `$${chainMetrics.totalVolume.toLocaleString()}`}
                                </span>
                                <span className="text-[#6B6B70] text-xs">total</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[#9CA3AF] text-[13px]">Retention Rate</span>
                                    <div className="w-8 h-8 rounded-lg bg-[#F59E0B22] flex items-center justify-center">
                                        <span className="material-symbols-sharp text-[#F59E0B] text-base" style={{ fontVariationSettings: "'wght' 300" }}>sync</span>
                                    </div>
                                </div>
                                <span className="text-white text-[28px] font-bold">{chainMetrics.retentionRate.toFixed(1)}%</span>
                                <span className={`text-xs ${chainMetrics.retentionRate >= 30 ? 'text-[#22C55E]' : chainMetrics.retentionRate >= 15 ? 'text-[#F59E0B]' : 'text-[#6B6B70]'}`}>
                                    {chainMetrics.retentionRate >= 30 ? 'Healthy' : chainMetrics.retentionRate >= 15 ? 'Average' : 'Needs improvement'}
                                </span>
                            </div>
                        </div>
                        {chainMetrics.campaignPerformance.length > 0 && (
                            <div className="px-6 pb-6">
                                <div className="border-t border-[#1F1F23] pt-4">
                                    <span className="text-[#9CA3AF] text-xs font-medium mb-3 block">CAMPAIGN ATTRIBUTION</span>
                                    <div className="grid grid-cols-2 gap-3">
                                        {chainMetrics.campaignPerformance.map((perf, i) => (
                                            <div key={perf.campaignId || i} className="bg-[#0A0A0B] rounded-lg p-4 flex items-center justify-between">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-white text-sm font-medium">Campaign #{i + 1}</span>
                                                    <span className="text-[#6B6B70] text-xs">{perf.whalesAcquired} high-activity wallets</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-center">
                                                        <div className="text-white text-sm font-mono font-bold">{perf.lift.toFixed(1)}x</div>
                                                        <div className="text-[#6B6B70] text-[10px]">Lift</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-white text-sm font-mono font-bold">${perf.cpa.toFixed(0)}</div>
                                                        <div className="text-[#6B6B70] text-[10px]">CPA</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className={`text-sm font-mono font-bold ${perf.roi > 1 ? 'text-[#22C55E]' : 'text-red-400'}`}>{perf.roi.toFixed(1)}x</div>
                                                        <div className="text-[#6B6B70] text-[10px]">ROI</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Performance Chart Section */}
                <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5">
                    <div className="flex gap-5">
                        {/* Chart Area */}
                        <div className="flex-1 flex flex-col gap-4 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className="text-white text-base font-semibold">Performance Over Time</span>
                                <div className="flex items-center gap-1 p-1 bg-[#1A1A1D] rounded-lg">
                                    {(['impressions', 'engagements', 'followers'] as ChartTab[]).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setChartTab(tab)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                                                chartTab === tab
                                                    ? 'bg-[#FF5C00] text-white'
                                                    : 'text-[#9CA3AF] hover:text-white'
                                            }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative h-52">
                                {chartTab === 'engagements' && hasEngagementHistory ? (
                                    <>
                                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                            {[0, 1, 2, 3, 4].map(i => (
                                                <div key={i} className="w-full h-px bg-[#1F1F23]"></div>
                                            ))}
                                        </div>
                                        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-[#6B6B70] text-xs py-1">
                                            <span>{Math.max(...historyData).toFixed(2)}%</span>
                                            <span>{((Math.max(...historyData) + Math.min(...historyData)) / 2).toFixed(2)}%</span>
                                            <span>{Math.min(...historyData).toFixed(2)}%</span>
                                            <span></span>
                                            <span>0%</span>
                                        </div>
                                        <div className="absolute left-12 right-0 top-0 bottom-6">
                                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                                                <defs>
                                                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                                        <stop offset="0%" stopColor="#FF5C00" stopOpacity="0.3" />
                                                        <stop offset="100%" stopColor="#FF5C00" stopOpacity="0" />
                                                    </linearGradient>
                                                </defs>
                                                <path d={engagementAreaPath()} fill="url(#chartGradient)" />
                                                <path d={engagementSeriesPath()} fill="none" stroke="#FF5C00" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        </div>
                                        <div className="absolute left-12 right-0 bottom-0 flex justify-between text-[#6B6B70] text-xs">
                                            <span>{engagementHistory[0]?.date || 'Start'}</span>
                                            <span>{engagementHistory[Math.floor(engagementHistory.length / 2)]?.date || ''}</span>
                                            <span>{engagementHistory[engagementHistory.length - 1]?.date || 'Now'}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-center">
                                        <div>
                                            <span className="material-symbols-sharp text-[#6B6B70] text-3xl mb-2 block" style={{ fontVariationSettings: "'wght' 200" }}>show_chart</span>
                                            <p className="text-[#6B6B70] text-sm">
                                                {chartTab === 'engagements'
                                                    ? 'No engagement history yet. We will start plotting once daily snapshots are available.'
                                                    : 'Historical data for this metric is not available yet.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Chart Stats Sidebar */}
                        <div className="w-[180px] flex flex-col gap-3 shrink-0">
                            <div className="bg-[#1A1A1D] rounded-lg p-3.5 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Peak Day</span>
                                <span className="text-white text-base font-semibold">
                                    {chartTab === 'engagements' && engagementPeak ? engagementPeak.date : '--'}
                                </span>
                                <span className="text-[#22C55E] text-xs font-medium">
                                    {chartTab === 'engagements' && engagementPeak ? `${engagementPeak.rate.toFixed(2)}%` : 'No data'}
                                </span>
                            </div>
                            <div className="bg-[#1A1A1D] rounded-lg p-3.5 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Avg. Daily</span>
                                <span className="text-white text-base font-semibold">
                                    {chartTab === 'engagements' && hasEngagementHistory ? `${engagementAvg.toFixed(2)}%` : '--'}
                                </span>
                                <span className="text-[#6B6B70] text-xs">{hasEngagementHistory ? 'Avg rate' : 'No data'}</span>
                            </div>
                            <div className="bg-[#1A1A1D] rounded-lg p-3.5 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Growth Rate</span>
                                <span className="text-white text-base font-semibold">
                                    {chartTab === 'engagements' && hasEngagementHistory ? formatDelta(engagementGrowth) : '--'}
                                </span>
                                <span className="text-[#6B6B70] text-xs">Period over period</span>
                            </div>
                            <div className="bg-[#1A1A1D] rounded-lg p-3.5 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Best Platform</span>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-sharp text-[#1DA1F2] text-base" style={{ fontVariationSettings: "'wght' 300" }}>alternate_email</span>
                                    <span className="text-white text-base font-semibold">{metrics ? 'Twitter/X' : '--'}</span>
                                </div>
                                <span className="text-[#6B6B70] text-xs">{metrics ? 'Based on available data' : 'No platform data'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Performance Insights */}
                <div
                    className="rounded-[14px] p-5 border border-[#FF5C0044]"
                    style={{ background: 'linear-gradient(180deg, #111113 0%, #1A120D 100%)' }}
                >
                    <div className="flex items-center gap-2.5 mb-3">
                        <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 200" }}>auto_awesome</span>
                        <span className="text-[#FF5C00] text-sm font-semibold">AI Performance Insights</span>
                    </div>
                    <div className="flex flex-col gap-2.5 mb-4">
                        {aiInsights.map(insight => (
                            <div key={insight.num} className="flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-full bg-[#FF5C00] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-white text-[10px] font-semibold">{insight.num}</span>
                                </div>
                                <span className="text-[#E5E5E5] text-[13px] leading-relaxed">{insight.text}</span>
                            </div>
                        ))}
                        {aiInsights.length === 0 && (
                            <div className="text-[#6B6B70] text-sm">
                                No AI insights yet. Generate more campaigns or connect data sources to unlock insights.
                            </div>
                        )}
                    </div>
                    <button
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white text-sm font-semibold"
                        style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                        disabled={aiInsights.length === 0}
                    >
                        <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>bolt</span>
                        {aiInsights.length === 0 ? 'No Recommendations Available' : 'Apply AI Recommendations'}
                    </button>
                </div>

                {/* Content Performance */}
                <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-white text-base font-semibold">Content Performance</span>
                            <span className="text-[#6B6B70] text-xs">{sortedContent.length} posts</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {contentLogs.length > 0 && (
                                <div className="flex items-center gap-1 p-1 bg-[#1A1A1D] rounded-lg">
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${!showHistory ? 'bg-[#FF5C00] text-white' : 'text-[#9CA3AF] hover:text-white'}`}
                                    >
                                        Recent
                                    </button>
                                    <button
                                        onClick={() => setShowHistory(true)}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${showHistory ? 'bg-[#FF5C00] text-white' : 'text-[#9CA3AF] hover:text-white'}`}
                                    >
                                        All History
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex flex-col">
                        {/* Table Header */}
                        <div className="flex items-center gap-4 py-2.5 border-b border-[#1F1F23]">
                            <span className="text-[#6B6B70] text-xs font-medium flex-1 min-w-0">Content</span>
                            <span className="text-[#6B6B70] text-xs font-medium w-[90px]">Platform</span>
                            <button onClick={() => handleSort('date')} className="flex items-center text-[#6B6B70] text-xs font-medium w-[80px] hover:text-white transition-colors">
                                Date<SortIcon field="date" />
                            </button>
                            <button onClick={() => handleSort('impressions')} className="flex items-center text-[#6B6B70] text-xs font-medium w-[90px] hover:text-white transition-colors">
                                Impressions<SortIcon field="impressions" />
                            </button>
                            <button onClick={() => handleSort('engagement')} className="flex items-center text-[#6B6B70] text-xs font-medium w-[90px] hover:text-white transition-colors">
                                Engagement<SortIcon field="engagement" />
                            </button>
                            <button onClick={() => handleSort('rate')} className="flex items-center text-[#6B6B70] text-xs font-medium w-[70px] hover:text-white transition-colors">
                                Rate<SortIcon field="rate" />
                            </button>
                        </div>

                        {/* Table Rows */}
                        {sortedContent.map(item => {
                            const platformInfo = getPlatformIcon(item.platform);
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedPost(item)}
                                    className="flex items-center gap-4 py-3 hover:bg-[#1A1A1D] transition-colors rounded-lg -mx-2 px-2 cursor-pointer"
                                >
                                    <span className="text-white text-[13px] flex-1 min-w-0 truncate">{item.content}</span>
                                    <div className="flex items-center gap-1.5 w-[90px]">
                                        <span className="material-symbols-sharp text-sm" style={{ color: platformInfo.color, fontVariationSettings: "'wght' 300" }}>
                                            {platformInfo.icon}
                                        </span>
                                        <span className="text-white text-[13px]">{platformInfo.name}</span>
                                    </div>
                                    <span className="text-[#9CA3AF] text-[13px] w-[80px]">{item.date || '--'}</span>
                                    <span className="text-white text-[13px] w-[90px]">{formatNumber(item.impressions)}</span>
                                    <span className="text-white text-[13px] w-[90px]">{formatNumber(item.engagement)}</span>
                                    <span className="text-[#22C55E] text-[13px] font-semibold w-[70px]">
                                        {Number(item.rate).toFixed(2)}%
                                    </span>
                                </div>
                            );
                        })}

                        {sortedContent.length === 0 && (
                            <div className="py-12 text-center">
                                <span className="material-symbols-sharp text-[#64748B] text-4xl mb-2 block" style={{ fontVariationSettings: "'wght' 200" }}>article</span>
                                <p className="text-[#64748B] text-sm">No content data available</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Detail Drawer */}
            {selectedPost && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedPost(null)} />
                    <div
                        className="fixed top-0 right-0 h-full w-[420px] z-50 flex flex-col"
                        style={{
                            backgroundColor: '#111113',
                            borderLeft: '1px solid #1F1F23',
                            boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
                            animation: 'slideInRight 0.2s ease-out',
                        }}
                    >
                        <style>{`
                            @keyframes slideInRight {
                                from { transform: translateX(100%); opacity: 0; }
                                to { transform: translateX(0); opacity: 1; }
                            }
                        `}</style>

                        {/* Drawer Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F1F23] shrink-0">
                            <span className="text-white text-base font-semibold">Post Details</span>
                            <button onClick={() => setSelectedPost(null)} className="p-1.5 hover:bg-[#1A1A1D] rounded-lg transition-colors">
                                <span className="material-symbols-sharp text-[#6B6B70] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                            {/* Platform + Date */}
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const pi = getPlatformIcon(selectedPost.platform);
                                    return (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1A1D]">
                                            <span className="material-symbols-sharp text-sm" style={{ color: pi.color, fontVariationSettings: "'wght' 300" }}>{pi.icon}</span>
                                            <span className="text-white text-xs font-medium">{pi.name}</span>
                                        </div>
                                    );
                                })()}
                                {selectedPost.date && (
                                    <span className="text-[#6B6B70] text-xs">{selectedPost.date}</span>
                                )}
                            </div>

                            {/* Full Content */}
                            <div className="bg-[#0A0A0B] rounded-xl p-4 border border-[#1F1F23]">
                                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>
                            </div>

                            {/* Media Preview */}
                            {selectedPost.mediaUrl && (
                                <div className="rounded-xl overflow-hidden border border-[#1F1F23]">
                                    <img src={selectedPost.mediaUrl} alt="Post media" className="w-full object-cover" />
                                </div>
                            )}

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-[#1A1A1D] rounded-xl p-4 flex flex-col gap-1">
                                    <span className="text-[#6B6B70] text-xs">Impressions</span>
                                    <span className="text-white text-xl font-bold">{formatNumber(selectedPost.impressions)}</span>
                                </div>
                                <div className="bg-[#1A1A1D] rounded-xl p-4 flex flex-col gap-1">
                                    <span className="text-[#6B6B70] text-xs">Engagement Rate</span>
                                    <span className="text-[#22C55E] text-xl font-bold">{selectedPost.rate.toFixed(2)}%</span>
                                </div>
                                <div className="bg-[#1A1A1D] rounded-xl p-4 flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-sharp text-[#EF4444] text-sm" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>favorite</span>
                                        <span className="text-[#6B6B70] text-xs">Likes</span>
                                    </div>
                                    <span className="text-white text-xl font-bold">{formatNumber(selectedPost.likes || 0)}</span>
                                </div>
                                <div className="bg-[#1A1A1D] rounded-xl p-4 flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-sharp text-[#22C55E] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>repeat</span>
                                        <span className="text-[#6B6B70] text-xs">Retweets</span>
                                    </div>
                                    <span className="text-white text-xl font-bold">{formatNumber(selectedPost.retweets || 0)}</span>
                                </div>
                                <div className="bg-[#1A1A1D] rounded-xl p-4 flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-sharp text-[#3B82F6] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>chat_bubble</span>
                                        <span className="text-[#6B6B70] text-xs">Comments</span>
                                    </div>
                                    <span className="text-white text-xl font-bold">{formatNumber(selectedPost.comments || 0)}</span>
                                </div>
                                <div className="bg-[#1A1A1D] rounded-xl p-4 flex flex-col gap-1">
                                    <span className="text-[#6B6B70] text-xs">Total Engagement</span>
                                    <span className="text-white text-xl font-bold">{formatNumber(selectedPost.engagement)}</span>
                                </div>
                            </div>

                            {/* Link to Original */}
                            {selectedPost.url && (
                                <a
                                    href={selectedPost.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-medium bg-[#1A1A1D] border border-[#2A2A2D] hover:border-[#FF5C00] hover:bg-[#FF5C00]/5 transition-colors"
                                >
                                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>open_in_new</span>
                                    View Original Post
                                </a>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
