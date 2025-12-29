
import React, { useState, useEffect } from 'react';
import { StrategyTask, CalendarEvent, TrendItem, BrandConfig, GrowthReport } from '../types';
import { generateStrategicAnalysis, generateTweet, generateWeb3Graphic } from '../services/gemini';
import { fetchMarketPulse } from '../services/pulse';
import { fetchMentions } from '../services/analytics';
import { runMarketScan } from '../services/ingestion';
import { searchContext, buildContextBlock, logDecision } from '../services/rag';
import { Button } from './Button';

interface StrategyBrainProps {
    brandName: string;
    brandConfig: BrandConfig;
    tasks: StrategyTask[];
    onUpdateTasks: (tasks: StrategyTask[]) => void;
    events: CalendarEvent[];
    onSchedule: (content: string, image?: string) => void;
    growthReport?: GrowthReport | null; // Keep optional
}

export const StrategyBrain: React.FC<StrategyBrainProps> = ({
    brandName,
    brandConfig,
    tasks,
    onUpdateTasks,
    events,
    onSchedule,
    growthReport
}) => {
    // const [tasks, setTasks] = useState<StrategyTask[]>([]); // LIFTED UP
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState<string | null>(null); // ID of task being executed
    // const [hasAnalyzed, setHasAnalyzed] = useState(false); // Controlled by parent or effect
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
            const ragHits = await searchContext(`Market trends, strategy context, and past decisions for ${brandName}`, 5);
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
            onUpdateTasks(generatedTasks);
            // setHasAnalyzed(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-run logic moved to parent or kept here for first load check?
    // For now, let's keep it manual or triggered by parent if needed.
    // If we want auto-run on mount if empty:
    // Auto-run logic: Ensure strategy is always "live"
    useEffect(() => {
        if (tasks.length === 0 && !isLoading) {
            console.log("Auto-Strategy: Initializing live scan...");
            performAudit();
        }
    }, [brandName]); // Only run on brand switch if empty.


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

            // 4. Log Decision to Long-Term Memory
            await logDecision(`Executed Task: ${task.title} (${task.type})`, task.reasoning);

            // 5. Remove task from list (optional, or mark done)
            const remaining = tasks.filter(t => t.id !== task.id);
            onUpdateTasks(remaining);

        } catch (e) {
            console.error("Execution failed", e);
            alert("Failed to execute task. Please try again.");
        } finally {
            setIsExecuting(null);
        }
    };

    const handleDismiss = (id: string) => {
        const remaining = tasks.filter(t => t.id !== id);
        onUpdateTasks(remaining);
    }

    return (
        <div className="w-full space-y-6 animate-fadeIn pb-4">

            {/* Control Bar (Replaces System Status Card) */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-brand-surface px-6 py-4 rounded-xl border border-brand-border shadow-sm">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    <p className="text-sm font-medium text-brand-text">
                        {isLoading ? "AI Analyst is scanning decentralized networks..." : "System analysis complete."}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={performAudit} disabled={isLoading} variant="secondary" className="h-8 text-xs bg-white hover:bg-gray-50 border-brand-border shadow-sm">
                        {isLoading ? 'Scanning...' : 'Refresh Strategy'}
                    </Button>
                </div>
            </div>

            {/* BRAIN DEBUGGER: Visualization of RAG Memory */}
            {ragEvents.length > 0 && (
                <div className="bg-blue-50/20 p-4 rounded-xl border border-blue-100/50 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Active Context</span>
                        <div className="h-px bg-blue-100 flex-1"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ragEvents.map((event, i) => (
                            <div key={i} className="bg-white p-3 rounded-lg border border-blue-100 text-xs text-brand-textSecondary shadow-sm">
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold text-blue-700">{event.source}</span>
                                    <span className="text-brand-muted">{(event.similarity * 100).toFixed(0)}% Match</span>
                                </div>
                                <p className="line-clamp-1">{event.content}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Task Agenda */}
            <div>
                {/* HEADER */}
                <div className="flex items-center justify-between mb-6 px-1">
                    <div>
                        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest flex items-center gap-2 font-display">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Strategy Monitoring
                        </h3>
                        <span className="text-xs text-brand-textSecondary mt-1 block">{tasks.length} Actionable Items</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {isLoading && tasks.length === 0 && (
                        <div className="p-12 text-center text-brand-muted bg-brand-surfaceHighlight rounded-2xl border border-dashed border-brand-border">
                            <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-sm font-medium">Analyzing market data...</p>
                        </div>
                    )}

                    {!isLoading && tasks.length === 0 && (
                        <div className="p-12 text-center text-brand-muted bg-brand-surface rounded-2xl border border-brand-border shadow-premium">
                            <p className="text-lg text-brand-text mb-2 font-bold font-display">All Caught Up</p>
                            <p className="text-sm text-brand-textSecondary">No critical gaps or trends detected requiring immediate action.</p>
                            <Button onClick={performAudit} className="mt-6" variant="secondary">Run Deep Scan</Button>
                        </div>
                    )}

                    {tasks.map((task, idx) => (
                        <div key={task.id} className="bg-brand-surface group rounded-2xl border border-brand-border p-6 flex flex-col md:flex-row gap-6 shadow-premium hover:shadow-premium-hover hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">

                            {/* Dismiss Button (Hover only) */}
                            <button
                                onClick={() => handleDismiss(task.id)}
                                className="absolute top-4 right-4 text-brand-muted hover:text-brand-error opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title="Disapprove/Dismiss"
                            >
                                ✕
                            </button>

                            {/* Priority Column */}
                            <div className="w-full md:w-16 shrink-0 flex flex-col items-center justify-center border-r border-brand-border pr-6">
                                <span className="text-4xl font-display font-bold text-brand-border group-hover:text-brand-text transition-colors duration-300">0{idx + 1}</span>
                            </div>

                            {/* Content Column */}
                            <div className="flex-1 pt-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${task.type === 'REPLY' ? 'bg-pink-50 text-pink-700 border-pink-100' :
                                        task.type === 'REACTION' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                            task.type === 'EVERGREEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                'bg-indigo-50 text-indigo-700 border-indigo-100'
                                        }`}>
                                        {task.type}
                                    </span>
                                    {task.impactScore >= 8 && <span className="text-[10px] font-bold text-brand-accent flex items-center gap-1">★ High Priority</span>}
                                </div>
                                <h3 className="text-lg font-bold text-brand-text mb-2 font-display">{task.title}</h3>
                                <p className="text-sm text-brand-textSecondary mb-4 leading-relaxed">{task.description}</p>

                                <div className="flex gap-3 text-xs bg-brand-surfaceHighlight p-3 rounded-xl border border-brand-border items-start mt-2">
                                    <div className="mt-0.5 opacity-70" title="Trigger Source">
                                        {task.type === 'TREND_JACK' ? '📉' :
                                            task.type === 'REPLY' ? '💬' :
                                                task.type === 'GAP_FILL' ? '🗓️' : '🧠'}
                                    </div>
                                    <div>
                                        <span className="font-bold text-brand-text block mb-0.5 text-[10px] uppercase tracking-wide">
                                            Triggered by {task.type === 'TREND_JACK' ? 'Market News' :
                                                task.type === 'REPLY' ? 'Community' :
                                                    task.type === 'GAP_FILL' ? 'Schedule Gap' : 'Growth Data'}
                                        </span>
                                        <span className="text-brand-muted leading-snug">{task.reasoning}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Column */}
                            <div className="w-full md:w-40 shrink-0 flex items-center justify-center pl-4 border-l border-brand-border">
                                <Button
                                    onClick={() => handleExecuteTask(task)}
                                    disabled={isExecuting !== null}
                                    isLoading={isExecuting === task.id}
                                    className="w-full text-xs h-10 shadow-md font-bold"
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
