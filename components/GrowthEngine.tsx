import React, { useState, useEffect, useCallback } from 'react';
import { CampaignLog, GrowthInput, ComputedMetrics, GrowthReport, SocialMetrics, CalendarEvent, TrendItem, BrandConfig, LunarCrushCreator, LunarCrushTimeSeriesItem, LunarCrushPost, StrategyTask } from '../types';
import { computeGrowthMetrics, getSocialMetrics, fetchSocialMetrics, getHandle } from '../services/analytics';
import { generateGrowthReport } from '../services/gemini';
import { getCreator, getCreatorTimeSeries, getCreatorPosts } from '../services/pulse';
import { Button } from './Button';
import { StrategyBrain } from './StrategyBrain';
import { SocialActivityFeed } from './SocialActivityFeed';
import { loadIntegrationKeys, saveIntegrationKeys } from '../services/storage';

interface GrowthEngineProps {
    brandName: string;
    calendarEvents: CalendarEvent[];
    brandConfig: BrandConfig;
    onSchedule: (content: string, image?: string, date?: string) => void;
    metrics: SocialMetrics | null;
    onUpdateMetrics: (metrics: SocialMetrics | null) => void;
    tasks: StrategyTask[];
    onUpdateTasks: (tasks: StrategyTask[]) => void;
    chainMetrics: ComputedMetrics | null;
    onUpdateChainMetrics: (metrics: ComputedMetrics | null) => void;
    growthReport: GrowthReport | null; // Lifted
    onUpdateGrowthReport: (report: GrowthReport | null) => void; // Lifted
    onLog?: (message: string) => void; // Optional logger
}

interface ContractInput {
    id: string;
    label: string;
    address: string;
    type: string;
}

// Internal Component for Top-Row Stats
const StatCard = ({ label, value, trend, trendDirection, subtext, icon, isLoading }: any) => (
    <div className="bg-white p-6 rounded-xl border border-brand-border shadow-sm flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">{label}</span>
            {trend && (
                <span className={`font-bold text-xs ${trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {trendDirection === 'up' ? '▲' : '▼'} {trend}
                </span>
            )}
        </div>
        <div className="space-y-1">
            {isLoading ? (
                <div className="h-8 w-24 bg-gray-100 animate-pulse rounded" />
            ) : (
                <div className="text-3xl font-display font-bold text-brand-text tracking-tight">{value}</div>
            )}
            <div className="text-xs text-brand-muted">{subtext}</div>
        </div>
    </div>
);

export const GrowthEngine: React.FC<GrowthEngineProps> = ({ brandName, calendarEvents, brandConfig, onSchedule, metrics, onUpdateMetrics, tasks, onUpdateTasks, chainMetrics, onUpdateChainMetrics, growthReport, onUpdateGrowthReport, onLog }) => {
    // --- TABS ---
    const [activeTab, setActiveTab] = useState<'analytics' | 'strategy'>('analytics');

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
        setDuneKey(savedKeys.dune || '');
        const ids = savedKeys.duneQueryIds || {};
        setDuneQueryIds({
            volume: ids.volume || '',
            users: ids.users || '',
            retention: ids.retention || ''
        });
        setApifyKey(savedKeys.apify || '');

        if (savedKeys.dune) setIsOnChainConnected(true);
    }, [brandName]);

    const handleSaveKeys = () => {
        saveIntegrationKeys({ dune: duneKey, duneQueryIds, apify: apifyKey }, brandName);
        if (duneKey) setIsOnChainConnected(true);
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
            // Use 'computed' which is either fresh or existing
            const aiReport = await generateGrowthReport(computed, campaigns, metricsForReport);

            onUpdateGrowthReport(aiReport);
            onLog?.(`Analysis complete. Brief generated.`);
        } catch (e) {
            console.error(e);
            setProcessingStatus('Analysis interrupted.');
        } finally {
            setIsProcessing(false);
        }
    }, [brandName, contracts, duneKey, duneQueryIds, campaigns, socialMetrics, apifyKey, loadRealSocialData, chainMetrics]);



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
    const retention = chainMetrics ? `${chainMetrics.retentionRate.toFixed(1)}%` : `${engRate.toFixed(2)}%`;

    // Calculate trends for LC
    const followerChange = lunarTimeSeries.length > 1 ? (lunarTimeSeries[lunarTimeSeries.length - 1].followers - lunarTimeSeries[0].followers) : (socialMetrics?.comparison.followersChange || 0);

    return (
        <div className="space-y-8 animate-fadeIn pb-10 w-full h-full flex flex-col">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-brand-border shadow-sm">
                <div>
                    <h2 className="text-2xl font-display font-bold text-brand-text">Growth & Strategy Hub</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-brand-muted text-sm">Unified command center for analysis and AI strategic planning.</p>
                        {/* Visual Connection Status Indicators */}
                        {duneKey && <span className="flex items-center text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 font-bold">● On-Chain</span>}
                        {apifyKey && <span className="flex items-center text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold">● Twitter Scraper</span>}
                        {lunarMetrics && <span className="flex items-center text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-200 font-bold">● LunarCrush</span>}
                    </div>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg mt-4 md:mt-0">
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`px-6 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'analytics' ? 'bg-white text-brand-text shadow-sm' : 'text-brand-muted hover:text-brand-text'}`}
                    >
                        Performance Data
                    </button>
                    <button
                        onClick={() => setActiveTab('strategy')}
                        className={`px-6 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'strategy' ? 'bg-white text-purple-700 shadow-sm' : 'text-brand-muted hover:text-brand-text'}`}
                    >
                        <span className="text-[10px]">⚡</span> Strategy
                    </button>
                </div>
            </div>

            {/* STATS ROW (Always Visible) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    value={retention}
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

            {/* TAB CONTENT: ANALYTICS */}
            {activeTab === 'analytics' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn flex-1">
                    {/* ERROR BANNER */}
                    {socialMetrics?.error === "BACKEND_OFFLINE" && (
                        <div className="lg:col-span-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between text-red-800">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">⚠️</span>
                                <div>
                                    <p className="font-bold text-sm">Backend Connection Failed</p>
                                    <p className="text-xs">Live data cache is unreachable. Run <code className="bg-red-100 px-1 rounded">npm run server</code> to restore services.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Chart/Report Area */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white rounded-xl border border-brand-border shadow-sm p-8 relative min-h-[500px]">
                            <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    Live Performance Intelligence
                                </h3>
                                {!isOnChainConnected ? (
                                    <Button onClick={() => setIsSettingUp(true)} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700">Connect Data Sources</Button>
                                ) : (
                                    <Button onClick={() => setIsSettingUp(true)} variant="secondary" className="h-8 text-xs">Manage Sources</Button>
                                )}
                            </div>

                            {isProcessing ? (
                                <div className="py-24 text-center">
                                    <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                                    <p className="text-sm text-brand-muted animate-pulse font-medium">{processingStatus}</p>
                                </div>
                            ) : growthReport ? (
                                <div className="prose prose-sm max-w-none text-brand-text">
                                    <div className="bg-gray-50 p-6 rounded-xl border border-brand-border mb-8">
                                        <p className="whitespace-pre-line text-base leading-relaxed">{growthReport.executiveSummary}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                            <h4 className="font-bold text-gray-900 mb-2">On-Chain Health</h4>
                                            <div className="text-sm text-gray-600">
                                                <div className="flex justify-between py-1 border-b border-gray-50"><span>New Wallets</span> <span className="font-mono font-bold text-brand-text">{chainMetrics?.netNewWallets || 'N/A'}</span></div>
                                                <div className="flex justify-between py-1 border-b border-gray-50"><span>TVL Change</span> <span className="font-mono font-bold text-green-600">+{chainMetrics ? '$' + chainMetrics.tvlChange.toLocaleString() : 'N/A'}</span></div>
                                                <div className="flex justify-between py-1 pt-2"><span>Retention</span> <span className="font-mono font-bold text-brand-text">{chainMetrics ? chainMetrics.retentionRate.toFixed(1) + '%' : 'N/A'}</span></div>
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                            <h4 className="font-bold text-gray-900 mb-2">Social Health</h4>
                                            <div className="text-sm text-gray-600">
                                                <div className="flex justify-between py-1 border-b border-gray-50"><span>Followers</span> <span className="font-mono font-bold text-brand-text">{lunarMetrics?.followers?.toLocaleString() || socialMetrics?.totalFollowers.toLocaleString()}</span></div>
                                                <div className="flex justify-between py-1 border-b border-gray-50"><span>Engagement</span> <span className="font-mono font-bold text-brand-text">{lunarMetrics ? engRate.toFixed(2) : socialMetrics?.engagementRate}%</span></div>
                                                <div className="flex justify-between py-1 pt-2"><span>Mentions / Interactions</span> <span className="font-mono font-bold text-brand-text">{lunarMetrics?.interactions_24h || socialMetrics?.mentions}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 border border-brand-border rounded-lg p-12 text-center h-64 flex flex-col items-center justify-center">
                                    <div className="w-10 h-10 border-4 border-brand-muted border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-brand-muted text-sm mb-4">Live Analysis System Active...</p>
                                    <p className="text-[10px] text-gray-400">Waiting for data streams to stabilize.</p>
                                    <div className="flex gap-2 mt-4 opacity-50 hover:opacity-100 transition-opacity">
                                        <Button onClick={handleSocialOnlyAnalysis} variant="secondary" className="text-xs h-8">Force Refresh</Button>
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
            )}


            {/* TAB CONTENT: STRATEGY (GAIA) */}
            {
                activeTab === 'strategy' && brandConfig && calendarEvents && (
                    <div className="animate-fadeIn space-y-6 flex-1 h-full">
                        <StrategyBrain
                            brandName={brandName}
                            brandConfig={brandConfig}
                            events={calendarEvents}
                            growthReport={growthReport}
                            onSchedule={(content, image) => onSchedule?.(content, image)}
                            tasks={tasks}
                            onUpdateTasks={onUpdateTasks}
                        />
                    </div>
                )
            }

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

        </div>
    );
};
