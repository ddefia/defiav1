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

    const navItems = [
        {
            group: 'Overview',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'analytics', label: 'Analytics', icon: 'bar-chart' },
                { id: 'growth', label: 'Performance', icon: 'trending-up' },
            ]
        },
        {
            group: 'Marketing',
            items: [
                { id: 'studio', label: 'Content Studio', icon: 'edit' },
                { id: 'campaigns', label: 'Campaigns', icon: 'target' },
                { id: 'calendar', label: 'Calendar', icon: 'calendar' },
                { id: 'pulse', label: 'Social Media', icon: 'message-circle' },
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

    const icons: Record<string, JSX.Element> = {
        'grid': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
        'bar-chart': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>,
        'trending-up': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
        'edit': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
        'target': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
        'calendar': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        'message-circle': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
        'users': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        'settings': <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    };

    return (
        <div className={`${isCollapsed ? 'w-20' : 'w-64'} h-full bg-white border-r border-gray-100 flex flex-col transition-all duration-300 relative`}>
            {/* Collapse Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-8 bg-white border border-gray-200 rounded-full w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-900 shadow-sm z-10"
            >
                <svg className={`w-3 h-3 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Header / Brand Selector */}
            <div className={`p-6 ${isCollapsed ? 'items-center px-4' : ''}`}>
                <div
                    className={`flex items-center gap-3 ${!isCollapsed && 'cursor-pointer hover:opacity-80 transition-opacity relative'}`}
                    onClick={() => !isCollapsed && setIsBrandMenuOpen(!isBrandMenuOpen)}
                >
                    <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold text-lg font-display shrink-0">
                        {brandName.charAt(0)}
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <span className="font-display font-bold text-lg text-gray-900 tracking-tight block truncate">{brandName}</span>
                        </div>
                    )}

                    {!isCollapsed && (
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </div>

                {/* Dropdown Menu */}
                {isBrandMenuOpen && !isCollapsed && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsBrandMenuOpen(false)}></div>
                        <div className="absolute top-20 left-4 right-4 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-20 animate-fadeIn">
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {Object.keys(profiles).map(b => (
                                    <button
                                        key={b}
                                        onClick={() => { onSelectBrand(b); setIsBrandMenuOpen(false); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${brandName === b ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                    >
                                        <div className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                            {b.charAt(0)}
                                        </div>
                                        {b}
                                    </button>
                                ))}
                            </div>
                            <div className="h-[1px] bg-gray-100 my-1"></div>
                            <button
                                onClick={() => { onConnect(); setIsBrandMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-brand-accent hover:bg-indigo-50 transition-colors flex items-center gap-2"
                            >
                                <plus className="w-4 h-4">+</plus> Connect New
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Nav Items */}
            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar px-3 py-2">
                {navItems.map((group, groupIdx) => (
                    <div key={groupIdx}>
                        {!isCollapsed && (
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 pl-3">{group.group}</h3>
                        )}
                        <div className="space-y-1">
                            {group.items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                                    ${currentSection === item.id
                                            ? 'bg-gray-900 text-white shadow-lg shadow-gray-200'
                                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                                >
                                    <span className={`${currentSection === item.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} shrink-0`}>
                                        {icons[item.icon]}
                                    </span>

                                    {!isCollapsed && (
                                        <span>{item.label}</span>
                                    )}

                                    {/* Tooltip on Collapsed */}
                                    {isCollapsed && (
                                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                            {item.label}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer / Pulse */}
            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={() => onNavigate('pulse')}
                    className={`w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl flex items-center group transition-colors border border-indigo-100
                  ${isCollapsed ? 'justify-center p-3' : 'justify-between p-3'}`}
                >
                    <div className="flex items-center gap-3 font-bold text-sm">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shrink-0"></span>
                        {!isCollapsed && "Pulse"}
                    </div>
                    {!isCollapsed && (
                        <span className="bg-indigo-200 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">3</span>
                    )}
                </button>
            </div>
        </div>
    );
};
