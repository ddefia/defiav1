import React, { useEffect, useState } from 'react';
import { BrandKit } from './BrandKit';
import { BrandConfig } from '../types';
import { loadAutomationSettings, saveAutomationSettings } from '../services/storage';

interface SettingsProps {
    brandName: string;
    config: BrandConfig;
    onChange: (newConfig: BrandConfig) => void;
}

export const Settings: React.FC<SettingsProps> = ({ brandName, config, onChange }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'brandkit'>('brandkit');
    const [automationEnabled, setAutomationEnabled] = useState(true);

    useEffect(() => {
        const settings = loadAutomationSettings(brandName);
        setAutomationEnabled(settings.enabled);
    }, [brandName]);

    const handleAutomationToggle = () => {
        const nextValue = !automationEnabled;
        setAutomationEnabled(nextValue);
        saveAutomationSettings(brandName, { enabled: nextValue, updatedAt: Date.now() });
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
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
