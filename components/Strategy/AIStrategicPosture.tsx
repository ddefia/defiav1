import React, { useState } from 'react';
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
        "Narrative consistency",
        "Measured experimentation"
    ],
    deprioritized: [
        "Short-term hype narratives",
        "Influencer-led speculation",
        "High-frequency posting",
        "Reactionary commentary"
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
        <div className="w-full h-full p-8 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER - Enterprise Style */}
            <div className="flex items-end justify-between mb-8 border-b border-gray-200 pb-6">
                <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm bg-gray-900"></span>
                        Strategic Command
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-none">
                        Strategic Posture
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Scope</div>
                        <div className="text-xs font-bold text-gray-900">{brandName}</div>
                    </div>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <div className="text-right">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status</div>
                        <div className="text-xs font-bold text-emerald-600 flex items-center justify-end gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                        </div>
                    </div>
                </div>
            </div>

            {/* TOP ROW: KPI CARDS (Sharpened) */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Confidence', value: posture.confidenceLevel, meta: 'Stable', color: 'text-emerald-600' },
                    { label: 'Time Horizon', value: 'Q2 2026', meta: 'Long Term', color: 'text-gray-500' },
                    { label: 'Mandates', value: posture.priorities.length, meta: 'Active', color: 'text-blue-600' },
                    { label: 'Signal Stream', value: tasks.length, meta: 'Processing', color: 'text-purple-600' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-colors">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{stat.label}</div>
                        <div className="flex items-baseline justify-between">
                            <div className="text-xl font-bold text-gray-900 tracking-tight">{stat.value}</div>
                            <div className={`text-[10px] font-medium ${stat.color}`}>{stat.meta}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* LEFT COLUMN: STRATEGY (8 Cols) */}
                <div className="md:col-span-8 flex flex-col gap-6">

                    {/* OBJECTIVE CARD (High Signal) */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">Primary Objective</h3>
                            <span className="text-[10px] font-mono text-gray-400">OBJ-01</span>
                        </div>
                        <div className="p-6">
                            <p className="text-lg font-medium text-gray-900 leading-relaxed tracking-tight mb-4">
                                {posture.objective}
                            </p>
                            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-md border border-gray-100">
                                <span className="text-gray-400 text-lg serif italic">"</span>
                                <p className="text-sm text-gray-600 italic leading-relaxed">
                                    {posture.thesis}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* NEURAL STREAM (Table/Feed Style) */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm min-h-[400px] flex flex-col">
                        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">Neural Stream</h3>
                                <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">LIVE</span>
                            </div>
                            <span className="text-[10px] font-mono text-gray-400">{tasks.length} EVENTS</span>
                        </div>

                        <div className="flex-1 p-4 bg-gray-50/30">
                            {tasks.length > 0 ? (
                                <div className="space-y-3">
                                    {tasks.map(task => (
                                        <StrategyActionCard
                                            key={task.id}
                                            task={task}
                                            onConfigure={() => handleExecuteTask(task)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-60">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                                    <div className="text-[10px] font-mono uppercase tracking-widest">Awaiting Signals</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: MANDATES (4 Cols) */}
                <div className="md:col-span-4 space-y-6">
                    {/* PRIORITIES */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Mandates</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {posture.priorities.map((item, i) => (
                                <div key={i} className="p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                                    <span className="text-[10px] font-mono text-gray-400 font-bold bg-gray-100 px-1.5 rounded">{i + 1}</span>
                                    <span className="text-xs font-medium text-gray-700 leading-snug">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CONSTRAINTS */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Restricted</h3>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {posture.deprioritized.map((item, i) => (
                                <div key={i} className="p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors opacity-75">
                                    <span className="text-[10px] font-mono text-gray-300">✕</span>
                                    <span className="text-xs text-gray-500 leading-snug">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
