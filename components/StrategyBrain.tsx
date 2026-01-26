import React, { useState } from 'react';
import { BrandConfig, CalendarEvent, GrowthReport, StrategyTask } from '../types';
import { StrategyActionCard } from './StrategyActionCard';
import { StrategyDetailView } from './StrategyDetailView';

interface StrategyBrainProps {
    brandName: string;
    brandConfig: BrandConfig;
    events: CalendarEvent[];
    growthReport?: GrowthReport | null; // Optional
    onSchedule: (content: string, image?: string) => void;
    tasks: StrategyTask[];
    onUpdateTasks: (t: StrategyTask[]) => void;
    onNavigate: (section: string, params?: any) => void;
    onRegenerate?: () => Promise<void>; // New: Optional regen
}

export const StrategyBrain: React.FC<StrategyBrainProps> = ({
    brandName,
    tasks,
    onSchedule,
    onRegenerate
}) => {
    const [selectedTask, setSelectedTask] = useState<StrategyTask | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const handleExecute = (task: StrategyTask) => {
        // Close modal if open
        setSelectedTask(null);
        // Pre-fill schedule
        onSchedule(task.executionPrompt, task.suggestedVisualTemplate);
    };

    const handleRegenClick = async () => {
        if (!onRegenerate) return;
        setIsRegenerating(true);
        try {
            await onRegenerate();
        } finally {
            setIsRegenerating(false);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative overflow-hidden">
            {/* Subtle Gradient Background for Header Area */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 opacity-80"></div>

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-display font-bold text-gray-900 flex items-center gap-3">
                        <span className="text-2xl">🧠</span>
                        Strategic Intelligence
                        {onRegenerate && (
                            <button
                                onClick={handleRegenClick}
                                disabled={isRegenerating}
                                className={`ml-2 p-1.5 rounded-full border transition-all ${isRegenerating ? 'bg-gray-50 border-gray-100 text-gray-300' : 'bg-white border-gray-200 text-gray-400 hover:text-emerald-500 hover:border-emerald-200 shadow-sm'}`}
                                title="Refresh Intelligence"
                            >
                                <svg className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        )}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 font-medium ml-1">
                        AI-generated high-leverage opportunities based on market conditions.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50">
                        {tasks.length} Active Signals
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {tasks.map(task => (
                    <StrategyActionCard
                        key={task.id}
                        task={task}
                        onConfigure={() => setSelectedTask(task)}
                    />
                ))}

                {tasks.length === 0 && (
                    <div className="p-8 text-center border-2 border-dashed border-gray-100 rounded-lg">
                        <p className="text-gray-400 text-sm">No strategic signals at this time.</p>
                    </div>
                )}
            </div>

            {/* Detailed View Modal */}
            {selectedTask && (
                <StrategyDetailView
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onExecute={() => handleExecute(selectedTask)}
                />
            )}
        </div>
    );
};
