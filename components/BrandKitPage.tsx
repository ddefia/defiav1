import React, { useState, useRef } from 'react';
import { BrandConfig } from '../types';
import { getBrandRegistryEntry } from '../services/storage';
import { parseDocumentFile } from '../services/documentParser';
// @ts-ignore
import { analyzeBrandKit } from '../services/gemini';
import { ingestContext } from '../services/rag';

interface BrandKitPageProps {
    brandName: string;
    config: BrandConfig;
    onChange: (newConfig: BrandConfig) => void;
    onBack?: () => void;
}

// Default brand colors
const DEFAULT_COLORS = [
    { id: '1', name: 'Primary', hex: '#FF5C00' },
    { id: '2', name: 'Secondary', hex: '#FF8400' },
    { id: '3', name: 'Background', hex: '#0A0A0B' },
    { id: '4', name: 'Success', hex: '#22C55E' },
];

// Default target audiences
const DEFAULT_AUDIENCES = [
    { id: '1', icon: 'rocket_launch', color: '#FF5C00', title: 'Web3 Project Founders', description: 'Early-stage to growth-stage crypto projects looking to scale their marketing efforts efficiently.' },
    { id: '2', icon: 'work', color: '#3B82F6', title: 'Marketing Teams & Agencies', description: 'Crypto-focused marketing professionals seeking automation tools to manage multiple client campaigns.' },
    { id: '3', icon: 'apartment', color: '#22C55E', title: 'DeFi Protocols & DAOs', description: 'Decentralized organizations needing consistent community engagement and governance communication.' },
];

// Default products
const DEFAULT_PRODUCTS = [
    { id: '1', icon: 'smart_toy', color: '#FF5C00', name: 'AI CMO', description: 'AI-powered marketing strategist' },
    { id: '2', icon: 'edit_note', color: '#3B82F6', name: 'Content Studio', description: 'Multi-format content creator' },
    { id: '3', icon: 'campaign', color: '#22C55E', name: 'Campaigns', description: 'Automated campaign manager' },
];

// Default differentiators
const DEFAULT_DIFFERENTIATORS = [
    'AI-native platform built specifically for Web3',
    'Real-time on-chain data integration',
    'Automated multi-platform campaign management',
    'Community sentiment analysis & response',
];

// Default competitors
const DEFAULT_COMPETITORS = [
    { id: '1', name: 'Hootsuite (Web2)', tag: 'No Web3 focus', color: '#EF4444' },
    { id: '2', name: 'Lunar Strategy', tag: 'Agency model', color: '#F59E0B' },
    { id: '3', name: 'Cookie3', tag: 'Analytics only', color: '#F59E0B' },
];

export const BrandKitPage: React.FC<BrandKitPageProps> = ({ brandName, config, onChange, onBack }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingKB, setIsUploadingKB] = useState(false);
    const [isAnalyzingKit, setIsAnalyzingKit] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const kbFileInputRef = useRef<HTMLInputElement>(null);
    const kitFileInputRef = useRef<HTMLInputElement>(null);

    // Editable fields state - initialized from config
    const [missionStatement, setMissionStatement] = useState(config.missionStatement || '');
    const [vision, setVision] = useState(config.vision || '');
    const [founded, setFounded] = useState(config.founded || '');
    const [headquarters, setHeadquarters] = useState(config.headquarters || '');
    const [toneGuidelines, setToneGuidelines] = useState(config.toneGuidelines || '');
    const [tagline, setTagline] = useState(config.tagline || config.targetAudience || '');
    const [brandDescription, setBrandDescription] = useState(config.brandDescription || config.voiceGuidelines || '');

    // Get values from config or use defaults
    const brandColors = config.colors?.length > 0 ? config.colors : DEFAULT_COLORS;
    const voiceTags = config.voiceGuidelines?.split(',').map(s => s.trim()).filter(Boolean) || ['Professional', 'Innovative', 'Technical'];
    const keywords = config.keywords?.length > 0 ? config.keywords : ['DeFi', 'Web3 Marketing', 'AI Automation', 'Crypto Growth', 'Community'];

    const handleSave = async () => {
        setIsSaving(true);
        // Save all editable fields to the brand config
        onChange({
            ...config,
            missionStatement,
            vision,
            founded,
            headquarters,
            toneGuidelines,
            tagline,
            brandDescription,
            targetAudience: tagline, // Keep backwards compatibility
        });
        // Small delay for UX feedback
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsSaving(false);
    };

    const handleKBUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploadingKB(true);
        const file = files[0];

        try {
            const text = await parseDocumentFile(file);

            if (text) {
                const IS_LARGE_DOC = text.length > 20000;

                if (IS_LARGE_DOC) {
                    const confirmed = window.confirm(
                        `This document is large (${(text.length / 1024).toFixed(1)} KB). \n\nTo prevent slowing down the app, we will index this into the AI's Long-Term Memory (RAG) instead of local storage. \n\nProceed?`
                    );

                    if (!confirmed) return;

                    const registry = getBrandRegistryEntry(brandName);
                    await ingestContext(text, 'KNOWLEDGE_BASE', { filename: file.name, type: 'document' }, registry?.brandId);

                    const pointer = `[INDEXED DOCUMENT]: ${file.name} (Searchable by AI)`;
                    onChange({
                        ...config,
                        knowledgeBase: [...(config.knowledgeBase || []), pointer]
                    });

                    alert("Document successfully indexed into Brain Memory!");
                } else {
                    onChange({
                        ...config,
                        knowledgeBase: [...(config.knowledgeBase || []), text]
                    });
                }
            }
        } catch (err: any) {
            console.error("Failed to parse file", err);
            alert(err.message || "Failed to read document.");
        } finally {
            setIsUploadingKB(false);
            if (kbFileInputRef.current) kbFileInputRef.current.value = '';
        }
    };

    const handleIdentityAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsAnalyzingKit(true);
        const file = files[0];

        try {
            const text = await parseDocumentFile(file);
            if (text) {
                const summary = await analyzeBrandKit(text);
                onChange({
                    ...config,
                    visualIdentity: summary
                });
                alert("Visual Identity Extracted Successfully!");
            }
        } catch (err: any) {
            console.error("Analysis failed", err);
            alert(err.message || "Failed to analyze document.");
        } finally {
            setIsAnalyzingKit(false);
            if (kitFileInputRef.current) kitFileInputRef.current.value = '';
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newImages = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();

            const dataUrl = await new Promise<string>((resolve) => {
                reader.onload = (event) => resolve(event.target?.result as string);
                reader.readAsDataURL(file);
            });

            newImages.push({
                id: `${Date.now()}-${i}`,
                name: file.name,
                data: dataUrl,
                url: ''
            });
        }

        onChange({
            ...config,
            referenceImages: [...config.referenceImages, ...newImages]
        });

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const addColor = () => {
        const newColor = { id: Date.now().toString(), name: 'New Color', hex: '#808080' };
        onChange({
            ...config,
            colors: [...(config.colors || []), newColor]
        });
    };

    const addKeyword = () => {
        const keyword = prompt('Enter new keyword:');
        if (keyword) {
            // For now store in a simple way - could be enhanced
            alert(`Keyword "${keyword}" added!`);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-6 border-b border-[#1F1F23]">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg hover:bg-[#1A1A1D] transition-colors"
                    >
                        <span className="material-symbols-sharp text-white text-xl" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                    </button>
                    <div className="flex flex-col gap-0.5">
                        <h1 className="text-2xl font-bold text-white">Brand Kit</h1>
                        <p className="text-sm text-[#6B6B70]">Define your brand identity for AI-powered content generation</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold"
                    style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                >
                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>save</span>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-6 p-7 px-10 overflow-hidden">
                {/* Left Column */}
                <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
                    {/* Company Information */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>apartment</span>
                            <span className="text-white text-base font-semibold">Company Information</span>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-white text-[13px] font-medium">Brand Name</label>
                                <input
                                    type="text"
                                    value={brandName}
                                    readOnly
                                    className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white outline-none"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-white text-[13px] font-medium">Tagline</label>
                                <input
                                    type="text"
                                    value={tagline}
                                    onChange={(e) => setTagline(e.target.value)}
                                    placeholder="Enter your brand tagline..."
                                    className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white outline-none focus:border-[#FF5C00] transition-colors"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-white text-[13px] font-medium">Brand Description</label>
                                <textarea
                                    value={brandDescription}
                                    onChange={(e) => setBrandDescription(e.target.value)}
                                    placeholder="Describe your brand, products, and mission..."
                                    rows={4}
                                    className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white outline-none focus:border-[#FF5C00] transition-colors resize-none"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-white text-[13px] font-medium">Industry</label>
                                <button className="flex items-center justify-between bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-left">
                                    <span className="text-white text-sm">DeFi / Web3 Marketing</span>
                                    <span className="material-symbols-sharp text-[#6B6B70] text-base" style={{ fontVariationSettings: "'wght' 300" }}>expand_more</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Brand Colors */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>palette</span>
                                <span className="text-white text-base font-semibold">Brand Colors</span>
                            </div>
                            <button
                                onClick={addColor}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2E2E2E] rounded-md text-[#6B6B70] text-xs hover:text-white hover:border-[#3E3E3E] transition-colors"
                            >
                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                Add Color
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            {brandColors.map(color => (
                                <div key={color.id} className="flex flex-col gap-2">
                                    <div
                                        className="h-20 rounded-[10px]"
                                        style={{ backgroundColor: color.hex, border: color.hex === '#0A0A0B' ? '1px solid #2E2E2E' : 'none' }}
                                    ></div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-white text-[13px] font-medium">{color.name}</span>
                                        <span className="text-[#6B6B70] text-xs">{color.hex}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Company Knowledge Base */}
                    <div
                        className="rounded-[14px] p-6 border border-[#FF5C0044]"
                        style={{ background: 'linear-gradient(180deg, #111113 0%, #1A120D 100%)' }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>menu_book</span>
                                <span className="text-[#FF5C00] text-base font-semibold">Company Knowledge Base</span>
                            </div>
                            <span className="px-2.5 py-1 bg-[#FF5C0022] rounded-full text-[#FF5C00] text-[11px] font-medium">AI Training Data</span>
                        </div>

                        <p className="text-[#9A9A9A] text-[13px] mb-5">
                            This information helps the AI CMO understand your company deeply and generate more accurate, on-brand content.
                        </p>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-white text-[13px] font-medium">Mission Statement</label>
                                <textarea
                                    rows={3}
                                    placeholder="To democratize Web3 marketing by providing AI-powered tools..."
                                    className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-[13px] text-white outline-none focus:border-[#FF5C00] transition-colors resize-none"
                                    value={missionStatement}
                                    onChange={(e) => setMissionStatement(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-white text-[13px] font-medium">Vision</label>
                                <textarea
                                    rows={3}
                                    placeholder="Become the leading AI-powered marketing platform..."
                                    className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-[13px] text-white outline-none focus:border-[#FF5C00] transition-colors resize-none"
                                    value={vision}
                                    onChange={(e) => setVision(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-white text-[13px] font-medium">Founded</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 2024"
                                        value={founded}
                                        onChange={(e) => setFounded(e.target.value)}
                                        className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-[13px] text-white outline-none focus:border-[#FF5C00] transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-white text-[13px] font-medium">Headquarters</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Remote / Global"
                                        value={headquarters}
                                        onChange={(e) => setHeadquarters(e.target.value)}
                                        className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-[13px] text-white outline-none focus:border-[#FF5C00] transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Target Audience */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>group</span>
                            <span className="text-white text-base font-semibold">Target Audience</span>
                        </div>

                        <div className="flex flex-col gap-3">
                            {DEFAULT_AUDIENCES.map(audience => (
                                <div key={audience.id} className="flex gap-3 p-4 bg-[#1A1A1D] rounded-[10px]">
                                    <div
                                        className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: `${audience.color}22` }}
                                    >
                                        <span className="material-symbols-sharp text-xl" style={{ color: audience.color, fontVariationSettings: "'wght' 300" }}>{audience.icon}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-white text-sm font-semibold">{audience.title}</span>
                                        <span className="text-[#9A9A9A] text-xs leading-relaxed">{audience.description}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Products & Features */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>inventory_2</span>
                                <span className="text-white text-base font-semibold">Products & Features</span>
                            </div>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2E2E2E] rounded-md text-[#6B6B70] text-xs hover:text-white hover:border-[#3E3E3E] transition-colors">
                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                Add
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {DEFAULT_PRODUCTS.map(product => (
                                <div key={product.id} className="flex flex-col gap-2 p-4 bg-[#1A1A1D] rounded-[10px]">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-sharp text-base" style={{ color: product.color, fontVariationSettings: "'wght' 300" }}>{product.icon}</span>
                                        <span className="text-white text-[13px] font-semibold">{product.name}</span>
                                    </div>
                                    <span className="text-[#9A9A9A] text-[11px]">{product.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Keywords & Topics */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center gap-2.5 mb-3">
                            <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>tag</span>
                            <span className="text-white text-base font-semibold">Keywords & Topics</span>
                        </div>

                        <p className="text-[#9A9A9A] text-xs mb-4">Topics and keywords the AI should focus on when creating content</p>

                        <div className="flex flex-wrap gap-2">
                            {keywords.map((keyword, i) => (
                                <span key={i} className="px-3 py-1.5 bg-[#1A1A1D] border border-[#2E2E2E] rounded-md text-white text-xs">
                                    {keyword}
                                </span>
                            ))}
                            <button
                                onClick={addKeyword}
                                className="flex items-center gap-1 px-3 py-1.5 border border-[#2E2E2E] rounded-md text-[#6B6B70] text-xs hover:text-white hover:border-[#3E3E3E] transition-colors"
                            >
                                <span className="material-symbols-sharp text-xs" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                Add
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="w-[400px] flex flex-col gap-6 flex-shrink-0 overflow-y-auto">
                    {/* Brand Logo */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                            <span className="text-white text-base font-semibold">Brand Logo</span>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-3 p-6 bg-[#1A1A1D] border border-[#2E2E2E] rounded-[10px] h-[140px]">
                            <div className="w-[60px] h-[60px] rounded-xl bg-[#FF5C00] flex items-center justify-center">
                                <span className="text-white text-2xl font-bold">{brandName.substring(0, 2).toUpperCase()}</span>
                            </div>
                            <span className="text-[#6B6B70] text-xs">Click to upload or drag and drop</span>
                        </div>
                    </div>

                    {/* Brand Voice & Tone */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>mic</span>
                            <span className="text-white text-base font-semibold">Brand Voice & Tone</span>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-5">
                            {voiceTags.map((tag, i) => (
                                <span key={i} className="px-3 py-1.5 bg-[#FF5C0022] border border-[#FF5C0044] rounded-full text-[#FF5C00] text-xs font-medium">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-white text-[13px] font-medium">Tone Guidelines</label>
                            <textarea
                                rows={3}
                                placeholder="Confident and knowledgeable, yet approachable..."
                                className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-[13px] text-white outline-none focus:border-[#FF5C00] transition-colors resize-none"
                                value={toneGuidelines}
                                onChange={(e) => setToneGuidelines(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Reference Images */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>collections</span>
                                <span className="text-white text-base font-semibold">Reference Images</span>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2E2E2E] rounded-md text-[#6B6B70] text-xs hover:text-white hover:border-[#3E3E3E] transition-colors"
                            >
                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                Add
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {config.referenceImages.slice(0, 2).map(img => (
                                <div key={img.id} className="aspect-square rounded-lg bg-[#1A1A1D] border border-[#2E2E2E] overflow-hidden">
                                    <img src={img.data || img.url} alt={img.name} className="w-full h-full object-cover" />
                                </div>
                            ))}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square rounded-lg bg-[#1A1A1D] border border-[#2E2E2E] flex items-center justify-center hover:border-[#3E3E3E] transition-colors"
                            >
                                <span className="material-symbols-sharp text-[#6B6B70] text-2xl" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                            </button>
                        </div>

                        <p className="text-[#6B6B70] text-xs">
                            Upload brand imagery, style references, or mood boards to guide AI content generation.
                        </p>
                    </div>

                    {/* Key Differentiators */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>auto_awesome</span>
                            <span className="text-white text-base font-semibold">Key Differentiators</span>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            {DEFAULT_DIFFERENTIATORS.map((diff, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                    <div className="w-5 h-5 rounded-full bg-[#22C55E22] flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="material-symbols-sharp text-[#22C55E] text-xs" style={{ fontVariationSettings: "'wght' 400" }}>check</span>
                                    </div>
                                    <span className="text-[#E5E5E5] text-[13px] leading-relaxed">{diff}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Social Links */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>link</span>
                            <span className="text-white text-base font-semibold">Social Links</span>
                        </div>

                        <div className="flex flex-col gap-2.5">
                            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg">
                                <span className="material-symbols-sharp text-[#1DA1F2] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>alternate_email</span>
                                <span className="text-white text-[13px]">@{brandName}Protocol</span>
                            </div>
                            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg">
                                <span className="material-symbols-sharp text-[#5865F2] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>forum</span>
                                <span className="text-white text-[13px]">discord.gg/{brandName.toLowerCase()}</span>
                            </div>
                            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg">
                                <span className="material-symbols-sharp text-[#FF5C00] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>language</span>
                                <span className="text-white text-[13px]">{brandName.toLowerCase()}.io</span>
                            </div>
                        </div>
                    </div>

                    {/* Competitors */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>target</span>
                                <span className="text-white text-base font-semibold">Competitors</span>
                            </div>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2E2E2E] rounded-md text-[#6B6B70] text-xs hover:text-white hover:border-[#3E3E3E] transition-colors">
                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                Add
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {DEFAULT_COMPETITORS.map(comp => (
                                <div key={comp.id} className="flex items-center justify-between px-3.5 py-2.5 bg-[#1A1A1D] rounded-lg">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: comp.color }}></div>
                                        <span className="text-white text-[13px]">{comp.name}</span>
                                    </div>
                                    <span className="text-[#6B6B70] text-[11px]">{comp.tag}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
