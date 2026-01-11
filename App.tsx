import React, { useState, useEffect, useRef } from 'react';
import { generateWeb3Graphic, generateTweet, generateIdeas, generateCampaignDrafts, researchBrandIdentity, generateStrategicAnalysis } from './services/gemini';
import { fetchMarketPulse } from './services/pulse';
import { fetchMentions, computeSocialSignals, fetchSocialMetrics } from './services/analytics';
import { runMarketScan } from './services/ingestion';
import { searchContext, buildContextBlock } from './services/rag';
import { loadBrandProfiles, saveBrandProfiles, loadCalendarEvents, saveCalendarEvents, loadStrategyTasks, saveStrategyTasks, STORAGE_EVENTS, loadBrainLogs, saveBrainLog } from './services/storage';
import { migrateToCloud } from './services/migration'; // Import migration
import { Button } from './components/Button';
import { Select } from './components/Select';
import { BrandKit } from './components/BrandKit';
import { GrowthEngine } from './components/GrowthEngine';
import { PulseEngine } from './components/PulseEngine'; // Import Pulse
import { ContentCalendar } from './components/ContentCalendar';
import { Dashboard } from './components/Dashboard'; // Import Dashboard
import { AnalyticsPage } from './components/AnalyticsPage'; // Import Analytics
import { Campaigns } from './components/Campaigns'; // Import Campaigns
import { SocialMedia } from './components/SocialMedia'; // Import SocialMedia
import { BrainPage } from './components/Brain/BrainPage'; // Import BrainPage
import { ContentStudio } from './components/ContentStudio'; // Import ContentStudio
import { Sidebar } from './components/Sidebar';
import { ImageSize, AspectRatio, BrandConfig, ReferenceImage, CampaignItem, TrendItem, CalendarEvent, SocialMetrics, StrategyTask, ComputedMetrics, GrowthReport, SocialSignals } from './types';

const App: React.FC = () => {
    // Check environment variable first (injected by Vite define)
    const [hasKey, setHasKey] = useState<boolean>(!!process.env.API_KEY);
    const [checkingKey, setCheckingKey] = useState<boolean>(true);
    const [isConnecting, setIsConnecting] = useState<boolean>(false);

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

    // App Navigation State
    const [appSection, setAppSection] = useState<string>('dashboard'); // Default to dashboard

    // App State - Profiles
    const [profiles, setProfiles] = useState<Record<string, BrandConfig>>(() => loadBrandProfiles());
    // Safely initialize selectedBrand to the first available profile, or empty string if none exist.
    const [selectedBrand, setSelectedBrand] = useState<string>(() => Object.keys(loadBrandProfiles())[0] || '');

    // Onboarding / Connect State
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');
    const [newBrandUrl, setNewBrandUrl] = useState('');
    const [isResearching, setIsResearching] = useState(false);
    const [researchLogs, setResearchLogs] = useState<string[]>([]);

    // Calendar State
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [itemToSchedule, setItemToSchedule] = useState<{ content: string, image?: string, campaignName?: string } | null>(null);
    const [scheduleDate, setScheduleDate] = useState('');

    // Strategy & Metrics State (Lifted for Dashboard)
    const [strategyTasks, setStrategyTasks] = useState<StrategyTask[]>([]);
    const [socialMetrics, setSocialMetrics] = useState<SocialMetrics | null>(null);
    const [chainMetrics, setChainMetrics] = useState<ComputedMetrics | null>(null); // Lifted for Defia Index
    const [growthReport, setGrowthReport] = useState<GrowthReport | null>(null); // Lifted for Dashboard

    // NEW: Shared "War Room" Signals for Brain & UI
    const [socialSignals, setSocialSignals] = useState<SocialSignals>({
        sentimentScore: 78,
        sentimentTrend: 'up',
        activeNarratives: ["#L2Wars", "$DEFI", "Yield Farming"],
        topKols: []
    });

    const [systemLogs, setSystemLogs] = useState<string[]>([]); // New: Activity Logs for Dashboard

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

    useEffect(() => {
        if (Object.keys(profiles).length > 0) {
            saveBrandProfiles(profiles);
        }
    }, [profiles]);

    useEffect(() => {
        setCalendarEvents(loadCalendarEvents(selectedBrand));
        setStrategyTasks(loadStrategyTasks(selectedBrand)); // Load Tasks

        // Listen for background sync updates
        const handleSyncUpdate = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.brandName === selectedBrand) {
                console.log("Live Sync: Reloading calendar events for", selectedBrand);
                setCalendarEvents(loadCalendarEvents(selectedBrand));
            }
        };

        window.addEventListener(STORAGE_EVENTS.CALENDAR_UPDATE, handleSyncUpdate);
        return () => window.removeEventListener(STORAGE_EVENTS.CALENDAR_UPDATE, handleSyncUpdate);
    }, [selectedBrand]);

    // NEW: Robust Auto-Save for Calendar
    // This replaces manual saves in children and ensures persistence.
    // We use a ref to skip the initial mount save to avoid overwriting with empty.
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (selectedBrand) {
            saveCalendarEvents(selectedBrand, calendarEvents);
        }
    }, [calendarEvents, selectedBrand]);

    // Persist Tasks
    useEffect(() => {
        saveStrategyTasks(selectedBrand, strategyTasks);
    }, [strategyTasks, selectedBrand]);

    // --- AUTO-PILOT LOGIC (Formerly in GrowthEngine) ---
    // Persistent background scanning regardless of active tab
    useEffect(() => {
        const runBackgroundScan = async () => {
            // Only run if we don't have fresh data and we have a valid brand
            if (strategyTasks.length > 0 || !selectedBrand || !profiles[selectedBrand]) return;

            setSystemLogs(prev => ["Initializing Auto-Pilot Sentinel...", ...prev]);

            try {
                // 1. Ingest Market Data
                setSystemLogs(prev => ["Scanning Social Graph (Twitter/Farcaster) & On-Chain...", ...prev]);
                await runMarketScan(selectedBrand);
                await new Promise(r => setTimeout(r, 800));

                // 2. Fetch Trends & Mentions
                setSystemLogs(prev => ["Analysis: Fetching Trends & Mentions...", ...prev]);
                const [trends, mentions] = await Promise.all([
                    fetchMarketPulse(selectedBrand),
                    fetchMentions(selectedBrand),
                    fetchSocialMetrics(selectedBrand)
                ]);

                // 2b. Update Live Signals (Brain Context)
                const liveSignals = computeSocialSignals(trends, mentions, socialMetrics || undefined);
                setSocialSignals(liveSignals);

                // 3. RAG Memory Retrieval
                setSystemLogs(prev => ["Memory: Querying Vector Database...", ...prev]);
                const ragHits = await searchContext(`Market trends, strategy context, and past decisions for ${selectedBrand}`, 5);
                const ragContext = buildContextBlock(ragHits);
                await new Promise(r => setTimeout(r, 800));

                // 4. AI Synthesis
                setSystemLogs(prev => ["Synthesizing Strategy Opportunities...", ...prev]);

                const generatedTasks = await generateStrategicAnalysis(
                    selectedBrand,
                    calendarEvents,
                    trends,
                    profiles[selectedBrand],
                    null, // Growth Report optional
                    mentions,
                    ragContext,
                    socialSignals,
                    loadBrainLogs(selectedBrand) // Cognitive Loop
                );

                setStrategyTasks(generatedTasks);
                setSystemLogs(prev => ["Sentinel: Strategy Updated.", ...prev]);

            } catch (e) {
                console.error("Auto-pilot analysis failed", e);
                setSystemLogs(prev => ["Sentinel Error: Analysis check failed.", ...prev]);
            }
        };

        const interval = setInterval(() => {
            // Periodic "Liveness" check
            setSystemLogs(prev => [`Sentinel Scan Active: ${new Date().toLocaleTimeString()}`, ...prev].slice(0, 50));
        }, 60000); // Every minute log a pulse

        // Run initial scan on mount
        runBackgroundScan();

        return () => clearInterval(interval);
        return () => clearInterval(interval);
    }, [selectedBrand]);

    // --- Server Health Check ---
    const [isServerOnline, setIsServerOnline] = useState<boolean>(false);
    useEffect(() => {
        const checkHealth = async () => {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
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

    // --- Agent Decisions Polling ---
    const [agentDecisions, setAgentDecisions] = useState<any[]>([]);
    useEffect(() => {
        const fetchDecisions = async () => {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
            try {
                // If health check failed previously, maybe skip this? 
                // For now, simple fetch with suppression
                const res = await fetch(`${baseUrl}/api/decisions`).catch(() => null);
                if (res && res.ok) {
                    const data = await res.json();
                    setAgentDecisions(data.filter((d: any) =>
                        d.status === 'pending' &&
                        (!d.brandId || d.brandId === selectedBrand)
                    ));
                }
            } catch (e) {
                // scilent fail 
            }
        };
        fetchDecisions();
        const interval = setInterval(fetchDecisions, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [selectedBrand]);

    // Campaign start date logic moved to Campaigns.tsx

    useEffect(() => {
        const checkKey = async () => {
            // If we already have a key from env, don't check aistudio
            if (hasKey) {
                setCheckingKey(false);
                return;
            }

            try {
                if (window.aistudio && window.aistudio.hasSelectedApiKey) {
                    const has = await window.aistudio.hasSelectedApiKey();
                    setHasKey(has);
                } else {
                    console.warn("AI Studio wrapper not found.");
                }
            } catch (e) {
                console.error("Error checking API key", e);
            } finally {
                setCheckingKey(false);
            }
        };
        checkKey();
    }, [hasKey]);

    const handleConnectKey = async () => {
        setIsConnecting(true);
        try {
            if (window.aistudio && window.aistudio.openSelectKey) {
                await window.aistudio.openSelectKey();
                setTimeout(() => setHasKey(true), 500);
            } else {
                setTimeout(() => setHasKey(true), 800);
            }
        } catch (e) { setError("Failed to connect API Key."); } finally { setIsConnecting(false); }
    };

    const handleUpdateCurrentBrandConfig = (newConfig: BrandConfig) => {
        setProfiles(prev => ({ ...prev, [selectedBrand]: newConfig }));
    };

    const handleTrendToCampaign = (trend: TrendItem) => {
        handleNavigate('campaigns', { title: trend.headline });
    };

    const handleNavigate = (section: string, params: any) => {
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
    }

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
        setShowScheduleModal(true);
    };

    const handleDayClick = (date: string) => {
        setScheduleDate(date);
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

        const newEvent: CalendarEvent = {
            id: `evt-${Date.now()}`,
            date: scheduleDate,
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
            e.id === id ? { ...e, date: newDate } : e
        );
        setCalendarEvents(updatedEvents);
        saveCalendarEvents(selectedBrand, updatedEvents);
    };

    const handleUpdateEvent = (id: string, updatedFields: Partial<CalendarEvent>) => {
        const updatedEvents = calendarEvents.map(e =>
            e.id === id ? { ...e, ...updatedFields } : e
        );
        setCalendarEvents(updatedEvents);
        saveCalendarEvents(selectedBrand, updatedEvents);
    };

    // handleBatchScheduleCampaign moved to Campaigns.tsx

    // Campaign Workflow Functions (handleDraftCampaign, etc.) moved to Campaigns.tsx

    // --- Other Logic ---
    // Campaign Workflow Functions (handleDraftCampaign, etc.) moved to Campaigns.tsx

    // count moved
    // const approvedCount = campaignItems.filter(i => i.isApproved).length;

    if (checkingKey) return <div className="min-h-screen bg-white flex items-center justify-center text-brand-text">Loading Defia Studio...</div>;
    if (!hasKey) return (
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-4xl text-brand-text font-display font-bold mb-4 tracking-tight">Defia Studio</h1>
            <p className="text-brand-muted mb-8">Professional Web3 Content & Growth Intelligence</p>
            <Button onClick={handleConnectKey} isLoading={isConnecting}>Connect API Key</Button>
        </div>
    );

    return (
        <div className="min-h-screen bg-brand-bg text-brand-text font-sans flex flex-row h-screen overflow-hidden">
            {/* SIDEBAR */}
            {selectedBrand && profiles[selectedBrand] && (
                <Sidebar
                    currentSection={appSection}
                    onNavigate={(s) => setAppSection(s)}
                    brandName={selectedBrand}
                    profiles={profiles}
                    onSelectBrand={setSelectedBrand}
                    onConnect={() => setShowOnboarding(true)}
                />
            )}

            <main className="flex-1 w-full h-full flex flex-col relative overflow-auto">

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
                        strategyTasks={strategyTasks}
                        chainMetrics={chainMetrics}
                        socialSignals={socialSignals} // Pass signals
                        systemLogs={systemLogs}
                        growthReport={growthReport}
                        onNavigate={(section) => setAppSection(section)}
                    />
                )}

                {/* SECTION: BRAIN (NEW) */}
                {appSection === 'brain' && selectedBrand && (
                    <BrainPage brandName={selectedBrand} />
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

                {/* SECTION: GROWTH & STRATEGY (Always Mounted for Background Ops) */}
                {selectedBrand && profiles[selectedBrand] && (
                    <div className={`w-full h-full animate-fadeIn ${appSection === 'growth' ? 'block' : 'hidden'}`}>
                        <GrowthEngine
                            brandName={selectedBrand}
                            calendarEvents={calendarEvents}
                            brandConfig={profiles[selectedBrand]}
                            onSchedule={handleOpenScheduleModal}
                            metrics={socialMetrics}
                            onUpdateMetrics={setSocialMetrics}
                            chainMetrics={chainMetrics}
                            onUpdateChainMetrics={setChainMetrics}
                            tasks={strategyTasks}
                            onUpdateTasks={setStrategyTasks}
                            growthReport={growthReport}
                            onUpdateGrowthReport={setGrowthReport}
                            onLog={(msg) => {
                                setSystemLogs(prev => [msg, ...prev].slice(0, 50));
                                // Pipe to Brain Stream
                                if (selectedBrand) {
                                    saveBrainLog({
                                        id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                        timestamp: Date.now(),
                                        type: 'SYSTEM',
                                        brandId: selectedBrand,
                                        context: msg,
                                        model: 'System',
                                        thoughts: 'System Activity Log'
                                    });
                                }
                            }} // Pipe logs
                            signals={socialSignals} // Pass signals to Brain
                            onNavigate={handleNavigate}
                        />
                    </div>
                )}

                {/* SECTION: BRAND KIT */}
                {appSection === 'profile' && selectedBrand && profiles[selectedBrand] && (
                    <div className="w-full max-w-5xl mx-auto">
                        <BrandKit
                            brandName={selectedBrand}
                            config={profiles[selectedBrand]}
                            onChange={handleUpdateCurrentBrandConfig}
                        />
                    </div>
                )}

                {appSection === 'calendar' && selectedBrand && (
                    <div className="w-full max-w-7xl mx-auto">
                        <ContentCalendar
                            brandName={selectedBrand}
                            events={calendarEvents}
                            onDeleteEvent={handleDeleteEvent}
                            onAddEvent={handleDayClick}
                            onMoveEvent={handleMoveEvent}
                            onUpdateEvent={handleUpdateEvent}
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
