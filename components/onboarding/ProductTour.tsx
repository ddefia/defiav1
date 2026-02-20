import React, { useState, useEffect, useCallback } from 'react';

interface ProductTourProps {
    brandName?: string;
    kickoffDrafts?: any[];
    socialMetrics?: { followers?: number; engagement?: number; impressions?: number };
    theme?: 'dark' | 'light';
    onThemeChange?: (theme: 'dark' | 'light') => void;
    onSelectPlan?: (tier: 'starter' | 'growth') => void;
    onComplete: () => void;
    onSkip: () => void;
}

type SlideVisualType = 'welcome' | 'ai' | 'dashboard' | 'studio' | 'telegram' | 'theme' | 'pricing' | 'trial' | 'complete';

interface Slide {
    icon: string;
    title: string;
    description: string;
    accent: string;
    visual: SlideVisualType;
}

const formatNumber = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
};

const SLIDES: Slide[] = [
    {
        icon: 'rocket_launch',
        title: 'Welcome to DEFIA',
        description: 'Your AI-powered marketing command center for Web3. Here\u2019s a quick overview of your new toolkit.',
        accent: '#FF5C00',
        visual: 'welcome',
    },
    {
        icon: 'auto_awesome',
        title: 'Your AI CMO',
        description: 'An autonomous AI that monitors trends, generates strategies, and recommends high-impact actions \u2014 tailored to your brand.',
        accent: '#FF5C00',
        visual: 'ai',
    },
    {
        icon: 'dashboard',
        title: 'Dashboard & Insights',
        description: 'Real-time KPIs, daily briefs, and growth metrics. Everything you need to track performance at a glance.',
        accent: '#3B82F6',
        visual: 'dashboard',
    },
    {
        icon: 'edit_square',
        title: 'Content Studio',
        description: 'Generate tweets, threads, and on-brand graphics in seconds. AI-matched to your voice, style, and strategy.',
        accent: '#8B5CF6',
        visual: 'studio',
    },
    {
        icon: 'send',
        title: 'Telegram Assistant',
        description: 'Add our bot to your Telegram group. Get daily briefings, draft tweets, generate graphics, and chat with your AI CMO \u2014 without leaving Telegram.',
        accent: '#0088CC',
        visual: 'telegram',
    },
    {
        icon: 'palette',
        title: 'Choose Your Look',
        description: 'Pick between dark and light mode. You can change this anytime in settings.',
        accent: '#FF5C00',
        visual: 'theme',
    },
    {
        icon: 'workspace_premium',
        title: 'Choose Your Plan',
        description: 'Start with a 24-hour free trial. No credit card required.',
        accent: '#FF5C00',
        visual: 'pricing',
    },
    {
        icon: 'hourglass_top',
        title: 'Your Free Trial',
        description: 'Here\'s what you get for the next 24 hours \u2014 no credit card needed.',
        accent: '#22C55E',
        visual: 'trial',
    },
    {
        icon: 'celebration',
        title: 'You\u2019re All Set!',
        description: 'Your AI CMO is ready. Start creating campaigns and growing your Web3 brand.',
        accent: '#FF5C00',
        visual: 'complete',
    },
];

// ─── Slide Visual Components ──────────────────────────────────────────────────

const WelcomeVisual: React.FC<{ brandName?: string }> = ({ brandName }) => (
    <div className="text-center">
        {brandName && (
            <div className="mb-5">
                <span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {brandName}
                </span>
                <span className="text-sm ml-2" style={{ color: 'var(--text-muted)' }}>is connected</span>
            </div>
        )}
        <div className="flex items-center justify-center gap-4">
            {[
                { icon: 'auto_awesome', label: 'AI CMO' },
                { icon: 'edit_square', label: 'Studio' },
                { icon: 'dashboard', label: 'Dashboard' },
                { icon: 'analytics', label: 'Analytics' },
                { icon: 'calendar_month', label: 'Calendar' },
            ].map((item, i) => (
                <div key={item.icon} className="flex flex-col items-center gap-2">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{
                            background: `linear-gradient(135deg, rgba(255, 92, 0, ${0.08 + i * 0.04}), rgba(255, 92, 0, ${0.15 + i * 0.04}))`,
                            border: '1px solid rgba(255, 92, 0, 0.1)',
                        }}
                    >
                        <span className="material-symbols-sharp text-xl" style={{ color: '#FF5C00', fontVariationSettings: "'wght' 300" }}>
                            {item.icon}
                        </span>
                    </div>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                </div>
            ))}
        </div>
    </div>
);

const AIVisual: React.FC<{ drafts?: any[] }> = ({ drafts }) => {
    const items = drafts && drafts.length > 0
        ? [
            { icon: 'check_circle', text: `${drafts.length} campaign drafts generated` },
            { icon: 'check_circle', text: 'Strategy aligned to your brand voice' },
            { icon: 'check_circle', text: 'Smart scheduling recommendations ready' },
        ]
        : [
            { icon: 'check_circle', text: 'Trend analysis complete' },
            { icon: 'check_circle', text: 'Strategy generated' },
            { icon: 'check_circle', text: '3 actions recommended' },
        ];

    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div
                    key={i}
                    className="flex items-center gap-3 px-5 py-3 rounded-xl"
                    style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                >
                    <span className="material-symbols-sharp text-lg" style={{ color: '#22C55E', fontVariationSettings: "'wght' 300, 'FILL' 1" }}>
                        {item.icon}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{item.text}</span>
                </div>
            ))}
        </div>
    );
};

const DashboardVisual: React.FC<{ metrics?: { followers?: number; engagement?: number; impressions?: number } }> = ({ metrics }) => {
    const kpis = [
        { label: 'Followers', value: metrics?.followers ? formatNumber(metrics.followers) : '12.4K', icon: 'group' },
        { label: 'Engagement', value: metrics?.engagement ? `${metrics.engagement.toFixed(1)}%` : '8.2%', icon: 'trending_up' },
        { label: 'Impressions', value: metrics?.impressions ? formatNumber(metrics.impressions) : '284K', icon: 'visibility' },
    ];

    return (
        <div className="grid grid-cols-3 gap-3">
            {kpis.map((kpi, i) => (
                <div
                    key={i}
                    className="rounded-2xl px-4 py-4 text-center"
                    style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                >
                    <span className="material-symbols-sharp text-lg mb-1 block" style={{ color: '#3B82F6', fontVariationSettings: "'wght' 300" }}>
                        {kpi.icon}
                    </span>
                    <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
                    <div className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
                </div>
            ))}
        </div>
    );
};

const StudioVisual: React.FC<{ draft?: string }> = ({ draft }) => {
    const sampleTweet = draft || 'Your AI-generated content will appear here \u2014 matched to your brand voice and strategy.';

    return (
        <div className="space-y-3">
            <div
                className="rounded-2xl px-5 py-4"
                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
            >
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FF8A4C] flex items-center justify-center">
                        <span className="material-symbols-sharp text-sm text-white" style={{ fontVariationSettings: "'wght' 300" }}>edit_square</span>
                    </div>
                    <div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>AI Draft</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Generated just now</div>
                    </div>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6' }}>
                        AI
                    </span>
                </div>
                <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                    {sampleTweet.slice(0, 160)}{sampleTweet.length > 160 ? '...' : ''}
                </p>
            </div>
            <div className="flex gap-2">
                {['Tweet', 'Thread', 'Graphic'].map((type, i) => (
                    <div
                        key={type}
                        className="flex-1 rounded-xl px-3 py-2.5 text-center text-xs font-medium"
                        style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >
                        {type}
                    </div>
                ))}
            </div>
        </div>
    );
};

const TelegramVisual: React.FC = () => (
    <div className="space-y-2.5">
        {[
            { text: 'What should we post about today?', isUser: true },
            { text: 'ETH L2 fees just hit all-time lows. Great angle for a thread on why your users should care.', isBot: true },
            { text: 'I drafted a tweet and a graphic. Want me to adjust the tone?', isBot: true },
        ].map((msg, i) => (
            <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                    className="rounded-xl px-3.5 py-2 max-w-[85%]"
                    style={{
                        backgroundColor: msg.isUser ? 'rgba(0, 136, 204, 0.15)' : 'var(--bg-tertiary)',
                        border: msg.isUser ? '1px solid rgba(0, 136, 204, 0.2)' : '1px solid var(--border)',
                    }}
                >
                    {msg.isBot && (
                        <div className="text-[10px] font-semibold mb-1" style={{ color: '#0088CC' }}>Defia Bot</div>
                    )}
                    <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>{msg.text}</p>
                </div>
            </div>
        ))}
        <div className="flex gap-1.5 justify-center pt-1">
            {['Daily Briefs', 'Tweet Drafts', 'AI Graphics', 'Trend Alerts'].map((f) => (
                <span
                    key={f}
                    className="text-[9px] font-medium px-2 py-1 rounded-full"
                    style={{ backgroundColor: 'rgba(0, 136, 204, 0.08)', color: '#0088CC', border: '1px solid rgba(0, 136, 204, 0.15)' }}
                >
                    {f}
                </span>
            ))}
        </div>
    </div>
);

const ThemeVisual: React.FC<{ currentTheme?: 'dark' | 'light'; onThemeChange?: (t: 'dark' | 'light') => void }> = ({ currentTheme = 'dark', onThemeChange }) => (
    <div className="flex items-center justify-center gap-5">
        {(['dark', 'light'] as const).map((t) => {
            const isActive = currentTheme === t;
            const bg = t === 'dark' ? '#0A0A0B' : '#F5F5F7';
            const fg = t === 'dark' ? '#FFFFFF' : '#000000';
            const border = t === 'dark' ? '#1F1F23' : '#E5E5EA';
            const cardBg = t === 'dark' ? '#111113' : '#FFFFFF';

            return (
                <button
                    key={t}
                    onClick={() => onThemeChange?.(t)}
                    className="flex flex-col items-center gap-3 transition-all duration-200"
                    style={{ opacity: isActive ? 1 : 0.5 }}
                >
                    {/* Mini dashboard preview */}
                    <div
                        className="w-[140px] h-[90px] rounded-xl overflow-hidden p-2.5 transition-all duration-300"
                        style={{
                            backgroundColor: bg,
                            border: isActive ? '2px solid #FF5C00' : `2px solid ${border}`,
                            transform: isActive ? 'scale(1.05)' : 'scale(1)',
                        }}
                    >
                        <div className="flex gap-1.5 mb-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF5C00' }} />
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: border }} />
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: border }} />
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-6 rounded" style={{ backgroundColor: cardBg, height: '50px' }} />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3 rounded" style={{ backgroundColor: cardBg, width: '80%' }} />
                                <div className="h-3 rounded" style={{ backgroundColor: cardBg, width: '60%' }} />
                                <div className="h-3 rounded" style={{ backgroundColor: cardBg, width: '70%' }} />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-sharp text-base" style={{ color: isActive ? '#FF5C00' : 'var(--text-muted)', fontVariationSettings: "'wght' 300" }}>
                            {t === 'dark' ? 'dark_mode' : 'light_mode'}
                        </span>
                        <span className="text-sm font-semibold capitalize" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {t} Mode
                        </span>
                        {isActive && (
                            <span className="material-symbols-sharp text-sm" style={{ color: '#22C55E', fontVariationSettings: "'wght' 300, 'FILL' 1" }}>
                                check_circle
                            </span>
                        )}
                    </div>
                </button>
            );
        })}
    </div>
);

const PricingVisual: React.FC<{ onSelectPlan?: (tier: 'starter' | 'growth') => void }> = ({ onSelectPlan }) => {
    const plans = [
        {
            tier: 'starter' as const,
            name: 'Starter',
            price: 299,
            features: ['1 brand', '50 posts/mo', '25 AI images', '3 campaigns'],
            accent: '#FF5C00',
        },
        {
            tier: 'growth' as const,
            name: 'Growth',
            price: 499,
            popular: true,
            features: ['3 brands', '200 posts/mo', '100 AI images', 'Unlimited campaigns'],
            accent: '#8B5CF6',
        },
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                {plans.map((plan) => (
                    <button
                        key={plan.tier}
                        onClick={() => onSelectPlan?.(plan.tier)}
                        className="relative rounded-2xl p-4 text-left transition-all duration-200 hover:scale-[1.02] group"
                        style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            border: plan.popular ? `2px solid ${plan.accent}` : '1px solid var(--border)',
                        }}
                    >
                        {plan.popular && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white" style={{ backgroundColor: plan.accent }}>
                                POPULAR
                            </span>
                        )}
                        <div className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{plan.name}</div>
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-2xl font-bold" style={{ color: plan.accent }}>${plan.price}</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/mo</span>
                        </div>
                        <div className="space-y-1.5">
                            {plan.features.map((f) => (
                                <div key={f} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    <span className="material-symbols-sharp text-xs" style={{ color: '#22C55E', fontVariationSettings: "'wght' 300, 'FILL' 1" }}>check</span>
                                    {f}
                                </div>
                            ))}
                        </div>
                        <div
                            className="mt-3 w-full py-2 rounded-lg text-center text-xs font-semibold transition-colors"
                            style={{
                                backgroundColor: plan.popular ? plan.accent : 'transparent',
                                color: plan.popular ? '#FFFFFF' : plan.accent,
                                border: plan.popular ? 'none' : `1px solid ${plan.accent}`,
                            }}
                        >
                            Start Free Trial
                        </div>
                    </button>
                ))}
            </div>
            <div className="text-center">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    <span className="material-symbols-sharp text-xs align-middle mr-1" style={{ color: '#22C55E', fontVariationSettings: "'wght' 300, 'FILL' 1" }}>shield</span>
                    24-hour free trial &middot; No credit card required &middot; Cancel anytime
                </p>
            </div>
        </div>
    );
};

const TrialVisual: React.FC = () => (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
            {[
                { icon: 'edit_square', label: '50 posts/month', sub: 'AI-generated content' },
                { icon: 'image', label: '25 AI images', sub: 'On-brand graphics' },
                { icon: 'campaign', label: '3 campaigns', sub: 'Strategic campaigns' },
                { icon: 'auto_awesome', label: 'AI CMO brain', sub: 'Daily analysis' },
            ].map((item) => (
                <div
                    key={item.label}
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                >
                    <span className="material-symbols-sharp text-lg" style={{ color: '#22C55E', fontVariationSettings: "'wght' 300" }}>
                        {item.icon}
                    </span>
                    <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.label}</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.sub}</div>
                    </div>
                </div>
            ))}
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(255, 92, 0, 0.06)', border: '1px solid rgba(255, 92, 0, 0.15)' }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                After 24 hours, upgrade to keep creating. Your data and brand setup are always saved.
            </p>
        </div>
    </div>
);

const CompleteVisual: React.FC = () => (
    <div className="flex items-center justify-center">
        <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(255, 92, 0, 0.15), rgba(255, 92, 0, 0.3))' }}
        >
            <span
                className="material-symbols-sharp text-5xl"
                style={{ color: '#FF5C00', fontVariationSettings: "'wght' 300, 'FILL' 1" }}
            >
                check_circle
            </span>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const ProductTour: React.FC<ProductTourProps> = ({
    brandName,
    kickoffDrafts,
    socialMetrics,
    theme: currentTheme = 'dark',
    onThemeChange,
    onSelectPlan,
    onComplete,
    onSkip,
}) => {
    const slides = SLIDES;
    const totalSlides = slides.length;
    const [currentSlide, setCurrentSlide] = useState(0);
    const [slideKey, setSlideKey] = useState(0);
    const isLastSlide = currentSlide === totalSlides - 1;
    const isFirstSlide = currentSlide === 0;
    const isPricingSlide = slides[currentSlide]?.visual === 'pricing';

    const goNext = useCallback(() => {
        if (isLastSlide) {
            onComplete();
        } else {
            setCurrentSlide(prev => prev + 1);
            setSlideKey(prev => prev + 1);
        }
    }, [isLastSlide, onComplete]);

    const goPrev = useCallback(() => {
        if (!isFirstSlide) {
            setCurrentSlide(prev => prev - 1);
            setSlideKey(prev => prev + 1);
        }
    }, [isFirstSlide]);

    const goToSlide = useCallback((index: number) => {
        setCurrentSlide(index);
        setSlideKey(prev => prev + 1);
    }, []);

    // Handle plan selection — advance to "You're All Set" slide
    const handleSelectPlan = useCallback((tier: 'starter' | 'growth') => {
        onSelectPlan?.(tier);
        // Jump to the last slide (complete)
        setCurrentSlide(totalSlides - 1);
        setSlideKey(prev => prev + 1);
    }, [onSelectPlan, totalSlides]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'Escape') onSkip();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goNext, goPrev, onSkip]);

    const slide = slides[currentSlide];
    const sampleDraft = kickoffDrafts?.[0]?.tweet || kickoffDrafts?.[0]?.content || undefined;

    const renderVisual = () => {
        switch (slide.visual) {
            case 'welcome':
                return <WelcomeVisual brandName={brandName} />;
            case 'ai':
                return <AIVisual drafts={kickoffDrafts} />;
            case 'dashboard':
                return <DashboardVisual metrics={socialMetrics} />;
            case 'studio':
                return <StudioVisual draft={sampleDraft} />;
            case 'telegram':
                return <TelegramVisual />;
            case 'theme':
                return <ThemeVisual currentTheme={currentTheme} onThemeChange={onThemeChange} />;
            case 'pricing':
                return <PricingVisual onSelectPlan={handleSelectPlan} />;
            case 'trial':
                return <TrialVisual />;
            case 'complete':
                return <CompleteVisual />;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ animation: 'tourFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <style>{`
                @keyframes tourFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes tourSlideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes tourScaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>

            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
                onClick={onSkip}
            />

            {/* Card — max-w-2xl for bigger presence */}
            <div
                className="relative z-10 w-full max-w-2xl rounded-3xl overflow-hidden"
                style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
                    animation: 'tourScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Top accent bar */}
                <div
                    className="h-1 transition-colors duration-300"
                    style={{ backgroundColor: slide.accent }}
                />

                {/* Skip button */}
                <button
                    onClick={onSkip}
                    className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105 z-10"
                    style={{
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                    }}
                >
                    Skip
                    <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                </button>

                {/* Slide content */}
                <div className="px-12 pt-14 pb-8" key={slideKey} style={{ animation: 'tourSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                    {/* Icon */}
                    <div className="flex justify-center mb-7">
                        <div
                            className="w-18 h-18 rounded-2xl flex items-center justify-center transition-colors duration-300"
                            style={{
                                width: '72px',
                                height: '72px',
                                background: `linear-gradient(135deg, ${slide.accent}15, ${slide.accent}28)`,
                                border: `1px solid ${slide.accent}20`,
                            }}
                        >
                            <span
                                className="material-symbols-sharp text-4xl"
                                style={{ color: slide.accent, fontVariationSettings: "'wght' 300, 'FILL' 1" }}
                            >
                                {slide.icon}
                            </span>
                        </div>
                    </div>

                    {/* Step indicator */}
                    <div className="text-center mb-2">
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--text-muted)' }}>
                            Step {currentSlide + 1} of {totalSlides}
                        </span>
                    </div>

                    {/* Title */}
                    <h2
                        className="text-2xl font-bold text-center mb-3"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        {slide.title}
                    </h2>

                    {/* Description */}
                    <p
                        className="text-center text-sm leading-relaxed max-w-md mx-auto mb-8"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {slide.description}
                    </p>

                    {/* Visual */}
                    <div className="max-w-lg mx-auto">
                        {renderVisual()}
                    </div>
                </div>

                {/* Navigation footer */}
                <div
                    className="px-12 py-5 flex items-center justify-between"
                    style={{ borderTop: '1px solid var(--border)' }}
                >
                    {/* Back button */}
                    <div className="w-28">
                        {!isFirstSlide && (
                            <button
                                onClick={goPrev}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                                Back
                            </button>
                        )}
                    </div>

                    {/* Dots */}
                    <div className="flex items-center gap-2">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goToSlide(i)}
                                className="transition-all duration-300"
                                style={{
                                    width: i === currentSlide ? '24px' : '8px',
                                    height: '8px',
                                    borderRadius: '4px',
                                    backgroundColor: i === currentSlide ? slide.accent : 'var(--border-subtle, var(--border))',
                                }}
                                aria-label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>

                    {/* Next / Get Started */}
                    <div className="w-28 flex justify-end">
                        <button
                            onClick={goNext}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105"
                            style={{
                                backgroundColor: slide.accent,
                                color: '#FFFFFF',
                                boxShadow: `0 4px 16px ${slide.accent}40`,
                            }}
                        >
                            {isLastSlide ? 'Get Started' : isPricingSlide ? 'Skip for now' : 'Next'}
                            {!isLastSlide && (
                                <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>arrow_forward</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
