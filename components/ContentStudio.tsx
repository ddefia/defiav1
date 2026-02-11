
import React, { useState, useEffect, useRef } from 'react';
import { BrandConfig } from '../types';
import { generateTweet, generateWeb3Graphic, generateIdeas } from '../services/gemini';
import { saveBrainMemory } from '../services/supabase';
import { saveStudioState, loadStudioState, saveImageToGallery, createThumbnail } from '../services/storage';

interface ContentStudioProps {
    brandName: string;
    brandConfig: BrandConfig;
    onSchedule: (content: string, image?: string) => void;
    onUpdateBrandConfig: (config: BrandConfig) => void;
    onNavigate?: (section: string, params?: any) => void;
    initialDraft?: string;
    initialVisualPrompt?: string;
}

type ContentType = 'all' | 'twitter' | 'discord' | 'email' | 'graphics';
type ContentStatus = 'published' | 'scheduled' | 'draft' | 'review';
type CreateType = 'tweet' | 'graphic' | 'quote-tweet';
type TweetContentType = 'announcement' | 'article' | 'thought' | 'community' | 'thread' | 'repost';
type QuoteTweetMode = 'amplify' | 'explain';

interface FetchedTweetData {
    text: string;
    authorName: string;
    authorHandle: string;
    url: string;
}

interface ContentItem {
    id: string;
    type: 'twitter' | 'discord' | 'email' | 'graphic' | 'thread' | 'blog';
    title: string;
    description?: string;
    status: ContentStatus;
    date: string;
    stats?: { likes?: number; retweets?: number; comments?: number };
    image?: string;
    dimensions?: string;
    channel?: string;
    readTime?: string;
}

const CONTENT_TYPE_OPTIONS: { id: TweetContentType; emoji: string; label: string; description: string }[] = [
    { id: 'announcement', emoji: '📢', label: 'Announcement', description: 'Product launches, updates' },
    { id: 'article', emoji: '📰', label: 'Article Share', description: 'Blog posts, news links' },
    { id: 'thought', emoji: '💡', label: 'Thought Leadership', description: 'Industry insights, opinions' },
    { id: 'community', emoji: '🎉', label: 'Community', description: 'Engagement, milestones' },
    { id: 'thread', emoji: '🧵', label: 'Thread', description: 'Deep dives, tutorials' },
    { id: 'repost', emoji: '🔄', label: 'Repost', description: 'Quote tweets, replies' },
];

// Content items are loaded from storage/API - no mock data
const sampleContent: ContentItem[] = [];

const TEMPLATE_OPTIONS: { id: string; label: string; }[] = [];

export const ContentStudio: React.FC<ContentStudioProps> = ({
    brandName,
    brandConfig,
    onSchedule,
    onUpdateBrandConfig,
    onNavigate,
    initialDraft,
    initialVisualPrompt
}) => {
    // View State
    const [currentView, setCurrentView] = useState<'library' | 'create-tweet' | 'create-graphic' | 'add-tweet-image' | 'quote-tweet'>('library');

    // Content Library State
    const [activeTab, setActiveTab] = useState<ContentType>('all');
    const [showCreateDropdown, setShowCreateDropdown] = useState(false);
    const [contentItems, setContentItems] = useState<ContentItem[]>(sampleContent);

    // Create Tweet State
    const [tweetTopic, setTweetTopic] = useState('');
    const [selectedContentType, setSelectedContentType] = useState<TweetContentType>('announcement');
    const [tweetContext, setTweetContext] = useState('');
    const [generatedTweetPreview, setGeneratedTweetPreview] = useState('');
    const [generatedThreadPreview, setGeneratedThreadPreview] = useState<string[]>([]);
    const [currentThreadIndex, setCurrentThreadIndex] = useState(0);
    const [isGeneratingTweet, setIsGeneratingTweet] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Create Graphic State
    const [graphicTweetContent, setGraphicTweetContent] = useState('');
    const [visualStyle, setVisualStyle] = useState('Modern');
    const [selectedRefImages, setSelectedRefImages] = useState<number[]>([]);
    const [graphicVariations, setGraphicVariations] = useState<string[]>([]);
    const [selectedVariation, setSelectedVariation] = useState<number>(0);
    const [isGeneratingGraphic, setIsGeneratingGraphic] = useState(false);
    const [graphicStep, setGraphicStep] = useState<1 | 2>(1);

    // Add Tweet Image State
    const [tweetImageDescription, setTweetImageDescription] = useState('');
    const [selectedTheme, setSelectedTheme] = useState<'web3' | 'minimal' | 'bold' | 'retro'>('web3');
    const [selectedImageStyle, setSelectedImageStyle] = useState<'3d' | 'minimal' | 'abstract' | 'illustrated'>('3d');
    const [tweetImageOptions, setTweetImageOptions] = useState<string[]>([]);
    const [selectedImageOption, setSelectedImageOption] = useState<number>(0);
    const [isGeneratingTweetImages, setIsGeneratingTweetImages] = useState(false);
    const [tweetForImage, setTweetForImage] = useState('');

    // Quote Tweet State
    const [quoteTweetUrl, setQuoteTweetUrl] = useState('');
    const [fetchedTweetData, setFetchedTweetData] = useState<FetchedTweetData | null>(null);
    const [isFetchingTweet, setIsFetchingTweet] = useState(false);
    const [quoteTweetMode, setQuoteTweetMode] = useState<QuoteTweetMode>('amplify');
    const [quoteTweetContext, setQuoteTweetContext] = useState('');
    const [generatedQuoteTweet, setGeneratedQuoteTweet] = useState('');
    const [isGeneratingQuoteTweet, setIsGeneratingQuoteTweet] = useState(false);

    // Writer State (preserved from original)
    const [writerTopic, setWriterTopic] = useState('');
    const [writerTone, setWriterTone] = useState('Professional');
    const [isWritingTweet, setIsWritingTweet] = useState(false);
    const [generatedDrafts, setGeneratedDrafts] = useState<string[]>([]);
    const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
    const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([]);

    // Combine default templates with brand custom templates
    const availableTemplates = React.useMemo(() => {
        const custom = (brandConfig.graphicTemplates || []).map(t => ({
            id: t.label,
            label: t.label,
            isCustom: true,
            prompt: t.prompt
        }));
        return [...TEMPLATE_OPTIONS, ...custom];
    }, [brandConfig.graphicTemplates]);

    // Generator State (preserved from original)
    const [tweetText, setTweetText] = useState('');
    const [visualPrompt, setVisualPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [variationCount, setVariationCount] = useState('1');
    const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '4:5'>('16:9');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [selectedReferenceImage, setSelectedReferenceImage] = useState<string | null>(null);
    const [uploadedAssets, setUploadedAssets] = useState<{ id: string; data: string; mimeType: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showCreateDropdown) {
                setShowCreateDropdown(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showCreateDropdown]);

    // --- PERSISTENCE & DEEP LINKS ---
    useEffect(() => {
        if (initialDraft || initialVisualPrompt) {
            // Draft takes priority over visual prompt for view selection
            if (initialDraft) {
                setTweetTopic(initialDraft);
                setCurrentView('create-tweet');
            }
            if (initialVisualPrompt) {
                setVisualPrompt(initialVisualPrompt);
                // Only switch to graphic view if there's no draft
                if (!initialDraft) {
                    setCurrentView('create-graphic');
                }
            }
        } else {
            const saved = loadStudioState(brandName);
            if (saved) {
                if (saved.writerTopic) setWriterTopic(saved.writerTopic);
                if (saved.generatedDrafts) setGeneratedDrafts(saved.generatedDrafts);
                else if (saved.generatedDraft) setGeneratedDrafts([saved.generatedDraft]);
                if (saved.tweetText) setTweetText(saved.tweetText);
                if (saved.visualPrompt) setVisualPrompt(saved.visualPrompt);
                if (saved.negativePrompt) setNegativePrompt(saved.negativePrompt);
                if (saved.generatedImages) setGeneratedImages(saved.generatedImages);
            }
        }
    }, [brandName, initialDraft, initialVisualPrompt]);

    useEffect(() => {
        const state = {
            writerTopic, generatedDrafts, tweetText, visualPrompt, negativePrompt, generatedImages
        };
        const timeout = setTimeout(() => saveStudioState(brandName, state), 1000);
        return () => clearTimeout(timeout);
    }, [writerTopic, generatedDrafts, tweetText, visualPrompt, negativePrompt, generatedImages, brandName]);

    // --- HANDLERS (preserved from original) ---
    const handleGenerateIdeas = async () => {
        setIsGeneratingIdeas(true);
        try {
            const ideas = await generateIdeas(brandName);
            setSuggestedIdeas(ideas);
        } catch (e) { console.error(e); } finally { setIsGeneratingIdeas(false); }
    };

    const handleGenerateTweet = async () => {
        if (!tweetTopic.trim()) return;
        setIsGeneratingTweet(true);
        setError(null);
        setGeneratedThreadPreview([]);
        setCurrentThreadIndex(0);
        setPreviewImage(null);
        try {
            // Map content type to tone
            const toneMap: Record<TweetContentType, string> = {
                announcement: 'Professional',
                article: 'Educational',
                thought: 'Professional',
                community: 'Casual',
                thread: 'Educational',
                repost: 'Casual'
            };
            const tone = toneMap[selectedContentType];

            if (selectedContentType === 'thread') {
                const threadCount = 4;
                const res = await generateTweet(
                    `Create a ${threadCount}-tweet thread about: ${tweetTopic}${tweetContext ? `\n\nContext: ${tweetContext}` : ''}\nReturn each tweet as a separate item in order.`,
                    brandName,
                    brandConfig,
                    tone,
                    threadCount
                );

                let tweets: string[] = [];
                if (Array.isArray(res)) {
                    tweets = res;
                } else if (typeof res === 'string') {
                    const trimmed = res.trim();
                    if (trimmed.startsWith('[')) {
                        try {
                            const parsed = JSON.parse(trimmed);
                            if (Array.isArray(parsed)) tweets = parsed;
                        } catch {}
                    }
                    if (tweets.length === 0) {
                        const split = trimmed.split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
                        tweets = split;
                    }
                }

                const cleaned = tweets.map(t => t.trim()).filter(Boolean);
                setGeneratedThreadPreview(cleaned);
                setGeneratedTweetPreview(cleaned[0] || '');
            } else {
                const res = await generateTweet(
                    `${tweetTopic}${tweetContext ? `\n\nContext: ${tweetContext}` : ''}`,
                    brandName,
                    brandConfig,
                    tone,
                    1
                );

                let draft = '';
                if (Array.isArray(res)) {
                    draft = res[0] || '';
                } else if (typeof res === 'string') {
                    draft = res;
                }

                setGeneratedTweetPreview(draft.trim());
            }
        } catch (e: any) {
            const msg = e?.message || '';
            if (msg.includes('quota')) {
                setError('API quota exceeded — check your Gemini billing at ai.dev/rate-limit');
            } else {
                setError(msg || 'Failed to generate tweet.');
            }
            console.error(e);
        } finally {
            setIsGeneratingTweet(false);
        }
    };

    const handleAIWrite = async () => {
        setIsWritingTweet(true);
        setGeneratedDrafts([]);
        try {
            const count = parseInt(variationCount);
            const res = await generateTweet(writerTopic, brandName, brandConfig, writerTone, count);

            let drafts: string[] = [];
            if (Array.isArray(res)) {
                drafts = res;
            } else if (typeof res === 'string') {
                if (res.trim().startsWith('[') && res.trim().endsWith(']')) {
                    try {
                        const parsed = JSON.parse(res);
                        if (Array.isArray(parsed)) drafts = parsed;
                    } catch (e) {
                        drafts = res.split('\n\n' + '-'.repeat(40) + '\n\n');
                    }
                } else {
                    drafts = res.split('\n\n' + '-'.repeat(40) + '\n\n');
                }
            } else {
                drafts = [String(res)];
            }

            setGeneratedDrafts(drafts.filter(d => d && d.trim().length > 0));
        } catch (e) { setError('Failed to generate draft.'); } finally { setIsWritingTweet(false); }
    };

    const handleGenerateSingle = async () => {
        if (!tweetText && !visualPrompt && !selectedTemplate) return;
        setIsGenerating(true);
        setError(null);
        setGeneratedImages([]);
        try {
            const count = parseInt(variationCount);
            const promises = Array(count).fill(0).map(() =>
                generateWeb3Graphic({
                    prompt: tweetText || "Visual Content",
                    artPrompt: visualPrompt,
                    negativePrompt,
                    size,
                    aspectRatio,
                    brandConfig,
                    brandName,
                    templateType: selectedTemplate,
                    selectedReferenceImages: selectedReferenceImage ? [selectedReferenceImage] : undefined,
                    adhocAssets: uploadedAssets.map(a => ({ data: a.data, mimeType: a.mimeType }))
                })
            );
            const images = await Promise.all(promises);
            setGeneratedImages(images);

            images.forEach(img => {
                saveBrainMemory(
                    brandName,
                    'FACT',
                    `Generated Visual: ${(tweetText || visualPrompt || 'Graphic').substring(0, 50)}...`,
                    undefined,
                    {
                        mediaUrl: img,
                        source: 'ContentStudio',
                        prompt: tweetText
                    }
                );
            });
        } catch (err: any) {
            setError(`Failed to generate: ${err.message || "Unknown error"}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGeneratePreviewImage = async () => {
        if (!generatedTweetPreview) return;
        setIsGenerating(true);
        try {
            const img = await generateWeb3Graphic({
                prompt: generatedTweetPreview,
                artPrompt: '',
                negativePrompt: 'text, words, letters, watermark',
                size: '1K',
                aspectRatio: '16:9',
                brandConfig,
                brandName,
                templateType: '',
            });
            setPreviewImage(img);
        } catch (err: any) {
            const msg = err?.message || '';
            if (msg.includes('quota')) {
                setError('API quota exceeded — check your Gemini billing at ai.dev/rate-limit');
            } else {
                setError(msg || 'Failed to generate image.');
            }
            console.error('Failed to generate image:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `defia-gen-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrepareTweet = (text: string) => {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });

            const mimeMatch = base64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const cleanBase64 = base64.split(',')[1] || base64;

            setUploadedAssets(prev => [...prev, {
                id: Date.now().toString(),
                data: cleanBase64,
                mimeType
            }]);
        } catch (err) {
            console.error("Asset upload failed", err);
            setError("Failed to upload asset");
        }
    };

    const removeAsset = (id: string) => {
        setUploadedAssets(assets => assets.filter(a => a.id !== id));
    };

    const openCreateView = (type: CreateType) => {
        if (type === 'tweet') {
            setCurrentView('create-tweet');
            setTweetTopic('');
            setTweetContext('');
            setGeneratedTweetPreview('');
            setPreviewImage(null);
        } else if (type === 'quote-tweet') {
            setCurrentView('quote-tweet');
            setQuoteTweetUrl('');
            setFetchedTweetData(null);
            setQuoteTweetMode('amplify');
            setQuoteTweetContext('');
            setGeneratedQuoteTweet('');
        } else {
            setCurrentView('create-graphic');
            setGraphicTweetContent('');
            setVisualStyle('Modern');
            setSelectedRefImages([]);
            setGraphicVariations([]);
            setSelectedVariation(0);
            setGraphicStep(1);
        }
        setShowCreateDropdown(false);
    };

    // Helper to get real image IDs from selected indices
    const getSelectedReferenceImageIds = (indices: number[]): string[] => {
        const images = brandConfig.referenceImages || [];
        return indices
            .map(idx => images[idx]?.id)
            .filter(Boolean) as string[];
    };

    const handleGenerateGraphicVariations = async () => {
        if (!graphicTweetContent.trim()) return;
        setIsGeneratingGraphic(true);
        setError(null);
        setGraphicVariations([]);
        try {
            // Get actual reference image IDs from selected indices
            const realImageIds = getSelectedReferenceImageIds(selectedRefImages);

            const count = 3;
            const promises = Array(count).fill(0).map(() =>
                generateWeb3Graphic({
                    prompt: graphicTweetContent,
                    artPrompt: visualStyle,
                    negativePrompt: 'text, words, letters, watermark, blurry',
                    size: '1K',
                    aspectRatio: '16:9',
                    brandConfig,
                    brandName,
                    templateType: '',
                    selectedReferenceImages: realImageIds.length > 0 ? realImageIds : undefined,
                    adhocAssets: uploadedAssets.map(a => ({ data: a.data, mimeType: a.mimeType }))
                })
            );
            const images = await Promise.all(promises);
            setGraphicVariations(images);
            setSelectedVariation(0);
            setGraphicStep(2);
            // Save generated images to gallery for Image Studio quick access
            images.forEach(async (img, idx) => {
                try {
                    const thumb = await createThumbnail(img);
                    saveImageToGallery(brandName, {
                        id: `gen-${Date.now()}-${idx}`,
                        data: thumb,
                        fullData: img.length < 500000 ? img : undefined,
                        prompt: graphicTweetContent,
                        timestamp: Date.now(),
                        source: 'generated',
                    });
                } catch { /* gallery save is non-critical */ }
            });
        } catch (err: any) {
            setError(`Failed to generate: ${err.message || "Unknown error"}`);
        } finally {
            setIsGeneratingGraphic(false);
        }
    };

    const handleBackToLibrary = () => {
        setCurrentView('library');
        setTweetTopic('');
        setTweetContext('');
        setGeneratedTweetPreview('');
        setGeneratedThreadPreview([]);
        setCurrentThreadIndex(0);
        setPreviewImage(null);
    };

    const handleGoToAddTweetImage = () => {
        // Navigate from create-tweet to add-tweet-image with the generated tweet
        const currentText = (selectedContentType === 'thread' && generatedThreadPreview.length > 0)
            ? (generatedThreadPreview[currentThreadIndex] || generatedThreadPreview[0])
            : generatedTweetPreview;
        setTweetForImage(currentText);
        setTweetImageDescription('');
        setSelectedTheme('web3');
        setSelectedImageStyle('3d');
        setTweetImageOptions([]);
        setSelectedImageOption(0);
        setCurrentView('add-tweet-image');
    };

    // --- QUOTE TWEET HANDLERS ---
    const handleFetchTweet = async () => {
        const url = quoteTweetUrl.trim();
        if (!url) return;

        // Basic validation
        const tweetUrlPattern = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
        if (!tweetUrlPattern.test(url)) {
            setError('Please enter a valid Twitter/X post URL (e.g. https://x.com/user/status/123...)');
            return;
        }

        setIsFetchingTweet(true);
        setError(null);
        setFetchedTweetData(null);
        setGeneratedQuoteTweet('');

        try {
            const apiBase = process.env.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_BASE_URL || '';
            const res = await fetch(`${apiBase}/api/tweet-oembed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to fetch tweet (${res.status})`);
            }

            const data = await res.json();
            if (!data.text) {
                throw new Error('Could not extract tweet text. The tweet may be private or deleted.');
            }

            setFetchedTweetData({
                text: data.text,
                authorName: data.authorName || 'Unknown',
                authorHandle: data.authorHandle || 'unknown',
                url: data.url || url
            });
        } catch (e: any) {
            setError(e.message || 'Failed to fetch tweet.');
        } finally {
            setIsFetchingTweet(false);
        }
    };

    const handleGenerateQuoteTweet = async () => {
        if (!fetchedTweetData) return;

        setIsGeneratingQuoteTweet(true);
        setError(null);
        setGeneratedQuoteTweet('');

        try {
            const { text: originalText, authorHandle } = fetchedTweetData;
            const userCtx = quoteTweetContext.trim() ? `\n\nAdditional context from me: ${quoteTweetContext.trim()}` : '';

            let prompt = '';
            if (quoteTweetMode === 'amplify') {
                prompt = `Write a quote retweet that amplifies and endorses this tweet. Show agreement, add your unique perspective, and boost the message. Keep it concise and authentic.\n\nOriginal tweet by @${authorHandle}: "${originalText}"${userCtx}`;
            } else {
                prompt = `Write a quote retweet that explains this tweet/event to your audience. Include: a compelling hook, what it is about, when it happens (if applicable), and a clear call to action. Make it informative and engaging.\n\nOriginal tweet by @${authorHandle}: "${originalText}"${userCtx}`;
            }

            const res = await generateTweet(prompt, brandName, brandConfig, 'Casual', 1);

            let draft = '';
            if (Array.isArray(res)) {
                draft = res[0] || '';
            } else if (typeof res === 'string') {
                draft = res;
            }

            setGeneratedQuoteTweet(draft.trim());
        } catch (e: any) {
            const msg = e?.message || '';
            if (msg.includes('quota')) {
                setError('API quota exceeded — check your Gemini billing at ai.dev/rate-limit');
            } else {
                setError(msg || 'Failed to generate quote tweet.');
            }
        } finally {
            setIsGeneratingQuoteTweet(false);
        }
    };

    const handleGenerateTweetImageOptions = async () => {
        if (!tweetForImage.trim()) return;
        setIsGeneratingTweetImages(true);
        setError(null);
        setTweetImageOptions([]);
        try {
            // Use image description as the art prompt, with a sensible default
            const artPrompt = tweetImageDescription.trim()
                ? tweetImageDescription
                : 'Web3, crypto, modern, professional, high quality';

            // Get actual reference image IDs from selected indices
            const realImageIds = getSelectedReferenceImageIds(selectedRefImages);

            const count = 3;
            const promises = Array(count).fill(0).map(() =>
                generateWeb3Graphic({
                    prompt: tweetForImage,
                    artPrompt,
                    negativePrompt: 'text, words, letters, watermark, blurry, low quality',
                    size: '1K',
                    aspectRatio: '16:9',
                    brandConfig,
                    brandName,
                    templateType: '',
                    selectedReferenceImages: realImageIds.length > 0 ? realImageIds : undefined,
                    adhocAssets: uploadedAssets.map(a => ({ data: a.data, mimeType: a.mimeType }))
                })
            );
            const images = await Promise.all(promises);
            setTweetImageOptions(images);
            setSelectedImageOption(0);
        } catch (err: any) {
            setError(`Failed to generate: ${err.message || "Unknown error"}`);
        } finally {
            setIsGeneratingTweetImages(false);
        }
    };

    const handleUseSelectedImage = () => {
        if (tweetImageOptions[selectedImageOption]) {
            setPreviewImage(tweetImageOptions[selectedImageOption]);
            setCurrentView('create-tweet');
        }
    };

    const handleSkipImage = () => {
        setCurrentView('create-tweet');
    };

    // Filter content by tab
    const filteredContent = contentItems.filter(item => {
        if (activeTab === 'all') return true;
        if (activeTab === 'twitter') return item.type === 'twitter' || item.type === 'thread';
        if (activeTab === 'discord') return item.type === 'discord';
        if (activeTab === 'email') return item.type === 'email';
        if (activeTab === 'graphics') return item.type === 'graphic';
        return true;
    });

    // Count by type
    const counts = {
        all: contentItems.length,
        twitter: contentItems.filter(i => i.type === 'twitter' || i.type === 'thread').length,
        discord: contentItems.filter(i => i.type === 'discord').length,
        email: contentItems.filter(i => i.type === 'email').length,
        graphics: contentItems.filter(i => i.type === 'graphic').length
    };

    // Get gradient for card type
    const getCardGradient = (type: ContentItem['type']) => {
        switch (type) {
            case 'twitter':
                return 'bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460]';
            case 'thread':
                return 'bg-gradient-to-br from-[#1DA1F2] via-[#0D8BD9] to-[#1A1A2E]';
            case 'discord':
                return 'bg-gradient-to-br from-[#5865F2] via-[#4752C4] to-[#1A1A2E]';
            case 'email':
                return 'bg-gradient-to-br from-[#9333EA] via-[#7C3AED] to-[#1A1A2E]';
            case 'graphic':
                return 'bg-[radial-gradient(ellipse_at_center,_#FF5C00_0%,_#FF8400_40%,_#1A1A1A_100%)]';
            case 'blog':
                return 'bg-gradient-to-b from-[#0EA5E9] to-[#6366F1]';
            default:
                return 'bg-gradient-to-br from-[#1A1A2E] to-[#0F3460]';
        }
    };

    // Get badge info for content type
    const getBadgeInfo = (type: ContentItem['type']) => {
        switch (type) {
            case 'twitter':
                return { icon: 'tag', label: 'Twitter', color: '#1DA1F2', bg: 'bg-[#1DA1F2]' };
            case 'thread':
                return { icon: 'tag', label: 'Thread', color: '#1DA1F2', bg: 'bg-[#1DA1F233]', textColor: 'text-[#1DA1F2]' };
            case 'discord':
                return { icon: 'forum', label: 'Discord', color: '#5865F2', bg: 'bg-[#5865F233]', textColor: 'text-[#5865F2]' };
            case 'email':
                return { icon: 'mail', label: 'Email Newsletter', color: '#A855F7', bg: 'bg-[#9333EA33]', textColor: 'text-[#A855F7]' };
            case 'graphic':
                return { icon: 'image', label: 'Banner Graphic', color: '#FF8400', bg: 'bg-[#FF5C0033]', textColor: 'text-[#FF8400]' };
            case 'blog':
                return { icon: 'description', label: 'Blog Post', color: '#10B981', bg: 'bg-[#10B98133]', textColor: 'text-[#10B981]' };
            default:
                return { icon: 'article', label: 'Content', color: '#64748B', bg: 'bg-[#64748B33]', textColor: 'text-[#64748B]' };
        }
    };

    // Get status badge info
    const getStatusInfo = (status: ContentStatus) => {
        switch (status) {
            case 'published':
                return { label: 'Published', color: '#22C55E', bg: 'bg-[#22C55E22]' };
            case 'scheduled':
                return { label: 'Scheduled', color: '#F59E0B', bg: 'bg-[#F59E0B22]' };
            case 'draft':
                return { label: 'Draft', color: '#3B82F6', bg: 'bg-[#3B82F622]' };
            case 'review':
                return { label: 'In Review', color: '#F59E0B', bg: 'bg-[#F59E0B22]' };
            default:
                return { label: 'Unknown', color: '#64748B', bg: 'bg-[#64748B22]' };
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    // Distribute content into 3 columns (masonry-style)
    const columns: ContentItem[][] = [[], [], []];
    filteredContent.forEach((item, index) => {
        columns[index % 3].push(item);
    });

    // =====================================================
    // CREATE TWEET VIEW
    // =====================================================
    if (currentView === 'create-tweet') {
        const isThreadPreview = selectedContentType === 'thread' && generatedThreadPreview.length > 0;
        const currentTweetText = isThreadPreview
            ? (generatedThreadPreview[currentThreadIndex] || generatedThreadPreview[0])
            : generatedTweetPreview;
        return (
            <div className="flex-1 flex bg-[#0A0A0B] min-h-0">
                {/* Left Panel */}
                <div className="w-[480px] flex flex-col bg-[#111113] border-r border-[#1F1F23]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F1F23]">
                        <button
                            onClick={handleBackToLibrary}
                            className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors"
                        >
                            <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                            <span className="text-sm font-medium">Back</span>
                        </button>

                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#1DA1F2] flex items-center justify-center">
                                <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 300" }}>tag</span>
                            </div>
                            <span className="text-lg font-semibold text-white">
                                {selectedContentType === 'thread' ? 'Create Thread' : 'Create Tweet'}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3B82F622]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></span>
                            <span className="text-xs font-medium text-[#3B82F6]">Draft</span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Tweet Topic */}
                        <div className="space-y-2.5">
                            <label className="text-sm font-semibold text-white">What's your tweet about?</label>
                            <textarea
                                value={tweetTopic}
                                onChange={e => setTweetTopic(e.target.value)}
                                placeholder="Announce our new NFT collection drop, highlight the exclusive benefits for early holders and create urgency..."
                                className="w-full h-[100px] bg-[#0A0A0B] border border-[#2E2E2E] rounded-[10px] p-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#FF5C00] focus:outline-none resize-none transition-colors"
                            />
                        </div>

                        {/* Content Type */}
                        <div className="space-y-2.5">
                            <label className="text-sm font-semibold text-white">Content Type</label>
                            <div className="grid grid-cols-3 gap-2.5">
                                {CONTENT_TYPE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setSelectedContentType(opt.id)}
                                        className={`flex flex-col gap-1 p-3 rounded-[10px] border text-left transition-all ${
                                            selectedContentType === opt.id
                                                ? 'bg-[#FF5C0015] border-[#FF5C00]'
                                                : 'bg-[#0A0A0B] border-[#2E2E2E] hover:border-[#3E3E3E]'
                                        }`}
                                    >
                                        <span className={`text-[13px] font-semibold ${selectedContentType === opt.id ? 'text-[#FF5C00]' : 'text-white'}`}>
                                            {opt.emoji} {opt.label}
                                        </span>
                                        <span className={`text-[11px] ${selectedContentType === opt.id ? 'text-[#FF5C0099]' : 'text-[#64748B]'}`}>
                                            {opt.description}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Context / Background */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-white">Context / Background</label>
                                <span className="text-xs text-[#64748B]">Optional</span>
                            </div>
                            <textarea
                                value={tweetContext}
                                onChange={e => setTweetContext(e.target.value)}
                                placeholder="Add any relevant details: links, dates, specific features to mention, hashtags to include..."
                                className="w-full h-[80px] bg-[#0A0A0B] border border-[#2E2E2E] rounded-[10px] p-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#FF5C00] focus:outline-none resize-none transition-colors"
                            />
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerateTweet}
                            disabled={!tweetTopic.trim() || isGeneratingTweet}
                            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-white text-[15px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                        >
                            <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>auto_awesome</span>
                            {isGeneratingTweet
                                ? (selectedContentType === 'thread' ? 'Generating Thread...' : 'Generating...')
                                : (selectedContentType === 'thread' ? 'Generate Thread' : 'Generate Tweet')}
                        </button>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg text-center">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end px-6 py-4 border-t border-[#1F1F23]">
                        <button
                            onClick={handleGenerateTweet}
                            disabled={!currentTweetText || isGeneratingTweet}
                            className="flex items-center gap-2 px-4 py-3 rounded-[10px] bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>refresh</span>
                            Regenerate
                        </button>
                    </div>
                </div>

                {/* Right Panel - Preview */}
                <div className="flex-1 flex items-center justify-center bg-[#0A0A0B] p-10">
                    <div className="flex flex-col items-center gap-6 w-full max-w-[520px]">
                        {/* Preview Label */}
                        <div className="flex items-center gap-2 text-[#64748B]">
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>visibility</span>
                            <span className="text-sm font-medium">Preview</span>
                        </div>

                        {/* Tweet Card */}
                        <div className="w-full bg-[#111113] border border-[#1F1F23] rounded-2xl p-5 space-y-4">
                            {/* Author */}
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-full"
                                    style={{ background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)' }}
                                />
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[15px] font-semibold text-white">Web3 Project</span>
                                        <span className="material-symbols-sharp text-[#1DA1F2] text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>verified</span>
                                    </div>
                                    <span className="text-sm text-[#64748B]">@web3project · Now</span>
                                </div>
                            </div>

                            {/* Tweet Content */}
                            {isThreadPreview && (
                                <div className="flex items-center justify-between mb-2 px-2 py-1 rounded-lg bg-[#0A0A0B] border border-[#1F1F23]">
                                    <button
                                        onClick={() => setCurrentThreadIndex(i => Math.max(0, i - 1))}
                                        disabled={currentThreadIndex === 0}
                                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                                            currentThreadIndex === 0 ? 'text-[#2E2E2E]' : 'text-[#6B6B70] hover:text-white bg-[#1F1F23]'
                                        }`}
                                        title="Previous tweet"
                                    >
                                        <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>chevron_left</span>
                                    </button>
                                    <span className="text-[11px] font-mono text-[#6B6B70]">
                                        Thread {currentThreadIndex + 1} / {generatedThreadPreview.length}
                                    </span>
                                    <button
                                        onClick={() => setCurrentThreadIndex(i => Math.min(generatedThreadPreview.length - 1, i + 1))}
                                        disabled={currentThreadIndex >= generatedThreadPreview.length - 1}
                                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                                            currentThreadIndex >= generatedThreadPreview.length - 1 ? 'text-[#2E2E2E]' : 'text-[#6B6B70] hover:text-white bg-[#1F1F23]'
                                        }`}
                                        title="Next tweet"
                                    >
                                        <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>chevron_right</span>
                                    </button>
                                </div>
                            )}
                            <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap">
                                {currentTweetText || "🚀 Big announcement! We're launching our new NFT collection next week.\n\nHere's what makes it special:\n• 10,000 unique pieces\n• Exclusive holder benefits\n• Built on Solana for low fees\n\nWho's ready? 👇"}
                            </p>

                            {/* Add Image Button or Preview Image */}
                            {previewImage ? (
                                <div className="relative rounded-xl overflow-hidden">
                                    <img src={previewImage} className="w-full object-cover" alt="Generated" />
                                    <button
                                        onClick={() => setPreviewImage(null)}
                                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                                    >
                                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleGoToAddTweetImage}
                                    disabled={!currentTweetText}
                                    className="w-full h-[100px] flex flex-col items-center justify-center gap-2 bg-[#0A0A0B] border border-[#2E2E2E] rounded-xl text-[#64748B] hover:border-[#3E3E3E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-sharp text-[28px]" style={{ fontVariationSettings: "'wght' 300" }}>add_photo_alternate</span>
                                    <span className="text-sm font-medium">Add AI-Generated Image</span>
                                </button>
                            )}

                            {/* Tweet Actions */}
                            <div className="flex items-center justify-between pt-2">
                                {[
                                    { icon: 'chat_bubble', label: 'Reply' },
                                    { icon: 'repeat', label: 'Retweet' },
                                    { icon: 'favorite', label: 'Like' },
                                    { icon: 'share', label: 'Share' },
                                ].map(action => (
                                    <div key={action.label} className="flex items-center gap-2 text-[#64748B]">
                                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>{action.icon}</span>
                                        <span className="text-[13px]">{action.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => currentTweetText && onSchedule(currentTweetText, previewImage || undefined)}
                                disabled={!currentTweetText}
                                className="flex items-center gap-2 px-5 py-3 rounded-[10px] bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>calendar_today</span>
                                Schedule
                            </button>
                            <button
                                onClick={() => currentTweetText && handlePrepareTweet(currentTweetText)}
                                disabled={!currentTweetText}
                                className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>send</span>
                                Post Now
                            </button>
                            {isThreadPreview && (
                                <button
                                    onClick={() => {
                                        const formatted = generatedThreadPreview.map((t, i) => {
                                            const hasNumber = /^\s*\d+\/\d+/.test(t);
                                            return hasNumber ? t : `${i + 1}/${generatedThreadPreview.length} ${t}`;
                                        }).join('\n\n');
                                        navigator.clipboard.writeText(formatted);
                                    }}
                                    className="flex items-center gap-2 px-4 py-3 rounded-[10px] bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors"
                                    title="Copy full thread"
                                >
                                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>content_copy</span>
                                    Copy Thread
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =====================================================
    // CREATE GRAPHIC VIEW
    // =====================================================
    if (currentView === 'create-graphic') {
        // Reference images from brand kit for display
        const referenceImages = (brandConfig.referenceImages || []).slice(0, 8).map((img, idx) => ({
            id: idx,
            url: img.url || img.data,
            name: img.name,
        }));

        const visualStyles = ['Modern', 'Minimalist', 'Bold', 'Neon', 'Vintage', 'Corporate'];

        return (
            <div className="flex-1 flex bg-[#0A0A0B] min-h-0">
                {/* Left Panel */}
                <div className="w-[480px] flex flex-col bg-[#111113] border-r border-[#1F1F23]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F1F23]">
                        <button
                            onClick={handleBackToLibrary}
                            className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors"
                        >
                            <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                            <span className="text-sm font-medium">Back</span>
                        </button>

                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#FF5C00] flex items-center justify-center">
                                <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                            </div>
                            <span className="text-lg font-semibold text-white">Create Graphic</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3B82F622]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></span>
                            <span className="text-xs font-medium text-[#3B82F6]">Draft</span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-7">
                        {/* Section 1: Tweet Content */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-sharp text-[#64748B] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>edit_note</span>
                                <label className="text-sm font-semibold text-white">Tweet Content</label>
                            </div>
                            <textarea
                                value={graphicTweetContent}
                                onChange={e => setGraphicTweetContent(e.target.value)}
                                placeholder="Paste the tweet this graphic will accompany, or describe the visual you want to create..."
                                className="w-full h-[120px] bg-[#0A0A0B] border border-[#2E2E2E] rounded-[10px] p-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#FF5C00] focus:outline-none resize-none transition-colors"
                            />
                        </div>

                        {/* Section 2: Visual Style */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-sharp text-[#64748B] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>palette</span>
                                <label className="text-sm font-semibold text-white">Visual Style</label>
                            </div>
                            <div className="relative">
                                <select
                                    value={visualStyle}
                                    onChange={e => setVisualStyle(e.target.value)}
                                    className="w-[160px] appearance-none bg-[#0A0A0B] border border-[#2E2E2E] rounded-[10px] px-3.5 py-3 text-sm text-white focus:border-[#FF5C00] focus:outline-none cursor-pointer transition-colors"
                                >
                                    {visualStyles.map(style => (
                                        <option key={style} value={style}>{style}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-sharp absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] text-lg pointer-events-none" style={{ fontVariationSettings: "'wght' 300" }}>expand_more</span>
                            </div>
                        </div>

                        {/* Section 3: Reference Images */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-sharp text-[#64748B] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>collections</span>
                                    <label className="text-sm font-semibold text-white">Reference Images</label>
                                </div>
                                <span className="text-xs text-[#64748B]">Select up to 3</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {referenceImages.length > 0 ? referenceImages.map(img => (
                                    <button
                                        key={img.id}
                                        onClick={() => {
                                            if (selectedRefImages.includes(img.id)) {
                                                setSelectedRefImages(prev => prev.filter(i => i !== img.id));
                                            } else if (selectedRefImages.length < 3) {
                                                setSelectedRefImages(prev => [...prev, img.id]);
                                            }
                                        }}
                                        className={`aspect-square rounded-lg overflow-hidden transition-all ${
                                            selectedRefImages.includes(img.id)
                                                ? 'ring-2 ring-[#FF5C00] ring-offset-2 ring-offset-[#111113]'
                                                : 'hover:opacity-80'
                                        }`}
                                        title={img.name}
                                    >
                                        <img
                                            src={img.url}
                                            alt={img.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                // Fallback to gradient if image fails to load
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).parentElement!.classList.add('bg-gradient-to-br', 'from-purple-600', 'to-blue-600');
                                            }}
                                        />
                                    </button>
                                )) : (
                                    <div className="col-span-4 py-4 text-center text-[#64748B] text-sm">
                                        No reference images in brand kit. Upload some in Settings → Brand Kit.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 4: Assets */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-sharp text-[#64748B] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>folder_open</span>
                                    <label className="text-sm font-semibold text-white">Assets</label>
                                </div>
                                <span className="text-xs text-[#64748B]">Optional</span>
                            </div>

                            {/* Uploaded Assets Grid */}
                            {uploadedAssets.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {uploadedAssets.map(asset => (
                                        <div key={asset.id} className="relative w-16 h-16 rounded-lg overflow-hidden group">
                                            <img
                                                src={`data:${asset.mimeType};base64,${asset.data}`}
                                                className="w-full h-full object-cover"
                                                alt="Uploaded asset"
                                            />
                                            <button
                                                onClick={() => removeAsset(asset.id)}
                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                            >
                                                <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex flex-col items-center justify-center gap-2 py-6 bg-[#0A0A0B] border border-[#2E2E2E] border-dashed rounded-[10px] text-[#64748B] hover:border-[#3E3E3E] hover:text-white transition-colors"
                            >
                                <span className="material-symbols-sharp text-2xl" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                <span className="text-sm font-medium">Add Asset</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAssetUpload}
                            />
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerateGraphicVariations}
                            disabled={!graphicTweetContent.trim() || isGeneratingGraphic}
                            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-white text-[15px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                        >
                            <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>auto_awesome</span>
                            {isGeneratingGraphic ? 'Generating...' : 'Generate Graphic'}
                        </button>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg text-center">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end px-6 py-4 border-t border-[#1F1F23]">
                        <button
                            onClick={handleGenerateGraphicVariations}
                            disabled={graphicVariations.length === 0 || isGeneratingGraphic}
                            className="flex items-center gap-2 px-4 py-3 rounded-[10px] bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>refresh</span>
                            Regenerate
                        </button>
                    </div>
                </div>

                {/* Right Panel - Variations */}
                <div className="flex-1 flex flex-col bg-[#0A0A0B]">
                    {/* Right Header */}
                    <div className="flex items-center justify-between px-6 py-3 border-b border-[#1F1F23]">
                        {/* Preview Label */}
                        <div className="flex items-center gap-2 text-[#64748B]">
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>visibility</span>
                            <span className="text-sm font-medium">Preview</span>
                        </div>

                        {/* Step Indicator */}
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                    graphicStep >= 1 ? 'bg-[#FF5C00] text-white' : 'bg-[#2E2E2E] text-[#64748B]'
                                }`}>1</div>
                                <span className={`text-sm font-medium ${graphicStep >= 1 ? 'text-white' : 'text-[#64748B]'}`}>Draft</span>
                            </div>
                            <div className="w-8 h-0.5 bg-[#2E2E2E]" />
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                    graphicStep >= 2 ? 'bg-[#FF5C00] text-white' : 'bg-[#2E2E2E] text-[#64748B]'
                                }`}>2</div>
                                <span className={`text-sm font-medium ${graphicStep >= 2 ? 'text-white' : 'text-[#64748B]'}`}>Preview</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => graphicVariations[selectedVariation] && handleDownload(graphicVariations[selectedVariation])}
                                disabled={graphicVariations.length === 0}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>download</span>
                                Download
                            </button>
                            <button
                                onClick={() => {
                                    if (graphicVariations[selectedVariation]) {
                                        onSchedule(graphicTweetContent, graphicVariations[selectedVariation]);
                                        handleBackToLibrary();
                                    }
                                }}
                                disabled={graphicVariations.length === 0}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>check</span>
                                Use This
                            </button>
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 overflow-y-auto p-10">
                        {/* Variations Header */}
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-lg font-semibold text-white">Choose a Variation</h2>
                            <button
                                onClick={handleGenerateGraphicVariations}
                                disabled={graphicVariations.length === 0 || isGeneratingGraphic}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>refresh</span>
                                Regenerate All
                            </button>
                        </div>

                        {/* Variations Grid */}
                        {graphicVariations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-20 h-20 rounded-2xl bg-[#1F1F23] flex items-center justify-center mb-4">
                                    <span className="material-symbols-sharp text-4xl text-[#64748B]" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">No variations yet</h3>
                                <p className="text-sm text-[#64748B] max-w-sm">
                                    Enter your tweet content and click "Generate Graphic" to create visual variations.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {graphicVariations.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedVariation(idx)}
                                        className={`w-full bg-[#111113] rounded-2xl overflow-hidden transition-all ${
                                            selectedVariation === idx
                                                ? 'ring-2 ring-[#FF5C00]'
                                                : 'border border-[#2E2E2E] hover:border-[#3E3E3E]'
                                        }`}
                                    >
                                        {/* Image */}
                                        <div className="aspect-video w-full relative">
                                            <img src={img} className="w-full h-full object-cover" alt={`Variation ${idx + 1}`} />
                                            {/* Selection indicator */}
                                            {selectedVariation === idx && (
                                                <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FF5C00] flex items-center justify-center">
                                                    <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check</span>
                                                </div>
                                            )}
                                        </div>
                                        {/* Footer */}
                                        <div className="flex items-center justify-between px-5 py-4 border-t border-[#1F1F23]">
                                            <span className="text-sm font-medium text-white">Variation {idx + 1}</span>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                selectedVariation === idx
                                                    ? 'border-[#FF5C00] bg-[#FF5C00]'
                                                    : 'border-[#3E3E3E]'
                                            }`}>
                                                {selectedVariation === idx && (
                                                    <span className="w-2 h-2 rounded-full bg-white"></span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lightbox */}
                {viewingImage && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-10 backdrop-blur-sm" onClick={() => setViewingImage(null)}>
                        <img src={viewingImage} className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                        <div className="absolute top-6 right-6 flex items-center gap-2">
                            {onNavigate && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setViewingImage(null); onNavigate('image-editor', { image: viewingImage }); }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
                                >
                                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>edit</span>
                                    Edit in Image Editor
                                </button>
                            )}
                            <button
                                onClick={() => setViewingImage(null)}
                                className="text-white/50 hover:text-white transition-colors bg-white/10 rounded-full w-10 h-10 flex items-center justify-center"
                            >
                                <span className="material-symbols-sharp" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // =====================================================
    // ADD TWEET IMAGE VIEW
    // =====================================================
    if (currentView === 'add-tweet-image') {
        const tweetRefImages = (brandConfig.referenceImages || []).slice(0, 8).map((img, idx) => ({
            id: idx,
            url: img.url || img.data,
            name: img.name,
        }));

        return (
            <div className="flex-1 flex bg-[#0A0A0B] min-h-0">
                {/* Left Panel */}
                <div className="w-[480px] flex flex-col bg-[#111113] border-r border-[#1F1F23]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F1F23]">
                        <button
                            onClick={() => setCurrentView('create-tweet')}
                            className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors"
                        >
                            <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                            <span className="text-sm font-medium">Back</span>
                        </button>

                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#FF5C00] flex items-center justify-center">
                                <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                            </div>
                            <span className="text-lg font-semibold text-white">Add Image to Tweet</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22C55E22]">
                            <span className="text-xs font-medium text-[#22C55E]">Optional</span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Your Tweet Preview */}
                        <div className="space-y-2.5">
                            <label className="text-sm font-semibold text-white">Your Tweet</label>
                            <div className="bg-[#0A0A0B] border border-[#2E2E2E] rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className="w-10 h-10 rounded-full"
                                        style={{ background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)' }}
                                    />
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-semibold text-white">Web3 Project</span>
                                            <span className="material-symbols-sharp text-[#1DA1F2] text-sm" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>verified</span>
                                        </div>
                                        <span className="text-xs text-[#64748B]">@web3project</span>
                                    </div>
                                </div>
                                <p className="text-[13px] text-white leading-relaxed whitespace-pre-wrap">
                                    {tweetForImage || generatedTweetPreview || "Your tweet content will appear here..."}
                                </p>
                            </div>
                        </div>

                        {/* Image Description */}
                        <div className="space-y-2.5">
                            <label className="text-sm font-semibold text-white">Image Description</label>
                            <p className="text-xs text-[#64748B]">AI will generate 3 options based on your tweet</p>
                            <textarea
                                value={tweetImageDescription}
                                onChange={e => setTweetImageDescription(e.target.value)}
                                placeholder="NFT collection banner with futuristic 3D elements and bold typography..."
                                className="w-full h-[80px] bg-[#0A0A0B] border border-[#2E2E2E] rounded-[10px] p-3.5 text-sm text-white placeholder-[#94A3B8] focus:border-[#FF5C00] focus:outline-none resize-none transition-colors"
                            />
                        </div>

                        {/* Reference Images */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-white">Reference Images</label>
                                <span className="text-xs text-[#64748B]">Optional — Select up to 3</span>
                            </div>
                            <div className="flex gap-3 flex-wrap">
                                {tweetRefImages.length > 0 ? tweetRefImages.map(img => (
                                    <button
                                        key={img.id}
                                        onClick={() => {
                                            if (selectedRefImages.includes(img.id)) {
                                                setSelectedRefImages(prev => prev.filter(i => i !== img.id));
                                            } else if (selectedRefImages.length < 3) {
                                                setSelectedRefImages(prev => [...prev, img.id]);
                                            }
                                        }}
                                        className={`w-[72px] h-[72px] rounded-lg overflow-hidden transition-all ${
                                            selectedRefImages.includes(img.id)
                                                ? 'ring-2 ring-[#FF5C00] ring-offset-1 ring-offset-[#111113]'
                                                : 'border border-[#2E2E2E] hover:border-[#3E3E3E]'
                                        }`}
                                        title={img.name}
                                    >
                                        <img
                                            src={img.url}
                                            alt={img.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).parentElement!.classList.add('bg-gradient-to-br', 'from-purple-600', 'to-blue-600');
                                            }}
                                        />
                                    </button>
                                )) : (
                                    <div className="text-[#64748B] text-xs py-3">
                                        No reference images yet. Upload in Brand Kit or use the + button.
                                    </div>
                                )}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-[72px] h-[72px] flex items-center justify-center rounded-lg bg-[#0A0A0B] border border-[#2E2E2E] text-[#64748B] hover:border-[#3E3E3E] hover:text-white transition-colors"
                                >
                                    <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-[#1F1F23]">
                        <button
                            onClick={handleSkipImage}
                            className="text-sm text-[#64748B] hover:text-white transition-colors"
                        >
                            Skip Image
                        </button>
                        <button
                            onClick={handleGenerateTweetImageOptions}
                            disabled={isGeneratingTweetImages}
                            className="flex items-center gap-2 px-4 py-3 rounded-[10px] text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                        >
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>auto_awesome</span>
                            {isGeneratingTweetImages ? 'Generating...' : 'Generate 3 Options'}
                        </button>
                    </div>
                </div>

                {/* Right Panel - Image Options */}
                <div className="flex-1 flex flex-col bg-[#0A0A0B]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 py-4 border-b border-[#1F1F23]">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-sharp text-lg text-[#64748B]" style={{ fontVariationSettings: "'wght' 300" }}>collections</span>
                            <span className="text-base font-semibold text-white">Choose an Image</span>
                        </div>
                        {tweetImageOptions.length > 0 && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B98122]">
                                <span className="material-symbols-sharp text-sm text-[#10B981]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check</span>
                                <span className="text-xs font-medium text-[#10B981]">Option {selectedImageOption + 1} Selected</span>
                            </div>
                        )}
                    </div>

                    {/* Image Grid */}
                    <div className="flex-1 overflow-y-auto p-8">
                        {tweetImageOptions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="w-20 h-20 rounded-2xl bg-[#1F1F23] flex items-center justify-center mb-4">
                                    <span className="material-symbols-sharp text-4xl text-[#64748B]" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">No images generated yet</h3>
                                <p className="text-sm text-[#64748B] max-w-sm">
                                    Configure your preferences and click "Generate 3 Options" to create images for your tweet.
                                </p>
                            </div>
                        ) : (
                            <div className="flex gap-6">
                                {tweetImageOptions.map((img, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col gap-3">
                                        {/* Image */}
                                        <button
                                            onClick={() => {
                                                setSelectedImageOption(idx);
                                                setViewingImage(img);
                                            }}
                                            className={`aspect-video rounded-2xl overflow-hidden transition-all cursor-pointer ${
                                                selectedImageOption === idx
                                                    ? 'ring-[3px] ring-[#FF5C00]'
                                                    : 'border border-[#2E2E2E] hover:border-[#3E3E3E]'
                                            }`}
                                        >
                                            <img src={img} className="w-full h-full object-cover" alt={`Option ${idx + 1}`} />
                                        </button>

                                        {/* Label */}
                                        <div className="flex items-center justify-between">
                                            <span className={`text-sm font-semibold ${selectedImageOption === idx ? 'text-[#FF5C00]' : 'text-white'}`}>
                                                Option {idx + 1}
                                            </span>
                                            {selectedImageOption === idx && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="material-symbols-sharp text-sm text-[#10B981]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check</span>
                                                    <span className="text-xs font-medium text-[#10B981]">Selected</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            {selectedImageOption === idx ? (
                                                <button
                                                    onClick={() => onNavigate ? onNavigate('image-editor', { image: img }) : setViewingImage(img)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors"
                                                >
                                                    <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>edit</span>
                                                    Edit
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => setSelectedImageOption(idx)}
                                                        className="flex-1 flex items-center justify-center py-2.5 rounded-lg bg-[#0A0A0B] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#1F1F23] transition-colors"
                                                    >
                                                        Select
                                                    </button>
                                                    <button
                                                        onClick={() => onNavigate ? onNavigate('image-editor', { image: img }) : setViewingImage(img)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#0A0A0B] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#1F1F23] transition-colors"
                                                    >
                                                        <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>edit</span>
                                                        Edit
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end px-8 py-4 border-t border-[#1F1F23]">
                        <button
                            onClick={handleUseSelectedImage}
                            disabled={tweetImageOptions.length === 0}
                            className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                        >
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>check</span>
                            Use Selected Image
                        </button>
                    </div>
                </div>

                {/* Lightbox */}
                {viewingImage && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-10 backdrop-blur-sm" onClick={() => setViewingImage(null)}>
                        <img src={viewingImage} className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                        <div className="absolute top-6 right-6 flex items-center gap-2">
                            {onNavigate && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setViewingImage(null); onNavigate('image-editor', { image: viewingImage }); }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
                                >
                                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>edit</span>
                                    Edit in Image Editor
                                </button>
                            )}
                            <button
                                onClick={() => setViewingImage(null)}
                                className="text-white/50 hover:text-white transition-colors bg-white/10 rounded-full w-10 h-10 flex items-center justify-center"
                            >
                                <span className="material-symbols-sharp" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // =====================================================
    // QUOTE TWEET VIEW
    // =====================================================
    if (currentView === 'quote-tweet') {
        return (
            <div className="flex-1 flex bg-[#0A0A0B] min-h-0">
                {/* Left Panel */}
                <div className="w-[480px] flex flex-col bg-[#111113] border-r border-[#1F1F23]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F1F23]">
                        <button
                            onClick={handleBackToLibrary}
                            className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors"
                        >
                            <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'wght' 300" }}>arrow_back</span>
                            <span className="text-sm font-medium">Back</span>
                        </button>

                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#10B981] flex items-center justify-center">
                                <span className="material-symbols-sharp text-white text-base" style={{ fontVariationSettings: "'wght' 300" }}>format_quote</span>
                            </div>
                            <span className="text-lg font-semibold text-white">Quote Tweet</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#3B82F622]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"></span>
                            <span className="text-xs font-medium text-[#3B82F6]">Draft</span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Step 1: Tweet URL */}
                        <div className="space-y-2.5">
                            <label className="text-sm font-semibold text-white">Tweet URL</label>
                            <div className="flex gap-2">
                                <input
                                    value={quoteTweetUrl}
                                    onChange={e => setQuoteTweetUrl(e.target.value)}
                                    placeholder="https://x.com/user/status/123456..."
                                    className="flex-1 bg-[#0A0A0B] border border-[#2E2E2E] rounded-[10px] px-3.5 py-3 text-sm text-white placeholder-[#64748B] focus:border-[#10B981] focus:outline-none transition-colors"
                                    onKeyDown={e => { if (e.key === 'Enter') handleFetchTweet(); }}
                                />
                                <button
                                    onClick={handleFetchTweet}
                                    disabled={!quoteTweetUrl.trim() || isFetchingTweet}
                                    className="px-4 py-3 rounded-[10px] bg-[#10B981] text-white text-sm font-semibold hover:bg-[#0D9668] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isFetchingTweet ? (
                                        <>
                                            <span className="material-symbols-sharp text-base animate-spin" style={{ fontVariationSettings: "'wght' 300" }}>progress_activity</span>
                                            Fetching...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>download</span>
                                            Fetch
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Fetched Tweet Preview */}
                        {fetchedTweetData && (
                            <div className="p-4 bg-[#0A0A0B] border border-[#2E2E2E] rounded-xl space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-sharp text-[#1DA1F2] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>tag</span>
                                    <span className="text-sm font-semibold text-white">{fetchedTweetData.authorName}</span>
                                    <span className="text-sm text-[#64748B]">@{fetchedTweetData.authorHandle}</span>
                                </div>
                                <p className="text-sm text-[#C4C4C4] leading-relaxed whitespace-pre-wrap">{fetchedTweetData.text}</p>
                            </div>
                        )}

                        {/* Step 2: Mode Selection */}
                        {fetchedTweetData && (
                            <div className="space-y-2.5">
                                <label className="text-sm font-semibold text-white">Quote Mode</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setQuoteTweetMode('amplify')}
                                        className={`flex flex-col gap-1.5 p-4 rounded-xl border text-left transition-all ${
                                            quoteTweetMode === 'amplify'
                                                ? 'bg-[#10B98115] border-[#10B981]'
                                                : 'bg-[#0A0A0B] border-[#2E2E2E] hover:border-[#3E3E3E]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300", color: quoteTweetMode === 'amplify' ? '#10B981' : '#64748B' }}>campaign</span>
                                            <span className={`text-sm font-semibold ${quoteTweetMode === 'amplify' ? 'text-[#10B981]' : 'text-white'}`}>Amplify</span>
                                        </div>
                                        <span className={`text-xs ${quoteTweetMode === 'amplify' ? 'text-[#10B98199]' : 'text-[#64748B]'}`}>
                                            Endorse, agree, add value
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setQuoteTweetMode('explain')}
                                        className={`flex flex-col gap-1.5 p-4 rounded-xl border text-left transition-all ${
                                            quoteTweetMode === 'explain'
                                                ? 'bg-[#3B82F615] border-[#3B82F6]'
                                                : 'bg-[#0A0A0B] border-[#2E2E2E] hover:border-[#3E3E3E]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300", color: quoteTweetMode === 'explain' ? '#3B82F6' : '#64748B' }}>school</span>
                                            <span className={`text-sm font-semibold ${quoteTweetMode === 'explain' ? 'text-[#3B82F6]' : 'text-white'}`}>Explain</span>
                                        </div>
                                        <span className={`text-xs ${quoteTweetMode === 'explain' ? 'text-[#3B82F699]' : 'text-[#64748B]'}`}>
                                            Hook, CTA, what, when
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Optional Context */}
                        {fetchedTweetData && (
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-white">Extra Context</label>
                                    <span className="text-xs text-[#64748B]">Optional</span>
                                </div>
                                <textarea
                                    value={quoteTweetContext}
                                    onChange={e => setQuoteTweetContext(e.target.value)}
                                    placeholder="Add any specific angle, CTA, or details you want included..."
                                    className="w-full h-[80px] bg-[#0A0A0B] border border-[#2E2E2E] rounded-[10px] p-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#10B981] focus:outline-none resize-none transition-colors"
                                />
                            </div>
                        )}

                        {/* Generate Button */}
                        {fetchedTweetData && (
                            <button
                                onClick={handleGenerateQuoteTweet}
                                disabled={isGeneratingQuoteTweet}
                                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-white text-[15px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: quoteTweetMode === 'amplify'
                                    ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)'
                                    : 'linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)' }}
                            >
                                <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>auto_awesome</span>
                                {isGeneratingQuoteTweet
                                    ? 'Generating...'
                                    : `Generate ${quoteTweetMode === 'amplify' ? 'Amplify' : 'Explain'} Quote`}
                            </button>
                        )}

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg text-center">
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {generatedQuoteTweet && (
                        <div className="flex items-center justify-end px-6 py-4 border-t border-[#1F1F23]">
                            <button
                                onClick={handleGenerateQuoteTweet}
                                disabled={isGeneratingQuoteTweet}
                                className="flex items-center gap-2 px-4 py-3 rounded-[10px] bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>refresh</span>
                                Regenerate
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Panel - Preview */}
                <div className="flex-1 flex items-center justify-center bg-[#0A0A0B] p-10">
                    <div className="flex flex-col items-center gap-6 w-full max-w-[520px]">
                        {/* Preview Label */}
                        <div className="flex items-center gap-2 text-[#64748B]">
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>visibility</span>
                            <span className="text-sm font-medium">Quote Tweet Preview</span>
                        </div>

                        {/* Quote Tweet Card */}
                        <div className="w-full bg-[#111113] border border-[#1F1F23] rounded-2xl p-5 space-y-4">
                            {/* Author (your brand) */}
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-full"
                                    style={{ background: 'linear-gradient(135deg, #FF5C00 0%, #FF8400 100%)' }}
                                />
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[15px] font-semibold text-white">{brandName || 'Your Brand'}</span>
                                        <span className="material-symbols-sharp text-[#1DA1F2] text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>verified</span>
                                    </div>
                                    <span className="text-sm text-[#64748B]">@{brandName?.toLowerCase().replace(/\s+/g, '') || 'brand'} · Now</span>
                                </div>
                            </div>

                            {/* Generated Quote Tweet Text */}
                            <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap">
                                {generatedQuoteTweet || (
                                    <span className="text-[#4A4A4E] italic">
                                        {fetchedTweetData
                                            ? 'Click "Generate" to create your quote tweet...'
                                            : 'Paste a tweet URL and fetch it to get started...'}
                                    </span>
                                )}
                            </p>

                            {/* Embedded Original Tweet */}
                            {fetchedTweetData && (
                                <div className="border border-[#2E2E2E] rounded-xl p-4 bg-[#0A0A0B] space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-[#1F1F23] flex items-center justify-center">
                                            <span className="material-symbols-sharp text-[#64748B] text-xs" style={{ fontVariationSettings: "'wght' 300" }}>person</span>
                                        </div>
                                        <span className="text-[13px] font-semibold text-white">{fetchedTweetData.authorName}</span>
                                        <span className="text-[13px] text-[#64748B]">@{fetchedTweetData.authorHandle}</span>
                                    </div>
                                    <p className="text-[13px] text-[#94A3B8] leading-relaxed whitespace-pre-wrap">{fetchedTweetData.text}</p>
                                </div>
                            )}

                            {/* Tweet Actions */}
                            <div className="flex items-center justify-between pt-2">
                                {[
                                    { icon: 'chat_bubble', label: 'Reply' },
                                    { icon: 'repeat', label: 'Retweet' },
                                    { icon: 'favorite', label: 'Like' },
                                    { icon: 'share', label: 'Share' },
                                ].map(action => (
                                    <div key={action.label} className="flex items-center gap-2 text-[#64748B]">
                                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>{action.icon}</span>
                                        <span className="text-[13px]">{action.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {generatedQuoteTweet && (
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={() => navigator.clipboard.writeText(generatedQuoteTweet)}
                                    className="flex items-center gap-2 px-4 py-3 rounded-[10px] bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors"
                                >
                                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>content_copy</span>
                                    Copy
                                </button>
                                <button
                                    onClick={() => onSchedule(generatedQuoteTweet)}
                                    className="flex items-center gap-2 px-5 py-3 rounded-[10px] bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors"
                                >
                                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>calendar_today</span>
                                    Schedule
                                </button>
                                <button
                                    onClick={() => {
                                        // Open Twitter with pre-filled quote tweet
                                        const quoteUrl = fetchedTweetData?.url || '';
                                        const tweetText = `${generatedQuoteTweet}\n\n${quoteUrl}`;
                                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
                                    }}
                                    className="flex items-center gap-2 px-6 py-3 rounded-[10px] text-white text-sm font-semibold transition-all"
                                    style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                                >
                                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>send</span>
                                    Post Now
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // =====================================================
    // CONTENT LIBRARY VIEW (default)
    // =====================================================
    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-[#1F1F23]">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-semibold text-white">Content Studio</h1>
                    <p className="text-sm text-[#64748B]">Manage and create marketing content</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors">
                        <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>filter_list</span>
                        Filter
                    </button>
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowCreateDropdown(!showCreateDropdown); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors"
                            style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                        >
                            <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                            Create Content
                        </button>

                        {/* Dropdown */}
                        {showCreateDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-[200px] bg-[#1A1A1D] border border-[#2E2E2E] rounded-xl shadow-2xl z-50 overflow-hidden">
                                <button
                                    onClick={() => openCreateView('tweet')}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors"
                                >
                                    <span className="material-symbols-sharp text-lg text-[#1DA1F2]" style={{ fontVariationSettings: "'wght' 300" }}>tag</span>
                                    Tweet / Thread
                                </button>
                                <button
                                    onClick={() => openCreateView('graphic')}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors"
                                >
                                    <span className="material-symbols-sharp text-lg text-[#FF5C00]" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                                    Graphic / Banner
                                </button>
                                <button
                                    onClick={() => openCreateView('quote-tweet')}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors"
                                >
                                    <span className="material-symbols-sharp text-lg text-[#10B981]" style={{ fontVariationSettings: "'wght' 300" }}>format_quote</span>
                                    Quote Tweet
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs Row */}
            <div className="flex items-center px-8 border-b border-[#1F1F23]">
                {[
                    { id: 'all', label: 'All Content' },
                    { id: 'twitter', label: 'Twitter Posts' },
                    { id: 'discord', label: 'Discord' },
                    { id: 'email', label: 'Email' },
                    { id: 'graphics', label: 'Graphics' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as ContentType)}
                        className={`flex items-center gap-2 px-5 py-4 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                            activeTab === tab.id
                                ? 'text-white border-[#FF5C00]'
                                : 'text-[#64748B] border-transparent hover:text-white'
                        }`}
                    >
                        {tab.label}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            activeTab === tab.id
                                ? 'bg-[#FF5C0033] text-[#FF5C00]'
                                : 'bg-[#1F1F23] text-[#64748B]'
                        }`}>
                            {counts[tab.id as ContentType]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto p-8">
                {filteredContent.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-24">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-[#1F1F23] flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-sharp text-[#4A4A4E] text-3xl" style={{ fontVariationSettings: "'wght' 200" }}>edit_note</span>
                            </div>
                            <h3 className="text-base font-semibold text-white mb-1.5">No content yet</h3>
                            <p className="text-sm text-[#6B6B70] max-w-sm mb-5">
                                Generate your first piece of content to build your library.
                            </p>
                            <button
                                onClick={() => setCurrentView('create-tweet')}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                            >
                                <span className="material-symbols-sharp text-lg">add</span>
                                Create Content
                            </button>
                        </div>
                    </div>
                ) : (
                <div className="flex gap-6">
                    {columns.map((column, colIndex) => (
                        <div key={colIndex} className="flex-1 flex flex-col gap-6">
                            {column.map(item => {
                                const badge = getBadgeInfo(item.type);
                                const status = getStatusInfo(item.status);

                                return (
                                    <div
                                        key={item.id}
                                        className="bg-[#111113] border border-[#1F1F23] rounded-2xl overflow-hidden hover:border-[#2E2E2E] transition-colors cursor-pointer group"
                                    >
                                        {/* Card Image */}
                                        <div className={`h-40 ${getCardGradient(item.type)} relative`}>
                                            {item.type === 'twitter' && (
                                                <div className="absolute bottom-5 left-5">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${badge.bg} text-white text-xs font-semibold`}>
                                                        <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>{badge.icon}</span>
                                                        Twitter
                                                    </span>
                                                </div>
                                            )}
                                            {item.type === 'graphic' && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-white text-3xl font-extrabold">NFT DROP</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Body */}
                                        <div className="p-5 flex flex-col gap-3">
                                            {/* Header with Badge & Status (for non-twitter cards) */}
                                            {item.type !== 'twitter' && (
                                                <div className="flex items-center justify-between">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${badge.bg} ${badge.textColor} text-xs font-semibold`}>
                                                        <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>{badge.icon}</span>
                                                        {badge.label}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${status.bg} text-xs font-medium`} style={{ color: status.color }}>
                                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }}></span>
                                                        {status.label}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Title */}
                                            <h3 className="text-[15px] font-medium text-white leading-relaxed">
                                                {item.title}
                                            </h3>

                                            {/* Description (if exists) */}
                                            {item.description && (
                                                <p className="text-sm text-[#64748B] leading-relaxed">
                                                    {item.description}
                                                </p>
                                            )}

                                            {/* Meta info */}
                                            <div className="flex items-center gap-4 text-[13px] text-[#64748B]">
                                                {item.type === 'twitter' && (
                                                    <>
                                                        <span>{item.date}</span>
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${status.bg} text-xs font-medium`} style={{ color: status.color }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }}></span>
                                                            {status.label}
                                                        </span>
                                                    </>
                                                )}
                                                {item.type === 'discord' && (
                                                    <>
                                                        <span>{item.date}</span>
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>tag</span>
                                                            {item.channel}
                                                        </span>
                                                    </>
                                                )}
                                                {item.type === 'email' && (
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>calendar_today</span>
                                                        {item.date}
                                                    </span>
                                                )}
                                                {item.type === 'graphic' && (
                                                    <>
                                                        <span>{item.date}</span>
                                                        <span>{item.dimensions}</span>
                                                    </>
                                                )}
                                                {item.type === 'thread' && (
                                                    <span>{item.date}</span>
                                                )}
                                                {item.type === 'blog' && (
                                                    <>
                                                        <span>{item.date}</span>
                                                        <span>{item.readTime}</span>
                                                    </>
                                                )}
                                            </div>

                                            {/* Stats (for Twitter content) */}
                                            {item.stats && (
                                                <div className="flex items-center gap-4 pt-1">
                                                    {item.stats.likes !== undefined && (
                                                        <span className="flex items-center gap-1.5 text-[13px] text-[#64748B]">
                                                            <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>favorite</span>
                                                            {formatNumber(item.stats.likes)}
                                                        </span>
                                                    )}
                                                    {item.stats.retweets !== undefined && (
                                                        <span className="flex items-center gap-1.5 text-[13px] text-[#64748B]">
                                                            <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>repeat</span>
                                                            {formatNumber(item.stats.retweets)}
                                                        </span>
                                                    )}
                                                    {item.stats.comments !== undefined && (
                                                        <span className="flex items-center gap-1.5 text-[13px] text-[#64748B]">
                                                            <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>chat_bubble</span>
                                                            {formatNumber(item.stats.comments)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
                )}
            </div>

            {/* Lightbox */}
            {viewingImage && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 p-10 backdrop-blur-sm" onClick={() => setViewingImage(null)}>
                    <img src={viewingImage} className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
                    <div className="absolute top-6 right-6 flex items-center gap-2">
                        {onNavigate && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setViewingImage(null); onNavigate('image-editor', { image: viewingImage }); }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
                            >
                                <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>edit</span>
                                Edit in Image Editor
                            </button>
                        )}
                        <button
                            onClick={() => setViewingImage(null)}
                            className="text-white/50 hover:text-white transition-colors bg-white/10 rounded-full w-10 h-10 flex items-center justify-center"
                        >
                            <span className="material-symbols-sharp" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                        </button>
                    </div>
                    <div className="absolute bottom-10 flex gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(viewingImage); }}
                            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Download High-Res
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
