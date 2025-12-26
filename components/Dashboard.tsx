import React, { useMemo } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics } from '../types';
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
    onNavigate: (section: 'studio' | 'growth' | 'pulse' | 'calendar' | 'dashboard') => void;
    onQuickAction: (action: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
    brandName,
    calendarEvents,
    socialMetrics,
    strategyTasks,
    chainMetrics,
    systemLogs = [],
    isServerOnline = false,
    onNavigate
}) => {
    // --- Data Processing ---

    // 1. Defia Index Calculation (Real Weighted Algo)
    const { total: indexScore, grade: indexGrade, breakdown, insights: scoreInsights } = useMemo(() => {
        return calculateDefiaScore(socialMetrics, chainMetrics, strategyTasks);
    }, [socialMetrics, chainMetrics, strategyTasks]);

    // Format for display (0-10 scale)
    const displayScore = (indexScore / 10).toFixed(1);

    // 2. Audience & Growth
    const totalAudience = socialMetrics?.totalFollowers
        ? (socialMetrics.totalFollowers > 1000 ? `${(socialMetrics.totalFollowers / 1000).toFixed(1)}K` : socialMetrics.totalFollowers.toString())
        : '0';

    const rawEngagement = socialMetrics?.engagementRate ? socialMetrics.engagementRate.toFixed(2) : '0.00';

    // 3. Daily Brief Item (Top Priority Task or Fallback)
    const dailyFeature = useMemo(() => {
        // Try high impact first, then any task
        return strategyTasks.find(t => t.impactScore >= 8) || strategyTasks[0] || null;
    }, [strategyTasks]);

    // 4. Upcoming One (Next Event)
    const nextEvent = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const upcoming = calendarEvents
            .filter(e => e.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date));
        return upcoming[0] || null;
    }, [calendarEvents]);


    // --- UI Sub-Components ---

    const StatCard = ({ label, value, subtext, trend, trendUp }: { label: string, value: string, subtext: string, trend?: string, trendUp?: boolean }) => (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                {trend && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {trendUp ? '↗' : '↘'} {trend}
                    </span>
                )}
            </div>
            <div className="text-3xl font-display font-bold text-gray-900 mb-1 tracking-tight">{value}</div>
            <div className="text-xs text-gray-400">{subtext}</div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-10 animate-fadeIn font-sans text-gray-900">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-100 pb-6 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg font-display">
                            {brandName.charAt(0)}
                        </div>
                        <h1 className="text-3xl font-display font-bold tracking-tight">{brandName} Dashboard</h1>
                    </div>
                    <p className="text-gray-400 text-sm pl-[52px]">AI-powered analytics and growth intelligence platform</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                    </button>
                    <button onClick={() => onNavigate('pulse')} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">
                        View Pulse Signals
                    </button>
                </div>
            </div>

            {/* KEY METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Defia Index"
                    value={`${displayScore}/10`}
                    subtext={`${indexGrade} Tier • ${scoreInsights[0] || 'Optimized'}`}
                    trend={socialMetrics?.isLive ? "Verified" : "Simulated"}
                    trendUp={!!socialMetrics?.isLive}
                />
                <StatCard
                    label="Total Audience"
                    value={totalAudience}
                    subtext="Combined social reach"
                    trend="+12.4%"
                    trendUp={true}
                />
                <StatCard
                    label="Engagement Rate"
                    value={`${rawEngagement}%`}
                    subtext="Active community interaction"
                    trend="-2.1%"
                    trendUp={false}
                />
                <StatCard
                    label="Weekly Growth"
                    value="+5.7%"
                    subtext="Total value locked relative growth"
                    trend="+1.2%"
                    trendUp={true}
                />
            </div>

            {/* DAILY BRIEF & ACTIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* DAILY MARKETING BRIEF (Featured) */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                        </span>
                        Daily Marketing Brief
                    </h2>

                    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm h-full flex flex-col justify-between relative overflow-hidden">
                        {/* Decorative Background Element */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-transparent rounded-bl-full opacity-50 -z-10"></div>

                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase mb-6 tracking-widest flex items-center gap-2">
                                <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span className={`flex items-center gap-2 ${isServerOnline ? 'text-green-600' : 'text-gray-400'}`}>
                                    <span className={`w-2 h-2 rounded-full ${isServerOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                    {isServerOnline ? "Live Monitoring Active" : "Offline"}
                                </span>
                            </div>

                            {/* --- AGENT PROPOSAL CARD --- */}
                            {systemLogs.some(l => l.includes('ACTION REQUIRED')) && (
                                <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100 shadow-sm animate-fadeIn">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            <div className="bg-white p-2 rounded-lg text-xl shadow-sm">⚡</div>
                                            <div>
                                                <h4 className="font-bold text-gray-900">Agent Proposal</h4>
                                                <p className="text-xs text-gray-500">The autonomous agent suggests a response.</p>
                                            </div>
                                        </div>
                                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded">PENDING APPROVAL</span>
                                    </div>

                                    <div className="mt-3 bg-white p-3 rounded-lg border border-indigo-100 text-sm italic text-gray-600">
                                        "Exciting times ahead! We are definitely tracking the volume spike correctly..."
                                    </div>

                                    <div className="flex justify-end gap-2 mt-3">
                                        <button className="text-xs text-gray-400 font-bold hover:text-gray-600 px-3 py-1.5">Dismiss</button>
                                        <button className="text-xs bg-indigo-600 text-white font-bold px-4 py-1.5 rounded-md hover:bg-indigo-700 shadow-sm">Approve & Post</button>
                                    </div>
                                </div>
                            )}

                            {dailyFeature ? (
                                <div className="space-y-6 animate-fadeIn">
                                    <h3 className="text-2xl font-display font-medium leading-tight text-gray-900">
                                        {dailyFeature.title}
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                                        {dailyFeature.description}
                                    </p>
                                    <div className="p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-4 items-start">
                                        <div className="bg-white p-2 rounded-lg shadow-sm text-indigo-600 mt-1 shrink-0">
                                            {dailyFeature.type === 'TREND_JACK' ? '📉' :
                                                dailyFeature.type === 'REPLY' ? '💬' :
                                                    dailyFeature.type === 'GAP_FILL' ? '🗓️' : '🧠'}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wide text-[10px] mb-1">
                                                Based on {dailyFeature.type === 'TREND_JACK' ? 'Real-Time Market News' :
                                                    dailyFeature.type === 'REPLY' ? 'Community Sentiment' :
                                                        dailyFeature.type === 'GAP_FILL' ? 'Schedule Analysis' : 'Strategic Growth Data'}
                                            </h4>
                                            <p className="text-sm text-indigo-800 leading-relaxed font-medium">"{dailyFeature.reasoning}"</p>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <button
                                            onClick={() => onNavigate('growth')}
                                            className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg shadow-gray-200 cursor-pointer flex items-center gap-2"
                                        >
                                            Execute Action Plan <span className="text-gray-400">→</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-2 animate-fadeIn">
                                    {/* TERMINAL UI FOR LOGS */}
                                    <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 h-48 overflow-y-auto border border-gray-800 shadow-inner">
                                        <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
                                            <span className="text-gray-500">System Logs</span>
                                            <span className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div><div className="w-2 h-2 rounded-full bg-yellow-500"></div><div className="w-2 h-2 rounded-full bg-green-500"></div></span>
                                        </div>
                                        <div className="space-y-1">
                                            {systemLogs.length > 0 ? systemLogs.map((log, i) => (
                                                <div key={i} className="opacity-80">{'>'} {log}</div>
                                            )) : (
                                                <>
                                                    <div className="opacity-50">{'>'} Initializing Sentinel...</div>
                                                    <div className="opacity-50">{'>'} Checking for recent tasks...</div>
                                                    <div className="opacity-50">{'>'} Status: SCANNING</div>
                                                </>
                                            )}
                                            <div className="animate-pulse">{'>'} _</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-center">
                                        <p className="text-gray-500 text-sm mb-2">Analyzing market conditions...</p>
                                        <button
                                            onClick={() => onNavigate('growth')}
                                            className="text-indigo-600 text-xs font-bold hover:underline"
                                        >
                                            Generating Recommendations in Strategy Hub &rarr;
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* SIDEBAR: UPCOMING & TRENDS */}
                <div className="space-y-8">

                    {/* Next Up */}
                    <div className="space-y-4">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Next Scheduled</h2>
                        {nextEvent ? (
                            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded uppercase">
                                        {nextEvent.platform}
                                    </div>
                                    <span className="text-xs text-gray-400 font-medium">{nextEvent.date}</span>
                                </div>

                                {/* IMAGE PREVIEW */}
                                {nextEvent.image && (
                                    <div className="mb-4 rounded-lg overflow-hidden border border-gray-100 relative h-32 w-full">
                                        <img src={nextEvent.image} alt="Scheduled Post" className="w-full h-full object-cover" />
                                    </div>
                                )}

                                <p className="text-sm font-medium text-gray-900 line-clamp-3 mb-4 italic">"{nextEvent.content}"</p>
                                <button onClick={() => onNavigate('calendar')} className="w-full py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100 uppercase tracking-wider">
                                    Manage Calendar
                                </button>
                            </div>
                        ) : (
                            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6 text-center">
                                <span className="text-gray-400 text-xs block mb-2">Queue Empty</span>
                                <button onClick={() => onNavigate('studio')} className="text-indigo-600 text-xs font-bold">Draft Content</button>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
