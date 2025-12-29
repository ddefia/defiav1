import React from 'react';
import { LunarCrushPost, SocialMetrics } from '../types';

interface SocialActivityFeedProps {
    lunarPosts: LunarCrushPost[];
    socialMetrics: SocialMetrics | null;
}

export const SocialActivityFeed: React.FC<SocialActivityFeedProps> = ({ lunarPosts, socialMetrics }) => {
    const [activeTab, setActiveTab] = React.useState<'twitter' | 'telegram' | 'discord'>('twitter');

    const renderContent = () => {
        if (activeTab === 'twitter') {
            return (
                <>
                    {(lunarPosts.length > 0 ? lunarPosts.slice(0, 5).map(post => ({
                        id: post.id,
                        text: post.body || "Media Content",
                        date: new Date(post.posted * 1000).toLocaleDateString(),
                        interactions: post.interactions,
                        link: post.post_link
                    })) : (socialMetrics?.recentPosts || []).slice(0, 5).map(post => ({
                        id: post.id,
                        text: post.content,
                        date: post.date,
                        interactions: post.likes + post.retweets + post.comments,
                        link: `https://twitter.com/i/web/status/${post.id}`
                    }))).map((post) => (
                        <div key={post.id} className="bg-gray-50 p-4 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors group">
                            <p className="text-xs text-brand-text leading-relaxed mb-3 line-clamp-4">
                                {post.text}
                            </p>
                            <div className="flex justify-between items-center text-[10px] text-brand-muted">
                                <span>{post.date}</span>
                                <div className="flex gap-2 items-center">
                                    <span className="font-bold text-gray-500 flex items-center gap-0.5">
                                        ♥ {post.interactions}
                                    </span>
                                    {post.link && (
                                        <a
                                            href={post.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ↗
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {(!lunarPosts.length && (!socialMetrics?.recentPosts || socialMetrics.recentPosts.length === 0)) && (
                        <div className="text-center py-10 text-brand-muted text-xs">
                            No recent tweets found.
                        </div>
                    )}
                </>
            );
        }

        if (activeTab === 'telegram') {
            return (
                <div className="text-center py-10 text-brand-muted text-xs bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p>Connecting to Telegram Channel...</p>
                    <p className="mt-2 opacity-50">No recent announcements.</p>
                </div>
            )
        }

        if (activeTab === 'discord') {
            return (
                <div className="text-center py-10 text-brand-muted text-xs bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p>Listening to Discord Server...</p>
                    <p className="mt-2 opacity-50">No active discussions tracked.</p>
                </div>
            )
        }
    };

    return (
        <div className="bg-white rounded-xl border border-brand-border shadow-sm p-6 h-full overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeTab === 'twitter' ? 'bg-black' : activeTab === 'telegram' ? 'bg-blue-400' : 'bg-indigo-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${activeTab === 'twitter' ? 'bg-black' : activeTab === 'telegram' ? 'bg-blue-500' : 'bg-indigo-500'}`}></span>
                    </span>
                    Live Feed
                </h3>
            </div>

            {/* Platform Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
                <button
                    onClick={() => setActiveTab('twitter')}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'twitter' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    X.com
                </button>
                <button
                    onClick={() => setActiveTab('telegram')}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'telegram' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Telegram
                </button>
                <button
                    onClick={() => setActiveTab('discord')}
                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'discord' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Discord
                </button>
            </div>

            <div className="overflow-y-auto pr-2 space-y-4 flex-1 custom-scrollbar" style={{ maxHeight: '600px' }}>
                {renderContent()}
            </div>
        </div>
    );
};
