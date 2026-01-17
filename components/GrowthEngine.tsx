import React, { useState, useEffect, useCallback } from 'react';
import { CampaignLog, GrowthInput, ComputedMetrics, GrowthReport, SocialMetrics, CalendarEvent, TrendItem, BrandConfig, LunarCrushCreator, LunarCrushTimeSeriesItem, LunarCrushPost, StrategyTask, SocialSignals } from '../types';
import { computeGrowthMetrics, getSocialMetrics, fetchSocialMetrics, getHandle } from '../services/analytics';
import { getIntegrationConfig } from '../config/integrations';
import { generateGrowthReport, generateStrategicAnalysis } from '../services/gemini';
import { getCreator, getCreatorTimeSeries, getCreatorPosts, fetchMarketPulse, getBrainContext } from '../services/pulse';

import { Button } from './Button';
import { StrategyBrain } from './StrategyBrain';
import { SocialActivityFeed } from './SocialActivityFeed';
import { loadIntegrationKeys, saveIntegrationKeys } from '../services/storage';

interface GrowthEngineProps {
    brandName: string;
    calendarEvents: CalendarEvent[];
    brandConfig: BrandConfig;
    onSchedule: (content: string, image?: string, campaignName?: string) => void;
    metrics: SocialMetrics | null;
    onUpdateMetrics: (m: SocialMetrics) => void;
    tasks: StrategyTask[];
    onUpdateTasks: (t: StrategyTask[]) => void;
    chainMetrics: ComputedMetrics | null;
    onUpdateChainMetrics: (metrics: ComputedMetrics | null) => void;
    growthReport: GrowthReport | null; // New
    onUpdateGrowthReport: (r: GrowthReport) => void; // New
    onLog: (msg: string) => void;
    signals: SocialSignals; // New: War Room Context
    onNavigate?: (section: string, params?: any) => void; // New
}

interface ContractInput {
    id: string;
    label: string;
    address: string;
    type: string;
}

// Internal Component for Top-Row Stats
const StatCard = ({ label, value, trend, trendDirection, subtext, icon, isLoading }: any) => (
    <div className="bg-brand-surface p-6 rounded-2xl border border-brand-border shadow-premium hover:shadow-premium-hover transition-all duration-300 flex flex-col justify-between h-full group relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
            <span className="text-[11px] font-bold text-brand-muted uppercase tracking-widest font-display">{label}</span>
            {trend && (
                <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded-full border ${trendDirection === 'up' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                    {trendDirection === 'up' ? '↗' : '↘'} {trend}
                </span>
            )}
            {/* Sparkline Placeholder if needed for engagement */}
            {label === 'Engagement' && (
                <div className="absolute right-0 top-0 opacity-10">
                    <svg width="60" height="30" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0,30 Q10,25 20,20 T40,10 T60,5" fill="none" stroke="currentColor" strokeWidth="2" />
                    </svg>
                </div>
            )}
        </div>
        <div className="space-y-1 relative z-10">
            {isLoading ? (
                <div className="h-8 w-24 bg-brand-surfaceHighlight animate-pulse rounded" />
            ) : (
                <div className="text-3xl font-display font-bold text-brand-text tracking-tight group-hover:text-brand-accent transition-colors">{value}</div>
            )}
            <div className="text-xs text-brand-textSecondary font-medium">{subtext}</div>
        </div>
    </div>
);

export const GrowthEngine: React.FC<GrowthEngineProps> = ({ brandName, calendarEvents, brandConfig, onSchedule, metrics, onUpdateMetrics, tasks, onUpdateTasks, chainMetrics, onUpdateChainMetrics, growthReport, onUpdateGrowthReport, onLog, signals, onNavigate }) => {
    // --- ANALYTICS STATE ---
    // const [socialMetrics, setSocialMetrics] = useState<SocialMetrics | null>(null); // LIFTED
    const socialMetrics = metrics; // Alias for easier refactor

    const [lunarMetrics, setLunarMetrics] = useState<LunarCrushCreator | null>(null);
    const [lunarTimeSeries, setLunarTimeSeries] = useState<LunarCrushTimeSeriesItem[]>([]);
    const [lunarPosts, setLunarPosts] = useState<LunarCrushPost[]>([]);
    const [isSocialLoading, setIsSocialLoading] = useState(false);
    const [isOnChainConnected, setIsOnChainConnected] = useState(false);
    const [isSettingUp, setIsSettingUp] = useState(false);
    const [isProcessing, setIsProcessing] = useState(true); // Default to processing for "Live" feel
    const [processingStatus, setProcessingStatus] = useState('Initializing Live Activity & Performance Scan...');
    const [contracts, setContracts] = useState<ContractInput[]>([]);

    // Keys persisted state
    const [duneKey, setDuneKey] = useState('');
    const [duneQueryIds, setDuneQueryIds] = useState({ volume: '', users: '', retention: '' });
    const [apifyKey, setApifyKey] = useState('');
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseKey, setSupabaseKey] = useState('');
    const [isAutoPilot, setIsAutoPilot] = useState(true); // Default to true based on "constant scan" request

    const [campaigns, setCampaigns] = useState<CampaignLog[]>([]);
    // Const [chainMetrics] removed (lifted)
    // const [report, setReport] = useState<GrowthReport | null>(null); // REMOVED (LIFTED)

    // Load Real Data Helper
    const loadRealSocialData = useCallback(async (apifyApiKeyToUse?: string) => {
        setIsSocialLoading(true);
        try {
            // Priority: LunarCrush (Backend Proxy) > Apify > Mock

            // Fetch LunarCrush via Proxy
            const handle = getHandle(brandName);
            try {
                const [creatorData, timeSeries, posts] = await Promise.all([
                    getCreator(handle),
                    getCreatorTimeSeries(handle, '1d'),
                    getCreatorPosts(handle)
                ]);

                if (creatorData) {
                    setLunarMetrics(creatorData);
                    setLunarTimeSeries(timeSeries);
                }
                if (posts) {
                    setLunarPosts(posts);
                }
            } catch (e) {
                console.warn("LunarCrush proxy fetch failed", e);
            }

            const realMetrics = await fetchSocialMetrics(brandName, apifyApiKeyToUse || apifyKey);
            onUpdateMetrics(realMetrics);
        } catch (e) {
            console.warn("Failed to load real social metrics", e);
        } finally {
            setIsSocialLoading(false);
        }
    }, [brandName, apifyKey]);

    // Load persisted keys when Brand changes
    useEffect(() => {
        const savedKeys = loadIntegrationKeys(brandName);

        // 1. Load Dune Keys: Saved/User > Known Integration Default
        let activeDuneIds = savedKeys.duneQueryIds || {};
        const knownConfig = getIntegrationConfig(brandName);

        if (!savedKeys.duneQueryIds && knownConfig?.dune) {
            console.log(`[GrowthEngine] Auto-loading known Dune IDs for ${brandName}`);
            activeDuneIds = {
                volume: knownConfig.dune.volumeQueryId,
                users: knownConfig.dune.usersQueryId,
                retention: knownConfig.dune.retentionQueryId
            };
        }

        setDuneKey(savedKeys.dune || '');
        setDuneQueryIds({
            volume: activeDuneIds.volume || '',
            users: activeDuneIds.users || '',
            retention: activeDuneIds.retention || ''
        });

        setApifyKey(savedKeys.apify || '');
        setSupabaseUrl(savedKeys.supabaseUrl || '');
        setSupabaseKey(savedKeys.supabaseKey || '');

        if (savedKeys.dune) setIsOnChainConnected(true);
    }, [brandName]);

    const handleSaveKeys = () => {
        saveIntegrationKeys({ dune: duneKey, duneQueryIds, apify: apifyKey, supabaseUrl, supabaseKey }, brandName);
        if (duneKey) setIsOnChainConnected(true);
        // Reload page to re-init supabase client with new keys? Or just let next action handle it.
        // Ideally we should force reload to ensure client is fresh, but simplified for now.
        if (supabaseUrl && supabaseKey) {
            window.location.reload(); // Force reload to init supabase
            return;
        }
        performAnalysis(); // Auto-run analysis on save
        setIsSettingUp(false);
    };

    const handleSkipToSimulation = () => {
        setIsSettingUp(false);
        performAnalysis({ forceSimulation: true });
    };

    // Analysis Logic
    const performAnalysis = useCallback(async (overrideParams?: { socialOnly?: boolean, forceSimulation?: boolean }) => {
        // If forcing simulation, skip connection check
        if (!overrideParams?.forceSimulation && !overrideParams?.socialOnly && (contracts.length === 0 || !duneKey)) return;

        setIsSettingUp(false);
        setIsProcessing(true);

        try {
            onLog?.(`Starting analysis for ${brandName}...`);
            let computed = chainMetrics; // Default to existing data

            if (overrideParams?.socialOnly) {
                setProcessingStatus('Fetching social data...');
                onLog?.(`Fetching live social metrics...`);
                await loadRealSocialData();
            } else {
                setProcessingStatus('Aggregating on-chain data...');
                await new Promise(r => setTimeout(r, 1000)); // Simulate delay
                computed = await computeGrowthMetrics({
                    contracts: contracts.map(c => ({ label: c.label, address: c.address, type: c.type as any })),
                    duneApiKey: duneKey,
                    duneQueryIds: duneQueryIds,
                    excludedWallets: [],
                    campaigns: campaigns
                });
                onUpdateChainMetrics(computed); // Update Parent
            }

            setProcessingStatus('Generating Strategy Brief via Gemini...');
            onLog?.(`Generating strategic brief via Gemini AI (Model: Experimental)...`);
            const metricsForReport = (overrideParams?.socialOnly) ? await fetchSocialMetrics(brandName, apifyKey) : (socialMetrics || getSocialMetrics(brandName));
            // 5. Generate Strategy (Gaia)
            // Use 'computed' which is either fresh or existing
            const aiReport = await generateGrowthReport(computed, campaigns, metricsForReport);
            onUpdateGrowthReport(aiReport);

            // Generate Tasks with Brain Context
            // We need to fetch recent mentions if not already available
            const mentions = metricsForReport?.recentPosts || [];

            // 12/29 FIX: Fetch Real Trends for Brain Context
            const trends = await fetchMarketPulse(brandName);

            // 1/10 FIX: Fetch Deep Context (Supabase)
            const { context: ragContext } = await getBrainContext(brandName);

            const newTasks = await generateStrategicAnalysis(
                brandName,
                calendarEvents,
                trends, // Actual Trends
                brandConfig,
                aiReport,
                mentions,
                ragContext, // RAG Context (Now Live)
                signals // LIVE WAR ROOM SIGNALS
            );
            onUpdateTasks(newTasks.tasks);

            onLog?.(`Analysis complete. Brief generated.`);
        } catch (e) {
            console.error(e);
            setProcessingStatus('Analysis interrupted.');
        } finally {
            setIsProcessing(false);
        }
    }, [brandName, contracts, duneKey, duneQueryIds, campaigns, socialMetrics, apifyKey, loadRealSocialData, chainMetrics, signals]);



    const handleSocialOnlyAnalysis = () => {
        performAnalysis({ socialOnly: true });
    };

    // Defaults & Init
    useEffect(() => {
        onUpdateMetrics(getSocialMetrics(brandName));
        loadRealSocialData();
        // Do not reset keys here, they are loaded separately
        onUpdateChainMetrics(null); // Reset Parent State
        onUpdateGrowthReport(null);

        // Default Inputs
        let initialCampaigns: CampaignLog[] = [];
        let initialContracts: ContractInput[] = [];

        // Demo logic removed.
        // User must manually configure data sources.


        // Auto-Run Analysis (Live Mode)
        // trigger after a brief delay to allow keys to hydrate
        const t = setTimeout(() => {
            performAnalysis({ socialOnly: true });
        }, 500);

        return () => clearTimeout(t);
    }, [brandName]);

    // Auto-Pilot: Constant Scan
    // Note: StrategyBrain now handles its own scanning, but we keep this for the Report/Social updates
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isAutoPilot) {
            console.log("Auto-Pilot Active: Scanning Metrics & Reports...");
            interval = setInterval(() => {
                console.log("Auto-Pilot: Performing Periodic Metric Scan...");
                performAnalysis({ socialOnly: true });
            }, 300000); // 5 Minutes
        }
        return () => clearInterval(interval);
    }, [isAutoPilot, performAnalysis]);

    // --- Derived Metrics ---
    // --- Derived Metrics ---
    // Priority: Social Metrics (Direct/Mock) > LunarCrush (Trend/Proxy)
    const engRate = socialMetrics?.engagementRate || (lunarMetrics ? (lunarMetrics.interactions_24h / (lunarMetrics.followers || 1)) * 100 : 0);
    const growthScore = Math.min((engRate * 1.5) + (socialMetrics?.comparison.engagementChange || 0 > 0 ? 0.5 : 0), 10).toFixed(1);
    const activeAudience = chainMetrics ? chainMetrics.activeWallets : (socialMetrics?.totalFollowers || lunarMetrics?.followers || 0);
    const retentionRate = chainMetrics ? `${chainMetrics.retentionRate.toFixed(1)}%` : `${engRate.toFixed(2)}%`;

    // Calculate trends for LC
    const followerChange = lunarTimeSeries.length > 1 ? (lunarTimeSeries[lunarTimeSeries.length - 1].followers - lunarTimeSeries[0].followers) : (socialMetrics?.comparison.followersChange || 0);

    return (
        <div className="space-y-4 animate-fadeIn pb-8 w-full h-full flex flex-col max-w-7xl mx-auto px-4 pt-4">

            {/* HEADER (Matches Dashboard.tsx Style) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-display font-bold text-brand-text tracking-tight mb-1">Action Center</h1>
                    <p className="text-sm text-brand-textSecondary">Review and approve high-priority strategic actions.</p>
                </div>
                <div className="flex gap-3 mt-4 md:mt-0">
                    {/* Status Indicators */}
                    <div className="flex items-center gap-1.5 bg-brand-surface border border-brand-border rounded px-2 py-1 shadow-sm">
                        <span className={`w-1.5 h-1.5 rounded-full ${duneKey ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                        <span className="text-[10px] font-bold text-brand-textSecondary">On-Chain</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-brand-surface border border-brand-border rounded px-2 py-1 shadow-sm">
                        <span className={`w-1.5 h-1.5 rounded-full ${apifyKey ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
                        <span className="text-[10px] font-bold text-brand-textSecondary">Social</span>
                    </div>
                </div>
            </div>

            {/* EXPLANATION BANNER */}
            <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-lg p-3 flex items-start sm:items-center gap-3 text-xs text-brand-textSecondary">
                <span className="text-brand-accent text-lg">💡</span>
                <p>
                    <strong>How it works:</strong> The <strong>Propulsion Brain</strong> (Top) analyzes the <strong>Live Intelligence</strong> (Bottom) to generate strategic actions.
                    Review the tasks below and click "Execute" to let the AI draft content or schedule campaigns based on this data.
                </p>
            </div>

            {/* SECTION 1: STRATEGIC PLANNING (GAIA) - MOVED TO TOP */}
            {brandConfig && calendarEvents && (
                <div className="animate-fadeIn w-full">
                    <StrategyBrain
                        brandName={brandName}
                        brandConfig={brandConfig}
                        events={calendarEvents}
                        growthReport={growthReport}
                        onSchedule={(content, image) => onSchedule?.(content, image)}
                        tasks={tasks}
                        onUpdateTasks={onUpdateTasks}
                        onNavigate={onNavigate}
                    />
                </div>
            )}

            <div className="h-px bg-brand-border w-full my-8"></div>

            {/* SECTIONS: ANALYTICS + STRATEGY STACKED */}
            <div className="space-y-4 w-full opacity-60 hover:opacity-100 transition-opacity duration-500">
                <div className="flex items-center gap-2 mb-[-16px]">
                    <h3 className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Supporting Performance Data</h3>
                    <div className="h-px bg-brand-border flex-1"></div>
                </div>

                {/* VISUAL ANALYTICS */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 w-full">
                    {/* ERROR BANNER: BACKEND */}
                    {socialMetrics?.error === "BACKEND_OFFLINE" && (
                        <div className="lg:col-span-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between text-red-800 shadow-sm">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <p className="font-bold text-sm">Backend Connection Failed</p>
                                    <p className="text-xs">Live data cache is unreachable. Run <code className="bg-red-100 px-1 rounded">npm run server</code> to restore services.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ERROR BANNER: API LIMITS */}
                    {socialMetrics?.error && socialMetrics.error !== "BACKEND_OFFLINE" && (
                        <div className="lg:col-span-4 bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between text-orange-800 shadow-sm animate-fadeIn">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">🛑</span>
                                <div>
                                    <p className="font-bold text-sm">Data Source Error</p>
                                    <p className="text-xs">{socialMetrics.error}</p>
                                </div>
                            </div>
                            <Button onClick={handleSkipToSimulation} variant="secondary" className="h-8 text-xs bg-white text-orange-800 border-orange-200 hover:bg-orange-100">
                                Switch to Simulation
                            </Button>
                        </div>
                    )}

                    {/* Main Chart/Report Area */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="bg-brand-surface rounded-xl border border-brand-border shadow-premium p-5 relative min-h-[400px]">
                            <div className="flex justify-between items-center mb-10 border-b border-brand-border pb-6">
                                <h3 className="text-lg font-bold text-brand-text flex items-center gap-3 font-display">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                    Live Performance Intelligence
                                </h3>
                                {!isOnChainConnected ? (
                                    <Button onClick={() => setIsSettingUp(true)} className="h-9 text-xs px-4 bg-brand-text text-brand-surface hover:bg-brand-textSecondary shadow-md">Connect Data Sources</Button>
                                ) : (
                                    <Button onClick={() => setIsSettingUp(true)} variant="secondary" className="h-9 text-xs">Manage Sources</Button>
                                )}
                            </div>

                            {isProcessing ? (
                                <div className="py-24 text-center">
                                    <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                                    <p className="text-sm text-brand-muted animate-pulse font-medium tracking-wide">{processingStatus}</p>
                                </div>
                            ) : growthReport ? (
                                <div className="prose prose-sm max-w-none text-brand-text font-sans">
                                    <div className="bg-brand-surfaceHighlight p-8 rounded-2xl border border-brand-border mb-10 shadow-inner">
                                        <p className="whitespace-pre-line text-base leading-relaxed text-brand-textSecondary">{growthReport.executiveSummary}</p>

                                        {/* Insight Tags if available */}
                                        <div className="flex gap-2 mt-4">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted bg-white border border-brand-border px-2 py-1 rounded">AI Analysis</span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted bg-white border border-brand-border px-2 py-1 rounded">Real-Time</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-white p-6 rounded-2xl border border-brand-border shadow-sm hover:shadow-md transition-all">
                                            <h4 className="font-bold text-brand-text mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                                <svg className="w-4 h-4 text-brand-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                On-Chain Health
                                            </h4>
                                            <div className="space-y-3">
                                                <div className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                                    <span className="text-brand-textSecondary">New Wallets</span>
                                                    <span className="font-mono font-bold text-brand-text">{chainMetrics?.netNewWallets || 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between py-2 border-b border-gray-50 text-sm">
                                                    <span className="text-brand-textSecondary">TVL Change</span>
                                                    <span className="font-mono font-bold text-emerald-600">+{chainMetrics ? '$' + chainMetrics.tvlChange.toLocaleString() : 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between py-2 pt-1 text-sm">
                                                    <span className="text-brand-textSecondary">Retention</span>
                                                    <span className="font-mono font-bold text-brand-text">{chainMetrics ? chainMetrics.retentionRate.toFixed(1) + '%' : 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-brand-text mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                            <svg className="w-4 h-4 text-brand-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                            Social Health
                                        </h4>
                                        <div className="space-y-4">
                                            {/* Platforms Header */}
                                            <div className="grid grid-cols-4 text-[10px] font-bold text-brand-muted uppercase tracking-wider pb-2 border-b border-gray-100">
                                                <span className="col-span-1">Channel</span>
                                                <span className="col-span-1 text-right">Members</span>
                                                <span className="col-span-1 text-right">Eng.</span>
                                                <span className="col-span-1 text-right">Signal</span>
                                            </div>

                                            {/* X / Twitter */}
                                            <div className="grid grid-cols-4 items-center text-sm">
                                                <span className="col-span-1 font-medium text-brand-text flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-black"></span> X / Twitter</span>
                                                <span className="col-span-1 text-right font-mono text-brand-textSecondary">{lunarMetrics?.followers?.toLocaleString() || '0'}</span>
                                                <span className="col-span-1 text-right font-mono text-brand-textSecondary">{lunarMetrics ? engRate.toFixed(1) : '0.0'}%</span>
                                                <span className="col-span-1 text-right flex justify-end"><span className="w-2 h-2 rounded-full bg-emerald-500"></span></span>
                                            </div>

                                            {/* Telegram (Mock/Future) */}
                                            <div className="grid grid-cols-4 items-center text-sm">
                                                <span className="col-span-1 font-medium text-brand-text flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Telegram</span>
                                                <span className="col-span-1 text-right font-mono text-brand-textSecondary">—</span>
                                                <span className="col-span-1 text-right font-mono text-brand-textSecondary">—</span>
                                                <span className="col-span-1 text-right flex justify-end"><span className="w-2 h-2 rounded-full bg-gray-300"></span></span>
                                            </div>

                                            {/* Discord (Mock/Future) */}
                                            <div className="grid grid-cols-4 items-center text-sm">
                                                <span className="col-span-1 font-medium text-brand-text flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Discord</span>
                                                <span className="col-span-1 text-right font-mono text-brand-textSecondary">—</span>
                                                <span className="col-span-1 text-right font-mono text-brand-textSecondary">—</span>
                                                <span className="col-span-1 text-right flex justify-end"><span className="w-2 h-2 rounded-full bg-gray-300"></span></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-brand-surfaceHighlight border border-brand-border rounded-2xl p-12 text-center h-64 flex flex-col items-center justify-center relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none"></div>
                                    <div className="relative z-10">
                                        <div className="w-12 h-12 border-4 border-brand-muted/30 border-t-brand-accent rounded-full animate-spin mx-auto mb-6"></div>
                                        <p className="text-brand-text font-bold text-sm mb-2">Live Analysis System Active...</p>
                                        <p className="text-xs text-brand-textSecondary max-w-xs mx-auto">Waiting for data streams to stabilize. This usually takes 5-10 seconds.</p>
                                        <div className="mt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button onClick={handleSocialOnlyAnalysis} variant="secondary" className="text-xs h-8 bg-white border-brand-border hover:bg-gray-50 shadow-sm">Force Refresh</Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar: Social Feed */}
                    <div className="lg:col-span-1 space-y-6">
                        <SocialActivityFeed lunarPosts={lunarPosts} socialMetrics={socialMetrics} />
                    </div>
                </div>

                {/* SECTION 2: ANALYTICS (FORMERLY SECTION 1) */}

                {/* STATS ROW */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-8">
                    <StatCard
                        label="Growth Index"
                        value={lunarMetrics ? (lunarMetrics.social_score || growthScore) : growthScore}
                        subtext={lunarMetrics ? "LunarCrush Social Score" : "Composite Score (0-10)"}
                        trend={Math.abs(socialMetrics?.comparison.engagementChange || 0) / 10}
                        trendDirection={(socialMetrics?.comparison.engagementChange || 0) >= 0 ? 'up' : 'down'}
                        isLoading={isSocialLoading}
                    />
                    <StatCard
                        label={chainMetrics ? "Active Addresses" : "Total Audience"}
                        value={(activeAudience > 1000 ? (activeAudience / 1000).toFixed(1) + 'K' : activeAudience)}
                        subtext={chainMetrics ? "7d Unique Wallets" : "Followers"}
                        trend={Math.abs(followerChange)}
                        trendDirection={followerChange >= 0 ? 'up' : 'down'}
                        isLoading={isSocialLoading}
                    />
                    <StatCard
                        label={chainMetrics ? "Retention" : "Engagement"}
                        value={retentionRate}
                        subtext={chainMetrics ? ">2 Tx / Month" : "Interactions / View"}
                        trend="2.1%"
                        trendDirection="up"
                        isLoading={isSocialLoading}
                    />
                    <StatCard
                        label="Active Campaigns"
                        value={campaigns.length}
                        subtext="Tracking Attribution"
                        isLoading={isSocialLoading}
                    />
                </div>

            </div>

            {/* SETUP MODAL */}
            {
                isSettingUp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-brand-text">Data Sources</h3>
                                <button onClick={() => setIsSettingUp(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>

                            <div className="space-y-6">
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <h4 className="font-bold text-sm text-brand-text mb-2 flex items-center gap-2">
                                        {duneKey && <span className="text-green-500">●</span>} Dune Analytics (On-Chain)
                                    </h4>
                                    <label className="text-xs text-brand-muted block mb-1">API Key</label>
                                    <input
                                        type="password"
                                        value={duneKey}
                                        onChange={e => setDuneKey(e.target.value)}
                                        className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent mb-4"
                                        placeholder="dune_..."
                                    />

                                    {/* GRANULAR QUERY IDS */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-brand-muted block mb-1">Total Volume Query ID</label>
                                            <input
                                                type="text"
                                                value={duneQueryIds.volume || ''}
                                                onChange={e => setDuneQueryIds({ ...duneQueryIds, volume: e.target.value })}
                                                className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent bg-gray-50"
                                                placeholder="e.g. 123456"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-brand-muted block mb-1">Users/Growth Query ID</label>
                                            <input
                                                type="text"
                                                value={duneQueryIds.users || ''}
                                                onChange={e => setDuneQueryIds({ ...duneQueryIds, users: e.target.value })}
                                                className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent bg-gray-50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-brand-muted block mb-1">Users/Growth Query ID</label>
                                            <input
                                                type="text"
                                                value={duneQueryIds.users || ''}
                                                onChange={e => setDuneQueryIds({ ...duneQueryIds, users: e.target.value })}
                                                className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent bg-gray-50"
                                                placeholder="e.g. 789012"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-brand-muted block mb-1">Retention/Cohorts Query ID</label>
                                            <input
                                                type="text"
                                                value={duneQueryIds.retention || ''}
                                                onChange={e => setDuneQueryIds({ ...duneQueryIds, retention: e.target.value })}
                                                className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent bg-gray-50"
                                                placeholder="e.g. 345678"
                                            />
                                        </div>
                                    </div>

                                    <p className="text-[10px] text-gray-500 mt-2">Map specific Dune Queries to metrics. Queries must return compatible columns.</p>
                                </div>

                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <h4 className="font-bold text-sm text-brand-text mb-2 flex items-center gap-2">
                                        {apifyKey && <span className="text-green-500">●</span>} Apify (Social)
                                    </h4>
                                    <label className="text-xs text-brand-muted block mb-1">API Token</label>
                                    <input
                                        type="password"
                                        value={apifyKey}
                                        onChange={e => setApifyKey(e.target.value)}
                                        className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent"
                                        placeholder="apify_api_..."
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Required for real-time Twitter scraping.</p>
                                </div>

                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                    <h4 className="font-bold text-sm text-brand-text mb-2 flex items-center gap-2">
                                        {supabaseUrl ? <span className="text-green-500">●</span> : null} Cloud Sync (Supabase)
                                    </h4>
                                    <p className="text-[10px] text-brand-textSecondary mb-3">Connect a Supabase project to ensure your **Brand Data & Settings** are saved online and synced across devices.</p>

                                    <label className="text-xs text-brand-muted block mb-1">Project URL</label>
                                    <input
                                        type="text"
                                        value={supabaseUrl}
                                        onChange={e => setSupabaseUrl(e.target.value)}
                                        className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent mb-3"
                                        placeholder="https://xyz.supabase.co"
                                    />

                                    <label className="text-xs text-brand-muted block mb-1">Anon Public Key</label>
                                    <input
                                        type="password"
                                        value={supabaseKey}
                                        onChange={e => setSupabaseKey(e.target.value)}
                                        className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent"
                                        placeholder="eyJh..."
                                    />
                                </div>

                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-sm text-brand-text">Auto-Pilot Mode</h4>
                                        <p className="text-[10px] text-gray-500">Automatically scan for trends and new data every 5 minutes.</p>
                                    </div>
                                    <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                        <input
                                            type="checkbox"
                                            name="toggle"
                                            id="autopilot-toggle"
                                            checked={isAutoPilot}
                                            onChange={e => setIsAutoPilot(e.target.checked)}
                                            className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 checked:right-0 checked:border-green-500"
                                            style={{ right: isAutoPilot ? '0' : 'auto', left: isAutoPilot ? 'auto' : '0' }}
                                        />
                                        <label htmlFor="autopilot-toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${isAutoPilot ? 'bg-green-500' : 'bg-gray-300'}`}></label>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-6">
                                    <button
                                        onClick={handleSkipToSimulation}
                                        className="px-4 py-2 text-xs font-bold text-brand-muted hover:text-brand-text transition-colors mr-auto"
                                    >
                                        Skip & Simulate Data
                                    </button>
                                    <Button onClick={() => setIsSettingUp(false)} variant="secondary">Cancel</Button>
                                    <Button onClick={handleSaveKeys}>Save & Connect</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
};
