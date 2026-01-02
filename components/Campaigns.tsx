import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { generateWeb3Graphic, generateCampaignDrafts, generateCampaignStrategy } from '../services/gemini';
import { saveCalendarEvents, saveCampaignState, loadCampaignState } from '../services/storage';
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
}

export const Campaigns: React.FC<CampaignsProps> = ({
    brandName,
    brandConfig,
    events,
    onUpdateEvents,
    initialIntent,
    onClearIntent
}) => {
    // View State: 'list' | 'wizard'
    const [viewMode, setViewMode] = useState<'list' | 'wizard'>('list');

    // Wizard State
    const [campaignStep, setCampaignStep] = useState<1 | 2 | 3 | 4>(1); // 1: Config, 2: Strategy, 3: Drafts, 4: Assets
    const [campaignType, setCampaignType] = useState<'theme' | 'diverse'>('theme');
    const [campaignTheme, setCampaignTheme] = useState<string>('');
    const [campaignGoal, setCampaignGoal] = useState<string>('User Acquisition'); // NEW
    const [campaignPlatforms, setCampaignPlatforms] = useState<string[]>(['Twitter']); // NEW
    const [campaignContext, setCampaignContext] = useState<string>(''); // NEW
    const [campaignStrategy, setCampaignStrategy] = useState<CampaignStrategy | null>(null); // NEW

    // Graphic Settings
    const [campaignTemplate, setCampaignTemplate] = useState<string>('');
    const [campaignReferenceImage, setCampaignReferenceImage] = useState<string | null>(null);

    const [campaignColor, setCampaignColor] = useState<string>('#4F46E5'); // Default Indigo
    const [campaignCount, setCampaignCount] = useState<string>('3');
    const [campaignStartDate, setCampaignStartDate] = useState<string>('');
    const [isDraftingCampaign, setIsDraftingCampaign] = useState<boolean>(false);
    const [isGeneratingStrategy, setIsGeneratingStrategy] = useState<boolean>(false); // NEW
    const [campaignItems, setCampaignItems] = useState<CampaignItem[]>([]);
    const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
    const [analyzingCampaign, setAnalyzingCampaign] = useState<string | null>(null); // New State

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
            campaignStartDate
        };
        // Debounce slightly or just save (localStorage is fast)
        const timeout = setTimeout(() => {
            saveCampaignState(brandName, stateToSave);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [viewMode, campaignStep, campaignType, campaignTheme, campaignGoal, campaignPlatforms, campaignStrategy, campaignTemplate, campaignReferenceImage, campaignItems, campaignStartDate, brandName]);

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

    // STEP 1 Action: Generate Strategy
    const handleGenerateStrategy = async () => {
        if (campaignType === 'theme' && !campaignTheme.trim()) return;

        setIsGeneratingStrategy(true);
        setError(null);

        try {
            // Get Active Campaigns for context
            const activeCampaigns = getActiveCampaigns().map(c => `${c.name} (${c.status})`);

            const strategy = await generateCampaignStrategy(
                campaignGoal,
                campaignType === 'theme' ? campaignTheme : 'Diverse Content Mix',
                campaignPlatforms,
                campaignContext, // NEW
                activeCampaigns, // NEW
                brandName,
                brandConfig
            );
            setCampaignStrategy(strategy);
            setCampaignStep(2); // Move to Strategy View
        } catch (err) {
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

        try {
            // Pass strategy context to drafting if available (enhancing the prompt)
            // For now, we use the existing function but ideally we'd pass the strategy object too.
            // We'll rely on the theme being descriptive enough or update the service later.
            // But to make it effective now, we can append the strategy summary to the theme string temporarily
            // so the LLM sees it in the prompt without changing the function signature yet.
            const enhancedTheme = campaignStrategy
                ? `${themeToSend}. STRATEGY CONTEXT: Audience: ${campaignStrategy.targetAudience}. Messages: ${campaignStrategy.keyMessaging.join(', ')}.`
                : themeToSend;

            const draftsText = await generateCampaignDrafts(
                enhancedTheme,
                brandName,
                brandConfig,
                parseInt(campaignCount)
            );

            // Parse output
            let textToParse = draftsText;
            const colorMatch = textToParse.match(/THEME_COLOR:\s*(#[0-9a-fA-F]{3,6})/i);

            if (colorMatch) {
                setCampaignColor(colorMatch[1]);
                textToParse = textToParse.replace(colorMatch[0], '').trim();
            }

            const splitDrafts = textToParse.split(/---/).map(t => t.trim()).filter(t => t.length > 0);

            const items: CampaignItem[] = splitDrafts.map((txt, i) => {
                // Extract Template Tag if present (e.g., "[Event] Tweet content...")
                let tweetContent = txt;
                let detectedTemplate = campaignTemplate; // Fallback to global setting

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
            setCampaignStep(3); // Move to Review
        } catch (err) {
            setError("Failed to draft campaign.");
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

        for (const item of approvedItems) {
            setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'generating' } : p));
            try {
                const promises = [
                    generateWeb3Graphic({ prompt: item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImage: campaignReferenceImage || undefined }),
                    generateWeb3Graphic({ prompt: item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImage: campaignReferenceImage || undefined })
                ];
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
            const promises = [
                generateWeb3Graphic({ prompt: item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImage: campaignReferenceImage || undefined }),
                generateWeb3Graphic({ prompt: item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName, templateType: item.template || campaignTemplate || undefined, selectedReferenceImage: campaignReferenceImage || undefined })
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
        const pageWidth = doc.internal.pageSize.getWidth();

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
                evt.status.toUpperCase()
            ];
            tableBody.push(rowData);
        }

        // GENERATE TABLE WITH IMAGES
        // Note: autotable doesn't support complex customization easily for images in cells without hooks.
        // We will use a simplified approach: Text Table first, then appended images or just text if images fail.

        // @ts-ignore
        autoTable(doc, {
            startY: 45,
            head: [['Date', 'Copy', 'Status']],
            body: tableBody,
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 25 }
            },
            styles: { overflow: 'linebreak', fontSize: 10 },
            didDrawCell: (data) => {
                // Hook to potentially draw images (advanced)
                // For simplicity/reliability in this version, we will list images below the table or separate page 
                // if the user requests "visual" PDF. For now, text focused.
            }
        });

        // ADD VISUAL BOARD (New Page)
        doc.addPage();
        doc.setFontSize(16);
        doc.text("Visual Assets", 14, 20);

        let yPos = 30;
        const margin = 14;
        const imgWidth = 80;
        const imgHeight = 45; // 16:9 approx

        // Loop to add images
        let xPos = margin;

        for (const evt of campaignEvents) {
            if (evt.image) {
                try {
                    // Check if image is Base64 or URL. If URL, might need fetch if not CORS friendly.
                    // Assuming stored images are often Base64 in this app (from previous context).

                    // If it's a huge base64, might crash. 
                    // Simple layout: 2 cols

                    if (yPos + imgHeight > 280) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.addImage(evt.image, 'PNG', xPos, yPos, imgWidth, imgHeight);

                    // Add caption (date)
                    doc.setFontSize(8);
                    doc.text(evt.date, xPos, yPos + imgHeight + 5);

                    // Move Cursor
                    if (xPos === margin) {
                        xPos = margin + imgWidth + 10;
                    } else {
                        xPos = margin;
                        yPos += imgHeight + 15;
                    }

                } catch (e) {
                    console.warn("Failed to add image to PDF", e);
                }
            }
        }

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
                <div className="flex flex-col lg:flex-row gap-8 animate-fadeIn">

                    {/* LEFT PANEL: CONTROLS */}
                    <div className="w-full lg:w-[400px] space-y-6">

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

                                <Select label="Tweet Count" value={campaignCount} onChange={e => setCampaignCount(e.target.value)} options={[{ value: '3', label: '3 Tweets' }, { value: '5', label: '5 Tweets' }, { value: '7', label: '7 Tweets' }]} />
                                <div className="space-y-4 pt-4 border-t border-brand-border">
                                    {/* Visual Style Selection */}
                                    <div>
                                        <label className="text-xs font-bold text-brand-muted uppercase mb-2 block">Visual Style (Optional)</label>
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
                                    Next: Generate Strategy
                                </Button>
                            </div>
                        )}

                        {/* STEP 2: STRATEGY REVIEW & EDIT */}
                        {campaignStep === 2 && campaignStrategy && (
                            <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm space-y-6">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-bold text-brand-text">Strategy Brief</h3>
                                    <div className="text-xs text-brand-muted bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        Active Campaigns Considered: <span className="font-medium text-brand-text">{getActiveCampaigns().length}</span>
                                    </div>
                                </div>

                                {/* Context Recap */}
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs mb-4">
                                    <p className="font-bold text-blue-800 mb-1">Context Provided:</p>
                                    <p className="text-blue-700 italic">"{campaignContext || 'None'}"</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-brand-muted uppercase block mb-1">Target Audience</label>
                                        <textarea
                                            value={campaignStrategy.targetAudience}
                                            onChange={(e) => updateStrategyField('targetAudience', e.target.value)}
                                            className="w-full bg-white border border-brand-border rounded p-2 text-sm text-brand-text focus:border-brand-accent focus:outline-none min-h-[80px]"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-brand-muted uppercase block mb-1">Key Messaging</label>
                                        <ul className="list-disc list-inside text-xs text-brand-text space-y-1">
                                            {campaignStrategy.keyMessaging.map((m, i) => <li key={i}>{m}</li>)}
                                        </ul>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-indigo-50 p-2 rounded">
                                            <span className="block text-[10px] text-indigo-600 font-bold uppercase">Topic Mix</span>
                                            <span className="text-xs font-medium text-indigo-900">{campaignStrategy.contentMix.split('.')[0]}</span>
                                        </div>
                                        <div className="bg-green-50 p-2 rounded">
                                            <span className="block text-[10px] text-green-600 font-bold uppercase">Est. Reach</span>
                                            <span className="text-xs font-medium text-green-900">{campaignStrategy.estimatedResults.impressions}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-brand-border">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-brand-muted uppercase">Estimated Results</label>
                                        <span className="text-[10px] text-brand-muted italic bg-gray-50 px-2 rounded">Estimates based on micro-campaign standards</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-gray-50 p-2 rounded text-center border border-gray-100">
                                            <div className="text-lg font-bold text-brand-accent">{campaignStrategy.estimatedResults.impressions}</div>
                                            <div className="text-[10px] text-brand-muted uppercase">Impressions</div>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded text-center border border-gray-100">
                                            <div className="text-lg font-bold text-teal-600">{campaignStrategy.estimatedResults.engagement}</div>
                                            <div className="text-[10px] text-brand-muted uppercase">Engagement</div>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded text-center border border-gray-100">
                                            <div className="text-lg font-bold text-purple-600">{campaignStrategy.estimatedResults.conversions}</div>
                                            <div className="text-[10px] text-brand-muted uppercase">Conversions</div>
                                        </div>
                                    </div>
                                </div>

                                {/* SCHEDULING INPUT in STRATEGY STEP */}
                                <div className="pt-4 border-t border-brand-border">
                                    <label className="text-xs font-bold text-brand-muted uppercase block mb-2">Campaign Start Date</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="date"
                                            value={campaignStartDate}
                                            onChange={(e) => setCampaignStartDate(e.target.value)}
                                            className="bg-white border border-brand-border rounded p-2 text-sm text-brand-text focus:border-brand-accent outline-none"
                                        />
                                        <span className="text-xs text-brand-muted">
                                            First post will be scheduled for this date.
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button variant="secondary" onClick={() => setCampaignStep(1)}>Back</Button>
                                    <Button onClick={handleDraftCampaign} isLoading={isDraftingCampaign} className="flex-1 shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-700 border-green-600">
                                        Approve Strategy & Draft Content
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: REVIEW SUMMARY */}
                        {campaignStep === 3 && (
                            <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm space-y-4">
                                <div className="text-center">
                                    <p className="text-sm text-brand-text font-semibold">{campaignItems.length} Drafts Generated</p>
                                    <p className="text-xs text-brand-muted">Review text on the right panel.</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg border border-brand-border">
                                    <div className="flex justify-between text-start text-xs text-brand-muted mb-2">
                                        <span>Approved Tweets:</span>
                                        <span className="text-green-600 font-bold">{approvedCount}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-brand-muted">
                                        <span>Estimated Output:</span>
                                        <span className="text-brand-accent font-bold">{approvedCount * 2} Images</span>
                                    </div>
                                </div>
                                <Button onClick={handleGenerateApproved} className="w-full bg-brand-text text-white hover:bg-black">
                                    Generate Assets
                                </Button>
                                <button onClick={() => setCampaignStep(2)} className="w-full text-xs text-brand-muted hover:text-brand-text py-2">Back to Strategy</button>
                            </div>
                        )}

                        {/* STEP 4: SCHEDULE SUMMARY */}
                        {campaignStep === 4 && (
                            <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm space-y-4">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <p className="text-sm text-brand-text font-medium text-center">Production Complete</p>

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

                        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">{error}</div>}

                    </div>

                    {/* RIGHT PANEL: WORKSPACE */}
                    <div className="flex-1 bg-white border border-brand-border rounded-2xl relative flex flex-col min-h-[600px] overflow-hidden shadow-sm">

                        {/* Subtle background pattern/gradient */}
                        <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent ${brandName === 'Meme' ? 'via-yellow-400' : 'via-brand-accent'} to-transparent opacity-50`}></div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">

                            {/* EMPTY STATE */}
                            {campaignStep === 1 && (
                                <div className="flex flex-col items-center justify-center h-full text-brand-muted text-sm space-y-2 opacity-60">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </div>
                                    <p>Configure campaign settings to begin.</p>
                                </div>
                            )}

                            {/* RIGHT PANEL - STRATEGY PREVIEW (Only for step 2) */}
                            {campaignStep === 2 && campaignStrategy && (
                                <div className="p-6 space-y-8 animate-fadeIn">
                                    <div className="flex justify-between items-center pb-4 border-b border-brand-border">
                                        <div>
                                            <h2 className="text-xl font-display font-bold text-brand-text">Strategic Research Brief</h2>
                                            <p className="text-xs text-brand-muted">Review and edit the AI-generated strategy before drafting.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Editable Mode</span>
                                        </div>
                                    </div>

                                    {/* Estimates */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-wider">Reach Estimate</div>
                                            <input
                                                className="text-lg font-bold text-brand-text bg-transparent text-center w-full focus:outline-none focus:border-b focus:border-brand-accent placeholder-gray-300"
                                                value={campaignStrategy.estimatedResults.impressions}
                                                onChange={(e) => updateStrategyField('estimatedResults', { ...campaignStrategy.estimatedResults, impressions: e.target.value })}
                                            />
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-wider">Engagement Goal</div>
                                            <input
                                                className="text-lg font-bold text-brand-text bg-transparent text-center w-full focus:outline-none focus:border-b focus:border-brand-accent placeholder-gray-300"
                                                value={campaignStrategy.estimatedResults.engagement}
                                                onChange={(e) => updateStrategyField('estimatedResults', { ...campaignStrategy.estimatedResults, engagement: e.target.value })}
                                            />
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-wider">Impact Target</div>
                                            <input
                                                className="text-lg font-bold text-brand-text bg-transparent text-center w-full focus:outline-none focus:border-b focus:border-brand-accent placeholder-gray-300"
                                                value={campaignStrategy.estimatedResults.conversions}
                                                onChange={(e) => updateStrategyField('estimatedResults', { ...campaignStrategy.estimatedResults, conversions: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    {/* Target Audience */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-brand-muted uppercase block">Target Audience Analysis</label>
                                        <textarea
                                            value={campaignStrategy.targetAudience}
                                            onChange={(e) => updateStrategyField('targetAudience', e.target.value)}
                                            className="w-full bg-white border border-brand-border rounded-lg p-3 text-sm text-brand-text focus:border-brand-accent outline-none shadow-sm resize-none min-h-[80px]"
                                        />
                                    </div>

                                    {/* Strategy Cards */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-brand-muted uppercase tracking-wider">Campaign Context & Situation</label>
                                        <textarea
                                            className="w-full bg-white border border-brand-border rounded p-2 text-sm text-brand-text focus:border-brand-accent focus:outline-none h-20"
                                            placeholder="e.g. Market is down, focus on reassurance. We are launching a partner integration with X..."
                                            value={campaignContext}
                                            onChange={(e) => setCampaignContext(e.target.value)}
                                        />
                                    </div>

                                    {/* Strategy Cards - Editable */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-brand-muted uppercase block">Platform Strategy</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {campaignStrategy.channelStrategy.map((s, i) => (
                                                <div key={i} className="border border-brand-border p-4 rounded-xl bg-white shadow-sm flex flex-col gap-2 relative group">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-brand-text text-sm">{s.channel}</span>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-brand-muted uppercase font-bold">Focus</label>
                                                        <input
                                                            type="text"
                                                            value={s.focus}
                                                            onChange={(e) => updateChannelStrategy(i, 'focus', e.target.value)}
                                                            className="w-full bg-gray-50 border border-brand-border rounded px-2 py-1 text-xs text-brand-text focus:border-brand-accent focus:outline-none mb-2"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-brand-muted uppercase font-bold">Rationale</label>
                                                        <textarea
                                                            value={s.rationale}
                                                            onChange={(e) => updateChannelStrategy(i, 'rationale', e.target.value)}
                                                            className="w-full bg-gray-50 border border-brand-border rounded px-2 py-1 text-xs text-brand-muted focus:border-brand-accent focus:outline-none min-h-[60px]"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Messaging */}
                                    <div className="bg-yellow-50/30 border border-yellow-100 p-5 rounded-xl space-y-3">
                                        <h4 className="text-sm font-bold text-yellow-800 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                                            Key Messaging Pillars
                                        </h4>
                                        {/* Key Messaging - Editable */}
                                        <div>
                                            <label className="text-xs font-bold text-brand-muted uppercase block mb-1">Key Messaging Pillars</label>
                                            <div className="space-y-2">
                                                {campaignStrategy.keyMessaging.map((msg, idx) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-brand-accent/10 text-brand-accent flex items-center justify-center text-xs font-bold shrink-0">
                                                            {idx + 1}
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={msg}
                                                            onChange={(e) => {
                                                                const newMsgs = [...campaignStrategy.keyMessaging];
                                                                newMsgs[idx] = e.target.value;
                                                                updateStrategyField('keyMessaging', newMsgs);
                                                            }}
                                                            className="w-full bg-white border border-brand-border rounded px-2 py-1 text-xs text-brand-text focus:border-brand-accent focus:outline-none"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {campaignStrategy.keyMessaging.map((msg, i) => (
                                                <div key={i} className="flex gap-2 items-start group">
                                                    <span className="text-yellow-500 font-bold mt-2">•</span>
                                                    <div className="flex-1">
                                                        <textarea
                                                            value={msg}
                                                            onChange={(e) => {
                                                                const newMsgs = [...campaignStrategy.keyMessaging];
                                                                newMsgs[i] = e.target.value;
                                                                updateStrategyField('keyMessaging', newMsgs);
                                                            }}
                                                            className="w-full bg-yellow-50/50 border-b border-transparent hover:border-yellow-200 focus:border-yellow-500 text-xs text-yellow-900 p-2 rounded focus:bg-white outline-none resize-none overflow-hidden"
                                                            rows={2}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const newMsgs = campaignStrategy.keyMessaging.filter((_, idx) => idx !== i);
                                                            updateStrategyField('keyMessaging', newMsgs);
                                                        }}
                                                        className="text-yellow-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => updateStrategyField('keyMessaging', [...campaignStrategy.keyMessaging, "New messaging pillar..."])}
                                                className="text-[10px] uppercase font-bold text-yellow-600 hover:text-yellow-800 flex items-center gap-1 pl-4"
                                            >
                                                + Add Pillar
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <div className="text-xs text-gray-400 italic">
                                            Changes here will guide the content generation in the next step.
                                        </div>
                                    </div>

                                </div>
                            )}

                            {/* REVIEW DRAFTS */}
                            {campaignStep === 3 && (
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
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] uppercase font-bold text-gray-400">Post {idx + 1}</span>
                                                        <div className="flex items-center gap-2">
                                                            {/* Per-Post Template Selector */}
                                                            <select
                                                                value={item.template || ''}
                                                                onChange={(e) => {
                                                                    const newVal = e.target.value;
                                                                    setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, template: newVal } : p));
                                                                }}
                                                                className="text-[10px] border border-brand-border rounded px-1 py-0.5 text-brand-text bg-white outline-none focus:border-brand-accent max-w-[120px]"
                                                            >
                                                                <option value="">Default Style</option>
                                                                <option value="Partnership">Partnership</option>
                                                                <option value="Campaign Launch">Campaign Launch</option>
                                                                <option value="Giveaway">Giveaway</option>
                                                                <option value="Event">Event</option>
                                                                <option value="Speaker Quote">Speaker Quote</option>
                                                                {(brandConfig.graphicTemplates || []).map(t => (
                                                                    <option key={t.id} value={t.label}>{t.label}</option>
                                                                ))}
                                                            </select>
                                                            <button onClick={() => handleDeleteDraft(item.id)} className="text-gray-400 hover:text-red-500">
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        value={item.tweet}
                                                        onChange={(e) => handleUpdateDraft(item.id, e.target.value)}
                                                        className="w-full bg-transparent border-none p-0 text-sm text-brand-text resize-none focus:ring-0"
                                                        rows={3}
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleToggleApproval(item.id)}
                                                    className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${item.isApproved ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                                >
                                                    {item.isApproved ? 'Approved' : 'Discarded'}
                                                </button>
                                            </div>
                                            {item.isApproved && (
                                                <div className="mt-2 pt-2 border-t border-brand-border flex justify-end">
                                                    <span className="text-[10px] text-brand-accent font-medium">Will generate 2 images</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* RESULTS / GENERATION */}
                            {campaignStep === 4 && (
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
                                                        placeholder="e.g. Make it darker, add a neon cat..."
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
        </div>
    );
};
