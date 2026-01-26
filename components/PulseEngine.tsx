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
    initialTrend?: TrendItem; // Deep Link Support
}

// Reusable Components matching Dashboard
const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-200 ${className}`}>
        {children}
    </div>
);

const Badge = ({ children, variant = "neutral" }: { children: React.ReactNode, variant?: "neutral" | "ai" | "hot" | "positive" | "negative" }) => {
    const styles = {
        neutral: "bg-white text-gray-600 border-gray-200",
        ai: "bg-white text-purple-600 border-purple-200",
        hot: "bg-white text-orange-600 border-orange-200",
        positive: "bg-white text-emerald-600 border-emerald-200",
        negative: "bg-white text-red-600 border-red-200"
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[variant]} flex items-center gap-1.5`}>
            {children}
        </span>
    );
};

// Skeleton Loader for Trends
const TrendSkeleton = () => (
    <div className="p-5 rounded-2xl border border-gray-100 bg-white animate-pulse">
        <div className="flex justify-between mb-3">
            <div className="h-4 w-20 bg-gray-200 rounded"></div>
            <div className="h-4 w-12 bg-gray-200 rounded"></div>
        </div>
        <div className="h-5 w-3/4 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 w-full bg-gray-100 rounded mb-4"></div>
        <div className="h-2 w-full bg-gray-100 rounded"></div>
    </div>
);

export const PulseEngine: React.FC<PulseEngineProps> = ({ brandName, brandConfig, onLaunchCampaign, onSchedule, initialTrend }) => {
    const [trends, setTrends] = useState<TrendItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<number>(0);
    const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null);

    // Filters & Inputs
    const [sourceFilter, setSourceFilter] = useState<'All' | 'Twitter' | 'News' | 'OnChain' | 'LunarCrush AI'>('All');
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

    // Deep Link Effect
    useEffect(() => {
        if (initialTrend) {
            setSelectedTrend(initialTrend);
            // Ensure it's in the list safely if we haven't scanned yet
            setTrends(prev => {
                const exists = prev.find(p => p.id === initialTrend.id);
                return exists ? prev : [initialTrend, ...prev];
            });
        }
    }, [initialTrend]);

    useEffect(() => {
        const cache = loadPulseCache(brandName);
        setTrends(cache.items);
        setLastUpdated(cache.lastUpdated);

        const now = Date.now();
        const CACHE_DURATION = 30000; // 30s cache for better UX
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

    const filteredTrends = sourceFilter === 'All' ? trends : trends.filter(t => t.source === sourceFilter || (sourceFilter === 'LunarCrush AI' && t.source.includes('LunarCrush')));

    return (
        <div className="w-full p-6 font-sans mx-auto animate-fadeIn max-w-[1920px]">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">Intelligence Feed</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <p className="text-xs text-gray-500 font-medium">Listening to {brandName} Market Signals...</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="hidden md:flex gap-1 mr-4">
                        <button onClick={handleDiscordScan} className="text-[10px] px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                            Scout Discord
                        </button>
                        <button onClick={handleTelegramScan} className="text-[10px] px-3 py-1.5 bg-sky-50 text-sky-700 font-bold rounded-lg hover:bg-sky-100 transition-colors">
                            Scout Telegram
                        </button>
                    </div>
                    <Button onClick={handleScan} disabled={isLoading} variant="secondary" className="h-8 text-[10px] bg-white border-gray-200">
                        {isLoading ? 'Scanning...' : 'Refresh Feed'}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-180px)]">

                {/* LEFT COLUMN: SIGNAL FEED (4/12) */}
                <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-hidden">

                    {/* FILTER BAR w/ SEARCH */}
                    <div className="flex gap-2 mb-2 p-1 border-b border-gray-100 overflow-x-auto scrollbar-hide pb-3">
                        {(['All', 'Twitter', 'LunarCrush AI', 'News'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setSourceFilter(filter)}
                                className={`px-3 py-1.5 rounded textxs font-bold transition-all whitespace-nowrap ${sourceFilter === filter
                                    ? 'bg-gray-900 text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                            >
                                {filter === 'LunarCrush AI' ? 'AI Signals' : filter}
                            </button>
                        ))}
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1 space-y-4 pr-2">
                        {/* Manual Input Inline */}
                        <div className="bg-white p-3 rounded-xl border border-gray-200 hover:border-blue-400 shadow-sm flex gap-2 items-center focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={manualSignal}
                                onChange={(e) => setManualSignal(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                                placeholder="Paste a URL or topic to analyze..."
                                className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-gray-400"
                            />
                            <button onClick={handleManualAdd} className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition-colors">Add</button>
                        </div>

                        {/* LOAD STATE */}
                        {isLoading && trends.length === 0 && (
                            <>
                                <TrendSkeleton />
                                <TrendSkeleton />
                                <TrendSkeleton />
                            </>
                        )}

                        {filteredTrends.map((trend) => {
                            // Clean up headline
                            const cleanHeadline = trend.headline.replace(/ trending/i, '').trim();

                            // Calculate signal strength (1-5 bars)
                            const strength = Math.ceil((trend.relevanceScore / 100) * 5);

                            return (
                                <div
                                    key={trend.id}
                                    onClick={() => { setSelectedTrend(trend); setGeneratedText(''); setGeneratedImage(''); }}
                                    className={`group relative p-4 rounded-xl border transition-all cursor-pointer mb-3
                                    ${selectedTrend?.id === trend.id
                                            ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500/20 shadow-md'
                                            : 'bg-white border-gray-100 hover:border-blue-300 hover:shadow-sm'
                                        }
                                `}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${trend.source.includes('LunarCrush') ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                trend.source === 'Twitter' ? 'bg-sky-100 text-sky-700 border-sky-200' :
                                                    'bg-gray-100 text-gray-600 border-gray-200'
                                                }`}>
                                                {trend.source.replace('LunarCrush ', '')}
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-mono">{new Date(trend.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>

                                        {/* Signal Strength Visual */}
                                        <div className="flex items-end gap-0.5 h-3" title={`Signal Strength: ${trend.relevanceScore}%`}>
                                            {[1, 2, 3, 4, 5].map(bar => (
                                                <div
                                                    key={bar}
                                                    className={`w-1 rounded-sm ${bar <= strength
                                                        ? (strength >= 4 ? 'bg-emerald-500' : 'bg-blue-500')
                                                        : 'bg-gray-200'}`}
                                                    style={{ height: `${bar * 20}%` }}
                                                ></div>
                                            ))}
                                        </div>
                                    </div>

                                    <h3 className="font-bold text-sm text-gray-900 leading-snug mb-1.5 group-hover:text-blue-600 transition-colors capitalize">
                                        {cleanHeadline}
                                    </h3>

                                    <p className="text-[11px] text-gray-500 line-clamp-2 mb-3 leading-relaxed">
                                        {trend.summary}
                                    </p>

                                    <div className="flex items-center justify-between pt-2 border-t border-gray-50/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Velocity</span>
                                            <span className={`text-[10px] font-mono font-bold ${trend.relevanceScore > 80 ? 'text-emerald-600' : 'text-gray-600'}`}>
                                                {trend.relevanceScore > 90 ? 'CRITICAL' : trend.relevanceScore > 75 ? 'HIGH' : 'NORMAL'}
                                            </span>
                                        </div>
                                        {trend.relevanceScore > 80 && (
                                            <span className="flex items-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                                                <span className="animate-pulse">🔥</span> Breakout
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}

                        {filteredTrends.length === 0 && !isLoading && (
                            <div className="text-center py-20 text-gray-400">
                                <p className="text-sm">No signals found via this filter.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: COMMAND CENTER (8/12) */}
                <div className="lg:col-span-8 h-full">
                    {selectedTrend ? (
                        <Card className="h-full flex flex-col relative overflow-hidden border-blue-100 shadow-xl shadow-blue-900/5">
                            {/* Header */}
                            <div className="mb-8 relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <Badge variant={selectedTrend.sentiment === 'Positive' ? 'positive' : 'neutral'}>
                                        {selectedTrend.sentiment} Sentiment
                                    </Badge>
                                    <span className="text-xs text-gray-400 px-2 border-l border-gray-200">ID: {selectedTrend.id}</span>
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                                    {selectedTrend.headline}
                                </h2>
                                <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                                    <p className="text-gray-700 leading-relaxed text-sm md:text-base">{selectedTrend.summary}</p>
                                    <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 text-sm">
                                        <span className="font-bold text-purple-600">AI Insight:</span>
                                        <span className="text-gray-600">{selectedTrend.relevanceReason}</span>
                                    </div>
                                </div>
                            </div>

                            {/* WORKSPACE */}
                            <div className="flex-1 min-h-0 flex flex-col">
                                {!generatedText && !isGenerating ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto mb-auto">
                                        <button
                                            onClick={() => { setActionType('Tweet'); handleGenerateContent(); }}
                                            className="group relative p-6 rounded-xl border border-gray-200 bg-white hover:border-blue-500 hover:shadow-md transition-all text-left"
                                        >
                                            <div className="absolute top-4 right-4 text-gray-200 group-hover:text-blue-500 transition-colors">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.664A2 2 0 017 12h0a2 2 0 012 2v4a2 2 0 01-2 2H7a2 2 0 01-2-2v-4z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 mb-1">Official Response</h3>
                                            <p className="text-xs text-gray-500">Draft a professional, brand-aligned announcement.</p>
                                        </button>

                                        <button
                                            onClick={() => { setActionType('Meme'); handleGenerateContent(); }}
                                            className="group relative p-6 rounded-xl border border-gray-200 bg-white hover:border-purple-500 hover:shadow-md transition-all text-left"
                                        >
                                            <div className="absolute top-4 right-4 text-gray-200 group-hover:text-purple-500 transition-colors">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 mb-1">Viral / Meme</h3>
                                            <p className="text-xs text-gray-500">Draft a high-engagement, culture-fit post.</p>
                                        </button>

                                        <div className="md:col-span-2 text-center mt-4">
                                            <button
                                                onClick={() => onLaunchCampaign(selectedTrend)}
                                                className="text-[10px] font-bold text-gray-400 hover:text-blue-600 transition-colors uppercase tracking-widest flex items-center justify-center gap-1"
                                            >
                                                Start Full Campaign
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col h-full min-h-0 animate-fadeIn">
                                        {isGenerating ? (
                                            <div className="flex-1 flex flex-col items-center justify-center">
                                                <div className="w-16 h-16 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                                                <p className="text-lg font-bold text-gray-900">Constructing Response...</p>
                                                <p className="text-gray-500">Analyzing sentiment & rendering assets</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                                                {/* Editor */}
                                                <div className="flex-1 flex flex-col gap-2">
                                                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Draft Content</label>
                                                    <textarea
                                                        value={generatedText}
                                                        onChange={e => setGeneratedText(e.target.value)}
                                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-base focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-medium text-gray-800"
                                                    />
                                                </div>

                                                {/* Visuals */}
                                                <div className="w-full md:w-1/3 flex flex-col gap-2">
                                                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Visual</label>
                                                    <div className="aspect-square bg-gray-100 rounded-xl border border-gray-200 overflow-hidden relative group">
                                                        {generatedImage ? (
                                                            <>
                                                                <img src={generatedImage} className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 gap-2">
                                                                    <Button onClick={handleRegenerateImage} variant="secondary" className="w-full text-xs">Redo</Button>
                                                                    <a href={generatedImage} download="asset.png" className="bg-white/20 text-white w-full py-2 text-center rounded text-xs font-bold backdrop-blur-sm hover:bg-white/30">Download</a>
                                                                </div>
                                                                {isRegeneratingImage && (
                                                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-gray-300 text-xs">No Image</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {!isGenerating && (
                                            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between items-center">
                                                <button onClick={() => { setGeneratedText(''); setGeneratedImage(''); }} className="text-gray-400 hover:text-red-500 text-sm font-bold">Cancel</button>
                                                <div className="flex gap-3">
                                                    <Button onClick={() => onSchedule(generatedText, generatedImage)} variant="secondary">Schedule</Button>
                                                    <Button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(generatedText)}`, '_blank')}>Post Now</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>
                    ) : (
                        <Card className="h-full flex flex-col items-center justify-center text-center p-12 bg-white border-dashed border-gray-200">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                                <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Awaiting Signal Selection</h2>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto">Select any trending topic from the Intelligence Feed to activate the War Room.</p>
                            <div className="mt-8 flex gap-2 items-center">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">AI Listening Active</span>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};
