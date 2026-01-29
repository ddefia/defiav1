import React, { useMemo, useState } from 'react';
import { Button } from '../Button';
import { BrandConfig } from '../../types';
import { researchBrandIdentity } from '../../services/gemini';
import { researchGithubBrandSignals } from '../../services/githubBrandResearcher';
import { runBrandCollector } from '../../services/brandCollector';
import { retryWithBackoff } from '../../vendor/brand-collector/src/lib/retry';
import { rateLimit } from '../../vendor/brand-collector/src/lib/rate-limit';

const STEP_LABELS = ['Brand Basics', 'Social Sources', 'Review & Launch'];

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

interface OnboardingFlowProps {
  onExit: () => void;
  onComplete: (payload: {
    brandName: string;
    config: BrandConfig;
    sources: { domains: string[]; xHandles: string[]; youtube?: string };
  }) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onExit, onComplete }) => {
  const [step, setStep] = useState(0);
  const [brandName, setBrandName] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [xHandles, setXHandles] = useState<string[]>([]);
  const [xInput, setXInput] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const normalizedDomains = useMemo(() => domains.map(normalizeDomain).filter(Boolean), [domains]);

  const handleAddDomain = () => {
    const normalized = normalizeDomain(domainInput);
    if (!normalized) {
      setError('Add a valid domain or website URL.');
      return;
    }
    if (!isValidUrl(normalized)) {
      setError('Please enter a valid website URL.');
      return;
    }
    if (normalizedDomains.includes(normalized)) {
      setError('That domain is already listed.');
      return;
    }
    setDomains((prev) => [...prev, normalized]);
    setDomainInput('');
    setError('');
  };

  const handleAddHandle = () => {
    const normalized = normalizeHandle(xInput);
    if (!normalized || !isValidHandle(normalized)) {
      setError('Enter a valid X handle (letters, numbers, underscore).');
      return;
    }
    if (xHandles.some((handle) => handle.toLowerCase() === normalized.toLowerCase())) {
      setError('That handle is already listed.');
      return;
    }
    setXHandles((prev) => [...prev, normalized]);
    setXInput('');
    setError('');
  };

  const isStepValid = useMemo(() => {
    if (step === 0) return brandName.trim().length > 1 && normalizedDomains.length > 0;
    if (step === 1) return xHandles.length > 0;
    return true;
  }, [step, brandName, normalizedDomains.length, xHandles.length]);

  const runEnrichment = async () => {
    if (!rateLimit('onboarding:start')) {
      setError('Please wait a moment before starting another enrichment run.');
      return;
    }

    setIsRunning(true);
    setError('');
    setProgress(10);

    try {
      const primaryDomain = normalizedDomains[0];
      setProgress(25);

      let collectorProfile: any | null = null;
      let collectorMode: 'collector' | 'fallback' = 'fallback';

      try {
        const collectorResult = await retryWithBackoff(
          () =>
            runBrandCollector({
              brandName: brandName.trim(),
              domains: normalizedDomains,
              xHandles,
              youtube: youtubeUrl || undefined,
            }),
          1,
          800
        );
        collectorProfile = collectorResult.profile;
        collectorMode = collectorResult.mode;
        setProgress(55);
      } catch (collectorError) {
        collectorProfile = null;
        collectorMode = 'fallback';
      }

      const researchResult = await retryWithBackoff(
        () => researchBrandIdentity(brandName.trim(), primaryDomain),
        2,
        1200
      );

      const githubSignals = await researchGithubBrandSignals(brandName.trim());

      setProgress(70);

      const sourcesSummary = [
        `Domains: ${normalizedDomains.join(', ')}`,
        `X handles: ${xHandles.map((handle) => `@${handle}`).join(', ')}`,
        youtubeUrl ? `YouTube: ${youtubeUrl}` : null,
      ].filter(Boolean) as string[];

      const enriched: BrandConfig = {
        colors: researchResult.colors || [],
        knowledgeBase: [
          ...(researchResult.knowledgeBase || []),
          ...sourcesSummary,
          ...githubSignals,
        ],
        tweetExamples: researchResult.tweetExamples || [],
        referenceImages: researchResult.referenceImages || [],
        brandCollectorProfile: collectorProfile || undefined,
        voiceGuidelines: researchResult.voiceGuidelines,
        targetAudience: researchResult.targetAudience,
        bannedPhrases: researchResult.bannedPhrases,
        visualIdentity: researchResult.visualIdentity,
        graphicTemplates: researchResult.graphicTemplates,
      };

      if (collectorMode === 'collector' && collectorProfile) {
        const summary = collectorProfile?.positioning?.oneLiner || collectorProfile?.positioning?.topics?.join(', ');
        if (summary) {
          enriched.knowledgeBase = [...enriched.knowledgeBase, `Collector profile: ${summary}`];
        }
      }

      setProgress(100);
      onComplete({
        brandName: brandName.trim(),
        config: enriched,
        sources: {
          domains: normalizedDomains,
          xHandles,
          youtube: youtubeUrl || undefined,
        },
      });
    } catch (err: any) {
      setError(err?.message || 'Enrichment failed. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-brand-muted">Onboarding</p>
            <h1 className="text-3xl font-bold">Brand Collector Setup</h1>
            <p className="text-brand-muted mt-2">Capture brand signals and kick off enrichment in minutes.</p>
          </div>
          <Button variant="secondary" onClick={onExit}>Exit to Dashboard</Button>
        </div>

        <div className="bg-white border border-brand-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              {STEP_LABELS.map((label, index) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      index <= step ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className={`text-sm ${index === step ? 'text-brand-text font-semibold' : 'text-brand-muted'}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-sm text-brand-muted">Step {step + 1} of {STEP_LABELS.length}</div>
          </div>

          <div className="mt-6 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-brand-accent transition-all duration-500"
              style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
            ></div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 space-y-6">
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-brand-muted uppercase">Brand / Company Name</label>
                  <input
                    value={brandName}
                    onChange={(event) => setBrandName(event.target.value)}
                    placeholder="e.g. Defia Labs"
                    className="mt-2 w-full rounded-lg border border-brand-border bg-white px-4 py-3 text-sm focus:border-brand-accent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-brand-muted uppercase">Domains</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={domainInput}
                      onChange={(event) => setDomainInput(event.target.value)}
                      placeholder="defia.com"
                      className="flex-1 rounded-lg border border-brand-border bg-white px-4 py-3 text-sm focus:border-brand-accent outline-none"
                    />
                    <Button onClick={handleAddDomain} variant="secondary">Add</Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {normalizedDomains.map((domain) => (
                      <span key={domain} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-brand-text">
                        {domain}
                        <button
                          className="text-gray-400 hover:text-gray-600"
                          onClick={() => setDomains((prev) => prev.filter((item) => item !== domain))}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-brand-muted uppercase">X / Twitter Handles</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={xInput}
                      onChange={(event) => setXInput(event.target.value)}
                      placeholder="@defia"
                      className="flex-1 rounded-lg border border-brand-border bg-white px-4 py-3 text-sm focus:border-brand-accent outline-none"
                    />
                    <Button onClick={handleAddHandle} variant="secondary">Add</Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {xHandles.map((handle) => (
                      <span key={handle} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-brand-text">
                        @{handle}
                        <button
                          className="text-gray-400 hover:text-gray-600"
                          onClick={() => setXHandles((prev) => prev.filter((item) => item !== handle))}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-brand-muted uppercase">YouTube Channel (optional)</label>
                  <input
                    value={youtubeUrl}
                    onChange={(event) => setYoutubeUrl(event.target.value)}
                    placeholder="https://www.youtube.com/@defia"
                    className="mt-2 w-full rounded-lg border border-brand-border bg-white px-4 py-3 text-sm focus:border-brand-accent outline-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-brand-border bg-gray-50 p-4">
                  <div className="text-sm font-semibold">Review inputs</div>
                  <ul className="mt-3 text-sm text-brand-muted space-y-2">
                    <li><span className="font-semibold text-brand-text">Brand:</span> {brandName}</li>
                    <li><span className="font-semibold text-brand-text">Domains:</span> {normalizedDomains.join(', ')}</li>
                    <li><span className="font-semibold text-brand-text">X Handles:</span> {xHandles.map((handle) => `@${handle}`).join(', ')}</li>
                    {youtubeUrl && (
                      <li><span className="font-semibold text-brand-text">YouTube:</span> {youtubeUrl}</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-xl border border-brand-border bg-white p-4">
                  <div className="text-sm font-semibold">Enrichment status</div>
                  <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 text-xs text-brand-muted">{isRunning ? 'Enrichment running...' : 'Ready to start.'}</div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
              disabled={step === 0 || isRunning}
            >
              Back
            </Button>
            {step < STEP_LABELS.length - 1 ? (
              <Button onClick={() => setStep((prev) => prev + 1)} disabled={!isStepValid || isRunning}>
                Continue
              </Button>
            ) : (
              <Button onClick={runEnrichment} disabled={isRunning} isLoading={isRunning}>
                Start Enrichment
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
