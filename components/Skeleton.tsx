import React from 'react';

// Reusable skeleton loading component with pulse animation
const shimmer = 'animate-pulse bg-[#1F1F23] rounded';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`${shimmer} ${className}`}></div>
);

export const SkeletonKPICard: React.FC = () => (
    <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-5">
        <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-9 w-24 mb-3" />
        <Skeleton className="h-3 w-20" />
    </div>
);

export const SkeletonBriefCard: React.FC = () => (
    <div className="rounded-xl bg-[#111113] border border-[#1F1F23] px-5 py-4 mb-7">
        <div className="flex items-start gap-3">
            <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
            </div>
        </div>
    </div>
);

export const SkeletonNewsItem: React.FC = () => (
    <div className="flex items-center gap-3 py-3">
        <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
        </div>
    </div>
);

export const SkeletonRecommendationCard: React.FC = () => (
    <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-5 space-y-3">
        <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-8 w-28 rounded-lg mt-2" />
    </div>
);

export const SkeletonContentCard: React.FC = () => (
    <div className="bg-[#111113] border border-[#1F1F23] rounded-2xl overflow-hidden">
        <Skeleton className="h-40 w-full rounded-none" />
        <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
        </div>
    </div>
);

export const SkeletonCampaignRow: React.FC = () => (
    <div className="rounded-xl bg-[#111113] border border-[#1F1F23] p-5 flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
);
