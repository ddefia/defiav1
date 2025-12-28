import React from 'react';

interface SidebarProps {
    currentSection: string;
    onNavigate: (section: string) => void;
    brandName: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentSection, onNavigate, brandName }) => {
    const navItems = [
        {
            group: 'Overview',
            items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
                { id: 'analytics', label: 'Analytics', icon: 'bar-chart' }, // Placeholder
                { id: 'growth', label: 'Performance', icon: 'trending-up' }, // Maps to Growth
            ]
        },
        {
            group: 'Marketing',
            items: [
                { id: 'studio', label: 'Content Studio', icon: 'edit' }, // Maps to Studio
                { id: 'campaigns', label: 'Campaigns', icon: 'target' }, // Placeholder
                { id: 'calendar', label: 'Calendar', icon: 'calendar' }, // Maps to Calendar
                { id: 'pulse', label: 'Social Media', icon: 'message-circle' }, // Maps to Pulse
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
        'grid': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
        'bar-chart': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>,
        'trending-up': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
        'edit': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
        'target': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
        'calendar': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        'message-circle': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
        'users': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        'settings': <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    };

    return (
        <div className="w-64 h-full bg-white border-r border-gray-100 flex flex-col p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-10">
                <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-lg font-display">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" /></svg>
                </div>
                <span className="font-display font-bold text-lg text-gray-900 tracking-tight">Defia</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar">
                {navItems.map((group, groupIdx) => (
                    <div key={groupIdx}>
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 pl-3">{group.group}</h3>
                        <div className="space-y-1">
                            {group.items.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 
                                    ${currentSection === item.id
                                            ? 'bg-gray-100 text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                                >
                                    <span className={`${currentSection === item.id ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                        {icons[item.icon]}
                                    </span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
                <button
                    onClick={() => onNavigate('pulse')}
                    className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 p-3 rounded-xl flex items-center justify-between group transition-colors"
                >
                    <div className="flex items-center gap-3 font-bold text-sm">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                        Pulse
                    </div>
                    <span className="bg-indigo-200 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">3</span>
                </button>
            </div>
        </div>
    );
};
