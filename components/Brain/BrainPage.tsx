import React, { useState, useEffect } from 'react';
import { BrainLog } from '../../types';
import { loadBrainLogs } from '../../services/storage';

interface BrainPageProps {
    brandName: string;
}

export const BrainPage: React.FC<BrainPageProps> = ({ brandName }) => {
    const [logs, setLogs] = useState<BrainLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<BrainLog | null>(null);

    useEffect(() => {
        // Load initially
        setLogs(loadBrainLogs(brandName));

        // Poll for updates
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
            case 'STRATEGY': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'REPLY': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'REACTION': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'GROWTH_REPORT': return 'bg-green-100 text-green-700 border-green-200';
            case 'CAMPAIGN': return 'bg-pink-100 text-pink-700 border-pink-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="flex h-full w-full bg-brand-bg text-brand-text overflow-hidden font-sans">

            {/* LEFT PANEL: FEED */}
            <div className="w-1/3 min-w-[350px] border-r border-brand-border flex flex-col h-full bg-white">
                <div className="p-4 border-b border-brand-border bg-white sticky top-0 z-10">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Neural Stream
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Real-time decision log</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {logs.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 text-sm">
                            No logs recorded yet.<br />
                            Waiting for AI activity...
                        </div>
                    ) : (
                        logs.map(log => (
                            <div
                                key={log.id}
                                onClick={() => setSelectedLog(log)}
                                className={`p-4 border-b border-brand-border cursor-pointer transition-all hover:bg-gray-50 ${selectedLog?.id === log.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getTypeStyles(log.type)}`}>
                                        {log.type}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-mono">{formatDate(log.timestamp)}</span>
                                </div>
                                <div className="text-xs font-semibold text-gray-800 mb-1 line-clamp-1">
                                    {log.userPrompt}
                                </div>
                                <div className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
                                    {log.context}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: INSPECTOR */}
            <div className="flex-1 flex flex-col h-full bg-gray-50/50">
                {selectedLog ? (
                    <>
                        <div className="px-6 py-4 border-b border-brand-border bg-white shadow-sm flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Decision Details</h2>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 font-mono">
                                    <span>ID: {selectedLog.id}</span>
                                    <span>•</span>
                                    <span>Model: {selectedLog.model}</span>
                                    <span>•</span>
                                    <span>{new Date(selectedLog.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200">
                                COMPLETED
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                            {/* Card: Context */}
                            <div className="bg-white rounded-xl border border-brand-border shadow-sm overflow-hidden">
                                <div className="bg-gray-50/80 px-4 py-2 border-b border-brand-border">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Input Context</h3>
                                </div>
                                <div className="p-4 text-sm text-gray-700 bg-white">
                                    {selectedLog.context}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Card: Prompt */}
                                <div className="bg-white rounded-xl border border-brand-border shadow-sm flex flex-col overflow-hidden h-[500px]">
                                    <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex justify-between items-center">
                                        <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider">System Instructions</h3>
                                    </div>
                                    <div className="flex-1 p-4 overflow-auto custom-scrollbar bg-gray-50">
                                        <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed">
                                            {selectedLog.systemPrompt.trim()}
                                        </pre>
                                    </div>
                                </div>

                                {/* Card: Output */}
                                <div className="bg-white rounded-xl border border-brand-border shadow-sm flex flex-col overflow-hidden h-[500px]">
                                    <div className="bg-green-50 px-4 py-2 border-b border-green-100 flex justify-between items-center">
                                        <h3 className="text-xs font-bold text-green-700 uppercase tracking-wider">AI Output</h3>
                                    </div>
                                    <div className="flex-1 p-4 overflow-auto custom-scrollbar bg-gray-50">
                                        <pre className="text-xs text-gray-800 font-mono whitespace-pre-wrap leading-relaxed">
                                            {typeof selectedLog.structuredOutput === 'object'
                                                ? JSON.stringify(selectedLog.structuredOutput, null, 2)
                                                : selectedLog.rawOutput
                                            }
                                        </pre>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                        <div className="w-20 h-20 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center mb-6">
                            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Log</h3>
                        <p className="text-center max-w-xs">Click on any item in the Neural Stream to inspect the full decision trace.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
