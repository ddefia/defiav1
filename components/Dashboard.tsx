import React, { useState, useMemo, useEffect } from 'react';
import { SocialMetrics, StrategyTask, CalendarEvent, ComputedMetrics, GrowthReport, BrandConfig, SocialSignals, DashboardCampaign, KPIItem, DailyBrief } from '../types';
import { fetchCampaignPerformance } from '../services/analytics';
import { generateDailyBrief as generateBriefService } from '../services/gemini';
import { loadCampaignState, loadCampaignLogs, loadIntegrationKeys, loadContentItems } from '../services/storage';
import { SkeletonKPICard, SkeletonBriefCard, SkeletonNewsItem } from './Skeleton';
import { generateSupplementalRecs } from './RecommendationsPage';
import { PLAN_NAMES, getResetUsage } from '../services/subscription';
import { useToast } from './Toast';
import { getAuthToken } from '../services/auth';

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
    // Shared recommendation state from App.tsx
    sharedRecommendations?: any[];
    sharedRegenLoading?: boolean;
    sharedRegenLastRun?: number;
    sharedDecisionSummary?: any;
    onRegenerate?: () => void;
    isKickoffGenerating?: boolean;
}

const formatEngagements = (metrics: SocialMetrics) => {
    const total = (metrics.recentPosts || []).reduce((sum, p) => sum + (p.likes || 0) + (p.retweets || 0) + (p.comments || 0), 0);
    if (total >= 1000) return `${(total / 1000).toFixed(1)}K`;
    return total > 0 ? total.toString() : '--';
};

const transformMetricsToKPIs = (
    metrics: SocialMetrics | null,
): KPIItem[] => {
    const followersVal = metrics ? metrics.totalFollowers : 0;
    const impressionsVal = metrics ? metrics.weeklyImpressions : 0;
    const engagementRateVal = metrics ? metrics.engagementRate : 0;

    // Build sparklines from engagement history if available
    const history = metrics?.engagementHistory || [];
    const impressionSpark = history.map((h: any) => h.impressions || 0);
    const engagementSpark = history.map((h: any) => h.rate || 0);

    // Derive comparison from engagement history
    const followersChange = metrics?.comparison?.followersChange || 0;
    const impressionsChange = metrics?.comparison?.impressionsChange || 0;

    const getTrend = (delta: number) => delta > 0 ? 'up' as const : delta < 0 ? 'down' as const : 'flat' as const;

    return [
        {
            label: 'TWITTER FOLLOWERS',
            value: followersVal > 0 ? `${(followersVal / 1000).toFixed(1)}K` : '--',
            delta: followersChange,
            trend: getTrend(followersChange),
            confidence: metrics ? 'High' : 'Low',
            statusLabel: followersVal > 10000 ? 'Strong' : followersVal > 0 ? 'Growing' : 'Weak',
            sparklineData: []
        },
        {
            label: 'TOTAL ENGAGEMENTS',
            value: metrics ? formatEngagements(metrics) : '--',
            delta: 0,
            trend: 'flat' as const,
            confidence: metrics ? 'High' : 'Low',
            statusLabel: metrics ? 'Active' : 'Weak',
            sparklineData: history.map((h: any) => h.engagements || 0)
        },
        {
            label: 'WEEKLY IMPRESSIONS',
            value: impressionsVal > 0 ? `${(impressionsVal / 1000).toFixed(1)}K` : '--',
            delta: impressionsChange,
            trend: getTrend(impressionsChange),
            confidence: metrics ? 'High' : 'Low',
            statusLabel: impressionsVal > 10000 ? 'Strong' : impressionsVal > 0 ? 'Growing' : 'Weak',
            sparklineData: impressionSpark
        },
        {
            label: 'ENGAGEMENT RATE',
            value: metrics ? `${engagementRateVal.toFixed(2)}%` : '--',
            delta: 0,
            trend: getTrend(0),
            confidence: metrics ? 'High' : 'Low',
            statusLabel: metrics ? (engagementRateVal >= 2 ? 'Strong' : 'Watch') : 'Weak',
            sparklineData: engagementSpark
        }
    ];
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
    agentDecisions,
    sharedRecommendations = [],
    sharedRegenLoading = false,
    sharedRegenLastRun = 0,
    sharedDecisionSummary = {},
    onRegenerate,
    isKickoffGenerating = false,
}) => {
    const { showToast } = useToast();
    const [campaigns, setCampaigns] = useState<DashboardCampaign[]>([]);
    const [campaignTab, setCampaignTab] = useState<'all' | 'active' | 'completed'>('all');
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
    const [setupBannerDismissed, setSetupBannerDismissed] = useState(false);
    const [xConnected, setXConnected] = useState<boolean | null>(null);
    const [telegramLinked, setTelegramLinked] = useState(false);
    const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
    const [trialTimeLeft, setTrialTimeLeft] = useState('');
    const [gettingStartedDismissed, setGettingStartedDismissed] = useState(() => {
        try { return localStorage.getItem(`defia_getting_started_dismissed_${brandName}`) === 'true'; } catch { return false; }
    });
    const [gettingStartedCollapsed, setGettingStartedCollapsed] = useState(false);

    // Trial countdown timer
    const trialEndsAt = brandConfig?.subscription?.trialEndsAt;
    useEffect(() => {
        if (!trialEndsAt) return;
        const update = () => {
            const remaining = trialEndsAt - Date.now();
            if (remaining <= 0) {
                setTrialTimeLeft('expired');
                return;
            }
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            setTrialTimeLeft(`${hours}h ${minutes}m`);
        };
        update();
        const interval = setInterval(update, 60_000);
        return () => clearInterval(interval);
    }, [trialEndsAt]);

    // Check for missing setup items
    const integrationKeys = useMemo(() => loadIntegrationKeys(brandName), [brandName]);
    const missingSetup = useMemo(() => {
        const items: { label: string; key: string }[] = [];
        if (xConnected === false) items.push({ label: 'Connect X/Twitter account', key: 'x-auth' });
        if (!integrationKeys.apify && !integrationKeys.xHandle) items.push({ label: 'Add X handle in Settings', key: 'x-handle' });
        return items;
    }, [xConnected, integrationKeys]);

    useEffect(() => {
        const checkXStatus = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
                const res = await fetch(`${baseUrl}/api/auth/x/status?brandId=${encodeURIComponent(brandName)}`);
                if (res.ok) {
                    const data = await res.json();
                    setXConnected(!!data.connected);
                } else {
                    setXConnected(false);
                }
            } catch {
                setXConnected(false);
            }
        };
        checkXStatus();
    }, [brandName]);

    // Check Telegram link status
    useEffect(() => {
        const checkTelegramStatus = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
                const authToken = await getAuthToken();
                const res = await fetch(`${baseUrl}/api/telegram/status?brandId=${encodeURIComponent(brandName)}`, {
                    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                });
                if (res.ok) {
                    const data = await res.json();
                    setTelegramLinked(data.linked === true);
                }
            } catch { /* ignore */ }
        };
        checkTelegramStatus();
    }, [brandName]);

    const kpis = useMemo(() => transformMetricsToKPIs(socialMetrics), [socialMetrics]);

    // Derive fallback recommendations from agentDecisions if sharedRecommendations is empty
    // Supplements with data-driven recs when total < 3
    const displayRecommendations = useMemo(() => {
        let primary: any[] = [];

        if (sharedRecommendations.length > 0) {
            primary = sharedRecommendations;
        } else if (agentDecisions && agentDecisions.length > 0) {
            const valid = agentDecisions.filter((d: any) => {
                const text = (d.reason || '') + (d.draft || '');
                return !text.includes('Could not load') && !text.includes('credentials') && !text.includes('ERROR:')
                    && !text.includes('is not a function') && !text.includes('TypeError') && !text.includes('Failed to');
            });
            const getRecStyleLocal = (action: string) => {
                const n = (action || '').toUpperCase();
                switch (n) {
                    case 'REPLY': return { type: 'Engagement', typeBg: '#3B82F6' };
                    case 'TREND_JACK': return { type: 'Trend', typeBg: '#8B5CF6' };
                    case 'CAMPAIGN': case 'CAMPAIGN_IDEA': return { type: 'Campaign', typeBg: '#FF5C00' };
                    case 'GAP_FILL': return { type: 'Content', typeBg: '#22C55E' };
                    case 'COMMUNITY': return { type: 'Community', typeBg: '#F59E0B' };
                    case 'TWEET': return { type: 'Tweet', typeBg: '#1DA1F2' };
                    case 'THREAD': return { type: 'Thread', typeBg: '#A855F7' };
                    default: return { type: 'Optimization', typeBg: '#F59E0B' };
                }
            };
            primary = valid.slice(0, 6).map((d: any) => {
                const style = getRecStyleLocal(d.action);
                const reason = d.reason || '';
                const draft = d.draft || '';
                const sentenceEnd = reason.search(/[.!?]\s/);
                let title = sentenceEnd > 10 ? reason.slice(0, sentenceEnd + 1) : reason;
                if (title.length > 200) title = title.slice(0, 197).replace(/\s+\S*$/, '') + '…';
                const base = (d.action || '').toUpperCase() === 'TREND_JACK' ? 82 : (d.action || '').toUpperCase() === 'CAMPAIGN' ? 80 : 75;
                const score = Math.min(95, base + Math.min(5, Math.floor(draft.length / 50)));
                return { ...style, title: title || 'Strategic opportunity', fullReason: reason, fullDraft: draft, reasoning: reason, impactScore: score };
            });
        }

        // Supplement with data-driven recs if primary count is below 3
        if (primary.length < 3) {
            const supplemental = generateSupplementalRecs(brandName, socialSignals, socialMetrics, brandConfig, chainMetrics, loadCampaignLogs(brandName));
            return [...primary, ...supplemental].slice(0, 6);
        }

        return primary;
    }, [sharedRecommendations, agentDecisions, brandName, socialSignals, socialMetrics, brandConfig, chainMetrics]);

    // Fetch Web3 news for dashboard
    useEffect(() => {
        setNewsLoading(true);
        // Fallback: stop loading after 10 seconds regardless
        const timeout = setTimeout(() => setNewsLoading(false), 10000);
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
        return () => clearTimeout(timeout);
    }, [brandName]);

    // Pre-load daily brief: show cached instantly, then refresh in background
    useEffect(() => {
        const initBrief = async () => {
            // Only show loading spinner if there's no cached data to display
            if (!briefData) setBriefLoading(true);
            try {
                const brief = await generateBriefService(brandName, kpis, campaigns, [], chainMetrics);
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
        const loadData = async () => {
            try {
                // Try Supabase first, fall back to computed chain metrics
                const camps = await fetchCampaignPerformance();
                if (mounted && camps.length > 0) {
                    setCampaigns(camps);
                } else if (mounted && chainMetrics?.campaignPerformance?.length) {
                    // Map attribution data to DashboardCampaign format
                    const logs = loadCampaignLogs(brandName);
                    const mapped: DashboardCampaign[] = chainMetrics.campaignPerformance.map(perf => {
                        const log = logs.find(l => l.id === perf.campaignId);
                        if (!log) return null;
                        const wallets = perf.cpa > 0 ? Math.round(log.budget / perf.cpa) : 0;
                        return {
                            id: log.id, name: log.name,
                            channel: log.channel as any || 'Twitter',
                            spend: log.budget, attributedWallets: wallets,
                            cpa: perf.cpa, retention: perf.retention || 0,
                            valueCreated: perf.roi * log.budget, roi: perf.roi,
                            status: (perf.roi > 2 ? 'Scale' : perf.roi > 1 ? 'Test' : 'Pause') as any,
                            trendSignal: perf.lift > 1.2 ? 'up' : perf.lift < 0.8 ? 'down' : 'flat',
                            confidence: log.budget > 1000 ? 'High' : 'Med',
                            aiSummary: [`${perf.lift.toFixed(1)}x lift vs baseline`, `${perf.whalesAcquired} high-activity wallets`],
                            anomalies: [], priorityScore: Math.min(10, Math.round(perf.roi * 2)),
                            type: 'Alpha' as const, expectedImpact: perf.roi > 2 ? 'Strong growth signal' : 'Needs optimization',
                            recommendation: {
                                action: (perf.roi > 2 ? 'Scale' : perf.roi > 1 ? 'Test' : 'Pause') as any,
                                reasoning: [`CPA: $${perf.cpa.toFixed(2)}`, `ROI: ${perf.roi.toFixed(1)}x`, `${perf.whalesAcquired} whales acquired`],
                                confidence: 'Med' as const,
                            },
                        };
                    }).filter(Boolean) as DashboardCampaign[];
                    setCampaigns(mapped);
                }
            } catch (e) {
                console.error("Dashboard Data Load Failed", e);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, [brandName, chainMetrics]);

    useEffect(() => {
        // Primary: load kickoff drafts from Content Studio storage (new location)
        const contentItems = loadContentItems(brandName);
        const kickoffContentItems = contentItems.filter((item: any) => String(item?.id || '').startsWith('kickoff-'));
        const kickoffSchedule = calendarEvents.filter((event) => String(event?.id || '').startsWith('kickoff-'));

        // Fallback: check legacy campaign state for backward compatibility
        let legacyDrafts: any[] = [];
        let legacyTheme = `${brandName} Launch`;
        if (kickoffContentItems.length === 0) {
            const state = loadCampaignState(brandName);
            const allDrafts = Array.isArray(state?.campaignItems) ? state.campaignItems : [];
            legacyDrafts = allDrafts.filter((item: any) => String(item?.id || '').startsWith('kickoff-'));
            legacyTheme = state?.campaignTheme || legacyTheme;
        }

        const drafts = kickoffContentItems.length > 0 ? kickoffContentItems : legacyDrafts;

        if (drafts.length === 0 && kickoffSchedule.length === 0) {
            setKickoffState(null);
            return;
        }

        // Normalize: ContentItems use 'description', CampaignItems use 'tweet'
        const normalizedDrafts = drafts.map((d: any) => ({
            id: d.id,
            tweet: d.description || d.tweet || d.title,
        }));

        setKickoffState({
            theme: kickoffContentItems.length > 0
                ? (kickoffContentItems[0]?.kickoffTheme || `${brandName} Launch`)
                : legacyTheme,
            drafts: normalizedDrafts,
            schedule: kickoffSchedule
        });
    }, [brandName, calendarEvents]);

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

    // Getting Started checklist
    const gettingStartedItems = useMemo(() => [
        {
            id: 'profile',
            title: 'Brand profile created',
            subtitle: 'Your AI CMO has analyzed your brand identity and voice',
            done: true,
            icon: 'person',
        },
        {
            id: 'kickoff',
            title: 'Review your launch content',
            subtitle: '3 draft posts and a 7-day calendar are ready',
            done: !!kickoffState?.drafts?.length,
            icon: 'edit_note',
            action: () => onNavigate('studio'),
            actionLabel: 'Review in Studio',
        },
        {
            id: 'create',
            title: 'Create your first post',
            subtitle: 'Head to Content Studio to generate tweets and graphics',
            done: (brandConfig?.subscription?.usage?.contentThisMonth || 0) > 0,
            icon: 'draw',
            action: () => onNavigate('studio'),
            actionLabel: 'Open Studio',
        },
        {
            id: 'connect',
            title: 'Connect your X account',
            subtitle: 'Link Twitter for real metrics and auto-publishing',
            done: xConnected === true,
            icon: 'link',
            action: () => onNavigate('settings'),
            actionLabel: 'Connect X',
        },
        {
            id: 'recs',
            title: 'Explore AI recommendations',
            subtitle: 'Your AI CMO analyzes market signals and suggests actions',
            done: (sharedRecommendations?.length || 0) > 0 || (agentDecisions?.length || 0) > 0,
            icon: 'auto_awesome',
            action: () => onNavigate('recommendations'),
            actionLabel: 'View Recs',
        },
        {
            id: 'telegram',
            title: 'Connect Telegram bot',
            subtitle: 'Get daily briefings and create content from your Telegram group',
            done: telegramLinked,
            icon: 'send',
            action: () => onNavigate('settings'),
            actionLabel: 'Connect',
        },
    ], [kickoffState, brandConfig, xConnected, telegramLinked, sharedRecommendations, agentDecisions, onNavigate]);

    const gettingStartedComplete = gettingStartedItems.filter(i => i.done).length;
    const gettingStartedTotal = gettingStartedItems.length;

    const dismissGettingStarted = () => {
        setGettingStartedDismissed(true);
        try { localStorage.setItem(`defia_getting_started_dismissed_${brandName}`, 'true'); } catch {}
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
        <div className="flex-1 py-8 px-10 overflow-y-auto space-y-7" style={{ backgroundColor: 'var(--bg-primary)' }}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[38px] font-normal tracking-tight" style={{ fontFamily: 'Instrument Serif, serif', letterSpacing: '-1px', color: 'var(--text-primary)' }}>Marketing Dashboard</h1>
                    <p className="text-sm font-['Inter']" style={{ color: 'var(--text-muted)' }}>Track engagement, news, and create content for your Web3 brand</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onNavigate('studio')}
                        className="h-10 px-4 rounded-full bg-[#FF5C00] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#FF6B1A] transition-colors font-['Inter']"
                    >
                        Create Content
                    </button>
                </div>
            </div>

            {/* Setup Banner — shows when X auth or key configs are missing */}
            {!setupBannerDismissed && missingSetup.length > 0 && (
                <div
                    className="rounded-xl p-4 flex items-center justify-between"
                    style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid var(--accent)' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#FF5C00] flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'wght' 400" }}>info</span>
                        </div>
                        <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Complete your setup</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {missingSetup.map(s => s.label).join(' \u00B7 ')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onNavigate('settings')}
                            className="px-4 py-2 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                        >
                            Go to Settings
                        </button>
                        <button
                            onClick={() => setSetupBannerDismissed(true)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <span className="material-symbols-sharp text-lg">close</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Trial Countdown Banner — always show when expired (non-dismissible), otherwise respect dismiss */}
            {trialEndsAt && trialTimeLeft && (trialTimeLeft === 'expired' || !trialBannerDismissed) && (
                <div
                    className="rounded-xl p-4 flex items-center justify-between"
                    style={{
                        backgroundColor: trialTimeLeft === 'expired' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                        border: `1px solid ${trialTimeLeft === 'expired' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: trialTimeLeft === 'expired' ? '#EF4444' : '#22C55E' }}
                        >
                            <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'wght' 400" }}>
                                {trialTimeLeft === 'expired' ? 'timer_off' : 'hourglass_top'}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {trialTimeLeft === 'expired'
                                    ? 'Your free trial has ended'
                                    : `Free trial: ${trialTimeLeft} remaining`}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {trialTimeLeft === 'expired'
                                    ? 'Upgrade to continue creating content and using your AI CMO.'
                                    : 'Starter plan limits apply. Upgrade anytime for more capacity.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onNavigate('settings', { tab: 'billing' })}
                            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
                            style={{ backgroundColor: trialTimeLeft === 'expired' ? '#EF4444' : '#FF5C00' }}
                        >
                            {trialTimeLeft === 'expired' ? 'Upgrade Now' : 'View Plans'}
                        </button>
                        {trialTimeLeft !== 'expired' && (
                            <button
                                onClick={() => setTrialBannerDismissed(true)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <span className="material-symbols-sharp text-lg">close</span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Getting Started Checklist */}
            {brandConfig?.subscription && !gettingStartedDismissed && (
                <div
                    className="rounded-xl overflow-hidden"
                    style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--card-shadow)',
                        borderLeft: '3px solid #FF5C00',
                    }}
                >
                    {/* Header */}
                    <div
                        className="px-5 py-4 flex items-center justify-between cursor-pointer"
                        onClick={() => setGettingStartedCollapsed(!gettingStartedCollapsed)}
                        style={{ borderBottom: gettingStartedCollapsed ? 'none' : '1px solid var(--border)' }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 400" }}>rocket_launch</span>
                            </div>
                            <div>
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Getting Started</span>
                                <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                                    {gettingStartedComplete} of {gettingStartedTotal} complete
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Progress bar */}
                            <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${(gettingStartedComplete / gettingStartedTotal) * 100}%`,
                                        backgroundColor: gettingStartedComplete === gettingStartedTotal ? '#22C55E' : '#FF5C00',
                                    }}
                                />
                            </div>
                            <span
                                className="material-symbols-sharp text-sm transition-transform duration-200"
                                style={{ color: 'var(--text-muted)', fontVariationSettings: "'wght' 300", transform: gettingStartedCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}
                            >
                                arrow_forward
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); dismissGettingStarted(); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <span className="material-symbols-sharp text-base">close</span>
                            </button>
                        </div>
                    </div>

                    {/* Checklist items */}
                    {!gettingStartedCollapsed && (
                        <div className="px-5 py-3">
                            {gettingStartedComplete === gettingStartedTotal && (
                                <div className="flex items-center justify-between py-3 px-4 mb-3 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-sharp text-[#22C55E] text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>celebration</span>
                                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>All done! You're all set.</span>
                                    </div>
                                    <button
                                        onClick={dismissGettingStarted}
                                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#22C55E] text-white hover:bg-[#36D06C] transition-colors"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            )}
                            {gettingStartedItems.map((item, i) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-4 py-3"
                                    style={{ borderBottom: i < gettingStartedItems.length - 1 ? '1px solid var(--border)' : 'none' }}
                                >
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{
                                            backgroundColor: item.done ? 'rgba(34, 197, 94, 0.12)' : 'var(--bg-tertiary)',
                                            border: `1px solid ${item.done ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
                                        }}
                                    >
                                        <span
                                            className="material-symbols-sharp text-sm"
                                            style={{
                                                color: item.done ? '#22C55E' : 'var(--text-muted)',
                                                fontVariationSettings: item.done ? "'FILL' 1, 'wght' 400" : "'wght' 300",
                                            }}
                                        >
                                            {item.done ? 'check_circle' : item.icon}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className="text-sm font-medium"
                                            style={{ color: item.done ? 'var(--text-muted)' : 'var(--text-primary)' }}
                                        >
                                            {item.title}
                                        </p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.subtitle}</p>
                                    </div>
                                    {!item.done && item.action && (
                                        <button
                                            onClick={item.action}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#FF5C00] hover:bg-[#FF6B1A] transition-colors flex-shrink-0"
                                        >
                                            {item.actionLabel}
                                        </button>
                                    )}
                                    {item.done && (
                                        <span className="text-xs font-medium text-[#22C55E] flex-shrink-0">Done</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {/* Restore Getting Started link when dismissed */}
            {brandConfig?.subscription && gettingStartedDismissed && (
                <button
                    onClick={() => {
                        setGettingStartedDismissed(false);
                        try { localStorage.removeItem(`defia_getting_started_dismissed_${brandName}`); } catch {}
                    }}
                    className="text-xs text-[#6B6B70] hover:text-[#FF5C00] transition-colors mb-4 flex items-center gap-1.5"
                >
                    <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>help_outline</span>
                    Show setup guide
                </button>
            )}

                    {/* Metrics Row */}
                    <div className="grid grid-cols-4 gap-4 mb-7">
                        {kpis.map((kpi, i) => (
                            <div key={i} className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
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
                                        <div className="text-[32px] font-medium font-mono tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
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

                    {/* Plan Usage Bar */}
                    {brandConfig?.subscription && (() => {
                        const sub = brandConfig.subscription;
                        const usage = getResetUsage(sub.usage);
                        const contentMax = sub.limits.contentPerMonth;
                        const imageMax = sub.limits.imagesPerMonth;
                        const contentPct = contentMax === -1 ? 0 : Math.min(100, (usage.contentThisMonth / contentMax) * 100);
                        const imagePct = imageMax === -1 ? 0 : Math.min(100, (usage.imagesThisMonth / imageMax) * 100);
                        return (
                            <div
                                className="rounded-xl p-4 mb-7 flex items-center gap-6 flex-wrap"
                                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-sharp text-base" style={{ color: '#FF5C00', fontVariationSettings: "'FILL' 1, 'wght' 300" }}>workspace_premium</span>
                                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        {PLAN_NAMES[sub.plan]} Plan
                                    </span>
                                </div>
                                <div className="h-4 w-px" style={{ backgroundColor: 'var(--border)' }} />
                                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                                    <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Content</span>
                                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                        <div className="h-full rounded-full transition-all" style={{ width: contentMax === -1 ? '5%' : `${contentPct}%`, backgroundColor: contentPct >= 90 ? '#EF4444' : '#FF5C00' }} />
                                    </div>
                                    <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                        {usage.contentThisMonth}/{contentMax === -1 ? '∞' : contentMax}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                                    <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Images</span>
                                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                        <div className="h-full rounded-full transition-all" style={{ width: imageMax === -1 ? '5%' : `${imagePct}%`, backgroundColor: imagePct >= 90 ? '#EF4444' : '#FF5C00' }} />
                                    </div>
                                    <span className="text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                        {usage.imagesThisMonth}/{imageMax === -1 ? '∞' : imageMax}
                                    </span>
                                </div>
                                <button
                                    onClick={() => onNavigate('settings', { tab: 'billing' })}
                                    className="text-[11px] font-medium text-[#FF5C00] hover:text-[#FF6B1A] transition-colors whitespace-nowrap"
                                >
                                    Manage Plan →
                                </button>
                            </div>
                        );
                    })()}

                    {/* On-Chain Analytics — only when chain data exists */}
                    {chainMetrics && (chainMetrics.netNewWallets > 0 || chainMetrics.totalVolume > 0 || chainMetrics.activeWallets > 0) && (
                        <div className="rounded-xl overflow-hidden mb-7" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                            <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                                <span className="material-symbols-sharp text-base" style={{ color: '#8B5CF6', fontVariationSettings: "'wght' 300" }}>token</span>
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>On-Chain Analytics</span>
                                {brandConfig?.blockchain?.contracts && (() => {
                                    const chains = [...new Set(brandConfig.blockchain!.contracts.map(c => c.chain).filter(Boolean))];
                                    return chains.length > 0 ? (
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            {chains.map(chain => (
                                                <span key={chain} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#8B5CF615', color: '#8B5CF6' }}>
                                                    {chain}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                            <div className="grid grid-cols-4 gap-4 p-5">
                                <div>
                                    <div className="text-xs font-medium tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>NEW WALLETS</div>
                                    <div className="text-2xl font-medium font-mono tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                        {chainMetrics.netNewWallets > 1000 ? `${(chainMetrics.netNewWallets / 1000).toFixed(1)}K` : chainMetrics.netNewWallets.toLocaleString()}
                                    </div>
                                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>net new</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>ACTIVE WALLETS</div>
                                    <div className="text-2xl font-medium font-mono tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                        {chainMetrics.activeWallets > 1000 ? `${(chainMetrics.activeWallets / 1000).toFixed(1)}K` : chainMetrics.activeWallets.toLocaleString()}
                                    </div>
                                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>currently active</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>VOLUME</div>
                                    <div className="text-2xl font-medium font-mono tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                        {chainMetrics.totalVolume > 1_000_000 ? `$${(chainMetrics.totalVolume / 1_000_000).toFixed(1)}M` : chainMetrics.totalVolume > 1000 ? `$${(chainMetrics.totalVolume / 1000).toFixed(0)}K` : `$${chainMetrics.totalVolume.toLocaleString()}`}
                                    </div>
                                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>total</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>RETENTION</div>
                                    <div className="text-2xl font-medium font-mono tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                        {chainMetrics.retentionRate.toFixed(1)}%
                                    </div>
                                    <div className="text-xs mt-1" style={{ color: chainMetrics.retentionRate >= 30 ? '#22C55E' : chainMetrics.retentionRate >= 15 ? '#F59E0B' : 'var(--text-muted)' }}>
                                        {chainMetrics.retentionRate >= 30 ? 'Healthy' : chainMetrics.retentionRate >= 15 ? 'Average' : 'Low'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Daily Brief — inline expandable card */}
                    {briefData && briefData.confidence?.explanation && (
                        <div
                            className="rounded-xl overflow-hidden mb-7 transition-all duration-200"
                            style={{ border: '1px solid #FF5C0033', background: 'var(--bg-secondary)' }}
                        >
                            <div
                                onClick={() => setIsBriefOpen(!isBriefOpen)}
                                className="px-5 py-4 cursor-pointer hover:opacity-90 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 300" }}>auto_awesome</span>
                                        </div>
                                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Daily Brief</span>
                                        <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{new Date(briefData.timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                                        {(() => {
                                            const hoursAgo = Math.floor((Date.now() - briefData.timestamp) / (1000 * 60 * 60));
                                            if (hoursAgo >= 1) {
                                                return <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>· {hoursAgo}h ago</span>;
                                            }
                                            return (
                                                <span className="flex items-center gap-1 text-[10px] text-[#22C55E] font-medium">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                                                    Just now
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[#FF5C00] text-xs font-medium opacity-60 hover:opacity-100 transition-opacity">
                                        <span>{isBriefOpen ? 'Collapse' : 'Expand'}</span>
                                        <span className="material-symbols-sharp text-sm transition-transform duration-200" style={{ fontVariationSettings: "'wght' 300", transform: isBriefOpen ? 'rotate(90deg)' : 'none' }}>arrow_forward</span>
                                    </div>
                                </div>
                                <p className={`text-[13px] leading-[1.7] ${isBriefOpen ? '' : 'line-clamp-3'}`} style={{ color: 'var(--text-secondary)' }}>{renderRichText(briefData.confidence.explanation)}</p>
                            </div>

                            {/* Expanded brief content */}
                            {isBriefOpen && (
                                <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>
                                    {/* Metrics Snapshot Strip */}
                                    {briefData.metricsSnapshot && briefData.metricsSnapshot.length > 0 && (
                                        <div className="flex gap-3 pt-4 pb-3 overflow-x-auto">
                                            {briefData.metricsSnapshot.map((m, i) => (
                                                <div key={i} className="flex-1 min-w-[100px] p-3 rounded-lg bg-[#0A0A0B] border border-[#1F1F23]">
                                                    <p className="text-[10px] text-[#6B6B70] uppercase tracking-wider font-medium mb-1">{m.label}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white text-lg font-semibold font-mono">{m.value}</span>
                                                        <span className={`material-symbols-sharp text-sm ${m.trend === 'up' ? 'text-[#22C55E]' : m.trend === 'down' ? 'text-[#EF4444]' : 'text-[#6B6B70]'}`} style={{ fontVariationSettings: "'wght' 300" }}>
                                                            {m.trend === 'up' ? 'trending_up' : m.trend === 'down' ? 'trending_down' : 'trending_flat'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        {/* Key Drivers */}
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-2 mb-2.5">
                                                <span className="material-symbols-sharp text-[#FF5C00] text-base" style={{ fontVariationSettings: "'wght' 300" }}>trending_up</span>
                                                <h3 className="text-[10px] font-bold text-[#FF5C00] uppercase tracking-[0.15em]">Key Drivers</h3>
                                            </div>
                                            <div className="space-y-1.5">
                                                {briefData.keyDrivers.map((item, i) => (
                                                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-[#0A0A0B] border border-[#1F1F23]">
                                                        <span className="material-symbols-sharp text-[#3B82F6] text-sm mt-0.5 shrink-0" style={{ fontVariationSettings: "'wght' 300" }}>bolt</span>
                                                        <p className="text-[12px] text-[#C4C4C4] leading-relaxed">{renderRichText(item)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Reinforced */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-2.5">
                                                <span className="material-symbols-sharp text-[#22C55E] text-base" style={{ fontVariationSettings: "'wght' 300" }}>verified</span>
                                                <h3 className="text-[10px] font-bold text-[#22C55E] uppercase tracking-[0.15em]">Reinforced</h3>
                                            </div>
                                            <div className="space-y-1.5">
                                                {briefData.decisionsReinforced.map((item, i) => (
                                                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-[#0A0A0B] border border-[#1F1F23]">
                                                        <span className="material-symbols-sharp text-[#22C55E] text-xs mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check_circle</span>
                                                        <p className="text-[12px] text-[#C4C4C4] leading-relaxed">{renderRichText(item)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Risks */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-2.5">
                                                <span className="material-symbols-sharp text-[#F59E0B] text-base" style={{ fontVariationSettings: "'wght' 300" }}>warning</span>
                                                <h3 className="text-[10px] font-bold text-[#F59E0B] uppercase tracking-[0.15em]">Risks</h3>
                                            </div>
                                            <div className="rounded-lg bg-[#F59E0B06] border border-[#F59E0B18] p-3 space-y-2">
                                                {briefData.risksAndUnknowns.map((item, i) => (
                                                    <div key={i} className="flex items-start gap-2">
                                                        <span className="material-symbols-sharp text-[#F59E0B] text-xs mt-0.5 shrink-0" style={{ fontVariationSettings: "'wght' 300" }}>error</span>
                                                        <p className="text-[12px] text-[#D4A94E] leading-relaxed">{renderRichText(item)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Today's Actions */}
                                        {briefData.topActions && briefData.topActions.length > 0 && (
                                            <div className="col-span-2 pt-1">
                                                <div className="flex items-center gap-2 mb-2.5">
                                                    <span className="material-symbols-sharp text-[#3B82F6] text-base" style={{ fontVariationSettings: "'wght' 300" }}>task_alt</span>
                                                    <h3 className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-[0.15em]">Today's Priority Actions</h3>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {briefData.topActions.map((action, i) => (
                                                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#3B82F608] border border-[#3B82F618]">
                                                            <div className="w-5 h-5 rounded-full bg-[#3B82F622] flex items-center justify-center flex-shrink-0">
                                                                <span className="text-[#3B82F6] text-[10px] font-bold">{i + 1}</span>
                                                            </div>
                                                            <p className="text-[12px] text-[#C4C4C4] leading-relaxed flex-1">{renderRichText(action)}</p>
                                                            <span className="material-symbols-sharp text-[14px] text-[#3B82F644]" style={{ fontVariationSettings: "'wght' 300" }}>arrow_forward</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Confidence */}
                                        <div className="col-span-2 pt-1">
                                            <div className="flex items-center gap-2 mb-2.5">
                                                <span className="material-symbols-sharp text-[#8B5CF6] text-base" style={{ fontVariationSettings: "'wght' 300" }}>psychology</span>
                                                <h3 className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-[0.15em]">Confidence</h3>
                                            </div>
                                            <div className="p-3 rounded-lg bg-[#0A0A0B] border border-[#1F1F23]">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                                        briefData.confidence.level === 'High' ? 'bg-[#22C55E18] text-[#22C55E] border border-[#22C55E33]' :
                                                        briefData.confidence.level === 'Medium' ? 'bg-[#F59E0B18] text-[#F59E0B] border border-[#F59E0B33]' :
                                                        'bg-[#EF444418] text-[#EF4444] border border-[#EF444433]'
                                                    }`}>
                                                        {briefData.confidence.level}
                                                    </span>
                                                    <div className="flex-1 h-1.5 rounded-full bg-[#1F1F23] overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-500 ${
                                                            briefData.confidence.level === 'High' ? 'w-[90%] bg-gradient-to-r from-[#22C55E] to-[#4ADE80]' :
                                                            briefData.confidence.level === 'Medium' ? 'w-[60%] bg-gradient-to-r from-[#F59E0B] to-[#FBBF24]' :
                                                            'w-[30%] bg-gradient-to-r from-[#EF4444] to-[#F87171]'
                                                        }`}></div>
                                                    </div>
                                                </div>
                                                <p className="text-[12px] text-[#8B8B8F] leading-relaxed">{renderRichText(briefData.confidence.explanation)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {briefLoading && !briefData && <SkeletonBriefCard />}

                    {/* Kickoff generating skeleton */}
                    {isKickoffGenerating && !kickoffState && (
                        <div className="rounded-xl border border-[#FF5C0033] bg-[#111113] p-5 mb-7">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-5 h-5 border-2 border-[#FF5C00] border-t-transparent rounded-full animate-spin" />
                                <div>
                                    <div className="text-xs font-semibold text-[#FF5C00] tracking-widest">GENERATING</div>
                                    <h3 className="text-white text-lg font-semibold mt-1">Creating your launch content...</h3>
                                    <p className="text-[#8B8B8F] text-sm mt-1">Preparing draft posts and scheduling your 7-day calendar.</p>
                                </div>
                            </div>
                            <div className="space-y-3 mt-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-10 rounded-lg bg-[#1F1F23] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {kickoffState && (
                        <div className="rounded-xl border border-[#22C55E33] bg-[#111113] p-5 mb-7">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <div className="text-xs font-semibold text-[#22C55E] tracking-widest">KICKOFF COMPLETE</div>
                                    <h3 className="text-white text-lg font-semibold mt-1">Launch pack ready for {kickoffState.theme}</h3>
                                    <p className="text-[#8B8B8F] text-sm mt-1">3 draft posts prepared and a 7-day calendar mapped.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onNavigate('studio')}
                                        className="px-4 py-2 rounded-lg bg-[#22C55E] text-[#0A0A0B] text-xs font-semibold hover:bg-[#36D06C] transition-colors"
                                    >
                                        Review in Studio
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
                                            <div key={draft.id || index} className="text-sm text-white/90 rounded-lg px-3 py-2">
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
                                                <div key={event.id || index} className="flex items-start gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-[#1F1F23] transition-colors" onClick={() => onNavigate('calendar')}>
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

                    {/* AI CMO Recommendations — Compact Card (full page at /recommendations) */}
                    <div
                        onClick={() => onNavigate('recommendations')}
                        className="rounded-xl border border-[#FF5C0044] overflow-hidden mb-7 cursor-pointer hover:border-[#FF5C0088] transition-all group"
                        style={{ background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-secondary) 100%)' }}
                    >
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center">
                                    <span className="material-symbols-sharp text-white text-[16px]">auto_awesome</span>
                                </div>
                                <span className="text-white text-sm font-semibold">AI CMO Recommendations</span>
                                {displayRecommendations.length > 0 && (
                                    <span className="px-2 py-1 rounded-full bg-[#FF5C0022] text-[#FF5C00] text-xs font-medium">{displayRecommendations.length} Actions</span>
                                )}
                                {sharedRecommendations.length > 0 && (
                                    <span className="px-2 py-1 rounded-full bg-[#22C55E18] text-[#22C55E] text-[10px] font-medium">LLM Powered</span>
                                )}
                                {sharedRecommendations.length === 0 && displayRecommendations.length > 0 && (
                                    <span className="px-2 py-1 rounded-full bg-[#F59E0B18] text-[#F59E0B] text-[10px] font-medium">Agent Decisions</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {sharedRegenLastRun > 0 && (
                                    <span className="text-[#6B6B70] text-[10px]">Updated {timeAgo(sharedRegenLastRun)}</span>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (onRegenerate) onRegenerate(); }}
                                    disabled={sharedRegenLoading}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${sharedRegenLoading ? 'bg-[#FF5C0022] text-[#FF5C00] cursor-wait' : 'bg-white/5 text-[#ADADB0] hover:bg-white/10'}`}
                                >
                                    <svg className={`w-3 h-3 ${sharedRegenLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {sharedRegenLoading ? 'Analyzing...' : 'Refresh'}
                                </button>
                            </div>
                        </div>

                        {/* Compact recommendation preview — click to open full page */}
                        {sharedRegenLoading ? (
                            <div className="p-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full border-2 border-[#FF5C00] border-t-transparent animate-spin"></div>
                                    <span className="text-[#FF5C00] text-xs font-medium">4-Agent Council analyzing market signals...</span>
                                </div>
                            </div>
                        ) : displayRecommendations.length > 0 ? (
                            <div className="p-4 space-y-2">
                                {displayRecommendations.slice(0, 3).map((rec: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#0A0A0B] border border-[#1F1F23] hover:border-[#FF5C0044] transition-all">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: rec.typeBg }}></span>
                                            <span className="text-[10px] font-bold tracking-wider uppercase flex-shrink-0" style={{ color: rec.typeBg }}>{rec.type}</span>
                                            <span className="text-white text-sm truncate">{(rec.title || '').replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY|CAMPAIGN_IDEA)\s*:\s*/i, '').trim()}</span>
                                        </div>
                                        <span className="text-xs font-medium flex-shrink-0" style={{ color: rec.impactScore >= 85 ? '#22C55E' : rec.impactScore >= 70 ? '#F59E0B' : '#6B6B70' }}>
                                            {rec.impactScore}%
                                        </span>
                                        <span className="material-symbols-sharp text-[14px] text-[#6B7280] flex-shrink-0">chevron_right</span>
                                    </div>
                                ))}
                                {displayRecommendations.length > 3 && (
                                    <p className="text-center text-[#6B6B70] text-[11px] pt-1">+{displayRecommendations.length - 3} more recommendations</p>
                                )}
                                <div className="flex items-center justify-center pt-1">
                                    <span className="text-[#FF5C00] text-xs font-medium group-hover:underline flex items-center gap-1">
                                        View All Recommendations
                                        <span className="material-symbols-sharp text-[14px]">arrow_forward</span>
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 text-center">
                                <p className="text-[#6B6B70] text-sm mb-2">No recommendations yet</p>
                                <p className="text-[#6B6B70] text-xs">Click Refresh or open the full Recommendations page.</p>
                            </div>
                        )}
                    </div>

                    {/* Two Column Section: News + Audience */}
                    <div className="grid grid-cols-2 gap-6 mb-7">
                        {/* Web3 News Feed */}
                        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
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
                                        <span className="material-symbols-sharp text-2xl mb-2" style={{ color: '#3A3A3E', fontVariationSettings: "'wght' 300" }}>newspaper</span>
                                        <p className="text-[#6B6B70] text-xs">No news yet — check back shortly.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Audience Insights */}
                        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
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
                    <div className="rounded-xl overflow-hidden mb-7" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
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
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
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
                                <div key={content.id || i} className="rounded-xl bg-[#0A0A0B] border border-[#1F1F23] overflow-hidden cursor-pointer hover:border-[#FF5C00]/50 transition-colors" onClick={() => onNavigate('calendar')}>
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

                </div>
    );
};
