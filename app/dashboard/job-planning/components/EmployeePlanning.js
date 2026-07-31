'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    FiChevronLeft, FiChevronRight, FiPrinter, FiDownload, FiPlus, FiX, FiCheck,
    FiUser, FiFilter, FiSearch, FiActivity, FiCalendar, FiGrid, FiClock,
    FiLayers, FiEdit2, FiAlertCircle, FiSidebar, FiMove, FiCheckCircle,
    FiTrendingUp, FiBriefcase, FiList
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import AddTaskModal from './AddTaskModal';

const G = {
    bg: '#070710',
    glass: 'rgba(255,255,255,0.03)',
    glassHover: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.08)',
    borderBright: 'rgba(255,255,255,0.18)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#10b981', // Emerald green theme replacement
    blue: '#3b82f6',
};

const glassStyle = {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
};

const STATUS_COLOR = {
    pending: '#64748b',
    in_progress: '#f59e0b',
    done: '#10b981'
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

const fmtTime = (m) => {
    if (!m || isNaN(m)) return '0m';
    if (m >= 60) {
        const hrs = (m / 60).toFixed(1);
        return `${hrs}h`;
    }
    return `${m}m`;
};

const getWeekStart = (d) => {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    const s = new Date(dt.setDate(diff));
    s.setHours(0, 0, 0, 0);
    return s;
};

// ── Export Modal (Daily, Weekly, Unplanned Reports) ───────────────────────
function ExportModal({ employee, weekStart, onClose }) {
    const [reportType, setReportType] = useState('daily'); // 'daily' | 'weekly' | 'unplanned'
    const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()));
    const [format, setFormat] = useState('pdf');
    const [includeStats, setIncludeStats] = useState(true);
    const [excludeCompleted, setExcludeCompleted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleDownload = async () => {
        if (!employee?.id) {
            toast.error('No employee selected');
            return;
        }
        setLoading(true);
        try {
            let url = '';
            if (reportType === 'unplanned') {
                const params = new URLSearchParams({
                    format,
                    includeStats: String(includeStats),
                    columns: 'code,customer,name,delivery,quantity,time,status'
                });
                url = `/api/job-planning/employee/${employee.id}/unplanned-pdf?${params}`;
            } else if (reportType === 'daily') {
                const params = new URLSearchParams({
                    date: selectedDate,
                    format,
                    includeStats: String(includeStats),
                    excludeCompleted: String(excludeCompleted),
                    columns: 'code,customer,name,time,status'
                });
                url = `/api/job-planning/employee/${employee.id}/pdf?${params}`;
            } else {
                // weekly
                const ws = fmtDate(weekStart);
                const params = new URLSearchParams({
                    weekStart: ws,
                    format,
                    includeStats: String(includeStats),
                    excludeCompleted: String(excludeCompleted),
                    columns: 'code,customer,name,time,status'
                });
                url = `/api/job-planning/employee/${employee.id}/pdf?${params}`;
            }

            const res = await fetch(url);
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                toast.error(errJson.error || 'Failed to generate report');
                setLoading(false);
                return;
            }

            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            const safeName = (employee.name || 'employee').replace(/\s+/g, '-');
            const fileExt = format === 'csv' ? 'csv' : 'pdf';
            a.download = `${safeName}-${reportType}-report.${fileExt}`;
            a.click();
            toast.success(`Downloaded ${reportType} report for ${employee.name}`);
            onClose();
        } catch (err) {
            toast.error('Export error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex',
            alignItems: 'center', justifyCenter: 'center', padding: 16
        }}>
            <div style={{
                background: '#0d0d18', border: `1px solid ${G.borderBright}`,
                borderRadius: 20, width: '100%', maxWidth: 440, padding: 24,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <h3 style={{ color: G.text, fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FiPrinter className="text-emerald-400" size={18} /> Employee Planning Report
                        </h3>
                        <p style={{ color: G.muted, fontSize: 12, margin: '2px 0 0 0' }}>
                            {employee?.name} — {employee?.job_title || employee?.department || 'Production Team'}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: G.muted, cursor: 'pointer' }}>
                        <FiX size={18} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Report Type */}
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                            Report Scope
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                            {[
                                ['daily', 'Daily Report'],
                                ['weekly', 'Weekly Schedule'],
                                ['unplanned', 'Unplanned Queue']
                            ].map(([k, label]) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setReportType(k)}
                                    style={{
                                        padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                                        border: `1px solid ${reportType === k ? G.purple : G.border}`,
                                        background: reportType === k ? 'rgba(16,185,129,0.15)' : G.glass,
                                        color: reportType === k ? G.purple : G.muted, cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date picker if daily */}
                    {reportType === 'daily' && (
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                                Select Date
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                style={{
                                    width: '100%', background: '#000', border: `1px solid ${G.borderBright}`,
                                    color: G.text, borderRadius: 10, padding: '8px 12px', fontSize: 13,
                                    outline: 'none', colorScheme: 'dark'
                                }}
                            />
                        </div>
                    )}

                    {/* Export Format */}
                    <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                            File Format
                        </label>
                        <div style={{ display: 'flex', gap: 16 }}>
                            {[
                                ['pdf', 'PDF Document'],
                                ['csv', 'CSV Spreadsheet']
                            ].map(([k, label]) => (
                                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: format === k ? G.text : G.muted, fontSize: 13 }}>
                                    <input
                                        type="radio"
                                        checked={format === k}
                                        onChange={() => setFormat(k)}
                                        style={{ accentColor: G.purple }}
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: `1px solid ${G.border}`, margin: '0' }} />

                    {/* Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: G.text, fontSize: 13 }}>
                            <input
                                type="checkbox"
                                checked={includeStats}
                                onChange={e => setIncludeStats(e.target.checked)}
                                style={{ accentColor: G.success, width: 15, height: 15 }}
                            />
                            Include Performance &amp; Hours Summary
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: G.text, fontSize: 13 }}>
                            <input
                                type="checkbox"
                                checked={excludeCompleted}
                                onChange={e => setExcludeCompleted(e.target.checked)}
                                style={{ accentColor: G.success, width: 15, height: 15 }}
                            />
                            Exclude Completed Tasks
                        </label>
                    </div>
                </div>

                <button
                    onClick={handleDownload}
                    disabled={loading}
                    style={{
                        marginTop: 24, width: '100%', padding: '12px 0',
                        background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                        color: 'white', border: 'none', borderRadius: 12,
                        fontWeight: 700, fontSize: 14, cursor: 'pointer',
                        opacity: loading ? 0.6 : 1, transition: 'all 0.15s shadow',
                        boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                >
                    <FiDownload size={16} />
                    {loading ? 'Generating Document…' : `Download ${format.toUpperCase()} Report`}
                </button>
            </div>
        </div>
    );
}

// ── Interactive Task Card ──────────────────────────────────────────────────
function TaskCard({ task, employees = [], onDragStart, isDragging, onUpdateStatus, onAssignEmployee, onAddTask }) {
    const [showQuickMenu, setShowQuickMenu] = useState(false);
    const dot = STATUS_COLOR[task.status] || STATUS_COLOR.pending;
    const nameParts = task.name ? task.name.split('—') : [];
    const cleanName = nameParts.length >= 2 ? nameParts[nameParts.length - 2]?.trim() : (task.name || 'Task');
    const jobCode = task.order_code || 'GEN';
    const jobLabel = task.customer_name || task.estimation_names || 'Standalone Job';

    return (
        <div
            draggable
            onDragStart={onDragStart}
            style={{
                background: 'rgba(255,255,255,0.035)',
                border: `1px solid ${G.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'grab',
                opacity: isDragging ? 0.4 : 1,
                marginBottom: 8,
                position: 'relative',
                transition: 'all 0.15s ease'
            }}
            className="hover:border-white/20 group"
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
                    <span style={{
                        fontSize: 10, color: G.warning, fontWeight: 700,
                        background: 'rgba(245,158,11,0.1)', padding: '1px 6px',
                        borderRadius: 4, flexShrink: 0
                    }}>
                        {jobCode}
                    </span>
                    <span style={{
                        fontSize: 10, color: G.muted, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                        {jobLabel}
                    </span>
                </div>
            </div>

            <div style={{ fontSize: 12, color: G.text, fontWeight: 600, marginBottom: 6, lineHeight: 1.35 }}>
                {cleanName}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: G.subtle, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <FiClock size={11} /> {fmtTime(task.estimated_minutes)}
                    </span>
                    {task.machine_name && (
                        <span style={{ fontSize: 9, color: G.purple, background: 'rgba(16,185,129,0.1)', padding: '1px 5px', borderRadius: 4 }}>
                            {task.machine_name}
                        </span>
                    )}
                </div>

                {/* Status Toggle Buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {(['pending', 'in_progress', 'done']).map(s => (
                        <button
                            key={s}
                            onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, s); }}
                            title={`Mark ${s.replace('_', ' ')}`}
                            style={{
                                width: 15, height: 15, borderRadius: '50%',
                                border: `1.5px solid ${STATUS_COLOR[s]}`,
                                background: task.status === s ? STATUS_COLOR[s] : 'transparent',
                                cursor: 'pointer', padding: 0
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function SearchableEmployeeSelect({ employees, value, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchVal, setSearchVal] = useState('');

    useEffect(() => {
        setSearchVal(value || '');
    }, [value]);

    const filtered = employees.filter(e =>
        e.name.toLowerCase().includes(searchVal.toLowerCase()) ||
        (e.job_title || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (e.department || '').toLowerCase().includes(searchVal.toLowerCase())
    );

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <input
                    type="text"
                    placeholder="Type to filter & select employee..."
                    value={searchVal}
                    onChange={e => {
                        setSearchVal(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.4)',
                        border: `1.5px solid ${G.border}`,
                        color: G.text,
                        borderRadius: 12,
                        padding: '10px 14px',
                        fontSize: 13,
                        outline: 'none',
                        transition: 'all 0.15s'
                    }}
                    className="focus:border-emerald-500/50"
                />
                {value && (
                    <button
                        onClick={() => {
                            setSearchVal('');
                            onChange('');
                        }}
                        style={{
                            position: 'absolute', right: 12, background: 'none', border: 'none',
                            color: G.muted, cursor: 'pointer', display: 'flex', alignItems: 'center'
                        }}
                    >
                        <FiX size={14} />
                    </button>
                )}
            </div>

            {isOpen && (
                <>
                    <div
                        onClick={() => {
                            setIsOpen(false);
                            setSearchVal(value || '');
                        }}
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                    />
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: 6,
                            background: 'rgba(10, 10, 20, 0.95)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: `1px solid ${G.border}`,
                            borderRadius: 12,
                            maxHeight: 240,
                            overflowY: 'auto',
                            zIndex: 1000,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                            padding: 4
                        }}
                    >
                        {filtered.length === 0 ? (
                            <div style={{ padding: '12px 14px', fontSize: 12, color: G.subtle, textAlign: 'center' }}>
                                No employees found
                            </div>
                        ) : (
                            filtered.map(e => (
                                <div
                                    key={e.id}
                                    onClick={() => {
                                        onChange(e.name);
                                        setSearchVal(e.name);
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        color: value === e.name ? '#000' : G.text,
                                        background: value === e.name ? '#10b981' : 'transparent',
                                        transition: 'all 0.1s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 2
                                    }}
                                    className="hover:bg-emerald-500/20 hover:text-white"
                                >
                                    <span style={{ fontWeight: 600 }}>{e.name}</span>
                                    <span style={{ fontSize: 10, opacity: 0.7 }}>
                                        {e.job_title || 'Operator'} · {e.department || 'Production'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function DetailedTaskRow({ task, onUpdateStatus }) {
    const dot = STATUS_COLOR[task.status] || STATUS_COLOR.pending;
    const nameParts = task.name ? task.name.split('—') : [];
    const cleanName = nameParts.length >= 2 ? nameParts[nameParts.length - 2]?.trim() : (task.name || 'Task');
    const jobCode = task.order_code || 'GEN';
    const jobLabel = task.customer_name || task.estimation_names || 'Standalone Job';

    const formatDuration = (mins) => {
        if (!mins) return '0m';
        const hrs = Math.floor(mins / 60);
        const rm = mins % 60;
        if (hrs > 0 && rm > 0) return `${hrs}h ${rm}m`;
        if (hrs > 0) return `${hrs}h`;
        return `${mins}m`;
    };

    return (
        <div
            style={{
                background: 'rgba(255,255,255,0.025)',
                border: `1px solid ${G.border}`,
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                transition: 'all 0.15s'
            }}
            className="hover:border-white/25 hover:bg-white/[0.04]"
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                {/* Status Dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
                
                {/* Job Info */}
                <div style={{ minWidth: 100, flexShrink: 0 }}>
                    <span style={{
                        fontSize: 11, color: G.warning, fontWeight: 700,
                        background: 'rgba(245,158,11,0.1)', padding: '2px 8px',
                        borderRadius: 6
                    }}>
                        {jobCode}
                    </span>
                    <div style={{ fontSize: 11, color: G.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {jobLabel}
                    </div>
                </div>

                {/* Task Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: G.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cleanName}
                    </div>
                    {task.description && (
                        <div style={{ fontSize: 11, color: G.subtle, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.description}
                        </div>
                    )}
                </div>

                {/* Machine Info */}
                {task.machine_name && (
                    <div style={{ flexShrink: 0 }}>
                        <span style={{ fontSize: 10, color: G.purple, background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                            {task.machine_name}
                        </span>
                    </div>
                )}
            </div>

            {/* Time & Status controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: G.muted, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                    <FiClock size={13} /> {formatDuration(task.estimated_minutes)}
                </span>

                {/* Status Toggle Buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                    {(['pending', 'in_progress', 'done']).map(s => {
                        const active = task.status === s;
                        let btnBg = 'transparent';
                        let btnBorder = STATUS_COLOR[s];
                        let btnText = STATUS_COLOR[s];
                        if (active) {
                            btnBg = STATUS_COLOR[s];
                            btnText = '#000';
                        }
                        return (
                            <button
                                key={s}
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, s); }}
                                style={{
                                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                    padding: '3px 8px', borderRadius: 6,
                                    border: `1.5px solid ${btnBorder}`,
                                    background: btnBg,
                                    color: btnText,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                }}
                            >
                                {s.replace('_', ' ')}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Main Employee Planning Component ──────────────────────────────────────
export default function EmployeePlanning({ orders = [], employees: initialEmployees = [], onRefresh }) {
    const [employees, setEmployees] = useState(initialEmployees);
    const [allTasks, setAllTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
    const [viewMode, setViewMode] = useState('matrix'); // 'matrix' | 'board' | 'overview'
    const [selectedDay, setSelectedDay] = useState(() => fmtDate(new Date()));
    const [dragOverDayCell, setDragOverDayCell] = useState(null);
    const [selectedDailyEmployeeName, setSelectedDailyEmployeeName] = useState('');

    const prevDay = () => {
        const d = new Date(selectedDay);
        d.setDate(d.getDate() - 1);
        setSelectedDay(fmtDate(d));
    };
    const nextDay = () => {
        const d = new Date(selectedDay);
        d.setDate(d.getDate() + 1);
        setSelectedDay(fmtDate(d));
    };
    const [draggedTaskId, setDraggedTaskId] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null);
    const [showAddTask, setShowAddTask] = useState(false);
    const [addTaskDefaults, setAddTaskDefaults] = useState({});
    const [exportEmployee, setExportEmployee] = useState(null);
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('all');
    const [showBacklog, setShowBacklog] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/job-planning/employee');
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setEmployees(json.employees || []);
            setAllTasks(json.tasks || []);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch employee tasks');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return {
            date: d,
            key: fmtDate(d),
            label: DAYS[i],
            short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };
    });

    const prevWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() - 7);
        setWeekStart(d);
    };
    const nextWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 7);
        setWeekStart(d);
    };
    const setToday = () => {
        setWeekStart(getWeekStart(new Date()));
        setSelectedDay(fmtDate(new Date()));
    };

    const weekRangeStr = `${weekDays[0].short} – ${weekDays[6].short}, ${weekStart.getFullYear()}`;

    // Filter Tasks helpers
    const getTasksForEmployeeDay = (empName, dateKey) => {
        return allTasks.filter(t =>
            t.assigned_to === empName &&
            t.scheduled_date &&
            fmtDate(new Date(t.scheduled_date)) === dateKey
        );
    };

    const getUnplannedForEmployee = (empName) => {
        return allTasks.filter(t => t.assigned_to === empName && !t.scheduled_date);
    };

    const unassignedTasks = allTasks.filter(t => !t.assigned_to);

    // Drop handler for dragging task onto employee/day
    const handleDrop = async (empName, dateKey = null) => {
        if (!draggedTaskId) return;
        setDraggedTaskId(null);
        setDragOverCell(null);
        setDragOverDayCell(null);
        try {
            const res = await fetch('/api/job-planning/employee/assign', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: draggedTaskId,
                    employeeName: empName,
                    scheduledDate: dateKey
                })
            });
            if (res.ok) {
                toast.success(`Task assigned to ${empName}`);
                loadData();
            } else {
                const j = await res.json();
                toast.error(j.error || 'Failed to assign task');
            }
        } catch {
            toast.error('Network error while assigning task');
        }
    };

    const handleUpdateStatus = async (taskId, status) => {
        try {
            await fetch('/api/job-planning/employee/assign', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, status })
            });
            setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
        } catch {
            toast.error('Failed to update status');
        }
    };

    const depts = ['all', ...Array.from(new Set(employees.map(e => e.department).filter(Boolean)))];
    const filteredEmployees = employees.filter(e => {
        const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || (e.job_title || '').toLowerCase().includes(search.toLowerCase());
        const matchDept = filterDept === 'all' || e.department === filterDept;
        return matchSearch && matchDept;
    });

    useEffect(() => {
        if (viewMode === 'day') {
            if (filteredEmployees.length > 0) {
                const exists = filteredEmployees.some(e => e.name === selectedDailyEmployeeName);
                if (!exists) {
                    setSelectedDailyEmployeeName(filteredEmployees[0].name);
                }
            } else {
                setSelectedDailyEmployeeName('');
            }
        }
    }, [viewMode, filteredEmployees, selectedDailyEmployeeName]);

    const totalScheduled = allTasks.filter(t => t.scheduled_date && weekDays.some(d => d.key === fmtDate(new Date(t.scheduled_date)))).length;
    const totalDone = allTasks.filter(t => t.status === 'done' && t.scheduled_date && weekDays.some(d => d.key === fmtDate(new Date(t.scheduled_date)))).length;
    const totalHoursAll = (allTasks.filter(t => t.scheduled_date && weekDays.some(d => d.key === fmtDate(new Date(t.scheduled_date)))).reduce((s, t) => s + (t.estimated_minutes || 0), 0) / 60).toFixed(1);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '80px 0', color: G.muted, fontSize: 13 }}>
                <FiClock className="animate-spin inline-block mr-2" size={18} /> Loading employee planning module…
            </div>
        );
    }

    return (
        <div style={{ fontFamily: 'Inter, sans-serif', color: G.text }}>
            {exportEmployee && (
                <ExportModal
                    employee={exportEmployee}
                    weekStart={weekStart}
                    onClose={() => setExportEmployee(null)}
                />
            )}

            {showAddTask && (
                <AddTaskModal
                    machines={[]}
                    finishings={[]}
                    orders={orders}
                    initialValues={addTaskDefaults}
                    onClose={() => setShowAddTask(false)}
                    onSuccess={async () => {
                        setShowAddTask(false);
                        await loadData();
                        if (onRefresh) onRefresh();
                        toast.success('Task created successfully');
                    }}
                />
            )}

            {/* ── 1. Top Stat Summary Cards ────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                {[
                    ['Active Operators', filteredEmployees.length, G.purple, <FiUser key="1" />],
                    ['Scheduled Tasks', totalScheduled, G.warning, <FiCalendar key="2" />],
                    ['Total Workload', `${totalHoursAll} hrs`, G.blue, <FiClock key="3" />],
                    ['Completed Tasks', totalDone, G.success, <FiCheckCircle key="4" />],
                    ['Unassigned Backlog', unassignedTasks.length, G.danger, <FiAlertCircle key="5" />]
                ].map(([label, val, accent, icon]) => (
                    <div
                        key={label}
                        style={{
                            ...glassStyle,
                            borderRadius: 16, padding: '14px 18px', display: 'flex',
                            alignItems: 'center', justifyContent: 'space-between'
                        }}
                    >
                        <div>
                            <span style={{ fontSize: 10, color: G.subtle, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                                {label}
                            </span>
                            <div style={{ fontSize: 22, fontWeight: 800, color: accent, fontFamily: 'monospace', marginTop: 2 }}>
                                {val}
                            </div>
                        </div>
                        <div style={{
                            width: 38, height: 38, borderRadius: 12,
                            background: `rgba(255,255,255,0.04)`, border: `1px solid ${G.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: accent, fontSize: 18
                        }}>
                            {icon}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── 2. Navigation & Filter Control Bar ─────────────────────────── */}
            <div style={{
                display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 20, flexWrap: 'wrap', ...glassStyle,
                borderRadius: 16, padding: '10px 14px'
            }}>
                {/* View switcher */}
                <div style={{ display: 'flex', background: '#000', padding: 3, borderRadius: 12, border: `1px solid ${G.border}` }}>
                    {[
                        ['matrix', 'Weekly Matrix', <FiGrid key="m" />],
                        ['day', 'Daily View', <FiCalendar key="d" />],
                        ['board', 'Board View', <FiSidebar key="b" />],
                        ['overview', 'Capacity Overview', <FiTrendingUp key="o" />]
                    ].map(([mode, label, icon]) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                background: viewMode === mode ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: viewMode === mode ? G.text : G.muted, border: 'none',
                                transition: 'all 0.15s'
                            }}
                        >
                            {icon} {label}
                        </button>
                    ))}
                </div>

                {/* Day / Week Navigator */}
                {viewMode === 'day' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                            onClick={prevDay}
                            style={{
                                background: G.glass, border: `1px solid ${G.border}`,
                                color: G.muted, borderRadius: 8, padding: '6px 10px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center'
                            }}
                        >
                            <FiChevronLeft size={16} />
                        </button>
                        <button
                            onClick={setToday}
                            style={{
                                background: G.glass, border: `1px solid ${G.border}`,
                                color: G.text, borderRadius: 8, padding: '6px 10px',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            Today
                        </button>
                        <input
                            type="date"
                            value={selectedDay}
                            onChange={e => setSelectedDay(e.target.value)}
                            style={{
                                background: '#000', border: `1px solid ${G.border}`,
                                color: G.text, borderRadius: 8, padding: '5px 10px',
                                fontSize: 12, fontWeight: 600, outline: 'none', colorScheme: 'dark'
                            }}
                        />
                        <button
                            onClick={nextDay}
                            style={{
                                background: G.glass, border: `1px solid ${G.border}`,
                                color: G.muted, borderRadius: 8, padding: '6px 10px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center'
                            }}
                        >
                            <FiChevronRight size={16} />
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                            onClick={prevWeek}
                            style={{
                                background: G.glass, border: `1px solid ${G.border}`,
                                color: G.muted, borderRadius: 8, padding: '6px 10px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center'
                            }}
                        >
                            <FiChevronLeft size={16} />
                        </button>
                        <button
                            onClick={setToday}
                            style={{
                                background: G.glass, border: `1px solid ${G.border}`,
                                color: G.text, borderRadius: 8, padding: '6px 10px',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            Today
                        </button>
                        <span style={{ fontSize: 13, color: G.text, fontWeight: 600, minWidth: 160, textAlign: 'center' }}>
                            {weekRangeStr}
                        </span>
                        <button
                            onClick={nextWeek}
                            style={{
                                background: G.glass, border: `1px solid ${G.border}`,
                                color: G.muted, borderRadius: 8, padding: '6px 10px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center'
                            }}
                        >
                            <FiChevronRight size={16} />
                        </button>
                    </div>
                )}

                {/* Filters and Add Task */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, background: '#000',
                        border: `1px solid ${G.border}`, borderRadius: 10, padding: '6px 12px', width: 180
                    }}>
                        <FiSearch size={14} color={G.subtle} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search employee…"
                            style={{ background: 'none', border: 'none', color: G.text, fontSize: 12, outline: 'none', width: '100%' }}
                        />
                    </div>

                    <select
                        value={filterDept}
                        onChange={e => setFilterDept(e.target.value)}
                        style={{
                            background: '#000', border: `1px solid ${G.border}`, color: G.muted,
                            borderRadius: 10, padding: '6px 12px', fontSize: 12, cursor: 'pointer'
                        }}
                    >
                        {depts.map(d => (
                            <option key={d} value={d}>{d === 'all' ? 'All Depts' : d}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => setShowBacklog(!showBacklog)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                            background: showBacklog ? 'rgba(59,130,246,0.15)' : G.glass,
                            border: `1px solid ${showBacklog ? G.blue : G.border}`,
                            color: showBacklog ? G.blue : G.muted, borderRadius: 10,
                            cursor: 'pointer', fontSize: 12, fontWeight: 600
                        }}
                    >
                        <FiSidebar size={14} /> Backlog ({unassignedTasks.length})
                    </button>

                    <button
                        onClick={() => {
                            setAddTaskDefaults({});
                            setShowAddTask(true);
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                            background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                            color: 'white', borderRadius: 10, cursor: 'pointer',
                            fontSize: 12, fontWeight: 700, border: 'none',
                            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                        }}
                    >
                        <FiPlus size={14} /> Add Task
                    </button>
                </div>
            </div>

            {/* ── 3. Main Planning Workspace (Backlog + Views) ───────────────── */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

                {/* Left Drawer / Sidebar: Unassigned Tasks Backlog */}
                {showBacklog && (
                    <div style={{
                        width: 260, flexShrink: 0, background: G.glass,
                        border: `1px solid ${G.border}`, borderRadius: 16, padding: 14
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FiList className="text-amber-400" size={16} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>Unassigned Queue</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: G.warning, background: 'rgba(245,158,11,0.1)', padding: '2px 7px', borderRadius: 6 }}>
                                {unassignedTasks.length}
                            </span>
                        </div>
                        <p style={{ fontSize: 10, color: G.subtle, marginBottom: 12 }}>
                            Drag tasks onto any operator's day to schedule instantly.
                        </p>

                        <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', paddingRight: 4 }}>
                            {unassignedTasks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px 10px', color: G.subtle, border: `1px dashed ${G.border}`, borderRadius: 10 }}>
                                    <FiCheckCircle size={24} style={{ marginBottom: 6, margin: '0 auto' }} />
                                    <p style={{ fontSize: 11 }}>All tasks assigned!</p>
                                </div>
                            ) : (
                                unassignedTasks.map(t => (
                                    <TaskCard
                                        key={t.id}
                                        task={t}
                                        employees={employees}
                                        onDragStart={() => setDraggedTaskId(t.id)}
                                        isDragging={draggedTaskId === t.id}
                                        onUpdateStatus={handleUpdateStatus}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Right Content Area: Views */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {filteredEmployees.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: G.muted, background: G.glass, border: `1px dashed ${G.border}`, borderRadius: 16 }}>
                            <FiUser size={36} style={{ marginBottom: 12, opacity: 0.3, margin: '0 auto' }} />
                            <p style={{ fontSize: 14 }}>No employees found matching filter.</p>
                        </div>
                    ) : (
                        <>
                            {/* VIEW 1: WEEKLY MATRIX */}
                            {viewMode === 'matrix' && (
                                <div style={{ overflowX: 'auto', background: G.glass, border: `1px solid ${G.border}`, borderRadius: 16 }}>
                                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                                        <thead>
                                            <tr>
                                                <th style={{
                                                    padding: '12px 14px', background: 'rgba(255,255,255,0.04)',
                                                    borderBottom: `1px solid ${G.border}`, color: G.muted,
                                                    fontSize: 11, fontWeight: 700, textAlign: 'left', width: 170,
                                                    position: 'sticky', left: 0, zIndex: 2
                                                }}>
                                                    Employee
                                                </th>
                                                <th style={{
                                                    padding: '12px 8px', background: 'rgba(255,255,255,0.04)',
                                                    borderBottom: `1px solid ${G.border}`, color: G.danger,
                                                    fontSize: 11, fontWeight: 700, textAlign: 'center', width: 120
                                                }}>
                                                    Unplanned
                                                </th>
                                                {weekDays.map(d => (
                                                    <th key={d.key} style={{
                                                        padding: '12px 8px', background: 'rgba(255,255,255,0.04)',
                                                        borderBottom: `1px solid ${G.border}`, color: G.muted,
                                                        fontSize: 11, fontWeight: 700, textAlign: 'center', minWidth: 140
                                                    }}>
                                                        <div style={{ color: G.text }}>{d.label}</div>
                                                        <div style={{ fontSize: 10, color: G.subtle, marginTop: 2 }}>{d.short}</div>
                                                    </th>
                                                ))}
                                                <th style={{
                                                    padding: '12px 8px', background: 'rgba(255,255,255,0.04)',
                                                    borderBottom: `1px solid ${G.border}`, color: G.muted,
                                                    fontSize: 11, fontWeight: 700, textAlign: 'center', width: 80
                                                }}>
                                                    Report
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEmployees.map(emp => {
                                                const unplanned = getUnplannedForEmployee(emp.name);
                                                const totalMins = allTasks.filter(t =>
                                                    t.assigned_to === emp.name &&
                                                    t.scheduled_date &&
                                                    weekDays.some(d => d.key === fmtDate(new Date(t.scheduled_date)))
                                                ).reduce((s, t) => s + (t.estimated_minutes || 0), 0);
                                                const totalHours = (totalMins / 60).toFixed(1);

                                                return (
                                                    <tr key={emp.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                                                        {/* Employee Info Header */}
                                                        <td style={{
                                                            padding: '12px 14px', borderRight: `1px solid ${G.border}`,
                                                            background: '#090914', verticalAlign: 'top',
                                                            position: 'sticky', left: 0, zIndex: 1
                                                        }}>
                                                            <div style={{ fontWeight: 700, fontSize: 13, color: G.text }}>{emp.name}</div>
                                                            <div style={{ fontSize: 10, color: G.subtle, marginTop: 2 }}>{emp.job_title || emp.department || 'Operator'}</div>
                                                            <div style={{ fontSize: 10, color: G.purple, fontWeight: 600, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <FiClock size={10} /> {totalHours} hrs scheduled
                                                            </div>
                                                        </td>

                                                        {/* Unplanned Queue for Employee */}
                                                        <td
                                                            style={{
                                                                padding: 8, borderRight: `1px solid ${G.border}`,
                                                                verticalAlign: 'top', background: 'rgba(239,68,68,0.02)'
                                                            }}
                                                            onDragOver={e => e.preventDefault()}
                                                            onDrop={e => { e.preventDefault(); handleDrop(emp.name, null); }}
                                                        >
                                                            {unplanned.length === 0 ? (
                                                                <div style={{ fontSize: 10, color: G.subtle, textAlign: 'center', padding: '12px 0' }}>—</div>
                                                            ) : (
                                                                unplanned.map(t => (
                                                                    <TaskCard
                                                                        key={t.id}
                                                                        task={t}
                                                                        onDragStart={() => setDraggedTaskId(t.id)}
                                                                        isDragging={draggedTaskId === t.id}
                                                                        onUpdateStatus={handleUpdateStatus}
                                                                    />
                                                                ))
                                                            )}
                                                        </td>

                                                        {/* 7 Days Columns */}
                                                        {weekDays.map(d => {
                                                            const dayTasks = getTasksForEmployeeDay(emp.name, d.key);
                                                            const isOver = dragOverCell === `${emp.id}-${d.key}`;
                                                            return (
                                                                <td
                                                                    key={d.key}
                                                                    style={{
                                                                        padding: 8, borderRight: `1px solid ${G.border}`,
                                                                        verticalAlign: 'top',
                                                                        background: isOver ? 'rgba(16,185,129,0.1)' : 'transparent',
                                                                        transition: 'background 0.15s', minHeight: 70
                                                                    }}
                                                                    onDragOver={e => { e.preventDefault(); setDragOverCell(`${emp.id}-${d.key}`); }}
                                                                    onDragLeave={() => setDragOverCell(null)}
                                                                    onDrop={e => { e.preventDefault(); handleDrop(emp.name, d.key); }}
                                                                >
                                                                    {dayTasks.map(t => (
                                                                        <TaskCard
                                                                            key={t.id}
                                                                            task={t}
                                                                            onDragStart={() => setDraggedTaskId(t.id)}
                                                                            isDragging={draggedTaskId === t.id}
                                                                            onUpdateStatus={handleUpdateStatus}
                                                                        />
                                                                    ))}

                                                                    <button
                                                                        onClick={() => {
                                                                            setAddTaskDefaults({ assigned_to: emp.name, scheduled_date: d.key });
                                                                            setShowAddTask(true);
                                                                        }}
                                                                        style={{
                                                                            width: '100%', padding: '4px 0', fontSize: 10,
                                                                            color: G.subtle, borderRadius: 6, border: `1px dashed ${G.border}`,
                                                                            background: 'transparent', cursor: 'pointer',
                                                                            marginTop: 4, transition: 'all 0.15s'
                                                                        }}
                                                                        className="hover:text-emerald-300 hover:border-emerald-500/40"
                                                                    >
                                                                        + Add task
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}

                                                        {/* Export Daily / Weekly PDF */}
                                                        <td style={{ padding: 8, verticalAlign: 'middle', textAlign: 'center' }}>
                                                            <button
                                                                onClick={() => setExportEmployee(emp)}
                                                                title="Download Report"
                                                                style={{
                                                                    background: G.glass, border: `1px solid ${G.border}`,
                                                                    color: G.muted, borderRadius: 8, padding: '6px 10px',
                                                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                                    gap: 4, fontSize: 11, margin: '0 auto'
                                                                }}
                                                                className="hover:text-white hover:border-white/30"
                                                            >
                                                                <FiPrinter size={13} /> PDF
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* VIEW 4: DAILY VIEW (SINGLE EMPLOYEE DETAILED VIEW) */}
                            {viewMode === 'day' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {/* Selection Header */}
                                    <div style={{
                                        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
                                        ...glassStyle, borderRadius: 16, padding: '12px 18px'
                                    }}>
                                        <label style={{ fontSize: 13, fontWeight: 700, color: G.muted }}>
                                            Select Employee:
                                        </label>
                                        <SearchableEmployeeSelect
                                            employees={filteredEmployees}
                                            value={selectedDailyEmployeeName}
                                            onChange={setSelectedDailyEmployeeName}
                                        />
                                    </div>

                                    {/* Employee Details & Tasks */}
                                    {(() => {
                                        const emp = filteredEmployees.find(e => e.name === selectedDailyEmployeeName);
                                        if (!emp) {
                                            return (
                                                <div style={{ textAlign: 'center', padding: '60px 0', color: G.muted, background: G.glass, border: `1px dashed ${G.border}`, borderRadius: 16 }}>
                                                    <FiUser size={36} style={{ marginBottom: 12, opacity: 0.3, margin: '0 auto' }} />
                                                    <p style={{ fontSize: 14 }}>Please select an employee to view their daily plan.</p>
                                                </div>
                                            );
                                        }

                                        const dayTasks = getTasksForEmployeeDay(emp.name, selectedDay);
                                        const totalMins = dayTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
                                        const totalHours = (totalMins / 60).toFixed(1);
                                        const isOver = dragOverDayCell === emp.id;

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                {/* Employee Banner */}
                                                <div style={{
                                                    ...glassStyle,
                                                    borderRadius: 16, padding: '16px 20px', display: 'flex',
                                                    alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                        <div style={{
                                                            width: 46, height: 46, borderRadius: 12,
                                                            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            color: 'white', fontWeight: 800, fontSize: 18
                                                        }}>
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h3 style={{ fontSize: 16, fontWeight: 700, color: G.text, margin: 0 }}>{emp.name}</h3>
                                                            <p style={{ fontSize: 11, color: G.muted, margin: '2px 0 0 0' }}>
                                                                {emp.job_title || 'Operator'} · <span style={{ color: G.purple, fontWeight: 600 }}>{emp.department || 'Production'}</span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <span style={{ fontSize: 11, color: G.muted }}>Scheduled Workload</span>
                                                            <div style={{ fontSize: 18, fontWeight: 800, color: G.purple, marginTop: 2 }}>
                                                                {totalHours} hrs <span style={{ fontSize: 11, color: G.subtle, fontWeight: 400 }}>({dayTasks.length} tasks)</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setExportEmployee(emp)}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                                                                ...glassStyle,
                                                                color: G.text, borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600
                                                            }}
                                                            className="hover:text-white hover:border-white/30"
                                                        >
                                                            <FiPrinter size={13} /> PDF Report
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Detailed Tasks Container Dropzone */}
                                                <div
                                                    style={{
                                                        ...glassStyle,
                                                        background: isOver ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                                                        border: `2px dashed ${isOver ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
                                                        borderRadius: 20, padding: 20, minHeight: 200,
                                                        boxShadow: isOver ? '0 0 25px rgba(16,185,129,0.2)' : '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    onDragOver={e => { e.preventDefault(); setDragOverDayCell(emp.id); }}
                                                    onDragLeave={() => setDragOverDayCell(null)}
                                                    onDrop={e => { e.preventDefault(); handleDrop(emp.name, selectedDay); }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                                        <h4 style={{ fontSize: 14, fontWeight: 700, color: G.text, margin: 0 }}>
                                                            Detailed Daily Schedule
                                                        </h4>
                                                        <button
                                                            onClick={() => {
                                                                setAddTaskDefaults({ assigned_to: emp.name, scheduled_date: selectedDay });
                                                                setShowAddTask(true);
                                                            }}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                                                background: 'rgba(255,255,255,0.05)', border: `1px solid ${G.border}`,
                                                                borderRadius: 8, color: G.muted, fontSize: 11, fontWeight: 600,
                                                                cursor: 'pointer'
                                                            }}
                                                            className="hover:text-white hover:border-white/20"
                                                        >
                                                            <FiPlus size={13} /> Add Task
                                                        </button>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                        {dayTasks.length === 0 ? (
                                                            <div style={{
                                                                textAlign: 'center', padding: '60px 20px', color: G.subtle,
                                                                border: `1px dashed ${G.border}`, borderRadius: 12
                                                            }}>
                                                                <FiCalendar size={32} style={{ marginBottom: 10, opacity: 0.3, margin: '0 auto' }} />
                                                                <p style={{ fontSize: 13, margin: 0 }}>No tasks scheduled for {selectedDay}.</p>
                                                                <p style={{ fontSize: 11, color: G.subtle, marginTop: 4 }}>
                                                                    Drag tasks from the Unassigned Queue here to schedule.
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            dayTasks.map(t => (
                                                                <DetailedTaskRow
                                                                    key={t.id}
                                                                    task={t}
                                                                    onUpdateStatus={handleUpdateStatus}
                                                                />
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* VIEW 2: BOARD / KANBAN PER EMPLOYEE */}
                            {viewMode === 'board' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                    {filteredEmployees.map(emp => {
                                        const empTasks = allTasks.filter(t => t.assigned_to === emp.name);
                                        const totalHrs = (empTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0) / 60).toFixed(1);

                                        return (
                                            <div
                                                key={emp.id}
                                                style={{
                                                    ...glassStyle,
                                                    borderRadius: 16, padding: 16
                                                }}
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => { e.preventDefault(); handleDrop(emp.name, null); }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                                    <div>
                                                        <h4 style={{ fontSize: 14, fontWeight: 700, color: G.text, margin: 0 }}>{emp.name}</h4>
                                                        <p style={{ fontSize: 10, color: G.subtle, margin: '2px 0 0 0' }}>{emp.job_title || emp.department || 'Operator'}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, color: G.purple, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                                            {totalHrs} hrs
                                                        </span>
                                                        <button
                                                            onClick={() => setExportEmployee(emp)}
                                                            style={{ display: 'block', fontSize: 10, color: G.muted, cursor: 'pointer', marginTop: 4, border: 'none', background: 'none' }}
                                                        >
                                                            <FiPrinter size={11} className="inline mr-1" /> PDF Report
                                                        </button>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
                                                    {empTasks.length === 0 ? (
                                                        <div style={{ textAlign: 'center', padding: '30px 0', color: G.subtle, fontSize: 11, border: `1px dashed ${G.border}`, borderRadius: 10 }}>
                                                            No tasks assigned
                                                        </div>
                                                    ) : (
                                                        empTasks.map(t => (
                                                            <TaskCard
                                                                key={t.id}
                                                                task={t}
                                                                onDragStart={() => setDraggedTaskId(t.id)}
                                                                isDragging={draggedTaskId === t.id}
                                                                onUpdateStatus={handleUpdateStatus}
                                                            />
                                                        ))
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setAddTaskDefaults({ assigned_to: emp.name });
                                                        setShowAddTask(true);
                                                    }}
                                                    style={{
                                                        marginTop: 12, width: '100%', padding: '8px 0',
                                                        background: 'rgba(255,255,255,0.04)', border: `1px dashed ${G.border}`,
                                                        borderRadius: 10, color: G.muted, fontSize: 12, fontWeight: 600,
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                        justifyContent: 'center', gap: 6
                                                    }}
                                                    className="hover:text-white hover:border-white/30"
                                                >
                                                    <FiPlus size={14} /> Add Task to {emp.name.split(' ')[0]}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* VIEW 3: CAPACITY & OVERVIEW SUMMARY */}
                            {viewMode === 'overview' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                                    {filteredEmployees.map(emp => {
                                        const empTasks = allTasks.filter(t => t.assigned_to === emp.name);
                                        const scheduledTasks = empTasks.filter(t => t.scheduled_date);
                                        const doneTasks = empTasks.filter(t => t.status === 'done');
                                        const totalMins = scheduledTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
                                        const totalHrs = (totalMins / 60);

                                        // Workload Status
                                        let statusLabel = 'Optimal';
                                        let statusColor = G.success;
                                        if (totalHrs > 40) {
                                            statusLabel = 'Overloaded';
                                            statusColor = G.danger;
                                        } else if (totalHrs < 10) {
                                            statusLabel = 'Light Workload';
                                            statusColor = G.blue;
                                        }

                                        const pct = empTasks.length > 0 ? Math.round((doneTasks.length / empTasks.length) * 100) : 0;

                                        return (
                                            <div
                                                key={emp.id}
                                                style={{
                                                    ...glassStyle,
                                                    borderRadius: 16, padding: 20
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{
                                                            width: 42, height: 42, borderRadius: 12,
                                                            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            color: 'white', fontWeight: 800, fontSize: 16
                                                        }}>
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h4 style={{ fontSize: 15, fontWeight: 700, color: G.text, margin: 0 }}>{emp.name}</h4>
                                                            <p style={{ fontSize: 11, color: G.subtle, margin: '2px 0 0 0' }}>{emp.job_title || emp.department || 'Operator'}</p>
                                                        </div>
                                                    </div>
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                                        color: statusColor, background: `${statusColor}15`,
                                                        padding: '3px 8px', borderRadius: 6, border: `1px solid ${statusColor}30`
                                                    }}>
                                                        {statusLabel}
                                                    </span>
                                                </div>

                                                {/* Capacity progress bar */}
                                                <div style={{ marginBottom: 16 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: G.muted, marginBottom: 6 }}>
                                                        <span>Weekly Utilization ({totalHrs.toFixed(1)} / 40 hrs)</span>
                                                        <span style={{ color: G.text, fontWeight: 700 }}>{Math.min(100, Math.round((totalHrs / 40) * 100))}%</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${Math.min(100, (totalHrs / 40) * 100)}%`, height: '100%',
                                                            background: statusColor, transition: 'width 0.3s'
                                                        }} />
                                                    </div>
                                                </div>

                                                {/* Quick Metrics */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                                                    <div style={{ background: '#000', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{empTasks.length}</div>
                                                        <div style={{ fontSize: 9, color: G.subtle, textTransform: 'uppercase' }}>Total Tasks</div>
                                                    </div>
                                                    <div style={{ background: '#000', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: G.success }}>{doneTasks.length}</div>
                                                        <div style={{ fontSize: 9, color: G.subtle, textTransform: 'uppercase' }}>Completed</div>
                                                    </div>
                                                    <div style={{ background: '#000', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: G.purple }}>{pct}%</div>
                                                        <div style={{ fontSize: 9, color: G.subtle, textTransform: 'uppercase' }}>Done Rate</div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        onClick={() => setExportEmployee(emp)}
                                                        style={{
                                                            flex: 1, padding: '8px 0', background: G.glass,
                                                            border: `1px solid ${G.border}`, borderRadius: 10,
                                                            color: G.text, fontSize: 12, fontWeight: 600,
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                            justifyContent: 'center', gap: 6
                                                        }}
                                                    >
                                                        <FiPrinter size={13} /> Daily PDF Report
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setAddTaskDefaults({ assigned_to: emp.name });
                                                            setShowAddTask(true);
                                                        }}
                                                        style={{
                                                            flex: 1, padding: '8px 0', background: 'rgba(16,185,129,0.15)',
                                                            border: `1px solid rgba(16,185,129,0.3)`, borderRadius: 10,
                                                            color: G.purple, fontSize: 12, fontWeight: 600,
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                                                            justifyContent: 'center', gap: 6
                                                        }}
                                                    >
                                                        <FiPlus size={13} /> Add Task
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
