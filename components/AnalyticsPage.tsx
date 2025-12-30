
import React from 'react';
import { SocialMetrics, ComputedMetrics } from '../types';

interface AnalyticsPageProps {
    brandName: string;
    metrics: SocialMetrics | null;
    chainMetrics: ComputedMetrics | null;
}

// Reusable "Modern" Card
const GlassCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
        {children}
    </div>
);

// SVG Sparkline / Area Chart Component
const GrowthChart = ({ data }: { data: number[] }) => {
    // Normalize data to 0-100 range for SVG
    const max = Math.max(...data) || 100;
    const min = Math.min(...data) || 0;
    const range = max - min || 1;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((val - min) / range) * 80 - 10; // Padding
        return `${x},${y}`;
    }).join(' ');

    const fillPath = `0,100 ${points} 100,100`;

    return (
        <div className="w-full h-64 relative overflow-hidden">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                    <linearGradient id="growthGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={`M ${fillPath}`} fill="url(#growthGrad)" />
                <polyline points={points} fill="none" stroke="#4F46E5" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {/* Tooltip-like overlay lines (visual only) */}
            <div className="absolute inset-0 flex justify-between items-end px-2 opacity-20 pointer-events-none">
                {data.map((_, i) => (
                    <div key={i} className="w-px h-full border-r border-dashed border-gray-400"></div>
                ))}
            </div>
        </div>
    );
};

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ brandName, metrics, chainMetrics }) => {

    // Derived or Mock History for Chart
    const historyData = metrics?.engagementHistory.map(h => h.rate)
        || [45, 50, 48, 55, 60, 58, 65, 70, 75, 72, 80, 85]; // Fallback mock curve

    // Stats
    const totalFollowers = metrics?.totalFollowers || 0;
    const engagementRate = metrics?.engagementRate || 0;
    const impressions = metrics?.weeklyImpressions || 0;
    const growthRate = metrics?.comparison.followersChange || 0;

    return (
        <div className="space-y-8 p-8 max-w-7xl mx-auto pb-24 animate-fadeIn">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight">Analytics Overview</h1>
                    <p className="text-gray-500 mt-1">Real-time performance metrics for <span className="font-bold text-indigo-600">{brandName}</span></p>
                </div>
                <div className="flex gap-2 bg-gray-50 p-1 rounded-lg">
                    {['7D', '30D', '90D', 'ALL'].map(range => (
                        <button key={range} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${range === '30D' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <GlassCard>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${growthRate >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {growthRate >= 0 ? '+' : ''}{growthRate}%
                        </span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">{totalFollowers.toLocaleString()}</div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Users</div>
                </GlassCard>

                <GlassCard>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-50 text-green-600">+12.5%</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">{engagementRate}%</div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Engagement Rate</div>
                </GlassCard>

                <GlassCard>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-50 text-green-600">+5.2%</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">{(impressions / 1000).toFixed(1)}k</div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Weekly Impressions</div>
                </GlassCard>

                <GlassCard>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">--</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">${chainMetrics ? chainMetrics.totalVolume.toLocaleString() : '0'}</div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">On-Chain Volume</div>
                </GlassCard>
            </div>

            {/* MAIN CHART SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* BIG CHART */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-lg font-bold text-gray-900">Engagement Growth</h3>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs text-gray-500"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Twitter</div>
                            <div className="flex items-center gap-1 text-xs text-gray-500"><div className="w-2 h-2 rounded-full bg-gray-300"></div> Telegram</div>
                        </div>
                    </div>
                    <GrowthChart data={historyData} />
                </div>

                {/* DEMOGRAPHICS / BREAKDOWN */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">Traffic Sources</h3>
                    <div className="flex-1 flex flex-col justify-center gap-6">
                        {/* Custom Progress Bars for Source */}
                        {[
                            { label: 'Twitter / X', val: 65, color: 'bg-black' },
                            { label: 'Direct / Search', val: 20, color: 'bg-green-500' },
                            { label: 'Telegram', val: 10, color: 'bg-blue-500' },
                            { label: 'Other', val: 5, color: 'bg-gray-300' }
                        ].map((item) => (
                            <div key={item.label}>
                                <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                                    <span>{item.label}</span>
                                    <span>{item.val}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color}`} style={{ width: `${item.val}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* TOP CONTENT TABLE */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">Top Performing Content</h3>
                    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800">View All</button>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-medium uppercase tracking-wider text-xs">
                        <tr>
                            <th className="px-6 py-4">Content</th>
                            <th className="px-6 py-4 text-right">Impressions</th>
                            <th className="px-6 py-4 text-right">Engagement</th>
                            <th className="px-6 py-4 text-right">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {metrics?.recentPosts.slice(0, 5).map(post => (
                            <tr key={post.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <p className="font-medium text-gray-900 line-clamp-1 max-w-xs">{post.content}</p>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-gray-600">{post.impressions.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs">{post.engagementRate}%</span>
                                </td>
                                <td className="px-6 py-4 text-right text-gray-500">{post.date}</td>
                            </tr>
                        ))}
                        {(!metrics?.recentPosts || metrics.recentPosts.length === 0) && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">No data available</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
};
