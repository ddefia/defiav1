import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import ReactMarkdown from 'react-markdown';
import { generateWeb3Graphic, generateCampaignDrafts, generateCampaignStrategy, analyzeContentNotes } from '../services/gemini';
import { getBrainContext } from '../services/pulse'; // New Import

import { saveCalendarEvents, saveCampaignState, loadCampaignState, loadBrainLogs } from '../services/storage';
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

    const [campaignColor, setCampaignColor] = useState<string>('#4F46E5'); // Default Indigo
    const [activeTab, setActiveTab] = useState<'wizard' | 'list'>('list');
    const [wizardStep, setWizardStep] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedStrategy, setGeneratedStrategy] = useState<any>(null); // Store content plan
    const [draftContext, setDraftContext] = useState<string>(""); // Store AI Thinking

    // Quick Mode State
    const [campaignCount, setCampaignCount] = useState<string>('3');
    const [campaignStartDate, setCampaignStartDate] = useState<string>('');
    const [isDraftingCampaign, setIsDraftingCampaign] = useState<boolean>(false);
    const [isGeneratingStrategy, setIsGeneratingStrategy] = useState<boolean>(false); // NEW
    const [campaignItems, setCampaignItems] = useState<CampaignItem[]>([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
    const [analyzingCampaign, setAnalyzingCampaign] = useState<string | null>(null); // New State
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

        setIsGeneratingStrategy(true);
        setError(null);

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
                    0, // Count invalid for smart plan
                    plan, // Pass the plan
                    "", // Focus Content (none)
                    [] // Recent Posts (none for notes mode)
                );

                setDraftContext(result.thinking); // Capture thinking

                // Parse & Set Items (Reusing logic from handleDraftCampaign - ideally refactor this)
                let textToParse = result.content;
                const colorMatch = textToParse.match(/THEME_COLOR:\s*(#[0-9a-fA-F]{3,6})/i);
                if (colorMatch) {
                    setCampaignColor(colorMatch[1]);
                    textToParse = textToParse.replace(colorMatch[0], '').trim();
                }

                const splitDrafts = textToParse.split(/---/).map(t => t.trim()).filter(t => t.length > 0);
                const items: CampaignItem[] = splitDrafts.map((txt, i) => {
                    let tweetContent = txt;
                    let detectedTemplate = campaignTemplate;
                    const templateMatch = txt.match(/^\[(.*?)\]/);
                    if (templateMatch) {
                        detectedTemplate = templateMatch[1];
                        tweetContent = txt.replace(templateMatch[0], '').trim();
                    }
                    return {
                        id: `draft-${Date.now()}-${i}`,
                        tweet: tweetContent,
                        isApproved: true,
                        status: 'draft',
                        images: [],
                        campaignColor: colorMatch ? colorMatch[1] : campaignColor,
                        template: detectedTemplate
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
            setError("Failed to generate strategy.");
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

                // Pass strategy context to drafting if available
                const enhancedTheme = campaignStrategy
                    ? `${themeToSend}. STRATEGY CONTEXT: Audience: ${campaignStrategy.targetAudience}. Messages: ${campaignStrategy.keyMessaging.join(', ')}.`
                    : themeToSend;

                // GENERATION CALL
                const result = await generateCampaignDrafts(
                    enhancedTheme,
                    brandName,
                    brandConfig,
                    countForBatch,
                    undefined, // No content plan for quick mode
                    campaignFocusDoc, // Pass Focus Doc
                    recentPosts
                );

                if (b === 0) setDraftContext(result.thinking); // 🧠 Set Brain Thinking Logic from first batch

                let textToParse = result.content;

                // Extract Theme Color if AI Suggests one (only from first batch)
                if (b === 0) {
                    const colorMatch = textToParse.match(/THEME_COLOR:\s*(#[0-9a-fA-F]{3,6})/i);
                    if (colorMatch) {
                        setCampaignColor(colorMatch[1]);
                        textToParse = textToParse.replace(colorMatch[0], '').trim();
                    }
                }

                const splitDrafts = textToParse.split(/---/)
                    .map(d => d.trim())
                    .filter(d => d.length > 0);

                const batchItems: CampaignItem[] = splitDrafts.map((txt, i) => {
                    let tweetContent = txt;
                    let detectedTemplate = campaignTemplate;

                    const templateMatch = txt.match(/^\[(.*?)\]/);
                    if (templateMatch) {
                        detectedTemplate = templateMatch[1];
                        tweetContent = txt.replace(templateMatch[0], '').trim();
                    }

                    return {
                        id: `draft-${Date.now()}-${b}-${i}`,
                        tweet: tweetContent,
                        isApproved: true,
                        status: 'draft',
                        images: [],
                        campaignColor: campaignColor,
                        template: detectedTemplate
                    };
                });

                allItems.push(...batchItems);
                // Update specific items state progressively so user sees progress
                setCampaignItems(prev => [...prev, ...batchItems]);
            }

            setCampaignStep(3); // Move to Review
        } catch (err) {
            setError("Failed to draft campaign.");
            console.error(err);
        } finally {
            setIsDraftingCampaign(false);
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
                try {
                    const promises = [
                        generateWeb3Graphic({ prompt: item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImages: campaignReferenceImage ? [campaignReferenceImage] : undefined }),
                        generateWeb3Graphic({ prompt: item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImages: campaignReferenceImage ? [campaignReferenceImage] : undefined })
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
                generateWeb3Graphic({ prompt: item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: effectiveTemplate, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined }),
                generateWeb3Graphic({ prompt: item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: effectiveTemplate, selectedReferenceImages: effectiveRefImage ? [effectiveRefImage] : undefined })
            ];
            const images = await Promise.all(promises);
            setCampaignItems(prev => prev.map(p => p.id === id ? { ...p, status: 'completed', images: images, selectedImageIndex: 0 } : p));
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
                color: campaignColor
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


    // --- RENDER ---
    const activeCampaigns = getActiveCampaigns();
    const approvedCount = campaignItems.filter(i => i.isApproved).length;

    return (
        <div className="w-full max-w-7xl mx-auto p-6 space-y-6">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display font-bold text-brand-text">Campaigns</h1>
                    <p className="text-brand-muted">Manage multi-post strategic campaigns.</p>
                </div>
                {viewMode === 'list' && (
                    <Button onClick={() => { setViewMode('wizard'); setCampaignStep(1); }} className="shadow-lg shadow-brand-accent/20">
                        + New Campaign
                    </Button>
                )}
                {viewMode === 'wizard' && (
                    <Button onClick={() => setViewMode('list')} variant="secondary">
                        Back to List
                    </Button>
                )}
            </div>

            {/* LIST VIEW */}
            {viewMode === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeCampaigns.map((camp, idx) => (
                        <div key={idx} className="bg-white border border-brand-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-lg text-brand-text break-words line-clamp-2">{camp.name}</h3>
                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">{camp.status}</span>
                            </div>
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-brand-muted">Posts</span>
                                    <span className="font-medium">{camp.count}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-brand-muted">Latest Date</span>
                                    <span className="font-medium">{camp.nextDate}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <Button variant="outline" className="flex-1 text-xs" onClick={() => setAnalyzingCampaign(camp.name)}>Analytics</Button>
                                <Button variant="secondary" className="text-xs px-2" onClick={() => handleExportCSV(camp.name)} title="Download CSV">CSV</Button>
                                <Button variant="secondary" className="text-xs px-2" onClick={() => handleExportPDF(camp.name)} title="Download PDF">PDF</Button>
                            </div>
                        </div>
                    ))}
                    {activeCampaigns.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 rounded-xl">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-3xl">🎯</div>
                            <h3 className="text-xl font-bold text-brand-text">No Active Campaigns</h3>
                            <p className="text-brand-muted max-w-md mt-2 mb-6">
                                Campaigns allow you to schedule a sequence of posts around a specific theme or launch.
                            </p>
                            <Button onClick={() => { setViewMode('wizard'); setCampaignStep(1); }}>Start Your First Campaign</Button>
                        </div>
                    )}
                </div>
            )}

            {/* WIZARD VIEW */}
            {viewMode === 'wizard' && (
                <div className="w-full animate-fadeIn transition-all duration-500">

                    {/* WIZARD CONTAINER */}
                    <div className={`mx-auto space-y-6 transition-all duration-500 ${campaignStep === 1 ? 'max-w-xl' : 'max-w-7xl'}`}>

                        {/* Stepper */}
                        <div className="flex items-center justify-between px-2 bg-white p-4 rounded-xl border border-brand-border shadow-sm">
                            <div className={`flex flex-col items-center ${campaignStep >= 1 ? 'text-brand-accent' : 'text-gray-300'}`}>
                                <div className="w-2 h-2 rounded-full bg-current mb-1" />
                                <span className="text-[10px] font-bold">CONFIG</span>
                            </div>
                            <div className={`h-[1px] flex-1 mx-2 ${campaignStep >= 2 ? 'bg-brand-accent' : 'bg-gray-200'}`} />
                            <div className={`flex flex-col items-center ${campaignStep >= 2 ? 'text-brand-accent' : 'text-gray-300'}`}>
                                <div className="w-2 h-2 rounded-full bg-current mb-1" />
                                <span className="text-[10px] font-bold">STRATEGY</span>
                            </div>
                            <div className={`h-[1px] flex-1 mx-2 ${campaignStep >= 3 ? 'bg-brand-accent' : 'bg-gray-200'}`} />
                            <div className={`flex flex-col items-center ${campaignStep >= 3 ? 'text-brand-accent' : 'text-gray-300'}`}>
                                <div className="w-2 h-2 rounded-full bg-current mb-1" />
                                <span className="text-[10px] font-bold">REVIEW</span>
                            </div>
                            <div className={`h-[1px] flex-1 mx-2 ${campaignStep >= 4 ? 'bg-brand-accent' : 'bg-gray-200'}`} />
                            <div className={`flex flex-col items-center ${campaignStep >= 4 ? 'text-brand-accent' : 'text-gray-300'}`}>
                                <div className="w-2 h-2 rounded-full bg-current mb-1" />
                                <span className="text-[10px] font-bold">DONE</span>
                            </div>
                        </div>

                        {/* STEP 1: CONFIG */}
                        {campaignStep === 1 && (
                            <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-brand-muted uppercase mb-2 block">Campaign Type</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCampaignType('theme')}
                                            className={`flex-1 py-2 text-xs rounded border transition-colors ${campaignType === 'theme' ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text border-brand-border hover:bg-gray-50'}`}
                                        >
                                            Specific Theme
                                        </button>
                                        <button
                                            onClick={() => setCampaignType('diverse')}
                                            className={`flex-1 py-2 text-xs rounded border transition-colors ${campaignType === 'diverse' ? 'bg-brand-text text-white border-brand-text' : 'bg-white text-brand-text border-brand-border hover:bg-gray-50'}`}
                                        >
                                            Diverse Mix
                                        </button>
                                        <button
                                            onClick={() => setCampaignType('notes')}
                                            className={`flex-1 py-2 text-xs rounded border transition-colors ${campaignType === 'notes' ? 'bg-brand-accent text-white border-brand-accent' : 'bg-white text-brand-text border-brand-border hover:bg-gray-50'}`}
                                        >
                                            ✨ Smart Plan
                                        </button>
                                    </div>
                                </div>

                                {campaignType === 'theme' && (
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
                                )}

                                {campaignType === 'diverse' && (
                                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-800">
                                        <p className="font-bold mb-1">Diverse Mix Mode</p>
                                        The AI will automatically generate a balanced week of content covering Education, Community, Market Insights, and Product Updates.
                                    </div>
                                )}

                                {campaignType === 'notes' && (
                                    <div>
                                        <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Raw Content Notes</label>
                                        <textarea
                                            value={campaignContext}
                                            onChange={e => setCampaignContext(e.target.value)}
                                            placeholder="Paste your rough notes here (e.g. valid URLs, bullet points, specific instructions like 'No GMs' or 'Credit this user'). The AI will parse this into a structured plan."
                                            className="w-full bg-indigo-50/50 border border-indigo-200 rounded-lg p-3 text-sm text-brand-text focus:border-brand-accent outline-none shadow-sm min-h-[150px] font-mono"
                                        />
                                        <p className="text-[10px] text-brand-muted mt-2">
                                            The AI will extract links, identify rules, and create one post per item.
                                        </p>
                                    </div>
                                )}


                                {campaignType !== 'notes' && (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Campaign Goal</label>
                                            <Select
                                                label="Campaign Goal"
                                                value={campaignGoal}
                                                onChange={(e) => setCampaignGoal(e.target.value)}
                                                options={[
                                                    { value: 'User Acquisition', label: 'User Acquisition' },
                                                    { value: 'Brand Awareness', label: 'Brand Awareness' },
                                                    { value: 'Community Engagement', label: 'Community Engagement' },
                                                    { value: 'Product Education', label: 'Product Education' }
                                                ]}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Campaign Scenario / Context (Optional)</label>
                                            <textarea
                                                value={campaignContext}
                                                onChange={e => setCampaignContext(e.target.value)}
                                                placeholder="Describe the specific situation (e.g., 'We are launching v2 next week and need to hype the new features...')"
                                                className="w-full bg-white border border-brand-border rounded-lg p-3 text-sm text-brand-text focus:border-brand-accent outline-none shadow-sm min-h-[80px]"
                                            />
                                        </div>

                                        {/* STRATEGIC FOCUS DOCUMENT */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-xs font-bold text-brand-muted uppercase">Strategic Focus Document (Optional)</label>
                                                <input
                                                    type="file"
                                                    ref={focusDocInputRef}
                                                    onChange={handleFocusDocUpload}
                                                    accept=".pdf,.txt,.md"
                                                    className="hidden"
                                                />
                                                <button
                                                    onClick={() => focusDocInputRef.current?.click()}
                                                    disabled={isUploadingFocusDoc}
                                                    className="text-[10px] text-brand-accent hover:underline flex items-center gap-1"
                                                >
                                                    {isUploadingFocusDoc ? 'Uploading...' : 'Upload PDF/Text'}
                                                </button>
                                            </div>
                                            <textarea
                                                value={campaignFocusDoc}
                                                onChange={e => setCampaignFocusDoc(e.target.value)}
                                                placeholder="Paste strategy text here or upload a document. The AI will prioritize this over general knowledge base."
                                                className="w-full bg-white border border-brand-border rounded-lg p-3 text-sm text-brand-text focus:border-brand-accent outline-none shadow-sm min-h-[100px]"
                                            />
                                        </div>

                                    </>
                                )}

                                {campaignType !== 'notes' && (
                                    <Select label="Tweet Count" value={campaignCount} onChange={e => setCampaignCount(e.target.value)} options={[{ value: '3', label: '3 Tweets' }, { value: '5', label: '5 Tweets' }, { value: '7', label: '7 Tweets' }, { value: '50', label: '50 Tweets (Mega Batch)' }]} />
                                )}

                                <div className="space-y-4 pt-4 border-t border-brand-border">
                                    {/* Visual Style Selection */}
                                    <div>
                                        <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Visual Style (Optional)</label>
                                        <p className="text-[10px] text-brand-muted mb-2">Leave as "Default" to let AI automatically mix content types (images, threads, text) based on the post topic.</p>
                                        <select
                                            value={campaignTemplate}
                                            onChange={(e) => setCampaignTemplate(e.target.value)}
                                            className="w-full bg-white border border-brand-border rounded-lg p-2 text-xs text-brand-text outline-none"
                                        >
                                            <option value="">No Template (Default)</option>
                                            <option value="Partnership">Partnership</option>
                                            <option value="Campaign">Campaign Launch</option>
                                            <option value="Giveaway">Giveaway</option>
                                            <option value="Events">Event</option>
                                            <option value="Speaker Scenes">Speaker Quote</option>
                                            {/* Custom Templates */}
                                            {(brandConfig.graphicTemplates || []).map(t => (
                                                <option key={t.id} value={t.label}>{t.label} (Custom)</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Reference Image Selection */}
                                    <div>
                                        <label className="text-xs font-bold text-brand-muted uppercase mb-2 block">Reference Image (Optional)</label>
                                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                            <div
                                                onClick={() => setCampaignReferenceImage(null)}
                                                className={`flex-shrink-0 w-16 h-16 rounded border-2 cursor-pointer flex items-center justify-center bg-gray-50 ${!campaignReferenceImage ? 'border-brand-accent' : 'border-transparent'}`}
                                            >
                                                <span className="text-[10px] text-gray-400">None</span>
                                            </div>
                                            {brandConfig.referenceImages.map(img => (
                                                <div
                                                    key={img.id}
                                                    onClick={() => setCampaignReferenceImage(campaignReferenceImage === img.id ? null : img.id)}
                                                    className={`flex-shrink-0 w-16 h-16 rounded border-2 cursor-pointer overflow-hidden relative group ${campaignReferenceImage === img.id ? 'border-brand-accent' : 'border-transparent'}`}
                                                    title={img.name}
                                                >
                                                    <img src={img.data || img.url} className="w-full h-full object-cover" />
                                                    {campaignReferenceImage === img.id && (
                                                        <div className="absolute inset-0 bg-brand-accent/20 flex items-center justify-center">
                                                            <div className="w-2 h-2 bg-brand-accent rounded-full shadow-sm" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <Button onClick={handleGenerateStrategy} isLoading={isGeneratingStrategy} disabled={campaignType === 'theme' && !campaignTheme} className="w-full shadow-lg shadow-indigo-500/20">
                                    {campaignType === 'notes' ? 'Analyze Notes & Create Plan' : 'Next: Generate Strategy'}
                                </Button>
                            </div>
                        )}

                        {/* STEP 2: STRATEGY REVIEW & EDIT */}
                        {/* STEP 2: STRATEGY REVIEW (READ ONLY SUMMARY) */}
                        {campaignStep === 2 && campaignStrategy && (
                            <div className="bg-white border border-brand-border rounded-xl p-8 shadow-sm space-y-8 animate-fadeIn">
                                <div className="flex justify-between items-start">
                                    <div>
                                        {campaignContext && (
                                            <div className="text-[10px] items-center gap-2 text-brand-muted uppercase font-bold mb-2 flex">
                                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Context Active</span>
                                                Context Source: Manual Input
                                            </div>
                                        )}
                                        <h3 className="text-2xl font-display font-bold text-brand-text mb-2">Campaign Strategy</h3>
                                        <div className="flex items-center gap-4 text-sm text-brand-textSecondary">
                                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-brand-accent"></span>{campaignGoal}</span>
                                            <span className="text-gray-300">|</span>
                                            <span>Target: {campaignStrategy.estimatedResults.impressions} Impressions</span>
                                        </div>
                                    </div>
                                    {/* Estimated Results Mini-Card */}
                                    <div className="flex gap-4">
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-brand-text">{campaignStrategy.estimatedResults.engagement}</div>
                                            <div className="text-[10px] text-brand-muted uppercase tracking-wider">Target Eng.</div>
                                        </div>
                                        <div className="w-px bg-gray-100 h-10"></div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-green-600">{campaignStrategy.estimatedResults.conversions}</div>
                                            <div className="text-[10px] text-brand-muted uppercase tracking-wider">Conv. Goal</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 pt-8">
                                    {/* AUDIENCE & MESSAGING */}
                                    {/* AI THINKING BOX */}
                                    {draftContext && (
                                        <div className="mb-6 bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 animate-fadeIn">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">🧠</div>
                                                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-widest">Brain Logic</h3>
                                            </div>
                                            <div className="prose prose-sm max-w-none text-indigo-900/80 text-xs">
                                                <ReactMarkdown>{draftContext}</ReactMarkdown>
                                            </div>
                                        </div>
                                    )}

                                    {/* GENERATED DRAFTS LIST */}
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2 block">Target Audience</label>
                                            <p className="text-brand-text leading-relaxed text-sm">
                                                {campaignStrategy.targetAudience}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2 block">Key Messaging</label>
                                            <ul className="space-y-3">
                                                {campaignStrategy.keyMessaging.map((msg, i) => (
                                                    <li key={i} className="flex gap-3 text-sm text-brand-text">
                                                        <span className="w-5 h-5 rounded-full bg-brand-accent/10 text-brand-accent text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">{i + 1}</span>
                                                        <span>{msg}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* PLATFORM STRATEGY */}
                                    <div>
                                        <label className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2 block">Platform Strategy</label>
                                        <div className="space-y-3">
                                            {campaignStrategy.channelStrategy.map((s, i) => (
                                                <div key={i} className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-bold text-brand-text text-sm">{s.channel}</span>
                                                        <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500 font-medium">{s.focus}</span>
                                                    </div>
                                                    <p className="text-xs text-brand-textSecondary leading-relaxed">{s.rationale}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* SCHEDULING INPUT in STRATEGY STEP */}
                                <div className="pt-6 border-t border-gray-100">
                                    <label className="text-xs font-bold text-brand-muted uppercase block mb-2">Start Date</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="date"
                                            value={campaignStartDate}
                                            onChange={(e) => setCampaignStartDate(e.target.value)}
                                            className="bg-white border border-gray-200 rounded p-2 text-sm text-brand-text focus:border-brand-accent outline-none hover:border-gray-300 transition-colors"
                                        />
                                        <span className="text-xs text-brand-muted">
                                            Campaign will launch on this date.
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button variant="secondary" onClick={() => setCampaignStep(1)}>Back</Button>
                                    <Button onClick={handleDraftCampaign} isLoading={isDraftingCampaign} className="flex-1 shadow-lg shadow-brand-accent/20 h-12 text-base">
                                        Generate Content Drafts
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: REVIEW SUMMARY */}
                        {campaignStep === 3 && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="flex justify-between items-center mb-2">
                                    <div>
                                        <h2 className="text-2xl font-display font-bold text-brand-text">Review Content</h2>
                                        <p className="text-sm text-brand-muted">Review and refine the AI-generated drafts.</p>
                                    </div>

                                    <div className="flex gap-3">
                                        <button onClick={() => setCampaignStep(2)} className="text-sm text-brand-muted hover:text-brand-text px-4 py-2">Back</button>
                                        <Button onClick={handleGenerateApproved} className="shadow-lg shadow-brand-accent/20">
                                            Finalize & Generate Assets
                                        </Button>
                                    </div>
                                </div>

                                {/* METADATA BAR */}
                                <div className="bg-white border border-brand-border rounded-xl p-4 flex justify-between items-center shadow-sm">
                                    <div className="flex gap-6 text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-brand-muted uppercase">Approved</span>
                                            <span className="font-bold text-green-600">{approvedCount} Posts</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-brand-muted uppercase">Est. Assets</span>
                                            <span className="font-bold text-brand-text">{approvedCount * 2} Graphics</span>
                                        </div>
                                    </div>

                                    {/* Color Picker (Subtle) */}
                                    <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
                                        <label className="text-[10px] font-bold text-brand-muted uppercase">Theme Color</label>
                                        <div className="relative group">
                                            <div className="w-8 h-8 rounded-full shadow-sm border border-gray-200 cursor-pointer" style={{ backgroundColor: campaignColor }}></div>
                                            <input
                                                type="color"
                                                value={campaignColor}
                                                onChange={(e) => setCampaignColor(e.target.value)}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    {campaignItems.map((item, idx) => (
                                        <div key={item.id} className={`group bg-white border rounded-xl overflow-hidden transition-all duration-300 ${item.isApproved ? 'border-brand-border shadow-sm hover:shadow-md hover:border-brand-accent/30' : 'border-gray-100 opacity-60 grayscale-[0.5]'}`}>
                                            <div className="p-1 pl-4 bg-gray-50 border-b border-brand-border/50 flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Post {idx + 1}</span>
                                                <div className="flex items-center">
                                                    <button
                                                        onClick={() => handleToggleApproval(item.id)}
                                                        className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-l ${item.isApproved ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}
                                                    >
                                                        {item.isApproved ? '✓ Approved' : '✕ Discarded'}
                                                    </button>
                                                    {/* Delete button option */}
                                                    <button onClick={() => handleDeleteDraft(item.id)} className="px-3 py-1.5 border-l border-gray-200 text-gray-400 hover:text-red-500 transition-colors">
                                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="p-5 flex gap-6 h-[280px]">
                                                {/* CONTENT */}
                                                <div className="flex-1 flex flex-col h-full">
                                                    <textarea
                                                        value={item.tweet}
                                                        onChange={(e) => handleUpdateDraft(item.id, e.target.value)}
                                                        className="w-full flex-1 bg-transparent border-none p-0 text-brand-text text-base resize-none focus:ring-0 leading-relaxed placeholder-gray-300 font-medium"
                                                        placeholder="Draft content..."
                                                    />
                                                </div>

                                                {/* SETTINGS SIDEBAR */}
                                                <div className="w-[180px] shrink-0 space-y-4 pt-1 flex flex-col justify-between">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-brand-muted uppercase block mb-1">Visual Template</label>
                                                        <select
                                                            value={item.template || ''}
                                                            onChange={(e) => {
                                                                const newVal = e.target.value;
                                                                setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, template: newVal } : p));
                                                            }}
                                                            className="w-full text-[11px] border border-gray-200 rounded px-2 py-1.5 text-brand-text bg-white outline-none focus:border-brand-accent hover:border-gray-300 transition-colors cursor-pointer"
                                                        >
                                                            <option value="">Auto (Default)</option>
                                                            <option value="Partnership">Partnership</option>
                                                            <option value="Campaign Launch">Campaign Launch</option>
                                                            <option value="Giveaway">Giveaway</option>
                                                            <option value="Event">Event</option>
                                                            <option value="Speaker Quote">Speaker Quote</option>
                                                            {(brandConfig.graphicTemplates || []).map(t => (
                                                                <option key={t.id} value={t.label}>{t.label}</option>
                                                            ))}
                                                        </select>
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
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl font-display font-bold text-brand-text">Campaign Assets</h2>
                                        <Button
                                            onClick={() => {
                                                const allScripts = campaignItems.map(i => i.tweet).join('\n\n---\n\n');
                                                navigator.clipboard.writeText(allScripts);
                                                alert("All scripts copied to clipboard!");
                                            }}
                                            variant="secondary"
                                            className="text-xs py-1 px-3 h-7 flex items-center gap-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                            Copy All Scripts (Recap)
                                        </Button>
                                    </div>
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
                                                    className="bg-transparent border-none p-0 text-sm text-brand-text w-full focus:ring-0 min-h-[120px]"
                                                    rows={5}
                                                    placeholder="Tweet content..."
                                                />
                                                <Button onClick={() => handlePrepareTweet(item.tweet)} variant="secondary" className="h-8 text-xs py-0 whitespace-nowrap">Post</Button>
                                            </div>

                                            {/* Advanced Overrides */}
                                            <div className="flex gap-2 mb-2 pt-2 border-t border-gray-200">
                                                <select
                                                    value={item.template || campaignTemplate || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setCampaignItems(prev => prev.map(i => i.id === item.id ? { ...i, template: val } : i));
                                                    }}
                                                    className="flex-1 bg-white border border-gray-200 rounded text-[10px] p-1.5 focus:border-brand-accent outline-none"
                                                >
                                                    <option value="">Default Template</option>
                                                    <option value="Partnership">Partnership</option>
                                                    <option value="Campaign Link">Campaign Link</option>
                                                    <option value="Campaign Launch">Campaign Launch</option>
                                                    <option value="Giveaway">Giveaway</option>
                                                    <option value="Events">Event</option>
                                                    <option value="Speaker Scenes">Speaker Quote</option>
                                                    {(brandConfig.graphicTemplates || []).map(t => (
                                                        <option key={t.id} value={t.label}>{t.label} (Custom)</option>
                                                    ))}
                                                </select>

                                                <select
                                                    value={item.referenceImageId || campaignReferenceImage || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setCampaignItems(prev => prev.map(i => i.id === item.id ? { ...i, referenceImageId: val || undefined } : i));
                                                    }}
                                                    className="flex-1 bg-white border border-gray-200 rounded text-[10px] p-1.5 focus:border-brand-accent outline-none"
                                                >
                                                    <option value="">Default Style</option>
                                                    {brandConfig.referenceImages.map(img => (
                                                        <option key={img.id} value={img.id}>{img.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Visual Refinement Input */}
                                            <div className="flex gap-2 items-center">
                                                <span className="text-[10px] font-bold text-brand-muted uppercase whitespace-nowrap">Visual Direction:</span>
                                                <input
                                                    type="text"
                                                    value={item.artPrompt || ''}
                                                    onChange={e => handleUpdateItemArtPrompt(item.id, e.target.value)}
                                                    placeholder="e.g. Make it darker, add a neon cat..."
                                                    className="flex-1 bg-white border border-brand-border rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-accent"
                                                />
                                                <Button
                                                    onClick={() => handleRegenerateItem(item.id)}
                                                    className="h-7 text-[10px] px-3 py-0"
                                                    isLoading={item.status === 'generating'}
                                                    variant="primary"
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Hidden File Inputs */}
            <input type="file" ref={campaignFileInputRef} onChange={handleCampaignImageUpload} accept="image/*" className="hidden" />

            {/* Image Preview Helper */}
            {viewingImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" onClick={() => setViewingImage(null)}>
                    <img src={viewingImage} className="max-w-full max-h-[90vh] rounded shadow-2xl" onClick={e => e.stopPropagation()} />
                    <button onClick={() => setViewingImage(null)} className="absolute top-5 right-5 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700">✕</button>
                </div>
            )}

            {/* ANALYTICS MODAL */}
            {analyzingCampaign && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-brand-border flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-lg font-bold text-brand-text">{analyzingCampaign}</h3>
                                <p className="text-xs text-brand-muted">Campaign Performance & Schedule</p>
                            </div>
                            <button onClick={() => setAnalyzingCampaign(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                                    <div className="text-2xl font-bold text-indigo-600">{events.filter(e => e.campaignName === analyzingCampaign).length}</div>
                                    <div className="text-[10px] uppercase font-bold text-indigo-400">Scheduled Posts</div>
                                </div>
                                <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                                    <div className="text-2xl font-bold text-green-600">0</div>
                                    <div className="text-[10px] uppercase font-bold text-green-400">Engagement (Live)</div>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-center">
                                    <div className="text-2xl font-bold text-purple-600">100%</div>
                                    <div className="text-[10px] uppercase font-bold text-purple-400">Completion</div>
                                </div>
                            </div>

                            {/* Post List */}
                            <h4 className="text-xs font-bold text-brand-muted uppercase mb-4">Scheduled Content</h4>
                            <div className="space-y-3">
                                {events.filter(e => e.campaignName === analyzingCampaign).sort((a, b) => a.date.localeCompare(b.date)).map((evt, i) => (
                                    <div key={i} className="flex gap-4 p-3 border border-brand-border rounded-lg items-start">
                                        <div className="bg-gray-100 px-3 py-2 rounded text-center min-w-[60px]">
                                            <div className="text-xs font-bold text-gray-500">{new Date(evt.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</div>
                                            <div className="text-lg font-bold text-gray-900">{new Date(evt.date).getDate()}</div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-brand-text line-clamp-2">{evt.content}</p>
                                            <div className="flex gap-2 mt-2">
                                                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">Twitter</span>
                                                <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded border border-gray-200 uppercase">{evt.status}</span>
                                            </div>
                                        </div>
                                        {evt.image && (
                                            <img src={evt.image} alt="Post asset" className="w-16 h-16 object-cover rounded-lg border border-gray-100" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 border-t border-brand-border bg-gray-50 flex justify-end">
                            <Button onClick={() => setAnalyzingCampaign(null)} variant="secondary">Close</Button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
