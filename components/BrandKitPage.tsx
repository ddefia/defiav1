import React, { useState, useRef } from 'react';
import { BrandConfig } from '../types';
import { getBrandRegistryEntry } from '../services/storage';
import { parseDocumentFile } from '../services/documentParser';
// @ts-ignore
import { analyzeBrandKit } from '../services/gemini';
import { ingestContext } from '../services/rag';
import { checkCountLimit } from '../services/subscription';
import { UsageLimitModal } from './UsageLimitModal';
import { useToast } from './Toast';

interface BrandKitPageProps {
    brandName: string;
    config: BrandConfig;
    onChange: (newConfig: BrandConfig) => void;
    onBack?: () => void;
    onNavigate?: (section: string, params?: any) => void;
}

// Default brand colors
const DEFAULT_COLORS = [
    { id: '1', name: 'Primary', hex: '#FF5C00' },
    { id: '2', name: 'Secondary', hex: '#FF8400' },
    { id: '3', name: 'Background', hex: '#0A0A0B' },
    { id: '4', name: 'Success', hex: '#22C55E' },
];

interface AudienceItem {
    id: string;
    title: string;
    description: string;
}

interface CompetitorItem {
    id: string;
    name: string;
    notes: string;
}

export const BrandKitPage: React.FC<BrandKitPageProps> = ({ brandName, config, onChange, onBack, onNavigate }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [limitModal, setLimitModal] = useState<{ current: number; max: number; limitType?: 'knowledgeBase' | 'trial_expired' } | null>(null);
    const { showToast } = useToast();
    const [isUploadingKB, setIsUploadingKB] = useState(false);
    const [isAnalyzingKit, setIsAnalyzingKit] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const kbFileInputRef = useRef<HTMLInputElement>(null);
    const kitFileInputRef = useRef<HTMLInputElement>(null);

    // ━━━ Editable State ━━━

    const [toneGuidelines, setToneGuidelines] = useState(config.toneGuidelines || '');
    const [voiceGuidelines, setVoiceGuidelines] = useState(config.voiceGuidelines || '');

    // Tweet examples (the "gold standard" the AI mimics)
    const [tweetExamples, setTweetExamples] = useState<string[]>(config.tweetExamples || []);
    const [showAddExample, setShowAddExample] = useState(false);
    const [newExample, setNewExample] = useState('');

    // Banned phrases
    const [bannedPhrases, setBannedPhrases] = useState<string[]>(config.bannedPhrases || []);
    const [showAddBanned, setShowAddBanned] = useState(false);
    const [newBannedPhrase, setNewBannedPhrase] = useState('');

    // Competitors - editable list, starts empty (from config or [])
    const [competitors, setCompetitors] = useState<CompetitorItem[]>(() => {
        if ((config as any).competitors && Array.isArray((config as any).competitors)) {
            return (config as any).competitors;
        }
        return [];
    });

    // Target Audience - editable list, starts empty (from config or [])
    const [audiences, setAudiences] = useState<AudienceItem[]>(() => {
        if ((config as any).audiences && Array.isArray((config as any).audiences)) {
            return (config as any).audiences;
        }
        return [];
    });

    // Inline add forms
    const [showAddCompetitor, setShowAddCompetitor] = useState(false);
    const [newCompetitorName, setNewCompetitorName] = useState('');
    const [newCompetitorNotes, setNewCompetitorNotes] = useState('');
    const [showAddAudience, setShowAddAudience] = useState(false);
    const [newAudienceTitle, setNewAudienceTitle] = useState('');
    const [newAudienceDesc, setNewAudienceDesc] = useState('');

    // Get values from config or use defaults
    const brandColors = config.colors?.length > 0 ? config.colors : DEFAULT_COLORS;

    const handleSave = async () => {
        setIsSaving(true);
        onChange({
            ...config,
            toneGuidelines,
            voiceGuidelines,
            tweetExamples,
            bannedPhrases,
            competitors: competitors as any,
            audiences: audiences as any,
        });
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsSaving(false);
        showToast('Brand kit saved', 'success');
    };

    // ━━━ Tweet Example Helpers ━━━

    const addTweetExample = () => {
        const trimmed = newExample.trim();
        if (!trimmed) return;
        setTweetExamples(prev => [...prev, trimmed]);
        setNewExample('');
        setShowAddExample(false);
    };

    const removeTweetExample = (index: number) => {
        setTweetExamples(prev => prev.filter((_, i) => i !== index));
    };

    // ━━━ Banned Phrase Helpers ━━━

    const addBannedPhrase = () => {
        const trimmed = newBannedPhrase.trim();
        if (!trimmed) return;
        setBannedPhrases(prev => [...prev, trimmed]);
        setNewBannedPhrase('');
        setShowAddBanned(false);
    };

    const removeBannedPhrase = (index: number) => {
        setBannedPhrases(prev => prev.filter((_, i) => i !== index));
    };

    const handleKBUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Enforce knowledge base document limit
        const kbCheck = checkCountLimit(config.subscription, 'maxKnowledgeDocs', (config.knowledgeBase || []).length);
        if (!kbCheck.allowed) {
            setLimitModal({ current: kbCheck.current, max: kbCheck.max, limitType: kbCheck.trialExpired ? 'trial_expired' : 'knowledgeBase' });
            if (kbFileInputRef.current) kbFileInputRef.current.value = '';
            return;
        }

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
            showToast('Failed to parse uploaded file', 'error');
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
            showToast('Brand kit analysis failed', 'error');
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

    const addCompetitor = () => {
        if (!newCompetitorName.trim()) return;
        setCompetitors(prev => [...prev, {
            id: Date.now().toString(),
            name: newCompetitorName.trim(),
            notes: newCompetitorNotes.trim()
        }]);
        setNewCompetitorName('');
        setNewCompetitorNotes('');
        setShowAddCompetitor(false);
    };

    const removeCompetitor = (id: string) => {
        setCompetitors(prev => prev.filter(c => c.id !== id));
    };

    const addAudience = () => {
        if (!newAudienceTitle.trim()) return;
        setAudiences(prev => [...prev, {
            id: Date.now().toString(),
            title: newAudienceTitle.trim(),
            description: newAudienceDesc.trim()
        }]);
        setNewAudienceTitle('');
        setNewAudienceDesc('');
        setShowAddAudience(false);
    };

    const removeAudience = (id: string) => {
        setAudiences(prev => prev.filter(a => a.id !== id));
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
                    {/* Company Information - Just Brand Name */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>apartment</span>
                            <span className="text-white text-base font-semibold">Company Information</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-white text-[13px] font-medium">Brand Name</label>
                            <input
                                type="text"
                                value={brandName}
                                readOnly
                                className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white outline-none"
                            />
                        </div>
                    </div>

                    {/* ━━━ Content Style Examples (Tweet Examples) ━━━ */}
                    <div
                        className="rounded-[14px] p-6 border border-[#8B5CF644]"
                        style={{ background: 'linear-gradient(180deg, #111113 0%, #13111A 100%)' }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#8B5CF6] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>edit_note</span>
                                <span className="text-[#8B5CF6] text-base font-semibold">Content Style Examples</span>
                            </div>
                            <span className="px-2.5 py-1 bg-[#8B5CF622] rounded-full text-[#8B5CF6] text-[11px] font-medium">AI Mimics These</span>
                        </div>

                        <p className="text-[#9A9A9A] text-[13px] mb-5">
                            These are the "gold standard" posts the AI uses to match your voice, pacing, length, and style. Add your best-performing tweets or posts here.
                        </p>

                        {tweetExamples.length > 0 && (
                            <div className="flex flex-col gap-2.5 mb-5 max-h-[400px] overflow-y-auto">
                                {tweetExamples.map((example, i) => (
                                    <div key={i} className="p-3.5 bg-[#1A1A1D] rounded-lg group relative">
                                        <p className="text-[#C5C5C7] text-[13px] leading-relaxed whitespace-pre-wrap pr-8">{example}</p>
                                        <button
                                            onClick={() => removeTweetExample(i)}
                                            className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[#EF444422] text-[#6B6B70] hover:text-[#EF4444] transition-all"
                                        >
                                            <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {tweetExamples.length === 0 && !showAddExample && (
                            <div className="flex flex-col items-center justify-center py-8 text-center mb-4">
                                <span className="material-symbols-sharp text-[#2E2E2E] text-4xl mb-3" style={{ fontVariationSettings: "'wght' 300" }}>edit_note</span>
                                <p className="text-[#6B6B70] text-sm">No style examples yet</p>
                                <p className="text-[#4A4A4A] text-xs mt-1">Add tweets that represent your ideal style — the AI will mimic them</p>
                            </div>
                        )}

                        {showAddExample ? (
                            <div className="p-4 bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg flex flex-col gap-3">
                                <textarea
                                    placeholder="Paste a tweet or post that represents your ideal style..."
                                    value={newExample}
                                    onChange={(e) => setNewExample(e.target.value)}
                                    rows={4}
                                    className="bg-[#111113] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-[13px] text-white outline-none focus:border-[#8B5CF6] transition-colors resize-none"
                                    autoFocus
                                />
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => { setShowAddExample(false); setNewExample(''); }}
                                        className="px-3 py-1.5 text-[#6B6B70] text-xs hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={addTweetExample}
                                        disabled={!newExample.trim()}
                                        className="px-4 py-1.5 bg-[#8B5CF6] rounded-md text-white text-xs font-medium disabled:opacity-40 hover:bg-[#7C3AED] transition-colors"
                                    >
                                        Add Example
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAddExample(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-[#8B5CF666] rounded-lg text-[#8B5CF6] text-sm font-medium hover:bg-[#8B5CF611] transition-colors"
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                Add Style Example
                            </button>
                        )}
                    </div>

                    {/* Company Knowledge Base */}
                    <div
                        className="rounded-[14px] p-6 border border-[#FF5C0044]"
                        style={{ background: 'linear-gradient(180deg, #111113 0%, #1A120D 100%)' }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>menu_book</span>
                                <span className="text-[#FF5C00] text-base font-semibold">Knowledge Base</span>
                            </div>
                            <span className="px-2.5 py-1 bg-[#FF5C0022] rounded-full text-[#FF5C00] text-[11px] font-medium">AI Training Data</span>
                        </div>

                        <p className="text-[#9A9A9A] text-[13px] mb-5">
                            Upload documents, whitepapers, brand guides, and any content that helps the AI understand your brand. This is the core of your AI's knowledge.
                        </p>

                        {/* Uploaded Knowledge Base Documents */}
                        {config.knowledgeBase && config.knowledgeBase.length > 0 && (
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-white text-[13px] font-medium">Documents ({config.knowledgeBase.length})</span>
                                </div>
                                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                                    {config.knowledgeBase.map((doc, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-[#1A1A1D] rounded-lg group">
                                            <div className="w-8 h-8 rounded-lg bg-[#FF5C0022] flex items-center justify-center flex-shrink-0">
                                                <span className="material-symbols-sharp text-[#FF5C00] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>
                                                    {doc.startsWith('[INDEXED DOCUMENT]') ? 'cloud_done' : 'description'}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-xs font-medium truncate">
                                                    {doc.startsWith('[INDEXED DOCUMENT]')
                                                        ? doc.replace('[INDEXED DOCUMENT]: ', '').replace(' (Searchable by AI)', '')
                                                        : `Document ${i + 1}`
                                                    }
                                                </p>
                                                <p className="text-[#6B6B70] text-[10px]">
                                                    {doc.startsWith('[INDEXED DOCUMENT]')
                                                        ? 'Indexed in AI Memory'
                                                        : `${(doc.length / 1024).toFixed(1)} KB`
                                                    }
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newKB = config.knowledgeBase?.filter((_, idx) => idx !== i) || [];
                                                    onChange({ ...config, knowledgeBase: newKB });
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-[#EF444422] text-[#6B6B70] hover:text-[#EF4444] transition-all"
                                            >
                                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Upload Button */}
                        <div className={config.knowledgeBase && config.knowledgeBase.length > 0 ? "pt-5 border-t border-[#2E2E2E]" : ""}>
                            <button
                                onClick={() => kbFileInputRef.current?.click()}
                                disabled={isUploadingKB}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-[#FF5C0066] rounded-lg text-[#FF5C00] text-sm font-medium hover:bg-[#FF5C0011] transition-colors"
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>
                                    {isUploadingKB ? 'hourglass_empty' : 'upload_file'}
                                </span>
                                {isUploadingKB ? 'Processing...' : 'Upload Document (PDF, TXT, MD)'}
                            </button>
                            <input
                                ref={kbFileInputRef}
                                type="file"
                                accept=".pdf,.txt,.md,.doc,.docx"
                                onChange={handleKBUpload}
                                className="hidden"
                            />
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

                    {/* Target Audience - Editable, starts empty */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>group</span>
                                <span className="text-white text-base font-semibold">Target Audience</span>
                            </div>
                            <button
                                onClick={() => setShowAddAudience(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2E2E2E] rounded-md text-[#6B6B70] text-xs hover:text-white hover:border-[#3E3E3E] transition-colors"
                            >
                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                Add
                            </button>
                        </div>

                        {audiences.length === 0 && !showAddAudience && (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <span className="material-symbols-sharp text-[#2E2E2E] text-4xl mb-3" style={{ fontVariationSettings: "'wght' 300" }}>group</span>
                                <p className="text-[#6B6B70] text-sm">No target audiences defined yet</p>
                                <p className="text-[#4A4A4A] text-xs mt-1">Add your target audience segments to help the AI tailor content</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            {audiences.map(audience => (
                                <div key={audience.id} className="flex gap-3 p-4 bg-[#1A1A1D] rounded-[10px] group">
                                    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-[#FF5C0022]">
                                        <span className="material-symbols-sharp text-xl text-[#FF5C00]" style={{ fontVariationSettings: "'wght' 300" }}>person</span>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <span className="text-white text-sm font-semibold">{audience.title}</span>
                                        {audience.description && (
                                            <span className="text-[#9A9A9A] text-xs leading-relaxed">{audience.description}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removeAudience(audience.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-[#EF444422] text-[#6B6B70] hover:text-[#EF4444] transition-all self-start"
                                    >
                                        <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                    </button>
                                </div>
                            ))}

                            {/* Inline Add Form */}
                            {showAddAudience && (
                                <div className="p-4 bg-[#1A1A1D] border border-[#2E2E2E] rounded-[10px] flex flex-col gap-3">
                                    <input
                                        type="text"
                                        placeholder="Audience segment (e.g. DeFi Protocol Founders)"
                                        value={newAudienceTitle}
                                        onChange={(e) => setNewAudienceTitle(e.target.value)}
                                        className="bg-[#111113] border border-[#2E2E2E] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF5C00] transition-colors"
                                        autoFocus
                                    />
                                    <textarea
                                        placeholder="Description (optional)"
                                        value={newAudienceDesc}
                                        onChange={(e) => setNewAudienceDesc(e.target.value)}
                                        rows={2}
                                        className="bg-[#111113] border border-[#2E2E2E] rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF5C00] transition-colors resize-none"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => { setShowAddAudience(false); setNewAudienceTitle(''); setNewAudienceDesc(''); }}
                                            className="px-3 py-1.5 text-[#6B6B70] text-xs hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={addAudience}
                                            disabled={!newAudienceTitle.trim()}
                                            className="px-4 py-1.5 bg-[#FF5C00] rounded-md text-white text-xs font-medium disabled:opacity-40 hover:bg-[#FF6A1A] transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}
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

                    {/* ━━━ Brand Voice & Tone (Now Editable) ━━━ */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center gap-2.5 mb-5">
                            <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>mic</span>
                            <span className="text-white text-base font-semibold">Brand Voice & Tone</span>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-white text-[13px] font-medium">Voice Guidelines</label>
                                <p className="text-[#6B6B70] text-[11px] -mt-1">How should the AI sound? This controls the personality of all generated content.</p>
                                <textarea
                                    rows={4}
                                    placeholder="e.g. Narrative Authority: Insightful, grounded, and high-signal. Speak to mechanics, not just features. Be authoritative but approachable..."
                                    className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-[13px] text-white outline-none focus:border-[#FF5C00] transition-colors resize-none"
                                    value={voiceGuidelines}
                                    onChange={(e) => setVoiceGuidelines(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-white text-[13px] font-medium">Additional Tone Notes</label>
                                <textarea
                                    rows={2}
                                    placeholder="Any extra tone guidance (e.g. 'casual in DMs, formal in announcements')..."
                                    className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-[13px] text-white outline-none focus:border-[#FF5C00] transition-colors resize-none"
                                    value={toneGuidelines}
                                    onChange={(e) => setToneGuidelines(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ━━━ Banned Phrases ━━━ */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#EF4444] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>block</span>
                                <span className="text-white text-base font-semibold">Banned Phrases</span>
                            </div>
                            <button
                                onClick={() => setShowAddBanned(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2E2E2E] rounded-md text-[#6B6B70] text-xs hover:text-white hover:border-[#3E3E3E] transition-colors"
                            >
                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                Add
                            </button>
                        </div>

                        <p className="text-[#6B6B70] text-[11px] mb-4">Words or phrases the AI will never use in generated content.</p>

                        {bannedPhrases.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {bannedPhrases.map((phrase, i) => (
                                    <span
                                        key={i}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#EF444415] border border-[#EF444433] rounded-lg text-[#EF4444] text-xs group cursor-default"
                                    >
                                        {phrase}
                                        <button
                                            onClick={() => removeBannedPhrase(i)}
                                            className="opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                                        >
                                            <span className="material-symbols-sharp text-xs" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        ) : !showAddBanned ? (
                            <div className="flex flex-col items-center justify-center py-4 text-center mb-2">
                                <p className="text-[#4A4A4A] text-xs">No banned phrases — defaults: "Delve", "Tapestry", "Game changer", "Unleash"</p>
                            </div>
                        ) : null}

                        {showAddBanned && (
                            <div className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    placeholder="e.g. Revolutionary"
                                    value={newBannedPhrase}
                                    onChange={(e) => setNewBannedPhrase(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') addBannedPhrase(); }}
                                    className="flex-1 bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#EF4444] transition-colors"
                                    autoFocus
                                />
                                <button
                                    onClick={addBannedPhrase}
                                    disabled={!newBannedPhrase.trim()}
                                    className="px-3 py-2 bg-[#EF4444] rounded-lg text-white text-xs font-medium disabled:opacity-40 hover:bg-[#DC2626] transition-colors"
                                >
                                    Add
                                </button>
                                <button
                                    onClick={() => { setShowAddBanned(false); setNewBannedPhrase(''); }}
                                    className="px-2 py-2 text-[#6B6B70] text-xs hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
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

                        <div className="grid grid-cols-3 gap-3 mb-4 max-h-72 overflow-y-auto">
                            {config.referenceImages.map(img => (
                                <div key={img.id} className="aspect-square rounded-lg bg-[#1A1A1D] border border-[#2E2E2E] overflow-hidden relative group">
                                    <img src={img.data || img.url} alt={img.name} className="w-full h-full object-cover" />
                                    {img.category && (
                                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                                            {img.category}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            onChange({
                                                ...config,
                                                referenceImages: config.referenceImages.filter(r => r.id !== img.id)
                                            });
                                        }}
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-black/70 hover:bg-red-600 flex items-center justify-center transition-all"
                                    >
                                        <span className="material-symbols-sharp text-white text-sm" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                    </button>
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

                    {/* Competitors - Editable, starts empty */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>target</span>
                                <span className="text-white text-base font-semibold">Competitors</span>
                            </div>
                            <button
                                onClick={() => setShowAddCompetitor(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2E2E2E] rounded-md text-[#6B6B70] text-xs hover:text-white hover:border-[#3E3E3E] transition-colors"
                            >
                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                Add
                            </button>
                        </div>

                        {competitors.length === 0 && !showAddCompetitor && (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <span className="material-symbols-sharp text-[#2E2E2E] text-3xl mb-2" style={{ fontVariationSettings: "'wght' 300" }}>target</span>
                                <p className="text-[#6B6B70] text-xs">No competitors added yet</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            {competitors.map(comp => (
                                <div key={comp.id} className="flex items-center justify-between px-3.5 py-2.5 bg-[#1A1A1D] rounded-lg group">
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <div className="w-2 h-2 rounded-full bg-[#F59E0B] flex-shrink-0"></div>
                                        <span className="text-white text-[13px] truncate">{comp.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {comp.notes && (
                                            <span className="text-[#6B6B70] text-[11px] truncate max-w-[120px]">{comp.notes}</span>
                                        )}
                                        <button
                                            onClick={() => removeCompetitor(comp.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[#EF444422] text-[#6B6B70] hover:text-[#EF4444] transition-all"
                                        >
                                            <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Inline Add Form */}
                            {showAddCompetitor && (
                                <div className="p-3 bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg flex flex-col gap-2.5">
                                    <input
                                        type="text"
                                        placeholder="Competitor name"
                                        value={newCompetitorName}
                                        onChange={(e) => setNewCompetitorName(e.target.value)}
                                        className="bg-[#111113] border border-[#2E2E2E] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5C00] transition-colors"
                                        autoFocus
                                    />
                                    <input
                                        type="text"
                                        placeholder="Notes (optional, e.g. 'Analytics only')"
                                        value={newCompetitorNotes}
                                        onChange={(e) => setNewCompetitorNotes(e.target.value)}
                                        className="bg-[#111113] border border-[#2E2E2E] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF5C00] transition-colors"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => { setShowAddCompetitor(false); setNewCompetitorName(''); setNewCompetitorNotes(''); }}
                                            className="px-3 py-1.5 text-[#6B6B70] text-xs hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={addCompetitor}
                                            disabled={!newCompetitorName.trim()}
                                            className="px-4 py-1.5 bg-[#FF5C00] rounded-md text-white text-xs font-medium disabled:opacity-40 hover:bg-[#FF6A1A] transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Usage Limit Modal */}
            {limitModal && (
                <UsageLimitModal
                    isOpen={true}
                    limitType={limitModal.limitType || 'knowledgeBase'}
                    current={limitModal.current}
                    max={limitModal.max}
                    currentPlan={config.subscription?.plan || 'starter'}
                    onUpgrade={() => {
                        setLimitModal(null);
                        onNavigate?.('settings', { tab: 'billing' });
                    }}
                    onDismiss={() => setLimitModal(null)}
                />
            )}
        </div>
    );
};
