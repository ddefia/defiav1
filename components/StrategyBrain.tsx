
import React, { useState, useEffect } from 'react';
import { StrategyTask, CalendarEvent, TrendItem, BrandConfig } from '../types';
import { generateStrategicAnalysis, generateTweet, generateWeb3Graphic } from '../services/gemini';
import { fetchMarketPulse } from '../services/pulse';
import { Button } from './Button';

interface StrategyBrainProps {
    brandName: string;
    brandConfig: BrandConfig;
    events: CalendarEvent[];
    onSchedule: (content: string, image?: string) => void;
}

export const StrategyBrain: React.FC<StrategyBrainProps> = ({ brandName, brandConfig, events, onSchedule }) => {
    const [tasks, setTasks] = useState<StrategyTask[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState<string | null>(null); // ID of task being executed
    const [hasAnalyzed, setHasAnalyzed] = useState(false);

    const performAudit = async () => {
        setIsLoading(true);
        try {
            // Fetch fresh trends internally to ensure the brain has the latest news
            const trends = await fetchMarketPulse(brandName);
            const generatedTasks = await generateStrategicAnalysis(brandName, events, trends, brandConfig);
            setTasks(generatedTasks);
            setHasAnalyzed(true);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Auto-run audit on first load if not done
        if (!hasAnalyzed) {
            performAudit();
        }
    }, [brandName]);

    const handleExecuteTask = async (task: StrategyTask) => {
        setIsExecuting(task.id);
        try {
            // 1. Generate Copy
            const copy = await generateTweet(task.executionPrompt, brandName, brandConfig, 'Professional');
            
            // 2. Generate Visual (Contextual)
            const visualPrompt = `Editorial graphic for ${brandName}. Context: ${task.title}. Style: Professional, clean, on-brand.`;
            const image = await generateWeb3Graphic({
                prompt: visualPrompt,
                size: '1K',
                aspectRatio: '16:9',
                brandConfig: brandConfig,
                brandName: brandName
            });

            // 3. Open Schedule Modal with results
            onSchedule(copy, image);

            // 4. Remove task from list (optional, or mark done)
            setTasks(prev => prev.filter(t => t.id !== task.id));

        } catch (e) {
            console.error("Execution failed", e);
            alert("Failed to execute task. Please try again.");
        } finally {
            setIsExecuting(null);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn pb-10">
            {/* Header / Persona */}
            <div className="bg-white p-8 rounded-none border-b-4 border-gray-900 shadow-sm flex flex-col md:flex-row justify-between items-start">
                <div className="flex gap-6">
                    {/* Persona Avatar - Clean/Executive */}
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                         <span className="text-4xl">👩‍💼</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                             <h2 className="text-2xl font-serif font-bold text-gray-900">Gaia</h2>
                             <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-medium tracking-wide">CMO / STRATEGIST</span>
                        </div>
                        <p className="text-gray-600 text-sm max-w-lg leading-relaxed italic">
                            "{isLoading ? "Reviewing your calendar and market position..." : "I've reviewed our upcoming schedule. We have some strategic gaps to address to maintain brand momentum."}"
                        </p>
                    </div>
                </div>
                <Button onClick={performAudit} disabled={isLoading} variant="secondary" className="mt-4 md:mt-0 text-xs h-9 border-gray-300">
                    {isLoading ? 'Consulting...' : 'Update Strategy'}
                </Button>
            </div>

            {/* Task Agenda */}
            <div>
                <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Proposed Agenda Items</h3>
                    <span className="text-xs text-gray-400">{tasks.length} Items Pending</span>
                </div>

                <div className="space-y-4">
                    {isLoading && tasks.length === 0 && (
                        <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                             <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
                             <p className="font-serif">Formulating strategy...</p>
                        </div>
                    )}
                    
                    {!isLoading && tasks.length === 0 && (
                         <div className="p-12 text-center text-gray-400 bg-white rounded-lg border border-gray-200">
                            <p className="font-serif text-lg text-gray-900 mb-2">Agenda Clear</p>
                            <p className="text-sm">No critical gaps detected. Your schedule is optimized.</p>
                            <Button onClick={performAudit} className="mt-4" variant="secondary">Force Review</Button>
                         </div>
                    )}

                    {tasks.map((task, idx) => (
                        <div key={task.id} className="bg-white group rounded-lg border border-gray-200 p-6 flex flex-col md:flex-row gap-6 hover:border-gray-300 hover:shadow-lg transition-all">
                            {/* Priority Column */}
                            <div className="w-full md:w-16 shrink-0 flex flex-col items-center justify-center border-r border-gray-100 pr-6">
                                <span className="text-4xl font-serif font-bold text-gray-200 group-hover:text-gray-900 transition-colors">0{idx + 1}</span>
                            </div>

                            {/* Content Column */}
                            <div className="flex-1 pt-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                        task.type === 'GAP_FILL' ? 'bg-orange-50 text-orange-800 border-orange-200' :
                                        task.type === 'TREND_JACK' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                                        'bg-blue-50 text-blue-800 border-blue-200'
                                    }`}>
                                        {task.type.replace('_', ' ')}
                                    </span>
                                    {task.impactScore >= 8 && <span className="text-[10px] font-bold text-red-600 flex items-center gap-1">★ High Priority</span>}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1 font-serif">{task.title}</h3>
                                <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                                
                                <div className="flex gap-2 text-xs text-gray-400 bg-gray-50 p-2 rounded inline-block border border-gray-100">
                                    <span className="font-bold">Rationale:</span> {task.reasoning}
                                </div>
                            </div>

                            {/* Action Column */}
                            <div className="w-full md:w-40 shrink-0 flex items-center justify-center pl-4 border-l border-gray-100">
                                <Button 
                                    onClick={() => handleExecuteTask(task)} 
                                    disabled={isExecuting !== null}
                                    isLoading={isExecuting === task.id}
                                    className="w-full text-xs h-10 bg-gray-900 text-white hover:bg-black"
                                >
                                    {isExecuting === task.id ? 'Drafting...' : 'Approve Item'}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
