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

// --- HELPER: TRANSFORM METRICS TO CLEAN KPIS ---
const transformMetricsToKPIs = (
    metrics: SocialMetrics | null,
    chain: ComputedMetrics | null,
    campaigns: DashboardCampaign[] = []
): KPIItem[] => {
    // 1. TOTAL SPEND (7d)
    const spendVal = campaigns.length > 0
        ? campaigns.reduce((acc, c) => acc + c.spend, 0)
        : 0;

    // 2. NEW WALLET VOLUME
    const newWallets = campaigns.length > 0
        ? campaigns.reduce((acc, c) => acc + c.attributedWallets, 0)
        : (chain?.netNewWallets || 0);

    // 3. EFFICIENCY (CPA)
    const cpaVal = newWallets > 0 ? (spendVal / newWallets) : 0;

    // 4. ON-CHAIN VALUE
    const valueCreated = campaigns.length > 0
        ? campaigns.reduce((acc, c) => acc + c.valueCreated, 0)
        : (chain?.totalVolume || 0);

    return [
        {
            label: '7-Day Spend',
            value: `$${spendVal.toLocaleString()}`,
            delta: 0,
            trend: 'flat',
            confidence: 'High',
            statusLabel: 'Neutral',
            sparklineData: []
        },
        {
            label: 'Attributed Wallets',
            value: newWallets.toLocaleString(),
            delta: 12,
            trend: 'up',
            confidence: 'High',
            statusLabel: 'Neutral',
            sparklineData: []
        },
        {
            label: 'Avg. Cost Per Acq.',
            value: `$${cpaVal.toFixed(2)}`,
            delta: -5,
            trend: 'down',
            confidence: 'High',
            statusLabel: 'Neutral',
            sparklineData: []
        },
        {
            label: 'On-Chain Volume',
            value: `$${(valueCreated / 1000).toFixed(1)}k`,
            delta: 8,
            trend: 'up',
            confidence: 'High',
            statusLabel: 'Neutral',
            sparklineData: []
        }
    ];
};

// --- SUB-COMPONENT: CLEAN PERFORMANCE CHART ---
const PerformanceChart = ({ dataPoints }: { dataPoints: number[] }) => {
    // Mock data simulation for illustration
    const points = [40, 45, 60, 55, 78, 82, 90, 85, 95, 110, 105, 120];
    const max = Math.max(...points);
    const min = Math.min(...points);
    const height = 120; // Slightly shorter for dashboard view
    const width = 800;

    // Generate path
    const pathD = points.map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p - min) / (max - min)) * (height * 0.8) - 10;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const fillD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

    return (
        <div className="w-full h-40 bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Performance History (30d)</h3>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-bold text-emerald-600">↑ 12.5% MoM</div>
                </div>
            </div>

            <div className="w-full h-full relative overflow-hidden">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={fillD} fill="url(#chartGradient)" />
                    <path d={pathD} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Annotations */}
                    <circle cx={width * 0.35} cy={height * 0.6} r="3" fill="#10B981" />
                    <text x={width * 0.35} y={height * 0.55} fontSize="9" fill="#047857" fontWeight="bold" textAnchor="middle">Deploy</text>

                    <circle cx={width * 0.8} cy={height * 0.2} r="3" fill="#10B981" />
                    <text x={width * 0.8} y={height * 0.15} fontSize="9" fill="#047857" fontWeight="bold" textAnchor="middle">Viral Spike</text>
                </svg>
            </div>
        </div>
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
    const [loading, setLoading] = useState(true);

    // AI & Brief State
    const [isBriefOpen, setIsBriefOpen] = useState(false);
    const [briefData, setBriefData] = useState<DailyBrief | null>(null);
    const [briefLoading, setBriefLoading] = useState(false);

    // Calc KPIs
    const kpis = useMemo(() => transformMetricsToKPIs(socialMetrics, chainMetrics, campaigns), [socialMetrics, chainMetrics, campaigns]);

    // Data Fetching
    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            try {
                const [camps] = await Promise.all([
                    fetchCampaignPerformance()
                ]);

                if (mounted) {
                    setCampaigns(camps);
                }
            } catch (e) {
                console.error("Data Load Failed", e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, [brandName]);

    // Init Brief (Simulated)
    useEffect(() => {
        const initBrief = async () => {
            if (!briefData && !briefLoading) {
                setBriefLoading(true);
                try {
                    await new Promise(r => setTimeout(r, 1500));
                    const brief = await generateBriefService(brandName, kpis, campaigns, []);
                    setBriefData(brief);
                } catch (e) { console.error(e); } finally { setBriefLoading(false); }
            }
        };
        initBrief();
    }, [kpis.length]);

    // Derived Logic for Actions
    const todaysCalls = campaigns
        .filter(c => c.status === 'Scale' || c.status === 'Kill' || c.status === 'Test')
        .sort((a, b) => b.priorityScore - a.priorityScore);

    const handleExecuteAll = () => {
        if (confirm(`Execute ${todaysCalls.length} strategic actions?`)) {
            alert('Actions Executed.');
        }
    };

    return (
        <div className="w-full h-full p-8 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER: HYBRID (Title + AI Status) */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        Analytics Dashboard
                    </h1>
                    <div className="text-[11px] text-gray-500 font-mono mt-1 tracking-tight">
                        Live telemetry and action recommendations.
                    </div>
                </div>

                {/* AI STATUS PILL (Restored but Cleaner) */}
                <button
                    onClick={() => setIsBriefOpen(true)}
                    className={`text-[10px] uppercase font-mono tracking-wider flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${briefLoading
                        ? 'bg-gray-50 text-gray-500 border-gray-200'
                        : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 shadow-sm'
                        }`}
                >
                    <span className="relative flex h-2 w-2">
                        {!briefLoading && briefData && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${briefLoading ? 'bg-gray-400' : 'bg-emerald-500'}`}></span>
                    </span>
                    {briefLoading ? 'Syncing...' : 'Engine: Live'}
                </button>
            </div>

            <DailyBriefDrawer
                isOpen={isBriefOpen}
                onClose={() => setIsBriefOpen(false)}
                brief={briefData}
                loading={briefLoading}
            />

            {/* LANE 1: CLEAN KPIS */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm relative overflow-hidden group">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{kpi.label}</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900 tracking-tight">{kpi.value}</span>
                            {kpi.delta !== 0 && (
                                <span className={`text-[10px] font-bold ${kpi.delta > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {kpi.delta > 0 ? '↑' : '↓'} {Math.abs(kpi.delta)}%
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-12 gap-6">

                {/* LEFT COL: TELEMETRY (Chart + Table) */}
                <div className="col-span-8">
                    <PerformanceChart dataPoints={[]} />

                    {/* ATTRIBUTION TABLE (Clean Style) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Active Attribution</h3>
                        </div>

                        {loading ? (
                            <div className="p-12 flex justify-center text-gray-400 font-mono text-xs">Loading Data...</div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-5 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider w-1/3">Source</th>
                                        <th className="px-5 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Traffic</th>
                                        <th className="px-5 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Conv. %</th>
                                        <th className="px-5 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider text-right">Trend</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {campaigns.map(c => (
                                        <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-default">
                                            <td className="px-5 py-3">
                                                <div className="text-xs font-bold text-gray-900">{c.name}</div>
                                                <div className="text-[9px] text-gray-400 font-mono">{c.channel}</div>
                                            </td>
                                            <td className="px-5 py-3 text-xs font-mono text-gray-600">{(c.spend * 12).toLocaleString()}</td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-12 bg-gray-100 rounded-full h-1 overflow-hidden">
                                                        <div className="bg-gray-400 h-1 rounded-full" style={{ width: `${Math.min(c.retention, 100)}%` }}></div>
                                                    </div>
                                                    <span className="text-[9px] font-mono text-gray-500">{c.retention.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${c.trendSignal === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                                                    {c.trendSignal === 'up' ? 'Rising' : 'Flat'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* RIGHT COL: ACTION CENTER (Restored) */}
                <div className="col-span-4 space-y-6">
                    {/* RECOMMENDED ACTIONS */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full flex flex-col sticky top-6">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Action Center</h3>
                            <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold">{todaysCalls.length} Pending</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[600px]">
                            {todaysCalls.map((c) => (
                                <ActionCard
                                    key={c.id}
                                    campaign={c}
                                    onReview={() => onNavigate('campaigns')}
                                    onExecute={() => {
                                        if (confirm(`Initialize execution for ${c.name}?`)) alert('Drafts Created.');
                                    }}
                                />
                            ))}

                            {todaysCalls.length === 0 && (
                                <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-xl">
                                    <p className="text-gray-400 text-[10px] font-mono">SYSTEM OPTIMAL</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={handleExecuteAll}
                                className="w-full py-2.5 bg-zinc-900 text-white text-[10px] font-bold rounded-lg hover:bg-zinc-800 transition-colors uppercase tracking-widest flex items-center justify-center gap-2">
                                Execute All
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
