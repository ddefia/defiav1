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
import { ImageSize, AspectRatio, BrandConfig, ReferenceImage, CampaignItem, TrendItem, CalendarEvent, SocialMetrics, StrategyTask, ComputedMetrics, GrowthReport } from './types';

const App: React.FC = () => {
    // Check environment variable first (injected by Vite define)
    const [hasKey, setHasKey] = useState<boolean>(!!process.env.API_KEY);
    const [checkingKey, setCheckingKey] = useState<boolean>(true);
    const [isConnecting, setIsConnecting] = useState<boolean>(false);

    // App Navigation State
    const [appSection, setAppSection] = useState<'studio' | 'growth' | 'pulse' | 'calendar' | 'dashboard'>('dashboard'); // Default to dashboard

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

    // Campaign Workflow State
    const [campaignStep, setCampaignStep] = useState<1 | 2 | 3>(1); // 1: Draft, 2: Approve, 3: Results
    const [campaignType, setCampaignType] = useState<'theme' | 'diverse'>('theme');
    const [campaignTheme, setCampaignTheme] = useState<string>('');
    const [campaignColor, setCampaignColor] = useState<string>('#4F46E5'); // Default Indigo
    const [campaignCount, setCampaignCount] = useState<string>('3');
    const [campaignStartDate, setCampaignStartDate] = useState<string>('');
    const [isDraftingCampaign, setIsDraftingCampaign] = useState<boolean>(false);
    const [campaignItems, setCampaignItems] = useState<CampaignItem[]>([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);

    // UI State
    const [error, setError] = useState<string | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const scheduleFileInputRef = useRef<HTMLInputElement>(null);
    const campaignFileInputRef = useRef<HTMLInputElement>(null);
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

    useEffect(() => { saveBrandProfiles(profiles); }, [profiles]);

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

    // Set default campaign start date to tomorrow
    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setCampaignStartDate(tomorrow.toISOString().split('T')[0]);
    }, []);

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
        setAppSection('studio');
        setActiveTab('calendar');
        setCampaignStep(1);
        setCampaignType('theme');
        setCampaignTheme(`${trend.headline} (Trend Response)`);
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

    const handleCampaignImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !activeUploadId) return;

        const file = files[0];
        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });

            // Update the campaign item
            setCampaignItems(prev => prev.map(item => {
                if (item.id === activeUploadId) {
                    const newImages = [...(item.images || []), base64];
                    return {
                        ...item,
                        images: newImages,
                        status: 'completed',
                        selectedImageIndex: newImages.length - 1 // Auto-select the new upload
                    };
                }
                return item;
            }));

            setActiveUploadId(null);
            if (campaignFileInputRef.current) campaignFileInputRef.current.value = ''; // Reset input
        } catch (err) { console.error("Campaign upload failed", err); }
    };

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

    const handleBatchScheduleCampaign = (items: CampaignItem[]) => {
        let startDateObj = new Date();
        if (campaignStartDate) {
            // Create date from input string to avoid timezone offset issues
            const parts = campaignStartDate.split('-');
            startDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            startDateObj.setDate(startDateObj.getDate() + 1);
        }

        const newEvents: CalendarEvent[] = items.map((item, idx) => {
            const date = new Date(startDateObj);
            date.setDate(startDateObj.getDate() + idx); // Sequential days

            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // Use the selected image, or default to the first one
            const selectedImage = (item.images && item.images.length > 0)
                ? item.images[item.selectedImageIndex ?? 0]
                : undefined;

            return {
                id: `evt-camp-${item.id}`,
                date: dateStr,
                content: item.tweet,
                image: selectedImage,
                platform: 'Twitter',
                status: 'scheduled',
                campaignName: campaignTheme || 'Campaign',
                color: campaignColor // Pass color
            };
        });

        const updatedEvents = [...calendarEvents, ...newEvents];
        setCalendarEvents(updatedEvents);
        saveCalendarEvents(selectedBrand, updatedEvents);

        // Success & Redirect
        alert(`Success! Scheduled ${newEvents.length} posts starting ${campaignStartDate}. Redirecting to Calendar...`);
        setAppSection('calendar');
        setCampaignStep(1); // Reset workflow
        setCampaignItems([]);
    };

    // --- Campaign Workflow ---

    // STEP 1: Draft
    const handleDraftCampaign = async () => {
        if (campaignType === 'theme' && !campaignTheme.trim()) return;

        setIsDraftingCampaign(true);
        setError(null);
        setCampaignItems([]);

        const themeToSend = campaignType === 'diverse' ? 'DIVERSE_MIX_MODE' : campaignTheme;

        try {
            const draftsText = await generateCampaignDrafts(
                themeToSend,
                selectedBrand,
                profiles[selectedBrand],
                parseInt(campaignCount)
            );

            // Parse output
            // Check for color line
            let textToParse = draftsText;
            const colorMatch = textToParse.match(/THEME_COLOR:\s*(#[0-9a-fA-F]{3,6})/i);

            if (colorMatch) {
                setCampaignColor(colorMatch[1]);
                // Remove the color line from the text to be split
                textToParse = textToParse.replace(colorMatch[0], '').trim();
            }

            const splitDrafts = textToParse.split(/---/).map(t => t.trim()).filter(t => t.length > 0);

            const items: CampaignItem[] = splitDrafts.map((txt, i) => ({
                id: `draft-${Date.now()}-${i}`,
                tweet: txt,
                isApproved: true, // Auto-approve initially
                status: 'draft',
                images: [],
                campaignColor: colorMatch ? colorMatch[1] : campaignColor
            }));

            setCampaignItems(items);
            setCampaignStep(2); // Move to Review
        } catch (err) {
            setError("Failed to draft campaign.");
        } finally {
            setIsDraftingCampaign(false);
        }
    };

    // STEP 2: Review Actions
    const handleUpdateDraft = (id: string, newText: string) => {
        setCampaignItems(prev => prev.map(item => item.id === id ? { ...item, tweet: newText } : item));
    };

    const handleToggleApproval = (id: string) => {
        setCampaignItems(prev => prev.map(item => item.id === id ? { ...item, isApproved: !item.isApproved } : item));
    };

    const handleDeleteDraft = (id: string) => {
        setCampaignItems(prev => prev.filter(item => item.id !== id));
    };

    // STEP 3: Generate
    const handleGenerateApproved = async () => {
        const approvedItems = campaignItems.filter(i => i.isApproved);
        if (approvedItems.length === 0) {
            setError("No tweets approved for generation.");
            return;
        }

        setCampaignStep(3); // Move to Results view
        setIsBatchProcessing(true);

        // Mark all approved as pending
        setCampaignItems(prev => prev.map(item => item.isApproved ? { ...item, status: 'pending' } : item));

        const currentConfig = profiles[selectedBrand];

        for (const item of approvedItems) {
            setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'generating' } : p));
            try {
                // Generate 2 images per tweet
                const promises = [
                    generateWeb3Graphic({ prompt: item.tweet, size: '1K', aspectRatio: '16:9', brandConfig: currentConfig, brandName: selectedBrand }),
                    generateWeb3Graphic({ prompt: item.tweet, size: '1K', aspectRatio: '16:9', brandConfig: currentConfig, brandName: selectedBrand })
                ];
                const images = await Promise.all(promises);
                setCampaignItems(prev => prev.map(p => p.id === item.id ? {
                    ...p,
                    status: 'completed',
                    images: images,
                    selectedImageIndex: 0 // Default to first image
                } : p));
            } catch (err) {
                setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error' } : p));
            }
        }
        setIsBatchProcessing(false);
    };

    // STEP 3: REFINE & REGENERATE & SELECT
    const handleUpdateItemArtPrompt = (id: string, prompt: string) => {
        setCampaignItems(prev => prev.map(i => i.id === id ? { ...i, artPrompt: prompt } : i));
    };

    const handleSelectImage = (itemId: string, index: number) => {
        setCampaignItems(prev => prev.map(i => i.id === itemId ? { ...i, selectedImageIndex: index } : i));
    };

    const handleRegenerateItem = async (id: string) => {
        const item = campaignItems.find(i => i.id === id);
        if (!item) return;

        setCampaignItems(prev => prev.map(p => p.id === id ? { ...p, status: 'generating' } : p));

        try {
            const graphicPrompt = item.tweet;
            const visualOverride = item.artPrompt;

            const promises = [
                generateWeb3Graphic({
                    prompt: graphicPrompt,
                    artPrompt: visualOverride,
                    size: '1K',
                    aspectRatio: '16:9',
                    brandConfig: profiles[selectedBrand],
                    brandName: selectedBrand
                }),
                generateWeb3Graphic({
                    prompt: graphicPrompt,
                    artPrompt: visualOverride,
                    size: '1K',
                    aspectRatio: '16:9',
                    brandConfig: profiles[selectedBrand],
                    brandName: selectedBrand
                })
            ];
            const images = await Promise.all(promises);
            setCampaignItems(prev => prev.map(p => p.id === id ? { ...p, status: 'completed', images: images, selectedImageIndex: 0 } : p));
        } catch (err) {
            setCampaignItems(prev => prev.map(p => p.id === id ? { ...p, status: 'error' } : p));
        }
    };

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

    // Helpers for Campaign UI
    const approvedCount = campaignItems.filter(i => i.isApproved).length;

    if (checkingKey) return <div className="min-h-screen bg-white flex items-center justify-center text-brand-text">Loading Defia Studio...</div>;
    if (!hasKey) return (
        <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-4xl text-brand-text font-display font-bold mb-4 tracking-tight">Defia Studio</h1>
            <p className="text-brand-muted mb-8">Professional Web3 Content & Growth Intelligence</p>
            <Button onClick={handleConnectKey} isLoading={isConnecting}>Connect API Key</Button>
        </div>
    );

    return (
        <div className="min-h-screen bg-brand-bg text-brand-text font-sans flex flex-col">
            {/* HEADER */}
            <header className="border-b border-brand-border bg-white/80 backdrop-blur sticky top-0 z-40 h-16 flex items-center px-6 justify-between shadow-sm">
                <div className="flex items-center gap-6">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-text flex items-center justify-center text-white font-bold text-xl font-display">D</div>
                        <span className="font-display font-bold text-xl text-brand-text tracking-tight hidden sm:inline">Defia <span className="text-brand-muted text-sm font-normal">Studio</span></span>
                    </div>

                    {/* Top Level Navigation */}
                    <nav className="flex items-center gap-1 bg-gray-100/70 p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={() => { console.log('Navigating to Dashboard'); setAppSection('dashboard'); }}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${appSection === 'dashboard' ? 'bg-white text-brand-text shadow-sm border border-brand-border' : 'text-brand-muted hover:text-brand-text'}`}
                        >
                            🏠 Dashboard
                        </button>
                        <button
                            onClick={() => setAppSection('studio')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${appSection === 'studio' ? 'bg-white text-brand-text shadow-sm border border-brand-border' : 'text-brand-muted hover:text-brand-text'}`}
                        >
                            Studio
                        </button>
                        <button
                            onClick={() => setAppSection('pulse')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${appSection === 'pulse' ? 'bg-white text-brand-accent shadow-sm border border-brand-border' : 'text-brand-muted hover:text-brand-text'}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${appSection === 'pulse' ? 'bg-brand-accent animate-pulse' : 'bg-gray-400'}`}></span>
                            Pulse
                        </button>
                        <button
                            onClick={() => setAppSection('growth')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${appSection === 'growth' ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-brand-muted hover:text-brand-text'}`}
                        >
                            Growth & Strategy
                        </button>
                        <button
                            onClick={() => setAppSection('calendar')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${appSection === 'calendar' ? 'bg-white text-green-700 shadow-sm border border-green-100' : 'text-brand-muted hover:text-brand-text'}`}
                        >
                            Calendar
                        </button>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    {/* Brand Selector (Global) */}
                    <div className="flex bg-gray-100 rounded-lg p-1 border border-brand-border overflow-x-auto max-w-[400px] scrollbar-hide">
                        {Object.keys(profiles).map(b => (
                            <button
                                key={b}
                                onClick={() => setSelectedBrand(b)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${selectedBrand === b ? 'bg-white text-brand-text shadow-sm' : 'text-brand-muted hover:text-brand-text'}`}
                            >
                                {b}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowOnboarding(true)}
                            className="px-3 py-1.5 text-xs font-bold rounded-md text-brand-accent hover:bg-indigo-100 transition-colors whitespace-nowrap"
                        >
                            + Connect
                        </button>
                    </div>
                    <button onClick={handleConnectKey} className="text-xs text-brand-muted hover:text-brand-text transition-colors">API Connected</button>
                </div>
            </header>

            <main className="flex-1 w-full h-full p-6 flex flex-col relative overflow-auto">

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

                {/* SECTION: STUDIO TOOLS */}
                {appSection === 'studio' && selectedBrand && profiles[selectedBrand] && (
                    <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6">

                        {/* SIDEBAR */}
                        <div className="w-full lg:w-[400px] flex flex-col gap-4">

                            {/* Navigation */}
                            <div className="bg-white border border-brand-border rounded-xl p-2 shadow-sm flex flex-col gap-1">
                                {['calendar', 'writer', 'generate', 'brand'].map(tab => {
                                    const showBadge = tab === 'brand' && (!profiles[selectedBrand].referenceImages || profiles[selectedBrand].referenceImages.length === 0);
                                    return (
                                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`relative w-full text-left px-4 py-3 text-sm font-medium rounded-lg capitalize transition-colors flex items-center gap-3 ${activeTab === tab ? 'bg-gray-100 text-brand-text font-semibold' : 'text-brand-muted hover:bg-gray-50'}`}>
                                            <span className="opacity-50">
                                                {tab === 'calendar' && '📅'}
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

                                {/* 1. CAMPAIGN MANAGER */}
                                {activeTab === 'calendar' && (
                                    <div className="space-y-6 animate-fadeIn">
                                        <div className="border-l-2 border-brand-accent pl-3">
                                            <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider">Campaign Manager</h3>
                                            <p className="text-xs text-brand-muted">Workflow: Draft &rarr; Review &rarr; Generate</p>
                                        </div>

                                        {/* Status Indicator */}
                                        <div className="flex items-center justify-between px-2">
                                            <div className={`flex flex-col items-center ${campaignStep >= 1 ? 'text-brand-accent' : 'text-gray-300'}`}>
                                                <div className="w-2 h-2 rounded-full bg-current mb-1" />
                                                <span className="text-[10px] font-bold">DRAFT</span>
                                            </div>
                                            <div className={`h-[1px] flex-1 mx-2 ${campaignStep >= 2 ? 'bg-brand-accent' : 'bg-gray-200'}`} />
                                            <div className={`flex flex-col items-center ${campaignStep >= 2 ? 'text-brand-accent' : 'text-gray-300'}`}>
                                                <div className="w-2 h-2 rounded-full bg-current mb-1" />
                                                <span className="text-[10px] font-bold">REVIEW</span>
                                            </div>
                                            <div className={`h-[1px] flex-1 mx-2 ${campaignStep >= 3 ? 'bg-brand-accent' : 'bg-gray-200'}`} />
                                            <div className={`flex flex-col items-center ${campaignStep >= 3 ? 'text-brand-accent' : 'text-gray-300'}`}>
                                                <div className="w-2 h-2 rounded-full bg-current mb-1" />
                                                <span className="text-[10px] font-bold">DONE</span>
                                            </div>
                                        </div>

                                        {campaignStep === 1 && (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-brand-muted uppercase mb-2 block">Campaign Type</label>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setCampaignType('theme')}
                                                            className={`flex-1 py-2 text-xs rounded border ${campaignType === 'theme' ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text border-brand-border'}`}
                                                        >
                                                            Specific Theme
                                                        </button>
                                                        <button
                                                            onClick={() => setCampaignType('diverse')}
                                                            className={`flex-1 py-2 text-xs rounded border ${campaignType === 'diverse' ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text border-brand-border'}`}
                                                        >
                                                            Diverse Mix
                                                        </button>
                                                    </div>
                                                </div>

                                                {campaignType === 'theme' ? (
                                                    <div>
                                                        <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Campaign Theme</label>
                                                        <input
                                                            type="text"
                                                            value={campaignTheme}
                                                            onChange={e => setCampaignTheme(e.target.value)}
                                                            placeholder="e.g. Protocol v2 Launch Week"
                                                            className="w-full bg-white border border-brand-border rounded-lg p-3 text-sm text-brand-text focus:border-brand-accent outline-none shadow-sm"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-800">
                                                        <p className="font-bold mb-1">Diverse Mix Mode</p>
                                                        The AI will automatically generate a balanced week of content covering Education, Community, Market Insights, and Product Updates.
                                                    </div>
                                                )}

                                                <Select label="Tweet Count" value={campaignCount} onChange={e => setCampaignCount(e.target.value)} options={[{ value: '3', label: '3 Tweets' }, { value: '5', label: '5 Tweets' }, { value: '7', label: '7 Tweets' }]} />
                                                <Button onClick={handleDraftCampaign} isLoading={isDraftingCampaign} disabled={campaignType === 'theme' && !campaignTheme} className="w-full shadow-lg shadow-indigo-500/20">
                                                    {campaignType === 'diverse' ? 'Generate Mix' : 'Draft Campaign'}
                                                </Button>
                                            </div>
                                        )}

                                        {campaignStep === 2 && (
                                            <div className="space-y-4">
                                                <div className="text-center">
                                                    <p className="text-sm text-brand-text font-semibold">{campaignItems.length} Drafts Generated</p>
                                                    <p className="text-xs text-brand-muted">Review text on the right panel.</p>
                                                </div>
                                                <div className="p-3 bg-gray-50 rounded-lg border border-brand-border">
                                                    <div className="flex justify-between text-xs text-brand-muted mb-2">
                                                        <span>Approved Tweets:</span>
                                                        <span className="text-green-600 font-bold">{approvedCount}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-brand-muted">
                                                        <span>Estimated Output:</span>
                                                        <span className="text-brand-accent font-bold">{approvedCount * 2} Images</span>
                                                    </div>
                                                </div>
                                                <Button onClick={handleGenerateApproved} className="w-full bg-brand-text text-white hover:bg-black">
                                                    Generate {approvedCount * 2} Assets
                                                </Button>
                                                <button onClick={() => setCampaignStep(1)} className="w-full text-xs text-brand-muted hover:text-brand-text py-2">Back to Draft</button>
                                            </div>
                                        )}

                                        {campaignStep === 3 && (
                                            <div className="space-y-4 text-center">
                                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                                <p className="text-sm text-brand-text font-medium">Production Complete</p>

                                                {/* NEW: Scheduling Configuration Block */}
                                                <div className="bg-gray-50 border border-brand-border rounded-lg p-3 text-left">
                                                    <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Campaign Start Date</label>
                                                    <input
                                                        type="date"
                                                        value={campaignStartDate}
                                                        onChange={(e) => setCampaignStartDate(e.target.value)}
                                                        className="w-full border border-brand-border rounded p-2 text-sm focus:border-brand-accent outline-none bg-white"
                                                    />
                                                    <p className="text-[10px] text-brand-muted mt-2">
                                                        Posts will be scheduled sequentially starting from this date.
                                                    </p>
                                                </div>

                                                <Button onClick={() => handleBatchScheduleCampaign(campaignItems.filter(i => i.isApproved))} className="w-full text-xs bg-indigo-600 hover:bg-indigo-700">
                                                    Approve & Schedule All to Calendar
                                                </Button>
                                                <Button onClick={() => setCampaignStep(1)} variant="secondary" className="w-full text-xs mt-2">Start New Campaign</Button>
                                            </div>
                                        )}
                                    </div>
                                )}

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

                                {/* VIEW: CAMPAIGN REVIEW (STEP 2) */}
                                {activeTab === 'calendar' && campaignStep === 2 && (
                                    <div className="space-y-4 animate-fadeIn">
                                        <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-xl font-display font-bold text-brand-text">Review Drafts</h2>
                                            {/* Color Picker */}
                                            <div className="flex items-center gap-2 bg-white/50 px-2 py-1 rounded-lg border border-brand-border/50">
                                                <label className="text-[10px] font-bold text-brand-muted uppercase">Campaign Color</label>
                                                <input
                                                    type="color"
                                                    value={campaignColor}
                                                    onChange={(e) => setCampaignColor(e.target.value)}
                                                    className="w-5 h-5 rounded cursor-pointer border-none bg-transparent"
                                                />
                                            </div>
                                        </div>
                                        {campaignItems.map((item, idx) => (
                                            <div key={item.id} className={`p-4 rounded-xl border transition-all shadow-sm ${item.isApproved ? 'bg-white border-brand-border opacity-100' : 'bg-gray-100 border-transparent opacity-60'}`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className="text-xs font-mono text-brand-muted">#{idx + 1}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleDeleteDraft(item.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                                                        <button
                                                            onClick={() => handleToggleApproval(item.id)}
                                                            className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${item.isApproved ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                                        >
                                                            {item.isApproved ? 'Approved' : 'Discarded'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    value={item.tweet}
                                                    onChange={(e) => handleUpdateDraft(item.id, e.target.value)}
                                                    className="w-full bg-transparent border-none focus:ring-0 text-sm text-brand-text resize-none p-0 h-auto min-h-[120px]"
                                                />
                                                {item.isApproved && (
                                                    <div className="mt-2 pt-2 border-t border-brand-border flex justify-end">
                                                        <span className="text-[10px] text-brand-accent font-medium">Will generate 2 images</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* VIEW: CAMPAIGN RESULTS (STEP 3) */}
                                {activeTab === 'calendar' && campaignStep === 3 && (
                                    <div className="space-y-8 animate-fadeIn">
                                        <div className="flex justify-between items-center">
                                            <h2 className="text-xl font-display font-bold text-brand-text">Campaign Assets</h2>
                                            {isBatchProcessing && <span className="text-xs text-brand-accent animate-pulse font-medium">Generating Graphics...</span>}
                                        </div>
                                        {campaignItems.filter(i => i.isApproved).map((item, idx) => (
                                            <div key={item.id} className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
                                                {/* Edit / Refine Section */}
                                                <div className="p-4 border-b border-brand-border bg-gray-50">
                                                    <div className="flex justify-between gap-4 mb-2">
                                                        <textarea
                                                            value={item.tweet}
                                                            onChange={e => handleUpdateDraft(item.id, e.target.value)}
                                                            className="bg-transparent border-none p-0 text-sm text-brand-text w-full resize-none focus:ring-0 min-h-[60px]"
                                                            rows={3}
                                                        />
                                                        <Button onClick={() => handlePrepareTweet(item.tweet)} variant="secondary" className="h-8 text-xs py-0 whitespace-nowrap">Post</Button>
                                                    </div>
                                                    {/* Visual Refinement Input */}
                                                    <div className="flex gap-2 items-center mt-2 border-t border-gray-200 pt-2">
                                                        <span className="text-[10px] font-bold text-brand-muted uppercase whitespace-nowrap">Visual Direction:</span>
                                                        <input
                                                            type="text"
                                                            value={item.artPrompt || ''}
                                                            onChange={e => handleUpdateItemArtPrompt(item.id, e.target.value)}
                                                            placeholder="e.g. Make it darker, add a neon cat, change color to purple..."
                                                            className="flex-1 bg-white border border-brand-border rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-accent"
                                                        />
                                                        <Button
                                                            onClick={() => handleRegenerateItem(item.id)}
                                                            className="h-7 text-[10px] px-3 py-0"
                                                            isLoading={item.status === 'generating'}
                                                        >
                                                            Regenerate
                                                        </Button>
                                                        <Button
                                                            onClick={() => { setActiveUploadId(item.id); campaignFileInputRef.current?.click(); }}
                                                            variant="secondary"
                                                            className="h-7 text-[10px] px-3 py-0 flex items-center gap-1"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                            Upload
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="p-4 grid grid-cols-2 gap-4">
                                                    {item.status === 'generating' && <div className="col-span-2 py-12 flex flex-col items-center justify-center text-xs text-brand-muted animate-pulse">
                                                        <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mb-2"></div>
                                                        Generating New Visuals...
                                                    </div>}
                                                    {item.status === 'pending' && <div className="col-span-2 py-8 text-center text-xs text-brand-muted">Queued</div>}
                                                    {item.status === 'error' && <div className="col-span-2 py-8 text-center text-xs text-red-500">Generation Failed</div>}
                                                    {item.status === 'completed' && item.images.map((img, i) => (
                                                        <div
                                                            key={i}
                                                            className={`relative group cursor-pointer rounded-lg overflow-hidden shadow-sm transition-all border-2
                                                    ${item.selectedImageIndex === i ? 'border-green-500 ring-2 ring-green-100' : 'border-brand-border hover:border-gray-300'}
                                                `}
                                                            onClick={() => handleSelectImage(item.id, i)}
                                                        >
                                                            <img src={img} className="w-full" />

                                                            {/* Selection Overlay */}
                                                            {item.selectedImageIndex === i && (
                                                                <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                                    Selected
                                                                </div>
                                                            )}

                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                <Button onClick={(e) => { e.stopPropagation(); setViewingImage(img); }} className="text-xs py-1 h-8" variant="secondary">View</Button>
                                                                <Button onClick={(e) => { e.stopPropagation(); handleDownload(img, 'camp'); }} className="text-xs py-1 h-8">Save</Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="px-4 pb-2 text-center text-[10px] text-brand-muted">
                                                    Select the image you want to schedule with the tweet.
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

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
                                        {!generatedDraft && generatedImages.length === 0 && campaignStep === 1 && (
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
                <input type="file" ref={campaignFileInputRef} onChange={handleCampaignImageUpload} accept="image/*" className="hidden" />

            </main>
        </div>
    );
};

export default App;
