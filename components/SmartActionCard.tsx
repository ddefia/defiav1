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
            <div className="p-3 border-b border-gray-100 bg-gray-50/20 flex items-start gap-4">

                {/* 1. THUMBNAIL (If Available) */}
                {campaign.mediaUrl ? (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden shrink-0 border border-gray-200 shadow-sm relative">
                        <img src={campaign.mediaUrl} alt="Campaign Media" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-lg"></div>
                    </div>
                ) : (
                    // Fallback Icon
                    <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-200 shadow-sm">
                        <span className="text-2xl opacity-40 grayscale">📊</span>
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
                            <div className="text-[10px] text-gray-500 font-medium flex items-center gap-2 mt-1">
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                    {campaign.channel}
                                </span>
                                <span className="text-gray-300">|</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border
                                    ${campaign.type === 'Alpha' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        campaign.type === 'Newsjack' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                    {campaign.type}
                                </span>
                            </div>
                        </div>

                        {/* Priority Score */}
                        <div className="flex flex-col items-center justify-center w-8 h-8 bg-black rounded text-white shadow-lg shadow-gray-200 shrink-0">
                            <span className="text-xs font-bold leading-none">{campaign.priorityScore}</span>
                        </div>
                    </div>

                    {/* Impact Line */}
                    <div className="flex items-center gap-3 mt-2">
                        <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1.5 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit">
                            <span className="text-gray-400">⚡ Impact:</span>
                            <span className="text-gray-700 font-bold">{campaign.expectedImpact}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${campaign.recommendation.confidence === 'High' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {campaign.recommendation.confidence} Conf
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Body - DENSE */}
            <div className="p-3 bg-white flex-1 flex flex-col gap-3">

                {/* 1. PRIMARY REASONING */}
                <div>
                    <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                        Reasoning Engine
                    </h4>
                    <ul className="space-y-1">
                        {campaign.recommendation.reasoning.slice(0, 2).map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-[10px] text-gray-700 leading-snug font-medium">
                                <span className="mt-1 w-1 h-1 bg-gray-300 rounded-full shrink-0"></span>
                                <span>{r}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* 2. STRATEGIC CONTEXT (New) */}
                {campaign.aiSummary && campaign.aiSummary.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                        <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                            Strategic Context
                        </h4>
                        <p className="text-[10px] text-gray-600 leading-snug">
                            {campaign.aiSummary[0]}
                        </p>
                    </div>
                )}

                {/* 3. RISK FACTORS (New) */}
                {campaign.recommendation.riskFactors && campaign.recommendation.riskFactors.length > 0 && (
                    <div className="bg-rose-50 rounded-lg p-2 border border-rose-100">
                        <h4 className="text-[9px] font-bold text-rose-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <span className="text-[8px]">⚠️</span> Risk Assessment
                        </h4>
                        <ul className="space-y-1">
                            {campaign.recommendation.riskFactors.map((r, i) => (
                                <li key={i} className="text-[10px] text-rose-800 leading-snug flex items-start gap-1">
                                    <span className="mt-1 w-1 h-1 bg-rose-300 rounded-full shrink-0"></span>
                                    {r}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            {/* Actions Row */}
            <div className="flex gap-2 p-3 pt-0 mt-auto">
                <button
                    onClick={onReview}
                    className="flex-[0.5] py-1.5 px-3 bg-white border border-gray-200 text-gray-500 text-[10px] font-bold rounded-lg hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all uppercase tracking-wide"
                >
                    Details
                </button>

                <button
                    onClick={onExecute}
                    className="flex-1 py-1.5 px-3 bg-black text-white text-[10px] font-bold rounded-lg hover:bg-gray-800 transition-all shadow-sm hover:shadow-md uppercase tracking-wide flex items-center justify-center gap-2"
                >
                    Approve & Execute
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
