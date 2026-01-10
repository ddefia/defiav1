
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
    // const [selectedTask, setSelectedTask] = useState<StrategyTask | null>(null); // REMOVED DETAIL VIEW FOR SIMPLICITY
    const [lastScan, setLastScan] = useState<Date | null>(new Date());

    // Config Modal State
    const [configuringTask, setConfiguringTask] = useState<StrategyTask | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('Campaign Launch');
    const [selectedRefImage, setSelectedRefImage] = useState<string>('');
    const [executionMode, setExecutionMode] = useState<'Creative' | 'Structure'>('Creative');

    const performAudit = async () => {
        setIsLoading(true);
        try {
            await runMarketScan(brandName);
            const [trends, mentions] = await Promise.all([
                fetchMarketPulse(brandName),
                fetchMentions(brandName)
            ]);

            const ragHits = await searchContext(`Market trends, strategy context, and past decisions for ${brandName}`, 5);
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

    // PREPARE EXECUTION (Open Modal)
    const handleConfigureExecution = (task: StrategyTask) => {
        // Intelligent Routing Bypass: If no generation needed, just route
        if (task.type === 'CAMPAIGN_IDEA' && onNavigate) {
            onNavigate('campaigns', { intent: task.title });
            return;
        }
        if (task.type === 'TREND_JACK' && onNavigate && task.contextData?.some(c => c.type === 'TREND')) {
            const trend = task.contextData.find(c => c.type === 'TREND');
            if (trend) {
                onNavigate('pulse', { trend: { headline: trend.headline, summary: trend.source } });
                return;
            }
        }
        if (task.type === 'REPLY' && onNavigate) {
            onNavigate('social', { filter: 'mentions' });
            return;
        }

        // Default: Open Graphics Config Modal
        setConfiguringTask(task);
        // Reset defaults
        setSelectedTemplate('Campaign Launch');
        if (brandConfig.referenceImages?.length > 0) {
            setSelectedRefImage(brandConfig.referenceImages[0].id);
        }
    };

    // RUN EXECUTION (Called from Modal)
    const handleConfirmExecute = async () => {
        if (!configuringTask) return;
        const task = configuringTask;

        setIsExecuting(task.id);
        setConfiguringTask(null); // Close modal

        try {
            // 1. Generate Copy
            const copy = await generateTweet(task.executionPrompt, brandName, brandConfig, 'Professional');

            // 2. Generate Graphic (Smart Mode)
            let image;
            if (task.type !== 'REPLY') {
                const visualPrompt = `Editorial graphic for ${brandName}. Context: ${task.title}. Style: Professional, clean, on-brand.`;

                image = await generateWeb3Graphic({
                    prompt: visualPrompt,
                    size: '1K',
                    aspectRatio: '16:9',
                    brandConfig: brandConfig,
                    brandName: brandName,
                    templateType: selectedTemplate, // USER SELECTED
                    selectedReferenceImage: selectedRefImage // USER SELECTED
                });
            }

            onSchedule(copy, image);
            await logDecision(`Executed Task: ${task.title} (${task.type})`, task.reasoning);

            // Remove from list
            const remaining = tasks.filter(t => t.id !== task.id);
            onUpdateTasks(remaining);

        } catch (e) {
            console.error(e);
            alert("Execution failed. Use standard Draft mode.");
        } finally {
            setIsExecuting(null);
        }
    };

    const handleDismiss = (id: string) => {
        const remaining = tasks.filter(t => t.id !== id);
        onUpdateTasks(remaining);
    }

    // --- RENDER HELPERS ---

    // Type Badge Style (Clean, Pill)
    const getTypeBadge = (type: string) => {
        const styles: Record<string, string> = {
            'REPLY': 'text-blue-600 bg-blue-50 border-blue-100',
            'REACTION': 'text-pink-600 bg-pink-50 border-pink-100',
            'EVERGREEN': 'text-emerald-600 bg-emerald-50 border-emerald-100',
            'GAP_FILL': 'text-orange-600 bg-orange-50 border-orange-100',
            'TREND_JACK': 'text-purple-600 bg-purple-50 border-purple-100',
            'CAMPAIGN_IDEA': 'text-indigo-600 bg-indigo-50 border-indigo-100'
        };
        const style = styles[type] || 'text-gray-600 bg-gray-50 border-gray-100';

        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${style}`}>
                {type.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="w-full space-y-4 animate-fadeIn pb-4">

            {/* HEADER / TOOLBAR */}
            <div className="flex justify-between items-center bg-white border border-brand-border rounded-lg p-3 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                        <span className="text-xs font-bold text-brand-text uppercase tracking-wider">AI Command Center</span>
                    </div>
                    <div className="h-4 w-px bg-brand-border"></div>
                    <div className="text-[10px] text-brand-textSecondary">
                        Last Scan: <span className="font-mono text-brand-text">{lastScan?.toLocaleTimeString()}</span>
                    </div>
                </div>
                <Button
                    onClick={performAudit}
                    disabled={isLoading}
                    variant="secondary"
                    className="h-7 text-[10px] px-3 bg-gray-50 hover:bg-white border-brand-border"
                >
                    {isLoading ? 'Scanning...' : 'Force Rescan'}
                </Button>
            </div>

            {/* TASK LIST (COMMAND STYLE) */}
            <div className="flex flex-col gap-3">

                {isLoading && tasks.length === 0 && (
                    <div className="p-12 text-center border border-dashed border-brand-border rounded-lg">
                        <div className="text-sm font-medium text-brand-muted animate-pulse">Analyzing market signals...</div>
                    </div>
                )}

                {!isLoading && tasks.length === 0 && (
                    <div className="p-8 text-center bg-gray-50 border border-brand-border rounded-lg">
                        <p className="text-sm font-bold text-brand-text">All Clear</p>
                        <p className="text-xs text-brand-textSecondary">No high-priority actions required at this moment.</p>
                    </div>
                )}

                {tasks.map((task) => (
                    <div key={task.id} className="group bg-white border border-brand-border rounded-lg p-4 shadow-sm hover:shadow-md hover:border-brand-accent/50 transition-all flex flex-col md:flex-row md:items-center gap-4">

                        {/* SCORE & TYPE */}
                        <div className="flex flex-row md:flex-col items-center md:items-start gap-3 md:gap-1 min-w-[80px]">
                            <div className="flex items-center gap-1.5" title={`Impact Score: ${task.impactScore}/10`}>
                                <div className={`w-2 h-2 rounded-full ${task.impactScore >= 8 ? 'bg-red-500' : 'bg-blue-400'}`}></div>
                                <span className="text-xs font-mono font-bold text-brand-text">{task.impactScore}/10</span>
                            </div>
                            {getTypeBadge(task.type)}
                        </div>

                        {/* CONTENT */}
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-brand-text mb-1 group-hover:text-brand-accent transition-colors">{task.title}</h3>
                            <p className="text-xs text-brand-textSecondary leading-relaxed max-w-2xl">{task.description}</p>

                            {/* MINI CONTEXT TAGS */}
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] font-bold text-brand-muted uppercase">Rational:</span>
                                <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 truncate max-w-[300px]">
                                    {task.reasoning}
                                </span>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex items-center gap-2 shrink-0 md:ml-auto border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4 mt-3 md:mt-0 w-full md:w-auto justify-end">
                            <button
                                onClick={() => handleDismiss(task.id)}
                                className="text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
                            >
                                Dismiss
                            </button>
                            <Button
                                onClick={() => handleConfigureExecution(task)}
                                disabled={isExecuting !== null}
                                isLoading={isExecuting === task.id}
                                className="h-8 text-xs font-bold shadow-sm"
                            >
                                {isExecuting === task.id ? 'Running...' : 'Execute'}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {/* SMART EXECUTION MODAL */}
            {configuringTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-brand-border">
                        <div className="bg-gray-50 border-b border-brand-border p-4 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-brand-text uppercase tracking-wider flex items-center gap-2">
                                <span className="text-lg">⚡</span> Configure Action
                            </h3>
                            <button onClick={() => setConfiguringTask(null)} className="text-gray-400 hover:text-red-500">✕</button>
                        </div>

                        <div className="p-6 space-y-6">

                            {/* CONTEXT SUMMARY */}
                            <div className="text-xs text-brand-textSecondary bg-blue-50/50 p-3 rounded border border-blue-100">
                                <strong>Creating Content for:</strong> {configuringTask.title}
                            </div>

                            {/* 1. SETUP GRAPHIC */}
                            <div>
                                <label className="text-xs font-bold text-brand-text uppercase tracking-wider mb-2 block">1. Graphic Generation Mode</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => { setSelectedTemplate('Campaign Launch'); setExecutionMode('Creative'); }}
                                        className={`p-3 rounded-lg border text-left transition-all ${executionMode === 'Creative' ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <div className="font-bold text-xs text-brand-text mb-1">Creative Harmony</div>
                                        <div className="text-[10px] text-gray-500 leading-tight">Artistic Vibe. Adapts layout to fit the text. Best for general posts.</div>
                                    </button>
                                    <button
                                        onClick={() => { setSelectedTemplate('Partnership'); setExecutionMode('Structure'); }}
                                        className={`p-3 rounded-lg border text-left transition-all ${executionMode === 'Structure' ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <div className="font-bold text-xs text-brand-text mb-1">Structural Clone</div>
                                        <div className="text-[10px] text-gray-500 leading-tight">Rigid Template. Keeps logo & text placement. Best for announcements.</div>
                                    </button>
                                </div>
                            </div>

                            {/* 2. SELECT REFS */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-muted uppercase">Visual Template</label>
                                    <select
                                        value={selectedTemplate}
                                        onChange={(e) => setSelectedTemplate(e.target.value)}
                                        className="w-full text-xs p-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-brand-accent"
                                    >
                                        <option value="Campaign Launch">Campaign Launch (Creative)</option>
                                        <option value="Partnership">Partnership (Structural)</option>
                                        <option value="Speaker Scenes">Speaker Quote (Structural)</option>
                                        <option value="Events">Event / Date (Structural)</option>
                                        <option value="Giveaway">Giveaway (Structural)</option>
                                        {brandConfig.graphicTemplates?.map(t => (
                                            <option key={t.id} value={t.label}>{t.label} (Custom)</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-brand-muted uppercase">Reference Image</label>
                                    <select
                                        value={selectedRefImage}
                                        onChange={(e) => setSelectedRefImage(e.target.value)}
                                        className="w-full text-xs p-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-brand-accent"
                                    >
                                        <option value="">Auto-Select Best Match</option>
                                        {brandConfig.referenceImages?.map(img => (
                                            <option key={img.id} value={img.id}>Ref: {img.id.substring(0, 8)}...</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                        </div>

                        <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-brand-border">
                            <Button onClick={() => setConfiguringTask(null)} variant="secondary" className="text-xs">
                                Cancel
                            </Button>
                            <Button onClick={handleConfirmExecute} className="text-xs px-6">
                                Generate Draft
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


