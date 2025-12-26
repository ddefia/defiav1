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
    growthReport,
    onNavigate
}) => {
    // --- Pulse Data Loading ---
    const [pulseTrends, setPulseTrends] = React.useState<any[]>([]);
    React.useEffect(() => {
        const cache = loadPulseCache(brandName);
        setPulseTrends(cache.items.slice(0, 3)); // Top 3
    }, [brandName]);

    // --- Data Processing (Restored) ---

    // 1. Defia Index Calculation
    const { total: indexScore, grade: indexGrade, breakdown, insights: scoreInsights } = useMemo(() => {
        return calculateDefiaScore(socialMetrics, chainMetrics, strategyTasks);
    }, [socialMetrics, chainMetrics, strategyTasks]);

    const displayScore = (indexScore / 10).toFixed(1);

    // 2. Audience & Growth
    const totalAudience = socialMetrics?.totalFollowers
        ? (socialMetrics.totalFollowers > 1000 ? `${(socialMetrics.totalFollowers / 1000).toFixed(1)}K` : socialMetrics.totalFollowers.toString())
        : '0';

    const rawEngagement = socialMetrics?.engagementRate ? socialMetrics.engagementRate.toFixed(2) : '0.00';

    // 3. Daily Brief Item
    const dailyFeature = useMemo(() => {
        return strategyTasks.find(t => t.impactScore >= 8) || strategyTasks[0] || null;
    }, [strategyTasks]);

    // 4. Upcoming One
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
        <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-8 animate-fadeIn font-sans text-gray-900 pb-20">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-100 pb-6 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg font-display">
                            {brandName.charAt(0)}
                        </div>
                        <h1 className="text-3xl font-display font-bold tracking-tight">{brandName} Command Center</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 pl-[52px]">
                        <span className={`flex items-center gap-2 ${isServerOnline ? 'text-green-600' : 'text-gray-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${isServerOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                            {isServerOnline ? "Neural Engine Online" : "Engine Offline"}
                        </span>
                        <span>•</span>
                        <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => onNavigate('studio')} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-colors shadow-lg shadow-gray-200">
                        + New Campaign
                    </button>
                </div>
            </div>

            {/* KEY METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Defia Index"
                    value={`${displayScore}/10`}
                    subtext={`${indexGrade} • ${scoreInsights[0] || 'Optimized'}`}
                    trend={socialMetrics?.isLive ? "Verified" : "Simulated"}
                    trendUp={!!socialMetrics?.isLive}
                />
                <StatCard
                    label="Total Audience"
                    value={totalAudience}
                    subtext="Combined Reach"
                    trend="+12.4%"
                    trendUp={true}
                />
                <StatCard
                    label="Engagement Rate"
                    value={`${rawEngagement}%`}
                    subtext="Avg interaction/post"
                    trend="-2.1%"
                    trendUp={false}
                />
                <StatCard
                    label="Weekly Growth"
                    value="+5.7%"
                    subtext="TVL & user growth"
                    trend="+1.2%"
                    trendUp={true}
                />
            </div>

            {/* MAIN COMMAND GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

                {/* COL 1: INTELLIGENCE & ACTIONS (Width: 5) */}
                <div className="lg:col-span-5 space-y-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Intelligence & Actions</h3>

                    {/* AGENT PROPOSAL (High Priority) */}
                    {systemLogs.some(l => l.includes('ACTION REQUIRED')) && (
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-1 rounded-2xl shadow-lg animate-fadeIn text-white">
                            <div className="bg-gray-900/40 backdrop-blur-sm p-5 rounded-xl">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex gap-3 items-center">
                                        <span className="text-2xl">⚡</span>
                                        <div>
                                            <h4 className="font-bold text-lg">Agent Proposal</h4>
                                            <p className="text-xs text-indigo-200">Autonomous reaction suggestion</p>
                                        </div>
                                    </div>
                                    <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md">PENDING</span>
                                </div>

                                <div className="mt-2 bg-black/20 p-3 rounded-lg border border-white/10 text-sm italic text-gray-300">
                                    "Volume spike detected on BN. Recommend slight trend-jack referencing previous ATH..."
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <button className="flex-1 bg-white text-indigo-900 py-2 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors">Approve & Post</button>
                                    <button className="px-4 py-2 bg-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/20">Dismiss</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DAILY BRIEF */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col h-auto min-h-[300px]">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                                </span>
                                <h2 className="font-bold text-gray-900">Daily Strategy</h2>
                            </div>
                            <button onClick={() => onNavigate('growth')} className="text-xs text-indigo-600 font-bold hover:underline">View Hub &rarr;</button>
                        </div>

                        {dailyFeature ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Top Recommendation</span>
                                    <h3 className="font-display font-bold text-gray-900 leading-tight mb-2">{dailyFeature.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">"{dailyFeature.reasoning}"</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs text-gray-400">Impact</div>
                                        <div className="font-bold text-green-600">High</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs text-gray-400">Effort</div>
                                        <div className="font-bold text-gray-900">Medium</div>
                                    </div>
                                </div>
                                <button onClick={() => onNavigate('growth')} className="w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors">
                                    Execute Strategy
                                </button>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                                <div className="text-3xl mb-2">🤔</div>
                                <p className="text-sm text-gray-500 mb-4">Analyzing market conditions...</p>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1"><div className="bg-indigo-500 h-1.5 rounded-full w-2/3 animate-pulse"></div></div>
                                <div className="font-mono text-xs text-gray-400 mt-2">Running Growth Engine...</div>
                            </div>
                        )}
                    </div>


                    {/* MARKETING BRIEF (Moved from Growth Engine) */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col min-h-[200px]">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <span>📄</span> Marketing Brief
                            </h2>
                            <span className="text-[10px] uppercase font-bold text-gray-400">Daily Executive Summary</span>
                        </div>

                        {growthReport ? (
                            <div className="text-sm text-gray-600 leading-relaxed font-serif">
                                {growthReport.executiveSummary}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-400 italic">
                                Run a Strategy Scan in the Growth Hub to generate today's brief.
                            </div>
                        )}
                    </div>
                </div>

                {/* COL 2: PULSE & TRENDS (Width: 4) */}
                <div className="lg:col-span-4 space-y-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Pulse Signals</h3>
                    <div className="bg-white border border-gray-200 rounded-2xl p-0 shadow-sm overflow-hidden flex flex-col h-full">
                        {pulseTrends.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {pulseTrends.map((trend, i) => (
                                    <div key={i} className="p-4 hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => onNavigate('pulse')}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">{trend.source}</span>
                                            <span className="text-[10px] text-gray-400">
                                                {/* Timestamp Logic: if raw timestamp exists, calc relative time, else use static string */}
                                                {trend.createdAt ? (() => {
                                                    const diff = Date.now() - trend.createdAt;
                                                    const mins = Math.floor(diff / 60000);
                                                    if (mins < 60) return `${mins}m ago`;
                                                    const hours = Math.floor(mins / 60);
                                                    if (hours < 24) return `${hours}h ago`;
                                                    return `${Math.floor(hours / 24)}d ago`;
                                                })() : trend.timestamp}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-sm text-gray-900 leading-snug mb-1 group-hover:text-indigo-600 transition-colors">{trend.headline}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-2">{trend.summary}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <div className="inline-block p-3 rounded-full bg-gray-50 mb-3 text-2xl">📡</div>
                                <p className="text-sm text-gray-500">Scanning frequency bands...</p>
                            </div>
                        )}
                        <div className="p-3 bg-gray-50 border-t border-gray-100 mt-auto text-center">
                            <button onClick={() => onNavigate('pulse')} className="text-xs font-bold text-gray-500 hover:text-gray-900">View All Signals &rarr;</button>
                        </div>
                    </div>
                </div>

                {/* COL 3: CONTENT QUEUE (Width: 3) */}
                <div className="lg:col-span-3 space-y-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Content Queue</h3>
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm h-full">
                        {calendarEvents.length > 0 ? (
                            <div className="space-y-4">
                                {calendarEvents.slice(0, 3).map((event, i) => (
                                    <div key={i} className="flex gap-3 items-start border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                                        <div
                                            className="w-12 h-12 rounded-lg shrink-0 overflow-hidden flex items-center justify-center text-xs text-gray-400 relative"
                                            style={event.color ? { backgroundColor: event.color + '20', border: `1px solid ${event.color}` } : { backgroundColor: '#f3f4f6' }}
                                        >
                                            {event.image ? <img src={event.image} className="w-full h-full object-cover" /> : '📝'}
                                            {event.color && <div className="absolute inset-0 bg-current opacity-10" style={{ color: event.color }}></div>}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">{event.date} • {event.platform}</span>
                                                {event.campaignName && (
                                                    <span
                                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                                                        style={event.color
                                                            ? { backgroundColor: event.color + '20', color: event.color }
                                                            : { backgroundColor: '#EEF2FF', color: '#4F46E5' }
                                                        }
                                                    >
                                                        {event.campaignName}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-relaxed">"{event.content}"</p>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={() => onNavigate('calendar')} className="w-full mt-2 py-2 border border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-400 hover:text-gray-600 hover:border-gray-400">
                                    + Schedule More
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-xs text-gray-400 mb-2">Queue is empty</p>
                                <button onClick={() => onNavigate('studio')} className="text-indigo-600 text-xs font-bold">Draft Content</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SYSTEM LOGS FOOTER */}
            <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Live System Logs</h3>
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-[10px] text-green-400 h-32 overflow-y-auto border border-gray-800 shadow-inner custom-scrollbar">
                    {systemLogs.length > 0 ? systemLogs.map((log, i) => (
                        <div key={i} className="opacity-80 py-0.5 border-b border-white/5">{'>'} {log}</div>
                    )) : (
                        <div className="opacity-50">{'>'} Monitoring active...</div>
                    )}
                    <div className="animate-pulse mt-2">{'>'} _</div>
                </div>
            </div>
        </div >
    );
};
