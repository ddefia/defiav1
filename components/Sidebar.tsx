import React, { useState } from 'react';
import { BrandConfig } from '../types';

interface SidebarProps {
    currentSection: string;
    onNavigate: (section: string) => void;
    brandName: string;
    profiles: Record<string, BrandConfig>;
    onSelectBrand: (brand: string) => void;
    onConnect: () => void;
}

interface NavItem {
    id: string;
    label: string;
    icon: string;
    children?: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
    currentSection,
    onNavigate,
    brandName,
    profiles,
    onSelectBrand,
    onConnect
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);

    // State for expanded parent items
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
        'studio': true // Default open for visibility if needed, or rely on effect
    });

    const toggleExpand = (id: string) => {
        setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const navItems = [
        {
            group: 'Overview',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'copilot', label: 'Copilot', icon: 'sparkles' },
                { id: 'brain', label: 'Strategy', icon: 'brain' },
                { id: 'growth', label: 'Growth', icon: 'trending-up' },
                { id: 'analytics', label: 'Analytics', icon: 'bar-chart' },
            ]
        },
        {
            group: 'Marketing',
            items: [
                {
                    id: 'studio',
                    label: 'Studio',
                    icon: 'edit',
                    children: [
                        { id: 'image-editor', label: 'Image Editor', icon: 'image' },
                    ]
                },
                { id: 'campaigns', label: 'Campaigns', icon: 'target' },
                { id: 'calendar', label: 'Calendar', icon: 'calendar' },
                { id: 'social', label: 'Social Media', icon: 'message-circle' },
            ]
        },
        {
            group: 'Management',
            items: [
                { id: 'audience', label: 'Audience', icon: 'users' },
                { id: 'settings', label: 'Settings', icon: 'settings' },
            ]
        }
    ];

    const icons: Record<string, React.ReactNode> = {
        'grid': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
        'bar-chart': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>,
        'trending-up': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
        'edit': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
        'target': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
        'calendar': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        'message-circle': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
        'users': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        'settings': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        'brain': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M3.343 15.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
        'sparkles': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
        'image': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    };

    return (
        <div className={`${isCollapsed ? 'w-20' : 'w-72'} h-full bg-brand-surface border-r border-brand-border flex flex-col transition-all duration-300 relative shadow-sm z-50`}>
            {/* Collapse Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-8 bg-brand-surface border border-brand-border rounded-full w-6 h-6 flex items-center justify-center text-brand-muted hover:text-brand-text shadow-sm z-10 hover:shadow-md transition-all"
            >
                <svg className={`w-3 h-3 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Header / Brand Selector */}
            <div className={`pt-8 pb-6 ${isCollapsed ? 'px-3 flex justify-center' : 'px-6'}`}>
                <div
                    className={`flex items-center gap-3 p-2 -ml-2 rounded-xl transition-all duration-200 ${!isCollapsed ? 'cursor-pointer hover:bg-brand-surfaceHighlight' : ''}`}
                    onClick={() => !isCollapsed && setIsBrandMenuOpen(!isBrandMenuOpen)}
                >
                    <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-white shrink-0 shadow-lg shadow-gray-200">
                        <span className="font-display font-bold text-xl">{brandName.charAt(0)}</span>
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <span className="font-display font-bold text-lg text-brand-text tracking-tight block truncate">{brandName}</span>
                            <span className="text-xs text-brand-textSecondary block truncate">Enterprise Plan</span>
                        </div>
                    )}

                    {!isCollapsed && (
                        <svg className="w-4 h-4 text-brand-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </div>

                {/* Dropdown Menu */}
                {isBrandMenuOpen && !isCollapsed && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsBrandMenuOpen(false)}></div>
                        <div className="absolute top-24 left-4 right-4 bg-brand-surface rounded-xl shadow-premium-hover border border-brand-border p-2 z-20 animate-fadeIn">
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {Object.keys(profiles).map(b => (
                                    <button
                                        key={b}
                                        onClick={() => { onSelectBrand(b); setIsBrandMenuOpen(false); }}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${brandName === b ? 'bg-brand-surfaceHighlight text-brand-accent' : 'hover:bg-brand-surfaceHighlight text-brand-textSecondary hover:text-brand-text'}`}
                                    >
                                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${brandName === b ? 'bg-indigo-100 text-brand-accent' : 'bg-gray-100 text-gray-500'}`}>
                                            {b.charAt(0)}
                                        </div>
                                        {b}
                                    </button>
                                ))}
                            </div>
                            <div className="h-[1px] bg-brand-border my-2"></div>
                            <button
                                onClick={() => { onConnect(); setIsBrandMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-brand-accent hover:bg-indigo-50 transition-colors flex items-center gap-2"
                            >
                                <span className="w-4 h-4 flex items-center justify-center border border-current rounded-full text-[10px]">+</span> Connect Brand
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Nav Items */}
            <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar px-4 py-2">
                {navItems.map((group, groupIdx) => (
                    <div key={groupIdx}>
                        {!isCollapsed && (
                            <h3 className="text-[11px] font-bold text-brand-muted/80 uppercase tracking-wider mb-3 pl-3 font-display">{group.group}</h3>
                        )}
                        <div className="space-y-1">
                            {group.items.map(item => {
                                const isActive = currentSection === item.id;
                                const hasChildren = item.children && item.children.length > 0;
                                const isExpanded = expandedItems[item.id];

                                // Check if child is active
                                const isChildActive = item.children?.some(c => c.id === currentSection);

                                return (
                                    <div key={item.id}>
                                        <button
                                            onClick={() => {
                                                onNavigate(item.id);
                                                if (hasChildren) toggleExpand(item.id);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                                            ${isActive || isChildActive
                                                    ? 'bg-brand-text text-brand-surface shadow-md shadow-gray-200'
                                                    : 'text-brand-textSecondary hover:text-brand-text hover:bg-brand-surfaceHighlight'}`}
                                        >
                                            <span className={`${isActive || isChildActive ? 'text-brand-surface' : 'text-brand-muted group-hover:text-brand-text'} shrink-0 transition-colors`}>
                                                {icons[item.icon]}
                                            </span>

                                            {!isCollapsed && (
                                                <span className="flex-1 text-left">{item.label}</span>
                                            )}

                                            {/* Chevron for Parent */}
                                            {!isCollapsed && hasChildren && (
                                                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''} ${isActive || isChildActive ? 'text-brand-surface' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            )}

                                            {/* Tooltip on Collapsed */}
                                            {isCollapsed && (
                                                <div className="absolute left-full ml-4 px-3 py-1.5 bg-brand-text text-brand-surface text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl translate-x-[-10px] group-hover:translate-x-0 transition-all duration-200">
                                                    {item.label}
                                                    {/* Arrow */}
                                                    <div className="absolute top-1/2 -left-1 w-2 h-2 bg-brand-text transform -translate-y-1/2 rotate-45"></div>
                                                </div>
                                            )}
                                        </button>

                                        {/* CHILDREN Rendering */}
                                        {!isCollapsed && hasChildren && isExpanded && (
                                            <div className="mt-1 ml-4 border-l border-gray-200 pl-2 space-y-1 animate-fadeIn">
                                                {item.children?.map(child => {
                                                    const isChildSelected = currentSection === child.id;
                                                    return (
                                                        <button
                                                            key={child.id}
                                                            onClick={() => onNavigate(child.id)}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                                                                ${isChildSelected
                                                                    ? 'bg-gray-100 text-gray-900'
                                                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <span className={isChildSelected ? 'text-gray-900' : 'text-gray-400'}>
                                                                {icons[child.icon] || <span className="w-1.5 h-1.5 rounded-full bg-current"></span>}
                                                            </span>
                                                            {child.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Pulse Button (Bottom Pinned) */}
            <div className="px-4 pb-4">
                <button
                    onClick={() => onNavigate('pulse')}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${currentSection === 'pulse' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 hover:shadow-md border border-indigo-100'}`}
                >
                    <div className={`absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-0 transition-opacity duration-300 ${currentSection === 'pulse' ? 'opacity-100' : 'group-hover:opacity-10'}`}></div>

                    <span className={`relative z-10 shrink-0 ${currentSection === 'pulse' ? 'text-white' : 'text-indigo-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </span>

                    {!isCollapsed && (
                        <span className={`relative z-10 font-bold font-display tracking-wide ${currentSection === 'pulse' ? 'text-white' : 'text-indigo-900'}`}>PULSE</span>
                    )}

                    {!isCollapsed && (
                        <span className="relative z-10 ml-auto flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                    )}
                </button>
            </div>

            {/* Footer / Profile */}
            <div className="p-4 border-t border-brand-border bg-brand-surface">
                <button className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-brand-surfaceHighlight transition-colors ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-brand-accent font-bold text-xs ring-4 ring-white border border-indigo-200/50">
                        MK
                    </div>
                    {!isCollapsed && (
                        <div className="text-left overflow-hidden">
                            <p className="text-sm font-bold text-brand-text truncate">Mike K.</p>
                            <p className="text-[10px] text-brand-textSecondary truncate">mike@defia.com</p>
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
};
