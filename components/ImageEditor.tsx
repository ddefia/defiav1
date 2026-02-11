import React, { useState, useRef, useEffect, useCallback } from 'react';
import { editWeb3Graphic } from '../services/gemini';
import { loadImageGallery, saveImageToGallery, removeFromGallery, createThumbnail, GalleryImage } from '../services/storage';
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

// Real editing adjustments
interface Adjustments {
    brightness: number;  // -100 to 100
    contrast: number;    // -100 to 100
    saturation: number;  // -100 to 100
    blur: number;        // 0 to 20
    rotation: number;    // 0, 90, 180, 270
    flipH: boolean;
    flipV: boolean;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
};

type EditorTab = 'ai' | 'adjust' | 'transform';

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
    const [sourceLabel, setSourceLabel] = useState('');

    // Gallery
    const [gallery, setGallery] = useState<GalleryImage[]>([]);

    // Real editing
    const [activeTab, setActiveTab] = useState<EditorTab>('ai');
    const [adjustments, setAdjustments] = useState<Adjustments>({ ...DEFAULT_ADJUSTMENTS });
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load gallery on mount
    useEffect(() => {
        if (brandName) {
            setGallery(loadImageGallery(brandName));
        }
    }, [brandName]);

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
            loadImageIntoEditor(base64, 'Uploaded');
        } catch (err) {
            setError('Failed to upload image.');
        }
    };

    const loadImageIntoEditor = (dataUrl: string, label: string) => {
        detectAspectRatio(dataUrl);
        setOriginalImage(dataUrl);
        setEditedImage(null);
        setError(null);
        setSourceLabel(label);
        setAdjustments({ ...DEFAULT_ADJUSTMENTS });
        setEditHistory([]);
    };

    const selectFromGallery = (item: GalleryImage) => {
        const imgData = item.fullData || item.data;
        loadImageIntoEditor(imgData, 'From Gallery');
    };

    // Save current image to gallery
    const saveToGallery = async () => {
        const img = getDisplayImage();
        if (!img) return;
        const thumbnail = await createThumbnail(img);
        const galleryItem: GalleryImage = {
            id: `img-${Date.now()}`,
            data: thumbnail,
            fullData: img.length < 500000 ? img : undefined, // Only store full if < 500KB
            prompt: prompt || undefined,
            timestamp: Date.now(),
            source: editedImage ? 'edited' : 'uploaded',
        };
        saveImageToGallery(brandName, galleryItem);
        setGallery(loadImageGallery(brandName));
    };

    // AI Edit
    const handleEdit = async () => {
        if (!originalImage || !prompt.trim()) return;
        setIsProcessing(true);
        setError(null);
        try {
            const sourceImg = applyAdjustmentsToCanvas() || originalImage;
            const result = await editWeb3Graphic(sourceImg, prompt, brandConfig, aspectRatio, quality);
            setEditedImage(result);
            detectAspectRatio(result);
            setEditHistory(prev => [{
                id: `edit-${Date.now()}`,
                prompt: prompt,
                image: result,
                timestamp: Date.now(),
            }, ...prev].slice(0, 20));
            // Auto-save to gallery
            const thumbnail = await createThumbnail(result);
            saveImageToGallery(brandName, {
                id: `img-${Date.now()}`,
                data: thumbnail,
                fullData: result.length < 500000 ? result : undefined,
                prompt,
                timestamp: Date.now(),
                source: 'edited',
            });
            setGallery(loadImageGallery(brandName));
        } catch (err: any) {
            setError(err.message || 'Failed to edit image.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleQuickAction = (action: string) => {
        setPrompt(action);
        setActiveTab('ai');
    };

    const handleUndo = (item: EditHistoryItem) => {
        setEditHistory(prev => prev.filter(h => h.id !== item.id));
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
        setAdjustments({ ...DEFAULT_ADJUSTMENTS });
    };

    // Apply CSS filter adjustments to canvas and return data URL
    const applyAdjustmentsToCanvas = useCallback((): string | null => {
        const sourceImg = editedImage || originalImage;
        if (!sourceImg) return null;
        const hasAdjustments = adjustments.brightness !== 0 || adjustments.contrast !== 0 ||
            adjustments.saturation !== 0 || adjustments.blur !== 0 ||
            adjustments.rotation !== 0 || adjustments.flipH || adjustments.flipV;
        if (!hasAdjustments) return sourceImg;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return sourceImg;

        const img = new Image();
        img.src = sourceImg;
        // Since we need synchronous result, use the existing image dimensions
        const isRotated90 = adjustments.rotation === 90 || adjustments.rotation === 270;
        canvas.width = isRotated90 ? imageSize.h : imageSize.w;
        canvas.height = isRotated90 ? imageSize.w : imageSize.h;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (adjustments.rotation) ctx.rotate((adjustments.rotation * Math.PI) / 180);
        if (adjustments.flipH) ctx.scale(-1, 1);
        if (adjustments.flipV) ctx.scale(1, -1);

        const b = 1 + adjustments.brightness / 100;
        const c = 1 + adjustments.contrast / 100;
        const s = 1 + adjustments.saturation / 100;
        ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s}) blur(${adjustments.blur}px)`;
        ctx.drawImage(img, -imageSize.w / 2, -imageSize.h / 2, imageSize.w, imageSize.h);
        ctx.restore();

        return canvas.toDataURL('image/png');
    }, [adjustments, editedImage, originalImage, imageSize]);

    // Get the CSS filter string for preview (non-destructive)
    const getFilterString = () => {
        const b = 1 + adjustments.brightness / 100;
        const c = 1 + adjustments.contrast / 100;
        const s = 1 + adjustments.saturation / 100;
        return `brightness(${b}) contrast(${c}) saturate(${s}) blur(${adjustments.blur}px)`;
    };

    const getTransformString = () => {
        let t = `scale(${zoom / 100})`;
        if (adjustments.rotation) t += ` rotate(${adjustments.rotation}deg)`;
        if (adjustments.flipH) t += ' scaleX(-1)';
        if (adjustments.flipV) t += ' scaleY(-1)';
        return t;
    };

    // Apply adjustments destructively (bake into image)
    const handleApplyAdjustments = async () => {
        const sourceImg = editedImage || originalImage;
        if (!sourceImg) return;
        setIsProcessing(true);
        try {
            // Load image and draw with adjustments
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = sourceImg;
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            const isRotated90 = adjustments.rotation === 90 || adjustments.rotation === 270;
            canvas.width = isRotated90 ? img.height : img.width;
            canvas.height = isRotated90 ? img.width : img.height;

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            if (adjustments.rotation) ctx.rotate((adjustments.rotation * Math.PI) / 180);
            if (adjustments.flipH) ctx.scale(-1, 1);
            if (adjustments.flipV) ctx.scale(1, -1);

            const b = 1 + adjustments.brightness / 100;
            const c = 1 + adjustments.contrast / 100;
            const s = 1 + adjustments.saturation / 100;
            ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s}) blur(${adjustments.blur}px)`;
            ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
            ctx.restore();

            const result = canvas.toDataURL('image/png');
            setEditedImage(result);
            setImageSize({ w: canvas.width, h: canvas.height });
            setAdjustments({ ...DEFAULT_ADJUSTMENTS });

            // Save to gallery
            const thumbnail = await createThumbnail(result);
            saveImageToGallery(brandName, {
                id: `img-${Date.now()}`,
                data: thumbnail,
                prompt: 'Manual adjustments applied',
                timestamp: Date.now(),
                source: 'edited',
            });
            setGallery(loadImageGallery(brandName));
        } catch (err: any) {
            setError(err.message || 'Failed to apply adjustments');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = async () => {
        const imageUrl = editedImage || originalImage;
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `defia-edit-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSave = () => {
        const img = editedImage || originalImage;
        if (img && onSaveAndUse) onSaveAndUse(img);
    };

    const getDisplayImage = () => editedImage || originalImage;
    const displayImage = getDisplayImage();

    const hasAdjustments = adjustments.brightness !== 0 || adjustments.contrast !== 0 ||
        adjustments.saturation !== 0 || adjustments.blur !== 0 ||
        adjustments.rotation !== 0 || adjustments.flipH || adjustments.flipV;

    // ==================== NO IMAGE — UPLOAD + GALLERY SCREEN ====================
    if (!originalImage) {
        return (
            <div className="flex-1 flex flex-col bg-[#0A0A0B]">
                <div className="flex items-center gap-4 px-8 py-5 border-b border-[#1F1F23]">
                    {onBack && (
                        <button onClick={onBack} className="flex items-center gap-2 text-[#6B6B70] hover:text-white transition-colors text-sm">
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                            Back
                        </button>
                    )}
                    <div className="flex items-center gap-2.5">
                        <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                        <span className="text-base font-semibold text-white">Image Studio</span>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8 overflow-y-auto">
                    {/* Upload Area */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full max-w-[520px] border-2 border-dashed border-[#2E2E2E] rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#FF5C00] transition-all group"
                    >
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                        <div className="w-16 h-16 rounded-2xl bg-[#1F1F23] flex items-center justify-center mb-4 group-hover:bg-[#FF5C0015] transition-colors">
                            <span className="material-symbols-sharp text-3xl text-[#6B6B70] group-hover:text-[#FF5C00] transition-colors" style={{ fontVariationSettings: "'wght' 300" }}>add_photo_alternate</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">Upload an Image</h3>
                        <p className="text-sm text-[#6B6B70]">Click to browse or drag and drop · JPG, PNG, WebP</p>
                    </div>

                    {/* Recent Images Gallery */}
                    {gallery.length > 0 && (
                        <div className="w-full max-w-[720px]">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-sharp text-[#FF5C00] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>history</span>
                                    <span className="text-sm font-semibold text-white">Recent Images</span>
                                    <span className="text-[11px] text-[#4A4A4E]">({gallery.length})</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-5 gap-3">
                                {gallery.map((item) => (
                                    <div
                                        key={item.id}
                                        className="group relative aspect-square rounded-xl overflow-hidden border border-[#1F1F23] cursor-pointer hover:border-[#FF5C00] transition-all hover:shadow-lg hover:shadow-[#FF5C0010]"
                                        onClick={() => selectFromGallery(item)}
                                    >
                                        <img src={item.data} alt="" className="w-full h-full object-cover" />
                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                            <span className="material-symbols-sharp text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontVariationSettings: "'wght' 300" }}>open_in_new</span>
                                        </div>
                                        {/* Source badge */}
                                        <div className="absolute bottom-1.5 left-1.5">
                                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                                item.source === 'generated' ? 'bg-[#8B5CF6] text-white' :
                                                item.source === 'edited' ? 'bg-[#FF5C00] text-white' :
                                                'bg-[#3B82F6] text-white'
                                            }`}>
                                                {item.source === 'generated' ? 'AI' : item.source === 'edited' ? 'Edited' : 'Upload'}
                                            </span>
                                        </div>
                                        {/* Delete on hover */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeFromGallery(brandName, item.id);
                                                setGallery(loadImageGallery(brandName));
                                            }}
                                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#EF4444]"
                                        >
                                            <span className="material-symbols-sharp text-white text-xs" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ==================== MAIN EDITOR ====================
    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#1F1F23] bg-[#111113]">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button onClick={onBack} className="flex items-center gap-2 text-[#6B6B70] hover:text-white transition-colors text-sm">
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                            Back
                        </button>
                    )}
                    <div className="flex items-center gap-2.5">
                        <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                        <span className="text-base font-semibold text-white">Image Studio</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF5C0015] border border-[#FF5C0033]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C00]"></span>
                        <span className="text-[11px] font-medium text-[#FF5C00]">Editing</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={saveToGallery}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#6B6B70] hover:text-white hover:bg-[#1F1F23] transition-colors"
                    >
                        <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>bookmark</span>
                        Save to Gallery
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                    >
                        <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>download</span>
                        Download
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0">
                {/* Left Panel */}
                <div className="w-[380px] flex flex-col border-r border-[#1F1F23] bg-[#111113] min-h-0">
                    {/* Tab Bar */}
                    <div className="flex border-b border-[#1F1F23]">
                        {[
                            { id: 'ai' as EditorTab, icon: 'auto_awesome', label: 'AI Edit' },
                            { id: 'adjust' as EditorTab, icon: 'tune', label: 'Adjust' },
                            { id: 'transform' as EditorTab, icon: 'crop_rotate', label: 'Transform' },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
                                    activeTab === tab.id
                                        ? 'text-[#FF5C00] border-[#FF5C00]'
                                        : 'text-[#6B6B70] border-transparent hover:text-white'
                                }`}
                            >
                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* AI EDIT TAB */}
                        {activeTab === 'ai' && (
                            <>
                                {/* Original Image Thumbnail */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-white">Source</span>
                                        {sourceLabel && <span className="text-[11px] text-[#6B6B70]">{sourceLabel}</span>}
                                    </div>
                                    <div className="rounded-xl overflow-hidden border border-[#1F1F23] bg-[#0A0A0B]">
                                        <img src={originalImage} alt="Original" className="w-full h-auto max-h-[140px] object-contain" />
                                    </div>
                                </div>

                                {/* Edit Prompt */}
                                <div>
                                    <label className="text-sm font-semibold text-white mb-2 block">AI Edit Prompt</label>
                                    <textarea
                                        value={prompt}
                                        onChange={e => setPrompt(e.target.value)}
                                        placeholder={'Describe what you want to change...\n\nExample: "Remove the watermark"'}
                                        className="w-full h-[80px] bg-[#0A0A0B] border border-[#2E2E2E] rounded-xl p-3.5 text-sm text-white placeholder-[#4A4A4E] focus:border-[#FF5C00] focus:outline-none resize-none transition-colors"
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); } }}
                                    />
                                </div>

                                {/* Quick Actions */}
                                <div>
                                    <span className="text-sm font-semibold text-white mb-2 block">Quick Actions</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { icon: 'water_drop', label: 'Remove\nWatermark', prompt: 'Remove the watermark from the image' },
                                            { icon: 'format_clear', label: 'Remove\nText', prompt: 'Remove all text overlays from the image' },
                                            { icon: 'hide_source', label: 'Remove\nObject', prompt: 'Remove the most prominent unwanted object from the image' },
                                            { icon: 'wallpaper', label: 'Change\nBackground', prompt: 'Change the background to a dark gradient' },
                                            { icon: 'auto_fix_high', label: 'Enhance\nQuality', prompt: 'Enhance the image quality, make it sharper and more vibrant' },
                                            { icon: 'palette', label: 'Restyle\nWeb3', prompt: 'Restyle this image with a modern Web3 / crypto aesthetic, dark theme, neon accents' },
                                        ].map((action, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleQuickAction(action.prompt)}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                                                    prompt === action.prompt
                                                        ? 'bg-[#FF5C0010] border-[#FF5C0044] text-[#FF5C00]'
                                                        : 'bg-[#0A0A0B] border-[#1F1F23] text-[#ADADB0] hover:border-[#2E2E2E] hover:text-white'
                                                }`}
                                            >
                                                <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>{action.icon}</span>
                                                <span className="text-[10px] font-medium text-center leading-tight whitespace-pre-line">{action.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Edit History */}
                                {editHistory.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-white">History</span>
                                            <button onClick={() => { setEditHistory([]); setEditedImage(null); }} className="text-[11px] text-[#6B6B70] hover:text-[#FF5C00] transition-colors">Clear</button>
                                        </div>
                                        <div className="space-y-1.5">
                                            {editHistory.slice(0, 5).map(item => (
                                                <div key={item.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0A0A0B] border border-[#1F1F23]">
                                                    <span className="material-symbols-sharp text-[#22C55E] text-sm" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check_circle</span>
                                                    <span className="text-[11px] text-[#ADADB0] flex-1 truncate">{item.prompt}</span>
                                                    <button onClick={() => handleUndo(item)} className="text-[10px] text-[#FF5C00] hover:text-[#FF6B1A] transition-colors font-medium flex-shrink-0">Undo</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ADJUST TAB */}
                        {activeTab === 'adjust' && (
                            <>
                                {[
                                    { key: 'brightness' as const, label: 'Brightness', icon: 'brightness_6', min: -100, max: 100 },
                                    { key: 'contrast' as const, label: 'Contrast', icon: 'contrast', min: -100, max: 100 },
                                    { key: 'saturation' as const, label: 'Saturation', icon: 'water_drop', min: -100, max: 100 },
                                    { key: 'blur' as const, label: 'Blur', icon: 'blur_on', min: 0, max: 20 },
                                ].map(slider => (
                                    <div key={slider.key}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-sharp text-[#FF5C00] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>{slider.icon}</span>
                                                <span className="text-sm font-medium text-white">{slider.label}</span>
                                            </div>
                                            <span className="text-xs font-mono text-[#6B6B70] min-w-[36px] text-right">{adjustments[slider.key]}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={slider.min}
                                            max={slider.max}
                                            value={adjustments[slider.key]}
                                            onChange={(e) => setAdjustments(prev => ({ ...prev, [slider.key]: Number(e.target.value) }))}
                                            className="w-full h-1.5 bg-[#1F1F23] rounded-full appearance-none cursor-pointer accent-[#FF5C00]"
                                            style={{ accentColor: '#FF5C00' }}
                                        />
                                    </div>
                                ))}

                                <button
                                    onClick={() => setAdjustments({ ...DEFAULT_ADJUSTMENTS })}
                                    className="w-full py-2 rounded-lg text-xs font-medium text-[#6B6B70] hover:text-white border border-[#1F1F23] hover:border-[#2E2E2E] transition-colors"
                                >
                                    Reset Adjustments
                                </button>
                            </>
                        )}

                        {/* TRANSFORM TAB */}
                        {activeTab === 'transform' && (
                            <>
                                <div>
                                    <span className="text-sm font-semibold text-white mb-3 block">Rotate</span>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[0, 90, 180, 270].map(deg => (
                                            <button
                                                key={deg}
                                                onClick={() => setAdjustments(prev => ({ ...prev, rotation: deg }))}
                                                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                                                    adjustments.rotation === deg
                                                        ? 'bg-[#FF5C0010] border-[#FF5C0044] text-[#FF5C00]'
                                                        : 'bg-[#0A0A0B] border-[#1F1F23] text-[#ADADB0] hover:border-[#2E2E2E] hover:text-white'
                                                }`}
                                            >
                                                <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300", transform: `rotate(${deg}deg)` }}>crop_rotate</span>
                                                <span className="text-[10px] font-medium">{deg}°</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-sm font-semibold text-white mb-3 block">Flip</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setAdjustments(prev => ({ ...prev, flipH: !prev.flipH }))}
                                            className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                                adjustments.flipH
                                                    ? 'bg-[#FF5C0010] border-[#FF5C0044] text-[#FF5C00]'
                                                    : 'bg-[#0A0A0B] border-[#1F1F23] text-[#ADADB0] hover:border-[#2E2E2E] hover:text-white'
                                            }`}
                                        >
                                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>flip</span>
                                            <span className="text-xs font-medium">Horizontal</span>
                                        </button>
                                        <button
                                            onClick={() => setAdjustments(prev => ({ ...prev, flipV: !prev.flipV }))}
                                            className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                                adjustments.flipV
                                                    ? 'bg-[#FF5C0010] border-[#FF5C0044] text-[#FF5C00]'
                                                    : 'bg-[#0A0A0B] border-[#1F1F23] text-[#ADADB0] hover:border-[#2E2E2E] hover:text-white'
                                            }`}
                                        >
                                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300", transform: 'rotate(90deg)' }}>flip</span>
                                            <span className="text-xs font-medium">Vertical</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setAdjustments(prev => ({ ...prev, rotation: 0, flipH: false, flipV: false }))}
                                    className="w-full py-2 rounded-lg text-xs font-medium text-[#6B6B70] hover:text-white border border-[#1F1F23] hover:border-[#2E2E2E] transition-colors"
                                >
                                    Reset Transform
                                </button>
                            </>
                        )}
                    </div>

                    {/* Left Footer */}
                    <div className="p-4 border-t border-[#1F1F23] flex items-center gap-2">
                        <button onClick={handleResetToOriginal} className="text-xs text-[#6B6B70] hover:text-white transition-colors px-2 py-2">
                            Reset All
                        </button>
                        {activeTab === 'ai' ? (
                            <button
                                onClick={handleEdit}
                                disabled={!prompt.trim() || isProcessing}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                                    isProcessing ? 'bg-[#1F1F23] text-[#6B6B70] cursor-wait'
                                    : !prompt.trim() ? 'bg-[#1F1F23] text-[#4A4A4E] cursor-not-allowed'
                                    : 'text-white hover:opacity-90'
                                }`}
                                style={!isProcessing && prompt.trim() ? { background: 'linear-gradient(135deg, #FF5C00, #FF8A4C)' } : undefined}
                            >
                                {isProcessing ? (
                                    <><div className="w-4 h-4 border-2 border-[#6B6B70] border-t-transparent rounded-full animate-spin" /> Processing...</>
                                ) : (
                                    <><span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>auto_awesome</span> Apply AI Edit</>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={handleApplyAdjustments}
                                disabled={!hasAdjustments || isProcessing}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                                    !hasAdjustments || isProcessing ? 'bg-[#1F1F23] text-[#4A4A4E] cursor-not-allowed' : 'text-white hover:opacity-90'
                                }`}
                                style={hasAdjustments && !isProcessing ? { background: 'linear-gradient(135deg, #FF5C00, #FF8A4C)' } : undefined}
                            >
                                {isProcessing ? (
                                    <><div className="w-4 h-4 border-2 border-[#6B6B70] border-t-transparent rounded-full animate-spin" /> Applying...</>
                                ) : (
                                    <><span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>check</span> Apply Changes</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Panel — Preview */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#0A0A0B]">
                    <div className="flex-1 flex items-center justify-center p-8 overflow-auto" style={{ background: 'repeating-conic-gradient(#111113 0% 25%, #0A0A0B 0% 50%) 50% / 24px 24px' }}>
                        {isProcessing && activeTab === 'ai' ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 border-3 border-[#FF5C00] border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm text-[#6B6B70]">AI is editing your image...</p>
                            </div>
                        ) : displayImage ? (
                            <img
                                src={displayImage}
                                alt="Preview"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                style={{
                                    transform: getTransformString(),
                                    filter: getFilterString(),
                                    transition: 'transform 0.3s ease, filter 0.2s ease',
                                }}
                            />
                        ) : (
                            <div className="text-center">
                                <span className="material-symbols-sharp text-5xl text-[#1F1F23] mb-4" style={{ fontVariationSettings: "'wght' 200" }}>image</span>
                                <p className="text-sm text-[#6B6B70]">No image loaded</p>
                            </div>
                        )}
                    </div>

                    {/* Bottom Bar */}
                    <div className="flex items-center justify-between px-6 py-3 border-t border-[#1F1F23] bg-[#111113]">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setZoom(z => Math.max(25, z - 25))} className="w-7 h-7 rounded-md bg-[#1F1F23] border border-[#2E2E2E] flex items-center justify-center text-[#6B6B70] hover:text-white transition-colors text-sm">−</button>
                                <span className="text-xs text-[#ADADB0] font-mono min-w-[40px] text-center">{zoom}%</span>
                                <button onClick={() => setZoom(z => Math.min(200, z + 25))} className="w-7 h-7 rounded-md bg-[#1F1F23] border border-[#2E2E2E] flex items-center justify-center text-[#6B6B70] hover:text-white transition-colors text-sm">+</button>
                            </div>
                            {imageSize.w > 0 && <span className="text-xs text-[#6B6B70] font-mono">{imageSize.w} × {imageSize.h}px</span>}
                            {hasAdjustments && <span className="text-[10px] text-[#FF5C00] font-medium px-2 py-0.5 bg-[#FF5C0010] rounded-full">Unsaved adjustments</span>}
                        </div>

                        {onSaveAndUse && (
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                                style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>check</span>
                                Save & Use Image
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Toast */}
            {error && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-[#EF444415] border border-[#EF444433] shadow-2xl">
                    <span className="text-sm">⚠️</span>
                    <span className="text-sm text-[#EF4444]">{error}</span>
                    <button onClick={() => setError(null)} className="text-[#EF4444] hover:text-white text-sm ml-2">✕</button>
                </div>
            )}

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};
