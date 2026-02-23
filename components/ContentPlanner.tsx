import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrandConfig, PlannerNote, PlannerDay, PlannerTag, PlannerStatus } from '../types';
import { loadContentPlannerNotes, saveContentPlannerNotes, STORAGE_EVENTS } from '../services/storage';
import { useToast } from './Toast';

// --- Constants ---

const DAYS: PlannerDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_LABELS: Record<PlannerDay, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const DAY_LABELS_FULL: Record<PlannerDay, string> = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const TAG_COLORS: Record<PlannerTag, string> = {
    tweet: 'bg-blue-500/20 text-blue-400',
    thread: 'bg-purple-500/20 text-purple-400',
    announcement: 'bg-amber-500/20 text-amber-400',
    engagement: 'bg-green-500/20 text-green-400',
    campaign: 'bg-[#FF5C00]/20 text-[#FF5C00]',
    idea: 'bg-[#1F1F23] text-[#6B6B70]',
};

const STATUS_COLORS: Record<PlannerStatus, string> = {
    idea: '#6B6B70',
    planned: '#3B82F6',
    drafted: '#F59E0B',
    ready: '#10B981',
    posted: '#FF5C00',
};

const ALL_TAGS: PlannerTag[] = ['tweet', 'thread', 'announcement', 'engagement', 'campaign', 'idea'];
const ALL_STATUSES: PlannerStatus[] = ['idea', 'planned', 'drafted', 'ready', 'posted'];

// --- Helpers ---

const getWeekId = (offset: number): string => {
    const now = new Date();
    const target = new Date(now);
    target.setDate(target.getDate() + (offset * 7));
    const tempDate = new Date(target.getTime());
    tempDate.setHours(0, 0, 0, 0);
    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
    const week1 = new Date(tempDate.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${tempDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

const getWeekDates = (offset: number): { dates: Record<PlannerDay, Date>; label: string } => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset + (offset * 7));
    monday.setHours(0, 0, 0, 0);

    const dates: Record<string, Date> = {};
    DAYS.forEach((day, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates[day] = d;
    });

    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const label = `Week of ${fmt(monday)}, ${monday.getFullYear()}`;

    return { dates: dates as Record<PlannerDay, Date>, label };
};

const makeId = () => `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// --- Props ---

interface ContentPlannerProps {
    brandName: string;
    brandConfig: BrandConfig;
    onNavigate?: (section: string, params?: any) => void;
}

// --- Component ---

export const ContentPlanner: React.FC<ContentPlannerProps> = ({ brandName, brandConfig, onNavigate }) => {
    const { showToast } = useToast();

    // State
    const [notes, setNotes] = useState<PlannerNote[]>([]);
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
    const [editingNote, setEditingNote] = useState<PlannerNote | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTag, setFilterTag] = useState<PlannerTag | 'all'>('all');
    const [moveDropdownId, setMoveDropdownId] = useState<string | null>(null);
    const hasLoaded = useRef(false);

    const currentWeekId = getWeekId(currentWeekOffset);
    const weekInfo = useMemo(() => getWeekDates(currentWeekOffset), [currentWeekOffset]);

    // Load on mount / brand change
    useEffect(() => {
        const loaded = loadContentPlannerNotes(brandName);
        setNotes(loaded);
        hasLoaded.current = true;
    }, [brandName]);

    // Listen for cloud sync updates
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.brandName?.toLowerCase() === brandName.toLowerCase()) {
                const fresh = loadContentPlannerNotes(brandName);
                setNotes(fresh);
            }
        };
        window.addEventListener(STORAGE_EVENTS.CONTENT_PLANNER_UPDATE, handler);
        return () => window.removeEventListener(STORAGE_EVENTS.CONTENT_PLANNER_UPDATE, handler);
    }, [brandName]);

    // Debounced auto-save
    useEffect(() => {
        if (!hasLoaded.current) return;
        const timeout = setTimeout(() => {
            saveContentPlannerNotes(brandName, notes);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [notes, brandName]);

    // --- CRUD ---

    const addNote = (day?: PlannerDay | null) => {
        const newNote: PlannerNote = {
            id: makeId(),
            title: '',
            body: '',
            day: day ?? null,
            weekId: currentWeekId,
            tag: 'idea',
            status: 'idea',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setEditingNote(newNote);
        setIsModalOpen(true);
    };

    const saveNote = (note: PlannerNote) => {
        if (!note.title.trim() && !note.body.trim()) {
            showToast('Add a title or description first', 'info');
            return;
        }
        const updated = { ...note, updatedAt: new Date().toISOString() };
        setNotes(prev => {
            const exists = prev.find(n => n.id === updated.id);
            if (exists) return prev.map(n => n.id === updated.id ? updated : n);
            return [...prev, updated];
        });
        setIsModalOpen(false);
        setEditingNote(null);
        showToast('Note saved', 'success');
    };

    const deleteNote = (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        setIsModalOpen(false);
        setEditingNote(null);
        showToast('Note deleted', 'info');
    };

    const moveNoteToDay = (noteId: string, newDay: PlannerDay | null) => {
        setNotes(prev => prev.map(n =>
            n.id === noteId
                ? { ...n, day: newDay, weekId: newDay ? currentWeekId : n.weekId, status: newDay && n.status === 'idea' ? 'planned' as PlannerStatus : n.status, updatedAt: new Date().toISOString() }
                : n
        ));
        setMoveDropdownId(null);
        showToast(newDay ? `Moved to ${DAY_LABELS_FULL[newDay]}` : 'Moved to backlog', 'info');
    };

    const handleDraftWithAI = (note: PlannerNote) => {
        const draftText = `${note.title}\n\n${note.body}`.trim();
        onNavigate?.('studio', { draft: draftText });
        showToast('Opened in Content Studio', 'info');
    };

    // --- Filtering ---

    const applyFilters = (list: PlannerNote[]) => {
        let filtered = list;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
        }
        if (filterTag !== 'all') {
            filtered = filtered.filter(n => n.tag === filterTag);
        }
        return filtered;
    };

    const weekNotes = useMemo(() =>
        applyFilters(notes.filter(n => n.weekId === currentWeekId && n.day !== null)),
        [notes, currentWeekId, searchQuery, filterTag]
    );

    const backlogNotes = useMemo(() =>
        applyFilters(notes.filter(n => n.day === null)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        [notes, searchQuery, filterTag]
    );

    const notesForDay = (day: PlannerDay) => weekNotes.filter(n => n.day === day);

    // --- Render ---

    return (
        <div className="flex-1 h-full overflow-y-auto bg-[#0A0A0B]">
            <div className="p-8 lg:px-10 space-y-7">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[28px] font-semibold text-white flex items-center gap-3">
                            <span className="material-symbols-sharp text-[#FF5C00]" style={{ fontSize: 28, fontVariationSettings: "'wght' 300" }}>event_note</span>
                            Content Planner
                        </h1>
                        <p className="text-sm text-[#6B6B70] mt-1">Plan your weekly content and store marketing ideas</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#111113] border border-[#1F1F23]">
                            <span className="material-symbols-sharp text-[#6B6B70] text-lg" style={{ fontVariationSettings: "'wght' 300" }}>search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search notes..."
                                className="bg-transparent border-none text-white placeholder-[#6B6B70] text-sm focus:outline-none w-40"
                            />
                        </div>
                        {/* Tag filter */}
                        <select
                            value={filterTag}
                            onChange={e => setFilterTag(e.target.value as PlannerTag | 'all')}
                            className="px-3.5 py-2.5 rounded-lg bg-[#111113] border border-[#1F1F23] text-white text-sm font-medium focus:outline-none focus:border-[#FF5C00]/50 appearance-none cursor-pointer"
                        >
                            <option value="all">All Tags</option>
                            {ALL_TAGS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                        </select>
                        {/* Add Note */}
                        <button
                            onClick={() => addNote(null)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#FF6B1A] transition-colors"
                        >
                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 400" }}>add</span>
                            New Note
                        </button>
                    </div>
                </div>

                {/* Week Navigator */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setCurrentWeekOffset(o => o - 1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1F1F23] text-[#ADADB0] hover:text-white transition-colors">
                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>chevron_left</span>
                        </button>
                        <span className="text-sm font-semibold text-white min-w-[200px] text-center">{weekInfo.label}</span>
                        <button onClick={() => setCurrentWeekOffset(o => o + 1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-[#1F1F23] text-[#ADADB0] hover:text-white transition-colors">
                            <span className="material-symbols-sharp text-lg" style={{ fontVariationSettings: "'wght' 300" }}>chevron_right</span>
                        </button>
                        {currentWeekOffset !== 0 && (
                            <button onClick={() => setCurrentWeekOffset(0)} className="px-3 py-1 rounded-md bg-[#1F1F23] text-[#ADADB0] text-[11px] font-medium hover:text-white transition-colors">
                                Today
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-md bg-[#FF5C0018] text-[#FF5C00] text-[11px] font-medium">{weekNotes.length} scheduled</span>
                        <span className="px-2.5 py-1 rounded-md bg-[#3B82F618] text-[#3B82F6] text-[11px] font-medium">{backlogNotes.length} ideas</span>
                    </div>
                </div>

                {/* Weekly Board */}
                <div className="grid grid-cols-7 gap-3">
                    {DAYS.map(day => {
                        const dayNotes = notesForDay(day);
                        const dayDate = weekInfo.dates[day];
                        const isToday = currentWeekOffset === 0 && new Date().toDateString() === dayDate.toDateString();

                        return (
                            <div key={day} className={`rounded-xl border min-h-[220px] flex flex-col ${isToday ? 'bg-[#111113] border-[#FF5C00]/30' : 'bg-[#111113] border-[#1F1F23]'}`}>
                                {/* Day Header */}
                                <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${isToday ? 'border-[#FF5C00]/20' : 'border-[#1F1F23]'}`}>
                                    <span className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-[#FF5C00]' : 'text-[#6B6B70]'}`}>{DAY_LABELS[day]}</span>
                                    <span className={`text-xs tabular-nums ${isToday ? 'text-[#FF5C00]/70' : 'text-[#4A4A4E]'}`}>{dayDate.getDate()}</span>
                                </div>
                                {/* Cards */}
                                <div className="p-2 space-y-2 flex-1">
                                    {dayNotes.map(note => (
                                        <NoteCard
                                            key={note.id}
                                            note={note}
                                            onEdit={() => { setEditingNote(note); setIsModalOpen(true); }}
                                            onDraftAI={() => handleDraftWithAI(note)}
                                            onMoveToggle={() => setMoveDropdownId(moveDropdownId === note.id ? null : note.id)}
                                            showMoveDropdown={moveDropdownId === note.id}
                                            onMove={(d) => moveNoteToDay(note.id, d)}
                                            compact
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={() => addNote(day)}
                                    className="mx-2 mb-2 py-2 rounded-lg border border-dashed border-[#2E2E2E] text-[#4A4A4E] text-xs hover:border-[#FF5C00]/40 hover:text-[#FF5C00] transition-colors"
                                >
                                    +
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Ideas Backlog */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-sharp text-[#6B6B70]" style={{ fontSize: 20, fontVariationSettings: "'wght' 300" }}>lightbulb</span>
                            <h2 className="text-lg font-semibold text-white">Ideas Backlog</h2>
                            {backlogNotes.length > 0 && (
                                <span className="px-2.5 py-0.5 rounded-md bg-[#1F1F23] text-[#6B6B70] text-xs font-medium">{backlogNotes.length}</span>
                            )}
                        </div>
                        <button
                            onClick={() => addNote(null)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-[#FF5C00] bg-[#FF5C00]/10 hover:bg-[#FF5C00]/20 transition-colors border border-[#FF5C00]/20"
                        >
                            <span className="material-symbols-sharp" style={{ fontSize: 16, fontVariationSettings: "'wght' 400" }}>add</span>
                            Add Idea
                        </button>
                    </div>
                    {backlogNotes.length === 0 ? (
                        <div className="bg-[#111113] rounded-xl border border-[#1F1F23] p-10 text-center">
                            <span className="material-symbols-sharp text-[#2E2E2E] mb-2 block" style={{ fontSize: 36, fontVariationSettings: "'wght' 200" }}>note_add</span>
                            <p className="text-sm text-[#6B6B70] mt-2">No ideas yet. Add your first brainstorm note.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {backlogNotes.map(note => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    onEdit={() => { setEditingNote(note); setIsModalOpen(true); }}
                                    onDraftAI={() => handleDraftWithAI(note)}
                                    onMoveToggle={() => setMoveDropdownId(moveDropdownId === note.id ? null : note.id)}
                                    showMoveDropdown={moveDropdownId === note.id}
                                    onMove={(d) => moveNoteToDay(note.id, d)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {isModalOpen && editingNote && (
                <NoteEditModal
                    note={editingNote}
                    onChange={setEditingNote}
                    onSave={() => saveNote(editingNote)}
                    onDelete={() => deleteNote(editingNote.id)}
                    onClose={() => { setIsModalOpen(false); setEditingNote(null); }}
                    currentWeekId={currentWeekId}
                />
            )}
        </div>
    );
};

// --- Sub-components ---

interface NoteCardProps {
    note: PlannerNote;
    onEdit: () => void;
    onDraftAI: () => void;
    onMoveToggle: () => void;
    showMoveDropdown: boolean;
    onMove: (day: PlannerDay | null) => void;
    compact?: boolean;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onEdit, onDraftAI, onMoveToggle, showMoveDropdown, onMove, compact }) => {
    return (
        <div className="relative">
            <div
                onClick={onEdit}
                className={`bg-[#0A0A0B] rounded-lg border border-[#1F1F23] cursor-pointer hover:border-[#FF5C00]/30 transition-colors group ${compact ? 'p-2.5' : 'p-4'}`}
            >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className={`font-medium text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>{note.title || 'Untitled'}</h4>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: STATUS_COLORS[note.status] }} title={note.status} />
                </div>
                {note.tag && (
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${TAG_COLORS[note.tag]}`}>
                        {note.tag}
                    </span>
                )}
                {note.body && !compact && (
                    <p className="text-xs text-[#6B6B70] mt-2 line-clamp-2">{note.body}</p>
                )}
                {note.body && compact && (
                    <p className="text-[10px] text-[#4A4A4E] mt-1 line-clamp-1">{note.body}</p>
                )}
                {/* Action row — visible on hover */}
                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDraftAI(); }}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#FF5C00]/10 text-[#FF5C00] hover:bg-[#FF5C00]/20 transition-colors"
                    >
                        Draft with AI
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onMoveToggle(); }}
                        className="px-2 py-0.5 rounded text-[10px] text-[#6B6B70] hover:text-white hover:bg-[#1F1F23] transition-colors"
                    >
                        Move
                    </button>
                </div>
            </div>

            {/* Move dropdown */}
            {showMoveDropdown && (
                <div className="absolute z-40 top-full left-0 mt-1 bg-[#111113] border border-[#1F1F23] rounded-lg shadow-xl py-1 min-w-[130px]">
                    {DAYS.map(d => (
                        <button key={d} onClick={() => onMove(d)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#FF5C00]/10 hover:text-[#FF5C00] transition-colors ${note.day === d ? 'text-[#FF5C00]' : 'text-[#ADADB0]'}`}>
                            {DAY_LABELS_FULL[d]}
                        </button>
                    ))}
                    <div className="border-t border-[#1F1F23] my-1" />
                    <button onClick={() => onMove(null)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#FF5C00]/10 hover:text-[#FF5C00] transition-colors ${note.day === null ? 'text-[#FF5C00]' : 'text-[#ADADB0]'}`}>
                        Backlog
                    </button>
                </div>
            )}
        </div>
    );
};

// --- Edit Modal ---

interface NoteEditModalProps {
    note: PlannerNote;
    onChange: (note: PlannerNote) => void;
    onSave: () => void;
    onDelete: () => void;
    onClose: () => void;
    currentWeekId: string;
}

const NoteEditModal: React.FC<NoteEditModalProps> = ({ note, onChange, onSave, onDelete, onClose, currentWeekId }) => {
    const isNew = note.createdAt === note.updatedAt && !note.title && !note.body;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="bg-[#111113] rounded-2xl border border-[#1F1F23] w-full max-w-lg p-6 shadow-2xl mx-4">
                <h3 className="text-lg font-bold text-white mb-4">{isNew ? 'New Note' : 'Edit Note'}</h3>

                {/* Title */}
                <input
                    value={note.title}
                    onChange={e => onChange({ ...note, title: e.target.value })}
                    placeholder="Title / Topic"
                    autoFocus
                    className="w-full bg-[#0A0A0B] border border-[#1F1F23] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#6B6B70] focus:outline-none focus:border-[#FF5C00] mb-3"
                />

                {/* Body */}
                <textarea
                    value={note.body}
                    onChange={e => onChange({ ...note, body: e.target.value })}
                    placeholder="Describe the content idea, talking points, context..."
                    rows={5}
                    className="w-full bg-[#0A0A0B] border border-[#1F1F23] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#6B6B70] focus:outline-none focus:border-[#FF5C00] mb-3 resize-none"
                />

                {/* Tags */}
                <div className="mb-3">
                    <label className="text-[10px] text-[#6B6B70] uppercase tracking-wider mb-1.5 block">Type</label>
                    <div className="flex flex-wrap gap-2">
                        {ALL_TAGS.map(t => (
                            <button
                                key={t}
                                onClick={() => onChange({ ...note, tag: t })}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${note.tag === t ? TAG_COLORS[t] : 'bg-[#1F1F23] text-[#6B6B70] hover:text-white'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status */}
                <div className="mb-3">
                    <label className="text-[10px] text-[#6B6B70] uppercase tracking-wider mb-1.5 block">Status</label>
                    <div className="flex flex-wrap gap-2">
                        {ALL_STATUSES.map(s => (
                            <button
                                key={s}
                                onClick={() => onChange({ ...note, status: s })}
                                className="px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5"
                                style={{
                                    backgroundColor: note.status === s ? `${STATUS_COLORS[s]}20` : '#1F1F23',
                                    color: note.status === s ? STATUS_COLORS[s] : '#6B6B70',
                                }}
                            >
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Day assignment */}
                <div className="mb-5">
                    <label className="text-[10px] text-[#6B6B70] uppercase tracking-wider mb-1.5 block">Schedule</label>
                    <select
                        value={note.day || ''}
                        onChange={e => onChange({ ...note, day: (e.target.value || null) as PlannerDay | null, weekId: e.target.value ? currentWeekId : note.weekId })}
                        className="w-full bg-[#0A0A0B] border border-[#1F1F23] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF5C00] appearance-none cursor-pointer"
                    >
                        <option value="">Backlog (unscheduled)</option>
                        {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS_FULL[d]}</option>)}
                    </select>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                    {!isNew ? (
                        <button onClick={onDelete} className="px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                            Delete
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2.5 text-sm text-[#6B6B70] hover:text-white rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button onClick={onSave} className="px-5 py-2.5 text-sm font-medium text-white bg-[#FF5C00] hover:bg-[#FF6B1A] rounded-lg transition-colors">
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContentPlanner;
