import React, { useState, useMemo, useEffect } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals, DashboardCampaign, KPIItem, CommunitySignal, DailyBrief } from '../types';
import { fetchCampaignPerformance, fetchMarketPulse } from '../services/analytics';
import { generateDailyBrief as generateBriefService } from '../services/gemini';
import { DailyBriefDrawer } from './DailyBriefDrawer';

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

// --- HELPER: TRANSFORM METRICS TO CLEAN TELEMETRY KPIS ---
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
    const kpis = useMemo(() => transformMetricsToTelemetry(socialMetrics, chainMetrics, campaigns), [socialMetrics, chainMetrics, campaigns]);

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

    return (
        <div className="w-full h-full p-8 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER: TELEMETRY CLEANUP (Option 1) */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                        Analytics Telemetry
                    </h1>
                    <div className="text-[11px] text-gray-500 font-mono mt-1 tracking-tight">
                        Observational Data Layer. (Actions derived in Console)
                    </div>
                </div>

                {/* AI STATUS PILL */}
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

            {/* LANE 1: CLEAN KPIS (Option 1 - No Sparklines) */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm relative overflow-hidden group">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{kpi.label}</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900 tracking-tight">{kpi.value}</span>
                            {kpi.delta !== 0 && (
                                <span className={`text-[10px] font-bold ${kpi.delta > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                                    {kpi.delta > 0 ? '↑' : '↓'} {Math.abs(kpi.delta)}%
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* MAIN CONTENT GRID - REMOVED SIDEBAR (Option 3) */}
            <div className="grid grid-cols-12 gap-6">

                {/* FULL WIDTH TELEMETRY (Option 4 - Simple Table) */}
                <div className="col-span-12">

                    {/* ATTRIBUTION TABLE (Clean Style) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Active Attribution</h3>
                            <div className="text-[10px] font-mono text-gray-400">Sort: Traffic Vol</div>
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
                                                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${c.trendSignal === 'up' ? 'bg-gray-50 text-gray-600' : 'bg-white text-gray-400'}`}>
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

            </div>
        </div>
    );
};
