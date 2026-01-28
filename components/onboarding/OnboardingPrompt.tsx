import React from 'react';
import { Button } from '../Button';

interface OnboardingPromptProps {
  onStart: () => void;
  onSkip: () => void;
}

export const OnboardingPrompt: React.FC<OnboardingPromptProps> = ({ onStart, onSkip }) => {
  return (
    <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-sm font-semibold text-brand-text">Finish your brand onboarding</div>
        <p className="text-xs text-brand-muted mt-1">
          Add your domain and social handles to unlock enrichment and personalized insights.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={onStart} className="px-4 py-2">Start onboarding</Button>
        <Button onClick={onSkip} variant="secondary" className="px-4 py-2">Skip for now</Button>
      </div>
    </div>
  );
};
