
import React, { useState } from 'react';
import { SocialMetrics, ComputedMetrics } from '../types';

interface AnalyticsPageProps {
    brandName: string;
    metrics: SocialMetrics | null;
    chainMetrics: ComputedMetrics | null;
}

type ChartTab = 'impressions' | 'engagements' | 'followers';
type DateRange = '7d' | '30d' | '90d' | 'all';

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ brandName, metrics, chainMetrics }) => {
    const [chartTab, setChartTab] = useState<ChartTab>('impressions');
    const [dateRange, setDateRange] = useState<DateRange>('30d');

    // Derived history for chart - empty if no real data
    const engagementHistory = metrics?.engagementHistory || [];
    const historyData = engagementHistory.map(h => h.rate);
    const hasEngagementHistory = historyData.length > 1;

    // Stats from real data only - show 0 or -- if no data
    const totalFollowers = metrics?.totalFollowers || 0;
    const engagementRate = metrics?.engagementRate || 0;
    const impressions = metrics?.weeklyImpressions || 0;
    const totalEngagements = impressions > 0 ? Math.round(impressions * (engagementRate / 100)) : 0;

    // Calculate changes - 0 if no real data
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
            const y = 100 - ((val - min) / range) * 80 - 10; // padding
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

    // Top content from real posts, sorted by engagement
    const topContent = (metrics?.recentPosts || [])
        .slice()
        .sort((a, b) => (b.likes + b.retweets + b.comments) - (a.likes + a.retweets + a.comments))
        .slice(0, 4)
        .map(post => ({
            id: post.id,
            content: post.content,
            platform: 'twitter',
            impressions: post.impressions,
            engagement: post.likes + post.retweets + (post.comments || 0),
            rate: post.engagementRate,
        }));

    // Generate insights from actual data
    const aiInsights: { num: number; text: string }[] = [];
    if (metrics) {
        if (topContent.length > 0) {
            const best = topContent[0];
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
            <div className="flex items-center justify-between px-10 py-6 border-b border-[#1F1F23]">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-white">Analytics</h1>
                    <p className="text-sm text-[#6B6B70]">Track your marketing performance and growth metrics</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[#6B6B70] text-sm">Based on recent X/Twitter data for {brandName}</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-6 p-7 px-10 overflow-y-auto">
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
                        <span className="text-white text-[32px] font-bold">{formatNumber(impressions)}</span>
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
                        <span className="text-white text-[32px] font-bold">{formatNumber(totalEngagements)}</span>
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
                        <span className="text-white text-[32px] font-bold">{formatNumber(totalFollowers)}</span>
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
                        <span className="text-white text-[32px] font-bold">{engagementRate.toFixed(2)}%</span>
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
                                <span className="text-white text-[32px] font-bold">{formatNumber(chainMetrics.netNewWallets)}</span>
                                <span className="text-[#6B6B70] text-xs">net new (30d)</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[#9CA3AF] text-[13px]">Active Wallets</span>
                                    <div className="w-8 h-8 rounded-lg bg-[#06B6D422] flex items-center justify-center">
                                        <span className="material-symbols-sharp text-[#06B6D4] text-base" style={{ fontVariationSettings: "'wght' 300" }}>account_balance_wallet</span>
                                    </div>
                                </div>
                                <span className="text-white text-[32px] font-bold">{formatNumber(chainMetrics.activeWallets)}</span>
                                <span className="text-[#6B6B70] text-xs">currently active</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[#9CA3AF] text-[13px]">Volume</span>
                                    <div className="w-8 h-8 rounded-lg bg-[#22C55E22] flex items-center justify-center">
                                        <span className="material-symbols-sharp text-[#22C55E] text-base" style={{ fontVariationSettings: "'wght' 300" }}>bar_chart</span>
                                    </div>
                                </div>
                                <span className="text-white text-[32px] font-bold">
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
                                <span className="text-white text-[32px] font-bold">{chainMetrics.retentionRate.toFixed(1)}%</span>
                                <span className={`text-xs ${chainMetrics.retentionRate >= 30 ? 'text-[#22C55E]' : chainMetrics.retentionRate >= 15 ? 'text-[#F59E0B]' : 'text-[#6B6B70]'}`}>
                                    {chainMetrics.retentionRate >= 30 ? 'Healthy' : chainMetrics.retentionRate >= 15 ? 'Average' : 'Needs improvement'}
                                </span>
                            </div>
                        </div>
                        {/* Campaign Attribution */}
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
                <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                    <div className="flex gap-6">
                        {/* Chart Area */}
                        <div className="flex-1 flex flex-col gap-5">
                            {/* Chart Header */}
                            <div className="flex items-center justify-between">
                                <span className="text-white text-base font-semibold">Performance Over Time</span>
                                {/* Tabs */}
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

                            {/* Chart */}
                            <div className="relative h-60">
                                {chartTab === 'engagements' && hasEngagementHistory ? (
                                    <>
                                        {/* Grid Lines */}
                                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                            {[0, 1, 2, 3, 4].map(i => (
                                                <div key={i} className="w-full h-px bg-[#1F1F23]"></div>
                                            ))}
                                        </div>

                                        {/* Y Axis Labels */}
                                        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-[#6B6B70] text-xs py-1">
                                            <span>{Math.max(...historyData).toFixed(2)}%</span>
                                            <span>{((Math.max(...historyData) + Math.min(...historyData)) / 2).toFixed(2)}%</span>
                                            <span>{Math.min(...historyData).toFixed(2)}%</span>
                                            <span>—</span>
                                            <span>0%</span>
                                        </div>

                                        {/* Chart SVG */}
                                        <div className="absolute left-12 right-0 top-0 bottom-6">
                                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                                                <defs>
                                                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                                        <stop offset="0%" stopColor="#FF5C00" stopOpacity="0.3" />
                                                        <stop offset="100%" stopColor="#FF5C00" stopOpacity="0" />
                                                    </linearGradient>
                                                </defs>
                                                {/* Area fill */}
                                                <path
                                                    d={engagementAreaPath()}
                                                    fill="url(#chartGradient)"
                                                />
                                                {/* Line */}
                                                <path
                                                    d={engagementSeriesPath()}
                                                    fill="none"
                                                    stroke="#FF5C00"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                />
                                            </svg>
                                        </div>

                                        {/* X Axis Labels */}
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
                        <div className="w-[200px] flex flex-col gap-4">
                            {/* Peak Day */}
                            <div className="bg-[#1A1A1D] rounded-lg p-4 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Peak Day</span>
                                <span className="text-white text-lg font-semibold">
                                    {chartTab === 'engagements' && engagementPeak ? engagementPeak.date : '--'}
                                </span>
                                <span className="text-[#22C55E] text-xs font-medium">
                                    {chartTab === 'engagements' && engagementPeak ? `${engagementPeak.rate.toFixed(2)}%` : 'No data'}
                                </span>
                            </div>

                            {/* Avg Daily */}
                            <div className="bg-[#1A1A1D] rounded-lg p-4 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Avg. Daily</span>
                                <span className="text-white text-lg font-semibold">
                                    {chartTab === 'engagements' && hasEngagementHistory ? `${engagementAvg.toFixed(2)}%` : '--'}
                                </span>
                                <span className="text-[#6B6B70] text-xs font-medium">
                                    {chartTab === 'engagements' && hasEngagementHistory ? 'Avg engagement rate' : 'No data'}
                                </span>
                            </div>

                            {/* Growth Rate */}
                            <div className="bg-[#1A1A1D] rounded-lg p-4 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Growth Rate</span>
                                <span className="text-white text-lg font-semibold">
                                    {chartTab === 'engagements' && hasEngagementHistory ? formatDelta(engagementGrowth) : '--'}
                                </span>
                                <span className="text-[#6B6B70] text-xs">Period over period</span>
                            </div>

                            {/* Best Platform */}
                            <div className="bg-[#1A1A1D] rounded-lg p-4 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Best Platform</span>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-sharp text-[#1DA1F2] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>alternate_email</span>
                                    <span className="text-white text-lg font-semibold">{metrics ? 'Twitter/X' : '--'}</span>
                                </div>
                                <span className="text-[#6B6B70] text-xs">
                                    {metrics ? 'Based on available social data' : 'No platform data'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Performance Insights */}
                <div
                    className="rounded-[14px] p-6 border border-[#FF5C0044]"
                    style={{ background: 'linear-gradient(180deg, #111113 0%, #1A120D 100%)' }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2.5 mb-4">
                        <span className="material-symbols-sharp text-[#FF5C00] text-2xl" style={{ fontVariationSettings: "'wght' 200" }}>auto_awesome</span>
                        <span className="text-[#FF5C00] text-base font-semibold">AI Performance Insights</span>
                    </div>

                    {/* Insights List */}
                    <div className="flex flex-col gap-3 mb-5">
                        {aiInsights.map(insight => (
                            <div key={insight.num} className="flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-[#FF5C00] flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">{insight.num}</span>
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

                    {/* Action Button */}
                    <button
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-semibold"
                        style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                        disabled={aiInsights.length === 0}
                    >
                        <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>bolt</span>
                        {aiInsights.length === 0 ? 'No Recommendations Available' : 'Apply AI Recommendations'}
                    </button>
                </div>

                {/* Top Performing Content */}
                <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <span className="text-white text-base font-semibold">Top Performing Content</span>
                        <span className="text-[#6B6B70] text-xs">{topContent.length} posts</span>
                    </div>

                    {/* Table */}
                    <div className="flex flex-col">
                        {/* Table Header */}
                        <div className="flex items-center gap-4 py-3 border-b border-[#1F1F23]">
                            <span className="text-[#6B6B70] text-xs font-medium flex-1 min-w-0" style={{ maxWidth: '320px' }}>Content</span>
                            <span className="text-[#6B6B70] text-xs font-medium w-[100px]">Platform</span>
                            <span className="text-[#6B6B70] text-xs font-medium w-[100px]">Impressions</span>
                            <span className="text-[#6B6B70] text-xs font-medium w-[100px]">Engagement</span>
                            <span className="text-[#6B6B70] text-xs font-medium w-[80px]">Rate</span>
                        </div>

                        {/* Table Rows */}
                        {topContent.map(item => {
                            const platformInfo = getPlatformIcon(item.platform);
                            return (
                                <div key={item.id} className="flex items-center gap-4 py-3 hover:bg-[#1A1A1D] transition-colors rounded-lg -mx-2 px-2">
                                    <span className="text-white text-[13px] flex-1 min-w-0 truncate" style={{ maxWidth: '320px' }}>
                                        {item.content}
                                    </span>
                                    <div className="flex items-center gap-1.5 w-[100px]">
                                        <span className="material-symbols-sharp text-sm" style={{ color: platformInfo.color, fontVariationSettings: "'wght' 300" }}>
                                            {platformInfo.icon}
                                        </span>
                                        <span className="text-white text-[13px]">{platformInfo.name}</span>
                                    </div>
                                    <span className="text-white text-[13px] w-[100px]">{formatNumber(item.impressions)}</span>
                                    <span className="text-white text-[13px] w-[100px]">{formatNumber(item.engagement)}</span>
                                    <span className="text-[#22C55E] text-[13px] font-semibold w-[80px]">
                                        {Number(item.rate).toFixed(2)}%
                                    </span>
                                </div>
                            );
                        })}

                        {topContent.length === 0 && (
                            <div className="py-12 text-center">
                                <span className="material-symbols-sharp text-[#64748B] text-4xl mb-2 block" style={{ fontVariationSettings: "'wght' 200" }}>article</span>
                                <p className="text-[#64748B] text-sm">No content data available</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
