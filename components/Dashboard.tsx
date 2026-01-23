import React, { useState, useMemo } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals, DashboardCampaign, KPIItem } from '../types';

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

// Helper: Safety check for metrics
const safeVal = (val: number | undefined, suffix = '') => val ? `${val.toLocaleString()}${suffix}` : '--';

// --- MOCK DATA GENERATORS (To be replaced with real backend data later) ---
const generateMockKPIs = (metrics: SocialMetrics | null, chain: ComputedMetrics | null): KPIItem[] => {
    return [
        {
            label: 'Spend (7d)',
            value: '$4,250',
            delta: 12,
            trend: 'up',
            confidence: 'High',
            sparklineData: [3000, 3200, 3100, 3500, 4000, 4100, 4250]
        },
        {
            label: 'Attributed Wallets',
            value: chain?.netNewWallets ? chain.netNewWallets.toLocaleString() : '142',
            delta: 8.5,
            trend: 'up',
            confidence: 'Med',
            sparklineData: [80, 95, 88, 110, 125, 130, 142]
        },
        {
            label: 'CPA (Wallet)',
            value: '$32.10',
            delta: -5.2, // Negative is good for CPA usually, but handled by color logic
            trend: 'down',
            confidence: 'High',
            sparklineData: [45, 42, 40, 38, 35, 33, 32.10]
        },
        {
            label: 'Value Created (TVL)',
            value: chain?.tvlChange ? `+$${(chain.tvlChange / 1000).toFixed(1)}k` : '+$450k',
            delta: 24,
            trend: 'up',
            confidence: 'Low',
            sparklineData: [300, 320, 310, 380, 410, 430, 450]
        },
        {
            label: 'Defia Index',
            value: '7.8',
            delta: 1.2,
            trend: 'up',
            confidence: 'High',
            sparklineData: [6.5, 6.8, 7.0, 7.2, 7.5, 7.7, 7.8]
        }
    ];
};

const generateMockCampaigns = (): DashboardCampaign[] => {
    return [
        {
            id: 'c1',
            name: 'Alpha Launch',
            channel: 'Twitter',
            spend: 1200,
            attributedWallets: 45,
            cpa: 26.6,
            retention: 85,
            valueCreated: 15000,
            roi: 12.5,
            status: 'Scale',
            aiSummary: ['High engagement from influencers', 'Referral loop active', 'Low churn on landing page'],
            anomalies: ['Bot traffic spike on day 2 (filtered)'],
            recommendation: {
                action: 'Scale',
                reasoning: ['ROI > 10x', 'CPA trending down', 'Saturation < 20%'],
                confidence: 'High'
            }
        },
        {
            id: 'c2',
            name: 'Influencer Batch A',
            channel: 'Influencer',
            spend: 2500,
            attributedWallets: 12,
            cpa: 208,
            retention: 40,
            valueCreated: 1200,
            roi: 0.48,
            status: 'Kill',
            aiSummary: ['Low conversion rate', 'High bounce rate', 'Audience mismatch'],
            anomalies: [],
            recommendation: {
                action: 'Kill',
                reasoning: ['ROI < 1x', 'CPA > $200', 'Negative sentiment detected'],
                confidence: 'High'
            }
        },
        {
            id: 'c3',
            name: 'DeFi Education Thread',
            channel: 'Twitter',
            spend: 150,
            attributedWallets: 28,
            cpa: 5.35,
            retention: 92,
            valueCreated: 5600,
            roi: 37.3,
            status: 'Scale',
            aiSummary: ['Organic viral reach', 'High bookmark rate', 'Strong wallet connection'],
            anomalies: [],
            recommendation: {
                action: 'Scale',
                reasoning: ['Extremely efficient CPA', 'High intent signal', 'Evergreen potential'],
                confidence: 'High'
            }
        },
        {
            id: 'c4',
            name: 'Discord AMA',
            channel: 'Discord',
            spend: 500,
            attributedWallets: 60,
            cpa: 8.33,
            retention: 78,
            valueCreated: 8000,
            roi: 16.0,
            status: 'Test',
            aiSummary: ['Solid community attendance', 'Complex attribution path'],
            anomalies: ['Attribution lag variable'],
            recommendation: {
                action: 'Test',
                reasoning: ['Good initial signals', 'Need 7 more days for retention data', 'Scale if retention > 70%'],
                confidence: 'Med'
            }
        }
    ];
};

// --- SUB-COMPONENTS ---

const StatusBadge = ({ status }: { status: DashboardCampaign['status'] }) => {
    const colors = {
        'Scale': 'bg-green-100 text-green-700 border-green-200',
        'Test': 'bg-blue-100 text-blue-700 border-blue-200',
        'Pause': 'bg-yellow-100 text-yellow-700 border-yellow-200',
        'Kill': 'bg-red-100 text-red-700 border-red-200'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${colors[status]}`}>
            {status}
        </span>
    );
};

const SmartSparkline = ({ data, color = "#10B981" }: { data: number[], color?: string }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const height = 30;
    const width = 60;

    // Create points string
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

// --- MAIN DASHBOARD ---

export const Dashboard: React.FC<DashboardProps> = ({
    brandName,
    socialMetrics,
    chainMetrics,
    growthReport,
    socialSignals,
    onNavigate
}) => {
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

    // Mock Data
    const kpis = useMemo(() => generateMockKPIs(socialMetrics, chainMetrics), [socialMetrics, chainMetrics]);
    const campaigns = useMemo(() => generateMockCampaigns(), []);

    const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

    // Sort Campaigns: ROI Descending by default
    const sortedCampaigns = [...campaigns].sort((a, b) => b.roi - a.roi);

    return (
        <div className="w-full h-full p-4 font-sans bg-gray-50/50 min-h-screen">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">Mission Control</h1>
                    <p className="text-[11px] text-gray-500 font-medium">Decision Console • {brandName}</p>
                </div>
                <div className="flex gap-2">
                    {/* "Insights" Tab Toggle (Simulated) */}
                    <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        View Insights
                    </button>
                    <button onClick={() => onNavigate('settings')} className="px-3 py-1.5 bg-black text-white rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors">
                        Sync Data
                    </button>
                </div>
            </div>

            {/* A) TOP KPI STRIP */}
            <div className="grid grid-cols-5 gap-4 mb-6">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between h-[110px] relative group overflow-hidden">
                        {/* Tooltip hint */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] bg-black text-white px-1 rounded">Conf: {kpi.confidence}</span>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{kpi.label}</span>
                            <div className="flex items-end gap-2 mt-1">
                                <span className="text-2xl font-bold text-gray-900 tracking-tighter">{kpi.value}</span>
                            </div>
                        </div>

                        <div className="flex items-end justify-between mt-2">
                            <div className={`flex items-center gap-1 text-[10px] font-bold ${kpi.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {kpi.delta > 0 ? '↑' : '↓'} {Math.abs(kpi.delta)}%
                                <span className="text-gray-300 font-normal ml-0.5">WoW</span>
                            </div>
                            <SmartSparkline data={kpi.sparklineData} color={kpi.delta >= 0 ? '#10B981' : '#EF4444'} />
                        </div>
                    </div>
                ))}
            </div>

            {/* B) MAIN BODY GRID */}
            <div className="grid grid-cols-12 gap-6 h-[600px]">

                {/* 1. CAMPAIGN TABLE (Main Feature) */}
                <div className={`${selectedCampaign ? 'col-span-8' : 'col-span-12'} transition-all duration-300 flex flex-col gap-4`}>
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex-1 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Campaign Performance</h3>
                            <div className="text-[10px] text-gray-400 font-medium">ROI sorted (Desc)</div>
                        </div>

                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 sticky top-0 z-10">
                                    <tr>
                                        {['Campaign', 'Channel', 'Spend', 'Attr. Wallets', 'CPA', 'Retention', 'Value Add', 'ROI', 'Decision'].map((h, i) => (
                                            <th key={i} className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {sortedCampaigns.map((row) => (
                                        <tr
                                            key={row.id}
                                            onClick={() => setSelectedCampaignId(selectedCampaignId === row.id ? null : row.id)}
                                            className={`group cursor-pointer transition-colors ${selectedCampaignId === row.id ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="px-4 py-3 text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                {row.name}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500 font-medium">{row.channel}</td>
                                            <td className="px-4 py-3 text-xs text-gray-900 font-mono">${row.spend.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-xs text-gray-900 font-mono">{row.attributedWallets}</td>
                                            <td className="px-4 py-3 text-xs font-mono font-medium">
                                                <span className={row.cpa < 10 ? 'text-green-600' : row.cpa > 50 ? 'text-red-500' : 'text-gray-600'}>
                                                    ${row.cpa.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 font-mono">{row.retention}%</td>
                                            <td className="px-4 py-3 text-xs text-gray-900 font-bold font-mono">+${row.valueCreated.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-xs font-bold font-mono">
                                                <span className={row.roi > 5 ? 'text-green-600' : row.roi < 1 ? 'text-red-500' : 'text-yellow-600'}>
                                                    {row.roi}x
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={row.status} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* COMMUNITY METRICS (Compact Row) */}
                    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-6 shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Community</span>
                        </div>
                        <div className="h-8 w-px bg-gray-100"></div>
                        <div className="flex items-center gap-8 flex-1">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-blue-50 rounded text-blue-500">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-gray-900">{safeVal(socialMetrics?.totalFollowers)}</div>
                                    <div className="text-[10px] text-green-600 font-semibold">+1.2% this week</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-indigo-50 rounded text-indigo-500">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.942 5.556a16.3 16.3 0 0 0-4.126-1.297c-.394.584-.546 1.155-.546 1.743-2.318.006-4.634.006-6.95 0-.002-.588-.154-1.159-.548-1.743-1.42.346-2.8.789-4.126 1.297C.585 10.156-1.47 23.33 2.53 27.97a15.42 15.42 0 0 0 4.966 2.51c1.192-1.605 2.128-3.393 2.768-5.27-.92-.353-1.802-.8-2.613-1.334.22-.162.434-.33.64-.509 4.314 2.012 8.943 2.012 13.25 0 .211.18.425.347.646.509-.811.535-1.693.981-2.613 1.334.64 1.877 1.576 3.665 2.768 5.27 1.796-.708 3.5-1.56 4.966-2.51 4-5.32 1.945-18.492-2.368-22.414z" /></svg>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-gray-900">8,420</div>
                                    <div className="text-[10px] text-gray-400 font-semibold">Stable</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-sky-50 rounded text-sky-500">
                                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10-10-4.477-10-10 4.477-10 10-10zm-1.801 16h4v-7h-4v7zm2-8.5c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2z" /></svg>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-gray-900">4,102</div>
                                    <div className="text-[10px] text-green-600 font-semibold">+5% Active</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. CONTEXT DRAWER (Right Panel) */}
                {
                    selectedCampaign && (
                        <div className="col-span-4 h-full animate-slideInRight">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-lg h-full p-6 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>

                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-bold text-gray-900">{selectedCampaign.name}</h2>
                                    <button onClick={() => setSelectedCampaignId(null)} className="text-gray-400 hover:text-black">
                                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                <div className="space-y-6 flex-1 overflow-y-auto">

                                    {/* AI Summary */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            AI Analysis
                                        </h4>
                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                            <ul className="space-y-2">
                                                {selectedCampaign.aiSummary.map((s, i) => (
                                                    <li key={i} className="text-xs text-blue-900 leading-relaxed flex items-start gap-2">
                                                        <span className="mt-1 text-blue-400">•</span>
                                                        {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Recommendation */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            Strategic Action
                                        </h4>
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-sm font-bold text-gray-900">Recommendation</div>
                                                <StatusBadge status={selectedCampaign.recommendation.action} />
                                            </div>
                                            <ul className="space-y-2 mb-4">
                                                {selectedCampaign.recommendation.reasoning.map((r, i) => (
                                                    <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                                                        <span className="text-green-500">✓</span>
                                                        {r}
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-50 p-2 rounded">
                                                <span className="font-bold">Confidence:</span>
                                                <span className={`font-bold ${selectedCampaign.recommendation.confidence === 'High' ? 'text-green-600' : 'text-yellow-600'}`}>
                                                    {selectedCampaign.recommendation.confidence}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Anomalies */}
                                    {selectedCampaign.anomalies.length > 0 && (
                                        <div>
                                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                Anomalies Detected
                                            </h4>
                                            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                                                <ul className="space-y-2">
                                                    {selectedCampaign.anomalies.map((s, i) => (
                                                        <li key={i} className="text-xs text-red-900 leading-relaxed font-medium">
                                                            ⚠️ {s}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {/* Action Footer */}
                                <div className="mt-6 pt-4 border-t border-gray-100 flex gap-2">
                                    <button className="flex-1 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors">
                                        Execute Action
                                    </button>
                                    <button className="flex-1 py-2 bg-white border border-gray-200 text-black text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors">
                                        Edit Campaign
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>

            {/* INSIGHTS DRAWER / COMPACT SECTION */}
            {growthReport && (
                <div className="mt-8 pt-6 border-t border-gray-200/50">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Daily Intelligence Brief</h4>
                    <ul className="space-y-2 max-w-3xl">
                        {growthReport.executiveSummary.split('.').slice(0, 3).map((line, i) => (
                            line.trim() && (
                                <li key={i} className="text-xs text-gray-500 flex items-start gap-3">
                                    <span className="w-1 h-1 rounded-full bg-gray-300 mt-1.5"></span>
                                    {line}.
                                </li>
                            )
                        ))}
                    </ul>
                </div>
            )}

        </div>
    );
};
