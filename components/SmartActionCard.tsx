import React from 'react';
import { DashboardCampaign } from '../types';

interface ActionCardProps {
    campaign: DashboardCampaign;
    onReview: () => void;
    onExecute: () => void;
}

export const SmartActionCard: React.FC<ActionCardProps> = ({ campaign, onReview, onExecute }) => {
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all relative group overflow-hidden flex flex-col">
            {/* Header Section */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex items-start gap-4">

                {/* 1. THUMBNAIL (If Available) */}
                {campaign.mediaUrl ? (
                    <div className="w-20 h-20 rounded-lg bg-gray-200 overflow-hidden shrink-0 border border-gray-200 shadow-sm relative">
                        <img src={campaign.mediaUrl} alt="Campaign Media" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-lg"></div>
                    </div>
                ) : (
                    // Fallback Icon
                    <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200 shadow-sm">
                        <span className="text-3xl opacity-50">📰</span>
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            {/* Action Title */}
                            <h3 className="text-sm font-bold text-gray-900 leading-tight truncate pr-2">
                                {campaign.recommendation.action}: {campaign.name}
                            </h3>
                            {/* Subheader */}
                            <div className="text-[11px] text-gray-500 font-medium flex items-center gap-2 mt-1">
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                    {campaign.channel}
                                </span>
                                <span className="text-gray-300">|</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                                    ${campaign.type === 'Alpha' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        campaign.type === 'Newsjack' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                    {campaign.type}
                                </span>
                            </div>
                        </div>

                        {/* Priority Score */}
                        <div className="flex flex-col items-center justify-center w-10 h-10 bg-gray-900 rounded-lg text-white shadow-lg shadow-gray-200 shrink-0">
                            <span className="text-sm font-bold leading-none">{campaign.priorityScore}</span>
                            <span className="text-[8px] opacity-60">/10</span>
                        </div>
                    </div>

                    {/* Impact Line */}
                    <div className="text-[11px] text-gray-500 font-mono mt-2 flex items-center gap-1.5 bg-gray-50/80 px-2 py-1 rounded border border-gray-100 w-fit">
                        <span className="text-gray-400">⚡ Impact:</span>
                        <span className="text-gray-700 font-bold">{campaign.expectedImpact}</span>
                    </div>
                </div>
            </div>

            {/* UNCOLLAPSED REASONING (Right Side in Flex or Bottom) 
                User complained about width/whitespace. Let's make this dense.
            */}
            <div className="p-4 bg-white flex-1 flex flex-col pt-3">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-3bg-blue-500 rounded-full"></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reasoning Engine</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${campaign.recommendation.confidence === 'High' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {campaign.recommendation.confidence} Confidence
                    </span>
                </div>

                {/* The List - Always Visible & Dense */}
                <div className="mb-4 pl-1">
                    <ul className="space-y-2">
                        {campaign.recommendation.reasoning.map((r, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-[11px] text-gray-600 leading-relaxed font-medium">
                                <span className="mt-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full shrink-0 shadow-sm shadow-blue-200"></span>
                                <span>{r}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Actions Row */}
                <div className="flex gap-3 mt-auto pt-3 border-t border-gray-50">
                    <button
                        onClick={onReview}
                        className="flex-1 py-2 px-4 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all uppercase tracking-wide"
                    >
                        Review Actions
                    </button>

                    <button
                        onClick={onExecute}
                        className={`flex-[1.5] py-2 px-4 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg uppercase tracking-wide flex items-center justify-center gap-2 group-hover:translate-y-[-1px] duration-200`}
                    >
                        Approve & Execute
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
