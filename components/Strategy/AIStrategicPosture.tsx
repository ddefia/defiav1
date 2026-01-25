import React, { useState } from 'react';
import { Button } from '../Button';
import { StrategyTask } from '../../types';
import { StrategyActionCard } from '../StrategyActionCard';

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

    const handleAcknowledge = () => {
        // Mock action
        alert("Strategic posture acknowledged. AI execution will align with these mandates.");
    };

    const handleRequestRevision = () => {
        // Mock action
        alert("Revision request logged for Admin review.");
    };

    const handleExecuteTask = (task: StrategyTask) => {
        if (onSchedule) {
            onSchedule(task.executionPrompt, task.suggestedVisualTemplate);
        }
    };

    return (
        <div className="min-h-full bg-[#FAFAFA] text-gray-900 font-sans animate-fadeIn p-8 md:p-12 max-w-5xl mx-auto">

            {/* HEADER */}
            <div className="mb-12 border-b border-gray-200 pb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-serif font-medium text-gray-900 mb-2 tracking-tight">AI Strategic Posture</h1>
                        <p className="text-gray-500 text-lg">Current strategic judgment guiding Defia’s recommendations</p>
                    </div>
                    <div className="flex flex-col items-end text-xs font-mono text-gray-400 uppercase tracking-widest gap-1">
                        <div>Role: <span className="text-gray-900 font-bold">AI Chief Marketing Officer</span></div>
                        <div>Scope: <span className="text-gray-900 font-bold">ENKI Protocol</span></div>
                        <div>Status: <span className="text-emerald-600 font-bold">Active</span></div>
                        <div>Reviewed: <span className="text-gray-900">{posture.lastUpdated}</span></div>
                    </div>
                </div>
            </div>

            {/* SECTION 1: CURRENT POSTURE */}
            <section className="mb-12">
                <div className="bg-white border border-gray-200 shadow-sm p-8 rounded-none"> {/* Intentionally boxy/memo-like */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="md:col-span-3 space-y-6">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Primary Objective</h3>
                                <p className="text-xl font-medium text-gray-900 leading-relaxed font-serif">
                                    {posture.objective}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Operating Thesis</h3>
                                <p className="text-lg text-gray-600 leading-relaxed">
                                    {posture.thesis}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-6 border-l border-gray-100 pl-6 md:pl-8">
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Time Horizon</h3>
                                <p className="text-sm font-bold text-gray-900">{posture.timeHorizon}</p>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Confidence</h3>
                                <p className="text-sm font-bold text-gray-900">{posture.confidenceLevel}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
                {/* SECTION 2: ACTIVE PRIORITIES */}
                <section>
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-6 border-b border-gray-200 pb-2">Active Priorities</h2>
                    <ul className="space-y-4">
                        {posture.priorities.map((item, i) => (
                            <li key={i} className="flex items-baseline gap-4 group">
                                <span className="text-xs font-mono text-gray-300 group-hover:text-gray-400">0{i + 1}</span>
                                <span className="text-lg text-gray-800 font-medium">{item}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* SECTION 3: DEPRIORITIZED */}
                <section>
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-200 pb-2">Deprioritized / Non-Goals</h2>
                    <ul className="space-y-4">
                        {posture.deprioritized.map((item, i) => (
                            <li key={i} className="flex items-baseline gap-4 text-gray-400">
                                <span className="text-xs font-mono text-gray-200">X</span>
                                <span className="text-lg decoration-gray-200">{item}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            {/* NEURAL STREAM SECTION (NEW) */}
            <section className="mb-12 animate-fadeIn delay-100">
                <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-2">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Neural Stream / Live Strategy
                    </h2>
                    <span className="text-[10px] font-mono text-gray-400">
                        {tasks.length} Active Thoughts
                    </span>
                </div>

                <div className="space-y-4">
                    {tasks.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {tasks.map(task => (
                                <StrategyActionCard
                                    key={task.id}
                                    task={task}
                                    onConfigure={() => handleExecuteTask(task)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                <span className="text-xl">🧠</span>
                            </div>
                            <p className="text-sm font-bold text-gray-500">Thinking...</p>
                            <p className="text-xs text-gray-400 mt-1">Analyzing market signals for next strategic move.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* SECTION 4 & 5: CONSTRAINTS & LOG */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
                <div className="md:col-span-1">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 border-b border-gray-200 pb-2">Constraints</h2>
                    <ul className="space-y-3">
                        {posture.constraints.map((c, i) => (
                            <li key={i} className="text-sm text-gray-600 leading-relaxed">• {c}</li>
                        ))}
                    </ul>
                </div>
                <div className="md:col-span-2">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4 border-b border-gray-200 pb-2">Strategic Change Log</h2>
                    <div className="space-y-0">
                        {posture.changeLog.map((log, i) => (
                            <div key={i} className="grid grid-cols-12 gap-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors px-2 -mx-2 rounded">
                                <div className="col-span-3 text-xs font-mono text-gray-400 pt-1">{log.date}</div>
                                <div className="col-span-4 text-sm font-bold text-gray-800">{log.change}</div>
                                <div className="col-span-5 text-sm text-gray-500 italic">{log.reason}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECTION 6: PRACTICAL APPLICATION */}
            <section className="bg-indigo-50/50 p-8 border border-indigo-100 rounded-lg mb-12">
                <h2 className="text-sm font-bold text-indigo-900 uppercase tracking-widest mb-4">Operational Impact</h2>
                <p className="text-gray-700 leading-relaxed max-w-3xl">
                    This posture enforces a <strong>check-gate on all high-velocity content</strong>.
                    Campaign recommendations will favor deep-dive threads over single tweets.
                    Action Center will suppress "reactionary" alerts unless they meet a relevance threshold of &gt;85.
                </p>
            </section>

            {/* SECTION 7: USER ACTIONS */}
            <section className="flex justify-end gap-4 pt-8 border-t border-gray-200">
                <button
                    onClick={handleRequestRevision}
                    className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-wider"
                >
                    Request Revision
                </button>
                <Button onClick={handleAcknowledge}>
                    Acknowledge Posture
                </Button>
            </section>

        </div>
    );
};
