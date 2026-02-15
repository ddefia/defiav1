import React, { useState } from 'react';
import { PlanTier, PlanUsage } from '../types';
import { PLAN_LIMITS, getResetUsage } from '../services/subscription';
import { getAuthToken } from '../services/auth';

// ─── Tier Data ───────────────────────────────────────────────────────────────

interface PricingTier {
    name: string;
    description: string;
    monthlyPrice: number | null; // null = custom
    annualPrice: number | null;
    features: { text: string; included: boolean }[];
    cta: string;
    isPopular?: boolean;
    isEnterprise?: boolean;
    icon: string;
}

const TIERS: PricingTier[] = [
    {
        name: 'Starter',
        description: 'Solo founders getting started with AI marketing.',
        monthlyPrice: 299,
        annualPrice: 239,
        icon: 'rocket_launch',
        cta: 'Get Started',
        features: [
            { text: '1 brand profile', included: true },
            { text: 'AI Brain analysis (daily)', included: true },
            { text: '50 AI content pieces/month', included: true },
            { text: '25 AI images/month', included: true },
            { text: '3 active campaigns', included: true },
            { text: 'Basic social analytics', included: true },
            { text: 'Content calendar', included: true },
            { text: 'Telegram bot integration', included: true },
            { text: '1 competitor tracked', included: true },
            { text: '5 knowledge base docs', included: true },
            { text: 'Email support', included: true },
            { text: 'On-chain analytics (Dune)', included: false },
            { text: 'Auto-publish to X', included: false },
            { text: 'AI CMO Copilot', included: false },
        ],
    },
    {
        name: 'Growth',
        description: 'Growing protocols needing full automation.',
        monthlyPrice: 499,
        annualPrice: 399,
        icon: 'trending_up',
        cta: 'Get Started',
        isPopular: true,
        features: [
            { text: '3 brand profiles', included: true },
            { text: 'AI Brain analysis (every 6h)', included: true },
            { text: '200 AI content pieces/month', included: true },
            { text: '100 AI images/month', included: true },
            { text: 'Unlimited campaigns', included: true },
            { text: 'Full social + on-chain analytics (Dune)', included: true },
            { text: 'Auto-publish to Twitter/X', included: true },
            { text: 'Telegram bot integration', included: true },
            { text: 'AI CMO Copilot', included: true },
            { text: 'Strategic Posture AI', included: true },
            { text: '5 competitors tracked', included: true },
            { text: '25 knowledge base docs', included: true },
            { text: 'Priority support', included: true },
        ],
    },
    {
        name: 'Enterprise',
        description: 'Agencies, large protocols & multi-brand ops.',
        monthlyPrice: null,
        annualPrice: null,
        icon: 'domain',
        cta: 'Contact Sales',
        isEnterprise: true,
        features: [
            { text: 'Unlimited brands', included: true },
            { text: 'Employee team accounts', included: true },
            { text: 'Custom Brain frequency (down to 1h)', included: true },
            { text: 'Unlimited content & images', included: true },
            { text: 'Custom dashboards', included: true },
            { text: 'Approval workflows', included: true },
            { text: 'Dedicated account manager', included: true },
            { text: 'Custom integrations & API access', included: true },
            { text: 'Telegram bot integration', included: true },
            { text: 'SSO & team management', included: true },
            { text: 'SLA guarantee', included: true },
            { text: 'White-label option', included: true },
        ],
    },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface PricingPageProps {
    onSelectPlan?: (tier: string) => void;
    currentPlan?: PlanTier;
    usage?: PlanUsage;
    brandId?: string;
}

const TIER_KEY_MAP: Record<string, PlanTier> = {
    'Starter': 'starter',
    'Growth': 'growth',
    'Enterprise': 'enterprise',
};

// Maps tier names to env var key suffix for price IDs
const TIER_PRICE_ENV: Record<string, string> = {
    'Starter': import.meta.env.VITE_STRIPE_STARTER_PRICE_ID || '',
    'Growth': import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID || '',
};

export const PricingPage: React.FC<PricingPageProps> = ({ onSelectPlan, currentPlan, usage, brandId }) => {
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

    const handleSelect = async (tier: PricingTier) => {
        if (tier.isEnterprise) {
            window.location.href = 'mailto:sales@defia.io?subject=Enterprise%20Plan%20Inquiry&body=Hi%20Defia%20team%2C%0A%0AI%27m%20interested%20in%20the%20Enterprise%20plan.%0A%0ABrand%3A%20%0ATeam%20size%3A%20%0A';
            return;
        }
        const tierKey = TIER_KEY_MAP[tier.name];
        if (tierKey === currentPlan) return;

        const priceId = TIER_PRICE_ENV[tier.name];
        if (!priceId) {
            // Stripe not configured yet — fall back to notification
            onSelectPlan?.(tier.name);
            alert(`${tier.name} plan selected! Billing will be available soon.`);
            return;
        }

        setCheckoutLoading(tier.name);
        try {
            const token = await getAuthToken();
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const res = await fetch(`${baseUrl}/api/billing/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ priceId, brandId }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create checkout session');

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err: any) {
            console.error('[PricingPage] Checkout error:', err);
            alert(`Checkout failed: ${err.message}`);
        } finally {
            setCheckoutLoading(null);
        }
    };

    // Compute reset-safe usage for display
    const safeUsage = usage ? getResetUsage(usage) : null;
    const currentLimits = currentPlan ? PLAN_LIMITS[currentPlan] : null;

    return (
        <div className="flex flex-col gap-8">
            {/* Usage Summary (shown when a plan is active) */}
            {currentPlan && safeUsage && currentLimits && (
                <div
                    className="rounded-[14px] p-5 flex flex-wrap items-center gap-6"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                >
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-sharp text-lg" style={{ color: '#FF5C00', fontVariationSettings: "'FILL' 1, 'wght' 300" }}>workspace_premium</span>
                        <span className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                            {currentPlan} Plan
                        </span>
                    </div>
                    <div className="h-5 w-px" style={{ backgroundColor: 'var(--border)' }} />
                    <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Content:</span>
                        <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: currentLimits.contentPerMonth === -1 ? '10%' : `${Math.min(100, (safeUsage.contentThisMonth / currentLimits.contentPerMonth) * 100)}%`,
                                    backgroundColor: currentLimits.contentPerMonth !== -1 && safeUsage.contentThisMonth >= currentLimits.contentPerMonth ? '#EF4444' : '#FF5C00',
                                }}
                            />
                        </div>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {safeUsage.contentThisMonth}/{currentLimits.contentPerMonth === -1 ? '∞' : currentLimits.contentPerMonth}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Images:</span>
                        <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div
                                className="h-full rounded-full transition-all"
                                style={{
                                    width: currentLimits.imagesPerMonth === -1 ? '10%' : `${Math.min(100, (safeUsage.imagesThisMonth / currentLimits.imagesPerMonth) * 100)}%`,
                                    backgroundColor: currentLimits.imagesPerMonth !== -1 && safeUsage.imagesThisMonth >= currentLimits.imagesPerMonth ? '#EF4444' : '#FF5C00',
                                }}
                            />
                        </div>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {safeUsage.imagesThisMonth}/{currentLimits.imagesPerMonth === -1 ? '∞' : currentLimits.imagesPerMonth}
                        </span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Plans & Billing
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Choose the plan that matches your growth stage.
                    </p>
                </div>

                {/* Billing Toggle */}
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center rounded-lg p-1 gap-0.5"
                        style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                    >
                        <button
                            onClick={() => setBillingPeriod('monthly')}
                            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200"
                            style={{
                                backgroundColor: billingPeriod === 'monthly' ? '#FF5C00' : 'transparent',
                                color: billingPeriod === 'monthly' ? '#FFFFFF' : 'var(--text-muted)',
                            }}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingPeriod('annual')}
                            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200"
                            style={{
                                backgroundColor: billingPeriod === 'annual' ? '#FF5C00' : 'transparent',
                                color: billingPeriod === 'annual' ? '#FFFFFF' : 'var(--text-muted)',
                            }}
                        >
                            Annual
                        </button>
                    </div>
                    {billingPeriod === 'annual' && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E]">
                            Save 20%
                        </span>
                    )}
                </div>
            </div>

            {/* Tier Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {TIERS.map((tier) => (
                    <PricingCard
                        key={tier.name}
                        tier={tier}
                        billingPeriod={billingPeriod}
                        onSelect={() => handleSelect(tier)}
                        isCurrent={TIER_KEY_MAP[tier.name] === currentPlan}
                        isLoading={checkoutLoading === tier.name}
                    />
                ))}
            </div>

            {/* Footer */}
            <div
                className="rounded-[14px] p-5 flex items-center gap-4"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
            >
                <span
                    className="material-symbols-sharp text-2xl"
                    style={{ color: '#FF5C00', fontVariationSettings: "'FILL' 1, 'wght' 300" }}
                >
                    shield
                </span>
                <div>
                    <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>
                        14-day free trial on all plans
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        No credit card required. Cancel anytime during your trial.
                    </span>
                </div>
            </div>
        </div>
    );
};

// ─── Pricing Card ────────────────────────────────────────────────────────────

interface PricingCardProps {
    tier: PricingTier;
    billingPeriod: 'monthly' | 'annual';
    onSelect: () => void;
    isCurrent?: boolean;
}

const PricingCard: React.FC<PricingCardProps & { isLoading?: boolean }> = ({ tier, billingPeriod, onSelect, isCurrent, isLoading }) => {
    const price = billingPeriod === 'annual' ? tier.annualPrice : tier.monthlyPrice;
    const monthlyEquivalent = tier.monthlyPrice;
    const isAnnual = billingPeriod === 'annual';

    return (
        <div
            className="relative rounded-[14px] p-6 flex flex-col"
            style={{
                backgroundColor: 'var(--bg-secondary)',
                border: tier.isPopular ? '1px solid #FF5C00' : '1px solid var(--border)',
                boxShadow: tier.isPopular
                    ? '0 0 40px rgba(255,92,0,0.08), var(--card-shadow)'
                    : 'var(--card-shadow)',
            }}
        >
            {/* Popular Badge */}
            {tier.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span
                        className="px-4 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap"
                        style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                    >
                        Most Popular
                    </span>
                </div>
            )}

            {/* Tier Header */}
            <div className="flex items-center gap-3 mb-2 mt-1">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                        background: tier.isPopular
                            ? 'linear-gradient(135deg, #FF5C00, #FF8400)'
                            : tier.isEnterprise
                            ? 'linear-gradient(135deg, #8B5CF6, #A78BFA)'
                            : 'var(--bg-tertiary)',
                    }}
                >
                    <span
                        className="material-symbols-sharp text-xl"
                        style={{
                            color: tier.isPopular || tier.isEnterprise ? '#FFFFFF' : 'var(--text-muted)',
                            fontVariationSettings: "'FILL' 1, 'wght' 300",
                        }}
                    >
                        {tier.icon}
                    </span>
                </div>
                <div>
                    <span className="text-base font-semibold block" style={{ color: 'var(--text-primary)' }}>
                        {tier.name}
                    </span>
                </div>
            </div>

            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                {tier.description}
            </p>

            {/* Price */}
            <div className="mb-5">
                {price !== null ? (
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            ${price}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            /month
                        </span>
                        {isAnnual && monthlyEquivalent && (
                            <span className="text-sm line-through ml-2" style={{ color: 'var(--text-faint)' }}>
                                ${monthlyEquivalent}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            Custom
                        </span>
                    </div>
                )}
                {isAnnual && price !== null && (
                    <span className="text-xs mt-1 block" style={{ color: 'var(--text-muted)' }}>
                        Billed annually at ${price * 12}/year
                    </span>
                )}
                {tier.isEnterprise && (
                    <span className="text-xs mt-1 block" style={{ color: 'var(--text-muted)' }}>
                        Tailored to your team and scale
                    </span>
                )}
            </div>

            {/* CTA Button */}
            <button
                onClick={isCurrent || isLoading ? undefined : onSelect}
                disabled={isCurrent || isLoading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 mb-6"
                style={
                    isCurrent
                        ? {
                              backgroundColor: 'var(--bg-tertiary)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              cursor: 'default',
                          }
                        : tier.isEnterprise
                        ? {
                              backgroundColor: 'transparent',
                              border: '1px solid #FF5C00',
                              color: '#FF5C00',
                          }
                        : {
                              background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)',
                              color: '#FFFFFF',
                              border: 'none',
                              boxShadow: tier.isPopular ? '0 4px 16px rgba(255,92,0,0.3)' : 'none',
                          }
                }
                onMouseEnter={(e) => {
                    if (isCurrent) return;
                    if (tier.isEnterprise) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,92,0,0.08)';
                    } else {
                        e.currentTarget.style.opacity = '0.9';
                    }
                }}
                onMouseLeave={(e) => {
                    if (isCurrent) return;
                    if (tier.isEnterprise) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    } else {
                        e.currentTarget.style.opacity = '1';
                    }
                }}
            >
                {isCurrent ? '✓ Current Plan' : isLoading ? 'Redirecting…' : tier.cta}
            </button>

            {/* Divider */}
            <div className="h-px mb-5" style={{ backgroundColor: 'var(--border)' }} />

            {/* Feature heading */}
            <span className="text-xs font-semibold uppercase tracking-wider mb-3 block" style={{ color: 'var(--text-muted)' }}>
                {tier.isEnterprise ? 'Everything in Growth, plus:' : tier.isPopular ? 'Everything in Starter, plus:' : 'What\'s included:'}
            </span>

            {/* Features */}
            <ul className="space-y-2.5 flex-1">
                {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                        <span
                            className="material-symbols-sharp text-base mt-0.5 flex-shrink-0"
                            style={{
                                color: feature.included ? '#22C55E' : 'var(--text-faint)',
                                fontVariationSettings: "'FILL' 1, 'wght' 300",
                            }}
                        >
                            {feature.included ? 'check_circle' : 'cancel'}
                        </span>
                        <span
                            className="text-sm"
                            style={{ color: feature.included ? 'var(--text-secondary)' : 'var(--text-faint)' }}
                        >
                            {feature.text}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};
