
import React, { useState, useEffect } from 'react';
import { getSupabase } from '../services/supabaseClient';
import { Button } from './Button';

interface MemoryItem {
    id: string;
    content: string;
    created_at: string;
    metrics: {
        likes: number;
        retweets: number;
        media_urls?: string[];
    };
}

interface BrainMemoryProps {
    brandName: string;
    onClose: () => void;
}

export const BrainMemory: React.FC<BrainMemoryProps> = ({ brandName, onClose }) => {
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchMemory();
    }, [brandName]);

    const fetchMemory = async () => {
        setIsLoading(true);
        const supabase = getSupabase();
        if (!supabase) return;

        const { data } = await supabase
            .from('brand_memory')
            .select('*')
            .eq('brand_id', brandName)
            .order('created_at', { ascending: false })
            .limit(50);

        if (data) setMemories(data);
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* HEAD */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            🧠 Memory Bank: Past Content
                        </h2>
                        <p className="text-xs text-gray-500">The AI "remembers" these high-performing posts to maintain consistency.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {isLoading && <p className="text-center py-10 text-gray-400">Retrieving memories...</p>}

                    {!isLoading && memories.length === 0 && (
                        <div className="text-center py-20">
                            <p className="text-gray-400 mb-2">No memories found.</p>
                            <p className="text-xs text-gray-500">Run the backfill script to populate this.</p>
                        </div>
                    )}

                    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                        {memories.map(item => (
                            <div key={item.id} className="break-inside-avoid bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                {/* IMAGE */}
                                {item.metrics.media_urls && item.metrics.media_urls.length > 0 && (
                                    <div className="w-full aspect-square relative bg-gray-100">
                                        <img
                                            src={item.metrics.media_urls[0]}
                                            alt="Memory Content"
                                            className="w-full h-full object-cover"
                                        />
                                        {item.metrics.media_urls.length > 1 && (
                                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                +{item.metrics.media_urls.length - 1}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="p-4">
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3 leading-relaxed">
                                        {item.content}
                                    </p>

                                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-rose-500 font-bold flex items-center gap-1">
                                                ♥ {item.metrics.likes}
                                            </span>
                                            <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                                                ⟳ {item.metrics.retweets}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
