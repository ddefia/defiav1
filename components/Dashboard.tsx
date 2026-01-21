import React, { useMemo } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals } from '../types';
import { calculateDefiaScore } from '../services/scoring';
import { ingestTwitterHistory } from '../services/ingestion'; // Correct Import Placement

interface DashboardProps {
    brandName: string;
    brandConfig: BrandConfig;
    calendarEvents: CalendarEvent[];
    socialMetrics: SocialMetrics | null;
    strategyTasks: StrategyTask[];
    chainMetrics: ComputedMetrics | null;
    socialSignals: SocialSignals;
    systemLogs: string[];
    growthReport?: GrowthReport | null;
    onNavigate: (section: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
    brandName,
    calendarEvents,
    socialMetrics,
    strategyTasks,
    chainMetrics,
    systemLogs = [],
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

    const handleIngestHistory = async () => {
        const confirmed = window.confirm("Ingest full Twitter history for Enki, Netswap, Metis, Laza? This may take 30s.");
        if (!confirmed) return;

        try {
            alert("Starting Ingestion... check console for progress.");
            const accounts = ['EnkiProtocol', 'NetswapOfficial', 'MetisL2', 'LazaNetwork'];
            const results = await ingestTwitterHistory(accounts);
            console.log("Ingestion Results:", results);
            alert(`Ingestion Complete! Scanned ${results.length} accounts.`);
        } catch (e) {
            console.error(e);
            alert("Ingestion Failed.");
        }
    };

    const TopBar = () => (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-2xl font-display font-bold text-brand-text tracking-tight">Dashboard</h1>
                <p className="text-sm text-brand-textSecondary">Overview of your brand's performance</p>
            </div>
            <div className="flex items-center gap-4">
                {/* Ingest Button */}
                <button
                    onClick={handleIngestHistory}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    Ingest History
                </button>

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

                    <div className="flex gap-3">
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
                <div onClick={() => onNavigate('growth')} className="cursor-pointer">
                    <StatCard
                        title="Active Campaigns"
                        value={strategyTasks.length || "0"}
                        subtext="Strategic initiatives"
                        trend="+1"
                        isPositive={true}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* DAILY MARKETING BRIEF */}
                {/* DAILY MARKETING BRIEF & CONTENT SCHEDULE */}
                <div className="lg:col-span-2 space-y-6">
                    {/* 1. DATA-DRIVEN STRATEGIC BRIEF */}
                    <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 shadow-premium relative overflow-hidden">
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-brand-text font-display">Daily Strategy Brief</h3>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs text-brand-muted font-medium uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                            <span className="w-1 h-1 rounded-full bg-brand-border"></span>
                                            <span className="text-xs text-brand-accent font-bold">AI Generated 5m ago</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onNavigate('growth')}
                                    className="text-xs font-bold text-brand-accent hover:text-brand-accentHover bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors border border-indigo-100"
                                >
                                    View Full Analysis
                                </button>
                            </div>

                            <div className="space-y-8">
                                {growthReport ? (
                                    <>
                                        {/* Executive Summary */}
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Executive Summary
                                            </h4>
                                            <p className="text-brand-textSecondary leading-relaxed text-sm bg-brand-bg/50 p-4 rounded-xl border border-brand-border/50">
                                                {growthReport.executiveSummary}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Tactical Plan */}
                                            <div>
                                                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                    Priority Action
                                                </h4>
                                                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 h-full">
                                                    <p className="text-sm text-brand-text font-medium">{growthReport.tacticalPlan}</p>
                                                </div>
                                            </div>

                                            {/* Strategic Directives */}
                                            <div>
                                                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                                    Strategic Moves
                                                </h4>
                                                <div className="space-y-2">
                                                    {growthReport.strategicPlan?.slice(0, 2).map((item, i) => (
                                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-brand-border bg-brand-surface">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.action === 'KILL' ? 'bg-red-100 text-red-700' :
                                                                item.action === 'DOUBLE_DOWN' ? 'bg-green-100 text-green-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                                }`}>{item.action.replace('_', ' ')}</span>
                                                            <span className="text-xs text-brand-text truncate">{item.subject}</span>
                                                        </div>
                                                    ))}
                                                    {!growthReport.strategicPlan?.length && (
                                                        <div className="text-xs text-brand-muted italic p-2">No strategic directives generated.</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : strategyTasks.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                Current Strategic Focus
                                            </h4>
                                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold">{strategyTasks.length} Active Goals</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            {strategyTasks.slice(0, 3).map(task => (
                                                <div key={task.id} className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl hover:bg-indigo-50/60 transition-colors">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h5 className="text-sm font-bold text-brand-text">{task.title}</h5>
                                                        <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">{task.type.replace('_', ' ')}</span>
                                                    </div>
                                                    <p className="text-xs text-brand-textSecondary line-clamp-2">{task.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-center pt-2">
                                            <button onClick={() => onNavigate('growth')} className="text-xs text-brand-accent hover:underline">View All Strategies</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">📝</div>
                                        <p className="text-sm text-brand-muted font-medium">No active strategy.</p>
                                        <p className="text-xs text-brand-textSecondary">Use the Growth Engine to generate a plan.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. UPCOMING SCHEDULED CONTENT */}
                    <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-premium">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-brand-muted uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Upcoming Content
                            </h3>
                            <button className="text-xs font-bold text-brand-textSecondary hover:text-brand-text flex items-center gap-1 transition-colors">
                                View Calendar
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>

                        <div className="space-y-3">
                            {calendarEvents.filter(e => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                .slice(0, 3)
                                .map((event) => (
                                    <div key={event.id} className="flex gap-4 p-3 rounded-xl border border-brand-border bg-brand-bg/30 hover:bg-brand-bg/60 transition-colors group">
                                        <div className="w-16 h-16 rounded-lg bg-brand-surface border border-brand-border overflow-hidden flex-shrink-0 relative">
                                            {event.image ? (
                                                <img src={event.image} alt="Content" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                            )}
                                            <div className="absolute top-1 right-1">
                                                {event.platform === 'Twitter' && <div className="w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center text-white text-[8px]"><svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg></div>}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 py-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-xs font-bold text-brand-muted uppercase tracking-wide">
                                                    {new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                                                </p>
                                                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">Scheduled</span>
                                            </div>
                                            <p className="text-sm text-brand-text font-medium truncate group-hover:text-brand-accent transition-colors">
                                                {event.content || "No content preview"}
                                            </p>
                                            <p className="text-xs text-brand-textSecondary mt-1">
                                                {event.campaignName ? `Campaign: ${event.campaignName}` : "General Content"}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            {calendarEvents.filter(e => new Date(e.date) >= new Date()).length === 0 && (
                                <div className="text-center py-8 text-brand-muted text-sm border-2 border-dashed border-brand-border rounded-xl">
                                    No upcoming content scheduled.
                                </div>
                            )}
                        </div>
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
