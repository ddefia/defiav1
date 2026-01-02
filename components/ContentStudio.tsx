
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { BrandKit } from './BrandKit';
import { BrandConfig } from '../types';
import { generateTweet, generateWeb3Graphic, generateIdeas } from '../services/gemini';
import { saveStudioState, loadStudioState } from '../services/storage';

interface ContentStudioProps {
    brandName: string;
    brandConfig: BrandConfig;
    onSchedule: (content: string, image?: string) => void;
    onUpdateBrandConfig: (config: BrandConfig) => void;
}

export const ContentStudio: React.FC<ContentStudioProps> = ({ brandName, brandConfig, onSchedule, onUpdateBrandConfig }) => {
    // Tab State
    const [activeTab, setActiveTab] = useState<'writer' | 'generate' | 'brand'>('writer');

    // Writer State
    const [writerTopic, setWriterTopic] = useState('');
    const [writerTone, setWriterTone] = useState('Professional');
    const [isWritingTweet, setIsWritingTweet] = useState(false);
    const [generatedDraft, setGeneratedDraft] = useState('');
    const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
    const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([]);

    // Generator State
    const [tweetText, setTweetText] = useState('');
    const [visualPrompt, setVisualPrompt] = useState('');
    const [variationCount, setVariationCount] = useState('1');
    const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '4:5'>('16:9');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);

    // --- PERSISTENCE ---
    useEffect(() => {
        const saved = loadStudioState(brandName);
        if (saved) {
            if (saved.activeTab) setActiveTab(saved.activeTab);
            if (saved.writerTopic) setWriterTopic(saved.writerTopic);
            if (saved.generatedDraft) setGeneratedDraft(saved.generatedDraft);
            if (saved.tweetText) setTweetText(saved.tweetText);
            if (saved.visualPrompt) setVisualPrompt(saved.visualPrompt);
            if (saved.generatedImages) setGeneratedImages(saved.generatedImages);
        }
    }, [brandName]);

    useEffect(() => {
        const state = {
            activeTab, writerTopic, generatedDraft, tweetText, visualPrompt, generatedImages
        };
        const timeout = setTimeout(() => saveStudioState(brandName, state), 1000);
        return () => clearTimeout(timeout);
    }, [activeTab, writerTopic, generatedDraft, tweetText, visualPrompt, generatedImages, brandName]);


    // --- HANDLERS ---
    const handleGenerateIdeas = async () => {
        setIsGeneratingIdeas(true);
        try {
            const ideas = await generateIdeas(brandName);
            setSuggestedIdeas(ideas);
        } catch (e) { console.error(e); } finally { setIsGeneratingIdeas(false); }
    };

    const handleAIWrite = async () => {
        setIsWritingTweet(true);
        setGeneratedDraft('');
        try {
            const draft = await generateTweet(writerTopic, brandName, brandConfig, writerTone);
            setGeneratedDraft(draft);
        } catch (e) { setError('Failed to generate draft.'); } finally { setIsWritingTweet(false); }
    };

    const handleGenerateSingle = async () => {
        if (!tweetText && !visualPrompt) return;
        setIsGenerating(true);
        setError(null);
        setGeneratedImages([]);
        try {
            const count = parseInt(variationCount);
            const promises = Array(count).fill(0).map(() =>
                generateWeb3Graphic({
                    prompt: tweetText,
                    artPrompt: visualPrompt,
                    size,
                    aspectRatio,
                    brandConfig,
                    brandName
                })
            );
            const images = await Promise.all(promises);
            setGeneratedImages(images);
        } catch (err) {
            setError("Failed to generate graphics. Ensure local server is running.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `defia-gen-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrepareTweet = (text: string) => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)] animate-fadeIn">

            {/* SIDEBAR */}
            <div className="w-full lg:w-[360px] flex flex-col gap-4">
                {/* Navigation */}
                <div className="bg-white border border-brand-border rounded-xl p-2 shadow-sm flex flex-col gap-1">
                    {[
                        { id: 'writer', label: 'Writer', icon: '✍️' },
                        { id: 'generate', label: 'Visuals', icon: '🎨' },
                        { id: 'brand', label: 'Brand Kit', icon: '💼' }
                    ].map(tab => {
                        const showBadge = tab.id === 'brand' && (!brandConfig.referenceImages || brandConfig.referenceImages.length === 0);
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center justify-between group
                                    ${isActive ? 'bg-gray-900 text-white shadow-md' : 'text-brand-muted hover:bg-gray-50 hover:text-brand-text'}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`text-lg ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>{tab.icon}</span>
                                    <span>{tab.label}</span>
                                </div>
                                {isActive && <span className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse"></span>}
                                {showBadge && !isActive && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                            </button>
                        );
                    })}
                </div>

                {/* PANEL INPUTS */}
                <div className="bg-white border border-brand-border rounded-2xl p-6 shadow-xl shadow-gray-200/50 flex flex-col gap-4 flex-1 overflow-y-auto custom-scrollbar">

                    {/* WRITER INPUTS */}
                    {activeTab === 'writer' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Drafting Console</h3>
                                <button onClick={handleGenerateIdeas} disabled={isGeneratingIdeas} className="text-[10px] text-brand-accent hover:text-brand-text font-bold uppercase tracking-wide">
                                    {isGeneratingIdeas ? 'Thinking...' : '✨ Suggest Ideas'}
                                </button>
                            </div>

                            {suggestedIdeas.length > 0 && (
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl overflow-hidden shadow-sm">
                                    <div className="px-3 py-2 border-b border-indigo-100 bg-white/50 text-[10px] font-bold text-indigo-400 uppercase">AI Suggestions</div>
                                    {suggestedIdeas.map((idea, idx) => (
                                        <button key={idx} onClick={() => { setWriterTopic(idea); setSuggestedIdeas([]); }} className="w-full text-left px-3 py-2 text-xs text-brand-text hover:bg-indigo-100/50 border-b border-indigo-100 last:border-0 transition-colors">
                                            {idea}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] uppercase font-bold text-brand-muted mb-1 block">Topic / Prompt</label>
                                <textarea
                                    value={writerTopic}
                                    onChange={e => setWriterTopic(e.target.value)}
                                    placeholder="Make a thread about..."
                                    className="w-full h-32 bg-gray-50 border border-brand-border rounded-xl p-3 text-sm text-brand-text focus:bg-white focus:border-brand-accent outline-none resize-none transition-all placeholder-gray-400"
                                />
                            </div>

                            <Select label="Tone of Voice" value={writerTone} onChange={e => setWriterTone(e.target.value)} options={[{ value: 'Professional', label: 'Professional' }, { value: 'Hype', label: 'Hype / Degen' }, { value: 'Casual', label: 'Casual' }, { value: 'Educational', label: 'Educational' }]} />

                            <Button onClick={handleAIWrite} isLoading={isWritingTweet} disabled={!writerTopic} className="w-full py-3 shadow-lg shadow-indigo-500/20">
                                Generate Draft
                            </Button>
                        </div>
                    )}

                    {/* GENERATOR INPUTS */}
                    {activeTab === 'generate' && (
                        <div className="space-y-5 animate-fadeIn">
                            <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">Visual Studio</h3>

                            <div>
                                <label className="text-[10px] font-bold text-brand-muted uppercase mb-1 block">1. Context (Tweet / Text)</label>
                                <textarea
                                    value={tweetText}
                                    onChange={e => setTweetText(e.target.value)}
                                    placeholder="Paste your content here..."
                                    className="w-full h-24 bg-gray-50 border border-brand-border rounded-xl p-3 text-sm text-brand-text focus:bg-white focus:border-brand-accent outline-none resize-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-brand-muted uppercase mb-1 block">2. Art Direction (Optional)</label>
                                <input
                                    type="text"
                                    value={visualPrompt}
                                    onChange={e => setVisualPrompt(e.target.value)}
                                    placeholder="e.g. Cyberpunk, Neon, Minimal..."
                                    className="w-full bg-gray-50 border border-brand-border rounded-xl p-3 text-sm text-brand-text focus:bg-white focus:border-brand-accent outline-none transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <Select label="Quantity" value={variationCount} onChange={e => setVariationCount(e.target.value)} options={[{ value: '1', label: '1 Image' }, { value: '2', label: '2 Images' }, { value: '3', label: '3 Images' }, { value: '4', label: '4 Images' }]} />
                                <Select label="Format" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} options={[{ value: '16:9', label: 'Landscape (16:9)' }, { value: '1:1', label: 'Square (1:1)' }, { value: '4:5', label: 'Portrait (4:5)' }]} />
                                <Select label="Quality" value={size} onChange={e => setSize(e.target.value as any)} options={[{ value: '1K', label: 'Standard (1K)' }, { value: '2K', label: 'High (2K)' }]} />
                            </div>

                            <Button onClick={handleGenerateSingle} isLoading={isGenerating} disabled={!tweetText && !visualPrompt} className="w-full py-3 shadow-lg shadow-purple-500/20">
                                Render Graphics
                            </Button>
                        </div>
                    )}

                    {/* BRAND KIT INPUTS */}
                    {activeTab === 'brand' && (
                        <div className="space-y-4 animate-fadeIn">
                            <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">Brand Identity</h3>
                            <p className="text-xs text-brand-textSecondary mb-4">
                                Configure your brand's voice, colors, and visual style. The AI uses this to maintain consistency.
                            </p>
                            <BrandKit config={brandConfig} brandName={brandName} onChange={onUpdateBrandConfig} />
                        </div>
                    )}

                    {error && <div className="mt-auto p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg">{error}</div>}
                </div>
            </div>

            {/* MAIN PREVIEW AREA */}
            <div className={`flex-1 bg-white border border-brand-border rounded-2xl relative flex flex-col overflow-hidden shadow-sm`}>

                {/* Header Bar */}
                <div className="absolute top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md border-b border-brand-border flex items-center justify-between px-6 z-10">
                    <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">{activeTab} Preview</span>
                    <div className="flex gap-2">
                        {activeTab === 'brand' ? (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Auto-Saved</span>
                        ) : (
                            <span className="text-[10px] text-gray-400">All changes saved locally</span>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 pt-20 custom-scrollbar bg-gray-50/30">

                    {/* WRITER PREVIEW */}
                    {activeTab === 'writer' && (
                        <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                            {generatedDraft ? (
                                <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-sm group relative">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button onClick={() => setTweetText(generatedDraft)} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 font-bold hidden md:block">Send to Visuals</button>
                                        <button onClick={() => handlePrepareTweet(generatedDraft)} className="text-[10px] bg-black text-white px-2 py-1 rounded hover:bg-gray-800 font-bold">Post X</button>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0"></div>
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                                                <div className="h-4 w-16 bg-gray-100 rounded"></div>
                                            </div>
                                            <textarea
                                                value={generatedDraft}
                                                onChange={e => setGeneratedDraft(e.target.value)}
                                                className="w-full bg-transparent border-none p-0 text-xl font-display text-brand-text focus:ring-0 resize-none min-h-[120px] leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-6 flex justify-between items-center border-t border-gray-100 pt-4">
                                        <div className="flex gap-4 text-gray-400">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 012 2h2a2 2 0 012-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        </div>
                                        <Button onClick={() => onSchedule(generatedDraft)} variant="outline" className="text-xs">Add to Calendar</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-4xl mb-4">✍️</div>
                                    <p className="text-brand-muted font-bold">Drafting Board Empty</p>
                                    <p className="text-xs text-brand-muted">Use the console on the left to write.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* GENERATOR PREVIEW */}
                    {activeTab === 'generate' && (
                        <div className="space-y-6 animate-fadeIn">
                            {generatedImages.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                                    {generatedImages.map((img, idx) => (
                                        <div key={idx} className="relative group rounded-2xl overflow-hidden shadow-lg border border-brand-border cursor-pointer transition-transform hover:scale-[1.01]" onClick={() => setViewingImage(img)}>
                                            <img src={img} className="w-full object-cover bg-gray-100" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                                                <Button onClick={(e) => { e.stopPropagation(); handleDownload(img); }} className="bg-white text-black hover:bg-gray-100">Download</Button>
                                                <Button onClick={(e) => { e.stopPropagation(); onSchedule(tweetText || 'Visual Content', img); }} variant="secondary">Schedule</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-4xl mb-4">🎨</div>
                                    <p className="text-brand-muted font-bold">No Renderings Yet</p>
                                    <p className="text-xs text-brand-muted">Configure the Visual Studio to generate.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BRAND KIT PREVIEW */}
                    {activeTab === 'brand' && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="bg-white p-10 rounded-2xl shadow-sm border border-brand-border text-center max-w-md">
                                <div className="w-20 h-20 mx-auto bg-brand-accent/10 rounded-full flex items-center justify-center text-brand-accent text-3xl mb-6">
                                    💼
                                </div>
                                <h3 className="text-xl font-bold text-brand-text mb-2">Brand Identity Active</h3>
                                <p className="text-brand-muted text-sm leading-relaxed">
                                    The settings configured in the left panel are automatically applied to all AI generation tasks across the Studio and Campaigns.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {viewingImage && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-4 animate-fadeIn" onClick={() => setViewingImage(null)}>
                    <img src={viewingImage} className="max-w-full max-h-[90vh] rounded shadow-2xl" onClick={e => e.stopPropagation()} />
                    <button onClick={() => setViewingImage(null)} className="absolute top-5 right-5 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700">✕</button>
                    <div className="absolute bottom-10 flex gap-4">
                        <Button onClick={(e) => { e.stopPropagation(); handleDownload(viewingImage); }}>Download High-Res</Button>
                    </div>
                </div>
            )}
        </div>
    );
};
