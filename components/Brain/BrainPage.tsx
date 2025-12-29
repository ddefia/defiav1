import React, { useState, useEffect } from 'react';
import { BrainLog, StrategyTask, CampaignStrategy, GrowthReport } from '../../types';
import { loadBrainLogs } from '../../services/storage';

interface BrainPageProps {
    brandName: string;
}

export const BrainPage: React.FC<BrainPageProps> = ({ brandName }) => {
    const [logs, setLogs] = useState<BrainLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<BrainLog | null>(null);

    useEffect(() => {
        setLogs(loadBrainLogs(brandName));
        const interval = setInterval(() => {
            const fresh = loadBrainLogs(brandName);
            if (fresh.length !== logs.length || (fresh[0] && logs[0] && fresh[0].id !== logs[0].id)) {
                setLogs(fresh);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [brandName, logs.length]);

    const formatDate = (ts: number) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getTypeStyles = (type: BrainLog['type']) => {
        switch (type) {
            case 'STRATEGY': return 'border-gray-800 text-gray-900 bg-transparent';
            case 'REPLY': return 'border-blue-800 text-blue-900 bg-transparent';
            case 'REACTION': return 'border-orange-800 text-orange-900 bg-transparent';
            case 'GROWTH_REPORT': return 'border-green-800 text-green-900 bg-transparent';
            case 'CAMPAIGN': return 'border-purple-800 text-purple-900 bg-transparent';
            default: return 'border-gray-400 text-gray-500 bg-transparent';
        }
    };

    // Helper: Determine what "Decisions" did the AI make from the output?
    const renderDecisions = (log: BrainLog) => {
        if (!log.structuredOutput) {
            // Text output (REPLY, REACTION sometimes)
            return (
                <div className="bg-white p-6 border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Generated Content</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap font-serif leading-relaxed">{log.rawOutput}</p>
                </div>
            );
        }

        switch (log.type) {
            case 'STRATEGY':
                const tasks = log.structuredOutput as StrategyTask[];
                return (
                    <div className="space-y-4">
                        {tasks.map((task, i) => (
                            <div key={i} className="bg-white p-5 border border-gray-200 shadow-sm flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-sm font-bold text-gray-900">{task.title}</h4>
                                    <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 border border-gray-200 uppercase">{task.type}</span>
                                </div>
                                <p className="text-sm text-gray-700">{task.description}</p>
                                <div className="mt-2 text-xs text-gray-500 font-mono border-t border-gray-100 pt-2">
                                    REASONING: {task.reasoning}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'CAMPAIGN':
                const camp = log.structuredOutput as CampaignStrategy;
                return (
                    <div className="bg-white p-6 border border-gray-200 space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Target Audience</h4>
                            <p className="text-sm text-gray-800">{camp.targetAudience}</p>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Key Messaging</h4>
                            <ul className="text-sm text-gray-800 list-disc list-inside space-y-1">
                                {camp.keyMessaging.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                        </div>
                    </div>
                );
            case 'GROWTH_REPORT':
                const report = log.structuredOutput as GrowthReport;
                return (
                    <div className="bg-white p-6 border border-gray-200 space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Executive Summary</h4>
                            <p className="text-sm text-gray-800 leading-relaxed">{report.executiveSummary}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {report.strategicPlan.map((plan, i) => (
                                <div key={i} className="p-4 border border-gray-200 bg-gray-50">
                                    <div className="font-bold text-gray-900 text-xs mb-2 uppercase">{plan.action}: {plan.subject}</div>
                                    <div className="text-xs text-gray-600 font-mono">{plan.reasoning}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            default:
                return <pre className="text-xs bg-gray-50 p-4 border border-gray-200">{JSON.stringify(log.structuredOutput, null, 2)}</pre>;
        }
    };

    return (
        <div className="flex h-full w-full bg-brand-bg text-brand-text overflow-hidden font-sans">

            {/* LEFT: STREAM */}
            <div className="w-1/3 min-w-[350px] border-r border-brand-border flex flex-col h-full bg-white">
                <div className="p-4 border-b border-brand-border bg-white sticky top-0 z-10 flex justify-between items-center">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Neural Stream
                    </h2>
                    <button
                        onClick={() => {
                            localStorage.removeItem('defia_brain_logs');
                            setLogs([]);
                            setSelectedLog(null);
                        }}
                        className="text-[10px] text-gray-400 hover:text-red-500 font-mono hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    >
                        CLEAR MEMORY
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {logs.map(log => (
                        <div
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className={`p-4 border-b border-brand-border cursor-pointer hover:bg-gray-50 transition-colors ${selectedLog?.id === log.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between mb-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getTypeStyles(log.type)}`}>{log.type}</span>
                                <span className="text-[10px] text-gray-400">{formatDate(log.timestamp)}</span>
                            </div>
                            <div className="text-xs font-medium text-gray-800 line-clamp-2">
                                {log.context.replace('Sentinel Audit. ', '').replace('WAR ROOM INTELLIGENCE:', 'War Room Signal').substring(0, 80)}...
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: DETAILS */}
            <div className="flex-1 flex flex-col h-full bg-gray-50/50 overflow-hidden">
                {selectedLog ? (
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">

                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold text-gray-900">Decision Analysis</h1>
                            <span className="text-xs font-mono text-gray-500">ID: {selectedLog.id}</span>
                        </div>

                        {/* 1. DATA SOURCES */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                                Data Sources & Context
                            </h3>
                            <div className="bg-white p-4 rounded-xl border border-brand-border shadow-sm">
                                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono bg-gray-50 p-3 rounded">
                                    {selectedLog.context}
                                </div>
                            </div>
                        </div>

                        {/* 2. DECISIONS / OUTPUT */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                Decisions & Reasoning
                            </h3>
                            {renderDecisions(selectedLog)}
                        </div>

                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <p>Select an event from the stream.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
