import React, { useState } from 'react';
import { StrategyTask } from '../types';

interface StrategyActionCardProps {
    task: StrategyTask;
    onConfigure: () => void;
}

export const StrategyActionCard: React.FC<StrategyActionCardProps> = ({ task, onConfigure }) => {
    const [isRationaleOpen, setIsRationaleOpen] = useState(false);

    // Map Type to readable tag
    const getTagStyle = (type: string) => {
        const styles: Record<string, string> = {
            'REPLY': 'bg-blue-50 text-blue-700 border-blue-100',
            'REACTION': 'bg-pink-50 text-pink-700 border-pink-100',
            'EVERGREEN': 'bg-emerald-50 text-emerald-700 border-emerald-100',
            'GAP_FILL': 'bg-orange-50 text-orange-700 border-orange-100',
            'TREND_JACK': 'bg-purple-50 text-purple-700 border-purple-100',
            'CAMPAIGN_IDEA': 'bg-indigo-50 text-indigo-700 border-indigo-100'
        };
        return styles[type] || 'bg-gray-50 text-gray-700 border-gray-100';
    };

    // Infer Expected Impact based on type/score (Simulation for UI)
    const getExpectedImpact = (task: StrategyTask) => {
        if (task.impactScore > 8) return "↑ retention, ↑ wallet quality";
        if (task.type === 'TREND_JACK') return "↑ visibility, ↑ engagement";
        return "Brand consistency";
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all relative group overflow-hidden mb-3">
            {/* Header Section */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex items-start gap-3">

                {/* 1. THUMBNAIL (Simulation if task has image context) */}
                <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden shrink-0 border border-gray-200 shadow-sm relative">
                    {/* Placeholder for now as StrategyTask doesn't have image URL yet */}
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-2xl opacity-50">📰</div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            <h3 className="text-xs font-bold text-gray-900 leading-tight">
                                {task.title}
                            </h3>
                            <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5 mt-1">
                                <span>Twitter</span>
                                <span className="text-gray-300">•</span>
                                <span>{task.type.replace('_', ' ')}</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center w-8 h-8 bg-gray-900 rounded-lg text-white shadow-sm shrink-0">
                            <span className="text-xs font-bold leading-none">{task.impactScore}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getTagStyle(task.type)}`}>
                            {task.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">
                            <span className="text-xs text-gray-300 mr-1">↪</span>
                            <span className="text-gray-600 font-medium">{getExpectedImpact(task)}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-4 flex flex-col pt-3">
                {/* Uncollapsed Analysis */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Reasoning Engine</span>
                    <span className={`text-[9px] font-bold px-1.5 rounded ${task.impactScore > 7 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                        {task.impactScore > 7 ? 'High' : 'Medium'} Confidence
                    </span>
                </div>

                <div className="bg-blue-50/30 rounded-lg p-3 border border-blue-50 mb-3">
                    <p className="text-[10px] text-gray-700 leading-relaxed font-medium flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 bg-blue-400 rounded-full shrink-0"></span>
                        {task.reasoning}
                    </p>
                    {task.contextData && task.contextData.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-blue-100/50">
                            <ul className="space-y-1">
                                {task.contextData.map((c, i) => (
                                    <li key={i} className="text-[9px] text-gray-500 truncate flex items-center gap-1">
                                        <span className="w-0.5 h-2 bg-gray-300 rounded-full"></span>
                                        {c.headline}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={onConfigure}
                        className="flex-1 py-1.5 px-3 bg-white border border-gray-200 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all uppercase tracking-wide"
                    >
                        Review
                    </button>

                    <div className="relative group/exec flex-[1.5]">
                        <button
                            onClick={onConfigure}
                            className={`w-full py-1.5 px-3 bg-black text-white text-[10px] font-bold rounded-lg hover:bg-gray-800 transition-all shadow-sm hover:shadow-md uppercase tracking-wide flex items-center justify-center gap-2`}
                        >
                            Approve & Execute
                            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
