import React from 'react';
import { DailyBrief } from '../types';

interface DailyBriefDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    brief: DailyBrief | null;
    loading: boolean;
}

export const DailyBriefDrawer: React.FC<DailyBriefDrawerProps> = ({ isOpen, onClose, brief, loading }) => {
    return (
        <div className={`fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform transition-transform duration-300 z-50 border-l border-gray-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex flex-col h-full">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        Daily AI Brief
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin"></div>
                            <p className="text-xs text-gray-400 font-mono animate-pulse">ANALYZING DASHBOARD METRICS...</p>
                        </div>
                    ) : !brief ? (
                        <div className="text-center text-gray-400 mt-10 text-sm">
                            Insufficient data to generate brief.
                        </div>
                    ) : (
                        <>
                            {/* A. Key Drivers */}
                            <section>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
                                    A. Key Drivers
                                </h3>
                                <ul className="space-y-3">
                                    {brief.keyDrivers.map((item, i) => (
                                        <li key={i} className="text-xs text-gray-700 leading-relaxed pl-3 border-l-2 border-blue-500">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            {/* B. Decisions Reinforced */}
                            <section>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
                                    B. Decisions Reinforced
                                </h3>
                                <ul className="space-y-3">
                                    {brief.decisionsReinforced.map((item, i) => (
                                        <li key={i} className="text-xs text-gray-700 leading-relaxed pl-3 border-l-2 border-emerald-500">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            {/* C. Risks & Unknowns */}
                            <section>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
                                    C. Risks & Unknowns
                                </h3>
                                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100/50">
                                    <ul className="space-y-3">
                                        {brief.risksAndUnknowns.map((item, i) => (
                                            <li key={i} className="text-xs text-amber-800 leading-relaxed flex items-start gap-2">
                                                <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0"></span>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </section>

                            {/* D. Confidence */}
                            <section>
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">
                                    D. Confidence
                                </h3>
                                <div className="group relative inline-block">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide cursor-help ${brief.confidence.level === 'High' ? 'bg-emerald-100 text-emerald-800' :
                                            brief.confidence.level === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                                'bg-rose-100 text-rose-800'
                                        }`}>
                                        {brief.confidence.level} Confidence
                                    </span>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-black text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed">
                                        {brief.confidence.explanation}
                                    </div>
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 text-[9px] text-gray-400 text-center font-mono">
                    GENERATED BY DEFIA ANALYST • {new Date().toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
};
