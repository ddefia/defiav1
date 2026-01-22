import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../Button';
import { BrandConfig, ChatMessage, ChatIntentResponse, CalendarEvent, StrategyTask, GrowthReport } from '../../types';
import { classifyAndPopulate } from '../../services/gemini';
import { generateCampaignDrafts, generateWeb3Graphic } from '../../services/gemini';
import { CampaignCard } from './ActionCards/CampaignCard';
import { ImagePreviewCard } from './ActionCards/ImagePreviewCard';

interface CopilotViewProps {
    brandName: string;
    brandConfig: BrandConfig;
    calendarEvents: CalendarEvent[];
    strategyTasks: StrategyTask[];
    growthReport: GrowthReport | null; // Nullable
}

export const CopilotView: React.FC<CopilotViewProps> = ({ brandName, brandConfig, calendarEvents, strategyTasks, growthReport }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: `Hello! I'm your specific AI Copilot for ${brandName}. I can create campaigns, generate visuals, or research market trends. To get started, just ask!`,
            timestamp: Date.now()
        }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: ChatMessage = {
            id: `usr-${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);

        try {
            // 1. Classify Intent WITH CONTEXT
            const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

            const marketingContext = {
                calendar: calendarEvents,
                tasks: strategyTasks,
                report: growthReport
            };

            const classification = await classifyAndPopulate(history, brandConfig, marketingContext);

            // 2. Prepare AI Response Placeholder
            const aiMsgId = `ai-${Date.now()}`;

            // 3. Execute Based on Intent (Orchestration Layer)
            let aiContent = classification.thoughtProcess || "Processing request...";
            let cardData = null;

            if (classification.type === 'MISSING_INFO') {
                aiContent = classification.missingInfo ? classification.missingInfo[0] : "Could you provide more details?";
            } else if (classification.type === 'CREATE_CAMPAIGN') {
                aiContent = `Drafting campaign regarding: ${classification.params?.campaignTopic}...`;
            } else if (classification.type === 'GENERATE_IMAGE') {
                aiContent = `Generating visual for: ${classification.params?.imagePrompt}...`;
            }

            const aiMsg: ChatMessage = {
                id: aiMsgId,
                role: 'assistant',
                content: aiContent,
                timestamp: Date.now(),
                intent: classification
            };

            setMessages(prev => [...prev, aiMsg]);

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                id: `err-${Date.now()}`,
                role: 'assistant',
                content: "Sorry, I encountered an error processing that request.",
                timestamp: Date.now()
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-zinc-100 relative overflow-hidden font-sans">

            {/* HEADER */}
            <div className="absolute top-0 inset-x-0 h-16 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md z-30 flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-white tracking-wide">Copilot</h1>
                        <p className="text-[10px] text-zinc-400 font-medium tracking-wider uppercase">Active Agent for {brandName}</p>
                    </div>
                </div>
            </div>

            {/* CHAT STREAM */}
            <div className="flex-1 overflow-y-auto pt-24 pb-32 px-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                <div className="max-w-3xl mx-auto space-y-8">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`group flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn duration-300`}>

                            {/* AI AVATAR */}
                            {msg.role === 'assistant' && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center mt-1">
                                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                </div>
                            )}

                            {/* MESSAGE BUBBLE */}
                            <div className={`
                                max-w-[85%] relative
                                ${msg.role === 'user' ? 'flex flex-row-reverse gap-3' : ''}
                            `}>
                                <div className={`
                                    px-6 py-4 rounded-2xl text-[15px] leading-relaxed shadow-sm
                                    ${msg.role === 'user'
                                        ? 'bg-[#2F2F2F] text-white rounded-tr-sm'
                                        : 'bg-transparent text-zinc-100 pl-0'}
                                `}>
                                    <p className="whitespace-pre-wrap">{msg.content}</p>

                                    {/* RENDER CARDS BASED ON INTENT (AI ONLY) */}
                                    {msg.intent && msg.role === 'assistant' && (
                                        <div className="mt-5 space-y-4">
                                            {msg.intent.uiCard === 'CampaignCard' && (
                                                <div className="border border-white/10 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
                                                    <CampaignCard params={msg.intent.params} brandName={brandName} brandConfig={brandConfig} />
                                                </div>
                                            )}
                                            {msg.intent.uiCard === 'ImageCard' && (
                                                <div className="border border-white/10 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
                                                    <ImagePreviewCard params={msg.intent.params} brandName={brandName} brandConfig={brandConfig} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    ))}

                    {isThinking && (
                        <div className="flex gap-4 animate-pulse">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center mt-1">
                                <span className="w-2 h-2 bg-zinc-500 rounded-full animate-ping"></span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2.5">
                                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-75"></div>
                                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* INPUT AREA */}
            <div className="absolute bottom-0 inset-x-0 pb-8 pt-20 bg-gradient-to-t from-[#09090b] via-[#09090b]/90 to-transparent z-20 pointer-events-none">
                <div className="max-w-3xl mx-auto px-4 pointer-events-auto">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                        <div className="relative flex items-end gap-2 bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-2">

                            {/* TEXTAREA (Auto-growing could be added, keeping simple input for now but styled better) */}
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Message Copilot..."
                                className="w-full bg-transparent border-none text-white placeholder-zinc-500 focus:ring-0 py-3 px-4 text-[15px]"
                                autoFocus
                            />

                            {/* SEND BUTTON */}
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isThinking}
                                className={`
                                    p-2 rounded-xl flex-shrink-0 transition-all duration-200
                                    ${input.trim()
                                        ? 'bg-white text-black hover:bg-gray-200'
                                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}
                                `}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                        <p className="text-center text-[10px] text-zinc-600 mt-3 font-medium">
                            Copilot can make mistakes. Check important information.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
};
