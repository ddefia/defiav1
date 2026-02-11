import React from 'react';
import { DailyBrief } from '../types';

interface DailyBriefDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    brief: DailyBrief | null;
    loading: boolean;
}

export const DailyBriefDrawer: React.FC<DailyBriefDrawerProps> = ({ isOpen, onClose, brief, loading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-[680px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
                style={{
                    backgroundColor: '#0A0A0B',
                    border: '1px solid #FF5C0033',
                    boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,92,0,0.08), 0 0 120px rgba(255,92,0,0.06)',
                    animation: 'briefModalIn 0.25s ease-out',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <style>{`
                    @keyframes briefModalIn {
                        from { opacity: 0; transform: scale(0.96) translateY(8px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                `}</style>

                {/* Header */}
                <div className="px-7 py-5 border-b border-[#1F1F23] flex items-center justify-between flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #111113 0%, #1A120D 100%)' }}>
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center shadow-lg shadow-[#FF5C0020]">
                            <span className="material-symbols-sharp text-white text-xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>auto_awesome</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Daily Brief</h2>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse"></span>
                                <span className="text-[10px] font-semibold text-[#22C55E] tracking-wider uppercase">Live Analysis</span>
                                {brief && (
                                    <span className="text-[10px] text-[#4A4A4E] ml-1">
                                        · {new Date(brief.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-[#1F1F23] flex items-center justify-center text-[#6B6B70] hover:text-white hover:bg-[#2A2A2E] transition-colors"
                    >
                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-7">

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4">
                            <div className="w-8 h-8 rounded-full border-2 border-[#1F1F23] border-t-[#FF5C00] animate-spin"></div>
                            <p className="text-xs text-[#6B6B70] font-medium animate-pulse tracking-wider uppercase">Analyzing signals...</p>
                        </div>
                    ) : !brief ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-14 h-14 rounded-2xl bg-[#1F1F23] flex items-center justify-center mb-4">
                                <span className="material-symbols-sharp text-[#4A4A4E] text-2xl" style={{ fontVariationSettings: "'wght' 200" }}>query_stats</span>
                            </div>
                            <p className="text-sm text-[#6B6B70]">Insufficient signal data.</p>
                            <p className="text-xs text-[#4A4A4E] mt-1">The brief will appear after the next analysis cycle.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-5">
                            {/* Key Drivers — full width */}
                            <div className="col-span-2">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-sharp text-[#FF5C00] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>trending_up</span>
                                    <h3 className="text-[11px] font-bold text-[#FF5C00] uppercase tracking-[0.15em]">Key Drivers</h3>
                                </div>
                                <div className="space-y-2">
                                    {brief.keyDrivers.map((item, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-[#111113] border border-[#1F1F23]">
                                            <span className="material-symbols-sharp text-[#3B82F6] text-base mt-0.5 shrink-0" style={{ fontVariationSettings: "'wght' 300" }}>bolt</span>
                                            <p className="text-[13px] text-[#C4C4C4] leading-relaxed">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Decisions Reinforced — left col */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-sharp text-[#22C55E] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>verified</span>
                                    <h3 className="text-[11px] font-bold text-[#22C55E] uppercase tracking-[0.15em]">Reinforced</h3>
                                </div>
                                <div className="space-y-2">
                                    {brief.decisionsReinforced.map((item, i) => (
                                        <div key={i} className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#111113] border border-[#1F1F23]">
                                            <span className="material-symbols-sharp text-[#22C55E] text-sm mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check_circle</span>
                                            <p className="text-[13px] text-[#C4C4C4] leading-relaxed">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Risks & Unknowns — right col */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-sharp text-[#F59E0B] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>warning</span>
                                    <h3 className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-[0.15em]">Risks</h3>
                                </div>
                                <div className="rounded-xl bg-[#F59E0B06] border border-[#F59E0B18] p-4 space-y-2.5">
                                    {brief.risksAndUnknowns.map((item, i) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                            <span className="material-symbols-sharp text-[#F59E0B] text-sm mt-0.5 shrink-0" style={{ fontVariationSettings: "'wght' 300" }}>error</span>
                                            <p className="text-[13px] text-[#D4A94E] leading-relaxed">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Confidence — full width */}
                            <div className="col-span-2 pt-1">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-sharp text-[#8B5CF6] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>psychology</span>
                                    <h3 className="text-[11px] font-bold text-[#8B5CF6] uppercase tracking-[0.15em]">Confidence</h3>
                                </div>
                                <div className="p-4 rounded-xl bg-[#111113] border border-[#1F1F23]">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
                                            brief.confidence.level === 'High' ? 'bg-[#22C55E18] text-[#22C55E] border border-[#22C55E33]' :
                                            brief.confidence.level === 'Medium' ? 'bg-[#F59E0B18] text-[#F59E0B] border border-[#F59E0B33]' :
                                            'bg-[#EF444418] text-[#EF4444] border border-[#EF444433]'
                                        }`}>
                                            {brief.confidence.level}
                                        </span>
                                        <div className="flex-1 h-2 rounded-full bg-[#1F1F23] overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${
                                                brief.confidence.level === 'High' ? 'w-[90%] bg-gradient-to-r from-[#22C55E] to-[#4ADE80]' :
                                                brief.confidence.level === 'Medium' ? 'w-[60%] bg-gradient-to-r from-[#F59E0B] to-[#FBBF24]' :
                                                'w-[30%] bg-gradient-to-r from-[#EF4444] to-[#F87171]'
                                            }`}></div>
                                        </div>
                                    </div>
                                    <p className="text-[13px] text-[#8B8B8F] leading-relaxed">{brief.confidence.explanation}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-7 py-3 border-t border-[#1F1F23] bg-[#0A0A0B] flex items-center justify-between flex-shrink-0">
                    <span className="text-[10px] text-[#4A4A4E] font-medium tracking-wider uppercase">AI Analysis</span>
                    <span className="text-[10px] text-[#4A4A4E] font-mono">{new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
};
