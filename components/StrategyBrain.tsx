
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
    const [lastScan, setLastScan] = useState<Date | null>(new Date());

    // EXECUTION STATE (Full Page Mode)
    const [configuringTask, setConfiguringTask] = useState<StrategyTask | null>(null);
    const [includeGraphic, setIncludeGraphic] = useState(true); // New Toggle
    const [selectedTemplate, setSelectedTemplate] = useState<string>('Campaign Launch');
    const [selectedRefImages, setSelectedRefImages] = useState<string[]>([]); // New: Multi-Select
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

    // PREPARE EXECUTION (Enter Config Mode)
    const handleConfigureExecution = (task: StrategyTask) => {
        // Intelligent Routing Bypass
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

        // Enter Execution View
        setConfiguringTask(task);

        // Smart Defaults & Auto-Selection
        setIncludeGraphic(task.type !== 'REPLY'); // Replies usually text-only

        // 1. Template: Use AI suggestion or fallback
        if (task.suggestedVisualTemplate) {
            setSelectedTemplate(task.suggestedVisualTemplate);
        } else {
            setSelectedTemplate('Campaign Launch');
        }

        // 2. References: Use AI suggestion or fallback to first available
        if (task.suggestedReferenceIds && task.suggestedReferenceIds.length > 0) {
            setSelectedRefImages(task.suggestedReferenceIds);
        } else if (brandConfig.referenceImages?.length > 0) {
            // Default to none selected so user can choose, or maybe just the first one?
            // Let's default to empty to encourage "Smart" selection or manual choice
            setSelectedRefImages([]);
        } else {
            setSelectedRefImages([]);
        }
    };

    // RUN EXECUTION
    const handleConfirmExecute = async () => {
        if (!configuringTask) return;
        const task = configuringTask;

        setIsExecuting(task.id);

        try {
            // 1. Generate Copy
            const copy = await generateTweet(task.executionPrompt, brandName, brandConfig, 'Professional');

            // 2. Generate Graphic (Only if toggled)
            let image;
            if (includeGraphic) {
                const visualPrompt = `Editorial graphic for ${brandName}. Context: ${task.title}. Style: Professional, clean, on-brand.`;
                image = await generateWeb3Graphic({
                    prompt: visualPrompt,
                    size: '1K',
                    aspectRatio: '16:9',
                    brandConfig: brandConfig,
                    brandName: brandName,
                    templateType: selectedTemplate,
                    selectedReferenceImages: selectedRefImages // Pass Array
                });
            }

            onSchedule(copy, image);
            await logDecision(`Executed Task: ${task.title} (${task.type})`, task.reasoning);

            // Access granted - clear task and view
            setConfiguringTask(null);
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

    // Helper for Type Badges
    const getTypeBadge = (type: string) => {
        const styles: Record<string, string> = {
            'REPLY': 'text-blue-600 bg-blue-50 border-blue-100',
            'REACTION': 'text-pink-600 bg-pink-50 border-pink-100',
            'EVERGREEN': 'text-emerald-600 bg-emerald-50 border-emerald-100',
            'GAP_FILL': 'text-orange-600 bg-orange-50 border-orange-100',
            'TREND_JACK': 'text-purple-600 bg-purple-50 border-purple-100',
            'CAMPAIGN_IDEA': 'text-indigo-600 bg-indigo-50 border-indigo-100'
        };

        const definitions: Record<string, string> = {
            'REPLY': 'Direct response to a mention or relevant conversation.',
            'REACTION': 'Immediate commentary on breaking news or market moves.',
            'EVERGREEN': 'Timeless educational or brand-building content that is always relevant.',
            'GAP_FILL': 'Content designed to maintain presence during quiet periods.',
            'TREND_JACK': 'Leveraging a current hot topic to gain visibility.',
            'CAMPAIGN_IDEA': 'A multi-post strategic narrative or product launch.'
        };

        const style = styles[type] || 'text-gray-600 bg-gray-50 border-gray-100';
        const definition = definitions[type] || 'Strategic Action';

        return (
            <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider cursor-help ${style}`}
                title={definition}
            >
                {type.replace('_', ' ')}
            </span>
        );
    };

    // --- FULL PAGE EXECUTION VIEW ---
    if (configuringTask) {
        return (
            <div className="w-full h-full bg-gray-50/50 -m-4 p-8 animate-fadeIn flex flex-col overflow-y-auto">
                {/* Header Navigation */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => setConfiguringTask(null)}
                        className="p-2 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors shadow-sm text-gray-500"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h2 className="text-xl font-display font-bold text-brand-text">Strategy Execution</h2>
                        <p className="text-xs text-brand-textSecondary">Configure and launch this action.</p>
                    </div>
                </div>

                {/* WIDE HERO: STRATEGY CONTEXT */}
                <div className="bg-white border border-brand-border rounded-xl p-8 shadow-sm mb-8 animate-slideDown shrink-0">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                        <div className="flex-1 max-w-4xl">
                            <div className="flex items-center gap-3 mb-4">
                                {getTypeBadge(configuringTask.type)}
                                <span className="h-px w-8 bg-gray-200"></span>
                                <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">Strategic Intent</span>
                            </div>
                            <h3 className="text-3xl font-display font-bold text-brand-text mb-4 leading-tight tracking-tight">{configuringTask.title}</h3>
                            <p className="text-lg text-brand-textSecondary leading-relaxed">
                                {configuringTask.description}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-gray-100 pt-8">
                        {/* REASONING */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-brand-text uppercase tracking-wider mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-accent"></span>
                                AI Reasoning
                            </label>
                            <div className="bg-brand-accent PO-5 rounded-xl border border-brand-accent/10 text-brand-text leading-relaxed text-base p-6 bg-brand-accent/5">
                                {configuringTask.reasoning}
                            </div>
                        </div>

                        {/* PROOF */}
                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-brand-text uppercase tracking-wider mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                Data Signals (Proof)
                            </label>
                            {configuringTask.contextData && configuringTask.contextData.length > 0 ? (
                                <div className="space-y-3">
                                    {configuringTask.contextData.map((data, idx) => (
                                        <div key={idx} className="flex items-start gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-50/50 hover:border-indigo-100 transition-colors">
                                            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${data.relevance >= 8 ? 'bg-indigo-500 shadow-sm shadow-indigo-300' : 'bg-indigo-300'}`}></div>
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm mb-1">{data.headline}</div>
                                                <div className="text-xs text-gray-500 flex items-center gap-2 font-medium">
                                                    <span className="uppercase tracking-wider text-indigo-600/80 text-[10px]">{data.type}</span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                    <span>{data.source}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-brand-muted italic py-2">No specific data signals cited by AI.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* CONFIGURATION SECTION */}
                <div className="space-y-6 max-w-5xl mx-auto w-full pb-12">
                    <div className="bg-white border border-brand-border rounded-xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-brand-border bg-gray-50/30 flex justify-between items-center">
                            <h3 className="font-bold text-brand-text flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded bg-brand-accent/10 text-brand-accent text-sm">1</span>
                                Configuration & Execution
                            </h3>
                            {/* Toggle */}
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold ${includeGraphic ? 'text-brand-text' : 'text-gray-400'}`}>Generate Graphic?</span>
                                <button
                                    onClick={() => setIncludeGraphic(!includeGraphic)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${includeGraphic ? 'bg-brand-accent' : 'bg-gray-200'}`}
                                >
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${includeGraphic ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-8">

                            {/* GRAPHIC SETTINGS - CONDITIONALLY SHOWN */}
                            {includeGraphic ? (
                                <div className="animate-fadeIn space-y-6">

                                    {/* MODE SELECTION */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button
                                            onClick={() => { setSelectedTemplate('Campaign Launch'); setExecutionMode('Creative'); }}
                                            className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${executionMode === 'Creative' ? 'border-brand-accent bg-brand-accent/5' : 'border-gray-100 hover:border-brand-accent/30'}`}
                                        >
                                            <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border border-brand-accent flex items-center justify-center ${executionMode === 'Creative' ? 'bg-brand-accent' : 'bg-transparent'}`}>
                                                {executionMode === 'Creative' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                            </div>
                                            <div className="font-bold text-sm text-brand-text mb-1">Creative Harmony</div>
                                            <div className="text-xs text-brand-textSecondary leading-snug">Artistic Direction. Use reference for "Vibe" & Light. Flexible Layout.</div>
                                        </button>

                                        <button
                                            onClick={() => { setSelectedTemplate('Partnership'); setExecutionMode('Structure'); }}
                                            className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${executionMode === 'Structure' ? 'border-brand-accent bg-brand-accent/5' : 'border-gray-100 hover:border-brand-accent/30'}`}
                                        >
                                            <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border border-brand-accent flex items-center justify-center ${executionMode === 'Structure' ? 'bg-brand-accent' : 'bg-transparent'}`}>
                                                {executionMode === 'Structure' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                            </div>
                                            <div className="font-bold text-sm text-brand-text mb-1">Structural Clone</div>
                                            <div className="text-xs text-brand-textSecondary leading-snug">Template Mode. Strict layout preservation. Best for announcements.</div>
                                        </button>
                                    </div>

                                    {/* DROPDOWNS */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-brand-text uppercase tracking-wider">Visual Template</label>
                                            <select
                                                value={selectedTemplate}
                                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                                className="w-full text-sm p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-brand-accent shadow-sm"
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
                                            <p className="text-[10px] text-gray-500">Determines the structure/layout of the image.</p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-brand-text uppercase tracking-wider">Reference Images (Multi-Select)</label>

                                            {brandConfig.referenceImages && brandConfig.referenceImages.length > 0 ? (
                                                <div className="grid grid-cols-4 gap-2">
                                                    {brandConfig.referenceImages.map((img) => {
                                                        const isSelected = selectedRefImages.includes(img.id);
                                                        return (
                                                            <div
                                                                key={img.id}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setSelectedRefImages(prev => prev.filter(id => id !== img.id));
                                                                    } else {
                                                                        setSelectedRefImages(prev => [...prev, img.id]);
                                                                    }
                                                                }}
                                                                className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all relative group ${isSelected ? 'border-brand-accent ring-2 ring-brand-accent/20' : 'border-transparent hover:border-brand-border'}`}
                                                            >
                                                                <img src={img.url || img.data} className="w-full h-full object-cover" />

                                                                {/* Selected Indicator */}
                                                                {isSelected && (
                                                                    <div className="absolute inset-0 bg-brand-accent/20 flex items-center justify-center">
                                                                        <div className="bg-white rounded-full p-0.5 shadow-sm">
                                                                            <svg className="w-3 h-3 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Hover Name Tooltip */}
                                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
                                                                    <p className="text-[9px] text-white font-medium truncate text-center">{img.name}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg text-center">
                                                    <p className="text-[10px] text-gray-500">No reference images found in Brand Kit.</p>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center">
                                                <p className="text-[10px] text-gray-500">Select multiple to blend styles.</p>
                                                {selectedRefImages.length > 0 && (
                                                    <button
                                                        onClick={() => setSelectedRefImages([])}
                                                        className="text-[10px] text-red-500 hover:text-red-600 font-medium"
                                                    >
                                                        Clear Selection ({selectedRefImages.length})
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            ) : (
                                <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                    <div className="text-4xl mb-3">📝</div>
                                    <h4 className="font-bold text-brand-text text-sm">Text Only Workflow</h4>
                                    <p className="text-xs text-brand-textSecondary max-w-xs mx-auto mt-1">The AI will draft a high-quality, formatted tweet without generating any accompanying graphics.</p>
                                </div>
                            )}
                        </div>

                        {/* FOOTER ACTIONS */}
                        <div className="p-6 bg-gray-50 border-t border-brand-border flex justify-end gap-3">
                            <Button
                                onClick={() => setConfiguringTask(null)}
                                variant="secondary"
                                className="bg-white hover:bg-gray-100 mr-auto"
                            >
                                Cancel
                            </Button>

                            {/* SMART ROUTING BUTTON */}
                            {onNavigate && (
                                <Button
                                    onClick={() => {
                                        if (configuringTask.type === 'CAMPAIGN_IDEA') {
                                            onNavigate!('campaigns', { intent: configuringTask.title });
                                        } else if (configuringTask.type === 'TREND_JACK') {
                                            const trend = configuringTask.contextData?.find(c => c.type === 'TREND');
                                            onNavigate!('studio', {
                                                draft: `Write a post about ${configuringTask.title}. Context: ${trend?.headline || 'Current Market Trend'}`,
                                                visualPrompt: `Editorial graphic representing ${configuringTask.title}`
                                            });
                                        } else {
                                            // Default to Studio Writer
                                            onNavigate!('studio', {
                                                draft: configuringTask.executionPrompt
                                            });
                                        }
                                    }}
                                    variant="secondary"
                                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100"
                                >
                                    Open in Workbench ↗
                                </Button>
                            )}

                            <Button
                                onClick={handleConfirmExecute}
                                disabled={isExecuting !== null}
                                isLoading={isExecuting === configuringTask.id}
                                className="px-8 shadow-lg shadow-brand-accent/20"
                            >
                                {isExecuting ? 'Generate Draft' : `Execute Strategy ${includeGraphic ? '+ Graphic' : ''}`}
                            </Button>
                        </div>

                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full space-y-4 animate-fadeIn pb-4">

            {/* HEADER / TOOLBAR */}
            <div className="flex justify-between items-center bg-white border border-brand-border rounded-lg p-3 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                        <span className="text-xs font-bold text-brand-text uppercase tracking-wider">AI Command Center</span>
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
                    <div
                        key={task.id}
                        onClick={() => handleConfigureExecution(task)}
                        className="group bg-white border border-brand-border rounded-lg p-4 shadow-sm hover:shadow-md hover:border-brand-accent/50 transition-all flex flex-col md:flex-row md:items-center gap-4 cursor-pointer"
                    >

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
                                onClick={(e) => { e.stopPropagation(); handleDismiss(task.id); }}
                                className="text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded transition-colors"
                            >
                                Dismiss
                            </button>
                            <Button
                                onClick={(e: any) => { e.stopPropagation(); handleConfigureExecution(task); }}
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
        </div>
    )
}

