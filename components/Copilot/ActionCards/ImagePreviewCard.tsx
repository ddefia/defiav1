import React, { useState } from 'react';
import { Button } from '../../Button';
import { ChatIntentResponse } from '../../../types';
import { generateWeb3Graphic } from '../../../services/gemini';
import { BrandConfig, GenerateImageParams } from '../../../types';

interface ImagePreviewCardProps {
    params: ChatIntentResponse['params'];
    brandName: string;
    brandConfig: BrandConfig;
}

export const ImagePreviewCard: React.FC<ImagePreviewCardProps> = ({ params, brandName, brandConfig }) => {
    const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle');
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!params?.imagePrompt) return;
        setStatus('generating');
        try {
            const imageParams: GenerateImageParams = {
                prompt: params.imagePrompt,
                artPrompt: params.imageStyle, // e.g., "Cyberpunk", "Minimalist"
                aspectRatio: params.imageAspectRatio || '1:1',
                size: '1K', // Default
                brandConfig: brandConfig,
                brandName: brandName,
                templateType: 'Default',
                selectedReferenceImages: [] // Copilot could infer this later
            };

            const result = await generateWeb3Graphic(imageParams);
            setImageUrl(result);
            setStatus('done');
        } catch (e) {
            console.error("Image Gen Failed", e);
            setStatus('idle');
        }
    };

    if (status === 'done' && imageUrl) {
        return (
            <div className="mt-4 p-4 border border-brand-border rounded-lg bg-black/20 animate-fadeIn relative group">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-green-400">✨ Visual Generated</h4>
                </div>

                <div className="relative aspect-square w-full rounded-md overflow-hidden bg-gray-900 border border-brand-border mb-4 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all">
                    <img src={imageUrl} alt="Generated visual" className="w-full h-full object-cover" />
                </div>

                <div className="flex gap-2">
                    <Button className="w-full" onClick={() => window.location.hash = '#image-editor'}>Edit High-Res</Button>
                    <a href={imageUrl} download={`generated-${Date.now()}.png`} className="px-4 py-2 border border-brand-border rounded-lg hover:bg-white/10 flex items-center justify-center text-white">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 p-4 border border-brand-border rounded-lg bg-black/20">
            <h4 className="text-sm font-bold text-purple-400 mb-2">Generate Visual</h4>
            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                    <span className="text-brand-muted">Prompt</span>
                    <span className="text-white truncate max-w-[200px]">{params?.imagePrompt}</span>
                </div>
                {params?.imageStyle && (
                    <div className="flex justify-between text-xs">
                        <span className="text-brand-muted">Style</span>
                        <span className="text-white">{params.imageStyle}</span>
                    </div>
                )}
                {params?.imageAspectRatio && (
                    <div className="flex justify-between text-xs">
                        <span className="text-brand-muted">Ratio</span>
                        <span className="text-white">{params.imageAspectRatio}</span>
                    </div>
                )}
            </div>
            <Button
                className="w-full"
                onClick={handleGenerate}
                isLoading={status === 'generating'}
            >
                {status === 'generating' ? 'Creating...' : 'Generate Image'}
            </Button>
        </div>
    );
};
