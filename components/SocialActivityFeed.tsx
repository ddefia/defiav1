import React from 'react';
import { LunarCrushPost, SocialMetrics } from '../types';

interface SocialActivityFeedProps {
    lunarPosts: LunarCrushPost[];
    socialMetrics: SocialMetrics | null;
}

export const SocialActivityFeed: React.FC<SocialActivityFeedProps> = ({ lunarPosts, socialMetrics }) => {
    return (
        <div className="bg-white rounded-xl border border-brand-border shadow-sm p-6 h-full overflow-hidden flex flex-col">
            <h3 className="text-lg font-bold text-brand-text mb-4 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                Live Social Feed
            </h3>
            <div className="overflow-y-auto pr-2 space-y-4 flex-1 custom-scrollbar" style={{ maxHeight: '600px' }}>
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
            </div>
        </div>
    );
};
