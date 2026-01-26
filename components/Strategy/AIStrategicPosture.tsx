import React, { useState, useEffect } from 'react';
import { StrategyTask, StrategicPosture } from '../../types';
import { StrategyActionCard } from '../StrategyActionCard';

interface AIStrategicPostureProps {
    brandName: string;
    tasks?: StrategyTask[];
    posture: StrategicPosture;
    onUpdate: (newPosture: StrategicPosture) => void;
    onRefine?: () => void;
    isRefining?: boolean;
    onSchedule?: (content: string, image?: string) => void;
}

export const AIStrategicPosture: React.FC<AIStrategicPostureProps> = ({
    brandName,
    tasks = [],
    posture,
    onUpdate,
    onRefine,
    isRefining = false,
    onSchedule
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editState, setEditState] = useState<StrategicPosture>(posture);

    // Sync state when props change (unless editing)
    useEffect(() => {
        if (!isEditing) setEditState(posture);
    }, [posture, isEditing]);

    const handleSave = () => {
        onUpdate(editState);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditState(posture);
        setIsEditing(false);
    };

    const handleExecuteTask = (task: StrategyTask) => {
        if (onSchedule) {
            onSchedule(task.executionPrompt, task.suggestedVisualTemplate);
        }
    };

    // Helper for List Editing
    const updateList = (field: 'priorities' | 'deprioritized', index: number, value: string) => {
        const newList = [...editState[field]];
        newList[index] = value;
        setEditState({ ...editState, [field]: newList });
    };

    const addListItem = (field: 'priorities' | 'deprioritized') => {
        setEditState({ ...editState, [field]: [...editState[field], "New Item"] });
    };

    const removeListItem = (field: 'priorities' | 'deprioritized', index: number) => {
        const newList = [...editState[field]].filter((_, i) => i !== index);
        setEditState({ ...editState, [field]: newList });
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

                    {/* ACTION BUTTONS */}
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={handleCancel} className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50">
                                    Cancel
                                </button>
                                <button onClick={handleSave} className="px-3 py-1.5 text-xs font-bold text-white bg-black border border-black rounded hover:bg-gray-800">
                                    Save Changes
                                </button>
                            </>
                        ) : (
                            <>
                                {onRefine && (
                                    <button
                                        onClick={onRefine}
                                        disabled={isRefining}
                                        className={`px-3 py-1.5 text-xs font-bold border rounded flex items-center gap-2 ${isRefining ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                                    >
                                        {isRefining ? (
                                            <><span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span> AI Refining...</>
                                        ) : (
                                            <>✨ AI Refine</>
                                        )}
                                    </button>
                                )}
                                <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                                    Edit
                                </button>
                            </>
                        )}
                    </div>

                    <div className="h-6 w-px bg-gray-200"></div>

                    <div className="text-right hidden sm:block">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Scope</div>
                        <div className="text-xs font-bold text-gray-900">{brandName}</div>
                    </div>
                </div>
            </div>

            {/* TOP ROW: REMOVED as per user feedback ("why do i have those 4 components") */}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* LEFT COLUMN: STRATEGY (8 Cols) */}
                <div className="md:col-span-8 flex flex-col gap-6">

                    {/* OBJECTIVE CARD (High Signal) */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-start md:items-center flex-col md:flex-row gap-2">
                            <div>
                                <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-widest">Primary Objective</h3>

                                {/* Moved Metadata Here */}
                                <div className="flex items-center gap-3 mt-1.5">
                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-emerald-100 bg-emerald-50">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        <span className="text-[10px] font-bold text-emerald-700 uppercase">{posture.confidenceLevel} Confidence</span>
                                    </div>
                                    <span className="text-gray-300 text-[10px]">|</span>
                                    <span className="text-[10px] font-mono text-gray-500 font-medium">Horizon: {posture.timeHorizon}</span>
                                </div>
                            </div>

                            {isEditing ? (
                                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100 animate-pulse">EDITING MODE</span>
                            ) : (
                                <span className="text-[10px] font-mono text-gray-400">OBJ-01</span>
                            )}
                        </div>
                        <div className="p-6">
                            {isEditing ? (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                        <label className="text-[10px] font-bold text-blue-900 uppercase mb-2 block">Objective Statement</label>
                                        <textarea
                                            value={editState.objective}
                                            onChange={(e) => setEditState({ ...editState, objective: e.target.value })}
                                            className="w-full text-lg font-medium text-gray-900 p-3 border border-gray-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white shadow-sm transition-all"
                                            rows={2}
                                            placeholder="Define the primary strategic goal..."
                                        />
                                    </div>
                                    <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Strategic Thesis</label>
                                        <textarea
                                            value={editState.thesis}
                                            onChange={(e) => setEditState({ ...editState, thesis: e.target.value })}
                                            className="w-full text-sm text-gray-600 italic leading-relaxed p-3 border border-gray-200 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white shadow-sm transition-all"
                                            rows={3}
                                            placeholder="Explain the reasoning behind this objective..."
                                        />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="text-lg font-medium text-gray-900 leading-relaxed tracking-tight mb-4">
                                        {posture.objective}
                                    </p>
                                    <div className="flex items-start gap-3 p-4 bg-gray-50/50 rounded-lg border border-gray-100">
                                        <span className="text-gray-300 text-2xl serif leading-none">“</span>
                                        <p className="text-sm text-gray-600 italic leading-relaxed">
                                            {posture.thesis}
                                        </p>
                                    </div>
                                </>
                            )}
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
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Mandates</h3>
                            {isEditing && <button onClick={() => addListItem('priorities')} className="text-[10px] text-blue-600 font-bold hover:underline">+ Add</button>}
                        </div>
                        <div className="divide-y divide-gray-50">
                            {(isEditing ? editState.priorities : posture.priorities).map((item, i) => (
                                <div key={i} className="p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors group">
                                    <span className="text-[10px] font-mono text-gray-400 font-bold bg-gray-100 px-1.5 rounded flex-shrink-0 mt-0.5">{i + 1}</span>
                                    {isEditing ? (
                                        <div className="flex-1 flex gap-2">
                                            <input
                                                value={item}
                                                onChange={(e) => updateList('priorities', i, e.target.value)}
                                                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-sm transition-all"
                                            />
                                            <button onClick={() => removeListItem('priorities', i)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-medium text-gray-700 leading-snug">{item}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CONSTRAINTS */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Restricted</h3>
                            {isEditing && <button onClick={() => addListItem('deprioritized')} className="text-[10px] text-blue-600 font-bold hover:underline">+ Add</button>}
                        </div>
                        <div className="divide-y divide-gray-50">
                            {(isEditing ? editState.deprioritized : posture.deprioritized).map((item, i) => (
                                <div key={i} className="p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors opacity-75 group">
                                    <span className="text-[10px] font-mono text-gray-300 flex-shrink-0 mt-0.5">✕</span>
                                    {isEditing ? (
                                        <div className="flex-1 flex gap-2">
                                            <input
                                                value={item}
                                                onChange={(e) => updateList('deprioritized', i, e.target.value)}
                                                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-sm transition-all"
                                            />
                                            <button onClick={() => removeListItem('deprioritized', i)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-500 leading-snug">{item}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CHANGE LOG (Visible in Edit Mode or if Expanded? Just show last update for now) */}
                    <div className="text-center">
                        <p className="text-[10px] text-gray-400">
                            Last Updated: {new Date(posture.lastUpdated).toLocaleDateString()} (v{posture.version})
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
};

