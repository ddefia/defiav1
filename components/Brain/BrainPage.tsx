import React, { useState, useEffect } from 'react';
import { BrainLog, BrandConfig } from '../../types';
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

        // Poll for updates (simple way to keep it live without complex event bus)
        const interval = setInterval(() => {
            const fresh = loadBrainLogs(brandName);
            if (fresh.length !== logs.length || (fresh[0] && logs[0] && fresh[0].id !== logs[0].id)) {
                setLogs(fresh);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [brandName, logs.length]); // Dep array checks length to avoid infinite re-render loop if stable

    const formatDate = (ts: number) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const getTypeColor = (type: BrainLog['type']) => {
        switch (type) {
            case 'STRATEGY': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
            case 'REPLY': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            case 'REACTION': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
            case 'GROWTH_REPORT': return 'text-green-400 bg-green-400/10 border-green-400/20';
            case 'CAMPAIGN': return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        }
    };

    return (
        <div className="flex h-full w-full bg-[#0a0a0f] text-gray-300 font-mono overflow-hidden">

            {/* LEFT PANEL: NEURAL STREAM */}
            <div className="w-1/3 min-w-[350px] border-r border-[#2a2a35] flex flex-col h-full">
                <div className="p-4 border-b border-[#2a2a35] bg-[#0f0f16]">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        NEURAL_STREAM
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Live feed of AI reasoning & decisions</p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                    {logs.length === 0 ? (
                        <div className="p-8 text-center text-gray-600 text-xs">
                            NO ACTIVITY DETECTED<br />
                            WAITING FOR INPUT...
                        </div>
                    ) : (
                        logs.map(log => (
                            <div
                                key={log.id}
                                onClick={() => setSelectedLog(log)}
                                className={`p-4 border-b border-[#1a1a25] cursor-pointer hover:bg-[#151520] transition-colors ${selectedLog?.id === log.id ? 'bg-[#1a1a25] border-l-2 border-l-brand-accent' : 'border-l-2 border-l-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded border ${getTypeColor(log.type)}`}>
                                        {log.type}
                                    </span>
                                    <span className="text-[10px] text-gray-600">{formatDate(log.timestamp)}</span>
                                </div>
                                <div className="text-xs text-white font-medium mb-1 line-clamp-1">
                                    {log.userPrompt}
                                </div>
                                <div className="text-[10px] text-gray-500 line-clamp-2">
                                    {log.context}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: SYNAPSE DETAIL */}
            <div className="flex-1 flex flex-col h-full bg-[#0d0d12]">
                {selectedLog ? (
                    <>
                        <div className="p-4 border-b border-[#2a2a35] flex justify-between items-center bg-[#0f0f16]">
                            <div>
                                <h2 className="text-sm font-bold text-white mb-1">SYNAPSE_ID: {selectedLog.id}</h2>
                                <div className="flex gap-4 text-xs text-gray-500">
                                    <span>MODEL: {selectedLog.model}</span>
                                    <span>Created: {new Date(selectedLog.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-brand-accent">
                                STATUS: COMPLETE
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">

                            {/* SECTION: CONTEXT */}
                            <div>
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-[#2a2a35] pb-1">Contextual Input</h3>
                                <div className="p-3 bg-[#11111a] rounded border border-[#2a2a35] text-xs text-gray-300">
                                    {selectedLog.context}
                                </div>
                            </div>

                            {/* SECTION: SYSTEM PROMPT (The "Why") */}
                            <div>
                                <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2 border-b border-purple-400/20 pb-1">System Instructions (The Brain)</h3>
                                <div className="p-4 bg-[#11111a] rounded border border-purple-500/20 text-xs text-gray-400 font-mono whitespace-pre-wrap leading-relaxed">
                                    {selectedLog.systemPrompt.trim()}
                                </div>
                            </div>

                            {/* SECTION: OUTPUT */}
                            <div>
                                <h3 className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-2 border-b border-green-400/20 pb-1">Decision / Output</h3>
                                <div className="p-4 bg-[#11111a] rounded border border-green-500/20 text-xs text-green-300 font-mono whitespace-pre-wrap leading-relaxed">
                                    {typeof selectedLog.structuredOutput === 'object'
                                        ? JSON.stringify(selectedLog.structuredOutput, null, 2)
                                        : selectedLog.rawOutput
                                    }
                                </div>
                            </div>

                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                        <div className="w-16 h-16 rounded-full border-2 border-[#2a2a35] flex items-center justify-center mb-4">
                            <span className="text-2xl">🧠</span>
                        </div>
                        <p className="text-xs uppercase tracking-widest">Select a synapse to inspect</p>
                    </div>
                )}
            </div>
        </div>
    );
};
