
import React, { useState, useRef } from 'react';
import { CalendarEvent } from '../types';
import { Button } from './Button';

interface ContentCalendarProps {
    brandName: string;
    events: CalendarEvent[];
    onDeleteEvent: (id: string) => void;
    onAddEvent: (date: string) => void;
    onMoveEvent: (id: string, newDate: string) => void;
    onUpdateEvent: (id: string, updatedFields: Partial<CalendarEvent>) => void;
}

export const ContentCalendar: React.FC<ContentCalendarProps> = ({ brandName, events, onDeleteEvent, onAddEvent, onMoveEvent, onUpdateEvent }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    
    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editDate, setEditDate] = useState('');

    const calendarFileInputRef = useRef<HTMLInputElement>(null);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month, 1).getDay();
    };

    const changeMonth = (offset: number) => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
        setCurrentDate(newDate);
    };

    const formatDate = (day: number) => {
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
        const d = day.toString().padStart(2, '0');
        return `${year}-${month}-${d}`;
    };

    const handleEventClick = (ev: CalendarEvent) => {
        setSelectedEvent(ev);
        setIsEditing(false);
        setEditContent(ev.content);
        setEditDate(ev.date);
    };

    const handleSaveChanges = () => {
        if (!selectedEvent) return;
        onUpdateEvent(selectedEvent.id, { content: editContent, date: editDate });
        setSelectedEvent({ ...selectedEvent, content: editContent, date: editDate }); // Local update for UI
        setIsEditing(false);
    };

    const handleCalendarImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !selectedEvent) return;
        
        const file = files[0];
        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            
            const updated = { ...selectedEvent, image: base64 };
            setSelectedEvent(updated);
            onUpdateEvent(selectedEvent.id, { image: base64 });
        } catch (err) { console.error("Upload failed", err); }
    };

    // Generate a consistent color theme based on the campaign name string
    const getEventStyle = (campaignName?: string) => {
        if (!campaignName) return { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-600', accent: 'bg-gray-400' };
        
        const variants = [
            { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', accent: 'bg-blue-400' },
            { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', accent: 'bg-green-400' },
            { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', accent: 'bg-purple-400' },
            { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', accent: 'bg-rose-400' },
            { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', accent: 'bg-amber-400' },
            { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', accent: 'bg-teal-400' },
            { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', accent: 'bg-indigo-400' },
            { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-800', accent: 'bg-cyan-400' },
        ];
        
        let hash = 0;
        for (let i = 0; i < campaignName.length; i++) {
            hash = campaignName.charCodeAt(i) + ((hash << 5) - hash);
        }
        return variants[Math.abs(hash) % variants.length];
    };

    // --- Drag & Drop Logic ---
    const handleDragStart = (e: React.DragEvent, eventId: string) => {
        e.dataTransfer.setData('text/plain', eventId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, date: string) => {
        e.preventDefault(); // Allows dropping
        if (dragOverDate !== date) {
            setDragOverDate(date);
        }
    };

    const handleDrop = (e: React.DragEvent, date: string) => {
        e.preventDefault();
        setDragOverDate(null);
        const eventId = e.dataTransfer.getData('text/plain');
        if (eventId) {
            onMoveEvent(eventId, date);
        }
    };

    const handleDragEnd = () => {
        setDragOverDate(null);
    };

    const renderCalendarGrid = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];

        // Empty cells for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-36 bg-gray-50/30 border border-brand-border/50"></div>);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = formatDate(day);
            const dayEvents = events.filter(e => e.date === dateStr);
            const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
            const isDragOver = dragOverDate === dateStr;

            days.push(
                <div 
                    key={day} 
                    onClick={() => onAddEvent(dateStr)}
                    onDragOver={(e) => handleDragOver(e, dateStr)}
                    onDrop={(e) => handleDrop(e, dateStr)}
                    className={`h-36 border border-brand-border p-2 relative group hover:bg-white transition-colors overflow-hidden cursor-pointer hover:shadow-inner 
                        ${isToday ? 'bg-indigo-50/30' : 'bg-white'}
                        ${isDragOver ? 'bg-indigo-100 ring-2 ring-indigo-300 z-10' : ''}
                    `}
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className={`text-xs font-bold ${isToday ? 'text-brand-accent bg-indigo-100 px-1.5 py-0.5 rounded-full' : 'text-brand-muted'}`}>{day}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="text-[10px] bg-brand-accent text-white px-1.5 py-0.5 rounded hover:bg-indigo-700 font-bold">+</button>
                        </div>
                    </div>
                    
                    <div className="space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar pb-1">
                        {dayEvents.map(ev => {
                            const style = getEventStyle(ev.campaignName);
                            return (
                                <div 
                                    key={ev.id} 
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, ev.id)}
                                    onDragEnd={handleDragEnd}
                                    onClick={(e) => { e.stopPropagation(); handleEventClick(ev); }}
                                    className={`${style.bg} ${style.border} border rounded p-1.5 text-[10px] ${style.text} relative group/event cursor-grab active:cursor-grabbing hover:shadow-md transition-all z-20`}
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold truncate w-full pointer-events-none uppercase tracking-tight text-[9px]">
                                                {ev.campaignName || 'No Campaign'}
                                            </span>
                                        </div>
                                        
                                        <div className="flex gap-2 items-start">
                                            {ev.image && (
                                                <img 
                                                    src={ev.image} 
                                                    alt="Preview" 
                                                    className="w-8 h-8 rounded object-cover border border-black/5 shrink-0 bg-white" 
                                                    draggable={false}
                                                />
                                            )}
                                            <p className="opacity-90 leading-snug line-clamp-2 pointer-events-none flex-1">
                                                {ev.content}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        return days;
    };

    return (
        <div className="w-full h-full space-y-6 animate-fadeIn pb-10">
            {/* Header */}
            <div className="flex justify-between items-end px-1">
                <div>
                    <h2 className="text-2xl font-display font-bold text-brand-text">Content Calendar</h2>
                    <p className="text-sm text-brand-muted">Schedule and manage your upcoming content for <span className="font-bold">{brandName}</span></p>
                </div>
                <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-brand-border shadow-sm">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-full text-brand-muted">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="font-display font-bold text-brand-text w-32 text-center">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-full text-brand-muted">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="bg-white rounded-xl border border-brand-border shadow-sm overflow-hidden" onMouseLeave={() => setDragOverDate(null)}>
                <div className="grid grid-cols-7 border-b border-brand-border bg-gray-50">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="py-2 text-center text-xs font-bold text-brand-muted uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {renderCalendarGrid()}
                </div>
            </div>

            {/* Stats Footer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-brand-border">
                    <h4 className="font-bold text-sm text-brand-text uppercase mb-2">Scheduled Posts</h4>
                    <div className="text-3xl font-display font-bold text-indigo-600">{events.filter(e => e.status === 'scheduled').length}</div>
                </div>
                 <div className="bg-white p-6 rounded-xl border border-brand-border">
                    <h4 className="font-bold text-sm text-brand-text uppercase mb-2">Campaigns Active</h4>
                    <div className="text-3xl font-display font-bold text-green-600">{new Set(events.filter(e => e.campaignName).map(e => e.campaignName)).size}</div>
                </div>
            </div>

            {/* DETAIL MODAL */}
            {selectedEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setSelectedEvent(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        
                        {/* Left Column: Media */}
                        <div className="w-full md:w-1/2 bg-gray-100 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-brand-border relative group">
                            {selectedEvent.image ? (
                                <>
                                    <img src={selectedEvent.image} alt="Planned Content" className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm" />
                                    {/* Hover controls for image */}
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); calendarFileInputRef.current?.click(); }}
                                            className="bg-white text-brand-text px-3 py-1.5 rounded-lg shadow-sm text-xs font-bold hover:bg-gray-50 border border-brand-border"
                                        >
                                            Change
                                        </button>
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation();
                                                const updated = { ...selectedEvent, image: undefined };
                                                setSelectedEvent(updated);
                                                onUpdateEvent(selectedEvent.id, { image: undefined });
                                            }}
                                            className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg shadow-sm text-xs font-bold hover:bg-red-100 border border-red-200"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div 
                                    className="text-brand-muted text-sm italic flex flex-col items-center gap-3 cursor-pointer hover:text-brand-accent transition-colors p-10 border-2 border-dashed border-transparent hover:border-brand-accent/30 rounded-xl"
                                    onClick={() => calendarFileInputRef.current?.click()}
                                >
                                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                                        <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <span className="font-bold underline decoration-dotted">Click to upload media</span>
                                </div>
                            )}
                            <input 
                                type="file" 
                                ref={calendarFileInputRef} 
                                onChange={handleCalendarImageUpload} 
                                accept="image/*" 
                                className="hidden" 
                            />
                        </div>

                        {/* Right Column: Details */}
                        <div className="w-full md:w-1/2 flex flex-col">
                            <div className="p-6 border-b border-brand-border bg-gray-50 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-1 bg-black text-white text-[10px] font-bold uppercase rounded-md tracking-wider">
                                            {selectedEvent.platform}
                                        </span>
                                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider ${selectedEvent.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {selectedEvent.status}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-display font-bold text-brand-text mb-1">
                                        {selectedEvent.campaignName || 'No Campaign (Single Post)'}
                                    </h3>
                                    {!isEditing ? (
                                        <p className="text-sm text-brand-muted">
                                            Scheduled for <span className="font-bold text-brand-text">{new Date(selectedEvent.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </p>
                                    ) : (
                                        <input 
                                            type="date" 
                                            value={editDate}
                                            onChange={(e) => setEditDate(e.target.value)}
                                            className="mt-1 border border-brand-border rounded px-2 py-1 text-sm text-brand-text focus:outline-none focus:border-brand-accent"
                                        />
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditing(!isEditing)} className="text-gray-400 hover:text-brand-accent p-1">
                                        {isEditing ? 'Cancel' : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                                    </button>
                                    <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600 p-1">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto">
                                <label className="text-xs font-bold text-brand-muted uppercase mb-3 block">Caption</label>
                                {!isEditing ? (
                                    <div className="text-sm text-brand-text whitespace-pre-wrap leading-relaxed">
                                        {selectedEvent.content}
                                    </div>
                                ) : (
                                    <textarea 
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="w-full h-40 border border-brand-border rounded-lg p-2 text-sm text-brand-text focus:outline-none focus:border-brand-accent resize-none"
                                    />
                                )}
                            </div>

                            <div className="p-6 border-t border-brand-border bg-gray-50 flex gap-3">
                                {isEditing ? (
                                    <Button 
                                        className="flex-1"
                                        onClick={handleSaveChanges}
                                    >
                                        Save Changes
                                    </Button>
                                ) : (
                                    <>
                                        <Button 
                                            className="flex-1"
                                            onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(selectedEvent.content)}`, '_blank')}
                                        >
                                            Post Now
                                        </Button>
                                        <Button 
                                            variant="danger" 
                                            onClick={() => { onDeleteEvent(selectedEvent.id); setSelectedEvent(null); }}
                                        >
                                            Delete
                                        </Button>
                                        {selectedEvent.image && (
                                             <Button 
                                                variant="secondary"
                                                className="px-3"
                                                onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = selectedEvent.image!;
                                                    link.download = `post-${selectedEvent.date}.png`;
                                                    link.click();
                                                }}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
