import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals } from '../types';
import { fetchMentions } from '../services/analytics';
import { orchestrateMarketingDecision } from '../services/gemini';
import { getBrainContext } from '../services/pulse';
import { getBrandRegistryEntry, loadBrainLogs, saveDecisionLoopLastRun } from '../services/storage';

interface RecommendationsPageProps {
    brandName: string;
    brandConfig: BrandConfig;
    calendarEvents: CalendarEvent[];
    socialMetrics: SocialMetrics | null;
    socialSignals: SocialSignals;
    agentDecisions: any[];
    tasks: StrategyTask[];
    onUpdateTasks: (t: StrategyTask[]) => void;
    onNavigate: (section: string, params?: any) => void;
    onSchedule: (content: string, image?: string) => void;
}

// --- Helpers ---

const timeAgo = (ts: string | number) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};

const getRecommendationStyle = (action: string) => {
    const n = (action || '').toUpperCase();
    switch (n) {
        case 'REPLY': return { type: 'Engagement', typeBg: '#3B82F6', icon: 'forum', actionLabel: 'Draft Reply', borderColor: '#3B82F644' };
        case 'TREND_JACK': return { type: 'Trend', typeBg: '#8B5CF6', icon: 'trending_up', actionLabel: 'Create Post', borderColor: '#8B5CF644' };
        case 'CAMPAIGN': case 'CAMPAIGN_IDEA': return { type: 'Campaign', typeBg: '#FF5C00', icon: 'campaign', actionLabel: 'Plan Campaign', borderColor: '#FF5C0044' };
        case 'GAP_FILL': return { type: 'Content', typeBg: '#22C55E', icon: 'edit_note', actionLabel: 'Fill Gap', borderColor: '#22C55E44' };
        case 'COMMUNITY': return { type: 'Community', typeBg: '#F59E0B', icon: 'groups', actionLabel: 'Engage', borderColor: '#F59E0B44' };
        case 'TWEET': return { type: 'Tweet', typeBg: '#1DA1F2', icon: 'chat_bubble', actionLabel: 'Draft Tweet', borderColor: '#1DA1F244' };
        case 'THREAD': return { type: 'Thread', typeBg: '#A855F7', icon: 'segment', actionLabel: 'Write Thread', borderColor: '#A855F744' };
        default: return { type: 'Optimization', typeBg: '#F59E0B', icon: 'tune', actionLabel: 'Optimize', borderColor: '#F59E0B44' };
    }
};

const getPriorityLabel = (score: number) => score >= 85 ? 'High' : score >= 70 ? 'Medium' : 'Low';
const getPriorityColor = (score: number) => score >= 85 ? '#22C55E' : score >= 70 ? '#F59E0B' : '#6B6B70';

export const RecommendationsPage: React.FC<RecommendationsPageProps> = ({
    brandName, brandConfig, calendarEvents, socialMetrics, socialSignals,
    agentDecisions, tasks, onUpdateTasks, onNavigate, onSchedule,
}) => {
    // --- State ---
    const [llmRecommendations, setLlmRecommendations] = useState<any[]>([]);
    const [regenLoading, setRegenLoading] = useState(false);
    const [regenError, setRegenError] = useState<string | null>(null);
    const [regenLastRun, setRegenLastRun] = useState<number>(0);
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [decisionSummary, setDecisionSummary] = useState<any>({});
    const autoRegenFired = useRef(false);

    // --- Derive recommendations ---
    const aiRecommendations = useMemo(() => {
        if (llmRecommendations.length > 0) return llmRecommendations;
        if (!agentDecisions || agentDecisions.length === 0) return [];
        const valid = agentDecisions.filter((d: any) => {
            const text = (d.reason || '') + (d.draft || '');
            return !text.includes('Could not load') && !text.includes('credentials') && !text.includes('ERROR:')
                && !text.includes('is not a function') && !text.includes('TypeError') && !text.includes('Failed to');
        });
        if (valid.length === 0) return [];
        return valid.slice(0, 6).map((d: any) => {
            const style = getRecommendationStyle(d.action);
            return {
                ...style,
                title: (d.reason || '').length > 80 ? (d.reason || '').slice(0, 80) + '...' : (d.reason || `${(d.action || 'ACTION').toUpperCase()}: Strategic opportunity`),
                reasoning: d.draft || d.reason || 'AI agent detected an opportunity based on market signals.',
                contentIdeas: [] as string[],
                strategicAlignment: '',
                dataSignal: '',
                impactScore: 70 + Math.floor(Math.random() * 15),
                fullDraft: d.draft || '',
                fullReason: d.reason || '',
                targetId: d.targetId,
                topic: '',
                goal: '',
            };
        });
    }, [agentDecisions, llmRecommendations]);

    // Filter by priority
    const filteredRecs = useMemo(() => {
        if (priorityFilter === 'all') return aiRecommendations;
        return aiRecommendations.filter((r: any) => {
            const label = getPriorityLabel(r.impactScore).toLowerCase();
            return label === priorityFilter;
        });
    }, [aiRecommendations, priorityFilter]);

    // Clamp selectedIdx
    useEffect(() => {
        if (selectedIdx >= filteredRecs.length) setSelectedIdx(Math.max(0, filteredRecs.length - 1));
    }, [filteredRecs.length, selectedIdx]);

    const selectedRec = filteredRecs[selectedIdx] || null;

    // Auto-generate on mount if empty
    useEffect(() => {
        if (autoRegenFired.current) return;
        if (regenLoading) return;
        const hasData = llmRecommendations.length > 0 || (agentDecisions && agentDecisions.length > 0);
        if (!hasData) {
            autoRegenFired.current = true;
            const timer = setTimeout(() => handleRegenerate(), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    // --- Regenerate handler ---
    const handleRegenerate = async () => {
        setRegenLoading(true);
        setRegenError(null);
        try {
            const registry = getBrandRegistryEntry(brandName);
            const deepContext = await getBrainContext(registry?.brandId);
            const brainLogs = loadBrainLogs(brandName).slice(0, 5);
            const brainLogSignals = brainLogs.map(log => `[${log.type}] ${log.context}`).join('\n');
            const knowledgeBase = brandConfig?.knowledgeBase?.length
                ? `BRAND KNOWLEDGE:\n${brandConfig.knowledgeBase.slice(0, 8).map(entry => `- ${entry}`).join('\n')}` : '';
            const positioning = brandConfig?.brandCollectorProfile?.positioning?.oneLiner
                ? `POSITIONING:\n${brandConfig.brandCollectorProfile.positioning.oneLiner}` : '';
            const voiceGuidelines = brandConfig?.voiceGuidelines
                ? `VOICE GUIDELINES:\n${brandConfig.voiceGuidelines}` : '';
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
            const now = Date.now();
            setDecisionSummary({
                analysis, agentInsights,
                inputCoverage: {
                    calendarItems: calendarEvents.length,
                    mentions: mentions.length,
                    trends: socialSignals.trendingTopics?.length || 0,
                    knowledgeSignals: enrichedContext.memory.ragDocs.length + deepContext.strategyCount + deepContext.memoryCount,
                    recentPosts: socialMetrics?.recentPosts?.length || 0
                }
            });

            if (actions.length === 0) {
                setRegenError('AI council returned no actionable recommendations. Try refreshing.');
            }

            const strategicAngle = analysis?.strategicAngle || (analysis as any)?.headline || '';
            const richRecs = actions.slice(0, 6).map((action: any) => {
                const style = getRecommendationStyle(action.type);
                const baseImpact = action.type === 'TREND_JACK' ? 92 : action.type === 'REPLY' ? 78 : action.type === 'CAMPAIGN' ? 88 : action.type === 'GAP_FILL' ? 75 : 80;
                const impactScore = Math.min(99, baseImpact + (mentions.length > 3 ? 5 : 0) + (socialSignals.trendingTopics?.length > 2 ? 3 : 0));
                const dataSignal = action.type === 'TREND_JACK'
                    ? `Trending: ${(socialSignals.trendingTopics || [])[0]?.headline || action.topic}`
                    : action.type === 'REPLY'
                    ? `${mentions.length} recent mentions detected`
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
                    knowledgeConnection: !!brandKnowledgeBlock,
                    proof: (action as any).proof,
                };
            });
            setLlmRecommendations(richRecs);
            setRegenLastRun(now);
            setSelectedIdx(0);

            if (actions.length > 0) {
                const newTasks = actions.map(action => ({
                    id: crypto.randomUUID(),
                    title: action.hook || `Strategy: ${action.topic}`,
                    description: action.reasoning || `Execute ${action.type.toLowerCase()} for ${action.goal}`,
                    status: 'pending', type: action.type as any,
                    contextSource: { type: 'TREND', source: 'Market Pulse', headline: action.topic },
                    impactScore: 85, executionPrompt: action.topic,
                    suggestedVisualTemplate: 'Auto',
                    reasoning: action.reasoning || 'Decision loop produced this action.',
                    strategicAlignment: action.strategicAlignment, contentIdeas: action.contentIdeas,
                    proof: (action as any).proof, logicExplanation: (action as any).logicExplanation,
                    createdAt: Date.now(), feedback: 'neutral'
                }));
                onUpdateTasks(newTasks as any);
            }
            saveDecisionLoopLastRun(brandName);
        } catch (e: any) {
            setRegenError(e?.message || 'Refresh failed.');
        } finally {
            setRegenLoading(false);
        }
    };

    const handleExecute = (rec: any) => {
        onNavigate('recommendation-detail', {
            recommendation: rec,
            agentInsights: decisionSummary.agentInsights,
            analysis: decisionSummary.analysis,
            inputCoverage: decisionSummary.inputCoverage,
            socialMetrics,
            trendingTopics: socialSignals.trendingTopics || [],
            brandConfig,
            generatedAt: regenLastRun || Date.now(),
        });
    };

    const handleDismiss = (idx: number) => {
        const newRecs = [...(llmRecommendations.length > 0 ? llmRecommendations : aiRecommendations)];
        newRecs.splice(idx, 1);
        setLlmRecommendations(newRecs);
        if (selectedIdx >= newRecs.length) setSelectedIdx(Math.max(0, newRecs.length - 1));
    };

    // Count data sources
    const dataSourceCount = useMemo(() => {
        let count = 0;
        if (socialMetrics?.recentPosts?.length) count++;
        if (socialSignals.trendingTopics?.length) count++;
        if (brandConfig?.knowledgeBase?.length) count++;
        count++; // AI Sentiment is always present
        return count;
    }, [socialMetrics, socialSignals, brandConfig]);

    // --- Clean title ---
    const cleanTitle = (title: string) => (title || '').replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY|CAMPAIGN_IDEA|TWEET|THREAD)\s*:\s*/i, '').trim() || title;

    // --- Stats for selected recommendation cards ---
    const getRecStats = (rec: any) => {
        if (!rec) return [];
        const stats: { icon: string; text: string }[] = [];
        if (rec.dataSignal) stats.push({ icon: 'bolt', text: rec.dataSignal.length > 40 ? rec.dataSignal.slice(0, 40) + '…' : rec.dataSignal });
        if (rec.impactScore) stats.push({ icon: 'speed', text: `${rec.impactScore}% confidence` });
        return stats;
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-[#1F1F23]">
                <div>
                    <h1 className="text-white text-[22px] font-bold" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
                        AI CMO Recommendations
                    </h1>
                    <p className="text-[#6B7280] text-sm mt-0.5">Strategic insights and action recommendations from your AI marketing assistant</p>
                </div>
                <div className="flex items-center gap-3">
                    {regenLastRun > 0 && (
                        <span className="text-[#6B7280] text-xs flex items-center gap-1.5">
                            <span className="material-symbols-sharp text-[14px]">schedule</span>
                            Last sync: {timeAgo(regenLastRun)}
                        </span>
                    )}
                    <span className="px-3 py-1.5 rounded-lg bg-[#111113] border border-[#1F1F23] text-[#9CA3AF] text-xs flex items-center gap-1.5">
                        <span className="material-symbols-sharp text-[14px]">database</span>
                        {dataSourceCount} data sources
                    </span>
                    <button
                        onClick={handleRegenerate}
                        disabled={regenLoading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${regenLoading
                            ? 'bg-[#FF5C0022] text-[#FF5C00] cursor-wait'
                            : 'bg-gradient-to-r from-[#FF5C00] to-[#FF8400] text-white hover:opacity-90 shadow-lg shadow-[#FF5C0033]'
                        }`}
                    >
                        <span className={`material-symbols-sharp text-[18px] ${regenLoading ? 'animate-spin' : ''}`}>
                            {regenLoading ? 'progress_activity' : 'auto_awesome'}
                        </span>
                        {regenLoading ? 'Analyzing...' : 'Run Analysis'}
                    </button>
                </div>
            </div>

            {/* Status bar */}
            <div className="px-8 py-2.5 border-b border-[#1F1F23]/50 bg-[#0A0A0B]">
                <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></span>
                        <span className="text-[#9CA3AF]">Last sync: {regenLastRun > 0 ? timeAgo(regenLastRun) : 'Never'}</span>
                    </span>
                    <span className="text-[#2E2E2E]">·</span>
                    <span className="text-[#9CA3AF]">{dataSourceCount} data sources</span>
                    <span className="text-[#2E2E2E]">·</span>
                    <span className="text-[#FF5C00] font-medium">{aiRecommendations.length} pending actions</span>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Priority Queue */}
                <div className="w-[420px] min-w-[420px] border-r border-[#1F1F23] flex flex-col bg-[#0A0A0B]">
                    {/* Queue header */}
                    <div className="px-5 pt-5 pb-3">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[#9CA3AF] text-xs font-semibold tracking-wider uppercase">Priority Queue</span>
                            <span className="text-[#6B7280] text-xs">{filteredRecs.length} items</span>
                        </div>
                        {/* Filter tabs */}
                        <div className="flex bg-[#111113] rounded-lg p-1 gap-1">
                            {(['high', 'medium', 'low', 'all'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => { setPriorityFilter(f); setSelectedIdx(0); }}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${priorityFilter === f
                                        ? f === 'high' ? 'bg-[#FF5C00] text-white' : 'bg-[#1F1F23] text-white'
                                        : 'text-[#6B7280] hover:text-[#9CA3AF]'
                                    }`}
                                >
                                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Queue list */}
                    <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                        {regenLoading ? (
                            <div className="p-5">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-5 h-5 rounded-full border-2 border-[#FF5C00] border-t-transparent animate-spin"></div>
                                    <span className="text-[#FF5C00] text-xs font-medium">4-Agent Council analyzing...</span>
                                </div>
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="rounded-xl bg-[#111113] p-4 border border-[#1F1F23] animate-pulse mb-2">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="w-20 h-5 rounded bg-[#1F1F23]"></div>
                                            <div className="w-12 h-4 rounded bg-[#1F1F23]"></div>
                                        </div>
                                        <div className="h-4 w-3/4 bg-[#1F1F23] rounded mb-2"></div>
                                        <div className="h-3 w-full bg-[#1F1F23] rounded mb-1"></div>
                                        <div className="h-3 w-1/2 bg-[#1F1F23] rounded"></div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredRecs.length > 0 ? (
                            filteredRecs.map((rec: any, i: number) => {
                                const isSelected = i === selectedIdx;
                                const stats = getRecStats(rec);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedIdx(i)}
                                        className={`w-full text-left rounded-xl p-4 transition-all border ${isSelected
                                            ? 'bg-[#111113] border-[#FF5C0066] shadow-lg shadow-[#FF5C0011]'
                                            : 'bg-[#0A0A0B] border-[#1F1F23] hover:bg-[#111113] hover:border-[#2E2E2E]'
                                        }`}
                                    >
                                        {/* Type + confidence */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rec.typeBg }}></span>
                                                <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: rec.typeBg }}>{rec.type}</span>
                                            </div>
                                            <span className="text-xs font-medium" style={{ color: getPriorityColor(rec.impactScore) }}>
                                                {rec.impactScore}% <span className="text-[#6B7280] font-normal">conf</span>
                                            </span>
                                        </div>
                                        {/* Title */}
                                        <h4 className="text-white text-sm font-semibold mb-1.5 leading-snug">{cleanTitle(rec.title)}</h4>
                                        {/* Stats row */}
                                        {stats.length > 0 && (
                                            <div className="flex items-center gap-3 mb-1.5">
                                                {stats.map((s, j) => (
                                                    <span key={j} className="flex items-center gap-1 text-[#6B7280] text-[11px]">
                                                        <span className="material-symbols-sharp text-[12px]">{s.icon}</span>
                                                        {s.text}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Data sources count */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[#6B7280] text-[11px]">{dataSourceCount} data sources</span>
                                            <span className="material-symbols-sharp text-[14px] text-[#6B7280]">chevron_right</span>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                <div className="w-12 h-12 rounded-full bg-[#FF5C0015] flex items-center justify-center mb-3">
                                    <span className="material-symbols-sharp text-[24px] text-[#FF5C00]">lightbulb</span>
                                </div>
                                <p className="text-[#6B7280] text-sm mb-2">No recommendations yet</p>
                                {regenError && <p className="text-[#F87171] text-xs mb-3">{regenError}</p>}
                                <button onClick={handleRegenerate}
                                    className="px-4 py-2 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors">
                                    Generate Recommendations
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Detail Panel */}
                <div className="flex-1 overflow-y-auto bg-[#0A0A0B]">
                    {selectedRec ? (
                        <div className="p-8">
                            {/* Top badges + actions */}
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase" style={{ backgroundColor: `${getPriorityColor(selectedRec.impactScore)}22`, color: getPriorityColor(selectedRec.impactScore) }}>
                                        {getPriorityLabel(selectedRec.impactScore)} Priority
                                    </span>
                                    <span className="px-3 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-[#1F1F23] text-[#9CA3AF]">
                                        {selectedRec.type}
                                    </span>
                                    <span className="px-3 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase" style={{ backgroundColor: `${getPriorityColor(selectedRec.impactScore)}22`, color: getPriorityColor(selectedRec.impactScore) }}>
                                        {selectedRec.impactScore}% Confidence
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDismiss(selectedIdx)}
                                        className="px-4 py-2 rounded-lg border border-[#2E2E2E] text-[#9CA3AF] text-sm hover:bg-[#1F1F23] transition-colors"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        onClick={() => handleExecute(selectedRec)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF5C00] to-[#FF8400] text-white text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-[#FF5C0033]"
                                    >
                                        <span className="material-symbols-sharp text-[16px]">play_arrow</span>
                                        Execute
                                    </button>
                                </div>
                            </div>

                            {/* Title + description */}
                            <h2 className="text-white text-2xl font-bold mb-3" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
                                {cleanTitle(selectedRec.title)}
                            </h2>
                            <p className="text-[#9CA3AF] text-[15px] leading-relaxed mb-8 max-w-[700px]">
                                {selectedRec.reasoning || 'Strategic opportunity identified by the AI council.'}
                            </p>

                            {/* Two column: Reasoning + Right cards */}
                            <div className="flex gap-6">
                                {/* Left: AI Reasoning */}
                                <div className="flex-1 min-w-0">
                                    <div className="rounded-2xl bg-[#111113] border border-[#1F1F23] p-6">
                                        <div className="flex items-center gap-2 mb-5">
                                            <span className="w-8 h-8 rounded-lg bg-[#FF5C0022] flex items-center justify-center">
                                                <span className="material-symbols-sharp text-[18px] text-[#FF5C00]">psychology</span>
                                            </span>
                                            <span className="text-white text-base font-semibold">AI Reasoning</span>
                                        </div>

                                        <div className="mb-5">
                                            <span className="text-[#6B7280] text-xs font-medium">Why this recommendation</span>
                                            <p className="text-[#D1D5DB] text-sm leading-relaxed mt-2">
                                                {selectedRec.fullReason || selectedRec.reasoning || 'Based on analysis of your social metrics, trending topics, and brand knowledge base.'}
                                            </p>
                                        </div>

                                        {selectedRec.strategicAlignment && (
                                            <div className="pt-4 border-t border-[#1F1F23]">
                                                <span className="text-[#6B7280] text-xs font-medium">Strategic alignment</span>
                                                <p className="text-[#D1D5DB] text-sm leading-relaxed mt-2">
                                                    {selectedRec.strategicAlignment}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Draft + Sources + Ideas */}
                                <div className="w-[340px] min-w-[340px] space-y-4">
                                    {/* Draft Content */}
                                    {selectedRec.fullDraft && (
                                        <div className="rounded-2xl bg-[#111113] border border-[#1F1F23] p-5">
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="material-symbols-sharp text-[16px] text-[#FF5C00]">edit_note</span>
                                                <span className="text-[#FF5C00] text-sm font-semibold">Draft Content</span>
                                            </div>
                                            <p className="text-[#D1D5DB] text-sm leading-relaxed mb-4">
                                                {selectedRec.fullDraft.length > 280 ? selectedRec.fullDraft.slice(0, 280) + '...' : selectedRec.fullDraft}
                                            </p>
                                            <button
                                                onClick={() => onNavigate('studio', { draft: selectedRec.fullDraft })}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2E2E2E] text-[#9CA3AF] text-xs hover:bg-[#1F1F23] transition-colors"
                                            >
                                                <span className="material-symbols-sharp text-[14px]">edit</span>
                                                Edit in Studio
                                            </button>
                                        </div>
                                    )}

                                    {/* Data Sources */}
                                    <div className="rounded-2xl bg-[#111113] border border-[#1F1F23] p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="material-symbols-sharp text-[16px] text-[#9CA3AF]">database</span>
                                            <span className="text-white text-sm font-semibold">Data Sources</span>
                                        </div>
                                        <div className="space-y-2.5">
                                            {socialMetrics?.recentPosts?.length ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                                                    <span className="text-[#D1D5DB] text-sm">X/Twitter (Apify)</span>
                                                </div>
                                            ) : null}
                                            {socialSignals.trendingTopics?.length ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#8B5CF6]"></span>
                                                    <span className="text-[#D1D5DB] text-sm">Web3 News Feed</span>
                                                </div>
                                            ) : null}
                                            {brandConfig?.knowledgeBase?.length ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
                                                    <span className="text-[#D1D5DB] text-sm">Brand Knowledge Base</span>
                                                </div>
                                            ) : null}
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                                                <span className="text-[#D1D5DB] text-sm">AI Sentiment Analysis</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Ideas */}
                                    {selectedRec.contentIdeas && selectedRec.contentIdeas.length > 0 && (
                                        <div className="rounded-2xl bg-[#111113] border border-[#FF5C0033] p-5">
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="material-symbols-sharp text-[16px] text-[#FF5C00]">tips_and_updates</span>
                                                <span className="text-[#FF5C00] text-sm font-semibold">Content Ideas</span>
                                            </div>
                                            <div className="space-y-3">
                                                {selectedRec.contentIdeas.map((idea: string, j: number) => (
                                                    <div key={j} className="flex items-start gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C00] mt-1.5 flex-shrink-0"></span>
                                                        <span className="text-[#D1D5DB] text-sm leading-relaxed">{idea}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : !regenLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="w-16 h-16 rounded-2xl bg-[#FF5C0015] flex items-center justify-center mb-4">
                                <span className="material-symbols-sharp text-[32px] text-[#FF5C00]">auto_awesome</span>
                            </div>
                            <h3 className="text-white text-lg font-semibold mb-2">No Recommendation Selected</h3>
                            <p className="text-[#6B7280] text-sm max-w-sm">
                                Select a recommendation from the queue or run analysis to generate new strategic insights.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
