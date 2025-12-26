import { SocialMetrics, ComputedMetrics, StrategyTask } from '../types';

export interface DefiaScore {
    total: number; // 0-100 (Where 70 is "Standard", <40 is "At Risk")
    grade: string; // S, A, B, C, D, F
    breakdown: {
        socialScore: number; // Max 50
        chainScore: number;  // Max 30
        strategyScore: number; // Max 20
    };
    insights: string[];
}

/**
 * Calculates the Defia Index Score.
 * 
 * Logic:
 * 1. Social Sensitivity (50%): Engagement, Follower Growth, Sentiment.
 * 2. On-Chain Vitality (30%): TVL, Wallet Growth. *If missing, weights shift to Social*.
 * 3. Strategic Velocity (20%): Task density / implementation status.
 */
export const calculateDefiaScore = (
    social: SocialMetrics | null,
    chain: ComputedMetrics | null,
    tasks: StrategyTask[]
): DefiaScore => {

    let socialScore = 0; // Max 50 (or 80 if chain missing)
    let chainScore = 0; // Max 30
    let strategyScore = 0; // Max 20

    const insights: string[] = [];

    // --- 1. SOCIAL SCORE (Engagement is King) ---
    // Target Engagement Rate: 2% is good, 5% is excellent.
    const engagement = social?.engagementRate || 0;

    // Base score from Engagement (Up to 30 points)
    // 5% engagement = 30 points. 1% = 6 points.
    const engPoints = Math.min((engagement / 5) * 30, 30);
    socialScore += engPoints;

    if (engagement < 1) insights.push("Low engagement is dragging down your Social Score.");
    if (engagement > 4) insights.push("Excellent engagement rate is boosting your Index.");

    // Follower Score (Up to 20 points)
    // Logarithmic scale: 1k followers = 5pts, 10k = 10pts, 100k = 20pts
    const followers = social?.totalFollowers || 0;
    if (followers > 0) {
        // Simple log scale approximation
        const logScore = Math.log10(followers);
        // Map 3 (1k) -> 5, 5 (100k) -> 20
        const fPoints = Math.max(0, Math.min(((logScore - 2) * 5), 20));
        socialScore += fPoints;
    } else {
        insights.push("Connect a social account to unlock Audience scoring.");
    }

    // --- 2. ON-CHAIN SCORE (Vitality) ---
    let maxChainPoints = 30;

    if (chain) {
        // Active Wallets (Up to 15 points)
        // Target: 1000 active wallets = 15 pts
        const walletPoints = Math.min((chain.activeWallets / 1000) * 15, 15);
        chainScore += walletPoints;

        // TVL / Volume Change (Up to 15 points)
        // Positive growth = points. Negative = 0.
        const growthPoints = chain.tvlChange > 0 ? 15 : (chain.tvlChange === 0 ? 5 : 0);
        chainScore += growthPoints;

        if (chain.activeWallets < 100) insights.push("Low on-chain activity detected.");
        if (chain.tvlChange < 0) insights.push("Negative TVL growth is impacting the Vitality Score.");

    } else {
        // CHAIN DATA MISSING -> REBALANCE
        // Shift 30 points to Social (Max Social becomes 80)
        maxChainPoints = 0;
        insights.push("On-Chain data disconnected. Score is heavily weighted on Socials.");

        // Boost Social Score proportionally
        // If current social is 25/50, it becomes 40/80 (1.6x multiplier)
        socialScore = Math.min(socialScore * 1.6, 80);
    }

    // --- 3. STRATEGY SCORE (Velocity) ---
    // Based on tasks active/completed
    // Max 20 points. Each high impact task = 4 points.
    const activeTasks = tasks.length;
    const highImpactTasks = tasks.filter(t => t.impactScore >= 7).length;

    strategyScore = Math.min((highImpactTasks * 4) + (activeTasks * 1), 20);

    if (strategyScore < 10) insights.push("Strategy pipeline is thin. Generate more tasks to boost Velocity.");

    // --- 4. REAL DATA VERIFICATION ---
    const isVerified = social?.isLive ?? false;

    if (!isVerified) {
        insights.push("⚠️ UNVERIFIED: Check connection.");
        // Penalize simulated data to prevent falsified high scores
        socialScore = Math.max(0, socialScore - 20);
    }

    // --- FINAL CALCULATION ---
    let total = Math.round(socialScore + chainScore + strategyScore);

    // HARD CAP for Unverified Data
    if (!isVerified && total > 60) {
        total = 60; // Max 'B-' for unverified
        insights.push("Score capped due to unverified data.");
    }

    let grade = 'F';
    if (total >= 95) grade = 'S';
    else if (total >= 85) grade = 'A+';
    else if (total >= 75) grade = 'A';
    else if (total >= 65) grade = 'B';
    else if (total >= 50) grade = 'C';
    else if (total >= 35) grade = 'D';

    return {
        total,
        grade,
        breakdown: {
            socialScore: Math.round(socialScore),
            chainScore: Math.round(chainScore),
            strategyScore: Math.round(strategyScore)
        },
        insights
    };
};
