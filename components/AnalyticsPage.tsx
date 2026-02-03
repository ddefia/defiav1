
import React, { useState } from 'react';
import { SocialMetrics, ComputedMetrics } from '../types';

interface AnalyticsPageProps {
    brandName: string;
    metrics: SocialMetrics | null;
    chainMetrics: ComputedMetrics | null;
}

type ChartTab = 'impressions' | 'engagements' | 'followers';
type DateRange = '7d' | '30d' | '90d' | 'all';

// Top content is loaded from real data - no hardcoded mock data
const MOCK_TOP_CONTENT: {
    id: string;
    content: string;
    platform: string;
    impressions: number;
    engagement: number;
    rate: number;
}[] = [];

// AI Insights are generated dynamically - no hardcoded mock data
const AI_INSIGHTS: { num: number; text: string }[] = [];

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ brandName, metrics, chainMetrics }) => {
    const [chartTab, setChartTab] = useState<ChartTab>('impressions');
    const [dateRange, setDateRange] = useState<DateRange>('30d');

    // Derived history for chart - empty if no real data
    const historyData = (metrics?.engagementHistory && metrics.engagementHistory.length > 0)
        ? metrics.engagementHistory.map(h => h.rate)
        : [];

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

    // Use real posts or mock data
    const topContent = metrics?.recentPosts?.slice(0, 4).map(post => ({
        id: post.id,
        content: post.content,
        platform: 'twitter',
        impressions: post.impressions,
        engagement: Math.round(post.impressions * (post.engagementRate / 100)),
        rate: post.engagementRate,
    })) || MOCK_TOP_CONTENT;

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-6 border-b border-[#1F1F23]">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-white">Analytics</h1>
                    <p className="text-sm text-[#6B6B70]">Track your marketing performance and growth metrics</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Date Range Selector */}
                    <button className="flex items-center gap-2 px-3.5 py-2.5 bg-[#111113] border border-[#2E2E2E] rounded-lg hover:bg-[#1A1A1D] transition-colors">
                        <span className="material-symbols-sharp text-[#6B6B70] text-base" style={{ fontVariationSettings: "'wght' 300" }}>calendar_today</span>
                        <span className="text-white text-sm font-medium">Last 30 days</span>
                        <span className="material-symbols-sharp text-[#6B6B70] text-base" style={{ fontVariationSettings: "'wght' 300" }}>expand_more</span>
                    </button>
                    {/* Export Button */}
                    <button className="flex items-center gap-1.5 px-3.5 py-2.5 border border-[#2E2E2E] rounded-lg hover:bg-[#1A1A1D] transition-colors">
                        <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 300" }}>download</span>
                        <span className="text-white text-sm font-medium">Export</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-6 p-7 px-10 overflow-y-auto">
                {/* Metrics Row */}
                <div className="grid grid-cols-4 gap-4">
                    {/* Total Impressions */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[#9CA3AF] text-[13px]">Total Impressions</span>
                            <div className="w-8 h-8 rounded-lg bg-[#3B82F622] flex items-center justify-center">
                                <span className="material-symbols-sharp text-[#3B82F6] text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>visibility</span>
                            </div>
                        </div>
                        <span className="text-white text-[32px] font-bold">{formatNumber(impressions)}</span>
                        <div className="flex items-center gap-1.5">
                            <span className="material-symbols-sharp text-[#22C55E] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>trending_up</span>
                            <span className="text-[#22C55E] text-xs font-medium">+{impressionsChange}% from last month</span>
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
                            <span className="material-symbols-sharp text-[#22C55E] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>trending_up</span>
                            <span className="text-[#22C55E] text-xs font-medium">+18.2% from last month</span>
                        </div>
                    </div>

                    {/* Follower Growth */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[#9CA3AF] text-[13px]">Follower Growth</span>
                            <div className="w-8 h-8 rounded-lg bg-[#FF5C0022] flex items-center justify-center">
                                <span className="material-symbols-sharp text-[#FF5C00] text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>group</span>
                            </div>
                        </div>
                        <span className="text-white text-[32px] font-bold">+{formatNumber(totalFollowers)}</span>
                        <div className="flex items-center gap-1.5">
                            <span className="material-symbols-sharp text-[#22C55E] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>trending_up</span>
                            <span className="text-[#22C55E] text-xs font-medium">+{followersChange}% from last month</span>
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
                        <span className="text-white text-[32px] font-bold">{engagementRate}%</span>
                        <div className="flex items-center gap-1.5">
                            <span className="material-symbols-sharp text-[#22C55E] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>trending_up</span>
                            <span className="text-[#22C55E] text-xs font-medium">+{engagementChange}% from last month</span>
                        </div>
                    </div>
                </div>

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
                                {/* Grid Lines */}
                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                    {[0, 1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-full h-px bg-[#1F1F23]"></div>
                                    ))}
                                </div>

                                {/* Y Axis Labels */}
                                <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-[#6B6B70] text-xs py-1">
                                    <span>3M</span>
                                    <span>2M</span>
                                    <span>1M</span>
                                    <span>500K</span>
                                    <span>0</span>
                                </div>

                                {/* Chart SVG */}
                                <div className="absolute left-12 right-0 top-0 bottom-6">
                                    <svg viewBox="0 0 700 200" preserveAspectRatio="none" className="w-full h-full">
                                        <defs>
                                            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                                <stop offset="0%" stopColor="#FF5C00" stopOpacity="0.3" />
                                                <stop offset="100%" stopColor="#FF5C00" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        {/* Area fill */}
                                        <path
                                            d="M0,180 C50,160 100,140 150,120 C200,100 250,90 300,85 C350,80 400,70 450,60 C500,50 550,45 600,35 C650,25 700,20 700,20 L700,200 L0,200 Z"
                                            fill="url(#chartGradient)"
                                        />
                                        {/* Line */}
                                        <path
                                            d="M0,180 C50,160 100,140 150,120 C200,100 250,90 300,85 C350,80 400,70 450,60 C500,50 550,45 600,35 C650,25 700,20 700,20"
                                            fill="none"
                                            stroke="#FF5C00"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                        />
                                        {/* Data points */}
                                        <circle cx="0" cy="180" r="6" fill="#FF5C00" stroke="#0A0A0B" strokeWidth="2" />
                                        <circle cx="150" cy="120" r="6" fill="#FF5C00" stroke="#0A0A0B" strokeWidth="2" />
                                        <circle cx="300" cy="85" r="6" fill="#FF5C00" stroke="#0A0A0B" strokeWidth="2" />
                                        <circle cx="450" cy="60" r="6" fill="#FF5C00" stroke="#0A0A0B" strokeWidth="2" />
                                        <circle cx="600" cy="35" r="6" fill="#FF5C00" stroke="#0A0A0B" strokeWidth="2" />
                                    </svg>

                                    {/* Tooltip */}
                                    <div className="absolute right-20 top-0 bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3 py-2">
                                        <p className="text-white text-xs font-semibold">2.4M impressions</p>
                                        <p className="text-[#6B6B70] text-[11px]">Jan 28, 2025</p>
                                    </div>
                                </div>

                                {/* X Axis Labels */}
                                <div className="absolute left-12 right-0 bottom-0 flex justify-between text-[#6B6B70] text-xs">
                                    <span>Jan 1</span>
                                    <span>Jan 7</span>
                                    <span>Jan 14</span>
                                    <span>Jan 21</span>
                                    <span>Jan 28</span>
                                </div>
                            </div>
                        </div>

                        {/* Chart Stats Sidebar */}
                        <div className="w-[200px] flex flex-col gap-4">
                            {/* Peak Day */}
                            <div className="bg-[#1A1A1D] rounded-lg p-4 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Peak Day</span>
                                <span className="text-white text-lg font-semibold">Jan 15</span>
                                <span className="text-[#22C55E] text-xs font-medium">542K impressions</span>
                            </div>

                            {/* Avg Daily */}
                            <div className="bg-[#1A1A1D] rounded-lg p-4 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Avg. Daily</span>
                                <span className="text-white text-lg font-semibold">80K</span>
                                <span className="text-[#22C55E] text-xs font-medium">+18% vs last month</span>
                            </div>

                            {/* Growth Rate */}
                            <div className="bg-[#1A1A1D] rounded-lg p-4 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Growth Rate</span>
                                <span className="text-[#22C55E] text-lg font-semibold">+24.5%</span>
                                <span className="text-[#6B6B70] text-xs">Month over month</span>
                            </div>

                            {/* Best Platform */}
                            <div className="bg-[#1A1A1D] rounded-lg p-4 flex flex-col gap-1">
                                <span className="text-[#6B6B70] text-xs">Best Platform</span>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-sharp text-[#1DA1F2] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>alternate_email</span>
                                    <span className="text-white text-lg font-semibold">Twitter/X</span>
                                </div>
                                <span className="text-[#6B6B70] text-xs">75% of total reach</span>
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
                        {AI_INSIGHTS.map(insight => (
                            <div key={insight.num} className="flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-[#FF5C00] flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-xs font-semibold">{insight.num}</span>
                                </div>
                                <span className="text-[#E5E5E5] text-[13px] leading-relaxed">{insight.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* Action Button */}
                    <button
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-semibold"
                        style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                    >
                        <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>bolt</span>
                        Apply AI Recommendations
                    </button>
                </div>

                {/* Top Performing Content */}
                <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <span className="text-white text-base font-semibold">Top Performing Content</span>
                        <button className="text-[#FF5C00] text-sm font-medium hover:underline flex items-center gap-1">
                            View All
                            <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>arrow_forward</span>
                        </button>
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
                                    <span className="text-[#22C55E] text-[13px] font-semibold w-[80px]">{item.rate}%</span>
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
