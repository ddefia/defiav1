
import React, { useRef, useState, useEffect } from 'react';
import { BrandConfig, BrandColor, ReferenceImage } from '../types';
import { Button } from './Button';
import { getBrandDefault } from '../services/storage';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

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

  // Example State
  const [newExample, setNewExample] = useState('');
  const [isAddingExample, setIsAddingExample] = useState(false);

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [viewingImage, setViewingImage] = useState<string | null>(null);

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

  const handleKBUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingKB(true);
    const file = files[0]; // Process one for now

    if (file.size > 1024 * 1024) { // 1MB Limit for PDFs
      alert("File is too large. Please upload documents under 1MB.");
      setIsUploadingKB(false);
      if (kbFileInputRef.current) kbFileInputRef.current.value = '';
      return;
    }

    try {
      let text = "";

      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();

        // Use the resolved lib reference
        // @ts-ignore
        const lib = (pdfjsLib as any).default || pdfjsLib;
        const loadingTask = lib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        let fullText = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText.push(pageText);
        }
        text = `[SOURCE: ${file.name}]\n` + fullText.join('\n\n');
      } else {
        // Assume text/markdown/json
        text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsText(file);
        });
        text = `[SOURCE: ${file.name}]\n` + text;
      }

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
    } catch (err) {
      console.error("Failed to parse file", err);
      alert("Failed to read document. Please ensure it is a valid PDF or Text file.");
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
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newImages: ReferenceImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Reduced to 800KB to prevent rapid storage filling
      if (file.size > 800 * 1024) {
        alert(`Skipped ${file.name}: Image too large. Max 800KB allowed for local storage.`);
        continue;
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newImages.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          data: base64
        });
      } catch (err) { console.error(err); }
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

      {/* 1. KNOWLEDGE BASE */}
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

      {/* 3. COLORS */}
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

      {/* 4. IMAGES */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-display font-medium text-brand-muted uppercase tracking-wider">Reference Images</h3>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-brand-accent hover:text-brand-text border border-brand-accent/30 px-2 py-1 rounded">+ Upload</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {config.referenceImages.map(img => (
            <div key={img.id} className="relative aspect-square rounded bg-gray-100 cursor-pointer overflow-hidden border border-brand-border group shadow-sm" onClick={() => setViewingImage(img.data || img.url)}>
              <img src={img.data || img.url} alt={img.name} className="w-full h-full object-cover" />

              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex justify-end gap-1">
                  <button onClick={(e) => handleRenameImage(e, img.id, img.name)} className="bg-white text-gray-700 rounded-full p-1.5 hover:bg-gray-100 shadow transition-colors" title="Rename">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={(e) => removeImage(e, img.id)} className="bg-white text-red-500 rounded-full p-1.5 hover:bg-red-50 shadow transition-colors" title="Delete">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="text-[10px] bg-black/60 text-white px-2 py-1 rounded truncate backdrop-blur-sm">
                  {img.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-6 border-t border-brand-border space-y-2">
        <Button onClick={handleCopyConfig} variant="secondary" className="w-full text-xs h-8">{copyStatus === 'copied' ? 'Copied JSON!' : 'Copy Config JSON'}</Button>
        <Button onClick={handleRestoreDefaults} variant="outline" className="w-full text-xs h-8 opacity-50 hover:opacity-100">Restore Defaults</Button>
      </div>

      {viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setViewingImage(null)}>
          <img src={viewingImage} className="max-w-full max-h-[90vh] rounded" />
        </div>
      )}
    </div>
  );
};
