import React, { useState } from 'react';
import { Button } from './Button';
import { analyzeContentNotes } from '../services/gemini';
import { CalendarEvent, BrandConfig } from '../types';

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (events: CalendarEvent[]) => void;
    brandName: string;
}

interface DraftItem {
    id: string;
    content: string;
    date: string;
    selected: boolean;
    type: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImport, brandName }) => {
    const [input, setInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [drafts, setDrafts] = useState<DraftItem[]>([]);
    const [step, setStep] = useState<'input' | 'review'>('input');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAnalyze = async () => {
        if (!input.trim()) return;
        setIsAnalyzing(true);
        setError(null);

        try {
            // Use the existing AI service to parse the notes
            const analysis = await analyzeContentNotes(input, brandName);

            if (analysis && analysis.items) {
                const today = new Date();

                const newDrafts: DraftItem[] = analysis.items.map((item: any, idx: number) => {
                    // Default to starting tomorrow, spaced out by 1 day
                    const d = new Date(today);
                    d.setDate(today.getDate() + 1 + idx);
                    const dateStr = d.toISOString().split('T')[0];

                    return {
                        id: `draft-${Date.now()}-${idx}`,
                        content: item.finalCopy || item.topic || "No content",
                        date: dateStr,
                        selected: true,
                        type: item.type || 'Post'
                    };
                });

                setDrafts(newDrafts);
                setStep('review');
            } else {
                setError("Could not parse content. Try a different format.");
            }
        } catch (e) {
            console.error(e);
            setError("Analysis failed. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleImport = () => {
        const selectedDrafts = drafts.filter(d => d.selected);

        const newEvents: CalendarEvent[] = selectedDrafts.map(d => ({
            id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            date: d.date,
            content: d.content,
            platform: 'Twitter', // Default
            status: 'scheduled',
            campaignName: 'Bulk Import'
        }));

        onImport(newEvents);
        onClose();

        // Reset state
        setStep('input');
        setInput('');
        setDrafts([]);
    };

    const updateDraft = (id: string, field: keyof DraftItem, value: any) => {
        setDrafts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="text-xl">✨</span> Bulk Content Import
                        </h2>
                        <p className="text-sm text-gray-500">Paste raw notes, drafts, or ideas. AI will organize them.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto bg-white">
                    {step === 'input' ? (
                        <div className="space-y-4">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Example:&#10;1. Tweet about Ethereum scaling on Monday.&#10;2. Thread about DeFi yields on Wednesday.&#10;3. Meme about gas fees for Friday."
                                className="w-full h-64 border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none bg-gray-50"
                            />
                            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Found {drafts.length} Items</span>
                                <button onClick={() => setStep('input')} className="text-xs text-purple-600 font-medium hover:underline">Start Over</button>
                            </div>

                            <div className="grid gap-3">
                                {drafts.map((draft) => (
                                    <div key={draft.id} className={`p-4 rounded-xl border transition-all ${draft.selected ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                                        <div className="flex gap-4 items-start">
                                            <div className="pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={draft.selected}
                                                    onChange={(e) => updateDraft(draft.id, 'selected', e.target.checked)}
                                                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-[10px] font-bold uppercase text-gray-500 bg-white px-2 py-1 rounded border border-gray-100">{draft.type}</span>
                                                    <input
                                                        type="date"
                                                        value={draft.date}
                                                        onChange={(e) => updateDraft(draft.id, 'date', e.target.value)}
                                                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:border-purple-500 outline-none"
                                                    />
                                                </div>
                                                <textarea
                                                    value={draft.content}
                                                    onChange={(e) => updateDraft(draft.id, 'content', e.target.value)}
                                                    className="w-full text-sm bg-transparent border-none p-0 focus:ring-0 resize-none text-gray-800 font-medium"
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    {step === 'input' ? (
                        <Button onClick={handleAnalyze} isLoading={isAnalyzing} disabled={!input.trim()}>
                            Analyze & Parse
                        </Button>
                    ) : (
                        <Button onClick={handleImport} disabled={drafts.filter(d => d.selected).length === 0}>
                            Import {drafts.filter(d => d.selected).length} Events
                        </Button>
                    )}
                </div>

            </div>
        </div>
    );
};
