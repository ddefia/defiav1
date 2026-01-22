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
            <div className="p-4 bg-white border border-gray-200 rounded-xl animate-fadeIn duration-300 relative group shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-semibold text-emerald-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Visual Generated
                    </h4>
                </div>

                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-gray-100 border border-gray-200 mb-4 group-hover:shadow-lg group-hover:shadow-purple-500/10 transition-all duration-500">
                    <img src={imageUrl} alt="Generated visual" className="w-full h-full object-cover" />
                </div>

                <div className="flex gap-3">
                    <Button className="flex-1" onClick={() => window.location.hash = '#image-editor'}>Edit High-Res</Button>
                    <a href={imageUrl} download={`generated-${Date.now()}.png`} className="px-4 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
            <h4 className="text-sm font-semibold text-purple-600 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Generate Visual
            </h4>
            <div className="space-y-3 mb-5">
                <div className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-500 font-medium">Prompt</span>
                    <span className="text-gray-900 font-medium truncate max-w-[200px]">{params?.imagePrompt}</span>
                </div>
                {params?.imageStyle && (
                    <div className="flex justify-between items-center text-[13px]">
                        <span className="text-gray-500 font-medium">Style</span>
                        <span className="text-gray-900 font-medium">{params.imageStyle}</span>
                    </div>
                )}
                {params?.imageAspectRatio && (
                    <div className="flex justify-between items-center text-[13px]">
                        <span className="text-gray-500 font-medium">Ratio</span>
                        <span className="text-gray-900 font-medium">{params.imageAspectRatio}</span>
                    </div>
                )}
            </div>
            <Button
                className="w-full"
                onClick={handleGenerate}
                isLoading={status === 'generating'}
            >
                {status === 'generating' ? 'Creating Visual...' : 'Generate Image'}
            </Button>
        </div>
    );
};
