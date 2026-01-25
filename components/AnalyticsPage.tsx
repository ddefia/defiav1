
import React from 'react';
import { SocialMetrics, ComputedMetrics } from '../types';

interface AnalyticsPageProps {
    brandName: string;
    metrics: SocialMetrics | null;
    chainMetrics: ComputedMetrics | null;
}

// Reusable "Clean" Stat Card (Sharper Aesthetic)
const StatCard = ({ title, value, subtext, trend, isPositive }: any) => (
    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:shadow-md transition-all duration-200">
        <div className="flex justify-between items-start mb-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isPositive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                <span>{isPositive ? '↗' : '↘'}</span>
                {trend}
            </div>
        </div>
        <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-2xl font-bold text-gray-900 tracking-tight">{value}</span>
        </div>
        <p className="text-[10px] text-gray-400 font-medium">{subtext}</p>
    </div>
);

// SVG Sparkline / Area Chart Component (Updated Colors)
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
        <div className="w-full h-80 relative overflow-hidden bg-white rounded-lg border border-gray-200 p-5">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-6 opacity-30 pointer-events-none">
                <div className="w-full h-px bg-gray-100"></div>
                <div className="w-full h-px bg-gray-100"></div>
                <div className="w-full h-px bg-gray-100"></div>
                <div className="w-full h-px bg-gray-100"></div>
            </div>

            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full relative z-10">
                <defs>
                    <linearGradient id="growthGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={`M ${fillPath}`} fill="url(#growthGrad)" />
                <polyline points={points} fill="none" stroke="#4F46E5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
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
        <div className="w-full p-6 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER (Matching Dashboard) */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                        Analytics Command
                    </h1>
                    <div className="text-[10px] text-gray-500 font-mono mt-1 tracking-tight flex items-center gap-2">
                        {brandName} / System Status: <span className="text-emerald-500 font-bold">ONLINE</span>
                    </div>
                </div>

                {/* Timeframe Toggle */}
                <div className="flex bg-white rounded-md p-1 border border-gray-200 shadow-sm">
                    {['24H', '7D', '30D', '90D', 'All'].map((t, i) => (
                        <button key={t} className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${i === 2 ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* BIG CHART SECTION */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-5 mb-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Performance History</h3>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Engagement</div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold"><div className="w-2 h-2 rounded-full bg-gray-300"></div> Baseline</div>
                            </div>
                        </div>
                        <GrowthChart data={historyData} />
                    </div>

                    {/* TOP CONTENT TABLE */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Top Content Performance</h3>
                            <button className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors">
                                View All Posts →
                            </button>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-5 py-2">Content</th>
                                    <th className="px-5 py-2 text-right">Impressions</th>
                                    <th className="px-5 py-2 text-right">Engagement</th>
                                    <th className="px-5 py-2 text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {metrics?.recentPosts.slice(0, 5).map(post => (
                                    <tr key={post.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                {post.mediaUrl && (
                                                    <div className="w-8 h-8 rounded bg-gray-100 bg-cover bg-center flex-shrink-0 border border-gray-200" style={{ backgroundImage: `url(${post.mediaUrl})` }}></div>
                                                )}
                                                <div className="min-w-0">
                                                    <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-gray-900 line-clamp-1 max-w-xs hover:text-blue-600 transition-colors">
                                                        {post.content}
                                                    </a>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-right text-xs font-mono text-gray-500">{post.impressions.toLocaleString()}</td>
                                        <td className="px-5 py-3 text-right">
                                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold text-[10px] border border-emerald-100">{post.engagementRate}%</span>
                                        </td>
                                        <td className="px-5 py-3 text-right text-gray-400 text-[10px] font-mono">{post.date}</td>
                                    </tr>
                                ))}
                                {(!metrics?.recentPosts || metrics.recentPosts.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center justify-center gap-2 opacity-60">
                                                <span className="text-xs font-medium">No recent content data available.</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT COLUMN: INSIGHTS */}
                <div className="flex flex-col gap-6">
                    {/* INSIGHTS BOX (Expanded to fill column) */}
                    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100 p-5 shadow-[0_1px_2px_rgba(79,70,229,0.05)] h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        <h3 className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest mb-3 relative z-10">AI Insight</h3>
                        <p className="text-xs text-indigo-900/80 leading-relaxed relative z-10 font-medium">
                            Engagement on Twitter has spiked <span className="font-bold text-indigo-700">+12%</span> this week due to the new roadmap announcement. Recommend doubling down on thread content.
                        </p>

                        <div className="mt-6 p-3 bg-white/60 rounded border border-indigo-50 relative z-10">
                            <h4 className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Recommended Action</h4>
                            <button className="w-full py-2 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-700 transition-colors shadow-sm cursor-not-allowed opacity-80">
                                Draft Thread (Coming Soon)
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            <div className="h-12"></div>
        </div>
    );
};
