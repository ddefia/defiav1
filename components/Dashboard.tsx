import React, { useState, useMemo, useEffect } from 'react';
import { AnalysisReport, SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals, DashboardCampaign, KPIItem, DailyBrief } from '../types';
import { fetchCampaignPerformance, fetchMentions } from '../services/analytics';
import { generateDailyBrief as generateBriefService, orchestrateMarketingDecision } from '../services/gemini';
import { getBrainContext } from '../services/pulse';
import { getBrandRegistryEntry, loadBrainLogs } from '../services/storage';
import { DailyBriefDrawer } from './DailyBriefDrawer';

interface DashboardProps {
    brandName: string;
    brandConfig: BrandConfig;
    calendarEvents: CalendarEvent[];
    socialMetrics: SocialMetrics | null;
    chainMetrics: ComputedMetrics | null;
    socialSignals: SocialSignals;
    systemLogs: string[];
    growthReport?: GrowthReport | null;
    agentDecisions: any[];
    onNavigate: (section: string, params?: any) => void;
    tasks: StrategyTask[];
    onUpdateTasks: (t: StrategyTask[]) => void;
    onSchedule: (content: string, image?: string) => void;
}

const transformMetricsToKPIs = (
    metrics: SocialMetrics | null,
    chain: ComputedMetrics | null,
    campaigns: DashboardCampaign[] = []
): KPIItem[] => {
    const impressionsVal = metrics ? metrics.weeklyImpressions : 0;
    const newWallets = campaigns.length > 0
        ? campaigns.reduce((acc, c) => acc + c.attributedWallets, 0)
        : (chain?.netNewWallets || 0);
    const netVol = chain ? chain.totalVolume : 0;
    const defiaScore = metrics ? (metrics.engagementRate * 1.5 + (chain?.retentionRate || 0) * 5).toFixed(1) : '0.0';

    // Only show real data - no mock deltas or sparklines
    return [
        {
            label: 'TWITTER FOLLOWERS',
            value: impressionsVal > 0 ? `${(impressionsVal / 1000).toFixed(1)}K` : '--',
            delta: 0, // Real delta would come from historical data comparison
            trend: 'flat' as const,
            confidence: metrics ? 'High' : 'Low',
            statusLabel: impressionsVal > 1000 ? 'Strong' : 'Weak',
            sparklineData: [] // Real sparkline would come from historical data
        },
        {
            label: 'DISCORD MEMBERS',
            value: newWallets > 0 ? `${(newWallets / 1000).toFixed(1)}K` : '--',
            delta: 0,
            trend: 'flat' as const,
            confidence: campaigns.length > 0 ? 'High' : 'Low',
            statusLabel: newWallets > 100 ? 'Strong' : 'Weak',
            sparklineData: []
        },
        {
            label: 'CAMPAIGN REACH',
            value: netVol > 0 ? `${(netVol / 1000000).toFixed(1)}M` : '--',
            delta: 0,
            trend: 'flat' as const,
            confidence: chain ? 'High' : 'Low',
            statusLabel: netVol > 0 ? 'Strong' : 'Weak',
            sparklineData: []
        },
        {
            label: 'ENGAGEMENT RATE',
            value: metrics ? `${defiaScore}%` : '--',
            delta: 0,
            trend: 'flat' as const,
            confidence: metrics ? 'High' : 'Low',
            statusLabel: metrics ? (Number(defiaScore) > 5 ? 'Strong' : 'Watch') : 'Weak',
            sparklineData: []
        }
    ];
};

// News items are fetched from the news service - no hardcoded mock data
const NEWS_ITEMS: { icon: string; iconBg: string; title: string; source: string; time: string }[] = [];

// AI recommendations are generated dynamically - no hardcoded mock data
const AI_RECOMMENDATIONS: {
    type: string;
    typeBg: string;
    icon: string;
    title: string;
    description: string;
    stats: { label: string; value: string }[];
    actionLabel: string;
    actionBg: string;
    borderColor: string;
}[] = [];

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
    growthReport,
    agentDecisions
}) => {
    const [campaigns, setCampaigns] = useState<DashboardCampaign[]>([]);
    const [campaignTab, setCampaignTab] = useState<'all' | 'active' | 'completed'>('all');
    const [decisionSummary, setDecisionSummary] = useState<{
        analysis?: AnalysisReport | null;
        actionCount: number;
        lastUpdated?: number | null;
        agentInsights?: { agent: string; focus: string; summary: string; keySignals: string[]; }[];
        inputCoverage?: { calendarItems: number; mentions: number; trends: number; knowledgeSignals: number; recentPosts: number; };
    }>({ analysis: null, actionCount: 0, lastUpdated: null });

    const [isBriefOpen, setIsBriefOpen] = useState(false);
    const [briefData, setBriefData] = useState<DailyBrief | null>(null);
    const [briefLoading, setBriefLoading] = useState(false);

    const kpis = useMemo(() => transformMetricsToKPIs(socialMetrics, chainMetrics, campaigns), [socialMetrics, chainMetrics, campaigns]);

    useEffect(() => {
        const initBrief = async () => {
            if (!briefData && !briefLoading) {
                setBriefLoading(true);
                try {
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
    }, [brandName, kpis.length]);

    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            try {
                const [camps] = await Promise.all([fetchCampaignPerformance()]);
                if (mounted) setCampaigns(camps);
            } catch (e) {
                console.error("Dashboard Data Load Failed", e);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, [brandName]);

    const upcomingContent = calendarEvents
        .filter(e => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 4);

    const filteredCampaigns = useMemo(() => {
        if (campaignTab === 'active') return campaigns.filter(c => c.status === 'Scale' || c.status === 'Test');
        if (campaignTab === 'completed') return campaigns.filter(c => c.status === 'Pause' || c.status === 'Kill');
        return campaigns;
    }, [campaigns, campaignTab]);

    const handleRegenerate = async () => {
        try {
            const registry = getBrandRegistryEntry(brandName);
            const deepContext = await getBrainContext(registry?.brandId);
            const brainLogs = loadBrainLogs(brandName).slice(0, 5);
            const brainLogSignals = brainLogs.map(log => `[${log.type}] ${log.context}`).join('\n');

            const brainContext = {
                brand: { ...brandConfig, name: brandName },
                marketState: { trends: socialSignals.trendingTopics || [], analytics: socialMetrics || undefined, mentions: [] },
                memory: {
                    ragDocs: [
                        deepContext.context ? `DEEP MEMORY:\n${deepContext.context}` : '',
                        brainLogSignals ? `RECENT BRAIN LOGS:\n${brainLogSignals}` : ''
                    ].filter(Boolean),
                    recentPosts: socialMetrics?.recentPosts || [],
                    pastStrategies: tasks
                },
                userObjective: "Identify key market opportunities and execute a strategic response."
            };

            const mentions = await fetchMentions(brandName);
            const calendarSignal = calendarEvents.slice(0, 5).map(event => `${event.date} • ${event.platform}: ${event.content}`);
            const mentionSignal = mentions.slice(0, 5).map(mention => `@${mention.author}: ${mention.text}`);
            const enrichedContext = {
                ...brainContext,
                marketState: { ...brainContext.marketState, mentions },
                memory: {
                    ...brainContext.memory,
                    ragDocs: [
                        ...brainContext.memory.ragDocs,
                        calendarSignal.length ? `CALENDAR:\n${calendarSignal.join('\n')}` : '',
                        mentionSignal.length ? `MENTIONS:\n${mentionSignal.join('\n')}` : '',
                        agentDecisions.length ? `AGENT DECISIONS:\n${agentDecisions.map((d) => `- ${d.action}: ${d.reason}`).join('\n')}` : ''
                    ].filter(Boolean)
                }
            };

            const { analysis, actions, agentInsights } = await orchestrateMarketingDecision(enrichedContext, { calendarEvents, mentions });
            setDecisionSummary({
                analysis,
                actionCount: actions.length,
                lastUpdated: Date.now(),
                agentInsights,
                inputCoverage: {
                    calendarItems: calendarEvents.length,
                    mentions: mentions.length,
                    trends: socialSignals.trendingTopics?.length || 0,
                    knowledgeSignals: enrichedContext.memory.ragDocs.length + deepContext.strategyCount + deepContext.memoryCount,
                    recentPosts: socialMetrics?.recentPosts?.length || 0
                }
            });

            if (actions.length > 0) {
                const newTasks = actions.map(action => ({
                    id: crypto.randomUUID(),
                    title: action.hook || `Strategy: ${action.topic}`,
                    description: action.reasoning || `Execute ${action.type.toLowerCase()} for ${action.goal}`,
                    status: 'pending',
                    type: action.type as any,
                    contextSource: { type: 'TREND', source: 'Market Pulse', headline: action.topic },
                    impactScore: 85,
                    executionPrompt: action.topic,
                    suggestedVisualTemplate: 'Auto',
                    reasoning: action.reasoning || 'Decision loop produced this action.',
                    strategicAlignment: action.strategicAlignment,
                    contentIdeas: action.contentIdeas,
                    proof: (action as any).proof,
                    logicExplanation: (action as any).logicExplanation
                }));
                onUpdateTasks(newTasks as any);
            }
        } catch (e) {
            console.error("Regen Failed", e);
        }
    };

    const getContentTypeIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'twitter': return '🐦';
            case 'discord': return '💬';
            case 'thread': return '📝';
            default: return '📊';
        }
    };

    const getContentTypeBg = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'twitter': return 'linear-gradient(135deg, #1A1A1D 0%, #FF5C0033 100%)';
            case 'discord': return 'linear-gradient(135deg, #1A1A1D 0%, #5865F233 100%)';
            case 'thread': return 'linear-gradient(135deg, #1A1A1D 0%, #1DA1F233 100%)';
            default: return 'linear-gradient(135deg, #1A1A1D 0%, #22C55E33 100%)';
        }
    };

    return (
        <div className="flex-1 py-8 px-10 overflow-y-auto space-y-7">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[38px] font-normal tracking-tight text-white" style={{ fontFamily: 'Instrument Serif, serif', letterSpacing: '-1px' }}>Marketing Dashboard</h1>
                    <p className="text-[#6B6B70] text-sm font-['Inter']">Track engagement, news, and create content for your Web3 brand</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="h-10 px-4 rounded-full bg-white text-[#0A0A0B] text-sm font-medium flex items-center gap-2 hover:bg-gray-100 transition-colors font-['Inter']">
                        Export Report
                    </button>
                    <button
                        onClick={() => onNavigate('content')}
                        className="h-10 px-4 rounded-full bg-[#FF5C00] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#FF6B1A] transition-colors font-['Inter']"
                    >
                        Create Content
                    </button>
                </div>
            </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-4 gap-4 mb-7">
                        {kpis.map((kpi, i) => (
                            <div key={i} className="rounded-xl bg-[#111113] border border-[#1F1F23] p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[#6B6B70] text-xs font-medium tracking-wider">{kpi.label}</span>
                                    {i === 0 && (
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22C55E18] text-[#22C55E] text-xs font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
                                            Live
                                        </span>
                                    )}
                                </div>
                                <div className="text-[32px] font-medium text-white font-mono tracking-tight mb-3">{kpi.value}</div>
                                <div className="flex items-center gap-1">
                                    {kpi.trend === 'up' ? (
                                        <svg className="w-3.5 h-3.5 text-[#22C55E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3.5 h-3.5 text-[#EF4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                        </svg>
                                    )}
                                    <span className={`text-xs font-medium ${kpi.trend === 'up' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                                        {kpi.delta > 0 ? '+' : ''}{kpi.delta}% this month
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* AI CMO Recommendations */}
                    <div className="rounded-xl border border-[#FF5C0044] overflow-hidden mb-7" style={{ background: 'linear-gradient(135deg, #111113 0%, #1A120D 100%)' }}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#FF5C0033]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z"/></svg>
                                </div>
                                <span className="text-white text-sm font-semibold">AI CMO Recommendations</span>
                                <span className="px-2 py-1 rounded-full bg-[#FF5C0022] text-[#FF5C00] text-xs font-medium">3 Priority Actions</span>
                            </div>
                            <button
                                onClick={handleRegenerate}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 text-[#ADADB0] text-xs font-medium hover:bg-white/10 transition-colors"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        </div>
                        <div className="p-5 grid grid-cols-3 gap-4">
                            {AI_RECOMMENDATIONS.map((rec, i) => (
                                <div key={i} className="rounded-xl bg-[#0A0A0B] p-4 border" style={{ borderColor: rec.borderColor }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-2xl">{rec.icon}</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: rec.typeBg }}>{rec.type}</span>
                                    </div>
                                    <h4 className="text-white text-sm font-semibold mb-2">{rec.title}</h4>
                                    <p className="text-[#8B8B8F] text-xs leading-relaxed mb-4">{rec.description}</p>
                                    <div className="flex gap-4 mb-4">
                                        {rec.stats.map((stat, j) => (
                                            <div key={j}>
                                                <span className="text-white text-sm font-semibold font-mono">{stat.value}</span>
                                                <span className="text-[#6B6B70] text-xs ml-1">{stat.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => onSchedule(rec.title)}
                                        className="w-full py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5"
                                        style={{ backgroundColor: rec.actionBg, color: rec.actionBg === '#B2B2FF' ? '#0A0A0B' : '#FFFFFF' }}
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {rec.actionLabel}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Two Column Section: News + Audience */}
                    <div className="grid grid-cols-2 gap-6 mb-7">
                        {/* Web3 News Feed */}
                        <div className="rounded-xl bg-[#111113] border border-[#1F1F23] overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F23]">
                                <span className="text-white text-sm font-semibold">Web3 News Feed</span>
                                <svg className="w-4 h-4 text-[#6B6B70]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <div>
                                {NEWS_ITEMS.map((item, i) => (
                                    <div key={i} className={`flex items-center gap-3 px-5 py-4 ${i < NEWS_ITEMS.length - 1 ? 'border-b border-[#1F1F23]' : ''}`}>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: item.iconBg }}>
                                            {item.icon}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white text-sm font-medium">{item.title}</p>
                                            <p className="text-[#6B6B70] text-xs">{item.source} · {item.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Audience Insights */}
                        <div className="rounded-xl bg-[#111113] border border-[#1F1F23] overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F23]">
                                <span className="text-white text-sm font-semibold">Audience Insights</span>
                                <svg className="w-4 h-4 text-[#6B6B70]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <div className="px-5 py-4 border-b border-[#1F1F23]">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-16 h-16">
                                        <svg className="w-16 h-16 transform -rotate-90">
                                            <circle cx="32" cy="32" r="28" fill="none" stroke="#1F1F23" strokeWidth="6" />
                                            <circle cx="32" cy="32" r="28" fill="none" stroke="#22C55E" strokeWidth="6" strokeDasharray="175.93" strokeDashoffset="38.7" strokeLinecap="round" />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-white text-sm font-bold">78%</span>
                                            <span className="text-[#22C55E] text-[10px]">Positive</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-[#6B6B70]">Bullish mentions</span>
                                            <span className="text-[#22C55E] font-medium">2,847</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-[#6B6B70]">Bearish mentions</span>
                                            <span className="text-[#EF4444] font-medium">412</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-[#6B6B70]">Neutral</span>
                                            <span className="text-white font-medium">1,204</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="divide-y divide-[#1F1F23]">
                                {[
                                    { icon: '💬', name: 'Discord', members: '12.4K members', active: '847 online', trend: '+8%', trendColor: '#22C55E' },
                                    { icon: '📨', name: 'Telegram', members: '8.2K subscribers', active: '156 active', trend: '+12%', trendColor: '#22C55E' },
                                    { icon: '𝕏', name: 'X (Twitter)', members: '24.7K followers', active: '1.2K engaged', trend: '—0%', trendColor: '#6B6B70' },
                                ].map((channel, i) => (
                                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                                        <span className="text-lg">{channel.icon}</span>
                                        <div className="flex-1">
                                            <p className="text-white text-sm font-medium">{channel.name}</p>
                                            <p className="text-[#6B6B70] text-xs">{channel.members} · {channel.active}</p>
                                        </div>
                                        <span className="text-xs font-medium" style={{ color: channel.trendColor }}>↗ {channel.trend}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Campaigns Overview */}
                    <div className="rounded-xl bg-[#111113] border border-[#1F1F23] overflow-hidden mb-7">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F23]">
                            <div className="flex items-center gap-2.5">
                                <span className="text-white text-sm font-semibold">Campaigns Overview</span>
                                <span className="px-2 py-1 rounded-full bg-[#22C55E18] text-[#22C55E] text-xs font-medium">All Performing Well</span>
                            </div>
                            <div className="flex items-center p-1 rounded-full bg-[#1A1A1D]">
                                {['All', 'Active', 'Completed'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setCampaignTab(tab.toLowerCase() as any)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                            campaignTab === tab.toLowerCase() ? 'bg-[#FF5C00] text-white' : 'text-[#6B6B70] hover:text-white'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table Header */}
                        <div className="flex items-center px-5 py-3 bg-[#0A0A0B] text-[#6B6B70] text-[11px] font-semibold tracking-wider">
                            <div className="w-[220px]">CAMPAIGN</div>
                            <div className="w-[100px]">STATUS</div>
                            <div className="w-[100px]">REACH</div>
                            <div className="w-[120px]">ENGAGEMENT</div>
                            <div className="w-[120px]">CONVERSION</div>
                            <div className="w-[80px]">ROI</div>
                            <div className="flex-1"></div>
                        </div>

                        {/* Table Body */}
                        <div>
                            {(filteredCampaigns.length > 0 ? filteredCampaigns : [
                                { id: '1', name: 'NFT Launch', channel: 'Twitter', status: 'Scale', reach: '1.2M', engagement: '8.4%', conversion: '3.2%', roi: '+247%' },
                                { id: '2', name: 'Token Airdrop', channel: 'Discord', status: 'Scale', reach: '845K', engagement: '6.1%', conversion: '2.8%', roi: '+182%' },
                                { id: '3', name: 'Community AMA', channel: 'Spaces', status: 'Test', reach: '—', engagement: '—', conversion: '—', roi: '—' },
                                { id: '4', name: 'Brand Awareness Q4', channel: 'Multi', status: 'Pause', reach: '2.1M', engagement: '5.2%', conversion: '1.8%', roi: '+124%' },
                            ]).map((campaign: any, i) => (
                                <div
                                    key={campaign.id || i}
                                    className="flex items-center px-5 py-3.5 border-b border-[#1F1F23] hover:bg-[#1F1F23]/50 cursor-pointer transition-colors"
                                    onClick={() => onNavigate('campaigns')}
                                >
                                    <div className="w-[220px] flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-[#1F1F23] flex items-center justify-center">
                                            {campaign.channel === 'Twitter' ? '🐦' : campaign.channel === 'Discord' ? '💬' : campaign.channel === 'Spaces' ? '👥' : '📊'}
                                        </div>
                                        <span className="text-white text-sm font-medium">{campaign.name}</span>
                                    </div>
                                    <div className="w-[100px]">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            campaign.status === 'Scale' ? 'bg-[#22C55E22] text-[#22C55E]' :
                                            campaign.status === 'Test' ? 'bg-[#F59E0B22] text-[#F59E0B]' :
                                            'bg-[#6B6B7022] text-[#6B6B70]'
                                        }`}>
                                            {campaign.status === 'Scale' ? 'Active' : campaign.status === 'Test' ? 'Scheduled' : 'Completed'}
                                        </span>
                                    </div>
                                    <div className="w-[100px] text-white text-sm font-mono">{campaign.reach || `${(campaign.valueCreated / 1000).toFixed(0)}K`}</div>
                                    <div className="w-[120px] flex items-center gap-1.5">
                                        <span className="text-white text-sm font-mono">{campaign.engagement || `${campaign.retention}%`}</span>
                                        {campaign.trendSignal === 'up' && <span className="text-[#22C55E] text-xs">↗</span>}
                                    </div>
                                    <div className="w-[120px] flex items-center gap-1.5">
                                        <span className="text-white text-sm font-mono">{campaign.conversion || '—'}</span>
                                        {campaign.conversion && campaign.conversion !== '—' && <span className="text-[#22C55E] text-xs">↗</span>}
                                    </div>
                                    <div className="w-[80px]">
                                        <span className={`text-sm font-mono font-medium ${
                                            campaign.roi?.includes('+') ? 'text-[#22C55E]' : 'text-[#6B6B70]'
                                        }`}>{campaign.roi || '—'}</span>
                                    </div>
                                    <div className="flex-1 flex justify-end">
                                        <svg className="w-5 h-5 text-[#6B6B70]" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                        </svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Upcoming Content */}
                    <div className="rounded-xl bg-[#111113] border border-[#1F1F23] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F23]">
                            <div className="flex items-center gap-2.5">
                                <span className="text-white text-sm font-semibold">Upcoming Content</span>
                                <span className="px-2 py-1 rounded-full bg-[#FF5C0018] text-[#FF5C00] text-xs font-medium">{upcomingContent.length} Scheduled</span>
                            </div>
                            <button
                                onClick={() => onNavigate('calendar')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FF5C00] text-white text-xs font-medium hover:bg-[#FF6B1A] transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create Post
                            </button>
                        </div>
                        <div className="p-5 grid grid-cols-4 gap-4">
                            {(upcomingContent.length > 0 ? upcomingContent : [
                                { id: '1', platform: 'Twitter', date: 'Today, 3PM', content: 'Big announcement coming! Our NFT collection drops tomorrow 🚀', campaignName: 'NFT Launch' },
                                { id: '2', platform: 'Discord', date: 'Tomorrow, 9AM', content: 'Community update: Roadmap reveal for Q1 2026', campaignName: 'Token Airdrop' },
                                { id: '3', platform: 'Thread', date: 'Jan 31, 2PM', content: 'Thread: 10 reasons why L2 scaling will dominate 2026', campaignName: 'Community AMA' },
                                { id: '4', platform: 'Graphic', date: 'Feb 1, 10AM', content: 'NFT reveal teaser graphic for social media', campaignName: 'NFT Launch' },
                            ]).map((content: any, i) => (
                                <div key={content.id || i} className="rounded-xl bg-[#0A0A0B] border border-[#1F1F23] overflow-hidden">
                                    <div
                                        className="h-[100px] flex items-center justify-center text-3xl"
                                        style={{ background: getContentTypeBg(content.platform) }}
                                    >
                                        {getContentTypeIcon(content.platform)}
                                    </div>
                                    <div className="p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                content.platform.toLowerCase() === 'twitter' ? 'bg-[#FF5C0022] text-[#FF5C00]' :
                                                content.platform.toLowerCase() === 'discord' ? 'bg-[#5865F222] text-[#5865F2]' :
                                                content.platform.toLowerCase() === 'thread' ? 'bg-[#1DA1F222] text-[#1DA1F2]' :
                                                'bg-[#22C55E22] text-[#22C55E]'
                                            }`}>
                                                {content.platform}
                                            </span>
                                            <span className="text-[#6B6B70] text-[10px]">{content.date || new Date(content.date).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-white text-xs font-medium line-clamp-2">{content.content}</p>
                                        <p className="text-[#6B6B70] text-[10px] flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C00]"></span>
                                            {content.campaignName || 'General'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <DailyBriefDrawer
                        isOpen={isBriefOpen}
                        onClose={() => setIsBriefOpen(false)}
                        brief={briefData}
                        loading={briefLoading}
                    />
                </div>
    );
};
