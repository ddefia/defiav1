import React, { useState, useEffect, useRef } from 'react';

export const THINKING_EVENT = 'defia-thinking';

export const dispatchThinking = (message: string, detail?: any) => {
    const event = new CustomEvent(THINKING_EVENT, { detail: { message, detail, timestamp: Date.now() } });
    window.dispatchEvent(event);
};

interface ThinkingLog {
    id: string;
    message: string;
    timestamp: number;
    detail?: any;
}

export const ThinkingConsole: React.FC = () => {
    const [logs, setLogs] = useState<ThinkingLog[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handleEvent = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            const newLog = {
                id: Math.random().toString(36).substr(2, 9),
                message: detail.message,
                timestamp: detail.timestamp,
                detail: detail.detail
            };

            setLogs(prev => [...prev, newLog].slice(-20)); // Keep fewer logs
            setIsExpanded(true);

            // Reset Hide Timer (5s of inactivity = minimize)
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = setTimeout(() => {
                setIsExpanded(false);
            }, 5000);
        };

        window.addEventListener(THINKING_EVENT, handleEvent);
        return () => {
            window.removeEventListener(THINKING_EVENT, handleEvent);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (isExpanded && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isExpanded]);

    const hasLogs = logs.length > 0;

    return (
        <>
            {/* MINIMIZED HANDLE (Only visible when has logs and NOT expanded) */}
            <div
                onClick={() => setIsExpanded(true)}
                className={`fixed bottom-0 left-1/2 -translate-x-1/2 z-[190] transition-transform duration-500 ease-in-out cursor-pointer group ${hasLogs && !isExpanded ? 'translate-y-0' : 'translate-y-full'
                    }`}
            >
                <div className="bg-gray-900/90 backdrop-blur border-t border-x border-gray-700 rounded-t-lg px-6 py-1.5 flex items-center gap-2 shadow-2xl hover:bg-gray-800 transition-colors">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[10px] font-mono font-bold text-green-400 uppercase tracking-wider">Neural Feed Active</span>
                    <span className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors ml-2">Show Logs ▲</span>
                </div>
            </div>

            {/* EXPANDED CONSOLE */}
            <div
                className={`fixed bottom-0 left-0 right-0 z-[200] transition-transform duration-500 ease-in-out transform ${isExpanded ? 'translate-y-0' : 'translate-y-full'
                    }`}
            >
                <div className="mx-auto max-w-3xl bg-gray-900/95 backdrop-blur-xl border-t border-x border-gray-700 rounded-t-2xl shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[40vh]">

                    {/* STATUS BAR */}
                    <div
                        className="flex items-center justify-between px-3 py-1.5 bg-gray-800/50 border-b border-gray-700 cursor-pointer hover:bg-gray-800"
                        onClick={() => setIsExpanded(false)}
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Neural Processing Unit</span>
                        </div>
                        <span className="text-[10px] text-gray-500 hover:text-white">▼ Minimize</span>
                    </div>

                    <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div key={log.id} className="animate-fadeInSlideUp">
                                    <div className="flex gap-3 items-start">
                                        <span className="text-gray-600 shrink-0 font-light hidden sm:block">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        <div className="flex-1">
                                            <div className="flex items-start gap-2">
                                                <span className="text-green-500 font-bold shrink-0">{'>'}</span>
                                                <span className="text-gray-200 font-medium leading-relaxed">{log.message}</span>
                                            </div>
                                            {log.detail && (
                                                <div className="mt-1.5 ml-4 pl-3 border-l border-gray-700/50 text-gray-400 font-light leading-relaxed">
                                                    {typeof log.detail === 'string' ? log.detail : JSON.stringify(log.detail).replace(/[{"}]/g, ' ').trim()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={bottomRef} className="h-px" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
