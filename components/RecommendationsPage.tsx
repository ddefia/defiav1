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
    trendingKOLTweets?: any[];
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

// Linkify text: turn @handles into twitter profile links, highlight quoted phrases as styled text
const LinkifiedText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    // Match @handles and quoted phrases (single or double)
    const parts = text.split(/(@\w+|"[^"]{4,}?"|'[A-Z][^']{3,}?')/g);
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
        } else if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'") && part.length > 5)) {
            // Render quoted phrases as highlighted text (not links) — these are headlines/signals, not tweets
            elements.push(
                <span key={i} className="font-medium" style={{ color: 'var(--text-primary)' }}>{part}</span>
            );
        } else {
            elements.push(<span key={i}>{part}</span>);
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

    // 6. Community engagement — always useful
    if (recs.length < 5) {
        recs.push({
            ...getRecStyle('COMMUNITY'),
            title: `Host an AMA or Twitter Space to deepen ${brandName}'s community connection`,
            reasoning: `Community-driven content consistently outperforms broadcast-style posts. An AMA or Space positions ${brandName} as transparent and accessible.`,
            fullReason: `Community-driven content consistently outperforms broadcast-style posts. Hosting an AMA or Twitter Space positions ${brandName} as transparent and accessible, while driving real-time engagement and organic impressions. This is especially effective for building trust in the Web3 space.`,
            fullDraft: `We're going live this week for a community AMA — bring your questions.\n\nTopics:\n- ${brandName}'s roadmap update\n- Behind the scenes on recent developments\n- Open Q&A with the team\n\nDrop your questions below 👇`,
            contentIdeas: [`Schedule a Twitter Space for this week`, `Create a question-collection tweet thread`],
            strategicAlignment: 'Community engagement builds trust and drives organic growth through authentic interaction.',
            dataSignal: 'Community engagement opportunity',
            impactScore: 77,
            source: 'supplemental',
            sourceTags: ['AI Analysis', 'Brand Mentions'],
            generatedAt: Date.now(),
        });
    }

    // 7. Thread content — evergreen recommendation
    if (recs.length < 5) {
        const topic = keywords[0] || (knowledgeBase.length > 0 ? 'core mission' : 'Web3 journey');
        recs.push({
            ...getRecStyle('THREAD'),
            title: `Publish an educational thread about ${brandName}'s ${topic}`,
            reasoning: `Threads drive 2-3x more engagement than single tweets. An educational thread about ${topic} positions ${brandName} as a thought leader.`,
            fullReason: `Thread-format content consistently drives 2-3x more engagement and higher save/share rates than single posts. An educational thread about ${topic} would position ${brandName} as a thought leader while providing value to followers. This builds long-term brand equity.`,
            fullDraft: `Let's talk about ${topic} — a thread 🧵\n\n1/ Most people misunderstand what ${brandName} is building.\n\n2/ Here's the real story:\n\n3/ [Key insight about ${topic}]\n\n4/ This matters because...\n\n5/ Follow for more insights on ${topic}.`,
            contentIdeas: [`Educational thread on ${topic}`, `Infographic companion to the thread`],
            strategicAlignment: 'Thread content drives deeper engagement and positions the brand as a knowledge leader.',
            dataSignal: `Thread opportunity: ${topic}`,
            impactScore: 75,
            source: 'supplemental',
            sourceTags: ['Content Calendar', 'AI Analysis'],
            generatedAt: Date.now(),
        });
    }

    return recs;
};

export const RecommendationsPage: React.FC<RecommendationsPageProps> = ({
    brandName, brandConfig, socialMetrics, socialSignals,
    agentDecisions, recommendations, regenLoading, regenLastRun, decisionSummary,
    onRegenerate, onDismiss, onNavigate, onSchedule,
    chainMetrics, campaignLogs, qrtFeed,
    recommendationFocus = '', onFocusChange,
    trendingKOLTweets = [],
}) => {
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [approvedRecs, setApprovedRecs] = useState<Set<string>>(new Set());
    const [snoozedRecs, setSnoozedRecs] = useState<Set<string>>(new Set());
    const [showMarketSnapshot, setShowMarketSnapshot] = useState(true);
    const [copiedDraft, setCopiedDraft] = useState(false);

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
            return [...primary, ...filtered].filter(r => r.type && r.title && r.impactScore).slice(0, 8);
        }

        // Runtime enrichment: enrich originalTweet + sourceLinks from KOL data at render time
        // Match by author + tweet text overlap to get the CORRECT tweet URL
        const enriched = primary.filter(r => r.type && r.title && r.impactScore).map(rec => {
            if (!rec.originalTweet) return rec;
            const ot = rec.originalTweet;
            const authorClean = (ot.author || '').replace('@', '').toLowerCase();
            const otTextLower = (ot.text || '').toLowerCase();
            // Find by author first, then narrow by text similarity
            const byAuthor = trendingKOLTweets.filter((t: any) => (t.author || '').toLowerCase() === authorClean);
            const kolMatch = byAuthor.find((t: any) => {
                const cText = (t.text || '').toLowerCase();
                return cText.includes(otTextLower.slice(0, 50)) || otTextLower.includes(cText.slice(0, 50));
            }) || (byAuthor.length === 1 ? byAuthor[0] : null); // Only fallback to author match if exactly 1 tweet
            if (!kolMatch) return rec;
            return {
                ...rec,
                originalTweet: {
                    ...ot,
                    tweetUrl: ot.tweetUrl || kolMatch.tweetUrl || null,
                    likes: ot.likes || kolMatch.likes || 0,
                    retweets: ot.retweets || kolMatch.retweets || 0,
                    timestamp: ot.timestamp || kolMatch.timestamp || kolMatch.createdAt || null,
                    images: ot.images?.length ? ot.images : kolMatch.images || [],
                },
                sourceLinks: (rec.sourceLinks?.length > 0) ? rec.sourceLinks : (kolMatch.tweetUrl ? [
                    { label: `@${kolMatch.author}: ${(kolMatch.text || '').slice(0, 50)}…`, url: kolMatch.tweetUrl, type: 'tweet' }
                ] : []),
            };
        });
        return enriched;
    }, [recommendations, agentDecisions, brandName, socialSignals, socialMetrics, brandConfig, chainMetrics, campaignLogs, trendingKOLTweets]);

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

    const getRecKey = (rec: any) => `${rec.type}_${cleanTitle(rec.title).slice(0, 30)}`;

    const handleApproveSelected = () => {
        if (!selectedRec) return;
        setApprovedRecs(prev => new Set([...prev, getRecKey(selectedRec)]));
    };

    const handleSnoozeSelected = () => {
        if (!selectedRec) return;
        setSnoozedRecs(prev => new Set([...prev, getRecKey(selectedRec)]));
        handleDismissSelected();
    };

    const handleCopyDraft = () => {
        if (!selectedRec) return;
        const draft = selectedRec.fullDraft
            ? selectedRec.fullDraft.replace(/#\w+/g, '').trim()
            : selectedRec.contentIdeas?.[0] || cleanTitle(selectedRec.title);
        navigator.clipboard.writeText(draft);
        setCopiedDraft(true);
        setTimeout(() => setCopiedDraft(false), 2000);
    };

    // Build draft text for display
    const getDraftText = (rec: any): string => {
        if (rec.fullDraft) return rec.fullDraft.replace(/#\w+/g, '').trim();
        if (rec.contentIdeas?.[0]) return rec.contentIdeas[0];
        return `${cleanTitle(rec.title)} — strategic move for ${brandName}`;
    };

    // Tweet action label for detail panel
    const getTweetAction = (rec: any): { label: string; icon: string; color: string } => {
        const t = (rec.type || '').toUpperCase();
        if (t === 'QRT') return { label: 'QUOTE TWEET', icon: 'format_quote', color: '#06B6D4' };
        if (t === 'ENGAGEMENT' || rec.originalTweet) return { label: 'REPLY', icon: 'reply', color: '#3B82F6' };
        if (t === 'THREAD') return { label: 'THREAD', icon: 'segment', color: '#A855F7' };
        return { label: 'DIRECT TWEET', icon: 'edit_note', color: '#1DA1F2' };
    };

    return (
        <div className="h-full flex flex-col">
            {/* Compact header */}
            <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-4">
                    <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Recommendations</h1>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${regenLastRun > 0 ? 'bg-[#22C55E]' : 'bg-[#6B7280]'}`}></span>
                        {regenLastRun > 0 ? timeAgo(regenLastRun) : 'Not synced'}
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span className="text-[#FF5C00] font-medium">{allRecommendations.length} actions</span>
                        {approvedRecs.size > 0 && (
                            <>
                                <span style={{ color: 'var(--border)' }}>·</span>
                                <span className="text-[#22C55E] font-medium">{approvedRecs.size} approved</span>
                            </>
                        )}
                    </div>
                </div>
                <button
                    onClick={onRegenerate}
                    disabled={regenLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${regenLoading
                        ? 'bg-[#FF5C0022] text-[#FF5C00] cursor-wait'
                        : 'bg-gradient-to-r from-[#FF5C00] to-[#FF8400] text-white hover:opacity-90 shadow-lg shadow-[#FF5C0033]'
                    }`}
                >
                    <span className={`material-symbols-sharp text-[16px] ${regenLoading ? 'animate-spin' : ''}`}>
                        {regenLoading ? 'progress_activity' : 'auto_awesome'}
                    </span>
                    {regenLoading ? 'Analyzing...' : 'Run Analysis'}
                </button>
            </div>

            {/* Fallback mode banner */}
            {isFallbackMode && allRecommendations.length > 0 && (
                <div className="px-6 py-2 bg-[#F59E0B08]" style={{ borderBottom: '1px solid #F59E0B22' }}>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="material-symbols-sharp text-[14px] text-[#F59E0B]">info</span>
                        <span style={{ color: 'var(--text-muted)' }}>Agent decisions</span>
                        <button onClick={onRegenerate} className="text-[#FF5C00] font-medium hover:underline ml-1">
                            Run Analysis for AI-powered recs
                        </button>
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Priority Queue */}
                <div className="w-[380px] min-w-[380px] flex flex-col" style={{ borderRight: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                    <div className="px-4 pt-4 pb-2">
                        {/* Focus input */}
                        <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                            <span className="material-symbols-sharp text-[#FF5C00] text-[14px] flex-shrink-0" style={{ fontVariationSettings: "'wght' 300" }}>target</span>
                            <input
                                type="text"
                                value={recommendationFocus}
                                onChange={e => onFocusChange?.(e.target.value)}
                                placeholder="Focus area (e.g. AI agents)..."
                                className="flex-1 bg-transparent text-xs focus:outline-none min-w-0"
                                style={{ color: 'var(--text-primary)' }}
                            />
                            {recommendationFocus ? (
                                <button onClick={() => onFocusChange?.('')} style={{ color: 'var(--text-muted)' }}>
                                    <span className="material-symbols-sharp text-[14px]">close</span>
                                </button>
                            ) : null}
                        </div>
                        <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            {(['all', 'high', 'medium', 'low'] as const).map(f => (
                                <button key={f}
                                    onClick={() => { setPriorityFilter(f); setSelectedIdx(0); }}
                                    className="flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all"
                                    style={priorityFilter === f
                                        ? f === 'high'
                                            ? { backgroundColor: '#FF5C00', color: 'white' }
                                            : { backgroundColor: 'var(--hover-bg)', color: 'var(--text-primary)' }
                                        : { color: 'var(--text-muted)' }}
                                >{f === 'all' ? `All (${allRecommendations.length})` : f.charAt(0).toUpperCase() + f.slice(1)}</button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1.5">
                        {regenLoading && filteredRecs.length === 0 ? (
                            <div className="p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-5 h-5 rounded-full border-2 border-[#FF5C00] border-t-transparent animate-spin"></div>
                                    <span className="text-[#FF5C00] text-xs font-medium">Analyzing...</span>
                                </div>
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="rounded-lg p-3 animate-pulse mb-1.5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                        <div className="h-3 w-16 rounded mb-2" style={{ backgroundColor: 'var(--hover-bg)' }}></div>
                                        <div className="h-4 w-3/4 rounded mb-1.5" style={{ backgroundColor: 'var(--hover-bg)' }}></div>
                                        <div className="h-3 w-full rounded" style={{ backgroundColor: 'var(--hover-bg)' }}></div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredRecs.length > 0 ? (
                            filteredRecs.map((rec: any, i: number) => {
                                const isSelected = i === selectedIdx;
                                const recKey = getRecKey(rec);
                                const isApproved = approvedRecs.has(recKey);
                                const action = getTweetAction(rec);
                                return (
                                    <button key={i} onClick={() => setSelectedIdx(i)}
                                        className="w-full text-left rounded-lg p-3 transition-all"
                                        style={{
                                            backgroundColor: isSelected ? 'var(--bg-primary)' : 'var(--bg-primary)',
                                            border: isSelected ? `1.5px solid ${rec.typeBg || '#FF5C00'}` : '1.5px solid var(--border)',
                                            boxShadow: isSelected ? `0 0 0 1px ${rec.typeBg || '#FF5C00'}22` : 'none',
                                        }}
                                        onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--text-muted)'; } }}
                                        onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border)'; } }}
                                    >
                                        {/* Top row: action type + confidence */}
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider text-white" style={{ backgroundColor: action.color }}>
                                                    {action.label}
                                                </span>
                                                <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: rec.typeBg }}>{rec.type}</span>
                                                {isApproved && (
                                                    <span className="material-symbols-sharp text-[12px] text-[#22C55E]">check_circle</span>
                                                )}
                                            </div>
                                            <span className="text-[11px] font-semibold" style={{ color: getPriorityColor(rec.impactScore) }}>
                                                {rec.impactScore}%
                                            </span>
                                        </div>
                                        {/* Title */}
                                        <h4 className="text-sm font-medium leading-snug line-clamp-2 mb-1" style={{ color: 'var(--text-primary)' }}>
                                            {cleanTitle(rec.title)}
                                        </h4>
                                        {/* QRT preview in card */}
                                        {rec.originalTweet ? (
                                            <div className="mb-1 text-[10px] rounded px-1.5 py-1" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="material-symbols-sharp text-[10px]" style={{ color: action.color }}>format_quote</span>
                                                    <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>@{rec.originalTweet.author}</span>
                                                    <span className="line-clamp-1 flex-1">{safeStr(rec.originalTweet.text).slice(0, 50)}</span>
                                                </div>
                                                {(rec.originalTweet.likes > 0 || rec.originalTweet.timestamp) && (
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {rec.originalTweet.likes > 0 && (
                                                            <span className="flex items-center gap-0.5">
                                                                <span className="material-symbols-sharp text-[9px]" style={{ color: '#EF4444' }}>favorite</span>
                                                                {rec.originalTweet.likes >= 1000 ? `${(rec.originalTweet.likes / 1000).toFixed(1)}K` : rec.originalTweet.likes}
                                                            </span>
                                                        )}
                                                        {rec.originalTweet.retweets > 0 && (
                                                            <span className="flex items-center gap-0.5">
                                                                <span className="material-symbols-sharp text-[9px]" style={{ color: '#22C55E' }}>repeat</span>
                                                                {rec.originalTweet.retweets >= 1000 ? `${(rec.originalTweet.retweets / 1000).toFixed(1)}K` : rec.originalTweet.retweets}
                                                            </span>
                                                        )}
                                                        {rec.originalTweet.timestamp && (
                                                            <span className="ml-auto">{timeAgo(rec.originalTweet.timestamp)}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : rec.dataSignal ? (
                                            <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                                <span className="material-symbols-sharp text-[10px]" style={{ fontVariationSettings: "'wght' 300" }}>bolt</span>
                                                <span className="line-clamp-1">{safeStr(rec.dataSignal).slice(0, 60)}</span>
                                            </div>
                                        ) : null}
                                        {/* Bottom: source tags + time */}
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            {(rec.sourceTags || []).slice(0, 2).map((tag: string, tIdx: number) => {
                                                const style = SOURCE_TAG_STYLES[tag] || SOURCE_TAG_STYLES['AI Analysis'];
                                                return (
                                                    <span key={tIdx}
                                                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                                        style={{ backgroundColor: `${style.color}12`, color: style.color }}>
                                                        {tag}
                                                    </span>
                                                );
                                            })}
                                            {rec.generatedAt && (
                                                <span className="text-[9px] ml-auto" style={{ color: 'var(--text-muted)' }}>{timeAgo(rec.generatedAt)}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                <span className="material-symbols-sharp text-[28px] text-[#FF5C00] mb-3">lightbulb</span>
                                <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>No recommendations</p>
                                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Run analysis to generate actions.</p>
                                <button onClick={onRegenerate}
                                    className="px-4 py-2 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors">
                                    Generate
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Detail Panel */}
                <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg-tertiary, var(--bg-primary))' }}>
                    {selectedRec ? (() => {
                        const action = getTweetAction(selectedRec);
                        const draftText = getDraftText(selectedRec);
                        const charCount = draftText.length;
                        const isOverLimit = charCount > 280 && selectedRec.type !== 'Thread';
                        return (
                        <div className="p-6 max-w-[800px]">

                            {/* ─── HEADER ─── */}
                            <div className="flex items-start justify-between gap-4 mb-6">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <span className="px-2 py-1 rounded-md text-[11px] font-bold tracking-wider text-white flex items-center gap-1" style={{ backgroundColor: action.color }}>
                                            <span className="material-symbols-sharp text-[13px]" style={{ fontVariationSettings: "'wght' 400" }}>{action.icon}</span>
                                            {action.label}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase" style={{ color: selectedRec.typeBg || '#FF5C00', backgroundColor: `${selectedRec.typeBg || '#FF5C00'}15` }}>
                                            {selectedRec.type}
                                        </span>
                                        <span className="text-[11px] font-medium" style={{ color: getPriorityColor(selectedRec.impactScore) }}>
                                            {selectedRec.impactScore}% confidence
                                        </span>
                                        {selectedRec.generatedAt && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(selectedRec.generatedAt)}</span>}
                                    </div>
                                    <h2 className="text-[17px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                                        <LinkifiedText text={cleanTitle(selectedRec.title)} />
                                    </h2>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button onClick={handleApproveSelected}
                                        className="p-2 rounded-lg transition-colors"
                                        title={approvedRecs.has(getRecKey(selectedRec)) ? 'Approved' : 'Approve'}
                                        style={{ color: approvedRecs.has(getRecKey(selectedRec)) ? '#22C55E' : 'var(--text-muted)' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                                        <span className="material-symbols-sharp text-[20px]">check_circle</span>
                                    </button>
                                    <button onClick={handleSnoozeSelected}
                                        className="p-2 rounded-lg transition-colors" title="Dismiss"
                                        style={{ color: 'var(--text-muted)' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                                        <span className="material-symbols-sharp text-[20px]">close</span>
                                    </button>
                                </div>
                            </div>

                            {/* ─── DATA CONTEXT — what triggered this ─── */}
                            {(selectedRec.dataSignal || selectedRec.dataSource) && !selectedRec.originalTweet && (
                                <div className="flex items-start gap-3 mb-5 px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                                    <span className="material-symbols-sharp text-[18px] text-[#FF5C00] mt-0.5 flex-shrink-0">bolt</span>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-bold tracking-wider uppercase block mb-1" style={{ color: '#FF5C00' }}>Triggering Signal</span>
                                        <p className="text-[13px] leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
                                            <LinkifiedText text={safeStr(selectedRec.dataSignal || selectedRec.dataSource)} />
                                        </p>
                                    </div>
                                    {/* Link to source if available */}
                                    {selectedRec.sourceLinks?.[0]?.url && (
                                        <a href={selectedRec.sourceLinks[0].url} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg hover:opacity-80 transition-opacity flex-shrink-0"
                                            style={{ backgroundColor: '#3B82F60D', color: '#3B82F6', border: '1px solid #3B82F620' }}>
                                            <span className="material-symbols-sharp text-[12px]">open_in_new</span>
                                            Source
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* ─── ORIGINAL TWEET (for QRT / Reply) ─── */}
                            {selectedRec.originalTweet && (
                                <div className="mb-6 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                                    <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                                        <span className="material-symbols-sharp text-[14px]" style={{ color: action.color }}>{action.icon}</span>
                                        <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: action.color }}>
                                            {selectedRec.type === 'QRT' ? 'Quote this tweet' : 'Reply to this tweet'}
                                        </span>
                                        {(() => {
                                            const tUrl = selectedRec.originalTweet.tweetUrl;
                                            const author = selectedRec.originalTweet.author || '';
                                            const tweetText = (selectedRec.originalTweet.text || '').slice(0, 40);
                                            // Direct tweet link > search on X > author profile
                                            const href = tUrl || `https://x.com/search?q=from%3A${author}+${encodeURIComponent(tweetText)}&f=live`;
                                            const label = tUrl ? 'View tweet on X' : `Find tweet by @${author}`;
                                            return (
                                                <a href={href} target="_blank" rel="noopener noreferrer"
                                                    className="ml-auto text-[11px] font-medium hover:underline flex items-center gap-1" style={{ color: action.color }}>
                                                    {label} <span className="material-symbols-sharp text-[10px]">open_in_new</span>
                                                </a>
                                            );
                                        })()}
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-center gap-2.5 mb-3">
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: '#1DA1F2' }}>
                                                {(selectedRec.originalTweet.author || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <a href={`https://x.com/${selectedRec.originalTweet.author}`} target="_blank" rel="noopener noreferrer"
                                                        className="text-[13px] font-semibold hover:underline" style={{ color: 'var(--text-primary)' }}>
                                                        @{selectedRec.originalTweet.author}
                                                    </a>
                                                    {selectedRec.originalTweet.timestamp && (
                                                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(selectedRec.originalTweet.timestamp)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[14px] leading-[1.65] whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                                            {selectedRec.originalTweet.text}
                                        </p>
                                        {selectedRec.originalTweet.images?.length > 0 && (
                                            <div className="flex gap-2 mt-3">
                                                {selectedRec.originalTweet.images.slice(0, 4).map((img: string, i: number) => (
                                                    <img key={i} src={img} alt="" className="rounded-lg max-h-[160px] object-cover flex-1 min-w-0"
                                                        style={{ border: '1px solid var(--border)' }}
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                ))}
                                            </div>
                                        )}
                                        {/* Engagement stats */}
                                        {(selectedRec.originalTweet.likes > 0 || selectedRec.originalTweet.retweets > 0) && (
                                            <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                                                {selectedRec.originalTweet.likes > 0 && (
                                                    <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                                                        <span className="material-symbols-sharp text-[14px]" style={{ color: '#EF4444' }}>favorite</span>
                                                        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                            {selectedRec.originalTweet.likes >= 1000 ? `${(selectedRec.originalTweet.likes / 1000).toFixed(1)}K` : selectedRec.originalTweet.likes}
                                                        </span>
                                                        likes
                                                    </div>
                                                )}
                                                {selectedRec.originalTweet.retweets > 0 && (
                                                    <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                                                        <span className="material-symbols-sharp text-[14px]" style={{ color: '#22C55E' }}>repeat</span>
                                                        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                            {selectedRec.originalTweet.retweets >= 1000 ? `${(selectedRec.originalTweet.retweets / 1000).toFixed(1)}K` : selectedRec.originalTweet.retweets}
                                                        </span>
                                                        retweets
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Trending source */}
                            {selectedRec.type === 'Trend' && selectedRec.sourceLinks?.[0]?.url && (
                                <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#8B5CF60A', border: '1px solid #8B5CF620' }}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse"></span>
                                    <span className="text-[#8B5CF6] text-[10px] font-bold tracking-widest uppercase">Trending</span>
                                    <a href={selectedRec.sourceLinks[0].url} target="_blank" rel="noopener noreferrer"
                                        className="ml-auto text-[#8B5CF6] text-[11px] font-medium hover:underline flex items-center gap-1">
                                        {selectedRec.sourceLinks[0].label || 'Read source'} <span className="material-symbols-sharp text-[10px]">open_in_new</span>
                                    </a>
                                </div>
                            )}

                            {/* ─── DRAFT TWEET ─── */}
                            <div className="rounded-xl mb-6 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', border: `1px solid ${action.color}33` }}>
                                <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: `${action.color}08`, borderBottom: `1px solid ${action.color}22` }}>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-sharp text-[14px]" style={{ color: action.color }}>{action.icon}</span>
                                        <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {selectedRec.type === 'Thread' ? 'Draft Thread' : selectedRec.type === 'QRT' ? 'Your Quote Tweet' : 'Draft Tweet'}
                                        </span>
                                        <span className={`text-[11px] font-medium ${isOverLimit ? 'text-[#EF4444]' : ''}`} style={!isOverLimit ? { color: 'var(--text-muted)' } : {}}>
                                            {charCount} chars
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleCopyDraft}
                                            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1"
                                            style={{ color: copiedDraft ? '#22C55E' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                            <span className="material-symbols-sharp text-[12px]">{copiedDraft ? 'check' : 'content_copy'}</span>
                                            {copiedDraft ? 'Copied' : 'Copy'}
                                        </button>
                                        <button onClick={() => handleExecute(selectedRec)}
                                            className="px-3 py-1 rounded-md text-[11px] font-semibold text-white transition-all hover:opacity-90 flex items-center gap-1"
                                            style={{ backgroundColor: '#FF5C00' }}>
                                            <span className="material-symbols-sharp text-[12px]">edit</span>
                                            Edit in Studio
                                        </button>
                                        {(() => {
                                            const isQRT = selectedRec.type === 'QRT' && selectedRec.originalTweet?.tweetUrl;
                                            const intentUrl = isQRT
                                                ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(draftText)}&url=${encodeURIComponent(selectedRec.originalTweet.tweetUrl)}`
                                                : `https://twitter.com/intent/tweet?text=${encodeURIComponent(draftText)}`;
                                            return (
                                                <a href={intentUrl} target="_blank" rel="noopener noreferrer"
                                                    className="px-3 py-1 rounded-md text-[11px] font-semibold text-white transition-all hover:opacity-90 flex items-center gap-1"
                                                    style={{ backgroundColor: '#1DA1F2' }}>
                                                    <span className="material-symbols-sharp text-[12px]">open_in_new</span>
                                                    {isQRT ? 'Quote on X' : 'Post to X'}
                                                </a>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
                                            {brandName.charAt(0)}
                                        </div>
                                        <div>
                                            <span className="text-[13px] font-semibold block" style={{ color: 'var(--text-primary)' }}>{brandName}</span>
                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>@{brandName.toLowerCase().replace(/\s/g, '')}</span>
                                        </div>
                                    </div>
                                    {selectedRec.type === 'Thread' ? (
                                        <div className="space-y-0">
                                            {draftText.split(/(?=\d+\/\s)/).filter(Boolean).map((segment: string, idx: number) => (
                                                <div key={idx} className={`py-3 ${idx > 0 ? 'ml-4' : ''}`} style={idx > 0 ? { borderLeft: '2px solid var(--border)', paddingLeft: '12px' } : {}}>
                                                    <p className="text-base leading-[1.7] whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{segment.trim()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-base leading-[1.7] whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{draftText}</p>
                                    )}
                                </div>
                            </div>

                            {/* ─── WHY THIS WORKS ─── */}
                            <div className="rounded-xl mb-5 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                                <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                                    <span className="material-symbols-sharp text-[14px] text-[#22C55E]">analytics</span>
                                    <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Why This Works</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    {/* Strategic reasoning — the main content */}
                                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                        <LinkifiedText text={safeStr(selectedRec.fullReason || selectedRec.reasoning || 'Based on analysis of social metrics, trending topics, and brand knowledge base.')} />
                                    </p>

                                    {/* Data signal — triggering signal with proof link */}
                                    {(selectedRec.dataSignal || selectedRec.dataSource) && (() => {
                                        const signal = safeStr(selectedRec.dataSignal || selectedRec.dataSource);
                                        // Extract quoted headline for search link
                                        const headlineMatch = signal.match(/'([A-Z][^']{10,})'/);
                                        const searchQuery = headlineMatch?.[1] || signal.replace(/^(WEB3 MARKET TRENDS|MENTIONS|COMPETITOR TWEETS|VIRAL CRYPTO TWITTER):?\s*/i, '').slice(0, 80);
                                        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
                                        // Check for matching source link
                                        const directUrl = selectedRec.sourceLinks?.find((l: any) => l.type === 'article')?.url;
                                        return (
                                            <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                                                <div className="flex items-start gap-2 mb-2">
                                                    <span className="material-symbols-sharp text-[14px] text-[#FF5C00] mt-0.5 flex-shrink-0">bolt</span>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[10px] font-bold tracking-wider uppercase block mb-1" style={{ color: '#FF5C00' }}>Triggering Signal</span>
                                                        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                                            <LinkifiedText text={signal} />
                                                        </p>
                                                    </div>
                                                </div>
                                                <a href={directUrl || searchUrl} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity ml-5"
                                                    style={{ backgroundColor: '#FF5C000A', color: '#FF5C00', border: '1px solid #FF5C0020' }}
                                                    onClick={e => e.stopPropagation()}>
                                                    <span className="material-symbols-sharp text-[12px]">{directUrl ? 'article' : 'search'}</span>
                                                    {directUrl ? 'Read source article' : 'Verify signal'}
                                                    <span className="material-symbols-sharp text-[10px]">open_in_new</span>
                                                </a>
                                            </div>
                                        );
                                    })()}

                                    {/* Source links */}
                                    {selectedRec.sourceLinks?.length > 0 && (
                                        <div className="pt-2 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                                            <span className="text-[10px] font-bold tracking-wider uppercase block" style={{ color: 'var(--text-muted)' }}>Sources</span>
                                            {selectedRec.sourceLinks.map((link: any, lIdx: number) => (
                                                <a key={lIdx} href={link.url} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:opacity-80 transition-opacity group"
                                                    style={{ backgroundColor: link.type === 'tweet' ? '#1DA1F208' : '#8B5CF608', border: `1px solid ${link.type === 'tweet' ? '#1DA1F220' : '#8B5CF620'}` }}
                                                    onClick={e => e.stopPropagation()}>
                                                    <span className="material-symbols-sharp text-[14px] flex-shrink-0" style={{ color: link.type === 'tweet' ? '#1DA1F2' : '#8B5CF6' }}>
                                                        {link.type === 'tweet' ? 'chat_bubble' : link.type === 'article' ? 'article' : 'link'}
                                                    </span>
                                                    <span className="text-[12px] font-medium truncate flex-1" style={{ color: link.type === 'tweet' ? '#1DA1F2' : '#8B5CF6' }}>
                                                        {link.label || 'Source'}
                                                    </span>
                                                    <span className="material-symbols-sharp text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: 'var(--text-muted)' }}>open_in_new</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {/* Source tags — compact row */}
                                    {selectedRec.sourceTags?.length > 0 && (
                                        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                                            {(selectedRec.sourceTags || []).map((tag: string, tIdx: number) => {
                                                const ts = SOURCE_TAG_STYLES[tag] || SOURCE_TAG_STYLES['AI Analysis'];
                                                return (
                                                    <span key={tIdx}
                                                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
                                                        style={{ backgroundColor: `${ts.color}10`, color: ts.color }}>
                                                        <span className="material-symbols-sharp text-[10px]" style={{ fontVariationSettings: "'wght' 300" }}>{ts.icon}</span>
                                                        {tag}
                                                    </span>
                                                );
                                            })}
                                            <span className="ml-auto text-[11px] font-semibold" style={{ color: getPriorityColor(selectedRec.impactScore) }}>
                                                {getPriorityLabel(selectedRec.impactScore)} Priority
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ─── ALTERNATIVE ANGLES ─── */}
                            {selectedRec.contentIdeas?.length > 1 && (
                                <div className="rounded-xl mb-5 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                                    <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                                        <span className="material-symbols-sharp text-[14px] text-[#F59E0B]">lightbulb</span>
                                        <span className="text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>Alternative Angles</span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        {selectedRec.contentIdeas.map((idea: string, j: number) => (
                                            <div key={j} className="flex items-start gap-2.5 p-2.5 rounded-lg transition-colors"
                                                style={{ backgroundColor: 'var(--bg-primary)' }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}>
                                                <span className="text-[11px] font-bold text-[#FF5C00] mt-0.5">{j + 1}</span>
                                                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{idea}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                        );
                    })() : !regenLoading && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <span className="material-symbols-sharp text-[36px] text-[#FF5C00] mb-3">auto_awesome</span>
                            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Select a recommendation</h3>
                            <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
                                Pick one from the queue or run analysis to generate new insights.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── QRT OPPORTUNITIES FEED ─── */}
            {(qrtFeed && qrtFeed.length > 0) && (
                <div className="px-6 py-5" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)' }}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)' }}>
                            <span className="material-symbols-sharp text-white text-[14px]" style={{ fontVariationSettings: "'wght' 400" }}>format_quote</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>QRT Opportunities</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tweets to quote</span>
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-[#06B6D4]/10 text-[#06B6D4] text-[11px] font-semibold">{qrtFeed.length}</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {qrtFeed.map((tweet: any, i: number) => (
                            <div
                                key={tweet.id || `qrt-${i}`}
                                className="flex-shrink-0 w-[320px] rounded-xl p-4 transition-colors"
                                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                        style={{ backgroundColor: ['#A855F7', '#EC4899', '#3B82F6', '#22C55E', '#F59E0B'][i % 5] }}
                                    >
                                        {(tweet.competitor || tweet.author || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>@{tweet.competitor || tweet.author || 'unknown'}</span>
                                    {tweet.timestamp && (
                                        <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>{timeAgo(tweet.timestamp)}</span>
                                    )}
                                </div>
                                <p className="text-[13px] leading-relaxed whitespace-pre-wrap mb-2.5 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{tweet.text}</p>
                                {tweet.images?.[0] && (
                                    <img src={tweet.images[0]} alt="" className="rounded-lg mb-2.5 max-h-[100px] w-full object-cover" style={{ border: '1px solid var(--border)' }} loading="lazy" />
                                )}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        {(tweet.likes > 0) && <span>{tweet.likes} likes</span>}
                                        {(tweet.retweets > 0) && <span>{tweet.retweets} RTs</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {tweet.tweetUrl && (
                                            <a href={tweet.tweetUrl} target="_blank" rel="noopener noreferrer"
                                                className="text-[11px]" style={{ color: 'var(--text-muted)' }}
                                                onClick={e => e.stopPropagation()}>
                                                View
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
                                            <span className="material-symbols-sharp text-[13px]" style={{ fontVariationSettings: "'wght' 400" }}>format_quote</span>
                                            Quote
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
