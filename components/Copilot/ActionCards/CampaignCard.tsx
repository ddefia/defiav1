import React, { useState } from 'react';
import { Button } from '../../Button';
import { ChatIntentResponse } from '../../../types';
import { generateCampaignDrafts } from '../../../services/gemini';
import { BrandConfig } from '../../../types';

interface CampaignCardProps {
    params: ChatIntentResponse['params'];
    brandName: string;
    brandConfig: BrandConfig;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ params, brandName, brandConfig }) => {
    const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle');
    const [result, setResult] = useState<any>(null);

    const handleGenerate = async () => {
        if (!params?.campaignTopic) return;
        setStatus('generating');
        try {
            // Simulate notes from the topic
            const rawNotes = `Topic: ${params.campaignTopic}. Theme: ${params.campaignTheme || 'General'}.`;
            // We use the simpler draft generator for now, or the 'analyzeContentNotes' if we want structured plan
            // Let's use the 'generateCampaignDrafts' which is the main one used in Campaigns.tsx
            // Actual signature: generateCampaignDrafts(theme, brandName, brandConfig, count, ...)
            const draftsResponse = await generateCampaignDrafts(
                params.campaignTopic,
                brandName,
                brandConfig,
                3,
                undefined, // contentPlan
                undefined, // focusContent
                [] // recentPosts
            );
            setResult(draftsResponse.drafts);
            setStatus('done');
        } catch (e) {
            console.error(e);
            setStatus('idle');
        }
    };

    if (status === 'done' && result) {
        return (
            <div className="p-4 bg-white border border-gray-200 rounded-xl animate-fadeIn duration-300 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-semibold text-emerald-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Generated Drafts
                    </h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded border border-gray-200">{result.length} Posts</span>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar mb-4 pr-1">
                    {result.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-[13px] text-gray-700 hover:bg-gray-100 transition-colors">
                            <p className="leading-relaxed">{item.tweet || item.content}</p>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Button className="w-full" onClick={() => window.location.hash = '#campaigns'}>Open in Editor</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
            <h4 className="text-sm font-semibold text-purple-600 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Draft Campaign
            </h4>
            <div className="space-y-3 mb-5">
                <div className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-500 font-medium">Topic</span>
                    <span className="text-gray-900 font-medium truncate max-w-[200px]">{params?.campaignTopic}</span>
                </div>
                {params?.campaignTheme && (
                    <div className="flex justify-between items-center text-[13px]">
                        <span className="text-gray-500 font-medium">Theme</span>
                        <span className="text-gray-900 font-medium">{params.campaignTheme}</span>
                    </div>
                )}
            </div>
            <Button
                className="w-full"
                onClick={handleGenerate}
                isLoading={status === 'generating'}
            >
                {status === 'generating' ? 'Drafting Campaign...' : 'Generate Drafts'}
            </Button>
        </div>
    );
};
