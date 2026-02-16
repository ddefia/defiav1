import React, { useMemo, useState, useEffect, useRef } from 'react';
import { BrandConfig, ReferenceImage } from '../../types';
import { researchBrandIdentity, generateStyleExamples, generateWeb3Graphic } from '../../services/gemini';
import { researchGithubBrandSignals } from '../../services/githubBrandResearcher';
import { runBrandCollector } from '../../services/brandCollector';
import { retryWithBackoff } from '../../vendor/brand-collector/src/lib/retry';
import { rateLimit } from '../../vendor/brand-collector/src/lib/rate-limit';
import { createUserProfile, connectWallet, loadUserProfile, signUp, updateUserProfile, UserProfile, getAuthToken } from '../../services/auth';
import { loadIntegrationKeys, saveIntegrationKeys } from '../../services/storage';
import { createDefaultSubscription } from '../../services/subscription';

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
  // Check if user already has a profile (skip profile step) - only on initial mount
  const existingProfileRef = useRef(loadUserProfile());
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(() =>
    existingProfileRef.current ? 'company' : 'profile'
  );

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
  const [xConnectStatus, setXConnectStatus] = useState<{ connected: boolean; username?: string | null } | null>(null);
  const [xConnectError, setXConnectError] = useState('');
  const [xConnectLoading, setXConnectLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  // Competitor state
  const [competitors, setCompetitors] = useState<Array<{ name: string; handle: string }>>([]);

  // Blockchain config state
  const [contracts, setContracts] = useState<Array<{ address: string; type: string; label: string; chain: string }>>([]);
  const [duneApiKey, setDuneApiKey] = useState('');

  const [analysisProgress, setAnalysisProgress] = useState({
    website: { status: 'pending' as 'pending' | 'loading' | 'complete', message: '' },
    twitter: { status: 'pending' as 'pending' | 'loading' | 'complete', message: '' },
    assets: { status: 'pending' as 'pending' | 'loading' | 'complete', message: '' },
  });

  const [enrichedData, setEnrichedData] = useState<EnrichedData | null>(null);

  // Brand Kit state
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    const profile = existingProfileRef.current;
    if (!profile) return true;
    return profile.id?.startsWith('guest-');
  }, []);

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

  useEffect(() => {
    let active = true;
    const fetchXStatus = async () => {
      const brandKey = brandName.trim();
      if (!brandKey) return;
      try {
        const baseUrl = getApiBaseUrl();
        const response = await fetch(`${baseUrl}/api/auth/x/status?brandId=${encodeURIComponent(brandKey)}`);
        if (!response.ok) return;
        const data = await response.json();
        if (active) setXConnectStatus(data);
      } catch {
        if (active) setXConnectStatus(null);
      }
    };
    fetchXStatus();
    return () => { active = false; };
  }, [brandName]);

  const handleConnectX = async () => {
    setXConnectError('');
    setXConnectLoading(true);
    try {
      const brandKey = brandName.trim();
      if (!brandKey) {
        setXConnectError('Enter your company name first.');
        return;
      }
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/x/authorize-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: brandKey })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        setXConnectError(data?.error || 'Failed to start X connection.');
        return;
      }
      window.location.href = data.url;
    } catch (e: any) {
      setXConnectError(e?.message || 'Failed to start X connection.');
    } finally {
      setXConnectLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    setIsConnectingWallet(true);
    setError('');
    try {
      const { address, error: walletError } = await connectWallet();
      if (walletError) {
        setError(walletError);
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
        setError(profileError);
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
      const authToken = await getAuthToken();
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      };
      let crawlContent = '';
      let crawlDocs: string[] = [];
      let crawlPages: string[] = [];
      let crawlImages: ReferenceImage[] = [];
      let tweetExamples: string[] = [];
      let tweetImages: ReferenceImage[] = [];

      // 1) Website deep crawl (Apify-powered for comprehensive extraction)
      let knowledgeBaseFromCrawl: string[] = [];
      let defiMetrics: any = null;

      try {
        setAnalysisProgress(prev => ({
          ...prev,
          website: { status: 'loading', message: 'Deep scanning website, docs, and extracting knowledge...' },
        }));

        // Try deep crawl first (comprehensive)
        const crawlRes = await fetch(`${baseUrl}/api/onboarding/deep-crawl`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            url: normalizedDomain,
            maxPages: 50,
            maxDepth: 10,
            includeDocsSubdomain: true
          })
        });

        if (!crawlRes.ok) {
          const data = await crawlRes.json().catch(() => ({}));
          throw new Error(data.error || 'Deep crawl failed');
        }

        const data = await crawlRes.json();
        crawlContent = data.content || '';
        crawlDocs = Array.isArray(data.docs) ? data.docs : [];
        crawlPages = Array.isArray(data.pages) ? data.pages.map((p: any) => p.url || p) : [];
        defiMetrics = data.defiMetrics || null;

        // Extract knowledge base entries from deep crawl
        if (data.knowledgeBase && Array.isArray(data.knowledgeBase)) {
          knowledgeBaseFromCrawl = data.knowledgeBase.map((entry: any) => {
            const prefix = entry.category !== 'general' ? `[${entry.category.toUpperCase()}] ` : '';
            return `${prefix}${entry.title}: ${entry.content.slice(0, 500)}`;
          });
        }

        // Extract images from crawl
        if (data.crawledImages && Array.isArray(data.crawledImages)) {
          crawlImages = data.crawledImages.map((img: any, idx: number) => ({
            id: `crawl-img-${idx}`,
            url: img.url,
            name: `Website image`,
            category: 'Website'
          }));
        }

        console.log('[Onboarding] Deep crawl data received:', {
          pages: crawlPages.length,
          docs: crawlDocs.length,
          knowledgeBase: knowledgeBaseFromCrawl.length,
          contentLength: crawlContent.length,
          images: crawlImages.length,
          sampleKB: knowledgeBaseFromCrawl[0]?.slice(0, 100)
        });

        // Build summary message
        const stats = data.stats || {};
        const categoryList = stats.categories ? Object.keys(stats.categories).join(', ') : '';
        const summaryParts = [
          `Scanned ${crawlPages.length} pages`,
          knowledgeBaseFromCrawl.length > 0 ? `extracted ${knowledgeBaseFromCrawl.length} knowledge entries` : null,
          crawlDocs.length > 0 ? `found ${crawlDocs.length} documents` : null,
          categoryList ? `(${categoryList})` : null
        ].filter(Boolean);

        setAnalysisProgress(prev => ({
          ...prev,
          website: {
            status: 'complete',
            message: summaryParts.join(', ') || 'Website scan complete'
          },
          twitter: { status: 'loading', message: 'Analyzing tweets, engagement patterns, and brand voice...' },
        }));
      } catch (crawlError: any) {
        // Fallback to simple crawl if deep crawl fails
        console.warn('Deep crawl failed, falling back to simple crawl:', crawlError);
        try {
          const simpleCrawlRes = await fetch(`${baseUrl}/api/onboarding/crawl`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ url: normalizedDomain })
          });

          if (simpleCrawlRes.ok) {
            const data = await simpleCrawlRes.json();
            crawlContent = data.content || '';
            crawlDocs = Array.isArray(data.docs) ? data.docs : [];
            crawlPages = Array.isArray(data.pages) ? data.pages.map((p: any) => p.url || p) : [];

            // Simple crawl now also returns knowledge base entries
            if (data.knowledgeBase && Array.isArray(data.knowledgeBase)) {
              knowledgeBaseFromCrawl = data.knowledgeBase.map((entry: any) => {
                const prefix = entry.category !== 'general' ? `[${entry.category.toUpperCase()}] ` : '';
                return `${prefix}${entry.title}: ${entry.content.slice(0, 500)}`;
              });
            }

            // Extract images from simple crawl
            if (data.crawledImages && Array.isArray(data.crawledImages)) {
              crawlImages = data.crawledImages.map((img: any, idx: number) => ({
                id: `crawl-img-${idx}`,
                url: img.url,
                name: `Website image`,
                category: 'Website'
              }));
            }

            console.log('[Onboarding] Simple crawl data received:', {
              pages: crawlPages.length,
              docs: crawlDocs.length,
              knowledgeBase: knowledgeBaseFromCrawl.length,
              contentLength: crawlContent.length,
              images: crawlImages.length
            });
          }
        } catch {
          // Both failed
        }

        setAnalysisProgress(prev => ({
          ...prev,
          website: { status: 'complete', message: crawlPages.length > 0 ? `Scanned ${crawlPages.length} pages` : 'Website scan completed with limited access' },
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
          headers: authHeaders,
          body: JSON.stringify({ handle: normalizedHandle, brandName: brandName.trim() })
        });

        if (!twitterRes.ok) {
          const data = await twitterRes.json().catch(() => ({}));
          throw new Error(data.error || 'Twitter scrape failed');
        }

        const data = await twitterRes.json();
        tweetExamples = Array.isArray(data.tweetExamples) ? data.tweetExamples : [];
        tweetImages = Array.isArray(data.referenceImages) ? data.referenceImages : [];

        console.log('[Onboarding] Twitter data received:', {
          tweetExamples: tweetExamples.length,
          referenceImages: tweetImages.length,
          sampleImage: tweetImages[0]?.url
        });

        setAnalysisProgress(prev => ({
          ...prev,
          twitter: {
            status: 'complete',
            message: tweetExamples.length > 0
              ? `Collected ${tweetExamples.length} tweets${tweetImages.length > 0 ? ` & ${tweetImages.length} images` : ''}`
              : 'Twitter scan complete (no examples found)'
          },
          assets: { status: 'loading', message: 'Extracting logos, images, and visual identity...' },
        }));
      } catch (twitterError: any) {
        console.error('[Onboarding] Twitter fetch error:', twitterError);
        setAnalysisProgress(prev => ({
          ...prev,
          twitter: { status: 'complete', message: 'Skipped — add Apify token to import tweets' },
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

      // GitHub signals removed — not a priority for onboarding
      const githubSignals: string[] = [];

      setAnalysisProgress(prev => ({
        ...prev,
        assets: { status: 'complete', message: 'Brand intelligence research complete' },
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

      // Gemini deep research is the primary knowledge source (long-form paragraphs)
      // Always supplement with crawl fallback content to ensure the KB is never empty
      const geminiKB = researchResult.knowledgeBase || [];
      const crawlFallbackKB = buildKnowledgeFallback(crawlContent, crawlDocs);

      // If Gemini returned entries, use them as primary and add non-duplicate crawl entries
      // If Gemini returned nothing, use crawl fallback entirely
      let baseKnowledge: string[];
      if (geminiKB.length > 0) {
        // Add crawl entries that aren't redundant with Gemini entries
        const geminiText = geminiKB.join(' ').toLowerCase();
        const supplemental = crawlFallbackKB.filter(entry => {
          const key = entry.replace(/^Website:\s*/i, '').slice(0, 60).toLowerCase();
          return !geminiText.includes(key);
        });
        baseKnowledge = [...geminiKB, ...supplemental.slice(0, 5)];
      } else {
        baseKnowledge = crawlFallbackKB;
      }

      console.log('[Onboarding] Knowledge assembly:', {
        geminiEntries: geminiKB.length,
        crawlFallback: crawlFallbackKB.length,
        finalBaseKnowledge: baseKnowledge.length
      });

      const baseTweetExamples = tweetExamples.length > 0
        ? tweetExamples
        : (researchResult.tweetExamples || []);

      console.log('[Onboarding] Building reference images from:', {
        researchResult: researchResult.referenceImages?.length || 0,
        tweetImages: tweetImages.length,
        sampleTweetImage: tweetImages[0]
      });

      const combinedReferenceImages = dedupeReferenceImages([
        ...(researchResult.referenceImages || []),
        ...tweetImages,
        ...crawlImages
      ]);

      console.log('[Onboarding] Combined reference images:', {
        count: combinedReferenceImages.length,
        sample: combinedReferenceImages[0]
      });

      // Build DeFi metrics knowledge entries if available
      const defiKnowledge: string[] = [];
      if (defiMetrics) {
        if (defiMetrics.tvl) {
          defiKnowledge.push(`[DEFI] Total Value Locked (TVL): $${defiMetrics.tvl.toLocaleString()}`);
        }
        if (defiMetrics.aprs && defiMetrics.aprs.length > 0) {
          const topAprs = defiMetrics.aprs.slice(0, 3);
          topAprs.forEach((apr: any) => {
            defiKnowledge.push(`[DEFI] APR: ${apr.value}% - ${apr.context}`);
          });
        }
        if (defiMetrics.pools && defiMetrics.pools.length > 0) {
          defiKnowledge.push(`[DEFI] Active Pools: ${defiMetrics.pools.join(', ')}`);
        }
      }

      const enriched: BrandConfig = {
        colors: researchResult.colors || [],
        knowledgeBase: [
          ...baseKnowledge,
          ...knowledgeBaseFromCrawl, // Deep crawl categorized knowledge
          ...defiKnowledge, // DeFi-specific metrics
          ...collectorKnowledge,
          ...crawlDocs.map((doc) => `[DOCUMENT] ${doc}`),
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
      // Only generate 3 NEW tweets for the carousel (not using scraped content)
      let generatedExamples: string[] = [];
      try {
        generatedExamples = await generateStyleExamples(brandName.trim(), enriched, 3);
      } catch (e) {
        generatedExamples = [];
      }

      // Use ONLY AI-generated examples for the carousel
      const combinedExamples = dedupeStrings([...generatedExamples]).slice(0, 3);

      // Merge blockchain config if provided
      const validContracts = contracts.filter(c => c.address.trim().length > 0 && c.chain.trim().length > 0);
      const enrichedWithBlockchain = {
        ...enriched,
        ...(validContracts.length > 0 ? {
          blockchain: {
            contracts: validContracts.map(c => ({
              address: c.address.trim(),
              type: c.type as 'token' | 'staking' | 'pool' | 'nft',
              label: c.label.trim() || c.type,
              chain: c.chain,
            })),
          },
        } : {}),
      };

      const data: EnrichedData = {
        brandName: brandName.trim(),
        config: enrichedWithBlockchain,
        sources: {
          domains,
          xHandles,
          youtube: undefined,
        },
      };

      console.log('[Onboarding] Final enriched data:', {
        knowledgeBase: enriched.knowledgeBase?.length,
        referenceImages: enriched.referenceImages?.length,
        tweetExamples: enriched.tweetExamples?.length,
        styleExamples: combinedExamples.length,
        sampleKnowledge: enriched.knowledgeBase?.slice(0, 3),
        sampleImages: enriched.referenceImages?.slice(0, 2)
      });

      console.log('[Onboarding] Setting enrichedData with referenceImages:', {
        count: data.config.referenceImages?.length || 0,
        first: data.config.referenceImages?.[0]
      });
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
      const validCompetitors = competitors.filter(c => c.name.trim());
      const finalConfig = {
        ...enrichedData.config,
        tweetExamples: approvedStyles.length > 0 ? approvedStyles : enrichedData.config.tweetExamples,
        approvedStyleExamples: approvedStyles,
        rejectedStyleExamples: rejectedStyles,
        referenceImages: mergedReferenceImages,
        ...(validCompetitors.length > 0 ? { competitors: validCompetitors } : {}),
        subscription: createDefaultSubscription('starter'), // New brands start on Starter plan
      };
      // Save Dune API key to integration keys if provided
      if (duneApiKey.trim()) {
        try {
          const existingKeys = loadIntegrationKeys(brandName.trim());
          saveIntegrationKeys({ ...existingKeys, dune: duneApiKey.trim() }, brandName.trim());
        } catch (e) {
          console.warn('[Onboarding] Failed to save Dune API key:', e);
        }
      }

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
      const token = await getAuthToken();
      const response = await fetch(`${baseUrl}/api/onboarding/carousel-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
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
    console.log('[Onboarding] ensureVariant called with enrichedData:', {
      hasEnrichedData: !!enrichedData,
      hasConfig: !!enrichedData?.config,
      referenceImagesCount: enrichedData?.config?.referenceImages?.length || 0,
      firstImage: enrichedData?.config?.referenceImages?.[0]
    });

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

      // DEBUG: Log the full reference images state at generation time
      console.log('[Onboarding] enrichedData.config.referenceImages at generation:', {
        exists: !!enrichedData.config.referenceImages,
        count: enrichedData.config.referenceImages?.length || 0,
        first3: (enrichedData.config.referenceImages || []).slice(0, 3).map(img => ({
          id: img.id,
          hasUrl: !!img.url,
          hasData: !!img.data
        }))
      });

      // ALWAYS use reference images for style consistency across all modes
      // Pick up to 3 random reference images to guide the style
      const allReferenceIds = (enrichedData.config.referenceImages || [])
        .filter(img => img.id && (img.url || img.data))
        .map(img => img.id);

      // Shuffle and pick up to 3 for style reference
      const shuffled = [...allReferenceIds].sort(() => Math.random() - 0.5);
      const selectedReferenceImages = shuffled.slice(0, 3);

      console.log('[Onboarding] Generating graphic with reference images:', selectedReferenceImages);

      // Match Content Studio format exactly
      const image = await generateWeb3Graphic({
        prompt: exampleText,
        artPrompt,
        negativePrompt: 'text, words, letters, watermark, blurry, low quality',
        size: '1K',
        aspectRatio: '16:9', // Match Content Studio default
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

  // Debug: Track enrichedData changes
  useEffect(() => {
    console.log('[Onboarding] enrichedData state changed:', {
      hasData: !!enrichedData,
      referenceImagesCount: enrichedData?.config?.referenceImages?.length || 0
    });
  }, [enrichedData]);

  // Track if we've already started generating for this index to prevent double-generation
  const generatingRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    console.log('[Onboarding] Styles useEffect triggered:', {
      currentStep,
      hasStyleExamples: styleExamples.length > 0,
      currentStyleIndex,
      enrichedDataRefImages: enrichedData?.config?.referenceImages?.length || 0
    });
    if (currentStep !== 'styles') return;
    if (!styleExamples[currentStyleIndex]) return;

    // Only generate once per index
    if (generatingRef.current.has(currentStyleIndex)) {
      console.log('[Onboarding] Skipping - already generating for index:', currentStyleIndex);
      return;
    }

    // Check if we already have a graphic for this index
    const existing = styleGraphics[currentStyleIndex];
    if (existing?.variants?.[0]?.status === 'ready' || existing?.variants?.[0]?.status === 'loading') {
      console.log('[Onboarding] Skipping - already have graphic for index:', currentStyleIndex);
      return;
    }

    generatingRef.current.add(currentStyleIndex);
    ensureVariant(currentStyleIndex, 0);
  }, [currentStep, currentStyleIndex, styleExamples.length]);

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
        className="w-[480px] h-full flex flex-col justify-between p-12 overflow-y-auto shrink-0"
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

          {/* On-Chain Configuration (Optional) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-sharp text-lg text-[#6B6B70]" style={{ fontVariationSettings: "'wght' 300" }}>token</span>
                <label className="text-[#8E8E93] text-sm font-medium">On-Chain Data <span className="text-[#6B6B70] font-normal">(optional)</span></label>
              </div>
              <button
                onClick={() => setContracts([...contracts, { address: '', type: 'token', label: '', chain: 'Ethereum' }])}
                className="text-xs text-[#FF5C00] hover:text-[#FF6B1A] font-medium transition-colors"
              >
                + Add Contract
              </button>
            </div>

            {contracts.length > 0 && (
              <div className="space-y-3">
                {contracts.map((contract, idx) => (
                  <div key={idx} className="flex gap-2">
                    <select
                      value={contract.chain}
                      onChange={(e) => {
                        const updated = [...contracts];
                        updated[idx] = { ...updated[idx], chain: e.target.value };
                        setContracts(updated);
                      }}
                      className="w-[110px] h-[44px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-2 text-white text-sm focus:border-[#FF5C00] focus:outline-none transition-colors appearance-none cursor-pointer"
                    >
                      <option value="Ethereum">Ethereum</option>
                      <option value="Metis">Metis</option>
                      <option value="Polygon">Polygon</option>
                      <option value="Arbitrum">Arbitrum</option>
                      <option value="Base">Base</option>
                      <option value="BSC">BSC</option>
                      <option value="Solana">Solana</option>
                      <option value="Other">Other</option>
                    </select>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={contract.address}
                      onChange={(e) => {
                        const updated = [...contracts];
                        updated[idx] = { ...updated[idx], address: e.target.value };
                        setContracts(updated);
                      }}
                      className="flex-1 h-[44px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-3 text-white text-sm placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors font-mono"
                    />
                    <select
                      value={contract.type}
                      onChange={(e) => {
                        const updated = [...contracts];
                        updated[idx] = { ...updated[idx], type: e.target.value };
                        setContracts(updated);
                      }}
                      className="w-[100px] h-[44px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-2 text-white text-sm focus:border-[#FF5C00] focus:outline-none transition-colors appearance-none cursor-pointer"
                    >
                      <option value="token">Token</option>
                      <option value="staking">Staking</option>
                      <option value="pool">Pool</option>
                      <option value="nft">NFT</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Label"
                      value={contract.label}
                      onChange={(e) => {
                        const updated = [...contracts];
                        updated[idx] = { ...updated[idx], label: e.target.value };
                        setContracts(updated);
                      }}
                      className="w-[100px] h-[44px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-3 text-white text-sm placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                    />
                    <button
                      onClick={() => setContracts(contracts.filter((_, i) => i !== idx))}
                      className="w-[44px] h-[44px] rounded-xl bg-[#111113] border border-[#2A2A2E] flex items-center justify-center text-[#6B6B70] hover:text-red-400 hover:border-red-400/30 transition-colors"
                    >
                      <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Dune API Key — only show if user has added contracts */}
            {contracts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#2A2A2E]">
                <label className="text-[#9CA3AF] text-xs font-medium block mb-1.5">Dune Analytics API Key (optional)</label>
                <input
                  type="password"
                  value={duneApiKey}
                  onChange={(e) => setDuneApiKey(e.target.value)}
                  placeholder="Paste your Dune API key"
                  className="w-full h-[44px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-3 text-white text-sm placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                />
                <p className="text-[#6B6B70] text-[11px] mt-1.5">
                  Enables automatic on-chain analytics. Get a free key at <span className="text-[#FF5C00]">dune.com</span> → Settings → API. You can also add this later in Settings.
                </p>
              </div>
            )}
          </div>

          {/* Competitors (optional) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-sharp text-lg text-[#6B6B70]" style={{ fontVariationSettings: "'wght' 300" }}>swords</span>
                <label className="text-[#8E8E93] text-sm font-medium">Competitors <span className="text-[#6B6B70] font-normal">(optional — helps AI differentiate you)</span></label>
              </div>
              {competitors.length < 3 && (
                <button
                  onClick={() => setCompetitors([...competitors, { name: '', handle: '' }])}
                  className="text-xs text-[#FF5C00] hover:text-[#FF6B1A] font-medium transition-colors"
                >
                  + Add Competitor
                </button>
              )}
            </div>
            {competitors.length > 0 && (
              <div className="space-y-3">
                {competitors.map((comp, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Competitor name"
                      value={comp.name}
                      onChange={(e) => {
                        const updated = [...competitors];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setCompetitors(updated);
                      }}
                      className="flex-1 h-[44px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-3 text-white text-sm placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                    />
                    <input
                      type="text"
                      placeholder="@handle"
                      value={comp.handle}
                      onChange={(e) => {
                        const updated = [...competitors];
                        updated[idx] = { ...updated[idx], handle: e.target.value.replace(/^@/, '') };
                        setCompetitors(updated);
                      }}
                      className="w-[140px] h-[44px] rounded-xl bg-[#111113] border border-[#2A2A2E] px-3 text-white text-sm placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                    />
                    <button
                      onClick={() => setCompetitors(competitors.filter((_, i) => i !== idx))}
                      className="w-[44px] h-[44px] rounded-xl bg-[#111113] border border-[#2A2A2E] flex items-center justify-center text-[#6B6B70] hover:text-red-400 hover:border-red-400/30 transition-colors"
                    >
                      <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#2A2A2E] bg-[#111113] px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm font-medium">Connect X (optional)</p>
                <p className="text-[#6B6B70] text-xs">
                  Recommended for the most accurate follower + engagement tracking. If you skip, we use public data for the handle above.
                </p>
              </div>
              <button
                onClick={handleConnectX}
                disabled={xConnectLoading}
                className="px-4 py-2 rounded-lg bg-[#1A1A1D] border border-[#2E2E2E] text-white text-xs font-semibold hover:border-[#FF5C00] disabled:opacity-50 whitespace-nowrap"
              >
                {xConnectLoading ? 'Connecting...' : (xConnectStatus?.connected ? 'Reconnect X' : 'Connect X')}
              </button>
            </div>
            <div className="mt-3 text-xs">
              <span className={xConnectStatus?.connected ? 'text-green-400' : 'text-[#6B6B70]'}>
                {xConnectStatus?.connected ? `Connected as @${xConnectStatus?.username || 'account'}` : 'Not connected'}
              </span>
              {xConnectError && <span className="text-red-400 ml-2">{xConnectError}</span>}
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

  // Handle file uploads for knowledge base
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'image') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    try {
      for (const file of Array.from(files)) {
        if (type === 'pdf' && file.type === 'application/pdf') {
          // For PDFs, we'd normally parse them - for now just add as knowledge
          const text = `[DOCUMENT] Uploaded: ${file.name}`;
          if (enrichedData) {
            setEnrichedData({
              ...enrichedData,
              config: {
                ...enrichedData.config,
                knowledgeBase: [...(enrichedData.config.knowledgeBase || []), text]
              }
            });
          }
        } else if (type === 'image' && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const data = event.target?.result as string;
            if (enrichedData && data) {
              const newImage: ReferenceImage = {
                id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                data,
                category: 'Uploaded'
              };
              setEnrichedData({
                ...enrichedData,
                config: {
                  ...enrichedData.config,
                  referenceImages: [...(enrichedData.config.referenceImages || []), newImage]
                }
              });
            }
          };
          reader.readAsDataURL(file);
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  // Extract brand colors from config
  const brandColors = enrichedData?.config.colors || [];
  const primaryColor = brandColors[0]?.hex || '#FF5C00';

  // Get first reference image as potential logo
  const potentialLogo = enrichedData?.config.referenceImages?.find(img =>
    img.name?.toLowerCase().includes('logo') || img.category?.toLowerCase().includes('logo')
  ) || enrichedData?.config.referenceImages?.[0];

  const renderReviewStep = () => (
    <div className="flex-1 overflow-y-auto px-12 py-10 bg-[#0A0A0B]">
      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-8"
          onClick={() => setViewingImage(null)}
        >
          <button
            onClick={() => setViewingImage(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={viewingImage}
            alt="Preview"
            className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'pdf')}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'image')}
      />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header with Logo */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            {/* Company Logo/Avatar */}
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-[#1F1F23] to-[#0A0A0B] border border-[#2A2A2E] flex items-center justify-center cursor-pointer hover:border-[#FF5C00] transition-colors"
              onClick={() => potentialLogo?.url && setViewingImage(potentialLogo.url)}
              style={{ backgroundColor: primaryColor + '20' }}
            >
              {potentialLogo?.url || potentialLogo?.data ? (
                <img
                  src={potentialLogo.url || potentialLogo.data}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                  {enrichedData?.brandName?.charAt(0) || 'B'}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{enrichedData?.brandName}</h1>
              <p className="text-[#8E8E93] mt-1">{(enrichedData?.config.targetAudience && !enrichedData.config.targetAudience.toLowerCase().includes('no information available'))
                ? enrichedData.config.targetAudience.split(',')[0]
                : 'Web3 Technology'}</p>
              <div className="flex items-center gap-4 mt-2">
                <a href={enrichedData?.sources.domains[0]} target="_blank" rel="noopener noreferrer" className="text-[#FF5C00] text-sm hover:underline flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  {enrichedData?.sources.domains[0]?.replace('https://', '')}
                </a>
                <a href={`https://x.com/${enrichedData?.sources.xHandles[0]}`} target="_blank" rel="noopener noreferrer" className="text-[#FF5C00] text-sm hover:underline flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  @{enrichedData?.sources.xHandles[0]}
                </a>
              </div>
            </div>
          </div>
          <button
            onClick={() => setCurrentStep('company')}
            className="px-4 py-2.5 rounded-xl bg-[#1F1F23] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#2A2A2E] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Details
          </button>
        </div>

        {/* Brand Colors */}
        {brandColors.length > 0 && (
          <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                Brand Colors
              </h3>
            </div>
            <div className="flex gap-4">
              {brandColors.map((color, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div
                    className="w-16 h-16 rounded-xl border-2 border-[#2A2A2E] shadow-lg"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-xs text-[#8E8E93]">{color.name}</span>
                  <span className="text-xs text-[#6B6B70] font-mono">{color.hex}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brand Voice & Personality */}
        <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              Brand Voice & Personality
            </h3>
          </div>
          <p className="text-[#C5C5C7] text-sm leading-relaxed mb-4">
            {(enrichedData?.config.voiceGuidelines && !enrichedData.config.voiceGuidelines.toLowerCase().includes('no information available'))
              ? enrichedData.config.voiceGuidelines
              : 'Professional yet approachable, with a focus on technical credibility and community-first messaging. Clear explanations of complex concepts while maintaining authenticity.'}
          </p>
          {enrichedData?.config.bannedPhrases && enrichedData.config.bannedPhrases.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#2A2A2E]">
              <p className="text-xs text-[#6B6B70] uppercase tracking-wider mb-2">Avoid These Phrases</p>
              <div className="flex gap-2 flex-wrap">
                {enrichedData.config.bannedPhrases.slice(0, 6).map((phrase, index) => (
                  <span key={index} className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs">{phrase}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Knowledge Base */}
        <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              Knowledge Base
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1F1F23] text-[#8E8E93] text-xs">
                {enrichedData?.config.knowledgeBase?.length || 0} items
              </span>
            </h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              className="px-3 py-1.5 rounded-lg bg-[#FF5C00]/10 text-[#FF5C00] text-sm font-medium hover:bg-[#FF5C00]/20 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {uploadingFile ? 'Uploading...' : 'Add PDF/Doc'}
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {enrichedData?.config.knowledgeBase?.slice(0, 5).map((item, index) => {
              const cleanItem = item.replace(/^\[(.*?)\]\s*/, '');
              const truncated = cleanItem.length > 180 ? cleanItem.slice(0, 180) + '...' : cleanItem;
              return (
                <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-[#0A0A0B] border border-[#1F1F23]">
                  <div className="w-6 h-6 rounded-md bg-[#1F1F23] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.startsWith('[DOCUMENT]') ? (
                      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    ) : item.startsWith('[DEFI]') ? (
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-[#FF5C00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[#C5C5C7] text-sm leading-relaxed">{truncated}</span>
                </div>
              );
            })}
          </div>
          {(enrichedData?.config.knowledgeBase?.length || 0) > 5 && (
            <button
              onClick={() => setShowKnowledgeModal(true)}
              className="mt-3 text-[#FF5C00] text-sm font-medium hover:underline"
            >
              View all {enrichedData?.config.knowledgeBase?.length} items →
            </button>
          )}
        </div>

        {/* Knowledge Base Modal */}
        {showKnowledgeModal && (
          <div
            className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8"
            onClick={() => setShowKnowledgeModal(false)}
          >
            <div
              className="w-full max-w-2xl max-h-[80vh] rounded-2xl bg-[#111113] border border-[#2A2A2E] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-[#2A2A2E]">
                <h3 className="text-white text-lg font-semibold flex items-center gap-2">
                  Knowledge Base
                  <span className="px-2 py-0.5 rounded-full bg-[#1F1F23] text-[#8E8E93] text-xs">
                    {enrichedData?.config.knowledgeBase?.length || 0} items
                  </span>
                </h3>
                <button
                  onClick={() => setShowKnowledgeModal(false)}
                  className="w-8 h-8 rounded-full bg-[#1F1F23] hover:bg-[#2A2A2E] flex items-center justify-center text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                {enrichedData?.config.knowledgeBase?.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-[#0A0A0B] border border-[#1F1F23]">
                    <div className="w-6 h-6 rounded-md bg-[#1F1F23] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.startsWith('[DOCUMENT]') ? (
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      ) : item.startsWith('[DEFI]') ? (
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      ) : item.startsWith('GitHub:') ? (
                        <svg className="w-3.5 h-3.5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-[#FF5C00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[#C5C5C7] text-sm leading-relaxed">{item.replace(/^\[(.*?)\]\s*/, '')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reference Images - Larger & Clickable */}
        <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              Style Reference Images
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1F1F23] text-[#8E8E93] text-xs">
                {enrichedData?.config.referenceImages?.length || 0} images
              </span>
            </h3>
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingFile}
              className="px-3 py-1.5 rounded-lg bg-[#FF5C00]/10 text-[#FF5C00] text-sm font-medium hover:bg-[#FF5C00]/20 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Images
            </button>
          </div>
          {enrichedData?.config.referenceImages && enrichedData.config.referenceImages.length > 0 ? (
            <div className="grid grid-cols-4 gap-4">
              {enrichedData.config.referenceImages.slice(0, 8).map((img, index) => (
                <div
                  key={img.id || index}
                  className="aspect-square rounded-xl bg-[#0A0A0B] border border-[#1F1F23] overflow-hidden cursor-pointer hover:border-[#FF5C00] hover:shadow-lg hover:shadow-[#FF5C00]/10 transition-all group relative"
                  onClick={() => setViewingImage(img.url || img.data || null)}
                >
                  <img
                    src={img.url || img.data}
                    alt={img.name || 'Reference'}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                  {img.category && (
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-xs">
                      {img.category}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#1F1F23] flex items-center justify-center">
                <svg className="w-6 h-6 text-[#6B6B70]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-[#8E8E93] text-sm font-medium mb-1">No reference images found</p>
              <p className="text-[#6B6B70] text-xs mb-3">Upload logos, graphics, or brand visuals to guide your AI's style.</p>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF5C00]/10 text-[#FF5C00] text-sm font-medium hover:bg-[#FF5C00]/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Images
              </button>
            </div>
          )}
        </div>

        {/* Tweet Examples from Twitter */}
        <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              Content Style Examples
              {enrichedData?.config.tweetExamples && enrichedData.config.tweetExamples.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#1F1F23] text-[#8E8E93] text-xs">
                  from @{enrichedData?.sources.xHandles[0]}
                </span>
              )}
            </h3>
          </div>
          {enrichedData?.config.tweetExamples && enrichedData.config.tweetExamples.length > 0 ? (
            <div className="space-y-3">
              {enrichedData.config.tweetExamples.slice(0, 5).map((tweet, index) => (
                <div key={index} className="p-4 rounded-xl bg-[#0A0A0B] border border-[#1F1F23]">
                  <p className="text-[#C5C5C7] text-sm leading-relaxed whitespace-pre-wrap">{tweet}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-[#6B6B70] text-sm">No tweets found yet. Connect your X/Twitter account or add the Apify API token to import your content history.</p>
              <p className="text-[#4B4B50] text-xs mt-1">Your AI CMO will use your knowledge base and brand voice to generate content.</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4 pb-8">
          <button
            onClick={() => setCurrentStep('company')}
            className="px-6 py-3.5 rounded-xl bg-[#1F1F23] text-white font-medium flex items-center gap-2 hover:bg-[#2A2A2E] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          {styleExamples.length > 0 ? (
            <button
              onClick={() => setCurrentStep('styles')}
              className="px-8 py-3.5 rounded-xl bg-[#FF5C00] hover:bg-[#FF6B1A] text-white font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-[#FF5C00]/20"
            >
              <span>Continue to Content Preview</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              className="px-8 py-3.5 rounded-xl bg-[#FF5C00] hover:bg-[#FF6B1A] text-white font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-[#FF5C00]/20"
            >
              <span>Launch AI CMO</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
          )}
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

    // Empty state: no style examples found (e.g. Apify not configured)
    if (totalExamples === 0) {
      return (
        <div className="flex-1 flex flex-col px-16 py-12 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-white text-2xl font-semibold">Content Style Examples</h2>
              <p className="text-[#8E8E93] text-sm mt-1">Train your AI by reviewing examples from your social accounts.</p>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-[540px] text-center space-y-6">
              <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] p-10">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1F1F23] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#6B6B70]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-white text-lg font-semibold mb-2">No Style Examples Found</h3>
                <p className="text-[#8E8E93] text-sm leading-relaxed mb-2">
                  We couldn't find tweet examples to train your AI style. This usually means the X/Twitter integration isn't connected yet.
                </p>
                <p className="text-[#6B6B70] text-xs">
                  Don't worry — your AI CMO will still work! You can always refine its voice later from the Content Studio.
                </p>
              </div>

              <button
                onClick={handleLaunch}
                className="w-full px-8 py-4 rounded-xl bg-[#FF5C00] hover:bg-[#FF6B1A] text-white font-semibold text-lg flex items-center justify-center gap-3 transition-colors shadow-lg shadow-[#FF5C00]/20"
              >
                <span>Launch AI CMO</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col px-16 py-12 overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-white text-2xl font-semibold tracking-tight">Train Your AI Voice</h2>
            <p className="text-[#8E8E93] text-sm mt-1">Review AI-generated content examples. Approve ones that match your style.</p>
          </div>
          <div className="px-4 py-2 rounded-full bg-[#1F1F23] text-white text-sm font-medium font-mono">
            {currentStyleIndex + 1} / {totalExamples}
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
            <div className="rounded-2xl bg-[#111113] border border-[#2A2A2E] overflow-hidden shadow-lg shadow-black/20">
              <div className="px-6 py-4 border-b border-[#2A2A2E] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FF8C4A] flex items-center justify-center text-white font-bold text-sm">
                    {enrichedData?.brandName?.charAt(0) || 'D'}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{enrichedData?.brandName || 'Your Brand'}</p>
                    <p className="text-[#6B6B70] text-xs">@{enrichedData?.sources.xHandles[0] || 'handle'}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#FF5C00]/10 text-[#FF5C00] text-[10px] font-semibold tracking-wider uppercase">AI Draft</span>
              </div>
              <div className="px-6 py-5">
                <p className="text-white text-[15px] leading-relaxed whitespace-pre-wrap">
                  {currentExample}
                </p>
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
            className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors ${
              currentStyleIndex >= styleExamples.length - 1
                ? 'bg-[#FF5C00] hover:bg-[#FF6B1A] text-white shadow-lg shadow-[#FF5C00]/20'
                : 'bg-[#1F1F23] text-[#8E8E93] hover:bg-[#2A2A2E] hover:text-white'
            }`}
          >
            {currentStyleIndex >= styleExamples.length - 1 ? 'Launch AI CMO' : 'Skip for Now'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-[#0A0A0B] flex overflow-hidden">
      {renderLeftPanel()}
      {currentStep === 'profile' && renderProfileStep()}
      {currentStep === 'company' && renderCompanyStep()}
      {currentStep === 'analyzing' && renderAnalyzingStep()}
      {currentStep === 'review' && renderReviewStep()}
      {currentStep === 'styles' && renderStylesStep()}
    </div>
  );
};
