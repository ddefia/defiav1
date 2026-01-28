import React from 'react';
import { AnalysisReport, BrandConfig, CalendarEvent, ComputedMetrics, GrowthReport, SocialMetrics, SocialSignals, StrategyTask } from '../types';

interface MarketingBrainPanelProps {
    brandName: string;
    brandConfig: BrandConfig;
    calendarEvents: CalendarEvent[];
    socialMetrics: SocialMetrics | null;
    chainMetrics: ComputedMetrics | null;
    socialSignals: SocialSignals;
    tasks: StrategyTask[];
    growthReport?: GrowthReport | null;
    campaignsCount: number;
    briefReady: boolean;
    briefLoading: boolean;
    decisionSummary?: {
        analysis?: AnalysisReport | null;
        actionCount: number;
        lastUpdated?: number | null;
        agentInsights?: {
            agent: string;
            focus: string;
            summary: string;
            keySignals: string[];
        }[];
        inputCoverage?: {
            calendarItems: number;
            mentions: number;
            trends: number;
            knowledgeSignals: number;
            recentPosts: number;
        };
    };
}

const statusStyles: Record<string, string> = {
    ready: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    active: 'bg-blue-50 text-blue-700 border-blue-100',
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    missing: 'bg-rose-50 text-rose-700 border-rose-100'
};

const StatusPill = ({ label, tone }: { label: string; tone: string }) => (
    <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusStyles[tone] || statusStyles.pending}`}>
        {label}
    </span>
);

export const MarketingBrainPanel: React.FC<MarketingBrainPanelProps> = ({
    brandName,
    brandConfig,
    calendarEvents,
    socialMetrics,
    chainMetrics,
    socialSignals,
    tasks,
    growthReport,
    campaignsCount,
    briefReady,
    briefLoading,
    decisionSummary
}) => {
    const analysisSummary = decisionSummary?.analysis?.summary;
    const strategicAngle = decisionSummary?.analysis?.strategicAngle;
    const opportunities = decisionSummary?.analysis?.opportunities || [];
    const lastUpdatedLabel = decisionSummary?.lastUpdated
        ? new Date(decisionSummary.lastUpdated).toLocaleTimeString()
        : 'Not run yet';
    const inputCoverage = decisionSummary?.inputCoverage;
    const agentInsights = decisionSummary?.agentInsights || [];

    const inputSignals = [
        {
            label: 'Brand Profile',
            detail: brandConfig?.name ? `Synced as ${brandConfig.name}` : `Using ${brandName}`,
            tone: brandConfig?.name ? 'ready' : 'pending'
        },
        {
            label: 'Market Pulse',
            detail: `${socialSignals.activeNarratives.length} active narratives • Sentiment ${socialSignals.sentimentScore}`,
            tone: 'active'
        },
        {
            label: 'Social Metrics',
            detail: socialMetrics ? `${socialMetrics.weeklyImpressions.toLocaleString()} impressions` : 'Awaiting connection',
            tone: socialMetrics ? 'ready' : 'pending'
        },
        {
            label: 'Onchain Metrics',
            detail: chainMetrics ? `$${chainMetrics.totalVolume.toLocaleString()} volume` : 'Connect wallet analytics',
            tone: chainMetrics ? 'ready' : 'missing'
        },
        {
            label: 'Content Calendar',
            detail: `${calendarEvents.length} scheduled items`,
            tone: calendarEvents.length ? 'active' : 'pending'
        }
    ];

    const outputSignals = [
        {
            label: 'Strategic Actions',
            detail: `${decisionSummary?.actionCount ?? tasks.length} prioritized moves`,
            tone: (decisionSummary?.actionCount ?? tasks.length) ? 'ready' : 'pending'
        },
        {
            label: 'Growth Report',
            detail: growthReport?.lastUpdated ? `Updated ${new Date(growthReport.lastUpdated).toLocaleDateString()}` : 'No report yet',
            tone: growthReport ? 'ready' : 'pending'
        },
        {
            label: 'Campaign Priorities',
            detail: `${campaignsCount} live campaigns`,
            tone: campaignsCount ? 'active' : 'pending'
        },
        {
            label: 'Daily Brief',
            detail: briefLoading ? 'Generating now' : briefReady ? 'Ready for review' : 'Not generated yet',
            tone: briefReady ? 'ready' : briefLoading ? 'active' : 'pending'
        }
    ];

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold">Main Marketing Brain</div>
                    <h2 className="text-2xl font-display font-bold text-gray-900 mt-2">Unified Decision Core</h2>
                    <p className="text-sm text-gray-500 mt-2 max-w-2xl">
                        Aggregates every signal across social, onchain, and brand memory to output decisive moves, recommendations, and execution-ready actions.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">Brain Active</span>
                    </div>
                    <StatusPill label="Decision Loop" tone="active" />
                </div>
            </div>

            <div className="mt-6 border border-dashed border-gray-200 rounded-xl p-4 bg-gradient-to-r from-white via-gray-50 to-white">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">Decision Process</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">Analyst → Strategist → Executor</div>
                        <div className="text-xs text-gray-500 mt-1">
                            {analysisSummary ? analysisSummary : 'Waiting on the next market analysis run.'}
                        </div>
                    </div>
                    <StatusPill label={analysisSummary ? 'Running' : 'Standby'} tone={analysisSummary ? 'active' : 'pending'} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-gray-600">
                    <div className="bg-white border border-gray-100 rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-widest text-gray-400">Strategic Angle</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">{strategicAngle || 'TBD'}</div>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-widest text-gray-400">Opportunities</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">
                            {opportunities.length ? opportunities.slice(0, 2).join(' • ') : 'Awaiting signal'}
                        </div>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-widest text-gray-400">Last Loop</div>
                        <div className="text-sm font-semibold text-gray-900 mt-1">{lastUpdatedLabel}</div>
                    </div>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Inputs Wired</h3>
                        <StatusPill label="Live" tone="active" />
                    </div>
                    <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                            <span>Content Calendar</span>
                            <span className="font-semibold text-gray-900">{inputCoverage?.calendarItems ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Upcoming Mentions</span>
                            <span className="font-semibold text-gray-900">{inputCoverage?.mentions ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Trend Signals</span>
                            <span className="font-semibold text-gray-900">{inputCoverage?.trends ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Knowledge Signals</span>
                            <span className="font-semibold text-gray-900">{inputCoverage?.knowledgeSignals ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Recent Posts</span>
                            <span className="font-semibold text-gray-900">{inputCoverage?.recentPosts ?? 0}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50/60 border border-gray-100 rounded-xl p-4 lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Agent Council</h3>
                        <StatusPill label={agentInsights.length ? 'Running' : 'Standby'} tone={agentInsights.length ? 'active' : 'pending'} />
                    </div>
                    <div className="space-y-3">
                        {agentInsights.length === 0 && (
                            <div className="text-xs text-gray-500">Run the decision loop to see agent summaries.</div>
                        )}
                        {agentInsights.map((insight) => (
                            <div key={insight.agent} className="bg-white border border-gray-100 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-gray-900">{insight.agent}</div>
                                    <span className="text-[10px] uppercase tracking-widest text-gray-400">{insight.focus}</span>
                                </div>
                                <p className="text-xs text-gray-600 mt-2">{insight.summary}</p>
                                {insight.keySignals.length > 0 && (
                                    <div className="mt-2 text-[10px] text-gray-500">
                                        Signals: {insight.keySignals.slice(0, 3).join(' • ')}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="bg-gray-50/60 border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Input Signals</h3>
                        <StatusPill label="Live" tone="active" />
                    </div>
                    <div className="space-y-3">
                        {inputSignals.map(signal => (
                            <div key={signal.label} className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">{signal.label}</div>
                                    <div className="text-xs text-gray-500 mt-1">{signal.detail}</div>
                                </div>
                                <StatusPill label={signal.tone === 'ready' ? 'Synced' : signal.tone === 'missing' ? 'Missing' : signal.tone === 'active' ? 'Active' : 'Pending'} tone={signal.tone} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-50/60 border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Decision Outputs</h3>
                        <StatusPill label="Guided" tone="ready" />
                    </div>
                    <div className="space-y-3">
                        {outputSignals.map(signal => (
                            <div key={signal.label} className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">{signal.label}</div>
                                    <div className="text-xs text-gray-500 mt-1">{signal.detail}</div>
                                </div>
                                <StatusPill label={signal.tone === 'ready' ? 'Ready' : signal.tone === 'active' ? 'Live' : 'Pending'} tone={signal.tone} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
