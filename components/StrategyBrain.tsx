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
    onFeedback?: (taskId: string, feedback: 'approved' | 'dismissed' | 'neutral') => void;
}

export const StrategyBrain: React.FC<StrategyBrainProps> = ({
    brandName,
    tasks,
    onSchedule,
    onNavigate,
    onRegenerate,
    onFeedback
}) => {
    const [selectedTask, setSelectedTask] = useState<StrategyTask | null>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);

    const buildStudioParams = (task: StrategyTask) => {
        const draft = task.executionPrompt || task.title || '';
        const visualPrompt = task.suggestedVisualTemplate || undefined;
        return { draft, visualPrompt };
    };

    const buildCampaignParams = (task: StrategyTask) => {
        const intent = task.executionPrompt || task.title || '';
        return { intent };
    };

    const handleExecute = (task: StrategyTask) => {
        // Close modal if open
        setSelectedTask(null);

        if (onNavigate) {
            if (task.type === 'CAMPAIGN_IDEA') {
                onNavigate('campaigns', buildCampaignParams(task));
                return;
            }
            onNavigate('studio', buildStudioParams(task));
            return;
        }

        // Fallback: schedule directly
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

            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-display font-bold text-gray-900 flex items-center gap-3">
                        Main Marketing Brain
                        {onRegenerate && (
                            <button
                                onClick={handleRegenClick}
                                disabled={isRegenerating}
                                className={`ml-2 p-2 rounded-full border transition-all ${isRegenerating ? 'bg-gray-50 border-gray-100 text-gray-300' : 'bg-white border-gray-200 text-gray-400 hover:text-emerald-500 hover:border-emerald-200 shadow-sm'}`}
                                title="Refresh Neural Stream"
                            >
                                <svg className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        )}
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1 max-w-xl">
                        Strategic posture and execution-ready actions generated from live market signals, brand memory, and performance metrics.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                            Neural Stream Active
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Incoming Signals</span>
                    <div className="h-[1px] flex-1 bg-zinc-100"></div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {tasks.map(task => (
                        <StrategyActionCard
                            key={task.id}
                            task={task}
                            onFeedback={onFeedback}
                            onConfigure={() => setSelectedTask(task)}
                        />
                    ))}

                    {tasks.length === 0 && (
                        <div className="p-12 text-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                            <p className="text-gray-400 text-sm font-medium">Neural Stream is calibrating. No active signals.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed View Modal */}
            {selectedTask && (
                <StrategyDetailView
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onExecute={() => handleExecute(selectedTask)}
                    onFeedback={(feedback) => {
                        if (onFeedback) onFeedback(selectedTask.id, feedback);
                    }}
                />
            )}
        </div>
    );
};
