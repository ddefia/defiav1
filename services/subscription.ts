import { PlanTier, PlanLimits, BrandSubscription, PlanUsage } from '../types';

// ─── Plan Definitions ────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
    starter: {
        maxBrands: 1,
        brainFrequencyHours: 24,
        contentPerMonth: 50,
        imagesPerMonth: 25,
        maxCampaigns: 3,
        maxCompetitors: 1,
        maxKnowledgeDocs: 5,
        onChainAnalytics: false,
        autoPublish: false,
        aiCopilot: false,
        maxTeamMembers: 1,
    },
    growth: {
        maxBrands: 3,
        brainFrequencyHours: 6,
        contentPerMonth: 200,
        imagesPerMonth: 100,
        maxCampaigns: -1,
        maxCompetitors: 5,
        maxKnowledgeDocs: 25,
        onChainAnalytics: true,
        autoPublish: true,
        aiCopilot: true,
        maxTeamMembers: 1,
    },
    enterprise: {
        maxBrands: -1,
        brainFrequencyHours: 1,
        contentPerMonth: -1,
        imagesPerMonth: -1,
        maxCampaigns: -1,
        maxCompetitors: -1,
        maxKnowledgeDocs: -1,
        onChainAnalytics: true,
        autoPublish: true,
        aiCopilot: true,
        maxTeamMembers: -1,
    },
};

export const PLAN_NAMES: Record<PlanTier, string> = {
    starter: 'Starter',
    growth: 'Growth',
    enterprise: 'Enterprise',
};

export const PLAN_PRICES: Record<PlanTier, { monthly: number | null; annual: number | null }> = {
    starter: { monthly: 299, annual: 239 },
    growth: { monthly: 499, annual: 399 },
    enterprise: { monthly: null, annual: null },
};

// ─── Factory ─────────────────────────────────────────────────────────────────

export const createDefaultSubscription = (plan: PlanTier): BrandSubscription => ({
    plan,
    limits: { ...PLAN_LIMITS[plan] },
    usage: {
        contentThisMonth: 0,
        imagesThisMonth: 0,
        lastResetAt: Date.now(),
    },
    trialEndsAt: Date.now() + 24 * 60 * 60 * 1000,  // 24-hour free trial
    billingPeriod: 'monthly',
});

// ─── Monthly Reset ───────────────────────────────────────────────────────────

const isSameMonth = (ts1: number, ts2: number): boolean => {
    const d1 = new Date(ts1);
    const d2 = new Date(ts2);
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
};

/**
 * Returns usage with counters reset if the stored `lastResetAt` is from a previous month.
 */
export const getResetUsage = (usage: PlanUsage): PlanUsage => {
    if (!usage.lastResetAt || !isSameMonth(usage.lastResetAt, Date.now())) {
        return { contentThisMonth: 0, imagesThisMonth: 0, lastResetAt: Date.now() };
    }
    return usage;
};

// ─── Trial Expiration ────────────────────────────────────────────────────────

/**
 * Returns true if the user's free trial has expired and they have NOT upgraded
 * via Stripe. Paid subscribers (with a stripeSubscriptionId) are never expired.
 */
export const isTrialExpired = (subscription?: BrandSubscription): boolean => {
    if (!subscription) return false;              // No sub = legacy/dev mode, allow
    if (!subscription.trialEndsAt) return false;  // No trial set (e.g. imported data)
    if (subscription.stripeSubscriptionId) return false; // Paid user — never expired
    return Date.now() > subscription.trialEndsAt;
};

// ─── Limit Checking ──────────────────────────────────────────────────────────

export interface LimitCheckResult {
    allowed: boolean;
    current: number;
    max: number;
    label: string;
    trialExpired?: boolean; // true when blocked specifically by trial expiration
}

type UsageLimitKey = 'contentPerMonth' | 'imagesPerMonth';

const USAGE_LABELS: Record<UsageLimitKey, string> = {
    contentPerMonth: 'content pieces',
    imagesPerMonth: 'AI images',
};

/**
 * Checks whether a usage-based action (content generation or image generation)
 * is within the plan limit. Also blocks if the free trial has expired.
 */
export const checkUsageLimit = (
    subscription: BrandSubscription | undefined,
    limitKey: UsageLimitKey,
): LimitCheckResult => {
    if (!subscription) {
        // No subscription = unlimited (legacy/dev mode)
        return { allowed: true, current: 0, max: -1, label: USAGE_LABELS[limitKey] };
    }

    // Block if free trial expired and no Stripe subscription
    if (isTrialExpired(subscription)) {
        return { allowed: false, current: 0, max: 0, label: USAGE_LABELS[limitKey], trialExpired: true };
    }

    const max = subscription.limits[limitKey];
    if (max === -1) {
        return { allowed: true, current: 0, max: -1, label: USAGE_LABELS[limitKey] };
    }

    const usage = getResetUsage(subscription.usage);
    const current = limitKey === 'contentPerMonth' ? usage.contentThisMonth : usage.imagesThisMonth;

    return {
        allowed: current < max,
        current,
        max,
        label: USAGE_LABELS[limitKey],
    };
};

/**
 * Checks a static limit (campaigns, competitors, knowledge docs) against a current count.
 * Also blocks if the free trial has expired.
 */
export const checkCountLimit = (
    subscription: BrandSubscription | undefined,
    limitKey: 'maxCampaigns' | 'maxCompetitors' | 'maxKnowledgeDocs',
    currentCount: number,
): LimitCheckResult => {
    const labels: Record<string, string> = {
        maxCampaigns: 'campaigns',
        maxCompetitors: 'competitors',
        maxKnowledgeDocs: 'knowledge base docs',
    };

    if (!subscription) {
        return { allowed: true, current: currentCount, max: -1, label: labels[limitKey] };
    }

    // Block if free trial expired and no Stripe subscription
    if (isTrialExpired(subscription)) {
        return { allowed: false, current: currentCount, max: 0, label: labels[limitKey], trialExpired: true };
    }

    const max = subscription.limits[limitKey];
    if (max === -1) {
        return { allowed: true, current: currentCount, max: -1, label: labels[limitKey] };
    }

    return {
        allowed: currentCount < max,
        current: currentCount,
        max,
        label: labels[limitKey],
    };
};

// ─── Usage Tracking ──────────────────────────────────────────────────────────

/**
 * Returns a new subscription with incremented usage for the given type.
 * Also handles monthly reset if needed.
 */
export const incrementUsage = (
    subscription: BrandSubscription,
    type: 'content' | 'image',
    count: number = 1,
): BrandSubscription => {
    const usage = getResetUsage(subscription.usage);
    return {
        ...subscription,
        usage: {
            ...usage,
            contentThisMonth: type === 'content' ? usage.contentThisMonth + count : usage.contentThisMonth,
            imagesThisMonth: type === 'image' ? usage.imagesThisMonth + count : usage.imagesThisMonth,
        },
    };
};

// ─── Brain Interval ──────────────────────────────────────────────────────────

/**
 * Returns the brain loop interval in milliseconds based on the subscription plan.
 * Falls back to 6 hours if no subscription is present.
 */
export const getEffectiveBrainInterval = (subscription?: BrandSubscription): number => {
    if (!subscription) return 6 * 60 * 60 * 1000; // 6h default
    return subscription.limits.brainFrequencyHours * 60 * 60 * 1000;
};
