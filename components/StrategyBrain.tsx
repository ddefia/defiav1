
import React, { useState, useEffect } from 'react';
import { StrategyTask, CalendarEvent, TrendItem, BrandConfig, GrowthReport, BrainLog } from '../types';
import { generateStrategicAnalysis, generateTweet, generateWeb3Graphic } from '../services/gemini';
import { fetchMarketPulse } from '../services/pulse';
import { fetchMentions } from '../services/analytics';
import { runMarketScan } from '../services/ingestion';
import { searchContext, buildContextBlock, logDecision } from '../services/rag';
import { loadBrainLogs } from '../services/storage';
import { Button } from './Button';
import { ManageStrategy } from './ManageStrategy';
import { BrainMemory } from './BrainMemory'; // New Import

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

    // EXECUTION STATE
    const [configuringTask, setConfiguringTask] = useState<StrategyTask | null>(null);
    const [generatedDraft, setGeneratedDraft] = useState<string>(''); // New: Draft Text
    const [showGraphicConfig, setShowGraphicConfig] = useState(false); // New: Show/Hide Graphic UI
    const [showStrategyManager, setShowStrategyManager] = useState(false); // New: Modal State
    const [showMemoryBank, setShowMemoryBank] = useState(false); // New: Memory State

    // DEBUG STATE
    const [thinkingData, setThinkingData] = useState<{ systemPrompt: string, thoughts: string } | null>(null); // 🧠 BRAIN TRANSPARENCY

    // Graphic State
    const [selectedTemplate, setSelectedTemplate] = useState<string>('Campaign Launch');
    const [selectedRefImages, setSelectedRefImages] = useState<string[]>([]);
    const [executionMode, setExecutionMode] = useState<'Creative' | 'Structure'>('Creative');

    const performAudit = async () => {
        setIsLoading(true);
        try {
            await runMarketScan(brandName);
            // SAFETY: Handle potential failures in Promise.all gracefully
            let trends: TrendItem[] = [];
            let mentions: any[] = [];

            try {
                const results = await Promise.all([
                    fetchMarketPulse(brandName).catch(e => { console.warn("Pulse failed", e); return []; }),
                    fetchMentions(brandName).catch(e => { console.warn("Mentions failed", e); return []; })
                ]);
                trends = results[0] || [];
                mentions = results[1] || [];
            } catch (err) {
                console.error("Critical Data Fetch Error in StrategyBrain", err);
            }

            // SAFETY: Ensure trends is an array before passing
            if (!Array.isArray(trends)) trends = [];
            if (!Array.isArray(mentions)) mentions = [];

            const ragHits = await searchContext(`Market trends, strategy context, and past decisions for ${brandName}`, 5);
            // SAFETY: Ensure ragHits is valid
            const safeRagHits = Array.isArray(ragHits) ? ragHits : [];
            const ragContext = buildContextBlock(safeRagHits);

            const generatedTasks = await generateStrategicAnalysis(
                brandName,
                events || [], // SAFETY: Default to empty array
                trends,
                brandConfig,
                growthReport,
                mentions,
                ragContext
            );

            // 🧠 Update Task List
            onUpdateTasks(generatedTasks.tasks);

            // 🧠 Update Debug View
            if (generatedTasks.systemPrompt) {
                setThinkingData({
                    systemPrompt: generatedTasks.systemPrompt,
                    thoughts: generatedTasks.thoughts || "No explicit thoughts returned."
                });
            }

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
        // Intelligent Routing Bypass (DISABLED to show Reasoning Modal first)
        // if (task.type === 'CAMPAIGN_IDEA' && onNavigate) { onNavigate('campaigns', { intent: task.title }); return; }

        if (task.type === 'TREND_JACK' && onNavigate && task.contextData?.some(c => c.type === 'TREND')) {
            const trend = task.contextData.find(c => c.type === 'TREND');
            if (trend) { onNavigate('pulse', { trend: { headline: trend.headline, summary: trend.source } }); return; }
        }
        if (task.type === 'REPLY' && onNavigate) { onNavigate('social', { filter: 'mentions' }); return; }

        // Enter Execution View
        setConfiguringTask(task);

        // Reset Workflow State
        setGeneratedDraft('');
        setShowGraphicConfig(false);

        // Smart Defaults (ready in background)
        if (task.suggestedVisualTemplate) setSelectedTemplate(task.suggestedVisualTemplate);
        else setSelectedTemplate('Campaign Launch');

        if (task.suggestedReferenceIds && task.suggestedReferenceIds.length > 0) setSelectedRefImages(task.suggestedReferenceIds);
        else setSelectedRefImages([]);
    };

    // STAGE 1: GENERATE DRAFT
    const handleGenerateDraft = async () => {
        if (!configuringTask) return;
        setIsExecuting(configuringTask.id);

        try {
            const result = await generateTweet(configuringTask.executionPrompt, brandName, brandConfig, 'Professional');
            const copy = Array.isArray(result) ? result[0] : result;
            setGeneratedDraft(copy);
        } catch (e) {
            console.error(e);
            setGeneratedDraft("Error generating draft. Please try again.");
        } finally {
            setIsExecuting(null);
        }
    };

    // STAGE 2 OPTION A: SCHEDULE TEXT ONLY
    const handleScheduleText = async () => {
        if (!configuringTask) return;

        onSchedule(generatedDraft);
        await logDecision(`Executed Task (Text Only): ${configuringTask.title}`, configuringTask.reasoning);

        // Cleanup
        dismissTask(configuringTask.id);
    };

    // STAGE 2 OPTION B: REVEAL GRAPHIC CONFIG (Just sets state)

    // STAGE 3: GENERATE GRAPHIC & SCHEDULE
    const handleGenerateGraphicAndSchedule = async () => {
        if (!configuringTask) return;
        setIsExecuting(configuringTask.id);

        try {
            const visualPrompt = `Editorial graphic for ${brandName}. Context: ${configuringTask.title}. Style: Professional, clean, on-brand.`;
            const image = await generateWeb3Graphic({
                prompt: visualPrompt,
                size: '1K',
                aspectRatio: '16:9',
                brandConfig: brandConfig,
                brandName: brandName,
                templateType: selectedTemplate,
                selectedReferenceImages: selectedRefImages
            });

            onSchedule(generatedDraft, image);
            await logDecision(`Executed Task (+Graphic): ${configuringTask.title}`, configuringTask.reasoning);

            dismissTask(configuringTask.id);

        } catch (e) {
            console.error(e);
            alert("Graphic generation failed.");
        } finally {
            setIsExecuting(null);
        }
    };

    const dismissTask = (id: string) => {
        setConfiguringTask(null);
        const remaining = tasks.filter(t => t.id !== id);
        onUpdateTasks(remaining);
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

    // --- STRATEGY EXECUTION TERMINAL ---
    if (configuringTask) {
        return (
            <div className="w-full h-full bg-[#f8f9fa] -m-4 p-6 animate-fadeIn flex flex-col overflow-y-auto font-sans">

                {/* 1. TERMINAL HEADER */}
                <div className="flex items-center justify-between mb-6 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setConfiguringTask(null)}
                            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-gray-500"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                {getTypeBadge(configuringTask.type)}
                                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">ID: {configuringTask.id.split('-')[0]}</span>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{configuringTask.title}</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Impact Score</span>
                            <div className="flex items-center justify-end gap-1">
                                <span className="text-2xl font-bold text-gray-900">{configuringTask.impactScore}</span>
                                <span className="text-sm text-gray-400">/ 10</span>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div className="text-right">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confidence</span>
                            <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">
                                <span>High</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. THE STRATEGIC TRIAD (Grid Layout) */}
                <div className="grid grid-cols-12 gap-6 mb-8">

                    {/* COL 1: THE LOGIC (Reasoning) */}
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Strategic Logic</h3>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-full">
                            <h4 className="font-bold text-gray-900 mb-4 text-sm">Why this? Why now?</h4>
                            <p className="text-sm text-gray-600 leading-relaxed mb-6">
                                {configuringTask.reasoning}
                            </p>

                            <div className="space-y-4">
                                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Reasoning Chain</h5>
                                {(configuringTask.reasoningSteps || [
                                    "Analyze market sentiment gap.",
                                    "Identify high-leverage narrative opportunity.",
                                    "Formulate action plan for maximum impact."
                                ]).map((step, i) => (
                                    <div key={i} className="flex gap-3 relative">
                                        {/* Connector Line */}
                                        {i !== (configuringTask.reasoningSteps?.length || 3) - 1 && (
                                            <div className="absolute left-[5px] top-6 bottom-[-16px] w-px bg-gray-100"></div>
                                        )}
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-500 shrink-0 mt-1.5 relative z-10"></div>
                                        <div>
                                            <span className="text-[10px] font-bold text-blue-600 uppercase mb-0.5 block">Step 0{i + 1}</span>
                                            <p className="text-xs text-gray-700 font-medium">{step}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 pt-4 border-t border-gray-100">
                                <div className="flex items-start gap-3 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                                    <div className="text-emerald-500 mt-0.5">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <div>
                                        <h5 className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1">Strategic Fit</h5>
                                        <p className="text-xs text-gray-600 leading-snug">
                                            {configuringTask.strategicAlignment || "Matches core growth objectives."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COL 2: THE EVIDENCE (Reference Points) */}
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Market Signals</h3>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-full flex flex-col">
                            <h4 className="font-bold text-gray-900 mb-4 text-sm">Data & Reference Points</h4>

                            <div className="space-y-3 flex-1">
                                {configuringTask.contextData && configuringTask.contextData.length > 0 ? (
                                    configuringTask.contextData.map((data, i) => (
                                        <div key={i} className="p-3 rounded-lg border border-gray-100 bg-gray-50 group hover:border-purple-200 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${data.type === 'TREND' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                    data.type === 'METRIC' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                        'bg-gray-100 text-gray-600 border-gray-200'
                                                    }`}>{data.type}</span>
                                                <span className="text-[9px] font-mono text-gray-400">{data.source}</span>
                                            </div>
                                            <p className="text-xs font-bold text-gray-800 mb-1">{data.headline}</p>
                                            <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
                                                <div className="bg-purple-500 h-full" style={{ width: `${(data.relevance || 0.8) * 100}%` }}></div>
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[9px] text-gray-400">Relevance</span>
                                                <span className="text-[9px] text-purple-600 font-bold">{Math.round((data.relevance || 0.8) * 100)}%</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    // EMPTY STATE MOCKS if no real data
                                    <>
                                        <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase bg-blue-50 text-blue-600 border-blue-100">Metric</span>
                                                <span className="text-[9px] font-mono text-gray-400">DefiLlama</span>
                                            </div>
                                            <p className="text-xs font-bold text-gray-800 mb-1">Sector TVL Growth &gt; 5%</p>
                                            <p className="text-[10px] text-gray-500">Strong momentum in yield aggregator category.</p>
                                        </div>
                                        <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase bg-orange-50 text-orange-600 border-orange-100">Trend</span>
                                                <span className="text-[9px] font-mono text-gray-400">Twitter/X</span>
                                            </div>
                                            <p className="text-xs font-bold text-gray-800 mb-1">Narrative Shift: 'Real Yield'</p>
                                            <p className="text-[10px] text-gray-500">Influencers discussing sustainable APR over high emissions.</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* COL 3: THE EXECUTION (Drafts) */}
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Content Vectors</h3>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-full flex flex-col">
                            <h4 className="font-bold text-gray-900 mb-4 text-sm">Proposed Angles</h4>

                            <div className="space-y-3 flex-1">
                                {configuringTask.contentIdeas && configuringTask.contentIdeas.length > 0 ? (
                                    configuringTask.contentIdeas.map((idea, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setGeneratedDraft(idea)}
                                            className="w-full text-left p-4 rounded-lg border border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50 hover:border-indigo-300 transition-all group relative overflow-hidden"
                                        >
                                            <div className="flex items-start gap-3 relative z-10">
                                                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <p className="text-xs text-indigo-900 font-medium leading-relaxed group-hover:text-indigo-950">{idea}</p>
                                                </div>
                                            </div>
                                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="text-sm text-gray-400 italic text-center py-8">No specific angles generated.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. EXECUTION KICKOFF */}
                <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm max-w-5xl mx-auto w-full">
                    <div className="flex flex-col items-center">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Ready to Draft?</h3>
                        <p className="text-sm text-gray-500 mb-6 text-center max-w-lg">
                            Select a content vector above or click below to let the AI synthesize the optimal post based on the strategic logic and market signals.
                        </p>

                        {!generatedDraft ? (
                            <Button
                                onClick={handleGenerateDraft}
                                disabled={isExecuting !== null}
                                isLoading={isExecuting === configuringTask.id}
                                className="px-10 h-12 text-sm shadow-xl shadow-brand-accent/20"
                            >
                                {isExecuting ? 'Synthesizing Draft...' : 'Generate Content Draft'}
                            </Button>
                        ) : (
                            <div className="w-full animate-slideDown">
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl mb-4">
                                    <textarea
                                        value={generatedDraft}
                                        onChange={(e) => setGeneratedDraft(e.target.value)}
                                        className="w-full h-32 bg-transparent text-lg text-gray-800 font-medium outline-none resize-none"
                                        placeholder="Draft content..."
                                    />
                                </div>
                                <div className="flex justify-center gap-4">
                                    <Button
                                        onClick={handleScheduleText}
                                        variant="secondary"
                                        className="bg-white hover:bg-gray-50 border-gray-200 text-gray-600"
                                    >
                                        Execute Text Only
                                    </Button>
                                    <Button
                                        onClick={() => setShowGraphicConfig(true)}
                                    >
                                        Execute with Visuals
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* GRAPHIC CONFIG (Nested if needed) - Keeping it simplified for this refactor to focus on the 'Terminal' aspect above */}
                    {showGraphicConfig && (
                        <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col items-center animate-fadeIn">
                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-6">Visual Configuration</h4>
                            {/* ... (Existing Graphic Config Components could go here, simplified for brevity in this specific requested view) ... */}
                            <div className="flex gap-4">
                                <select
                                    value={selectedTemplate}
                                    onChange={(e) => setSelectedTemplate(e.target.value)}
                                    className="p-3 border border-gray-300 rounded-lg text-sm bg-white"
                                >
                                    <option value="Campaign Launch">Campaign Launch</option>
                                    <option value="Partnership">Partnership</option>
                                </select>
                                <Button
                                    onClick={handleGenerateGraphicAndSchedule}
                                    isLoading={isExecuting === configuringTask.id}
                                >
                                    Generate & Launch
                                </Button>
                            </div>
                        </div>
                    )}
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
                    <button
                        onClick={() => setShowMemoryBank(true)}
                        className="text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                    >
                        <span>📜</span> View Memory
                    </button>
                    <button
                        onClick={() => setShowStrategyManager(true)}
                        className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                    >
                        <span>🧠</span> Manage Brain
                    </button>
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
                        <p className="text-sm font-bold text-brand-text">Awaiting Strategic Signal</p>
                        <p className="text-xs text-brand-textSecondary">No specific recommendations generated yet. Run a market scan to refresh.</p>
                    </div>
                )}

                {(Array.isArray(tasks) ? tasks : []).map((task) => (
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

            {/* MODAL */}
            {showStrategyManager && (
                <ManageStrategy
                    brandName={brandName}
                    onClose={() => setShowStrategyManager(false)}
                />
            )}

            {showMemoryBank && (
                <BrainMemory
                    brandName={brandName}
                    onClose={() => setShowMemoryBank(false)}
                />
            )}

            {/* BRAIN DEBUG VIEW (Think Mode) */}
            {/* We assume 'thinkingData' state exists, populated by performAudit */}
            {thinkingData && (
                <div className="mt-8 border-t border-brand-border pt-8 animate-fadeIn">
                    <div className="bg-gray-900 rounded-xl p-6 text-gray-300 font-mono text-xs overflow-hidden">
                        <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                            <span className="font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                Brain Activity Log
                            </span>
                            <span className="text-gray-500">gemini-2.0-flash</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-white font-bold mb-2">System Prompt (Context)</h4>
                                <div className="h-64 overflow-y-auto bg-black/50 p-4 rounded border border-gray-800 whitespace-pre-wrap">
                                    {thinkingData.systemPrompt}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-white font-bold mb-2">Reasoning Stream (Chain of Thought)</h4>
                                <div className="h-64 overflow-y-auto bg-black/50 p-4 rounded border border-gray-800 whitespace-pre-wrap text-emerald-300/80">
                                    {thinkingData.thoughts}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
