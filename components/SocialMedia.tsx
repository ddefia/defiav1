import React, { useState } from 'react';
import { LunarCrushPost, SocialMetrics, SocialSignals } from '../types';
import { generateSmartReply } from '../services/gemini';

interface SocialMediaProps {
    brandName: string;
    lunarPosts: LunarCrushPost[];
    socialMetrics: SocialMetrics | null;
    signals: SocialSignals;
}

export const SocialMedia: React.FC<SocialMediaProps> = ({ brandName, lunarPosts, socialMetrics, signals }) => {
    const [activePlatform, setActivePlatform] = useState<'twitter' | 'telegram' | 'discord'>('twitter');
    const [activeFilter, setActiveFilter] = useState<'all' | 'kol' | 'fud' | 'alpha'>('all');

    // Use shared state from App/Brain
    const { sentimentScore, activeNarratives } = signals;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn h-full flex flex-col">

            {/* 1. WAR ROOM HEADER */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* A. Brand Sentiment (Moodometer) */}
                <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-premium relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2 relative z-10">
                        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Community Sentiment</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sentimentScore > 60 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            {sentimentScore > 60 ? 'BULLISH' : 'BEARISH'}
                        </span>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                        <span className="text-4xl font-display font-bold text-brand-text">{sentimentScore}/100</span>
                        <span className="text-xs text-brand-textSecondary mb-1.5 font-medium">Greed Index</span>
                    </div>
                    {/* Visual Gauge Bar */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-4 overflow-hidden relative z-10">
                        <div className={`h-full rounded-full transition-all duration-1000 ${sentimentScore > 60 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`} style={{ width: `${sentimentScore}%` }}></div>
                    </div>
                    <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${sentimentScore > 60 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                </div>

                {/* B. Active Narratives */}
                <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-premium">
                    <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3">Detected Narratives</h3>
                    <div className="flex flex-wrap gap-2">
                        {activeNarratives.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold hover:bg-indigo-100 cursor-pointer transition-colors">
                                {tag}
                            </span>
                        ))}
                        <span className="px-3 py-1 bg-gray-50 text-gray-500 border border-gray-100 border-dashed rounded-lg text-xs font-medium hover:bg-gray-100 cursor-pointer transition-colors">
                            + Add Topic
                        </span>
                    </div>
                </div>

                {/* C. Quick Stats */}
                <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 shadow-premium flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Volume Spike</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-display font-bold text-brand-text">+128%</span>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Trending</span>
                    </div>
                    <p className="text-[10px] text-brand-textSecondary">Mentions are up significantly in the last hour vs 7d avg.</p>
                </div>
            </div>

            {/* 2. MAIN CONSOLE */}
            <div className="flex-1 bg-white rounded-2xl border border-brand-border shadow-sm flex overflow-hidden">

                {/* LEFT RAIL: FILTERS */}
                <div className="w-64 border-r border-brand-border bg-gray-50/50 p-4 flex flex-col gap-6">

                    {/* Platform Selector */}
                    <div>
                        <label className="text-[10px] font-bold text-brand-muted uppercase mb-2 block">Source</label>
                        <div className="space-y-1">
                            {[
                                { id: 'twitter', label: 'X / Twitter', icon: '🐦', color: 'text-black' },
                                { id: 'telegram', label: 'Telegram', icon: '✈️', color: 'text-blue-500' },
                                { id: 'discord', label: 'Discord', icon: '💬', color: 'text-indigo-500' }
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setActivePlatform(p.id as any)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activePlatform === p.id ? 'bg-white shadow-sm ring-1 ring-gray-200 text-brand-text' : 'text-brand-textSecondary hover:bg-gray-100'}`}
                                >
                                    <span className={p.color}>{p.icon}</span>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Smart Web3 Filters */}
                    <div>
                        <label className="text-[10px] font-bold text-brand-muted uppercase mb-2 block">Smart Loop</label>
                        <div className="space-y-1">
                            <button onClick={() => setActiveFilter('all')} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium ${activeFilter === 'all' ? 'bg-brand-accent/10 text-brand-accent font-bold' : 'text-brand-textSecondary hover:bg-gray-100'}`}>
                                ⚡ All Mentions
                            </button>
                            <button onClick={() => setActiveFilter('kol')} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium ${activeFilter === 'kol' ? 'bg-purple-50 text-purple-600 font-bold' : 'text-brand-textSecondary hover:bg-gray-100'}`}>
                                💎 KOL Watchlist
                            </button>
                            <button onClick={() => setActiveFilter('fud')} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium ${activeFilter === 'fud' ? 'bg-red-50 text-red-600 font-bold' : 'text-brand-textSecondary hover:bg-gray-100'}`}>
                                🛡️ FUD Alert
                            </button>
                            <button onClick={() => setActiveFilter('alpha')} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium ${activeFilter === 'alpha' ? 'bg-amber-50 text-amber-600 font-bold' : 'text-brand-textSecondary hover:bg-gray-100'}`}>
                                🚀 Alpha / Hype
                            </button>
                        </div>
                    </div>
                </div>

                {/* CENTER: FEED */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white relative">
                    {/* Floating Toolbar */}
                    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-brand-border px-6 py-3 flex justify-between items-center">
                        <h2 className="text-sm font-bold text-brand-text flex items-center gap-2">
                            {activeFilter === 'all' && 'Live Feed'}
                            {activeFilter === 'kol' && '💎 Influencer Activity'}
                            {activeFilter === 'fud' && '🛡️ FUD Detection'}
                            {activeFilter === 'alpha' && '🚀 High Engagement'}
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 font-normal">Real-time</span>
                        </h2>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Search mentions..." className="bg-gray-50 border border-brand-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-accent w-48" />
                        </div>
                    </div>

                    <div className="p-0">
                        {/* EMPTY STATES FOR MOCK PLATFORMS first */}
                        {activePlatform === 'telegram' && (
                            <div className="flex flex-col items-center justify-center pt-24 text-center">
                                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4 text-2xl">✈️</div>
                                <h3 className="font-bold text-gray-900">Telegram Command Center</h3>
                                <p className="text-sm text-gray-500 mt-2 max-w-sm">Connect your automated raid bot to manage community raids directly from here.</p>
                                <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-700">Connect Bot</button>
                            </div>
                        )}

                        {activePlatform === 'discord' && (
                            <div className="flex flex-col items-center justify-center pt-24 text-center">
                                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4 text-2xl">💬</div>
                                <h3 className="font-bold text-gray-900">Discord Sentinel</h3>
                                <p className="text-sm text-gray-500 mt-2 max-w-sm">Track server growth, support tickets, and FUD alerts.</p>
                                <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700">Install Sentinel</button>
                            </div>
                        )}

                        {/* TWITTER FEED */}
                        {activePlatform === 'twitter' && (
                            <div className="divide-y divide-gray-100">
                                {(lunarPosts.length > 0 ? lunarPosts : (socialMetrics?.recentPosts || [])).map((post: any) => {
                                    // Normalizing Data
                                    const id = post.id || post.post_id;
                                    const text = post.body || post.content || post.text;
                                    const date = post.posted ? new Date(post.posted * 1000).toLocaleString() : post.date;
                                    const interactions = post.interactions || (post.likes + (post.retweets || 0));
                                    const handle = post.creator_handle || post.author || 'User';

                                    // Mock Sentiment for UI demo if missing
                                    const isBullish = (text?.length || 0) % 2 === 0;

                                    return (
                                        <div key={id} className="p-6 hover:bg-blue-50/30 transition-colors group relative">
                                            <div className="flex gap-4">
                                                {/* Avatar + Score */}
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 flex items-center justify-center text-gray-600 font-bold border border-gray-200">
                                                        {handle[0]}
                                                    </div>
                                                    <div className={`text-[10px] font-bold px-1.5 rounded border ${isBullish ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                                        {isBullish ? 'BULL' : 'BEAR'}
                                                    </div>
                                                </div>

                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <span className="font-bold text-brand-text text-sm hover:underline cursor-pointer">@{handle}</span>
                                                            <span className="text-brand-textSecondary text-xs ml-2">{date}</span>
                                                        </div>

                                                        {/* Context Tags */}
                                                        <div className="flex gap-2">
                                                            {interactions > 500 && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">🔥 Hype</span>}
                                                            {interactions > 10000 && <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">💎 KOL</span>}
                                                        </div>
                                                    </div>

                                                    <p className="text-brand-text text-sm mt-2 leading-relaxed whitespace-pre-wrap">{text}</p>

                                                    {/* Action Bar */}
                                                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={async () => {
                                                                const reply = await generateSmartReply(text, handle, sentimentScore, brandName, { colors: [], referenceImages: [], tweetExamples: [], knowledgeBase: [] }); // TODO: Pass full config
                                                                alert(`AI SUGGESTED REPLY:\n\n${reply}\n\n(Copied to clipboard)`);
                                                                navigator.clipboard.writeText(reply);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-brand-accent hover:text-white text-xs font-bold text-gray-600 transition-colors"
                                                        >
                                                            <span>🤖</span> AI Reply
                                                        </button>
                                                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 transition-colors">
                                                            <span>🔄</span> Quote
                                                        </button>
                                                        <button className="ml-auto text-xs font-medium text-gray-400 hover:text-brand-text">
                                                            Ignore
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {(!lunarPosts.length && !socialMetrics?.recentPosts?.length) && (
                                    <div className="p-20 text-center text-brand-muted">
                                        <p>No recent tweets found for {brandName}.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
