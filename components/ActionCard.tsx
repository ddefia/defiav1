import React, { useState } from 'react';
import { DashboardCampaign } from '../types';

interface ActionCardProps {
    campaign: DashboardCampaign;
    onReview: () => void;
    onExecute: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ campaign, onReview, onExecute }) => {
    const [isRationaleOpen, setIsRationaleOpen] = useState(false);

    // Map recommendation action to color
    const getActionColor = (action: string) => {
        switch (action) {
            case 'Scale': return 'text-emerald-700 bg-emerald-50 border-emerald-100';
            case 'Kill': return 'text-rose-700 bg-rose-50 border-rose-100';
            case 'Test': return 'text-blue-700 bg-blue-50 border-blue-100';
            default: return 'text-gray-700 bg-gray-50 border-gray-100';
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all relative group overflow-hidden">
            {/* Header Section */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                        {/* Priority Score - prominent */}
                        <div className="flex flex-col items-center justify-center w-10 h-10 bg-gray-900 rounded-lg text-white shadow-sm shrink-0">
                            <span className="text-sm font-bold leading-none">{campaign.priorityScore}</span>
                            <span className="text-[8px] opacity-60 uppercase">/10</span>
                        </div>
                        <div>
                            {/* Action Title - concrete */}
                            <h3 className="text-xs font-bold text-gray-900 leading-tight">
                                {campaign.recommendation.action} {campaign.name}
                            </h3>
                            {/* Subheader: Channel + Format */}
                            <div className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5 mt-1">
                                <span>{campaign.channel}</span>
                                <span className="text-gray-300">•</span>
                                <span>Campaign</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tags & Impact */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                        ${campaign.type === 'Alpha' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                            campaign.type === 'Newsjack' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        {campaign.type}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]" title={campaign.expectedImpact}>
                        <span className="text-xs text-gray-300 mr-1">↪</span>
                        <span className="text-gray-600 font-medium">{campaign.expectedImpact}</span>
                    </span>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-4">
                {/* Confidence Indicator */}
                <div className="flex items-center justify-between mb-4">
                    <div className="group/conf relative flex items-center gap-1.5 cursor-help">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Confidence</span>
                        <div className={`h-1.5 w-1.5 rounded-full ${campaign.recommendation.confidence === 'High' ? 'bg-emerald-500' : campaign.recommendation.confidence === 'Med' ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                        <span className={`text-[10px] font-bold ${campaign.recommendation.confidence === 'High' ? 'text-emerald-700' : campaign.recommendation.confidence === 'Med' ? 'text-amber-700' : 'text-rose-700'}`}>
                            {campaign.recommendation.confidence}
                        </span>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover/conf:opacity-100 pointer-events-none transition-opacity z-10 transition-delay-75">
                            System confidence based on ROI ({campaign.roi}x) and signal consistency.
                        </div>
                    </div>
                </div>

                {/* Rationale Drawer */}
                <div className="mb-4">
                    <button
                        onClick={() => setIsRationaleOpen(!isRationaleOpen)}
                        className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-gray-800 transition-colors uppercase tracking-wide mb-2"
                    >
                        {isRationaleOpen ? 'Hide Rationale' : 'View Rationale'}
                        <svg className={`w-3 h-3 transition-transform ${isRationaleOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {isRationaleOpen && (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 animate-fadeIn">
                            <ul className="space-y-2">
                                {campaign.recommendation.reasoning.map((r, i) => (
                                    <li key={i} className="flex items-start gap-2 text-[10px] text-gray-600 leading-relaxed font-mono">
                                        <span className="mt-1.5 w-1 h-1 bg-gray-400 rounded-full shrink-0"></span>
                                        {r}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-50">
                    <button
                        onClick={onReview}
                        className="flex-1 py-1.5 px-3 bg-white border border-gray-200 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all uppercase tracking-wide"
                    >
                        Review
                    </button>

                    <div className="relative group/exec flex-1">
                        <button
                            onClick={onExecute}
                            className={`w-full py-1.5 px-3 bg-black text-white text-[10px] font-bold rounded-lg hover:bg-gray-800 transition-all shadow-sm hover:shadow-md uppercase tracking-wide flex items-center justify-center gap-2`}
                        >
                            Approve
                            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </button>

                        {/* Execute Tooltip/Subtext */}
                        <div className="absolute bottom-full right-0 mb-2 w-56 bg-white border border-gray-200 text-gray-600 text-[10px] p-3 rounded-lg shadow-xl opacity-0 group-hover/exec:opacity-100 pointer-events-none transition-opacity z-20">
                            <div className="font-bold text-gray-900 mb-1 border-b border-gray-100 pb-1">Execute will:</div>
                            <ul className="space-y-1 text-gray-500">
                                <li className="flex items-center gap-1.5">
                                    <span className="w-1 h-1 bg-gray-500 rounded-full"></span> Draft content
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <span className="w-1 h-1 bg-gray-500 rounded-full"></span> Schedule campaign
                                </li>
                                <li className="flex items-center gap-1.5 text-orange-600 font-medium">
                                    <span className="w-1 h-1 bg-orange-500 rounded-full"></span> Will not publish without review
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
