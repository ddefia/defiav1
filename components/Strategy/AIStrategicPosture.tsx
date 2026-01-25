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
        <div className="w-full h-full p-6 font-sans bg-[#F9FAFB] min-h-screen">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                        Strategic Posture
                    </h1>
                    <div className="text-[11px] text-gray-500 font-mono mt-1 tracking-tight flex items-center gap-2">
                        AI CMO / {brandName} / Status: <span className="text-emerald-500 font-bold">ACTIVE</span>
                    </div>
                </div>
                <div className="text-[10px] text-gray-400 font-mono bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
                    Last Reviewed: {posture.lastUpdated}
                </div>
            </div>

            {/* SECTION 1: KEY METRICS (KPI Grid Style) */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {/* Confidence Card */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-3 opacity-10 font-black text-6xl text-gray-300 -mr-4 -mt-2 group-hover:scale-110 transition-transform">C</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Confidence</div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{posture.confidenceLevel}</div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-[10px] text-emerald-600 font-medium">Stable</span>
                    </div>
                </div>

                {/* Horizon Card */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-3 opacity-10 font-black text-6xl text-gray-300 -mr-4 -mt-2 group-hover:scale-110 transition-transform">H</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Time Horizon</div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">Q2 2026</div>
                    <div className="text-[10px] text-gray-500 font-medium">Long Term Vision</div>
                </div>

                {/* Active Priorities Count */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-3 opacity-10 font-black text-6xl text-gray-300 -mr-4 -mt-2 group-hover:scale-110 transition-transform">P</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Active Priorities</div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{posture.priorities.length}</div>
                    <div className="text-[10px] text-blue-600 font-medium cursor-pointer hover:underline">View Mandates →</div>
                </div>

                {/* Live Signals Count */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-3 opacity-10 font-black text-6xl text-gray-300 -mr-4 -mt-2 group-hover:scale-110 transition-transform">S</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Live Signals</div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{tasks.length}</div>
                    <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] text-emerald-600 font-medium">Processing</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* LEFT COLUMN: STRATEGIC CONTEXT (2/3 width) */}
                <div className="md:col-span-2 space-y-8">
                    {/* PRIMARY POSTURE CARD */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6 border-b border-gray-50 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Primary Objective</h2>
                                    <p className="text-[10px] text-gray-400 font-medium">The North Star guiding all actions</p>
                                </div>
                            </div>
                        </div>
                        <div className="mb-8">
                            <p className="text-xl font-medium text-gray-900 leading-relaxed">
                                {posture.objective}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Operating Thesis</h3>
                            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100 italic">
                                "{posture.thesis}"
                            </p>
                        </div>
                    </div>

                    {/* NEURAL STREAM / ACTIVE STRATEGY */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Neural Stream</h2>
                                    <p className="text-[10px] text-gray-400 font-medium">Real-time strategic opportunities</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{tasks.length} New</span>
                        </div>

                        <div className="space-y-4">
                            {tasks.length > 0 ? (
                                tasks.map(task => (
                                    <StrategyActionCard
                                        key={task.id}
                                        task={task}
                                        onConfigure={() => handleExecuteTask(task)}
                                    />
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-900">All Clear</h3>
                                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">System is monitoring market signals. No immediate actions required.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: MANDATES (Sidebar Style) */}
                <div className="space-y-6">
                    {/* Active Priorities */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                            Strategic Mandates
                        </h3>
                        <ul className="space-y-3">
                            {posture.priorities.map((item, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="text-[10px] font-mono text-gray-300 mt-0.5">0{i + 1}</span>
                                    <span className="text-sm font-medium text-gray-700 leading-snug">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Non-Goals */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 opacity-75">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                            Restricted / Avoid
                        </h3>
                        <ul className="space-y-3">
                            {posture.deprioritized.map((item, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="text-[10px] font-mono text-gray-300 mt-0.5">X</span>
                                    <span className="text-sm text-gray-500 leading-snug decoration-gray-300">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

            </div>
        </div>
    );
};
