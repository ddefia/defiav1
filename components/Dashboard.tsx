import React, { useMemo } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport } from '../types';
import { loadPulseCache } from '../services/storage';
import { calculateDefiaScore } from '../services/scoring';

interface DashboardProps {
    brandName: string;
    calendarEvents: CalendarEvent[];
    socialMetrics: SocialMetrics | null;
    strategyTasks: StrategyTask[];
    chainMetrics: ComputedMetrics | null;
    systemLogs?: string[];
    isServerOnline?: boolean;
    growthReport?: GrowthReport | null;
    onNavigate: (section: string) => void;
    onQuickAction: (action: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
    brandName,
    calendarEvents,
    socialMetrics,
    strategyTasks,
    chainMetrics,
    systemLogs = [],
    // Force Update 12/29
    isServerOnline = false,
    growthReport,
    onNavigate
}) => {
    // --- Data Calculation ---
    // 1. Defia Index
    const { total: indexScore } = useMemo(() => {
        return calculateDefiaScore(socialMetrics, chainMetrics, strategyTasks);
    }, [socialMetrics, chainMetrics, strategyTasks]);

    const displayScore = (indexScore / 10).toFixed(1);

    // --- UI Helper Components ---

    const TopBar = () => (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-2xl font-display font-bold text-brand-text tracking-tight">Dashboard</h1>
                <p className="text-sm text-brand-textSecondary">Overview of your brand's performance</p>
            </div>
            <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative group">
                    <svg className="w-4 h-4 absolute left-3 top-2.5 text-brand-muted group-hover:text-brand-textSecondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                        type="text"
                        placeholder="Search..."
                        className="pl-9 pr-12 py-2 bg-brand-surface border border-brand-border rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent w-64 shadow-sm transition-all"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] bg-brand-surfaceHighlight text-brand-muted px-1.5 py-0.5 rounded border border-brand-border">⌘K</span>
                </div>

                {/* Timeframe */}
                <div className="flex bg-brand-surface rounded-lg p-1 border border-brand-border shadow-sm">
                    {['24H', '7D', '30D', '90D', 'All'].map((t, i) => (
                        <button key={t} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${i === 1 ? 'bg-brand-text text-brand-surface shadow-sm' : 'text-brand-textSecondary hover:text-brand-text hover:bg-brand-surfaceHighlight'}`}>
                            {t}
                        </button>
                    ))}
                </div>

                <div className="h-6 w-[1px] bg-brand-border mx-2"></div>

                {/* Actions */}
                <button className="p-2 text-brand-textSecondary hover:text-brand-text hover:bg-brand-surfaceHighlight rounded-lg transition-colors relative">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    <span className="absolute top-1.5 right-2 w-2 h-2 bg-brand-error rounded-full border border-white"></span>
                </button>
            </div>
        </div>
    );

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

    return (
        <div className="w-full p-6 font-sans animate-fadeIn max-w-[1600px] mx-auto">
            <TopBar />

            {/* HERO SECTION */}
            <div className="mb-6 bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-premium relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-indigo-50/50 to-transparent rounded-bl-full pointer-events-none"></div>

                <div className="relative z-10 flex justify-between items-start">
                    <div className="flex items-start gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-brand-text text-brand-surface shadow-xl shadow-gray-200 flex items-center justify-center text-2xl font-bold font-display">
                            {brandName.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-display font-bold text-brand-text tracking-tight">{brandName}</h1>
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wide">Growth Engine Active</span>
                            </div>
                            <p className="text-brand-textSecondary font-medium mb-4 max-w-xl">
                                {strategyTasks.length > 0
                                    ? `Intelligent automation active. Defia is currently optimizing for maximum ROAS across ${strategyTasks.length} recognized vectors.`
                                    : "Growth Engine is in standby. Generate a strategy or connect data sources to begin optimization."}
                            </p>

                            <div className="flex gap-8 border-t border-brand-border pt-4">
                                {chainMetrics ? (
                                    <>
                                        <div>
                                            <span className="text-xs text-brand-muted font-bold uppercase block mb-1">On-Chain Users</span>
                                            <span className="text-xl font-bold text-brand-text">{chainMetrics.activeWallets.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-brand-muted font-bold uppercase block mb-1">Retention</span>
                                            <span className="text-xl font-bold text-brand-text">{chainMetrics.retentionRate.toFixed(1)}%</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <span className="text-xs text-brand-muted font-bold uppercase block mb-1">Followers</span>
                                            <span className="text-xl font-bold text-brand-text">{(socialMetrics?.totalFollowers || 0).toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-brand-muted font-bold uppercase block mb-1">Engagement</span>
                                            <span className="text-xl font-bold text-brand-success">{socialMetrics?.engagementRate.toFixed(1) || "0.0"}%</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => onNavigate('pulse')}
                        className="bg-brand-surface border border-brand-border text-brand-text px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-surfaceHighlight hover:border-brand-accent/30 transition-all flex items-center gap-3 shadow-sm group"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-error opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-error"></span>
                        </span>
                        Live Pulse
                        <svg className="w-4 h-4 text-brand-muted group-hover:text-brand-text transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    title="Defia Index"
                    value={`${displayScore}/10`}
                    subtext="Overall ecosystem health"
                    trend={indexScore > 5 ? "+0.3" : "-0.1"}
                    isPositive={indexScore > 5}
                />
                <StatCard
                    title="Total Audience"
                    value={(socialMetrics?.totalFollowers || 0).toLocaleString()}
                    subtext="Combined social following"
                    trend={socialMetrics?.comparison?.followersChange ? (socialMetrics.comparison.followersChange >= 0 ? "+" : "") + socialMetrics.comparison.followersChange : "0"}
                    isPositive={(socialMetrics?.comparison?.followersChange || 0) >= 0}
                />
                <StatCard
                    title="Engagement"
                    value={`${socialMetrics?.engagementRate.toFixed(2) || "0.00"}%`}
                    subtext="Average interaction rate"
                    trend={socialMetrics?.comparison?.engagementChange ? (socialMetrics.comparison.engagementChange >= 0 ? "+" : "") + socialMetrics.comparison.engagementChange.toFixed(1) + "%" : "0.0%"}
                    isPositive={(socialMetrics?.comparison?.engagementChange || 0) >= 0}
                />
                <StatCard
                    title="Active Campaigns"
                    value={strategyTasks.length || "0"}
                    subtext="Strategic initiatives"
                    trend="+1"
                    isPositive={true}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* DAILY MARKETING BRIEF */}
                <div className="lg:col-span-2 bg-brand-surface border border-brand-border rounded-2xl p-8 shadow-premium">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-brand-accent flex items-center justify-center ring-4 ring-indigo-50/50">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-brand-text font-display">Daily Brief</h3>
                                <p className="text-xs text-brand-muted font-medium uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>
                        <button className="text-xs font-bold text-brand-accent hover:text-brand-accentHover bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                            View Full Report
                        </button>
                    </div>

                    <div className="space-y-6">
                        {growthReport ? (
                            <div className="prose prose-sm max-w-none text-brand-textSecondary leading-relaxed font-sans">
                                <p>{growthReport.executiveSummary}</p>
                                <div className="p-4 bg-brand-bg rounded-xl border border-brand-border mt-4">
                                    <h4 className="text-xs font-bold text-brand-text uppercase mb-2">Tactical Priority</h4>
                                    <p className="text-sm">{growthReport.tacticalPlan}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">📝</div>
                                <p className="text-sm text-brand-muted font-medium">No Daily Brief available.</p>
                                <p className="text-xs text-brand-textSecondary">Connect data sources or wait for the next analysis cycle.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ACTIVITY FEED (New) */}
                <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-premium h-full">
                    <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider mb-6">System Activity</h3>
                    <div className="space-y-6 relative ml-2">
                        {/* Timeline Line */}
                        <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-brand-bg"></div>

                        {/* Recent Events */}
                        {systemLogs.length === 0 ? (
                            <div className="pl-6 pt-2 text-sm text-brand-muted italic">No recent system activity.</div>
                        ) : (
                            systemLogs.slice(0, 8).map((log, i) => (
                                <div key={i} className="relative pl-6">
                                    <div className={`absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-brand-surface ${i === 0 ? 'bg-brand-accent ring-2 ring-indigo-50' : 'bg-brand-border'}`}></div>
                                    <p className="text-xs text-brand-muted mb-0.5">{i === 0 ? 'Just now' : 'System Log'}</p>
                                    <p className="text-sm text-brand-text font-medium truncate">{log}</p>
                                </div>
                            ))
                        )}
                    </div>
                    <button className="w-full mt-6 py-2 text-xs font-bold text-brand-muted hover:text-brand-text border border-dashed border-brand-border rounded-lg hover:border-brand-muted transition-all">
                        View System Logs
                    </button>
                </div>
            </div>

            {/* SPACER for scrolling */}
            <div className="h-20"></div>
        </div>
    );
};
