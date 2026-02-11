import React, { useState, useMemo, useEffect } from 'react';
import { SocialMetrics, BrandConfig, SocialSignals } from '../types';

interface RecommendationsPageProps {
    brandName: string;
    brandConfig: BrandConfig;
    socialMetrics: SocialMetrics | null;
    socialSignals: SocialSignals;
    agentDecisions: any[];
    // Shared state from App.tsx
    recommendations: any[];
    regenLoading: boolean;
    regenLastRun: number;
    decisionSummary: any;
    onRegenerate: () => void;
    onDismiss: (idx: number) => void;
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

const getRecStyle = (action: string) => {
    const n = (action || '').toUpperCase();
    switch (n) {
        case 'REPLY': return { type: 'Engagement', typeBg: '#3B82F6', icon: 'forum', borderColor: '#3B82F644' };
        case 'TREND_JACK': return { type: 'Trend', typeBg: '#8B5CF6', icon: 'trending_up', borderColor: '#8B5CF644' };
        case 'CAMPAIGN': case 'CAMPAIGN_IDEA': return { type: 'Campaign', typeBg: '#FF5C00', icon: 'campaign', borderColor: '#FF5C0044' };
        case 'GAP_FILL': return { type: 'Content', typeBg: '#22C55E', icon: 'edit_note', borderColor: '#22C55E44' };
        case 'COMMUNITY': return { type: 'Community', typeBg: '#F59E0B', icon: 'groups', borderColor: '#F59E0B44' };
        case 'TWEET': return { type: 'Tweet', typeBg: '#1DA1F2', icon: 'chat_bubble', borderColor: '#1DA1F244' };
        case 'THREAD': return { type: 'Thread', typeBg: '#A855F7', icon: 'segment', borderColor: '#A855F744' };
        default: return { type: 'Optimization', typeBg: '#F59E0B', icon: 'tune', borderColor: '#F59E0B44' };
    }
};

const getPriorityLabel = (score: number) => score >= 85 ? 'High' : score >= 70 ? 'Medium' : 'Low';
const getPriorityColor = (score: number) => score >= 85 ? '#22C55E' : score >= 70 ? '#F59E0B' : '#6B6B70';
const cleanTitle = (title: string) => (title || '').replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY|CAMPAIGN_IDEA|TWEET|THREAD)\s*:\s*/i, '').trim() || title;

export const RecommendationsPage: React.FC<RecommendationsPageProps> = ({
    brandName, brandConfig, socialMetrics, socialSignals,
    agentDecisions, recommendations, regenLoading, regenLastRun, decisionSummary,
    onRegenerate, onDismiss, onNavigate, onSchedule,
}) => {
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

    // Derive combined recs: prefer LLM, fallback to agent decisions
    const isFallbackMode = recommendations.length === 0;
    const allRecommendations = useMemo(() => {
        if (recommendations.length > 0) return recommendations;
        if (!agentDecisions || agentDecisions.length === 0) return [];
        const valid = agentDecisions.filter((d: any) => {
            const text = (d.reason || '') + (d.draft || '');
            return !text.includes('Could not load') && !text.includes('credentials') && !text.includes('ERROR:')
                && !text.includes('is not a function') && !text.includes('TypeError') && !text.includes('Failed to');
        });

        // Helper: extract first sentence as a cleaner title
        const extractTitle = (text: string): string => {
            if (!text) return 'Strategic opportunity';
            // Try to get first sentence
            const sentenceEnd = text.search(/[.!?]\s/);
            let title = sentenceEnd > 10 ? text.slice(0, sentenceEnd + 1) : text;
            // If still too long, truncate at word boundary
            if (title.length > 200) {
                title = title.slice(0, 197).replace(/\s+\S*$/, '') + '…';
            }
            return title;
        };

        // Derive data signal from action type
        const getDataSignal = (action: string): string => {
            const a = (action || '').toUpperCase();
            switch (a) {
                case 'REPLY': return 'Engagement opportunity detected';
                case 'TREND_JACK': return 'Trending topic identified';
                case 'CAMPAIGN': case 'CAMPAIGN_IDEA': return 'Strategic campaign opportunity';
                case 'GAP_FILL': return 'Content gap identified';
                case 'TWEET': return 'Posting opportunity';
                case 'THREAD': return 'Thread opportunity';
                default: return 'Agent decision pending review';
            }
        };

        // Deterministic score based on action type + content length
        const getScore = (action: string, draft: string): number => {
            const base = (action || '').toUpperCase() === 'TREND_JACK' ? 82
                : (action || '').toUpperCase() === 'CAMPAIGN' ? 80
                : (action || '').toUpperCase() === 'REPLY' ? 75
                : (action || '').toUpperCase() === 'GAP_FILL' ? 78
                : 73;
            const lengthBonus = Math.min(5, Math.floor((draft || '').length / 50));
            return Math.min(95, base + lengthBonus);
        };

        return valid.slice(0, 6).map((d: any) => {
            const style = getRecStyle(d.action);
            const reason = d.reason || '';
            const draft = d.draft || '';
            const getStrategicAlignment = (action: string): string => {
                const a = (action || '').toUpperCase();
                switch (a) {
                    case 'REPLY': return 'Engaging with relevant conversations builds authority and increases organic reach through mutual visibility.';
                    case 'TREND_JACK': return 'Jumping on trending topics while they peak maximizes impression potential and positions the brand as culturally aware.';
                    case 'CAMPAIGN': case 'CAMPAIGN_IDEA': return 'Coordinated campaign pushes create compounding engagement effects across your audience base.';
                    case 'GAP_FILL': return 'Filling content gaps maintains consistent audience engagement and algorithmic favorability.';
                    case 'TWEET': return 'Regular posting maintains presence in followers\' feeds and compounds organic reach over time.';
                    case 'THREAD': return 'Thread-format content drives deeper engagement and higher save/share rates than single posts.';
                    default: return 'Strategic optimization based on current market signals and brand positioning.';
                }
            };
            return {
                ...style,
                title: extractTitle(reason),
                reasoning: reason || 'AI agent detected an opportunity.',
                contentIdeas: [],
                strategicAlignment: getStrategicAlignment(d.action),
                dataSignal: getDataSignal(d.action),
                impactScore: getScore(d.action, draft),
                fullDraft: draft, fullReason: reason,
                targetId: d.targetId, topic: '', goal: '',
            };
        });
    }, [recommendations, agentDecisions]);

    // Filter by priority
    const filteredRecs = useMemo(() => {
        if (priorityFilter === 'all') return allRecommendations;
        return allRecommendations.filter((r: any) => getPriorityLabel(r.impactScore).toLowerCase() === priorityFilter);
    }, [allRecommendations, priorityFilter]);

    // Clamp selection
    useEffect(() => {
        if (selectedIdx >= filteredRecs.length) setSelectedIdx(Math.max(0, filteredRecs.length - 1));
    }, [filteredRecs.length, selectedIdx]);

    const selectedRec = filteredRecs[selectedIdx] || null;

    // Data source count
    const dataSourceCount = useMemo(() => {
        let count = 1; // AI Sentiment always present
        if (socialMetrics?.recentPosts?.length) count++;
        if (socialSignals.trendingTopics?.length) count++;
        if (brandConfig?.knowledgeBase?.length) count++;
        return count;
    }, [socialMetrics, socialSignals, brandConfig]);

    const handleExecute = (rec: any) => {
        const draft = rec.fullDraft
            ? rec.fullDraft.replace(/#\w+/g, '').trim()
            : rec.contentIdeas?.[0] || `${cleanTitle(rec.fullReason || rec.title)} — strategic move for ${brandName}`;
        onNavigate('studio', { draft, visualPrompt: rec.title });
    };

    // Find real index in allRecommendations for dismiss
    const handleDismissSelected = () => {
        if (!selectedRec) return;
        const realIdx = allRecommendations.indexOf(selectedRec);
        if (realIdx >= 0) onDismiss(realIdx);
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
                        onClick={onRegenerate}
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
                        <span className={`w-2 h-2 rounded-full ${regenLastRun > 0 ? 'bg-[#22C55E] animate-pulse' : 'bg-[#6B7280]'}`}></span>
                        <span className="text-[#9CA3AF]">Last sync: {regenLastRun > 0 ? timeAgo(regenLastRun) : 'Never'}</span>
                    </span>
                    <span className="text-[#2E2E2E]">·</span>
                    <span className="text-[#9CA3AF]">{dataSourceCount} data sources</span>
                    <span className="text-[#2E2E2E]">·</span>
                    <span className="text-[#FF5C00] font-medium">{allRecommendations.length} pending actions</span>
                </div>
            </div>

            {/* Fallback mode banner */}
            {isFallbackMode && allRecommendations.length > 0 && (
                <div className="px-8 py-2 bg-[#F59E0B08] border-b border-[#F59E0B22]">
                    <div className="flex items-center gap-2 text-xs">
                        <span className="material-symbols-sharp text-[14px] text-[#F59E0B]">info</span>
                        <span className="text-[#F59E0B]/80">Showing agent decisions</span>
                        <span className="text-[#F59E0B]/40">·</span>
                        <button onClick={onRegenerate} className="text-[#FF5C00] font-medium hover:underline">
                            Run Analysis for AI-powered recommendations
                        </button>
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Priority Queue */}
                <div className="w-[420px] min-w-[420px] border-r border-[#1F1F23] flex flex-col bg-[#0A0A0B]">
                    <div className="px-5 pt-5 pb-3">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[#9CA3AF] text-xs font-semibold tracking-wider uppercase">Priority Queue</span>
                            <span className="text-[#6B7280] text-xs">{filteredRecs.length} items</span>
                        </div>
                        <div className="flex bg-[#111113] rounded-lg p-1 gap-1">
                            {(['high', 'medium', 'low', 'all'] as const).map(f => (
                                <button key={f}
                                    onClick={() => { setPriorityFilter(f); setSelectedIdx(0); }}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${priorityFilter === f
                                        ? f === 'high' ? 'bg-[#FF5C00] text-white' : 'bg-[#1F1F23] text-white'
                                        : 'text-[#6B7280] hover:text-[#9CA3AF]'
                                    }`}
                                >{f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                        {regenLoading && filteredRecs.length === 0 ? (
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
                                return (
                                    <button key={i} onClick={() => setSelectedIdx(i)}
                                        className={`w-full text-left rounded-xl p-4 transition-all border ${isSelected
                                            ? 'bg-[#111113] border-[#FF5C0066] shadow-lg shadow-[#FF5C0011]'
                                            : 'bg-[#0A0A0B] border-[#1F1F23] hover:bg-[#111113] hover:border-[#2E2E2E]'
                                        }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rec.typeBg }}></span>
                                                <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: rec.typeBg }}>{rec.type}</span>
                                            </div>
                                            <span className="text-xs font-medium" style={{ color: getPriorityColor(rec.impactScore) }}>
                                                {rec.impactScore}% <span className="text-[#6B7280] font-normal">conf</span>
                                            </span>
                                        </div>
                                        <h4 className="text-white text-sm font-semibold mb-1.5 leading-snug line-clamp-3">{cleanTitle(rec.title)}</h4>
                                        {rec.dataSignal && (
                                            <div className="flex items-center gap-1 mb-1.5 text-[#6B7280] text-[11px]">
                                                <span className="material-symbols-sharp text-[12px]">bolt</span>
                                                {rec.dataSignal.length > 45 ? rec.dataSignal.slice(0, 45) + '…' : rec.dataSignal}
                                            </div>
                                        )}
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
                                <p className="text-[#6B7280] text-xs mb-4">Run analysis to generate strategic recommendations from the AI council.</p>
                                <button onClick={onRegenerate}
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
                                <div className="flex items-center gap-2 flex-wrap">
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
                                    <button onClick={handleDismissSelected}
                                        className="px-4 py-2 rounded-lg border border-[#2E2E2E] text-[#9CA3AF] text-sm hover:bg-[#1F1F23] transition-colors">
                                        Dismiss
                                    </button>
                                    <button onClick={() => handleExecute(selectedRec)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF5C00] to-[#FF8400] text-white text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-[#FF5C0033]">
                                        <span className="material-symbols-sharp text-[16px]">edit</span>
                                        Open in Studio
                                    </button>
                                </div>
                            </div>

                            {/* Title */}
                            <h2 className="text-white text-2xl font-bold mb-3 leading-snug" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
                                {cleanTitle(selectedRec.fullReason || selectedRec.reasoning || selectedRec.title)}
                            </h2>
                            {/* Data signal subtitle — only show if different from the title */}
                            {selectedRec.dataSignal && (
                                <p className="text-[#9CA3AF] text-[15px] leading-relaxed mb-8 max-w-[700px] flex items-center gap-2">
                                    <span className="material-symbols-sharp text-[16px] text-[#FF5C00]">bolt</span>
                                    {selectedRec.dataSignal}
                                </p>
                            )}

                            {/* Action Context Banner */}
                            <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-4 mb-6 flex items-center gap-3">
                                <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${selectedRec.typeBg}22` }}>
                                    <span className="material-symbols-sharp text-[20px]"
                                        style={{ color: selectedRec.typeBg, fontVariationSettings: "'wght' 300" }}>{selectedRec.icon}</span>
                                </span>
                                <div>
                                    <span className="text-white text-sm font-semibold">{selectedRec.type} Opportunity</span>
                                    <p className="text-[#6B7280] text-xs mt-0.5">
                                        {selectedRec.type === 'Engagement' ? 'Engage with an active conversation to build community presence and visibility.'
                                            : selectedRec.type === 'Trend' ? 'Capitalize on a trending topic while it has peak attention.'
                                            : selectedRec.type === 'Campaign' ? 'Launch a coordinated content push around a strategic theme.'
                                            : selectedRec.type === 'Content' ? 'Fill a content gap in your posting schedule.'
                                            : selectedRec.type === 'Community' ? 'Strengthen community bonds with targeted interaction.'
                                            : selectedRec.type === 'Tweet' ? 'Publish timely content to maintain audience presence.'
                                            : selectedRec.type === 'Thread' ? 'Create a multi-part thread for deeper engagement.'
                                            : 'Optimize your content strategy based on current signals.'}
                                    </p>
                                </div>
                            </div>

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

                                        {/* Agent Council Insights */}
                                        {decisionSummary?.agentInsights && decisionSummary.agentInsights.length > 0 && (
                                            <div className="pt-4 mt-4 border-t border-[#1F1F23]">
                                                <span className="text-[#6B7280] text-xs font-medium mb-3 block">Agent Council Breakdown</span>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {decisionSummary.agentInsights.map((insight: any, idx: number) => {
                                                        const colors: Record<string, string> = {
                                                            'Social Listener': '#3B82F6', 'Performance Analyst': '#22C55E',
                                                            'Content Planner': '#F59E0B', 'Knowledge Curator': '#8B5CF6',
                                                        };
                                                        const icons: Record<string, string> = {
                                                            'Social Listener': 'visibility', 'Performance Analyst': 'analytics',
                                                            'Content Planner': 'edit_calendar', 'Knowledge Curator': 'menu_book',
                                                        };
                                                        const color = colors[insight.agent] || '#FF5C00';
                                                        return (
                                                            <div key={idx} className="rounded-lg bg-[#0A0A0B] border border-[#1F1F23] p-3">
                                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                                    <span className="material-symbols-sharp text-[14px]" style={{ color }}>{icons[insight.agent] || 'smart_toy'}</span>
                                                                    <span className="text-[10px] font-semibold" style={{ color }}>{insight.agent}</span>
                                                                </div>
                                                                <p className="text-[#ADADB0] text-[11px] leading-relaxed mb-1.5">
                                                                    {insight.summary ? (insight.summary.length > 120 ? insight.summary.slice(0, 120) + '...' : insight.summary) : insight.focus}
                                                                </p>
                                                                {insight.keySignals?.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {insight.keySignals.slice(0, 2).map((signal: string, sIdx: number) => (
                                                                            <span key={sIdx} className="px-1.5 py-0.5 rounded bg-[#1F1F23] text-[9px] text-[#8B8B8F]">
                                                                                {signal.length > 35 ? signal.slice(0, 35) + '…' : signal}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
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
                                                {selectedRec.fullDraft}
                                            </p>
                                            <button onClick={() => onNavigate('studio', { draft: selectedRec.fullDraft })}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2E2E2E] text-[#9CA3AF] text-xs hover:bg-[#1F1F23] transition-colors">
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
                                                    {decisionSummary?.inputCoverage?.recentPosts > 0 && (
                                                        <span className="text-[#6B7280] text-[10px] ml-auto">{decisionSummary.inputCoverage.recentPosts} posts</span>
                                                    )}
                                                </div>
                                            ) : null}
                                            {socialSignals.trendingTopics?.length ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#8B5CF6]"></span>
                                                    <span className="text-[#D1D5DB] text-sm">Web3 News Feed</span>
                                                    <span className="text-[#6B7280] text-[10px] ml-auto">{socialSignals.trendingTopics.length} trends</span>
                                                </div>
                                            ) : null}
                                            {brandConfig?.knowledgeBase?.length ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
                                                    <span className="text-[#D1D5DB] text-sm">Brand Knowledge Base</span>
                                                    <span className="text-[#6B7280] text-[10px] ml-auto">{brandConfig.knowledgeBase.length} docs</span>
                                                </div>
                                            ) : null}
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                                                <span className="text-[#D1D5DB] text-sm">AI Sentiment Analysis</span>
                                            </div>
                                            {decisionSummary?.inputCoverage?.mentions > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#EC4899]"></span>
                                                    <span className="text-[#D1D5DB] text-sm">Mentions Scanned</span>
                                                    <span className="text-[#6B7280] text-[10px] ml-auto">{decisionSummary.inputCoverage.mentions}</span>
                                                </div>
                                            )}
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
