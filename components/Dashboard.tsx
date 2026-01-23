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
        <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100/50 ${className}`}>
            {children}
        </div>
    );

    const StatParams = ({ label, value, sub }: any) => (
        <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{label}</span>
            <span className="text-2xl font-semibold text-black tracking-tight mb-1">{value}</span>
            {sub && <span className="text-[11px] text-gray-500 font-medium">{sub}</span>}
        </div>
    );

    const activeEvents = calendarEvents
        .filter(e => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 4);

    return (
        <div className="w-full p-6 font-sans mx-auto animate-fadeIn max-w-[1920px]">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-8 pl-1">
                <div>
                    <h1 className="text-2xl font-semibold text-black tracking-tight">Mission Control</h1>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Overview for {brandName}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleIngestHistory}
                        className="px-4 py-2 bg-black text-white text-[10px] font-bold rounded-full hover:bg-gray-800 transition-colors shadow-sm uppercase tracking-wider"
                    >
                        Sync Data
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-200">
                        {brandName.charAt(0)}
                    </div>
                </div>
            </div>

            {/* 1. COMMUNITY PULSE HERO (Telegram/Discord/Twitter Focus) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <BCard className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-white to-gray-50">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Community Pulse</h3>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Sentiment: Bullish</span>
                    </div>

                    <div className="grid grid-cols-3 gap-8">
                        {/* Twitter */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Twitter</span>
                            </div>
                            <div className="text-2xl font-bold text-black mb-1">
                                {(socialMetrics?.totalFollowers || 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-green-600 font-bold bg-green-50 inline-block px-1.5 rounded">
                                {socialMetrics?.comparison?.followersChange ? `+${socialMetrics.comparison.followersChange}%` : '--'}
                            </div>
                        </div>

                        {/* Telegram (Mock for 'Visual' request) */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Telegram</span>
                            </div>
                            <div className="text-2xl font-bold text-black mb-1">
                                4,210
                            </div>
                            <div className="text-[10px] text-green-600 font-bold bg-green-50 inline-block px-1.5 rounded">
                                +12 Active
                            </div>
                        </div>

                        {/* Discord */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Discord</span>
                            </div>
                            <div className="text-2xl font-bold text-black mb-1">
                                8,903
                            </div>
                            <div className="text-[10px] text-gray-400 font-bold bg-gray-50 inline-block px-1.5 rounded">
                                Stable
                            </div>
                        </div>
                    </div>
                </BCard>

                {/* HEALTH SCORE */}
                <BCard className="flex flex-col justify-center items-center text-center">
                    <div className="w-20 h-20 rounded-full border-4 border-black flex items-center justify-center mb-4">
                        <span className="text-2xl font-bold text-black">{displayScore}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Defia Health Score</span>
                    <p className="text-[10px] text-gray-400 mt-2 max-w-[150px]">Based on engagement, growth, and on-chain velocity.</p>
                </BCard>
            </div>

            {/* 2. MAIN WORKSPACE */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">

                {/* LEFT: DAILY BRIEFING (Compact) */}
                <div className="xl:col-span-2">
                    <BCard className="h-full">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Daily Intelligence</h3>
                            <span className="text-[10px] text-gray-400 font-medium">
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </span>
                        </div>

                        {growthReport ? (
                            <div className="flex flex-col gap-6">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Executive Summary</h4>
                                    <p className="text-sm font-medium text-black leading-relaxed">
                                        {growthReport.executiveSummary}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Tactical Focus</h4>
                                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                            {growthReport.tacticalPlan}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Key Strategic Moves</h4>
                                        <ul className="space-y-2">
                                            {growthReport.strategicPlan?.slice(0, 3).map((item, i) => (
                                                <li key={i} className="flex items-center gap-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${item.action === 'KILL' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                                    <span className="text-xs text-black font-medium">{item.subject}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center text-xs text-gray-400">Initializing Intelligence Stream...</div>
                        )}
                    </BCard>
                </div>

                {/* RIGHT: PRIORITY ACTIONS (The "Work" list) */}
                <div className="xl:col-span-1">
                    <BCard className="h-full bg-gray-900 text-white border-gray-800">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Priority Actions</h3>
                            <div className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[9px] font-bold uppercase">
                                Live
                            </div>
                        </div>

                        <div className="space-y-3">
                            {[
                                ...strategyTasks.map(t => ({ ...t, kind: 'STRATEGY' })),
                                ...socialSignals.trendingTopics?.map(t => ({ ...t, kind: 'SIGNAL' })) || []
                            ]
                                .slice(0, 6)
                                .map((item: any, i) => (
                                    <div
                                        key={i}
                                        onClick={() => onNavigate(item.kind === 'STRATEGY' ? 'growth' : 'pulse')}
                                        className="cursor-pointer group p-3 rounded-lg hover:bg-white/5 transition-colors border border-white/5 hover:border-white/10"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[9px] font-bold uppercase tracking-wider ${item.kind === 'STRATEGY' ? 'text-blue-400' : 'text-purple-400'}`}>
                                                {item.kind === 'STRATEGY' ? 'Strategy' : 'Signal'}
                                            </span>
                                        </div>
                                        <h4 className="font-medium text-white text-xs mb-0.5 truncate">{item.title || item.headline}</h4>
                                        <p className="text-[10px] text-gray-400 line-clamp-1">{item.description || item.summary}</p>
                                    </div>
                                ))}
                            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]"></div>
                        </div>

                    </BCard>
                </div>

                {/* ACTIVE TASKS MINI */}
                {
                    strategyTasks.length > 0 && (
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
                    )
                }
            </div>
        </div>
    );
};
