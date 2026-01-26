import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { editWeb3Graphic } from '../services/gemini';
import { fetchBrainHistoryEvents } from '../services/storage';
import { BrandConfig, CalendarEvent } from '../types';

interface ImageEditorProps {
    brandConfig?: BrandConfig;
    brandName?: string;
}

export const ImageEditor: React.FC<ImageEditorProps & { initialImage?: string, initialPrompt?: string }> = ({ brandConfig, brandName = '', initialImage, initialPrompt }) => {
    // State
    const [originalImage, setOriginalImage] = useState<string | null>(initialImage || null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>(initialPrompt || '');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<CalendarEvent[]>([]);
    const [aspectRatio, setAspectRatio] = useState<string>('1:1');
    const [quality, setQuality] = useState<'1K' | '2K'>('2K');

    // API Info
    const currentModel = "Gemini 2.0 Flash (Instruction) + Imagen 3 (Generation)";

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (brandName) {
            loadHistory();
        }
    }, [brandName]);

    // Update state if props change (e.g. navigation from Copilot)
    useEffect(() => {
        if (initialImage) setOriginalImage(initialImage);
        if (initialPrompt) setPrompt(initialPrompt);
    }, [initialImage, initialPrompt]);

    const loadHistory = async () => {
        if (!brandName) return;
        try {
            const events = await fetchBrainHistoryEvents(brandName);

            // CRASH FIX: Ensure events is an array before filtering
            if (!Array.isArray(events)) {
                console.warn("History events is not an array:", events);
                setHistory([]);
                return;
            }

            // Filter for events with images (ensure image is a string and not empty)
            const imageEvents = events.filter(e => e && e.image && typeof e.image === 'string' && e.image.length > 5);
            setHistory(imageEvents);
        } catch (e) {
            console.error("Failed to load history", e);
            setHistory([]); // Safely default to empty
        }
    };

    // Handlers
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

            // Detect Aspect Ratio
            const img = new Image();
            img.onload = () => {
                const ratio = img.width / img.height;
                // Simple buckets for Imagen 3
                let finalRatio = '1:1';
                if (ratio > 1.4) finalRatio = '16:9';
                else if (ratio < 0.7) finalRatio = '9:16';
                else if (ratio > 1.1) finalRatio = '4:3';
                else if (ratio < 0.9) finalRatio = '3:4';

                console.log(`Examples: Detected Image Ratio: ${ratio.toFixed(2)} -> bucketed to ${finalRatio}`);
                setAspectRatio(finalRatio);
            };
            img.src = base64;

            setOriginalImage(base64);
            setEditedImage(null); // Reset edited image on new upload
            setError(null);
        } catch (err) {
            console.error("Upload failed", err);
            setError("Failed to upload image.");
        }
    };

    const handleEdit = async () => {
        if (!originalImage || !prompt) return;

        setIsProcessing(true);
        setError(null);

        try {
            // Call the service
            const result = await editWeb3Graphic(originalImage, prompt, brandConfig, aspectRatio, quality);
            setEditedImage(result);
        } catch (err: any) {
            console.error("Edit failed", err);
            setError(err.message || "Failed to edit image.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = async (imageUrl: string) => {
        const createDownloadLink = (url: string) => {
            const link = document.createElement('a');
            link.href = url;
            link.download = `edited-image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        if (imageUrl.startsWith('http')) {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                createDownloadLink(blobUrl);
                URL.revokeObjectURL(blobUrl);
            } catch (e) {
                console.error('Download failed, falling back to direct link', e);
                createDownloadLink(imageUrl);
            }
        } else {
            createDownloadLink(imageUrl);
        }
    };

    const handleClear = () => {
        setOriginalImage(null);
        setEditedImage(null);
        setPrompt('');
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-6 space-y-6 animate-fadeIn h-full flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-200 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">AI Image Studio <span className="text-[10px] bg-black text-white px-2 py-1 rounded ml-2 align-middle font-bold uppercase tracking-widest">Beta</span></h1>
                    <p className="text-gray-500 text-sm max-w-lg">Upload an image and use magic prompts to edit it.</p>
                </div>
                {originalImage && (
                    <Button onClick={handleClear} variant="secondary">Start Over</Button>
                )}
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-[500px]">

                {/* LEFT PANEL: CONTROLS */}
                <div className="bg-white border border-brand-border rounded-xl p-6 shadow-sm flex flex-col gap-6 h-fit">

                    {/* Upload Section */}
                    {!originalImage ? (
                        <div
                            className="border-2 border-dashed border-zinc-200 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-zinc-50 hover:border-zinc-300 transition-all duration-300 h-64 group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*"
                                className="hidden"
                            />
                            <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:scale-110 transition-transform mb-4 border border-zinc-100">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <span className="font-bold text-zinc-700 text-sm">Click to Upload Image</span>
                            <span className="text-xs text-zinc-400 mt-2">JPG, PNG supported</span>
                        </div>
                    ) : (
                        <div className="relative group rounded-xl overflow-hidden shadow-sm border border-brand-border">
                            <img src={originalImage} className="w-full h-auto max-h-64 object-cover" alt="Original" />
                            <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md">Original</div>
                        </div>
                    )}

                    {/* Edit Controls */}
                    {originalImage && (
                        <div className="space-y-4 animate-fadeIn">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-2 block tracking-widest pl-1">Magic Instruction</label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g. Change the background to a cyberpunk city, make the logo neon blue..."
                                    className="w-full bg-white border-2 border-gray-100 rounded-xl p-4 text-sm text-gray-900 focus:border-zinc-900 focus:ring-0 outline-none resize-none h-32 transition-all font-medium placeholder:text-gray-400"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Select
                                    label="Aspect Ratio"
                                    value={aspectRatio}
                                    onChange={(e) => setAspectRatio(e.target.value)}
                                    options={[
                                        { value: '1:1', label: 'Square (1:1)' },
                                        { value: '16:9', label: 'Wide (16:9)' },
                                        { value: '9:16', label: 'Story (9:16)' },
                                        { value: '4:3', label: 'Classic (4:3)' },
                                        { value: '3:4', label: 'Portrait (3:4)' }
                                    ]}
                                />
                                <Select
                                    label="Quality"
                                    value={quality}
                                    onChange={(e) => setQuality(e.target.value as any)}
                                    options={[
                                        { value: '1K', label: 'Standard (1K)' },
                                        { value: '2K', label: 'High (2K)' }
                                    ]}
                                />
                            </div>

                            <Button
                                onClick={handleEdit}
                                isLoading={isProcessing}
                                disabled={!prompt}
                                className="w-full py-4 shadow-lg shadow-zinc-900/10 bg-zinc-900 text-white hover:bg-zinc-800 border-none rounded-xl font-bold"
                            >
                                ✨ Magic Edit
                            </Button>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL: PREVIEW */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white border border-gray-100 rounded-xl p-8 flex items-center justify-center relative min-h-[400px] flex-1 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">

                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur border border-zinc-200 px-3 py-1.5 rounded-full text-[10px] font-bold text-zinc-500 flex items-center gap-1.5 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Running on {currentModel}
                        </div>

                        {!editedImage && !isProcessing && (
                            <div className="text-center opacity-40">
                                <div className="w-20 h-20 mx-auto bg-gray-200 rounded-full flex items-center justify-center text-4xl mb-4">🪄</div>
                                <h3 className="font-bold text-lg text-gray-500">Ready to Magic</h3>
                                <p className="text-sm text-gray-400">Upload an image and enter a prompt to see the result here.</p>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="text-center animate-pulse">
                                <div className="w-16 h-16 mx-auto border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                                <h3 className="font-bold text-lg text-indigo-600">Generating Magic...</h3>
                                <p className="text-sm text-gray-400">This might take a few seconds.</p>
                            </div>
                        )}

                        {editedImage && !isProcessing && (
                            <div className="animate-fadeIn w-full h-full flex flex-col items-center">
                                <div className="relative rounded-lg overflow-hidden shadow-2xl border border-white/20 max-h-[600px]">
                                    <img src={editedImage} className="max-w-full max-h-[600px] object-contain" alt="Edited Result" />
                                </div>
                                <div className="mt-8 flex gap-4">
                                    <Button onClick={() => handleDownload(editedImage)} className="shadow-xl">
                                        Download Result
                                    </Button>
                                    <Button onClick={() => { setOriginalImage(editedImage); setEditedImage(null); setPrompt(''); }} variant="secondary">
                                        Use as New Base
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* HISTORY GALLERY */}
                    {history.length > 0 && (
                        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                                History for {brandName || 'Brand'}
                            </h3>
                            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                                {history.slice(0, 8).map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            if (item.image) {
                                                // Simplified: Just set current image to this history URL.
                                                // If cross-origin becomes an issue for the canvas editing later, we'll need a proxy, 
                                                // but for "Image Editor" flow (multimodal), providing the URL or base64 usually works if supported.
                                                // Warning: editWeb3Graphic expects base64. 
                                                // The image element will load the URL. We might need to fetch blob in handleFileUpload-like manner if we want to be safe, 
                                                // but let's try setting it as originalImage first. 
                                                // If 'editWeb3Graphic' logic checks for "data:", it handles base64. If it's a URL, we need to convert.
                                                // Let's optimize: fetch blob and convert on click.
                                                setOriginalImage(item.image); // Set immediately for UI

                                                // Async fetch for internal data processing if needed
                                                // (Ideally we do this processing inside editWeb3Graphic or before setting for consistency)
                                                // BUT 'editWeb3Graphic' takes base64. 
                                                // Let's modify handleEdit to handle URL too? Or convert here.
                                                // Converting HERE is better UX control.
                                                if (item.image.startsWith('http')) {
                                                    fetch(item.image)
                                                        .then(res => res.blob())
                                                        .then(blob => {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => setOriginalImage(reader.result as string);
                                                            reader.readAsDataURL(blob);
                                                        })
                                                        .catch(e => console.error("Failed to load history image", e));
                                                }

                                                setEditedImage(null);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }
                                        }}
                                        className="min-w-[120px] w-[120px] aspect-square rounded-lg border border-brand-border cursor-pointer hover:border-brand-accent hover:shadow-md transition-all relative group overflow-hidden"
                                    >
                                        <img src={item.image} className="w-full h-full object-cover" loading="lazy" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <span className="text-[10px] font-bold text-white bg-black/50 px-2 py-1 rounded">Edit This</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
