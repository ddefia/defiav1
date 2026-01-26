import React, { useState } from 'react';
import { TrendItem, StrategyTask } from '../types';
import { Button } from './Button';

interface TrendFeedProps {
    trends: TrendItem[];
    onReact: (trend: TrendItem, type: 'Tweet' | 'Meme') => void;
    isLoading: boolean;
}

export const TrendFeed: React.FC<TrendFeedProps> = ({ trends, onReact, isLoading }) => {
    const [filter, setFilter] = useState<'All' | 'News' | 'Social'>('All');

    const filteredTrends = trends.filter(t => {
        if (filter === 'All') return true;
        if (filter === 'News') return t.source === 'LunarCrush';
        if (filter === 'Social') return t.source === 'Twitter';
        return true;
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-40 bg-brand-surfaceHighlight animate-pulse rounded-xl border border-brand-border" />
                ))}
            </div>
        );
    }

    if (trends.length === 0) {
        return (
            <div className="p-8 text-center bg-gray-50 border border-brand-border rounded-xl">
                <p className="text-sm font-bold text-brand-text">No Signal Detected</p>
                <p className="text-xs text-brand-textSecondary">Scanning the wire... check back in a few seconds or add API keys.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-2">
                {(['All', 'News', 'Social'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border transition-colors ${filter === f ? 'bg-brand-text text-white border-brand-text shadow-sm' : 'bg-white text-brand-muted border-gray-200 hover:border-gray-300'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredTrends.map((trend) => {
                    // Cleaner Source Handling
                    const isNews = trend.source === 'LunarCrush';
                    const icon = isNews ? '📰' : '🐦';
                    const sourceLabel = isNews ? 'Market Wire' : 'Social';

                    // Visual "Hotness" Indicator based on relevance
                    const isHot = trend.relevanceScore > 90;

                    return (
                        <div key={trend.id} className="bg-white border border-brand-border rounded-xl p-0 shadow-sm hover:shadow-premium hover:-translate-y-0.5 transition-all duration-300 group flex flex-col justify-between h-full overflow-hidden relative">
                            {isHot && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-brand-accent/10 to-transparent rounded-bl-3xl -mr-4 -mt-4 opacity-50"></div>}

                            <div className="p-5 pb-0">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-1.5 opacity-60">
                                        <span className="text-xs">{icon}</span>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-textSecondary">{sourceLabel}</span>
                                        {trend.topic && (
                                            <>
                                                <span className="text-gray-300">•</span>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">{trend.topic}</span>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-mono text-brand-muted bg-gray-50 px-1.5 py-0.5 rounded">
                                        {typeof trend.timestamp === 'number' ? new Date(trend.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}
                                    </span>
                                </div>

                                <h4 className="font-display font-bold text-lg text-brand-text mb-2 leading-tight group-hover:text-brand-accent transition-colors line-clamp-2">
                                    {trend.headline}
                                </h4>

                                <div className={`text-xs text-brand-textSecondary leading-relaxed mb-4 border-l-2 pl-3 ${isNews ? 'border-brand-accent/30' : 'border-blue-200'}`}>
                                    {trend.summary}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-4 bg-gray-50/50 border-t border-brand-border/50 flex gap-2 mt-auto">
                                <Button
                                    onClick={() => onReact(trend, 'Tweet')}
                                    className="flex-1 h-9 text-[11px] font-bold bg-white border border-brand-border text-brand-text hover:bg-brand-text hover:text-white hover:border-brand-text shadow-sm transition-all"
                                >
                                    ⚡ Jack this Trend
                                </Button>
                                <Button
                                    onClick={() => onReact(trend, 'Meme')}
                                    variant="secondary"
                                    className="h-9 w-9 p-0 flex items-center justify-center bg-white border border-brand-border text-brand-muted hover:text-brand-accent hover:border-brand-accent/30 shadow-sm"
                                    title="Generate Meme Concept"
                                >
                                    <span className="text-sm">🎭</span>
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
