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

    // 2. Mock Data for matched metrics
    const activeWallets = "142.3K";
    const retentionRate = "34.2%";

    // 3. Weekly Growth
    const weeklyGrowthVal = "+5.7%";

    // --- UI Helper Components ---
    const TopBar = () => (
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-gray-400 font-normal">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
                </span>
                Dashboard
            </h1>
            <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative">
                    <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                        type="text"
                        placeholder="Search"
                        className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:border-indigo-500 w-64 shadow-sm"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] bg-gray-100 text-gray-400 px-1.5 rounded border border-gray-200">⌘K</span>
                </div>

                {/* Timeframe */}
                <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                    {['24H', '7D', '30D', '90D', 'All'].map((t, i) => (
                        <button key={t} className={`px-3 py-1 text-xs font-bold rounded ${i === 1 ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                            {t}
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <button className="p-2 text-gray-400 hover:text-gray-900"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg></button>
                <div className="w-8 h-8 rounded-full bg-indigo-100 ring-2 ring-white border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                    {brandName.charAt(0)}
                </div>
            </div>
        </div>
    );

    const StatCard = ({ title, value, subtext, trend, isPositive }: any) => (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    <span>{isPositive ? '↗' : '↘'}</span>
                    {trend}
                </div>
            </div>
            <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-display font-bold text-gray-900 tracking-tight">{value}</span>
            </div>
            <p className="text-xs text-gray-400 font-medium">{subtext}</p>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto w-full p-8 font-sans">
            <TopBar />

            {/* HERO SECTION */}
            <div className="mb-10">
                <div className="flex justify-between items-start">
                    <div className="flex items-start gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg shadow-blue-200 flex items-center justify-center text-white text-2xl font-bold font-display">
                            {brandName.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-3xl font-display font-bold text-gray-900 mb-1">{brandName} Dashboard</h2>
                            <p className="text-gray-500 font-medium mb-3">AI-powered analytics and growth intelligence platform</p>
                            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
                                This week shows <span className="text-green-600 font-bold">23% increase</span> in user engagement, <span className="text-gray-700 font-bold">$1.2M revenue growth</span>, and <span className="text-gray-700 font-bold">89% customer satisfaction</span> across {strategyTasks.length || 12} active campaigns.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onNavigate('pulse')}
                        className="bg-white border border-gray-200 text-gray-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
                    >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        DefiA Pulse
                    </button>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <StatCard
                    title="DEFIA INDEX"
                    value={`${displayScore}/10`}
                    subtext="Overall growth health score"
                    trend="+0.3"
                    isPositive={true}
                />
                <StatCard
                    title="ACTIVE WALLETS"
                    value={activeWallets}
                    subtext="7-day active addresses"
                    trend="+12.4%"
                    isPositive={true}
                />
                <StatCard
                    title="R7 RETENTION"
                    value={retentionRate}
                    subtext="Users returning after 7 days"
                    trend="-2.1%"
                    isPositive={false}
                />
                <StatCard
                    title="WEEKLY GROWTH"
                    value={weeklyGrowthVal}
                    subtext="Total value locked relative growth"
                    trend="+1.2%"
                    isPositive={true}
                />
            </div>

            {/* DAILY MARKETING BRIEF */}
            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Daily Marketing Brief</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {growthReport ? (
                        <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed font-serif">
                            <p>{growthReport.executiveSummary}</p>
                            <p className="mt-4">{growthReport.tacticalPlan}</p>
                        </div>
                    ) : (
                        <div className="text-brand-muted space-y-4">
                            <p className="text-gray-600 leading-relaxed">
                                Strong momentum continues across all channels today. Our Summer Campaign is driving exceptional results with a <strong className="text-gray-900">4.04 ROAS</strong>—35% above target—while maintaining a lean <strong className="text-gray-900">$23 CPA</strong>. The campaign has processed <strong className="text-gray-900">4,523 transactions</strong> this week, contributing significantly to our <strong className="text-gray-900">$1.2M revenue milestone</strong>.
                            </p>
                            <p className="text-gray-600 leading-relaxed">
                                Social engagement surged <strong className="text-gray-900">47% following yesterday's influencer partnership launch</strong>, generating 1,834 brand mentions and lifting our overall engagement rate to 23%. Mobile performance particularly stands out, with conversion rates climbing from 3.2% to <strong className="text-gray-900">4.8%</strong>—a clear signal our responsive redesign is resonating with users.
                            </p>
                            <p className="text-gray-600 leading-relaxed">
                                With <strong className="text-gray-900">{strategyTasks.length || 12} active campaigns</strong> running simultaneously and customer satisfaction holding steady at 89%, we're well-positioned heading into Q4. Key areas to watch include the emerging referral vector and the localized adoption spike we're seeing in the APAC region.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* SPACER for scrolling */}
            <div className="h-20"></div>
        </div>
    );
};
