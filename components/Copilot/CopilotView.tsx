import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BrandConfig, ChatMessage, CalendarEvent, StrategyTask, GrowthReport } from '../../types';
import { classifyAndPopulate, generateGeneralChatResponse } from '../../services/gemini';
import { CampaignCard } from './ActionCards/CampaignCard';
import { ImagePreviewCard } from './ActionCards/ImagePreviewCard';

interface CopilotViewProps {
    brandName: string;
    brandConfig: BrandConfig;
    calendarEvents: CalendarEvent[];
    strategyTasks: StrategyTask[];
    growthReport: GrowthReport | null;
    onNavigate: (section: string, params: any) => void;
}

interface ChatHistoryItem {
    id: string;
    title: string;
    preview: string;
    timestamp: number;
}

const SUGGESTION_CHIPS = [
    { icon: 'trending_up', label: 'Analyze my campaign' },
    { icon: 'strategy', label: 'Growth strategy' },
    { icon: 'analytics', label: 'Audience insights' },
    { icon: 'edit_note', label: 'Content strategy' },
];

export const CopilotView: React.FC<CopilotViewProps> = ({
    brandName,
    brandConfig,
    calendarEvents,
    strategyTasks,
    growthReport,
    onNavigate
}) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>(() => [{
        id: 'welcome',
        role: 'assistant',
        content: `I've analyzed your NFT campaign data. Here's what I found and my recommendations:`,
        timestamp: Date.now()
    }]);
    const [isThinking, setIsThinking] = useState(false);
    const [showHistory, setShowHistory] = useState(true);
    const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>(() => {
        const now = Date.now();
        return [
            { id: '1', title: 'NFT Campaign Analysis', preview: 'Analyzing performance metrics...', timestamp: now },
            { id: '2', title: 'Twitter Growth Strategy', preview: 'Let me help you grow...', timestamp: now - 3600000 },
            { id: '3', title: 'Content Calendar Q1', preview: 'Here\'s your content plan...', timestamp: now - 7200000 },
            { id: '4', title: 'Discord Engagement Report', preview: 'Your community metrics...', timestamp: now - 86400000 },
            { id: '5', title: 'Competitor Analysis', preview: 'I\'ve analyzed your competitors...', timestamp: now - 86400000 * 2 },
            { id: '6', title: 'Launch Announcement Copy', preview: 'Here\'s the draft...', timestamp: now - 86400000 * 3 },
            { id: '7', title: 'Email Newsletter Ideas', preview: 'Some suggestions...', timestamp: now - 86400000 * 5 },
        ];
    });
    const [activeChat, setActiveChat] = useState('1');
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
            const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

            const marketingContext = {
                calendar: calendarEvents,
                tasks: strategyTasks,
                report: growthReport
            };

            const classification = await classifyAndPopulate(history, brandConfig, marketingContext);

            const aiMsgId = `ai-${Date.now()}`;
            let aiContent = "";
            let cardData = null;

            if (classification.type === 'MISSING_INFO') {
                aiContent = classification.missingInfo ? classification.missingInfo[0] : "Could you provide more details?";
            }
            else if (classification.type === 'GENERAL_CHAT') {
                const response = await generateGeneralChatResponse(history, brandConfig, marketingContext);
                aiContent = response.text;
                if (response.actions && response.actions.length > 0) {
                    cardData = response.actions;
                }
            }
            else if (classification.type === 'CREATE_CAMPAIGN') {
                aiContent = `Drafting campaign regarding: ${classification.params?.campaignTopic || 'your topic'}...`;
            }
            else if (classification.type === 'GENERATE_IMAGE') {
                aiContent = `Generating visual for: ${classification.params?.imagePrompt || 'your idea'}...`;
            }
            else if (classification.type === 'DRAFT_CONTENT') {
                aiContent = `I'll help you draft content for: ${classification.params?.contentTopic || 'your topic'}. Opening the studio...`;
            }
            else {
                aiContent = classification.thoughtProcess || "Processing...";
            }

            const aiMsg: ChatMessage = {
                id: aiMsgId,
                role: 'assistant',
                content: aiContent,
                timestamp: Date.now(),
                intent: classification,
                suggestedActions: cardData
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

    const handleNewChat = () => {
        const newId = `chat-${Date.now()}`;
        setChatHistory(prev => [{
            id: newId,
            title: 'New Chat',
            preview: 'Start a conversation...',
            timestamp: Date.now()
        }, ...prev]);
        setActiveChat(newId);
        setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: `Hello! I'm your AI CMO for ${brandName}. How can I help you today?`,
            timestamp: Date.now()
        }]);
    };

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
                            <h1 className="text-lg font-semibold text-white">AI CMO Assistant</h1>
                            <p className="text-xs text-[#64748B]">Your intelligent marketing copilot</p>
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
                            className="w-10 h-10 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] flex items-center justify-center text-[#64748B] hover:text-white hover:bg-[#2A2A2D] transition-colors"
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
                                        <p className="whitespace-pre-wrap">{msg.content}</p>

                                        {/* AI Response with Data Cards */}
                                        {msg.role === 'assistant' && msg.id === 'welcome' && (
                                            <div className="mt-4 space-y-4">
                                                {/* Metrics Row */}
                                                <div className="grid grid-cols-4 gap-3">
                                                    {[
                                                        { label: 'Total Mints', value: '2,847', change: '+12% vs last week', positive: true },
                                                        { label: 'Avg. Mint Price', value: '0.08 ETH', change: '+5% avg increase', positive: true },
                                                        { label: 'Unique Holders', value: '1,892', change: '+8% new holders', positive: true },
                                                        { label: 'Floor Price', value: '0.12 ETH', change: '-3% from peak', positive: false },
                                                    ].map((metric, i) => (
                                                        <div key={i} className="bg-[#0A0A0B] rounded-lg p-3 border border-[#1F1F23]">
                                                            <p className="text-[10px] text-[#64748B] mb-1">{metric.label}</p>
                                                            <p className="text-lg font-semibold text-white font-mono">{metric.value}</p>
                                                            <p className={`text-[10px] ${metric.positive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                                                                {metric.change}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Chart Placeholder */}
                                                <div className="bg-[#0A0A0B] rounded-lg p-4 border border-[#1F1F23]">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-xs font-medium text-white">Mint Activity Over Time</span>
                                                        <div className="flex items-center gap-4 text-[10px]">
                                                            <span className="flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full bg-[#FF5C00]"></span>
                                                                This Week
                                                            </span>
                                                            <span className="flex items-center gap-1.5 text-[#64748B]">
                                                                <span className="w-2 h-2 rounded-full bg-[#3B82F6]"></span>
                                                                Last Week
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {/* Simple Bar Chart */}
                                                    <div className="flex items-end gap-2 h-24">
                                                        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                                                            <div key={i} className="flex-1 flex flex-col gap-1">
                                                                <div className="flex gap-0.5 items-end flex-1">
                                                                    <div className="flex-1 bg-[#FF5C00] rounded-t" style={{ height: `${h}%` }}></div>
                                                                    <div className="flex-1 bg-[#3B82F6] rounded-t" style={{ height: `${h * 0.7}%` }}></div>
                                                                </div>
                                                                <span className="text-[9px] text-[#64748B] text-center">
                                                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Key Recommendations */}
                                                <div className="bg-[#0A0A0B] rounded-lg p-4 border border-[#1F1F23]">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="material-symbols-sharp text-[#FF5C00] text-lg">lightbulb</span>
                                                        <span className="text-xs font-medium text-white">Key Recommendations</span>
                                                    </div>
                                                    <ul className="space-y-2 text-xs text-[#94A3B8]">
                                                        <li className="flex items-start gap-2">
                                                            <span className="text-[#22C55E] mt-0.5">✓</span>
                                                            Increase your Discord activity - your Dexbot activity correlates with 34% higher mints
                                                        </li>
                                                        <li className="flex items-start gap-2">
                                                            <span className="text-[#22C55E] mt-0.5">✓</span>
                                                            Schedule Twitter Spaces during peak hours (2-4 PM EST)
                                                        </li>
                                                        <li className="flex items-start gap-2">
                                                            <span className="text-[#22C55E] mt-0.5">✓</span>
                                                            Consider a collaboration with trending projects in your niche
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div>
                                        )}

                                        {/* Suggested Actions */}
                                        {msg.suggestedActions && (
                                            <div className="mt-4 flex flex-col gap-2">
                                                {msg.suggestedActions.map((action: any, idx: number) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setInput(action.action)}
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
                                                {msg.intent.type === 'DRAFT_CONTENT' && (
                                                    <div className="p-4 bg-[#111113] border border-[#1F1F23] rounded-xl">
                                                        <div className="flex items-center gap-2 mb-3 text-[#FF5C00] font-semibold text-sm">
                                                            <span className="material-symbols-sharp">edit_note</span>
                                                            Drafting Assistant
                                                        </div>
                                                        <p className="text-sm text-[#94A3B8] mb-4">
                                                            I've set up a writing session for: <span className="font-medium text-white">{msg.intent.params?.contentTopic}</span>
                                                        </p>
                                                        <button
                                                            onClick={() => onNavigate('content', { draft: msg.intent?.params?.contentTopic })}
                                                            className="w-full py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                                                        >
                                                            Open Content Studio
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                                <div className="flex items-center gap-1.5 py-4">
                                    <div className="w-2 h-2 bg-[#64748B] rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2 h-2 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="px-8 py-4 border-t border-[#1F1F23]">
                    {/* Suggestion Chips */}
                    <div className="flex gap-2 mb-3 max-w-3xl mx-auto">
                        {SUGGESTION_CHIPS.map((chip, i) => (
                            <button
                                key={i}
                                onClick={() => setInput(chip.label)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1F1F23] border border-[#2E2E2E] text-[#94A3B8] text-xs font-medium hover:bg-[#2A2A2D] hover:text-white transition-colors"
                            >
                                <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>{chip.icon}</span>
                                {chip.label}
                            </button>
                        ))}
                    </div>

                    {/* Input Row */}
                    <div className="flex gap-4 max-w-3xl mx-auto">
                        <div className="flex-1 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[#111113] border border-[#1F1F23]">
                            <span className="material-symbols-sharp text-[#64748B] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>
                                chat_bubble
                            </span>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Ask about campaigns, analytics, content strategy..."
                                className="flex-1 bg-transparent border-none text-white placeholder-[#64748B] focus:outline-none text-sm"
                                autoFocus
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isThinking}
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                input.trim()
                                    ? 'bg-gradient-to-r from-[#FF5C00] to-[#FF8400] text-white hover:opacity-90'
                                    : 'bg-[#1F1F23] text-[#64748B] cursor-not-allowed'
                            }`}
                        >
                            <span className="material-symbols-sharp text-xl">arrow_upward</span>
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
                        <button className="w-8 h-8 rounded-lg bg-[#1F1F23] flex items-center justify-center text-[#64748B] hover:text-white transition-colors">
                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>search</span>
                        </button>
                    </div>

                    {/* History Content */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
                        {/* Today */}
                        {today.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-[#64748B] px-3 py-1">Today</p>
                                {today.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveChat(item.id)}
                                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors ${
                                            activeChat === item.id ? 'bg-[#1F1F23]' : 'hover:bg-[#1F1F23]/50'
                                        }`}
                                    >
                                        <p className="text-sm font-medium text-white truncate">{item.title}</p>
                                        <p className="text-xs text-[#64748B] truncate mt-0.5">{item.preview}</p>
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
                                        onClick={() => setActiveChat(item.id)}
                                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors ${
                                            activeChat === item.id ? 'bg-[#1F1F23]' : 'hover:bg-[#1F1F23]/50'
                                        }`}
                                    >
                                        <p className="text-sm font-medium text-white truncate">{item.title}</p>
                                        <p className="text-xs text-[#64748B] truncate mt-0.5">{item.preview}</p>
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
                                        onClick={() => setActiveChat(item.id)}
                                        className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors ${
                                            activeChat === item.id ? 'bg-[#1F1F23]' : 'hover:bg-[#1F1F23]/50'
                                        }`}
                                    >
                                        <p className="text-sm font-medium text-white truncate">{item.title}</p>
                                        <p className="text-xs text-[#64748B] truncate mt-0.5">{item.preview}</p>
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
