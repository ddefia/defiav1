import React, { useState } from 'react';
import { generateWeb3Graphic } from '../services/gemini';

interface RecommendationDetailProps {
    recommendation: any;
    context: {
        agentInsights?: { agent: string; focus: string; summary: string; keySignals: string[] }[];
        analysis?: any;
        inputCoverage?: { calendarItems: number; mentions: number; trends: number; knowledgeSignals: number; recentPosts: number };
        socialMetrics?: any;
        trendingTopics?: string[];
        brandConfig?: any;
        generatedAt?: number;
    };
    brandName: string;
    onNavigate: (section: string, params?: any) => void;
    onBack: () => void;
}

const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};

const sourceIcon = (src: string) => {
    const map: Record<string, { icon: string; color: string }> = {
        'Social Listener': { icon: '👁', color: '#3B82F6' },
        'Performance Analyst': { icon: '📊', color: '#22C55E' },
        'Content Planner': { icon: '📝', color: '#F59E0B' },
        'Knowledge Curator': { icon: '📚', color: '#8B5CF6' },
        'Trending Data': { icon: '📈', color: '#EC4899' },
        'Knowledge Base': { icon: '🧠', color: '#8B5CF6' },
        'Past Content': { icon: '📄', color: '#6366F1' },
        'Market Analysis': { icon: '💹', color: '#10B981' },
        'Strategic Analysis': { icon: '🎯', color: '#FF5C00' },
    };
    return map[src] || { icon: '💡', color: '#FF5C00' };
};

export const RecommendationDetail: React.FC<RecommendationDetailProps> = ({
    recommendation: rec,
    context,
    brandName,
    onNavigate,
    onBack
}) => {
    const [visualUrl, setVisualUrl] = useState<string | null>(null);
    const [visualLoading, setVisualLoading] = useState(false);
    const [copiedTweet, setCopiedTweet] = useState(false);

    if (!rec) return null;

    const { agentInsights, analysis, inputCoverage, socialMetrics, trendingTopics, brandConfig, generatedAt } = context || {};
    const impactColor = rec.impactScore >= 85 ? '#22C55E' : rec.impactScore >= 70 ? '#FF5C00' : '#6B6B70';
    const impactLabel = rec.impactScore >= 85 ? 'High Impact' : rec.impactScore >= 70 ? 'Medium Impact' : 'Moderate';

    // Build rich, source-attributed reasoning blocks — always produce meaningful content
    const buildReasoningBlocks = (): { source: string; text: string; signals?: string[] }[] => {
        const blocks: { source: string; text: string; signals?: string[] }[] = [];

        // 1. Strategic analysis from the AI council
        if (analysis?.strategicAngle) {
            blocks.push({
                source: 'Strategic Analysis',
                text: analysis.strategicAngle,
                signals: analysis.marketMood ? [`Market: ${analysis.marketMood}`, ...(analysis.urgency ? [`Urgency: ${analysis.urgency}`] : [])] : undefined,
            });
        }

        // 2. Strategic alignment from the recommendation itself
        if (rec.strategicAlignment && rec.strategicAlignment !== analysis?.strategicAngle) {
            blocks.push({
                source: 'Market Analysis',
                text: rec.strategicAlignment,
            });
        }

        // 3. Each agent's insights — with their key signals
        if (agentInsights && agentInsights.length > 0) {
            for (const insight of agentInsights) {
                if (insight.summary) {
                    blocks.push({
                        source: insight.agent,
                        text: insight.summary,
                        signals: insight.keySignals?.slice(0, 3),
                    });
                }
            }
        }

        // 4. The recommendation's own reasoning (from the LLM action)
        if (rec.fullReason && rec.fullReason !== rec.title && !blocks.some(b => b.text === rec.fullReason)) {
            blocks.push({
                source: 'Content Planner',
                text: rec.fullReason,
            });
        }

        // 5. Trending data context
        if (trendingTopics && trendingTopics.length > 0) {
            const relevantTopics = trendingTopics.slice(0, 5);
            blocks.push({
                source: 'Trending Data',
                text: `Currently trending in Web3: ${relevantTopics.join(', ')}. Content that intersects with active conversations increases organic reach and engagement.`,
                signals: relevantTopics.slice(0, 3),
            });
        }

        // 6. Knowledge base signals
        const kbEntries = brandConfig?.knowledgeBase?.slice(0, 5) || [];
        if (kbEntries.length > 0) {
            const count = inputCoverage?.knowledgeSignals || kbEntries.length;
            blocks.push({
                source: 'Knowledge Base',
                text: `Drawing from ${count} knowledge base entries about ${brandName}'s products, positioning, and competitive advantages to ensure the content represents the brand's value proposition accurately.`,
                signals: kbEntries.slice(0, 3).map((e: string) => typeof e === 'string' ? (e.length > 60 ? e.slice(0, 57) + '...' : e) : ''),
            });
        }

        // 7. Past content performance
        if (inputCoverage?.recentPosts && inputCoverage.recentPosts > 0) {
            blocks.push({
                source: 'Past Content',
                text: `Analyzed ${inputCoverage.recentPosts} recent posts to identify content patterns that resonate with ${brandName}'s audience. This recommendation builds on formats and topics that have previously driven engagement.`,
            });
        }

        // 8. Social mentions context
        if (inputCoverage?.mentions && inputCoverage.mentions > 0) {
            blocks.push({
                source: 'Social Listener',
                text: `${inputCoverage.mentions} social mentions scanned for sentiment and narrative direction. ${rec.type === 'Engage' ? 'Direct engagement opportunities were detected in recent conversations.' : 'Community conversation patterns were analyzed for timing and relevance.'}`,
            });
        }

        // 9. Calendar context
        if (inputCoverage?.calendarItems && inputCoverage.calendarItems > 0) {
            blocks.push({
                source: 'Content Planner',
                text: `${inputCoverage.calendarItems} upcoming calendar items were considered to avoid content overlap and find optimal posting windows.`,
            });
        }

        // 10. Data signal (time-sensitive hook)
        if (rec.dataSignal) {
            const hasDataSignalAlready = blocks.some(b => b.text === rec.dataSignal);
            if (!hasDataSignalAlready) {
                blocks.push({
                    source: 'Market Analysis',
                    text: rec.dataSignal,
                });
            }
        }

        // 11. Brand positioning context
        const positioning = brandConfig?.brandCollectorProfile?.positioning?.oneLiner;
        if (positioning) {
            blocks.push({
                source: 'Knowledge Base',
                text: `This recommendation is aligned with ${brandName}'s core positioning: "${positioning}". Content that reinforces brand identity while capitalizing on market trends builds long-term audience trust.`,
            });
        }

        // Fallback if we still have nothing (no context at all)
        if (blocks.length === 0) {
            blocks.push({
                source: 'Strategic Analysis',
                text: `${brandName}'s AI marketing council analyzed real-time market conditions, social signals, trending topics, and brand knowledge to identify this content opportunity. Click "Refresh" on the Dashboard to generate deeper agent insights with full source attribution.`,
            });
            // Add the recommendation's reasoning as a second block
            if (rec.reasoning) {
                blocks.push({
                    source: 'Content Planner',
                    text: rec.reasoning,
                });
            }
        }

        return blocks;
    };

    const reasoningBlocks = buildReasoningBlocks();

    // Clean title: strip action type prefixes
    const cleanTitle = (rec.title || '').replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY|CAMPAIGN_IDEA)\s*:\s*/i, '').trim() || rec.title;

    // Example tweet
    const exampleTweet = rec.fullDraft
        ? rec.fullDraft.replace(/#\w+/g, '').trim()
        : rec.contentIdeas?.[0] || `${cleanTitle} — strategic move for ${brandName}`;

    const handleGenerateVisual = async () => {
        setVisualLoading(true);
        try {
            const prompt = `${rec.topic || rec.title} — ${brandName} Web3 marketing visual. Dark theme, modern, crypto aesthetic.`;
            const result = await generateWeb3Graphic(prompt, brandName, brandConfig, { aspectRatio: '16:9' });
            if (result?.imageUrl) setVisualUrl(result.imageUrl);
        } catch (e) {
            console.error('Visual generation failed:', e);
        } finally {
            setVisualLoading(false);
        }
    };

    const handleCopyTweet = () => {
        navigator.clipboard.writeText(exampleTweet);
        setCopiedTweet(true);
        setTimeout(() => setCopiedTweet(false), 2000);
    };

    // Data sources count
    const totalSources = inputCoverage
        ? inputCoverage.trends + inputCoverage.mentions + inputCoverage.knowledgeSignals + inputCoverage.recentPosts + inputCoverage.calendarItems
        : 0;

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-3.5 border-b border-[#1F1F23] bg-[#111113]">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-1.5 text-[#6B6B70] hover:text-white text-sm transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Dashboard
                    </button>
                    <div className="w-px h-5 bg-[#1F1F23]"></div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-white" style={{ backgroundColor: rec.typeBg || '#FF5C00' }}>{rec.type || 'Recommendation'}</span>
                        {generatedAt && <span className="text-[#4A4A4E] text-[11px]">Generated {timeAgo(generatedAt)}</span>}
                        {totalSources > 0 && <span className="text-[#4A4A4E] text-[11px]">· {totalSources} data points analyzed</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onNavigate('studio', { draft: exampleTweet, visualPrompt: rec.title })}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
                        style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Draft Reply
                    </button>
                </div>
            </div>

            {/* Content — full width, minimal padding */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-8 py-6">
                    {/* Title + Impact — inline */}
                    <div className="flex items-start gap-5 mb-6">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-[22px] font-semibold text-white leading-snug mb-1.5">{cleanTitle}</h1>
                            <p className="text-[#6B6B70] text-sm">
                                AI-generated recommendation for <span className="text-white">{brandName}</span>
                            </p>
                        </div>
                        {/* Impact Score - compact pill */}
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#111113] border border-[#1F1F23] shrink-0">
                            <div className="relative w-10 h-10">
                                <svg className="w-10 h-10 transform -rotate-90">
                                    <circle cx="20" cy="20" r="16" fill="none" stroke="#1F1F23" strokeWidth="3" />
                                    <circle cx="20" cy="20" r="16" fill="none" stroke={impactColor} strokeWidth="3"
                                        strokeDasharray={`${2 * Math.PI * 16}`}
                                        strokeDashoffset={`${2 * Math.PI * 16 * (1 - (rec.impactScore || 0) / 100)}`}
                                        strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-white text-xs font-bold font-mono">{rec.impactScore || 0}</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] font-semibold" style={{ color: impactColor }}>{impactLabel}</div>
                                <div className="text-[10px] text-[#4A4A4E]">Impact</div>
                            </div>
                        </div>
                    </div>

                    {/* Main Grid — wider: 7 col main + 3 col sidebar */}
                    <div className="grid grid-cols-10 gap-5">
                        {/* Main Content — 7 cols */}
                        <div className="col-span-7 space-y-4">

                            {/* Strategic Reasoning — source-attributed blocks */}
                            <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-white text-sm font-semibold flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C00]"></span>
                                        Strategic Reasoning
                                    </h3>
                                    <span className="text-[10px] text-[#4A4A4E]">{reasoningBlocks.length} sources</span>
                                </div>
                                <div className="space-y-3.5">
                                    {reasoningBlocks.map((block, idx) => {
                                        const { icon, color } = sourceIcon(block.source);
                                        return (
                                            <div key={idx} className="flex gap-3">
                                                {/* Source indicator */}
                                                <div className="flex flex-col items-center shrink-0 pt-0.5">
                                                    <span className="text-sm">{icon}</span>
                                                    {idx < reasoningBlocks.length - 1 && (
                                                        <div className="w-px flex-1 mt-1.5 bg-[#1F1F23]"></div>
                                                    )}
                                                </div>
                                                {/* Content */}
                                                <div className="flex-1 min-w-0 pb-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[11px] font-semibold" style={{ color }}>{block.source}</span>
                                                    </div>
                                                    <p className="text-[#ADADB0] text-[13px] leading-[1.65]">{block.text}</p>
                                                    {/* Key signals as chips */}
                                                    {block.signals && block.signals.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {block.signals.map((signal, si) => (
                                                                <span key={si} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] bg-[#0A0A0B] border border-[#1F1F23] text-[#8B8B8F]">
                                                                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: color }}></span>
                                                                    {signal}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Market + Urgency tags */}
                                {(analysis?.marketMood || analysis?.urgency) && (
                                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#1F1F23]">
                                        {analysis.marketMood && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-[#6B6B70]">Market</span>
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                                    analysis.marketMood === 'Bullish' ? 'bg-[#22C55E18] text-[#22C55E]' :
                                                    analysis.marketMood === 'Bearish' ? 'bg-[#EF444418] text-[#EF4444]' :
                                                    'bg-[#F59E0B18] text-[#F59E0B]'
                                                }`}>{analysis.marketMood}</span>
                                            </div>
                                        )}
                                        {analysis.urgency && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-[#6B6B70]">Urgency</span>
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                                    analysis.urgency === 'High' ? 'bg-[#EF444418] text-[#EF4444]' :
                                                    'bg-[#F59E0B18] text-[#F59E0B]'
                                                }`}>{analysis.urgency}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Draft Tweet */}
                            <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-white text-sm font-semibold flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#1DA1F2]"></span>
                                        Draft Tweet
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleCopyTweet} className="px-2.5 py-1 rounded-md bg-[#1F1F23] text-[#6B6B70] text-[11px] font-medium hover:text-white transition-colors border border-[#2E2E2E]">
                                            {copiedTweet ? '✓ Copied' : 'Copy'}
                                        </button>
                                        <button
                                            onClick={() => onNavigate('studio', { draft: exampleTweet, visualPrompt: rec.title })}
                                            className="px-2.5 py-1 rounded-md bg-[#FF5C00] text-white text-[11px] font-medium hover:bg-[#FF6B1A] transition-colors"
                                        >
                                            Open in Studio
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 rounded-lg bg-[#0A0A0B] border border-[#1F1F23]">
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center text-white font-bold text-xs">{brandName.charAt(0)}</div>
                                        <div>
                                            <span className="text-white text-sm font-medium">{brandName}</span>
                                            <span className="text-[#4A4A4E] text-xs ml-1.5">@{brandName.toLowerCase().replace(/\s/g, '')}</span>
                                        </div>
                                    </div>
                                    <p className="text-[#D1D5DB] text-[13px] leading-[1.6]">{exampleTweet}</p>
                                </div>
                            </div>

                            {/* Visual + Content Ideas side by side */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Visual Concept */}
                                <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-white text-xs font-semibold flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"></span>
                                            Visual Concept
                                        </h3>
                                        {!visualUrl && !visualLoading && (
                                            <button onClick={handleGenerateVisual} className="px-2 py-0.5 rounded-md bg-[#8B5CF6] text-white text-[10px] font-medium hover:bg-[#9B6DF6] transition-colors">
                                                Generate
                                            </button>
                                        )}
                                    </div>
                                    {visualLoading && (
                                        <div className="aspect-video rounded-lg bg-[#0A0A0B] border border-[#1F1F23] flex items-center justify-center">
                                            <div className="w-5 h-5 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    {visualUrl && (
                                        <div className="rounded-lg overflow-hidden border border-[#1F1F23]">
                                            <img src={visualUrl} alt="Visual" className="w-full aspect-video object-cover" />
                                            <div className="flex items-center gap-1.5 p-2 bg-[#0A0A0B]">
                                                <button onClick={() => onNavigate('image-editor', { image: visualUrl })} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F23] text-white border border-[#2E2E2E] hover:bg-[#2A2A2D] transition-colors">Edit</button>
                                                <button onClick={handleGenerateVisual} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#1F1F23] text-[#6B6B70] border border-[#2E2E2E] hover:text-white transition-colors">Regen</button>
                                            </div>
                                        </div>
                                    )}
                                    {!visualUrl && !visualLoading && (
                                        <div className="aspect-video rounded-lg bg-[#0A0A0B] border border-dashed border-[#2E2E2E] flex flex-col items-center justify-center gap-1.5">
                                            <span className="text-[#2E2E2E] text-xl">🎨</span>
                                            <p className="text-[#4A4A4E] text-[10px]">Generate an AI visual</p>
                                        </div>
                                    )}
                                </div>

                                {/* Content Ideas */}
                                <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-4">
                                    <h3 className="text-white text-xs font-semibold mb-3 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"></span>
                                        Content Ideas
                                        {rec.contentIdeas && <span className="text-[10px] text-[#6B6B70] font-normal ml-1">{rec.contentIdeas.length}</span>}
                                    </h3>
                                    {rec.contentIdeas && rec.contentIdeas.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {rec.contentIdeas.map((idea: string, i: number) => (
                                                <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-[#0A0A0B] border border-[#1F1F23] group hover:border-[#FF5C0033] transition-colors">
                                                    <span className="w-4 h-4 rounded-full bg-[#FF5C0012] flex items-center justify-center flex-shrink-0 mt-0.5 text-[9px] font-bold text-[#FF5C00]">{i + 1}</span>
                                                    <p className="text-[#ADADB0] text-[11px] leading-relaxed flex-1 line-clamp-2">{idea}</p>
                                                    <button onClick={() => onNavigate('studio', { draft: idea })} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#FF5C00] text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">Use</button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center py-8">
                                            <p className="text-[#4A4A4E] text-[11px]">No additional ideas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar — 3 cols */}
                        <div className="col-span-3 space-y-3">
                            {/* Quick Actions */}
                            <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-3.5 space-y-2">
                                <button
                                    onClick={() => onNavigate('studio', { draft: exampleTweet, visualPrompt: rec.title })}
                                    className="w-full py-2.5 rounded-lg text-sm font-medium text-white text-center transition-colors hover:opacity-90"
                                    style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                                >
                                    ✏️ Draft Reply
                                </button>
                                <button
                                    onClick={() => onNavigate('campaigns', { intent: rec.topic || rec.title })}
                                    className="w-full py-2 rounded-lg bg-[#1F1F23] text-white text-sm font-medium text-center border border-[#2E2E2E] hover:bg-[#2A2A2D] transition-colors"
                                >
                                    📢 Build Campaign
                                </button>
                                <button
                                    onClick={() => onNavigate('calendar')}
                                    className="w-full py-2 rounded-lg bg-[#0A0A0B] text-[#ADADB0] text-sm font-medium text-center border border-[#1F1F23] hover:text-white transition-colors"
                                >
                                    📅 Schedule Post
                                </button>
                                <button
                                    onClick={() => onNavigate('copilot')}
                                    className="w-full py-2 rounded-lg bg-[#0A0A0B] text-[#ADADB0] text-sm font-medium text-center border border-[#1F1F23] hover:text-white transition-colors"
                                >
                                    💬 Discuss with AI CMO
                                </button>
                            </div>

                            {/* Why Now */}
                            {rec.dataSignal && (
                                <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-3.5">
                                    <h3 className="text-white text-xs font-semibold mb-2 flex items-center gap-1.5">⚡ Why Now</h3>
                                    <p className="text-[#ADADB0] text-[12px] leading-relaxed">{rec.dataSignal}</p>
                                </div>
                            )}

                            {/* Data Sources */}
                            {inputCoverage && (
                                <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-3.5">
                                    <h3 className="text-white text-xs font-semibold mb-2.5">🔍 Data Sources</h3>
                                    <div className="space-y-1.5">
                                        {[
                                            { label: 'Trends analyzed', value: inputCoverage.trends, icon: '📈' },
                                            { label: 'Mentions scanned', value: inputCoverage.mentions, icon: '💬' },
                                            { label: 'Knowledge signals', value: inputCoverage.knowledgeSignals, icon: '🧠' },
                                            { label: 'Recent posts', value: inputCoverage.recentPosts, icon: '📄' },
                                            { label: 'Calendar items', value: inputCoverage.calendarItems, icon: '📅' },
                                        ].filter(s => s.value > 0).map((s, i) => (
                                            <div key={i} className="flex items-center justify-between py-1">
                                                <span className="text-[#6B6B70] text-[11px] flex items-center gap-1.5">
                                                    <span className="text-[10px]">{s.icon}</span>
                                                    {s.label}
                                                </span>
                                                <span className="text-white text-[11px] font-mono font-medium">{s.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Metrics */}
                            {socialMetrics && socialMetrics.totalFollowers > 0 && (
                                <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-3.5">
                                    <h3 className="text-white text-xs font-semibold mb-2.5">📊 Current Metrics</h3>
                                    <div className="space-y-1.5">
                                        {[
                                            { label: 'Followers', value: `${(socialMetrics.totalFollowers / 1000).toFixed(1)}K` },
                                            { label: 'Engagement', value: `${socialMetrics.engagementRate?.toFixed(1)}%` },
                                            ...(socialMetrics.weeklyImpressions > 0 ? [{ label: 'Impressions/wk', value: `${(socialMetrics.weeklyImpressions / 1000).toFixed(1)}K` }] : [])
                                        ].map((m, i) => (
                                            <div key={i} className="flex items-center justify-between py-1">
                                                <span className="text-[#6B6B70] text-[11px]">{m.label}</span>
                                                <span className="text-white text-sm font-mono font-medium">{m.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Trending */}
                            {trendingTopics && trendingTopics.length > 0 && (
                                <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-3.5">
                                    <h3 className="text-white text-xs font-semibold mb-2">📈 Trending Now</h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {trendingTopics.slice(0, 6).map((topic, i) => (
                                            <span key={i} className="px-2 py-0.5 rounded-md bg-[#8B5CF60A] border border-[#8B5CF622] text-[#9CA3AF] text-[10px]">{topic}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
