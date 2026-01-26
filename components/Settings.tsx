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
