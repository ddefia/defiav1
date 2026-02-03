import React, { useMemo, useState, useEffect, useRef } from 'react';
import { BrandConfig, ReferenceImage } from '../../types';
import { researchBrandIdentity, generateStyleExamples, generateWeb3Graphic } from '../../services/gemini';
import { researchGithubBrandSignals } from '../../services/githubBrandResearcher';
import { runBrandCollector } from '../../services/brandCollector';
import { retryWithBackoff } from '../../vendor/brand-collector/src/lib/retry';
import { rateLimit } from '../../vendor/brand-collector/src/lib/rate-limit';
import { createUserProfile, connectWallet, loadUserProfile, signUp, updateUserProfile, UserProfile } from '../../services/auth';

const normalizeHandle = (value: string) => value.replace(/^@/, '').trim();

const isValidHandle = (value: string) => /^[A-Za-z0-9_]{1,15}$/.test(normalizeHandle(value));

const normalizeDomain = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const compactLines = (lines: Array<string | undefined | null>) =>
  lines.map((line) => line?.trim()).filter(Boolean) as string[];

const buildCollectorVoiceGuidelines = (profile: any) => {
  const voice = profile?.voice;
  if (!voice) return '';

  return compactLines([
    voice.tone?.length ? `Tone: ${voice.tone.join(', ')}` : null,
    voice.traits?.length ? `Traits: ${voice.traits.join(', ')}` : null,
    voice.dos?.length ? `Do: ${voice.dos.join('; ')}` : null,
    voice.donts?.length ? `Don't: ${voice.donts.join('; ')}` : null,
    voice.signaturePhrases?.length ? `Signature phrases: ${voice.signaturePhrases.join(', ')}` : null,
    voice.formatPatterns?.length ? `Format patterns: ${voice.formatPatterns.join(', ')}` : null,
    voice.readingLevel ? `Reading level: ${voice.readingLevel}` : null,
  ]).join('\n');
};

const buildCollectorVisualIdentity = (profile: any) => {
  const visual = profile?.visualStyle;
  if (!visual) return '';

  const imagePrefs = visual.imagePreferences || {};
  const videoPrefs = visual.videoPreferences || {};
  return compactLines([
    imagePrefs.style ? `Image style: ${imagePrefs.style}` : null,
    imagePrefs.themes?.length ? `Image themes: ${imagePrefs.themes.join(', ')}` : null,
    imagePrefs.colorSchemes?.length ? `Image color schemes: ${imagePrefs.colorSchemes.join(', ')}` : null,
    videoPrefs.style ? `Video style: ${videoPrefs.style}` : null,
    videoPrefs.format ? `Video format: ${videoPrefs.format}` : null,
    videoPrefs.length ? `Video length: ${videoPrefs.length}` : null,
    visual.visualContentThemes?.length
      ? `Visual content themes: ${visual.visualContentThemes.map((item: any) => item.theme).filter(Boolean).join(', ')}`
      : null,
  ]).join('\n');
};

const extractCollectorTweetExamples = (profile: any) =>
  compactLines([
    ...(profile?.templates?.postTemplates || []).map((template: any) => template?.example),
    ...(profile?.templates?.replyTemplates || []).map((template: any) => template?.example),
    ...(profile?.engagementStrategies?.effectiveReplyTypes || []).map((reply: any) => reply?.example),
  ]);

const extractCollectorKnowledge = (profile: any) =>
  compactLines([
    profile?.positioning?.oneLiner ? `Positioning: ${profile.positioning.oneLiner}` : null,
    profile?.positioning?.topics?.length ? `Topics: ${profile.positioning.topics.join(', ')}` : null,
    ...(profile?.positioning?.contentPillars || []).map((pillar: any) =>
      pillar?.name ? `Content pillar: ${pillar.name}${pillar.description ? ` — ${pillar.description}` : ''}` : null
    ),
  ]);

const extractCollectorBannedPhrases = (profile: any) =>
  compactLines([
    ...(profile?.brandSafety?.redTopics || []),
  ]);

const getApiBaseUrl = () => import.meta.env.VITE_API_BASE_URL || '';

const dedupeReferenceImages = (images: ReferenceImage[]) => {
  const seen = new Set<string>();
  return images.filter((img) => {
    const key = img.url || img.data || img.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dedupeStrings = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach((item) => {
    const cleaned = item.trim();
    if (!cleaned) return;
    if (seen.has(cleaned)) return;
    seen.add(cleaned);
    result.push(cleaned);
  });
  return result;
};

const buildKnowledgeFallback = (content: string, docs: string[]) => {
  const items: string[] = [];
  const sentences = content
    .replace(/\s+/g, ' ')
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 60);

  sentences.slice(0, 8).forEach((s) => items.push(`Website: ${s}`));
  docs.slice(0, 5).forEach((doc) => items.push(`Document: ${doc}`));
  return items;
};

type OnboardingStep = 'profile' | 'company' | 'analyzing' | 'review' | 'styles';

interface EnrichedData {
  brandName: string;
  config: BrandConfig;
  sources: { domains: string[]; xHandles: string[]; youtube?: string };
}

interface OnboardingFlowProps {
  onExit: () => void;
  onComplete: (payload: EnrichedData) => void;
}

const STEPS: { id: OnboardingStep; label: string; description: string }[] = [
  { id: 'profile', label: 'Your Profile', description: 'Tell us about yourself' },
  { id: 'company', label: 'Company Details', description: 'Enter your brand info' },
  { id: 'analyzing', label: 'Auto-Configuration', description: 'Analyzing your data' },
  { id: 'review', label: 'Review & Launch', description: 'Go live' },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onExit, onComplete }) => {
  // Check if user already has a profile (skip profile step)
  const existingProfile = loadUserProfile();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(existingProfile ? 'company' : 'profile');

  // User profile state
  const [userEmail, setUserEmail] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userRole, setUserRole] = useState<UserProfile['role']>('founder');
  const [userWalletAddress, setUserWalletAddress] = useState('');
  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [wantsAccount, setWantsAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState('');

  // Company/brand state
  const [brandName, setBrandName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  const [analysisProgress, setAnalysisProgress] = useState({
    website: { status: 'pending' as 'pending' | 'loading' | 'complete', message: '' },
    twitter: { status: 'pending' as 'pending' | 'loading' | 'complete', message: '' },
    assets: { status: 'pending' as 'pending' | 'loading' | 'complete', message: '' },
  });

  const [enrichedData, setEnrichedData] = useState<EnrichedData | null>(null);

  const [styleExamples, setStyleExamples] = useState<string[]>([]);
  const [currentStyleIndex, setCurrentStyleIndex] = useState(0);
  const [approvedStyles, setApprovedStyles] = useState<string[]>([]);
  const [rejectedStyles, setRejectedStyles] = useState<string[]>([]);
  const [styleGraphics, setStyleGraphics] = useState<Record<number, {
    selectedIndex: number;
    variants: Array<{
      label: string;
      mode: 'article' | 'announcement' | 'article_image';
      image?: string;
      status: 'idle' | 'loading' | 'ready' | 'error';
      error?: string;
    }>;
  }>>({});
  const [approvedGraphics, setApprovedGraphics] = useState<ReferenceImage[]>([]);

  const normalizedDomain = useMemo(() => normalizeDomain(websiteUrl), [websiteUrl]);
  const normalizedHandle = useMemo(() => normalizeHandle(twitterHandle), [twitterHandle]);

  const isCompanyStepValid = useMemo(() => {
    return brandName.trim().length > 1 &&
           normalizedDomain &&
           isValidUrl(normalizedDomain) &&
           normalizedHandle &&
           isValidHandle(normalizedHandle);
  }, [brandName, normalizedDomain, normalizedHandle]);

  const getStepIndex = (step: OnboardingStep) => {
    const mapping: Record<OnboardingStep, number> = {
      'profile': 0,
      'company': 1,
      'analyzing': 2,
      'review': 3,
      'styles': 3, // styles is part of review now
    };
    return mapping[step];
  };

  const isGuestProfile = useMemo(() => {
    if (!existingProfile) return true;
    return existingProfile.id?.startsWith('guest-');
  }, [existingProfile]);

  const isAccountFormValid = useMemo(() => {
    const hasEmail = userEmail.trim().length > 0 && userEmail.includes('@');
    const hasPassword = accountPassword.length >= 6;
    const matches = accountPassword === accountPasswordConfirm;
    return hasEmail && hasPassword && matches;
  }, [userEmail, accountPassword, accountPasswordConfirm]);

  const isProfileStepValid = useMemo(() => {
    const hasEmail = userEmail.trim().length > 0 && userEmail.includes('@');
    const hasWallet = userWalletAddress.length > 0;
    if (wantsAccount && isGuestProfile) {
      return isAccountFormValid;
    }
    return hasEmail || hasWallet;
  }, [userEmail, userWalletAddress, wantsAccount, isAccountFormValid, isGuestProfile]);

  const handleConnectWallet = async () => {
    setIsConnectingWallet(true);
    setError('');
    try {
      const { address, error: walletError } = await connectWallet();
      if (walletError) {
        setError(walletError.message);
      } else if (address) {
        setUserWalletAddress(address);
      }
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUserAvatarUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
    }
  };

  const handleProfileContinue = async () => {
    setIsRunning(true);
    setError('');
    try {
      const { profile, error: profileError } = await createUserProfile({
        email: userEmail || undefined,
        walletAddress: userWalletAddress || undefined,
        fullName: userFullName || undefined,
        role: userRole,
        avatarUrl: userAvatarUrl || undefined,
      });

      if (profileError) {
        setError(profileError.message);
        return;
      }

      if (wantsAccount && isGuestProfile) {
        if (!isAccountFormValid) {
          setError('Please provide a valid email and matching password (6+ chars).');
          return;
        }

        const { user, error: authError } = await signUp(
          userEmail,
          accountPassword,
          { fullName: userFullName || undefined, role: userRole }
        );

        if (authError) {
          setError(authError);
          return;
        }

        if (user) {
          await updateUserProfile({
            avatarUrl: userAvatarUrl || undefined,
            walletAddress: userWalletAddress || undefined,
          });
        }
      }

      setCurrentStep('company');
    } catch (e: any) {
      setError(e?.message || 'Failed to create profile');
    } finally {
      setIsRunning(false);
    }
  };

  const runEnrichment = async () => {
    if (!rateLimit('onboarding:start')) {
      setError('Please wait a moment before starting another enrichment run.');
      return;
    }

    setIsRunning(true);
    setError('');
    setCurrentStep('analyzing');

    setAnalysisProgress({
      website: { status: 'loading', message: 'Scanning website content, products, and key messaging...' },
      twitter: { status: 'pending', message: '' },
      assets: { status: 'pending', message: '' },
    });

    try {
      const domains = [normalizedDomain];
      const xHandles = [normalizedHandle];

      const baseUrl = getApiBaseUrl();
      let crawlContent = '';
      let crawlDocs: string[] = [];
      let crawlPages: string[] = [];
      let tweetExamples: string[] = [];
      let tweetImages: ReferenceImage[] = [];

      // 1) Website crawl (real)
      try {
        const crawlRes = await fetch(`${baseUrl}/api/onboarding/crawl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedDomain })
        });

        if (!crawlRes.ok) {
          const data = await crawlRes.json().catch(() => ({}));
          throw new Error(data.error || 'Website crawl failed');
        }

        const data = await crawlRes.json();
        crawlContent = data.content || '';
        crawlDocs = Array.isArray(data.docs) ? data.docs : [];
        crawlPages = Array.isArray(data.pages) ? data.pages : [];

        setAnalysisProgress(prev => ({
          ...prev,
          website: {
            status: 'complete',
            message: crawlPages.length > 0 ? `Scanned ${crawlPages.length} pages and extracted key messaging` : 'Website scan complete'
          },
          twitter: { status: 'loading', message: 'Analyzing tweets, engagement patterns, and brand voice...' },
        }));
      } catch (crawlError: any) {
        setAnalysisProgress(prev => ({
          ...prev,
          website: { status: 'complete', message: crawlError?.message || 'Website scan skipped (no access)' },
          twitter: { status: 'loading', message: 'Analyzing tweets, engagement patterns, and brand voice...' },
        }));
      }

      let collectorProfile: any | null = null;
      let collectorMode: 'collector' | 'fallback' = 'fallback';

      try {
        const collectorResult = await retryWithBackoff(
          () =>
            runBrandCollector({
              brandName: brandName.trim(),
              domains,
              xHandles,
              youtube: undefined,
            }),
          1,
          800
        );
        collectorProfile = collectorResult.profile;
        collectorMode = collectorResult.mode;
      } catch (collectorError) {
        collectorProfile = null;
        collectorMode = 'fallback';
      }

      // 2) Twitter scrape (real)
      try {
        const twitterRes = await fetch(`${baseUrl}/api/onboarding/twitter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle: normalizedHandle, brandName: brandName.trim() })
        });

        if (!twitterRes.ok) {
          const data = await twitterRes.json().catch(() => ({}));
          throw new Error(data.error || 'Twitter scrape failed');
        }

        const data = await twitterRes.json();
        tweetExamples = Array.isArray(data.tweetExamples) ? data.tweetExamples : [];
        tweetImages = Array.isArray(data.referenceImages) ? data.referenceImages : [];

        setAnalysisProgress(prev => ({
          ...prev,
          twitter: {
            status: 'complete',
            message: tweetExamples.length > 0
              ? `Collected ${tweetExamples.length} tweet examples`
              : 'Twitter scan complete (no examples found)'
          },
          assets: { status: 'loading', message: 'Extracting logos, images, and visual identity...' },
        }));
      } catch (twitterError: any) {
        setAnalysisProgress(prev => ({
          ...prev,
          twitter: { status: 'complete', message: twitterError?.message || 'Twitter scan skipped (no access)' },
          assets: { status: 'loading', message: 'Extracting logos, images, and visual identity...' },
        }));
      }

      let researchResult: BrandConfig = { colors: [], knowledgeBase: [], tweetExamples: [], referenceImages: [] };
      try {
        researchResult = await retryWithBackoff(
          () => researchBrandIdentity(brandName.trim(), normalizedDomain, {
            siteContent: crawlContent,
            tweetExamples,
            docUrls: crawlDocs,
          }),
          2,
          1200
        );
      } catch (e) {
        researchResult = {
          colors: [],
          knowledgeBase: buildKnowledgeFallback(crawlContent, crawlDocs),
          tweetExamples,
          referenceImages: [],
        };
      }

      const githubSignals = await researchGithubBrandSignals(brandName.trim());

      setAnalysisProgress(prev => ({
        ...prev,
        assets: { status: 'complete', message: 'Collected brand assets and visual identity' },
      }));

      const sourcesSummary = [
        `Domains: ${domains.join(', ')}`,
        `X handles: ${xHandles.map((handle) => `@${handle}`).join(', ')}`,
      ].filter(Boolean) as string[];

      const collectorTweetExamples = extractCollectorTweetExamples(collectorProfile);
      const collectorKnowledge = extractCollectorKnowledge(collectorProfile);
      const collectorVoice = buildCollectorVoiceGuidelines(collectorProfile);
      const collectorVisualIdentity = buildCollectorVisualIdentity(collectorProfile);
      const collectorBannedPhrases = extractCollectorBannedPhrases(collectorProfile);

      const combinedVoiceGuidelines = compactLines([
        researchResult.voiceGuidelines,
        collectorVoice,
      ]).join('\n');

      const combinedVisualIdentity = compactLines([
        researchResult.visualIdentity,
        collectorVisualIdentity,
      ]).join('\n');

      const baseKnowledge = (researchResult.knowledgeBase && researchResult.knowledgeBase.length > 0)
        ? researchResult.knowledgeBase
        : buildKnowledgeFallback(crawlContent, crawlDocs);

      const baseTweetExamples = tweetExamples.length > 0
        ? tweetExamples
        : (researchResult.tweetExamples || []);

      const combinedReferenceImages = dedupeReferenceImages([
        ...(researchResult.referenceImages || []),
        ...tweetImages
      ]);

      const enriched: BrandConfig = {
        colors: researchResult.colors || [],
        knowledgeBase: [
          ...baseKnowledge,
          ...collectorKnowledge,
          ...crawlDocs.map((doc) => `Document: ${doc}`),
          ...sourcesSummary,
          ...githubSignals,
        ],
        tweetExamples: [
          ...baseTweetExamples,
          ...collectorTweetExamples,
        ],
        referenceImages: combinedReferenceImages,
        brandCollectorProfile: collectorProfile || undefined,
        voiceGuidelines: combinedVoiceGuidelines || undefined,
        targetAudience: researchResult.targetAudience,
        bannedPhrases: [
          ...(researchResult.bannedPhrases || []),
          ...collectorBannedPhrases,
        ],
        visualIdentity: combinedVisualIdentity || undefined,
        graphicTemplates: researchResult.graphicTemplates,
      };

      if (collectorMode === 'collector' && collectorProfile) {
        const summary = collectorProfile?.positioning?.oneLiner || collectorProfile?.positioning?.topics?.join(', ');
        if (summary) {
          enriched.knowledgeBase = [...enriched.knowledgeBase, `Collector profile: ${summary}`];
        }
      }

      // Generate carousel content examples (AI) after enrichment
      let generatedExamples: string[] = [];
      try {
        generatedExamples = await generateStyleExamples(brandName.trim(), enriched, 10);
      } catch (e) {
        generatedExamples = [];
      }

      const combinedExamples = dedupeStrings([
        ...(enriched.tweetExamples || []),
        ...generatedExamples
      ]);

      const data: EnrichedData = {
        brandName: brandName.trim(),
        config: enriched,
        sources: {
          domains,
          xHandles,
          youtube: undefined,
        },
      };

      setEnrichedData(data);
      setStyleExamples(combinedExamples);

      await new Promise(resolve => setTimeout(resolve, 800));
      setCurrentStep('review');
    } catch (err: any) {
      setError(err?.message || 'Enrichment failed. Please try again.');
      setCurrentStep('company');
    } finally {
      setIsRunning(false);
    }
  };

  const handleApproveStyle = () => {
    if (styleExamples[currentStyleIndex]) {
      setApprovedStyles(prev => [...prev, styleExamples[currentStyleIndex]]);
    }
    const graphicEntry = styleGraphics[currentStyleIndex];
    const selectedVariant = graphicEntry?.variants?.[graphicEntry.selectedIndex || 0];
    if (selectedVariant?.image) {
      const id = `carousel-${currentStyleIndex}-${graphicEntry?.selectedIndex || 0}`;
      setApprovedGraphics(prev => {
        if (prev.some(img => img.id === id)) return prev;
        return [
          ...prev,
          {
            id,
            name: `Carousel ${currentStyleIndex + 1}`,
            data: selectedVariant.image,
            category: 'Carousel'
          }
        ];
      });

      // Upload to Supabase storage in background
      uploadCarouselGraphic(selectedVariant.image, id).catch(() => {});
    }
    if (currentStyleIndex < styleExamples.length - 1) {
      setCurrentStyleIndex(prev => prev + 1);
    }
  };

  const handleRejectStyle = () => {
    if (styleExamples[currentStyleIndex]) {
      setRejectedStyles(prev => [...prev, styleExamples[currentStyleIndex]]);
    }
    if (currentStyleIndex < styleExamples.length - 1) {
      setCurrentStyleIndex(prev => prev + 1);
    }
  };

  const handleLaunch = () => {
    if (enrichedData) {
      const mergedReferenceImages = dedupeReferenceImages([
        ...(enrichedData.config.referenceImages || []),
        ...approvedGraphics
      ]);
      const finalConfig = {
        ...enrichedData.config,
        tweetExamples: approvedStyles.length > 0 ? approvedStyles : enrichedData.config.tweetExamples,
        approvedStyleExamples: approvedStyles,
        rejectedStyleExamples: rejectedStyles,
        referenceImages: mergedReferenceImages,
      };
      onComplete({
        ...enrichedData,
        config: finalConfig,
      });
    }
  };

  const uploadCarouselGraphic = async (imageData: string, imageId: string) => {
    const baseUrl = getApiBaseUrl();
    if (!imageData) return;

    try {
      const response = await fetch(`${baseUrl}/api/onboarding/carousel-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: brandName.trim(),
          imageData,
          imageId
        })
      });

      if (!response.ok) return;
      const data = await response.json();
      if (!data?.publicUrl) return;

      setApprovedGraphics(prev =>
        prev.map(img =>
          img.id === imageId
            ? { ...img, url: data.publicUrl, data: '' }
            : img
        )
      );
    } catch (e) {
      // Non-blocking
    }
  };

  const extractTitleAndBody = (text: string) => {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const parts = cleaned.split(/[.!?]/).map(p => p.trim()).filter(Boolean);
    const title = parts[0] ? parts[0].slice(0, 90) : cleaned.slice(0, 90);
    const body = parts.slice(1).join('. ').trim() || cleaned.slice(title.length).trim();
    return { title, body };
  };

  const pickTemplateMode = (text: string, config: BrandConfig) => {
    const hasImage = (config.referenceImages || []).some(img => img.url || img.data);
    const looksLikeArticle = /http|read|blog|article|report|thread|guide|docs/i.test(text);
    if (looksLikeArticle && hasImage) return 'article_image';
    if (looksLikeArticle) return 'article';
    return 'announcement';
  };

  const buildGraphicPrompt = (text: string, mode: 'article' | 'announcement' | 'article_image', config: BrandConfig) => {
    const { title, body } = extractTitleAndBody(text);
    const brandColor = config.colors?.[0]?.hex || '#FF5C00';
    if (mode === 'article_image') {
      return `Create a premium article card overlay on a branded background image. Use the reference image as a textured backdrop, then overlay a clean text panel. Headline: "${title}". Body: "${body}". Use brand color ${brandColor} for accents. High-contrast, editorial typography.`;
    }
    if (mode === 'article') {
      return `Create a clean editorial article card. Headline: "${title}". Body: "${body}". Use brand color ${brandColor} for accents. Minimal, high-contrast, legible typography.`;
    }
    return `Create a bold announcement card. Headline: "${title}". Supporting text: "${body}". Use brand color ${brandColor}. High-impact layout, clean typography, strong hierarchy.`;
  };

  const getVariantConfigs = (text: string, config: BrandConfig) => {
    const defaultMode = pickTemplateMode(text, config);
    if (defaultMode === 'article_image') {
      return [
        { label: 'Article + Image', mode: 'article_image' as const },
        { label: 'Announcement', mode: 'announcement' as const }
      ];
    }
    if (defaultMode === 'article') {
      return [
        { label: 'Article', mode: 'article' as const },
        { label: 'Announcement', mode: 'announcement' as const }
      ];
    }
    return [
      { label: 'Announcement', mode: 'announcement' as const },
      { label: 'Article', mode: 'article' as const }
    ];
  };

  const pickReferenceImageId = (config: BrandConfig) => {
    const candidates = (config.referenceImages || []).filter(img => img.id && (img.url || img.data));
    if (candidates.length === 0) return undefined;
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  };

  const ensureVariant = async (index: number, variantIndex: number) => {
    if (!enrichedData?.config || !styleExamples[index]) return;
    const exampleText = styleExamples[index];
    const variants = getVariantConfigs(exampleText, enrichedData.config);
    setStyleGraphics(prev => {
      const existing = prev[index];
      if (existing && existing.variants[variantIndex]?.status === 'ready') return prev;
      const nextVariants = variants.map((variant, i) => {
        const previousVariant = existing?.variants?.[i];
        if (previousVariant) return previousVariant;
        return { ...variant, status: 'idle' as const };
      });
      nextVariants[variantIndex] = { ...nextVariants[variantIndex], status: 'loading' };
      return {
        ...prev,
        [index]: {
          selectedIndex: existing?.selectedIndex ?? 0,
          variants: nextVariants
        }
      };
    });

    try {
      const variant = variants[variantIndex];
      const artPrompt = buildGraphicPrompt(exampleText, variant.mode, enrichedData.config);
      const referenceId = variant.mode === 'article_image'
        ? pickReferenceImageId(enrichedData.config)
        : undefined;
      const selectedReferenceImages = referenceId ? [referenceId] : [];

      const image = await generateWeb3Graphic({
        prompt: exampleText,
        artPrompt,
        size: '1K',
        aspectRatio: '1:1',
        brandConfig: enrichedData.config,
        brandName: brandName.trim(),
        selectedReferenceImages
      });

      setStyleGraphics(prev => {
        const existing = prev[index];
        if (!existing) return prev;
        const updatedVariants = [...existing.variants];
        updatedVariants[variantIndex] = { ...updatedVariants[variantIndex], image, status: 'ready' };
        return {
          ...prev,
          [index]: { ...existing, variants: updatedVariants }
        };
      });
    } catch (e: any) {
      setStyleGraphics(prev => {
        const existing = prev[index];
        if (!existing) return prev;
        const updatedVariants = [...existing.variants];
        updatedVariants[variantIndex] = { ...updatedVariants[variantIndex], status: 'error', error: e?.message || 'Generation failed' };
        return {
          ...prev,
          [index]: { ...existing, variants: updatedVariants }
        };
      });
    }
  };

  useEffect(() => {
    if (currentStep !== 'styles') return;
    if (!styleExamples[currentStyleIndex]) return;
    ensureVariant(currentStyleIndex, 0);
  }, [currentStep, currentStyleIndex, styleExamples, enrichedData]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (currentStep !== 'styles') return;
      if (e.key === 'ArrowLeft' || e.key === 'x' || e.key === 'X') {
        handleRejectStyle();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleApproveStyle();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentStep, currentStyleIndex, styleExamples]);

  const renderLeftPanel = () => {
    const stepIndex = getStepIndex(currentStep);
    const titles: Record<OnboardingStep, string> = {
      profile: "Tell us about yourself",
      company: "Let's set up your AI CMO",
      analyzing: "Analyzing your company",
      review: "Review your AI CMO",
      styles: "Train your AI CMO",
    };
    const descriptions: Record<OnboardingStep, string> = {
      profile: "Help us personalize your experience. This info will be used to customize your AI CMO.",
      company: "Tell us about your project and we'll configure your marketing assistant to match your brand perfectly.",
      analyzing: "We're gathering information from your website and social profiles to configure your AI CMO.",
      review: "We've configured your AI CMO based on your company data. Review and customize before launching.",
      styles: "Help us understand your content preferences. Approve styles you like, reject ones that don't fit your brand.",
    };

    return (
      <div
        className="w-[480px] min-h-screen flex flex-col justify-between p-12"
        style={{ background: 'linear-gradient(180deg, #1A0A00 0%, #0A0A0B 100%)' }}
      >
        <div className="space-y-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#FF7A2E] to-[#FF5C00] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-mono text-xl tracking-wider">Defia</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-white text-4xl font-serif tracking-tight" style={{ fontFamily: 'Instrument Serif, serif' }}>
              {titles[currentStep]}
            </h1>
            <p className="text-[#9CA3AF] text-base leading-relaxed max-w-[380px]">
              {descriptions[currentStep]}
            </p>
          </div>

          <div className="space-y-0">
            {STEPS.slice(0, -1).map((step, index) => (
              <div key={step.id + index}>
                <div className="flex items-center gap-4 py-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < stepIndex ? 'bg-[#FF5C00] text-white' :
                    index === stepIndex ? 'bg-[#FF5C00] text-white' :
                    'bg-[#1F1F23] text-[#6B6B70]'
                  }`}>
                    {index < stepIndex ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${index <= stepIndex ? 'text-white' : 'text-[#6B6B70]'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-[#6B6B70]">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 2 && (
                  <div className={`w-0.5 h-6 ml-4 ${index < stepIndex ? 'bg-[#FF5C00]' : 'bg-[#2A2A2E]'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#6B6B70] text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Your data is encrypted and secure</span>
        </div>
      </div>
    );
  };

  const renderProfileStep = () => {
    const roles: { id: UserProfile['role']; label: string; icon: string }[] = [
      { id: 'founder', label: 'Founder / CEO', icon: 'briefcase' },
      { id: 'marketing', label: 'Marketing', icon: 'megaphone' },
      { id: 'community', label: 'Community', icon: 'users' },
      { id: 'developer', label: 'Developer', icon: 'code' },
    ];

    return (
      <div className="flex-1 flex flex-col justify-center px-24 py-20">
        <div className="max-w-[500px] space-y-10">
          <div className="space-y-2">
            <h2 className="text-white text-[32px] font-semibold">Your Profile</h2>
            <p className="text-[#8E8E93] text-base">This helps us personalize content recommendations for you</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div
              className="w-[100px] h-[100px] rounded-full bg-[#111113] border-2 border-[#2A2A2E] flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={() => avatarInputRef.current?.click()}
            >
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-10 h-10 text-[#6B6B70]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-white text-base font-semibold">Profile Photo</p>
              <p className="text-[#6B6B70] text-sm">Upload a photo or we'll use your initials</p>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-[#1F1F23] rounded-lg px-4 py-2 text-white text-[13px] font-medium hover:bg-[#2A2A2E] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          </div>

          <div className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Email Address</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full h-[52px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#2A2A2E]"></div>
              <span className="text-[#6B6B70] text-sm">or</span>
              <div className="flex-1 h-px bg-[#2A2A2E]"></div>
            </div>

            {/* Connect Wallet Button */}
            <button
              onClick={handleConnectWallet}
              disabled={isConnectingWallet}
              className="w-full h-[52px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 flex items-center justify-center gap-3 text-white hover:border-[#FF5C00] focus:border-[#FF5C00] transition-colors disabled:opacity-50"
            >
              {isConnectingWallet ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="font-medium">
                    {userWalletAddress ? `${userWalletAddress.slice(0, 6)}...${userWalletAddress.slice(-4)}` : 'Connect Wallet'}
                  </span>
                  {userWalletAddress && (
                    <svg className="w-4 h-4 text-green-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </>
              )}
            </button>

            {/* Full Name Field */}
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Full Name</label>
              <input
                type="text"
                value={userFullName}
                onChange={(e) => setUserFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full h-[52px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Your Role</label>
              <div className="grid grid-cols-4 gap-3">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setUserRole(role.id)}
                    className={`flex flex-col items-center gap-1 p-4 rounded-xl border transition-colors ${
                      userRole === role.id
                        ? 'bg-[#FF5C00]/10 border-[#FF5C00] text-[#FF5C00]'
                        : 'bg-[#111113] border-[#2A2A2E] text-white hover:border-[#3A3A3E]'
                    }`}
                  >
                    {role.icon === 'briefcase' && (
                      <svg className={`w-6 h-6 ${userRole === role.id ? 'text-[#FF5C00]' : 'text-[#6B6B70]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                    {role.icon === 'megaphone' && (
                      <svg className={`w-6 h-6 ${userRole === role.id ? 'text-[#FF5C00]' : 'text-[#6B6B70]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    )}
                    {role.icon === 'users' && (
                      <svg className={`w-6 h-6 ${userRole === role.id ? 'text-[#FF5C00]' : 'text-[#6B6B70]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    )}
                    {role.icon === 'code' && (
                      <svg className={`w-6 h-6 ${userRole === role.id ? 'text-[#FF5C00]' : 'text-[#6B6B70]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    )}
                    <span className={`text-[13px] font-medium ${userRole === role.id ? 'text-[#FF5C00]' : 'text-white'}`}>
                      {role.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Create Account (Optional) */}
            {isGuestProfile ? (
              <div className="rounded-xl border border-[#2A2A2E] bg-[#111113] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">Create account (optional)</p>
                    <p className="text-[#6B6B70] text-xs">Save your setup and access it from any device.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWantsAccount(prev => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      wantsAccount ? 'bg-[#FF5C00] text-white' : 'bg-[#1F1F23] text-[#8E8E93]'
                    }`}
                  >
                    {wantsAccount ? 'Enabled' : 'Enable'}
                  </button>
                </div>

                {wantsAccount && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-white text-xs font-medium">Password</label>
                      <input
                        type="password"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        placeholder="Create a password (6+ chars)"
                        className="w-full h-[46px] rounded-lg bg-[#0A0A0B] border border-[#2A2A2E] px-3 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-white text-xs font-medium">Confirm Password</label>
                      <input
                        type="password"
                        value={accountPasswordConfirm}
                        onChange={(e) => setAccountPasswordConfirm(e.target.value)}
                        placeholder="Re-enter your password"
                        className="w-full h-[46px] rounded-lg bg-[#0A0A0B] border border-[#2A2A2E] px-3 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                      />
                    </div>
                    {!isAccountFormValid && accountPassword.length > 0 && (
                      <p className="text-xs text-[#F59E0B]">Passwords must match and be at least 6 characters.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-[#2A2A2E] bg-[#111113] px-4 py-3">
                <p className="text-[#6B6B70] text-xs">You’re already signed in. This profile will sync automatically.</p>
              </div>
            )}
          </div>

          <button
            onClick={handleProfileContinue}
            disabled={!isProfileStepValid || isRunning}
            className="w-full h-14 rounded-xl bg-[#FF5C00] hover:bg-[#FF6B1A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white font-semibold transition-colors"
          >
            {isRunning ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <span>{wantsAccount && isGuestProfile ? 'Create Account & Continue' : 'Continue'}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderCompanyStep = () => (
    <div className="flex-1 flex flex-col justify-center px-24 py-20">
      <div className="max-w-[500px] space-y-10">
        <div className="space-y-2">
          <h2 className="text-white text-3xl font-semibold">Company Details</h2>
          <p className="text-[#8E8E93] text-base">Tell us about your company so we can personalize your AI CMO</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-white text-sm font-medium">Company Name</label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Enter your company name"
              className="w-full h-[52px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-white text-sm font-medium">Website URL</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6B70]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourcompany.com"
                className="w-full h-[52px] rounded-xl bg-[#111113] border border-[#2A2A2E] pl-12 pr-4 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-white text-sm font-medium">Twitter / X Handle</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6B70]">
                <span className="text-base">@</span>
              </div>
              <input
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                placeholder="yourhandle"
                className="w-full h-[52px] rounded-xl bg-[#111113] border border-[#2A2A2E] pl-10 pr-4 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={runEnrichment}
            disabled={!isCompanyStepValid || isRunning}
            className="w-full h-14 rounded-xl bg-[#FF5C00] hover:bg-[#FF6B1A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white font-semibold transition-colors"
          >
            <span>Continue</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
          <p className="text-center text-[#6B6B70] text-sm">
            We'll use this information to automatically configure your AI CMO
          </p>
        </div>
      </div>
    </div>
  );

  const renderAnalyzingStep = () => (
    <div className="flex-1 flex flex-col items-center justify-center px-24 py-20">
      <div className="space-y-12 text-center">
        <div className="space-y-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FF8C4A] flex items-center justify-center mx-auto">
            <svg className="w-9 h-9 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-white text-2xl font-semibold">Analyzing Your Company</h2>
            <p className="text-[#8E8E93] text-base">This usually takes about 30 seconds</p>
          </div>
        </div>

        <div className="w-[400px] space-y-4">
          <div className={`rounded-xl bg-[#111113] border p-4 flex items-center gap-3 ${
            analysisProgress.website.status === 'loading' ? 'border-[#FF5C00]' : 'border-[#2A2A2E]'
          } ${analysisProgress.assets.status === 'pending' && analysisProgress.website.status === 'pending' ? 'opacity-50' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              analysisProgress.website.status === 'complete' ? 'bg-[#1A3D1A]' : 'bg-[#1A1208]'
            }`}>
              {analysisProgress.website.status === 'complete' ? (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[#FF5C00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-white text-sm font-medium">Website Content</p>
              <p className="text-[#8E8E93] text-xs">
                {analysisProgress.website.message || 'Scanning website content, products, and key messaging...'}
              </p>
            </div>
          </div>

          <div className={`rounded-xl bg-[#111113] border p-4 flex items-center gap-3 ${
            analysisProgress.twitter.status === 'loading' ? 'border-[#FF5C00]' : 'border-[#2A2A2E]'
          } ${analysisProgress.twitter.status === 'pending' ? 'opacity-50' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              analysisProgress.twitter.status === 'complete' ? 'bg-[#1A3D1A]' : 'bg-[#1A1208]'
            }`}>
              {analysisProgress.twitter.status === 'complete' ? (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[#FF5C00]" fill="none" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-white text-sm font-medium">Twitter Profile</p>
              <p className="text-[#8E8E93] text-xs">
                {analysisProgress.twitter.message || 'Analyzing tweets, engagement patterns, and brand voice...'}
              </p>
            </div>
          </div>

          <div className={`rounded-xl bg-[#111113] border p-4 flex items-center gap-3 ${
            analysisProgress.assets.status === 'loading' ? 'border-[#FF5C00]' : 'border-[#2A2A2E]'
          } ${analysisProgress.assets.status === 'pending' ? 'opacity-50' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              analysisProgress.assets.status === 'complete' ? 'bg-[#1A3D1A]' : 'bg-[#1F1F23]'
            }`}>
              {analysisProgress.assets.status === 'complete' ? (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-[#6B6B70]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-white text-sm font-medium">Brand Assets</p>
              <p className="text-[#8E8E93] text-xs">
                {analysisProgress.assets.message || 'Extracting logos, images, and visual identity...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="flex-1 overflow-y-auto px-16 py-12">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-2xl font-semibold">Your Company Profile</h2>
          <button className="px-4 py-2.5 rounded-lg bg-[#1F1F23] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#2A2A2E] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5C00] to-[#FF8C4A] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Company Information</p>
                <p className="text-[#8E8E93] text-sm">Basic details about your company</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[#6B6B70]">Company Name</p>
                <p className="text-white">{enrichedData?.brandName}</p>
              </div>
              <div>
                <p className="text-[#6B6B70]">Industry</p>
                <p className="text-white">{enrichedData?.config.targetAudience?.split(',')[0] || 'Technology'}</p>
              </div>
              <div>
                <p className="text-[#6B6B70]">Website</p>
                <p className="text-[#FF5C00]">{enrichedData?.sources.domains[0]}</p>
              </div>
              <div>
                <p className="text-[#6B6B70]">Twitter</p>
                <p className="text-[#FF5C00]">@{enrichedData?.sources.xHandles[0]}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">Brand Voice</p>
                <p className="text-[#8E8E93] text-sm">Your unique communication style</p>
              </div>
            </div>
            <p className="text-[#9CA3AF] text-sm leading-relaxed">
              {enrichedData?.config.voiceGuidelines?.slice(0, 300) || 'Professional yet approachable, with a focus on technical credibility and community-first messaging. Clear explanations of complex DeFi concepts.'}
              {(enrichedData?.config.voiceGuidelines?.length || 0) > 300 && '...'}
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-[#1F1F23] text-[#FF5C00] text-xs font-medium">Professional</span>
              <span className="px-3 py-1 rounded-full bg-[#1F1F23] text-[#FF5C00] text-xs font-medium">Technical</span>
              <span className="px-3 py-1 rounded-full bg-[#1F1F23] text-[#FF5C00] text-xs font-medium">Community-Focused</span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-medium">Knowledge Base</p>
                  <p className="text-[#8E8E93] text-sm">{enrichedData?.config.knowledgeBase?.length || 0} items collected</p>
                </div>
              </div>
              <button className="text-[#FF5C00] text-sm font-medium hover:underline">+ Add</button>
            </div>
            <div className="space-y-2">
              {enrichedData?.config.knowledgeBase?.slice(0, 3).map((item, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <svg className="w-4 h-4 text-[#FF5C00] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[#9CA3AF]">{item.slice(0, 80)}{item.length > 80 && '...'}</span>
                </div>
              ))}
              {(enrichedData?.config.knowledgeBase?.length || 0) > 3 && (
                <p className="text-[#FF5C00] text-sm cursor-pointer hover:underline">
                  View all {enrichedData?.config.knowledgeBase?.length} items →
                </p>
              )}
            </div>
          </div>

          {enrichedData?.config.referenceImages && enrichedData.config.referenceImages.length > 0 && (
            <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Reference Images</p>
                    <p className="text-[#8E8E93] text-sm">{enrichedData.config.referenceImages.length} images found</p>
                  </div>
                </div>
                <button className="text-[#FF5C00] text-sm font-medium hover:underline">+ Add</button>
              </div>
              <div className="flex gap-3">
                {enrichedData.config.referenceImages.slice(0, 4).map((img, index) => (
                  <div key={img.id || index} className="w-20 h-20 rounded-xl bg-[#1F1F23] overflow-hidden">
                    <img src={img.url || img.data} alt={img.name || ''} className="w-full h-full object-cover" onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }} />
                  </div>
                ))}
                {enrichedData.config.referenceImages.length > 4 && (
                  <div className="w-20 h-20 rounded-xl bg-[#1F1F23] flex items-center justify-center">
                    <span className="text-[#6B6B70] text-sm">+{enrichedData.config.referenceImages.length - 4}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button
            onClick={() => setCurrentStep('company')}
            className="px-6 py-3.5 rounded-xl bg-[#1F1F23] text-white font-medium flex items-center gap-2 hover:bg-[#2A2A2E] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <button
            onClick={() => setCurrentStep('styles')}
            className="px-8 py-3.5 rounded-xl bg-[#FF5C00] hover:bg-[#FF6B1A] text-white font-semibold flex items-center gap-2 transition-colors"
          >
            <span>Continue to Styles</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  const renderStylesStep = () => {
    const currentExample = styleExamples[currentStyleIndex];
    const totalExamples = styleExamples.length;
    const graphicEntry = styleGraphics[currentStyleIndex];
    const selectedVariantIndex = graphicEntry?.selectedIndex ?? 0;
    const selectedVariant = graphicEntry?.variants?.[selectedVariantIndex];
    const variantLabel = selectedVariant?.mode === 'article_image'
      ? 'article + image'
      : selectedVariant?.mode;
    const fallbackVariants = enrichedData?.config && currentExample
      ? getVariantConfigs(currentExample, enrichedData.config)
      : [];
    const variantButtons = graphicEntry?.variants && graphicEntry.variants.length > 0
      ? graphicEntry.variants
      : fallbackVariants;

    return (
      <div className="flex-1 flex flex-col px-16 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-white text-2xl font-semibold">Content Style Examples</h2>
            <p className="text-[#8E8E93] text-sm mt-1">Swipe through examples from your content. Approve or reject to train your AI.</p>
          </div>
          <div className="px-4 py-2 rounded-full bg-[#1F1F23] text-white text-sm font-medium">
            {currentStyleIndex + 1} of {totalExamples || '...'}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center gap-6">
          <button
            onClick={() => setCurrentStyleIndex(prev => Math.max(0, prev - 1))}
            disabled={currentStyleIndex === 0}
            className="w-12 h-12 rounded-full bg-[#1F1F23] flex items-center justify-center text-white hover:bg-[#2A2A2E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="w-[540px] space-y-6">
            <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2A2A2E]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FF8C4A] flex items-center justify-center text-white font-bold">
                    {enrichedData?.brandName?.charAt(0) || 'D'}
                  </div>
                  <div>
                    <p className="text-white font-medium">{enrichedData?.brandName || 'Your Brand'}</p>
                    <p className="text-[#6B6B70] text-sm">@{enrichedData?.sources.xHandles[0] || 'handle'}</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <p className="text-white text-base leading-relaxed whitespace-pre-wrap">
                  {currentExample || 'No style examples available. You can skip this step.'}
                </p>
              </div>
              <div className="px-5 py-3 border-t border-[#2A2A2E] flex items-center gap-6 text-[#6B6B70] text-sm">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  24
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  156
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  89
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-[#0F0F12] border border-[#2A2A2E] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#FF5C00]">Graphic Preview</span>
                  {variantLabel && (
                    <span className="text-[10px] uppercase tracking-widest text-[#6B6B70]">
                      {variantLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => ensureVariant(currentStyleIndex, selectedVariantIndex)}
                    className="text-[10px] text-[#8E8E93] hover:text-white"
                  >
                    Regenerate
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                {(variantButtons.length > 0 ? variantButtons : [
                  { label: 'Variant A' },
                  { label: 'Variant B' }
                ]).map((variant, idx) => (
                  <button
                    key={`${currentStyleIndex}-variant-${idx}`}
                    onClick={() => {
                      setStyleGraphics(prev => {
                        const existing = prev[currentStyleIndex];
                        if (!existing) return prev;
                        return {
                          ...prev,
                          [currentStyleIndex]: {
                            ...existing,
                            selectedIndex: idx
                          }
                        };
                      });
                      ensureVariant(currentStyleIndex, idx);
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                      (selectedVariantIndex === idx)
                        ? 'bg-[#FF5C00] text-white'
                        : 'bg-[#1F1F23] text-[#8E8E93] hover:text-white'
                    }`}
                  >
                    {variant.label || `Variant ${idx + 1}`}
                  </button>
                ))}
              </div>

              <div className="rounded-xl overflow-hidden border border-[#1F1F23] bg-[#0A0A0B] h-[240px] flex items-center justify-center">
                {selectedVariant?.image ? (
                  <img
                    src={selectedVariant.image}
                    alt="Graphic preview"
                    className="w-full h-full object-cover"
                  />
                ) : selectedVariant?.status === 'error' ? (
                  <div className="text-[#EF4444] text-xs text-center px-6">
                    {selectedVariant.error || 'Failed to generate graphic.'}
                  </div>
                ) : (
                  <div className="text-[#6B6B70] text-xs">
                    {selectedVariant?.status === 'loading' ? 'Generating preview...' : 'Graphic preview will appear here'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleRejectStyle}
                disabled={!currentExample}
                className="px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium flex items-center gap-2 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Not My Style
              </button>
              <button
                onClick={handleApproveStyle}
                disabled={!currentExample}
                className="px-6 py-3 rounded-xl bg-green-500 text-white font-medium flex items-center gap-2 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                This is Me
              </button>
            </div>
          </div>

          <button
            onClick={() => setCurrentStyleIndex(prev => Math.min(totalExamples - 1, prev + 1))}
            disabled={currentStyleIndex >= totalExamples - 1}
            className="w-12 h-12 rounded-full bg-[#1F1F23] flex items-center justify-center text-white hover:bg-[#2A2A2E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center justify-between mt-8">
          <div className="flex items-center gap-6 text-[#6B6B70] text-sm">
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-[#1F1F23] text-xs">←</kbd> Previous
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-[#1F1F23] text-xs">→</kbd> Next
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-[#1F1F23] text-xs">Enter</kbd> Approve
            </span>
          </div>
          <button
            onClick={handleLaunch}
            className="px-5 py-3 rounded-lg bg-[#1F1F23] text-[#8E8E93] font-medium flex items-center gap-2 hover:bg-[#2A2A2E] hover:text-white transition-colors"
          >
            {styleExamples.length === 0 || currentStyleIndex >= styleExamples.length - 1 ? 'Launch AI CMO' : 'Skip for Now'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex">
      {renderLeftPanel()}
      {currentStep === 'profile' && renderProfileStep()}
      {currentStep === 'company' && renderCompanyStep()}
      {currentStep === 'analyzing' && renderAnalyzingStep()}
      {currentStep === 'review' && renderReviewStep()}
      {currentStep === 'styles' && renderStylesStep()}
    </div>
  );
};
