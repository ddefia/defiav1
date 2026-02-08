import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AnalysisReport, SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals, DashboardCampaign, KPIItem, DailyBrief } from '../types';
import { fetchCampaignPerformance, fetchMentions } from '../services/analytics';
import { generateDailyBrief as generateBriefService, orchestrateMarketingDecision } from '../services/gemini';
import { getBrainContext } from '../services/pulse';
import { getBrandRegistryEntry, loadBrainLogs, loadCampaignState, saveDecisionLoopLastRun } from '../services/storage';
import { DailyBriefDrawer } from './DailyBriefDrawer';
import { SkeletonKPICard, SkeletonBriefCard, SkeletonNewsItem } from './Skeleton';

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

// Helper: Map agent decision action to recommendation card styling
const getRecommendationStyle = (action: string) => {
    const normalized = (action || '').toUpperCase();
    switch (normalized) {
        case 'REPLY':
            return { type: 'Engage', typeBg: '#3B82F6', icon: '↩️', actionLabel: 'Draft Reply', actionBg: '#3B82F6', borderColor: '#3B82F633' };
        case 'TREND_JACK':
            return { type: 'Trend', typeBg: '#8B5CF6', icon: '⚡', actionLabel: 'Create Post', actionBg: '#8B5CF6', borderColor: '#8B5CF633' };
        case 'CAMPAIGN':
        case 'CAMPAIGN_IDEA':
            return { type: 'Campaign', typeBg: '#FF5C00', icon: '📢', actionLabel: 'Plan Campaign', actionBg: '#FF5C00', borderColor: '#FF5C0033' };
        case 'GAP_FILL':
            return { type: 'Content Gap', typeBg: '#22C55E', icon: '🎯', actionLabel: 'Fill Gap', actionBg: '#22C55E', borderColor: '#22C55E33' };
        case 'COMMUNITY':
            return { type: 'Community', typeBg: '#F59E0B', icon: '👥', actionLabel: 'Engage Community', actionBg: '#F59E0B', borderColor: '#F59E0B33' };
        default:
            return { type: 'Strategy', typeBg: '#FF5C00', icon: '🧠', actionLabel: 'Take Action', actionBg: '#FF5C00', borderColor: '#FF5C0033' };
    }
};

// Helper: Time ago formatting
const timeAgo = (ts: string | number) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};

// Parse **bold** markup and render as React elements
const renderRichText = (text: string): React.ReactNode => {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
};

// News icon helpers
const getNewsIcon = (source: string) => {
    const s = (source || '').toLowerCase();
    if (s.includes('cointelegraph')) return '📰';
    if (s.includes('decrypt')) return '🔐';
    if (s.includes('coindesk')) return '💰';
    if (s.includes('block')) return '🧱';
    return '📡';
};

const getNewsIconBg = (source: string) => {
    const s = (source || '').toLowerCase();
    if (s.includes('cointelegraph')) return '#3B82F6';
    if (s.includes('decrypt')) return '#8B5CF6';
    if (s.includes('coindesk')) return '#F59E0B';
    if (s.includes('block')) return '#22C55E';
    return '#FF5C00';
};

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
    const [kickoffState, setKickoffState] = useState<{
        theme: string;
        drafts: any[];
        schedule: CalendarEvent[];
    } | null>(null);

    const [isBriefOpen, setIsBriefOpen] = useState(false);
    // Pre-load brief from localStorage cache instantly, then refresh in background
    const [briefData, setBriefData] = useState<DailyBrief | null>(() => {
        try {
            const cached = localStorage.getItem(`defia_daily_brief_${brandName}`);
            if (cached) {
                const parsed = JSON.parse(cached) as DailyBrief;
                // Use cache if less than 12 hours old
                if (parsed.timestamp && (Date.now() - parsed.timestamp) < 12 * 60 * 60 * 1000) {
                    return parsed;
                }
            }
        } catch {}
        return null;
    });
    const [briefLoading, setBriefLoading] = useState(false);
    const [newsItems, setNewsItems] = useState<{ icon: string; iconBg: string; title: string; source: string; time: string; url?: string; rawArticle?: any }[]>([]);
    const [newsLoading, setNewsLoading] = useState(true);

    // LLM-powered recommendation state
    const [llmRecommendations, setLlmRecommendations] = useState<any[]>([]);
    const [regenLoading, setRegenLoading] = useState(false);
    const autoRegenFired = useRef(false);
    const [regenLastRun, setRegenLastRun] = useState<number>(0);

    const kpis = useMemo(() => transformMetricsToKPIs(socialMetrics, chainMetrics, campaigns), [socialMetrics, chainMetrics, campaigns]);

    // Derive AI recommendations: prefer LLM-generated, fallback to raw agent decisions
    const aiRecommendations = useMemo(() => {
        // Priority 1: LLM-generated rich recommendations
        if (llmRecommendations.length > 0) return llmRecommendations;

        // Priority 2: Raw agent decisions (fallback) — filter out errored entries
        if (!agentDecisions || agentDecisions.length === 0) return [];
        const validDecisions = agentDecisions.filter((d: any) => {
            const text = (d.reason || '') + (d.draft || '');
            return !text.includes('Could not load') && !text.includes('credentials') && !text.includes('ERROR:')
                && !text.includes('is not a function') && !text.includes('TypeError') && !text.includes('Failed to');
        });
        if (validDecisions.length === 0) return [];
        return validDecisions.slice(0, 3).map((d: any) => {
            const style = getRecommendationStyle(d.action);
            const draft = d.draft || '';
            const reason = d.reason || '';
            const titleText = reason.length > 80 ? reason.slice(0, 80) + '...' : (reason || `${(d.action || 'ACTION').toUpperCase()}: Strategic opportunity`);
            const descText = draft ? (draft.length > 140 ? draft.slice(0, 140) + '...' : draft) : (reason || 'AI agent detected an opportunity based on market signals.');
            return {
                ...style,
                title: titleText,
                reasoning: descText,
                contentIdeas: [] as string[],
                strategicAlignment: '',
                dataSignal: '',
                impactScore: 70,
                fullDraft: draft,
                fullReason: reason,
                targetId: d.targetId,
                topic: '',
                goal: '',
                knowledgeConnection: false,
                proof: null,
            };
        });
    }, [agentDecisions, llmRecommendations]);

    // Whether we're showing rich (LLM) or fallback cards
    const isRichMode = llmRecommendations.length > 0;

    // Fetch Web3 news for dashboard
    useEffect(() => {
        setNewsLoading(true);
        const fetchNews = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
                const res = await fetch(`${baseUrl}/api/web3-news?brand=${encodeURIComponent(brandName)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.items && data.items.length > 0) {
                        const mapped = data.items.slice(0, 5).map((item: any) => {
                            // Use rawData.createdAt or rawData.news_provider for richer info
                            const raw = item.rawData || {};
                            const sourceName = raw.news_provider || item.source || 'Web3';
                            const createdAt = raw.createdAt ? new Date(raw.createdAt).getTime() : (typeof item.createdAt === 'number' ? item.createdAt : 0);
                            return {
                                icon: getNewsIcon(sourceName),
                                iconBg: getNewsIconBg(sourceName),
                                title: item.headline || raw.title || item.summary || 'Untitled',
                                source: sourceName.replace(/^(www\.)?/, '').split('/')[0],
                                time: createdAt > 0 ? timeAgo(createdAt) : 'Recently',
                                url: item.url,
                                rawArticle: {
                                    ...item,
                                    sourceName: sourceName.replace(/^(www\.)?/, '').split('/')[0],
                                    category: item.topic || 'defi',
                                }
                            };
                        });
                        setNewsItems(mapped);
                    }
                }
            } catch (e) {
                console.warn('[Dashboard] News fetch failed:', e);
            } finally {
                setNewsLoading(false);
            }
        };
        fetchNews();
    }, [brandName]);

    // Pre-load daily brief: show cached instantly, then refresh in background
    useEffect(() => {
        const initBrief = async () => {
            // Only show loading spinner if there's no cached data to display
            if (!briefData) setBriefLoading(true);
            try {
                const brief = await generateBriefService(brandName, kpis, campaigns, []);
                setBriefData(brief);
                // Cache to localStorage for instant display on next visit
                try { localStorage.setItem(`defia_daily_brief_${brandName}`, JSON.stringify(brief)); } catch {}
            } catch (e) {
                console.error("Background Brief Gen Failed", e);
            } finally {
                setBriefLoading(false);
            }
        };
        initBrief();
    }, [brandName]);

    useEffect(() => {
        let mounted = true;
        // Reset auto-regen guard when brand changes
        autoRegenFired.current = false;
        setLlmRecommendations([]);
        setRegenLastRun(0);
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

    useEffect(() => {
        const state = loadCampaignState(brandName);
        const allDrafts = Array.isArray(state?.campaignItems) ? state.campaignItems : [];
        const kickoffDrafts = allDrafts.filter((item: any) => String(item?.id || '').startsWith('kickoff-'));
        const kickoffSchedule = calendarEvents.filter((event) => String(event?.id || '').startsWith('kickoff-'));

        if (kickoffDrafts.length === 0 && kickoffSchedule.length === 0) {
            setKickoffState(null);
            return;
        }

        setKickoffState({
            theme: state?.campaignTheme || `${brandName} Launch`,
            drafts: kickoffDrafts.length > 0 ? kickoffDrafts : allDrafts.slice(0, 3),
            schedule: kickoffSchedule
        });
    }, [brandName, calendarEvents]);

    // Auto-generate recommendations if stale (> 6 hours) or empty on mount
    useEffect(() => {
        if (autoRegenFired.current) return;
        if (regenLoading) return;
        // Only auto-fire if we have no LLM recommendations and no agent decisions as fallback
        const hasData = llmRecommendations.length > 0 || (agentDecisions && agentDecisions.length > 0);
        const isStale = regenLastRun > 0 && (Date.now() - regenLastRun > 6 * 60 * 60 * 1000);
        if (!hasData || isStale) {
            autoRegenFired.current = true;
            // Delay slightly to let other data load first
            const timer = setTimeout(() => {
                handleRegenerate();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [brandName, agentDecisions?.length, llmRecommendations.length]);

    const upcomingContent = calendarEvents
        .filter(e => {
            const target = e.scheduledAt ? new Date(e.scheduledAt) : new Date(e.date);
            return target >= new Date();
        })
        .sort((a, b) => {
            const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : new Date(a.date).getTime();
            const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : new Date(b.date).getTime();
            return aTime - bTime;
        })
        .slice(0, 4);

    const filteredCampaigns = useMemo(() => {
        if (campaignTab === 'active') return campaigns.filter(c => c.status === 'Scale' || c.status === 'Test');
        if (campaignTab === 'completed') return campaigns.filter(c => c.status === 'Pause' || c.status === 'Kill');
        return campaigns;
    }, [campaigns, campaignTab]);

    const handleRegenerate = async () => {
        setRegenLoading(true);
        try {
            const registry = getBrandRegistryEntry(brandName);
            const deepContext = await getBrainContext(registry?.brandId);
            const brainLogs = loadBrainLogs(brandName).slice(0, 5);
            const brainLogSignals = brainLogs.map(log => `[${log.type}] ${log.context}`).join('\n');
            const knowledgeBase = brandConfig?.knowledgeBase?.length
                ? `BRAND KNOWLEDGE:\n${brandConfig.knowledgeBase.slice(0, 8).map(entry => `- ${entry}`).join('\n')}`
                : '';
            const positioning = brandConfig?.brandCollectorProfile?.positioning?.oneLiner
                ? `POSITIONING:\n${brandConfig.brandCollectorProfile.positioning.oneLiner}`
                : '';
            const voiceGuidelines = brandConfig?.voiceGuidelines
                ? `VOICE GUIDELINES:\n${brandConfig.voiceGuidelines}`
                : '';
            const brandKnowledgeBlock = [knowledgeBase, positioning, voiceGuidelines].filter(Boolean).join('\n');

            const brainContext = {
                brand: { ...brandConfig, name: brandName },
                marketState: { trends: socialSignals.trendingTopics || [], analytics: socialMetrics || undefined, mentions: [] },
                memory: {
                    ragDocs: [
                        deepContext.context ? `DEEP MEMORY:\n${deepContext.context}` : '',
                        brainLogSignals ? `RECENT BRAIN LOGS:\n${brainLogSignals}` : '',
                        brandKnowledgeBlock
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

            // Populate decision summary (agent insights, coverage, etc.)
            const now = Date.now();
            setDecisionSummary({
                analysis,
                actionCount: actions.length,
                lastUpdated: now,
                agentInsights,
                inputCoverage: {
                    calendarItems: calendarEvents.length,
                    mentions: mentions.length,
                    trends: socialSignals.trendingTopics?.length || 0,
                    knowledgeSignals: enrichedContext.memory.ragDocs.length + deepContext.strategyCount + deepContext.memoryCount,
                    recentPosts: socialMetrics?.recentPosts?.length || 0
                }
            });

            // Build rich LLM recommendation cards from actions
            const strategicAngle = analysis?.strategicAngle || (analysis as any)?.headline || '';
            const richRecs = actions.slice(0, 4).map((action: any, idx: number) => {
                const style = getRecommendationStyle(action.type);
                // Compute impact score based on action type + market context
                const baseImpact = action.type === 'TREND_JACK' ? 92 : action.type === 'REPLY' ? 78 : action.type === 'CAMPAIGN' ? 88 : action.type === 'GAP_FILL' ? 75 : 80;
                const impactScore = Math.min(99, baseImpact + (mentions.length > 3 ? 5 : 0) + (socialSignals.trendingTopics?.length > 2 ? 3 : 0));
                // Data signal: what triggered this
                const dataSignal = action.type === 'TREND_JACK'
                    ? `Trending: ${(socialSignals.trendingTopics || [])[0] || action.topic}`
                    : action.type === 'REPLY'
                    ? `${mentions.length} recent mention${mentions.length !== 1 ? 's' : ''} detected`
                    : action.type === 'CAMPAIGN'
                    ? `Market shift: ${strategicAngle.slice(0, 60) || action.topic}`
                    : `Content gap identified in ${action.topic || 'market'}`;

                return {
                    ...style,
                    title: action.hook || `${style.type}: ${action.topic}`,
                    reasoning: action.reasoning || `Strategic opportunity based on ${action.goal}`,
                    contentIdeas: Array.isArray(action.contentIdeas) ? action.contentIdeas.slice(0, 3) : [],
                    strategicAlignment: action.strategicAlignment || strategicAngle,
                    dataSignal,
                    impactScore,
                    fullDraft: action.instructions || action.reasoning || '',
                    fullReason: action.reasoning || action.topic || '',
                    targetId: action.targetId || null,
                    topic: action.topic,
                    goal: action.goal,
                    knowledgeConnection: brandKnowledgeBlock ? true : false,
                    proof: (action as any).proof,
                };
            });
            setLlmRecommendations(richRecs);
            setRegenLastRun(now);

            // Also create strategy tasks
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
                    logicExplanation: (action as any).logicExplanation,
                    createdAt: Date.now(),
                    feedback: 'neutral'
                }));
                onUpdateTasks(newTasks as any);
            }
            saveDecisionLoopLastRun(brandName);
        } catch (e) {
            console.error("Regen Failed", e);
        } finally {
            setRegenLoading(false);
        }
    };

    const handleRecommendationAction = (rec: any) => {
        if (!onNavigate) {
            const draft = rec.fullDraft || rec.reasoning || rec.title || '';
            onSchedule(draft);
            return;
        }

        // Navigate to the recommendation detail page with full context
        onNavigate('recommendation-detail', {
            recommendation: rec,
            agentInsights: decisionSummary.agentInsights,
            analysis: decisionSummary.analysis,
            inputCoverage: decisionSummary.inputCoverage,
            socialMetrics,
            trendingTopics: socialSignals.trendingTopics || [],
            brandConfig,
            generatedAt: decisionSummary.lastUpdated || Date.now(),
        });
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

    const formatKickoffDate = (value: string) => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
                        onClick={() => onNavigate('studio')}
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
                                    {i === 0 && kpi.value !== '--' && (
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22C55E18] text-[#22C55E] text-xs font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
                                            Live
                                        </span>
                                    )}
                                </div>
                                {kpi.value === '--' ? (
                                    <>
                                        <div className="text-[32px] font-medium text-[#2E2E2E] font-mono tracking-tight mb-3">—</div>
                                        <span className="text-xs text-[#4A4A4E]">No data yet</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-[32px] font-medium text-white font-mono tracking-tight mb-3">{kpi.value}</div>
                                        {kpi.delta !== 0 && (
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
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Daily Brief — compact 2-3 sentence text with bold markup */}
                    {briefData && briefData.confidence?.explanation && (
                        <div className="rounded-xl bg-[#111113] border border-[#1F1F23] px-5 py-4 mb-7">
                            <div className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z"/></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-white text-sm font-semibold">Daily Brief</span>
                                        <span className="text-[10px] text-[#4A4A4E]">{new Date(briefData.timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                                        {(() => {
                                            const hoursAgo = Math.floor((Date.now() - briefData.timestamp) / (1000 * 60 * 60));
                                            if (hoursAgo >= 1) {
                                                return <span className="text-[10px] text-[#4A4A4E]">· Generated {hoursAgo}h ago</span>;
                                            }
                                            return <span className="text-[10px] text-[#22C55E]">· Just now</span>;
                                        })()}
                                    </div>
                                    <p className="text-[13px] text-[#ADADB0] leading-[1.65]">{renderRichText(briefData.confidence.explanation)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {briefLoading && !briefData && <SkeletonBriefCard />}

                    {kickoffState && (
                        <div className="rounded-xl border border-[#22C55E33] bg-[#0F1510] p-5 mb-7">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <div className="text-xs font-semibold text-[#22C55E] tracking-widest">KICKOFF COMPLETE</div>
                                    <h3 className="text-white text-lg font-semibold mt-1">Launch pack ready for {kickoffState.theme}</h3>
                                    <p className="text-[#8B8B8F] text-sm mt-1">3 draft posts prepared and a 7-day calendar mapped.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onNavigate('campaigns')}
                                        className="px-4 py-2 rounded-lg bg-[#22C55E] text-[#0A0A0B] text-xs font-semibold hover:bg-[#36D06C] transition-colors"
                                    >
                                        Review Drafts
                                    </button>
                                    <button
                                        onClick={() => onNavigate('calendar')}
                                        className="px-4 py-2 rounded-lg bg-[#1F1F23] text-white text-xs font-medium border border-[#2E2E2E] hover:bg-[#2A2A2D] transition-colors"
                                    >
                                        View Calendar
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="rounded-lg bg-[#0A0A0B] border border-[#1F1F23] p-4">
                                    <div className="text-[11px] font-semibold text-[#6B6B70] tracking-widest mb-3">DRAFTS READY</div>
                                    <div className="space-y-2">
                                        {kickoffState.drafts.slice(0, 3).map((draft, index) => (
                                            <div key={draft.id || index} className="text-sm text-white/90 bg-[#111113] border border-[#1F1F23] rounded-lg px-3 py-2">
                                                {String(draft.tweet || '').slice(0, 140)}{String(draft.tweet || '').length > 140 ? '…' : ''}
                                            </div>
                                        ))}
                                        {kickoffState.drafts.length === 0 && (
                                            <div className="text-xs text-[#6B6B70]">Drafts will appear once generation completes.</div>
                                        )}
                                    </div>
                                </div>
                                <div className="rounded-lg bg-[#0A0A0B] border border-[#1F1F23] p-4">
                                    <div className="text-[11px] font-semibold text-[#6B6B70] tracking-widest mb-3">NEXT 7 DAYS</div>
                                    <div className="space-y-2">
                                        {(kickoffState.schedule || [])
                                            .slice()
                                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                            .slice(0, 7)
                                            .map((event, index) => (
                                                <div key={event.id || index} className="flex items-start gap-3 bg-[#111113] border border-[#1F1F23] rounded-lg px-3 py-2">
                                                    <div className="text-[11px] font-semibold text-[#22C55E]">{formatKickoffDate(event.date)}</div>
                                                    <div className="text-sm text-white/90 flex-1">
                                                        {String(event.content || '').slice(0, 90)}{String(event.content || '').length > 90 ? '…' : ''}
                                                    </div>
                                                </div>
                                            ))}
                                        {kickoffState.schedule.length === 0 && (
                                            <div className="text-xs text-[#6B6B70]">Schedule will appear once the calendar syncs.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AI CMO Recommendations */}
                    <div className="rounded-xl border border-[#FF5C0044] overflow-hidden mb-7" style={{ background: 'linear-gradient(135deg, #111113 0%, #1A120D 100%)' }}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#FF5C0033]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z"/></svg>
                                </div>
                                <span className="text-white text-sm font-semibold">AI CMO Recommendations</span>
                                {!regenLoading && aiRecommendations.length > 0 && (
                                    <span className="px-2 py-1 rounded-full bg-[#FF5C0022] text-[#FF5C00] text-xs font-medium">{aiRecommendations.length} Priority Actions</span>
                                )}
                                {isRichMode && (
                                    <span className="px-2 py-1 rounded-full bg-[#22C55E18] text-[#22C55E] text-[10px] font-medium">LLM Powered</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {regenLastRun > 0 && (
                                    <span className="text-[#6B6B70] text-[10px]">Updated {timeAgo(regenLastRun)}</span>
                                )}
                                <button
                                    onClick={handleRegenerate}
                                    disabled={regenLoading}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${regenLoading ? 'bg-[#FF5C0022] text-[#FF5C00] cursor-wait' : 'bg-white/5 text-[#ADADB0] hover:bg-white/10'}`}
                                >
                                    <svg className={`w-3 h-3 ${regenLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {regenLoading ? 'Analyzing...' : 'Refresh'}
                                </button>
                            </div>
                        </div>

                        {/* Loading Skeleton */}
                        {regenLoading && (
                            <div className="p-5">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-5 h-5 rounded-full border-2 border-[#FF5C00] border-t-transparent animate-spin"></div>
                                    <span className="text-[#FF5C00] text-xs font-medium">4-Agent Council analyzing market signals, knowledge base & social data...</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="rounded-xl bg-[#0A0A0B] p-4 border border-[#1F1F23] animate-pulse">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="w-8 h-8 rounded-lg bg-[#1F1F23]"></div>
                                                <div className="w-16 h-5 rounded bg-[#1F1F23]"></div>
                                            </div>
                                            <div className="h-4 w-3/4 bg-[#1F1F23] rounded mb-2"></div>
                                            <div className="h-3 w-full bg-[#1F1F23] rounded mb-1"></div>
                                            <div className="h-3 w-2/3 bg-[#1F1F23] rounded mb-4"></div>
                                            <div className="space-y-1.5 mb-4">
                                                <div className="h-2.5 w-5/6 bg-[#1F1F23] rounded"></div>
                                                <div className="h-2.5 w-4/6 bg-[#1F1F23] rounded"></div>
                                            </div>
                                            <div className="h-8 w-full bg-[#1F1F23] rounded-md"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recommendation Cards */}
                        {!regenLoading && (
                            <div className="p-5">
                                {aiRecommendations.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        {aiRecommendations.map((rec: any, i: number) => (
                                            <div key={i} className="rounded-xl bg-[#0A0A0B] p-4 border transition-all hover:border-opacity-60" style={{ borderColor: rec.borderColor }}>
                                                {/* Header: Type badge + Impact score */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{rec.icon}</span>
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: rec.typeBg }}>{rec.type}</span>
                                                    </div>
                                                    {rec.impactScore > 0 && (
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-12 h-1.5 rounded-full bg-[#1F1F23] overflow-hidden">
                                                                <div className="h-full rounded-full" style={{
                                                                    width: `${rec.impactScore}%`,
                                                                    backgroundColor: rec.impactScore >= 85 ? '#22C55E' : rec.impactScore >= 70 ? '#F59E0B' : '#6B6B70'
                                                                }}></div>
                                                            </div>
                                                            <span className={`text-[10px] font-mono font-bold ${rec.impactScore >= 85 ? 'text-[#22C55E]' : rec.impactScore >= 70 ? 'text-[#F59E0B]' : 'text-[#6B6B70]'}`}>{rec.impactScore}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Title — strip action type prefixes */}
                                                <h4 className="text-white text-sm font-semibold mb-1.5 leading-snug">{(rec.title || '').replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY|CAMPAIGN_IDEA)\s*:\s*/i, '').trim() || rec.title}</h4>

                                                {/* Strategic reasoning */}
                                                <p className="text-[#8B8B8F] text-xs leading-relaxed mb-3">
                                                    {rec.reasoning ? (rec.reasoning.length > 160 ? rec.reasoning.slice(0, 160) + '...' : rec.reasoning) : 'Strategic opportunity identified by AI analysis.'}
                                                </p>

                                                {/* Content Ideas (if rich mode) */}
                                                {rec.contentIdeas && rec.contentIdeas.length > 0 && (
                                                    <div className="mb-3 pl-3 border-l-2 border-[#FF5C0044]">
                                                        <span className="text-[10px] font-semibold text-[#FF5C00] tracking-wider block mb-1">CONTENT IDEAS</span>
                                                        {rec.contentIdeas.slice(0, 3).map((idea: string, j: number) => (
                                                            <p key={j} className="text-[#ADADB0] text-[11px] leading-relaxed flex items-start gap-1.5">
                                                                <span className="text-[#FF5C00] mt-0.5">•</span>
                                                                <span>{idea.length > 90 ? idea.slice(0, 90) + '...' : idea}</span>
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Data signal + KB connection */}
                                                {(rec.dataSignal || rec.knowledgeConnection) && (
                                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                        {rec.dataSignal && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#1F1F23] text-[10px] text-[#ADADB0]">
                                                                <span className="text-[#F59E0B]">⚡</span> {rec.dataSignal.length > 50 ? rec.dataSignal.slice(0, 50) + '…' : rec.dataSignal}
                                                            </span>
                                                        )}
                                                        {rec.knowledgeConnection && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#22C55E11] text-[10px] text-[#22C55E]">
                                                                <span>📚</span> Knowledge Base
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Strategic alignment (if rich mode) */}
                                                {rec.strategicAlignment && (
                                                    <p className="text-[10px] text-[#6B6B70] mb-3 italic">
                                                        Alignment: {rec.strategicAlignment.length > 80 ? rec.strategicAlignment.slice(0, 80) + '…' : rec.strategicAlignment}
                                                    </p>
                                                )}

                                                {/* CTA Button */}
                                                <button
                                                    onClick={() => handleRecommendationAction(rec)}
                                                    className="w-full py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
                                                    style={{ backgroundColor: rec.actionBg, color: '#FFFFFF' }}
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                    {rec.actionLabel}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <div className="w-12 h-12 rounded-full bg-[#FF5C0015] flex items-center justify-center mb-3">
                                            <svg className="w-6 h-6 text-[#FF5C00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                        </div>
                                        <p className="text-[#6B6B70] text-sm mb-2">No recommendations yet</p>
                                        <p className="text-[#6B6B70] text-xs mb-4">Click Refresh to run the 4-agent AI council and generate strategic recommendations.</p>
                                        <button
                                            onClick={handleRegenerate}
                                            className="px-4 py-2 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                                        >
                                            Generate Recommendations
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Agent Insights Bar */}
                        {decisionSummary.agentInsights && decisionSummary.agentInsights.length > 0 && !regenLoading && (
                            <div className="border-t border-[#FF5C0022] bg-[#0A0A0B]/60">
                                <div className="px-5 py-3">
                                    <div className="flex items-center gap-2 mb-2.5">
                                        <span className="text-[10px] font-semibold text-[#FF5C00] tracking-widest">AGENT COUNCIL INSIGHTS</span>
                                        <div className="flex-1 h-px bg-[#1F1F23]"></div>
                                        {decisionSummary.inputCoverage && (
                                            <span className="text-[10px] text-[#6B6B70]">
                                                {decisionSummary.inputCoverage.knowledgeSignals} signals · {decisionSummary.inputCoverage.mentions} mentions · {decisionSummary.inputCoverage.trends} trends
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-4 gap-3">
                                        {decisionSummary.agentInsights.map((insight, idx) => {
                                            const agentColors: Record<string, string> = {
                                                'Social Listener': '#3B82F6',
                                                'Performance Analyst': '#22C55E',
                                                'Content Planner': '#F59E0B',
                                                'Knowledge Curator': '#8B5CF6',
                                            };
                                            const agentIcons: Record<string, string> = {
                                                'Social Listener': '👁',
                                                'Performance Analyst': '📊',
                                                'Content Planner': '📝',
                                                'Knowledge Curator': '📚',
                                            };
                                            const color = agentColors[insight.agent] || '#FF5C00';
                                            const icon = agentIcons[insight.agent] || '🤖';
                                            return (
                                                <div key={idx} className="rounded-lg bg-[#111113] border border-[#1F1F23] p-3">
                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                        <span className="text-xs">{icon}</span>
                                                        <span className="text-[10px] font-semibold" style={{ color }}>{insight.agent}</span>
                                                    </div>
                                                    <p className="text-[#ADADB0] text-[11px] leading-relaxed mb-1.5">
                                                        {insight.summary ? (insight.summary.length > 100 ? insight.summary.slice(0, 100) + '...' : insight.summary) : insight.focus}
                                                    </p>
                                                    {insight.keySignals && insight.keySignals.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {insight.keySignals.slice(0, 2).map((signal, sIdx) => (
                                                                <span key={sIdx} className="px-1.5 py-0.5 rounded bg-[#1F1F23] text-[9px] text-[#8B8B8F]">
                                                                    {signal.length > 30 ? signal.slice(0, 30) + '…' : signal}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Two Column Section: News + Audience */}
                    <div className="grid grid-cols-2 gap-6 mb-7">
                        {/* Web3 News Feed */}
                        <div className="rounded-xl bg-[#111113] border border-[#1F1F23] overflow-hidden">
                            <button
                                onClick={() => onNavigate('news')}
                                className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F23] w-full hover:bg-[#1A1A1D] transition-colors"
                            >
                                <span className="text-white text-sm font-semibold">Web3 News Feed</span>
                                <span className="text-[#FF5C00] text-xs font-medium">View All →</span>
                            </button>
                            <div>
                                {newsLoading ? (
                                    <div className="px-5 py-2 space-y-1">
                                        <SkeletonNewsItem />
                                        <SkeletonNewsItem />
                                        <SkeletonNewsItem />
                                        <SkeletonNewsItem />
                                    </div>
                                ) : newsItems.length > 0 ? newsItems.map((item, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            if (item.rawArticle) {
                                                onNavigate('news-article', { article: item.rawArticle, relatedNews: newsItems.filter((_, idx) => idx !== i).slice(0, 2).map(n => n.rawArticle).filter(Boolean) });
                                            } else {
                                                onNavigate('news');
                                            }
                                        }}
                                        className={`flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-[#1F1F23] transition-colors cursor-pointer ${i < newsItems.length - 1 ? 'border-b border-[#1F1F23]' : ''}`}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: item.iconBg }}>
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm font-medium line-clamp-1">{item.title}</p>
                                            <p className="text-[#6B6B70] text-xs">{item.source} · {item.time}</p>
                                        </div>
                                        <svg className="w-4 h-4 text-[#4A4A4E] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                )) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <p className="text-[#6B6B70] text-xs">No news available. Start server to fetch Web3 news.</p>
                                    </div>
                                )}
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
                                        {socialSignals && socialSignals.sentimentScore > 0 ? (
                                            <>
                                                <svg className="w-16 h-16 transform -rotate-90">
                                                    <circle cx="32" cy="32" r="28" fill="none" stroke="#1F1F23" strokeWidth="6" />
                                                    <circle cx="32" cy="32" r="28" fill="none" stroke={socialSignals.sentimentScore >= 60 ? '#22C55E' : socialSignals.sentimentScore >= 40 ? '#F59E0B' : '#EF4444'} strokeWidth="6" strokeDasharray="175.93" strokeDashoffset={175.93 - (175.93 * socialSignals.sentimentScore / 100)} strokeLinecap="round" />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className="text-white text-sm font-bold">{socialSignals.sentimentScore}%</span>
                                                    <span className={`text-[10px] ${socialSignals.sentimentScore >= 60 ? 'text-[#22C55E]' : socialSignals.sentimentScore >= 40 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                                                        {socialSignals.sentimentScore >= 60 ? 'Positive' : socialSignals.sentimentScore >= 40 ? 'Neutral' : 'Negative'}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-16 h-16 transform -rotate-90">
                                                    <circle cx="32" cy="32" r="28" fill="none" stroke="#1F1F23" strokeWidth="6" />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className="text-[#6B6B70] text-sm font-bold">--</span>
                                                    <span className="text-[#6B6B70] text-[10px]">No data</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        {socialSignals && socialSignals.activeNarratives && socialSignals.activeNarratives.length > 0 ? (
                                            socialSignals.activeNarratives.slice(0, 3).map((narrative, i) => (
                                                <div key={i} className="flex justify-between text-xs">
                                                    <span className="text-[#6B6B70]">{narrative}</span>
                                                    <span className="text-white font-medium">Active</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-2">
                                                <span className="text-[#6B6B70] text-xs">Sentiment data will appear once social integrations are connected</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="divide-y divide-[#1F1F23]">
                                {/* Audience data is populated from real integrations */}
                                {socialMetrics && socialMetrics.totalFollowers > 0 ? (
                                    <div className="flex items-center gap-3 px-5 py-3">
                                        <span className="text-lg">𝕏</span>
                                        <div className="flex-1">
                                            <p className="text-white text-sm font-medium">X (Twitter)</p>
                                            <p className="text-[#6B6B70] text-xs">{(socialMetrics.totalFollowers / 1000).toFixed(1)}K followers · {socialMetrics.engagementRate.toFixed(1)}% engaged</p>
                                        </div>
                                        <span className="text-xs font-medium" style={{ color: socialMetrics.comparison?.followersChange >= 0 ? '#22C55E' : '#EF4444' }}>
                                            {socialMetrics.comparison?.followersChange >= 0 ? '↗' : '↘'} {socialMetrics.comparison?.followersChange >= 0 ? '+' : ''}{socialMetrics.comparison?.followersChange || 0}%
                                        </span>
                                    </div>
                                ) : (
                                    <div className="px-5 py-6 text-center">
                                        <p className="text-[#6B6B70] text-sm">Connect your social accounts in Settings to see audience data</p>
                                    </div>
                                )}
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
                            {filteredCampaigns.length > 0 ? filteredCampaigns.map((campaign: any, i) => (
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
                            )) : (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <div className="w-12 h-12 rounded-full bg-[#1F1F23] flex items-center justify-center mb-3">
                                        <svg className="w-6 h-6 text-[#6B6B70]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    <p className="text-[#6B6B70] text-sm mb-3">No campaigns yet</p>
                                    <button
                                        onClick={() => onNavigate('campaigns')}
                                        className="px-4 py-2 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                                    >
                                        Create Campaign
                                    </button>
                                </div>
                            )}
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
                            {upcomingContent.length > 0 ? upcomingContent.map((content: any, i) => (
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
                            )) : (
                                <div className="col-span-4 flex flex-col items-center justify-center py-8 text-center">
                                    <div className="w-12 h-12 rounded-full bg-[#1F1F23] flex items-center justify-center mb-3">
                                        <svg className="w-6 h-6 text-[#6B6B70]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-[#6B6B70] text-sm mb-3">No scheduled content yet</p>
                                    <button
                                        onClick={() => onNavigate('calendar')}
                                        className="px-4 py-2 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                                    >
                                        Schedule Content
                                    </button>
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
                </div>
    );
};
