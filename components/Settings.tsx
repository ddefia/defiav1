import React, { useState } from 'react';
import { BrandKit } from './BrandKit';
import { BrandConfig } from '../types';

interface SettingsProps {
    brandName: string;
    config: BrandConfig;
    onChange: (newConfig: BrandConfig) => void;
}

export const Settings: React.FC<SettingsProps> = ({ brandName, config, onChange }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'brandkit'>('brandkit');

    return (
        <div className="w-full h-full flex flex-col bg-brand-bg">
            {/* Header */}
            <div className="px-8 py-6 border-b border-brand-border bg-brand-surface sticky top-0 z-10">
                <h1 className="text-2xl font-display font-bold text-brand-text mb-2">Settings</h1>
                <div className="flex gap-6 text-sm font-medium">
                    <button
                        onClick={() => setActiveTab('brandkit')}
                        className={`pb-2 border-b-2 transition-colors ${activeTab === 'brandkit' ? 'border-brand-accent text-brand-text' : 'border-transparent text-brand-muted hover:text-brand-text'}`}
                    >
                        Brand Kit
                    </button>
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`pb-2 border-b-2 transition-colors ${activeTab === 'general' ? 'border-brand-accent text-brand-text' : 'border-transparent text-brand-muted hover:text-brand-text'}`}
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
                        <div className="animate-fadeIn bg-brand-surface border border-brand-border rounded-xl p-8 text-center text-brand-muted">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚙️</div>
                            <h3 className="text-lg font-bold text-brand-text mb-2">General Settings</h3>
                            <p>Global application settings and user preferences will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
