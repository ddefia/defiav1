import React, { useEffect } from 'react';
import { PlanTier, PlanLimits } from '../types';
import { PLAN_LIMITS, PLAN_NAMES, PLAN_PRICES } from '../services/subscription';

export type LimitType = 'content' | 'image' | 'campaign' | 'knowledgeBase' | 'competitor' | 'trial_expired';

interface UsageLimitModalProps {
    isOpen: boolean;
    limitType: LimitType;
    current: number;
    max: number;
    currentPlan: PlanTier;
    onUpgrade: () => void;
    onDismiss: () => void;
}

const LIMIT_CONFIG: Record<LimitType, {
    label: string;
    icon: string;
    unit: string;
    limitKey: keyof PlanLimits;
}> = {
    content:        { label: 'Content Pieces', icon: 'edit_note',     unit: '/mo',  limitKey: 'contentPerMonth' },
    image:          { label: 'AI Images',      icon: 'image',         unit: '/mo',  limitKey: 'imagesPerMonth' },
    campaign:       { label: 'Campaigns',      icon: 'campaign',      unit: '',     limitKey: 'maxCampaigns' },
    knowledgeBase:  { label: 'Knowledge Docs', icon: 'menu_book',     unit: '',     limitKey: 'maxKnowledgeDocs' },
    competitor:     { label: 'Competitors',    icon: 'swords',        unit: '',     limitKey: 'maxCompetitors' },
    trial_expired:  { label: 'Free Trial',     icon: 'timer_off',     unit: '',     limitKey: 'contentPerMonth' },
};

const TIER_ORDER: PlanTier[] = ['starter', 'growth', 'enterprise'];

const getNextTier = (current: PlanTier): PlanTier | null => {
    const idx = TIER_ORDER.indexOf(current);
    if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
    return TIER_ORDER[idx + 1];
};

const formatLimit = (value: number | boolean, unit: string): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === -1) return 'Unlimited';
    return `${value}${unit}`;
};

export const UsageLimitModal: React.FC<UsageLimitModalProps> = ({
    isOpen,
    limitType,
    current,
    max,
    currentPlan,
    onUpgrade,
    onDismiss,
}) => {
    // Escape key handler
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onDismiss();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onDismiss]);

    if (!isOpen) return null;

    const config = LIMIT_CONFIG[limitType];
    const nextTier = getNextTier(currentPlan);
    const nextTierLimit = nextTier ? PLAN_LIMITS[nextTier][config.limitKey] : null;
    const nextTierName = nextTier ? PLAN_NAMES[nextTier] : null;
    const nextTierPrice = nextTier ? PLAN_PRICES[nextTier] : null;
    const currentTierName = PLAN_NAMES[currentPlan];
    const currentLimit = PLAN_LIMITS[currentPlan][config.limitKey];

    const pct = typeof max === 'number' && max > 0 ? Math.min(100, (current / max) * 100) : 100;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ animation: 'limitFadeIn 0.2s ease-out' }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-md"
                onClick={onDismiss}
            />

            {/* Card */}
            <div
                className="relative w-full max-w-md rounded-2xl overflow-hidden"
                style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 40px 100px rgba(0,0,0,0.5)',
                    animation: 'limitScaleIn 0.25s ease-out',
                }}
            >
                {/* Orange accent bar */}
                <div className="h-1 bg-[#FF5C00]" />

                {/* Close button */}
                <button
                    onClick={onDismiss}
                    className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/10 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <span className="material-symbols-sharp text-lg">close</span>
                </button>

                <div className="px-8 pt-8 pb-6">
                    {/* Icon */}
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(255,92,0,0.1), rgba(255,92,0,0.2))' }}
                    >
                        <span
                            className="material-symbols-sharp text-3xl text-[#FF5C00]"
                            style={{ fontVariationSettings: "'wght' 300" }}
                        >
                            {config.icon}
                        </span>
                    </div>

                    {/* Title */}
                    <h2
                        className="text-xl font-bold text-center mb-2"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        {limitType === 'trial_expired' ? 'Your free trial has ended' : "You've hit your limit"}
                    </h2>

                    {/* Description */}
                    <p
                        className="text-sm text-center mb-6 leading-relaxed"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {limitType === 'trial_expired' ? (
                            <>
                                Upgrade to a paid plan to keep creating content, generating images, and running your AI marketing engine.
                            </>
                        ) : (
                            <>
                                You've used all {max} {config.label.toLowerCase()} on your{' '}
                                <span style={{ color: 'var(--text-primary)' }} className="font-medium">{currentTierName}</span>{' '}
                                plan{config.unit === '/mo' ? ' this month' : ''}.
                            </>
                        )}
                    </p>

                    {/* Usage bar — hide for trial expired */}
                    {limitType !== 'trial_expired' && (
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                {config.label}
                            </span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: pct >= 100 ? '#EF4444' : 'var(--text-secondary)' }}>
                                {current}/{max}
                            </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#FF5C00',
                                }}
                            />
                        </div>
                    </div>
                    )}

                    {/* Plan comparison */}
                    {nextTier && nextTierLimit !== null && (
                        <div
                            className="rounded-xl p-4 mb-6 flex items-center justify-between"
                            style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                        >
                            {/* Current plan */}
                            <div className="text-center flex-1">
                                <div className="text-[10px] font-semibold tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                    {currentTierName.toUpperCase()}
                                </div>
                                <div className="text-lg font-bold" style={{ color: 'var(--text-muted)', textDecoration: 'line-through', textDecorationColor: 'rgba(239,68,68,0.5)' }}>
                                    {formatLimit(currentLimit, config.unit)}
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className="mx-3 flex-shrink-0">
                                <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 400" }}>
                                    arrow_forward
                                </span>
                            </div>

                            {/* Next plan */}
                            <div className="text-center flex-1">
                                <div className="text-[10px] font-semibold tracking-wider mb-1 text-[#FF5C00]">
                                    {nextTierName?.toUpperCase()}
                                </div>
                                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {formatLimit(nextTierLimit, config.unit)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CTA Button */}
                    {nextTier ? (
                        <button
                            onClick={onUpgrade}
                            className="w-full py-3 rounded-xl bg-[#FF5C00] text-white text-sm font-semibold hover:bg-[#FF6B1A] transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 400" }}>upgrade</span>
                            Upgrade to {nextTierName}
                            {nextTierPrice?.monthly && (
                                <span className="text-white/70 font-normal">— ${nextTierPrice.monthly}/mo</span>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                window.location.href = 'mailto:sales@defia.io?subject=Enterprise%20Plan%20Inquiry';
                            }}
                            className="w-full py-3 rounded-xl bg-[#FF5C00] text-white text-sm font-semibold hover:bg-[#FF6B1A] transition-colors"
                        >
                            Contact Sales for Enterprise
                        </button>
                    )}

                    {/* Dismiss */}
                    <button
                        onClick={onDismiss}
                        className="w-full mt-3 py-2 text-xs font-medium text-center transition-colors hover:underline"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Maybe Later
                    </button>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes limitFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes limitScaleIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
};
