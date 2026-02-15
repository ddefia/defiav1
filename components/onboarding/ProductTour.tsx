import React, { useState, useEffect, useCallback } from 'react';

interface ProductTourProps {
    onComplete: () => void;
    onSkip: () => void;
}

interface Slide {
    icon: string;
    title: string;
    description: string;
    accent: string;
    visual: 'welcome' | 'ai' | 'dashboard' | 'studio' | 'analytics' | 'complete';
}

const slides: Slide[] = [
    {
        icon: 'rocket_launch',
        title: 'Welcome to DEFIA',
        description: 'Your AI-powered marketing command center for Web3 brands. Let\u2019s take a quick look at what you can do.',
        accent: '#FF5C00',
        visual: 'welcome',
    },
    {
        icon: 'auto_awesome',
        title: 'Your AI CMO',
        description: 'An AI copilot that analyzes market trends, generates strategies, and recommends actions tailored to your brand.',
        accent: '#FF5C00',
        visual: 'ai',
    },
    {
        icon: 'dashboard',
        title: 'Dashboard & Insights',
        description: 'Monitor KPIs, track growth metrics, and get your daily brief with actionable insights \u2014 all in one place.',
        accent: '#3B82F6',
        visual: 'dashboard',
    },
    {
        icon: 'edit_square',
        title: 'Content Studio',
        description: 'Create tweets, threads, and graphics in seconds with AI templates matched to your brand voice.',
        accent: '#8B5CF6',
        visual: 'studio',
    },
    {
        icon: 'analytics',
        title: 'Analytics & Calendar',
        description: 'Track performance, measure campaign success, and schedule content with smart timing recommendations.',
        accent: '#10B981',
        visual: 'analytics',
    },
    {
        icon: 'celebration',
        title: 'You\u2019re All Set!',
        description: 'Start creating campaigns, generating content, and growing your Web3 brand with AI at your side.',
        accent: '#FF5C00',
        visual: 'complete',
    },
];

const SlideVisual: React.FC<{ slide: Slide; isActive: boolean }> = ({ slide, isActive }) => {
    if (!isActive) return null;

    const renderMockUI = () => {
        switch (slide.visual) {
            case 'welcome':
                return (
                    <div className="flex items-center justify-center gap-3">
                        {['auto_awesome', 'dashboard', 'edit_square', 'analytics', 'calendar_month'].map((icon, i) => (
                            <div
                                key={icon}
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{
                                    backgroundColor: `rgba(255, 92, 0, ${0.08 + i * 0.04})`,
                                    animationDelay: `${i * 100}ms`,
                                }}
                            >
                                <span
                                    className="material-symbols-sharp text-xl"
                                    style={{ color: '#FF5C00', fontVariationSettings: "'wght' 300" }}
                                >
                                    {icon}
                                </span>
                            </div>
                        ))}
                    </div>
                );
            case 'ai':
                return (
                    <div className="space-y-2.5">
                        {['Trend analysis complete', 'Strategy generated', '3 actions recommended'].map((text, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                            >
                                <span
                                    className="material-symbols-sharp text-base"
                                    style={{ color: '#FF5C00', fontVariationSettings: "'wght' 300, 'FILL' 1" }}
                                >
                                    check_circle
                                </span>
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'dashboard':
                return (
                    <div className="grid grid-cols-3 gap-2.5">
                        {[
                            { label: 'Followers', value: '12.4K' },
                            { label: 'Engagement', value: '8.2%' },
                            { label: 'Impressions', value: '284K' },
                        ].map((kpi, i) => (
                            <div
                                key={i}
                                className="rounded-xl px-4 py-3 text-center"
                                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                            >
                                <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{kpi.value}</div>
                                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{kpi.label}</div>
                            </div>
                        ))}
                    </div>
                );
            case 'studio':
                return (
                    <div className="space-y-2.5">
                        {['Tweet thread', 'Campaign graphic', 'Community poll'].map((text, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                                style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                            >
                                <span
                                    className="material-symbols-sharp text-base"
                                    style={{ color: slide.accent, fontVariationSettings: "'wght' 300" }}
                                >
                                    {['short_text', 'image', 'poll'][i]}
                                </span>
                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{text}</span>
                                <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${slide.accent}15`, color: slide.accent }}>
                                    AI
                                </span>
                            </div>
                        ))}
                    </div>
                );
            case 'analytics':
                return (
                    <div className="flex items-end gap-1.5 justify-center h-16">
                        {[35, 50, 40, 65, 55, 80, 70, 90, 75, 85].map((h, i) => (
                            <div
                                key={i}
                                className="w-5 rounded-t-md transition-all duration-500"
                                style={{
                                    height: `${h}%`,
                                    backgroundColor: i >= 7 ? slide.accent : `${slide.accent}30`,
                                    animationDelay: `${i * 60}ms`,
                                }}
                            />
                        ))}
                    </div>
                );
            case 'complete':
                return (
                    <div className="flex items-center justify-center">
                        <div
                            className="w-20 h-20 rounded-full flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${slide.accent}20, ${slide.accent}40)` }}
                        >
                            <span
                                className="material-symbols-sharp text-4xl"
                                style={{ color: slide.accent, fontVariationSettings: "'wght' 300, 'FILL' 1" }}
                            >
                                check_circle
                            </span>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="mt-8 mb-2">
            {renderMockUI()}
        </div>
    );
};

export const ProductTour: React.FC<ProductTourProps> = ({ onComplete, onSkip }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [slideKey, setSlideKey] = useState(0);
    const isLastSlide = currentSlide === slides.length - 1;
    const isFirstSlide = currentSlide === 0;

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

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ animation: 'tourFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            {/* Inline animations */}
            <style>{`
                @keyframes tourFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes tourSlideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes tourScaleIn {
                    from { opacity: 0; transform: scale(0.96); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes tourPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            `}</style>

            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onSkip}
            />

            {/* Card */}
            <div
                className="relative z-10 w-full max-w-lg rounded-3xl overflow-hidden"
                style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
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
                    className="absolute top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105"
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
                <div className="px-10 pt-12 pb-6" key={slideKey} style={{ animation: 'tourSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300"
                            style={{
                                background: `linear-gradient(135deg, ${slide.accent}18, ${slide.accent}30)`,
                                border: `1px solid ${slide.accent}25`,
                            }}
                        >
                            <span
                                className="material-symbols-sharp text-3xl"
                                style={{ color: slide.accent, fontVariationSettings: "'wght' 300, 'FILL' 1" }}
                            >
                                {slide.icon}
                            </span>
                        </div>
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
                        className="text-center text-base leading-relaxed max-w-md mx-auto"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {slide.description}
                    </p>

                    {/* Visual */}
                    <SlideVisual slide={slide} isActive={true} />
                </div>

                {/* Navigation footer */}
                <div
                    className="px-10 py-5 flex items-center justify-between"
                    style={{ borderTop: '1px solid var(--border)' }}
                >
                    {/* Back button */}
                    <div className="w-24">
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
                    <div className="w-24 flex justify-end">
                        <button
                            onClick={goNext}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105"
                            style={{
                                backgroundColor: slide.accent,
                                color: '#FFFFFF',
                                boxShadow: `0 4px 12px ${slide.accent}40`,
                            }}
                        >
                            {isLastSlide ? 'Get Started' : 'Next'}
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
