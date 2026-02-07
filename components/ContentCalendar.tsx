
import React, { useState, useRef } from 'react';
import { CalendarEvent } from '../types';
import { Button } from './Button';
import { BulkImportModal } from './BulkImportModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ContentCalendarProps {
    brandName: string;
    events: CalendarEvent[];
    onDeleteEvent: (id: string) => void;
    onAddEvent: (date: string) => void;
    onMoveEvent: (id: string, newDate: string) => void;
    onUpdateEvent: (id: string, updatedFields: Partial<CalendarEvent>) => void;
    onBatchAdd?: (events: CalendarEvent[]) => void;
}

type ViewMode = 'month' | 'week' | 'list';
type FilterType = 'all' | 'tweets' | 'campaigns';

export const ContentCalendar: React.FC<ContentCalendarProps> = ({ brandName, events, onDeleteEvent, onAddEvent, onMoveEvent, onUpdateEvent, onBatchAdd }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [filter, setFilter] = useState<FilterType>('all');
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

    const calendarFileInputRef = useRef<HTMLInputElement>(null);

    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const changeMonth = (offset: number) => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    const goToToday = () => setCurrentDate(new Date());

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
        setEditTime(ev.time || '09:00');
    };

    const handleSaveChanges = () => {
        if (!selectedEvent) return;
        onUpdateEvent(selectedEvent.id, { content: editContent, date: editDate, time: editTime });
        setSelectedEvent({ ...selectedEvent, content: editContent, date: editDate, time: editTime });
        setIsEditing(false);
    };

    const handleMarkPublished = () => {
        if (!selectedEvent) return;
        const updated = { ...selectedEvent, status: 'published', approvalStatus: 'published', publishedAt: new Date().toISOString() };
        setSelectedEvent(updated);
        onUpdateEvent(selectedEvent.id, { status: 'published', approvalStatus: 'published', publishedAt: updated.publishedAt });
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

    const getEventStyle = (event: CalendarEvent) => {
        if (event.platform.toLowerCase() === 'twitter' && !event.campaignName) {
            return { bg: 'bg-[#3B82F622]', text: 'text-[#3B82F6]', border: 'border-transparent' };
        }
        if (event.campaignName) {
            if (event.color) return { bg: '', text: 'text-white', border: 'border-transparent', customBg: `${event.color}33`, customText: event.color };
            return { bg: 'bg-[#22C55E22]', text: 'text-[#22C55E]', border: 'border-transparent' };
        }
        return { bg: 'bg-[#A855F722]', text: 'text-[#A855F7]', border: 'border-transparent' };
    };

    // Exports
    const handleExportAllCSV = () => {
        if (events.length === 0) { alert('No events to export.'); return; }
        const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Date,Time,Campaign,Platform,Status,Content,Image URL\r\n";
        sortedEvents.forEach(evt => {
            const cleanContent = evt.content.replace(/"/g, '""');
            csvContent += `${evt.date},${evt.time || ''},${evt.campaignName || 'Single Post'},${evt.platform},${evt.status},"${cleanContent}",${evt.image || ''}\r\n`;
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `${brandName}_Calendar_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportAllPDF = async () => {
        if (events.length === 0) { alert('No events to export.'); return; }
        const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const doc = new jsPDF();
        doc.setFontSize(22); doc.setTextColor(40, 40, 40);
        doc.text(`${brandName}: Content Calendar`, 14, 20);
        doc.setFontSize(12); doc.setTextColor(100, 100, 100);
        doc.text(`Generated on ${new Date().toLocaleDateString()} · ${sortedEvents.length} posts`, 14, 28);
        const tableBody = sortedEvents.map(evt => [evt.date, evt.campaignName || '-', evt.content, evt.status.toUpperCase(), '']);
        // @ts-ignore
        autoTable(doc, {
            startY: 38,
            head: [['Date', 'Campaign', 'Copy', 'Status', 'Visual']],
            body: tableBody,
            columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 30 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 20 }, 4: { cellWidth: 35, minCellHeight: 25 } },
            styles: { overflow: 'linebreak', fontSize: 9, valign: 'middle' },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 4) {
                    const evt = sortedEvents[data.row.index];
                    if (evt?.image) { try { const dim = data.cell.height - 4; doc.addImage(evt.image, 'PNG', data.cell.x + 2, data.cell.y + 2, dim * 1.77, dim); } catch {} }
                }
            }
        });
        doc.save(`${brandName}_Calendar.pdf`);
    };

    // Drag & Drop
    const handleDragStart = (e: React.DragEvent, eventId: string) => { e.dataTransfer.setData('text/plain', eventId); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragOver = (e: React.DragEvent, date: string) => { e.preventDefault(); if (dragOverDate !== date) setDragOverDate(date); };
    const handleDrop = (e: React.DragEvent, date: string) => { e.preventDefault(); setDragOverDate(null); const id = e.dataTransfer.getData('text/plain'); if (id) onMoveEvent(id, date); };
    const handleDragEnd = () => setDragOverDate(null);

    const getFilteredEvents = (dayEvents: CalendarEvent[]) => {
        if (filter === 'tweets') return dayEvents.filter(e => e.platform.toLowerCase() === 'twitter' && !e.campaignName);
        if (filter === 'campaigns') return dayEvents.filter(e => !!e.campaignName);
        return dayEvents;
    };

    // Counts for header stats
    const scheduledCount = events.filter(e => e.status === 'scheduled').length;
    const publishedCount = events.filter(e => e.status === 'published').length;
    const thisMonthEvents = events.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });

    // Week view helpers
    const getWeekDays = () => {
        const start = new Date(currentDate);
        const day = start.getDay();
        start.setDate(start.getDate() - day);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const renderCalendarGrid = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const weeks: React.ReactNode[] = [];
        let days: React.ReactNode[] = [];
        const today = new Date();
        const isCurrentMonth = today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
        const todayDate = today.getDate();
        const prevMonthDays = getDaysInMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));

        for (let i = 0; i < firstDay; i++) {
            const prevDay = prevMonthDays - firstDay + i + 1;
            days.push(
                <div key={`prev-${i}`} className="flex-1 min-h-[100px] p-1.5 border-r border-[#1F1F23] last:border-r-0 bg-[#0A0A0B]/30">
                    <span className="text-[11px] text-[#2E2E2E] font-medium">{prevDay}</span>
                </div>
            );
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = formatDate(day);
            const dayEvents = events.filter(e => e.date === dateStr);
            const filteredEvents = getFilteredEvents(dayEvents);
            const isToday = isCurrentMonth && day === todayDate;
            const isDragOver = dragOverDate === dateStr;

            days.push(
                <div
                    key={day}
                    onClick={() => onAddEvent(dateStr)}
                    onDragOver={(e) => handleDragOver(e, dateStr)}
                    onDrop={(e) => handleDrop(e, dateStr)}
                    className={`flex-1 min-h-[100px] p-1.5 border-r border-[#1F1F23] last:border-r-0 cursor-pointer transition-colors ${
                        isToday ? 'bg-[#FF5C0008]' : 'hover:bg-[#1F1F2333]'
                    } ${isDragOver ? 'bg-[#FF5C0015] ring-1 ring-inset ring-[#FF5C0044]' : ''}`}
                >
                    <div className="flex items-start justify-between mb-1">
                        {isToday ? (
                            <div className="w-5.5 h-5.5 rounded-full bg-[#FF5C00] flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white">{day}</span>
                            </div>
                        ) : (
                            <span className={`text-[11px] font-medium ${dayEvents.length > 0 ? 'text-white' : 'text-[#6B6B70]'}`}>{day}</span>
                        )}
                        {filteredEvents.length > 2 && (
                            <span className="text-[9px] text-[#6B6B70] font-medium">+{filteredEvents.length - 2}</span>
                        )}
                    </div>
                    <div className="space-y-0.5 overflow-hidden max-h-[68px]">
                        {filteredEvents.slice(0, 2).map(ev => {
                            const style = getEventStyle(ev);
                            return (
                                <div
                                    key={ev.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, ev.id)}
                                    onDragEnd={handleDragEnd}
                                    onClick={(e) => { e.stopPropagation(); handleEventClick(ev); }}
                                    className={`${style.bg} rounded px-1.5 py-0.5 cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity`}
                                    style={style.customBg ? { backgroundColor: style.customBg } : {}}
                                >
                                    <p className={`text-[10px] font-medium truncate ${style.text}`} style={style.customText ? { color: style.customText } : {}}>
                                        {ev.time && <span className="opacity-60">{ev.time} </span>}
                                        {ev.campaignName || ev.content.substring(0, 25)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );

            if ((firstDay + day) % 7 === 0) {
                weeks.push(<div key={`week-${weeks.length}`} className="flex flex-1 border-b border-[#1F1F23] last:border-b-0">{days}</div>);
                days = [];
            }
        }

        if (days.length > 0) {
            const remaining = 7 - days.length;
            for (let i = 1; i <= remaining; i++) {
                days.push(
                    <div key={`next-${i}`} className="flex-1 min-h-[100px] p-1.5 border-r border-[#1F1F23] last:border-r-0 bg-[#0A0A0B]/30">
                        <span className="text-[11px] text-[#2E2E2E] font-medium">{i}</span>
                    </div>
                );
            }
            weeks.push(<div key={`week-${weeks.length}`} className="flex flex-1 border-b border-[#1F1F23] last:border-b-0">{days}</div>);
        }

        return weeks;
    };

    // List view
    const renderListView = () => {
        const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const filtered = filter === 'tweets' ? sorted.filter(e => e.platform.toLowerCase() === 'twitter' && !e.campaignName)
            : filter === 'campaigns' ? sorted.filter(e => !!e.campaignName) : sorted;
        if (filtered.length === 0) return (
            <div className="flex-1 flex items-center justify-center py-16">
                <div className="text-center">
                    <span className="text-3xl mb-3 block">📅</span>
                    <p className="text-[#6B6B70] text-sm">No events to show</p>
                </div>
            </div>
        );
        return (
            <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-[#1F1F23]">
                    {filtered.map(ev => {
                        const style = getEventStyle(ev);
                        const dateObj = new Date(ev.date);
                        return (
                            <div key={ev.id} onClick={() => handleEventClick(ev)} className="flex items-center gap-4 px-6 py-3 hover:bg-[#1F1F2333] cursor-pointer transition-colors">
                                <div className="w-12 text-center flex-shrink-0">
                                    <div className="text-[10px] text-[#6B6B70] font-medium uppercase">{dateObj.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                    <div className="text-lg font-bold text-white">{dateObj.getDate()}</div>
                                    <div className="text-[10px] text-[#6B6B70]">{dateObj.toLocaleDateString(undefined, { month: 'short' })}</div>
                                </div>
                                <div className={`w-1 h-10 rounded-full ${style.bg}`} style={style.customBg ? { backgroundColor: style.customBg } : {}}></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        {ev.campaignName && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#22C55E18] text-[#22C55E]">{ev.campaignName}</span>}
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ev.status === 'published' ? 'bg-[#22C55E18] text-[#22C55E]' : 'bg-[#3B82F618] text-[#3B82F6]'}`}>{ev.status}</span>
                                        {ev.time && <span className="text-[10px] text-[#6B6B70]">{ev.time}</span>}
                                    </div>
                                    <p className="text-sm text-white truncate">{ev.content}</p>
                                </div>
                                <svg className="w-4 h-4 text-[#4A4A4E] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const monthYear = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
        <div className="flex-1 flex flex-col bg-[#0A0A0B] min-h-0">
            {/* Compact Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#1F1F23] bg-[#111113]">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-semibold text-white">Content Calendar</h1>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#FF5C0018] text-[#FF5C00] text-[10px] font-medium">{thisMonthEvents.length} this month</span>
                        {scheduledCount > 0 && <span className="px-2 py-0.5 rounded-md bg-[#3B82F618] text-[#3B82F6] text-[10px] font-medium">{scheduledCount} scheduled</span>}
                        {publishedCount > 0 && <span className="px-2 py-0.5 rounded-md bg-[#22C55E18] text-[#22C55E] text-[10px] font-medium">{publishedCount} published</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Export */}
                    <button onClick={handleExportAllCSV} className="px-3 py-1.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-[#ADADB0] text-xs font-medium hover:text-white transition-colors">CSV</button>
                    <button onClick={handleExportAllPDF} className="px-3 py-1.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-[#ADADB0] text-xs font-medium hover:text-white transition-colors">PDF</button>
                    <div className="w-px h-5 bg-[#1F1F23] mx-1"></div>
                    {/* View Toggle */}
                    <div className="flex items-center bg-[#0A0A0B] border border-[#1F1F23] rounded-lg p-0.5">
                        {(['month', 'week', 'list'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                                    viewMode === mode ? 'bg-[#FF5C00] text-white' : 'text-[#64748B] hover:text-white'
                                }`}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => onAddEvent(formatDate(new Date().getDate()))}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold"
                        style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }}
                    >
                        <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>add</span>
                        New Post
                    </button>
                </div>
            </div>

            {/* Calendar Nav + Filter */}
            <div className="flex items-center justify-between px-6 py-2.5 border-b border-[#1F1F23]">
                <div className="flex items-center gap-3">
                    <button onClick={() => changeMonth(-1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1F1F23] text-[#94A3B8] hover:text-white transition-colors">
                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>chevron_left</span>
                    </button>
                    <span className="text-sm font-semibold text-white min-w-[140px] text-center">{monthYear}</span>
                    <button onClick={() => changeMonth(1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1F1F23] text-[#94A3B8] hover:text-white transition-colors">
                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>chevron_right</span>
                    </button>
                    <button onClick={goToToday} className="px-3 py-1 rounded-md bg-[#1F1F23] text-[#94A3B8] text-[11px] font-medium hover:text-white transition-colors">Today</button>
                </div>
                <div className="flex items-center gap-1.5">
                    {[
                        { key: 'all' as FilterType, label: 'All', color: '#FF5C00' },
                        { key: 'tweets' as FilterType, label: 'Tweets', color: '#3B82F6' },
                        { key: 'campaigns' as FilterType, label: 'Campaigns', color: '#22C55E' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                filter === f.key ? `text-white` : 'text-[#64748B] hover:text-white'
                            }`}
                            style={filter === f.key ? { backgroundColor: `${f.color}22`, color: f.color, border: `1px solid ${f.color}44` } : { border: '1px solid transparent' }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }}></span>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Calendar Container */}
            {viewMode === 'list' ? renderListView() : (
                <div className="flex-1 mx-4 mb-4 mt-2 bg-[#111113] border border-[#1F1F23] rounded-xl overflow-hidden flex flex-col" onMouseLeave={() => setDragOverDate(null)}>
                    {/* Day Headers */}
                    <div className="flex border-b border-[#1F1F23]">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="flex-1 py-2 text-center text-[10px] font-semibold text-[#4A4A4E] uppercase tracking-wider">{day}</div>
                        ))}
                    </div>
                    <div className="flex-1 flex flex-col">{renderCalendarGrid()}</div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {selectedEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedEvent(null)}>
                    <div className="bg-[#111113] border border-[#1F1F23] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        {/* Left: Media */}
                        <div className="w-full md:w-1/2 bg-[#0A0A0B] flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-[#1F1F23] relative group">
                            {selectedEvent.image ? (
                                <>
                                    <img src={selectedEvent.image} alt="Planned Content" className="max-w-full max-h-[60vh] object-contain rounded-xl" />
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); calendarFileInputRef.current?.click(); }} className="bg-[#1F1F23] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#2A2A2E] border border-[#2E2E2E]">Change</button>
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedEvent({ ...selectedEvent, image: undefined }); onUpdateEvent(selectedEvent.id, { image: undefined }); }} className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/30 border border-red-500/30">Remove</button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-[#64748B] text-sm flex flex-col items-center gap-3 cursor-pointer hover:text-white transition-colors p-10 border-2 border-dashed border-[#2E2E2E] hover:border-[#FF5C00] rounded-xl" onClick={() => calendarFileInputRef.current?.click()}>
                                    <div className="w-14 h-14 bg-[#1F1F23] rounded-full flex items-center justify-center">
                                        <span className="material-symbols-sharp text-2xl text-[#64748B]" style={{ fontVariationSettings: "'wght' 300" }}>image</span>
                                    </div>
                                    <span className="font-medium text-xs">Click to upload media</span>
                                </div>
                            )}
                            <input type="file" ref={calendarFileInputRef} onChange={handleCalendarImageUpload} accept="image/*" className="hidden" />
                        </div>

                        {/* Right: Details */}
                        <div className="w-full md:w-1/2 flex flex-col">
                            <div className="p-5 border-b border-[#1F1F23] flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-[#1F1F23] text-white text-[10px] font-bold uppercase rounded tracking-wider">{selectedEvent.platform}</span>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded tracking-wider ${selectedEvent.status === 'published' ? 'bg-[#22C55E22] text-[#22C55E]' : 'bg-[#3B82F622] text-[#3B82F6]'}`}>{selectedEvent.status}</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1">{selectedEvent.campaignName || 'Single Post'}</h3>
                                    {selectedEvent.publishedAt && <p className="text-xs text-[#94A3B8]">Published {new Date(selectedEvent.publishedAt).toLocaleString()}</p>}
                                    {!isEditing ? (
                                        <p className="text-sm text-[#64748B]">
                                            Scheduled for <span className="font-medium text-white">{new Date(selectedEvent.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                                            {selectedEvent.time && <span className="text-[#94A3B8]"> at <span className="font-medium text-white">{selectedEvent.time}</span></span>}
                                        </p>
                                    ) : (
                                        <div className="flex items-center gap-2 mt-1">
                                            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="bg-[#0A0A0B] border border-[#2E2E2E] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#FF5C00]" />
                                            <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="bg-[#0A0A0B] border border-[#2E2E2E] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#FF5C00]" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditing(!isEditing)} className="text-[#64748B] hover:text-[#FF5C00] p-1 transition-colors">
                                        {isEditing ? <span className="text-xs font-medium">Cancel</span> : <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>edit</span>}
                                    </button>
                                    <button onClick={() => setSelectedEvent(null)} className="text-[#64748B] hover:text-white p-1 transition-colors">
                                        <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>close</span>
                                    </button>
                                </div>
                            </div>

                            <div className="p-5 flex-1 overflow-y-auto">
                                {selectedEvent.platformPostId && (
                                    <div className="mb-3">
                                        <a href={`https://x.com/i/web/status/${selectedEvent.platformPostId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-[#22C55E] hover:text-[#34D399]">
                                            View Published Post <span className="material-symbols-sharp text-sm" style={{ fontVariationSettings: "'wght' 300" }}>open_in_new</span>
                                        </a>
                                    </div>
                                )}
                                {selectedEvent.publishError && (
                                    <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">Publish error: {selectedEvent.publishError}</div>
                                )}
                                <label className="text-[10px] font-semibold text-[#64748B] uppercase mb-2 block tracking-wider">Caption</label>
                                {!isEditing ? (
                                    <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">{selectedEvent.content}</div>
                                ) : (
                                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full h-40 bg-[#0A0A0B] border border-[#2E2E2E] rounded-lg p-3 text-sm text-white focus:outline-none focus:border-[#FF5C00] resize-none" />
                                )}
                            </div>

                            <div className="p-5 border-t border-[#1F1F23] flex gap-2">
                                {isEditing ? (
                                    <button className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }} onClick={handleSaveChanges}>Save Changes</button>
                                ) : (
                                    <>
                                        <button className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: 'linear-gradient(180deg, #FF5C00 0%, #FF8400 100%)' }} onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(selectedEvent.content)}`, '_blank')}>Post Now</button>
                                        {selectedEvent.status !== 'published' && <button className="px-4 py-2.5 rounded-lg bg-[#1F1F23] border border-[#2E2E2E] text-white text-sm font-medium hover:bg-[#2A2A2E] transition-colors" onClick={handleMarkPublished}>Mark Published</button>}
                                        <button className="px-4 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors" onClick={() => { onDeleteEvent(selectedEvent.id); setSelectedEvent(null); }}>Delete</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <BulkImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                brandName={brandName}
                onImport={(newEvents) => { if (onBatchAdd) onBatchAdd(newEvents); }}
            />
        </div>
    );
};
