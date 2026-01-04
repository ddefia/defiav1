
import React, { useState, useEffect } from 'react';
import { StrategyTask, CalendarEvent, TrendItem, BrandConfig, GrowthReport, BrainLog } from '../types';
import { generateStrategicAnalysis, generateTweet, generateWeb3Graphic } from '../services/gemini';
import { fetchMarketPulse } from '../services/pulse';
import { fetchMentions } from '../services/analytics';
import { runMarketScan } from '../services/ingestion';
import { searchContext, buildContextBlock, logDecision } from '../services/rag';
import { loadBrainLogs } from '../services/storage';
import { Button } from './Button';

interface StrategyBrainProps {
    brandName: string;
    brandConfig: BrandConfig;
    tasks: StrategyTask[];
    onUpdateTasks: (tasks: StrategyTask[]) => void;
    events: CalendarEvent[];
    onSchedule: (content: string, image?: string) => void;
    growthReport?: GrowthReport | null;
    onNavigate?: (section: string, params?: any) => void; // New Navigation Handler
}

export const StrategyBrain: React.FC<StrategyBrainProps> = ({
    brandName,
    brandConfig,
    tasks,
    onUpdateTasks,
    events,
    onSchedule,
    growthReport,
    onNavigate
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState<string | null>(null);
    const [selectedTask, setSelectedTask] = useState<StrategyTask | null>(null); // For Modal
    const [ragEvents, setRagEvents] = useState<any[]>([]);
    const [lastScan, setLastScan] = useState<Date | null>(new Date());

    const performAudit = async () => {
        setIsLoading(true);
        setRagEvents([]);
        try {
            await runMarketScan(brandName);
            const [trends, mentions] = await Promise.all([
                fetchMarketPulse(brandName),
                fetchMentions(brandName)
            ]);

            const ragHits = await searchContext(`Market trends, strategy context, and past decisions for ${brandName}`, 5);
            setRagEvents(ragHits);
            const ragContext = buildContextBlock(ragHits);

            const generatedTasks = await generateStrategicAnalysis(
                brandName,
                events,
                trends,
                brandConfig,
                growthReport,
                mentions,
                ragContext
            );
            onUpdateTasks(generatedTasks);
            setLastScan(new Date());
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (tasks.length === 0 && !isLoading) {
            performAudit();
        }
    }, [brandName]);

    const handleExecuteTask = async (task: StrategyTask) => {
        setIsExecuting(task.id);
        try {
            // Intelligent Routing based on Task Type
            if (task.type === 'CAMPAIGN_IDEA' && onNavigate) {
                // Route to Campaigns
                onNavigate('campaigns', { intent: task.title });
                setIsExecuting(null);
                setSelectedTask(null);
                return; // Exit, let router handle
            }

            if (task.type === 'TREND_JACK' && onNavigate && task.contextData && task.contextData.length > 0) {
                // Route to Pulse if trend data available
                const trendSource = task.contextData.find(c => c.type === 'TREND');
                if (trendSource) {
                    onNavigate('pulse', { trend: { headline: trendSource.headline, summary: trendSource.source } });
                    setIsExecuting(null);
                    setSelectedTask(null);
                    return;
                }
            }

            if (task.type === 'REPLY' && onNavigate && task.contextData && task.contextData.length > 0) {
                // Route to Social
                onNavigate('social', { filter: 'mentions' }); // Simple redirect for now
                setIsExecuting(null);
                setSelectedTask(null);
                return;
            }

            // Default: "Execute" = Generate Content Draft (Quick Action)
            const copy = await generateTweet(task.executionPrompt, brandName, brandConfig, 'Professional');
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
            onSchedule(copy, image);
            await logDecision(`Executed Task: ${task.title} (${task.type})`, task.reasoning);

            // Remove from list
            const remaining = tasks.filter(t => t.id !== task.id);
            onUpdateTasks(remaining);

        } catch (e) {
            console.error(e);
            alert("Failed. Try again.");
        } finally {
            setIsExecuting(null);
        }
    };

    const handleDismiss = (id: string) => {
        const remaining = tasks.filter(t => t.id !== id);
        onUpdateTasks(remaining);
    }

    // Helper for Type Badges
    const getTypeBadge = (type: string) => {
        const styles = {
            'REPLY': 'bg-blue-50 text-blue-700 border-blue-200',
            'REACTION': 'bg-pink-50 text-pink-700 border-pink-200',
            'EVERGREEN': 'bg-emerald-50 text-emerald-700 border-emerald-200',
            'GAP_FILL': 'bg-orange-50 text-orange-700 border-orange-200',
            'TREND_JACK': 'bg-purple-50 text-purple-700 border-purple-200',
            'CAMPAIGN_IDEA': 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${styles[type as keyof typeof styles] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {type.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="w-full space-y-4 animate-fadeIn pb-4">

            {/* VIEW CONTROLLER: LIST vs DETAIL */}
            {selectedTask ? (
                // DETAIL VIEW (PAGE MODE)
                <div className="bg-brand-surface border border-brand-border rounded-xl shadow-sm overflow-hidden animate-fadeIn min-h-[600px]">
                    {/* Header */}
                    <div className="bg-brand-surfaceHighlight border-b border-brand-border p-6 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="group flex items-center gap-2 text-brand-muted hover:text-brand-text transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-white border border-brand-border flex items-center justify-center shadow-sm group-hover:bg-brand-bg">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider">Back to Matrix</span>
                            </button>
                            <div className="h-8 w-px bg-brand-border mx-2"></div>
                            <div>
                                <h2 className="text-xl font-bold text-brand-text font-display">{selectedTask.title}</h2>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {getTypeBadge(selectedTask.type)}
                            <Button onClick={() => handleExecuteTask(selectedTask)} className="px-6">
                                Execute Strategy
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row h-full">
                        {/* MAIN CONTENT (LEFT) */}
                        <div className="flex-1 p-8 space-y-8 border-r border-brand-border bg-white">

                            {/* 1. EXECUTION PLAN */}
                            <div>
                                <h4 className="flex items-center gap-2 text-xs font-bold text-brand-muted uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                                    <span className="text-lg">⚡</span> Execution Strategy
                                </h4>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 font-mono text-sm text-gray-800 whitespace-pre-wrap leading-relaxed shadow-inner">
                                    {selectedTask.executionPrompt}
                                </div>
                            </div>

                            {/* 2. THE WHY (AI LOGIC) */}
                            <div>
                                <h4 className="flex items-center gap-2 text-xs font-bold text-brand-muted uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                                    <span className="text-lg">🧠</span> Cognitive Process
                                </h4>
                                <div className="space-y-4">
                                    {selectedTask.reasoningSteps?.map((step, idx) => (
                                        <div key={idx} className="flex gap-4 p-4 bg-indigo-50/50 rounded-lg border border-indigo-50/50">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shadow-sm">
                                                {idx + 1}
                                            </div>
                                            <p className="text-sm text-indigo-900 leading-relaxed font-medium">
                                                {step}
                                            </p>
                                        </div>
                                    ))}
                                    {(!selectedTask.reasoningSteps || selectedTask.reasoningSteps.length === 0) && (
                                        <p className="text-sm text-indigo-900 leading-relaxed font-medium italic p-4 bg-indigo-50 rounded-lg">
                                            "{selectedTask.reasoning}"
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* 3. SYSTEM MONOLOGUE (DEEP LOGS) */}
                            {(() => {
                                // Load logs to find the source
                                const allLogs = loadBrainLogs(brandName);
                                const sourceLog = selectedTask.sourceLogId ? allLogs.find(l => l.id === selectedTask.sourceLogId) : null;

                                if (sourceLog && sourceLog.thoughts) {
                                    return (
                                        <div className="mt-8 animate-fadeIn">
                                            <h4 className="flex items-center gap-2 text-xs font-bold text-brand-muted uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                                                <span className="text-lg">🧬</span> System Monologue (Raw)
                                            </h4>
                                            <div className="bg-gray-900 text-gray-300 p-6 rounded-xl font-mono text-xs leading-loose shadow-2xl border border-gray-800 overflow-x-auto">
                                                <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                                                    <span className="text-green-500 font-bold">● SYSTEM_LOG_ID: {sourceLog.id}</span>
                                                    <span className="text-gray-500">{new Date(sourceLog.timestamp).toLocaleString()}</span>
                                                </div>
                                                <p className="whitespace-pre-wrap">{sourceLog.thoughts}</p>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                        </div>

                        {/* SIDEBAR (RIGHT) */}
                        <div className="w-full lg:w-96 bg-gray-50 p-8 flex flex-col gap-6 shrink-0 h-auto min-h-screen">
                            {/* CONTEXT */}
                            <div>
                                <h4 className="flex items-center gap-2 text-xs font-bold text-brand-muted uppercase tracking-wider mb-3">
                                    <span className="text-lg">📡</span> Input Signals
                                </h4>
                                {selectedTask.contextData && selectedTask.contextData.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedTask.contextData.map((data, idx) => (
                                            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:border-brand-accent transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-bold uppercase text-brand-muted bg-gray-100 px-2 py-0.5 rounded">{data.type}</span>
                                                    {data.relevance && <span className="text-[10px] text-green-600 font-bold">Hit: {data.relevance}/10</span>}
                                                </div>
                                                <p className="text-xs font-bold text-brand-text mb-1 line-clamp-2">{data.headline}</p>
                                                <p className="text-[10px] text-brand-textSecondary break-words">{data.source.substring(0, 100)}...</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-brand-muted border border-dashed border-gray-200 rounded-lg">
                                        <p className="text-xs">No specific signal links.</p>
                                    </div>
                                )}
                            </div>

                            {/* METADATA */}
                            <div className="bg-white p-4 rounded-lg border border-brand-border shadow-sm">
                                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-4">Task Metadata</h4>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-brand-textSecondary">ID</span>
                                        <span className="font-mono text-brand-text">{selectedTask.id.substring(0, 8)}...</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-brand-textSecondary">Impact Score</span>
                                        <span className="font-bold text-brand-text">{selectedTask.impactScore}/10</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-brand-textSecondary">Confidence</span>
                                        <span className="font-bold text-brand-text">{((selectedTask.impactScore / 10) * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            ) : (
                // LIST VIEW (GRID)
                <div className="mt-[-8px]">
                    {/* PROFESSIONAL TOOLBAR */}
                    <div className="flex flex-col md:flex-row justify-between items-center bg-white border-b border-brand-border pb-4 mb-2">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                <span className="text-sm font-bold text-brand-text">AI Analyst Active</span>
                            </div>
                            <div className="h-4 w-px bg-brand-border"></div>
                            <div className="flex items-center gap-2 text-xs text-brand-textSecondary">
                                <span>Last Scan:</span>
                                <span className="font-mono text-brand-text">{lastScan?.toLocaleTimeString()}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={performAudit}
                                disabled={isLoading}
                                variant="secondary"
                                className="h-8 text-xs bg-white hover:bg-gray-50 border-brand-border text-brand-text font-medium"
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Scanning Market...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Refresh Intelligence
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* DATA TABLES */}
                    <div className="bg-white border border-brand-border rounded-lg shadow-sm overflow-hidden">
                        {/* Header Row */}
                        <div className="grid grid-cols-12 gap-2 border-b border-brand-border bg-gray-50/50 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-brand-muted">
                            <div className="col-span-1" title="Urgency level based on market opportunity">Priority ⓘ</div>
                            <div className="col-span-1" title="Category of strategic action">Type ⓘ</div>
                            <div className="col-span-5">Task Details</div>
                            <div className="col-span-3" title="Why AI recommends this now">AI Reasoning & Context ⓘ</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        {/* Loading State */}
                        {isLoading && tasks.length === 0 && (
                            <div className="p-12 flex flex-col items-center justify-center text-brand-muted">
                                <div className="w-8 h-8 border-2 border-brand-border border-t-brand-accent rounded-full animate-spin mb-4"></div>
                                <span className="text-xs font-mono">Running Inference...</span>
                            </div>
                        )}

                        {/* Empty State */}
                        {!isLoading && tasks.length === 0 && (
                            <div className="p-6 text-center">
                                <p className="text-sm font-bold text-brand-text mb-1">No Pending Actions</p>
                                <p className="text-xs text-brand-textSecondary max-w-sm mx-auto">System is monitoring. Refresh to scan.</p>
                            </div>
                        )}

                        {/* Rows */}
                        <div className="divide-y divide-brand-border/50">
                            {tasks.map((task, idx) => (
                                <div
                                    key={task.id}
                                    onClick={() => setSelectedTask(task)}
                                    className="grid grid-cols-12 gap-2 px-4 py-2 hover:bg-brand-surfaceHighlight transition-colors items-center group cursor-pointer"
                                >

                                    {/* Priority */}
                                    <div className="col-span-1 flex items-center gap-2 pt-1">
                                        <div className={`w-2 h-2 rounded-full ${task.impactScore >= 8 ? 'bg-red-500 shadow-sm shadow-red-200' : 'bg-blue-400'}`}></div>
                                        <span className={`text-xs font-mono font-bold ${task.impactScore >= 8 ? 'text-brand-text' : 'text-brand-muted'}`}>
                                            {task.impactScore >= 8 ? 'HIGH' : 'NORM'}
                                        </span>
                                    </div>

                                    {/* Type */}
                                    <div className="col-span-1 pt-0.5">
                                        {getTypeBadge(task.type)}
                                    </div>

                                    {/* Task Details */}
                                    <div className="col-span-5 pr-4">
                                        <p className="text-sm font-bold text-brand-text leading-tight mb-1 group-hover:text-brand-accent transition-colors">
                                            {task.title}
                                        </p>
                                        <p className="text-xs text-brand-textSecondary leading-relaxed line-clamp-2">
                                            {task.description}
                                        </p>
                                    </div>

                                    {/* Reasoning */}
                                    <div className="col-span-3 border-l border-brand-border/30 pl-4 h-full">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="text-[10px] text-brand-muted uppercase font-bold">Signal</span>
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 rounded">{((task.impactScore / 10) * 100).toFixed(0)}% Conf.</span>
                                        </div>
                                        <p className="text-xs text-brand-textSecondary/80 leading-snug font-medium line-clamp-2">
                                            {task.reasoning}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-2 flex items-center justify-end gap-2 pt-0.5">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDismiss(task.id); }}
                                            className="p-1.5 text-brand-muted hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title="Dismiss"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                        <Button
                                            onClick={(e: any) => {
                                                e.stopPropagation(); // Just execute without opening detail
                                                handleExecuteTask(task);
                                            }}
                                            disabled={isExecuting !== null}
                                            isLoading={isExecuting === task.id}
                                            className="h-8 text-xs px-3 shadow-none border border-brand-accent bg-brand-accent hover:bg-brand-accent/90"
                                            title="Click to execute intention"
                                        >
                                            {isExecuting === task.id ? 'Running...' : 'Execute'}
                                        </Button>
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


