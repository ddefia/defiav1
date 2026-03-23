import React, { useState, useEffect } from 'react';
import { signIn, sendPasswordReset, loadUserProfile } from '../services/auth';
import { getCurrentUserBrand } from '../services/storage';

interface AuthPageProps {
    mode?: 'login' | 'signup';
    onSuccess: (hasBrand?: boolean) => void;
    onSwitchMode?: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

export const AuthPage: React.FC<AuthPageProps> = ({
    mode: initialMode = 'login',
    onSuccess,
    onSwitchMode
}) => {
    const [mode, setMode] = useState<AuthMode>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [projectUrl, setProjectUrl] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
    const [waitlistPosition, setWaitlistPosition] = useState(0);
    const [confettiActive, setConfettiActive] = useState(false);

    // Sync mode with prop changes
    useEffect(() => {
        if (initialMode) {
            setMode(initialMode);
        }
    }, [initialMode]);

    const handleModeSwitch = (newMode: AuthMode) => {
        setMode(newMode);
        setError('');
        setSuccess('');
        if (onSwitchMode && (newMode === 'login' || newMode === 'signup')) {
            onSwitchMode();
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const { user, error: authError } = await signIn(email, password);
            if (authError) {
                setError(authError);
            } else if (user) {
                const existingBrand = getCurrentUserBrand();
                const userProfile = loadUserProfile();
                const hasBrandInMetadata = !!(userProfile?.brandId || userProfile?.brandName);
                onSuccess(!!existingBrand || hasBrandInMetadata);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleWaitlistSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '';
            const res = await fetch(`${baseUrl}/api/waitlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    name: fullName,
                    project_name: projectName || undefined,
                    project_url: projectUrl || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Something went wrong. Please try again.');
            } else {
                setWaitlistPosition(data.position || 0);
                setWaitlistSubmitted(true);
                setConfettiActive(true);
                setTimeout(() => setConfettiActive(false), 3000);
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            const { error: resetError } = await sendPasswordReset(email);
            if (resetError) {
                setError(resetError);
            } else {
                setSuccess('Password reset email sent. Check your inbox.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-full bg-[#0A0A0B] flex">
            {/* Confetti animation styles */}
            <style>{`
                @keyframes wl-confetti-fall {
                    0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
                }
                @keyframes wl-pulse-ring {
                    0% { transform: scale(0.8); opacity: 0.6; }
                    50% { transform: scale(1.1); opacity: 0.3; }
                    100% { transform: scale(0.8); opacity: 0.6; }
                }
                @keyframes wl-check-draw {
                    0% { stroke-dashoffset: 50; }
                    100% { stroke-dashoffset: 0; }
                }
                @keyframes wl-fade-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes wl-shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes wl-float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                }
                .wl-confetti-piece {
                    position: fixed;
                    width: 8px;
                    height: 8px;
                    z-index: 100;
                    pointer-events: none;
                    animation: wl-confetti-fall 2.5s ease-in forwards;
                }
                .wl-input-group {
                    position: relative;
                }
                .wl-input-group input, .wl-input-group select {
                    transition: border-color 0.3s, box-shadow 0.3s;
                }
                .wl-input-group input:focus, .wl-input-group select:focus {
                    border-color: #FF5C00 !important;
                    box-shadow: 0 0 0 3px rgba(255, 92, 0, 0.1);
                }
                .wl-submit-btn {
                    position: relative;
                    overflow: hidden;
                }
                .wl-submit-btn::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
                    background-size: 200% 100%;
                    animation: wl-shimmer 2s ease-in-out infinite;
                }
                .wl-feature-item {
                    animation: wl-fade-up 0.5s ease-out backwards;
                }
            `}</style>

            {/* Confetti overlay */}
            {confettiActive && (
                <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
                    {Array.from({ length: 40 }).map((_, i) => {
                        const colors = ['#FF5C00', '#FF8A4C', '#FFB347', '#4CAF50', '#2196F3', '#9C27B0', '#E91E63'];
                        const shapes = ['circle', 'square'];
                        return (
                            <div
                                key={i}
                                className="wl-confetti-piece"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: '-10px',
                                    width: `${6 + Math.random() * 8}px`,
                                    height: `${6 + Math.random() * 8}px`,
                                    background: colors[Math.floor(Math.random() * colors.length)],
                                    borderRadius: shapes[Math.floor(Math.random() * shapes.length)] === 'circle' ? '50%' : '2px',
                                    animationDelay: `${Math.random() * 1.5}s`,
                                    animationDuration: `${2 + Math.random() * 2}s`,
                                }}
                            />
                        );
                    })}
                </div>
            )}

            {/* Left Panel - Branding */}
            <div
                className="hidden lg:flex w-[480px] min-h-full flex-col justify-between p-12"
                style={{ background: 'linear-gradient(180deg, #1A0A00 0%, #0A0A0B 100%)' }}
            >
                <div className="space-y-10">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF7A2E] to-[#FF5C00] flex items-center justify-center">
                            <span className="material-symbols-sharp text-white text-xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                                bolt
                            </span>
                        </div>
                        <span className="text-[#FF5C00] font-bold text-2xl tracking-wide">Defia</span>
                    </div>

                    {/* Hero Text */}
                    <div className="space-y-4">
                        <h1 className="text-white text-4xl font-semibold leading-tight">
                            {mode === 'signup' ? (
                                <>AI Marketing<br />Is Almost Here</>
                            ) : (
                                <>Your AI-Powered<br />Marketing Command Center</>
                            )}
                        </h1>
                        <p className="text-[#8E8E93] text-base leading-relaxed max-w-[380px]">
                            {mode === 'signup'
                                ? 'Be among the first Web3 teams to automate marketing with AI that truly understands your brand.'
                                : 'Automate your Web3 marketing with AI that understands your brand, creates compelling content, and executes strategies 24/7.'
                            }
                        </p>
                    </div>

                    {/* Features */}
                    <div className="space-y-4">
                        {(mode === 'signup' ? [
                            { icon: 'rocket_launch', text: 'Early access to all features' },
                            { icon: 'groups', text: 'Join 200+ Web3 teams on the list' },
                            { icon: 'star', text: 'Founding member pricing locked in' },
                            { icon: 'bolt', text: 'Priority onboarding when we launch' },
                        ] : [
                            { icon: 'auto_awesome', text: 'AI CMO that learns your brand voice' },
                            { icon: 'campaign', text: 'Automated campaign generation' },
                            { icon: 'analytics', text: 'Real-time social analytics' },
                            { icon: 'calendar_month', text: 'Smart content scheduling' },
                        ]).map((feature, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 wl-feature-item"
                                style={{ animationDelay: `${i * 0.1}s` }}
                            >
                                <div className="w-8 h-8 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center">
                                    <span className="material-symbols-sharp text-[#FF5C00] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>
                                        {feature.icon}
                                    </span>
                                </div>
                                <span className="text-[#D1D5DB] text-sm">{feature.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom */}
                <div className="flex items-center gap-2 text-[#6B6B70] text-sm">
                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>
                        shield
                    </span>
                    <span>Your data is encrypted and secure</span>
                </div>
            </div>

            {/* Right Panel */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-[420px] space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FF7A2E] to-[#FF5C00] flex items-center justify-center">
                            <span className="material-symbols-sharp text-white text-xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                                bolt
                            </span>
                        </div>
                        <span className="text-[#FF5C00] font-bold text-2xl tracking-wide">Defia</span>
                    </div>

                    {/* Header */}
                    <div className="text-center space-y-2">
                        <h2 className="text-white text-2xl font-semibold">
                            {mode === 'login' && 'Welcome back'}
                            {mode === 'signup' && !waitlistSubmitted && 'Join the Waitlist'}
                            {mode === 'signup' && waitlistSubmitted && "You're on the list!"}
                            {mode === 'forgot' && 'Reset your password'}
                        </h2>
                        <p className="text-[#8E8E93] text-sm">
                            {mode === 'login' && 'Sign in to access your AI CMO dashboard'}
                            {mode === 'signup' && !waitlistSubmitted && 'Get early access when we launch'}
                            {mode === 'signup' && waitlistSubmitted && 'We\'ll notify you as soon as your spot is ready'}
                            {mode === 'forgot' && "Enter your email and we'll send you a reset link"}
                        </p>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                            <span className="material-symbols-sharp text-red-400 text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
                                error
                            </span>
                            <span className="text-red-400 text-sm">{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                            <span className="material-symbols-sharp text-green-400 text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
                                check_circle
                            </span>
                            <span className="text-green-400 text-sm">{success}</span>
                        </div>
                    )}

                    {/* Login Form */}
                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-white text-sm font-medium">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@company.com"
                                    required
                                    className="w-full h-12 rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-white text-sm font-medium">Password</label>
                                    <button
                                        type="button"
                                        onClick={() => handleModeSwitch('forgot')}
                                        className="text-[#FF5C00] text-sm hover:underline"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        className="w-full h-12 rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 pr-12 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B6B70] hover:text-white"
                                    >
                                        <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'wght' 300" }}>
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-12 rounded-xl bg-[#FF5C00] hover:bg-[#FF6B1A] disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                            >
                                {isLoading ? (
                                    <span className="material-symbols-sharp text-xl animate-spin" style={{ fontVariationSettings: "'wght' 300" }}>
                                        progress_activity
                                    </span>
                                ) : (
                                    'Sign In'
                                )}
                            </button>

                            <p className="text-center text-[#8E8E93] text-sm">
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('signup')}
                                    className="text-[#FF5C00] font-medium hover:underline"
                                >
                                    Join the waitlist
                                </button>
                            </p>
                        </form>
                    )}

                    {/* Waitlist Form (replaces signup) */}
                    {mode === 'signup' && !waitlistSubmitted && (
                        <form onSubmit={handleWaitlistSubmit} className="space-y-5" style={{ animation: 'wl-fade-up 0.4s ease-out' }}>
                            <div className="wl-input-group space-y-2">
                                <label className="text-white text-sm font-medium">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                    className="w-full h-12 rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:outline-none transition-all"
                                />
                            </div>

                            <div className="wl-input-group space-y-2">
                                <label className="text-white text-sm font-medium">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@project.com"
                                    required
                                    className="w-full h-12 rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:outline-none transition-all"
                                />
                            </div>

                            <div className="wl-input-group space-y-2">
                                <label className="text-white text-sm font-medium">
                                    Project Name <span className="text-[#6B6B70] font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="e.g. Uniswap, Aave, your project"
                                    className="w-full h-12 rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:outline-none transition-all"
                                />
                            </div>

                            <div className="wl-input-group space-y-2">
                                <label className="text-white text-sm font-medium">
                                    Website or Twitter <span className="text-[#6B6B70] font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={projectUrl}
                                    onChange={(e) => setProjectUrl(e.target.value)}
                                    placeholder="https://... or @handle"
                                    className="w-full h-12 rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:outline-none transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="wl-submit-btn w-full h-12 rounded-xl bg-gradient-to-r from-[#FF5C00] to-[#FF8A4C] hover:from-[#FF6B1A] hover:to-[#FF9A5C] disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-all"
                            >
                                {isLoading ? (
                                    <span className="material-symbols-sharp text-xl animate-spin" style={{ fontVariationSettings: "'wght' 300", position: 'relative', zIndex: 1 }}>
                                        progress_activity
                                    </span>
                                ) : (
                                    <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>
                                            rocket_launch
                                        </span>
                                        Join the Waitlist
                                    </span>
                                )}
                            </button>

                            <p className="text-center text-[#8E8E93] text-sm">
                                Already have access?{' '}
                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('login')}
                                    className="text-[#FF5C00] font-medium hover:underline"
                                >
                                    Sign in
                                </button>
                            </p>
                        </form>
                    )}

                    {/* Waitlist Success State */}
                    {mode === 'signup' && waitlistSubmitted && (
                        <div className="space-y-6" style={{ animation: 'wl-fade-up 0.5s ease-out' }}>
                            {/* Animated checkmark */}
                            <div className="flex justify-center">
                                <div
                                    className="relative"
                                    style={{
                                        width: '80px',
                                        height: '80px',
                                    }}
                                >
                                    {/* Pulse rings */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: '-12px',
                                            borderRadius: '50%',
                                            border: '2px solid rgba(255, 92, 0, 0.2)',
                                            animation: 'wl-pulse-ring 2s ease-in-out infinite',
                                        }}
                                    />
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: '-24px',
                                            borderRadius: '50%',
                                            border: '1px solid rgba(255, 92, 0, 0.1)',
                                            animation: 'wl-pulse-ring 2s ease-in-out 0.5s infinite',
                                        }}
                                    />
                                    {/* Circle + check */}
                                    <div
                                        className="flex items-center justify-center"
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, rgba(255,92,0,0.15), rgba(255,138,76,0.1))',
                                            border: '2px solid rgba(255, 92, 0, 0.3)',
                                            animation: 'wl-float 3s ease-in-out infinite',
                                        }}
                                    >
                                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                                            <path
                                                d="M10 18L16 24L26 12"
                                                stroke="#FF5C00"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeDasharray="50"
                                                style={{ animation: 'wl-check-draw 0.6s ease-out 0.3s forwards', strokeDashoffset: 50 }}
                                            />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            {/* Position badge */}
                            {waitlistPosition > 0 && (
                                <div
                                    className="flex justify-center"
                                    style={{ animation: 'wl-fade-up 0.5s ease-out 0.2s backwards' }}
                                >
                                    <div
                                        style={{
                                            padding: '10px 24px',
                                            borderRadius: '100px',
                                            background: 'linear-gradient(135deg, rgba(255,92,0,0.1), rgba(255,138,76,0.05))',
                                            border: '1px solid rgba(255, 92, 0, 0.2)',
                                        }}
                                    >
                                        <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#FF8A4C', fontWeight: 600 }}>
                                            #{waitlistPosition}
                                        </span>
                                        <span className="text-[#8E8E93] text-sm ml-2">on the waitlist</span>
                                    </div>
                                </div>
                            )}

                            {/* Info */}
                            <div
                                className="text-center space-y-3"
                                style={{ animation: 'wl-fade-up 0.5s ease-out 0.4s backwards' }}
                            >
                                <p className="text-[#D1D5DB] text-sm leading-relaxed">
                                    We're onboarding teams in batches. You'll receive an email
                                    at <span className="text-[#FF5C00] font-medium">{email}</span> with
                                    your login credentials when your spot opens up.
                                </p>
                            </div>

                            {/* What to expect */}
                            <div
                                className="bg-[#111113] border border-[#2A2A2E] rounded-xl p-5 space-y-3"
                                style={{ animation: 'wl-fade-up 0.5s ease-out 0.6s backwards' }}
                            >
                                <p className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider">What happens next</p>
                                {[
                                    { icon: 'mail', text: 'Confirmation email sent to your inbox' },
                                    { icon: 'hourglass_top', text: 'We review and prioritize your spot' },
                                    { icon: 'key', text: 'You get access with founding member perks' },
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-sharp text-[#FF5C00] text-sm" style={{ fontVariationSettings: "'wght' 300" }}>
                                                {step.icon}
                                            </span>
                                        </div>
                                        <span className="text-[#D1D5DB] text-sm">{step.text}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Follow CTA */}
                            <div
                                className="text-center"
                                style={{ animation: 'wl-fade-up 0.5s ease-out 0.8s backwards' }}
                            >
                                <p className="text-[#6B6B70] text-xs mb-3">Follow us for updates</p>
                                <a
                                    href="https://x.com/defiaxyz"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1A1A1E] border border-[#2A2A2E] text-white text-sm font-medium hover:bg-[#222226] transition-colors"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                    @defiaxyz
                                </a>
                            </div>

                            <p className="text-center text-[#8E8E93] text-sm">
                                Already have access?{' '}
                                <button
                                    type="button"
                                    onClick={() => { setWaitlistSubmitted(false); handleModeSwitch('login'); }}
                                    className="text-[#FF5C00] font-medium hover:underline"
                                >
                                    Sign in
                                </button>
                            </p>
                        </div>
                    )}

                    {/* Forgot Password Form */}
                    {mode === 'forgot' && (
                        <form onSubmit={handleForgotPassword} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-white text-sm font-medium">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@company.com"
                                    required
                                    className="w-full h-12 rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-12 rounded-xl bg-[#FF5C00] hover:bg-[#FF6B1A] disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
                            >
                                {isLoading ? (
                                    <span className="material-symbols-sharp text-xl animate-spin" style={{ fontVariationSettings: "'wght' 300" }}>
                                        progress_activity
                                    </span>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </button>

                            <p className="text-center text-[#8E8E93] text-sm">
                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('login')}
                                    className="text-[#FF5C00] font-medium hover:underline"
                                >
                                    Back to sign in
                                </button>
                            </p>
                        </form>
                    )}

                    {/* Demo Accounts Info — only in dev mode */}
                    {import.meta.env.DEV && (
                        <div className="mt-8 pt-6 border-t border-[#1F1F23]">
                            <p className="text-[#6B6B70] text-xs text-center mb-3">Demo Accounts (dev only)</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {[
                                    { email: 'enki@defia.io', brand: 'ENKI' },
                                    { email: 'netswap@defia.io', brand: 'Netswap' },
                                    { email: 'metis@defia.io', brand: 'Metis' },
                                    { email: 'lazai@defia.io', brand: 'LazAI' },
                                ].map((demo) => (
                                    <button
                                        key={demo.email}
                                        type="button"
                                        onClick={() => {
                                            setEmail(demo.email);
                                            setMode('login');
                                        }}
                                        className="px-3 py-2 rounded-lg bg-[#1F1F23] hover:bg-[#2A2A2D] text-[#8E8E93] hover:text-white transition-colors text-left"
                                    >
                                        <span className="font-medium">{demo.brand}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
