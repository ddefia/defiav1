import React from 'react';
import { Button } from './Button';

interface LandingPageProps {
  onOpenDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenDashboard }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0F1F] via-[#0F172A] to-[#111827] text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl">✦</div>
            <span className="text-lg font-semibold tracking-wide">Defia Studio</span>
          </div>
          <Button onClick={onOpenDashboard} className="bg-white text-gray-900 hover:bg-white/90">
            Open Dashboard
          </Button>
        </nav>

        <section className="mt-20 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/60">Brand Intelligence Suite</p>
            <h1 className="mt-4 text-4xl md:text-5xl font-bold leading-tight">
              Build a complete brand command center in minutes.
            </h1>
            <p className="mt-6 text-lg text-white/70">
              Defia Studio turns your domain and social signals into a living brand profile, giving your team a
              real-time marketing cockpit with strategic insights, content planning, and AI-ready guidance.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button onClick={onOpenDashboard} className="bg-brand-accent hover:bg-brand-accent/90 text-white">
                Open Dashboard
              </Button>
              <button
                onClick={onOpenDashboard}
                className="px-6 py-3 rounded-lg border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition"
              >
                Preview Admin View
              </button>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3 text-sm text-white/70">
              <div className="rounded-xl border border-white/10 p-4 bg-white/5">
                <div className="text-white font-semibold">Instant onboarding</div>
                <p className="mt-2">Collect domains, socials, and start enrichment immediately.</p>
              </div>
              <div className="rounded-xl border border-white/10 p-4 bg-white/5">
                <div className="text-white font-semibold">Dashboard-first</div>
                <p className="mt-2">Admins always land in the workspace—no blockers.</p>
              </div>
              <div className="rounded-xl border border-white/10 p-4 bg-white/5">
                <div className="text-white font-semibold">Safe enrichment</div>
                <p className="mt-2">Fill only what’s missing and preserve existing brand context.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-brand-accent/30 to-cyan-400/10 blur-2xl"></div>
            <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-xs text-white/60">Live Preview</div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-4">
                  <div className="text-sm text-white/70">Brand Profile Health</div>
                  <div className="mt-2 text-3xl font-semibold">92%</div>
                  <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                    <div className="h-2 w-3/4 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"></div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-4">
                  <div className="text-sm text-white/70">Strategic Signals</div>
                  <ul className="mt-3 space-y-2 text-sm text-white/80">
                    <li>• Narrative momentum: L2 infrastructure</li>
                    <li>• Priority channel: X / Twitter</li>
                    <li>• Suggested cadence: 3x weekly</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-4">
                  <div className="text-sm text-white/70">Next Actions</div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-white">Resume onboarding</span>
                    <span className="text-emerald-300">Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
