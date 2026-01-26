import React, { useState, useMemo } from 'react';
import { LunarCrushPost, SocialMetrics, SocialSignals } from '../types';
import { generateSmartReply } from '../services/gemini';

interface SocialMediaProps {
    brandName: string;
    lunarPosts: LunarCrushPost[];
    socialMetrics: SocialMetrics | null;
    signals: SocialSignals;
    initialFilter?: string;
}

// --- SUB-COMPONENTS ---
const SocialStatusBadge = ({ sentiment }: { sentiment: string }) => {
    const colors: Record<string, string> = {
        'BULLISH': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'BEARISH': 'bg-red-50 text-red-600 border-red-100',
        'NEUTRAL': 'bg-gray-50 text-gray-600 border-gray-100',
        'HIGH': 'bg-emerald-50 text-emerald-600',
        'LOW': 'bg-amber-50 text-amber-600',
    };
    return (
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${colors[sentiment] || 'bg-gray-100'}`}>
            {sentiment}
        </span>
    );
};

export const SocialMedia: React.FC<SocialMediaProps> = ({ brandName, lunarPosts, socialMetrics, signals, initialFilter }) => {
    const [activePlatform, setActivePlatform] = useState<'twitter' | 'telegram' | 'discord'>('twitter');
    const [activeFilter, setActiveFilter] = useState<string>(initialFilter || 'all');

    // Use shared state from App/Brain
    const { sentimentScore, activeNarratives } = signals;

    // --- KPI CALCULATIONS ---
    const kpis = useMemo(() => {
        const volumeSpike = 128; // Mock for now, or derive
        const sentimentLabel = sentimentScore > 60 ? 'BULLISH' : 'BEARISH';
        const engagementRate = socialMetrics?.engagementRate || 0.0;

        return [
            {
                label: 'Community Sentiment',
                value: `${sentimentScore}/100`,
                delta: 5.2,
                trend: sentimentScore > 50 ? 'up' : 'down',
                confidence: 'High',
                statusLabel: sentimentLabel,
                sparklineData: [45, 48, 52, 49, 60, 58, sentimentScore]
            },
            {
                label: 'Social Volume (24h)',
                value: '+128%',
                delta: 12.5,
                trend: 'up',
                confidence: 'High',
                statusLabel: 'Trending',
                sparklineData: [80, 90, 85, 110, 100, 115, 128]
            },
            {
                label: 'Engagement Rate',
                value: `${engagementRate}%`,
                delta: -0.5,
                trend: 'flat',
                confidence: 'Med',
                statusLabel: engagementRate > 2 ? 'Strong' : 'Watch',
                sparklineData: [2.1, 2.3, 2.2, 2.0, 1.9, 2.1, engagementRate]
            },
            {
                label: 'Active Narratives',
                value: activeNarratives.length.toString(),
                delta: activeNarratives.length > 2 ? 1 : 0,
                trend: 'up',
                confidence: 'High',
                statusLabel: 'Active',
                sparklineData: [1, 1, 2, 2, 3, 3, activeNarratives.length]
            },
            {
                label: 'Voice Share',
                value: '4.2%',
                delta: 0.8,
                trend: 'up',
                confidence: 'Low',
                statusLabel: 'Growing',
                sparklineData: [3.5, 3.8, 3.9, 4.0, 4.1, 4.2]
            }
        ];
    }, [sentimentScore, socialMetrics, activeNarratives]);

    return (
        <div className="w-full h-full p-6 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-8 border-b border-gray-200 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">
                        Social Command Center
                    </h1>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Listening Pattern Active for {brandName}
                    </div>
                </div>

                {/* Platform Selector (Top Right) */}
                <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                    {[
                        { id: 'twitter', icon: '🐦' },
                        { id: 'telegram', icon: '✈️' },
                        { id: 'discord', icon: '💬' }
                    ].map(p => (
                        <button
                            key={p.id}
                            onClick={() => setActivePlatform(p.id as any)}
                            className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${activePlatform === p.id ? 'bg-gray-100 text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                            title={p.id}
                        >
                            <span className="text-sm">{p.icon}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI ROW */}
            <div className="grid grid-cols-5 gap-4 mb-8">
                {kpis.map((kpi, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm relative group hover:border-gray-300 transition-colors">
                        {/* Confidence Dot */}
                        <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${kpi.confidence === 'High' ? 'bg-emerald-500' : 'bg-amber-500'}`} title={`Confidence: ${kpi.confidence}`}></div>

                        <div className="mb-2">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</div>
                            <div className="text-2xl font-bold text-gray-900 tracking-tight">{kpi.value}</div>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                            <div className={`text-[10px] font-bold flex items-center gap-1 ${kpi.trend === 'up' ? 'text-emerald-600' : kpi.trend === 'down' ? 'text-rose-600' : 'text-gray-500'}`}>
                                {kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→'} {Math.abs(kpi.delta)}%
                            </div>
                            <SocialStatusBadge sentiment={kpi.statusLabel} />
                        </div>
                    </div>
                ))}
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-12 gap-8 mb-12">

                {/* LEFT RAIL: FILTERS & NARRATIVES */}
                <div className="col-span-3 space-y-6">
                    {/* Smart Filters */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Signal Filters</h3>
                        </div>
                        <div className="p-2 space-y-1">
                            <button onClick={() => setActiveFilter('all')} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'all' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                                ⚡ All Mentions
                            </button>
                            <button onClick={() => setActiveFilter('kol')} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'kol' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                                💎 KOL Watchlist
                            </button>
                            <button onClick={() => setActiveFilter('fud')} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'fud' ? 'bg-rose-50 text-rose-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                                🛡️ FUD Alert
                            </button>
                            <button onClick={() => setActiveFilter('alpha')} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeFilter === 'alpha' ? 'bg-amber-50 text-amber-700 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                                🚀 Alpha / Hype
                            </button>
                        </div>
                    </div>

                    {/* Active Narratives Card (Moved from top) */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Active Narratives</h3>
                        </div>
                        <div className="p-4 flex flex-wrap gap-2">
                            {activeNarratives.map(tag => (
                                <span key={tag} className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-[10px] font-bold hover:bg-indigo-100 cursor-pointer transition-colors">
                                    {tag}
                                </span>
                            ))}
                            <button className="px-2 py-1 bg-gray-50 text-gray-400 border border-gray-100 border-dashed rounded-md text-[10px] font-medium hover:bg-gray-100 transition-colors">
                                + Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* CENTER: FEED */}
                <div className="col-span-9">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[800px]">
                        {/* Feed Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-xl">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <h2 className="text-sm font-bold text-gray-900">
                                    {activeFilter === 'all' && 'Live Activity Feed'}
                                    {activeFilter === 'kol' && 'Influencer Watch'}
                                    {activeFilter === 'fud' && 'Risk Monitoring'}
                                    {activeFilter === 'alpha' && 'High Signal Triggers'}
                                </h2>
                            </div>
                            <div className="relative">
                                <input type="text" placeholder="Search feed..." className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 w-64 transition-all" />
                                <svg className="w-4 h-4 text-gray-400 absolute right-3 top-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>

                        {/* Feed Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50/30">

                            {/* EMPTY STATES FOR MOCK PLATFORMS first */}
                            {activePlatform === 'telegram' && (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4 text-2xl">✈️</div>
                                    <h3 className="font-bold text-gray-900">Telegram Command Center</h3>
                                    <p className="text-xs text-gray-500 mt-2 max-w-xs">Connect your automated raid bot to manage community raids directly from here.</p>
                                    <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-blue-700 uppercase tracking-wide">Connect Bot</button>
                                </div>
                            )}

                            {activePlatform === 'discord' && (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4 text-2xl">💬</div>
                                    <h3 className="font-bold text-gray-900">Discord Sentinel</h3>
                                    <p className="text-xs text-gray-500 mt-2 max-w-xs">Track server growth, support tickets, and FUD alerts.</p>
                                    <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 uppercase tracking-wide">Install Sentinel</button>
                                </div>
                            )}

                            {/* TWITTER FEED */}
                            {activePlatform === 'twitter' && (
                                <>
                                    {(lunarPosts.length > 0 ? lunarPosts : (socialMetrics?.recentPosts || [])).map((post: any) => {
                                        // Normalizing Data
                                        const id = post.id || post.post_id;
                                        const text = post.body || post.content || post.text;
                                        const date = post.posted ? new Date(post.posted * 1000).toLocaleString() : post.date;
                                        const interactions = post.interactions || (post.likes + (post.retweets || 0));
                                        const handle = post.creator_handle || post.author || 'User';
                                        const isBullish = (text?.length || 0) % 2 === 0;

                                        return (
                                            <div key={id} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all group overflow-hidden">
                                                <div className="p-4 flex gap-4">
                                                    {/* Avatar */}
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 shrink-0 border border-gray-200 flex items-center justify-center font-bold text-gray-500">
                                                        {handle[0]}
                                                    </div>

                                                    <div className="flex-1">
                                                        {/* Header */}
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-gray-900 text-sm">@{handle}</span>
                                                                    <span className="text-[10px] text-gray-400 font-mono">{date}</span>
                                                                </div>
                                                                {/* Tags */}
                                                                <div className="flex gap-2 mt-1">
                                                                    <span className={`text-[9px] font-bold px-1.5 rounded border ${isBullish ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                                        {isBullish ? 'BULL' : 'BEAR'}
                                                                    </span>
                                                                    {interactions > 500 && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded border border-amber-100">🔥 Hype</span>}
                                                                    {interactions > 10000 && <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 rounded border border-purple-100">💎 KOL</span>}
                                                                </div>
                                                            </div>

                                                            {/* Interactions Badge */}
                                                            <div className="px-2 py-1 bg-gray-50 rounded-lg border border-gray-100 text-[10px] font-bold text-gray-600">
                                                                {interactions.toLocaleString()} Eng.
                                                            </div>
                                                        </div>

                                                        {/* Content */}
                                                        <p className="text-gray-800 text-xs leading-relaxed whitespace-pre-wrap">{text}</p>

                                                        {/* Action Bar (Hidden by default, shown on hover) */}
                                                        <div className="flex items-center gap-2 mt-4 opacity-40 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={async () => {
                                                                    const reply = await generateSmartReply(text, handle, sentimentScore, brandName, { colors: [], referenceImages: [], tweetExamples: [], knowledgeBase: [] });
                                                                    alert(`AI SUGGESTED REPLY:\n\n${reply}\n\n(Copied to clipboard)`);
                                                                    navigator.clipboard.writeText(reply);
                                                                }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 text-[10px] font-bold uppercase tracking-wide transition-colors"
                                                            >
                                                                <span>🤖</span> Generate Reply
                                                            </button>
                                                            <button className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-[10px] font-bold text-gray-600 uppercase tracking-wide transition-colors">
                                                                Quote
                                                            </button>
                                                            <button className="ml-auto text-[10px] font-medium text-gray-400 hover:text-gray-600 underline">
                                                                Dismiss
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {(!lunarPosts.length && !socialMetrics?.recentPosts?.length) && (
                                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-200 rounded-xl">
                                            <div className="text-gray-300 text-4xl mb-2">📡</div>
                                            <p className="text-gray-400 text-xs font-medium">No active signals detected in this range.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
