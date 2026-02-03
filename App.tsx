import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateWeb3Graphic, generateTweet, generateIdeas, generateCampaignDrafts, researchBrandIdentity, generateStrategicAnalysis, orchestrateMarketingDecision, generateGrowthReport, refineStrategicPosture } from './services/gemini';
import { fetchMarketPulse, getBrainContext } from './services/pulse';
import { fetchMentions, computeSocialSignals, fetchSocialMetrics } from './services/analytics';
import { runMarketScan } from './services/ingestion';
import { searchContext, buildContextBlock } from './services/rag';
import { fetchActionCenter } from './services/actionCenter';
import { loadBrandProfiles, saveBrandProfiles, loadCalendarEvents, saveCalendarEvents, loadStrategyTasks, saveStrategyTasks, loadCampaignState, saveCampaignState, STORAGE_EVENTS, loadBrainLogs, saveBrainLog, fetchBrainHistoryEvents, importHistoryToReferences, loadGrowthReport, saveGrowthReport, fetchGrowthReportFromCloud, loadStrategicPosture, saveStrategicPosture, loadAutomationSettings, saveBrandRegistryEntry, getBrandRegistryEntry, getCurrentUserBrand, syncBrandAssetsFromStorage, loadIntegrationKeys, saveIntegrationKeys, loadDecisionLoopLastRun, saveDecisionLoopLastRun } from './services/storage';
import { migrateToCloud } from './services/migration'; // Import migration
import { getCurrentUser, onAuthStateChange, UserProfile } from './services/auth'; // Import auth
import { Button } from './components/Button';
import { Select } from './components/Select';
import { BrandKit } from './components/BrandKit';
import { BrandKitPage } from './components/BrandKitPage';
import { PulseEngine } from './components/PulseEngine'; // Import Pulse
import { ContentCalendar } from './components/ContentCalendar';
import { Dashboard } from './components/Dashboard'; // Import Dashboard
import { AnalyticsPage } from './components/AnalyticsPage'; // Import Analytics
import { Campaigns } from './components/Campaigns'; // Import Campaigns
import { SocialMedia } from './components/SocialMedia'; // Import SocialMedia
import { AIStrategicPosture } from './components/Strategy/AIStrategicPosture'; // Import AIStrategicPosture
import { ContentStudio } from './components/ContentStudio'; // Import ContentStudio
import { ImageEditor } from './components/ImageEditor'; // Import ImageEditor
import { CopilotView } from './components/Copilot/CopilotView'; // Import Copilot
import { Sidebar } from './components/Sidebar';
import { Settings } from './components/Settings'; // Import Settings
import { TwitterFeed } from './components/TwitterFeed'; // Import TwitterFeed
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage'; // Import AuthPage
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { OnboardingPrompt } from './components/onboarding/OnboardingPrompt';
import { ImageSize, AspectRatio, BrandConfig, ReferenceImage, CampaignItem, TrendItem, CalendarEvent, SocialMetrics, StrategyTask, ComputedMetrics, GrowthReport, SocialSignals, StrategicPosture } from './types';

const ONBOARDING_STORAGE_KEY = 'defia_onboarding_state_v1';

interface OnboardingState {
    dismissed: boolean;
    completed: boolean;
    lastStep: number;
    updatedAt: number;
}

const loadOnboardingState = (): OnboardingState => {
    try {
        const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored) as OnboardingState;
        }
    } catch (e) {
        console.warn("Failed to load onboarding state", e);
    }
    return {
        dismissed: false,
        completed: false,
        lastStep: 0,
        updatedAt: Date.now(),
    };
};

const saveOnboardingState = (state: OnboardingState) => {
    try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn("Failed to save onboarding state", e);
    }
};

const normalizePath = (path: string) => {
    if (path === '/') return '/';
    return path.replace(/\/+$/, '');
};

const sectionRoutes: Record<string, string> = {
    dashboard: '/dashboard',
    copilot: '/copilot',
    brain: '/strategy',
    analytics: '/analytics',
    pulse: '/pulse',
    campaigns: '/campaigns',
    calendar: '/calendar',
    social: '/social',
    studio: '/studio',
    'image-editor': '/image-editor',
    settings: '/settings',
    'twitter-feed': '/twitter-feed',
    'brand-kit': '/brand-kit',
};

const getSectionFromPath = (path: string) => {
    const normalized = normalizePath(path);
    const match = Object.entries(sectionRoutes).find(([, route]) => route === normalized);
    return match?.[0] ?? 'dashboard';
};


const App: React.FC = () => {
    console.log('App: Auth Integration Loaded v3'); // Debug: Force Rebuild
    const [route, setRoute] = useState<string>(() => window.location.pathname);
    const [onboardingState, setOnboardingState] = useState<OnboardingState>(() => loadOnboardingState());
    // App Navigation State
    const [appSection, setAppSection] = useState<string>(() => getSectionFromPath(window.location.pathname));

    // Auth State
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true); // Default to dashboard

    useEffect(() => {
        const handlePopState = () => setRoute(window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        const normalized = normalizePath(route);
        if (Object.values(sectionRoutes).includes(normalized)) {
            const section = getSectionFromPath(normalized);
            if (section !== appSection) {
                setAppSection(section);
            }
        }
    }, [route]); // Removed appSection from deps to prevent loop

    useEffect(() => {
        saveOnboardingState(onboardingState);
    }, [onboardingState]);

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            setIsAuthLoading(true);
            try {
                const user = await getCurrentUser();
                setCurrentUser(user);

                // If user has a linked brand (by brandId, brandName, or email), auto-select it
                if (user) {
                    const userBrand = getCurrentUserBrand();
                    if (userBrand) {
                        setSelectedBrand(userBrand.brandName);
                        // Also mark onboarding as complete for users with existing brands
                        setOnboardingState(prev => ({
                            ...prev,
                            completed: true,
                            updatedAt: Date.now(),
                        }));

                        // Sync brand assets from Supabase storage (images, etc.)
                        // This runs in background and updates the UI via storage events
                        syncBrandAssetsFromStorage(userBrand.brandName).then(result => {
                            if (result.imagesAdded > 0) {
                                console.log(`✅ Synced ${result.imagesAdded} images for ${userBrand.brandName}`);
                                // Reload profiles to pick up new images
                                setProfiles(loadBrandProfiles());
                            }
                        }).catch(err => {
                            console.warn('Brand asset sync failed (non-critical):', err);
                        });
                    }
                }
            } catch (e) {
                console.warn('Auth init failed', e);
            } finally {
                setIsAuthLoading(false);
            }
        };
        initAuth();

        // Listen for auth changes
        const unsubscribe = onAuthStateChange((user) => {
            setCurrentUser(user);
            if (!user) {
                // User signed out - redirect to landing
                setSelectedBrand('');
                navigate('/');
            } else {
                // User signed in - set their brand
                const userBrand = getCurrentUserBrand();
                if (userBrand) {
                    setSelectedBrand(userBrand.brandName);
                }
            }
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        const targetPath = sectionRoutes[appSection];
        if (!targetPath) return;
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath.startsWith('/onboarding')) return;
        const normalized = normalizePath(currentPath);
        // Only push if the route doesn't already match
        if (normalized !== targetPath) {
            window.history.pushState({}, '', targetPath);
            setRoute(targetPath);
        }
    }, [appSection]); // Uses window.location.pathname directly to avoid stale closure

    const navigate = (path: string) => {
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
            setRoute(path);
        }
    };

    // --- AUTOMATIC BRAIN SYNC (BACKGROUND) ---
    useEffect(() => {
        const syncBrain = async () => {
            console.log("🧠 Brain Sync: Initiating background sync...");
            const result = await migrateToCloud();
            if (result.success) {
                console.log(`🧠 Brain Sync: Complete. Migrated ${result.report.brands} brands, ${result.report.tasks} tasks.`);
            } else {
                console.warn("🧠 Brain Sync: Failed (Non-critical)", result.error);
            }
        };
        // Delay slightly to prioritize UI render
        const timer = setTimeout(syncBrain, 3000);
        return () => clearTimeout(timer);
    }, []);

    // App State - Profiles
    const [profiles, setProfiles] = useState<Record<string, BrandConfig>>(() => loadBrandProfiles());
    // Initialize selectedBrand to empty - will be set after auth check to user's linked brand
    const [selectedBrand, setSelectedBrand] = useState<string>('');

    // Onboarding / Connect State
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');
    const [newBrandUrl, setNewBrandUrl] = useState('');
    const [isResearching, setIsResearching] = useState(false);
    const [researchLogs, setResearchLogs] = useState<string[]>([]);

    // Calendar State
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [historyEvents, setHistoryEvents] = useState<CalendarEvent[]>([]); // NEW: Read-only history
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [itemToSchedule, setItemToSchedule] = useState<{ content: string, image?: string, campaignName?: string } | null>(null);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');

    // Strategy & Metrics State (Lifted for Dashboard)
    const [strategyTasks, setStrategyTasks] = useState<StrategyTask[]>([]);
    const [socialMetrics, setSocialMetrics] = useState<SocialMetrics | null>(null);
    const [chainMetrics, setChainMetrics] = useState<ComputedMetrics | null>(null); // Lifted for Defia Index
    const [growthReport, setGrowthReport] = useState<GrowthReport | null>(null); // Lifted for Dashboard
    const [strategicPosture, setStrategicPosture] = useState<StrategicPosture | null>(null); // NEW: Dynamic Posture

    // NEW: Shared "War Room" Signals for Brain & UI
    const [socialSignals, setSocialSignals] = useState<SocialSignals>({
        sentimentScore: 78,
        sentimentTrend: 'up',
        activeNarratives: ["#L2Wars", "$DEFI", "Yield Farming"],
        topKols: []
    });

    const [systemLogs, setSystemLogs] = useState<string[]>([]); // New: Activity Logs for Dashboard
    const [automationEnabled, setAutomationEnabled] = useState<boolean>(true);
    const decisionLoopInFlightRef = useRef<Record<string, boolean>>({});
    const agentDecisionsRef = useRef<any[]>([]);

    const DECISION_LOOP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

    // --- Agent Decisions Polling ---
    const [agentDecisions, setAgentDecisions] = useState<any[]>([]);

    // Campaign Intent State (Handover from Pulse)
    const [campaignIntent, setCampaignIntent] = useState<{ type: 'theme' | 'diverse', theme: string } | null>(null);
    const [initialTrend, setInitialTrend] = useState<any>(null); // For Pulse
    const [socialFilter, setSocialFilter] = useState<string>('all'); // For Social

    // Legacy State Removed (campaignStep, campaignType, campaignItems etc. moved to specific component)

    // UI State

    // UI State
    const [error, setError] = useState<string | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const scheduleFileInputRef = useRef<HTMLInputElement>(null);
    // const campaignFileInputRef = useRef<HTMLInputElement>(null); // Moved
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

    // Studio Deep Link State
    const [studioDraft, setStudioDraft] = useState<string>('');
    const [studioVisualPrompt, setStudioVisualPrompt] = useState<string>('');

    // Image Editor Deep Link State
    const [editorInitialImage, setEditorInitialImage] = useState<string | null>(null);
    const [editorInitialPrompt, setEditorInitialPrompt] = useState<string | null>(null);

    useEffect(() => {
        if (Object.keys(profiles).length > 0) {
            saveBrandProfiles(profiles, true);
        }
    }, [profiles]);

    useEffect(() => {
        if (!selectedBrand) return;

        setCalendarEvents(loadCalendarEvents(selectedBrand));
        setAutomationEnabled(loadAutomationSettings(selectedBrand).enabled);

        // Sync brand assets from Supabase storage (runs once per brand selection)
        syncBrandAssetsFromStorage(selectedBrand).then(result => {
            if (result.imagesAdded > 0) {
                console.log(`✅ Synced ${result.imagesAdded} images for ${selectedBrand}`);
                // Reload profiles to pick up new images
                setProfiles(loadBrandProfiles());
            }
        }).catch(err => {
            console.warn('Brand asset sync failed (non-critical):', err);
        });

        // AGGRESSIVE PURGE: Remove legacy "Autopilot" generic tasks
        const rawTasks = loadStrategyTasks(selectedBrand);
        const CLEAN_TASKS = rawTasks.filter(t =>
            !t.title.includes("Competitive Landscape Analysis") &&
            !t.title.includes("Customer Segmentation") &&
            !t.title.includes("Value Proposition") &&
            !t.title.includes("Go-to-Market") &&
            !t.title.includes("Project Phoenix") &&
            !t.title.includes("Canvas of Nations") &&
            !t.title.includes("Operation Bootstrap") &&
            !t.title.startsWith("Autopilot:") // Catch-all
        );
        setStrategyTasks(CLEAN_TASKS);

        const loadedReport = loadGrowthReport(selectedBrand);
        if (loadedReport) {
            setGrowthReport(loadedReport);
        } else {
            // Fallback Force Seed if storage fails
            setGrowthReport({
                executiveSummary: "Market conditions are stabilizing. AI analysis detects rising sentiment for L2 narratives. Recommend increasing engagement frequency to capture early momentum.",
                tacticalPlan: "Execute 2-3 high-impact replies on trending threads. Monitor competitor announcements for 'vampire attack' opportunities.",
                strategicPlan: [
                    { action: 'DOUBLE_DOWN', subject: 'Community Engagement', reasoning: 'High organic mentions suggest a breakout moment.' },
                    { action: 'OPTIMIZE', subject: 'Content Distribution', reasoning: 'Tweet threads are outperforming single posts by 40%.' }
                ],
                metrics: undefined,
                lastUpdated: 0
            });
        }

        // Load Strategic Posture
        const loadedPosture = loadStrategicPosture(selectedBrand);
        setStrategicPosture(loadedPosture);

        // Load History (Logs + Alert Debug)
        console.log(`DEBUG: Selected Brand is [${selectedBrand}]`);
        fetchBrainHistoryEvents(selectedBrand).then(events => {
            console.log('Loaded history events:', events);
            setHistoryEvents(events);
        }).catch(err => console.error("History Load Error:", err));

        // Listen for background sync updates
        const handleSyncUpdate = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.brandName === selectedBrand) {
                console.log("Live Sync: Reloading calendar events for", selectedBrand);
                setCalendarEvents(loadCalendarEvents(selectedBrand));
            }
        };

        const handlePostureUpdate = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.brandName === selectedBrand) {
                console.log("Live Sync: Reloading posture for", selectedBrand);
                setStrategicPosture(loadStrategicPosture(selectedBrand));
            }
        };

        const handleAutomationUpdate = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.brandName === selectedBrand) {
                setAutomationEnabled(loadAutomationSettings(selectedBrand).enabled);
            }
        };

        const handleIntegrationsUpdate = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.brandName && detail.brandName !== selectedBrand) return;
            const refreshMetrics = async () => {
                setSystemLogs(prev => ["Integrations updated. Refreshing analytics...", ...prev]);
                const [trends, mentions, metrics] = await Promise.all([
                    fetchMarketPulse(selectedBrand).catch(e => { console.warn("Market Pulse failed", e); return []; }),
                    fetchMentions(selectedBrand).catch(e => { console.warn("Mentions failed", e); return []; }),
                    fetchSocialMetrics(selectedBrand).catch(e => { console.warn("Social Metrics failed", e); return null; })
                ]);

                if (metrics) {
                    setSocialMetrics(metrics);
                }

                const highVelocityTrends = trends.filter(t => t.relevanceScore > 85);
                const liveSignals: SocialSignals = {
                    ...computeSocialSignals(trends, mentions, metrics || undefined),
                    trendingTopics: highVelocityTrends.length > 0 ? highVelocityTrends : trends.slice(0, 3)
                };
                setSocialSignals(liveSignals);
            };
            void refreshMetrics();
        };

        window.addEventListener(STORAGE_EVENTS.CALENDAR_UPDATE, handleSyncUpdate);
        window.addEventListener(STORAGE_EVENTS.POSTURE_UPDATE, handlePostureUpdate);
        window.addEventListener(STORAGE_EVENTS.AUTOMATION_UPDATE, handleAutomationUpdate);
        window.addEventListener(STORAGE_EVENTS.INTEGRATIONS_UPDATE, handleIntegrationsUpdate);

        // Listen for Brand Updates
        const handleBrandUpdate = () => {
            console.log("Live Sync: Reloading brand profiles");
            setProfiles(loadBrandProfiles());
        };
        window.addEventListener(STORAGE_EVENTS.BRAND_UPDATE, handleBrandUpdate);

        return () => {
            window.removeEventListener(STORAGE_EVENTS.CALENDAR_UPDATE, handleSyncUpdate);
            window.removeEventListener(STORAGE_EVENTS.BRAND_UPDATE, handleBrandUpdate);
            window.removeEventListener(STORAGE_EVENTS.POSTURE_UPDATE, handlePostureUpdate);
            window.removeEventListener(STORAGE_EVENTS.AUTOMATION_UPDATE, handleAutomationUpdate);
            window.removeEventListener(STORAGE_EVENTS.INTEGRATIONS_UPDATE, handleIntegrationsUpdate);
        };
    }, [selectedBrand, profiles, automationEnabled]);

    // Auto-Save Removed: Persistence is now handled explicitly in handlers to avoid race conditions.

    // Persist Tasks & Report
    useEffect(() => {
        saveStrategyTasks(selectedBrand, strategyTasks);
    }, [strategyTasks, selectedBrand]);

    useEffect(() => {
        if (growthReport) saveGrowthReport(selectedBrand, growthReport);
    }, [growthReport, selectedBrand]);

    const normalizeDecisionType = (action?: string): StrategyTask['type'] => {
        const normalized = action?.toUpperCase() || '';
        switch (normalized) {
            case 'REPLY':
                return 'REPLY';
            case 'TREND_JACK':
                return 'TREND_JACK';
            case 'CAMPAIGN':
                return 'CAMPAIGN_IDEA';
            default:
                return 'EVERGREEN';
        }
    };

    const mapDecisionToTask = (decision: any): StrategyTask => {
        const actionLabel = decision.action ? decision.action.toString().toUpperCase() : 'ACTION';
        return {
            id: decision.id || crypto.randomUUID(),
            type: normalizeDecisionType(decision.action),
            title: `${actionLabel}: ${decision.reason || 'Strategic opportunity detected'}`,
            description: decision.reason || 'Automated decision from server brain.',
            reasoning: decision.reason || 'Automated decision from server brain.',
            impactScore: 7,
            executionPrompt: decision.draft || decision.reason || 'Draft a response to the detected opportunity.',
            createdAt: decision.timestamp || Date.now(),
            feedback: 'neutral'
        };
    };

    const hasOnlyWelcomeTask = (tasks: StrategyTask[]) => {
        return tasks.length === 1 && tasks[0].id === 'welcome-1';
    };

    // --- Agent Decisions Polling ---
    useEffect(() => {
        const fetchDecisions = async () => {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
            try {
                // If health check failed previously, maybe skip this? 
                // For now, simple fetch with suppression
                const res = await fetch(`${baseUrl}/api/decisions`).catch(() => null);
                if (res && res.ok) {
                    const data = await res.json();
                    const filtered = data.filter((d: any) =>
                        d.status === 'pending' &&
                        (!d.brandId || d.brandId === selectedBrand)
                    );
                    agentDecisionsRef.current = filtered;
                    setAgentDecisions(filtered);
                }
            } catch (e) {
                // scilent fail 
            }
        };
        fetchDecisions();
        const interval = setInterval(fetchDecisions, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [selectedBrand]);

    useEffect(() => {
        if (!selectedBrand || agentDecisions.length === 0) return;
        const latestDecision = agentDecisions[0];
        const decisionTimestamp = latestDecision?.created_at || latestDecision?.timestamp || null;
        const decisionTime = decisionTimestamp ? new Date(decisionTimestamp).getTime() : 0;
        if (!decisionTime) return;

        const latestTaskTime = strategyTasks.reduce((max, task) => Math.max(max, task.createdAt || 0), 0);
        if (latestTaskTime && decisionTime <= latestTaskTime) return;

        const mapped = agentDecisions.map(mapDecisionToTask).slice(0, 5);
        if (mapped.length === 0) return;

        setStrategyTasks(mapped);
        saveStrategyTasks(selectedBrand, mapped);
        saveDecisionLoopLastRun(selectedBrand, decisionTime);
    }, [agentDecisions, selectedBrand, strategyTasks]);

    // --- AUTO-PILOT LOGIC (Formerly in GrowthEngine) ---
    // Persistent background scanning regardless of active tab
    useEffect(() => {
        const runBackgroundScan = async () => {
            // Only run if we lack critical data or want to force a refresh
            // REMOVED BLOCKER: if (strategyTasks.length > 0) return; -> We want it to run to get the Growth Report
            if (!selectedBrand || !profiles[selectedBrand]) return;
            if (!automationEnabled) {
                setSystemLogs(prev => ["Automation disabled. Skipping background scan.", ...prev]);
                return;
            }

            const lastRun = loadDecisionLoopLastRun(selectedBrand);
            const now = Date.now();
            const isDecisionStale = !lastRun || now - lastRun >= DECISION_LOOP_INTERVAL_MS;

            if (!isDecisionStale) return;
            if (decisionLoopInFlightRef.current[selectedBrand]) return;
            decisionLoopInFlightRef.current[selectedBrand] = true;

            setSystemLogs(prev => ["Initializing Auto-Pilot Sentinel...", ...prev]);

            try {
                const actionCenter = await fetchActionCenter(selectedBrand);
                if (actionCenter) {
                    if (actionCenter.growthReport && (!growthReport || growthReport.lastUpdated === 0)) {
                        setGrowthReport(actionCenter.growthReport);
                        setSystemLogs(prev => ["Loaded server-side Daily Briefing.", ...prev]);
                    }

                    if (actionCenter.decisions?.length) {
                        const mappedTasks = actionCenter.decisions.map(mapDecisionToTask).slice(0, 5);
                        if (mappedTasks.length > 0) {
                            setStrategyTasks(mappedTasks);
                            saveStrategyTasks(selectedBrand, mappedTasks);
                            setSystemLogs(prev => ["Loaded server-side Action Center recommendations.", ...prev]);
                        }
                    }

                    if (actionCenter.decisions?.length && actionCenter.growthReport) {
                        setSystemLogs(prev => ["Server brain is active. Skipping local scan.", ...prev]);
                        return;
                    }
                }

                // 1. Ingest Market Data
                setSystemLogs(prev => ["Scanning Social Graph (Twitter/Farcaster) & On-Chain...", ...prev]);
                const registryEntry = getBrandRegistryEntry(selectedBrand);
                await runMarketScan(selectedBrand, [], registryEntry?.brandId);
                await new Promise(r => setTimeout(r, 800));

                // 2. Fetch Trends & Mentions
                setSystemLogs(prev => ["Analysis: Fetching Trends & Mentions...", ...prev]);
                const [trends, mentions] = await Promise.all([
                    fetchMarketPulse(selectedBrand).catch(e => { console.warn("Market Pulse failed", e); return []; }),
                    fetchMentions(selectedBrand).catch(e => { console.warn("Mentions failed", e); return []; }),
                    fetchSocialMetrics(selectedBrand).catch(e => { console.warn("Social Metrics failed", e); return null; })
                ]);

                // 2b. Update Live Signals (Prioritize High Velocity / AI Signals)
                // Filter for high relevance (>80) or LunarCrush AI signals
                // GAIA FILTER: Only show highly relevant (>85) items to reduce noise
                const highVelocityTrends = trends.filter(t => t.relevanceScore > 85);

                const liveSignals: SocialSignals = {
                    ...computeSocialSignals(trends, mentions, socialMetrics || undefined),
                    trendingTopics: highVelocityTrends.length > 0 ? highVelocityTrends : trends.slice(0, 3) // Fallback to top 3 if no super-high trends
                };
                setSocialSignals(liveSignals);

                // 2c. Generate Growth Report (Daily Briefing) - REAL TIME w/ CACHE (6h)
                // FIX: Check storage directly if state is empty to avoid race condition on mount
                let currentReport = growthReport;

                // 1. Try Local Storage Synchronously
                if (!currentReport) {
                    const cachedParams = loadGrowthReport(selectedBrand);
                    if (cachedParams) currentReport = cachedParams;
                }

                // 2. If Local is Missing or is just a Seed (lastUpdated === 0), Try Cloud (Async)
                if (!currentReport || currentReport.lastUpdated === 0) {
                    setSystemLogs(prev => ["Local cache empty/seed. Syncing from Cloud...", ...prev]);
                    try {
                        // Explicitly wait for cloud data
                        const cloudReport = await fetchGrowthReportFromCloud(selectedBrand);
                        if (cloudReport) {
                            currentReport = cloudReport;
                            // Update State immediately so UI shows it
                            setGrowthReport(cloudReport);
                            setSystemLogs(prev => ["Cloud sync successful. Loaded Daily Briefing.", ...prev]);
                        }
                    } catch (e) {
                        console.warn("Cloud sync check failed", e);
                    }
                }

                const reportAge = currentReport?.lastUpdated ? Date.now() - currentReport.lastUpdated : null;
                const hoursOld = reportAge ? (reportAge / (1000 * 60 * 60)).toFixed(1) : "NEW";

                setSystemLogs(prev => [`GAIA: Verifying Briefing Freshness (Age: ${hoursOld}h)...`, ...prev]);

                const isStale = !reportAge || reportAge > 6 * 60 * 60 * 1000; // 6 Hours (4x per day)

                if (!currentReport || isStale) {
                    setSystemLogs(prev => ["GAIA: Report is stale or missing. Generating Daily Briefing...", ...prev]);
                    try {
                        const freshReport = await generateGrowthReport(selectedBrand, trends, mentions, profiles[selectedBrand]);
                        setGrowthReport(freshReport);
                    } catch (err) {
                        console.error("Failed to generate growth report", err);
                    }
                } else {
                    setSystemLogs(prev => ["GAIA: Daily Briefing is fresh. Skipping generation.", ...prev]);
                }

                // 3. RAG Memory Retrieval
                setSystemLogs(prev => ["Memory: Querying Vector Database...", ...prev]);
                const registry = getBrandRegistryEntry(selectedBrand);
                const ragHits = await searchContext(`Market trends and strategy context for ${selectedBrand}`, 5, registry?.brandId);
                const ragContextDocs = ragHits.map(h => h.content); // Extract just strings

                // 4. UNIFIED BRAIN EXECUTION (Autopilot)
                const existingTasks = loadStrategyTasks(selectedBrand);
                const hasOnlyWelcome = hasOnlyWelcomeTask(existingTasks);

                const brainLogs = loadBrainLogs(selectedBrand).slice(0, 5);
                const brainLogSignals = brainLogs.map(log => `[${log.type}] ${log.context}`).join('\n');
                const deepContext = await getBrainContext(registryEntry?.brandId);

                const brandProfile = profiles[selectedBrand];
                const knowledgeBase = brandProfile?.knowledgeBase?.length
                    ? `BRAND KNOWLEDGE:\n${brandProfile.knowledgeBase.slice(0, 8).map(entry => `- ${entry}`).join('\n')}`
                    : '';
                const positioning = brandProfile?.brandCollectorProfile?.positioning?.oneLiner
                    ? `POSITIONING:\n${brandProfile.brandCollectorProfile.positioning.oneLiner}`
                    : '';
                const voiceGuidelines = brandProfile?.voiceGuidelines
                    ? `VOICE GUIDELINES:\n${brandProfile.voiceGuidelines}`
                    : '';
                const brandKnowledgeBlock = [knowledgeBase, positioning, voiceGuidelines].filter(Boolean).join('\n');

                const calendarSignal = calendarEvents.slice(0, 5).map(event => `${event.date} • ${event.platform}: ${event.content}`).join('\n');
                const mentionSignal = mentions.slice(0, 5).map(mention => `@${mention.author}: ${mention.text}`).join('\n');
                const latestAgentDecisions = agentDecisionsRef.current || [];
                const agentDecisionSignal = latestAgentDecisions.length
                    ? `AGENT DECISIONS:\n${latestAgentDecisions.map((d) => `- ${d.action}: ${d.reason}`).join('\n')}`
                    : '';

                const knowledgeSignals = [
                    brandKnowledgeBlock ? "Brand Knowledge" : null,
                    deepContext.context ? "Deep Memory" : null,
                    brainLogSignals ? "Brain Logs" : null,
                    ragContextDocs.length ? "Vector Memory" : null
                ].filter(Boolean);

                const hasTrends = trends.length > 0;
                const hasKnowledge = knowledgeSignals.length > 0;
                const hasMentions = mentions.length > 0;
                const hasRecentPosts = (socialMetrics?.recentPosts?.length || 0) > 0;
                const hasCalendar = calendarEvents.length > 0;
                const signalScore = [hasTrends, hasKnowledge, hasMentions, hasRecentPosts, hasCalendar].filter(Boolean).length;

                if (!hasTrends || signalScore < 2) {
                    setSystemLogs(prev => ["GAIA: Insufficient signal density. Skipping decision generation.", ...prev]);
                    return;
                }

                if (!existingTasks.length || hasOnlyWelcome) {
                    setSystemLogs(prev => ["Launch: Generating your first AI CMO playbook...", ...prev]);
                }

                setSystemLogs(prev => ["GAIA: Engaging Unified Brain...", ...prev]);

                const ragDocs = [
                    ...ragContextDocs,
                    deepContext.context ? `DEEP MEMORY:\n${deepContext.context}` : '',
                    brainLogSignals ? `RECENT BRAIN LOGS:\n${brainLogSignals}` : '',
                    brandKnowledgeBlock,
                    calendarSignal ? `CALENDAR:\n${calendarSignal}` : '',
                    mentionSignal ? `MENTIONS:\n${mentionSignal}` : '',
                    agentDecisionSignal
                ].filter(Boolean);

                // Construct the Context Object
                const brainContext = {
                    brand: { ...profiles[selectedBrand], name: selectedBrand },
                    marketState: {
                        trends: trends,
                        analytics: socialMetrics || undefined,
                        mentions: mentions
                    },
                    memory: {
                        ragDocs,
                        recentPosts: socialMetrics?.recentPosts || [],
                        pastStrategies: existingTasks
                    },
                    userObjective: hasOnlyWelcome
                        ? "Post-onboarding kickoff: deliver 1 campaign idea, 1 community engagement, and 1 evergreen content angle. Prioritize high-signal, low-risk actions."
                        : "Identify key market opportunities and execute a strategic response. Focus on high-impact updates."
                };

                const { analysis, actions } = await orchestrateMarketingDecision(brainContext, { calendarEvents, mentions });

                const scoreAction = (action: any) => {
                    let score = 0;
                    if (action.reasoning && action.reasoning.length > 20) score += 1;
                    if (action.instructions && action.instructions.length > 10) score += 1;
                    if (action.hook && action.hook.length > 3) score += 1;
                    if (action.strategicAlignment && action.strategicAlignment.length > 20) score += 1;
                    if (Array.isArray(action.contentIdeas) && action.contentIdeas.length >= 2) score += 1;
                    if (action.goal && action.goal.length > 5) score += 1;
                    return score;
                };

                const normalizeActionType = (actionType?: string): StrategyTask['type'] => {
                    const normalized = actionType?.toUpperCase() || '';
                    switch (normalized) {
                        case 'CAMPAIGN':
                            return 'CAMPAIGN_IDEA';
                        case 'REPLY':
                            return 'REPLY';
                        case 'THREAD':
                            return 'TREND_JACK';
                        default:
                            return 'EVERGREEN';
                    }
                };

                const rankedActions = actions
                    .map(action => ({ action, score: scoreAction(action) }))
                    .filter(({ score }) => score >= 3)
                    .sort((a, b) => b.score - a.score);

                if (rankedActions.length === 0) {
                    setSystemLogs(prev => ["GAIA: Actions returned but failed quality gate. Skipping update.", ...prev]);
                    return;
                }

                setSystemLogs(prev => [`Autopilot: Executed ${rankedActions.length} strategic actions.`, ...prev]);

                const topTrend = highVelocityTrends[0] || trends[0];
                const topMention = mentions[0];
                const defaultContextSource = topTrend
                    ? { type: 'TREND', source: topTrend.source || 'Market Pulse', headline: topTrend.headline }
                    : topMention
                        ? { type: 'MENTION', source: `@${topMention.author}`, headline: topMention.text }
                        : undefined;

                const newTasks: StrategyTask[] = rankedActions.slice(0, 5).map(({ action, score }) => ({
                    id: crypto.randomUUID(),
                    title: `${action.type || 'ACTION'}: ${action.hook || action.topic}`,
                    description: action.goal ? `${action.goal}${action.instructions ? ` • ${action.instructions}` : ''}` : action.instructions || action.reasoning || 'Strategic action from GAIA.',
                    status: 'pending',
                    type: normalizeActionType(action.type),
                    contextSource: defaultContextSource,
                    impactScore: Math.min(10, 6 + score),
                    executionPrompt: action.instructions ? `${action.topic}\n\n${action.instructions}` : action.topic,
                    suggestedVisualTemplate: 'Auto',
                    reasoning: action.reasoning || analysis.summary || 'Strategic action recommended by GAIA.',
                    strategicAlignment: action.strategicAlignment,
                    contentIdeas: action.contentIdeas,
                    logicExplanation: action.strategicAlignment || analysis.strategicAngle,
                    proof: analysis.summary,
                    createdAt: Date.now(),
                    feedback: 'neutral'
                }));

                const hasCampaignTask = newTasks.some(task => task.type === 'CAMPAIGN_IDEA' || task.type === 'CAMPAIGN');
                if (!hasCampaignTask) {
                    const fallbackTopic = trends[0]?.headline || `${selectedBrand} launch momentum`;
                    newTasks.unshift({
                        id: crypto.randomUUID(),
                        title: `CAMPAIGN: ${fallbackTopic}`,
                        description: 'Kick off a launch campaign to convert attention into momentum.',
                        status: 'pending',
                        type: 'CAMPAIGN_IDEA',
                        contextSource: {
                            type: 'TREND',
                            source: 'Market Pulse',
                            headline: fallbackTopic
                        },
                        impactScore: 9,
                        executionPrompt: fallbackTopic,
                        suggestedVisualTemplate: 'Auto',
                        reasoning: 'New brand kickoff benefits from an immediate, high-signal campaign concept.',
                        logicExplanation: analysis.strategicAngle,
                        proof: analysis.summary,
                        createdAt: Date.now(),
                        feedback: 'neutral'
                    });
                }

                const cappedTasks = newTasks.slice(0, 5); // STRICT LIMIT: Max 5 new tasks

                setStrategyTasks(cappedTasks);
                saveStrategyTasks(selectedBrand, cappedTasks);

            } catch (e) {
                console.error("Auto-pilot analysis failed", e);
                setSystemLogs(prev => ["Sentinel Error: Analysis check failed.", ...prev]);
            } finally {
                saveDecisionLoopLastRun(selectedBrand);
                decisionLoopInFlightRef.current[selectedBrand] = false;
            }
        };

        // Run initial scan on mount / brand change
        runBackgroundScan();

        // Re-run on a 6h cadence to keep recommendations fresh without manual refresh
        const interval = setInterval(runBackgroundScan, DECISION_LOOP_INTERVAL_MS);
        return () => clearInterval(interval);

    }, [selectedBrand, automationEnabled, profiles, socialMetrics, strategyTasks, growthReport, calendarEvents]);

    // --- Server Health Check ---
    const [isServerOnline, setIsServerOnline] = useState<boolean>(false);
    useEffect(() => {
        const checkHealth = async () => {
            // In Vercel/Production, the API is at the same origin, so we can use '' or just relative paths.
            // If VITE_API_BASE_URL is set (e.g. for local dev with separate frontend/backend), use it.
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
            try {
                // simple check, if fails we just set offline
                const res = await fetch(`${baseUrl}/api/health`).catch(() => null);
                if (res && res.ok) setIsServerOnline(true);
                else setIsServerOnline(false);
            } catch (e) {
                setIsServerOnline(false);
            }
        };
        // Only poll if we expect a backend (e.g. dev or specific env)
        // For now, we run it but suppress errors
        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    // Campaign start date logic moved to Campaigns.tsx

    const handleStartOnboarding = () => {
        setOnboardingState(prev => ({
            ...prev,
            dismissed: false,
            lastStep: 0,
            updatedAt: Date.now(),
        }));
        navigate('/onboarding');
    };

    const getDefaultScheduleTime = () => {
        const now = new Date();
        now.setMinutes(0, 0, 0);
        now.setHours(now.getHours() + 1);
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const buildScheduledAt = (date: string, time?: string) => {
        if (!date) return undefined;
        const safeTime = time && time.length >= 4 ? time : '09:00';
        const scheduled = new Date(`${date}T${safeTime}:00`);
        if (Number.isNaN(scheduled.getTime())) return undefined;
        return scheduled.toISOString();
    };

    const handleSkipOnboarding = () => {
        setOnboardingState(prev => ({
            ...prev,
            dismissed: true,
            updatedAt: Date.now(),
        }));
        navigate('/dashboard');
    };

    const mergeUnique = <T,>(existing: T[] | undefined, incoming: T[] | undefined, getKey: (item: T) => string) => {
        const merged: T[] = [];
        const seen = new Set<string>();
        const addItem = (item: T) => {
            const key = getKey(item);
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(item);
        };

        (existing || []).forEach(addItem);
        (incoming || []).forEach(addItem);
        return merged;
    };

    const mergeBrandConfig = (existing: BrandConfig | undefined, incoming: BrandConfig): BrandConfig => {
        const safeExisting = existing || { colors: [], knowledgeBase: [], tweetExamples: [], referenceImages: [] };
        return {
            ...safeExisting,
            colors: mergeUnique(safeExisting.colors, incoming.colors, (color) => color.hex?.toLowerCase() || color.id),
            knowledgeBase: mergeUnique(safeExisting.knowledgeBase, incoming.knowledgeBase, (entry) => entry.trim()),
            tweetExamples: mergeUnique(safeExisting.tweetExamples, incoming.tweetExamples, (entry) => entry.trim()),
            referenceImages: mergeUnique(
                safeExisting.referenceImages,
                incoming.referenceImages,
                (image) => image.url || image.data || image.id
            ),
            brandCollectorProfile: safeExisting.brandCollectorProfile || incoming.brandCollectorProfile,
            voiceGuidelines: safeExisting.voiceGuidelines || incoming.voiceGuidelines,
            targetAudience: safeExisting.targetAudience || incoming.targetAudience,
            bannedPhrases: mergeUnique(safeExisting.bannedPhrases, incoming.bannedPhrases, (entry) => entry.trim()),
            visualIdentity: safeExisting.visualIdentity || incoming.visualIdentity,
            graphicTemplates: mergeUnique(
                safeExisting.graphicTemplates,
                incoming.graphicTemplates,
                (template) => template.id
            ),
        };
    };

    const KICKOFF_BOOTSTRAP_PREFIX = 'defia_onboarding_bootstrap_v1_';

    const getKickoffBootstrapKey = (brandName: string) => `${KICKOFF_BOOTSTRAP_PREFIX}${brandName.toLowerCase()}`;

    const hasKickoffBootstrap = (brandName: string) => {
        try {
            return Boolean(localStorage.getItem(getKickoffBootstrapKey(brandName)));
        } catch {
            return false;
        }
    };

    const markKickoffBootstrap = (brandName: string) => {
        try {
            localStorage.setItem(getKickoffBootstrapKey(brandName), new Date().toISOString());
        } catch {
            // no-op
        }
    };

    const truncate = (value: string, max: number) => (value.length > max ? value.slice(0, max).trim() : value.trim());

    const deriveKickoffTheme = (brandName: string, config: BrandConfig) => {
        const candidate =
            config?.brandCollectorProfile?.positioning?.oneLiner ||
            config?.tagline ||
            config?.missionStatement ||
            config?.brandDescription ||
            `${brandName} launch momentum`;
        return truncate(String(candidate || `${brandName} launch momentum`), 120);
    };

    const mergeCalendarEvents = (existing: CalendarEvent[], incoming: CalendarEvent[]) => {
        const seen = new Set<string>();
        const merged: CalendarEvent[] = [];
        const addEvent = (event: CalendarEvent) => {
            const key = `${event.date}|${event.time || ''}|${event.content}`;
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(event);
        };
        existing.forEach(addEvent);
        incoming.forEach(addEvent);
        return merged;
    };

    const buildKickoffCalendarEvents = (campaignName: string, drafts: any[]) => {
        const start = new Date();
        start.setDate(start.getDate() + 1);
        const timeStr = '09:00';

        return drafts.slice(0, 7).map((draft, index) => {
            const date = new Date(start);
            date.setDate(start.getDate() + index);
            const formatted = date.toISOString().split('T')[0];

            return {
                id: `kickoff-${Date.now()}-${index}`,
                date: formatted,
                time: timeStr,
                scheduledAt: buildScheduledAt(formatted, timeStr),
                content: draft.tweet,
                platform: 'Twitter',
                status: 'scheduled',
                approvalStatus: 'approved',
                campaignName,
                reasoning: draft.reasoning,
                template: draft.template,
                visualHeadline: draft.visualHeadline,
                visualDescription: draft.visualDescription,
                referenceImageId: draft.referenceImageId
            } as CalendarEvent;
        });
    };

    const bootstrapKickoffContent = async (brandName: string, config: BrandConfig) => {
        if (!brandName || !config) return;
        if (hasKickoffBootstrap(brandName)) return;

        const existingCampaignState = loadCampaignState(brandName);
        const existingCalendar = loadCalendarEvents(brandName);

        if ((existingCampaignState?.campaignItems?.length || 0) > 0 || (existingCalendar?.length || 0) > 0) {
            markKickoffBootstrap(brandName);
            return;
        }

        const kickoffTheme = deriveKickoffTheme(brandName, config);
        setSystemLogs(prev => [`Kickoff: Generating launch content for ${brandName}...`, ...prev]);

        try {
            const result = await generateCampaignDrafts(kickoffTheme, brandName, config, 7);
            const drafts = Array.isArray(result?.drafts) ? result.drafts : [];

            if (drafts.length === 0) {
                throw new Error('No drafts generated');
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() + 1);
            const startDateStr = startDate.toISOString().split('T')[0];

            const campaignItems: CampaignItem[] = drafts.slice(0, 3).map((draft: any, index: number) => ({
                id: `kickoff-draft-${Date.now()}-${index}`,
                tweet: draft.tweet,
                isApproved: false,
                approvalStatus: 'review',
                status: 'draft',
                images: [],
                campaignColor: result?.themeColor,
                template: draft.template,
                referenceImageId: draft.referenceImageId,
                reasoning: draft.reasoning,
                visualHeadline: draft.visualHeadline,
                visualDescription: draft.visualDescription
            }));

            const kickoffState = {
                viewMode: 'wizard',
                campaignStep: 3,
                campaignType: 'theme',
                campaignTheme: kickoffTheme,
                campaignGoal: 'Launch momentum',
                campaignPlatforms: ['Twitter'],
                campaignContext: '',
                campaignStrategy: null,
                campaignTemplate: '',
                campaignReferenceImage: null,
                campaignItems,
                campaignStartDate: startDateStr,
                contentPlan: null
            };

            saveCampaignState(brandName, kickoffState);

            const calendarEvents = buildKickoffCalendarEvents(kickoffTheme, drafts);
            const mergedEvents = mergeCalendarEvents(existingCalendar || [], calendarEvents);
            saveCalendarEvents(brandName, mergedEvents);
            setCalendarEvents(mergedEvents);

            setSystemLogs(prev => ["Kickoff: Campaign drafts + 7-day calendar ready.", ...prev]);
        } catch (e: any) {
            const message = e?.message || 'Kickoff generation failed.';
            setSystemLogs(prev => [`Kickoff: ${message}`, ...prev]);
        } finally {
            markKickoffBootstrap(brandName);
        }
    };

    const handleCompleteOnboarding = async (payload: { brandName: string; config: BrandConfig; sources: { domains: string[]; xHandles: string[]; youtube?: string } }) => {
        const mergedConfig = mergeBrandConfig(profiles[payload.brandName], payload.config);
        const nextProfiles = { ...profiles, [payload.brandName]: mergedConfig };
        setProfiles(nextProfiles);
        saveBrandProfiles(nextProfiles, true);
        setSelectedBrand(payload.brandName);
        try {
            const existingKeys = loadIntegrationKeys(payload.brandName);
            const handle = payload.sources?.xHandles?.[0];
            if (handle) {
                saveIntegrationKeys({ ...existingKeys, apify: handle }, payload.brandName);
            }
        } catch (e) {
            console.warn("Failed to save onboarding integration keys", e);
        }
        setOnboardingState({
            dismissed: false,
            completed: true,
            lastStep: 3,
            updatedAt: Date.now(),
        });
        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/brands/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: payload.brandName,
                    ownerId: currentUser?.id,
                    sources: payload.sources,
                    websiteUrl: payload.sources.domains?.[0],
                    config: mergedConfig,
                    enrichment: payload.config.brandCollectorProfile
                        ? { mode: 'collector', profile: payload.config.brandCollectorProfile }
                        : undefined
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.id) {
                    saveBrandRegistryEntry(payload.brandName, data.id);
                    const handle = payload.sources?.xHandles?.[0];
                    if (handle) {
                        await fetch(`${baseUrl}/api/brands/${data.id}/integrations`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ apifyHandle: handle })
                        });
                    }
                    fetch(`${baseUrl}/api/agent/trigger`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ brandId: data.id, brandName: payload.brandName })
                    }).catch(() => null);
                }
            }
        } catch (e) {
            console.warn("Failed to register brand", e);
        }
        await bootstrapKickoffContent(payload.brandName, mergedConfig);
        navigate('/campaigns');
    };

    const handleUpdateCurrentBrandConfig = (newConfig: BrandConfig) => {
        setProfiles(prev => ({ ...prev, [selectedBrand]: newConfig }));
    };

    const handleTrendToCampaign = (trend: TrendItem) => {
        handleNavigate('campaigns', { title: trend.headline });
    };

    const handleNavigate = useCallback((section: string, params: any) => {
        setAppSection(section);

        // Campaigns: Pre-fill Concept
        if (section === 'campaigns' && params?.intent) {
            setCampaignIntent({ type: 'theme', theme: params.intent });
        }

        // Pulse: Deep Link to Trend
        if (section === 'pulse' && params?.trend) {
            setInitialTrend(params.trend);
        }

        // Social: Filter View
        if (section === 'social' && params?.filter) {
            setSocialFilter(params.filter);
        }

        // Studio: Deep Link with Content
        if (section === 'studio') {
            if (params?.draft) setStudioDraft(params.draft);
            if (params?.visualPrompt) setStudioVisualPrompt(params.visualPrompt);
        }

        // Image Editor: Deep Link with Image
        if (section === 'image-editor') {
            if (params?.image) setEditorInitialImage(params.image);
            if (params?.prompt) setEditorInitialPrompt(params.prompt);
        }
    }, []);

    // --- Onboarding / Research ---

    const handleStartResearch = async () => {
        if (!newBrandName || !newBrandUrl) return;

        setIsResearching(true);
        setResearchLogs([]);

        const addLog = (msg: string) => setResearchLogs(prev => [...prev, msg]);

        try {
            addLog(`Initializing connection to ${newBrandUrl}...`);
            await new Promise(r => setTimeout(r, 800));
            addLog(`Analyzing metadata for ${newBrandName}...`);
            await new Promise(r => setTimeout(r, 800));
            addLog(`Extracting visual vectors and color palette...`);

            // Actual AI Call
            const newConfig = await researchBrandIdentity(newBrandName, newBrandUrl);

            addLog(`Brand DNA compiled successfully.`);
            await new Promise(r => setTimeout(r, 500));

            // Save and Switch
            setProfiles(prev => ({ ...prev, [newBrandName]: newConfig }));
            setSelectedBrand(newBrandName);
            setShowOnboarding(false);
            setNewBrandName('');
            setNewBrandUrl('');

        } catch (e) {
            addLog(`Error: Research failed. Manual setup required.`);
            console.error(e);
        } finally {
            setIsResearching(false);
        }
    };

    // --- Scheduling ---

    const handleOpenScheduleModal = (content: string, image?: string, campaignName?: string, dateOverride?: string) => {
        setItemToSchedule({ content, image, campaignName });

        if (dateOverride) {
            setScheduleDate(dateOverride);
        } else {
            // Default to tomorrow if no date provided
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setScheduleDate(tomorrow.toISOString().split('T')[0]);
        }
        setScheduleTime(getDefaultScheduleTime());
        setShowScheduleModal(true);
    };

    const handleDayClick = (date: string) => {
        setScheduleDate(date);
        setScheduleTime(getDefaultScheduleTime());
        setItemToSchedule({ content: '', image: undefined, campaignName: '' });
        setShowScheduleModal(true);
    };

    const handleScheduleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            setItemToSchedule(prev => prev ? { ...prev, image: base64 } : null);
        } catch (err) { console.error("Upload failed", err); }
    };

    // handleCampaignImageUpload moved to Campaigns.tsx

    const handleConfirmSchedule = () => {
        if (!itemToSchedule || !scheduleDate) return;

        // Handle both cases: creating new (where content might be empty initially) or scheduling generated
        const content = itemToSchedule.content || "Media Post";
        const normalizedTime = scheduleTime && scheduleTime.length >= 4 ? scheduleTime : '09:00';
        const scheduledAt = buildScheduledAt(scheduleDate, normalizedTime);

        const newEvent: CalendarEvent = {
            id: `evt-${Date.now()}`,
            date: scheduleDate,
            time: normalizedTime,
            scheduledAt,
            content: content,
            image: itemToSchedule.image,
            platform: 'Twitter',
            status: 'scheduled',
            campaignName: itemToSchedule.campaignName
        };

        const updatedEvents = [...calendarEvents, newEvent];
        setCalendarEvents(updatedEvents);
        saveCalendarEvents(selectedBrand, updatedEvents);

        setShowScheduleModal(false);
        setItemToSchedule(null);
    };

    const handleDeleteEvent = (id: string) => {
        const updatedEvents = calendarEvents.filter(e => e.id !== id);
        setCalendarEvents(updatedEvents);
        saveCalendarEvents(selectedBrand, updatedEvents);
    };

    const handleMoveEvent = (id: string, newDate: string) => {
        const updatedEvents = calendarEvents.map(e =>
            e.id === id ? { ...e, date: newDate, scheduledAt: buildScheduledAt(newDate, e.time) } : e
        );
        setCalendarEvents(updatedEvents);
        saveCalendarEvents(selectedBrand, updatedEvents);
    };

    const handleUpdateEvent = (id: string, updatedFields: Partial<CalendarEvent>) => {
        const updatedEvents = calendarEvents.map(e =>
            e.id === id
                ? {
                    ...e,
                    ...updatedFields,
                    scheduledAt: (updatedFields.date || updatedFields.time)
                        ? buildScheduledAt(updatedFields.date || e.date, updatedFields.time || e.time)
                        : e.scheduledAt
                }
                : e
        );
        setCalendarEvents(updatedEvents);
        saveCalendarEvents(selectedBrand, updatedEvents);
    };

    // handleBatchScheduleCampaign moved to Campaigns.tsx

    // Campaign Workflow Functions (handleDraftCampaign, etc.) moved to Campaigns.tsx

    // --- Other Logic ---
    // Campaign Workflow Functions (handleDraftCampaign, etc.) moved to Campaigns.tsx

    const handleUpdatePosture = (newPosture: StrategicPosture) => {
        setStrategicPosture(newPosture);
        saveStrategicPosture(selectedBrand, newPosture);
    };

    const handleTaskFeedback = (taskId: string, feedback: 'approved' | 'dismissed' | 'neutral') => {
        setStrategyTasks(prev => {
            const updated = prev.map(task => task.id === taskId
                ? { ...task, feedback, feedbackAt: Date.now(), status: feedback === 'neutral' ? task.status : feedback }
                : task
            );
            saveStrategyTasks(selectedBrand, updated);
            return updated;
        });

        const task = strategyTasks.find(t => t.id === taskId);
        if (task) {
            saveBrainLog({
                brandId: selectedBrand,
                type: 'FEEDBACK',
                context: `${feedback.toUpperCase()}: ${task.title}`,
                timestamp: Date.now()
            });
        }
    };

    const handleRefinePosture = async () => {
        if (!strategicPosture) return;
        // Mock loading state is handled by component prop, but we can prevent double click here
        try {
            // Fetch latest market data first if missing
            let trends: TrendItem[] = [];
            try {
                trends = await fetchMarketPulse(selectedBrand);
            } catch (e) { trends = []; }

            const updated = await refineStrategicPosture(selectedBrand, strategicPosture, trends, growthReport);
            setStrategicPosture(updated);
            saveStrategicPosture(selectedBrand, updated);
        } catch (e) {
            console.error("Refine failed", e);
        }
    };

    // count moved
    // const approvedCount = campaignItems.filter(i => i.isApproved).length;

    const isLanding = route === '/';
    const isAuthRoute = route === '/login' || route === '/signup';
    const isOnboardingRoute = route.startsWith('/onboarding');
    const isDashboardRoute = !isLanding && !isAuthRoute && !isOnboardingRoute;
    const shouldShowOnboardingPrompt = isDashboardRoute && !onboardingState.completed && !onboardingState.dismissed;

    // Auth loading state
    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-[#FF5C00] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[#6B6B70] text-sm">Loading...</span>
                </div>
            </div>
        );
    }

    if (isLanding) {
        return <LandingPage onOpenDashboard={() => {
            // If user is logged in, go to dashboard, otherwise go to login
            if (currentUser) {
                navigate('/dashboard');
            } else {
                navigate('/login');
            }
        }} />;
    }

    // Auth pages (login/signup)
    if (isAuthRoute) {
        // If already logged in, redirect to dashboard
        if (currentUser) {
            navigate('/dashboard');
            return null;
        }
        return (
            <AuthPage
                mode={route === '/signup' ? 'signup' : 'login'}
                onSuccess={(hasBrand) => {
                    // If user already has a brand (demo accounts or returning users), skip onboarding
                    if (hasBrand) {
                        // Mark onboarding as complete for users with existing brands
                        setOnboardingState({
                            dismissed: false,
                            completed: true,
                            lastStep: 3,
                            updatedAt: Date.now(),
                        });
                        navigate('/dashboard');
                    } else {
                        // New users go through onboarding
                        navigate('/onboarding');
                    }
                }}
                onSwitchMode={() => navigate(route === '/login' ? '/signup' : '/login')}
            />
        );
    }

    // Protected routes - require auth
    if (isDashboardRoute && !currentUser) {
        navigate('/login');
        return null;
    }

    if (isOnboardingRoute) {
        return (
            <OnboardingFlow
                onExit={() => navigate('/dashboard')}
                onComplete={handleCompleteOnboarding}
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-white font-sans flex flex-row h-screen overflow-hidden">
            {/* SIDEBAR */}
            {selectedBrand && profiles[selectedBrand] && (
                <Sidebar
                    currentSection={appSection}
                    onNavigate={(s) => handleNavigate(s, null)}
                    brandName={selectedBrand}
                    profiles={profiles}
                    onSelectBrand={setSelectedBrand}
                    onConnect={() => setShowOnboarding(true)}
                />
            )}

            <main className="flex-1 w-full h-full flex flex-col relative overflow-auto bg-[#0A0A0B]">
                {isDashboardRoute && !onboardingState.completed && (
                    <div className="px-6 pt-6">
                        {shouldShowOnboardingPrompt ? (
                            <OnboardingPrompt
                                onStart={handleStartOnboarding}
                                onSkip={handleSkipOnboarding}
                            />
                        ) : (
                            <div className="rounded-2xl border border-[#1F1F23] bg-[#111113] p-4 shadow-sm flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-white">Resume onboarding anytime</div>
                                    <p className="text-xs text-[#6B6B70] mt-1">Pick up where you left off and enrich your brand profile.</p>
                                </div>
                                <Button onClick={handleStartOnboarding} className="px-4 py-2 bg-[#FF5C00] hover:bg-[#FF6B1A] text-white">Resume onboarding</Button>
                            </div>
                        )}
                    </div>
                )}

                {/* EMPTY STATE */}
                {(!selectedBrand || !profiles[selectedBrand]) && !showOnboarding && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 animate-fadeIn">
                        <div className="w-16 h-16 bg-brand-accent/10 text-brand-accent rounded-2xl flex items-center justify-center mb-6 text-3xl">✨</div>
                        <h2 className="text-2xl font-bold text-brand-text mb-2">Welcome to Defia Studio</h2>
                        <p className="text-brand-muted mb-8 max-w-md">Connect your brand identity to generate tailored content and strategies.</p>
                        <Button onClick={() => setShowOnboarding(true)} className="shadow-xl shadow-brand-accent/20">+ Connect Brand</Button>
                    </div>
                )}

                {/* SECTION: DASHBOARD */}
                {appSection === 'dashboard' && selectedBrand && (
                    <Dashboard
                        brandName={selectedBrand}
                        brandConfig={profiles[selectedBrand]}
                        calendarEvents={calendarEvents}
                        socialMetrics={socialMetrics}
                        chainMetrics={chainMetrics}
                        socialSignals={socialSignals} // Pass signals
                        systemLogs={systemLogs}
                        growthReport={growthReport}
                        onNavigate={(section, params) => handleNavigate(section, params)}
                        agentDecisions={agentDecisions}
                        // New Props from Growth Engine
                        tasks={strategyTasks}
                        onUpdateTasks={setStrategyTasks}
                        onSchedule={handleOpenScheduleModal}
                    />
                )}

                {/* SECTION: STRATEGY (AI STRATEGIC POSTURE) */}
                {appSection === 'brain' && selectedBrand && strategicPosture && (
                    <AIStrategicPosture
                        brandName={selectedBrand}
                        tasks={strategyTasks}
                        posture={strategicPosture}
                        onUpdate={handleUpdatePosture}
                        onRefine={handleRefinePosture}
                        onNavigate={handleNavigate}
                        onFeedback={handleTaskFeedback}
                        onSchedule={handleOpenScheduleModal}
                    />
                )}

                {/* SECTION: ANALYTICS (NEW) */}
                {appSection === 'analytics' && selectedBrand && (
                    <AnalyticsPage
                        brandName={selectedBrand}
                        metrics={socialMetrics}
                        chainMetrics={chainMetrics}
                    />
                )}

                {/* SECTION: PULSE */}
                {appSection === 'pulse' && selectedBrand && (
                    <div className="w-full h-full">
                        <PulseEngine
                            brandName={selectedBrand}
                            brandConfig={profiles[selectedBrand]}
                            onLaunchCampaign={handleTrendToCampaign}
                            onSchedule={handleOpenScheduleModal}
                            initialTrend={initialTrend} // Pass deep link
                        />
                    </div>
                )}


                {/* SECTION: CAMPAIGNS */}
                {appSection === 'campaigns' && selectedBrand && profiles[selectedBrand] && (
                    <Campaigns
                        brandName={selectedBrand}
                        brandConfig={profiles[selectedBrand]}
                        events={calendarEvents}
                        onUpdateEvents={setCalendarEvents}
                        initialIntent={campaignIntent}
                        onClearIntent={() => setCampaignIntent(null)}
                        recentPosts={socialMetrics?.recentPosts || []}
                    />
                )}

                {/* SECTION: SETTINGS (Replaces 'profile') */}
                {appSection === 'settings' && selectedBrand && profiles[selectedBrand] && (
                    <Settings
                        brandName={selectedBrand}
                        config={profiles[selectedBrand]}
                        onChange={handleUpdateCurrentBrandConfig}
                        onNavigateToBrandKit={() => handleNavigate('brand-kit', null)}
                    />
                )}

                {/* SECTION: BRAND KIT */}
                {appSection === 'brand-kit' && selectedBrand && profiles[selectedBrand] && (
                    <BrandKitPage
                        brandName={selectedBrand}
                        config={profiles[selectedBrand]}
                        onChange={handleUpdateCurrentBrandConfig}
                        onBack={() => handleNavigate('settings', null)}
                    />
                )}


                {appSection === 'calendar' && selectedBrand && (
                    <div className="w-full max-w-7xl mx-auto p-6">
                        <ContentCalendar
                            brandName={selectedBrand}
                            events={[...calendarEvents, ...historyEvents]}
                            onDeleteEvent={handleDeleteEvent}
                            onAddEvent={handleDayClick}
                            onMoveEvent={handleMoveEvent}
                            onUpdateEvent={handleUpdateEvent}
                            onBatchAdd={(newEvents) => {
                                setCalendarEvents(prev => [...prev, ...newEvents]);
                                const updated = [...calendarEvents, ...newEvents]; // Capture state for save
                                saveCalendarEvents(selectedBrand, updated);
                            }}
                        />
                    </div>
                )}

                {/* SECTION: SOCIAL MEDIA */}
                {appSection === 'social' && selectedBrand && (
                    <SocialMedia
                        brandName={selectedBrand}
                        lunarPosts={[]} // Pass actual posts if available
                        socialMetrics={socialMetrics}
                        signals={socialSignals} // Live Brain Signals
                        initialFilter={socialFilter} // Pass filter
                    />
                )}

                {/* SECTION: TWITTER FEED */}
                {appSection === 'twitter-feed' && selectedBrand && (
                    <TwitterFeed
                        brandName={selectedBrand}
                        onNavigate={handleNavigate}
                    />
                )}

                {/* SECTION: STUDIO TOOLS */}
                {appSection === 'studio' && selectedBrand && profiles[selectedBrand] && (
                    <ContentStudio
                        brandName={selectedBrand}
                        brandConfig={profiles[selectedBrand]}
                        onSchedule={(content, image) => handleOpenScheduleModal(content, image)}
                        onUpdateBrandConfig={handleUpdateCurrentBrandConfig}
                        initialDraft={studioDraft}
                        initialVisualPrompt={studioVisualPrompt}
                    />
                )}

                {/* SECTION: IMAGE EDITOR */}
                {appSection === 'image-editor' && selectedBrand && profiles[selectedBrand] && (
                    <ImageEditor
                        brandConfig={profiles[selectedBrand]}
                        brandName={selectedBrand}
                        initialImage={editorInitialImage ?? undefined}
                        initialPrompt={editorInitialPrompt ?? undefined}
                    />
                )}

                {/* SECTION: COPILOT */}
                {appSection === 'copilot' && selectedBrand && (
                    <CopilotView
                        brandName={selectedBrand}
                        brandConfig={profiles[selectedBrand]}
                        calendarEvents={calendarEvents}
                        strategyTasks={strategyTasks}
                        growthReport={growthReport}
                        onNavigate={handleNavigate}
                    />
                )}

                {/* ONBOARDING MODAL */}
                {showOnboarding && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
                        <div className="bg-black border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative">
                            {/* Decorative Grid Background */}
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>

                            <div className="p-8 relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            AI Brand Research
                                        </h3>
                                        <p className="text-gray-400 text-sm mt-1">Plug & Play: Enter your details, we'll build the brand.</p>
                                    </div>
                                    <button onClick={() => setShowOnboarding(false)} className="text-gray-500 hover:text-white">✕</button>
                                </div>

                                {!isResearching ? (
                                    <div className="space-y-5">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Company Name</label>
                                            <input
                                                type="text"
                                                value={newBrandName}
                                                onChange={(e) => setNewBrandName(e.target.value)}
                                                placeholder="e.g. Arbitrum"
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-brand-accent outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Website URL</label>
                                            <input
                                                type="text"
                                                value={newBrandUrl}
                                                onChange={(e) => setNewBrandUrl(e.target.value)}
                                                placeholder="e.g. https://arbitrum.io"
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-brand-accent outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Contract Address (Optional)</label>
                                            <input
                                                type="text"
                                                placeholder="0x..."
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-brand-accent outline-none"
                                            />
                                            <p className="text-[10px] text-gray-600 mt-1">Used for Growth Engine data integration.</p>
                                        </div>

                                        <Button
                                            onClick={handleStartResearch}
                                            disabled={!newBrandName || !newBrandUrl}
                                            className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white font-bold h-12 shadow-lg shadow-brand-accent/20"
                                        >
                                            Initialize Brand Analysis
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="py-8 font-mono text-xs">
                                        <div className="flex items-center justify-center mb-6">
                                            <div className="w-16 h-16 border-4 border-gray-800 border-t-green-500 rounded-full animate-spin"></div>
                                        </div>
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar p-2 bg-gray-900/50 rounded border border-gray-800">
                                            {researchLogs.map((log, i) => (
                                                <div key={i} className="text-green-400">
                                                    <span className="text-gray-600 mr-2">{`>`}</span>
                                                    {log}
                                                </div>
                                            ))}
                                            <div className="text-green-400 animate-pulse">
                                                <span className="text-gray-600 mr-2">{`>`}</span>
                                                _
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {viewingImage && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" onClick={() => setViewingImage(null)}>
                        <img src={viewingImage} className="max-w-full max-h-[90vh] rounded shadow-2xl" onClick={e => e.stopPropagation()} />
                        <button onClick={() => setViewingImage(null)} className="absolute top-5 right-5 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700">✕</button>
                    </div>
                )}



                {/* SCHEDULE / ADD CONTENT MODAL */}
                {showScheduleModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-fadeIn">
                            <h3 className="text-lg font-bold text-brand-text mb-4">
                                {itemToSchedule?.content ? 'Schedule Content' : 'Create New Post'}
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Date</label>
                                    <input
                                        type="date"
                                        value={scheduleDate}
                                        onChange={(e) => setScheduleDate(e.target.value)}
                                        className="w-full border border-brand-border rounded-lg p-3 text-sm focus:border-brand-accent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Time</label>
                                    <input
                                        type="time"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        className="w-full border border-brand-border rounded-lg p-3 text-sm focus:border-brand-accent outline-none"
                                    />
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-brand-border space-y-3">
                                    <textarea
                                        value={itemToSchedule?.content || ''}
                                        onChange={e => setItemToSchedule(prev => prev ? { ...prev, content: e.target.value } : null)}
                                        placeholder="Write your post content..."
                                        className="w-full bg-transparent border-none p-0 text-sm focus:ring-0 resize-none min-h-[80px]"
                                    />

                                    {itemToSchedule?.image ? (
                                        <div className="relative group">
                                            <img src={itemToSchedule.image} className="w-full h-32 object-cover rounded-md" />
                                            <button
                                                onClick={() => setItemToSchedule(prev => prev ? { ...prev, image: undefined } : null)}
                                                className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-red-50 px-2"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <input type="file" ref={scheduleFileInputRef} onChange={handleScheduleImageUpload} accept="image/*" className="hidden" />
                                            <button
                                                onClick={() => scheduleFileInputRef.current?.click()}
                                                className="text-xs flex items-center gap-2 text-brand-accent font-bold hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                Add Image
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button onClick={() => setShowScheduleModal(false)} variant="secondary" className="flex-1">Cancel</Button>
                                    <Button onClick={handleConfirmSchedule} disabled={!scheduleDate} className="flex-1">Confirm Schedule</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Hidden File Inputs */}
                {/* campaignFileInputRef removed */}

            </main>
        </div>
    );
};

export default App;
