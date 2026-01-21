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
    growthReport?: GrowthReport | null; // Keep optional
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
            await ingestTwitterHistory(['EnkiProtocol', 'NetswapOfficial']); // Shortened for demo
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

    return (
        <div className="w-full p-6 md:p-12 font-sans max-w-[1440px] mx-auto animate-fadeIn">

            {/* HEADER - Minimalist */}
            <div className="flex items-center justify-between mb-12">
                <div>
                    <h1 className="text-4xl font-semibold text-black tracking-tight">Mission Control</h1>
                    <p className="text-base text-gray-500 mt-2 font-medium">Overview for {brandName}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleIngestHistory}
                        className="px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        Sync Data
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                        {brandName.charAt(0)}
                    </div>
                </div>
            </div>

            {/* HERO SECTION - "Bento" Style Wide Card */}
            <BCard className="mb-8 relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-center gap-12">
                    <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse"></div>
                            <span className="text-xs font-bold text-black uppercase tracking-wide">System Operational</span>
                        </div>
                        <h2 className="text-2xl font-semibold text-black mb-2 tracking-tight">
                            {strategyTasks.length > 0
                                ? `Optimizing ${strategyTasks.length} active growth vectors.`
                                : "Standing by for strategic directive."}
                        </h2>
                        <p className="text-gray-500 leading-relaxed max-w-xl">
                            The system is monitoring {socialMetrics?.totalFollowers ? ((socialMetrics.totalFollowers / 1000).toFixed(1) + 'k') : '0'} audience members and real-time market signals to auto-adjust campaign parameters.
                        </p>
                    </div>

                    {/* KEY METRICS - Clean, Spacious */}
                    <div className="flex gap-16 border-t md:border-t-0 md:border-l border-gray-100 pt-8 md:pt-0 md:pl-16">
                        <StatParams
                            label="Total Audience"
                            value={(socialMetrics?.totalFollowers || 0).toLocaleString()}
                            sub={socialMetrics?.comparison?.followersChange ? `${socialMetrics.comparison.followersChange}% vs last week` : null}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUMN 1: INTELLIGENCE (2/3) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* DAILY BRIEF */}
                    <BCard className="h-full flex flex-col">
                        <div className="mb-8 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-semibold text-black mb-1">Daily Briefing</h3>
                                <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">
                                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            {/* AI Badge */}
                            <div className="px-3 py-1 rounded-full bg-gray-100 text-xs font-bold text-black border border-gray-200">
                                AI Generated
                            </div>
                        </div>

                        {growthReport ? (
                            <div className="space-y-8 flex-1">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Executive Summary</h4>
                                    <p className="text-black text-lg leading-relaxed font-medium">
                                        {growthReport.executiveSummary}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tactical Focus</h4>
                                        <p className="text-sm font-medium text-black leading-relaxed">
                                            {growthReport.tacticalPlan}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Strategic Moves</h4>
                                        <div className="space-y-3">
                                            {growthReport.strategicPlan?.slice(0, 3).map((item, i) => (
                                                <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                                                    <span className="text-sm font-medium text-black">{item.subject}</span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${item.action === 'KILL' ? 'bg-black text-white' : 'bg-gray-200 text-gray-800'
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
                            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center opacity-40">
                                <div className="w-16 h-16 rounded-full bg-gray-100 mb-4"></div>
                                <p className="font-medium text-black">No briefing generated.</p>
                                <button onClick={() => onNavigate('growth')} className="mt-2 text-sm font-bold text-blue-600 hover:underline">Generate Report</button>
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                            <button onClick={() => onNavigate('growth')} className="text-sm font-semibold text-black hover:text-gray-600 transition-colors">
                                View Full Intelligence Report →
                            </button>
                        </div>
                    </BCard>

                    {/* ACTIVE TASKS LIST */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-4">Active Directives</h3>
                        {strategyTasks.length > 0 ? (
                            strategyTasks.slice(0, 3).map(task => (
                                <div key={task.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-6 hover:shadow-md transition-shadow cursor-pointer">
                                    <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white font-bold text-lg shrink-0">
                                        {task.impactScore}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-lg font-semibold text-black mb-1">{task.title}</h4>
                                        <p className="text-sm text-gray-500 line-clamp-1">{task.description}</p>
                                    </div>
                                    <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-bold text-black hover:bg-gray-200">
                                        View
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400 italic">No active directives.</div>
                        )}
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

                        <div className="space-y-6">
                            {socialSignals && socialSignals.trendingTopics && socialSignals.trendingTopics.length > 0 ? (
                                socialSignals.trendingTopics.slice(0, 4).map((topic, i) => (
                                    <div key={i} onClick={() => onNavigate('pulse')} className="cursor-pointer group">
                                        <h4 className="font-semibold text-black mb-1 group-hover:text-blue-600 transition-colors">{topic.headline}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{topic.summary}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-xs text-gray-400">
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

                    {/* TERMINAL UI - Dark Mode Contrast */}
                    <div className="bg-black rounded-3xl p-8 shadow-2xl relative overflow-hidden h-[400px]">
                        <div className="absolute top-0 left-0 w-full h-8 bg-[#1a1a1a] flex items-center px-4 gap-2 border-b border-[#333]">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]"></div>
                            <span className="ml-2 text-[10px] text-gray-500 font-mono">system_log — zsh</span>
                        </div>

                        <div className="mt-6 font-mono text-[11px] leading-6 text-gray-400 h-full overflow-y-auto pb-8 scrollbar-hide">
                            {systemLogs.length === 0 ? (
                                <div className="opacity-50">
                                    <span className="text-green-500">➜</span> <span className="text-white">~</span> initializing core systems...<br />
                                    <span className="text-green-500">➜</span> <span className="text-white">~</span> connected to neural engine.<br />
                                    <span className="text-green-500">➜</span> <span className="text-white">~</span> awaiting input_
                                </div>
                            ) : (
                                systemLogs.map((log, i) => (
                                    <div key={i} className="flex gap-3">
                                        <span className="text-[#555] select-none">{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className="text-gray-300">
                                            {i === 0 ? <span className="text-white font-bold">{log}</span> : log}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
