import React from 'react';
import { TrendItem, BrandConfig } from '../types';

interface NewsArticleDetail extends TrendItem {
    imageUrl?: string;
    sourceName?: string;
    category?: string;
    relevanceBadge?: string;
    readTime?: string;
    fullContent?: string;
    quote?: string;
}

interface NewsArticleDetailProps {
    article: NewsArticleDetail;
    brandName: string;
    brandConfig: BrandConfig;
    relatedNews: NewsArticleDetail[];
    onBack: () => void;
    onCreateTwitterThread?: () => void;
    onGenerateInfographic?: () => void;
    onDraftDiscordPost?: () => void;
    onSelectRelated?: (article: NewsArticleDetail) => void;
}

export const NewsArticleDetail: React.FC<NewsArticleDetailProps> = ({
    article,
    brandName,
    brandConfig,
    relatedNews,
    onBack,
    onCreateTwitterThread,
    onGenerateInfographic,
    onDraftDiscordPost,
    onSelectRelated,
}) => {
    const getTimeAgo = (timestamp: string | number) => {
        if (typeof timestamp === 'string') return timestamp;
        const now = Date.now();
        const diff = now - timestamp;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        if (hours === 1) return '1 hour ago';
        if (hours < 24) return `${hours} hours ago`;
        return 'Yesterday';
    };

    const getCategoryBadge = (category?: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            defi: { bg: 'bg-[#3B82F622]', text: 'text-[#3B82F6]' },
            nfts: { bg: 'bg-[#A855F722]', text: 'text-[#A855F7]' },
            solana: { bg: 'bg-[#14F19522]', text: 'text-[#14F195]' },
            regulations: { bg: 'bg-[#F59E0B22]', text: 'text-[#F59E0B]' },
            ai: { bg: 'bg-[#EC489922]', text: 'text-[#EC4899]' },
        };
        return badges[category || 'defi'] || badges.defi;
    };

    const categoryBadge = getCategoryBadge(article.category);

    // Calculate relevance score display
    const relevanceScore = article.relevanceScore || 85;
    const isHighRelevance = relevanceScore >= 80;
    const relevanceLabel = isHighRelevance ? 'High' : relevanceScore >= 60 ? 'Medium' : 'Low';
    const relevanceColor = isHighRelevance ? '#22C55E' : relevanceScore >= 60 ? '#F59E0B' : '#6B6B70';

    // Key takeaways based on the article
    const keyTakeaways = [
        `Market timing is optimal for your launch - capitalize on the TVL growth momentum`,
        `Highlight your automated yield strategies in upcoming content`,
        `Consider referencing this news in your next Twitter thread`,
    ];

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-5 border-b border-[#1F1F23]">
                {/* Left: Back button + Breadcrumb */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2E2E2E] hover:bg-[#1F1F23] transition-colors"
                    >
                        <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                        <span className="text-white text-[13px] font-medium">Back to News</span>
                    </button>

                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2">
                        <span className="text-[#6B6B70] text-xs">Web3 News</span>
                        <span className="material-symbols-sharp text-[#6B6B70] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>chevron_right</span>
                        <span className="text-[#6B6B70] text-xs">{article.category?.charAt(0).toUpperCase() + (article.category?.slice(1) || 'DeFi')}</span>
                        <span className="material-symbols-sharp text-[#6B6B70] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>chevron_right</span>
                        <span className="text-[#9CA3AF] text-xs">Article</span>
                    </div>
                </div>

                {/* Right: Share + Bookmark */}
                <div className="flex items-center gap-2.5">
                    <button className="p-2.5 rounded-lg border border-[#2E2E2E] hover:bg-[#1F1F23] transition-colors">
                        <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 300" }}>ios_share</span>
                    </button>
                    <button className="p-2.5 rounded-lg border border-[#2E2E2E] hover:bg-[#1F1F23] transition-colors">
                        <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 300" }}>bookmark</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-10 px-10 py-8 overflow-hidden">
                {/* Article Column */}
                <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-4">
                    {/* Article Header */}
                    <div className="flex flex-col gap-4">
                        {/* Meta */}
                        <div className="flex items-center gap-3 text-[13px]">
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded bg-[#FF5C00] flex items-center justify-center">
                                    <span className="text-white text-[11px] font-bold">{article.sourceName?.charAt(0) || 'C'}</span>
                                </div>
                                <span className="text-[#FF5C00] font-semibold">{article.sourceName || 'CoinDesk'}</span>
                            </div>
                            <span className="w-1 h-1 rounded-full bg-[#4B5563]"></span>
                            <span className="text-[#6B6B70]">{getTimeAgo(article.timestamp)}</span>
                            <span className="w-1 h-1 rounded-full bg-[#4B5563]"></span>
                            <span className="text-[#6B6B70]">{article.readTime || '5 min read'}</span>
                            <span className={`px-2.5 py-1 rounded-full ${categoryBadge.bg} ${categoryBadge.text} text-[11px] font-medium`}>
                                {article.category?.charAt(0).toUpperCase() + (article.category?.slice(1) || 'DeFi')}
                            </span>
                        </div>

                        {/* Title */}
                        <h1 className="text-[28px] font-bold text-white leading-[1.3]">
                            {article.headline}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-[#9CA3AF] text-base leading-[1.5]">
                            {article.summary}
                        </p>
                    </div>

                    {/* Article Image */}
                    <div className="w-full h-80 rounded-[14px] bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] overflow-hidden relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3/4 h-3/4 bg-gradient-to-br from-[#FF5C00]/20 via-[#3B82F6]/20 to-[#22C55E]/20 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-sharp text-[#64748B] text-6xl" style={{ fontVariationSettings: "'wght' 200" }}>insert_chart</span>
                            </div>
                        </div>
                    </div>

                    {/* Article Body */}
                    <div className="flex flex-col gap-5">
                        {/* Paragraph 1 */}
                        <p className="text-[#D1D5DB] text-[15px] leading-[1.7]">
                            {article.fullContent || `The ${article.category || 'DeFi'} ecosystem has experienced a remarkable surge in Total Value Locked (TVL), climbing 40% over the past month as several new protocols launch innovative yield optimization features that are attracting significant capital inflows.`}
                        </p>

                        {/* Paragraph 2 */}
                        <p className="text-[#D1D5DB] text-[15px] leading-[1.7]">
                            Leading this growth are protocols focused on automated yield strategies, which leverage high throughput and low transaction costs to offer more efficient farming opportunities. These platforms are implementing sophisticated algorithms that automatically rebalance positions to maximize returns.
                        </p>

                        {/* Quote Block */}
                        <div className="bg-[#111113] rounded-xl p-5 pl-6 border-l-[3px] border-[#FF5C00]">
                            <p className="text-[#E5E5E5] text-[15px] italic leading-[1.6]">
                                "{article.quote || `We're seeing unprecedented interest in Solana DeFi. The combination of speed, low costs, and innovative protocols is creating a perfect storm for growth.`}"
                            </p>
                        </div>

                        {/* Paragraph 3 */}
                        <p className="text-[#D1D5DB] text-[15px] leading-[1.7]">
                            Industry analysts predict this trend will continue as more institutional players enter the ecosystem. The network's ability to handle high-frequency trading strategies makes it particularly attractive for yield optimization protocols.
                        </p>
                    </div>
                </div>

                {/* Brand Connection Column */}
                <div className="w-[420px] flex flex-col gap-5 flex-shrink-0 overflow-y-auto">
                    {/* Brand Connection Card */}
                    <div
                        className="rounded-[14px] p-6 border border-[#FF5C0066]"
                        style={{ background: 'linear-gradient(135deg, #111113 0%, #1A120D 100%)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div
                                className="w-11 h-11 rounded-[10px] flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)' }}
                            >
                                <span className="material-symbols-sharp text-white text-[22px]" style={{ fontVariationSettings: "'wght' 300" }}>link</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-white text-[17px] font-semibold">Brand Connection</span>
                                <span className="text-[#9CA3AF] text-xs">How this impacts {brandName}</span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-[#FF5C0033] mb-4"></div>

                        {/* Relevance Score */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[#9CA3AF] text-[13px]">Relevance Score</span>
                            <div className="flex items-center gap-1.5">
                                <span
                                    className="px-2.5 py-1 rounded-full text-xs font-semibold"
                                    style={{ backgroundColor: `${relevanceColor}22`, color: relevanceColor }}
                                >
                                    {relevanceLabel}
                                </span>
                                <span className="text-lg font-bold" style={{ color: relevanceColor }}>
                                    {relevanceScore}%
                                </span>
                            </div>
                        </div>

                        {/* Why This Matters */}
                        <div className="flex flex-col gap-2.5 mb-4">
                            <span className="text-white text-sm font-semibold">Why This Matters</span>
                            <p className="text-[#D1D5DB] text-[13px] leading-[1.5]">
                                This news directly validates {brandName}'s core value proposition. The 40% TVL growth in {article.category?.toUpperCase() || 'DeFi'} demonstrates strong market demand for exactly the yield optimization features your protocol offers.
                            </p>
                        </div>

                        {/* Key Takeaways */}
                        <div className="flex flex-col gap-2.5">
                            <span className="text-white text-sm font-semibold">Key Takeaways for {brandName}</span>
                            {keyTakeaways.map((takeaway, i) => (
                                <div key={i} className="flex gap-2.5">
                                    <span className="material-symbols-sharp text-[#22C55E] text-base flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'wght' 400" }}>check</span>
                                    <span className="text-[#D1D5DB] text-[13px] leading-[1.4]">{takeaway}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Suggested Actions Card */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-3.5">
                            <span className="material-symbols-sharp text-[#FF5C00] text-base" style={{ fontVariationSettings: "'wght' 300" }}>auto_awesome</span>
                            <span className="text-white text-sm font-semibold">Suggested Actions</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={onCreateTwitterThread}
                                className="flex items-center justify-between px-3.5 py-3 bg-[#1A1A1D] rounded-lg hover:bg-[#252528] transition-colors group"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="material-symbols-sharp text-[#1DA1F2] text-base" style={{ fontVariationSettings: "'wght' 300" }}>alternate_email</span>
                                    <span className="text-white text-[13px] font-medium">Create Twitter Thread</span>
                                </div>
                                <span className="material-symbols-sharp text-[#6B6B70] text-sm group-hover:text-white transition-colors" style={{ fontVariationSettings: "'wght' 300" }}>arrow_forward</span>
                            </button>

                            <button
                                onClick={onGenerateInfographic}
                                className="flex items-center justify-between px-3.5 py-3 bg-[#1A1A1D] rounded-lg hover:bg-[#252528] transition-colors group"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="material-symbols-sharp text-[#A855F7] text-base" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                                    <span className="text-white text-[13px] font-medium">Generate Infographic</span>
                                </div>
                                <span className="material-symbols-sharp text-[#6B6B70] text-sm group-hover:text-white transition-colors" style={{ fontVariationSettings: "'wght' 300" }}>arrow_forward</span>
                            </button>

                            <button
                                onClick={onDraftDiscordPost}
                                className="flex items-center justify-between px-3.5 py-3 bg-[#1A1A1D] rounded-lg hover:bg-[#252528] transition-colors group"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="material-symbols-sharp text-[#5865F2] text-base" style={{ fontVariationSettings: "'wght' 300" }}>forum</span>
                                    <span className="text-white text-[13px] font-medium">Draft Discord Post</span>
                                </div>
                                <span className="material-symbols-sharp text-[#6B6B70] text-sm group-hover:text-white transition-colors" style={{ fontVariationSettings: "'wght' 300" }}>arrow_forward</span>
                            </button>
                        </div>
                    </div>

                    {/* Related News Card */}
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-5">
                        {/* Header */}
                        <span className="text-white text-sm font-semibold mb-3.5 block">Related News</span>

                        {/* Related Articles */}
                        <div className="flex flex-col gap-3">
                            {relatedNews.slice(0, 2).map((related, i) => (
                                <button
                                    key={i}
                                    onClick={() => onSelectRelated?.(related)}
                                    className="flex flex-col gap-1.5 p-3.5 bg-[#1A1A1D] rounded-lg hover:bg-[#252528] transition-colors text-left"
                                >
                                    <span className="text-white text-[13px] font-medium leading-[1.3]">
                                        {related.headline}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[#FF5C00] text-[10px] font-medium">{related.sourceName || 'The Block'}</span>
                                        <span className="w-0.5 h-0.5 rounded-full bg-[#4B5563]"></span>
                                        <span className="text-[#6B6B70] text-[10px]">{getTimeAgo(related.timestamp)}</span>
                                    </div>
                                </button>
                            ))}

                            {relatedNews.length === 0 && (
                                <>
                                    <div className="flex flex-col gap-1.5 p-3.5 bg-[#1A1A1D] rounded-lg">
                                        <span className="text-white text-[13px] font-medium leading-[1.3]">
                                            Jupiter DEX Hits $1B Daily Volume on Solana
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#FF5C00] text-[10px] font-medium">The Block</span>
                                            <span className="w-0.5 h-0.5 rounded-full bg-[#4B5563]"></span>
                                            <span className="text-[#6B6B70] text-[10px]">4 hours ago</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5 p-3.5 bg-[#1A1A1D] rounded-lg">
                                        <span className="text-white text-[13px] font-medium leading-[1.3]">
                                            Marinade Finance Launches New Staking Features
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#FF5C00] text-[10px] font-medium">Decrypt</span>
                                            <span className="w-0.5 h-0.5 rounded-full bg-[#4B5563]"></span>
                                            <span className="text-[#6B6B70] text-[10px]">Yesterday</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
