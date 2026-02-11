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
    const [isStudioOpen, setIsStudioOpen] = useState(currentSection === 'studio' || currentSection === 'image-editor');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const userProfile = loadUserProfile();

    // Nav items with nested children support
    type NavItem = { id: string; label: string; icon: string; isAccent?: boolean; isSub?: boolean; children?: NavItem[] };
    const mainNavItems: NavItem[] = [
        { id: 'copilot', label: 'AI CMO', icon: 'auto_awesome', isAccent: true },
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { id: 'recommendations', label: 'Recommendations', icon: 'lightbulb', isSub: true },
        { id: 'campaigns', label: 'Campaigns', icon: 'campaign' },
        { id: 'analytics', label: 'Analytics', icon: 'analytics' },
        { id: 'studio', label: 'Content Studio', icon: 'edit_square', children: [
            { id: 'image-editor', label: 'Image Studio', icon: 'image' },
        ]},
        { id: 'calendar', label: 'Content Calendar', icon: 'calendar_month' },
    ];

    const feedsNavItems: NavItem[] = [
        { id: 'news', label: 'Web3 News', icon: 'newspaper' },
        { id: 'twitter-feed', label: 'Twitter Feed', icon: 'tag' },
    ];

    const handleSignOut = async () => {
        await signOut();
    };

    return (
        <div className={`${isCollapsed ? 'w-[68px]' : 'w-[280px]'} h-full flex flex-col shrink-0 transition-all duration-200`} style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
            {/* Header / Logo */}
            <div className={`h-[88px] flex items-center gap-2 ${isCollapsed ? 'px-4 justify-center' : 'px-8'}`} style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF7A2E] to-[#FF5C00] flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-sharp text-white text-lg" style={{ fontVariationSettings: "'wght' 400, 'FILL' 1" }}>
                        bolt
                    </span>
                </div>
                {!isCollapsed && <span className="text-[#FF5C00] font-bold text-lg tracking-wide">DEFIA</span>}
            </div>

            {/* Brand Display (Single Brand) */}
            {brandName && (
                <div className={`${isCollapsed ? 'px-3 py-4' : 'px-6 py-4'}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5C00]/20 to-[#FF5C00]/10 flex items-center justify-center border border-[#FF5C00]/20 flex-shrink-0">
                            <span className="text-[#FF5C00] font-bold text-sm">
                                {brandName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        {!isCollapsed && (
                            <>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{brandName}</p>
                                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>Active Brand</p>
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
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Nav Content */}
            <div className={`flex-1 py-0 ${isCollapsed ? 'px-2' : 'px-4'} overflow-y-auto`}>
                {/* MAIN Section */}
                {!isCollapsed && <div className="px-4 py-4 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>MAIN</div>}
                {isCollapsed && <div className="py-3" />}

                <div className="space-y-0.5">
                    {mainNavItems.map((item) => {
                        const isActive = currentSection === item.id;
                        const hasChildren = item.children && item.children.length > 0;
                        const childActive = hasChildren && item.children!.some(c => currentSection === c.id);
                        const isExpanded = hasChildren && (isStudioOpen || childActive);

                        return (
                            <div key={item.id}>
                                <button
                                    onClick={() => {
                                        if (hasChildren && !isCollapsed) {
                                            setIsStudioOpen(!isStudioOpen);
                                            onNavigate(item.id);
                                        } else {
                                            onNavigate(item.id);
                                        }
                                    }}
                                    title={isCollapsed ? item.label : undefined}
                                    className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} rounded-full transition-colors ${
                                        isCollapsed
                                            ? 'p-3'
                                            : item.isSub ? 'pl-12 pr-4 py-2.5' : 'px-4 py-3'
                                    }`}
                                    style={{
                                        backgroundColor: (isActive || childActive) ? 'var(--hover-bg)' : undefined,
                                        color: item.isAccent ? '#FF5C00' : (isActive || childActive) ? 'var(--text-primary)' : 'var(--text-muted)',
                                    }}
                                >
                                    <span
                                        className={`material-symbols-sharp ${item.isSub && !isCollapsed ? 'text-xl' : 'text-2xl'} flex-shrink-0`}
                                        style={{
                                            color: item.isAccent ? '#FF5C00' : (isActive || childActive) ? 'var(--text-primary)' : 'var(--text-muted)',
                                            fontVariationSettings: "'wght' 100"
                                        }}
                                    >
                                        {item.icon}
                                    </span>
                                    {!isCollapsed && (
                                        <span className={`${item.isSub ? 'text-sm' : 'text-base'} flex-1 text-left`}>{item.label}</span>
                                    )}
                                    {!isCollapsed && hasChildren && (
                                        <span
                                            className="material-symbols-sharp text-lg text-[#6B6B70] transition-transform duration-200"
                                            style={{ fontVariationSettings: "'wght' 100", transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                                        >
                                            expand_more
                                        </span>
                                    )}
                                </button>
                                {/* Sub-items */}
                                {!isCollapsed && hasChildren && isExpanded && item.children!.map(child => {
                                    const isChildActive = currentSection === child.id;
                                    return (
                                        <button
                                            key={child.id}
                                            onClick={() => onNavigate(child.id)}
                                            className="w-full flex items-center gap-4 pl-12 pr-4 py-2.5 rounded-full transition-colors"
                                            style={{
                                                backgroundColor: isChildActive ? 'var(--hover-bg)' : undefined,
                                                color: isChildActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                            }}
                                        >
                                            <span
                                                className="material-symbols-sharp text-xl"
                                                style={{
                                                    color: isChildActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                                    fontVariationSettings: "'wght' 100"
                                                }}
                                            >
                                                {child.icon}
                                            </span>
                                            <span className="text-sm">{child.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* FEEDS Section */}
                {!isCollapsed && <div className="px-4 py-4 text-sm font-normal mt-2" style={{ color: 'var(--text-muted)' }}>FEEDS</div>}
                {isCollapsed && <div className="py-2 my-2" style={{ borderTop: '1px solid var(--border)' }} />}

                <div className="space-y-1">
                    {feedsNavItems.map((item) => {
                        const isActive = currentSection === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                title={isCollapsed ? item.label : undefined}
                                className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3'} rounded-full transition-colors`}
                                style={{
                                    backgroundColor: isActive ? 'var(--hover-bg)' : undefined,
                                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                }}
                            >
                                <span
                                    className="material-symbols-sharp text-2xl flex-shrink-0"
                                    style={{
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                        fontVariationSettings: "'wght' 100"
                                    }}
                                >
                                    {item.icon}
                                </span>
                                {!isCollapsed && <span className="text-base">{item.label}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Collapse Toggle */}
            <div className={`${isCollapsed ? 'px-2' : 'px-4'} py-2`}>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3'} rounded-full transition-colors`}
                    style={{ color: 'var(--text-muted)' }}
                >
                    <span
                        className="material-symbols-sharp text-xl flex-shrink-0 transition-transform duration-200"
                        style={{ fontVariationSettings: "'wght' 300", color: 'var(--text-muted)', transform: isCollapsed ? 'rotate(180deg)' : 'none' }}
                    >
                        keyboard_double_arrow_left
                    </span>
                    {!isCollapsed && <span className="text-sm">Collapse</span>}
                </button>
            </div>

            {/* Footer / User Profile */}
            <div className={`${isCollapsed ? 'px-2' : 'px-6'} py-4`} style={{ borderTop: '1px solid var(--border)' }}>
                <div
                    className={`flex items-center ${isCollapsed ? 'justify-center p-1' : 'gap-3 p-2'} cursor-pointer rounded-xl hover:bg-[#1F1F23]/50 transition-colors`}
                    onClick={() => isCollapsed ? onNavigate('settings') : setIsUserMenuOpen(!isUserMenuOpen)}
                >
                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2A2A2D] to-[#1F1F23] flex items-center justify-center border border-[#2A2A2D] flex-shrink-0">
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
                    {!isCollapsed && (
                        <>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                    {userProfile?.fullName || 'User'}
                                </p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                    {userProfile?.email || 'No email'}
                                </p>
                            </div>
                            <span
                                className="material-symbols-sharp text-xl text-[#6B6B70]"
                                style={{ fontVariationSettings: "'wght' 100" }}
                            >
                                {isUserMenuOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                            </span>
                        </>
                    )}
                </div>

                {/* User Menu Dropdown */}
                {isUserMenuOpen && !isCollapsed && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>
                        <div className="absolute bottom-24 left-4 right-4 rounded-xl shadow-xl p-2 z-20" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
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
