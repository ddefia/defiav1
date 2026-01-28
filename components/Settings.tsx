import React, { useEffect, useState } from 'react';
import { BrandKit } from './BrandKit';
import { BrandConfig } from '../types';
import { loadAutomationSettings, saveAutomationSettings, loadIntegrationKeys, saveIntegrationKeys, getBrandRegistryEntry, saveBrandRegistryEntry } from '../services/storage';

interface SettingsProps {
    brandName: string;
    config: BrandConfig;
    onChange: (newConfig: BrandConfig) => void;
}

export const Settings: React.FC<SettingsProps> = ({ brandName, config, onChange }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'brandkit'>('brandkit');
    const [automationEnabled, setAutomationEnabled] = useState(true);
    const [apifyHandle, setApifyHandle] = useState('');
    const [lunarSymbol, setLunarSymbol] = useState('');
    const [duneVolumeQuery, setDuneVolumeQuery] = useState('');
    const [duneUsersQuery, setDuneUsersQuery] = useState('');
    const [duneRetentionQuery, setDuneRetentionQuery] = useState('');
    const [savingIntegrations, setSavingIntegrations] = useState(false);

    useEffect(() => {
        const settings = loadAutomationSettings(brandName);
        setAutomationEnabled(settings.enabled);
        const keys = loadIntegrationKeys(brandName);
        setApifyHandle(keys.apify || '');
        setLunarSymbol(keys.lunarCrush || '');
        setDuneVolumeQuery(keys.duneQueryIds?.volume || '');
        setDuneUsersQuery(keys.duneQueryIds?.users || '');
        setDuneRetentionQuery(keys.duneQueryIds?.retention || '');
    }, [brandName]);

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
                        }
                    })
                });
            } catch (e) {
                console.warn("Failed to sync integrations", e);
            }
        }

        setSavingIntegrations(false);
    };

    return (
        <div className="w-full h-full flex flex-col bg-[#F9FAFB]">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-200 bg-white shadow-sm flex items-center justify-between shrink-0">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
                <div className="flex gap-1 text-sm font-bold bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('brandkit')}
                        className={`px-3 py-1.5 rounded-md transition-all ${activeTab === 'brandkit' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Brand Kit
                    </button>
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-3 py-1.5 rounded-md transition-all ${activeTab === 'general' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        General
                    </button>
                </div>
            </div>

            {/* Content SCROLLABLE AREA */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="max-w-5xl mx-auto">
                    {activeTab === 'brandkit' && (
                        <div className="animate-fadeIn">
                            <BrandKit
                                brandName={brandName}
                                config={config}
                                onChange={onChange}
                            />
                        </div>
                    )}

                    {activeTab === 'general' && (
                        <div className="animate-fadeIn bg-brand-surface border border-brand-border rounded-xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl">⚙️</div>
                                <div>
                                    <h3 className="text-lg font-bold text-brand-text">General Settings</h3>
                                    <p className="text-sm text-brand-muted">Control automation and system behavior.</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border border-brand-border rounded-xl p-4 bg-white">
                                <div>
                                    <div className="text-sm font-semibold text-brand-text">Automation mode</div>
                                    <p className="text-xs text-brand-muted">Enable always-on recommendations in the Action Center.</p>
                                </div>
                                <button
                                    onClick={handleAutomationToggle}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${automationEnabled ? 'bg-brand-accent' : 'bg-gray-300'}`}
                                    aria-pressed={automationEnabled}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${automationEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>

                            <div className="mt-6 border border-brand-border rounded-xl p-5 bg-white space-y-4">
                                <div>
                                    <div className="text-sm font-semibold text-brand-text">Data Integrations</div>
                                    <p className="text-xs text-brand-muted">Connect per-brand data sources to improve analytics and agent accuracy.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide">
                                        Apify / X Handle
                                        <input
                                            value={apifyHandle}
                                            onChange={(e) => setApifyHandle(e.target.value)}
                                            placeholder="@yourbrand"
                                            className="mt-2 w-full border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text"
                                        />
                                    </label>
                                    <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide">
                                        LunarCrush Symbol
                                        <input
                                            value={lunarSymbol}
                                            onChange={(e) => setLunarSymbol(e.target.value)}
                                            placeholder="ETH, METIS, etc."
                                            className="mt-2 w-full border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text"
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide">
                                        Dune Volume Query
                                        <input
                                            value={duneVolumeQuery}
                                            onChange={(e) => setDuneVolumeQuery(e.target.value)}
                                            placeholder="Query ID"
                                            className="mt-2 w-full border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text"
                                        />
                                    </label>
                                    <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide">
                                        Dune Users Query
                                        <input
                                            value={duneUsersQuery}
                                            onChange={(e) => setDuneUsersQuery(e.target.value)}
                                            placeholder="Query ID"
                                            className="mt-2 w-full border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text"
                                        />
                                    </label>
                                    <label className="text-xs font-semibold text-brand-muted uppercase tracking-wide">
                                        Dune Retention Query
                                        <input
                                            value={duneRetentionQuery}
                                            onChange={(e) => setDuneRetentionQuery(e.target.value)}
                                            placeholder="Query ID"
                                            className="mt-2 w-full border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text"
                                        />
                                    </label>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={handleSaveIntegrations} isLoading={savingIntegrations}>
                                        Save Integrations
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
