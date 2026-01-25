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
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        🧠 Strategic Intelligence
                        {onRegenerate && (
                            <button
                                onClick={handleRegenClick}
                                disabled={isRegenerating}
                                className={`ml-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border rounded transition-all ${isRegenerating ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                            >
                                {isRegenerating ? 'Syncing...' : '↻ Refresh'}
                            </button>
                        )}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        AI-generated high-leverage opportunities based on market conditions.
                    </p>
                </div>
                <div className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-mono">
                    {tasks.length} Active Signals
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
