import React, { useState } from 'react';
import { Button } from '../Button';
import { StrategyTask } from '../../types';

interface StrategicPosture {
    lastUpdated: string;
    version: string;
    objective: string;
    thesis: string;
    timeHorizon: string;
    confidenceLevel: 'High' | 'Medium' | 'Low';
    priorities: string[];
    deprioritized: string[];
    constraints: string[];
    changeLog: { date: string; change: string; reason: string }[];
}

// Initial Hardcoded "Stable Snapshot"
const INITIAL_POSTURE: StrategicPosture = {
    lastUpdated: new Date().toLocaleDateString(),
    version: "1.0",
    objective: "Establish Defia as the premier authority on DeFi infrastructure and L2 scaling solutions.",
    thesis: "The market is shifting from speculative trading to infrastructure maturity. Defia must position itself not just as a participant, but as a knowledgeable guide through this transition, prioritizing educational depth over engagement farming.",
    timeHorizon: "Q1 - Q2 2026",
    confidenceLevel: "High",
    priorities: [
        "Education before promotion",
        "Retention over raw acquisition",
        "Narrative consistency across all channels",
        "Measured experimentation with new formats"
    ],
    deprioritized: [
        "Short-term hype narratives",
        "Influencer-led speculation",
        "High-frequency posting without signal",
        "Reactionary commentary on minor price action"
    ],
    constraints: [
        "Adhere to strict compliance regarding financial advice",
        "Maintain neutral tone during market volatility",
        "Resource allocation focused on high-fidelity content"
    ],
    changeLog: [
        { date: "Oct 12, 2025", change: "Shifted focus to L2 Scaling", reason: "Market maturity indicates consolidated interest in scaling solutions." },
        { date: "Jan 10, 2026", change: "Deprioritized Meme-coin coverage", reason: "Brand risk and alignment with long-term infrastructure thesis." }
    ]
};

interface AIStrategicPostureProps {
    brandName: string;
    tasks?: StrategyTask[];
    onSchedule?: (content: string, image?: string) => void;
}

export const AIStrategicPosture: React.FC<AIStrategicPostureProps> = ({ brandName, tasks = [], onSchedule }) => {
    // In a real app, this might come from a DB. For now, it's a static "Memo".
    const [posture] = useState<StrategicPosture>(INITIAL_POSTURE);

    const handleExecuteTask = (task: StrategyTask) => {
        if (onSchedule) {
            onSchedule(task.executionPrompt, task.suggestedVisualTemplate);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white text-gray-900 font-sans animate-fadeIn overflow-hidden rounded-tl-2xl">

            {/* PART 1: THE MEMO (Static Context - Editorial Style) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-8 md:p-12">
                <div className="max-w-4xl mx-auto">
                    {/* Header - Editorial */}
                    <div className="mb-12 border-b border-gray-100 pb-6 flex justify-between items-end">
                        <div>
                            <h5 className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-2">Internal Memo // Restricted</h5>
                            <h1 className="text-4xl font-serif text-gray-900 tracking-tight leading-none">
                                Strategic Posture
                            </h1>
                        </div>
                        <div className="hidden md:block text-right">
                            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Effective Date</div>
                            <div className="text-sm font-bold text-gray-900">{posture.lastUpdated}</div>
                        </div>
                    </div>

                    {/* Core Thesis - The "Why" */}
                    <section className="mb-12">
                        <div className="prose prose-lg max-w-none">
                            <p className="text-2xl font-serif leading-relaxed text-gray-800 antialiased">
                                <span className="font-bold text-gray-900">Objective: </span>
                                {posture.objective}
                            </p>
                            <div className="my-6 h-px w-16 bg-gray-200"></div>
                            <p className="text-gray-600 text-lg leading-relaxed font-light">
                                " {posture.thesis} "
                            </p>
                        </div>
                    </section>

                    {/* Directives Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 border-t border-gray-100 pt-8">
                        <div>
                            <h3 className="text-xs font-bold text-black uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                Mandates (Prioritize)
                            </h3>
                            <ul className="space-y-3">
                                {posture.priorities.map((p, i) => (
                                    <li key={i} className="text-sm font-medium text-gray-800 flex items-start gap-2">
                                        <span className="text-gray-300 font-serif italic">{i + 1}.</span>
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                                Constraints (Avoid)
                            </h3>
                            <ul className="space-y-3">
                                {posture.deprioritized.map((p, i) => (
                                    <li key={i} className="text-sm text-gray-500 flex items-start gap-2 decoration-gray-300">
                                        <span className="text-gray-300 font-serif italic">x</span>
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* PART 2: THE MACHINE (Neural Stream - Terminal Style) */}
            <div className="h-[45%] bg-[#0A0A0B] border-t border-gray-800 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] relative z-10">
                {/* Terminal Header */}
                <div className="h-10 bg-[#111113] border-b border-white/5 flex items-center px-4 justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                        </div>
                        <div className="h-4 w-px bg-white/10 mx-2"></div>
                        <span className="text-[10px] font-mono font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                            <span className="animate-pulse">●</span> NEURAL_STREAM_ACTIVE
                        </span>
                    </div>
                    <div className="text-[10px] font-mono text-gray-600">
                        {tasks.length} PROCESSES RUNNING
                    </div>
                </div>

                {/* Stream / Terminal Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-sm custom-scrollbar-dark">
                    {tasks.length > 0 ? (
                        tasks.map((task, idx) => (
                            <div
                                key={task.id}
                                className="group relative pl-4 border-l border-white/10 hover:border-emerald-500/50 transition-colors py-2"
                            >
                                {/* Timestamp & ID */}
                                <div className="flex items-baseline gap-3 mb-1 opactiy-50">
                                    <span className="text-[10px] text-gray-600">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                                        {task.type.replace('_', ' ')}
                                    </span>
                                    <span className="text-[10px] text-gray-700">ID: {task.id.slice(0, 8)}</span>
                                </div>

                                {/* Content Line */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="text-gray-300 font-medium group-hover:text-emerald-400 transition-colors">
                                            <span className="text-emerald-500 mr-2">➜</span>
                                            {task.title}
                                        </div>
                                        <div className="text-[11px] text-gray-500 mt-1 pl-5 line-clamp-1 group-hover:line-clamp-none transition-all">
                                            {task.reasoning}
                                        </div>
                                    </div>

                                    {/* Action Button (Hidden until hover) */}
                                    <button
                                        onClick={() => handleExecuteTask(task)}
                                        className="opacity-0 group-hover:opacity-100 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap"
                                    >
                                        [ Execute ]
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-700 space-y-2 opacity-50">
                            <div className="animate-pulse">_</div>
                            <div className="text-xs">LISTENING FOR MARKET SIGNALS...</div>
                        </div>
                    )}

                    {/* Fake Cursor at bottom */}
                    <div className="pl-4 py-2 flex items-center gap-2 text-gray-600">
                        <span className="text-emerald-500">➜</span>
                        <span className="animate-pulse bg-emerald-500 w-2 h-4 block"></span>
                    </div>
                </div>

                {/* Visual Glint/Grid Background effect (Optional, keeping simple CSS for now) */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,19,0)_2px,transparent_2px),linear-gradient(90deg,rgba(18,16,19,0)_2px,transparent_2px)] bg-[length:30px_30px] [background-position:center] opacity-[0.03]"></div>
            </div>

        </div>
    );
};
