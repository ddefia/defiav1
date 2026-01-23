import React, { useState, useMemo } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals, DashboardCampaign, KPIItem, CommunitySignal } from '../types';

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

// --- MOCK DATA GENERATORS ---
const generateMockKPIs = (metrics: SocialMetrics | null, chain: ComputedMetrics | null): KPIItem[] => {
    return [
        {
            label: 'Spend (7d)',
            value: '$4,250',
            delta: 12,
            trend: 'up',
            confidence: 'High',
            statusLabel: 'Watch',
            sparklineData: [3000, 3200, 3100, 3500, 4000, 4100, 4250]
        },
        {
            label: 'Attr. Wallets',
            value: chain?.netNewWallets ? chain.netNewWallets.toLocaleString() : '142',
            delta: 8.5,
            trend: 'up',
            confidence: 'Med',
            statusLabel: 'Strong',
            sparklineData: [80, 95, 88, 110, 125, 130, 142]
        },
        {
            label: 'CPA (Average)',
            value: '$32.10',
            delta: -5.2,
            trend: 'down',
            confidence: 'High',
            statusLabel: 'Strong',
            sparklineData: [45, 42, 40, 38, 35, 33, 32.10]
        },
        {
            label: 'Value (TVL)',
            value: chain?.tvlChange ? `+$${(chain.tvlChange / 1000).toFixed(1)}k` : '+$450k',
            delta: 24,
            trend: 'up',
            confidence: 'Low',
            statusLabel: 'Strong',
            sparklineData: [300, 320, 310, 380, 410, 430, 450]
        },
        {
            label: 'Defia Index',
            value: '7.8',
            delta: 1.2,
            trend: 'up',
            confidence: 'High',
            statusLabel: 'Strong',
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
            trendSignal: 'up',
            confidence: 'High',
            aiSummary: ['Viral mechanic working', 'High influencer participation'],
            anomalies: [],
            recommendation: {
                action: 'Scale',
                reasoning: ['ROI is 12x', 'CPA is low'],
                confidence: 'High',
                riskFactors: ['Bot traffic potential']
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
            trendSignal: 'down',
            confidence: 'High',
            aiSummary: ['Poor conversion', 'High cost'],
            anomalies: [],
            recommendation: {
                action: 'Kill',
                reasoning: ['ROI < 1', 'CPA unsustainable'],
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
            trendSignal: 'up',
            confidence: 'High',
            aiSummary: ['Top organic performer'],
            anomalies: [],
            recommendation: {
                action: 'Scale',
                reasoning: ['Best CPA', 'High retention'],
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
            trendSignal: 'flat',
            confidence: 'Med',
            aiSummary: ['Solid engagement'],
            anomalies: [],
            recommendation: {
                action: 'Test',
                reasoning: ['Need more data'],
                confidence: 'Med'
            }
        }
    ];
};

const generateMockSignals = (): CommunitySignal[] => [
    { platform: 'Telegram', signal: '+5% active (7d) → high retention', trend: 'up', sentiment: 'Positive' },
    { platform: 'Discord', signal: 'Inactive 3d → risk to retention', trend: 'flat', sentiment: 'Neutral' },
    { platform: 'Twitter', signal: 'Impressions ↓ 12% → needs hook', trend: 'down', sentiment: 'Negative' }
];


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
    socialMetrics,
    chainMetrics,
    calendarEvents,
    onNavigate
}) => {
    // Mock Data
    const kpis = useMemo(() => generateMockKPIs(socialMetrics, chainMetrics), [socialMetrics, chainMetrics]);
    const campaigns = useMemo(() => generateMockCampaigns(), []);
    const signals = useMemo(() => generateMockSignals(), []);

    const upcomingContent = calendarEvents
        .filter(e => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);

    // Filter Logic for "Today's Calls"
    const todaysCalls = campaigns.filter(c => c.status === 'Scale' || c.status === 'Kill' || c.status === 'Test');

    return (
        <div className="w-full h-full p-6 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        DEFIA COMMAND <span className="text-gray-400">/</span> {brandName}
                    </h1>
                </div>
                <div className="text-[10px] bg-white border border-gray-200 px-3 py-1 rounded-full font-mono text-gray-500">
                    STATUS: ONLINE • {new Date().toLocaleTimeString()}
                </div>
            </div>

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
                                                <td className="px-4 py-3">
                                                    <div className="text-xs font-bold text-gray-900 group-hover:text-blue-600">{c.name}</div>
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

                    {/* LANE 3: CONTENT & COMMUNITY ("What's coming") */}
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

                        {/* Community Signals */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                Community Signals
                            </h3>
                            <div className="space-y-3">
                                {signals.map((s, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className={`mt-1 text-[10px] ${s.trend === 'up' ? 'text-emerald-500' : s.trend === 'down' ? 'text-rose-500' : 'text-gray-400'}`}>
                                            {s.trend === 'up' ? '▲' : s.trend === 'down' ? '▼' : '●'}
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

                {/* LANE 2 (RIGHT): DECISIONS & INTELLIGENCE ("What should we do") */}
                <div className="col-span-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full flex flex-col sticky top-6">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Today's Calls</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {todaysCalls.map((c, i) => (
                                <div key={i} className="group">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors cursor-pointer">
                                            {c.recommendation.action} {c.name}
                                        </div>
                                        <StatusBadge status={c.recommendation.action} />
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 mb-2">
                                        <ul className="space-y-1.5">
                                            {c.recommendation.reasoning.slice(0, 2).map((r, ri) => (
                                                <li key={ri} className="text-xs text-gray-600 flex items-start gap-2">
                                                    <span className="mt-1 w-1 h-1 rounded-full bg-gray-400"></span>
                                                    {r}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className={`text-[9px] font-bold uppercase border px-1.5 rounded ${c.recommendation.confidence === 'High' ? 'text-emerald-600 border-emerald-100 bg-emerald-50' : 'text-amber-600 border-amber-100 bg-amber-50'
                                            }`}>
                                            {c.recommendation.confidence} Confidence
                                        </span>
                                        {c.recommendation.riskFactors && c.recommendation.riskFactors.length > 0 && (
                                            <div className="group relative cursor-help">
                                                <span className="text-[9px] text-gray-400 font-medium hover:text-rose-500 transition-colors">
                                                    Risk: Low
                                                </span>
                                                {/* Simple Tooltip */}
                                                <div className="absolute bottom-full right-0 mb-1 w-32 p-2 bg-black text-white text-[9px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                    {c.recommendation.riskFactors[0]}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {i < todaysCalls.length - 1 && <div className="h-px bg-gray-100 mt-6"></div>}
                                </div>
                            ))}

                            {/* Empty State */}
                            {todaysCalls.length === 0 && (
                                <div className="text-center py-10 text-gray-400 text-xs">
                                    No critical actions pending.
                                </div>
                            )}

                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button className="w-full py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors uppercase tracking-wide">
                                Execute All Approved
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
