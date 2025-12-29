import React, { useState, useEffect, useRef } from 'react';
import { generateWeb3Graphic, generateTweet, generateIdeas, generateCampaignDrafts, researchBrandIdentity, generateStrategicAnalysis } from './services/gemini';
import { fetchMarketPulse } from './services/pulse';
import { fetchMentions } from './services/analytics';
import { runMarketScan } from './services/ingestion';
import { searchContext, buildContextBlock } from './services/rag';
import { loadBrandProfiles, saveBrandProfiles, loadCalendarEvents, saveCalendarEvents, loadStrategyTasks, saveStrategyTasks, STORAGE_EVENTS } from './services/storage';
import { Button } from './components/Button';
import { Select } from './components/Select';
import { BrandKit } from './components/BrandKit';
import { GrowthEngine } from './components/GrowthEngine';
import { PulseEngine } from './components/PulseEngine'; // Import Pulse
import { ContentCalendar } from './components/ContentCalendar';
import { Dashboard } from './components/Dashboard'; // Import Dashboard
import { Campaigns } from './components/Campaigns'; // Import Campaigns
import { SocialMedia } from './components/SocialMedia'; // Import SocialMedia
import { Sidebar } from './components/Sidebar';
import { ImageSize, AspectRatio, BrandConfig, ReferenceImage, CampaignItem, TrendItem, CalendarEvent, SocialMetrics, StrategyTask, ComputedMetrics, GrowthReport, SocialSignals } from './types';

const App: React.FC = () => {
    // Check environment variable first (injected by Vite define)
    const [hasKey, setHasKey] = useState<boolean>(!!process.env.API_KEY);
    const [checkingKey, setCheckingKey] = useState<boolean>(true);
    const [isConnecting, setIsConnecting] = useState<boolean>(false);

    // App Navigation State
    const [appSection, setAppSection] = useState<string>('dashboard'); // Default to dashboard

    // App State - Profiles
    const [profiles, setProfiles] = useState<Record<string, BrandConfig>>(loadBrandProfiles());
    // Safely initialize selectedBrand to the first available profile, or empty string if none exist.
    const [selectedBrand, setSelectedBrand] = useState<string>(Object.keys(loadBrandProfiles())[0] || '');
    const [activeTab, setActiveTab] = useState<'brand' | 'writer' | 'generate' | 'calendar'>('calendar');

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

    // Single Generation State
    const [tweetText, setTweetText] = useState<string>('');
    const [visualPrompt, setVisualPrompt] = useState<string>(''); // Explicit visual direction
    const [size, setSize] = useState<ImageSize>('1K');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [variationCount, setVariationCount] = useState<string>('1');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);

    // Writer State
    const [writerTopic, setWriterTopic] = useState<string>('');
    const [writerTone, setWriterTone] = useState<string>('Professional');
    const [isWritingTweet, setIsWritingTweet] = useState<boolean>(false);
    const [generatedDraft, setGeneratedDraft] = useState<string>('');
    const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([]);
    const [isGeneratingIdeas, setIsGeneratingIdeas] = useState<boolean>(false);

    // Campaign Intent State (Handover from Pulse)
    const [campaignIntent, setCampaignIntent] = useState<{ type: 'theme' | 'diverse', theme: string } | null>(null);

    // Legacy State Removed (campaignStep, campaignType, campaignItems etc. moved to specific component)

    // UI State

    // UI State
    const [error, setError] = useState<string | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const scheduleFileInputRef = useRef<HTMLInputElement>(null);
    // const campaignFileInputRef = useRef<HTMLInputElement>(null); // Moved
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

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
                    fetchMentions(selectedBrand)
                ]);

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
                    ragContext
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
            try {
                const res = await fetch('http://localhost:3001/api/health'); // Assume standard port
                if (res.ok) setIsServerOnline(true);
                else setIsServerOnline(false);
            } catch (e) {
                setIsServerOnline(false);
            }
        };
        checkHealth();
        const interval = setInterval(checkHealth, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, []);

    // --- Agent Decisions Polling ---
    const [agentDecisions, setAgentDecisions] = useState<any[]>([]);
    useEffect(() => {
        const fetchDecisions = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/decisions');
                if (res.ok) {
                    const data = await res.json();
                    // FILTER: Pending + Matches Current Brand
                    setAgentDecisions(data.filter((d: any) =>
                        d.status === 'pending' &&
                        (!d.brandId || d.brandId === selectedBrand)
                    ));
                }
            } catch (e) { console.error("Failed to fetch decisions", e); }
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
        setAppSection('campaigns');
        setCampaignIntent({ type: 'theme', theme: `${trend.headline} (Trend Response)` });
    };

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
    const handleGenerateIdeas = async () => {
        setIsGeneratingIdeas(true);
        try { setSuggestedIdeas(await generateIdeas(selectedBrand)); } catch (e) { } finally { setIsGeneratingIdeas(false); }
    };

    const handleAIWrite = async () => {
        if (!writerTopic.trim()) return;
        setIsWritingTweet(true);
        try {
            const writtenTweet = await generateTweet(writerTopic, selectedBrand, profiles[selectedBrand], writerTone);
            setGeneratedDraft(writtenTweet);
        } catch (err) { setError("Failed to write tweet."); } finally { setIsWritingTweet(false); }
    };

    const handleGenerateSingle = async () => {
        setIsGenerating(true);
        setGeneratedImages([]);
        try {
            const count = parseInt(variationCount);
            const finalPrompt = tweetText || visualPrompt; // Allow generating just from visual prompt if tweet is empty

            const promises = Array.from({ length: count }).map(() => generateWeb3Graphic({
                prompt: finalPrompt,
                artPrompt: visualPrompt,
                size,
                aspectRatio,
                brandConfig: profiles[selectedBrand],
                brandName: selectedBrand
            }));
            setGeneratedImages(await Promise.all(promises));
        } catch (err) { setError("Failed to generate."); } finally { setIsGenerating(false); }
    };

    const handleDownload = (imageUrl: string, prefix: string) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `${selectedBrand}-${prefix}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrepareTweet = (text: string) => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');

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
                {appSection === 'dashboard' && selectedBrand && profiles[selectedBrand] && (
                    <Dashboard
                        brandName={selectedBrand}
                        calendarEvents={calendarEvents}
                        socialMetrics={socialMetrics}
                        strategyTasks={strategyTasks}
                        chainMetrics={chainMetrics}
                        systemLogs={systemLogs} // Pass logs to Dashboard
                        isServerOnline={isServerOnline}
                        onNavigate={setAppSection}
                        onQuickAction={() => { }} // Placeholder
                        growthReport={growthReport} // Pass recent report
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
                            onLog={(msg) => setSystemLogs(prev => [msg, ...prev].slice(0, 50))} // Pipe logs
                            signals={socialSignals} // Pass signals to Brain
                        />
                    </div>
                )}

                {/* SECTION: CALENDAR */}
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
                    />
                )}

                {/* SECTION: STUDIO TOOLS */}
                {appSection === 'studio' && selectedBrand && profiles[selectedBrand] && (
                    <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6">

                        {/* SIDEBAR */}
                        <div className="w-full lg:w-[400px] flex flex-col gap-4">

                            {/* Navigation */}
                            <div className="bg-white border border-brand-border rounded-xl p-2 shadow-sm flex flex-col gap-1">
                                {['writer', 'generate', 'brand'].map(tab => {
                                    const showBadge = tab === 'brand' && (!profiles[selectedBrand].referenceImages || profiles[selectedBrand].referenceImages.length === 0);
                                    return (
                                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`relative w-full text-left px-4 py-3 text-sm font-medium rounded-lg capitalize transition-colors flex items-center gap-3 ${activeTab === tab ? 'bg-gray-100 text-brand-text font-semibold' : 'text-brand-muted hover:bg-gray-50'}`}>
                                            <span className="opacity-50">
                                                {tab === 'writer' && '✍️'}
                                                {tab === 'generate' && '🎨'}
                                                {tab === 'brand' && '💼'}
                                            </span>
                                            {tab}
                                            {showBadge && <span className="absolute right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* PANEL CONTENT */}
                            <div className="bg-white border border-brand-border rounded-2xl p-6 shadow-xl shadow-gray-200/50 min-h-[400px]">

                                {/* Campaign Manager Moved to separate component */}

                                {/* 2. WRITER */}
                                {activeTab === 'writer' && (
                                    <div className="space-y-6 animate-fadeIn">
                                        <div className="flex justify-between items-end">
                                            <label className="text-xs font-bold text-brand-muted uppercase">Single Tweet Writer</label>
                                            <button onClick={handleGenerateIdeas} disabled={isGeneratingIdeas} className="text-[10px] text-brand-accent hover:text-brand-text font-medium">
                                                {isGeneratingIdeas ? 'Thinking...' : '✨ Suggest Ideas'}
                                            </button>
                                        </div>
                                        {suggestedIdeas.length > 0 && (
                                            <div className="bg-white border border-brand-border rounded-lg overflow-hidden shadow-sm">
                                                {suggestedIdeas.map((idea, idx) => (
                                                    <button key={idx} onClick={() => { setWriterTopic(idea); setSuggestedIdeas([]); }} className="w-full text-left px-3 py-2 text-xs text-brand-text hover:bg-gray-50 border-b border-brand-border last:border-0">{idea}</button>
                                                ))}
                                            </div>
                                        )}
                                        <textarea value={writerTopic} onChange={e => setWriterTopic(e.target.value)} placeholder="Topic..." className="w-full h-24 bg-white border border-brand-border rounded-lg p-3 text-sm text-brand-text focus:border-brand-accent outline-none resize-none shadow-sm" />
                                        <Select label="Tone" value={writerTone} onChange={e => setWriterTone(e.target.value)} options={[{ value: 'Professional', label: 'Professional' }, { value: 'Hype', label: 'Hype' }, { value: 'Casual', label: 'Casual' }]} />
                                        <Button onClick={handleAIWrite} isLoading={isWritingTweet} disabled={!writerTopic} className="w-full">Draft Tweet</Button>
                                    </div>
                                )}

                                {/* 3. GENERATOR */}
                                {activeTab === 'generate' && (
                                    <div className="space-y-6 animate-fadeIn">
                                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                                            <h3 className="text-sm font-bold text-indigo-900 mb-2">Graphic Generator</h3>
                                            <p className="text-xs text-indigo-700">Create visuals that perfectly match your social copy.</p>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">1. Tweet Content (Context)</label>
                                            <textarea
                                                value={tweetText}
                                                onChange={e => setTweetText(e.target.value)}
                                                placeholder="Paste the tweet text here. The AI will analyze the sentiment and topic..."
                                                className="w-full h-24 bg-white border border-brand-border rounded-lg p-3 text-sm text-brand-text focus:border-brand-accent outline-none resize-none shadow-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">2. Visual Direction (Optional)</label>
                                            <input
                                                type="text"
                                                value={visualPrompt}
                                                onChange={e => setVisualPrompt(e.target.value)}
                                                placeholder="e.g. Cyberpunk city, neon green lines, minimal geometric shapes..."
                                                className="w-full bg-white border border-brand-border rounded-lg p-3 text-sm text-brand-text focus:border-brand-accent outline-none shadow-sm"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <Select label="Quantity" value={variationCount} onChange={e => setVariationCount(e.target.value)} options={[{ value: '1', label: '1 Image' }, { value: '2', label: '2 Images' }, { value: '3', label: '3 Images' }, { value: '4', label: '4 Images' }]} />
                                            <Select label="Size" value={size} onChange={e => setSize(e.target.value as any)} options={[{ value: '1K', label: '1K' }, { value: '2K', label: '2K' }, { value: '4K', label: '4K' }]} />
                                            <Select label="Aspect" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} options={[{ value: '16:9', label: '16:9' }, { value: '1:1', label: '1:1' }, { value: '4:5', label: '4:5 (Portrait)' }]} />
                                        </div>

                                        <Button onClick={handleGenerateSingle} isLoading={isGenerating} disabled={!tweetText && !visualPrompt} className="w-full">
                                            Generate {variationCount} Graphic{parseInt(variationCount) > 1 ? 's' : ''}
                                        </Button>
                                    </div>
                                )}

                                {/* 4. BRAND DB */}
                                {activeTab === 'brand' && (
                                    <BrandKit config={profiles[selectedBrand]} brandName={selectedBrand} onChange={handleUpdateCurrentBrandConfig} />
                                )}

                                {error && <div className="mt-4 p-2 bg-red-50 border border-red-200 text-red-600 text-xs rounded">{error}</div>}
                            </div>
                        </div>

                        {/* MAIN DISPLAY AREA */}
                        <div className={`flex-1 bg-white border border-brand-border rounded-2xl relative flex flex-col min-h-[600px] overflow-hidden shadow-sm`}>

                            {/* Subtle background pattern/gradient for light mode */}
                            <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent ${selectedBrand === 'Meme' ? 'via-yellow-400' : 'via-brand-accent'} to-transparent opacity-50`}></div>

                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">

                                {/* VIEW: CAMPAIGN REVIEW (Moved) */}

                                {/* VIEW: CAMPAIGN RESULTS (Moved) */}

                                {/* VIEW: WRITER / GENERATOR OUTPUT */}
                                {(activeTab === 'writer' || activeTab === 'generate') && (
                                    <div className="space-y-6 animate-fadeIn">
                                        {generatedDraft && activeTab === 'writer' && (
                                            <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm">
                                                <h3 className="text-xs font-bold text-brand-muted uppercase mb-4">Draft Result</h3>
                                                <textarea value={generatedDraft} onChange={e => setGeneratedDraft(e.target.value)} className="w-full bg-transparent text-lg font-display text-brand-text border-none resize-none h-32 focus:ring-0 p-0" />
                                                <div className="flex justify-end gap-2 mt-4">
                                                    <Button onClick={() => handleOpenScheduleModal(generatedDraft)} variant="outline" className="text-xs">Schedule</Button>
                                                    <Button onClick={() => { setTweetText(generatedDraft); setActiveTab('generate'); }} className="text-xs">Use in Generator</Button>
                                                    <Button onClick={() => handlePrepareTweet(generatedDraft)} variant="secondary" className="text-xs">Post to X</Button>
                                                </div>
                                            </div>
                                        )}
                                        {generatedImages.length > 0 && activeTab === 'generate' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {generatedImages.map((img, idx) => (
                                                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-brand-border shadow-md cursor-pointer" onClick={() => setViewingImage(img)}>
                                                        <img src={img} className="w-full" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                                            <Button onClick={(e) => { e.stopPropagation(); handleDownload(img, 'gen'); }}>Download</Button>
                                                            <Button onClick={(e) => { e.stopPropagation(); handleOpenScheduleModal(tweetText || 'Scheduled Graphic', img); }} variant="secondary">Schedule</Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {!generatedDraft && generatedImages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full text-brand-muted text-sm space-y-2">
                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
                                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                                <p>Generated content will appear here</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* VIEW: BRAND DB EMPTY STATE */}
                                {activeTab === 'brand' && (
                                    <div className="flex flex-col items-center justify-center h-full text-brand-muted text-sm space-y-2">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                        </div>
                                        <p>Use the left panel to manage brand assets.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
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
