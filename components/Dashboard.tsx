import React, { useMemo } from 'react';
import { SocialMetrics, StrategyTask, TrendItem, CalendarEvent } from '../types';
import { loadPulseCache } from '../services/storage';

interface DashboardProps {
    brandName: string;
    calendarEvents: CalendarEvent[];
    socialMetrics: SocialMetrics | null;
    strategyTasks: StrategyTask[];
    onNavigate: (section: 'studio' | 'growth' | 'pulse' | 'calendar' | 'dashboard') => void;
    onQuickAction: (action: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
    brandName,
    calendarEvents,
    socialMetrics,
    strategyTasks,
    onNavigate,
    onQuickAction
}) => {
    // 1. Get Top Trends (Read directly from cache for now to avoid extra prop drilling/fetching)
    const topTrends = useMemo(() => {
        const cache = loadPulseCache(brandName);
        // Sort by relevance and take top 3
        return cache.items
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 3);
    }, [brandName]);

    // 2. Get Upcoming Events (Next 3)
    const upcomingEvents = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return calendarEvents
            .filter(e => e.date >= todayStr) // String comparison works for ISO dates
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 3);
    }, [calendarEvents]);

    // 3. Get High Priority Tasks
    const priorityTasks = useMemo(() => {
        return strategyTasks
            .filter(t => t.impactScore >= 7) // Show tasks with decent impact
            .slice(0, 3);
    }, [strategyTasks]);

    // Quick Stats
    const engagementRate = socialMetrics?.engagementRate ? `${socialMetrics.engagementRate.toFixed(2)}%` : 'N/A';
    const followers = socialMetrics?.totalFollowers ? (socialMetrics.totalFollowers > 1000 ? `${(socialMetrics.totalFollowers / 1000).toFixed(1)}K` : socialMetrics.totalFollowers) : 'N/A';

    return (
        <div className="max-w-7xl mx-auto p-8 space-y-8 animate-fadeIn pb-24">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-gray-900">Good Morning, {brandName}</h1>
                    <p className="text-brand-muted">Here is your daily briefing and command center.</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
                        <span className="text-xs font-bold text-gray-400 uppercase">Followers</span>
                        <span className="text-xl font-bold text-gray-900">{followers}</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
                        <span className="text-xs font-bold text-gray-400 uppercase">Engagement</span>
                        <span className="text-xl font-bold text-green-600">{engagementRate}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COL 1: STRATEGY & ACTION PLANS */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span> Strategy Action Plans
                        </h2>
                        <button onClick={() => onNavigate('growth')} className="text-xs text-purple-600 font-bold hover:underline">View All</button>
                    </div>

                    <div className="space-y-4">
                        {priorityTasks.length > 0 ? (
                            priorityTasks.map(task => (
                                <div key={task.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-purple-300 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded uppercase">{task.type}</span>
                                        <span className="text-xs text-red-500 font-bold">★ {task.impactScore}/10</span>
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-sm mb-1">{task.title}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{task.description}</p>
                                    <button
                                        onClick={() => onNavigate('growth')}
                                        className="w-full py-2 bg-gray-50 text-gray-600 text-xs font-bold rounded hover:bg-gray-100"
                                    >
                                        Execute Draft
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-sm">No urgent tasks.</p>
                                <button onClick={() => onNavigate('growth')} className="mt-2 text-xs text-purple-600 font-bold">Run Strategy Scan</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* COL 2: PULSE SIGNALS */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Market Pulse
                        </h2>
                        <button onClick={() => onNavigate('pulse')} className="text-xs text-blue-600 font-bold hover:underline">Explore</button>
                    </div>

                    <div className="space-y-4">
                        {topTrends.length > 0 ? (
                            topTrends.map(trend => (
                                <div key={trend.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition-colors relative overflow-hidden group">
                                    {trend.relevanceScore > 85 && <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl">HOT</div>}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">{trend.source === 'Twitter' ? '🐦' : '📰'}</span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase">{trend.timestamp}</span>
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-sm mb-1 leading-snug">{trend.headline}</h3>
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => onNavigate('pulse')}
                                            className="flex-1 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            React
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-sm">No active signals.</p>
                                <button onClick={() => onNavigate('pulse')} className="mt-2 text-xs text-blue-600 font-bold">Scan Market</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* COL 3: UPCOMING CONTENT */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span> Upcoming Content
                        </h2>
                        <button onClick={() => onNavigate('calendar')} className="text-xs text-green-600 font-bold hover:underline">Full Calendar</button>
                    </div>

                    <div className="relative border-l-2 border-gray-100 pl-4 space-y-6 ml-2">
                        {upcomingEvents.length > 0 ? (
                            upcomingEvents.map((event, i) => (
                                <div key={event.id} className="relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white ring-1 ring-gray-100"></div>
                                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-gray-500">{event.date}</span>
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded">{event.platform}</span>
                                        </div>
                                        <p className="text-sm text-gray-900 font-medium line-clamp-2">{event.content}</p>
                                        {event.image && (
                                            <div className="mt-2 h-24 w-full rounded-md bg-gray-100 overflow-hidden relative">
                                                <img src={event.image} alt="Scheduled asset" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-sm">Queue is empty.</p>
                                <button onClick={() => onNavigate('studio')} className="mt-2 text-xs text-green-600 font-bold">Draft Content</button>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
