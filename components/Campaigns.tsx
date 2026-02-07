import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import ReactMarkdown from 'react-markdown';
import { generateWeb3Graphic, generateCampaignDrafts, generateCampaignStrategy, analyzeContentNotes } from '../services/gemini';
import { getBrainContext } from '../services/pulse';
import { dispatchThinking } from './ThinkingConsole';

import { saveCalendarEvents, saveCampaignState, loadCampaignState, loadBrainLogs, loadStrategyTasks, getBrandRegistryEntry } from '../services/storage';
import { saveBrainMemory } from '../services/supabase';
import { BrandConfig, CampaignItem, CalendarEvent, CampaignStrategy, ActionPlan, MarketingAction } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CampaignsProps {
    brandName: string;
    brandConfig: BrandConfig;
    events: CalendarEvent[];
    onUpdateEvents: (events: CalendarEvent[]) => void;
    initialIntent?: { type: 'theme' | 'diverse', theme: string } | null;
    onClearIntent?: () => void;
    recentPosts?: any[];
}

export const Campaigns: React.FC<CampaignsProps> = ({
    brandName,
    brandConfig,
    events,
    onUpdateEvents,
    initialIntent,
    onClearIntent,
    recentPosts = []
}) => {
    // View State: 'list' | 'wizard'
    const [viewMode, setViewMode] = useState<'list' | 'wizard'>('list');
    const [promptProvenance, setPromptProvenance] = useState<string>('Manual Creation');
    const [showBrief, setShowBrief] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'draft' | 'completed'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Wizard State
    const [campaignStep, setCampaignStep] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [campaignType, setCampaignType] = useState<'theme' | 'diverse' | 'notes'>('theme');
    const [campaignTheme, setCampaignTheme] = useState<string>('');
    const [campaignGoal, setCampaignGoal] = useState<string>('User Acquisition');
    const [campaignPlatforms, setCampaignPlatforms] = useState<string[]>(['Twitter']);
    const [campaignContext, setCampaignContext] = useState<string>('');
    const [campaignStrategy, setCampaignStrategy] = useState<CampaignStrategy | null>(null);
    const [contentPlan, setContentPlan] = useState<any>(null);

    // Graphic Settings
    const [campaignTemplate, setCampaignTemplate] = useState<string>('');
    const [campaignReferenceImage, setCampaignReferenceImage] = useState<string | null>(null);

    // Focus Document State
    const [campaignFocusDoc, setCampaignFocusDoc] = useState<string>('');
    const [isUploadingFocusDoc, setIsUploadingFocusDoc] = useState<boolean>(false);
    const focusDocInputRef = useRef<HTMLInputElement>(null);

    const [wizardStep, setWizardStep] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedStrategy, setGeneratedStrategy] = useState<any>(null);
    const [draftContext, setDraftContext] = useState<string>("");
    const [batchProgress, setBatchProgress] = useState<string>("");

    // Quick Mode State
    const [campaignCount, setCampaignCount] = useState<string>('3');
    const [campaignStartDate, setCampaignStartDate] = useState<string>('');
    const [isDraftingCampaign, setIsDraftingCampaign] = useState<boolean>(false);
    const [isGeneratingStrategy, setIsGeneratingStrategy] = useState<boolean>(false);
    const [campaignItems, setCampaignItems] = useState<CampaignItem[]>([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
    const [analyzingCampaign, setAnalyzingCampaign] = useState<string | null>(null);
    const [viewingCampaignDetails, setViewingCampaignDetails] = useState<string | null>(null);
    const [contextStats, setContextStats] = useState<{ activeCampaignsCount: number, brainMemoriesCount: number, strategyDocsCount?: number } | null>(null);
    const [recommendedStrategies, setRecommendedStrategies] = useState<MarketingAction[]>([]);
    const [expandedRecIdx, setExpandedRecIdx] = useState<number | null>(null);

    // UI State
    const [error, setError] = useState<string | null>(null);
    const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const campaignFileInputRef = useRef<HTMLInputElement>(null);

    // --- PERSISTENCE ---
    useEffect(() => {
        const saved = loadCampaignState(brandName);
        if (saved) {
            if (saved.viewMode) setViewMode(saved.viewMode);
            if (saved.campaignStep) setCampaignStep(saved.campaignStep);
            if (saved.campaignType) setCampaignType(saved.campaignType);
            if (saved.campaignTheme) setCampaignTheme(saved.campaignTheme);
            if (saved.campaignGoal) setCampaignGoal(saved.campaignGoal);
            if (saved.campaignPlatforms) setCampaignPlatforms(saved.campaignPlatforms);
            if (saved.campaignStrategy) setCampaignStrategy(saved.campaignStrategy);
            if (saved.campaignTemplate) setCampaignTemplate(saved.campaignTemplate);
            if (saved.campaignReferenceImage) setCampaignReferenceImage(saved.campaignReferenceImage);
            if (saved.campaignItems) setCampaignItems(saved.campaignItems);
            if (saved.campaignStartDate) setCampaignStartDate(saved.campaignStartDate);
            if (saved.contentPlan) setContentPlan(saved.contentPlan);
        }

        try {
            const tasks = loadStrategyTasks(brandName);
            const recommendations: MarketingAction[] = tasks
                .filter((t: any) => {
                    const isHighImpact = (t.impactScore && t.impactScore >= 7) || t.priority === 'high';
                    return t.status !== 'completed' && t.status !== 'dismissed' && isHighImpact;
                })
                .slice(0, 3)
                .map((t: any) => ({
                    type: t.type || 'CAMPAIGN',
                    topic: t.executionPrompt || t.title,
                    hook: t.title,
                    goal: t.description || 'Strategic Growth',
                    reasoning: t.reasoning,
                    strategicAlignment: t.strategicAlignment || '',
                    contentIdeas: t.contentIdeas || [],
                    proof: t.proof || '',
                    logicExplanation: t.logicExplanation || '',
                    content: null
                } as any));
            setRecommendedStrategies(recommendations);
        } catch (e) {
            console.error("Failed to load recommended campaigns", e);
        }
    }, [brandName]);

    useEffect(() => {
        const stateToSave = {
            viewMode, campaignStep, campaignType, campaignTheme, campaignGoal, campaignPlatforms,
            campaignContext, campaignStrategy, campaignTemplate, campaignReferenceImage,
            campaignItems, campaignStartDate, contentPlan
        };
        const timeout = setTimeout(() => {
            saveCampaignState(brandName, stateToSave);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [viewMode, campaignStep, campaignType, campaignTheme, campaignGoal, campaignPlatforms, campaignStrategy, campaignTemplate, campaignReferenceImage, campaignItems, campaignStartDate, contentPlan, brandName]);

    // --- Helpers ---
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

    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setCampaignStartDate(tomorrow.toISOString().split('T')[0]);
    }, []);

    const getActiveCampaigns = () => {
        const campaigns: Record<string, { count: number, nextDate: string, status: string, type: string, budget: string, reach: string, conversion: string, roi: string }> = {};
        events.forEach(e => {
            if (e.campaignName) {
                if (!campaigns[e.campaignName]) {
                    campaigns[e.campaignName] = {
                        count: 0,
                        nextDate: e.date,
                        status: 'Active',
                        type: 'General',
                        budget: '$0',
                        reach: '0',
                        conversion: '0%',
                        roi: '+0%'
                    };
                }
                campaigns[e.campaignName].count++;
                if (new Date(e.date) > new Date(campaigns[e.campaignName].nextDate)) {
                    campaigns[e.campaignName].nextDate = e.date;
                }
                // Check if completed
                const allPast = events.filter(ev => ev.campaignName === e.campaignName).every(ev => new Date(ev.date) < new Date());
                if (allPast) campaigns[e.campaignName].status = 'Completed';
            }
        });
        return Object.entries(campaigns).map(([name, data]) => ({ name, ...data }));
    };

    // --- Actions ---
    const handleGenerateStrategy = async () => {
        if (campaignType === 'theme' && !campaignTheme.trim()) return;

        dispatchThinking("Analyzing Campaign Context...", {
            goal: campaignGoal, type: campaignType, theme: campaignTheme, docProvided: !!campaignFocusDoc
        });

        setIsGeneratingStrategy(true);
        setError(null);
        setDraftContext("");

        try {
            if (campaignType === 'notes') {
                const plan = await analyzeContentNotes(campaignContext, brandName);
                if (!plan) throw new Error("Could not analyze notes");

                setContentPlan(plan);
                const planTheme = plan.theme || "Smart Content Plan";
                setCampaignTheme(planTheme);

                const result = await generateCampaignDrafts(
                    planTheme, brandName, brandConfig, parseInt(campaignCount), plan, "", []
                );

                setDraftContext(result.thinking);

                const items: CampaignItem[] = result.drafts.map((d: any, i: number) => {
                    let resolvedTemplate = d.template || campaignTemplate;
                    if (brandConfig.graphicTemplates && brandConfig.graphicTemplates.length > 0) {
                        const lowerTweet = (d.tweet || '').toLowerCase();
                        const lowerTheme = (planTheme || '').toLowerCase();
                        let smartMatch = null;

                        if (lowerTweet.includes('"') || lowerTweet.includes('said') || lowerTweet.includes(' says') || lowerTweet.includes('- ')) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                t.label.toLowerCase().includes('quote') || (t.category || '').toLowerCase().includes('community')
                            );
                        }

                        if (!smartMatch && (lowerTweet.includes('thread') || lowerTweet.includes('👇') || lowerTweet.includes('1/') || lowerTweet.includes('breakdown'))) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                t.label.toLowerCase().includes('deepdive') || t.label.toLowerCase().includes('header') || (t.category || '').toLowerCase().includes('education')
                            );
                        }

                        if (!smartMatch) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                lowerTheme.includes(t.label.toLowerCase()) || lowerTheme.includes((t.category || '').toLowerCase())
                            );
                        }

                        if (!resolvedTemplate || !brandConfig.graphicTemplates.some(t => t.label === resolvedTemplate)) {
                            resolvedTemplate = smartMatch ? smartMatch.label : undefined;
                        }
                    }

                    return {
                        id: `draft-${Date.now()}-${i}`,
                        tweet: d.tweet, isApproved: false, approvalStatus: 'review', status: 'draft',
                        images: [], campaignColor: undefined, template: resolvedTemplate, reasoning: d.reasoning
                    };
                });

                setCampaignItems(items);
                setCampaignStep(3);
                setIsGeneratingStrategy(false);
                return;
            }

            const activeCampaignsData = getActiveCampaigns();
            const activeContext = activeCampaignsData.map(c => {
                const campaignPosts = events
                    .filter(e => e.campaignName === c.name && new Date(e.date) >= new Date())
                    .slice(0, 3)
                    .map(e => `[${e.date}] ${e.content.substring(0, 50)}...`)
                    .join(' | ');
                return `CAMPAIGN: ${c.name} (${c.status})\n   UPCOMING: ${campaignPosts || "No upcoming posts scheduled."}`;
            });

            const brainLogs = loadBrainLogs(brandName);
            const recentLogs = brainLogs.slice(0, 5).map(l => `[${new Date(l.timestamp).toLocaleDateString()}] ${l.type}: ${l.context}`).join('\n');

            const registry = getBrandRegistryEntry(brandName);
            const { context: ragContext, strategyCount, memoryCount } = await getBrainContext(registry?.brandId);

            setContextStats({
                activeCampaignsCount: activeCampaignsData.length,
                brainMemoriesCount: memoryCount,
                strategyDocsCount: strategyCount
            });

            const strategy = await generateCampaignStrategy(
                campaignGoal,
                campaignType === 'theme' ? campaignTheme : 'Diverse Content Mix',
                campaignPlatforms, campaignContext, activeContext, brandName, brandConfig, recentLogs, campaignFocusDoc, ragContext
            );
            setCampaignStrategy(strategy);
            setCampaignStep(2);
        } catch (err) {
            console.error(err);
            setError(`Failed to generate strategy: ${(err as Error).message}`);
            dispatchThinking("Strategy Generation Failed", { error: (err as Error).message });
        } finally {
            setIsGeneratingStrategy(false);
        }
    };

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
                setBatchProgress(`Drafting Batch ${b + 1}/${batches} (${allItems.length} generated so far)...`);

                const strategyDoc = campaignStrategy ? `
                GENERATED CAMPAIGN STRATEGY (STRICTLY ADHERE TO THIS):
                Target Audience: ${campaignStrategy.targetAudience}
                Strategic Rationale: ${campaignStrategy.strategicRationale}
                Key Messaging Pillars:
                ${campaignStrategy.keyMessaging.map(m => `- ${m}`).join('\n')}
                ` : "";

                const effectiveFocusContent = `${campaignFocusDoc}\n\n${strategyDoc}`.trim();

                const result = await generateCampaignDrafts(
                    themeToSend, brandName, brandConfig, countForBatch, undefined, effectiveFocusContent, recentPosts
                );

                if (!result.drafts || result.drafts.length === 0) {
                    console.warn(`Batch ${b + 1} failed to return drafts.`);
                }

                if (b === 0) setDraftContext(result.thinking);

                const batchItems: CampaignItem[] = result.drafts.map((d: any, i: number) => {
                    let resolvedTemplate = d.template || campaignTemplate;

                    if (brandConfig.graphicTemplates && brandConfig.graphicTemplates.length > 0) {
                        const lowerTweet = (d.tweet || '').toLowerCase();
                        const lowerTheme = (themeToSend || '').toLowerCase();
                        let smartMatch = null;

                        if (lowerTweet.includes(' stated:') || lowerTweet.includes(' announced:') || lowerTweet.match(/"\s+-\s+[a-z]+/i)) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                t.label.toLowerCase().includes('quote') || (t.category || '').toLowerCase().includes('community')
                            );
                        }

                        if (!smartMatch && (lowerTweet.includes('thread') || lowerTweet.includes('👇') || lowerTweet.includes('1/') || lowerTweet.includes('breakdown'))) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                t.label.toLowerCase().includes('deepdive') || t.label.toLowerCase().includes('header') || (t.category || '').toLowerCase().includes('education')
                            );
                        }

                        if (!smartMatch) {
                            smartMatch = brandConfig.graphicTemplates.find(t =>
                                lowerTheme.includes(t.label.toLowerCase()) || lowerTheme.includes((t.category || '').toLowerCase())
                            );
                        }

                        if (!resolvedTemplate || !brandConfig.graphicTemplates.some(t => t.label === resolvedTemplate)) {
                            resolvedTemplate = smartMatch ? smartMatch.label : undefined;
                        }
                    }

                    let finalRefId = d.referenceImageId;
                    if (!finalRefId && resolvedTemplate) {
                        const tmplObj = brandConfig.graphicTemplates?.find(t => t.label === resolvedTemplate);
                        if (tmplObj && tmplObj.referenceImageIds && tmplObj.referenceImageIds.length > 0) {
                            finalRefId = tmplObj.referenceImageIds[Math.floor(Math.random() * tmplObj.referenceImageIds.length)];
                        }
                    }

                    return {
                        id: `draft-${Date.now()}-${b}-${i}`,
                        tweet: d.tweet, isApproved: false, approvalStatus: 'review', status: 'draft',
                        images: [], campaignColor: undefined, template: resolvedTemplate, reasoning: d.reasoning,
                        visualHeadline: d.visualHeadline, artPrompt: d.visualDescription, referenceImageId: finalRefId
                    };
                });

                allItems.push(...batchItems);
                setCampaignItems(prev => [...prev, ...batchItems]);
            }

            if (allItems.length === 0) {
                throw new Error("No drafts were generated. Please check API limits or try a smaller batch.");
            }

            setCampaignStep(3);
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
        setCampaignItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const isApproved = item.approvalStatus === 'approved';
            return { ...item, isApproved: !isApproved, approvalStatus: isApproved ? 'review' : 'approved' };
        }));
    };

    const handleApproveAll = () => {
        setCampaignItems(prev => prev.map(item => ({ ...item, isApproved: true, approvalStatus: 'approved' })));
    };

    const handleDeleteDraft = (id: string) => {
        setCampaignItems(prev => prev.filter(item => item.id !== id));
    };

    const handleGenerateApproved = async () => {
        const approvedItems = campaignItems.filter(i => i.approvalStatus === 'approved');
        if (approvedItems.length === 0) {
            setError("No tweets approved for generation.");
            return;
        }

        setCampaignStep(4);
        setIsBatchProcessing(true);
        setCampaignItems(prev => prev.map(item => item.approvalStatus === 'approved' ? { ...item, status: 'pending' } : item));

        const CHUNK_SIZE = 3;
        for (let i = 0; i < approvedItems.length; i += CHUNK_SIZE) {
            const chunk = approvedItems.slice(i, i + CHUNK_SIZE);

            await Promise.all(chunk.map(async (item) => {
                setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'generating' } : p));

                if (item.skipImage) {
                    await new Promise(r => setTimeout(r, 500));
                    setCampaignItems(prev => prev.map(p => p.id === item.id ? {
                        ...p, status: 'completed', images: [], selectedImageIndex: -1
                    } : p));
                    return;
                }

                try {
                    const effectiveRefImage = item.referenceImageId || campaignReferenceImage || undefined;

                    const promises = [
                        generateWeb3Graphic({ prompt: item.visualHeadline || item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined, artPrompt: item.artPrompt }),
                        generateWeb3Graphic({ prompt: item.visualHeadline || item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined, artPrompt: item.artPrompt })
                    ];
                    await new Promise(r => setTimeout(r, Math.random() * 1000));

                    const images = await Promise.all(promises);
                    setCampaignItems(prev => prev.map(p => p.id === item.id ? {
                        ...p, status: 'completed', images: images, selectedImageIndex: 0
                    } : p));

                    const registry = getBrandRegistryEntry(brandName);
                    if (registry?.brandId) {
                        images.forEach(img => {
                            saveBrainMemory(registry.brandId, 'FACT', `Campaign Asset: ${item.visualHeadline || item.tweet.substring(0, 30)}`, undefined, {
                                mediaUrl: img, source: 'Campaigns', campaign: campaignTheme
                            });
                        });
                    }
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
            const effectiveTemplate = item.template || campaignTemplate || undefined;
            const effectiveRefImage = item.referenceImageId || campaignReferenceImage || undefined;

            const promises = [
                generateWeb3Graphic({ prompt: item.visualHeadline || item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: effectiveTemplate, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined }),
                generateWeb3Graphic({ prompt: item.visualHeadline || item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: effectiveTemplate, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined })
            ];
            const images = await Promise.all(promises);
            setCampaignItems(prev => prev.map(p => p.id === id ? { ...p, status: 'completed', images: images, selectedImageIndex: 0 } : p));

            const registry = getBrandRegistryEntry(brandName);
            if (registry?.brandId) {
                images.forEach(img => {
                    saveBrainMemory(registry.brandId, 'FACT', `Campaign Asset (Regen): ${item.visualHeadline || item.tweet.substring(0, 30)}`, undefined, {
                        mediaUrl: img, source: 'Campaigns', campaign: campaignTheme
                    });
                });
            }
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
                    return { ...item, images: newImages, status: 'completed', selectedImageIndex: newImages.length - 1 };
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
            if (text) setCampaignFocusDoc(text);
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

        const buildScheduledAt = (dateStr: string, time: string) => {
            const scheduled = new Date(`${dateStr}T${time}:00`);
            if (Number.isNaN(scheduled.getTime())) return undefined;
            return scheduled.toISOString();
        };

        const newEvents: CalendarEvent[] = items.map((item, idx) => {
            const date = new Date(startDateObj);
            date.setDate(startDateObj.getDate() + idx);

            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const timeStr = '09:00';

            const selectedImage = (item.images && item.images.length > 0)
                ? item.images[item.selectedImageIndex ?? 0]
                : undefined;

            return {
                id: `evt-camp-${item.id}`, date: dateStr, content: item.tweet, image: selectedImage,
                time: timeStr, scheduledAt: buildScheduledAt(dateStr, timeStr),
                platform: 'Twitter', status: 'scheduled', approvalStatus: 'approved',
                campaignName: campaignTheme || 'Campaign', color: '#4F46E5', reasoning: item.reasoning,
                visualDescription: item.artPrompt, referenceImageId: item.referenceImageId,
                template: item.template, visualHeadline: item.visualHeadline
            };
        });

        const updatedEvents = [...events, ...newEvents];
        onUpdateEvents(updatedEvents);
        saveCalendarEvents(brandName, updatedEvents);

        setCampaignStep(5);
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

    const handleExportCSV = (campaignName: string) => {
        const campaignEvents = events.filter(e => e.campaignName === campaignName).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (campaignEvents.length === 0) {
            alert('No scheduled events found for this campaign.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Date,Time,Platform,Status,Content,Image URL\r\n";

        campaignEvents.forEach(evt => {
            const cleanContent = evt.content.replace(/"/g, '""');
            const row = `${evt.date},${evt.time || ''},${evt.platform},${evt.status},"${cleanContent}",${evt.image || ''}`;
            csvContent += row + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${brandName}_Campaign_${campaignName.replace(/\s+/g, '_')}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPDF = async (campaignName: string) => {
        const campaignEvents = events.filter(e => e.campaignName === campaignName).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (campaignEvents.length === 0) {
            alert('No scheduled events found for this campaign.');
            return;
        }

        const doc = new jsPDF();

        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(`${brandName}: ${campaignName}`, 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Campaign Report generated on ${new Date().toLocaleDateString()}`, 14, 28);
        doc.text(`Total Posts: ${campaignEvents.length}`, 14, 34);

        const tableBody: any[] = [];
        for (const evt of campaignEvents) {
            const rowData = [evt.date, evt.content, evt.status.toUpperCase(), ''];
            tableBody.push(rowData);
        }

        // @ts-ignore
        autoTable(doc, {
            startY: 45,
            head: [['Date', 'Copy', 'Status', 'Visual']],
            body: tableBody,
            columnStyles: {
                0: { cellWidth: 25 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 25 }, 3: { cellWidth: 35, minCellHeight: 25 }
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
                        } catch (e) {}
                    }
                }
            }
        });

        doc.save(`${brandName}_Campaign_${campaignName.replace(/\s+/g, '_')}.pdf`);
    };

    const handleDownloadDraftsPDF = (drafts: CampaignItem[]) => {
        const doc = new jsPDF();

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
            const itemDate = new Date(startDateObj);
            itemDate.setDate(startDateObj.getDate() + i);
            const dateStr = itemDate.toLocaleDateString();

            if (yPos > 250) { doc.addPage(); yPos = 20; }

            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(`Post #${i + 1} (${dateStr})`, 14, yPos);
            yPos += 8;

            doc.setFontSize(11);
            doc.setTextColor(60, 60, 60);

            const manualClean = item.tweet
                .replace(/\*\*/g, '')
                .replace(/^[-•]\s*/gm, '• ')
                .replace(/[^\x00-\x7F]/g, "")
                .replace(/\n\s*\n/g, '\n');

            const splitText = doc.splitTextToSize(manualClean, 180);
            doc.text(splitText, 14, yPos);
            yPos += (splitText.length * 5) + 5;

            const selectedImg = item.images && item.images.length > 0 ? item.images[item.selectedImageIndex || 0] : null;

            if (selectedImg) {
                try {
                    if (yPos + 60 > 280) { doc.addPage(); yPos = 20; }
                    doc.addImage(selectedImg, 'PNG', 14, yPos, 100, 56);
                    yPos += 65;
                } catch (e) {
                    console.error("PDF Image Error", e);
                }
            } else {
                yPos += 10;
            }

            doc.setDrawColor(200, 200, 200);
            doc.line(14, yPos, 196, yPos);
            yPos += 10;
        });

        doc.save(`${brandName}_Drafts_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    // --- RENDER ---
    const activeCampaigns = getActiveCampaigns();
    const approvedCount = campaignItems.filter(i => i.approvalStatus === 'approved').length;

    const filteredCampaigns = activeCampaigns.filter(camp => {
        if (searchQuery && !camp.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (activeTab === 'active' && camp.status !== 'Active') return false;
        if (activeTab === 'completed' && camp.status !== 'Completed') return false;
        if (activeTab === 'draft' && camp.status !== 'Draft') return false;
        return true;
    });

    const totalCampaigns = activeCampaigns.length;
    const activeCampaignsCount = activeCampaigns.filter(c => c.status === 'Active').length;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Active':
                return <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-[#22C55E]/10 text-[#22C55E]">Active</span>;
            case 'Completed':
                return <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-[#4A4A4E]/10 text-[#ADADB0]">Completed</span>;
            case 'Scheduled':
                return <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-[#FF8400]/10 text-[#FF8400]">Scheduled</span>;
            default:
                return <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-[#6B6B70]/10 text-[#6B6B70]">{status}</span>;
        }
    };

    const getCampaignIcon = (name: string, index: number) => {
        const icons = [
            { bg: '#FF5C00', icon: 'rocket_launch' },
            { bg: '#22C55E', icon: 'toll' },
            { bg: '#B2B2FF', icon: 'groups' },
            { bg: '#0088CC', icon: 'send' },
            { bg: '#6B6B70', icon: 'campaign' },
            { bg: '#FFFFFF', icon: 'handshake' },
        ];
        const iconData = icons[index % icons.length];
        return (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconData.bg}18` }}>
                <span className="material-symbols-sharp text-lg" style={{ color: iconData.bg, fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
                    {iconData.icon}
                </span>
            </div>
        );
    };

    return (
        <div className="flex-1 h-full overflow-y-auto bg-[#0A0A0B]">
            <div className="p-8 lg:px-10 space-y-7">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[28px] font-semibold text-white">Campaigns</h1>
                        <p className="text-sm text-[#6B6B70] mt-1">Manage and track your Web3 marketing campaigns</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#111113] border border-[#1F1F23]">
                            <span className="material-symbols-sharp text-[#6B6B70] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search campaigns..."
                                className="bg-transparent border-none text-white placeholder-[#6B6B70] text-sm focus:outline-none w-40"
                            />
                        </div>
                        {/* Filters */}
                        <button className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#111113] border border-[#1F1F23] text-white text-sm font-medium hover:bg-[#1A1A1D] transition-colors">
                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>tune</span>
                            Filters
                        </button>
                        {/* New Campaign */}
                        <button
                            onClick={() => { setViewMode('wizard'); setCampaignStep(1); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                        >
                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 400" }}>add</span>
                            New Campaign
                        </button>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4">
                    {/* Total Campaigns */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-[#6B6B70]">Total Campaigns</span>
                            <span className="material-symbols-sharp text-[#6B6B70] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>folder_open</span>
                        </div>
                        <p className="text-[32px] font-semibold text-white font-mono">{totalCampaigns}</p>
                        <p className="text-xs text-[#22C55E] mt-2">+3 this month</p>
                    </div>
                    {/* Active Campaigns */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-[#6B6B70]">Active Campaigns</span>
                            <span className="material-symbols-sharp text-[#22C55E] text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>radio_button_checked</span>
                        </div>
                        <p className="text-[32px] font-semibold text-white font-mono">{activeCampaignsCount}</p>
                        <p className="text-xs text-[#3B82F6] mt-2">2 launching soon</p>
                    </div>
                    {/* Total Reach */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-[#6B6B70]">Total Reach</span>
                            <span className="material-symbols-sharp text-[#6B6B70] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>visibility</span>
                        </div>
                        <p className="text-[32px] font-semibold text-white font-mono">4.2M</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="material-symbols-sharp text-[#22C55E] text-sm">trending_up</span>
                            <span className="text-xs text-[#22C55E]">+18.2% vs last month</span>
                        </div>
                    </div>
                    {/* Average ROI */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-[#6B6B70]">Average ROI</span>
                            <span className="material-symbols-sharp text-[#22C55E] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>trending_up</span>
                        </div>
                        <p className="text-[32px] font-semibold text-[#22C55E] font-mono">+186%</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="material-symbols-sharp text-[#22C55E] text-sm">trending_up</span>
                            <span className="text-xs text-[#22C55E]">+24% improvement</span>
                        </div>
                    </div>
                </div>

                {/* Campaigns Table */}
                {viewMode === 'list' && (
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl overflow-hidden">
                        {/* Table Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F23]">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-white">All Campaigns</span>
                                <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-[#FF5C00]/20 text-[#FF5C00]">
                                    {totalCampaigns} total
                                </span>
                            </div>
                            {/* Tabs */}
                            <div className="flex items-center gap-1 p-1 rounded-full bg-[#1A1A1D]">
                                {(['all', 'active', 'draft', 'completed'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                            activeTab === tab
                                                ? 'bg-[#FF5C00] text-white'
                                                : 'text-[#6B6B70] hover:text-white'
                                        }`}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table Content */}
                        <div>
                            {/* Table Head */}
                            <div className="flex items-center px-5 py-3 bg-[#0A0A0B] text-[11px] font-semibold text-[#6B6B70] tracking-wide uppercase">
                                <div className="w-[280px]">Campaign</div>
                                <div className="w-[120px]">Type</div>
                                <div className="w-[100px]">Status</div>
                                <div className="w-[100px]">Budget</div>
                                <div className="w-[100px]">Reach</div>
                                <div className="w-[110px]">Conversion</div>
                                <div className="w-[80px]">ROI</div>
                                <div className="flex-1"></div>
                            </div>

                            {/* Table Rows */}
                            {filteredCampaigns.length > 0 ? (
                                filteredCampaigns.map((camp, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center px-5 py-3.5 border-b border-[#1F1F23] hover:bg-[#1A1A1D]/50 transition-colors cursor-pointer"
                                        onClick={() => setViewingCampaignDetails(camp.name)}
                                    >
                                        {/* Campaign Name */}
                                        <div className="w-[280px] flex items-center gap-3">
                                            {getCampaignIcon(camp.name, idx)}
                                            <div>
                                                <p className="text-[13px] font-medium text-white">{camp.name}</p>
                                                <p className="text-[11px] text-[#6B6B70]">
                                                    {camp.status === 'Active' ? `Started ${camp.nextDate}` : `Ended ${camp.nextDate}`}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Type */}
                                        <div className="w-[120px]">
                                            <span className="text-[13px] text-white">General</span>
                                        </div>
                                        {/* Status */}
                                        <div className="w-[100px]">
                                            {getStatusBadge(camp.status)}
                                        </div>
                                        {/* Budget */}
                                        <div className="w-[100px]">
                                            <span className="text-[13px] text-white font-mono">$12,500</span>
                                        </div>
                                        {/* Reach */}
                                        <div className="w-[100px]">
                                            <span className="text-[13px] text-white font-mono">1.2M</span>
                                        </div>
                                        {/* Conversion */}
                                        <div className="w-[110px]">
                                            <span className="text-[13px] text-white font-mono">3.2%</span>
                                        </div>
                                        {/* ROI */}
                                        <div className="w-[80px]">
                                            <span className="text-[13px] font-medium text-[#22C55E] font-mono">+247%</span>
                                        </div>
                                        {/* Actions */}
                                        <div className="flex-1 flex justify-end">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B6B70] hover:text-white hover:bg-[#1F1F23] transition-colors"
                                            >
                                                <span className="material-symbols-sharp text-lg">more_horiz</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-16 flex flex-col items-center justify-center text-center">
                                    <div className="w-14 h-14 rounded-xl bg-[#1F1F23] flex items-center justify-center mb-4">
                                        <span className="material-symbols-sharp text-[#6B6B70] text-2xl">campaign</span>
                                    </div>
                                    <h3 className="text-base font-semibold text-white mb-1">No Campaigns Yet</h3>
                                    <p className="text-sm text-[#6B6B70] max-w-sm mb-5">
                                        Create your first campaign to start tracking performance and ROI.
                                    </p>
                                    <button
                                        onClick={() => { setViewMode('wizard'); setCampaignStep(1); }}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                                    >
                                        <span className="material-symbols-sharp text-lg">add</span>
                                        Create Campaign
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Bottom Row: Performance Chart & Quick Actions */}
                {viewMode === 'list' && filteredCampaigns.length > 0 && (
                    <div className="flex gap-6">
                        {/* Performance Chart */}
                        <div className="flex-1 bg-[#111113] border border-[#1F1F23] rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F23]">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-white">Campaign Performance</span>
                                    <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-[#22C55E]/20 text-[#22C55E]">Live</span>
                                </div>
                                <div className="flex items-center gap-1 p-1 rounded-full bg-[#1A1A1D]">
                                    {['7D', '30D', '90D'].map(period => (
                                        <button
                                            key={period}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                                period === '7D' ? 'bg-[#1F1F23] text-white' : 'text-[#6B6B70] hover:text-white'
                                            }`}
                                        >
                                            {period}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-5">
                                {/* Legend */}
                                <div className="flex items-center gap-5 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#FF5C00]"></span>
                                        <span className="text-xs text-[#6B6B70]">Reach</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
                                        <span className="text-xs text-[#6B6B70]">Conversions</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                                        <span className="text-xs text-[#6B6B70]">Engagement</span>
                                    </div>
                                </div>
                                {/* Bar Chart */}
                                <div className="flex items-end gap-3 h-40">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                                        const heights = [45, 60, 55, 75, 65, 85, 70];
                                        return (
                                            <div key={day} className="flex-1 flex flex-col items-center gap-2">
                                                <div className="w-full flex gap-1 items-end h-32">
                                                    <div className="flex-1 bg-[#FF5C00] rounded-t" style={{ height: `${heights[i]}%` }}></div>
                                                    <div className="flex-1 bg-[#22C55E] rounded-t" style={{ height: `${heights[i] * 0.6}%` }}></div>
                                                    <div className="flex-1 bg-[#3B82F6] rounded-t" style={{ height: `${heights[i] * 0.4}%` }}></div>
                                                </div>
                                                <span className={`text-[10px] ${day === 'Sun' ? 'text-[#FF5C00] font-medium' : 'text-[#6B6B70]'}`}>{day}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="w-80 bg-[#111113] border border-[#1F1F23] rounded-xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-[#1F1F23]">
                                <span className="text-sm font-semibold text-white">Quick Actions</span>
                            </div>
                            <div>
                                {[
                                    { icon: 'add_circle', label: 'Create Campaign', desc: 'Launch a new marketing campaign', color: '#FF5C00' },
                                    { icon: 'content_copy', label: 'Duplicate Campaign', desc: 'Clone an existing campaign', color: '#6B6B70' },
                                    { icon: 'download', label: 'Export Report', desc: 'Download campaign analytics', color: '#6B6B70' },
                                    { icon: 'schedule', label: 'Schedule Campaign', desc: 'Plan future campaign launches', color: '#6B6B70' },
                                ].map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            if (action.label === 'Create Campaign') {
                                                setViewMode('wizard');
                                                setCampaignStep(1);
                                            }
                                        }}
                                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#1A1A1D] transition-colors border-b border-[#1F1F23] last:border-none"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-[#1F1F23] flex items-center justify-center">
                                            <span className="material-symbols-sharp text-xl" style={{ color: action.color, fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
                                                {action.icon}
                                            </span>
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="text-sm font-medium text-white">{action.label}</p>
                                            <p className="text-xs text-[#6B6B70]">{action.desc}</p>
                                        </div>
                                        <span className="material-symbols-sharp text-[#4A4A4E] text-lg">chevron_right</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* WIZARD VIEW */}
                {viewMode === 'wizard' && (
                    <div className="animate-fadeIn">
                        {/* Header with Breadcrumb and Back/Cancel */}
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <div className="flex items-center gap-2 text-sm text-[#6B6B70] mb-2">
                                    <button onClick={() => setViewMode('list')} className="hover:text-white transition-colors">
                                        Campaigns
                                    </button>
                                    <span className="material-symbols-sharp text-xs">chevron_right</span>
                                    <span className="text-white">{campaignStep === 5 ? campaignTheme || 'Campaign' : 'New Campaign'}</span>
                                </div>
                                <h1 className="text-2xl font-semibold text-white">
                                    {campaignStep === 1 && 'Create New Campaign'}
                                    {campaignStep === 2 && 'Review & Generate'}
                                    {campaignStep === 3 && 'Review Content'}
                                    {campaignStep === 4 && 'Generate Assets'}
                                    {campaignStep === 5 && (
                                        <span className="flex items-center gap-2">
                                            Campaign Launched!
                                            <span className="text-2xl">🎉</span>
                                        </span>
                                    )}
                                </h1>
                            </div>
                            {campaignStep === 1 ? (
                                <button
                                    onClick={() => setViewMode('list')}
                                    className="px-4 py-2 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                                >
                                    Cancel
                                </button>
                            ) : campaignStep === 5 ? (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setViewingCampaignDetails(campaignTheme || 'Campaign')}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                                    >
                                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>visibility</span>
                                        View Campaign
                                    </button>
                                    <button
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                                    >
                                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>edit_calendar</span>
                                        Edit Schedule
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setCampaignStep(prev => Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                                >
                                    <span className="material-symbols-sharp text-sm">arrow_back</span>
                                    Back
                                </button>
                            )}
                        </div>

                        {/* Step 1: Config */}
                        {campaignStep === 1 && (
                            <div className="space-y-5">
                                {/* Create Campaign Card */}
                                <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-6">
                                    <h2 className="text-base font-semibold text-white mb-5">Create Campaign</h2>

                                    {/* Campaign Name & Duration Row */}
                                    <div className="flex gap-4 mb-5">
                                        <div className="flex-1">
                                            <label className="text-xs font-medium text-[#6B6B70] mb-2 block">Campaign Name</label>
                                            <input
                                                type="text"
                                                value={campaignTheme}
                                                onChange={(e) => setCampaignTheme(e.target.value)}
                                                placeholder="SolanaAI Token Launch"
                                                className="w-full bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-4 py-3 text-white placeholder-[#4A4A4E] text-sm focus:outline-none focus:border-[#FF5C00] transition-colors"
                                            />
                                        </div>
                                        <div className="w-40">
                                            <label className="text-xs font-medium text-[#6B6B70] mb-2 block">Duration</label>
                                            <select
                                                value={campaignCount}
                                                onChange={(e) => setCampaignCount(e.target.value)}
                                                className="w-full bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#FF5C00] transition-colors appearance-none cursor-pointer"
                                            >
                                                <option value="7">7 days</option>
                                                <option value="14">14 days</option>
                                                <option value="30">30 days</option>
                                                <option value="60">60 days</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Campaign Goals */}
                                    <div className="mb-5">
                                        <label className="text-xs font-medium text-[#6B6B70] mb-2 block">Campaign Goals</label>
                                        <input
                                            type="text"
                                            value={campaignGoal}
                                            onChange={(e) => setCampaignGoal(e.target.value)}
                                            placeholder="10K holders, 50K Twitter followers"
                                            className="w-full bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-4 py-3 text-white placeholder-[#4A4A4E] text-sm focus:outline-none focus:border-[#FF5C00] transition-colors"
                                        />
                                    </div>

                                    {/* Platforms */}
                                    <div className="mb-5">
                                        <label className="text-xs font-medium text-[#6B6B70] mb-3 block">Platforms</label>
                                        <div className="flex gap-3">
                                            {[
                                                { id: 'twitter', label: 'Twitter', icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
                                                { id: 'discord', label: 'Discord', icon: 'M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z' },
                                                { id: 'telegram', label: 'Telegram', icon: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' },
                                            ].map(platform => (
                                                <button
                                                    key={platform.id}
                                                    onClick={() => {
                                                        setCampaignPlatforms(prev =>
                                                            prev.includes(platform.label)
                                                                ? prev.filter(p => p !== platform.label)
                                                                : [...prev, platform.label]
                                                        );
                                                    }}
                                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                                                        campaignPlatforms.includes(platform.label)
                                                            ? 'bg-[#FF5C00]/10 border-[#FF5C00] text-[#FF5C00]'
                                                            : 'bg-[#1A1A1D] border-[#2E2E2E] text-[#6B6B70] hover:border-[#4A4A4E]'
                                                    }`}
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d={platform.icon} />
                                                    </svg>
                                                    {platform.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Additional Context */}
                                    <div>
                                        <label className="text-xs font-medium text-[#6B6B70] mb-2 block">Additional Context <span className="text-[#4A4A4E]">(optional)</span></label>
                                        <textarea
                                            value={campaignContext}
                                            onChange={(e) => setCampaignContext(e.target.value)}
                                            placeholder="Add any extra context, talking points, key messages, or specific angles you want the AI to focus on..."
                                            rows={3}
                                            className="w-full bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-4 py-3 text-white placeholder-[#4A4A4E] text-sm focus:outline-none focus:border-[#FF5C00] transition-colors resize-none"
                                        />
                                        <p className="text-[11px] text-[#4A4A4E] mt-1.5">This context will be used by the AI CMO when generating your campaign strategy and content.</p>
                                    </div>
                                </div>

                                {/* AI CMO Recommended Campaigns */}
                                <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)' }}>
                                                <span className="material-symbols-sharp text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                            </div>
                                            <span className="text-base font-semibold text-white">AI CMO Recommended Campaigns</span>
                                        </div>
                                        <span className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-[#FF5C00]/10 text-[#FF5C00] border border-[#FF5C00]/20">
                                            Based on your data
                                        </span>
                                    </div>
                                    <p className="text-sm text-[#6B6B70] mb-5">
                                        {recommendedStrategies.length > 0
                                            ? `Based on your strategy tasks and market analysis, here are ${recommendedStrategies.length} campaign ${recommendedStrategies.length === 1 ? 'idea' : 'ideas'} I recommend:`
                                            : 'Enter a campaign topic below, or type your own idea to get started:'}
                                    </p>

                                    {/* Recommendation Cards */}
                                    {recommendedStrategies.length > 0 && (
                                        <div className="space-y-3 mb-6">
                                            <div className="grid grid-cols-3 gap-4">
                                                {recommendedStrategies.map((rec: any, idx: number) => {
                                                    const badges = ['TOP PICK', 'HIGH ROI', 'TRENDING'];
                                                    const badgeColors = ['#22C55E', '#F59E0B', '#8B5CF6'];
                                                    // Strip action type prefixes like "TREND_JACK:", "REPLY:", "CAMPAIGN:" from titles
                                                    const rawTitle = rec.hook || rec.topic || `Strategy ${idx + 1}`;
                                                    const recTitle = rawTitle.replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY|CAMPAIGN_IDEA)\s*:\s*/i, '').trim() || rawTitle;
                                                    const recDesc = rec.reasoning || `Campaign opportunity: ${rec.topic || rec.hook || 'Strategic growth initiative'}`;
                                                    const cleanDesc = recDesc.replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY)\s*:\s*/i, '').trim();
                                                    const isExpanded = expandedRecIdx === idx;
                                                    const isSelected = campaignTheme === recTitle;
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`rounded-xl border-2 text-left transition-all ${
                                                                isSelected
                                                                    ? 'border-[#22C55E] bg-[#22C55E]/5'
                                                                    : 'border-[#1F1F23] hover:border-[#2E2E2E]'
                                                            }`}
                                                        >
                                                            {/* Card Header — clickable to select */}
                                                            <button
                                                                onClick={() => {
                                                                    setCampaignTheme(recTitle);
                                                                    setCampaignType('theme');
                                                                }}
                                                                className="w-full p-4 text-left"
                                                            >
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                                                                        isSelected ? 'bg-[#22C55E]' : 'border border-[#2E2E2E]'
                                                                    }`}>
                                                                        {isSelected && (
                                                                            <span className="material-symbols-sharp text-white text-sm">check</span>
                                                                        )}
                                                                    </div>
                                                                    <span
                                                                        className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide flex-shrink-0"
                                                                        style={{
                                                                            backgroundColor: `${badgeColors[idx % badgeColors.length]}15`,
                                                                            color: badgeColors[idx % badgeColors.length]
                                                                        }}
                                                                    >
                                                                        {badges[idx % badges.length]}
                                                                    </span>
                                                                    <span className="text-sm font-semibold text-white flex-1 line-clamp-2">{recTitle}</span>
                                                                </div>
                                                                <p className="text-xs text-[#6B6B70] leading-relaxed line-clamp-3">{cleanDesc}</p>
                                                            </button>

                                                            {/* Expand toggle */}
                                                            <button
                                                                onClick={() => setExpandedRecIdx(isExpanded ? null : idx)}
                                                                className="w-full px-4 py-2 text-[10px] font-medium text-[#6B6B70] hover:text-white border-t border-[#1F1F23] flex items-center justify-center gap-1 transition-colors"
                                                            >
                                                                {isExpanded ? 'Hide Details' : 'View Details'}
                                                                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Expanded Detail Panel — appears below the grid */}
                                            {expandedRecIdx !== null && recommendedStrategies[expandedRecIdx] && (() => {
                                                const rec = recommendedStrategies[expandedRecIdx] as any;
                                                const rawTitle = rec.hook || rec.topic || '';
                                                const cleanTitle = rawTitle.replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY|CAMPAIGN_IDEA)\s*:\s*/i, '').trim() || rawTitle;
                                                const reasoning = (rec.reasoning || '').replace(/^(TREND_JACK|REPLY|CAMPAIGN|GAP_FILL|COMMUNITY)\s*:\s*/i, '').trim();
                                                const typeLabel = (rec.type || 'CAMPAIGN').replace(/_/g, ' ');
                                                const contentIdeas = rec.contentIdeas || [];
                                                const strategicAlign = rec.strategicAlignment || '';
                                                const proof = rec.proof || '';
                                                const logicExplanation = rec.logicExplanation || '';
                                                return (
                                                    <div className="rounded-xl bg-[#0A0A0B] border border-[#1F1F23] p-5 animate-in fade-in duration-200">
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1.5">
                                                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-[#FF5C00]/10 text-[#FF5C00]">{typeLabel}</span>
                                                                    <span className="text-[10px] text-[#4A4A4E]">Campaign Recommendation #{expandedRecIdx + 1}</span>
                                                                </div>
                                                                <h4 className="text-white text-base font-semibold">{cleanTitle}</h4>
                                                            </div>
                                                            <button onClick={() => setExpandedRecIdx(null)} className="p-1 rounded-md hover:bg-[#1F1F23] text-[#6B6B70] hover:text-white transition-colors">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-5">
                                                            {/* Left: Reasoning + Strategic Alignment */}
                                                            <div className="space-y-4">
                                                                {reasoning && (
                                                                    <div>
                                                                        <h5 className="text-[11px] font-semibold text-[#FF5C00] tracking-wider mb-1.5">STRATEGIC REASONING</h5>
                                                                        <p className="text-[#ADADB0] text-[13px] leading-relaxed">{reasoning}</p>
                                                                    </div>
                                                                )}
                                                                {strategicAlign && (
                                                                    <div>
                                                                        <h5 className="text-[11px] font-semibold text-[#8B5CF6] tracking-wider mb-1.5">STRATEGIC ALIGNMENT</h5>
                                                                        <p className="text-[#8B8B8F] text-[12px] leading-relaxed">{strategicAlign}</p>
                                                                    </div>
                                                                )}
                                                                {logicExplanation && (
                                                                    <div>
                                                                        <h5 className="text-[11px] font-semibold text-[#3B82F6] tracking-wider mb-1.5">LOGIC</h5>
                                                                        <p className="text-[#8B8B8F] text-[12px] leading-relaxed">{logicExplanation}</p>
                                                                    </div>
                                                                )}
                                                                {proof && (
                                                                    <div>
                                                                        <h5 className="text-[11px] font-semibold text-[#22C55E] tracking-wider mb-1.5">SUPPORTING EVIDENCE</h5>
                                                                        <p className="text-[#8B8B8F] text-[12px] leading-relaxed">{proof}</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Right: Content Ideas + Goal */}
                                                            <div className="space-y-4">
                                                                {contentIdeas.length > 0 && (
                                                                    <div>
                                                                        <h5 className="text-[11px] font-semibold text-[#F59E0B] tracking-wider mb-1.5">CONTENT IDEAS</h5>
                                                                        <div className="space-y-1.5">
                                                                            {contentIdeas.map((idea: string, j: number) => (
                                                                                <div key={j} className="flex items-start gap-2 text-[12px] text-[#ADADB0]">
                                                                                    <span className="text-[#FF5C00] mt-0.5 flex-shrink-0">•</span>
                                                                                    <span>{idea}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {rec.goal && (
                                                                    <div>
                                                                        <h5 className="text-[11px] font-semibold text-[#6B6B70] tracking-wider mb-1.5">GOAL</h5>
                                                                        <p className="text-[#8B8B8F] text-[12px]">{rec.goal}</p>
                                                                    </div>
                                                                )}
                                                                {rec.topic && (
                                                                    <div>
                                                                        <h5 className="text-[11px] font-semibold text-[#6B6B70] tracking-wider mb-1.5">TOPIC</h5>
                                                                        <p className="text-[#8B8B8F] text-[12px]">{rec.topic}</p>
                                                                    </div>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        setCampaignTheme(cleanTitle);
                                                                        setCampaignType('theme');
                                                                        setExpandedRecIdx(null);
                                                                    }}
                                                                    className="w-full mt-2 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors flex items-center justify-center gap-2"
                                                                >
                                                                    <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                                                    Use This Strategy
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {error && (
                                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                                            {error}
                                        </div>
                                    )}

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleGenerateStrategy}
                                        disabled={isGeneratingStrategy || !campaignTheme.trim()}
                                        className="w-full py-4 rounded-xl bg-[#FF5C00] text-white font-semibold hover:bg-[#FF6B1A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-base"
                                    >
                                        {isGeneratingStrategy ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Generating Campaign...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                                Generate Campaign
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Review & Generate */}
                        {campaignStep === 2 && campaignStrategy && (
                            <div className="flex gap-6">
                                {/* Left Column - Main Content */}
                                <div className="flex-1 space-y-5">
                                    {/* Campaign Summary Card */}
                                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-base font-semibold text-white">Campaign Summary</h2>
                                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1F1F23] text-white text-xs font-medium hover:bg-[#2A2A2D] transition-colors">
                                                <span className="material-symbols-sharp text-sm">edit</span>
                                                Edit
                                            </button>
                                        </div>

                                        <div className="space-y-5">
                                            {/* Campaign Name */}
                                            <div>
                                                <label className="text-xs text-[#6B6B70] mb-1 block">Campaign Name</label>
                                                <p className="text-base font-semibold text-white">{campaignTheme} Campaign</p>
                                            </div>

                                            {/* Campaign Type */}
                                            <div>
                                                <label className="text-xs text-[#6B6B70] mb-1 block">Campaign Type</label>
                                                <p className="text-sm font-medium text-white">Token/NFT Launch</p>
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <label className="text-xs text-[#6B6B70] mb-1 block">Description</label>
                                                <p className="text-sm text-[#ADADB0] leading-relaxed">
                                                    {campaignStrategy.strategicRationale || `Launching ${campaignTheme} - a strategic marketing campaign. Features include coordinated social media push, community engagement, and influencer outreach.`}
                                                </p>
                                            </div>

                                            {/* Duration, Start Date, End Date */}
                                            <div className="grid grid-cols-3 gap-6">
                                                <div>
                                                    <label className="text-xs text-[#6B6B70] mb-1 block">Duration</label>
                                                    <p className="text-sm font-medium text-white">{campaignCount} Days</p>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-[#6B6B70] mb-1 block">Start Date</label>
                                                    <p className="text-sm font-medium text-white">
                                                        {campaignStartDate ? new Date(campaignStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-[#6B6B70] mb-1 block">End Date</label>
                                                    <p className="text-sm font-medium text-white">
                                                        {campaignStartDate ? new Date(new Date(campaignStartDate).getTime() + (parseInt(campaignCount) * 24 * 60 * 60 * 1000)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Target Platforms */}
                                            <div>
                                                <label className="text-xs text-[#6B6B70] mb-2 block">Target Platforms</label>
                                                <div className="flex gap-2">
                                                    {campaignPlatforms.map(platform => (
                                                        <span
                                                            key={platform}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                                                                platform === 'Twitter' ? 'bg-[#1DA1F2]/10 border-[#1DA1F2]/30 text-[#1DA1F2]' :
                                                                platform === 'Discord' ? 'bg-[#5865F2]/10 border-[#5865F2]/30 text-[#5865F2]' :
                                                                'bg-[#0088CC]/10 border-[#0088CC]/30 text-[#0088CC]'
                                                            }`}
                                                        >
                                                            {platform === 'Twitter' && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
                                                            {platform === 'Discord' && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963.021-.04.001-.088-.041-.104a13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/></svg>}
                                                            {platform === 'Telegram' && <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>}
                                                            {platform}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Target Audience & Goals */}
                                            <div className="grid grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-xs text-[#6B6B70] mb-1 block">Target Audience</label>
                                                    <p className="text-sm text-white">{campaignStrategy.targetAudience || 'Crypto traders, DeFi enthusiasts, AI tech adopters'}</p>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-[#6B6B70] mb-1 block">Campaign Goals</label>
                                                    <p className="text-sm text-white">{campaignGoal || 'Token awareness, community growth, pre-launch signups'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content to be Generated */}
                                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-6">
                                        <h3 className="text-base font-semibold text-white mb-5">Content to be Generated</h3>
                                        <div className="grid grid-cols-4 gap-4">
                                            {[
                                                { icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z', label: 'Twitter', count: `${Math.ceil(parseInt(campaignCount) * 0.6)} posts`, color: '#1DA1F2' },
                                                { icon: 'M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.175 13.175 0 0 1-1.872-.878.075.075 0 0 1-.008-.125 10.814 10.814 0 0 0 .372-.287.074.074 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.196.373.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028z', label: 'Discord', count: `${Math.ceil(parseInt(campaignCount) * 0.3)} announcements`, color: '#5865F2' },
                                                { icon: 'image', label: 'Graphics', count: `${Math.ceil(parseInt(campaignCount) * 0.4)} images`, color: '#E91E63', isIcon: true },
                                                { icon: 'article', label: 'Threads', count: `${Math.ceil(parseInt(campaignCount) * 0.2)} threads`, color: '#4CAF50', isIcon: true },
                                            ].map((item, i) => (
                                                <div key={i} className="bg-[#1A1A1D] rounded-xl p-4 border border-[#1F1F23]">
                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${item.color}20` }}>
                                                        {item.isIcon ? (
                                                            <span className="material-symbols-sharp text-xl" style={{ color: item.color, fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                                                        ) : (
                                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={item.color}><path d={item.icon}/></svg>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-medium text-white">{item.label}</p>
                                                    <p className="text-xs text-[#6B6B70]">{item.count}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* AI Content Strategy */}
                                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)' }}>
                                                    <span className="material-symbols-sharp text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                                                </div>
                                                <span className="text-base font-semibold text-white">AI Content Strategy</span>
                                            </div>
                                            <span className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
                                                Optimized
                                            </span>
                                        </div>
                                        <p className="text-sm text-[#6B6B70] mb-5">
                                            Based on your inputs and market analysis, here's the optimized content strategy:
                                        </p>

                                        <div className="grid grid-cols-3 gap-4">
                                            {[
                                                { icon: 'calendar_today', color: '#FF5C00', days: 'Day 1-2', title: 'Teaser content & community building' },
                                                { icon: 'rocket_launch', color: '#22C55E', days: 'Day 3-4', title: 'Launch announcement & feature highlights' },
                                                { icon: 'trending_up', color: '#F59E0B', days: 'Day 5-7', title: 'Engagement & momentum building' },
                                            ].map((phase, i) => (
                                                <div key={i} className="bg-[#1A1A1D] rounded-xl p-4 border border-[#1F1F23]">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-symbols-sharp text-lg" style={{ color: phase.color, fontVariationSettings: "'FILL' 1" }}>{phase.icon}</span>
                                                        <span className="text-sm font-semibold text-white">{phase.days}</span>
                                                    </div>
                                                    <p className="text-xs text-[#6B6B70]">{phase.title}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Sidebar */}
                                <div className="w-80 space-y-5">
                                    {/* Predicted Performance */}
                                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-5">
                                        <div className="flex items-center gap-2 mb-5">
                                            <span className="material-symbols-sharp text-[#22C55E] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                                            <span className="text-sm font-semibold text-white">Predicted Performance</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                            {[
                                                { value: '45K+', label: 'Impressions', color: '#FF5C00' },
                                                { value: '2.8K', label: 'Engagements', color: '#22C55E' },
                                                { value: '850', label: 'New Followers', color: '#3B82F6' },
                                            ].map((stat, i) => (
                                                <div key={i} className="text-center">
                                                    <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                                                    <p className="text-[10px] text-[#6B6B70]">{stat.label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        <p className="text-[10px] text-[#4A4A4E] text-center">
                                            Based on similar token launch campaigns in the Solana ecosystem
                                        </p>
                                    </div>

                                    {/* Ready to Generate */}
                                    <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-5">
                                        <div className="flex justify-center mb-4">
                                            <div className="w-16 h-16 rounded-full bg-[#FF5C00]/10 flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-[#FF5C00]/20 flex items-center justify-center">
                                                    <div className="w-8 h-8 rounded-full bg-[#FF5C00] animate-pulse"></div>
                                                </div>
                                            </div>
                                        </div>

                                        <h3 className="text-base font-semibold text-white text-center mb-2">Ready to Generate</h3>
                                        <p className="text-xs text-[#6B6B70] text-center mb-5">
                                            AI CMO will generate all content based on your campaign settings. You'll review and approve each post before launching.
                                        </p>

                                        <button
                                            onClick={handleDraftCampaign}
                                            disabled={isDraftingCampaign}
                                            className="w-full py-4 rounded-xl bg-[#FF5C00] text-white font-semibold hover:bg-[#FF6B1A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-base"
                                        >
                                            {isDraftingCampaign ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    {batchProgress || 'Generating...'}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                                    Generate Content
                                                </>
                                            )}
                                        </button>

                                        <p className="text-[10px] text-[#4A4A4E] text-center mt-3">
                                            After generation, you'll review each post and select graphics before launching your campaign.
                                        </p>
                                    </div>

                                    {/* Back Button */}
                                    <button
                                        onClick={() => setCampaignStep(1)}
                                        className="w-full py-3 rounded-lg bg-[#1F1F23] text-white font-medium hover:bg-[#2A2A2D] transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-sharp text-lg">arrow_back</span>
                                        Back to Setup
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Content Preview / Draft Review */}
                        {campaignStep === 3 && (
                            <div className="space-y-6">
                                {/* Campaign Title Row */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-xl font-semibold text-white">{campaignTheme} Campaign</h2>
                                        <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1F1F23] text-white border border-[#2E2E2E]">
                                            {campaignItems.length} Posts to Review
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            handleApproveAll();
                                            handleGenerateApproved();
                                        }}
                                        disabled={campaignItems.length === 0}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] disabled:opacity-50 transition-colors"
                                    >
                                        <span className="material-symbols-sharp text-lg">check</span>
                                        Approve All & Launch
                                    </button>
                                </div>

                                {/* Post Cards */}
                                <div className="space-y-5">
                                    {campaignItems.map((item, i) => {
                                        const scheduledDate = new Date();
                                        scheduledDate.setDate(scheduledDate.getDate() + i + 1);
                                        const isApproved = item.approvalStatus === 'approved';
                                        const isEditing = editingDraftId === item.id;

                                        return (
                                            <div
                                                key={item.id}
                                                className={`bg-[#111113] border rounded-xl overflow-hidden transition-all ${
                                                    isApproved ? 'border-[#22C55E]/50' : 'border-[#1F1F23]'
                                                }`}
                                            >
                                                {/* Card Header */}
                                                <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F23]">
                                                    <div className="flex items-center gap-4">
                                                        {/* Number Badge */}
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                                                            isApproved ? 'bg-[#22C55E] text-white' : 'bg-[#FF5C00] text-white'
                                                        }`}>
                                                            {isApproved ? (
                                                                <span className="material-symbols-sharp text-lg">check</span>
                                                            ) : (
                                                                i + 1
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                                                                <span className="text-sm font-medium text-white">Tweet + Graphic</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-1 text-xs text-[#6B6B70]">
                                                                <span className="material-symbols-sharp text-sm">calendar_today</span>
                                                                Scheduled: {scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at 9:00 AM
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Status Badge */}
                                                    <span className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                                                        isApproved
                                                            ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20'
                                                            : 'bg-[#FF5C00]/10 text-[#FF5C00] border border-[#FF5C00]/20'
                                                    }`}>
                                                        <span className="material-symbols-sharp text-sm">{isApproved ? 'check_circle' : 'schedule'}</span>
                                                        {isApproved ? 'Approved' : 'Pending Review'}
                                                    </span>
                                                </div>

                                                {/* Card Content */}
                                                <div className="p-5">
                                                    <div className="flex gap-6">
                                                        {/* Left: Tweet Content */}
                                                        <div className="flex-1">
                                                            <label className="text-xs text-[#FF5C00] font-medium mb-3 block">Tweet Content</label>
                                                            <div className="bg-[#0A0A0B] border border-[#1F1F23] rounded-xl p-4 min-h-[140px]">
                                                                {isEditing ? (
                                                                    <textarea
                                                                        value={item.tweet}
                                                                        onChange={(e) => handleUpdateDraft(item.id, e.target.value)}
                                                                        className="w-full bg-transparent text-white text-sm resize-none focus:outline-none min-h-[120px]"
                                                                        autoFocus
                                                                    />
                                                                ) : (
                                                                    <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                                                                        {item.tweet}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Right: Graphics Selection */}
                                                        <div className="w-[380px]">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <label className="text-xs text-[#FF5C00] font-medium">
                                                                    {item.images && item.images.length > 0 ? 'Selected Graphic' : 'Select Graphic (3 options)'}
                                                                </label>
                                                                {item.images && item.images.length > 0 && (
                                                                    <button
                                                                        onClick={() => handleRegenerateItem(item.id)}
                                                                        disabled={item.status === 'generating'}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F1F23] text-white text-xs font-medium hover:bg-[#2A2A2D] disabled:opacity-50 transition-colors"
                                                                    >
                                                                        <span className="material-symbols-sharp text-sm">refresh</span>
                                                                        Generate More
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Image Grid or Placeholder */}
                                                            {item.status === 'generating' ? (
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {[1, 2, 3].map(n => (
                                                                        <div key={n} className="aspect-square rounded-xl bg-[#1A1A1D] border border-[#1F1F23] flex items-center justify-center">
                                                                            <div className="w-6 h-6 border-2 border-[#FF5C00]/30 border-t-[#FF5C00] rounded-full animate-spin"></div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : item.images && item.images.length > 0 ? (
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {item.images.slice(0, 3).map((img, imgIdx) => (
                                                                        <button
                                                                            key={imgIdx}
                                                                            onClick={() => handleSelectImage(item.id, imgIdx)}
                                                                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                                                                                item.selectedImageIndex === imgIdx
                                                                                    ? 'border-[#22C55E] ring-2 ring-[#22C55E]/30'
                                                                                    : 'border-[#1F1F23] hover:border-[#4A4A4E]'
                                                                            }`}
                                                                        >
                                                                            <img src={img} alt="" className="w-full h-full object-cover" />
                                                                            {item.selectedImageIndex === imgIdx && (
                                                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                                                                    <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-[#22C55E]">
                                                                                        <span className="material-symbols-sharp text-xs">check</span>
                                                                                        Selected
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {item.selectedImageIndex !== imgIdx && (
                                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                                                                                    <span className="text-[10px] font-medium text-white">Click to Select</span>
                                                                                </div>
                                                                            )}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {[1, 2, 3].map(n => (
                                                                        <div key={n} className="aspect-square rounded-xl bg-[#1A1A1D] border border-[#1F1F23] flex flex-col items-center justify-center gap-2 text-[#4A4A4E]">
                                                                            <span className="material-symbols-sharp text-2xl">image</span>
                                                                            <span className="text-[10px]">No image</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card Footer */}
                                                <div className="flex items-center justify-between px-5 py-4 border-t border-[#1F1F23] bg-[#0A0A0B]/50">
                                                    <button
                                                        onClick={() => setEditingDraftId(isEditing ? null : item.id)}
                                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F1F23] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                                                    >
                                                        <span className="material-symbols-sharp text-lg">edit</span>
                                                        {isEditing ? 'Done Editing' : 'Edit Tweet'}
                                                    </button>

                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => handleDeleteDraft(item.id)}
                                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#EF4444]/10 text-[#EF4444] text-sm font-medium hover:bg-[#EF4444]/20 border border-[#EF4444]/20 transition-colors"
                                                        >
                                                            <span className="material-symbols-sharp text-lg">close</span>
                                                            Reject
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleApproval(item.id)}
                                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                                isApproved
                                                                    ? 'bg-[#22C55E] text-white hover:bg-[#16A34A]'
                                                                    : 'bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 border border-[#22C55E]/20'
                                                            }`}
                                                        >
                                                            <span className="material-symbols-sharp text-lg">check</span>
                                                            {isApproved ? 'Approved' : 'Approve Post'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Empty State */}
                                {campaignItems.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 rounded-xl bg-[#1F1F23] flex items-center justify-center mb-4">
                                            <span className="material-symbols-sharp text-[#6B6B70] text-3xl">article</span>
                                        </div>
                                        <h3 className="text-lg font-semibold text-white mb-2">No Content Generated</h3>
                                        <p className="text-sm text-[#6B6B70] max-w-sm mb-5">
                                            Go back to the previous step to generate content for your campaign.
                                        </p>
                                        <button
                                            onClick={() => setCampaignStep(2)}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                                        >
                                            <span className="material-symbols-sharp text-lg">arrow_back</span>
                                            Back to Generate
                                        </button>
                                    </div>
                                )}

                                {/* Bottom Action Bar */}
                                {campaignItems.length > 0 && (
                                    <div className="flex items-center justify-between pt-4 border-t border-[#1F1F23]">
                                        <div className="text-sm text-[#6B6B70]">
                                            <span className="text-[#22C55E] font-semibold">{approvedCount}</span> of {campaignItems.length} posts approved
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setCampaignStep(2)}
                                                className="px-5 py-2.5 rounded-lg bg-[#1F1F23] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={handleGenerateApproved}
                                                disabled={approvedCount === 0 || isBatchProcessing}
                                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-semibold hover:bg-[#FF6B1A] disabled:opacity-50 transition-colors"
                                            >
                                                {isBatchProcessing ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-sharp text-lg">auto_awesome</span>
                                                        Generate Graphics ({approvedCount})
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 4: Asset Generation */}
                        {campaignStep === 4 && (
                            <div className="max-w-5xl space-y-5">
                                {/* Stepper */}
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 bg-[#1F1F23] rounded-lg p-1">
                                        {[1, 2, 3, 4].map((step) => (
                                            <div key={step} className={`h-1.5 w-8 rounded-full transition-all ${campaignStep >= step ? 'bg-[#FF5C00]' : 'bg-[#4A4A4E]'}`}></div>
                                        ))}
                                    </div>
                                    <span className="text-xs font-mono text-[#6B6B70] pl-2">Step {campaignStep}/4</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">Generate Campaign Assets</h2>
                                        <p className="text-sm text-[#6B6B70]">
                                            {isBatchProcessing ? 'Generating images...' : `${campaignItems.filter(i => i.status === 'completed').length} of ${campaignItems.filter(i => i.approvalStatus === 'approved').length} assets ready`}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {campaignItems.filter(i => i.approvalStatus === 'approved').map((item, i) => (
                                        <div key={item.id} className="bg-[#111113] border border-[#1F1F23] rounded-xl overflow-hidden">
                                            {/* Image Area */}
                                            <div className="aspect-video bg-[#0A0A0B] relative">
                                                {item.status === 'generating' && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-8 h-8 border-2 border-[#FF5C00]/30 border-t-[#FF5C00] rounded-full animate-spin"></div>
                                                    </div>
                                                )}
                                                {item.status === 'completed' && item.images && item.images.length > 0 && (
                                                    <img
                                                        src={item.images[item.selectedImageIndex || 0]}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                                {item.status === 'error' && (
                                                    <div className="absolute inset-0 flex items-center justify-center text-red-400">
                                                        <span className="material-symbols-sharp text-3xl">error</span>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Content */}
                                            <div className="p-4">
                                                <p className="text-sm text-white line-clamp-2">{item.tweet}</p>
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => handleRegenerateItem(item.id)}
                                                        disabled={item.status === 'generating'}
                                                        className="flex-1 py-2 text-xs font-medium rounded-lg bg-[#1F1F23] text-white hover:bg-[#2A2A2D] disabled:opacity-50 transition-colors"
                                                    >
                                                        Regenerate
                                                    </button>
                                                    {item.images && item.images.length > 0 && (
                                                        <button
                                                            onClick={() => handleDownload(item.images![item.selectedImageIndex || 0], `post-${i + 1}`)}
                                                            className="py-2 px-3 text-xs font-medium rounded-lg bg-[#1F1F23] text-white hover:bg-[#2A2A2D] transition-colors"
                                                        >
                                                            <span className="material-symbols-sharp text-sm">download</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3 pt-4 col-span-2">
                                    <button
                                        onClick={() => setCampaignStep(3)}
                                        className="px-6 py-3 rounded-lg bg-[#1F1F23] text-white font-medium hover:bg-[#2A2A2D] transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={() => handleBatchScheduleCampaign(campaignItems.filter(i => i.approvalStatus === 'approved'))}
                                        disabled={isBatchProcessing || campaignItems.filter(i => i.status === 'completed').length === 0}
                                        className="flex-1 py-3 rounded-xl bg-[#22C55E] text-white font-semibold hover:bg-[#16A34A] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-sharp text-lg">calendar_month</span>
                                        Schedule All to Calendar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Campaign Launched */}
                        {campaignStep === 5 && (
                            <div className="space-y-6">
                                {/* Success Banner */}
                                <div className="bg-[#111113] border border-[#1F1F23] rounded-xl p-6">
                                    <div className="flex items-start gap-5">
                                        {/* Success Icon */}
                                        <div className="w-14 h-14 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-sharp text-3xl text-[#22C55E]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check_circle</span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-white mb-1">Your campaign has been scheduled!</h3>
                                            <p className="text-sm text-[#6B6B70]">
                                                All posts have been added to your content calendar. You can view and manage them anytime.
                                            </p>
                                            {/* Quick Stats */}
                                            <div className="flex items-center gap-6 mt-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center">
                                                        <span className="material-symbols-sharp text-lg text-[#FF5C00]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>article</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-semibold text-white font-mono">{campaignItems.filter(i => i.approvalStatus === 'approved').length}</p>
                                                        <p className="text-[10px] text-[#6B6B70] uppercase tracking-wide">Posts</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                                                        <span className="material-symbols-sharp text-lg text-[#3B82F6]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>calendar_month</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-semibold text-white font-mono">{campaignCount}</p>
                                                        <p className="text-[10px] text-[#6B6B70] uppercase tracking-wide">Days</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Two Column Layout */}
                                <div className="flex gap-6">
                                    {/* Left Column: Campaign Details */}
                                    <div className="flex-1 space-y-6">
                                        {/* Campaign Details Card */}
                                        <div className="bg-[#111113] border border-[#1F1F23] rounded-xl overflow-hidden">
                                            <div className="px-5 py-4 border-b border-[#1F1F23]">
                                                <h3 className="text-sm font-semibold text-white">Campaign Details</h3>
                                            </div>
                                            <div className="p-5 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-[#6B6B70]">Campaign Name</span>
                                                    <span className="text-sm font-medium text-white">{campaignTheme || 'Untitled Campaign'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-[#6B6B70]">Duration</span>
                                                    <span className="text-sm font-medium text-white">{campaignCount} days</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-[#6B6B70]">Type</span>
                                                    <span className="text-sm font-medium text-white capitalize">{campaignType === 'theme' ? 'Themed Campaign' : campaignType === 'diverse' ? 'Diverse Mix' : 'Notes-based'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-[#6B6B70]">Target Audience</span>
                                                    <span className="text-sm font-medium text-white">{campaignStrategy?.targetAudience || 'Web3 Community'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Predicted Performance */}
                                    <div className="w-80">
                                        <div className="bg-[#111113] border border-[#1F1F23] rounded-xl overflow-hidden">
                                            <div className="px-5 py-4 border-b border-[#1F1F23]">
                                                <h3 className="text-sm font-semibold text-white">Predicted Performance</h3>
                                            </div>
                                            <div className="p-5 space-y-4">
                                                {[
                                                    { label: 'Impressions', value: '45K+', icon: 'visibility', color: '#FF5C00' },
                                                    { label: 'Engagements', value: '2.8K', icon: 'favorite', color: '#22C55E' },
                                                    { label: 'New Followers', value: '850', icon: 'person_add', color: '#3B82F6' },
                                                ].map((metric, i) => (
                                                    <div key={i} className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${metric.color}15` }}>
                                                            <span className="material-symbols-sharp text-xl" style={{ color: metric.color, fontVariationSettings: "'FILL' 1, 'wght' 300" }}>{metric.icon}</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-xs text-[#6B6B70]">{metric.label}</p>
                                                            <p className="text-lg font-semibold text-white font-mono">{metric.value}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Scheduled Content Grid */}
                                <div className="bg-[#111113] border border-[#1F1F23] rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F1F23]">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-sm font-semibold text-white">Scheduled Content</h3>
                                            <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-[#22C55E]/10 text-[#22C55E]">
                                                {campaignItems.filter(i => i.approvalStatus === 'approved').length} scheduled
                                            </span>
                                        </div>
                                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1F1F23] text-white text-xs font-medium hover:bg-[#2A2A2D] transition-colors">
                                            <span className="material-symbols-sharp text-sm">calendar_month</span>
                                            View Calendar
                                        </button>
                                    </div>
                                    <div className="p-5">
                                        <div className="grid grid-cols-3 gap-4">
                                            {(() => {
                                                const approvedItems = campaignItems.filter(i => i.approvalStatus === 'approved');
                                                let startDateObj = new Date();
                                                if (campaignStartDate) {
                                                    const parts = campaignStartDate.split('-');
                                                    startDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                                } else {
                                                    startDateObj.setDate(startDateObj.getDate() + 1);
                                                }

                                                return approvedItems.map((item, i) => {
                                                    const itemDate = new Date(startDateObj);
                                                    itemDate.setDate(startDateObj.getDate() + i);
                                                    const selectedImg = item.images && item.images.length > 0 ? item.images[item.selectedImageIndex || 0] : null;

                                                    return (
                                                        <div key={item.id} className="bg-[#0A0A0B] border border-[#1F1F23] rounded-xl overflow-hidden group hover:border-[#2E2E2E] transition-colors">
                                                            {/* Image */}
                                                            <div className="aspect-[16/10] bg-[#1A1A1D] relative overflow-hidden">
                                                                {selectedImg ? (
                                                                    <img src={selectedImg} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <span className="material-symbols-sharp text-3xl text-[#4A4A4E]">image</span>
                                                                    </div>
                                                                )}
                                                                {/* Number Badge */}
                                                                <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-[#FF5C00] flex items-center justify-center text-white text-xs font-semibold">
                                                                    {i + 1}
                                                                </div>
                                                            </div>
                                                            {/* Content */}
                                                            <div className="p-4">
                                                                {/* Date */}
                                                                <div className="flex items-center gap-1.5 text-xs text-[#6B6B70] mb-2">
                                                                    <span className="material-symbols-sharp text-sm">calendar_today</span>
                                                                    {itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </div>
                                                                {/* Tweet Preview */}
                                                                <p className="text-sm text-white line-clamp-2">{item.tweet}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Actions */}
                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        onClick={() => {
                                            setViewMode('list');
                                            setCampaignStep(1);
                                            setCampaignItems([]);
                                            setCampaignTheme('');
                                            setCampaignStrategy(null);
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F1F23] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                                    >
                                        <span className="material-symbols-sharp text-lg">arrow_back</span>
                                        Back to Campaigns
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCampaignStep(1);
                                            setCampaignItems([]);
                                            setCampaignTheme('');
                                            setCampaignStrategy(null);
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                                    >
                                        <span className="material-symbols-sharp text-lg">add</span>
                                        Create Another Campaign
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* VIEW CAMPAIGN DETAILS MODAL */}
                {viewingCampaignDetails && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[#111113] border border-[#1F1F23] rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                            <div className="p-5 border-b border-[#1F1F23] flex justify-between items-center">
                                <div>
                                    <h3 className="font-semibold text-lg text-white">{viewingCampaignDetails}</h3>
                                    <p className="text-xs text-[#6B6B70] mt-1">Campaign Posts</p>
                                </div>
                                <button
                                    onClick={() => setViewingCampaignDetails(null)}
                                    className="w-8 h-8 rounded-lg bg-[#1F1F23] flex items-center justify-center text-[#6B6B70] hover:text-white transition-colors"
                                >
                                    <span className="material-symbols-sharp">close</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {events.filter(e => e.campaignName === viewingCampaignDetails).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(post => (
                                    <div key={post.id} className="bg-[#0A0A0B] border border-[#1F1F23] rounded-xl p-4">
                                        <div className="flex items-start gap-4">
                                            <div className="text-center">
                                                <p className="text-xs text-[#6B6B70]">{new Date(post.date).toLocaleDateString(undefined, { month: 'short' })}</p>
                                                <p className="text-lg font-semibold text-white">{new Date(post.date).getDate()}</p>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-white">{post.content}</p>
                                                {post.reasoning && (
                                                    <p className="text-xs text-[#6B6B70] mt-2 italic">Strategy: {post.reasoning}</p>
                                                )}
                                            </div>
                                            {post.image && (
                                                <img src={post.image} alt="" className="w-20 h-20 object-cover rounded-lg" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {events.filter(e => e.campaignName === viewingCampaignDetails).length === 0 && (
                                    <div className="text-center py-12 text-[#6B6B70]">No posts found for this campaign.</div>
                                )}
                            </div>
                            <div className="p-5 border-t border-[#1F1F23] flex gap-3">
                                <button
                                    onClick={() => handleExportCSV(viewingCampaignDetails)}
                                    className="px-4 py-2.5 rounded-lg bg-[#1F1F23] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                                >
                                    Export CSV
                                </button>
                                <button
                                    onClick={() => handleExportPDF(viewingCampaignDetails)}
                                    className="px-4 py-2.5 rounded-lg bg-[#1F1F23] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                                >
                                    Export PDF
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Hidden File Inputs */}
                <input type="file" ref={campaignFileInputRef} onChange={handleCampaignImageUpload} accept="image/*" className="hidden" />
                <input type="file" ref={focusDocInputRef} onChange={handleFocusDocUpload} accept=".txt,.pdf,.doc,.docx" className="hidden" />
            </div>
        </div>
    );
};
