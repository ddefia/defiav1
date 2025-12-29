import React, { useState } from 'react';
import { LunarCrushPost, SocialMetrics } from '../types';

interface SocialMediaProps {
    brandName: string;
    lunarPosts: LunarCrushPost[];
    socialMetrics: SocialMetrics | null;
}

export const SocialMedia: React.FC<SocialMediaProps> = ({ brandName, lunarPosts, socialMetrics }) => {
    const [activePlatform, setActivePlatform] = useState<'twitter' | 'telegram' | 'discord'>('twitter');

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-display font-bold text-brand-text tracking-tight">Community & Mentions</h1>
                <p className="text-brand-textSecondary mt-2">Track real-time conversations across your social channels.</p>
            </div>

            {/* Platform Tabs */}
            <div className="flex items-center gap-4 border-b border-brand-border pb-1">
                <button
                    onClick={() => setActivePlatform('twitter')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activePlatform === 'twitter' ? 'text-black' : 'text-brand-muted hover:text-brand-text'}`}
                >
                    X / Twitter
                    {activePlatform === 'twitter' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-black rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActivePlatform('telegram')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activePlatform === 'telegram' ? 'text-blue-500' : 'text-brand-muted hover:text-brand-text'}`}
                >
                    Telegram
                    {activePlatform === 'telegram' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActivePlatform('discord')}
                    className={`pb-3 px-2 text-sm font-bold transition-all relative ${activePlatform === 'discord' ? 'text-indigo-500' : 'text-brand-muted hover:text-brand-text'}`}
                >
                    Discord
                    {activePlatform === 'discord' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full"></div>}
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl border border-brand-border shadow-sm min-h-[600px] flex flex-col">

                {/* TOOLBAR */}
                <div className="p-4 border-b border-brand-border flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-bold text-brand-text uppercase tracking-wide">Live Stream: {activePlatform}</span>
                    </div>
                    <div className="flex gap-2">
                        <button className="text-xs font-bold text-brand-textSecondary hover:text-brand-text px-3 py-1.5 bg-white border border-brand-border rounded-lg shadow-sm">Config</button>
                        <button className="text-xs font-bold text-brand-textSecondary hover:text-brand-text px-3 py-1.5 bg-white border border-brand-border rounded-lg shadow-sm">Export</button>
                    </div>
                </div>

                {/* FEED */}
                <div className="flex-1 p-0 overflow-y-auto custom-scrollbar">
                    {/* TWITTER VIEW */}
                    {activePlatform === 'twitter' && (
                        <div className="divide-y divide-gray-100">
                            {(lunarPosts.length > 0 ? lunarPosts : (socialMetrics?.recentPosts || [])).map((post: any) => {
                                // Normalizing Data
                                const id = post.id || post.post_id;
                                const text = post.body || post.content || post.text;
                                const date = post.posted ? new Date(post.posted * 1000).toLocaleString() : post.date;
                                const interactions = post.interactions || (post.likes + (post.retweets || 0));
                                const handle = post.creator_handle || post.author || 'User';

                                return (
                                    <div key={id} className="p-6 hover:bg-gray-50 transition-colors group">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-500 font-bold">
                                                {handle[0]}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-bold text-brand-text text-sm">{handle}</span>
                                                        <span className="text-brand-textSecondary text-xs ml-2">{date}</span>
                                                    </div>
                                                    <a href={post.post_link || `https://twitter.com/i/web/status/${id}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    </a>
                                                </div>
                                                <p className="text-brand-text text-sm mt-2 leading-relaxed whitespace-pre-wrap">{text}</p>

                                                <div className="flex gap-6 mt-3 text-xs text-brand-muted">
                                                    <span className="flex items-center gap-1">♥ {interactions}</span>
                                                    <span className="flex items-center gap-1">Sent: {post.sentiment || 'Neutral'}</span>
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

                    {/* TELEGRAM VIEW */}
                    {activePlatform === 'telegram' && (
                        <div className="flex flex-col items-center justify-center h-[400px] text-center p-10">
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-brand-text">Telegram Tracking</h3>
                            <p className="text-sm text-brand-textSecondary max-w-sm mt-2">Connect your Telegram Community Bot to start streaming messages and sentiment analysis.</p>
                            <button className="mt-6 px-4 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-600 transition-colors">Connect Telegram</button>
                        </div>
                    )}

                    {/* DISCORD VIEW */}
                    {activePlatform === 'discord' && (
                        <div className="flex flex-col items-center justify-center h-[400px] text-center p-10">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-brand-text">Discord Server</h3>
                            <p className="text-sm text-brand-textSecondary max-w-sm mt-2">Install the Defia Sentinel Bot in your server to track community engagement and questions.</p>
                            <button className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">Connect Discord</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
