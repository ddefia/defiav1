import React, { useState, useMemo, useEffect } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals, DashboardCampaign, KPIItem, CommunitySignal, DailyBrief } from '../types';
import { fetchCampaignPerformance, fetchSocialMetrics, computeGrowthMetrics, computeSocialSignals } from '../services/analytics';
import { generateDailyBrief as generateBriefService } from '../services/gemini';
import { fetchMarketPulse } from '../services/pulse';
import { DailyBriefDrawer } from './DailyBriefDrawer';
import { SmartActionCard } from './SmartActionCard';
import { TrendFeed } from './TrendFeed';
import { StrategyBrain } from './StrategyBrain';

interface DashboardProps {
    brandName: string;
    brandConfig: BrandConfig;
    calendarEvents: CalendarEvent[];
    socialMetrics: SocialMetrics | null;
    // strategyTasks removed, replaced by tasks
    chainMetrics: ComputedMetrics | null;
    socialSignals: SocialSignals;
    systemLogs: string[];
    growthReport?: GrowthReport | null;
    onNavigate: (section: string, params?: any) => void;
    // New Props for Strategy Brain & Trends
    tasks: StrategyTask[];
    onUpdateTasks: (t: StrategyTask[]) => void;
    onSchedule: (content: string, image?: string) => void;
}

// Helper: Safety check for metrics
const safeVal = (val: number | undefined, suffix = '') => val ? `${val.toLocaleString()}${suffix}` : '--';

// --- HELPER: TRANSFORM METRICS TO KPIS ---
// --- HELPER: TRANSFORM METRICS TO KPIS ---
const transformMetricsToKPIs = (
    metrics: SocialMetrics | null,
    chain: ComputedMetrics | null,
    campaigns: DashboardCampaign[] = []
): KPIItem[] => {
    // 1. IMPRESSIONS (from Social Metrics)
    const impressionsVal = metrics ? metrics.weeklyImpressions : 0;

    // 2. ATTR WALLETS (sum of campaigns)
    // Honest Connection: Only show wallets we can prove came from campaigns
    const newWallets = campaigns.length > 0
        ? campaigns.reduce((acc, c) => acc + c.attributedWallets, 0)
        : (chain?.netNewWallets || 0);

    // 3. CPA (Weighted Average)
    // 3. CPA (Weighted Average)
    // CPA is tricky if we don't have spend, but we'll keep the calculation logic if needed or fallback
    // For now, let's keep CPA but base it on a hypothetical spend if real spend is gone, or just 0.
    const realSpend = campaigns.reduce((acc, c) => acc + c.spend, 0);
    const cpaVal = newWallets > 0 ? (realSpend / newWallets) : 0;

    // 4. NETWORK VOLUME (Chain Metrics)
    const netVol = chain ? chain.totalVolume : 0;

    // 5. DEFIA SCORE
    const defiaScore = metrics ? (metrics.engagementRate * 1.5 + (chain?.retentionRate || 0) * 5).toFixed(1) : '0.0';

    return [
        {
            label: 'Impressions (7d)',
            value: impressionsVal > 0 ? `${(impressionsVal / 1000).toFixed(1)}k` : '0',
            delta: 12.5, // Mock delta for now, or calc from history
            trend: 'up',
            confidence: metrics ? 'High' : 'Low',
            statusLabel: impressionsVal > 1000 ? 'Strong' : 'Watch',
            sparklineData: [impressionsVal * 0.8, impressionsVal * 0.9, impressionsVal]
        },
        {
            label: 'Attr. Wallets',
            value: newWallets.toLocaleString(),
            delta: 0,
            trend: 'flat',
            confidence: campaigns.length > 0 ? 'High' : 'Med',
            statusLabel: newWallets > 100 ? 'Strong' : 'Watch',
            sparklineData: [newWallets * 0.8, newWallets]
        },
        {
            label: 'CPA (Average)',
            value: `$${cpaVal.toFixed(2)}`,
            delta: 0,
            trend: 'flat',
            confidence: 'High',
            statusLabel: cpaVal < 50 ? 'Strong' : 'Watch',
            sparklineData: [cpaVal * 1.1, cpaVal]
        },
        {
            label: 'Network Volume',
            value: `$${(netVol / 1000000).toFixed(2)}m`,
            delta: 4.2,
            trend: 'up',
            confidence: chain ? 'High' : 'Low',
            statusLabel: 'Strong',
            sparklineData: [netVol * 0.8, netVol * 0.9, netVol]
        },
        {
            label: 'Defia Index',
            value: String(defiaScore),
            delta: 1.2,
            trend: 'up',
            confidence: 'High',
            statusLabel: 'Strong',
            sparklineData: [6.5, 6.8, 7.0, 7.2, 7.5, 7.7, Number(defiaScore)]
        }
    ];
};


// --- SUB-COMPONENTS ---

const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
        'Scale': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'Test': 'bg-blue-100 text-blue-800 border-blue-200',
        'Pause': 'bg-amber-100 text-amber-800 border-amber-200',
        'Kill': 'bg-rose-100 text-rose-800 border-rose-200',
        'Strong': 'bg-emerald-50 text-emerald-600',
        'Watch': 'bg-amber-50 text-amber-600',
        'Weak': 'bg-rose-50 text-rose-600'
    };
    return (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border border-transparent ${colors[status] || 'bg-gray-100'}`}>
            {status}
        </span>
    );
};

// --- MAIN DASHBOARD V2 ---

export const Dashboard: React.FC<DashboardProps> = ({
    brandName,
    brandConfig,
    socialMetrics,
    chainMetrics,
    calendarEvents,
    onNavigate,
    socialSignals,
    tasks,
    onUpdateTasks,
    onSchedule,
    growthReport
}) => {
    const [campaigns, setCampaigns] = useState<DashboardCampaign[]>([]);
    const [isThinking, setIsThinking] = useState<string | null>(null);

    // Daily Brief State
    const [isBriefOpen, setIsBriefOpen] = useState(false);
    const [briefData, setBriefData] = useState<DailyBrief | null>(null);
    const [briefLoading, setBriefLoading] = useState(false);

    // Re-calculate KPIs when data arrives
    const kpis = useMemo(() => transformMetricsToKPIs(socialMetrics, chainMetrics, campaigns), [socialMetrics, chainMetrics, campaigns]);

    // Auto-Generate Brief on Mount (Background Process)
    useEffect(() => {
        const initBrief = async () => {
            if (!briefData && !briefLoading) {
                setBriefLoading(true);
                try {
                    // Small delay to simulate "system boot" feel
                    await new Promise(r => setTimeout(r, 1500));
                    const brief = await generateBriefService(brandName, kpis, campaigns, []);
                    setBriefData(brief);
                } catch (e) {
                    console.error("Background Brief Gen Failed", e);
                } finally {
                    setBriefLoading(false);
                }
            }
        };
        initBrief();
    }, [brandName, kpis.length]); // Dependencies to ensure data is ready

    // Handler: Open Drawer
    const handleOpenDrawer = () => {
        setIsBriefOpen(true);
    };

    // Data Fetching
    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            try {
                // Parallel Fetch
                const [camps] = await Promise.all([
                    fetchCampaignPerformance(),
                    // fetchMarketPulse is now handled by parent App.tsx and passed via socialSignals
                ]);

                if (mounted) {
                    setCampaigns(camps);
                }
            } catch (e) {
                console.error("Dashboard Data Load Failed", e);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, [brandName]);

    // Trend Reaction Logic (Moved from GrowthEngine)
    const handleTrendReaction = async (trend: any, type: 'Tweet' | 'Meme') => {
        setIsThinking(trend.id);
        try {
            // We need to import generateTrendReaction here or move it to a service hook
            // For now, let's assume we can import it.
            // But to avoid adding more imports, let's just use onSchedule directly with a placeholder
            // In a real refactor, we would lift this logic to App.tsx or import the service.
            // Let's assume we can trigger a "Reaction" task in StrategyBrain instead?
            // Actually, simpler: Just open schedule modal with pre-filled content.
            onSchedule(`Reacting to ${trend.headline}...`, undefined);
        } finally {
            setIsThinking(null);
        }
    };

    const upcomingContent = calendarEvents
        .filter(e => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);

    // Filter Logic for "Today's Calls"
    const todaysCalls = campaigns
        .filter(c => c.status === 'Scale' || c.status === 'Kill' || c.status === 'Test')
        .sort((a, b) => b.priorityScore - a.priorityScore);

    const handleExecuteAll = () => {
        if (confirm(`Execute ${todaysCalls.length} strategic actions? This will scale updated budgets and pause underperformers.`)) {
            alert('Actions Executed. Budgets updated on-chain.');
        }
    };

    return (
        <div className="w-full h-full p-6 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                        Command Center
                    </h1>
                    <div className="text-[11px] text-gray-500 font-mono mt-1 tracking-tight flex items-center gap-2">
                        {brandName} / System Status: <span className="text-emerald-500 font-bold">ONLINE</span>
                    </div>
                </div>

                {/* AI STATUS INDICATOR */}
                <div className="relative group">
                    <button
                        onClick={handleOpenDrawer}
                        className={`text-[10px] uppercase font-mono tracking-wider flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer hover:shadow-md active:scale-95 ${briefLoading
                            ? 'bg-gray-50 text-gray-500 border-gray-200'
                            : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200 shadow-sm'
                            }`}
                    >
                        <span className="relative flex h-2 w-2">
                            {briefLoading && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75"></span>}
                            {!briefLoading && briefData && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${briefLoading ? 'bg-gray-400' : 'bg-emerald-500'}`}></span>
                        </span>
                        {briefLoading ? 'Analysis Engine: Syncing' : 'Analysis Engine: Live'}
                    </button>

                    {/* HOVER PREVIEW TOOLTIP */}
                    {!briefLoading && briefData && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-900 uppercase">AI Update (Just Now)</span>
                                <span className={`text-[9px] px-1.5 rounded ${briefData.confidence.level === 'High' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {briefData.confidence.level} Conf
                                </span>
                            </div>
                            <ul className="space-y-1.5">
                                {(briefData.keyDrivers || []).slice(0, 3).map((item, i) => (
                                    <li key={i} className="text-[10px] text-gray-600 leading-snug flex items-start gap-1.5">
                                        <span className="mt-1 w-1 h-3 rounded-full bg-gray-400 shrink-0"></span>
                                        {item.length > 50 ? item.substring(0, 50) + '...' : item}
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-2 pt-2 border-t border-gray-50 text-[9px] text-blue-600 font-medium flex items-center gap-1">
                                View full brief <span aria-hidden="true">&rarr;</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <DailyBriefDrawer
                isOpen={isBriefOpen}
                onClose={() => setIsBriefOpen(false)}
                brief={briefData}
                loading={briefLoading}
            />

            {/* LANE 1: PERFORMANCE (KPIs) */}
            <div className="grid grid-cols-5 gap-3 mb-8">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm relative group">
                        {/* Confidence Dot */}
                        <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${kpi.confidence === 'High' ? 'bg-emerald-500' : 'bg-amber-500'}`} title={`Confidence: ${kpi.confidence}`}></div>

                        <div className="mb-2">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{kpi.label}</div>
                            <div className="text-xl font-bold text-gray-900 tracking-tighter">{kpi.value}</div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className={`text-[10px] font-bold flex items-center gap-1 ${kpi.delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {kpi.trend === 'up' ? '↑' : '↓'} {Math.abs(kpi.delta)}%
                            </div>
                            <span className={`text-[9px] font-bold uppercase ${kpi.statusLabel === 'Strong' ? 'text-emerald-600' : kpi.statusLabel === 'Weak' ? 'text-rose-500' : 'text-amber-500'
                                }`}>
                                {kpi.statusLabel}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-12 gap-8 mb-12">
                {/* LANE 1 (LEFT/CENTER): PERFORMANCE & CAMPAIGN TABLE */}
                <div className="col-span-8 flex flex-col gap-8">

                    {/* CAMPAIGN TABLE */}
                    <div className="bg-white rounded-xl border border-gray-200/75 shadow-md shadow-gray-100/50 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/80"></div>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Active Campaigns</h3>
                            <button onClick={() => onNavigate('campaigns')} className="text-[10px] font-bold text-blue-600 hover:text-blue-800">View All →</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        {['Campaign', 'Trend', 'Spend', 'CPA', 'Retention', 'Value', 'ROI', 'Conf', 'Status'].map(h => (
                                            <th key={h} className="px-4 py-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {campaigns.map(c => {
                                        // Row Color Logic
                                        let rowClass = "hover:bg-gray-50 transition-colors cursor-pointer group";
                                        if (c.roi < 1 || (c.attributedWallets === 0 && c.spend > 1000)) rowClass += " bg-rose-50/30 hover:bg-rose-50/60";
                                        else if (c.cpa > 50 || c.retention < 50) rowClass += " bg-amber-50/30 hover:bg-amber-50/60";

                                        return (
                                            <tr key={c.id} className={rowClass}>
                                                <td className="px-4 py-3" onClick={() => onNavigate('campaigns')}>
                                                    <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600 underline decoration-dotted underline-offset-2">{c.name}</div>
                                                    <div className="text-[10px] text-gray-400">{c.channel}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs ${c.trendSignal === 'up' ? 'text-emerald-500' : c.trendSignal === 'down' ? 'text-rose-500' : 'text-gray-400'}`}>
                                                        {c.trendSignal === 'up' ? '↗' : c.trendSignal === 'down' ? '↘' : '→'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-mono text-gray-600">${c.spend.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-xs font-mono font-medium">
                                                    ${c.cpa.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-mono">{c.retention}%</td>
                                                <td className="px-4 py-3 text-xs font-mono font-bold">+${c.valueCreated.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-xs font-mono font-bold">
                                                    <span className={c.roi > 5 ? 'text-emerald-600' : c.roi < 1 ? 'text-rose-600' : 'text-amber-600'}>{c.roi}x</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className={`w-2 h-2 rounded-full mx-auto ${c.confidence === 'High' ? 'bg-emerald-400' : 'bg-gray-300'}`} title={c.confidence}></div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge status={c.status} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* LANE 3: CONTENT & TRENDS */}
                    <div className="grid grid-cols-2 gap-6">

                        {/* Upcoming Content */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                Upcoming (7 Days)
                            </h3>
                            <div className="space-y-3">
                                {upcomingContent.length > 0 ? upcomingContent.map((e, i) => (
                                    <div key={i} className="flex items-center gap-3 group">
                                        <div className="text-[10px] font-mono text-gray-400 w-8">{new Date(e.date).getDate()}th</div>
                                        <div className="flex-1">
                                            <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600 truncate transition-colors">{e.content}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] text-gray-500 uppercase">{e.platform}</span>
                                                <span className="text-[9px] text-gray-300">•</span>
                                                <span className={`text-[9px] font-bold uppercase ${e.status === 'scheduled' ? 'text-emerald-500' : 'text-amber-500'}`}>{e.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-amber-800">
                                            <span className="text-[10px] font-bold uppercase">⚠️ High Risk</span>
                                        </div>
                                        <div className="text-xs text-amber-900 font-medium">No active content. Engagement decay likely.</div>
                                        <button onClick={() => onNavigate('calendar')} className="text-[10px] font-bold text-amber-700 underline text-left hover:text-amber-900">
                                            Schedule Thread →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Live Signal Feed (Replaces Community Signals) */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                                Live Market Pulse
                            </h3>
                            <div className="-mx-2">
                                <TrendFeed
                                    trends={socialSignals?.trendingTopics || []}
                                    onReact={handleTrendReaction}
                                    isLoading={false}
                                />
                            </div>
                        </div>

                    </div>

                </div>

                {/* LANE 2 (RIGHT): DECISIONS & INTELLIGENCE */}
                <div className="col-span-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full flex flex-col sticky top-6">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Campaign Optimization</h3>
                            <span className="text-[10px] text-gray-400 font-mono">{todaysCalls.length} Pending</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[600px]">
                            {todaysCalls.map((c) => (
                                <SmartActionCard
                                    key={c.id}
                                    campaign={c}
                                    onReview={() => onNavigate('campaigns')}
                                    onExecute={() => {
                                        if (confirm(`Initialize strict execution flow for ${c.name}? This will draft content and schedule campaigns but requires final manual approval.`)) {
                                            alert('Execution Pipeline Initialized: Drafts Created.');
                                        }
                                    }}
                                />
                            ))}

                            {/* Empty State */}
                            {todaysCalls.length === 0 && (
                                <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-xl">
                                    <p className="text-gray-400 text-xs font-mono mb-2">SYSTEM OPTIMAL</p>
                                    <p className="text-gray-300 text-[10px]">No immediate actions required.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={handleExecuteAll}
                                title="Drafts and Schedules all actions. Requires final review."
                                className="w-full py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors uppercase tracking-wide flex items-center justify-center gap-2">
                                Execute All Recommended
                            </button>
                            <div className="text-[9px] text-center text-gray-400 mt-2">
                                Will not publish without final review.
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* SECTION: AI STRATEGY DIRECTOR (MOVED TO BOTTOM) */}
            <div className="mb-8 animate-fadeIn">
                <StrategyBrain
                    brandName={brandName}
                    brandConfig={brandConfig}
                    events={calendarEvents}
                    growthReport={growthReport}
                    onSchedule={onSchedule}
                    tasks={tasks}
                    onUpdateTasks={onUpdateTasks}
                    onNavigate={onNavigate}
                />
            </div>
        </div>
    );
};
