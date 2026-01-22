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
            <div className="mt-4 p-4 border border-brand-border rounded-lg bg-black/20 animate-fadeIn">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-green-400">✨ Campaign Drafts Ready</h4>
                    <span className="text-xs text-brand-muted">{result.length} posts generated</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar mb-4">
                    {result.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 bg-brand-surface border border-brand-border rounded-md text-xs">
                            <p className="opacity-90">{item.tweet || item.content}</p>
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
        <div className="mt-4 p-4 border border-brand-border rounded-lg bg-black/20">
            <h4 className="text-sm font-bold text-brand-accent mb-2">Draft Campaign</h4>
            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                    <span className="text-brand-muted">Topic</span>
                    <span className="text-white">{params?.campaignTopic}</span>
                </div>
                {params?.campaignTheme && (
                    <div className="flex justify-between text-xs">
                        <span className="text-brand-muted">Theme</span>
                        <span className="text-white">{params.campaignTheme}</span>
                    </div>
                )}
            </div>
            <Button
                className="w-full"
                onClick={handleGenerate}
                isLoading={status === 'generating'}
            >
                {status === 'generating' ? 'Drafting...' : 'Generate Drafts'}
            </Button>
        </div>
    );
};
