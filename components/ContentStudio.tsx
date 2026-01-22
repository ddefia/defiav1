
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { BrandConfig } from '../types';
import { generateTweet, generateWeb3Graphic, generateIdeas } from '../services/gemini';
import { saveBrainMemory } from '../services/supabase';
import { saveStudioState, loadStudioState } from '../services/storage';

interface ContentStudioProps {
    brandName: string;
    brandConfig: BrandConfig;
    onSchedule: (content: string, image?: string) => void;
    onUpdateBrandConfig: (config: BrandConfig) => void;
    initialDraft?: string;
    initialVisualPrompt?: string;
}

const TEMPLATE_OPTIONS: { id: string; label: string; }[] = [];

export const ContentStudio: React.FC<ContentStudioProps> = ({ brandName, brandConfig, onSchedule, onUpdateBrandConfig, initialDraft, initialVisualPrompt }) => {
    // Tab State
    const [activeTab, setActiveTab] = useState<'writer' | 'generate'>('writer');

    // Writer State
    const [writerTopic, setWriterTopic] = useState('');
    const [writerTone, setWriterTone] = useState('Professional');
    const [isWritingTweet, setIsWritingTweet] = useState(false);
    const [generatedDraft, setGeneratedDraft] = useState('');
    const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
    const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([]);

    // Combine default templates with brand custom templates
    const availableTemplates = React.useMemo(() => {
        const custom = (brandConfig.graphicTemplates || []).map(t => ({
            id: t.label, // Use label as ID for simplicity in selection
            label: t.label,
            isCustom: true,
            prompt: t.prompt
        }));
        return [...TEMPLATE_OPTIONS, ...custom];
    }, [brandConfig.graphicTemplates]);

    // Generator State
    const [tweetText, setTweetText] = useState('');
    const [visualPrompt, setVisualPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [variationCount, setVariationCount] = useState('1');
    const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '4:5'>('16:9');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [selectedReferenceImage, setSelectedReferenceImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // --- PERSISTENCE & DEEP LINKS ---
    useEffect(() => {
        // Handle Deep Linking Overrides
        if (initialDraft || initialVisualPrompt) {
            if (initialDraft) {
                setWriterTopic(initialDraft);
                setActiveTab('writer');
            }
            if (initialVisualPrompt) {
                setVisualPrompt(initialVisualPrompt);
                setActiveTab('generate');
            }
        } else {
            // Load saved state
            const saved = loadStudioState(brandName);
            if (saved) {
                if (saved.activeTab && (saved.activeTab === 'writer' || saved.activeTab === 'generate')) setActiveTab(saved.activeTab);
                if (saved.writerTopic) setWriterTopic(saved.writerTopic);
                if (saved.generatedDraft) setGeneratedDraft(saved.generatedDraft);
                if (saved.tweetText) setTweetText(saved.tweetText);
                if (saved.visualPrompt) setVisualPrompt(saved.visualPrompt);
                if (saved.negativePrompt) setNegativePrompt(saved.negativePrompt);
                if (saved.generatedImages) setGeneratedImages(saved.generatedImages);
            }
        }
    }, [brandName, initialDraft, initialVisualPrompt]);

    useEffect(() => {
        const state = {
            activeTab, writerTopic, generatedDraft, tweetText, visualPrompt, negativePrompt, generatedImages
        };
        const timeout = setTimeout(() => saveStudioState(brandName, state), 1000);
        return () => clearTimeout(timeout);
    }, [activeTab, writerTopic, generatedDraft, tweetText, visualPrompt, negativePrompt, generatedImages, brandName]);


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
        if (!tweetText && !visualPrompt && !selectedTemplate) return;
        setIsGenerating(true);
        setError(null);
        setGeneratedImages([]);
        try {
            const count = parseInt(variationCount);
            const promises = Array(count).fill(0).map(() =>
                generateWeb3Graphic({
                    prompt: tweetText || "Visual Content",
                    artPrompt: visualPrompt,
                    negativePrompt,
                    size,
                    aspectRatio,
                    brandConfig,
                    brandName,
                    templateType: selectedTemplate,
                    selectedReferenceImages: selectedReferenceImage ? [selectedReferenceImage] : undefined
                })
            );
            const images = await Promise.all(promises);
            setGeneratedImages(images);

            // Sync to Brain Memory (History)
            images.forEach(img => {
                saveBrainMemory(
                    brandName,
                    'FACT',
                    `Generated Visual: ${(tweetText || visualPrompt || 'Graphic').substring(0, 50)}...`,
                    undefined,
                    {
                        mediaUrl: img,
                        source: 'ContentStudio',
                        prompt: tweetText
                    }
                );
            });
        } catch (err: any) {
            setError(`Failed to generate: ${err.message || "Unknown error"}`);
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
        <div className="w-full h-full flex flex-col lg:flex-row gap-6 p-6 animate-fadeIn max-w-[1920px] mx-auto">

            {/* CONTROL PANEL */}
            <div className="w-full lg:w-[420px] bg-white border border-brand-border rounded-xl shadow-lg flex flex-col h-full overflow-hidden">

                {/* Mode Switcher */}
                <div className="p-4 border-b border-brand-border bg-gray-50/50">
                    <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                        <button
                            onClick={() => setActiveTab('writer')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'writer' ? 'bg-white text-brand-text shadow-sm' : 'text-brand-muted hover:text-brand-text'}`}
                        >
                            <span>✍️</span> Writer
                        </button>
                        <button
                            onClick={() => setActiveTab('generate')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'generate' ? 'bg-white text-indigo-600 shadow-sm' : 'text-brand-muted hover:text-brand-text'}`}
                        >
                            <span>🎨</span> Visuals
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">

                    {/* WRITER MODE */}
                    {activeTab === 'writer' && (
                        <div className="space-y-5 animate-fadeIn">
                            <div className="flex justify-between items-center mb-1">
                                <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Topic Inspiration</h3>
                                <button onClick={handleGenerateIdeas} disabled={isGeneratingIdeas} className="text-[10px] text-brand-accent hover:text-brand-text font-bold uppercase tracking-wide flex items-center gap-1">
                                    {isGeneratingIdeas ? <span className="animate-spin">⚡</span> : '⚡'} Inspire Me
                                </button>
                            </div>

                            {suggestedIdeas.length > 0 && (
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl overflow-hidden shadow-sm">
                                    {suggestedIdeas.map((idea, idx) => (
                                        <button key={idx} onClick={() => { setWriterTopic(idea); setSuggestedIdeas([]); }} className="w-full text-left px-3 py-2 text-xs text-brand-text hover:bg-white/50 border-b border-indigo-100 last:border-0 transition-colors">
                                            {idea}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-brand-text block mb-2">What are we writing about?</label>
                                <div className="relative">
                                    <textarea
                                        value={writerTopic}
                                        onChange={e => setWriterTopic(e.target.value)}
                                        placeholder="E.g. Explain our new tokenomics model..."
                                        className="w-full h-32 bg-gray-50 border border-brand-border rounded-xl p-3 text-sm text-brand-text focus:bg-white focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/50 outline-none resize-none transition-all placeholder-gray-400"
                                    />
                                </div>
                            </div>

                            <Select label="Tone of Voice" value={writerTone} onChange={e => setWriterTone(e.target.value)} options={[{ value: 'Professional', label: 'Professional' }, { value: 'Hype', label: 'Hype / Degen' }, { value: 'Casual', label: 'Casual' }, { value: 'Educational', label: 'Educational' }]} />

                            <div className="pt-4">
                                <Button onClick={handleAIWrite} isLoading={isWritingTweet} disabled={!writerTopic} className="w-full h-12 text-sm shadow-xl shadow-brand-accent/10">
                                    Generate Draft
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* VISUALS MODE */}
                    {activeTab === 'generate' && (
                        <div className="space-y-6 animate-fadeIn">

                            {/* Section 1: Content */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-xs font-bold text-brand-text">
                                    <span className="w-5 h-5 rounded bg-gray-100 text-gray-500 flex items-center justify-center text-[10px]">1</span>
                                    Content Context
                                </label>
                                <textarea
                                    value={tweetText}
                                    onChange={e => setTweetText(e.target.value)}
                                    placeholder="Paste tweet text or describe the scene..."
                                    className="w-full h-20 bg-gray-50 border border-brand-border rounded-xl p-3 text-sm text-brand-text focus:bg-white focus:border-indigo-500 outline-none resize-none transition-all"
                                />
                            </div>

                            <hr className="border-gray-100" />

                            {/* Section 2: Style */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-xs font-bold text-brand-text">
                                    <span className="w-5 h-5 rounded bg-gray-100 text-gray-500 flex items-center justify-center text-[10px]">2</span>
                                    Visual Style
                                </label>

                                {availableTemplates.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {availableTemplates.map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setSelectedTemplate(selectedTemplate === opt.id ? '' : opt.id)}
                                                className={`text-xs px-3 py-2.5 rounded-lg border transition-all text-left truncate ${selectedTemplate === opt.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={visualPrompt}
                                        onChange={e => setVisualPrompt(e.target.value)}
                                        placeholder="Add specific details (e.g. 'Neon lights')..."
                                        className="w-full bg-gray-50 border border-brand-border rounded-xl p-3 text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all"
                                    />
                                    <input
                                        type="text"
                                        value={negativePrompt}
                                        onChange={e => setNegativePrompt(e.target.value)}
                                        placeholder="No text, no blur, no people..."
                                        className="w-full bg-white border border-red-100 text-red-600 rounded-xl p-3 text-sm focus:border-red-300 outline-none transition-all placeholder-red-200"
                                    />
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Section 3: Reference */}
                            {brandConfig.referenceImages && brandConfig.referenceImages.length > 0 && (
                                <div className="space-y-3">
                                    <label className="flex items-center justify-between text-xs font-bold text-brand-text">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded bg-gray-100 text-gray-500 flex items-center justify-center text-[10px]">3</span>
                                            Reference Image
                                        </div>
                                        {selectedReferenceImage && <button onClick={() => setSelectedReferenceImage(null)} className="text-[10px] text-red-500 hover:underline">Clear</button>}
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {brandConfig.referenceImages.map((img) => (
                                            <div
                                                key={img.id}
                                                onClick={() => setSelectedReferenceImage(selectedReferenceImage === img.id ? null : img.id)}
                                                className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all relative group ${selectedReferenceImage === img.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-transparent hover:border-gray-200'}`}
                                            >
                                                <img src={img.url || img.data} className="w-full h-full object-cover" />
                                                {selectedReferenceImage === img.id && (
                                                    <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                                                        <div className="bg-white rounded-full p-1 shadow-sm"><div className="w-2 h-2 bg-indigo-500 rounded-full"></div></div>
                                                    </div>
                                                )}
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 translate-y-full group-hover:translate-y-0 transition-transform">
                                                    <p className="text-[8px] text-white truncate text-center">{img.name}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-2">
                                <Select label="Qty" value={variationCount} onChange={e => setVariationCount(e.target.value)} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]} />
                                <Select label="Ratio" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as any)} options={[{ value: '16:9', label: '16:9' }, { value: '1:1', label: '1:1' }, { value: '4:5', label: '4:5' }]} />
                                <Select label="Res" value={size} onChange={e => setSize(e.target.value as any)} options={[{ value: '1K', label: '1K' }, { value: '2K', label: '2K' }]} />
                            </div>

                            <Button onClick={handleGenerateSingle} isLoading={isGenerating} disabled={!tweetText && !visualPrompt && !selectedTemplate} className="w-full h-12 shadow-xl shadow-indigo-500/20 bg-gradient-to-r from-indigo-600 to-violet-600 border-none">
                                Render Graphics
                            </Button>
                        </div>
                    )}

                    {error && <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg text-center">{error}</div>}
                </div>
            </div>

            {/* PREVIEW CANVAS */}
            <div className="flex-1 bg-gray-50/50 border border-brand-border rounded-xl shadow-inner relative flex flex-col overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-10 border-b border-brand-border bg-white flex items-center px-4 justify-between z-10">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Canvas Preview</span>
                    <span className="text-[10px] text-gray-300">Auto-Saving</span>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-16 custom-scrollbar flex items-center justify-center min-h-[500px]">

                    {/* WRITER PREVIEW */}
                    {activeTab === 'writer' && (
                        generatedDraft ? (
                            <div className="w-full max-w-2xl bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 p-8 animate-fadeIn">
                                <textarea
                                    value={generatedDraft}
                                    onChange={e => setGeneratedDraft(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-xl font-display text-gray-800 focus:ring-0 resize-none min-h-[160px] leading-relaxed placeholder-gray-300"
                                    placeholder="Your draft will appear here..."
                                />
                                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-50">
                                    <Button onClick={() => handlePrepareTweet(generatedDraft)} variant="secondary" className="text-xs">Post to X</Button>
                                    <Button onClick={() => onSchedule(generatedDraft)} className="text-xs bg-gray-900 text-white">Schedule</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center opacity-30">
                                <div className="text-6xl mb-4">✍️</div>
                                <p className="font-bold text-gray-500">Drafting Board</p>
                            </div>
                        )
                    )}

                    {/* GENERATOR PREVIEW */}
                    {activeTab === 'generate' && (
                        generatedImages.length > 0 ? (
                            <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-8 content-start">
                                {generatedImages.map((img, idx) => (
                                    <div key={idx} className="relative group rounded-xl overflow-hidden shadow-2xl shadow-indigo-500/10 border-4 border-white cursor-pointer transition-all hover:scale-[1.02] hover:shadow-indigo-500/20" onClick={() => setViewingImage(img)}>
                                        <img src={img} className="w-full object-cover bg-gray-100" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                                            <Button onClick={(e) => { e.stopPropagation(); handleDownload(img); }} className="bg-white text-black hover:bg-gray-100 text-xs py-1 px-3 h-8">Download</Button>
                                            <Button onClick={(e) => { e.stopPropagation(); onSchedule(tweetText || 'Visual Content', img); }} className="text-xs py-1 px-3 h-8">Schedule</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center opacity-30">
                                <div className="text-6xl mb-4">🎨</div>
                                <p className="font-bold text-gray-500">Visual Canvas</p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {viewingImage && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-10 animate-fadeIn backdrop-blur-sm" onClick={() => setViewingImage(null)}>
                    <img src={viewingImage} className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                    <button onClick={() => setViewingImage(null)} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 rounded-full w-10 h-10 flex items-center justify-center">✕</button>
                    <div className="absolute bottom-10 flex gap-4">
                        <Button onClick={(e) => { e.stopPropagation(); handleDownload(viewingImage); }} className="bg-white text-black hover:bg-gray-200 border-none">Download High-Res</Button>
                    </div>
                </div>
            )}
        </div>
    );
};
