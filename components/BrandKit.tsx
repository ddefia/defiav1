
import React, { useRef, useState, useEffect } from 'react';
import { BrandConfig, BrandColor, ReferenceImage } from '../types';
import { Button } from './Button';
import { getBrandDefault, importHistoryToReferences } from '../services/storage';
// @ts-ignore
import { analyzeBrandKit } from '../services/gemini';
import { parseDocumentFile } from '../services/documentParser';
import * as pdfjsLib from 'pdfjs-dist';
// import { syncHistoryToReferenceImages } from '../services/ingestion';
import { indexEmptyEmbeddings } from '../services/rag';




interface BrandKitProps {
  config: BrandConfig;
  brandName: string;
  onChange: (newConfig: BrandConfig) => void;
}

export const BrandKit: React.FC<BrandKitProps> = ({ config, brandName, onChange }) => {
  // Colors State
  const [newColorHex, setNewColorHex] = useState('#ffffff');
  const [newColorName, setNewColorName] = useState('');

  // KB State
  const [newKBEntry, setNewKBEntry] = useState('');
  const [isAddingKB, setIsAddingKB] = useState(false);
  const [isUploadingKB, setIsUploadingKB] = useState(false);
  const [isAnalyzingKit, setIsAnalyzingKit] = useState(false);
  const kitFileInputRef = useRef<HTMLInputElement>(null);


  // Template State
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState(''); // New State
  const [newTemplateImageIds, setNewTemplateImageIds] = useState<string[]>([]); // Changed to Array
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Sync State
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);

  // Example State
  const [newExample, setNewExample] = useState('');
  const [isAddingExample, setIsAddingExample] = useState(false);

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Image Editing State
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editImageName, setEditImageName] = useState('');
  const [editImageCategory, setEditImageCategory] = useState('');
  const [linkingImageId, setLinkingImageId] = useState<string | null>(null); // New: For Link Modal

  // Quick Create Template State (Inside Link Modal)
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);
  const [quickTmplName, setQuickTmplName] = useState('');
  const [quickTmplPrompt, setQuickTmplPrompt] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const kbFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize PDF worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Explicitly set worker source for the browser
      // Handle potential export structure differences (ESM vs CJS default)
      // @ts-ignore
      const lib = (pdfjsLib as any).default || pdfjsLib;
      if (lib && lib.GlobalWorkerOptions) {
        // Use unpkg for the worker to ensure we get the classic script format compatible with standard Workers
        // The ESM version from esm.sh often fails with importScripts in the worker context
        lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
      }
    }
  }, []);

  // --- Colors ---
  const addColor = () => {
    if (!newColorName || !newColorHex) return;
    onChange({
      ...config,
      colors: [...config.colors, { id: Date.now().toString(), name: newColorName, hex: newColorHex }]
    });
    setNewColorName('');
  };

  const removeColor = (id: string) => {
    onChange({ ...config, colors: config.colors.filter(c => c.id !== id) });
  };

  // --- KB ---
  const addKB = () => {
    if (!newKBEntry.trim()) return;
    onChange({
      ...config,
      knowledgeBase: [...(config.knowledgeBase || []), newKBEntry]
    });
    setNewKBEntry('');
    setIsAddingKB(false);
  };

  const removeKB = (idx: number) => {
    const newKB = [...(config.knowledgeBase || [])];
    newKB.splice(idx, 1);
    onChange({ ...config, knowledgeBase: newKB });
  };

  // --- Templates ---
  const addTemplate = () => {
    if (!newTemplateName.trim() || !newTemplatePrompt.trim()) return;

    if (editingTemplateId) {
      // Update existing
      onChange({
        ...config,
        graphicTemplates: (config.graphicTemplates || []).map(t =>
          t.id === editingTemplateId
            ? { ...t, label: newTemplateName, prompt: newTemplatePrompt, category: newTemplateCategory, referenceImageIds: newTemplateImageIds }
            : t
        )
      });
      setEditingTemplateId(null);
    } else {
      // Create new
      const newTmpl = {
        id: `tmpl-${Date.now()}`,
        label: newTemplateName,
        prompt: newTemplatePrompt,
        category: newTemplateCategory,
        referenceImageIds: newTemplateImageIds
      };
      onChange({
        ...config,
        graphicTemplates: [...(config.graphicTemplates || []), newTmpl]
      });
    }

    setNewTemplateName('');
    setNewTemplatePrompt('');
    setNewTemplateCategory('');
    setNewTemplateImageIds([]);
    setIsAddingTemplate(false);
  };

  const startEditingTemplate = (t: { id: string, label: string, prompt: string, category?: string, referenceImageIds?: string[] }) => {
    setNewTemplateName(t.label);
    setNewTemplatePrompt(t.prompt);
    setNewTemplateCategory(t.category || '');
    setNewTemplateImageIds(t.referenceImageIds || []);
    setEditingTemplateId(t.id);
    setIsAddingTemplate(true);
  };

  const removeTemplate = (id: string) => {
    if (editingTemplateId === id) {
      setEditingTemplateId(null);
      setIsAddingTemplate(false);
      setNewTemplateName('');
      setNewTemplatePrompt('');
    }
    onChange({
      ...config,
      graphicTemplates: (config.graphicTemplates || []).filter(t => t.id !== id)
    });
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

  const handleKBUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingKB(true);
    const file = files[0];

    try {
      const { parseDocumentFile } = await import('../services/documentParser');
      const text = await parseDocumentFile(file);

      if (text) {
        if (text.length > 50000) {
          if (!window.confirm("This document contains a lot of text (>50k chars). It may use up your storage. Continue?")) {
            return;
          }
        }
        onChange({
          ...config,
          knowledgeBase: [...(config.knowledgeBase || []), text]
        });
      }
    } catch (err: any) {
      console.error("Failed to parse file", err);
      alert(err.message || "Failed to read document.");
    } finally {
      setIsUploadingKB(false);
      if (kbFileInputRef.current) kbFileInputRef.current.value = '';
    }
  };


  // --- Examples ---
  const addExample = () => {
    if (!newExample.trim()) return;
    onChange({
      ...config,
      tweetExamples: [...(config.tweetExamples || []), newExample]
    });
    setNewExample('');
    setIsAddingExample(false);
  };

  const removeExample = (idx: number) => {
    const newEx = [...(config.tweetExamples || [])];
    newEx.splice(idx, 1);
    onChange({ ...config, tweetExamples: newEx });
  };

  // --- Images ---
  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // Resize to reasonable max width
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Compress to JPEG at 0.7 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleSyncHistory = async () => {
    setIsSyncingHistory(true);
    try {
      // 1. Sync Images (Simple URL Import)
      await importHistoryToReferences(brandName);

      // 2. Sync AI Embeddings (Background Backfill)
      // We run a few batches silently to catch up on history
      console.log(`[Auto-Sync] Backfilling AI Memory...`);
      let indexed = 0;
      for (let i = 0; i < 3; i++) {
        indexed += await indexEmptyEmbeddings(brandName);
      }

      alert(`Sync Complete! \n- Imported Images\n- Indexed ${indexed} items for AI Memory.`);

    } catch (e) {
      console.error(e);
      alert("Failed to sync history.");
    } finally {
      setIsSyncingHistory(false);
    }
  };

  const uploadToSupabase = async (file: File, brandId: string): Promise<string | null> => {
    try {
      // @ts-ignore
      const { createClient } = await import('@supabase/supabase-js');
      // @ts-ignore
      const url = (import.meta as any).env.VITE_SUPABASE_URL || "https://fwvqrdxgcugullcwkfiq.supabase.co";
      // @ts-ignore
      const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "sb_publishable_dn_SxJbbX9sIYjCiR9paTw_MRMnokPf";

      const supabase = createClient(url, key);
      const fileExt = file.name.split('.').pop();
      // Sanitize brand name for folder usage
      const cleanBrand = brandId.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${cleanBrand}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('brand-assets')
        .upload(filePath, file);

      if (error) {
        if (error.message.includes("bucket")) alert("Upload failed: 'brand-assets' bucket missing in Supabase. Please create it.");
        return null;
      }

      const { data: { publicUrl } } = supabase.storage.from('brand-assets').getPublicUrl(filePath);
      return publicUrl;
    } catch (e) {
      console.error("Upload process failed", e);
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newImages: ReferenceImage[] = [];

    const isSupabaseEnabled = true;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > 5 * 1024 * 1024) {
        if (!window.confirm(`File ${file.name} is quite large (${(file.size / 1024 / 1024).toFixed(1)}MB). Continue?`)) continue;
      }

      try {
        const compressedBase64 = await compressImage(file);

        let finalUrl = "";
        try {
          const uploadedUrl = await uploadToSupabase(file, brandName);
          if (uploadedUrl) finalUrl = uploadedUrl;
        } catch (err) { console.error("Upload skipped", err); }

        newImages.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          data: finalUrl ? "" : compressedBase64,
          url: finalUrl
        });
      } catch (err) {
        console.error("Processing failed", err);
        alert(`Failed to process ${file.name}`);
      }
    }
    if (newImages.length > 0) {
      onChange({ ...config, referenceImages: [...config.referenceImages, ...newImages] });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange({ ...config, referenceImages: config.referenceImages.filter(img => img.id !== id) });
  };

  const handleRenameImage = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    const newName = window.prompt("Rename Reference Image:", currentName);
    if (newName && newName.trim() !== "") {
      onChange({
        ...config,
        referenceImages: config.referenceImages.map(img =>
          img.id === id ? { ...img, name: newName.trim() } : img
        )
      });
    }
  };

  const handleLinkImage = (e: React.MouseEvent, imgId: string) => {
    e.stopPropagation();
    setLinkingImageId(imgId);
  };

  const toggleImageLink = (tmplId: string, imgId: string) => {
    const tmpl = config.graphicTemplates?.find(t => t.id === tmplId);
    if (!tmpl) return;

    const currentLinks = tmpl.referenceImageIds || [];
    const isLinked = currentLinks.includes(imgId);

    let newLinks: string[];
    if (isLinked) {
      newLinks = currentLinks.filter(id => id !== imgId);
    } else {
      newLinks = [...currentLinks, imgId];
    }

    onChange({
      ...config,
      graphicTemplates: (config.graphicTemplates || []).map(t =>
        t.id === tmplId ? { ...t, referenceImageIds: newLinks } : t
      )
    });
  };

  const createQuickTemplate = () => {
    if (!quickTmplName || !quickTmplPrompt || !linkingImageId) return;

    const newTmpl = {
      id: `tmpl-${Date.now()}`,
      label: quickTmplName,
      prompt: quickTmplPrompt,
      category: 'Quick Create',
      referenceImageIds: [linkingImageId] // Automatically link!
    };

    onChange({
      ...config,
      graphicTemplates: [...(config.graphicTemplates || []), newTmpl]
    });

    // Reset and Close Modal
    setQuickTmplName('');
    setQuickTmplPrompt('');
    setIsCreatingQuick(false);
    setLinkingImageId(null);
  };

  // --- Meta ---
  const handleRestoreDefaults = () => {
    if (window.confirm(`Restore defaults for ${brandName}?`)) {
      const defaults = getBrandDefault(brandName);
      if (defaults) onChange(defaults);
    }
  };

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) { }
  };

  return (
    <div className="space-y-8 pb-10">

      {/* 0. BRAND VOICE & PROTOCOLS (NEW) */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-display font-medium text-brand-text uppercase tracking-wider mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          Brand Voice & Protocols
        </h3>

        <div className="space-y-4">
          {/* Voice Guidelines */}
          <div>
            <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Voice Guidelines</label>
            <textarea
              value={config.voiceGuidelines || ''}
              onChange={(e) => onChange({ ...config, voiceGuidelines: e.target.value })}
              placeholder="e.g. Professional, Authoritative, Institutional. Avoid slang. Use clean, concise language."
              className="w-full h-20 bg-white p-3 text-sm text-brand-text rounded-lg border border-brand-border focus:ring-1 focus:ring-brand-accent focus:border-brand-accent outline-none placeholder:text-gray-300 transition-all"
            />
            <p className="text-[10px] text-gray-400 mt-1">Defines how the AI writes. Defaults to "Professional" if left empty.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Audience */}
            <div>
              <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Target Audience</label>
              <input
                type="text"
                value={config.targetAudience || ''}
                onChange={(e) => onChange({ ...config, targetAudience: e.target.value })}
                placeholder="e.g. Institutional Investors, Pension Funds"
                className="w-full bg-white p-3 text-sm text-brand-text rounded-lg border border-brand-border focus:ring-1 focus:ring-brand-accent focus:border-brand-accent outline-none placeholder:text-gray-300 transition-all"
              />
            </div>

            {/* Banned Phrases (Simple CSV for now) */}
            <div>
              <label className="text-xs font-bold text-brand-muted uppercase mb-1 block">Banned Phrases (Comma Separated)</label>
              <input
                type="text"
                value={(config.bannedPhrases || []).join(', ')}
                onChange={(e) => onChange({ ...config, bannedPhrases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="e.g. Moon, LFG, WAGMI, Pump"
                className="w-full bg-white p-3 text-sm text-brand-text rounded-lg border border-brand-border focus:ring-1 focus:ring-brand-accent focus:border-brand-accent outline-none placeholder:text-gray-300 transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">Words the AI is strictly forbidden from using.</p>
            </div>
          </div>
        </div>
      </div>


      {/* 0.5 VISUAL IDENTITY (NEW) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-display font-medium text-brand-muted uppercase tracking-wider">Visual Identity System</h3>
          <div className="flex gap-2">
            <input
              type="file"
              ref={kitFileInputRef}
              onChange={handleIdentityAnalysis}
              accept=".pdf"
              className="hidden"
            />
            <button
              onClick={() => kitFileInputRef.current?.click()}
              disabled={isAnalyzingKit}
              className="text-xs text-brand-accent hover:text-brand-text border border-brand-accent/30 px-2 py-1 rounded flex items-center gap-1"
            >
              {isAnalyzingKit ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  analyzing...
                </>
              ) : (
                '+ Upload Brand Kit PDF'
              )}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mb-2">Upload your Brand PDF (Max 25 pages) to automatically extract a visual style guide.</p>

        <div className="relative">
          <textarea
            value={config.visualIdentity || ''}
            onChange={(e) => onChange({ ...config, visualIdentity: e.target.value })}
            placeholder="Upload a PDF to generate this guide automatically... or paste your own style rules."
            className="w-full h-40 bg-gray-900 border border-gray-700 text-gray-200 p-3 rounded-lg text-xs font-mono focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
          />
          {!config.visualIdentity && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-600 italic">No visual identity guide active.</span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-brand-border"></div>

      <div>
        <div className="flex items-center justify-between mb-4">

          <h3 className="text-sm font-display font-medium text-brand-muted uppercase tracking-wider">Knowledge Base (Documents)</h3>
          <div className="flex gap-2">
            <input
              type="file"
              ref={kbFileInputRef}
              onChange={handleKBUpload}
              accept=".pdf,.txt,.md,.json"
              className="hidden"
            />
            <button
              onClick={() => kbFileInputRef.current?.click()}
              disabled={isUploadingKB}
              className="text-xs text-brand-muted hover:text-brand-text border border-brand-border px-2 py-1 rounded flex items-center gap-1"
            >
              {isUploadingKB ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              )}
              Upload PDF/Text
            </button>
            <button onClick={() => setIsAddingKB(!isAddingKB)} className="text-xs text-brand-accent hover:text-brand-text border border-brand-accent/30 px-2 py-1 rounded">
              {isAddingKB ? 'Cancel' : '+ Add Text'}
            </button>
          </div>
        </div>
        {isAddingKB && (
          <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-brand-border">
            <textarea
              value={newKBEntry}
              onChange={e => setNewKBEntry(e.target.value)}
              placeholder="Paste whitepaper text, roadmap details, or partnership info..."
              className="w-full h-32 bg-white p-2 text-xs text-brand-text rounded border border-brand-border focus:outline-none focus:border-brand-accent mb-2"
            />
            <Button onClick={addKB} className="text-xs h-8 py-0 px-4">Save Document</Button>
          </div>
        )}
        <div className="space-y-2">
          {(config.knowledgeBase || []).map((doc, idx) => (
            <div key={idx} className="bg-white border border-brand-border rounded-lg p-3 group shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-gray-100 rounded text-gray-500">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-xs text-brand-text font-medium truncate w-[200px]">{doc.split('\n')[0].substring(0, 30)}...</p>
              </div>
              <p className="text-[10px] text-brand-muted line-clamp-2 pl-7">{doc.substring(0, 150)}</p>
              <div className="flex justify-between items-center mt-2 pl-7">
                <span className="text-[10px] text-brand-muted font-mono">{doc.length.toLocaleString()} chars</span>
                <button onClick={() => removeKB(idx)} className="text-[10px] text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">Remove</button>
              </div>
            </div>
          ))}
          {(!config.knowledgeBase || config.knowledgeBase.length === 0) && !isAddingKB && (
            <div className="text-xs text-brand-muted italic bg-gray-50 p-4 rounded text-center border border-dashed border-gray-300">
              No documents added. Upload a PDF or add text to give the AI writer context about your protocol.
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-brand-border"></div>

      {/* 2. STYLE EXAMPLES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-display font-medium text-brand-muted uppercase tracking-wider">Tweet Style Guide</h3>
          <button onClick={() => setIsAddingExample(!isAddingExample)} className="text-xs text-brand-accent hover:text-brand-text border border-brand-accent/30 px-2 py-1 rounded">
            {isAddingExample ? 'Cancel' : '+ Add Example'}
          </button>
        </div>
        {isAddingExample && (
          <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-brand-border">
            <textarea
              value={newExample}
              onChange={e => setNewExample(e.target.value)}
              placeholder="Paste a perfect example tweet here..."
              className="w-full h-20 bg-white p-2 text-xs text-brand-text rounded border border-brand-border focus:outline-none focus:border-brand-accent mb-2"
            />
            <Button onClick={addExample} className="text-xs h-8 py-0 px-4">Save Example</Button>
          </div>
        )}
        <div className="space-y-2">
          {(config.tweetExamples || []).map((ex, idx) => (
            <div key={idx} className="bg-white border border-brand-border rounded-lg p-3 flex justify-between items-start group shadow-sm">
              <p className="text-xs text-brand-text whitespace-pre-wrap">{ex}</p>
              <button onClick={() => removeExample(idx)} className="ml-2 text-[10px] text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
            </div>
          ))}
          {(!config.tweetExamples || config.tweetExamples.length === 0) && !isAddingExample && (
            <div className="text-xs text-brand-muted italic">No examples added. The AI will use generic style.</div>
          )}
        </div>
      </div>

      <div className="border-t border-brand-border"></div>

      {/* 3. GRAPHIC TEMPLATES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-display font-medium text-brand-muted uppercase tracking-wider">Custom Graphic Templates</h3>
          <button onClick={() => {
            setIsAddingTemplate(!isAddingTemplate);
            if (isAddingTemplate) {
              setEditingTemplateId(null);
              setNewTemplateName('');
              setNewTemplatePrompt('');
              setNewTemplateCategory('');
              setNewTemplateImageIds([]);
            }
          }} className="text-xs text-brand-accent hover:text-brand-text border border-brand-accent/30 px-2 py-1 rounded">
            {isAddingTemplate ? 'Cancel' : '+ Add Template'}
          </button>
        </div>
        {isAddingTemplate && (
          <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-brand-border space-y-2">
            <input
              type="text"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              placeholder="Template Name (e.g. My Newsletter)"
              className="w-full bg-white p-2 text-xs text-brand-text rounded border border-brand-border focus:outline-none focus:border-brand-accent"
            />
            <textarea
              value={newTemplatePrompt}
              onChange={e => setNewTemplatePrompt(e.target.value)}
              placeholder="AI Instruction: Describe the layout, composition, and style..."
              className="w-full h-20 bg-white p-2 text-xs text-brand-text rounded border border-brand-border focus:outline-none focus:border-brand-accent"
            />

            {/* Category Support with Suggestions */}
            <div className="relative">
              <input
                type="text"
                list="category-suggestions"
                value={newTemplateCategory}
                onChange={e => setNewTemplateCategory(e.target.value)}
                placeholder="Category (e.g. Giveaway, Campaign - Optional)"
                className="w-full bg-white p-2 text-xs text-brand-text rounded border border-brand-border focus:outline-none focus:border-brand-accent"
              />
              <datalist id="category-suggestions">
                <option value="Giveaway" />
                <option value="Announcement" />
                <option value="Campaign" />
                <option value="Community" />
                <option value="Meme" />
              </datalist>
            </div>

            {/* Image Link Selector (Multi-Select) */}
            <div>
              <label className="text-[10px] font-bold text-brand-muted uppercase mb-1 block">Link Reference Images (Style Anchors)</label>
              <div className="bg-white border border-brand-border rounded p-2 max-h-32 overflow-y-auto space-y-1">
                {config.referenceImages.length === 0 && <span className="text-xs text-brand-muted italic">No images uploaded.</span>}
                {config.referenceImages.map(img => (
                  <label key={img.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={newTemplateImageIds.includes(img.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewTemplateImageIds(prev => [...prev, img.id]);
                        } else {
                          setNewTemplateImageIds(prev => prev.filter(id => id !== img.id));
                        }
                      }}
                      className="rounded border-brand-border text-brand-accent focus:ring-brand-accent h-3 w-3"
                    />
                    <span className="text-xs text-brand-text truncate">{img.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-brand-muted mt-1">Select one or more images to anchor the style.</p>
            </div>

            <Button onClick={addTemplate} className="text-xs h-8 py-0 px-4" disabled={!newTemplateName || !newTemplatePrompt}>
              {editingTemplateId ? 'Save Changes' : 'Save Template'}
            </Button>
          </div>
        )}
        <div className="space-y-2">

          {/* Grouped Display */}
          {(() => {
            const templates = config.graphicTemplates || [];
            if (templates.length === 0 && !isAddingTemplate) {
              return <div className="text-xs text-brand-muted italic">No custom templates. Add one to define reusable styles.</div>;
            }

            // Group By Category
            const grouped: Record<string, typeof templates> = {};
            templates.forEach(t => {
              const cat = t.category || 'Uncategorized';
              if (!grouped[cat]) grouped[cat] = [];
              grouped[cat].push(t);
            });

            return Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-4">
                {category !== 'Uncategorized' && (
                  <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">
                    {category}
                  </div>
                )}

                <div className="space-y-2">
                  {items.map(tmpl => (
                    <div key={tmpl.id} className={`bg-white border rounded-lg p-3 flex justify-between items-start group shadow-sm transition-colors ${editingTemplateId === tmpl.id ? 'border-brand-accent ring-1 ring-brand-accent bg-brand-accent/5' : 'border-brand-border'}`}>
                      <div>
                        <div className="text-xs font-bold text-brand-text mb-1">{tmpl.label}</div>
                        <p className="text-[10px] text-brand-muted line-clamp-2">{tmpl.prompt}</p>
                        {tmpl.category && <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-gray-100 text-[9px] text-gray-500">{tmpl.category}</span>}
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditingTemplate(tmpl)} className="text-[10px] text-brand-accent hover:text-brand-text font-medium">Edit</button>
                        <button onClick={() => removeTemplate(tmpl.id)} className="text-[10px] text-red-500 hover:text-red-600">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
          {(!config.graphicTemplates || config.graphicTemplates.length === 0) && !isAddingTemplate && (
            <div className="text-xs text-brand-muted italic">No custom templates. Add one to define reusable styles.</div>
          )}
        </div>
      </div>

      <div className="border-t border-brand-border"></div>

      {/* 4. COLORS */}
      <div>
        <h3 className="text-sm font-display font-medium text-brand-muted uppercase tracking-wider mb-4">Brand Colors</h3>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {config.colors.map(color => (
            <div key={color.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-brand-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded border border-brand-border" style={{ backgroundColor: color.hex }} />
                <span className="text-xs text-brand-text font-medium">{color.name} <span className="text-brand-muted font-normal ml-1">{color.hex}</span></span>
              </div>
              <button onClick={() => removeColor(color.id)} className="text-brand-muted hover:text-red-500">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} className="w-8 h-8 rounded bg-transparent cursor-pointer border border-brand-border" />
          <input type="text" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} placeholder="Color Name" className="flex-1 bg-white border border-brand-border rounded px-2 text-xs text-brand-text" />
          <Button onClick={addColor} variant="secondary" className="px-3 py-1 text-xs h-8" disabled={!newColorName}>Add</Button>
        </div>
      </div>

      <div className="border-t border-brand-border"></div>

      {/* 5. IMAGES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-display font-medium text-brand-muted uppercase tracking-wider">Reference Images ({config.referenceImages.length})</h3>

          <div className="flex gap-2">
            <button
              onClick={async () => {
                const historyImages = config.referenceImages.filter(img => img.name.startsWith('History:') && !img.name.includes('['));
                if (historyImages.length === 0) {
                  alert("No unclassified history images found.");
                  return;
                }
                if (!confirm(`Classify ${historyImages.length} images? This might take a minute.`)) return;

                // Import dynamically to avoid circular dep issues if any
                const { classifyImage } = await import('../services/gemini');

                // Get categories
                const categories = config.graphicTemplates?.map(t => t.label) || [];
                if (categories.length === 0) categories.push('Tweet', 'Announcement', 'Meme', 'Infographic');

                let updatedCount = 0;
                const newImages = [...config.referenceImages];

                for (const img of historyImages) {
                  // Find index
                  const idx = newImages.findIndex(i => i.id === img.id);
                  if (idx === -1) continue;

                  try {
                    const category = await classifyImage(img.url || "", categories);
                    if (category) {
                      newImages[idx] = {
                        ...newImages[idx],
                        name: `[${category}] ${img.name.replace('History: ', '')}`
                      };
                      updatedCount++;
                    }
                  } catch (e) {
                    console.error("Failed to classify", img.id);
                  }
                }

                onChange({ ...config, referenceImages: newImages });
                alert(`Classified ${updatedCount} images successfully!`);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              Auto-Classify
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-brand-accent hover:text-brand-text border border-brand-accent/30 px-2 py-1 rounded">+ Upload</button>
          </div>
        </div>

        {/* Collapsible Grid */}
        <div className={`grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 transition-all duration-500 overflow-hidden ${!viewingImage && config.referenceImages.length > 15 ? 'max-h-[300px] overflow-y-auto pr-1' : ''}`}>
          {config.referenceImages.slice(0, viewingImage === 'ALL' ? undefined : 15).map(img => (
            <div key={img.id} className="relative aspect-square rounded bg-gray-100 cursor-pointer overflow-hidden border border-brand-border group shadow-sm transition-transform hover:scale-105" onClick={() => setViewingImage(img.data || img.url)}>
              <img src={img.data || img.url} alt={img.name} className="w-full h-full object-cover" loading="lazy" />

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex justify-between items-start">
                  {/* Link Indicator */}
                  <div className="flex gap-1 flex-wrap max-w-[70%]">
                    {(config.graphicTemplates || []).filter(t => t.referenceImageIds?.includes(img.id)).map(t => (
                      <span key={t.id} className="text-[8px] bg-brand-accent text-white px-1.5 py-0.5 rounded shadow-sm truncate max-w-full">
                        {t.label}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1">
                    <button onClick={(e) => handleLinkImage(e, img.id)} className="bg-white text-indigo-600 rounded-full p-1.5 hover:bg-indigo-50 shadow transition-colors" title="Link to Template">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </button>
                    <button onClick={(e) => handleRenameImage(e, img.id, img.name)} className="bg-white text-gray-700 rounded-full p-1.5 hover:bg-gray-100 shadow transition-colors" title="Rename">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={(e) => removeImage(e, img.id)} className="bg-white text-red-500 rounded-full p-1.5 hover:bg-red-50 shadow transition-colors" title="Delete">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="text-[10px] bg-black/60 text-white px-2 py-1 rounded truncate backdrop-blur-sm mt-auto">
                  {img.name}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Link Modal */}
        {linkingImageId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all duration-300" onClick={() => setLinkingImageId(null)}>
            <div className="bg-white rounded-2xl p-6 w-[480px] shadow-2xl border border-white/20 ring-1 ring-black/5 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>

              <div className="mb-4">
                <h3 className="font-display font-semibold text-xl text-gray-900">Link Image to Template</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Select which templates should use this image as a <span className="font-medium text-brand-accent">Strict Style Anchor</span>.
                  The AI will mimic this image's layout and vibe.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-2 scrollbar-hide">
                {/* Create New Toggle */}
                {!isCreatingQuick ? (
                  <button
                    onClick={() => setIsCreatingQuick(true)}
                    className="w-full py-3 px-4 text-sm font-medium text-brand-accent bg-brand-accent/5 border border-brand-accent/20 rounded-xl hover:bg-brand-accent/10 hover:border-brand-accent/40 transition-all flex items-center justify-center gap-2 group"
                  >
                    <div className="bg-brand-accent text-white rounded-full p-0.5 group-hover:scale-110 transition-transform">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                    </div>
                    Create New Template from this Image
                  </button>
                ) : (
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-brand-accent/20 space-y-3 shadow-inner ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Template Name</label>
                      <input
                        value={quickTmplName}
                        onChange={e => setQuickTmplName(e.target.value)}
                        placeholder="e.g. Neon Dark Mode"
                        className="w-full text-sm p-2.5 rounded-lg border border-gray-200 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none transition-all"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1 block">Style Prompt</label>
                      <textarea
                        value={quickTmplPrompt}
                        onChange={e => setQuickTmplPrompt(e.target.value)}
                        placeholder="Describe the style (e.g. Dark background, glassy textures, vibrant accents...)"
                        className="w-full text-sm p-2.5 rounded-lg border border-gray-200 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none transition-all h-20 resize-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button onClick={() => setIsCreatingQuick(false)} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">Cancel</button>
                      <Button onClick={createQuickTemplate} className="text-xs h-8 py-0" disabled={!quickTmplName || !quickTmplPrompt}>Save & Link</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Existing Templates</h4>

                  {(config.graphicTemplates || []).length === 0 && !isCreatingQuick && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                      <p className="text-sm text-gray-400">No templates found.</p>
                    </div>
                  )}

                  {(config.graphicTemplates || []).map(tmpl => {
                    const isLinked = tmpl.referenceImageIds?.includes(linkingImageId);
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => toggleImageLink(tmpl.id, linkingImageId)}
                        className={`
                            relative px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between group
                            ${isLinked
                            ? 'border-brand-accent bg-brand-accent/5 shadow-sm ring-1 ring-brand-accent/20'
                            : 'border-gray-100 hover:border-brand-accent/30 hover:bg-gray-50 hover:shadow-sm'
                          }
                          `}
                      >
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${isLinked ? 'text-brand-accent' : 'text-gray-700 group-hover:text-gray-900'}`}>{tmpl.label}</span>
                          <span className="text-[10px] text-gray-400 line-clamp-1">{tmpl.prompt}</span>
                        </div>

                        <div className={`
                             w-5 h-5 rounded-full flex items-center justify-center border transition-all
                             ${isLinked ? 'bg-brand-accent border-brand-accent text-white scale-100' : 'border-gray-300 text-transparent scale-90 group-hover:scale-100 group-hover:border-brand-accent/50'}
                          `}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-6 mt-2 border-t border-gray-100">
                <Button onClick={() => setLinkingImageId(null)} variant="secondary" className="w-full sm:w-auto">Done</Button>
              </div>
            </div>
          </div>
        )}

        {/* Show More Button */}
        {config.referenceImages.length > 15 && (
          <div className="mt-3 flex justify-center sticky bottom-0 z-10">
            <button
              onClick={() => setViewingImage(viewingImage === 'ALL' ? null : 'ALL')}
              className="text-xs text-brand-muted hover:text-brand-text bg-white border border-brand-border px-4 py-2 rounded-full shadow-sm flex items-center gap-2 transition-all hover:shadow-md"
            >
              {viewingImage === 'ALL' ? (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                  Collapse Gallery
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  Show All {config.referenceImages.length} Images
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-6 border-t border-brand-border space-y-2">
        <Button onClick={handleCopyConfig} variant="secondary" className="w-full text-xs h-8">{copyStatus === 'copied' ? 'Copied JSON!' : 'Copy Config JSON'}</Button>
        <Button onClick={handleRestoreDefaults} variant="outline" className="w-full text-xs h-8 opacity-50 hover:opacity-100">Restore Defaults</Button>
      </div>

      {
        viewingImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setViewingImage(null)}>
            <img src={viewingImage} className="max-w-full max-h-[90vh] rounded" />
          </div>
        )
      }
    </div >
  );
};
