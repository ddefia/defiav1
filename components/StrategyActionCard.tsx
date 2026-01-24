import React, { useState } from 'react';
import { StrategyTask } from '../types';

interface StrategyActionCardProps {
    task: StrategyTask;
    onConfigure: () => void;
}

export const StrategyActionCard: React.FC<StrategyActionCardProps> = ({ task, onConfigure }) => {
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

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 relative group overflow-hidden mb-2">

            {/* CARD BODY - GRID LAYOUT */}
            <div className="flex flex-col sm:flex-row">

                {/* LEFT: Main Context (Weighted 2/3) */}
                <div className="flex-1 p-3 border-b sm:border-b-0 sm:border-r border-gray-100">
                    {/* Header Line */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider border ${getTagStyle(task.type)}`}>
                            {task.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">Twitter</span>
                        <div className="flex-1"></div>
                        {/* Mobile Score (Hidden on Desktop usually, but good for responsive) */}
                        <span className={`sm:hidden text-[9px] font-bold px-1.5 py-0.5 rounded border ${getImpactColor(task.impactScore)}`}>
                            Impact: {task.impactScore}/10
                        </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors cursor-pointer" onClick={onConfigure}>
                        {task.title}
                    </h3>

                    {/* Reasoning - Compact */}
                    <div className="relative pl-3 border-l-2 border-blue-100">
                        <p className="text-[11px] text-gray-600 leading-relaxed font-medium line-clamp-2">
                            {task.reasoning}
                        </p>
                    </div>
                </div>

                {/* RIGHT: Metrics & Actions (Weighted 1/3) */}
                <div className="w-full sm:w-[180px] bg-gray-50/50 p-3 flex flex-col justify-between gap-3">

                    {/* Metrics Block */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Confidence</span>
                            <span className={`text-[9px] font-bold ${task.impactScore > 7 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {task.impactScore > 7 ? 'High' : 'Med'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">Impact</span>
                            <div className={`flex items-center px-1.5 py-0.5 rounded border ${getImpactColor(task.impactScore)}`}>
                                <span className="text-xs font-bold">{task.impactScore}</span>
                                <span className="text-[9px] opacity-70">/10</span>
                            </div>
                        </div>
                    </div>

                    {/* Primary Action Button */}
                    <button
                        onClick={onConfigure}
                        className="w-full group/btn relative overflow-hidden rounded flex items-center justify-center gap-2 bg-white hover:bg-black hover:text-white border border-gray-200 hover:border-black text-gray-700 text-[10px] font-bold uppercase tracking-wide py-2 transition-all shadow-sm"
                    >
                        <span>Execute</span>
                        <svg className="w-3 h-3 text-gray-400 group-hover/btn:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>

                </div>
            </div>
        </div>
    );
};
