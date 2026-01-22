import React, { useState } from 'react';
import { Button } from '../../Button';
import { ChatIntentResponse } from '../../../types';
import { generateCampaignDrafts } from '../../../services/gemini';
import { BrandConfig } from '../../../types';

interface CampaignCardProps {
    params: ChatIntentResponse['params'];
    brandName: string;
    brandConfig: BrandConfig;
    onNavigate: (section: string, params: any) => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ params, brandName, brandConfig, onNavigate }) => {
    const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle');
    const [result, setResult] = useState<any>(null);

    // Editable State
    const [topic, setTopic] = useState(params?.campaignTopic || '');
    const [theme, setTheme] = useState(params?.campaignTheme || '');
    const [goal, setGoal] = useState('');

    const handleGenerate = async () => {
        if (!topic) return;
        setStatus('generating');
        try {
            // Include user edits in the prompt context if needed, 
            // but generateCampaignDrafts main sig takes topic/theme.
            // We can append goal to topic for context or pass it if extended.
            // For now, appending goal to topic ensures it's respecting the user's intent.
            const augmentedTopic = goal ? `${topic} (Goal: ${goal})` : topic;

            const draftsResponse = await generateCampaignDrafts(
                augmentedTopic,
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
                    <Button
                        className="w-full"
                        onClick={() => onNavigate('campaigns', { intent: topic })} // Use the active topic
                    >
                        Open in Editor
                    </Button>
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

            {/* EDITABLE FORM */}
            <div className="space-y-3 mb-5">
                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Topic / Focus</label>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Theme</label>
                        <input
                            type="text"
                            value={theme}
                            placeholder="e.g. Educational"
                            onChange={(e) => setTheme(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Goal (Optional)</label>
                        <input
                            type="text"
                            value={goal}
                            placeholder="e.g. Conversion"
                            onChange={(e) => setGoal(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-900 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
                        />
                    </div>
                </div>
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
