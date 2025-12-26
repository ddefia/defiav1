
import React, { useState, useEffect, useRef } from 'react';
import { TrendItem, BrandConfig } from '../types';
import { fetchMarketPulse } from '../services/pulse';
import { generateTrendReaction, generateWeb3Graphic, generateBusinessConnections } from '../services/gemini';
import { loadPulseCache, savePulseCache } from '../services/storage';
import { scanDiscordChannel } from '../services/discord';
import { scanTelegramChats } from '../services/telegram';
import { Button } from './Button';

interface PulseEngineProps {
    brandName: string;
    brandConfig: BrandConfig;
    onLaunchCampaign: (trend: TrendItem) => void;
    onSchedule: (content: string, image?: string) => void;
}

export const PulseEngine: React.FC<PulseEngineProps> = ({ brandName, brandConfig, onLaunchCampaign, onSchedule }) => {
    const [trends, setTrends] = useState<TrendItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<number>(0);
    const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null);

    // Filters & Inputs
    const [sourceFilter, setSourceFilter] = useState<'All' | 'Twitter' | 'News' | 'OnChain' | 'LunarCrush'>('All');
    const [manualSignal, setManualSignal] = useState('');

    // Business Connection State
    const [businessIdeas, setBusinessIdeas] = useState('');
    const [isAnalyzingBusiness, setIsAnalyzingBusiness] = useState(false);

    // Action State
    const [generatedText, setGeneratedText] = useState('');
    const [generatedImage, setGeneratedImage] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
    const [actionType, setActionType] = useState<'Tweet' | 'Meme'>('Tweet');

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const cache = loadPulseCache(brandName);
        setTrends(cache.items);
        setLastUpdated(cache.lastUpdated);

        const now = Date.now();
        const CACHE_DURATION = 1000; // 1 second (Force Refresh for Dev)
        const shouldFetch = (now - cache.lastUpdated) > CACHE_DURATION || cache.items.length === 0;

        if (shouldFetch) {
            handleScan();
        }

        intervalRef.current = setInterval(() => {
            const currentCache = loadPulseCache(brandName);
            const currentNow = Date.now();
            if ((currentNow - currentCache.lastUpdated) > CACHE_DURATION) {
                handleScan();
            }
        }, CACHE_DURATION);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [brandName]);

    const handleScan = async () => {
        setIsLoading(true);
        try {
            const newItems = await fetchMarketPulse(brandName);
            const now = Date.now();

            const cache = loadPulseCache(brandName);
            const existingMap = new Map(cache.items.map(i => [i.id, i]));
            newItems.forEach(item => existingMap.set(item.id, item));

            const mergedItems = Array.from(existingMap.values());
            mergedItems.sort((a, b) => b.createdAt - a.createdAt);

            setTrends(mergedItems);
            setLastUpdated(now);
            savePulseCache(brandName, { lastUpdated: now, items: mergedItems });

        } catch (e) {
            console.error("Pulse scan failed", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiscordScan = async () => {
        const channelId = window.prompt("Enter Discord Channel ID to scan:", "10987654321"); // Default placeholder
        if (!channelId) return;

        setIsLoading(true);
        try {
            const result = await scanDiscordChannel(channelId, 'Community-General');
            alert(result.message);
            if (result.success) handleScan(); // Refresh pulse
        } catch (e) {
            console.error(e);
            alert("Discord scan failed. Check console.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTelegramScan = async () => {
        setIsLoading(true);
        try {
            const result = await scanTelegramChats();
            alert(result.message);
            if (result.success) handleScan(); // Refresh pulse
        } catch (e) {
            console.error(e);
            alert("Telegram scan failed. Check console.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualAdd = () => {
        if (!manualSignal.trim()) return;
        const newTrend: TrendItem = {
            id: `manual-${Date.now()}`,
            source: 'News',
            headline: "Manual Signal: " + manualSignal,
            summary: "User added signal for immediate reaction.",
            relevanceScore: 100,
            relevanceReason: "Manually triggered by user.",
            sentiment: 'Neutral',
            timestamp: 'Just now',
            createdAt: Date.now()
        };
        setTrends([newTrend, ...trends]);
        setSelectedTrend(newTrend);
        setManualSignal('');
    };

    const handleAct = async (trend: TrendItem) => {
        setSelectedTrend(trend);
        setGeneratedText('');
        setGeneratedImage('');
    };

    const handleGenerateContent = async () => {
        if (!selectedTrend) return;
        setIsGenerating(true);
        try {
            const text = await generateTrendReaction(selectedTrend, brandName, brandConfig, actionType);
            setGeneratedText(text);

            const img = await generateWeb3Graphic({
                prompt: `Editorial graphic for ${brandName} related to: ${selectedTrend.headline}. Context: ${selectedTrend.summary}`,
                size: '1K',
                aspectRatio: '16:9',
                brandConfig: brandConfig,
                brandName: brandName,
                artPrompt: actionType === 'Meme' ? 'Funny meme style, high contrast, internet culture' : undefined
            });
            setGeneratedImage(img);

        } catch (e) {
            console.error("Generation failed", e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRegenerateImage = async () => {
        if (!selectedTrend || !generatedText) return;
        setIsRegeneratingImage(true);
        try {
            const img = await generateWeb3Graphic({
                prompt: `Editorial graphic for ${brandName} related to: ${selectedTrend.headline}. Context: ${selectedTrend.summary}`,
                size: '1K',
                aspectRatio: '16:9',
                brandConfig: brandConfig,
                brandName: brandName,
                artPrompt: actionType === 'Meme' ? 'Funny meme style, high contrast, internet culture' : undefined
            });
            setGeneratedImage(img);
        } catch (e) {
            console.error("Image regeneration failed", e);
        } finally {
            setIsRegeneratingImage(false);
        }
    };

    const handleAnalyzeBusiness = async () => {
        if (trends.length === 0) return;
        setIsAnalyzingBusiness(true);
        setBusinessIdeas('');
        try {
            const ideas = await generateBusinessConnections(trends, brandName, brandConfig);
            setBusinessIdeas(ideas);
        } catch (e) {
            console.error("Analysis failed", e);
        } finally {
            setIsAnalyzingBusiness(false);
        }
    };

    const getSourceIcon = (source: string) => {
        if (source === 'Twitter') return <span className="text-blue-400">🐦</span>;
        if (source === 'OnChain') return <span className="text-orange-500">🔗</span>;
        if (source === 'LunarCrush') return <span className="text-purple-400">🌕</span>;
        if (source === 'DISCORD') return <span className="text-[#5865F2]">👾</span>;
        if (source === 'TELEGRAM') return <span className="text-[#229ED9]">✈️</span>;
        return <span className="text-gray-500">📰</span>;
    };

    const filteredTrends = sourceFilter === 'All' ? trends : trends.filter(t => t.source === sourceFilter);

    // Debug State
    const [isDebugMode, setIsDebugMode] = useState(false);

    return (
        <div className="w-full h-full flex flex-col lg:flex-row gap-8 animate-fadeIn pb-10">

            {/* LEFT: TREND FEED */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl border border-brand-border shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-display font-bold text-brand-text">Market Pulse</h2>
                            <p className="text-sm text-brand-muted">Real-time signals detected for {brandName}</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex gap-1">
                                <button onClick={handleDiscordScan} className="text-[10px] bg-[#5865F2] text-white px-2 py-1 rounded hover:opacity-90 transition-opacity flex items-center gap-1">
                                    👾 <span className="hidden sm:inline">Discord</span>
                                </button>
                                <button onClick={handleTelegramScan} className="text-[10px] bg-[#229ED9] text-white px-2 py-1 rounded hover:opacity-90 transition-opacity flex items-center gap-1">
                                    ✈️ <span className="hidden sm:inline">Tel</span>
                                </button>
                            </div>
                            <button
                                onClick={() => setIsDebugMode(!isDebugMode)}
                                className={`text-xs px-2 py-1 rounded border ${isDebugMode ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-gray-50 text-gray-400'}`}
                            >
                                🐞 Debug
                            </button>
                            <Button onClick={handleScan} disabled={isLoading} variant="secondary" className="h-8 text-xs px-3">
                                {isLoading ? 'Scanning...' : 'Refresh'}
                            </Button>
                        </div>
                    </div>

                    {/* Manual Input */}
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            value={manualSignal}
                            onChange={(e) => setManualSignal(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                            placeholder="Paste URL or topic to analyze..."
                            className="flex-1 bg-gray-50 border border-brand-border rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-accent"
                        />
                        <button
                            onClick={handleManualAdd}
                            className="bg-brand-text text-white px-3 py-2 rounded text-xs font-bold hover:bg-black"
                        >
                            + Add
                        </button>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {(['All', 'Twitter', 'OnChain', 'News', 'LunarCrush'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setSourceFilter(filter)}
                                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors whitespace-nowrap ${sourceFilter === filter
                                    ? 'bg-brand-text text-white border-brand-text'
                                    : 'bg-white text-brand-muted border-brand-border hover:border-gray-400'
                                    }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    {/* DEBUG PANEL - ANALYSIS OUTPUT */}
                    {isDebugMode && (
                        <div className="mt-4 bg-amber-50 p-2 rounded border border-amber-200 text-[10px] font-mono overflow-x-auto">
                            <strong className="block text-amber-800 mb-1">RAW OUTPUT (Strategic Analysis):</strong>
                            <pre className="text-amber-900 whitespace-pre-wrap">{businessIdeas || "No analysis generated yet."}</pre>
                        </div>
                    )}
                </div>


                {/* DEBUG PANEL - RAW INPUT */}
                {isDebugMode && (
                    <div className="bg-gray-900 text-green-400 p-4 rounded-xl border border-gray-700 font-mono text-xs overflow-y-auto max-h-60 shadow-lg">
                        <strong className="block text-white mb-2 border-b border-gray-700 pb-1">API RAW DATA (Input Trends):</strong>
                        <pre>{JSON.stringify(trends, null, 2)}</pre>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[calc(100vh-250px)]">
                    {filteredTrends.map((trend) => (
                        <div
                            key={trend.id}
                            onClick={() => handleAct(trend)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md bg-white relative overflow-hidden
                                ${selectedTrend?.id === trend.id ? 'border-brand-accent ring-1 ring-brand-accent shadow-md' : 'border-brand-border hover:border-gray-300'}
                                ${isLoading ? 'opacity-50' : 'opacity-100'}
                            `}
                        >
                            {/* Score Indicator Background */}
                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-gray-100 to-transparent"></div>

                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-gray-50 rounded-md border border-gray-100 shadow-sm">{getSourceIcon(trend.source)}</div>
                                    <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">{trend.timestamp}</span>
                                </div>
                                {trend.relevanceScore > 80 && <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full shadow-sm">HOT</span>}
                            </div>

                            <h3 className="font-bold text-sm text-brand-text mb-2 leading-snug pr-4">{trend.headline}</h3>

                            <div className="flex items-center gap-2 mt-3">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${trend.sentiment === 'Positive' ? 'bg-green-500' : 'bg-brand-accent'}`}
                                        style={{ width: `${trend.relevanceScore}%` }}
                                    ></div>
                                </div>
                                <span className="text-[10px] font-bold text-brand-muted">{trend.relevanceScore}% Rel.</span>
                            </div>
                        </div>
                    ))}
                    {filteredTrends.length === 0 && !isLoading && (
                        <div className="text-center py-10 text-brand-muted text-sm bg-white rounded-xl border border-dashed border-brand-border">
                            No active signals found for this filter.
                        </div>
                    )}
                </div>
            </div>


            {/* RIGHT: ACTION CENTER */}
            <div className="flex-1 bg-white border border-brand-border rounded-xl p-6 shadow-sm flex flex-col h-full min-h-[600px]">
                {!selectedTrend ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-brand-muted">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-2xl font-bold text-brand-text mb-2 font-display">Select a Signal</h3>
                        <p className="text-sm max-w-sm text-gray-500">Choose a trending topic from the feed to analyze and generate targeted content instantly.</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col animate-fadeIn h-full">
                        <div className="border-b border-brand-border pb-6 mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded border border-gray-200">ID: {selectedTrend.id}</span>
                                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${selectedTrend.sentiment === 'Positive' ? 'bg-green-50 text-green-700 border-green-200' :
                                    selectedTrend.sentiment === 'Negative' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}>
                                    {selectedTrend.sentiment} Sentiment
                                </span>
                            </div>
                            <h2 className="text-3xl font-display font-bold text-brand-text leading-tight mb-4">{selectedTrend.headline}</h2>
                            <div className="bg-gray-50 p-4 rounded-lg border border-brand-border">
                                <p className="text-sm text-brand-text leading-relaxed">{selectedTrend.summary}</p>
                                <div className="mt-3 pt-3 border-t border-gray-200 flex items-start gap-2">
                                    <span className="text-brand-accent">💡</span>
                                    <p className="text-xs text-brand-muted font-medium italic">{selectedTrend.relevanceReason}</p>
                                </div>
                            </div>
                        </div>

                        {!generatedText && !isGenerating && (
                            <div className="space-y-6 max-w-2xl mx-auto w-full mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setActionType('Tweet')}
                                        className={`p-6 rounded-xl border text-left transition-all group ${actionType === 'Tweet' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-brand-border hover:border-gray-300 hover:shadow-sm'}`}
                                    >
                                        <div className={`font-bold text-lg mb-2 ${actionType === 'Tweet' ? 'text-indigo-700' : 'text-gray-900'}`}>📢 Official Comms</div>
                                        <div className="text-xs text-gray-500">Authoritative, brand-aligned response to the news.</div>
                                    </button>
                                    <button
                                        onClick={() => setActionType('Meme')}
                                        className={`p-6 rounded-xl border text-left transition-all group ${actionType === 'Meme' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-brand-border hover:border-gray-300 hover:shadow-sm'}`}
                                    >
                                        <div className={`font-bold text-lg mb-2 ${actionType === 'Meme' ? 'text-indigo-700' : 'text-gray-900'}`}>🐸 Degen / Meme</div>
                                        <div className="text-xs text-gray-500">Culture-fit, high engagement, community focused.</div>
                                    </button>
                                </div>

                                <Button onClick={handleGenerateContent} className="w-full h-12 text-sm shadow-lg shadow-indigo-500/20">
                                    Generate Reaction Assets
                                </Button>

                                <div className="text-center pt-4">
                                    <button
                                        onClick={() => onLaunchCampaign(selectedTrend)}
                                        className="text-xs text-brand-muted hover:text-brand-accent underline transition-colors"
                                    >
                                        or launch a full multi-day campaign based on this topic
                                    </button>
                                </div>
                            </div>
                        )}

                        {isGenerating && (
                            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-brand-border rounded-full"></div>
                                    <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="font-bold text-brand-text">Constructing Response...</p>
                                    <p className="text-sm text-brand-muted">Analyzing sentiment, drafting copy, and rendering visuals.</p>
                                </div>
                            </div>
                        )}

                        {generatedText && !isGenerating && (
                            <div className="space-y-6 animate-fadeIn h-full flex flex-col">
                                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Text Column */}
                                    <div className="flex flex-col gap-4">
                                        <label className="text-xs font-bold text-brand-muted uppercase">Draft Copy</label>
                                        <div className="bg-white border border-brand-border rounded-xl p-4 shadow-sm flex-1">
                                            <textarea
                                                value={generatedText}
                                                onChange={(e) => setGeneratedText(e.target.value)}
                                                className="w-full h-full bg-transparent border-none p-0 text-lg text-brand-text focus:ring-0 resize-none leading-relaxed"
                                            />
                                        </div>
                                    </div>

                                    {/* Image Column */}
                                    <div className="flex flex-col gap-4">
                                        <label className="text-xs font-bold text-brand-muted uppercase">Visual Asset</label>
                                        {generatedImage && (
                                            <div className="relative group rounded-xl overflow-hidden border border-brand-border shadow-md bg-gray-100 aspect-video flex items-center justify-center">
                                                {isRegeneratingImage && (
                                                    <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                                                        <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
                                                    </div>
                                                )}
                                                <img src={generatedImage} alt="Generated visual" className="w-full h-full object-cover" />

                                                {/* Hover Overlay */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-300 gap-3 p-6">
                                                    <Button onClick={handleRegenerateImage} variant="secondary" className="w-full max-w-[200px] h-9 text-xs">
                                                        Redo Image
                                                    </Button>
                                                    <a href={generatedImage} download={`pulse-${selectedTrend.id}.png`} className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 h-9 flex items-center justify-center w-full max-w-[200px]">
                                                        Download High-Res
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-brand-border pt-6 mt-auto">
                                    <div className="flex justify-between items-center">
                                        <button onClick={() => { setGeneratedText(''); setGeneratedImage(''); }} className="text-sm text-brand-muted hover:text-red-500 px-4">
                                            Discard
                                        </button>
                                        <div className="flex gap-4">
                                            <Button
                                                onClick={() => onSchedule(generatedText, generatedImage)}
                                                variant="secondary"
                                                className="px-8"
                                            >
                                                Schedule
                                            </Button>
                                            <Button
                                                onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(generatedText)}`, '_blank')}
                                                className="px-8 shadow-lg shadow-brand-accent/20"
                                            >
                                                Post Now
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
};
