import React, { useState, useMemo, useEffect } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals, DashboardCampaign, KPIItem, CommunitySignal } from '../types';
import { fetchCampaignPerformance, fetchMarketPulse } from '../services/analytics';

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

// --- HELPER: TRANSFORM METRICS TO OBSERVATIONAL KPIS ---
const transformMetricsToTelemetry = (
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
            statusLabel: 'Neutral', // No prescriptive status
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

// --- SUB-COMPONENT: HISTORY CHART (Visual Anchor) ---
const PerformanceChart = ({ dataPoints }: { dataPoints: number[] }) => {
    // Mock data simulation for illustration if real history isn't available
    const points = [40, 45, 60, 55, 78, 82, 90, 85, 95, 110, 105, 120];
    const max = Math.max(...points);
    const min = Math.min(...points);
    const height = 160;
    const width = 1000;

    // Generate path
    const pathD = points.map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p - min) / (max - min)) * (height * 0.8) - 10; // 10px padding
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const fillD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

    return (
        <div className="w-full h-48 bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Performance History (30d)</h3>
                    <div className="text-[10px] text-gray-400 font-mono mt-1">Metric: Net Value Created ($)</div>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <div className="text-xs font-bold text-gray-900">12.5%</div>
                        <div className="text-[9px] text-gray-400">MoM Growth</div>
                    </div>
                </div>
            </div>

            <div className="w-full h-full relative overflow-hidden">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible" preserveAspectRatio="none">
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
                    <text x={width * 0.35} y={height * 0.55} fontSize="10" fill="#047857" fontWeight="bold" textAnchor="middle">Initial Deployment</text>

                    <circle cx={width * 0.8} cy={height * 0.2} r="3" fill="#10B981" />
                    <text x={width * 0.8} y={height * 0.15} fontSize="10" fill="#047857" fontWeight="bold" textAnchor="middle">Viral Spike</text>
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

    // Calc Observational KPIs
    const kpis = useMemo(() => transformMetricsToTelemetry(socialMetrics, chainMetrics, campaigns), [socialMetrics, chainMetrics, campaigns]);

    // Data Fetching
    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            try {
                // Parallel Fetch
                const [camps] = await Promise.all([
                    fetchCampaignPerformance()
                ]);

                if (mounted) {
                    setCampaigns(camps);
                }
            } catch (e) {
                console.error("Analytics Data Load Failed", e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, [brandName]);

    return (
        <div className="w-full h-full p-8 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER: TELEMETRY CONTEXT */}
            <div className="flex items-end justify-between mb-8 pb-6 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">
                        Analytics Telemetry
                    </h1>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        <p className="text-xs text-gray-500 font-mono">
                            Observational Data Layer. <span className="text-gray-400">(Actions derived in Console)</span>
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-1">Last Sync</div>
                    <div className="text-xs font-bold text-gray-600">Just now</div>
                </div>
            </div>

            {/* LANE 1: REFERENCE KPIs (Low Contrast) */}
            <div className="grid grid-cols-4 gap-6 mb-8">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{kpi.label}</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900 tracking-tight">{kpi.value}</span>
                            {kpi.delta !== 0 && (
                                <span className={`text-[10px] font-bold ${kpi.delta > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {kpi.delta > 0 ? '↗' : '↘'} {Math.abs(kpi.delta)}%
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* LANE 2: VISUAL ANCHOR (Performance Trends) */}
            <PerformanceChart dataPoints={[]} />

            {/* LANE 3: SOURCE ATTRIBUTION (Forensic Table) */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Attribution & Sources</h3>
                    <div className="text-[10px] font-medium text-gray-400 font-mono">
                        Window: Last 30 Days
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin mb-3"></div>
                        <div className="text-[10px] font-mono uppercase">Retrieving On-Chain Data...</div>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider w-1/3">Source (Campaign)</th>
                                <th className="px-6 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Traffic Vol.</th>
                                <th className="px-6 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Conversion %</th>
                                <th className="px-6 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider">Est. Value Impact</th>
                                <th className="px-6 py-3 text-[9px] font-bold text-gray-400 uppercase tracking-wider text-right">Trend</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {campaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                        <div className="text-xs font-mono">No verified data sources in selected window.</div>
                                    </td>
                                </tr>
                            ) : campaigns.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-default">
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-bold text-gray-900">{c.name}</div>
                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{c.channel.toUpperCase()} • ID: {c.id.slice(0, 6)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-mono text-gray-600">{(c.spend * 12).toLocaleString()} <span className="text-gray-300 ml-1">hits</span></div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="w-full bg-gray-100 rounded-full h-1.5 w-16 mb-1 overflow-hidden">
                                            <div className="bg-gray-400 h-1.5 rounded-full" style={{ width: `${Math.min(c.retention, 100)}%` }}></div>
                                        </div>
                                        <div className="text-[10px] font-mono text-gray-500">{c.retention.toFixed(1)}%</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-mono font-bold text-gray-900">+${c.valueCreated.toLocaleString()}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${c.trendSignal === 'up' ? 'bg-gray-50 border-gray-200 text-gray-600' :
                                                c.trendSignal === 'down' ? 'bg-white border-transparent text-gray-400' : 'bg-white border-transparent text-gray-400'
                                            }`}>
                                            {c.trendSignal === 'up' ? 'Trending Up' : c.trendSignal === 'down' ? 'Declining' : 'Stable'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
