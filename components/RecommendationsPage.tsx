import React, { useState, useMemo, useEffect } from 'react';
import { SocialMetrics, BrandConfig, SocialSignals, ComputedMetrics, CampaignLog } from '../types';

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
    chainMetrics?: ComputedMetrics | null;
    campaignLogs?: CampaignLog[];
    qrtFeed?: any[];
    recommendationFocus?: string;
    onFocusChange?: (focus: string) => void;
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
        case 'QRT': return { type: 'QRT', typeBg: '#06B6D4', icon: 'format_quote', borderColor: '#06B6D444' };
        default: return { type: 'Optimization', typeBg: '#F59E0B', icon: 'tune', borderColor: '#F59E0B44' };
    }
};

const getPriorityLabel = (score: number) => score >= 85 ? 'High' : score >= 70 ? 'Medium' : 'Low';
const getPriorityColor = (score: number) => score >= 85 ? '#22C55E' : score >= 70 ? '#F59E0B' : '#6B6B70';
const safeStr = (v: any): string => typeof v === 'string' ? v : (v?.signal || v?.analysis || v?.insight || v?.text || (v && typeof v === 'object' ? JSON.stringify(v) : String(v || '')));
const cleanTitle = (title: any) => { const s = safeStr(title); return s.replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY|CAMPAIGN_IDEA|TWEET|THREAD)\s*:\s*/i, '').trim() || s; };

// Source tag styling + navigation targets
const SOURCE_TAG_STYLES: Record<string, { color: string; icon: string; nav?: string }> = {
    'Web3 News': { color: '#8B5CF6', icon: 'newspaper', nav: 'web3-news' },
    'X Analytics': { color: '#1DA1F2', icon: 'analytics', nav: 'twitter' },
    'Knowledge Base': { color: '#22C55E', icon: 'menu_book', nav: 'brand-settings' },
    'Competitive Intel': { color: '#EF4444', icon: 'compare_arrows', nav: 'twitter' },
    'Brand Mentions': { color: '#EC4899', icon: 'alternate_email', nav: 'twitter' },
    'Content Calendar': { color: '#F59E0B', icon: 'edit_calendar', nav: 'studio' },
    'On-Chain Data': { color: '#06B6D4', icon: 'token', nav: 'analytics' },
    'AI Analysis': { color: '#FF5C00', icon: 'psychology' },
};

// Linkify text: turn @handles into twitter links, quoted terms into X search links
const LinkifiedText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    // Match @handles and "double-quoted phrases" (safe, no ambiguity)
    // For single quotes: only match 'phrases' that start with uppercase (avoids possessives like economy's)
    const parts = text.split(/(@\w+|"[^"]{4,}?")/g);
    const elements: React.ReactNode[] = [];
    parts.forEach((part, i) => {
        if (part.startsWith('@')) {
            const handle = part.slice(1);
            elements.push(
                <a key={i} href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer"
                    className="text-[#1DA1F2] hover:underline cursor-pointer font-medium"
                    onClick={e => e.stopPropagation()}
                    title={`View @${handle} on X`}
                >{part}<span className="material-symbols-sharp text-[10px] opacity-60 align-middle ml-0.5" style={{ fontVariationSettings: "'wght' 300" }}>open_in_new</span></a>
            );
        } else if (part.startsWith('"') && part.endsWith('"')) {
            const term = part.slice(1, -1);
            elements.push(
                <a key={i} href={`https://x.com/search?q=${encodeURIComponent(term)}`} target="_blank" rel="noopener noreferrer"
                    className="text-[#8B5CF6] hover:underline cursor-pointer font-medium"
                    onClick={e => e.stopPropagation()}
                    title={`Search "${term}" on X`}
                >{part}<span className="material-symbols-sharp text-[10px] opacity-60 align-middle ml-0.5" style={{ fontVariationSettings: "'wght' 300" }}>search</span></a>
            );
        } else {
            // Second pass: find 'single-quoted phrases' that start with uppercase letter
            // This safely avoids possessives (economy's, Bitcoin's) since those have lowercase after '
            const subParts = part.split(/('[A-Z][^']{3,}?')/g);
            subParts.forEach((sub, j) => {
                if (sub.startsWith("'") && sub.endsWith("'") && sub.length > 5) {
                    const term = sub.slice(1, -1);
                    elements.push(
                        <a key={`${i}-${j}`} href={`https://x.com/search?q=${encodeURIComponent(term)}`} target="_blank" rel="noopener noreferrer"
                            className="text-[#8B5CF6] hover:underline cursor-pointer font-medium"
                            onClick={e => e.stopPropagation()}
                            title={`Search "${term}" on X`}
                        >{sub}<span className="material-symbols-sharp text-[10px] opacity-60 align-middle ml-0.5" style={{ fontVariationSettings: "'wght' 300" }}>search</span></a>
                    );
                } else {
                    elements.push(<span key={`${i}-${j}`}>{sub}</span>);
                }
            });
        }
    });
    return <span className={className}>{elements}</span>;
};

// Agent relevance by rec type
const getRelevantAgents = (recType: string): string[] => {
    const map: Record<string, string[]> = {
        'Trend': ['Social Listener', 'Knowledge Curator'],
        'Engagement': ['Social Listener'],
        'Campaign': ['Social Listener', 'Performance Analyst', 'Content Planner', 'Knowledge Curator'],
        'Content': ['Content Planner', 'Performance Analyst'],
        'Tweet': ['Content Planner', 'Social Listener'],
        'Thread': ['Performance Analyst', 'Content Planner'],
        'Community': ['Social Listener', 'Knowledge Curator'],
        'QRT': ['Social Listener', 'Knowledge Curator'],
        'Optimization': ['Performance Analyst'],
    };
    return map[recType] || ['Social Listener', 'Performance Analyst'];
};

// Generate supplemental recommendations from available data signals (no API calls)
// Only used to fill gaps when primary recs (LLM or agent decisions) are insufficient
// Exported for reuse in Dashboard.tsx
export const generateSupplementalRecs = (
    brandName: string,
    socialSignals: SocialSignals,
    socialMetrics: SocialMetrics | null,
    brandConfig: BrandConfig,
    chainMetrics?: ComputedMetrics | null,
    campaignLogs?: CampaignLog[],
): any[] => {
    if (!brandConfig) return [];
    const recs: any[] = [];
    const topics = socialSignals?.trendingTopics || [];
    const narratives = socialSignals?.activeNarratives || [];
    const keywords = brandConfig.keywords || [];
    const knowledgeBase = brandConfig.knowledgeBase || [];
    const engagementRate = socialMetrics?.engagementRate || 0;
    const recentPostCount = socialMetrics?.recentPosts?.length || 0;

    // 1. Trending topic → TREND_JACK (up to 2)
    for (const trend of topics.slice(0, 2)) {
        const matchingKeyword = keywords.find(kw =>
            trend.headline.toLowerCase().includes(kw.toLowerCase()) ||
            trend.summary.toLowerCase().includes(kw.toLowerCase())
        );
        const expertise = matchingKeyword || (knowledgeBase.length > 0 ? 'core expertise' : brandName);
        recs.push({
            ...getRecStyle('TREND_JACK'),
            title: `Capitalize on "${trend.headline}" — connect ${brandName}'s ${expertise} to this trending narrative`,
            reasoning: `"${trend.headline}" is trending with ${trend.relevanceScore}% relevance to ${brandName}. ${trend.relevanceReason || `This is an opportunity to position ${brandName} within an active conversation.`}`,
            fullReason: `"${trend.headline}" is trending with ${trend.relevanceScore}% relevance to ${brandName}. ${trend.relevanceReason || `This is an opportunity to position ${brandName} within an active conversation.`} Engaging with trending topics while they peak maximizes impression potential and positions the brand as culturally aware.`,
            fullDraft: `${trend.headline} is reshaping the landscape — and ${brandName} is built for exactly this.\n\nHere's what most people miss about ${trend.headline.toLowerCase()}:\n\n${brandName} has been focused on ${expertise} since day one. The trend is catching up to the vision.\n\nThread incoming on why this matters.`,
            contentIdeas: [`Thread on ${brandName}'s approach to ${trend.headline}`, `Quote-tweet a key voice discussing ${trend.headline}`],
            strategicAlignment: `Jumping on "${trend.headline}" while it has peak attention maximizes impression potential and positions ${brandName} as culturally aware.`,
            dataSignal: `Trending: "${trend.headline}" (${trend.relevanceScore}% relevance)`,
            impactScore: Math.min(92, 78 + Math.floor(trend.relevanceScore / 10)),
            source: 'supplemental',
            sourceTags: ['Web3 News', ...(matchingKeyword ? ['Knowledge Base'] : [])],
            sourceLinks: trend.url ? [{ label: trend.headline.slice(0, 60), url: trend.url, type: 'article' }] : [],
            generatedAt: Date.now(),
        });
    }

    // 2. Low engagement → REPLY
    if (engagementRate < 2 || recentPostCount === 0) {
        const narrative = narratives[0] || `${brandName} ecosystem`;
        recs.push({
            ...getRecStyle('REPLY'),
            title: `Boost engagement by joining active conversations about ${narrative}`,
            reasoning: `Current engagement rate is ${engagementRate.toFixed(1)}% with ${recentPostCount} recent posts. Engaging with relevant conversations builds authority and increases organic reach.`,
            fullReason: `Current engagement rate is ${engagementRate.toFixed(1)}% with ${recentPostCount} recent posts. Replying to active conversations in the ${narrative} space builds authority and increases organic reach through mutual visibility. Community members who receive replies are significantly more likely to engage with future content.`,
            fullDraft: `Great point on ${narrative} — this is exactly why ${brandName} is focused on building real utility here.\n\nThe key insight most miss: sustainable growth comes from genuine community engagement, not just announcements.\n\nWhat's your take on where ${narrative} heads next?`,
            contentIdeas: [`Reply to a top voice discussing ${narrative}`, `Start a poll about ${narrative} priorities`],
            strategicAlignment: 'Engaging with relevant conversations builds authority and increases organic reach through mutual visibility.',
            dataSignal: `Engagement: ${engagementRate.toFixed(1)}% · ${recentPostCount} recent posts`,
            impactScore: 76,
            source: 'supplemental',
            sourceTags: ['X Analytics', 'Brand Mentions'],
            generatedAt: Date.now(),
        });
    }

    // 3. Content cadence → GAP_FILL
    if (recentPostCount < 3) {
        const expertise = keywords[0] || (knowledgeBase.length > 0 ? 'core technology' : brandName);
        recs.push({
            ...getRecStyle('GAP_FILL'),
            title: `Fill content gap — schedule a thread about ${brandName}'s ${expertise}`,
            reasoning: `Only ${recentPostCount} posts in recent history. Consistent posting maintains algorithmic favorability and keeps ${brandName} visible in follower feeds.`,
            fullReason: `Only ${recentPostCount} posts in recent history. Consistent posting maintains algorithmic favorability and keeps ${brandName} visible in follower feeds. A thread about ${expertise} would demonstrate depth and attract engaged followers interested in the brand's core value proposition.`,
            fullDraft: `Let's talk about ${expertise} — and why ${brandName} takes a different approach.\n\n1/ Most projects in this space focus on hype. ${brandName} focuses on building.\n\n2/ Here's what that actually looks like in practice:\n\n3/ [Technical insight about ${expertise}]\n\nMore coming soon.`,
            contentIdeas: [`Educational thread on ${expertise}`, `Behind-the-scenes look at ${brandName}'s approach`],
            strategicAlignment: 'Filling content gaps maintains consistent audience engagement and algorithmic favorability.',
            dataSignal: `Content cadence: ${recentPostCount} recent posts (below target)`,
            impactScore: 74,
            source: 'supplemental',
            sourceTags: ['Content Calendar', 'X Analytics'],
            generatedAt: Date.now(),
        });
    }

    // 4. Brand+trend intersection → CAMPAIGN_IDEA
    for (const trend of topics) {
        const overlap = keywords.find(kw =>
            trend.headline.toLowerCase().includes(kw.toLowerCase()) ||
            trend.summary.toLowerCase().includes(kw.toLowerCase())
        );
        if (overlap) {
            // Skip if we already have a TREND_JACK for this same topic
            const alreadyCovered = recs.some(r => r.title.includes(trend.headline));
            if (!alreadyCovered) {
                recs.push({
                    ...getRecStyle('CAMPAIGN_IDEA'),
                    title: `Launch a campaign around "${overlap}" — ${brandName}'s expertise meets trending demand`,
                    reasoning: `${brandName}'s focus on "${overlap}" directly intersects with the trending topic "${trend.headline}". This is a rare alignment of brand expertise and market attention.`,
                    fullReason: `${brandName}'s focus on "${overlap}" directly intersects with the trending topic "${trend.headline}". This creates a rare alignment where brand expertise meets active market attention. A coordinated campaign push would create compounding engagement effects across the audience base and establish ${brandName} as a thought leader in this intersection.`,
                    fullDraft: `${brandName} + ${overlap} — here's why this matters right now.\n\nThe conversation around "${trend.headline}" is exactly where ${brandName} has been building.\n\nWe're launching a series breaking down how ${overlap} is changing the game:\n\nDay 1: The problem\nDay 2: Our approach\nDay 3: What's next\n\nStay tuned.`,
                    contentIdeas: [`Multi-day campaign on ${overlap}`, `Infographic: ${brandName}'s ${overlap} approach vs. industry standard`],
                    strategicAlignment: `Coordinated campaign around "${overlap}" creates compounding engagement effects and establishes thought leadership.`,
                    dataSignal: `Brand expertise "${overlap}" × Trending "${trend.headline}"`,
                    impactScore: 84,
                    source: 'supplemental',
                    sourceTags: ['Web3 News', 'Knowledge Base'],
                    sourceLinks: trend.url ? [{ label: trend.headline.slice(0, 60), url: trend.url, type: 'article' }] : [],
                    generatedAt: Date.now(),
                });
                break; // Only one campaign idea
            }
        }
    }

    // 5. On-chain campaign performance recs (scale / pause / whale)
    if (chainMetrics?.campaignPerformance?.length && campaignLogs?.length) {
        for (const perf of chainMetrics.campaignPerformance) {
            const log = campaignLogs.find(l => l.id === perf.campaignId);
            if (!log) continue;
            const retPct = Math.round((perf.retention || 0) * 100);
            const wallets = perf.cpa > 0 ? Math.round(log.budget / perf.cpa) : 0;

            // Scale recommendation — high ROI + strong retention
            if (perf.roi > 2 && (perf.retention || 0) > 0.3) {
                recs.push({
                    ...getRecStyle('CAMPAIGN'),
                    title: `Scale "${log.name}" — ${perf.roi.toFixed(1)}x ROI with ${retPct}% wallet retention`,
                    reasoning: `Campaign "${log.name}" is outperforming with ${perf.roi.toFixed(1)}x ROI and ${retPct}% retention. ${wallets} wallets acquired at $${perf.cpa.toFixed(2)} CPA — strong signal to increase budget.`,
                    fullReason: `Campaign "${log.name}" is delivering exceptional results: ${perf.roi.toFixed(1)}x ROI, ${retPct}% wallet retention after 7 days, and ${perf.whalesAcquired} high-value wallets acquired. With a CPA of $${perf.cpa.toFixed(2)} and ${perf.lift.toFixed(1)}x lift vs baseline acquisition rate, this campaign is a strong candidate for budget increase. Scaling now while the momentum holds could compound wallet growth and deepen community engagement.`,
                    fullDraft: `Our "${log.name}" campaign is crushing it:\n\n📈 ${perf.roi.toFixed(1)}x ROI\n🔁 ${retPct}% wallet retention\n🐋 ${perf.whalesAcquired} high-value wallets\n\nRecommendation: Increase budget by 50-100% while these economics hold.`,
                    contentIdeas: [`Increase "${log.name}" budget by 50-100%`, `Clone this campaign for a new audience segment`, `Create a follow-up retention campaign for the ${wallets} acquired wallets`],
                    strategicAlignment: 'Scaling high-ROI campaigns while economics hold maximizes wallet growth and minimizes wasted spend.',
                    dataSignal: `ROI: ${perf.roi.toFixed(1)}x · Retention: ${retPct}% · CPA: $${perf.cpa.toFixed(2)}`,
                    impactScore: Math.min(96, 85 + Math.round(perf.roi)),
                    source: 'supplemental',
                    sourceTags: ['On-Chain Data', 'X Analytics'],
                    generatedAt: Date.now(),
                });
            }

            // Pause recommendation — poor ROI or very low retention
            else if (perf.roi < 0.5 || ((perf.retention || 0) < 0.1 && wallets > 5)) {
                recs.push({
                    ...getRecStyle('CAMPAIGN'),
                    title: `Pause "${log.name}" — ${perf.roi.toFixed(1)}x ROI, only ${retPct}% retention`,
                    reasoning: `Campaign "${log.name}" is underperforming with ${perf.roi.toFixed(1)}x ROI and ${retPct}% retention. Consider reallocating budget to higher-performing campaigns.`,
                    fullReason: `Campaign "${log.name}" is showing poor unit economics: ${perf.roi.toFixed(1)}x ROI (below breakeven), ${retPct}% wallet retention, and $${perf.cpa.toFixed(2)} CPA. While it acquired ${wallets} wallets, the low retention suggests these users aren't sticky. Budget would deliver better returns if reallocated to campaigns with stronger fundamentals.`,
                    fullDraft: `Campaign "${log.name}" needs a rethink:\n\n⚠️ ${perf.roi.toFixed(1)}x ROI (below 1x)\n📉 ${retPct}% retention\n💸 $${perf.cpa.toFixed(2)} CPA\n\nRecommendation: Pause and reallocate budget. Test a new creative or targeting approach before relaunching.`,
                    contentIdeas: [`Pause "${log.name}" and reallocate budget`, `A/B test new creatives for this audience`, `Analyze churned wallets for insights`],
                    strategicAlignment: 'Cutting underperformers frees budget for campaigns with proven ROI and retention.',
                    dataSignal: `ROI: ${perf.roi.toFixed(1)}x · Retention: ${retPct}% · CPA: $${perf.cpa.toFixed(2)}`,
                    impactScore: 82,
                    source: 'supplemental',
                    sourceTags: ['On-Chain Data', 'X Analytics'],
                    generatedAt: Date.now(),
                });
            }

            // Whale acquisition highlight
            if (perf.whalesAcquired >= 5) {
                const alreadyHasRec = recs.some(r => r.title.includes(log.name));
                if (!alreadyHasRec) {
                    recs.push({
                        ...getRecStyle('CAMPAIGN'),
                        title: `"${log.name}" attracted ${perf.whalesAcquired} high-value wallets — build a retention play`,
                        reasoning: `Campaign "${log.name}" brought in ${perf.whalesAcquired} wallets with 50+ transactions. These power users are high-value — create a targeted retention campaign to keep them active.`,
                        fullReason: `Campaign "${log.name}" acquired ${perf.whalesAcquired} high-activity wallets (50+ transactions each). These power users represent outsized protocol value. A dedicated retention campaign — exclusive content, early access, or direct engagement — could lock in their activity and create brand advocates. The ${perf.lift.toFixed(1)}x lift vs baseline confirms this campaign is reaching quality users.`,
                        fullDraft: `🐋 ${perf.whalesAcquired} power users just landed via "${log.name}".\n\nThese wallets have 50+ transactions each — they're not tourists.\n\nNext steps:\n1. Segment these wallets for targeted outreach\n2. Create exclusive content or early access perks\n3. Monitor retention weekly`,
                        contentIdeas: [`Launch a whale retention program`, `Create exclusive content for high-value users`, `Direct engagement campaign for power users`],
                        strategicAlignment: 'Retaining high-value wallets creates outsized protocol value and potential brand advocates.',
                        dataSignal: `${perf.whalesAcquired} whales · ${perf.lift.toFixed(1)}x lift · Campaign: ${log.name}`,
                        impactScore: 88,
                        source: 'supplemental',
                        sourceTags: ['On-Chain Data'],
                        generatedAt: Date.now(),
                    });
                }
            }
        }
    }

    return recs;
};

export const RecommendationsPage: React.FC<RecommendationsPageProps> = ({
    brandName, brandConfig, socialMetrics, socialSignals,
    agentDecisions, recommendations, regenLoading, regenLastRun, decisionSummary,
    onRegenerate, onDismiss, onNavigate, onSchedule,
    chainMetrics, campaignLogs, qrtFeed,
    recommendationFocus = '', onFocusChange,
}) => {
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

    // Derive combined recs: prefer LLM, fallback to agent decisions, supplement with data-driven recs
    const isFallbackMode = recommendations.length === 0;
    const allRecommendations = useMemo(() => {
        let primary: any[] = [];

        if (recommendations.length > 0) {
            primary = recommendations;
        } else if (agentDecisions && agentDecisions.length > 0) {
            const valid = agentDecisions.filter((d: any) => {
                const text = (d.reason || '') + (d.draft || '');
                return !text.includes('Could not load') && !text.includes('credentials') && !text.includes('ERROR:')
                    && !text.includes('is not a function') && !text.includes('TypeError') && !text.includes('Failed to');
            });

            // Helper: extract first sentence as a cleaner title
            const extractTitle = (text: string): string => {
                if (!text) return 'Strategic opportunity';
                const sentenceEnd = text.search(/[.!?]\s/);
                let title = sentenceEnd > 10 ? text.slice(0, sentenceEnd + 1) : text;
                if (title.length > 200) {
                    title = title.slice(0, 197).replace(/\s+\S*$/, '') + '…';
                }
                return title;
            };

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

            const getScore = (action: string, draft: string): number => {
                const base = (action || '').toUpperCase() === 'TREND_JACK' ? 82
                    : (action || '').toUpperCase() === 'CAMPAIGN' ? 80
                    : (action || '').toUpperCase() === 'REPLY' ? 75
                    : (action || '').toUpperCase() === 'GAP_FILL' ? 78
                    : 73;
                const lengthBonus = Math.min(5, Math.floor((draft || '').length / 50));
                return Math.min(95, base + lengthBonus);
            };

            primary = valid.slice(0, 6).map((d: any) => {
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
        }

        // Supplement with data-driven recs if primary count is below 5
        if (primary.length < 5) {
            const supplemental = generateSupplementalRecs(brandName, socialSignals, socialMetrics, brandConfig, chainMetrics, campaignLogs);
            // Dedupe: skip supplementals whose title topic overlaps with a primary rec
            const primaryText = primary.map(r => (r.title + ' ' + (r.fullReason || '')).toLowerCase()).join(' ');
            const filtered = supplemental.filter(s => {
                const key = (s.dataSignal || s.title || '').toLowerCase().split(/\s+/).slice(0, 4).join(' ');
                return !primaryText.includes(key.slice(0, 20));
            });
            return [...primary, ...filtered].slice(0, 8);
        }

        return primary;
    }, [recommendations, agentDecisions, brandName, socialSignals, socialMetrics, brandConfig, chainMetrics, campaignLogs]);

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
        const recType = (rec.type || rec.action || '').toUpperCase();
        const isCampaign = recType === 'CAMPAIGN' || recType === 'CAMPAIGN_IDEA';

        if (isCampaign) {
            // For campaigns, send the first specific content idea as the tweet draft
            // and the full brief as background context — not the raw instructions blob
            const campaignTweet = rec.contentIdeas?.[0] || rec.hook || cleanTitle(rec.title);
            const brief = [rec.goal, rec.description, rec.fullReason]
                .filter(Boolean).join(' — ').slice(0, 300);
            onNavigate('studio', {
                draft: campaignTweet,
                visualPrompt: rec.title,
                context: brief,
            });
        } else {
            const draft = rec.fullDraft
                ? rec.fullDraft.replace(/#\w+/g, '').trim()
                : rec.contentIdeas?.[0] || `${cleanTitle(rec.fullReason || rec.title)} — strategic move for ${brandName}`;
            onNavigate('studio', { draft, visualPrompt: rec.title });
        }
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
                    <p className="text-[#9CA3AF] text-sm mt-0.5">Strategic insights and action recommendations from your AI marketing assistant</p>
                </div>
                <div className="flex items-center gap-3">
                    {regenLastRun > 0 && (
                        <span className="text-[#9CA3AF] text-xs flex items-center gap-1.5">
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
                            <span className="text-[#9CA3AF] text-xs">{filteredRecs.length} items</span>
                        </div>
                        {/* AI Focus compact input */}
                        <div className="flex items-center gap-2 bg-[#111113] border border-[#1F1F23] rounded-lg px-3 py-2 mb-3">
                            <span className="material-symbols-sharp text-[#FF5C00] text-[14px] flex-shrink-0" style={{ fontVariationSettings: "'wght' 300" }}>target</span>
                            <input
                                type="text"
                                value={recommendationFocus}
                                onChange={e => onFocusChange?.(e.target.value)}
                                placeholder="Focus area (e.g. AI agents)…"
                                className="flex-1 bg-transparent text-white text-xs placeholder-[#4B5563] focus:outline-none min-w-0"
                            />
                            {recommendationFocus ? (
                                <button onClick={() => onFocusChange?.('')}
                                    className="flex-shrink-0 text-[#4B5563] hover:text-white transition-colors">
                                    <span className="material-symbols-sharp text-[14px]">close</span>
                                </button>
                            ) : null}
                        </div>
                        <div className="flex bg-[#111113] rounded-lg p-1 gap-1">
                            {(['high', 'medium', 'low', 'all'] as const).map(f => (
                                <button key={f}
                                    onClick={() => { setPriorityFilter(f); setSelectedIdx(0); }}
                                    className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${priorityFilter === f
                                        ? f === 'high' ? 'bg-[#FF5C00] text-white' : 'bg-[#1F1F23] text-white'
                                        : 'text-[#9CA3AF] hover:text-[#9CA3AF]'
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
                                                {rec.impactScore}% <span className="text-[#9CA3AF] font-normal">conf</span>
                                            </span>
                                        </div>
                                        <h4 className="text-white text-sm font-semibold mb-1.5 leading-snug line-clamp-3"><LinkifiedText text={cleanTitle(rec.title)} /></h4>
                                        {/* Trending / QRT signal highlight */}
                                        {rec.type === 'Trend' && (
                                            <div className="flex items-center gap-1 mb-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse flex-shrink-0"></span>
                                                <span className="text-[#8B5CF6] text-[10px] font-bold tracking-wider uppercase">Trending Now</span>
                                            </div>
                                        )}
                                        {rec.type === 'QRT' && rec.originalTweet && (
                                            <div className="flex items-center gap-1 mb-1.5">
                                                <span className="material-symbols-sharp text-[11px] text-[#06B6D4]">format_quote</span>
                                                <span className="text-[#06B6D4] text-[10px] font-semibold">Source tweet available</span>
                                            </div>
                                        )}
                                        {rec.dataSignal && (
                                            <div className="flex items-center gap-1 mb-1.5 text-[#9CA3AF] text-[11px]">
                                                <span className="material-symbols-sharp text-[12px]">bolt</span>
                                                <LinkifiedText text={safeStr(rec.dataSignal).length > 45 ? safeStr(rec.dataSignal).slice(0, 45) + '…' : safeStr(rec.dataSignal)} />
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 flex-wrap flex-1 mr-2">
                                                {(rec.sourceTags || []).slice(0, 3).map((tag: string, tIdx: number) => {
                                                    const style = SOURCE_TAG_STYLES[tag] || SOURCE_TAG_STYLES['AI Analysis'];
                                                    return (
                                                        <span key={tIdx}
                                                            className={`flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded ${style.nav ? 'cursor-pointer hover:brightness-125 transition-all' : ''}`}
                                                            style={{ backgroundColor: `${style.color}15`, color: style.color }}
                                                            onClick={style.nav ? (e) => { e.stopPropagation(); onNavigate(style.nav!); } : undefined}
                                                            title={style.nav ? `Go to ${tag}` : undefined}
                                                        >
                                                            <span className="material-symbols-sharp text-[10px]" style={{ fontVariationSettings: "'wght' 300" }}>{style.icon}</span>
                                                            {tag}
                                                        </span>
                                                    );
                                                })}
                                                {rec.generatedAt && (
                                                    <span className="text-[#6B6B70] text-[9px] ml-auto">{timeAgo(rec.generatedAt)}</span>
                                                )}
                                            </div>
                                            <span className="material-symbols-sharp text-[14px] text-[#9CA3AF]">chevron_right</span>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                <div className="w-12 h-12 rounded-full bg-[#FF5C0015] flex items-center justify-center mb-3">
                                    <span className="material-symbols-sharp text-[24px] text-[#FF5C00]">lightbulb</span>
                                </div>
                                <p className="text-[#9CA3AF] text-sm mb-2">No recommendations yet</p>
                                <p className="text-[#9CA3AF] text-xs mb-4">Run analysis to generate strategic recommendations from the AI council.</p>
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
                        <div className="p-7 max-w-[820px]">

                            {/* Header row: badges + actions */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase"
                                        style={{ backgroundColor: `${getPriorityColor(selectedRec.impactScore)}18`, color: getPriorityColor(selectedRec.impactScore) }}>
                                        {getPriorityLabel(selectedRec.impactScore)} Priority
                                    </span>
                                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase"
                                        style={{ backgroundColor: `${selectedRec.typeBg || '#FF5C00'}18`, color: selectedRec.typeBg || '#FF5C00' }}>
                                        <span className="material-symbols-sharp text-[11px] mr-1" style={{ fontVariationSettings: "'wght' 400" }}>{selectedRec.icon}</span>
                                        {selectedRec.type}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-[#1F1F23] text-[#9CA3AF]">
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

                            {/* WHAT */}
                            <div className="mb-6">
                                <span className="text-[10px] font-bold tracking-widest text-[#FF5C00] uppercase mb-2 block">What</span>

                                {/* Trending NOW banner */}
                                {selectedRec.type === 'Trend' && (
                                    <div className="flex items-center gap-2.5 mb-3 px-3 py-2 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/25">
                                        <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse flex-shrink-0"></span>
                                        <span className="text-[#8B5CF6] text-xs font-bold tracking-widest uppercase">Trending Now</span>
                                        {selectedRec.sourceLinks?.[0]?.url && (
                                            <a href={selectedRec.sourceLinks[0].url} target="_blank" rel="noopener noreferrer"
                                                className="ml-auto text-[#8B5CF6] text-xs hover:underline flex items-center gap-1 font-medium">
                                                Read article
                                                <span className="material-symbols-sharp text-[11px]" style={{ fontVariationSettings: "'wght' 300" }}>open_in_new</span>
                                            </a>
                                        )}
                                    </div>
                                )}

                                <h2 className="text-white text-[22px] font-bold leading-snug mb-4" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
                                    <LinkifiedText text={cleanTitle(selectedRec.title)} />
                                </h2>

                                {/* Source tweet for QRT/REPLY — shown whenever originalTweet is present */}
                                {selectedRec.originalTweet && (
                                    <div className="rounded-xl border border-[#06B6D4]/30 bg-[#06B6D4]/5 p-4 mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-sharp text-[14px] text-[#06B6D4]" style={{ fontVariationSettings: "'wght' 300" }}>format_quote</span>
                                            <span className="text-[#06B6D4] text-[11px] font-semibold uppercase tracking-wider">
                                                {selectedRec.type === 'QRT' ? 'Tweet to Quote' : selectedRec.type === 'Engagement' ? 'Tweet to Reply to' : 'Source Tweet'}
                                            </span>
                                            {selectedRec.originalTweet.tweetUrl && (
                                                <a href={selectedRec.originalTweet.tweetUrl} target="_blank" rel="noopener noreferrer"
                                                    className="ml-auto text-[#06B6D4] text-xs hover:underline flex items-center gap-1">
                                                    <span className="material-symbols-sharp text-[11px]" style={{ fontVariationSettings: "'wght' 300" }}>open_in_new</span>View on X
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-[#E5E7EB] text-sm leading-relaxed italic">"{selectedRec.originalTweet.text}"</p>
                                        {selectedRec.originalTweet.images?.length > 0 && (
                                            <div className="flex gap-2 mt-2 overflow-x-auto">
                                                {selectedRec.originalTweet.images.slice(0, 3).map((img: string, i: number) => (
                                                    <img key={i} src={img} alt="" className="rounded-lg max-h-[120px] object-cover border border-[#1F1F23]"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-[#6B6B70] text-xs mt-2">— {selectedRec.originalTweet.author}</p>
                                    </div>
                                )}

                                {/* Content ideas / draft */}
                                {(selectedRec.contentIdeas?.length > 0 || selectedRec.fullDraft) && (
                                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-4">
                                        <span className="text-[#9CA3AF] text-[11px] font-semibold uppercase tracking-wider mb-3 block">
                                            {selectedRec.contentIdeas?.length > 1 ? 'Content ideas' : 'Suggested content'}
                                        </span>
                                        {selectedRec.contentIdeas?.length > 0 ? (
                                            <div className="space-y-2">
                                                {selectedRec.contentIdeas.map((idea: string, j: number) => (
                                                    <div key={j} className="flex items-start gap-2.5">
                                                        <span className="w-5 h-5 rounded-full bg-[#FF5C00]/15 text-[#FF5C00] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{j + 1}</span>
                                                        <span className="text-[#E5E7EB] text-sm leading-relaxed">{idea}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[#E5E7EB] text-sm leading-relaxed">{selectedRec.fullDraft}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* WHY */}
                            <div className="mb-6">
                                <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase mb-2 block">Why</span>
                                <p className="text-[#D1D5DB] text-[15px] leading-relaxed mb-3">
                                    <LinkifiedText text={safeStr(selectedRec.reasoning || selectedRec.fullReason || 'Based on analysis of your social metrics, trending topics, and brand knowledge base.')} />
                                </p>
                                {selectedRec.dataSignal && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${selectedRec.type === 'Trend' ? 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/20' : 'bg-[#FF5C00]/8 border border-[#FF5C00]/15'}`}>
                                        <span className="material-symbols-sharp text-[14px]"
                                            style={{ color: selectedRec.type === 'Trend' ? '#8B5CF6' : '#FF5C00', fontVariationSettings: "'wght' 300" }}>
                                            {selectedRec.type === 'Trend' ? 'trending_up' : 'bolt'}
                                        </span>
                                        <LinkifiedText text={safeStr(selectedRec.dataSignal)}
                                            className={`text-[13px] font-medium ${selectedRec.type === 'Trend' ? 'text-[#C4B5FD]' : 'text-[#FDBA74]'}`} />
                                    </div>
                                )}
                                {/* Source tags as inline pills */}
                                {(selectedRec.sourceTags || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {(selectedRec.sourceTags as string[]).map((tag: string, tIdx: number) => {
                                            const style = SOURCE_TAG_STYLES[tag] || SOURCE_TAG_STYLES['AI Analysis'];
                                            return (
                                                <span key={tIdx}
                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.nav ? 'cursor-pointer hover:opacity-80' : ''}`}
                                                    style={{ backgroundColor: `${style.color}18`, color: style.color }}
                                                    onClick={style.nav ? () => onNavigate(style.nav!) : undefined}>
                                                    <span className="material-symbols-sharp text-[11px]" style={{ fontVariationSettings: "'wght' 300" }}>{style.icon}</span>
                                                    {tag}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* WHERE + WHEN */}
                            <div>
                                <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase mb-2 block">Where &amp; When</span>
                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* Platform */}
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111113] border border-[#1F1F23]">
                                        <span className="material-symbols-sharp text-[14px] text-[#1DA1F2]" style={{ fontVariationSettings: "'wght' 300" }}>chat_bubble</span>
                                        <span className="text-[#E5E7EB] text-xs font-medium">X / Twitter</span>
                                    </div>
                                    {/* Format */}
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111113] border border-[#1F1F23]">
                                        <span className="material-symbols-sharp text-[14px]" style={{ color: selectedRec.typeBg || '#FF5C00', fontVariationSettings: "'wght' 300" }}>{selectedRec.icon}</span>
                                        <span className="text-[#E5E7EB] text-xs font-medium">{selectedRec.type}</span>
                                    </div>
                                    {/* Timing */}
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111113] border border-[#1F1F23]">
                                        <span className="material-symbols-sharp text-[14px] text-[#9CA3AF]" style={{ fontVariationSettings: "'wght' 300" }}>schedule</span>
                                        <span className="text-[#9CA3AF] text-xs">
                                            {selectedRec.generatedAt ? `Generated ${timeAgo(selectedRec.generatedAt)}` : regenLastRun > 0 ? `Data from ${new Date(regenLastRun).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Now'}
                                        </span>
                                    </div>
                                    {/* Source links */}
                                    {selectedRec.sourceLinks?.map((link: any, lIdx: number) => (
                                        <a key={lIdx} href={link.url} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111113] border border-[#1F1F23] hover:border-[#3E3E3E] transition-colors group">
                                            <span className="material-symbols-sharp text-[14px]" style={{ color: link.type === 'tweet' ? '#1DA1F2' : '#8B5CF6', fontVariationSettings: "'wght' 300" }}>
                                                {link.type === 'tweet' ? 'chat_bubble' : 'article'}
                                            </span>
                                            <span className="text-[#E5E7EB] text-xs font-medium line-clamp-1 max-w-[140px]">{link.label}</span>
                                            <span className="material-symbols-sharp text-[11px] text-[#6B6B70] group-hover:text-[#9CA3AF]" style={{ fontVariationSettings: "'wght' 300" }}>open_in_new</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : !regenLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="w-16 h-16 rounded-2xl bg-[#FF5C0015] flex items-center justify-center mb-4">
                                <span className="material-symbols-sharp text-[32px] text-[#FF5C00]">auto_awesome</span>
                            </div>
                            <h3 className="text-white text-lg font-semibold mb-2">No Recommendation Selected</h3>
                            <p className="text-[#9CA3AF] text-sm max-w-sm">
                                Select a recommendation from the queue or run analysis to generate new strategic insights.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* QRT Opportunities Section */}
            {(qrtFeed && qrtFeed.length > 0) && (
                <div className="border-t border-[#1F1F23] px-8 py-6 bg-[#0A0A0B]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)' }}>
                            <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'wght' 300" }}>format_quote</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">QRT Opportunities</h3>
                            <p className="text-xs text-[#6B7280]">Competitor & ecosystem tweets you can quote retweet</p>
                        </div>
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-[#06B6D4]/10 text-[#06B6D4] text-[11px] font-medium">{qrtFeed.length} tweets</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                        {qrtFeed.map((tweet: any, i: number) => (
                            <div
                                key={tweet.id || `qrt-${i}`}
                                className="flex-shrink-0 w-[340px] bg-[#111113] border border-[#1F1F23] rounded-xl p-4 hover:border-[#06B6D4]/30 transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-2.5">
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                                        style={{ backgroundColor: ['#A855F7', '#EC4899', '#3B82F6', '#22C55E', '#F59E0B'][i % 5] }}
                                    >
                                        {(tweet.competitor || tweet.author || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[13px] font-semibold text-white">@{tweet.competitor || tweet.author || 'unknown'}</span>
                                        {tweet.competitorName && (
                                            <span className="text-xs text-[#6B7280] ml-1.5">{tweet.competitorName}</span>
                                        )}
                                    </div>
                                    {tweet.timestamp && (
                                        <span className="text-[11px] text-[#4A4A4E]">{timeAgo(tweet.timestamp)}</span>
                                    )}
                                </div>
                                <p className="text-[13px] text-[#D1D5DB] leading-relaxed whitespace-pre-wrap mb-3">{tweet.text}</p>
                                {tweet.images?.[0] && (
                                    <img src={tweet.images[0]} alt="" className="rounded-lg mb-3 max-h-[140px] w-full object-cover border border-[#1F1F23]" loading="lazy" />
                                )}
                                <div className="flex items-center justify-between pt-1">
                                    <div className="flex items-center gap-3">
                                        {(tweet.likes > 0) && <span className="text-[11px] text-[#6B7280]">❤️ {tweet.likes}</span>}
                                        {(tweet.retweets > 0) && <span className="text-[11px] text-[#6B7280]">🔄 {tweet.retweets}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {tweet.tweetUrl && (
                                            <a
                                                href={tweet.tweetUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[11px] text-[#6B7280] hover:text-white transition-colors"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                View ↗
                                            </a>
                                        )}
                                        <button
                                            onClick={() => onNavigate('studio', {
                                                qrt: {
                                                    text: tweet.text,
                                                    author: tweet.competitor || tweet.author || 'unknown',
                                                    tweetUrl: tweet.tweetUrl,
                                                }
                                            })}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#06B6D4] bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 transition-colors"
                                        >
                                            <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>format_quote</span>
                                            Quote This
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
