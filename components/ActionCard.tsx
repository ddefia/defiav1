import React from 'react';
import { DashboardCampaign } from '../types';

interface ActionCardProps {
    campaign: DashboardCampaign;
    onReview: () => void;
    onExecute: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ campaign, onReview, onExecute }) => {
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all relative group overflow-hidden flex flex-col">
            {/* Header Section */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex items-start gap-3">

                {/* 1. THUMBNAIL (If Available) */}
                {campaign.mediaUrl ? (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden shrink-0 border border-gray-200 shadow-sm">
                        <img src={campaign.mediaUrl} alt="Campaign Media" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    // Fallback Icon
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200">
                        <span className="text-2xl">📄</span>
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <div>
                            {/* Action Title */}
                            <h3 className="text-xs font-bold text-gray-900 leading-tight truncate pr-2">
                                {campaign.recommendation.action} {campaign.name}
                            </h3>
                            {/* Subheader */}
                            <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                                <span>{campaign.channel}</span>
                                <span className="text-gray-300">•</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border
                                    ${campaign.type === 'Alpha' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        campaign.type === 'Newsjack' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                    {campaign.type}
                                </span>
                            </div>
                        </div>

                        {/* Priority Score */}
                        <div className="flex flex-col items-center justify-center w-8 h-8 bg-gray-900 rounded-lg text-white shadow-sm shrink-0">
                            <span className="text-xs font-bold leading-none">{campaign.priorityScore}</span>
                        </div>
                    </div>

                    {/* Impact Line */}
                    <div className="text-[10px] text-gray-400 font-mono truncate mt-1">
                        <span className="text-gray-300 mr-1">↪</span>
                        <span className="text-gray-600 font-medium">{campaign.expectedImpact}</span>
                    </div>
                </div>
            </div>

            {/* UNCOLLAPSED REASONING (The Core Change) */}
            <div className="p-4 bg-white flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Analysis & Recommendation</span>
                    <div className="h-px bg-gray-100 flex-1"></div>
                    <span className={`text-[9px] font-bold px-1.5 rounded ${campaign.recommendation.confidence === 'High' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {campaign.recommendation.confidence} Confidence
                    </span>
                </div>

                {/* The List - Always Visible */}
                <div className="bg-blue-50/30 rounded-lg p-3 border border-blue-50 mb-3 flex-1">
                    <ul className="space-y-2">
                        {campaign.recommendation.reasoning.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-[10px] text-gray-700 leading-relaxed font-medium">
                                <span className="mt-1.5 w-1 h-1 bg-blue-400 rounded-full shrink-0"></span>
                                {r}
                            </li>
                        ))}
                        {campaign.recommendation.reasoning.length === 0 && (
                            <li className="text-[10px] text-gray-400 italic">Processing signals...</li>
                        )}
                    </ul>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={onReview}
                        className="flex-1 py-1.5 px-3 bg-white border border-gray-200 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all uppercase tracking-wide"
                    >
                        Review
                    </button>

                    <button
                        onClick={onExecute}
                        className={`flex-[2] py-1.5 px-3 bg-black text-white text-[10px] font-bold rounded-lg hover:bg-gray-800 transition-all shadow-sm hover:shadow-md uppercase tracking-wide flex items-center justify-center gap-2`}
                    >
                        Approve & Execute
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
