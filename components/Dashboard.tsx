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
        const confirmed = window.confirm("Ingest full Twitter history? This ensures historical data accuracy.");
        if (!confirmed) return;
        try {
            alert("Starting deep ingestion...");
            const accounts = ['EnkiProtocol', 'NetswapOfficial', 'MetisL2', 'LazaNetwork'];
            await ingestTwitterHistory(accounts);
            alert(`Ingestion Complete.`);
        } catch (e) {
            console.error(e);
            alert("Ingestion Failed. Check console.");
        }
    };

    const StatCard = ({ title, value, subtext, trend, isPositive }: any) => (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 group relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">{title}</h3>
                {trend && (
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                        <span>{isPositive ? '↑' : '↓'}</span>
                        {trend}
                    </div>
                )}
            </div>
            <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold text-gray-900 tracking-tight">{value}</span>
            </div>
            <p className="text-xs text-gray-500 font-medium">{subtext}</p>
        </div>
    );

    return (
        <div className="w-full p-8 font-sans max-w-[1600px] mx-auto animate-fadeIn text-slate-800">
            {/* HERADER */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Mission Control</h1>
                    <p className="text-sm text-gray-500 mt-1">Real-time overview of {brandName}'s ecosystem.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleIngestHistory} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                        Resync Data
                    </button>
                    <div className="h-4 w-px bg-gray-200 mx-1"></div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">v2.4.0</span>
                </div>
            </div>

            {/* MAIN HERO CARD */}
            <div className="mb-8 bg-white border border-gray-100 rounded-2xl p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-50/50 to-transparent rounded-bl-full pointer-events-none opacity-60"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-gray-900 text-white shadow-xl shadow-indigo-500/10 flex items-center justify-center text-3xl font-bold font-display">
                            {brandName.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{brandName}</h1>
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    System Active
                                </span>
                            </div>
                            <p className="text-gray-500 text-sm max-w-lg leading-relaxed">
                                {strategyTasks.length > 0
                                    ? `Growth logic is currently optimizing for ${strategyTasks.length} active vectors.`
                                    : "System is in standby mode. Awaiting strategic directive."}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-12 md:border-l md:border-gray-100 md:pl-12">
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Total Audience</span>
                            <span className="text-2xl font-bold text-gray-900 block">{(socialMetrics?.totalFollowers || 0).toLocaleString()}</span>
                            {socialMetrics?.comparison?.followersChange !== undefined && (
                                <span className={`text-xs font-bold ${socialMetrics.comparison.followersChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {socialMetrics.comparison.followersChange >= 0 ? '+' : ''}{socialMetrics.comparison.followersChange}%
                                </span>
                            )}
                        </div>
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Engagement</span>
                            <span className="text-2xl font-bold text-gray-900 block">{socialMetrics?.engagementRate.toFixed(2) || "0.00"}%</span>
                            {socialMetrics?.comparison?.engagementChange !== undefined && (
                                <span className={`text-xs font-bold ${socialMetrics.comparison.engagementChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {socialMetrics.comparison.engagementChange >= 0 ? '+' : ''}{socialMetrics.comparison.engagementChange}%
                                </span>
                            )}
                        </div>
                        <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Health Score</span>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-gray-900">{displayScore}</span>
                                <span className="text-sm text-gray-400">/10</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN: STRATEGY & ACTIONS (2/3) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* DAILY BRIEF CARD */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-0 shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Daily Strategy Brief</h3>
                                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">
                                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100">
                                AI Generated
                            </span>
                        </div>

                        <div className="p-8">
                            {growthReport ? (
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Executive Summary</h4>
                                        <p className="text-gray-700 leading-relaxed text-sm bg-gray-50 p-5 rounded-xl border border-gray-100">
                                            {growthReport.executiveSummary}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tactical Priority</h4>
                                            <div className="p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-xl">
                                                <p className="text-sm text-gray-800 font-medium">{growthReport.tacticalPlan}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Strategic Moves</h4>
                                            <div className="space-y-2">
                                                {growthReport.strategicPlan?.slice(0, 2).map((item, i) => (
                                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-white shadow-sm">
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${item.action === 'KILL' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                                                            }`}>{item.action.replace('_', ' ')}</span>
                                                        <span className="text-xs text-gray-700 truncate font-medium">{item.subject}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-12 text-center">
                                    <p className="text-sm text-gray-500 italic">No analysis generated yet today.</p>
                                    <button onClick={() => onNavigate('growth')} className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-800">Generate Report →</button>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-50 bg-gray-50/30 text-center">
                            <button onClick={() => onNavigate('growth')} className="text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors">View Detailed Analysis</button>
                        </div>
                    </div>

                    {/* ACTIVE TASKS LIST */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Directives ({strategyTasks.length})</h3>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                            {strategyTasks.length > 0 ? (
                                strategyTasks.slice(0, 4).map((task, i) => (
                                    <div key={task.id} className={`p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors cursor-pointer border-gray-100 ${i !== strategyTasks.length - 1 ? 'border-b' : ''}`}>
                                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${task.type === 'CAMPAIGN_IDEA' ? 'bg-indigo-500' : 'bg-blue-500'}`}></div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="text-sm font-bold text-gray-900">{task.title}</h4>
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wide">{task.type.replace('_', ' ')}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-sm text-gray-400 italic">No active tasks.</div>
                            )}
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: SIDEBAR CONTENT (1/3) */}
                <div className="space-y-8">

                    {/* LIVE PULSE WIDGET */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live Market Signals</h3>
                            <button onClick={() => onNavigate('pulse')} className="text-red-500 text-xs font-bold hover:text-red-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                Live
                            </button>
                        </div>
                        {/* Dynamic Signal Data (No Fake Data) */}
                        <div className="space-y-4">
                            {socialSignals && socialSignals.trendingTopics && socialSignals.trendingTopics.length > 0 ? (
                                socialSignals.trendingTopics.slice(0, 3).map((topic, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-xs">⚡</div>
                                        <div className="flex-1">
                                            <h4 className="text-xs font-bold text-gray-900 truncate">{topic.headline || "Trend"}</h4>
                                            <div className="h-1.5 w-full bg-gray-50 rounded mt-1 overflow-hidden">
                                                <div className="h-full bg-red-400 rounded" style={{ width: '60%' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-xs text-gray-400 italic border border-dashed border-gray-100 rounded-xl">
                                    No live signals detected.
                                </div>
                            )}
                        </div>
                        <button onClick={() => onNavigate('pulse')} className="mt-6 w-full py-2.5 border border-dashed border-gray-200 text-xs font-bold text-gray-500 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all">
                            Open Signal Feed
                        </button>
                    </div>

                    {/* SYSTEM LOGS */}
                    <div className="bg-gray-900 text-gray-300 rounded-2xl p-6 shadow-lg h-96 overflow-hidden flex flex-col">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">System Terminal</h3>
                        <div className="flex-1 overflow-y-auto space-y-3 font-mono text-[10px] leading-relaxed scrollbar-hide">
                            {systemLogs.length === 0 ? (
                                <span className="text-gray-600 italic">Connected. Waiting for output...</span>
                            ) : (
                                systemLogs.map((log, i) => (
                                    <div key={i} className="flex gap-3">
                                        <span className="text-gray-600 shrink-0">{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className={i === 0 ? "text-emerald-400 font-bold" : "text-gray-400"}>
                                            {i === 0 && <span className="mr-2">›</span>}
                                            {log}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>

            <div className="h-24"></div>
        </div>
    );
};
