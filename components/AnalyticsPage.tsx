
import React from 'react';
import { SocialMetrics, ComputedMetrics } from '../types';

interface AnalyticsPageProps {
    brandName: string;
    metrics: SocialMetrics | null;
    chainMetrics: ComputedMetrics | null;
}

// Reusable "Premium" Stat Card (Matching Dashboard.tsx)
const StatCard = ({ title, value, subtext, trend, isPositive }: any) => (
    <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border shadow-premium hover:shadow-premium-hover transition-all duration-300 relative overflow-hidden group">
        <div className="flex justify-between items-start mb-4">
            <h3 className="text-[11px] font-bold text-brand-muted uppercase tracking-widest font-display">{title}</h3>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                <span>{isPositive ? '↗' : '↘'}</span>
                {trend}
            </div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-display font-bold text-brand-text tracking-tight group-hover:text-brand-accent transition-colors">{value}</span>
        </div>
        <p className="text-xs text-brand-textSecondary font-medium">{subtext}</p>

        {/* Subtle Decor */}
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-brand-surfaceHighlight rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    </div>
);

// SVG Sparkline / Area Chart Component (Keep the logic, update colors to brand variables)
const GrowthChart = ({ data }: { data: number[] }) => {
    // Normalize data
    const max = Math.max(...data) || 100;
    const min = Math.min(...data) || 0;
    const range = max - min || 1;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 80 - 10;
        return `${x},${y}`;
    }).join(' ');

    const fillPath = `0,100 ${points} 100,100`;

    return (
        <div className="w-full h-72 relative overflow-hidden bg-brand-surfaceHighlight/30 rounded-xl border border-brand-border/50 p-4">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-10 pointer-events-none">
                <div className="w-full h-px bg-brand-text"></div>
                <div className="w-full h-px bg-brand-text"></div>
                <div className="w-full h-px bg-brand-text"></div>
                <div className="w-full h-px bg-brand-text"></div>
            </div>

            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full relative z-10">
                <defs>
                    <linearGradient id="growthGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={`M ${fillPath}`} fill="url(#growthGrad)" />
                <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
};

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ brandName, metrics, chainMetrics }) => {

    // Derived or Mock History
    const historyData = (metrics?.engagementHistory && metrics.engagementHistory.length > 0)
        ? metrics.engagementHistory.map(h => h.rate)
        : [45, 52, 49, 58, 62, 60, 68, 74, 80, 78, 85, 90];

    // Stats
    const totalFollowers = metrics?.totalFollowers || 0;
    const engagementRate = metrics?.engagementRate || 0;
    const impressions = metrics?.weeklyImpressions || 0;

    return (
        <div className="w-full p-6 font-sans animate-fadeIn max-w-[1600px] mx-auto min-h-screen">

            {/* HEADER (Matching Dashboard) */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-display font-bold text-brand-text tracking-tight">Analytics Command</h1>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wide">Live Data</span>
                    </div>
                    <p className="text-sm text-brand-textSecondary">Deep dive performance metrics for <span className="font-bold text-brand-text">{brandName}</span></p>
                </div>

                {/* Timeframe Toggle (Matching Dashboard) */}
                <div className="flex bg-brand-surface rounded-lg p-1 border border-brand-border shadow-sm">
                    {['24H', '7D', '30D', '90D', 'All'].map((t, i) => (
                        <button key={t} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${i === 2 ? 'bg-brand-text text-brand-surface shadow-sm' : 'text-brand-textSecondary hover:text-brand-text hover:bg-brand-surfaceHighlight'}`}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                    title="Total Reach"
                    value={totalFollowers.toLocaleString()}
                    subtext="Followers across all platforms"
                    trend={metrics?.comparison?.followersChange ? `${metrics.comparison.followersChange >= 0 ? '+' : ''}${metrics.comparison.followersChange}%` : "+2.4%"}
                    isPositive={(metrics?.comparison?.followersChange || 0) >= 0}
                />
                <StatCard
                    title="Engagement Rate"
                    value={`${engagementRate}%`}
                    subtext="Average interaction per post"
                    trend="+12.5%"
                    isPositive={true}
                />
                <StatCard
                    title="Impressions"
                    value={`${(impressions / 1000).toFixed(1)}k`}
                    subtext="Weekly view count"
                    trend="+5.2%"
                    isPositive={true}
                />
                <StatCard
                    title="On-Chain Vol"
                    value={chainMetrics ? `$${(chainMetrics.totalVolume / 1000).toFixed(1)}k` : '$--'}
                    subtext="Verified transaction volume"
                    trend="+0.0%"
                    isPositive={true}
                />
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* BIG CHART SECTION */}
                <div className="lg:col-span-2 bg-brand-surface rounded-2xl border border-brand-border shadow-premium p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-brand-muted uppercase tracking-widest font-display">Performance History</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-xs text-brand-textSecondary font-bold"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Engagement</div>
                            <div className="flex items-center gap-2 text-xs text-brand-muted font-bold"><div className="w-2 h-2 rounded-full bg-brand-border"></div> Baseline</div>
                        </div>
                    </div>
                    <GrowthChart data={historyData} />
                </div>

                {/* DEMOGRAPHICS / BREAKDOWN */}
                <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-premium p-6 flex flex-col">
                    <h3 className="text-sm font-bold text-brand-muted uppercase tracking-widest font-display mb-6">Acquisition Sources</h3>
                    <div className="flex-1 flex flex-col justify-center gap-6">
                        {/* Custom Progress Bars */}
                        {[
                            { label: 'Twitter / X', val: 65, color: 'bg-brand-text' },
                            { label: 'Direct / Search', val: 20, color: 'bg-emerald-500' },
                            { label: 'Telegram', val: 10, color: 'bg-blue-500' },
                            { label: 'Other', val: 5, color: 'bg-gray-300' }
                        ].map((item) => (
                            <div key={item.label}>
                                <div className="flex justify-between text-xs font-bold text-brand-textSecondary mb-2">
                                    <span>{item.label}</span>
                                    <span className="text-brand-text">{item.val}%</span>
                                </div>
                                <div className="w-full h-2 bg-brand-bg rounded-full overflow-hidden border border-brand-border/50">
                                    <div className={`h-full ${item.color}`} style={{ width: `${item.val}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* TOP CONTENT TABLE */}
            <div className="bg-brand-surface rounded-2xl border border-brand-border shadow-premium overflow-hidden mt-8">
                <div className="p-6 border-b border-brand-border flex justify-between items-center bg-brand-bg/30">
                    <h3 className="text-sm font-bold text-brand-muted uppercase tracking-widest font-display">Top Content Performance</h3>
                    <button className="text-xs font-bold text-brand-accent hover:text-brand-accentHover bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100">
                        View All Posts
                    </button>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-brand-surfaceHighlight text-brand-muted font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                            <th className="px-6 py-4">Content</th>
                            <th className="px-6 py-4 text-right">Impressions</th>
                            <th className="px-6 py-4 text-right">Engagement</th>
                            <th className="px-6 py-4 text-right">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                        {metrics?.recentPosts.slice(0, 5).map(post => (
                            <tr key={post.id} className="hover:bg-brand-surfaceHighlight/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        {post.mediaUrl && (
                                            <div className="w-10 h-10 rounded-md bg-gray-100 bg-cover bg-center flex-shrink-0 border border-brand-border" style={{ backgroundImage: `url(${post.mediaUrl})` }}></div>
                                        )}
                                        <div className="min-w-0">
                                            <a href={post.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-text line-clamp-1 max-w-xs hover:text-brand-accent transition-colors hover:underline decoration-brand-accent/50">
                                                {post.content}
                                            </a>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-brand-textSecondary">{post.impressions.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-brand-accent font-bold text-xs ring-1 ring-indigo-100">{post.engagementRate}%</span>
                                </td>
                                <td className="px-6 py-4 text-right text-brand-muted text-xs font-medium">{post.date}</td>
                            </tr>
                        ))}
                        {(!metrics?.recentPosts || metrics.recentPosts.length === 0) && (
                            <tr>
                                <td colSpan={4} className="px-6 py-16 text-center text-brand-muted">
                                    <div className="flex flex-col items-center justify-center gap-3 opacity-60">
                                        <div className="w-12 h-12 bg-brand-bg rounded-xl flex items-center justify-center border border-brand-border">
                                            <svg className="w-6 h-6 text-brand-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                        </div>
                                        <span className="text-sm font-medium">No recent content detected.</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer Spacer */}
            <div className="h-24"></div>
        </div>
    );
};
