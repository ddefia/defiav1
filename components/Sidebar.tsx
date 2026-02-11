import React, { useState } from 'react';
import { BrandConfig } from '../types';
import { signOut, loadUserProfile } from '../services/auth';

interface SidebarProps {
    currentSection: string;
    onNavigate: (section: string) => void;
    brandName: string;
    profiles: Record<string, BrandConfig>;
    onSelectBrand: (brand: string) => void;
    onConnect: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    currentSection,
    onNavigate,
    brandName,
    profiles,
    onSelectBrand,
    onConnect
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userProfile = loadUserProfile();

    const mainNavItems = [
        { id: 'copilot', label: 'AI CMO', icon: 'auto_awesome', isAccent: true },
        { id: 'recommendations', label: 'Recommendations', icon: 'lightbulb' },
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'campaigns', label: 'Campaigns', icon: 'campaign' },
        { id: 'analytics', label: 'Analytics', icon: 'analytics' },
        { id: 'studio', label: 'Content Studio', icon: 'edit_square' },
        { id: 'image-editor', label: 'Image Studio', icon: 'image' },
        { id: 'calendar', label: 'Content Calendar', icon: 'calendar_month' },
    ];

    const feedsNavItems = [
        { id: 'news', label: 'Web3 News', icon: 'newspaper' },
        { id: 'twitter-feed', label: 'Twitter Feed', icon: 'tag' },
    ];

    const handleSignOut = async () => {
        await signOut();
    };

    return (
        <div className="w-[280px] h-full bg-[#111113] border-r border-[#1F1F23] flex flex-col shrink-0">
            {/* Header / Logo */}
            <div className="h-[88px] flex items-center gap-2 px-8 border-b border-[#1F1F23]">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF7A2E] to-[#FF5C00] flex items-center justify-center">
                    <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'wght' 400, 'FILL' 1" }}>
                        bolt
                    </span>
                </div>
                <span className="text-[#FF5C00] font-bold text-lg tracking-wide">DEFIA</span>
            </div>

            {/* Brand Display (Single Brand) */}
            {brandName && (
                <div className="px-6 py-4 border-b border-[#1F1F23]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5C00]/20 to-[#FF5C00]/10 flex items-center justify-center border border-[#FF5C00]/20">
                            <span className="text-[#FF5C00] font-bold text-sm">
                                {brandName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm truncate">{brandName}</p>
                            <p className="text-[#6B6B70] text-xs truncate">Active Brand</p>
                        </div>
                        <button
                            onClick={() => onNavigate('settings')}
                            className="p-2 hover:bg-[#1F1F23] rounded-lg transition-colors"
                        >
                            <span
                                className="material-symbols-sharp text-lg text-[#6B6B70]"
                                style={{ fontVariationSettings: "'wght' 100" }}
                            >
                                settings
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* Nav Content */}
            <div className="flex-1 py-0 px-4 overflow-y-auto">
                {/* MAIN Section */}
                <div className="px-4 py-4 text-[#6B6B70] text-sm font-normal">MAIN</div>

                <div className="space-y-1">
                    {mainNavItems.map((item) => {
                        const isActive = currentSection === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`w-full flex items-center gap-4 px-4 py-3 rounded-full transition-colors ${
                                    isActive
                                        ? 'bg-[#1F1F23] text-white'
                                        : item.isAccent
                                            ? 'text-[#FF5C00] hover:bg-[#1F1F23]/50'
                                            : 'text-[#6B6B70] hover:bg-[#1F1F23]/50 hover:text-white'
                                }`}
                            >
                                <span
                                    className="material-symbols-sharp text-2xl"
                                    style={{
                                        color: item.isAccent ? '#FF5C00' : isActive ? '#FFFFFF' : '#6B6B70',
                                        fontVariationSettings: "'wght' 100"
                                    }}
                                >
                                    {item.icon}
                                </span>
                                <span className="text-base">{item.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* FEEDS Section */}
                <div className="px-4 py-4 text-[#6B6B70] text-sm font-normal mt-2">FEEDS</div>

                <div className="space-y-1">
                    {feedsNavItems.map((item) => {
                        const isActive = currentSection === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`w-full flex items-center gap-4 px-4 py-3 rounded-full transition-colors ${
                                    isActive
                                        ? 'bg-[#1F1F23] text-white'
                                        : 'text-[#6B6B70] hover:bg-[#1F1F23]/50 hover:text-white'
                                }`}
                            >
                                <span
                                    className="material-symbols-sharp text-2xl"
                                    style={{
                                        color: isActive ? '#FFFFFF' : '#6B6B70',
                                        fontVariationSettings: "'wght' 100"
                                    }}
                                >
                                    {item.icon}
                                </span>
                                <span className="text-base">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Footer / User Profile */}
            <div className="px-6 py-4 border-t border-[#1F1F23]">
                <div
                    className="flex items-center gap-3 cursor-pointer p-2 rounded-xl hover:bg-[#1F1F23]/50 transition-colors"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2A2A2D] to-[#1F1F23] flex items-center justify-center border border-[#2A2A2D]">
                        {userProfile?.avatarUrl ? (
                            <img
                                src={userProfile.avatarUrl}
                                alt="avatar"
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <span className="text-[#6B6B70] text-sm font-medium">
                                {userProfile?.fullName?.charAt(0)?.toUpperCase() || userProfile?.email?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                            {userProfile?.fullName || 'User'}
                        </p>
                        <p className="text-[#6B6B70] text-xs truncate">
                            {userProfile?.email || 'No email'}
                        </p>
                    </div>
                    <span
                        className="material-symbols-sharp text-xl text-[#6B6B70]"
                        style={{ fontVariationSettings: "'wght' 100" }}
                    >
                        {isUserMenuOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                    </span>
                </div>

                {/* User Menu Dropdown */}
                {isUserMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>
                        <div className="absolute bottom-24 left-4 right-4 bg-[#1F1F23] rounded-xl shadow-xl border border-[#2A2A2D] p-2 z-20">
                            <button
                                onClick={() => { onNavigate('settings'); setIsUserMenuOpen(false); }}
                                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 hover:bg-[#2A2A2D] text-[#ADADB0] hover:text-white"
                            >
                                <span
                                    className="material-symbols-sharp text-lg"
                                    style={{ fontVariationSettings: "'wght' 100" }}
                                >
                                    settings
                                </span>
                                Settings
                            </button>
                            <div className="h-[1px] bg-[#2A2A2D] my-2"></div>
                            <button
                                onClick={handleSignOut}
                                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 hover:bg-red-500/10 text-red-400"
                            >
                                <span
                                    className="material-symbols-sharp text-lg"
                                    style={{ fontVariationSettings: "'wght' 100" }}
                                >
                                    logout
                                </span>
                                Sign Out
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
