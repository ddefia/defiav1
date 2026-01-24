import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import ReactMarkdown from 'react-markdown';
import { generateWeb3Graphic, generateCampaignDrafts, generateCampaignStrategy, analyzeContentNotes } from '../services/gemini';
import { getBrainContext } from '../services/pulse'; // New Import
import { dispatchThinking } from './ThinkingConsole';

import { saveCalendarEvents, saveCampaignState, loadCampaignState, loadBrainLogs } from '../services/storage';
import { saveBrainMemory } from '../services/supabase'; // History Sync
import { BrandConfig, CampaignItem, CalendarEvent, CampaignStrategy } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CampaignsProps {
    brandName: string;
    brandConfig: BrandConfig;
    events: CalendarEvent[];
    onUpdateEvents: (events: CalendarEvent[]) => void;
    initialIntent?: { type: 'theme' | 'diverse', theme: string } | null;
    onClearIntent?: () => void;
    recentPosts?: any[]; // New Prop
}

export const Campaigns: React.FC<CampaignsProps> = ({
    brandName,
    brandConfig,
    events,
    onUpdateEvents,
    initialIntent,
    onClearIntent,
    recentPosts = [] // New Prop with default
}) => {
    // View State: 'list' | 'wizard'
    const [viewMode, setViewMode] = useState<'list' | 'wizard'>('list');
    const [promptProvenance, setPromptProvenance] = useState<string>('Manual Creation');
    const [showBrief, setShowBrief] = useState<boolean>(false);

    // Wizard State
    const [campaignStep, setCampaignStep] = useState<1 | 2 | 3 | 4>(1); // 1: Config, 2: Strategy, 3: Drafts, 4: Assets
    const [campaignType, setCampaignType] = useState<'theme' | 'diverse' | 'notes'>('theme');
    const [campaignTheme, setCampaignTheme] = useState<string>('');
    const [campaignGoal, setCampaignGoal] = useState<string>('User Acquisition'); // NEW
    const [campaignPlatforms, setCampaignPlatforms] = useState<string[]>(['Twitter']); // NEW
    const [campaignContext, setCampaignContext] = useState<string>(''); // NEW
    const [campaignStrategy, setCampaignStrategy] = useState<CampaignStrategy | null>(null); // NEW
    const [contentPlan, setContentPlan] = useState<any>(null); // NEW for Smart Plan

    // Graphic Settings
    const [campaignTemplate, setCampaignTemplate] = useState<string>('');
    const [campaignReferenceImage, setCampaignReferenceImage] = useState<string | null>(null);

    // Focus Document State
    const [campaignFocusDoc, setCampaignFocusDoc] = useState<string>('');
    const [isUploadingFocusDoc, setIsUploadingFocusDoc] = useState<boolean>(false);
    const focusDocInputRef = useRef<HTMLInputElement>(null);


    const [activeTab, setActiveTab] = useState<'wizard' | 'list'>('list');
    const [wizardStep, setWizardStep] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedStrategy, setGeneratedStrategy] = useState<any>(null); // Store content plan
    const [draftContext, setDraftContext] = useState<string>(""); // Store AI Thinking
    const [batchProgress, setBatchProgress] = useState<string>(""); // NEW: Batch Progress Indicator

    // Quick Mode State
    const [campaignCount, setCampaignCount] = useState<string>('3');
    const [campaignStartDate, setCampaignStartDate] = useState<string>('');
    const [isDraftingCampaign, setIsDraftingCampaign] = useState<boolean>(false);
    const [isGeneratingStrategy, setIsGeneratingStrategy] = useState<boolean>(false); // NEW
    const [campaignItems, setCampaignItems] = useState<CampaignItem[]>([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
    const [analyzingCampaign, setAnalyzingCampaign] = useState<string | null>(null); // New State
    const [viewingCampaignDetails, setViewingCampaignDetails] = useState<string | null>(null); // New State for Thinking View
    // Track what the AI actually analyzed for transparency
    const [contextStats, setContextStats] = useState<{ activeCampaignsCount: number, brainMemoriesCount: number, strategyDocsCount?: number } | null>(null);

    // --- PERSISTENCE ---
    // Load state on mount
    useEffect(() => {
        const saved = loadCampaignState(brandName);
        if (saved) {
            if (saved.viewMode) setViewMode(saved.viewMode);
            if (saved.campaignStep) setCampaignStep(saved.campaignStep);
            if (saved.campaignType) setCampaignType(saved.campaignType);
            if (saved.campaignTheme) setCampaignTheme(saved.campaignTheme);
            if (saved.campaignGoal) setCampaignGoal(saved.campaignGoal);
            if (saved.campaignPlatforms) setCampaignPlatforms(saved.campaignPlatforms);
            if (saved.campaignGoal) setCampaignGoal(saved.campaignGoal);
            if (saved.campaignPlatforms) setCampaignPlatforms(saved.campaignPlatforms);
            if (saved.campaignStrategy) setCampaignStrategy(saved.campaignStrategy);
            if (saved.campaignTemplate) setCampaignTemplate(saved.campaignTemplate);
            if (saved.campaignReferenceImage) setCampaignReferenceImage(saved.campaignReferenceImage);
            if (saved.campaignItems) setCampaignItems(saved.campaignItems);
            if (saved.campaignStartDate) setCampaignStartDate(saved.campaignStartDate);
            if (saved.contentPlan) setContentPlan(saved.contentPlan);
        }
    }, [brandName]);

    // Save state on change
    useEffect(() => {
        const stateToSave = {
            viewMode,
            campaignStep,
            campaignType,
            campaignTheme,
            campaignGoal,
            campaignPlatforms,
            campaignContext,
            campaignStrategy,
            campaignTemplate,
            campaignReferenceImage,
            campaignItems,
            campaignStartDate,
            contentPlan
        };
        // Debounce slightly or just save (localStorage is fast)
        const timeout = setTimeout(() => {
            saveCampaignState(brandName, stateToSave);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [viewMode, campaignStep, campaignType, campaignTheme, campaignGoal, campaignPlatforms, campaignStrategy, campaignTemplate, campaignReferenceImage, campaignItems, campaignStartDate, contentPlan, brandName]);

    // --- Helpers ---

    // Helpers for Strategy Editing
    const updateStrategyField = (field: keyof CampaignStrategy, value: any) => {
        if (!campaignStrategy) return;
        setCampaignStrategy({ ...campaignStrategy, [field]: value });
    };

    const updateChannelStrategy = (index: number, field: string, value: string) => {
        if (!campaignStrategy) return;
        const newChannels = [...campaignStrategy.channelStrategy];
        newChannels[index] = { ...newChannels[index], [field]: value };
        setCampaignStrategy({ ...campaignStrategy, channelStrategy: newChannels });
    };

    // UI State
    const [error, setError] = useState<string | null>(null);
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const campaignFileInputRef = useRef<HTMLInputElement>(null);

    // Initial Intent Handling (from Pulse)
    useEffect(() => {
        if (initialIntent) {
            setPromptProvenance('Action Center Recommendation');
            setViewMode('wizard');
            setCampaignStep(1);
            setCampaignType(initialIntent.type);
            setCampaignTheme(initialIntent.theme);
            if (onClearIntent) onClearIntent();
        }
    }, [initialIntent, onClearIntent]);

    // Set default start date
    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setCampaignStartDate(tomorrow.toISOString().split('T')[0]);
    }, []);

    // --- Helpers ---
    const getActiveCampaigns = () => {
        const campaigns: Record<string, { count: number, nextDate: string, status: string }> = {};

        events.forEach(e => {
            if (e.campaignName) {
                if (!campaigns[e.campaignName]) {
                    campaigns[e.campaignName] = { count: 0, nextDate: e.date, status: 'Active' };
                }
                campaigns[e.campaignName].count++;
                if (new Date(e.date) > new Date(campaigns[e.campaignName].nextDate)) {
                    campaigns[e.campaignName].nextDate = e.date;
                }
            }
        });
        return Object.entries(campaigns).map(([name, data]) => ({ name, ...data }));
    };

    // --- Actions ---

    // STEP 1 Action: Generate Strategy (OR Direct Draft for Notes)
    const handleGenerateStrategy = async () => {
        if (campaignType === 'theme' && !campaignTheme.trim()) return;

        dispatchThinking("Analyzing Campaign Context...", {
            goal: campaignGoal,
            type: campaignType,
            theme: campaignTheme,
            docProvided: !!campaignFocusDoc
        });

        setIsGeneratingStrategy(true);
        setError(null);
        setDraftContext(""); // Clear old context to prevent "JSON Generation Successful" from showing


        try {
            // FAST TRACK FOR NOTES: Analyze -> Drafts (Skip Strategy Brief)
            if (campaignType === 'notes') {
                const plan = await analyzeContentNotes(campaignContext, brandName);
                if (!plan) throw new Error("Could not analyze notes");

                setContentPlan(plan);
                const planTheme = plan.theme || "Smart Content Plan";
                setCampaignTheme(planTheme);

                // Immediately Generate Drafts
                const result = await generateCampaignDrafts(
                    planTheme,
                    brandName,
                    brandConfig,
                    parseInt(campaignCount), // Use User Count
                    plan, // Pass the plan
                    "", // Focus Content (none)
                    [] // Recent Posts (none for notes mode)
                );

                setDraftContext(result.thinking); // Capture thinking

                // Prevent AI from overwriting the Theme Color randomly. User wants stability.
                // if (result.themeColor) {
                //    setCampaignColor(result.themeColor);
                // }

                const items: CampaignItem[] = result.drafts.map((d: any, i: number) => {
                    // SMART TEMPLATE RESOLUTION
                    // Analyze content and theme to pick the best strict template if AI defaults.
                    let resolvedTemplate = d.template || campaignTemplate;

                    if (brandConfig.graphicTemplates && brandConfig.graphicTemplates.length > 0) {
                        // Helper Logic (Inline for now to access brandConfig easily)
                        const lowerTweet = (d.tweet || '').toLowerCase();
                        const lowerTheme = (planTheme || '').toLowerCase();
                        let smartMatch = null;

                        // 1. Check for Quote Signals
                        if (lowerTweet.includes('"') || lowerTweet.includes('said') || lowerTweet.includes(' says') || lowerTweet.includes('- ')) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                t.label.toLowerCase().includes('quote') ||
                                (t.category || '').toLowerCase().includes('community')
                            );
                        }

                        // 2. Check for Deepdive/Education Signals
                        if (!smartMatch && (lowerTweet.includes('thread') || lowerTweet.includes('👇') || lowerTweet.includes('1/') || lowerTweet.includes('breakdown'))) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                t.label.toLowerCase().includes('deepdive') ||
                                t.label.toLowerCase().includes('header') ||
                                (t.category || '').toLowerCase().includes('education')
                            );
                        }

                        // 3. Fallback to Theme Match
                        if (!smartMatch) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                lowerTheme.includes(t.label.toLowerCase()) ||
                                lowerTheme.includes((t.category || '').toLowerCase())
                            );
                        }

                        // Apply Smart Match or Fallback to First (Strict Mode) if AI failed
                        // Apply Smart Match or Allow Auto (Undefined)
                        if (!resolvedTemplate || !brandConfig.graphicTemplates.some(t => t.label === resolvedTemplate)) {
                            resolvedTemplate = smartMatch ? smartMatch.label : undefined;
                        }
                    }

                    return {
                        id: `draft-${Date.now()}-${i}`,
                        tweet: d.tweet,
                        isApproved: true,
                        status: 'draft',
                        images: [],
                        campaignColor: undefined,
                        template: resolvedTemplate,
                        reasoning: d.reasoning
                    };
                });

                setCampaignItems(items);
                setCampaignStep(3); // Jump straight to drafts
                setIsGeneratingStrategy(false);
                return;
            }

            // ... STANDARD FLOW FOR CAMPAIGNS ...

            // CONTEXT 1: Active Campaigns & CONTENT
            // Instead of just names, get the actual upcoming content to prevent collision
            const activeCampaignsData = getActiveCampaigns();
            const activeContext = activeCampaignsData.map(c => {
                // Get first 3 scheduled posts for this campaign to give AI flavor
                const campaignPosts = events
                    .filter(e => e.campaignName === c.name && new Date(e.date) >= new Date())
                    .slice(0, 3)
                    .map(e => `[${e.date}] ${e.content.substring(0, 50)}...`)
                    .join(' | ');
                return `CAMPAIGN: ${c.name} (${c.status})\n   UPCOMING: ${campaignPosts || "No upcoming posts scheduled."}`;
            });

            // CONTEXT 2: Brain Memory
            // Fetch recent strategic decisions to maintain consistency
            const brainLogs = loadBrainLogs(brandName);
            const recentLogs = brainLogs.slice(0, 5).map(l => `[${new Date(l.timestamp).toLocaleDateString()}] ${l.type}: ${l.context}`).join('\n');

            // CONTEXT 3: DEEP RAG (Supabase)
            const { context: ragContext, strategyCount, memoryCount } = await getBrainContext(brandName);

            // UPDATE UI STATS FOR TRANSPARENCY
            setContextStats({
                activeCampaignsCount: activeCampaignsData.length,
                brainMemoriesCount: memoryCount,
                strategyDocsCount: strategyCount // Need to add to Type or just ignore type error for now? state is any?
            });

            const strategy = await generateCampaignStrategy(
                campaignGoal,
                campaignType === 'theme' ? campaignTheme : 'Diverse Content Mix',
                campaignPlatforms,
                campaignContext,
                activeContext,
                brandName,
                brandConfig,
                recentLogs, // History
                campaignFocusDoc, // Focus Doc
                ragContext // Deep Context from Supabase
            );
            setCampaignStrategy(strategy);
            setCampaignStep(2); // Move to Strategy View
        } catch (err) {
            console.error(err);
            console.error(err);
            setError(`Failed to generate strategy: ${(err as Error).message}`);
            dispatchThinking("Strategy Generation Failed", { error: (err as Error).message });
        } finally {
            setIsGeneratingStrategy(false);
        }
    };

    // STEP 2 Action: Approve Strategy & Draft
    const handleDraftCampaign = async () => {
        setIsDraftingCampaign(true);
        setError(null);
        setCampaignItems([]);

        const themeToSend = campaignType === 'diverse' ? 'DIVERSE_MIX_MODE' : campaignTheme;
        const totalCount = parseInt(campaignCount);
        const BATCH_SIZE = 10;

        try {
            const allItems: CampaignItem[] = [];
            const batches = Math.ceil(totalCount / BATCH_SIZE);

            for (let b = 0; b < batches; b++) {
                const countForBatch = Math.min(BATCH_SIZE, totalCount - (b * BATCH_SIZE));
                const batchLabel = `Batch ${b + 1}/${batches}`;
                console.log(`Generating ${batchLabel}...`);
                setBatchProgress(`Drafting ${batchLabel} (${allItems.length} generated so far)...`);

                // Pass strategy context to drafting if available
                const enhancedTheme = themeToSend;

                // Create a "Strategy Document" from the object to force strict adherence
                const strategyDoc = campaignStrategy ? `
                GENERATED CAMPAIGN STRATEGY (STRICTLY ADHERE TO THIS):
                Target Audience: ${campaignStrategy.targetAudience}
                Strategic Rationale: ${campaignStrategy.strategicRationale}
                Key Messaging Pillars:
                ${campaignStrategy.keyMessaging.map(m => `- ${m}`).join('\n')}
                ` : "";

                const effectiveFocusContent = `${campaignFocusDoc}\n\n${strategyDoc}`.trim();

                // GENERATION CALL
                const result = await generateCampaignDrafts(
                    enhancedTheme,
                    brandName,
                    brandConfig,
                    countForBatch,
                    undefined, // No content plan for quick mode
                    effectiveFocusContent, // Pass Strategy as Focus Doc
                    recentPosts
                );

                if (!result.drafts || result.drafts.length === 0) {
                    console.warn(`Batch ${b + 1} failed to return drafts.`);
                    // Continue to next batch instead of breaking whole flow, but alert if all fail
                }

                if (b === 0) setDraftContext(result.thinking); // 🧠 Set Brain Thinking Logic from first batch

                // JSON Handling


                const batchItems: CampaignItem[] = result.drafts.map((d: any, i: number) => {
                    // SMART TEMPLATE RESOLUTION
                    // Analyze content and theme to pick the best strict template if AI defaults.
                    let resolvedTemplate = d.template || campaignTemplate;

                    if (brandConfig.graphicTemplates && brandConfig.graphicTemplates.length > 0) {
                        // Helper Logic
                        const lowerTweet = (d.tweet || '').toLowerCase();
                        const lowerTheme = (enhancedTheme || '').toLowerCase();
                        let smartMatch = null;

                        // 1. Check for Quote Signals (STRICTER)
                        // Only trigger if it looks like a person speaking, avoiding bullet points or simple emphasis
                        if (lowerTweet.includes(' stated:') || lowerTweet.includes(' announced:') || lowerTweet.match(/"\s+-\s+[a-z]+/i)) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                t.label.toLowerCase().includes('quote') ||
                                (t.category || '').toLowerCase().includes('community')
                            );
                        }

                        // 2. Check for Deepdive/Education Signals
                        if (!smartMatch && (lowerTweet.includes('thread') || lowerTweet.includes('👇') || lowerTweet.includes('1/') || lowerTweet.includes('breakdown'))) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                t.label.toLowerCase().includes('deepdive') ||
                                t.label.toLowerCase().includes('header') ||
                                (t.category || '').toLowerCase().includes('education')
                            );
                        }

                        // 3. Fallback to Theme Match
                        if (!smartMatch) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                lowerTheme.includes(t.label.toLowerCase()) ||
                                lowerTheme.includes((t.category || '').toLowerCase())
                            );
                        }

                        // Apply Smart Match or Fallback to First (Strict Mode) if AI failed
                        // Apply Smart Match or Allow Auto (Undefined)
                        if (!resolvedTemplate || !brandConfig.graphicTemplates.some(t => t.label === resolvedTemplate)) {
                            resolvedTemplate = smartMatch ? smartMatch.label : undefined;
                        }
                    }

                    // RESOLVE REFERENCE IMAGE FROM TEMPLATE
                    // If AI left ref ID blank (because it respected our "Use Template Images" rule),
                    // we must now pick one of the template's images to assign to this draft.
                    let finalRefId = d.referenceImageId;
                    if (!finalRefId && resolvedTemplate) {
                        const tmplObj = brandConfig.graphicTemplates?.find(t => t.label === resolvedTemplate);
                        if (tmplObj && tmplObj.referenceImageIds && tmplObj.referenceImageIds.length > 0) {
                            // Pick one randomly (User: "what decides" -> Code decides here)
                            finalRefId = tmplObj.referenceImageIds[Math.floor(Math.random() * tmplObj.referenceImageIds.length)];
                        }
                    }

                    return {
                        id: `draft-${Date.now()}-${b}-${i}`,
                        tweet: d.tweet,
                        isApproved: true,
                        status: 'draft',
                        images: [],
                        campaignColor: undefined,
                        template: resolvedTemplate,
                        reasoning: d.reasoning, // New transparency field
                        visualHeadline: d.visualHeadline, // AI suggested headline
                        artPrompt: d.visualDescription, // Map AI Description to Art Prompt
                        referenceImageId: finalRefId // Explicitly map the Reference Image ID chosen by AI or Template
                    };
                });

                allItems.push(...batchItems);
                // Update specific items state progressively so user sees progress
                setCampaignItems(prev => [...prev, ...batchItems]);
            }

            if (allItems.length === 0) {
                throw new Error("No drafts were generated. Please check API limits or try a smaller batch.");
            }

            setCampaignStep(3); // Move to Review
        } catch (err) {
            setError(`Failed to draft campaign. ${(err as Error).message}`);
            console.error(err);
        } finally {
            setIsDraftingCampaign(false);
            setBatchProgress("");
        }
    };

    const handleUpdateDraft = (id: string, newText: string) => {
        setCampaignItems(prev => prev.map(item => item.id === id ? { ...item, tweet: newText } : item));
    };

    const handleToggleApproval = (id: string) => {
        setCampaignItems(prev => prev.map(item => item.id === id ? { ...item, isApproved: !item.isApproved } : item));
    };

    const handleDeleteDraft = (id: string) => {
        setCampaignItems(prev => prev.filter(item => item.id !== id));
    };

    const handleGenerateApproved = async () => {
        const approvedItems = campaignItems.filter(i => i.isApproved);
        if (approvedItems.length === 0) {
            setError("No tweets approved for generation.");
            return;
        }

        setCampaignStep(4);
        setIsBatchProcessing(true);
        setCampaignItems(prev => prev.map(item => item.isApproved ? { ...item, status: 'pending' } : item));

        // Chunking for Image Generation (Concurrency: 3 items = 6 images at a time)
        const CHUNK_SIZE = 3;
        for (let i = 0; i < approvedItems.length; i += CHUNK_SIZE) {
            const chunk = approvedItems.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (item) => {
                setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'generating' } : p));

                // CHECK FOR TEXT-ONLY MODE
                if (item.skipImage) {
                    // Simulate a quick delay for UX, then complete
                    await new Promise(r => setTimeout(r, 500));
                    setCampaignItems(prev => prev.map(p => p.id === item.id ? {
                        ...p,
                        status: 'completed',
                        images: [], // No images
                        selectedImageIndex: -1 // Indicator for no image
                    } : p));
                    return;
                }

                try {
                    // FIX: Prioritize the specific reference image assigned to this item (Strict Mode)
                    const effectiveRefImage = item.referenceImageId || campaignReferenceImage || undefined;

                    const promises = [
                        generateWeb3Graphic({ prompt: item.visualHeadline || item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined, artPrompt: item.artPrompt }),
                        generateWeb3Graphic({ prompt: item.visualHeadline || item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined, artPrompt: item.artPrompt })
                    ];
                    // Add slight random delay to stagger start times
                    await new Promise(r => setTimeout(r, Math.random() * 1000));

                    const images = await Promise.all(promises);
                    setCampaignItems(prev => prev.map(p => p.id === item.id ? {
                        ...p,
                        status: 'completed',
                        images: images,
                        selectedImageIndex: 0
                    } : p));

                    // History Sync
                    images.forEach(img => {
                        saveBrainMemory(brandName, 'FACT', `Campaign Asset: ${item.visualHeadline || item.tweet.substring(0, 30)}`, undefined, {
                            mediaUrl: img,
                            source: 'Campaigns',
                            campaign: campaignTheme
                        });
                    });
                } catch (err) {
                    setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'error' } : p));
                }
            }));
        }
        setIsBatchProcessing(false);
    };

    const handleUpdateItemArtPrompt = (id: string, prompt: string) => {
        setCampaignItems(prev => prev.map(i => i.id === id ? { ...i, artPrompt: prompt } : i));
    };

    const handleUpdateItemVisualHeadline = (id: string, headline: string) => {
        setCampaignItems(prev => prev.map(i => i.id === id ? { ...i, visualHeadline: headline } : i));
    };

    const handleSelectImage = (itemId: string, index: number) => {
        setCampaignItems(prev => prev.map(i => i.id === itemId ? { ...i, selectedImageIndex: index } : i));
    };

    const handleRegenerateItem = async (id: string) => {
        const item = campaignItems.find(i => i.id === id);
        if (!item) return;

        setCampaignItems(prev => prev.map(p => p.id === id ? { ...p, status: 'generating' } : p));

        try {
            // Use Item overrides if present, otherwise global defaults
            const effectiveTemplate = item.template || campaignTemplate || undefined;
            const effectiveRefImage = item.referenceImageId || campaignReferenceImage || undefined;

            const promises = [
                generateWeb3Graphic({ prompt: item.visualHeadline || item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: effectiveTemplate, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined }),
                generateWeb3Graphic({ prompt: item.visualHeadline || item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: effectiveTemplate, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined })
            ];
            const images = await Promise.all(promises);
            setCampaignItems(prev => prev.map(p => p.id === id ? { ...p, status: 'completed', images: images, selectedImageIndex: 0 } : p));

            // History Sync
            images.forEach(img => {
                saveBrainMemory(brandName, 'FACT', `Campaign Asset (Regen): ${item.visualHeadline || item.tweet.substring(0, 30)}`, undefined, {
                    mediaUrl: img,
                    source: 'Campaigns',
                    campaign: campaignTheme
                });
            });
        } catch (err) {
            setCampaignItems(prev => prev.map(p => p.id === id ? { ...p, status: 'error' } : p));
        }
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

            setCampaignItems(prev => prev.map(item => {
                if (item.id === activeUploadId) {
                    const newImages = [...(item.images || []), base64];
                    return {
                        ...item,
                        images: newImages,
                        status: 'completed',
                        selectedImageIndex: newImages.length - 1
                    };
                }
                return item;
            }));
            setActiveUploadId(null);
            if (campaignFileInputRef.current) campaignFileInputRef.current.value = '';
        } catch (err) { console.error("Campaign upload failed", err); }
    };

    const handleFocusDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploadingFocusDoc(true);
        const file = files[0];

        try {
            const { parseDocumentFile } = await import('../services/documentParser');
            const text = await parseDocumentFile(file);
            if (text) {
                setCampaignFocusDoc(text); // Overwrite or could append if we wanted multiple
            }
        } catch (err: any) {
            alert(err.message || "Failed to upload document");
        } finally {
            setIsUploadingFocusDoc(false);
            if (focusDocInputRef.current) focusDocInputRef.current.value = '';
        }
    };

    const handleBatchScheduleCampaign = async (items: CampaignItem[]) => {
        let startDateObj = new Date();
        if (campaignStartDate) {
            const parts = campaignStartDate.split('-');
            startDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            startDateObj.setDate(startDateObj.getDate() + 1);
        }

        const newEvents: CalendarEvent[] = items.map((item, idx) => {
            const date = new Date(startDateObj);
            date.setDate(startDateObj.getDate() + idx);

            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

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
                color: '#4F46E5',
                reasoning: item.reasoning,
                visualDescription: item.artPrompt, // Map artPrompt to visualDescription (Prompt)
                referenceImageId: item.referenceImageId,
                template: item.template,
                visualHeadline: item.visualHeadline
            };
        });

        const updatedEvents = [...events, ...newEvents];
        onUpdateEvents(updatedEvents);
        saveCalendarEvents(brandName, updatedEvents);

        alert(`Success! Scheduled ${newEvents.length} posts starting ${campaignStartDate}.`);
        setViewMode('list');
        setCampaignItems([]);
    };

    const handleDownload = (imageUrl: string, prefix: string) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `${brandName}-${prefix}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrepareTweet = (text: string) => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');

    // --- EXPORT FUNCTIONS ---

    const handleExportCSV = (campaignName: string) => {
        // Filter events for this campaign
        const campaignEvents = events.filter(e => e.campaignName === campaignName).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (campaignEvents.length === 0) {
            alert('No scheduled events found for this campaign.');
            return;
        }

        // CSV Header
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Date,Platform,Status,Content,Image URL\r\n";

        // CSV Rows
        campaignEvents.forEach(evt => {
            const cleanContent = evt.content.replace(/"/g, '""'); // Escape quotes
            const row = `${evt.date},${evt.platform},${evt.status},"${cleanContent}",${evt.image || ''}`;
            csvContent += row + "\r\n";
        });

        // Download Trigger
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${brandName}_Campaign_${campaignName.replace(/\s+/g, '_')}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPDF = async (campaignName: string) => {
        // Filter events
        const campaignEvents = events.filter(e => e.campaignName === campaignName).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (campaignEvents.length === 0) {
            alert('No scheduled events found for this campaign.');
            return;
        }

        const doc = new jsPDF();

        // TITLE
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(`${brandName}: ${campaignName}`, 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Campaign Report generated on ${new Date().toLocaleDateString()}`, 14, 28);
        doc.text(`Total Posts: ${campaignEvents.length}`, 14, 34);

        // PREPARE TABLE DATA
        const tableBody: any[] = [];

        for (const evt of campaignEvents) {
            const rowData = [
                evt.date,
                evt.content,
                evt.status.toUpperCase(),
                '' // Placeholder for Visual
            ];
            tableBody.push(rowData);
        }

        // GENERATE TABLE WITH IMAGES
        // @ts-ignore
        autoTable(doc, {
            startY: 45,
            head: [['Date', 'Copy', 'Status', 'Visual']],
            body: tableBody,
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 25 },
                3: { cellWidth: 35, minCellHeight: 25 }
            },
            styles: { overflow: 'linebreak', fontSize: 10, valign: 'middle' },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 3) {
                    const evtIndex = data.row.index;
                    const evt = campaignEvents[evtIndex];
                    if (evt && evt.image) {
                        try {
                            const dim = data.cell.height - 4;
                            const x = data.cell.x + 2;
                            const y = data.cell.y + 2;
                            doc.addImage(evt.image, 'PNG', x, y, dim * 1.77, dim);
                        } catch (e) {
                            // console.warn('Image fail');
                        }
                    }
                }
            }
        });

        doc.save(`${brandName}_Campaign_${campaignName.replace(/\s+/g, '_')}.pdf`);
    };

    const handleDownloadDraftsPDF = (drafts: CampaignItem[]) => {
        // @ts-ignore
        const doc = new jsPDF();

        // TITLE
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(`${brandName}: Draft Review`, 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 28);

        let startDateObj = new Date();
        if (campaignStartDate) {
            const parts = campaignStartDate.split('-');
            startDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            startDateObj.setDate(startDateObj.getDate() + 1);
        }

        let yPos = 40;

        drafts.forEach((item, i) => {
            // Calculate Date
            const itemDate = new Date(startDateObj);
            itemDate.setDate(startDateObj.getDate() + i);
            const dateStr = itemDate.toLocaleDateString();

            // New Page check
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            // Item Index
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(`Post #${i + 1} (${dateStr})`, 14, yPos);
            yPos += 8;

            // Content
            doc.setFontSize(11);
            doc.setTextColor(60, 60, 60);

            // CLEAN TEXT: Strip Markdown, replace bullets, weird chars
            const manualClean = item.tweet
                .replace(/\*\*/g, '') // remove bold
                .replace(/^[-•]\s*/gm, '• ') // normalize bullets
                .replace(/[^\x00-\x7F]/g, "") // STRIP NON-ASCII (Emojis, etc) to prevent PDF artifacts
                .replace(/\n\s*\n/g, '\n'); // compact double newlines

            const splitText = doc.splitTextToSize(manualClean, 180);
            doc.text(splitText, 14, yPos);
            yPos += (splitText.length * 5) + 5;

            // Image
            const selectedImg = item.images && item.images.length > 0
                ? item.images[item.selectedImageIndex || 0]
                : null;

            if (selectedImg) {
                try {
                    // Aspect ratio usually 16:9 => 100 width, 56 height
                    if (yPos + 60 > 280) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.addImage(selectedImg, 'PNG', 14, yPos, 100, 56);
                    yPos += 65;
                } catch (e) {
                    console.error("PDF Image Error", e);
                }
            } else {
                yPos += 10;
            }

            // Separator
            doc.setDrawColor(200, 200, 200);
            doc.line(14, yPos, 196, yPos);
            yPos += 10;
        });

        doc.save(`${brandName}_Drafts_${new Date().toISOString().slice(0, 10)}.pdf`);
    };


    // --- RENDER ---
    const activeCampaigns = getActiveCampaigns();
    const approvedCount = campaignItems.filter(i => i.isApproved).length;

    return (
        <div className="w-full min-h-screen bg-gray-50 text-gray-900 p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex justify-between items-end border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight mb-2">Campaigns</h1>
                        <p className="text-zinc-400 text-sm max-w-lg">Design a coordinated content sequence tied to a specific growth objective.</p>
                        <p className="text-zinc-600 text-xs mt-1">Execution units derived from Defia system recommendations.</p>
                    </div>
                    {viewMode === 'list' && (
                        <Button onClick={() => { setViewMode('wizard'); setCampaignStep(1); }} className="shadow-lg shadow-purple-500/20 bg-white text-black hover:bg-zinc-200 border-none">
                            + New Campaign
                        </Button>
                    )}
                    {viewMode === 'wizard' && (
                        <Button onClick={() => setViewMode('list')} variant="secondary" className="bg-zinc-800 text-zinc-300 hover:text-white border-none">
                            Back to List
                        </Button>
                    )}
                </div>

                {/* LIST VIEW */}
                {viewMode === 'list' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                        {activeCampaigns.map((camp, idx) => (
                            <div key={idx} className="group bg-[#121214] border border-white/5 rounded-2xl p-6 hover:border-zinc-700 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-purple-500/10 transition-colors"></div>

                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <h3 className="font-bold text-lg text-white break-words line-clamp-2 pr-4">{camp.name}</h3>
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">{camp.status}</span>
                                </div>

                                <div className="space-y-3 mb-8 relative z-10">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500 font-medium">Posts</span>
                                        <span className="font-mono text-zinc-300">{camp.count}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-zinc-500 font-medium">Latest Date</span>
                                        <span className="font-mono text-zinc-300">{camp.nextDate}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 relative z-10">
                                    <Button variant="secondary" className="bg-zinc-900 border-white/5 text-zinc-400 hover:text-white text-xs h-9" onClick={() => setViewingCampaignDetails(camp.name)}>View Posts</Button>
                                    <Button variant="outline" className="border-white/10 text-zinc-400 hover:text-white text-xs h-9" onClick={() => handleExportPDF(camp.name)}>Report PDF</Button>
                                    <div className="col-span-2 grid grid-cols-2 gap-2">
                                        <Button variant="secondary" className="bg-zinc-900 border-white/5 text-zinc-500 hover:text-white text-xs h-9" onClick={() => handleExportCSV(camp.name)}>CSV</Button>
                                        <Button variant="secondary" className="bg-zinc-900 border-white/5 text-zinc-500 hover:text-white text-xs h-9" onClick={() => setAnalyzingCampaign(camp.name)}>Stats</Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {activeCampaigns.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                                <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center mb-6 border border-white/5">
                                    <span className="text-4xl">🚀</span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No Active Campaigns</h3>
                                <p className="text-zinc-500 max-w-md mb-8">
                                    Start a new campaign to schedule a sequence of strategic posts.
                                </p>
                                <Button onClick={() => { setViewMode('wizard'); setCampaignStep(1); }} className="bg-white text-black hover:bg-zinc-200">Start Campaign</Button>
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW CAMPAIGN DETAILS MODAL */}
                {viewingCampaignDetails && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                        <div className="bg-[#121214] border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#121214]">
                                <div>
                                    <h3 className="font-bold text-xl text-white mb-1">{viewingCampaignDetails}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        <p className="text-xs text-zinc-400 font-mono">LIVE CAMPAIGN VIEW</p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingCampaignDetails(null)} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/20">
                                {events.filter(e => e.campaignName === viewingCampaignDetails).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(post => {
                                    const refImage = post.referenceImageId ? brandConfig.referenceImages.find(r => r.id === post.referenceImageId) : null;
                                    return (
                                        <details key={post.id} className="group bg-[#18181b] border border-white/5 rounded-xl open:border-purple-500/30 transition-all duration-300">
                                            <summary className="p-5 cursor-pointer list-none flex items-start gap-4 select-none hover:bg-white/[0.02] transition-colors rounded-xl">
                                                <div className="flex flex-col items-center min-w-[60px] pt-1">
                                                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{new Date(post.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                    <span className={`w-2 h-2 rounded-full mt-2 ${post.status === 'published' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]'}`}></span>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm text-zinc-200 line-clamp-2 font-medium group-open:line-clamp-none leading-relaxed">{post.content}</p>
                                                    <div className="flex gap-2 mt-3 opacity-0 group-open:opacity-100 transition-opacity">
                                                        {post.reasoning && <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">AI Strategy</span>}
                                                        {post.referenceImageId && <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Ref. Image</span>}
                                                    </div>
                                                </div>
                                                <svg className="w-5 h-5 text-zinc-600 group-open:rotate-180 transition-transform mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                            </summary>

                                            <div className="p-5 pt-0 border-t border-white/5 mt-2">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">

                                                    {/* LEFT: STRATEGY */}
                                                    <div className="space-y-6">
                                                        {/* Thinking */}
                                                        <div>
                                                            <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2 mb-2 tracking-wider">
                                                                <span className="w-4 h-4 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-[10px]">🧠</span>
                                                                AI Reasoning
                                                            </label>
                                                            <div className="text-xs text-zinc-400 bg-[#09090b] border border-white/5 p-4 rounded-xl leading-relaxed whitespace-pre-wrap font-medium">
                                                                {post.reasoning || "No strategic reasoning recorded."}
                                                            </div>
                                                        </div>

                                                        {/* Template & Rules */}
                                                        <div>
                                                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block tracking-wider">Template Rule</label>
                                                            <div className="text-xs text-zinc-300 bg-[#09090b] border border-white/5 p-3 rounded-lg flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                                                {post.template || "Auto / Default"}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* RIGHT: VISUALS */}
                                                    <div className="space-y-6">
                                                        {/* Visual Prompt */}
                                                        <div>
                                                            <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2 mb-2 tracking-wider">
                                                                <span className="w-4 h-4 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center text-[10px]">🎨</span>
                                                                Visual Prompt
                                                            </label>
                                                            <div className="text-xs text-zinc-400 bg-[#09090b] border border-white/5 p-4 rounded-xl italic leading-relaxed">
                                                                "{post.visualDescription || post.content}"
                                                            </div>
                                                        </div>

                                                        {/* Reference Image */}
                                                        <div>
                                                            <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block tracking-wider">Reference Anchor</label>
                                                            {refImage ? (
                                                                <div className="flex items-start gap-4 bg-[#09090b] border border-white/5 p-3 rounded-xl hover:border-purple-500/30 transition-colors">
                                                                    <img src={refImage.url || refImage.data} className="w-20 h-20 object-cover rounded-lg border border-white/5" />
                                                                    <div>
                                                                        <div className="text-sm font-bold text-white mb-1">{refImage.name}</div>
                                                                        <div className="text-[10px] text-zinc-500 font-mono mb-2">ID: {refImage.id}</div>
                                                                        <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 inline-block px-2 py-0.5 rounded font-bold uppercase">Style Enforced</div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-zinc-600 italic pl-2">No specific reference image linked.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    );
                                })}

                                {events.filter(e => e.campaignName === viewingCampaignDetails).length === 0 && (
                                    <div className="text-center py-12 text-zinc-500">No posts found for this campaign.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* WIZARD VIEW */}
                {viewMode === 'wizard' && (
                    <div className="w-full animate-fadeIn transition-all duration-500">

                        {/* WIZARD CONTAINER */}
                        <div className={`mx-auto space-y-6 transition-all duration-500 ${campaignStep === 1 ? 'max-w-6xl' : 'max-w-7xl'}`}>

                            {/* Stepper */}
                            {/* COMPACT HEADER & STEPPER */}
                            {/* COMPACT STEPPER (Right Aligned) */}
                            <div className="flex items-center justify-end py-2 border-b border-gray-200 mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                        {[1, 2, 3, 4].map((step) => (
                                            <div key={step} className={`h-1.5 w-6 rounded-full transition-all ${campaignStep >= step ? 'bg-zinc-800' : 'bg-gray-300'}`}></div>
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest pl-2">Step {campaignStep}/4</span>
                                </div>
                            </div>

                            {/* STEP 1: CONFIG */}
                            {campaignStep === 1 && (
                                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">

                                    {/* CONTEXT BANNER (Compact) */}
                                    <div className="w-full bg-blue-50/50 border border-blue-100 rounded-lg p-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white border border-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shadow-sm">
                                                Source
                                            </div>
                                            <div className="text-xs font-medium text-blue-900">
                                                {promptProvenance} <span className="text-blue-400">/</span> <span className="opacity-70">Just Now</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Integrated Status Badge */}
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100/50 border border-emerald-100 text-[9px] font-bold text-emerald-700 uppercase tracking-wide">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                                Live Analysis
                                            </div>
                                            <button
                                                onClick={() => setShowBrief(!showBrief)}
                                                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wide hover:underline"
                                            >
                                                {showBrief ? 'Hide Signals' : 'View Signals'}
                                            </button>
                                        </div>
                                    </div>

                                    {showBrief && (
                                        <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-600 animate-in slide-in-from-top-1 shadow-sm">
                                            <div className="flex items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Topic Spike</span>
                                                        <span className="text-[10px] text-gray-400">Confidence: 92%</span>
                                                    </div>
                                                    <p className="leading-relaxed text-zinc-700">
                                                        Detected +15% increase in competitor mentions regarding "Protocol v2". Recommended action is a preemptive education campaign to capture Share of Voice.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

                                        {/* CAMPAIGN TYPE CARDS */}
                                        {/* LEFT COL: STRUCTURE */}
                                        <div className="lg:col-span-4 space-y-3">
                                            <div className="px-1">
                                                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Model</h2>
                                                <p className="text-zinc-500 text-[10px]">How should this executed?</p>
                                            </div>

                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => setCampaignType('theme')}
                                                    className={`w-full p-3 rounded-lg border text-left transition-all duration-200 relative overflow-hidden group ${campaignType === 'theme' ? 'bg-white border-zinc-500 ring-1 ring-zinc-500 shadow-sm' : 'bg-gray-50/50 border-gray-200 hover:bg-white hover:border-gray-300'}`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 ${campaignType === 'theme' ? 'bg-zinc-100 text-zinc-900' : 'bg-white text-gray-400 border border-gray-100'}`}>🎯</div>
                                                        <div>
                                                            <h3 className={`font-bold text-xs mb-0.5 ${campaignType === 'theme' ? 'text-gray-900' : 'text-gray-600'}`}>Specific Theme</h3>
                                                            <p className="text-[10px] text-gray-500 leading-tight">Deep dive into a single topic or launch event.</p>
                                                        </div>
                                                    </div>
                                                    {campaignType === 'theme' && <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-zinc-900" />}
                                                </button>

                                                <button
                                                    onClick={() => setCampaignType('diverse')}
                                                    className={`w-full p-3 rounded-lg border text-left transition-all duration-200 relative overflow-hidden group ${campaignType === 'diverse' ? 'bg-white border-zinc-500 ring-1 ring-zinc-500 shadow-sm' : 'bg-gray-50/50 border-gray-200 hover:bg-white hover:border-gray-300'}`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 ${campaignType === 'diverse' ? 'bg-zinc-100 text-zinc-900' : 'bg-white text-gray-400 border border-gray-100'}`}>🌊</div>
                                                        <div>
                                                            <h3 className={`font-bold text-xs mb-0.5 ${campaignType === 'diverse' ? 'text-gray-900' : 'text-gray-600'}`}>Diverse Mix</h3>
                                                            <p className="text-[10px] text-gray-500 leading-tight">Balance maintenance content with updates.</p>
                                                        </div>
                                                    </div>
                                                    {campaignType === 'diverse' && <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-zinc-900" />}
                                                </button>

                                                <button
                                                    onClick={() => setCampaignType('notes')}
                                                    className={`w-full p-3 rounded-lg border text-left transition-all duration-200 relative overflow-hidden group ${campaignType === 'notes' ? 'bg-white border-zinc-500 ring-1 ring-zinc-500 shadow-sm' : 'bg-gray-50/50 border-gray-200 hover:bg-white hover:border-gray-300'}`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 ${campaignType === 'notes' ? 'bg-zinc-100 text-zinc-900' : 'bg-white text-gray-400 border border-gray-100'}`}>✨</div>
                                                        <div>
                                                            <h3 className={`font-bold text-xs mb-0.5 ${campaignType === 'notes' ? 'text-gray-900' : 'text-gray-600'}`}>Smart Plan</h3>
                                                            <p className="text-[10px] text-gray-500 leading-tight">AI creates a plan from your raw notes.</p>
                                                        </div>
                                                    </div>
                                                    {campaignType === 'notes' && <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-zinc-900" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* RIGHT COL: CONFIGURATION */}
                                        <div className="lg:col-span-8">
                                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-6 h-full">
                                                <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
                                                    <div>
                                                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Params</h2>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    {campaignType === 'theme' && (
                                                        <div className="animate-fadeIn">
                                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block tracking-wider">Campaign Theme</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={campaignTheme}
                                                                    onChange={e => setCampaignTheme(e.target.value)}
                                                                    placeholder="e.g. Protocol v2 Launch Week"
                                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400"
                                                                />
                                                                <div className="absolute right-3 top-2.5 text-[10px] text-gray-400 font-mono">Required</div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {campaignType === 'notes' && (
                                                        <div className="animate-fadeIn">
                                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block tracking-wider">Raw Content Notes</label>
                                                            <textarea
                                                                value={campaignContext}
                                                                onChange={e => setCampaignContext(e.target.value)}
                                                                placeholder="Paste rough notes, links, or bullet points..."
                                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none min-h-[120px] font-mono placeholder:text-gray-400 leading-relaxed resize-y"
                                                            />
                                                            <div className="flex items-center gap-1.5 mt-1.5 text-gray-400 text-[9px]">
                                                                <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                                                AI Agent will structure this into a coherent campaign.
                                                            </div>
                                                        </div>
                                                    )}

                                                    {campaignType !== 'notes' && (
                                                        <>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex justify-between items-center tracking-wider">
                                                                        <span>Objective</span>
                                                                    </label>
                                                                    <div className="relative">
                                                                        <select
                                                                            value={campaignGoal}
                                                                            onChange={(e) => setCampaignGoal(e.target.value)}
                                                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 appearance-none outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 cursor-pointer"
                                                                        >
                                                                            <option value="User Acquisition">User Acquisition</option>
                                                                            <option value="Brand Awareness">Brand Awareness</option>
                                                                            <option value="Community Engagement">Community Engagement</option>
                                                                            <option value="Product Education">Product Education</option>
                                                                        </select>
                                                                        <div className="absolute right-3 top-3 pointer-events-none text-gray-500 text-[8px]">▼</div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex justify-between items-center tracking-wider">
                                                                        <span>Posts</span>
                                                                    </label>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        max="50"
                                                                        value={campaignCount}
                                                                        onChange={e => setCampaignCount(e.target.value)}
                                                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 outline-none"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block tracking-wider">Additional Context (Optional)</label>
                                                                <textarea
                                                                    value={campaignContext}
                                                                    onChange={e => setCampaignContext(e.target.value)}
                                                                    placeholder="Any specific constraints or key phrases to include?"
                                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-900 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 outline-none min-h-[60px] placeholder:text-gray-400 resize-none"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block tracking-wider flex justify-between items-end">
                                                                    <span>Strategic Doc</span>
                                                                    <span onClick={() => focusDocInputRef.current?.click()} className="text-purple-600 hover:text-purple-800 cursor-pointer hover:underline text-[9px] font-bold">
                                                                        {isUploadingFocusDoc ? 'Uploading...' : '+ Upload PDF/TXT'}
                                                                    </span>
                                                                </label>
                                                                <input type="file" ref={focusDocInputRef} onChange={handleFocusDocUpload} accept=".pdf,.txt,.md" className="hidden" />
                                                                <textarea
                                                                    value={campaignFocusDoc}
                                                                    onChange={e => setCampaignFocusDoc(e.target.value)}
                                                                    placeholder="Paste strategy text or upload a doc to guide the AI..."
                                                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-[10px] text-gray-900 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 outline-none min-h-[80px] placeholder:text-gray-400 font-mono resize-y"
                                                                />
                                                            </div>
                                                        </>
                                                    )}

                                                    {/* Visual Style & Refs */}
                                                    <div className="pt-4 border-t border-gray-100 space-y-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block tracking-wider">Visual Style</label>
                                                                <div className="relative">
                                                                    <select
                                                                        value={campaignTemplate}
                                                                        onChange={(e) => setCampaignTemplate(e.target.value)}
                                                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 appearance-none outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 cursor-pointer"
                                                                    >
                                                                        <option value="">No Template (Default)</option>
                                                                        {(!brandConfig.graphicTemplates || brandConfig.graphicTemplates.length === 0) && (
                                                                            <>
                                                                                <option value="Partnership">Partnership</option>
                                                                                <option value="Campaign">Campaign Launch</option>
                                                                                <option value="Giveaway">Giveaway</option>
                                                                            </>
                                                                        )}
                                                                        {(brandConfig.graphicTemplates || []).map(t => (
                                                                            <option key={t.id} value={t.label}>{t.label}</option>
                                                                        ))}
                                                                    </select>
                                                                    <div className="absolute right-3 top-3 pointer-events-none text-gray-500 text-[8px]">▼</div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block tracking-wider">Reference Image</label>
                                                            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                                                <div
                                                                    onClick={() => setCampaignReferenceImage(null)}
                                                                    className={`flex-shrink-0 w-12 h-12 rounded-lg border border-dashed cursor-pointer flex items-center justify-center transition-all ${!campaignReferenceImage ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-400'}`}
                                                                >
                                                                    <span className="text-[9px]">None</span>
                                                                </div>
                                                                {brandConfig.referenceImages.map(img => (
                                                                    <div
                                                                        key={img.id}
                                                                        onClick={() => setCampaignReferenceImage(campaignReferenceImage === img.id ? null : img.id)}
                                                                        className={`flex-shrink-0 w-16 h-16 rounded-xl border cursor-pointer overflow-hidden relative group transition-all ${campaignReferenceImage === img.id ? 'border-purple-500 shadow-md ring-2 ring-purple-100' : 'border-gray-200 hover:border-gray-400'}`}
                                                                        title={img.name}
                                                                    >
                                                                        <img src={img.data || img.url} className="w-full h-full object-cover" />
                                                                        {campaignReferenceImage === img.id && (
                                                                            <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                                                                                <div className="w-2 h-2 bg-purple-500 rounded-full shadow-sm" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>

                                                {error && (
                                                    <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2 animate-fadeIn">
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                        {error}
                                                    </div>
                                                )}

                                                <div className="pt-4">
                                                    <Button onClick={handleGenerateStrategy} isLoading={isGeneratingStrategy} disabled={campaignType === 'theme' && !campaignTheme} className="w-full h-12 text-sm font-bold shadow-lg shadow-zinc-500/10 bg-zinc-900 text-white hover:bg-zinc-800 border-none rounded-lg">
                                                        {campaignType === 'notes' ? 'Analyze & Create Plan' : 'Generate Strategy'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: STRATEGY REVIEW & EDIT */}
                            {/* STEP 2: STRATEGY REVIEW (READ ONLY SUMMARY) */}
                            {/* STEP 2: STRATEGY REVIEW & EDIT */}
                            {campaignStep === 2 && campaignStrategy && (
                                <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm space-y-8 animate-fadeIn">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            {campaignContext && (
                                                <div className="text-[10px] items-center gap-2 text-gray-500 uppercase font-bold mb-2 flex">
                                                    <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded">Context Active</span>
                                                    Context Source: Manual Input
                                                </div>
                                            )}
                                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Campaign Strategy</h3>
                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>{campaignGoal}</span>
                                                <span className="text-gray-300">|</span>
                                                <span className="text-zinc-500 italic">System Guided Pattern</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 pt-8">
                                        {/* AUDIENCE & MESSAGING */}
                                        {/* AI THINKING BOX */}
                                        {draftContext && !draftContext.includes("JSON Generation Successful") && (
                                            <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-6 animate-fadeIn relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                                <div className="flex items-center gap-2 mb-3 relative z-10">
                                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">🧠</div>
                                                    <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-widest">Brain Logic</h3>
                                                </div>
                                                <div className="prose prose-sm max-w-none text-indigo-900/80 text-xs relative z-10 leading-relaxed">
                                                    <ReactMarkdown>{draftContext}</ReactMarkdown>
                                                </div>
                                            </div>
                                        )}

                                        {/* VISUAL STRATEGY */}
                                        <div className="col-span-1 md:col-span-2 bg-gray-50 border border-gray-100 rounded-xl p-6 hover:border-gray-200 transition-colors">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">🎨</div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Visual Strategy & Art Direction</label>
                                            </div>
                                            <textarea
                                                value={campaignStrategy.visualStrategy || "No visual strategy generated."}
                                                onChange={(e) => setCampaignStrategy(prev => prev ? { ...prev, visualStrategy: e.target.value } : null)}
                                                className="w-full bg-transparent border-none p-0 text-sm text-gray-700 min-h-[60px] outline-none resize-none focus:ring-0 leading-relaxed font-medium placeholder-gray-400"
                                                placeholder="Explain the visual approach..."
                                            />
                                        </div>

                                        {/* GENERATED DRAFTS LIST */}
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Target Audience</label>
                                                <textarea
                                                    value={campaignStrategy.targetAudience}
                                                    onChange={(e) => setCampaignStrategy(prev => prev ? { ...prev, targetAudience: e.target.value } : null)}
                                                    className="w-full bg-white border border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-xl p-4 text-sm text-gray-900 min-h-[80px] outline-none transition-all placeholder:text-gray-400"
                                                    placeholder="Describe your target audience..."
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Key Messaging</label>
                                                <textarea
                                                    value={campaignStrategy.keyMessaging.join('\n')}
                                                    onChange={(e) => setCampaignStrategy(prev => prev ? { ...prev, keyMessaging: e.target.value.split('\n') } : null)}
                                                    className="w-full bg-white border border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 rounded-xl p-4 text-sm text-gray-900 min-h-[120px] outline-none transition-all placeholder:text-gray-400"
                                                    placeholder="Enter one key message per line"
                                                />
                                            </div>
                                        </div>

                                        {/* PLATFORM STRATEGY */}
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Platform Strategy</label>
                                            <div className="space-y-3">
                                                {campaignStrategy.channelStrategy.map((s, i) => (
                                                    <div key={i} className="bg-white border border-gray-200 p-4 rounded-xl hover:border-gray-300 transition-colors">
                                                        <div className="flex justify-between items-center mb-2 gap-2">
                                                            <span className="font-bold text-gray-900 text-sm">{s.channel}</span>
                                                            <input
                                                                value={s.focus}
                                                                onChange={(e) => {
                                                                    const newVal = e.target.value;
                                                                    setCampaignStrategy(prev => prev ? {
                                                                        ...prev,
                                                                        channelStrategy: prev.channelStrategy.map((item, idx) => idx === i ? { ...item, focus: newVal } : item)
                                                                    } : null);
                                                                }}
                                                                className="text-[10px] bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-500 font-medium outline-none focus:border-purple-500 w-32 text-center"
                                                            />
                                                        </div>
                                                        <textarea
                                                            value={s.rationale}
                                                            onChange={(e) => {
                                                                const newVal = e.target.value;
                                                                setCampaignStrategy(prev => prev ? {
                                                                    ...prev,
                                                                    channelStrategy: prev.channelStrategy.map((item, idx) => idx === i ? { ...item, rationale: newVal } : item)
                                                                } : null);
                                                            }}
                                                            className="w-full bg-transparent text-xs text-gray-500 leading-relaxed outline-none border-b border-transparent focus:border-gray-200 transition-colors p-1"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* SCHEDULING INPUT in STRATEGY STEP */}
                                    <div className="pt-6 border-t border-gray-100">
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Start Date</label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="date"
                                                value={campaignStartDate}
                                                onChange={(e) => setCampaignStartDate(e.target.value)}
                                                className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:border-purple-500 outline-none"
                                            />
                                            <span className="text-xs text-gray-400">
                                                Campaign will launch on this date.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <Button variant="secondary" onClick={() => setCampaignStep(1)} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900">Back</Button>
                                        <Button onClick={handleDraftCampaign} isLoading={isDraftingCampaign} className="flex-1 shadow-xl shadow-zinc-500/10 h-12 text-base bg-zinc-900 text-white hover:bg-zinc-800 border-none rounded-lg">
                                            {batchProgress || 'Generate Content Sequence'}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: REVIEW SUMMARY */}
                            {campaignStep === 3 && (
                                <div className="space-y-8 animate-fadeIn">
                                    <div className="sticky top-2 z-30 bg-white/95 backdrop-blur border border-gray-200 shadow-sm rounded-2xl p-6 mb-6 flex justify-between items-center transition-all">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900 mb-1">Review Content</h2>
                                            <p className="text-sm text-gray-500">Review and refine the AI-generated drafts.</p>
                                        </div>

                                        <div className="flex gap-4">
                                            <button onClick={() => setCampaignStep(2)} className="text-sm text-gray-500 hover:text-gray-900 px-4 py-2 transition-colors">Back</button>
                                            <Button onClick={handleGenerateApproved} className="shadow-lg shadow-zinc-500/20 bg-zinc-900 text-white hover:bg-zinc-800 border-none font-bold">
                                                Queue for Execution
                                            </Button>
                                        </div>
                                    </div>

                                    {/* METADATA BAR */}
                                    <div className="bg-white border border-gray-200 rounded-2xl p-6 flex justify-between items-center shadow-sm">
                                        <div className="flex gap-8 text-sm">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Approved</span>
                                                <span className="font-bold text-emerald-600 text-lg">{approvedCount} Posts</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Est. Assets</span>
                                                <span className="font-bold text-gray-900 text-lg">{approvedCount * 2} Graphics</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                        {campaignItems.map((item, idx) => (
                                            <div key={item.id} className={`group bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${item.isApproved ? 'border-purple-500/50 shadow-md ring-1 ring-purple-100' : 'border-gray-200 opacity-60 grayscale-[0.5]'}`}>
                                                <div className="p-3 pl-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Post {idx + 1}</span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleToggleApproval(item.id)}
                                                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors border ${item.isApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'}`}
                                                        >
                                                            {item.isApproved ? '✓ Approved' : '✕ Discarded'}
                                                        </button>
                                                        {/* Delete button option */}
                                                        <button onClick={() => handleDeleteDraft(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="p-6 flex gap-6 h-[320px]">
                                                    {/* CONTENT */}
                                                    <div className="flex-1 flex flex-col h-full">
                                                        <textarea
                                                            value={item.tweet}
                                                            onChange={(e) => handleUpdateDraft(item.id, e.target.value)}
                                                            className="w-full flex-1 bg-transparent border-none p-0 text-gray-900 text-base resize-none focus:ring-0 leading-relaxed placeholder-gray-400 font-medium custom-scrollbar"
                                                            placeholder="Draft content..."
                                                        />
                                                        {/* REASONING DISPLAY */}
                                                        {item.reasoning && (
                                                            <div className="mt-4 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-2">
                                                                <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                                                    <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                                                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">Strategy Insight</span>
                                                                </div>
                                                                <p className="text-[10px] text-indigo-800/70 leading-relaxed font-medium line-clamp-2 hover:line-clamp-none transition-all">
                                                                    {item.reasoning}
                                                                </p>
                                                            </div>
                                                        )}

                                                    </div>

                                                    {/* SETTINGS SIDEBAR */}
                                                    <div className="w-[180px] shrink-0 space-y-5 pt-1 flex flex-col justify-between border-l border-gray-100 pl-4">
                                                        <div>
                                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1.5">Visual Template</label>
                                                            <select
                                                                value={item.template || ''}
                                                                onChange={(e) => {
                                                                    const newVal = e.target.value;
                                                                    setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, template: newVal } : p));
                                                                }}
                                                                disabled={item.skipImage} // Disable if text only
                                                                className={`w-full text-[11px] border border-gray-200 rounded-lg px-2 py-2 text-gray-700 bg-white outline-none focus:border-purple-500 transition-colors cursor-pointer appearance-none ${item.skipImage ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                            >
                                                                <option value="">Auto (Default)</option>
                                                                {/* STRICT MODE: Only show defaults if NO custom templates exist */}
                                                                {(!brandConfig.graphicTemplates || brandConfig.graphicTemplates.length === 0) && (
                                                                    <>
                                                                        <option value="Educational">Educational / Insight</option>
                                                                        <option value="Feature Update">Feature / Product Update</option>
                                                                        <option value="Partnership">Partnership</option>
                                                                        <option value="Campaign Launch">Campaign Launch</option>
                                                                        <option value="Giveaway">Giveaway</option>
                                                                        <option value="Event">Event</option>
                                                                        <option value="Speaker Quote">Speaker Quote</option>
                                                                    </>
                                                                )}
                                                                {/* Custom Templates */}
                                                                {(brandConfig.graphicTemplates || []).map(t => (
                                                                    <option key={t.id} value={t.label}>{t.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="pt-2">
                                                            <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1.5">Style Reference</label>
                                                            <div className="relative">
                                                                <select
                                                                    value={item.referenceImageId || campaignReferenceImage || ""}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, referenceImageId: val || undefined } : p));
                                                                    }}
                                                                    disabled={item.skipImage}
                                                                    className={`w-full text-[11px] border border-gray-200 rounded-lg px-2 py-2 text-gray-700 bg-white outline-none focus:border-purple-500 transition-colors cursor-pointer appearance-none ${item.skipImage ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                                >
                                                                    <option value="">Auto (Brand Default)</option>
                                                                    {brandConfig.referenceImages.map(img => (
                                                                        <option key={img.id} value={img.id}>{img.name}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="absolute right-2 top-2.5 pointer-events-none text-gray-400 text-[10px]">▼</div>
                                                            </div>
                                                            {/* Step 3 Thumbnail Preview */}
                                                            {(item.referenceImageId || campaignReferenceImage) && (
                                                                <div className="mt-2 flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                                                                    <img
                                                                        src={brandConfig.referenceImages.find(r => r.id === (item.referenceImageId || campaignReferenceImage))?.url || brandConfig.referenceImages.find(r => r.id === (item.referenceImageId || campaignReferenceImage))?.data || ''}
                                                                        className="w-8 h-8 rounded object-cover border border-gray-200"
                                                                        alt=""
                                                                    />
                                                                    <span className="text-[9px] text-gray-500 truncate max-w-[100px]">
                                                                        {brandConfig.referenceImages.find(r => r.id === (item.referenceImageId || campaignReferenceImage))?.name}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* SKIP IMAGE TOGGLE */}
                                                        <div className="flex items-center gap-2 pt-4 border-t border-gray-100 mt-auto">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!item.skipImage}
                                                                onChange={(e) => {
                                                                    setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, skipImage: e.target.checked } : p));
                                                                }}
                                                                id={`skip-${item.id}`}
                                                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                                                            />
                                                            <label htmlFor={`skip-${item.id}`} className="text-[10px] font-medium text-gray-500 cursor-pointer select-none hover:text-gray-900 transition-colors">
                                                                Skip Image (Text Only)
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* RESULTS / GENERATION */}
                            {campaignStep === 4 && (
                                <div className="space-y-8 animate-fadeIn">
                                    <div className="sticky top-2 z-30 bg-white/95 backdrop-blur border border-gray-200 shadow-sm rounded-2xl p-6 mb-6 flex justify-between items-center transition-all">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-xl font-bold text-gray-900">Campaign Assets</h2>
                                            <Button
                                                onClick={() => {
                                                    const allScripts = campaignItems.map(i => i.tweet).join('\n\n---\n\n');
                                                    navigator.clipboard.writeText(allScripts);
                                                    alert("All scripts copied to clipboard!");
                                                }}
                                                variant="secondary"
                                                className="text-xs py-1.5 px-3 h-8 flex items-center gap-1 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                Copy Recap
                                            </Button>

                                            <div className="h-6 w-[1px] bg-gray-200 mx-2"></div>

                                            <Button
                                                onClick={() => handleDownloadDraftsPDF(campaignItems.filter(i => i.isApproved))}
                                                variant="secondary"
                                                className="text-xs py-1.5 px-3 h-8 flex items-center gap-1 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                PDF
                                            </Button>

                                            <Button
                                                onClick={() => handleBatchScheduleCampaign(campaignItems.filter(i => i.isApproved))}
                                                className="text-xs py-1.5 px-4 h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-none flex items-center gap-2 font-bold shadow-md shadow-emerald-500/20"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                Schedule
                                            </Button>
                                        </div>
                                        {isBatchProcessing && <span className="text-xs text-purple-600 animate-pulse font-bold">Generating Graphics...</span>}
                                    </div>

                                    {campaignItems.filter(i => i.isApproved).map((item, idx) => (
                                        <div key={item.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                            {/* Edit / Refine Section */}
                                            <div className="p-6 border-b border-gray-100 bg-gray-50">
                                                {item.reasoning && (
                                                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3">
                                                        <div className="shrink-0 pt-0.5" title="Verified Source">✅</div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5 animate-pulse">Verified Source</div>
                                                            <p className="text-xs text-emerald-800/80 font-medium leading-relaxed">{item.reasoning}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex justify-between gap-6 mb-4">
                                                    <textarea
                                                        value={item.tweet}
                                                        onChange={e => handleUpdateDraft(item.id, e.target.value)}
                                                        className="bg-transparent border-none p-0 text-sm text-gray-900 w-full focus:ring-0 min-h-[120px] leading-relaxed placeholder-gray-400 resize-none font-medium custom-scrollbar"
                                                        rows={5}
                                                        placeholder="Tweet content..."
                                                    />
                                                    <Button onClick={() => handlePrepareTweet(item.tweet)} variant="secondary" className="h-8 text-xs py-0 whitespace-nowrap bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900">Post Now</Button>
                                                </div>

                                                {/* Advanced Overrides */}
                                                <div className="flex gap-2 mb-2 pt-4 border-t border-gray-200">
                                                    <div className="relative flex-1">
                                                        <select
                                                            value={item.template || campaignTemplate || ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setCampaignItems(prev => prev.map(i => i.id === item.id ? { ...i, template: val } : i));
                                                            }}
                                                            className="w-full bg-white border border-gray-200 rounded-lg text-[10px] p-2 text-gray-700 focus:border-purple-500 outline-none appearance-none"
                                                        >
                                                            <option value="">Default Template</option>
                                                            {/* STRICT MODE: Only show defaults if NO custom templates exist */}
                                                            {(!brandConfig.graphicTemplates || brandConfig.graphicTemplates.length === 0) && (
                                                                <>
                                                                    <option value="Educational">Educational / Insight</option>
                                                                    <option value="Feature Update">Feature / Product Update</option>
                                                                    <option value="Partnership">Partnership</option>
                                                                    <option value="Campaign Link">Campaign Link</option>
                                                                    <option value="Campaign Launch">Campaign Launch</option>
                                                                    <option value="Giveaway">Giveaway</option>
                                                                    <option value="Events">Event</option>
                                                                    <option value="Speaker Scenes">Speaker Quote</option>
                                                                </>
                                                            )}
                                                            {(brandConfig.graphicTemplates || []).map(t => (
                                                                <option key={t.id} value={t.label}>{t.label} (Custom)</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-2 top-2.5 pointer-events-none text-gray-400 text-[10px]">▼</div>
                                                    </div>

                                                    <div className="flex-1 min-w-[140px] relative">
                                                        <select
                                                            value={item.referenceImageId || campaignReferenceImage || ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setCampaignItems(prev => prev.map(i => i.id === item.id ? { ...i, referenceImageId: val || undefined } : i));
                                                            }}
                                                            className="w-full bg-white border border-gray-200 rounded-lg text-[10px] p-2 text-gray-700 focus:border-purple-500 outline-none appearance-none"
                                                        >
                                                            <option value="">Style: Auto / Best Match</option>
                                                            {brandConfig.referenceImages.map(img => (
                                                                <option key={img.id} value={img.id}>Style: {img.name}</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-2 top-2.5 pointer-events-none text-gray-400 text-[10px]">▼</div>

                                                        {/* THUMBNAIL PREVIEW */}
                                                        {(item.referenceImageId || campaignReferenceImage) && (
                                                            <div className="mt-2 flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                                                                <img
                                                                    src={brandConfig.referenceImages.find(r => r.id === (item.referenceImageId || campaignReferenceImage))?.url || brandConfig.referenceImages.find(r => r.id === (item.referenceImageId || campaignReferenceImage))?.data || ''}
                                                                    className="w-5 h-5 rounded object-cover border border-gray-200"
                                                                    alt=""
                                                                />
                                                                <span className="text-[9px] text-gray-500 truncate">
                                                                    Using: {brandConfig.referenceImages.find(r => r.id === (item.referenceImageId || campaignReferenceImage))?.name}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Text Only Toggle Step 4 */}
                                                    <div className="flex items-center gap-2 px-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors cursor-pointer" title="Skip Image Generation">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!item.skipImage}
                                                            onChange={(e) => {
                                                                setCampaignItems(prev => prev.map(i => i.id === item.id ? { ...i, skipImage: e.target.checked } : i));
                                                            }}
                                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                                                        />
                                                        <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">No Image</span>
                                                    </div>
                                                </div>

                                                {/* Visual Refinement Input */}
                                                <div className="flex gap-2 items-center mt-3">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap w-24">Visual Direction:</span>
                                                    <input
                                                        type="text"
                                                        value={item.artPrompt || ''}
                                                        onChange={e => handleUpdateItemArtPrompt(item.id, e.target.value)}
                                                        placeholder="Art Direction (e.g. Neon, Dark mode)..."
                                                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-purple-500 placeholder:text-gray-400"
                                                    />
                                                </div>
                                                {/* Visual Headline Input */}
                                                <div className="flex gap-2 items-center mt-2">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap w-24">Image Text:</span>
                                                    <input
                                                        type="text"
                                                        value={item.visualHeadline || ''}
                                                        onChange={e => handleUpdateItemVisualHeadline(item.id, e.target.value)}
                                                        placeholder="Short text for the image..."
                                                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-purple-500 font-bold placeholder:text-gray-400"
                                                    />
                                                    <Button
                                                        onClick={() => handleRegenerateItem(item.id)}
                                                        className="h-7 text-[10px] px-3 py-0 bg-purple-600 hover:bg-purple-700 text-white border-none shadow-md shadow-purple-500/20"
                                                        isLoading={item.status === 'generating'}
                                                        variant="primary"
                                                    >
                                                        Regenerate
                                                    </Button>
                                                    <Button
                                                        onClick={() => { setActiveUploadId(item.id); campaignFileInputRef.current?.click(); }}
                                                        variant="secondary"
                                                        className="h-7 text-[10px] px-3 py-0 flex items-center gap-1 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 border-none"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                        Upload
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="p-4 grid grid-cols-2 gap-4 bg-gray-50/50">
                                                {item.status === 'generating' && <div className="col-span-2 py-12 flex flex-col items-center justify-center text-xs text-purple-600 animate-pulse">
                                                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                                                    Generating New Visuals...
                                                </div>}
                                                {item.status === 'pending' && <div className="col-span-2 py-8 text-center text-xs text-gray-500">Queued</div>}
                                                {item.status === 'error' && <div className="col-span-2 py-8 text-center text-xs text-red-500">Generation Failed</div>}
                                                {item.status === 'completed' && item.images.map((img, i) => (
                                                    <div
                                                        key={i}
                                                        className={`relative group cursor-pointer rounded-xl overflow-hidden shadow-sm transition-all border-2
                                                    ${item.selectedImageIndex === i ? 'border-purple-500 ring-4 ring-purple-500/20 scale-[1.02]' : 'border-transparent hover:border-gray-200'}
                                                `}
                                                        onClick={() => handleSelectImage(item.id, i)}
                                                    >
                                                        <img src={img} className="w-full h-48 object-cover bg-gray-100" />
                                                        {item.selectedImageIndex === i && (
                                                            <div className="absolute top-3 left-3 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg flex items-center gap-1">
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                                Selected
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                                                            <Button onClick={(e) => { e.stopPropagation(); setViewingImage(img); }} className="text-xs py-1.5 h-8 bg-white/20 hover:bg-white/30 text-white border-none" variant="secondary">View</Button>
                                                            <Button onClick={(e) => { e.stopPropagation(); handleDownload(img, 'camp'); }} className="text-xs py-1.5 h-8 bg-white text-black hover:bg-gray-100 border-none">Save</Button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {/* Text Only Fallback Display */}
                                                {item.status === 'completed' && (!item.images || item.images.length === 0) && item.skipImage && (
                                                    <div className="col-span-2 py-12 bg-white border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center">
                                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 text-gray-400">
                                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                                        </div>
                                                        <h3 className="text-sm font-bold text-gray-500">Text Only Tweet</h3>
                                                        <p className="text-xs text-gray-400 mt-1">No graphic assets needed for this post.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                </div>
                            )}


                            {/* Hidden File Inputs */}
                            <input type="file" ref={campaignFileInputRef} onChange={handleCampaignImageUpload} accept="image/*" className="hidden" />

                            {/* Image Preview Helper */}
                            {
                                viewingImage && (
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-8 backdrop-blur" onClick={() => setViewingImage(null)}>
                                        <img src={viewingImage} className="max-w-full max-h-[90vh] rounded-xl shadow-2xl border border-white/10" onClick={e => e.stopPropagation()} />
                                        <button onClick={() => setViewingImage(null)} className="absolute top-5 right-5 text-zinc-400 bg-white/10 rounded-full p-3 hover:bg-white/20 transition-colors">✕</button>
                                    </div>
                                )
                            }

                            {/* ANALYTICS MODAL */}
                            {
                                analyzingCampaign && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
                                        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">{analyzingCampaign}</h3>
                                                    <p className="text-xs text-gray-500">Campaign Performance & Schedule</p>
                                                </div>
                                                <button onClick={() => setAnalyzingCampaign(null)} className="text-gray-400 hover:text-gray-900 transition-colors">✕</button>
                                            </div>
                                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                                {/* Summary Stats */}
                                                <div className="grid grid-cols-3 gap-4 mb-8">
                                                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                                                        <div className="text-2xl font-bold text-indigo-600">{events.filter(e => e.campaignName === analyzingCampaign).length}</div>
                                                        <div className="text-[10px] uppercase font-bold text-indigo-800/70">Scheduled Posts</div>
                                                    </div>
                                                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                                                        <div className="text-2xl font-bold text-emerald-600">0</div>
                                                        <div className="text-[10px] uppercase font-bold text-emerald-800/70">Engagement (Live)</div>
                                                    </div>
                                                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-center">
                                                        <div className="text-2xl font-bold text-purple-600">100%</div>
                                                        <div className="text-[10px] uppercase font-bold text-purple-800/70">Completion</div>
                                                    </div>
                                                </div>

                                                {/* Post List */}
                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-wider">Scheduled Content</h4>
                                                <div className="space-y-3">
                                                    {events.filter(e => e.campaignName === analyzingCampaign).sort((a, b) => a.date.localeCompare(b.date)).map((evt, i) => (
                                                        <div key={i} className="flex gap-4 p-4 border border-gray-200 bg-white rounded-xl items-start hover:border-gray-300 transition-colors shadow-sm">
                                                            <div className="bg-gray-50 px-3 py-2 rounded-lg text-center min-w-[60px] border border-gray-200">
                                                                <div className="text-[10px] font-bold text-gray-500 uppercase">{new Date(evt.date).toLocaleString('default', { month: 'short' })}</div>
                                                                <div className="text-xl font-bold text-gray-900">{new Date(evt.date).getDate()}</div>
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{evt.content}</p>
                                                                <div className="flex gap-2 mt-3">
                                                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded border border-blue-100 font-bold">Twitter</span>
                                                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded border border-gray-200 uppercase font-bold">{evt.status}</span>
                                                                </div>
                                                            </div>
                                                            {evt.image && (
                                                                <img src={evt.image} alt="Post asset" className="w-16 h-16 object-cover rounded-lg border border-gray-200 bg-gray-100" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                                                <Button onClick={() => setAnalyzingCampaign(null)} variant="secondary" className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-100">Close</Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        </div>
                    </div>
                )
                }
            </div>
        </div>
    );
};
