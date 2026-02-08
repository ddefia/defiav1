import React, { useEffect, useState } from 'react';
import { BrandConfig } from '../types';
import { loadAutomationSettings, saveAutomationSettings, loadIntegrationKeys, saveIntegrationKeys, getBrandRegistryEntry, saveBrandRegistryEntry, forceSeedDefaultBrands, resetBrandToDefault } from '../services/storage';
import { loadUserProfile, UserProfile } from '../services/auth';

interface SettingsProps {
    brandName: string;
    config: BrandConfig;
    onChange: (newConfig: BrandConfig) => void;
    onNavigateToBrandKit?: () => void;
}

type SettingsTab = 'general' | 'notifications' | 'security' | 'billing';

export const Settings: React.FC<SettingsProps> = ({ brandName, config, onChange, onNavigateToBrandKit }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [automationEnabled, setAutomationEnabled] = useState(true);
    const [darkModeEnabled, setDarkModeEnabled] = useState(true);
    const [apifyHandle, setApifyHandle] = useState('');
    const [lunarSymbol, setLunarSymbol] = useState('');
    const [duneVolumeQuery, setDuneVolumeQuery] = useState('');
    const [duneUsersQuery, setDuneUsersQuery] = useState('');
    const [duneRetentionQuery, setDuneRetentionQuery] = useState('');
    const [savingIntegrations, setSavingIntegrations] = useState(false);
    const [timezone, setTimezone] = useState('UTC +0 (London)');
    const [language, setLanguage] = useState('English (US)');
    const [xApiKey, setXApiKey] = useState('');
    const [xApiSecret, setXApiSecret] = useState('');
    const [xAccessToken, setXAccessToken] = useState('');
    const [xAccessSecret, setXAccessSecret] = useState('');
    const [xConnectStatus, setXConnectStatus] = useState<{ connected: boolean; username?: string | null } | null>(null);
    const [xConnectError, setXConnectError] = useState('');
    const [xConnectLoading, setXConnectLoading] = useState(false);

    // Profile data from auth
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [profileName, setProfileName] = useState('Alex Chen');
    const [profileEmail, setProfileEmail] = useState('alex@web3agency.io');
    const [profileRole, setProfileRole] = useState('Marketing Lead');
    const [profileCompany, setProfileCompany] = useState('Web3 Agency');

    // Brand seeding state
    const [isSeeding, setIsSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<{ success: boolean; brands: string[] } | null>(null);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        const settings = loadAutomationSettings(brandName);
        setAutomationEnabled(settings.enabled);
        const keys = loadIntegrationKeys(brandName);
        setApifyHandle(keys.apify || '');
        setLunarSymbol(keys.lunarCrush || '');
        setDuneVolumeQuery(keys.duneQueryIds?.volume || '');
        setDuneUsersQuery(keys.duneQueryIds?.users || '');
        setDuneRetentionQuery(keys.duneQueryIds?.retention || '');

        // Load user profile from auth
        const profile = loadUserProfile();
        if (profile) {
            setUserProfile(profile);
            if (profile.fullName) setProfileName(profile.fullName);
            if (profile.email) setProfileEmail(profile.email);
            if (profile.role) setProfileRole(profile.role === 'founder' ? 'Founder / CEO' : profile.role.charAt(0).toUpperCase() + profile.role.slice(1));
        }
    }, [brandName]);

    useEffect(() => {
        let isActive = true;
        const fetchXStatus = async () => {
            try {
                const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
                const registryEntry = getBrandRegistryEntry(brandName);
                const brandKey = registryEntry?.brandId || brandName;
                const response = await fetch(`${baseUrl}/api/auth/x/status?brandId=${encodeURIComponent(brandKey)}`);
                if (!response.ok) return;
                const data = await response.json();
                if (isActive) setXConnectStatus(data);
            } catch (e) {
                if (isActive) setXConnectStatus(null);
            }
        };
        fetchXStatus();
        return () => { isActive = false; };
    }, [brandName]);

    const handleConnectX = async () => {
        setXConnectError('');
        setXConnectLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const registryEntry = getBrandRegistryEntry(brandName);
            const brandKey = registryEntry?.brandId || brandName;
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

    const resolveBrandId = async (): Promise<string | null> => {
        const cached = getBrandRegistryEntry(brandName);
        if (cached?.brandId) return cached.brandId;

        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
            const response = await fetch(`${baseUrl}/api/brands/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: brandName })
            });

            if (!response.ok) return null;
            const data = await response.json();
            if (data?.id) {
                saveBrandRegistryEntry(brandName, data.id);
                return data.id;
            }
        } catch (e) {
            console.warn("Failed to resolve brand ID", e);
        }
        return null;
    };

    const handleAutomationToggle = async () => {
        const nextValue = !automationEnabled;
        setAutomationEnabled(nextValue);
        saveAutomationSettings(brandName, { enabled: nextValue, updatedAt: Date.now() });

        const brandId = await resolveBrandId();
        if (!brandId) return;

        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
            await fetch(`${baseUrl}/api/brands/${brandId}/automation`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: nextValue,
                    ownerId: null
                })
            });
        } catch (e) {
            console.warn("Failed to sync automation settings", e);
        }
    };

    const handleSaveIntegrations = async () => {
        setSavingIntegrations(true);
        const nextKeys = {
            apify: apifyHandle,
            lunarCrush: lunarSymbol,
            duneQueryIds: {
                volume: duneVolumeQuery,
                users: duneUsersQuery,
                retention: duneRetentionQuery
            }
        };
        saveIntegrationKeys(nextKeys, brandName);

        const brandId = await resolveBrandId();
        if (brandId) {
            try {
                const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
                await fetch(`${baseUrl}/api/brands/${brandId}/integrations`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apifyHandle,
                        lunarcrushSymbol: lunarSymbol,
                        duneQueryIds: {
                            volume: duneVolumeQuery,
                            users: duneUsersQuery,
                            retention: duneRetentionQuery
                        },
                        xApiKey: xApiKey || undefined,
                        xApiSecret: xApiSecret || undefined,
                        xAccessToken: xAccessToken || undefined,
                        xAccessSecret: xAccessSecret || undefined
                    })
                });
            } catch (e) {
                console.warn("Failed to sync integrations", e);
            }
        }

        setSavingIntegrations(false);
    };

    const tabs: { id: SettingsTab; label: string; icon: string }[] = [
        { id: 'general', label: 'General', icon: 'person' },
        { id: 'notifications', label: 'Notifications', icon: 'notifications' },
        { id: 'security', label: 'Security', icon: 'shield' },
        { id: 'billing', label: 'Billing', icon: 'credit_card' },
    ];

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-6 border-b border-[#1F1F23]">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-white">Settings</h1>
                    <p className="text-sm text-[#6B6B70]">Manage your account and brand settings</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-8 px-10 py-7 overflow-hidden">
                {/* Tabs Column */}
                <div className="w-[220px] flex flex-col gap-1 flex-shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-[#FF5C00] text-white'
                                    : 'text-[#6B6B70] hover:text-white hover:bg-[#1A1A1D]'
                            }`}
                        >
                            <span
                                className="material-symbols-sharp text-xl"
                                style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1, 'wght' 300" : "'wght' 300" }}
                            >
                                {tab.icon}
                            </span>
                            <span className="text-sm font-medium">{tab.label}</span>
                        </button>
                    ))}

                    {/* Divider */}
                    <div className="h-px bg-[#1F1F23] my-2"></div>

                    {/* Brand Kit Link */}
                    <button
                        onClick={onNavigateToBrandKit}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-left border border-[#FF5C0044] text-[#FF5C00] hover:bg-[#FF5C0011] transition-colors"
                    >
                        <span className="material-symbols-sharp text-xl" style={{ fontVariationSettings: "'wght' 300" }}>palette</span>
                        <span className="text-sm font-medium">Brand Kit</span>
                    </button>
                </div>

                {/* Settings Panel */}
                <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
                    {activeTab === 'general' && (
                        <>
                            {/* Profile Information Card */}
                            <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <span className="text-white text-base font-semibold">Profile Information</span>
                                    <button className="text-[#FF5C00] text-sm font-medium hover:underline">Edit</button>
                                </div>

                                <div className="flex gap-6">
                                    {/* Avatar */}
                                    <div className="w-20 h-20 rounded-full bg-[#FF5C00] flex items-center justify-center flex-shrink-0">
                                        <span className="text-white text-[28px] font-semibold">AC</span>
                                    </div>

                                    {/* Fields */}
                                    <div className="flex-1 flex flex-col gap-4">
                                        <div className="flex gap-4">
                                            <div className="flex-1 flex flex-col gap-1.5">
                                                <span className="text-[#6B6B70] text-xs">Full Name</span>
                                                <span className="text-white text-sm">{profileName}</span>
                                            </div>
                                            <div className="flex-1 flex flex-col gap-1.5">
                                                <span className="text-[#6B6B70] text-xs">Email</span>
                                                <span className="text-white text-sm">{profileEmail}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex-1 flex flex-col gap-1.5">
                                                <span className="text-[#6B6B70] text-xs">Role</span>
                                                <span className="text-white text-sm">{profileRole}</span>
                                            </div>
                                            <div className="flex-1 flex flex-col gap-1.5">
                                                <span className="text-[#6B6B70] text-xs">Company</span>
                                                <span className="text-white text-sm">{profileCompany}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Preferences Card */}
                            <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                                <span className="text-white text-base font-semibold mb-5 block">Preferences</span>

                                <div className="flex flex-col gap-4">
                                    {/* Timezone */}
                                    <div className="flex items-center justify-between py-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-white text-sm">Timezone</span>
                                            <span className="text-[#6B6B70] text-xs">Set your local timezone for scheduling</span>
                                        </div>
                                        <button className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1D] border border-[#2E2E2E] rounded-md">
                                            <span className="text-white text-[13px]">{timezone}</span>
                                            <span className="material-symbols-sharp text-[#6B6B70] text-base" style={{ fontVariationSettings: "'wght' 300" }}>expand_more</span>
                                        </button>
                                    </div>

                                    <div className="h-px bg-[#1F1F23]"></div>

                                    {/* Language */}
                                    <div className="flex items-center justify-between py-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-white text-sm">Language</span>
                                            <span className="text-[#6B6B70] text-xs">Select your preferred language</span>
                                        </div>
                                        <button className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1D] border border-[#2E2E2E] rounded-md">
                                            <span className="text-white text-[13px]">{language}</span>
                                            <span className="material-symbols-sharp text-[#6B6B70] text-base" style={{ fontVariationSettings: "'wght' 300" }}>expand_more</span>
                                        </button>
                                    </div>

                                    <div className="h-px bg-[#1F1F23]"></div>

                                    {/* Dark Mode */}
                                    <div className="flex items-center justify-between py-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-white text-sm">Dark Mode</span>
                                            <span className="text-[#6B6B70] text-xs">Enable dark mode interface</span>
                                        </div>
                                        <button
                                            onClick={() => setDarkModeEnabled(!darkModeEnabled)}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${darkModeEnabled ? 'bg-[#FF5C00]' : 'bg-[#2E2E2E]'}`}
                                        >
                                            <span
                                                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${darkModeEnabled ? 'left-[22px]' : 'left-0.5'}`}
                                            ></span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Integrations Card (preserving existing functionality) */}
                            <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                                <span className="text-white text-base font-semibold mb-2 block">Data Integrations</span>
                                <p className="text-[#6B6B70] text-xs mb-5">Connect per-brand data sources to improve analytics and agent accuracy.</p>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#9CA3AF] text-xs font-medium">Apify / X Handle</label>
                                        <input
                                            value={apifyHandle}
                                            onChange={(e) => setApifyHandle(e.target.value)}
                                            placeholder="@yourbrand"
                                            className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white placeholder-[#6B6B70] outline-none focus:border-[#FF5C00] transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#9CA3AF] text-xs font-medium">LunarCrush Symbol</label>
                                        <input
                                            value={lunarSymbol}
                                            onChange={(e) => setLunarSymbol(e.target.value)}
                                            placeholder="ETH, METIS, etc."
                                            className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white placeholder-[#6B6B70] outline-none focus:border-[#FF5C00] transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mb-5">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#9CA3AF] text-xs font-medium">Dune Volume Query</label>
                                        <input
                                            value={duneVolumeQuery}
                                            onChange={(e) => setDuneVolumeQuery(e.target.value)}
                                            placeholder="Query ID"
                                            className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white placeholder-[#6B6B70] outline-none focus:border-[#FF5C00] transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#9CA3AF] text-xs font-medium">Dune Users Query</label>
                                        <input
                                            value={duneUsersQuery}
                                            onChange={(e) => setDuneUsersQuery(e.target.value)}
                                            placeholder="Query ID"
                                            className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white placeholder-[#6B6B70] outline-none focus:border-[#FF5C00] transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#9CA3AF] text-xs font-medium">Dune Retention Query</label>
                                        <input
                                            value={duneRetentionQuery}
                                            onChange={(e) => setDuneRetentionQuery(e.target.value)}
                                            placeholder="Query ID"
                                            className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white placeholder-[#6B6B70] outline-none focus:border-[#FF5C00] transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-[#1F1F23] pt-4 mb-4">
                                    <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest">X Account (Recommended)</span>
                                    <p className="text-[11px] text-[#6B6B70] mt-1 mb-3">
                                        Connect your official X account for the most accurate follower + engagement tracking.
                                        If you skip this, we'll use public data for the handle above.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleConnectX}
                                            disabled={xConnectLoading}
                                            className="px-4 py-2 rounded-lg bg-[#1A1A1D] border border-[#2E2E2E] text-white text-sm font-semibold hover:border-[#FF5C00] disabled:opacity-50"
                                        >
                                            {xConnectLoading ? 'Connecting...' : (xConnectStatus?.connected ? 'Reconnect X' : 'Connect X')}
                                        </button>
                                        <span className={`text-xs ${xConnectStatus?.connected ? 'text-green-400' : 'text-[#6B6B70]'}`}>
                                            {xConnectStatus?.connected ? `Connected as @${xConnectStatus?.username || 'account'}` : 'Not connected'}
                                        </span>
                                    </div>
                                    {xConnectError && (
                                        <p className="text-xs text-red-400 mt-2">{xConnectError}</p>
                                    )}
                                </div>

                                <div className="mt-4 border-t border-[#1F1F23] pt-4">
                                    <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest">X Publishing Credentials</span>
                                    <p className="text-[11px] text-[#6B6B70] mt-1 mb-3">
                                        Stored securely in Supabase for server-side publishing. Leave blank to keep existing values.
                                    </p>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[#9CA3AF] text-xs font-medium">X API Key</label>
                                            <input
                                                value={xApiKey}
                                                onChange={(e) => setXApiKey(e.target.value)}
                                                placeholder="API Key"
                                                className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white placeholder-[#6B6B70] outline-none focus:border-[#FF5C00] transition-colors"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[#9CA3AF] text-xs font-medium">X API Secret</label>
                                            <input
                                                type="password"
                                                value={xApiSecret}
                                                onChange={(e) => setXApiSecret(e.target.value)}
                                                placeholder="API Secret"
                                                className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white placeholder-[#6B6B70] outline-none focus:border-[#FF5C00] transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[#9CA3AF] text-xs font-medium">X Access Token</label>
                                            <input
                                                type="password"
                                                value={xAccessToken}
                                                onChange={(e) => setXAccessToken(e.target.value)}
                                                placeholder="Access Token"
                                                className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white placeholder-[#6B6B70] outline-none focus:border-[#FF5C00] transition-colors"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[#9CA3AF] text-xs font-medium">X Access Secret</label>
                                            <input
                                                type="password"
                                                value={xAccessSecret}
                                                onChange={(e) => setXAccessSecret(e.target.value)}
                                                placeholder="Access Secret"
                                                className="bg-[#1A1A1D] border border-[#2E2E2E] rounded-lg px-3.5 py-3 text-sm text-white placeholder-[#6B6B70] outline-none focus:border-[#FF5C00] transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSaveIntegrations}
                                        disabled={savingIntegrations}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                                        style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                                    >
                                        {savingIntegrations ? (
                                            <>
                                                <span className="material-symbols-sharp text-base animate-spin" style={{ fontVariationSettings: "'wght' 300" }}>progress_activity</span>
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Integrations'
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Brand Data Management Card */}
                            <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="material-symbols-sharp text-[#FF5C00] text-xl" style={{ fontVariationSettings: "'wght' 300" }}>database</span>
                                    <span className="text-white text-base font-semibold">Brand Data Management</span>
                                </div>
                                <p className="text-[#6B6B70] text-xs mb-5">Import demo brands or reset your current brand to its default configuration.</p>

                                <div className="flex flex-col gap-4">
                                    {/* Seed Default Brands */}
                                    <div className="flex items-center justify-between py-3 px-4 bg-[#1A1A1D] rounded-lg border border-[#2E2E2E]">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-white text-sm font-medium">Import Demo Brands</span>
                                            <span className="text-[#6B6B70] text-xs">Add ENKI, Netswap, Metis, and LazAI with all their data</span>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                setIsSeeding(true);
                                                setSeedResult(null);
                                                try {
                                                    const result = await forceSeedDefaultBrands();
                                                    setSeedResult(result);
                                                } finally {
                                                    setIsSeeding(false);
                                                }
                                            }}
                                            disabled={isSeeding}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-sm font-medium disabled:opacity-50 transition-colors"
                                        >
                                            {isSeeding ? (
                                                <>
                                                    <span className="material-symbols-sharp text-base animate-spin" style={{ fontVariationSettings: "'wght' 300" }}>progress_activity</span>
                                                    Importing...
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>download</span>
                                                    Import Brands
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Seed Result */}
                                    {seedResult && (
                                        <div className={`p-3 rounded-lg border ${seedResult.success ? 'bg-[#22C55E]/10 border-[#22C55E]/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`material-symbols-sharp text-base ${seedResult.success ? 'text-[#22C55E]' : 'text-red-400'}`} style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
                                                    {seedResult.success ? 'check_circle' : 'error'}
                                                </span>
                                                <span className={`text-sm font-medium ${seedResult.success ? 'text-[#22C55E]' : 'text-red-400'}`}>
                                                    {seedResult.success
                                                        ? `Successfully imported: ${seedResult.brands.join(', ')}`
                                                        : 'Failed to import brands'}
                                                </span>
                                            </div>
                                            {seedResult.success && (
                                                <p className="text-[#6B6B70] text-xs mt-1 ml-6">Refresh the page or use the sidebar to switch to these brands.</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="h-px bg-[#2E2E2E]"></div>

                                    {/* Reset Current Brand */}
                                    <div className="flex items-center justify-between py-3 px-4 bg-[#1A1A1D] rounded-lg border border-[#2E2E2E]">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-white text-sm font-medium">Reset Current Brand</span>
                                            <span className="text-[#6B6B70] text-xs">Restore "{brandName}" to its default configuration</span>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`Are you sure you want to reset "${brandName}" to its default settings? This will overwrite your customizations.`)) return;
                                                setIsResetting(true);
                                                try {
                                                    await resetBrandToDefault(brandName);
                                                    window.location.reload();
                                                } finally {
                                                    setIsResetting(false);
                                                }
                                            }}
                                            disabled={isResetting}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2E2E2E] hover:bg-[#3A3A3E] text-[#9CA3AF] text-sm font-medium disabled:opacity-50 transition-colors"
                                        >
                                            {isResetting ? (
                                                <>
                                                    <span className="material-symbols-sharp text-base animate-spin" style={{ fontVariationSettings: "'wght' 300" }}>progress_activity</span>
                                                    Resetting...
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>restart_alt</span>
                                                    Reset Brand
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                            <span className="text-white text-base font-semibold mb-4 block">Notification Preferences</span>
                            <p className="text-[#6B6B70] text-sm">Notification settings coming soon.</p>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                            <span className="text-white text-base font-semibold mb-4 block">Security Settings</span>
                            <p className="text-[#6B6B70] text-sm">Security settings coming soon.</p>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="bg-[#111113] border border-[#1F1F23] rounded-[14px] p-6">
                            <span className="text-white text-base font-semibold mb-4 block">Billing & Subscription</span>
                            <p className="text-[#6B6B70] text-sm">Billing settings coming soon.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
