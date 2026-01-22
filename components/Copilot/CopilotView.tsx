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
                // Trigger Campaign Generation
                aiContent = `Drafting campaign regarding: ${classification.params?.campaignTopic}...`;
                // Ideally we call the real tool here or show a "Drafting..." card
                // For MVP Deep Integration, we can effectively call the service if we want instant results
                // Or we ask for confirmation.
                // Let's implement "Instant Preview"
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
                role: 'assistant', // Fallback
                content: "Sorry, I encountered an error processing that request.",
                timestamp: Date.now()
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-brand-bg text-brand-text relative overflow-hidden">
            {/* HEADER */}
            <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-surface/50 backdrop-blur-md z-10">
                <div>
                    <h1 className="text-2xl font-display font-bold text-white flex items-center gap-3">
                        <span className="w-3 h-3 bg-purple-500 rounded-full animate-pulse shadow-[0_0_10px_#A855F7]"></span>
                        Copilot
                    </h1>
                    <p className="text-brand-muted text-sm">Orchestrating growth for {brandName}</p>
                </div>
            </div>

            {/* CHAT STREAM */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-2xl p-4 rounded-xl ${msg.role === 'user' ? 'bg-brand-accent text-white rounded-br-none' : 'bg-brand-surface border border-brand-border rounded-bl-none'}`}>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                            {/* RENDER CARDS BASED ON INTENT */}
                            {msg.intent && msg.intent.uiCard === 'CampaignCard' && (
                                <CampaignCard params={msg.intent.params} brandName={brandName} brandConfig={brandConfig} />
                            )}
                            {msg.intent && msg.intent.uiCard === 'ImageCard' && (
                                <ImagePreviewCard params={msg.intent.params} brandName={brandName} brandConfig={brandConfig} />
                            )}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="bg-brand-surface border border-brand-border rounded-xl rounded-bl-none p-4 flex items-center gap-2">
                            <span className="w-2 h-2 bg-brand-muted rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-brand-muted rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-brand-muted rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <div className="p-6 border-t border-brand-border bg-brand-bg relative z-20">
                <div className="relative max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask Copilot to create a campaign, generate an image, or analyze trends..."
                        className="w-full bg-brand-surface border border-brand-border rounded-2xl py-4 pl-6 pr-16 text-white placeholder-brand-muted focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all shadow-xl"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isThinking}
                        className="absolute right-2 top-2 bottom-2 aspect-square bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all"
                    >
                        Start
                    </button>
                </div>
            </div>
        </div>
    );
};
