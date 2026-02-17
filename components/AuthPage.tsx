import React, { useState, useEffect } from 'react';
import { signIn, signUp, sendPasswordReset } from '../services/auth';
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
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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
        // If we have an external switch handler and switching between login/signup
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
                // Check if user already has a brand linked
                const existingBrand = getCurrentUserBrand();
                onSuccess(!!existingBrand);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setIsLoading(true);

        try {
            const { user, error: authError } = await signUp(email, password, { fullName });
            if (authError) {
                setError(authError);
            } else if (user) {
                onSuccess();
            }
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
                            Your AI-Powered<br />Marketing Command Center
                        </h1>
                        <p className="text-[#8E8E93] text-base leading-relaxed max-w-[380px]">
                            Automate your Web3 marketing with AI that understands your brand,
                            creates compelling content, and executes strategies 24/7.
                        </p>
                    </div>

                    {/* Features */}
                    <div className="space-y-4">
                        {[
                            { icon: 'auto_awesome', text: 'AI CMO that learns your brand voice' },
                            { icon: 'campaign', text: 'Automated campaign generation' },
                            { icon: 'analytics', text: 'Real-time social analytics' },
                            { icon: 'calendar_month', text: 'Smart content scheduling' },
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3">
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

            {/* Right Panel - Auth Form */}
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
                            {mode === 'signup' && 'Create your account'}
                            {mode === 'forgot' && 'Reset your password'}
                        </h2>
                        <p className="text-[#8E8E93] text-sm">
                            {mode === 'login' && 'Sign in to access your AI CMO dashboard'}
                            {mode === 'signup' && 'Start your 24-hour free trial'}
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
                                    Sign up
                                </button>
                            </p>
                        </form>
                    )}

                    {/* Signup Form */}
                    {mode === 'signup' && (
                        <form onSubmit={handleSignup} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-white text-sm font-medium">Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    required
                                    className="w-full h-12 rounded-xl bg-[#111113] border border-[#2A2A2E] px-4 text-white placeholder-[#6B6B70] focus:border-[#FF5C00] focus:outline-none transition-colors"
                                />
                            </div>

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
                                <label className="text-white text-sm font-medium">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Create a password (min 6 characters)"
                                        required
                                        minLength={6}
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

                            <div className="space-y-2">
                                <label className="text-white text-sm font-medium">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
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
                                    'Create Account'
                                )}
                            </button>

                            <p className="text-center text-[#8E8E93] text-sm">
                                Already have an account?{' '}
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

                    {/* Terms */}
                    {mode === 'signup' && (
                        <p className="text-center text-[#6B6B70] text-xs">
                            By creating an account, you agree to our{' '}
                            <a href="/terms" className="text-[#FF5C00] hover:underline">Terms of Service</a>
                            {' '}and{' '}
                            <a href="/privacy" className="text-[#FF5C00] hover:underline">Privacy Policy</a>
                        </p>
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
