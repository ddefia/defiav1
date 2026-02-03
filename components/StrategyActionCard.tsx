import React, { useState } from 'react';
import { StrategyTask } from '../types';

interface StrategyActionCardProps {
    task: StrategyTask;
    onConfigure: () => void;
    onFeedback?: (taskId: string, feedback: 'approved' | 'dismissed' | 'neutral') => void;
}

export const StrategyActionCard: React.FC<StrategyActionCardProps> = ({ task, onConfigure, onFeedback }) => {
    // Map Type to readable tag
    const getTagStyle = (type: string) => {
        const styles: Record<string, string> = {
            'REPLY': 'bg-blue-100 text-blue-800 border-blue-200',
            'REACTION': 'bg-pink-100 text-pink-800 border-pink-200',
            'EVERGREEN': 'bg-emerald-100 text-emerald-800 border-emerald-200',
            'GAP_FILL': 'bg-orange-100 text-orange-800 border-orange-200',
            'TREND_JACK': 'bg-purple-100 text-purple-800 border-purple-200',
            'CAMPAIGN_IDEA': 'bg-indigo-100 text-indigo-800 border-indigo-200'
        };
        return styles[type] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getImpactColor = (score: number) => {
        if (score >= 9) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        if (score >= 7) return 'text-blue-600 bg-blue-50 border-blue-100';
        return 'text-amber-600 bg-amber-50 border-amber-100';
    };

    const feedbackTone = task.feedback === 'approved' ? 'border-emerald-300 bg-emerald-50/40' : task.feedback === 'dismissed' ? 'border-rose-300 bg-rose-50/40 opacity-70' : '';

    return (
        <div className={`bg-white border border-gray-200/60 rounded-xl p-0 shadow-sm hover:shadow-premium hover:-translate-y-0.5 transition-all duration-300 relative group overflow-hidden mb-3 ${feedbackTone}`}>

            {/* Type Indicator Line */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${getTagStyle(task.type).split(' ')[0].replace('bg-', 'bg-')}`}></div>

            <div className="flex flex-col sm:flex-row h-full">

                {/* LEFT: Context & Content */}
                <div className="flex-1 p-5 pl-7 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getTagStyle(task.type)}`}>
                                    {task.type.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    Twitter
                                </span>
                                {task.feedback === 'approved' && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Approved</span>
                                )}
                                {task.feedback === 'dismissed' && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500">Dismissed</span>
                                )}
                            </div>

                            {/* Mobile Impact Score */}
                            <span className={`sm:hidden text-[9px] font-bold ${getImpactColor(task.impactScore)} px-1.5 py-0.5 rounded`}>
                                Impact: {task.impactScore}
                            </span>
                        </div>

                        <h3
                            className="text-base font-display font-bold text-gray-900 leading-tight mb-2 pr-4 group-hover:text-blue-600 transition-colors cursor-pointer"
                            onClick={onConfigure}
                        >
                            {task.title}
                        </h3>

                        <div className="relative pl-3 border-l-2 border-brand-border mt-3">
                            <p className="text-xs text-brand-textSecondary leading-relaxed line-clamp-2">
                                {task.reasoning}
                            </p>
                        </div>
                    </div>

                    {/* Proof Footnote (Bottom align) */}
                    {task.proof && (
                        <div className="mt-4 flex items-center gap-1.5 text-[9px] text-brand-muted uppercase tracking-wide font-medium opacity-60">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Signal: {task.proof}
                        </div>
                    )}
                </div>

                {/* RIGHT: Actions & Stats */}
                <div className="w-full sm:w-[160px] bg-gray-50/80 border-l border-gray-100 p-4 flex flex-col justify-center gap-3">

                    {/* Impact Stats */}
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1">
                        <div className="text-right">
                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Impact</div>
                            <div className={`text-lg font-display font-bold leading-none ${task.impactScore > 8 ? 'text-emerald-500' : 'text-gray-700'}`}>
                                {task.impactScore}<span className="text-xs text-gray-400 font-sans ml-0.5">/10</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-px bg-gray-200 hidden sm:block opacity-50"></div>

                    {/* Execute Button */}
                    <button
                        onClick={onConfigure}
                        className="w-full h-9 bg-black text-white hover:bg-gray-800 text-[10px] font-bold uppercase tracking-widest rounded shadow-sm hover:shadow-lg transition-all flex items-center justify-center gap-2 group/btn"
                    >
                        Execute
                        <svg className="w-3 h-3 text-gray-400 group-hover/btn:text-emerald-400 transition-colors transform group-hover/btn:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </button>

                    {onFeedback && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFeedback(task.id, task.feedback === 'approved' ? 'neutral' : 'approved');
                                }}
                                className={`flex-1 h-8 rounded text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                                    task.feedback === 'approved'
                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                                        : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50'
                                }`}
                                title="Approve recommendation"
                            >
                                Approve
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onFeedback(task.id, task.feedback === 'dismissed' ? 'neutral' : 'dismissed');
                                }}
                                className={`flex-1 h-8 rounded text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                                    task.feedback === 'dismissed'
                                        ? 'bg-rose-500/10 text-rose-600 border-rose-200'
                                        : 'bg-white text-rose-500 border-rose-100 hover:bg-rose-50'
                                }`}
                                title="Dismiss recommendation"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
