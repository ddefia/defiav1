import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { generateWeb3Graphic, generateCampaignDrafts } from '../services/gemini';
import { saveCalendarEvents } from '../services/storage';
import { BrandConfig, CampaignItem, CalendarEvent } from '../types';

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

    const handleDraftCampaign = async () => {
        if (campaignType === 'theme' && !campaignTheme.trim()) return;

        setIsDraftingCampaign(true);
        setError(null);
        setCampaignItems([]);

        const themeToSend = campaignType === 'diverse' ? 'DIVERSE_MIX_MODE' : campaignTheme;

        try {
            const draftsText = await generateCampaignDrafts(
                themeToSend,
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

            const items: CampaignItem[] = splitDrafts.map((txt, i) => ({
                id: `draft-${Date.now()}-${i}`,
                tweet: txt,
                isApproved: true,
                status: 'draft',
                images: [],
                campaignColor: colorMatch ? colorMatch[1] : campaignColor
            }));

            setCampaignItems(items);
            setCampaignStep(2);
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

        setCampaignStep(3);
        setIsBatchProcessing(true);
        setCampaignItems(prev => prev.map(item => item.isApproved ? { ...item, status: 'pending' } : item));

        for (const item of approvedItems) {
            setCampaignItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'generating' } : p));
            try {
                const promises = [
                    generateWeb3Graphic({ prompt: item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName }),
                    generateWeb3Graphic({ prompt: item.tweet, size: '1K', aspectRatio: '16:9', brandConfig, brandName })
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
                generateWeb3Graphic({ prompt: item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName }),
                generateWeb3Graphic({ prompt: item.tweet, artPrompt: item.artPrompt, size: '1K', aspectRatio: '16:9', brandConfig, brandName })
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
                            <Button variant="outline" className="w-full text-xs">View Analytics</Button>
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

                                <Select label="Tweet Count" value={campaignCount} onChange={e => setCampaignCount(e.target.value)} options={[{ value: '3', label: '3 Tweets' }, { value: '5', label: '5 Tweets' }, { value: '7', label: '7 Tweets' }]} />
                                <Button onClick={handleDraftCampaign} isLoading={isDraftingCampaign} disabled={campaignType === 'theme' && !campaignTheme} className="w-full shadow-lg shadow-indigo-500/20">
                                    {campaignType === 'diverse' ? 'Generate Mix' : 'Draft Campaign'}
                                </Button>
                            </div>
                        )}

                        {/* STEP 2: REVIEW SUMMARY */}
                        {campaignStep === 2 && (
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
                                <button onClick={() => setCampaignStep(1)} className="w-full text-xs text-brand-muted hover:text-brand-text py-2">Back to Draft</button>
                            </div>
                        )}

                        {/* STEP 3: SCHEDULE SUMMARY */}
                        {campaignStep === 3 && (
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

                            {/* REVIEW DRAFTS */}
                            {campaignStep === 2 && (
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

                            {/* RESULTS / GENERATION */}
                            {campaignStep === 3 && (
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
        </div>
    );
};
