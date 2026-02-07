import React, { useState } from 'react';
import { ChatIntentResponse } from '../../../types';
import { generateTweet, generateWeb3Graphic } from '../../../services/gemini';
import { BrandConfig } from '../../../types';

interface ContentCardProps {
    params: ChatIntentResponse['params'];
    brandName: string;
    brandConfig: BrandConfig;
    onNavigate: (section: string, params: any) => void;
}

const TONE_OPTIONS = ['Professional', 'Casual', 'Bold', 'Educational', 'Hype', 'Community'];
const FORMAT_OPTIONS = [
    { id: 'tweet', label: 'Tweet', icon: '𝕏' },
    { id: 'thread', label: 'Thread (3)', icon: '🧵' },
    { id: 'announcement', label: 'Announcement', icon: '📢' },
];

export const ContentCard: React.FC<ContentCardProps> = ({ params, brandName, brandConfig, onNavigate }) => {
    const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle');
    const [results, setResults] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Editable fields
    const [topic, setTopic] = useState(params?.contentTopic || '');
    const [tone, setTone] = useState('Professional');
    const [format, setFormat] = useState('tweet');

    // Image generation
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);

    const handleGenerate = async () => {
        if (!topic.trim()) return;
        setStatus('generating');
        setResults([]);
        setCurrentIndex(0);
        setImageUrl(null);

        try {
            const count = format === 'thread' ? 3 : 3; // Always generate 3 variations
            const fullTopic = format === 'thread'
                ? `Create a 3-tweet thread about: ${topic}`
                : format === 'announcement'
                ? `Write an announcement about: ${topic}`
                : topic;

            const result = await generateTweet(fullTopic, brandName, brandConfig, tone, count);
            const tweets = Array.isArray(result) ? result : [result];
            setResults(tweets);
            setStatus('done');
        } catch (e) {
            console.error('Content generation failed:', e);
            setStatus('idle');
        }
    };

    const handleGenerateImage = async () => {
        if (!results[currentIndex]) return;
        setImageLoading(true);
        try {
            const prompt = `${topic} — ${brandName} marketing visual`;
            const result = await generateWeb3Graphic({
                prompt,
                artPrompt: 'Modern, Web3, clean, professional, dark theme',
                aspectRatio: '16:9',
                size: '1K',
                brandConfig,
                brandName,
                templateType: 'Default',
            });
            setImageUrl(result);
        } catch (e) {
            console.error('Image gen failed:', e);
        } finally {
            setImageLoading(false);
        }
    };

    const handleCopy = () => {
        if (results[currentIndex]) {
            navigator.clipboard.writeText(results[currentIndex]);
        }
    };

    // ====== DONE STATE ======
    if (status === 'done' && results.length > 0) {
        return (
            <div className="rounded-xl overflow-hidden bg-[#0A0A0B] border border-[#1F1F23]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1F1F23]">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#22C55E18] flex items-center justify-center">
                            <svg className="w-3 h-3 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-[#22C55E]">Content Generated</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                            disabled={currentIndex === 0}
                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                                currentIndex === 0 ? 'text-[#2E2E2E]' : 'text-[#6B6B70] hover:text-white bg-[#1F1F23]'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="text-[11px] font-mono text-[#6B6B70]">{currentIndex + 1} / {results.length}</span>
                        <button
                            onClick={() => setCurrentIndex(i => Math.min(results.length - 1, i + 1))}
                            disabled={currentIndex === results.length - 1}
                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                                currentIndex === results.length - 1 ? 'text-[#2E2E2E]' : 'text-[#6B6B70] hover:text-white bg-[#1F1F23]'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>

                {/* Tweet Preview */}
                <div className="p-4">
                    <div className="p-4 rounded-xl bg-[#111113] border border-[#1F1F23]">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center text-white font-bold text-xs">
                                {brandName.charAt(0)}
                            </div>
                            <div>
                                <span className="text-white text-sm font-semibold">{brandName}</span>
                                <span className="text-[#6B6B70] text-xs ml-2">@{brandName.toLowerCase().replace(/\s/g, '')}</span>
                            </div>
                        </div>
                        <p className="text-[#E2E8F0] text-sm leading-relaxed whitespace-pre-wrap">
                            {results[currentIndex]}
                        </p>
                        <div className="flex items-center gap-5 mt-3 pt-3 border-t border-[#1F1F23]">
                            <span className="text-[#4A4A4E] text-xs">💬 0</span>
                            <span className="text-[#4A4A4E] text-xs">🔁 0</span>
                            <span className="text-[#4A4A4E] text-xs">❤️ 0</span>
                        </div>
                    </div>

                    {/* Generated Image */}
                    {imageUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-[#1F1F23]">
                            <img src={imageUrl} alt="Generated" className="w-full aspect-video object-cover" />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-4 pb-4">
                    <button
                        onClick={() => onNavigate('studio', { draft: results[currentIndex], visualPrompt: topic })}
                        className="flex-1 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors text-center"
                    >
                        Edit in Studio
                    </button>
                    {!imageUrl && (
                        <button
                            onClick={handleGenerateImage}
                            disabled={imageLoading}
                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                        >
                            {imageLoading ? (
                                <div className="w-4 h-4 border-2 border-[#6B6B70] border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span className="text-sm">🎨</span>
                            )}
                            {imageLoading ? 'Gen...' : 'Image'}
                        </button>
                    )}
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2D] transition-colors"
                        title="Copy to clipboard"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                    <button
                        onClick={() => { setResults([]); setStatus('idle'); setCurrentIndex(0); setImageUrl(null); }}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-[#6B6B70] text-sm font-medium hover:bg-[#2A2A2D] hover:text-white transition-colors"
                        title="Regenerate"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>
        );
    }

    // ====== IDLE / FORM STATE ======
    return (
        <div className="rounded-xl overflow-hidden bg-[#0A0A0B] border border-[#1F1F23]">
            <div className="px-4 py-3 border-b border-[#1F1F23] flex items-center gap-2">
                <span className="text-[#FF5C00]">✍️</span>
                <span className="text-sm font-semibold text-[#FF5C00]">Draft Content</span>
            </div>

            <div className="p-4 space-y-3">
                {/* Topic */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-[#6B6B70] mb-1.5 block tracking-wider">Topic</label>
                    <input
                        type="text"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="e.g. AI agents revolutionizing DeFi"
                        className="w-full bg-[#111113] border border-[#1F1F23] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#4A4A4E] focus:border-[#FF5C00] focus:outline-none transition-colors"
                        onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
                    />
                </div>

                {/* Tone */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-[#6B6B70] mb-1.5 block tracking-wider">Tone</label>
                    <div className="flex flex-wrap gap-1.5">
                        {TONE_OPTIONS.map(t => (
                            <button
                                key={t}
                                onClick={() => setTone(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    tone === t
                                        ? 'bg-[#FF5C0015] border border-[#FF5C0044] text-[#FF5C00]'
                                        : 'bg-[#111113] border border-[#1F1F23] text-[#ADADB0] hover:border-[#2E2E2E]'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Format */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-[#6B6B70] mb-1.5 block tracking-wider">Format</label>
                    <div className="flex gap-2">
                        {FORMAT_OPTIONS.map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFormat(f.id)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                                    format === f.id
                                        ? 'bg-[#FF5C0015] border border-[#FF5C0044] text-[#FF5C00]'
                                        : 'bg-[#111113] border border-[#1F1F23] text-[#ADADB0] hover:border-[#2E2E2E]'
                                }`}
                            >
                                <span>{f.icon}</span>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Generate */}
                <button
                    onClick={handleGenerate}
                    disabled={!topic.trim() || status === 'generating'}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        status === 'generating'
                            ? 'bg-[#1F1F23] text-[#6B6B70] cursor-wait'
                            : !topic.trim()
                            ? 'bg-[#1F1F23] text-[#4A4A4E] cursor-not-allowed'
                            : 'bg-gradient-to-b from-[#FF5C00] to-[#FF7A2E] text-white hover:opacity-90'
                    }`}
                >
                    {status === 'generating' ? (
                        <>
                            <div className="w-4 h-4 border-2 border-[#6B6B70] border-t-transparent rounded-full animate-spin"></div>
                            Generating {format === 'thread' ? 'Thread' : 'Tweets'}...
                        </>
                    ) : (
                        <>
                            ✨ Generate {format === 'thread' ? 'Thread' : '3 Options'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
