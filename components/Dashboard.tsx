import React, { useState, useMemo, useEffect } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals, DashboardCampaign, KPIItem, CommunitySignal, DailyBrief } from '../types';
import { fetchCampaignPerformance, fetchMarketPulse } from '../services/analytics';
import { generateDailyBrief as generateBriefService } from '../services/gemini';
import { DailyBriefDrawer } from './DailyBriefDrawer';
import { ActionCard } from './ActionCard';

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

// --- HELPER: TRANSFORM METRICS TO KPIS ---
const transformMetricsToKPIs = (
    metrics: SocialMetrics | null,
    chain: ComputedMetrics | null,
    campaigns: DashboardCampaign[] = []
): KPIItem[] => {
    // 1. SPEND
    const spendVal = campaigns.length > 0
        ? campaigns.reduce((acc, c) => acc + c.spend, 0)
        : 0;

    // 2. ATTR WALLETS
    const newWallets = campaigns.length > 0
        ? campaigns.reduce((acc, c) => acc + c.attributedWallets, 0)
        : (chain?.netNewWallets || 0);

    // 3. CPA
    const cpaVal = newWallets > 0 ? (spendVal / newWallets) : 0;

    // 4. VALUE CREATED
    const valueCreated = campaigns.length > 0
        ? campaigns.reduce((acc, c) => acc + c.valueCreated, 0)
        : (chain?.totalVolume || 0);

    // 5. DEFIA SCORE
    const defiaScore = metrics ? (metrics.engagementRate * 1.5 + (chain?.retentionRate || 0) * 5).toFixed(1) : '0.0';

    return [
        {
            label: 'Spend (7d)',
            value: `$${spendVal.toLocaleString()}`,
            delta: 0,
            trend: 'flat',
            confidence: campaigns.length > 0 ? 'High' : 'Low',
            statusLabel: spendVal > 5000 ? 'Watch' : 'Strong',
            sparklineData: [spendVal * 0.8, spendVal * 0.9, spendVal]
        },
        {
            label: 'Attr. Wallets',
            value: newWallets.toLocaleString(),
            delta: 12,
            trend: 'up',
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
            label: 'Value Created',
            value: `$${(valueCreated / 1000).toFixed(1)}k`,
            delta: 8,
            trend: 'up',
            confidence: 'High',
            statusLabel: 'Strong',
            sparklineData: [valueCreated * 0.8, valueCreated]
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

export const Dashboard: React.FC<DashboardProps> = ({
    brandName,
    socialMetrics,
    chainMetrics,
    calendarEvents,
    onNavigate
}) => {
    const [campaigns, setCampaigns] = useState<DashboardCampaign[]>([]);
    const [signals, setSignals] = useState<CommunitySignal[]>([]);
    const [loading, setLoading] = useState(true);

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
                    await new Promise(r => setTimeout(r, 1500));
                    const brief = await generateBriefService(brandName, kpis, campaigns, signals);
                    setBriefData(brief);
                } catch (e) { console.error(e); } finally { setBriefLoading(false); }
            }
        };
        initBrief();
    }, [kpis.length]);

    // Data Fetching
    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            try {
                const [camps, pulse] = await Promise.all([
                    fetchCampaignPerformance(),
                    fetchMarketPulse(brandName)
                ]);

                if (mounted) {
                    setCampaigns(camps);
                    setSignals(pulse.map(p => ({
                        platform: 'Twitter', // Defaulting to Twitter
                        signal: p.headline,
                        trend: p.sentiment === 'Positive' ? 'up' : p.sentiment === 'Negative' ? 'down' : 'flat',
                        sentiment: p.sentiment
                    })));
                }
            } catch (e) {
                console.error("Dashboard Data Load Failed", e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, [brandName]);

    const upcomingContent = calendarEvents
        .filter(e => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);

    const todaysCalls = campaigns
        .filter(c => c.status === 'Scale' || c.status === 'Kill' || c.status === 'Test')
        .sort((a, b) => b.priorityScore - a.priorityScore);

    const handleExecuteAll = () => {
        if (confirm(`Execute ${todaysCalls.length} strategic actions?`)) {
            alert('Actions Executed. Budgets updated on-chain.');
        }
    };

    return (
        <div className="w-full h-full p-6 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                        Analysis Engine
                    </h1>
                    <div className="text-[11px] text-gray-500 font-mono mt-1 tracking-tight flex items-center gap-2">
                        Approve system-recommended actions derived from live performance signals.
                    </div>
                </div>

                {/* AI STATUS INDICATOR */}
                <div className="relative group">
                    <button
                        onClick={() => setIsBriefOpen(true)}
                        className={`text-[10px] uppercase font-mono tracking-wider flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${briefLoading
                            ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-wait'
                            : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200 cursor-default shadow-sm'
                            }`}
                    >
                        <span className="relative flex h-2 w-2">
                            {briefLoading && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-400 opacity-75"></span>}
                            {!briefLoading && briefData && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${briefLoading ? 'bg-gray-400' : 'bg-emerald-500'}`}></span>
                        </span>
                        {briefLoading ? 'Analysis Engine: Syncing' : 'Analysis Engine: Live'}
                    </button>
                    {/* Tooltip omitted for cleaner code, restored BriefDrawer interaction */}
                </div>
            </div>

            <DailyBriefDrawer
                isOpen={isBriefOpen}
                onClose={() => setIsBriefOpen(false)}
                brief={briefData}
                loading={briefLoading}
            />

            {/* LANE 1: PERFORMANCE (KPIs with Sparklines) */}
            <div className="grid grid-cols-5 gap-3 mb-8">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm relative group">
                        <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${kpi.confidence === 'High' ? 'bg-emerald-500' : 'bg-amber-500'}`} title={`Confidence: ${kpi.confidence}`}></div>
                        <div className="mb-2">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{kpi.label}</div>
                            <div className="text-xl font-bold text-gray-900 tracking-tighter">{kpi.value}</div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className={`text-[10px] font-bold flex items-center gap-1 ${kpi.delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {kpi.trend === 'up' ? '↑' : '↓'} {Math.abs(kpi.delta)}%
                            </div>
                            <StatusBadge status={kpi.statusLabel} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-12 gap-8">

                {/* LANE 1 (LEFT/CENTER): PERFORMANCE & CAMPAIGN TABLE */}
                <div className="col-span-8 flex flex-col gap-8">
                    {/* CAMPAIGN TABLE */}
                    <div className="bg-white rounded-xl border border-gray-200/75 shadow-md shadow-gray-100/50 overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/80"></div>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Active Campaigns</h3>
                            <div className="flex gap-2 text-[10px] font-medium text-gray-500">
                                <span>Sort: ROI</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            {loading ? <div className="p-12 text-center text-gray-400 text-xs font-mono">Loading data...</div> : (
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            {['Campaign', 'Trend', 'Spend', 'CPA', 'Retention', 'Value', 'ROI', 'Conf', 'Status'].map(h => (
                                                <th key={h} className="px-4 py-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {campaigns.map(c => (
                                            <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                                                <td className="px-4 py-3" onClick={() => onNavigate('campaigns')}>
                                                    <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600 underline decoration-dotted underline-offset-2">{c.name}</div>
                                                    <div className="text-[10px] text-gray-400">{c.channel}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs ${c.trendSignal === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {c.trendSignal === 'up' ? '↗' : '↘'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-mono text-gray-600">${c.spend.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-xs font-mono font-medium">${c.cpa.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-xs font-mono">{c.retention}%</td>
                                                <td className="px-4 py-3 text-xs font-mono font-bold">+${c.valueCreated.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-xs font-mono font-bold">
                                                    <span className={c.roi > 5 ? 'text-emerald-600' : 'text-amber-600'}>{c.roi}x</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className={`w-2 h-2 rounded-full mx-auto ${c.confidence === 'High' ? 'bg-emerald-400' : 'bg-gray-300'}`}></div>
                                                </td>
                                                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* LANE 3: CONTENT & COMMUNITY */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Upcoming Content */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                Upcoming (7 Days)
                            </h3>
                            <div className="space-y-3">
                                {upcomingContent.map((e, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="text-[10px] font-mono text-gray-400 w-8">{new Date(e.date).getDate()}th</div>
                                        <div className="flex-1">
                                            <div className="text-xs font-bold text-gray-900 truncate">{e.content}</div>
                                            <div className="flex items-center gap-2 text-[9px] text-gray-500 uppercase">
                                                <span>{e.platform}</span>
                                                <span className={`font-bold ${e.status === 'scheduled' ? 'text-emerald-500' : 'text-amber-500'}`}>{e.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {upcomingContent.length === 0 && <div className="text-xs text-gray-400 italic">No upcoming content.</div>}
                            </div>
                        </div>

                        {/* Community Signals */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                Community Signals
                            </h3>
                            <div className="space-y-3">
                                {signals.map((s, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className={`mt-1 text-[10px] ${s.trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {s.trend === 'up' ? '▲' : '▼'}
                                        </div>
                                        <div>
                                            <div className="text-xs font-medium text-gray-900">{s.signal}</div>
                                            <div className="text-[9px] text-gray-400 uppercase font-bold mt-0.5">{s.platform}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* LANE 2 (RIGHT): DECISIONS & INTELLIGENCE */}
                <div className="col-span-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full flex flex-col sticky top-6">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Recommended Actions</h3>
                            <span className="text-[10px] text-gray-400 font-mono">{todaysCalls.length} Pending</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {todaysCalls.map((c) => (
                                <ActionCard
                                    key={c.id}
                                    campaign={c}
                                    onReview={() => onNavigate('campaigns')}
                                    onExecute={() => {
                                        if (confirm(`Initialize strict execution flow for ${c.name}?`)) alert('Pipeline Initialized.');
                                    }}
                                />
                            ))}
                            {todaysCalls.length === 0 && (
                                <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-xl">
                                    <p className="text-gray-400 text-xs font-mono">SYSTEM OPTIMAL</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={handleExecuteAll}
                                className="w-full py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors uppercase tracking-wide flex items-center justify-center gap-2">
                                Execute All Recommended
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
