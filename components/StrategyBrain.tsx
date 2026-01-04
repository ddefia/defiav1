
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

            {/* DATA GRID */}
            <div className="bg-white border border-brand-border rounded-lg shadow-sm overflow-hidden mt-[-8px]">
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
                                        e.stopPropagation(); // Prevent modal open
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

            {/* Pagination / Context Footer if needed */}
            {ragEvents.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-[10px] text-brand-muted bg-gray-50 border border-brand-border rounded px-3 py-2">
                    <span className="font-bold">Context Sources:</span>
                    {ragEvents.map((e, i) => (
                        <span key={i} className="bg-white border border-gray-200 px-1.5 rounded">{e.source}</span>
                    ))}
                </div>
            )}

            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setSelectedTask(null)}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh] max-h-[800px]" onClick={e => e.stopPropagation()}>

                    {/* Modal Header */}
                    <div className="bg-brand-surfaceHighlight border-b border-brand-border p-6 flex justify-between items-start shrink-0">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                {getTypeBadge(selectedTask.type)}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${selectedTask.impactScore >= 8 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                    IMPACT: {selectedTask.impactScore}/10
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-brand-text leading-tight font-display pr-8">{selectedTask.title}</h3>
                        </div>
                        <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600 bg-white p-2 rounded-full shadow-sm hover:shadow transition-all">✕</button>
                    </div>

                    {/* Modal Body - Scrollable Area */}
                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                        {/* Left Column: Logic & Plan (Scrollable) */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* Section: The Why (Detailed Logic Chain) */}
                            <div>
                                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="text-lg">🧠</span> AI Reasoning Chain
                                </h4>

                                {selectedTask.reasoningSteps && selectedTask.reasoningSteps.length > 0 ? (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 shadow-sm space-y-3">
                                        {selectedTask.reasoningSteps.map((step, idx) => (
                                            <div key={idx} className="flex gap-3">
                                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold mt-0.5">
                                                    {idx + 1}
                                                </div>
                                                <p className="text-sm text-indigo-900 leading-snug font-medium">
                                                    {step}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 shadow-sm">
                                        <p className="text-sm text-indigo-900 leading-relaxed font-medium italic">
                                            "{selectedTask.reasoning}"
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Section: The What */}
                            <div>
                                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">Detailed Context</h4>
                                <p className="text-sm text-brand-textSecondary leading-relaxed bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                                    {selectedTask.description}
                                </p>
                            </div>

                            {/* Section: The Plan */}
                            <div>
                                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">Execution Strategy</h4>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-xs text-gray-700 whitespace-pre-wrap shadow-inner relative overflow-hidden group">
                                    <div className="absolute top-2 right-2 opacity-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">GenAI Prompt</div>
                                    {selectedTask.executionPrompt}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Evidence & Data (Fixed Width, Scrollable) */}
                        <div className="w-full md:w-80 bg-gray-50 border-l border-brand-border p-6 space-y-6 shrink-0 overflow-y-auto custom-scrollbar md:h-full h-auto border-t md:border-t-0">
                            <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                                <span className="text-lg">📡</span> Intelligence Signals
                            </h4>

                            {selectedTask.contextData && selectedTask.contextData.length > 0 ? (
                                <div className="space-y-3">
                                    {selectedTask.contextData.map((data, idx) => (
                                        <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-brand-accent transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] font-bold uppercase text-brand-muted bg-gray-100 px-1.5 rounded">{data.type}</span>
                                                {data.relevance && <span className="text-[10px] text-green-600 font-bold">Relevance: {data.relevance}/10</span>}
                                            </div>
                                            <p className="text-xs font-bold text-brand-text mb-1 line-clamp-2">{data.headline}</p>
                                            <p className="text-[10px] text-brand-textSecondary truncate">{data.source}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-brand-muted">
                                    <div className="text-2xl mb-2">🔭</div>
                                    <p className="text-xs">No specific data sources linked to this task.</p>
                                </div>
                            )}

                            {/* Manual Action Tips */}
                            <div className="pt-6 border-t border-brand-border/50">
                                <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">System Action</h4>
                                <p className="text-xs text-brand-textSecondary">
                                    Clicking execute will
                                    {selectedTask.type === 'CAMPAIGN_IDEA' ? ' <b>open the Campaign Wizard</b> with this strategy pre-filled.' :
                                        selectedTask.type === 'TREND_JACK' ? ' <b>take you to the Pulse Engine</b> to react to this trend.' :
                                            ' <b>draft and schedule</b> content immediately.'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer - Fixed */}
                <div className="p-4 bg-white border-t border-brand-border flex justify-between items-center shrink-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    {/* Log Link */}
                    {selectedTask.sourceLogId && onNavigate ? (
                        <button
                            onClick={() => onNavigate('brain', { logId: selectedTask.sourceLogId })}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 hover:underline decoration-indigo-300 underline-offset-2"
                        >
                            <span>🔍 View System Log</span>
                        </button>
                    ) : <div></div>}

                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setSelectedTask(null)}>Close</Button>
                        <Button onClick={() => { handleExecuteTask(selectedTask); }}>
                            Execute Action
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

        </div >
    );
};
