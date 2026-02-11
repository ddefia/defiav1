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
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Drawer */}
            <div className={`fixed inset-y-0 right-0 w-[420px] bg-[#0A0A0B] shadow-2xl transform transition-transform duration-300 z-50 border-l border-[#1F1F23] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full">

                    {/* Header */}
                    <div className="px-6 py-5 border-b border-[#1F1F23] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center">
                                <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>summarize</span>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white tracking-tight">Daily Brief</h2>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse"></span>
                                    <span className="text-[10px] font-medium text-[#22C55E] tracking-wider uppercase">Live Analysis</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#1F1F23] flex items-center justify-center text-[#6B6B70] hover:text-white hover:bg-[#2A2A2E] transition-colors">
                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-7">

                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-48 space-y-4">
                                <div className="w-8 h-8 rounded-full border-2 border-[#1F1F23] border-t-[#FF5C00] animate-spin"></div>
                                <p className="text-xs text-[#6B6B70] font-medium animate-pulse tracking-wider uppercase">Analyzing signal data...</p>
                            </div>
                        ) : !brief ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="w-14 h-14 rounded-2xl bg-[#1F1F23] flex items-center justify-center mb-4">
                                    <span className="material-symbols-sharp text-[#4A4A4E] text-2xl" style={{ fontVariationSettings: "'wght' 200" }}>query_stats</span>
                                </div>
                                <p className="text-sm text-[#6B6B70]">Insufficient signal data.</p>
                                <p className="text-xs text-[#4A4A4E] mt-1">The brief will appear after the next analysis cycle.</p>
                            </div>
                        ) : (
                            <>
                                {/* A. Key Drivers */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-sharp text-[#FF5C00] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>trending_up</span>
                                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Key Drivers</h3>
                                    </div>
                                    <div className="space-y-2.5">
                                        {brief.keyDrivers.map((item, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#111113] border border-[#1F1F23]">
                                                <span className="material-symbols-sharp text-[#3B82F6] text-base mt-0.5 shrink-0" style={{ fontVariationSettings: "'wght' 300" }}>bolt</span>
                                                <p className="text-[13px] text-[#C4C4C4] leading-relaxed">{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* B. Decisions Reinforced */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-sharp text-[#22C55E] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>verified</span>
                                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Decisions Reinforced</h3>
                                    </div>
                                    <div className="space-y-2.5">
                                        {brief.decisionsReinforced.map((item, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#111113] border border-[#1F1F23]">
                                                <span className="material-symbols-sharp text-[#22C55E] text-base mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check_circle</span>
                                                <p className="text-[13px] text-[#C4C4C4] leading-relaxed">{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* C. Risks & Unknowns */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-sharp text-[#F59E0B] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>warning</span>
                                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Risks & Unknowns</h3>
                                    </div>
                                    <div className="rounded-xl bg-[#F59E0B08] border border-[#F59E0B22] p-4 space-y-2.5">
                                        {brief.risksAndUnknowns.map((item, i) => (
                                            <div key={i} className="flex items-start gap-2.5">
                                                <span className="material-symbols-sharp text-[#F59E0B] text-sm mt-0.5 shrink-0" style={{ fontVariationSettings: "'wght' 300" }}>error</span>
                                                <p className="text-[13px] text-[#F5C563] leading-relaxed">{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* D. Confidence */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-sharp text-[#8B5CF6] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>psychology</span>
                                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Confidence</h3>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[#111113] border border-[#1F1F23]">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                                                brief.confidence.level === 'High' ? 'bg-[#22C55E18] text-[#22C55E] border border-[#22C55E33]' :
                                                brief.confidence.level === 'Medium' ? 'bg-[#F59E0B18] text-[#F59E0B] border border-[#F59E0B33]' :
                                                'bg-[#EF444418] text-[#EF4444] border border-[#EF444433]'
                                            }`}>
                                                {brief.confidence.level}
                                            </span>
                                            <div className="flex-1 h-1.5 rounded-full bg-[#1F1F23] overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${
                                                    brief.confidence.level === 'High' ? 'w-[90%] bg-[#22C55E]' :
                                                    brief.confidence.level === 'Medium' ? 'w-[60%] bg-[#F59E0B]' :
                                                    'w-[30%] bg-[#EF4444]'
                                                }`}></div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-[#8B8B8F] leading-relaxed">{brief.confidence.explanation}</p>
                                    </div>
                                </section>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3.5 border-t border-[#1F1F23] bg-[#0A0A0B] flex items-center justify-between">
                        <span className="text-[10px] text-[#4A4A4E] font-medium tracking-wider uppercase">System Analysis</span>
                        <span className="text-[10px] text-[#4A4A4E] font-mono">{new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>
        </>
    );
};
