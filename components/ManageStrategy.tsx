
import React, { useState, useEffect } from 'react';
import { getSupabase } from '../services/supabaseClient';
import { Button } from './Button';

interface StrategyDoc {
    id: string;
    category: string;
    title: string;
    content: string;
    created_at: string;
}

interface ManageStrategyProps {
    brandName: string;
    onClose: () => void;
}

export const ManageStrategy: React.FC<ManageStrategyProps> = ({ brandName, onClose }) => {
    const [docs, setDocs] = useState<StrategyDoc[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('Goal');
    const [content, setContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchDocs();
    }, [brandName]);

    const fetchDocs = async () => {
        setIsLoading(true);
        const supabase = getSupabase();
        if (!supabase) return;

        const { data, error } = await supabase
            .from('strategy_docs')
            .select('*')
            .eq('brand_id', brandName)
            .order('created_at', { ascending: false });

        if (data) setDocs(data);
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!title || !content) return;
        setIsSaving(true);
        const supabase = getSupabase();

        if (supabase) {
            const { error } = await supabase
                .from('strategy_docs')
                .insert([{
                    brand_id: brandName,
                    category,
                    title,
                    content
                }]);

            if (!error) {
                setTitle('');
                setContent('');
                fetchDocs();
            } else {
                alert('Failed to save strategy.');
            }
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this strategy doc?')) return;
        const supabase = getSupabase();
        if (supabase) {
            await supabase.from('strategy_docs').delete().eq('id', id);
            fetchDocs();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* HEAD */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            🧠 Brand Brain: Strategy Manager
                        </h2>
                        <p className="text-xs text-gray-500">Define the long-term goals and mandates that guide the AI.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* INPUT FORM */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-4">
                        <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Add New Mandate</h3>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-indigo-800 mb-1">TITLE</label>
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full text-sm p-2 rounded border border-indigo-200 focus:border-indigo-500 outline-none"
                                    placeholder="e.g. Q1 User Growth"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-indigo-800 mb-1">CATEGORY</label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full text-sm p-2 rounded border border-indigo-200 focus:border-indigo-500 outline-none"
                                >
                                    <option>Goal</option>
                                    <option>Slogan</option>
                                    <option>Pillar</option>
                                    <option>Rule</option>
                                    <option>Persona</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-indigo-800 mb-1">CONTENT / INSTRUCTION</label>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                className="w-full text-sm p-2 rounded border border-indigo-200 focus:border-indigo-500 outline-none min-h-[80px]"
                                placeholder="Describe the goal or rule in detail. The AI will read this before generating any content."
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSave} disabled={isSaving || !title}>
                                {isSaving ? 'Saving...' : 'Add to Brain'}
                            </Button>
                        </div>
                    </div>

                    {/* LIST */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Active Mandates ({docs.length})</h3>

                        {isLoading && <p className="text-sm text-gray-400">Loading brain...</p>}

                        {!isLoading && docs.length === 0 && (
                            <div className="text-center p-8 border-2 border-dashed border-gray-100 rounded-xl">
                                <p className="text-gray-400 text-sm">Brain is empty. Add a goal above.</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {docs.map(doc => (
                                <div key={doc.id} className="group bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-200 transition-colors flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">{doc.category}</span>
                                            <span className="text-sm font-bold text-gray-800">{doc.title}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 leading-relaxed">{doc.content}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(doc.id)}
                                        className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
