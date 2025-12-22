
import React, { useState, useEffect } from 'react';
import { StrategyTask, CalendarEvent, TrendItem, BrandConfig, GrowthReport } from '../types';
import { generateStrategicAnalysis, generateTweet, generateWeb3Graphic } from '../services/gemini';
import { fetchMarketPulse } from '../services/pulse';
import { fetchMentions } from '../services/analytics';
import { runMarketScan } from '../services/ingestion';
import { searchContext, buildContextBlock } from '../services/rag';
import { Button } from './Button';

interface StrategyBrainProps {
    brandName: string;
    brandConfig: BrandConfig;
    events: CalendarEvent[];
    onSchedule: (content: string, image?: string) => void;
    growthReport?: GrowthReport | null;
}

export const StrategyBrain: React.FC<StrategyBrainProps> = ({ brandName, brandConfig, events, onSchedule, growthReport }) => {
    const [tasks, setTasks] = useState<StrategyTask[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState<string | null>(null); // ID of task being executed
    const [hasAnalyzed, setHasAnalyzed] = useState(false);
    const [ragEvents, setRagEvents] = useState<any[]>([]); // New: Store retrieved context for UI

    const performAudit = async () => {
        setIsLoading(true);
        setRagEvents([]); // Reset
        try {
            // 1. Ingest/Refresh Memory (Live Scan)
            await runMarketScan(brandName);

            // 2. Fetch fresh trends & mentions internally
            const [trends, mentions] = await Promise.all([
                fetchMarketPulse(brandName),
                fetchMentions(brandName)
            ]);

            // 3. RAG Retrieval
            const ragHits = await searchContext(`Market state and trends for ${brandName}`, 5);
            setRagEvents(ragHits); // Update UI
            const ragContext = buildContextBlock(ragHits);

            console.log("RAG Context Injected:", ragContext);

            // 4. Generate Analysis with Memory
            const generatedTasks = await generateStrategicAnalysis(
                brandName,
                events,
                trends,
                brandConfig,
                growthReport, // NOW PASSED
                mentions,
                ragContext
            );
            setTasks(generatedTasks);
            setHasAnalyzed(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Auto-run audit on first load if not done
        if (!hasAnalyzed) {
            performAudit();
        }
    }, [brandName]);

    const handleExecuteTask = async (task: StrategyTask) => {
        setIsExecuting(task.id);
        try {
            // 1. Generate Copy
            const copy = await generateTweet(task.executionPrompt, brandName, brandConfig, 'Professional');

            // 2. Generate Visual (Contextual) - Only if not a simple Reply
            let image;
            if (task.type !== 'REPLY') {
                const visualPrompt = `Editorial graphic for ${brandName}. Context: ${task.title}. Style: Professional, clean, on-brand.`;
                image = await generateWeb3Graphic({
                    prompt: visualPrompt,
                    size: '1K',
                    aspectRatio: '16:9',
                    brandConfig: brandConfig,
                    brandName: brandName
                });
            }

            // 3. Open Schedule Modal with results
            onSchedule(copy, image);

            // 4. Remove task from list (optional, or mark done)
            setTasks(prev => prev.filter(t => t.id !== task.id));

        } catch (e) {
            console.error("Execution failed", e);
            alert("Failed to execute task. Please try again.");
        } finally {
            setIsExecuting(null);
        }
    };

    const handleDismiss = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn pb-10">
            {/* Header / System Status */}
            <div className="bg-white p-8 rounded-xl border border-brand-border shadow-sm flex flex-col md:flex-row justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Strategy Hub</h2>
                    <p className="text-gray-600 text-sm max-w-xl">
                        {isLoading ? "Scanning decentralized networks, ingesting new vectors, and ensuring long-term memory sync..." : "System analysis complete. The following strategic actions are proposed for your review."}
                    </p>
                </div>
                <Button onClick={performAudit} disabled={isLoading} variant="secondary" className="mt-4 md:mt-0 text-xs h-9">
                    {isLoading ? 'Scanning...' : 'Refresh Analysis'}
                </Button>
                <Button onClick={performAudit} disabled={isLoading} variant="secondary" className="mt-4 md:mt-0 text-xs h-9">
                    {isLoading ? 'Scanning...' : 'Refresh Analysis'}
                </Button>
            </div>

            {/* BRAIN DEBUGGER: Visualization of RAG Memory */}
            {ragEvents.length > 0 && (
                <div className="bg-blue-50/50 p-6 rounded-lg border border-blue-100 mb-8 overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded">Active Memory</span>
                        <span className="text-xs text-blue-400">Context retrieved from Vector Store</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ragEvents.map((event, i) => (
                            <div key={i} className="bg-white p-3 rounded border border-blue-100 text-xs text-gray-600 shadow-sm flex flex-col gap-1">
                                <div className="flex justify-between">
                                    <span className="font-bold text-blue-800">{event.source}</span>
                                    <span className="text-gray-400">Similarity: {(event.similarity * 100).toFixed(1)}%</span>
                                </div>
                                <p className="line-clamp-2">{event.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Task Agenda */}
            <div>
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recommended Actions</h3>
                    <span className="text-xs text-gray-400">{tasks.length} Pending</span>
                </div>

                <div className="space-y-4">
                    {isLoading && tasks.length === 0 && (
                        <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-sm font-medium">Analyzing market data...</p>
                        </div>
                    )}

                    {!isLoading && tasks.length === 0 && (
                        <div className="p-12 text-center text-gray-400 bg-white rounded-lg border border-gray-200">
                            <p className="text-lg text-gray-900 mb-2 font-medium">All Caught Up</p>
                            <p className="text-sm">No critical gaps or trends detected requiring immediate action.</p>
                            <Button onClick={performAudit} className="mt-4" variant="secondary">Run Deep Scan</Button>
                        </div>
                    )}

                    {tasks.map((task, idx) => (
                        <div key={task.id} className="bg-white group rounded-lg border border-gray-200 p-6 flex flex-col md:flex-row gap-6 hover:border-gray-300 hover:shadow-lg transition-all relative">

                            {/* Dismiss Button (Hover only) */}
                            <button
                                onClick={() => handleDismiss(task.id)}
                                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Disapprove/Dismiss"
                            >
                                ✕
                            </button>

                            {/* Priority Column */}
                            <div className="w-full md:w-16 shrink-0 flex flex-col items-center justify-center border-r border-gray-100 pr-6">
                                <span className="text-4xl font-serif font-bold text-gray-200 group-hover:text-gray-900 transition-colors">0{idx + 1}</span>
                            </div>

                            {/* Content Column */}
                            <div className="flex-1 pt-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${task.type === 'REPLY' ? 'bg-pink-50 text-pink-800 border-pink-200' :
                                        task.type === 'REACTION' ? 'bg-red-50 text-red-800 border-red-200' :
                                            task.type === 'EVERGREEN' ? 'bg-green-50 text-green-800 border-green-200' :
                                                'bg-blue-50 text-blue-800 border-blue-200'
                                        }`}>
                                        {task.type}
                                    </span>
                                    {task.impactScore >= 8 && <span className="text-[10px] font-bold text-red-600 flex items-center gap-1">★ High Priority</span>}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1 font-serif">{task.title}</h3>
                                <p className="text-sm text-gray-600 mb-3">{task.description}</p>

                                <div className="flex gap-2 text-xs text-gray-400 bg-gray-50 p-2 rounded inline-block border border-gray-100">
                                    <span className="font-bold">Rationale:</span> {task.reasoning}
                                </div>
                            </div>

                            {/* Action Column */}
                            <div className="w-full md:w-40 shrink-0 flex items-center justify-center pl-4 border-l border-gray-100">
                                <Button
                                    onClick={() => handleExecuteTask(task)}
                                    disabled={isExecuting !== null}
                                    isLoading={isExecuting === task.id}
                                    className="w-full text-xs h-10 bg-gray-900 text-white hover:bg-black"
                                >
                                    {isExecuting === task.id ? 'Drafting...' : 'Approve Draft'}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
