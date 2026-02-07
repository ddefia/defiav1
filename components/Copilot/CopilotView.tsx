import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { BrandConfig, ChatMessage, CalendarEvent, StrategyTask, GrowthReport, SocialMetrics } from '../../types';
import { classifyAndPopulate, generateGeneralChatResponse } from '../../services/gemini';
import { CampaignCard } from './ActionCards/CampaignCard';
import { ImagePreviewCard } from './ActionCards/ImagePreviewCard';
import { ContentCard } from './ActionCards/ContentCard';

interface CopilotViewProps {
    brandName: string;
    brandConfig: BrandConfig;
    calendarEvents: CalendarEvent[];
    strategyTasks: StrategyTask[];
    growthReport: GrowthReport | null;
    socialMetrics: SocialMetrics | null;
    agentDecisions: any[];
    onNavigate: (section: string, params?: any) => void;
}

interface ChatHistoryItem {
    id: string;
    title: string;
    preview: string;
    timestamp: number;
    messages: ChatMessage[];
}

const STORAGE_KEY_PREFIX = 'defia_copilot_history_';

// Build a dynamic welcome message based on real data
const buildWelcomeContent = (brandName: string, brandConfig: BrandConfig, socialMetrics: SocialMetrics | null, calendarEvents: CalendarEvent[], strategyTasks: StrategyTask[], agentDecisions: any[]): string => {
    const parts: string[] = [];
    parts.push(`Hey! I'm your AI CMO for **${brandName}**. I have access to your knowledge base, social data, calendar, and strategic context — ask me anything.\n`);

    // Show real metrics summary if available
    const dataPoints: string[] = [];
    if (socialMetrics && socialMetrics.totalFollowers > 0) {
        dataPoints.push(`**${(socialMetrics.totalFollowers / 1000).toFixed(1)}K** followers`);
    }
    if (socialMetrics && socialMetrics.engagementRate > 0) {
        dataPoints.push(`**${socialMetrics.engagementRate.toFixed(1)}%** engagement rate`);
    }
    if (calendarEvents.length > 0) {
        const upcoming = calendarEvents.filter(e => new Date(e.scheduledAt || e.date) >= new Date()).length;
        if (upcoming > 0) dataPoints.push(`**${upcoming}** upcoming posts scheduled`);
    }
    if (strategyTasks.length > 0) {
        const pending = strategyTasks.filter(t => t.status === 'pending').length;
        if (pending > 0) dataPoints.push(`**${pending}** pending strategy tasks`);
    }
    if (agentDecisions && agentDecisions.length > 0) {
        dataPoints.push(`**${agentDecisions.length}** agent decisions to review`);
    }

    if (dataPoints.length > 0) {
        parts.push(`Here's what I see right now:\n${dataPoints.map(d => `• ${d}`).join('\n')}`);
    }

    // Knowledge base
    if (brandConfig?.knowledgeBase?.length > 0) {
        parts.push(`\n📚 I have **${brandConfig.knowledgeBase.length}** knowledge base entries loaded for context.`);
    }

    parts.push(`\nWhat would you like to work on?`);
    return parts.join('\n');
};

export const CopilotView: React.FC<CopilotViewProps> = ({
    brandName,
    brandConfig,
    calendarEvents,
    strategyTasks,
    growthReport,
    socialMetrics,
    agentDecisions,
    onNavigate
}) => {
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [showHistory, setShowHistory] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load chat history from localStorage
    const storageKey = `${STORAGE_KEY_PREFIX}${brandName}`;
    const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) { }
        return [];
    });

    const [activeChat, setActiveChat] = useState<string>(() => {
        return chatHistory.length > 0 ? chatHistory[0].id : `chat-${Date.now()}`;
    });

    // Build the welcome message dynamically
    const welcomeMessage = useMemo(() => buildWelcomeContent(
        brandName, brandConfig, socialMetrics, calendarEvents, strategyTasks, agentDecisions
    ), [brandName]);

    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        // Check if active chat has saved messages
        if (chatHistory.length > 0) {
            const active = chatHistory.find(c => c.id === activeChat);
            if (active && active.messages && active.messages.length > 0) return active.messages;
        }
        return [{
            id: 'welcome',
            role: 'assistant' as const,
            content: welcomeMessage,
            timestamp: Date.now()
        }];
    });

    // Persist chat history to localStorage
    const persistHistory = useCallback((history: ChatHistoryItem[]) => {
        try {
            // Keep only last 20 chats
            const trimmed = history.slice(0, 20);
            localStorage.setItem(storageKey, JSON.stringify(trimmed));
        } catch (e) { }
    }, [storageKey]);

    // Save messages to active chat history whenever messages change
    useEffect(() => {
        if (messages.length <= 1) return; // Don't save just the welcome
        setChatHistory(prev => {
            const existingIdx = prev.findIndex(c => c.id === activeChat);
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
            const title = lastUserMsg
                ? (lastUserMsg.content.length > 40 ? lastUserMsg.content.slice(0, 40) + '...' : lastUserMsg.content)
                : 'New Chat';
            const preview = lastAssistantMsg
                ? (lastAssistantMsg.content.length > 60 ? lastAssistantMsg.content.slice(0, 60) + '...' : lastAssistantMsg.content)
                : '';

            const entry: ChatHistoryItem = {
                id: activeChat,
                title,
                preview,
                timestamp: Date.now(),
                messages: messages.slice(-30) // Keep last 30 messages per chat
            };

            let updated: ChatHistoryItem[];
            if (existingIdx >= 0) {
                updated = [...prev];
                updated[existingIdx] = entry;
            } else {
                updated = [entry, ...prev];
            }
            persistHistory(updated);
            return updated;
        });
    }, [messages, activeChat]);

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
            const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

            const marketingContext = {
                calendar: calendarEvents,
                tasks: strategyTasks,
                report: growthReport
            };

            const classification = await classifyAndPopulate(history, brandConfig, marketingContext);

            let aiContent = "";
            let cardData = null;

            if (classification.type === 'MISSING_INFO') {
                aiContent = classification.missingInfo ? classification.missingInfo[0] : "Could you provide more details so I can help you better?";
            }
            else if (classification.type === 'GENERAL_CHAT') {
                const response = await generateGeneralChatResponse(history, brandConfig, marketingContext);
                aiContent = response.text;
                if (response.actions && response.actions.length > 0) {
                    cardData = response.actions;
                }
            }
            else if (classification.type === 'CREATE_CAMPAIGN') {
                aiContent = `Great — let me set up a campaign draft for **${classification.params?.campaignTopic || 'your topic'}**. Here's the campaign builder:`;
            }
            else if (classification.type === 'GENERATE_IMAGE') {
                aiContent = `I'll generate a visual for: **${classification.params?.imagePrompt || 'your idea'}**. Working on it now:`;
            }
            else if (classification.type === 'DRAFT_CONTENT') {
                aiContent = `Let's create some content about **${classification.params?.contentTopic || 'your topic'}**. I'll generate multiple options — pick a tone and format, then hit generate:`;
            }
            else {
                aiContent = classification.thoughtProcess || "Let me think about that...";
            }

            const aiMsg: ChatMessage = {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: aiContent,
                timestamp: Date.now(),
                intent: classification,
                suggestedActions: cardData || undefined
            };

            setMessages(prev => [...prev, aiMsg]);

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                id: `err-${Date.now()}`,
                role: 'assistant',
                content: "Sorry, I encountered an error. Please try again — if this persists, the API rate limit may be reached.",
                timestamp: Date.now()
            }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleNewChat = () => {
        const newId = `chat-${Date.now()}`;
        setActiveChat(newId);
        setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: welcomeMessage,
            timestamp: Date.now()
        }]);
    };

    const handleLoadChat = (chatId: string) => {
        const chat = chatHistory.find(c => c.id === chatId);
        if (chat && chat.messages && chat.messages.length > 0) {
            setActiveChat(chatId);
            setMessages(chat.messages);
        }
    };

    const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setChatHistory(prev => {
            const updated = prev.filter(c => c.id !== chatId);
            persistHistory(updated);
            return updated;
        });
        if (activeChat === chatId) {
            handleNewChat();
        }
    };

    // Suggestion chips: context-aware based on what data we have
    const suggestionChips = useMemo(() => {
        const chips: { icon: string; label: string }[] = [];

        if (agentDecisions && agentDecisions.length > 0) {
            chips.push({ icon: 'psychology', label: `Review ${agentDecisions.length} agent decisions` });
        }
        if (strategyTasks.filter(t => t.status === 'pending').length > 0) {
            chips.push({ icon: 'task_alt', label: 'What should I prioritize?' });
        }
        chips.push({ icon: 'trending_up', label: 'Analyze my performance' });
        chips.push({ icon: 'edit_note', label: 'Draft a tweet for me' });

        if (calendarEvents.length === 0) {
            chips.push({ icon: 'calendar_month', label: 'Help me plan this week' });
        }

        return chips.slice(0, 4);
    }, [agentDecisions?.length, strategyTasks, calendarEvents.length]);

    const { today, yesterday, lastWeek } = useMemo(() => {
        const now = Date.now();
        const todayItems: ChatHistoryItem[] = [];
        const yesterdayItems: ChatHistoryItem[] = [];
        const lastWeekItems: ChatHistoryItem[] = [];

        chatHistory.forEach(item => {
            const diff = now - item.timestamp;
            if (diff < 86400000) todayItems.push(item);
            else if (diff < 86400000 * 2) yesterdayItems.push(item);
            else lastWeekItems.push(item);
        });

        return { today: todayItems, yesterday: yesterdayItems, lastWeek: lastWeekItems };
    }, [chatHistory]);

    // Render markdown-like bold text
    const renderContent = (text: string) => {
        // Split by **bold** markers
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="flex flex-1 h-[calc(100vh-0px)] bg-[#0A0A0B] text-white overflow-hidden">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-h-0">
                {/* Chat Header */}
                <div className="flex items-center justify-between px-8 py-4 border-b border-[#1F1F23]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)' }}>
                            <span className="material-symbols-sharp text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                auto_awesome
                            </span>
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-white">AI CMO</h1>
                            <p className="text-xs text-[#64748B]">Strategic marketing copilot for {brandName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleNewChat}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                        >
                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                            New Chat
                        </button>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center transition-colors ${showHistory ? 'bg-[#FF5C0015] border-[#FF5C0044] text-[#FF5C00]' : 'bg-[#1F1F23] border-[#2E2E2E] text-[#64748B] hover:text-white hover:bg-[#2A2A2D]'}`}
                        >
                            <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'wght' 300" }}>history</span>
                        </button>
                    </div>
                </div>

                {/* Chat Body */}
                <div className="flex-1 overflow-y-auto px-12 py-8 min-h-0">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {/* AI Avatar */}
                                {msg.role === 'assistant' && (
                                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)' }}>
                                        <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                                            auto_awesome
                                        </span>
                                    </div>
                                )}

                                {/* Message Content */}
                                <div className={`max-w-[80%] ${msg.role === 'user' ? '' : 'flex-1'}`}>
                                    <div className={`px-5 py-3.5 text-sm leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-[#1F1F23] text-white rounded-[16px] rounded-tr-[4px]'
                                            : 'bg-[#111113] border border-[#1F1F23] text-[#E2E8F0] rounded-[16px] rounded-tl-[4px]'
                                    }`}>
                                        <p className="whitespace-pre-wrap">{renderContent(msg.content)}</p>

                                        {/* Suggested Actions */}
                                        {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                                            <div className="mt-4 flex flex-col gap-2">
                                                {msg.suggestedActions.map((action: any, idx: number) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            setInput(action.action);
                                                            // Auto-send after a short delay
                                                            setTimeout(() => {
                                                                const syntheticInput = action.action;
                                                                setInput('');
                                                                // Create user message and send
                                                                const userMsg: ChatMessage = {
                                                                    id: `usr-${Date.now()}`,
                                                                    role: 'user',
                                                                    content: syntheticInput,
                                                                    timestamp: Date.now()
                                                                };
                                                                setMessages(prev => [...prev, userMsg]);
                                                                setIsThinking(true);

                                                                const doSend = async () => {
                                                                    try {
                                                                        const hist = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
                                                                        const ctx = { calendar: calendarEvents, tasks: strategyTasks, report: growthReport };
                                                                        const cls = await classifyAndPopulate(hist, brandConfig, ctx);
                                                                        let aiContent = "";
                                                                        let cardData = null;

                                                                        if (cls.type === 'MISSING_INFO') {
                                                                            aiContent = cls.missingInfo?.[0] || "Could you provide more details?";
                                                                        } else if (cls.type === 'GENERAL_CHAT') {
                                                                            const resp = await generateGeneralChatResponse(hist, brandConfig, ctx);
                                                                            aiContent = resp.text;
                                                                            if (resp.actions?.length) cardData = resp.actions;
                                                                        } else if (cls.type === 'CREATE_CAMPAIGN') {
                                                                            aiContent = `Setting up campaign for **${cls.params?.campaignTopic || 'your topic'}**:`;
                                                                        } else if (cls.type === 'GENERATE_IMAGE') {
                                                                            aiContent = `Generating visual for **${cls.params?.imagePrompt || 'your idea'}**:`;
                                                                        } else if (cls.type === 'DRAFT_CONTENT') {
                                                                            aiContent = `Drafting content about **${cls.params?.contentTopic || 'your topic'}**:`;
                                                                        } else {
                                                                            aiContent = cls.thoughtProcess || "Processing...";
                                                                        }

                                                                        setMessages(prev => [...prev, {
                                                                            id: `ai-${Date.now()}`,
                                                                            role: 'assistant',
                                                                            content: aiContent,
                                                                            timestamp: Date.now(),
                                                                            intent: cls,
                                                                            suggestedActions: cardData || undefined
                                                                        }]);
                                                                    } catch (e) {
                                                                        console.error(e);
                                                                        setMessages(prev => [...prev, {
                                                                            id: `err-${Date.now()}`,
                                                                            role: 'assistant',
                                                                            content: "Sorry, I encountered an error processing that.",
                                                                            timestamp: Date.now()
                                                                        }]);
                                                                    } finally {
                                                                        setIsThinking(false);
                                                                    }
                                                                };
                                                                doSend();
                                                            }, 100);
                                                        }}
                                                        className="text-left w-full px-4 py-3 bg-[#0A0A0B] hover:bg-[#1F1F23] border border-[#1F1F23] rounded-lg text-sm font-medium text-[#E2E8F0] hover:text-[#FF5C00] transition-all flex items-center justify-between group"
                                                    >
                                                        <span>{action.label}</span>
                                                        <span className="material-symbols-sharp text-[#64748B] group-hover:text-[#FF5C00] text-lg">
                                                            arrow_forward
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Intent-based Cards */}
                                        {msg.intent && msg.role === 'assistant' && (
                                            <div className="mt-4 space-y-4">
                                                {msg.intent.uiCard === 'CampaignCard' && (
                                                    <div className="border border-[#1F1F23] rounded-xl overflow-hidden bg-[#111113]">
                                                        <CampaignCard params={msg.intent.params} brandName={brandName} brandConfig={brandConfig} onNavigate={onNavigate} />
                                                    </div>
                                                )}
                                                {msg.intent.uiCard === 'ImageCard' && (
                                                    <div className="border border-[#1F1F23] rounded-xl overflow-hidden bg-[#111113]">
                                                        <ImagePreviewCard
                                                            params={msg.intent.params}
                                                            brandName={brandName}
                                                            brandConfig={brandConfig}
                                                            onNavigate={onNavigate}
                                                        />
                                                    </div>
                                                )}
                                                {(msg.intent.type === 'DRAFT_CONTENT' || msg.intent.uiCard === 'ContentCard') && (
                                                    <div className="border border-[#1F1F23] rounded-xl overflow-hidden bg-[#111113]">
                                                        <ContentCard
                                                            params={msg.intent.params}
                                                            brandName={brandName}
                                                            brandConfig={brandConfig}
                                                            onNavigate={onNavigate}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Timestamp */}
                                    <div className={`mt-1 text-[10px] text-[#4A4A4E] ${msg.role === 'user' ? 'text-right' : ''}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Thinking Indicator */}
                        {isThinking && (
                            <div className="flex gap-4">
                                <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)' }}>
                                    <span className="material-symbols-sharp text-white text-lg animate-pulse">auto_awesome</span>
                                </div>
                                <div className="bg-[#111113] border border-[#1F1F23] rounded-[16px] rounded-tl-[4px] px-5 py-3.5">
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 bg-[#FF5C00] rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-[#FF5C00] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                            <div className="w-2 h-2 bg-[#FF5C00] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        </div>
                                        <span className="text-xs text-[#64748B] ml-2">Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="px-8 py-4 border-t border-[#1F1F23]">
                    {/* Suggestion Chips — only show when last message is from assistant (not during thinking) */}
                    {!isThinking && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                        <div className="flex gap-2 mb-3 max-w-3xl mx-auto flex-wrap">
                            {suggestionChips.map((chip, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setInput(chip.label);
                                        // Focus the input so user can just press Enter
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1F1F23] border border-[#2E2E2E] text-[#94A3B8] text-xs font-medium hover:bg-[#2A2A2D] hover:text-white hover:border-[#FF5C0044] transition-colors"
                                >
                                    <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>{chip.icon}</span>
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input Row */}
                    <div className="flex gap-4 max-w-3xl mx-auto">
                        <div className="flex-1 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[#111113] border border-[#1F1F23] focus-within:border-[#FF5C0066] transition-colors">
                            <span className="material-symbols-sharp text-[#64748B] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>
                                chat_bubble
                            </span>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !isThinking && handleSend()}
                                placeholder="Ask about strategy, content, analytics, or anything..."
                                className="flex-1 bg-transparent border-none text-white placeholder-[#64748B] focus:outline-none text-sm"
                                autoFocus
                                disabled={isThinking}
                            />
                            {input.trim() && (
                                <span className="text-[10px] text-[#4A4A4E]">Enter ↵</span>
                            )}
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isThinking}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                input.trim() && !isThinking
                                    ? 'bg-gradient-to-r from-[#FF5C00] to-[#FF8400] text-white hover:opacity-90'
                                    : 'bg-[#1F1F23] text-[#64748B] cursor-not-allowed'
                            }`}
                        >
                            <span className="material-symbols-sharp text-xl">{isThinking ? 'hourglass_top' : 'arrow_upward'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Chat History Panel */}
            {showHistory && (
                <div className="w-[280px] bg-[#0F0F10] border-l border-[#1F1F23] flex flex-col shrink-0">
                    {/* History Header */}
                    <div className="flex items-center justify-between px-5 py-5 border-b border-[#1F1F23]">
                        <span className="text-base font-semibold text-white">Chat History</span>
                        {chatHistory.length > 0 && (
                            <span className="text-[10px] text-[#64748B]">{chatHistory.length} chats</span>
                        )}
                    </div>

                    {/* History Content */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
                        {chatHistory.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <span className="material-symbols-sharp text-3xl text-[#2E2E2E] mb-3">forum</span>
                                <p className="text-xs text-[#64748B]">Your conversations will appear here</p>
                            </div>
                        )}

                        {/* Today */}
                        {today.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-[#64748B] px-3 py-1">Today</p>
                                {today.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleLoadChat(item.id)}
                                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors group relative ${
                                            activeChat === item.id ? 'bg-[#1F1F23]' : 'hover:bg-[#1F1F23]/50'
                                        }`}
                                    >
                                        <p className="text-sm font-medium text-white truncate pr-6">{item.title}</p>
                                        <p className="text-xs text-[#64748B] truncate mt-0.5">{item.preview}</p>
                                        <button
                                            onClick={(e) => handleDeleteChat(item.id, e)}
                                            className="absolute top-3 right-2 w-6 h-6 rounded flex items-center justify-center text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF444422] opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <span className="material-symbols-sharp text-sm">close</span>
                                        </button>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Yesterday */}
                        {yesterday.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-[#64748B] px-3 py-1">Yesterday</p>
                                {yesterday.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleLoadChat(item.id)}
                                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors group relative ${
                                            activeChat === item.id ? 'bg-[#1F1F23]' : 'hover:bg-[#1F1F23]/50'
                                        }`}
                                    >
                                        <p className="text-sm font-medium text-white truncate pr-6">{item.title}</p>
                                        <p className="text-xs text-[#64748B] truncate mt-0.5">{item.preview}</p>
                                        <button
                                            onClick={(e) => handleDeleteChat(item.id, e)}
                                            className="absolute top-3 right-2 w-6 h-6 rounded flex items-center justify-center text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF444422] opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <span className="material-symbols-sharp text-sm">close</span>
                                        </button>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Last 7 Days */}
                        {lastWeek.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-[#64748B] px-3 py-1">Last 7 Days</p>
                                {lastWeek.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleLoadChat(item.id)}
                                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors group relative ${
                                            activeChat === item.id ? 'bg-[#1F1F23]' : 'hover:bg-[#1F1F23]/50'
                                        }`}
                                    >
                                        <p className="text-sm font-medium text-white truncate pr-6">{item.title}</p>
                                        <p className="text-xs text-[#64748B] truncate mt-0.5">{item.preview}</p>
                                        <button
                                            onClick={(e) => handleDeleteChat(item.id, e)}
                                            className="absolute top-3 right-2 w-6 h-6 rounded flex items-center justify-center text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF444422] opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <span className="material-symbols-sharp text-sm">close</span>
                                        </button>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
