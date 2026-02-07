import React, { useState, useRef, useEffect, useCallback } from 'react';
import { editWeb3Graphic } from '../services/gemini';
import { fetchBrainHistoryEvents } from '../services/storage';
import { BrandConfig, CalendarEvent } from '../types';

interface ImageEditorProps {
    brandConfig?: BrandConfig;
    brandName?: string;
    initialImage?: string;
    initialPrompt?: string;
    onBack?: () => void;
    onSaveAndUse?: (imageUrl: string) => void;
}

interface EditHistoryItem {
    id: string;
    prompt: string;
    image: string;
    timestamp: number;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
    brandConfig,
    brandName = '',
    initialImage,
    initialPrompt,
    onBack,
    onSaveAndUse,
}) => {
    const [originalImage, setOriginalImage] = useState<string | null>(initialImage || null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>(initialPrompt || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<string>('16:9');
    const [quality] = useState<'1K' | '2K'>('2K');
    const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
    const [zoom, setZoom] = useState(100);
    const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
    const [mode, setMode] = useState<'editing' | 'preview'>('editing');
    const [sourceLabel, setSourceLabel] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialImage) {
            setOriginalImage(initialImage);
            setSourceLabel('From Content Studio');
            detectAspectRatio(initialImage);
        }
        if (initialPrompt) setPrompt(initialPrompt);
    }, [initialImage, initialPrompt]);

    const detectAspectRatio = (src: string) => {
        const img = new Image();
        img.onload = () => {
            setImageSize({ w: img.width, h: img.height });
            const ratio = img.width / img.height;
            if (ratio > 1.4) setAspectRatio('16:9');
            else if (ratio < 0.7) setAspectRatio('9:16');
            else if (ratio > 1.1) setAspectRatio('4:3');
            else if (ratio < 0.9) setAspectRatio('3:4');
            else setAspectRatio('1:1');
        };
        img.src = src;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            detectAspectRatio(base64);
            setOriginalImage(base64);
            setEditedImage(null);
            setError(null);
            setSourceLabel('Uploaded');
        } catch (err) {
            setError('Failed to upload image.');
        }
    };

    const handleEdit = async () => {
        if (!originalImage || !prompt.trim()) return;
        setIsProcessing(true);
        setError(null);
        try {
            const result = await editWeb3Graphic(originalImage, prompt, brandConfig, aspectRatio, quality);
            setEditedImage(result);
            detectAspectRatio(result);
            setEditHistory(prev => [{
                id: `edit-${Date.now()}`,
                prompt: prompt,
                image: result,
                timestamp: Date.now(),
            }, ...prev].slice(0, 20));
        } catch (err: any) {
            setError(err.message || 'Failed to edit image.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleQuickAction = (action: string) => {
        setPrompt(action);
    };

    const handleUndo = (item: EditHistoryItem) => {
        setEditHistory(prev => prev.filter(h => h.id !== item.id));
        // Find the previous state
        const idx = editHistory.findIndex(h => h.id === item.id);
        if (idx < editHistory.length - 1) {
            setEditedImage(editHistory[idx + 1].image);
        } else {
            setEditedImage(null);
        }
    };

    const handleResetToOriginal = () => {
        setEditedImage(null);
        setEditHistory([]);
        setPrompt('');
    };

    const handleDownload = async () => {
        const imageUrl = editedImage || originalImage;
        if (!imageUrl) return;
        const createLink = (url: string) => {
            const link = document.createElement('a');
            link.href = url;
            link.download = `defia-edit-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        if (imageUrl.startsWith('http')) {
            try {
                const res = await fetch(imageUrl);
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                createLink(blobUrl);
                URL.revokeObjectURL(blobUrl);
            } catch {
                createLink(imageUrl);
            }
        } else {
            createLink(imageUrl);
        }
    };

    const handleSave = () => {
        const img = editedImage || originalImage;
        if (img && onSaveAndUse) onSaveAndUse(img);
    };

    const displayImage = editedImage || originalImage;

    // No image loaded — upload screen
    if (!originalImage) {
        return (
            <div className="flex-1 flex flex-col bg-[#0A0A0B]">
                <div className="flex items-center gap-4 px-8 py-5 border-b border-[#1F1F23]">
                    {onBack && (
                        <button onClick={onBack} className="flex items-center gap-2 text-[#6B6B70] hover:text-white transition-colors text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Back
                        </button>
                    )}
                    <div className="flex items-center gap-2.5">
                        <span className="text-lg">✏️</span>
                        <span className="text-base font-semibold text-white">Image Editor</span>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-[500px] border-2 border-dashed border-[#2E2E2E] rounded-2xl p-16 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#FF5C00] transition-colors group"
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                        <div className="w-20 h-20 rounded-2xl bg-[#1F1F23] flex items-center justify-center mb-5 group-hover:bg-[#FF5C0015] transition-colors">
                            <svg className="w-10 h-10 text-[#6B6B70] group-hover:text-[#FF5C00] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Upload an Image</h3>
                        <p className="text-sm text-[#6B6B70]">Click to upload or drag and drop · JPG, PNG</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#1F1F23] bg-[#111113]">
                <div className="flex items-center gap-5">
                    {onBack && (
                        <button onClick={onBack} className="flex items-center gap-2 text-[#6B6B70] hover:text-white transition-colors text-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Back
                        </button>
                    )}
                    <div className="flex items-center gap-2.5">
                        <span className="text-lg">✏️</span>
                        <span className="text-base font-semibold text-white">Edit Image</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF5C0015] border border-[#FF5C0033]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C00]"></span>
                        <span className="text-[11px] font-medium text-[#FF5C00]">Editing</span>
                    </div>

                    {/* Mode toggle */}
                    <button
                        onClick={() => setMode(mode === 'editing' ? 'preview' : 'editing')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            mode === 'preview'
                                ? 'bg-[#3B82F615] text-[#3B82F6] border border-[#3B82F633]'
                                : 'text-[#6B6B70] hover:text-white'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Preview
                    </button>
                </div>

                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0">
                {/* Left Panel */}
                <div className="w-[420px] flex flex-col border-r border-[#1F1F23] bg-[#111113] overflow-y-auto">
                    <div className="p-5 space-y-5">
                        {/* Original Image Thumbnail */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-sm font-semibold text-white">Original Image</span>
                                {sourceLabel && <span className="text-[11px] text-[#6B6B70]">{sourceLabel}</span>}
                            </div>
                            <div className="rounded-xl overflow-hidden border border-[#1F1F23] bg-[#0A0A0B]">
                                <img
                                    src={originalImage}
                                    alt="Original"
                                    className="w-full h-auto max-h-[200px] object-contain"
                                />
                            </div>
                        </div>

                        {/* Edit Prompt */}
                        <div>
                            <label className="text-sm font-semibold text-white mb-2 block">What do you want to edit?</label>
                            <textarea
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder={'Describe what you want to change...\n\nExample: "Remove the watermark in the bottom right corner"'}
                                className="w-full h-[100px] bg-[#0A0A0B] border border-[#2E2E2E] rounded-xl p-3.5 text-sm text-white placeholder-[#4A4A4E] focus:border-[#FF5C00] focus:outline-none resize-none transition-colors"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleEdit();
                                    }
                                }}
                            />
                        </div>

                        {/* Quick Actions */}
                        <div>
                            <span className="text-sm font-semibold text-white mb-2.5 block">Quick Actions</span>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { icon: '💧', label: 'Remove\nWatermark', prompt: 'Remove the watermark from the image' },
                                    { icon: '𝐓', label: 'Remove\nText', prompt: 'Remove all text overlays from the image' },
                                    { icon: '🎯', label: 'Remove\nObject', prompt: 'Remove the most prominent unwanted object from the image' },
                                    { icon: '🖼️', label: 'Change\nBackground', prompt: 'Change the background to a dark gradient' },
                                    { icon: '✨', label: 'Enhance\nQuality', prompt: 'Enhance the image quality, make it sharper and more vibrant' },
                                    { icon: '🎨', label: 'Restyle\nWeb3', prompt: 'Restyle this image with a modern Web3 / crypto aesthetic, dark theme, neon accents' },
                                ].map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleQuickAction(action.prompt)}
                                        className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all ${
                                            prompt === action.prompt
                                                ? 'bg-[#FF5C0010] border-[#FF5C0044] text-[#FF5C00]'
                                                : 'bg-[#0A0A0B] border-[#1F1F23] text-[#ADADB0] hover:border-[#2E2E2E] hover:text-white'
                                        }`}
                                    >
                                        <span className="text-lg">{action.icon}</span>
                                        <span className="text-[11px] font-medium text-center leading-tight whitespace-pre-line">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Edit History */}
                        {editHistory.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className="text-sm font-semibold text-white">Edit History</span>
                                    <button
                                        onClick={() => { setEditHistory([]); setEditedImage(null); }}
                                        className="text-[11px] text-[#6B6B70] hover:text-[#FF5C00] transition-colors"
                                    >
                                        Clear All
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {editHistory.map(item => (
                                        <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0A0A0B] border border-[#1F1F23]">
                                            <div className="w-5 h-5 rounded-full bg-[#22C55E18] flex items-center justify-center flex-shrink-0">
                                                <svg className="w-3 h-3 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <span className="text-xs text-[#ADADB0] flex-1 truncate">{item.prompt}</span>
                                            <button
                                                onClick={() => handleUndo(item)}
                                                className="text-[11px] text-[#FF5C00] hover:text-[#FF6B1A] transition-colors font-medium flex-shrink-0"
                                            >
                                                Undo
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Left Footer */}
                    <div className="mt-auto p-5 border-t border-[#1F1F23] flex items-center gap-3">
                        <button
                            onClick={handleResetToOriginal}
                            className="text-sm text-[#6B6B70] hover:text-white transition-colors"
                        >
                            Reset to Original
                        </button>
                        <button
                            onClick={handleEdit}
                            disabled={!prompt.trim() || isProcessing}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                                isProcessing
                                    ? 'bg-[#1F1F23] text-[#6B6B70] cursor-wait'
                                    : !prompt.trim()
                                    ? 'bg-[#1F1F23] text-[#4A4A4E] cursor-not-allowed'
                                    : 'bg-gradient-to-b from-[#FF5C00] to-[#FF7A2E] text-white hover:opacity-90'
                            }`}
                        >
                            {isProcessing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-[#6B6B70] border-t-transparent rounded-full animate-spin"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <span>🔄</span>
                                    Regenerate
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Panel — Preview */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#0A0A0B]">
                    {/* Preview Area */}
                    <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
                        {isProcessing ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 border-3 border-[#FF5C00] border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm text-[#6B6B70]">Applying edits...</p>
                            </div>
                        ) : displayImage ? (
                            <img
                                src={displayImage}
                                alt="Preview"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                style={{ transform: `scale(${zoom / 100})`, transition: 'transform 0.2s ease' }}
                            />
                        ) : (
                            <div className="text-center">
                                <div className="w-20 h-20 rounded-2xl bg-[#1F1F23] flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">🖼️</span>
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">No Preview</h3>
                                <p className="text-sm text-[#6B6B70]">Upload an image to get started</p>
                            </div>
                        )}
                    </div>

                    {/* Bottom Bar */}
                    <div className="flex items-center justify-between px-6 py-3 border-t border-[#1F1F23] bg-[#111113]">
                        <div className="flex items-center gap-4">
                            {/* Zoom Controls */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setZoom(z => Math.max(25, z - 25))}
                                    className="w-7 h-7 rounded-md bg-[#1F1F23] border border-[#2E2E2E] flex items-center justify-center text-[#6B6B70] hover:text-white transition-colors text-sm"
                                >
                                    −
                                </button>
                                <span className="text-xs text-[#ADADB0] font-mono min-w-[40px] text-center">{zoom}%</span>
                                <button
                                    onClick={() => setZoom(z => Math.min(200, z + 25))}
                                    className="w-7 h-7 rounded-md bg-[#1F1F23] border border-[#2E2E2E] flex items-center justify-center text-[#6B6B70] hover:text-white transition-colors text-sm"
                                >
                                    +
                                </button>
                            </div>

                            {/* Dimensions */}
                            {imageSize.w > 0 && (
                                <span className="text-xs text-[#6B6B70] font-mono">{imageSize.w} × {imageSize.h}px</span>
                            )}
                        </div>

                        {/* Save Button */}
                        {onSaveAndUse && (
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                Save & Use Image
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Toast */}
            {error && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-[#EF444415] border border-[#EF444433] shadow-2xl">
                    <span className="text-[#EF4444] text-sm">⚠️</span>
                    <span className="text-sm text-[#EF4444]">{error}</span>
                    <button onClick={() => setError(null)} className="text-[#EF4444] hover:text-white text-sm ml-2">✕</button>
                </div>
            )}

            {/* Hidden file input */}
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
        </div>
    );
};
