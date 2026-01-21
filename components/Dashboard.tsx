import React, { useMemo } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals } from '../types';
import { calculateDefiaScore } from '../services/scoring';
import { ingestTwitterHistory } from '../services/ingestion';

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
    socialSignals,
    systemLogs = [],
    growthReport,
    onNavigate
}) => {
    // --- Data Calculation ---
    const { total: indexScore } = useMemo(() => {
        return calculateDefiaScore(socialMetrics, chainMetrics, strategyTasks);
    }, [socialMetrics, chainMetrics, strategyTasks]);

    const displayScore = (indexScore / 10).toFixed(1);

    const handleIngestHistory = async () => {
        const confirmed = window.confirm("Sync latest data?");
        if (!confirmed) return;
        try {
            await ingestTwitterHistory(['EnkiProtocol', 'NetswapOfficial']);
            alert(`Sync started.`);
        } catch (e) {
            console.error(e);
        }
    };

    // APPLE STYLE CARD
    const BCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
        <div className={`bg-white rounded-3xl p-8 shadow-sm border border-gray-100/50 ${className}`}>
            {children}
        </div>
    );

    const StatParams = ({ label, value, sub }: any) => (
        <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{label}</span>
            <span className="text-3xl font-semibold text-black tracking-tight mb-1">{value}</span>
            {sub && <span className="text-xs text-gray-500 font-medium">{sub}</span>}
        </div>
    );

    const activeEvents = calendarEvents
        .filter(e => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 4);

    return (
        <div className="w-full p-6 md:p-10 font-sans mx-auto animate-fadeIn max-w-[2400px]">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-8 pl-2">
                <div>
                    <h1 className="text-3xl font-semibold text-black tracking-tight">Mission Control</h1>
                    <p className="text-sm text-gray-500 mt-1 font-medium">Overview for {brandName}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleIngestHistory}
                        className="px-5 py-2.5 bg-black text-white text-xs font-bold rounded-full hover:bg-gray-800 transition-colors shadow-sm uppercase tracking-wider"
                    >
                        Sync Data
                    </button>
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 border border-gray-200">
                        {brandName.charAt(0)}
                    </div>
                </div>
            </div>

            {/* HERO SECTION - "Bento" Style Wide Card */}
            <BCard className="mb-8 relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-center gap-12">
                    <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse"></div>
                            <span className="text-[10px] font-bold text-black uppercase tracking-widest">System Operational</span>
                        </div>
                        <h2 className="text-3xl font-semibold text-black mb-3 tracking-tight leading-loose">
                            {strategyTasks.length > 0
                                ? `Optimizing ${strategyTasks.length} active growth vectors.`
                                : "Standing by for strategic directive."}
                        </h2>
                        <p className="text-gray-500 font-medium leading-relaxed max-w-xl text-sm">
                            The system is monitoring {socialMetrics?.totalFollowers ? ((socialMetrics.totalFollowers / 1000).toFixed(1) + 'k') : '0'} audience members and real-time market signals to auto-adjust campaign parameters.
                        </p>
                    </div>

                    {/* KEY METRICS - Clean, Spacious */}
                    <div className="flex gap-16 border-t md:border-t-0 md:border-l border-gray-100 pt-8 md:pt-0 md:pl-16">
                        <StatParams
                            label="Total Audience"
                            value={(socialMetrics?.totalFollowers || 0).toLocaleString()}
                            sub={socialMetrics?.comparison?.followersChange ? `${socialMetrics.comparison.followersChange >= 0 ? '+' : ''}${socialMetrics.comparison.followersChange}% vs last week` : null}
                        />
                        <StatParams
                            label="Engagement"
                            value={`${socialMetrics?.engagementRate.toFixed(2) || "0.00"}%`}
                            sub="Average interaction"
                        />
                        <StatParams
                            label="Health Index"
                            value={displayScore}
                            sub={`/10.0`}
                        />
                    </div>
                </div>
            </BCard>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* COLUMN 1: INTELLIGENCE & CONTENT (2/3) */}
                <div className="xl:col-span-2 space-y-8">

                    {/* DAILY BRIEF */}
                    <BCard>
                        <div className="mb-6 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-black">Daily Briefing</h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-gray-100 text-[10px] font-bold text-black border border-gray-200 uppercase tracking-wide">
                                AI Generated
                            </div>
                        </div>

                        {growthReport ? (
                            <div className="space-y-8">
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Executive Summary</h4>
                                    <p className="text-black text-base leading-relaxed font-medium">
                                        {growthReport.executiveSummary}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tactical Focus</h4>
                                        <p className="text-sm font-medium text-black leading-relaxed">
                                            {growthReport.tacticalPlan}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Strategic Moves</h4>
                                        <div className="space-y-3">
                                            {growthReport.strategicPlan?.slice(0, 3).map((item, i) => (
                                                <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 px-1">
                                                    <span className="text-sm font-medium text-black">{item.subject}</span>
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${item.action === 'KILL' ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'
                                                        }`}>
                                                        {item.action === 'DOUBLE_DOWN' ? 'Boost' : item.action}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                                <div className="w-12 h-12 rounded-full bg-gray-100 mb-4 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <p className="font-medium text-black text-sm">No briefing generated today.</p>
                                <button onClick={() => onNavigate('growth')} className="mt-2 text-xs font-bold text-black border-b border-black hover:opacity-70">Generate Report</button>
                            </div>
                        )}
                    </BCard>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* CONTENT CALENDAR */}
                        <BCard>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Upcoming Content</h3>
                                <button className="text-xs font-bold text-black hover:opacity-70">View Calendar →</button>
                            </div>
                            <div className="space-y-4">
                                {activeEvents.length > 0 ? (
                                    activeEvents.map((event, i) => (
                                        <div key={i} className="flex gap-4 group cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-xl transition-colors">
                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex flex-col items-center justify-center border border-gray-200 shrink-0">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">{new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                                                <span className="text-sm font-bold text-black">{new Date(event.date).getDate()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-black truncate">{event.content || "Draft Content"}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                    <p className="text-xs text-gray-500 font-medium">{event.platform}</p>
                                                    {event.campaignName && (
                                                        <>
                                                            <span className="text-gray-300">•</span>
                                                            <p className="text-xs text-gray-400 line-clamp-1">{event.campaignName}</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-8 text-center text-xs text-gray-400 italic">No content scheduled.</div>
                                )}
                            </div>
                        </BCard>

                        {/* GROWTH ANALYTICS */}
                        <BCard>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Growth Analytics</h3>
                                <button onClick={() => onNavigate('analytics')} className="text-xs font-bold text-black hover:opacity-70">Full Report →</button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Net New Wallets</span>
                                    <span className="text-xl font-bold text-black">{chainMetrics?.netNewWallets ? `+${chainMetrics.netNewWallets}` : '0'}</span>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Retention</span>
                                    <span className="text-xl font-bold text-black">{chainMetrics?.retentionRate ? `${chainMetrics.retentionRate}%` : '0%'}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs font-medium">
                                    <span className="text-gray-500">Twitter Growth</span>
                                    <span className="text-green-600 font-bold">+12%</span>
                                </div>
                                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-black h-full w-[12%] rounded-full"></div>
                                </div>
                                <div className="flex justify-between items-center text-xs font-medium mt-2">
                                    <span className="text-gray-500">On-Chain Volume</span>
                                    <span className="text-gray-400 font-bold">0%</span>
                                </div>
                                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-gray-300 h-full w-[2%] rounded-full"></div>
                                </div>
                            </div>
                        </BCard>
                    </div>
                </div>

                {/* COLUMN 2: SIDEBAR (1/3) */}
                <div className="space-y-8">

                    {/* LIVE SIGNALS */}
                    <BCard>
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Live Signals</span>
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {socialSignals && socialSignals.trendingTopics && socialSignals.trendingTopics.length > 0 ? (
                                socialSignals.trendingTopics.slice(0, 4).map((topic, i) => (
                                    <div key={i} onClick={() => onNavigate('pulse')} className="cursor-pointer group hover:bg-gray-50 p-3 -mx-3 rounded-xl transition-colors">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Market</span>
                                            <span className="text-[10px] text-gray-300">{new Date(topic.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <h4 className="font-semibold text-black mb-1 group-hover:text-blue-600 transition-colors text-sm">{topic.headline}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{topic.summary}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center">
                                    <svg className="w-6 h-6 text-gray-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Scanning market data...
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => onNavigate('pulse')}
                            className="w-full mt-6 py-3 bg-gray-50 rounded-xl text-xs font-bold text-black hover:bg-gray-100 transition-colors border border-gray-100"
                        >
                            Open Signal Monitor
                        </button>
                    </BCard>

                    {/* TERMINAL UI */}
                    <div className="bg-black rounded-3xl p-6 shadow-2xl relative overflow-hidden h-[340px] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]"></div>
                            </div>
                            <span className="text-[10px] text-gray-600 font-mono">zsh — 80x24</span>
                        </div>

                        <div className="flex-1 font-mono text-[10px] leading-5 text-gray-400 overflow-y-auto pb-4 scrollbar-hide">
                            {systemLogs.length === 0 ? (
                                <div className="opacity-50">
                                    <span className="text-green-500">➜</span> <span className="text-white">~</span> initializing core systems...<br />
                                    <span className="text-green-500">➜</span> <span className="text-white">~</span> connected to neural engine.<br />
                                    <span className="text-green-500">➜</span> <span className="text-white">~</span> awaiting input_
                                </div>
                            ) : (
                                systemLogs.map((log, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="text-[#444] select-none shrink-0">{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-gray-300">
                                            {i === 0 ? <span className="text-white font-bold">{log}</span> : log}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ACTIVE TASKS MINI */}
                    {strategyTasks.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 pl-2">Active Directives</h3>
                            <div className="space-y-3">
                                {strategyTasks.slice(0, 3).map(task => (
                                    <div key={task.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="text-sm font-bold text-black">{task.title}</h4>
                                                <span className="text-[10px] font-bold text-white bg-black px-1.5 py-0.5 rounded">{task.impactScore}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
