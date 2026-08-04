'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    FiChevronLeft, FiChevronRight, FiPrinter, FiDownload, FiPlus, FiX, FiCheck,
    FiUser, FiFilter, FiSearch, FiActivity, FiCalendar, FiGrid, FiClock,
    FiLayers, FiEdit2, FiAlertCircle, FiSidebar, FiMove, FiCheckCircle,
    FiTrendingUp, FiBriefcase, FiList
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import AddTaskModal from './AddTaskModal';



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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-[#0d0d18] border border-white/20 rounded-2xl w-full max-w-[440px] p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-5">
                    <div>
                        <h3 className="text-slate-100 text-base font-bold m-0 flex items-center gap-2">
                            <FiPrinter className="text-emerald-400" size={18} /> Employee Planning Report
                        </h3>
                        <p className="text-slate-400 text-xs mt-0.5 mb-0 mx-0">
                            {employee?.name} — {employee?.job_title || employee?.department || 'Production Team'}
                        </p>
                    </div>
                    <button onClick={onClose} className="bg-none border-none text-slate-400 cursor-pointer hover:text-white transition-colors">
                        <FiX size={18} />
                    </button>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Report Type */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Report Scope
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                ['daily', 'Daily Report'],
                                ['weekly', 'Weekly Schedule'],
                                ['unplanned', 'Unplanned Queue']
                            ].map(([k, label]) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setReportType(k)}
                                    className={`px-2.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all duration-150 ${reportType === k
                                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-white hover:border-white/20'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date picker if daily */}
                    {reportType === 'daily' && (
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Select Date
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="w-full bg-black border border-white/20 text-slate-100 rounded-xl px-3 py-2 text-sm outline-none color-scheme-dark"
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                    )}

                    {/* Export Format */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            File Format
                        </label>
                        <div className="flex gap-4">
                            {[
                                ['pdf', 'PDF Document'],
                                ['csv', 'CSV Spreadsheet']
                            ].map(([k, label]) => (
                                <label key={k} className={`flex items-center gap-2 cursor-pointer text-sm ${format === k ? 'text-slate-100' : 'text-slate-400'}`}>
                                    <input
                                        type="radio"
                                        checked={format === k}
                                        onChange={() => setFormat(k)}
                                        className="accent-emerald-500"
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <hr className="border-none border-t border-white/10 m-0" />

                    {/* Options */}
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2.5 cursor-pointer text-slate-100 text-sm">
                            <input
                                type="checkbox"
                                checked={includeStats}
                                onChange={e => setIncludeStats(e.target.checked)}
                                className="accent-emerald-500 w-4 h-4"
                            />
                            Include Performance &amp; Hours Summary
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer text-slate-100 text-sm">
                            <input
                                type="checkbox"
                                checked={excludeCompleted}
                                onChange={e => setExcludeCompleted(e.target.checked)}
                                className="accent-emerald-500 w-4 h-4"
                            />
                            Exclude Completed Tasks
                        </label>
                    </div>
                </div>

                <button
                    onClick={handleDownload}
                    disabled={loading}
                    className={`mt-6 w-full py-3 bg-gradient-to-r from-emerald-400 to-teal-600 hover:from-emerald-500 hover:to-teal-700 text-white border-none rounded-xl font-bold text-sm cursor-pointer transition-all duration-150 shadow-[0_4px_14px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 ${loading ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
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
    const jobLabel = task.sales_order_id === null
        ? 'Standalone Task'
        : (task.customer_name || task.estimation_names || 'Standalone Job');

    return (
        <div
            draggable
            onDragStart={onDragStart}
            className={`bg-white/[0.035] border border-white/10 hover:border-white/20 rounded-xl p-3 cursor-grab mb-2 relative transition-all duration-150 group ${isDragging ? 'opacity-40' : 'opacity-100'}`}
        >
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
                    <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                        {jobCode}
                    </span>
                    <span className="text-[10px] text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
                        {jobLabel}
                    </span>
                </div>
            </div>

            <div className="text-xs text-slate-100 font-semibold mb-1.5 leading-normal">
                {cleanName}
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <FiClock size={11} /> {fmtTime(task.estimated_minutes)}
                    </span>
                    {task.machine_name && (
                        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {task.machine_name}
                        </span>
                    )}
                </div>

                {/* Status Toggle Buttons */}
                <div className="flex gap-1">
                    {(['pending', 'in_progress', 'done']).map(s => (
                        <button
                            key={s}
                            onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, s); }}
                            title={`Mark ${s.replace('_', ' ')}`}
                            className="w-3.5 h-3.5 rounded-full border-[1.5px] cursor-pointer p-0 transition-colors"
                            style={{
                                borderColor: STATUS_COLOR[s],
                                backgroundColor: task.status === s ? STATUS_COLOR[s] : 'transparent'
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
    const [prevValue, setPrevValue] = useState(value);
    const [searchVal, setSearchVal] = useState(value || '');

    if (value !== prevValue) {
        setPrevValue(value);
        setSearchVal(value || '');
    }

    const dropdownRef = useRef(null);

    const handleFocus = () => {
        setIsOpen(true);
    };

    const handleInputChange = (e) => {
        setSearchVal(e.target.value);
        setIsOpen(true);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearchVal(value || '');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [value]);

    const filtered = searchVal && searchVal !== value
        ? employees.filter(e =>
            e.name.toLowerCase().includes(searchVal.toLowerCase()) ||
            (e.job_title || '').toLowerCase().includes(searchVal.toLowerCase()) ||
            (e.department || '').toLowerCase().includes(searchVal.toLowerCase())
          )
        : employees;

    return (
        <div className="relative w-full max-w-[320px] z-50" ref={dropdownRef}>
            <div className="flex items-center relative">
                <input
                    type="text"
                    placeholder="Type to filter & select employee..."
                    value={searchVal}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    className="w-full bg-black/40 border-[1.5px] border-white/10 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all duration-150 focus:border-emerald-500/50"
                />
                {value && (
                    <button
                        onClick={() => {
                            setSearchVal('');
                            onChange('');
                        }}
                        className="absolute right-3 bg-none border-none text-slate-400 cursor-pointer flex items-center hover:text-white"
                    >
                        <FiX size={14} />
                    </button>
                )}
            </div>

            {isOpen && (
                <div
                    className="absolute top-full left-0 w-full mt-1.5 bg-[#0a0a14]/95 backdrop-blur-[20px] border border-white/10 rounded-xl max-h-[240px] overflow-y-auto z-[1000] shadow-2xl p-1"
                >
                    {filtered.length === 0 ? (
                        <div className="px-3.5 py-3 text-xs text-slate-500 text-center">
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
                                className={`px-3 py-2 rounded-lg cursor-pointer text-xs flex flex-col gap-0.5 transition-all duration-100 ${value === e.name
                                        ? 'text-black bg-emerald-500'
                                        : 'text-slate-100 bg-transparent hover:bg-emerald-500/20 hover:text-white'
                                    }`}
                            >
                                <span className="font-semibold">{e.name}</span>
                                <span className={`text-[10px] ${value === e.name ? 'text-black/70' : 'text-slate-400'}`}>
                                    {e.job_title || 'Operator'} · {e.department || 'Production'}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function DetailedTaskRow({ task, onUpdateStatus }) {
    const dot = STATUS_COLOR[task.status] || STATUS_COLOR.pending;
    const nameParts = task.name ? task.name.split('—') : [];
    const cleanName = nameParts.length >= 2 ? nameParts[nameParts.length - 2]?.trim() : (task.name || 'Task');
    const jobCode = task.order_code || 'GEN';
    const jobLabel = task.sales_order_id === null
        ? 'Standalone Task'
        : (task.customer_name || task.estimation_names || 'Standalone Job');

    const formatDuration = (mins) => {
        if (!mins) return '0m';
        const hrs = Math.floor(mins / 60);
        const rm = mins % 60;
        if (hrs > 0 && rm > 0) return `${hrs}h ${rm}m`;
        if (hrs > 0) return `${hrs}h`;
        return `${mins}m`;
    };

    return (
        <div className="bg-white/[0.025] border border-white/10 rounded-xl px-4 py-3.5 flex items-center justify-between gap-4 transition-all duration-150 hover:border-white/25 hover:bg-white/[0.04]">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Status Dot */}
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />

                {/* Job Info */}
                <div className="min-w-[100px] flex-shrink-0">
                    <span className="text-[11px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md">
                        {jobCode}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {jobLabel}
                    </div>
                </div>

                {/* Task Details */}
                <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-100 font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                        {cleanName}
                    </div>
                    {task.description && (
                        <div className="text-[11px] text-slate-500 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                            {task.description}
                        </div>
                    )}
                </div>

                {/* Machine Info */}
                {task.machine_name && (
                    <div className="flex-shrink-0">
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-semibold">
                            {task.machine_name}
                        </span>
                    </div>
                )}
            </div>

            {/* Time & Status controls */}
            <div className="flex items-center gap-5 flex-shrink-0">
                <span className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                    <FiClock size={13} /> {formatDuration(task.estimated_minutes)}
                </span>

                {/* Status Toggle Buttons */}
                <div className="flex gap-1.5">
                    {(['pending', 'in_progress', 'done']).map(s => {
                        const active = task.status === s;
                        let borderClass = '';
                        let bgClass = 'bg-transparent';
                        let textClass = '';

                        if (s === 'pending') {
                            borderClass = 'border-slate-500';
                            textClass = active ? 'text-black' : 'text-slate-400 hover:text-white';
                            bgClass = active ? 'bg-slate-500' : 'bg-transparent';
                        } else if (s === 'in_progress') {
                            borderClass = 'border-amber-500';
                            textClass = active ? 'text-black' : 'text-amber-500 hover:text-amber-400';
                            bgClass = active ? 'bg-amber-500' : 'bg-transparent';
                        } else {
                            borderClass = 'border-emerald-500';
                            textClass = active ? 'text-black' : 'text-emerald-400 hover:text-emerald-300';
                            bgClass = active ? 'bg-emerald-500' : 'bg-transparent';
                        }

                        return (
                            <button
                                key={s}
                                onClick={(e) => { e.stopPropagation(); onUpdateStatus(task.id, s); }}
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border-[1.5px] cursor-pointer transition-all duration-150 ${borderClass} ${bgClass} ${textClass}`}
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
            <div className="text-center py-20 text-slate-400 text-xs">
                <FiClock className="animate-spin inline-block mr-2" size={18} /> Loading employee planning module…
            </div>
        );
    }

    return (
        <div className="text-slate-100 font-sans">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-5">
                {[
                    ['Active Operators', filteredEmployees.length, 'text-emerald-400', <FiUser key="1" />],
                    ['Scheduled Tasks', totalScheduled, 'text-amber-500', <FiCalendar key="2" />],
                    ['Total Workload', `${totalHoursAll} hrs`, 'text-blue-400', <FiClock key="3" />],
                    ['Completed Tasks', totalDone, 'text-emerald-400', <FiCheckCircle key="4" />],
                    ['Unassigned Backlog', unassignedTasks.length, 'text-rose-500', <FiAlertCircle key="5" />]
                ].map(([label, val, accent, icon]) => (
                    <div
                        key={label}
                        className="bg-white/[0.03] backdrop-blur-[20px] border border-white/10 rounded-2xl p-4.5 flex items-center justify-between shadow-lg"
                    >
                        <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                {label}
                            </span>
                            <div className={`text-2xl font-extrabold font-mono mt-0.5 ${accent}`}>
                                {val}
                            </div>
                        </div>
                        <div className={`w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-lg ${accent}`}>
                            {icon}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-3 items-center justify-between mb-5 flex-wrap bg-white/[0.03] backdrop-blur-[20px] border border-white/10 rounded-2xl p-3">
                {/* View switcher */}
                <div className="flex bg-black p-1 rounded-xl border border-white/10">
                    {[
                        ['matrix', 'Weekly Matrix', <FiGrid key="m" />],
                        ['day', 'Daily View', <FiCalendar key="d" />],
                        ['board', 'Board View', <FiSidebar key="b" />],
                        ['overview', 'Capacity Overview', <FiTrendingUp key="o" />]
                    ].map(([mode, label, icon]) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border-none ${viewMode === mode ? 'bg-white/10 text-slate-100' : 'bg-transparent text-slate-400 hover:text-white'
                                }`}
                        >
                            {icon} {label}
                        </button>
                    ))}
                </div>

                {/* Day / Week Navigator */}
                {viewMode === 'day' ? (
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={prevDay}
                            className="bg-white/[0.03] border border-white/10 text-slate-400 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center hover:text-white hover:border-white/20"
                        >
                            <FiChevronLeft size={16} />
                        </button>
                        <button
                            onClick={setToday}
                            className="bg-white/[0.03] border border-white/10 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer hover:border-white/20"
                        >
                            Today
                        </button>
                        <input
                            type="date"
                            value={selectedDay}
                            onChange={e => setSelectedDay(e.target.value)}
                            className="bg-black border border-white/10 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none color-scheme-dark"
                            style={{ colorScheme: 'dark' }}
                        />
                        <button
                            onClick={nextDay}
                            className="bg-white/[0.03] border border-white/10 text-slate-400 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center hover:text-white hover:border-white/20"
                        >
                            <FiChevronRight size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={prevWeek}
                            className="bg-white/[0.03] border border-white/10 text-slate-400 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center hover:text-white hover:border-white/20"
                        >
                            <FiChevronLeft size={16} />
                        </button>
                        <button
                            onClick={setToday}
                            className="bg-white/[0.03] border border-white/10 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer hover:border-white/20"
                        >
                            Today
                        </button>
                        <span className="text-xs text-slate-100 font-semibold min-w-[160px] text-center">
                            {weekRangeStr}
                        </span>
                        <button
                            onClick={nextWeek}
                            className="bg-white/[0.03] border border-white/10 text-slate-400 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center hover:text-white hover:border-white/20"
                        >
                            <FiChevronRight size={16} />
                        </button>
                    </div>
                )}

                {/* Filters and Add Task */}
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-2 bg-black border border-white/10 rounded-xl px-3 py-1.5 w-[180px]">
                        <FiSearch size={14} className="text-slate-500" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search employee…"
                            className="bg-transparent border-none text-slate-100 text-xs outline-none w-full"
                        />
                    </div>

                    <select
                        value={filterDept}
                        onChange={e => setFilterDept(e.target.value)}
                        className="bg-black border border-white/10 text-slate-400 rounded-xl px-3 py-1.5 text-xs cursor-pointer outline-none hover:text-white hover:border-white/20"
                    >
                        {depts.map(d => (
                            <option key={d} value={d}>{d === 'all' ? 'All Depts' : d}</option>
                        ))}
                    </select>

                    <button
                        onClick={() => setShowBacklog(!showBacklog)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all duration-150 ${showBacklog
                                ? 'bg-blue-500/15 border-blue-500 text-blue-400'
                                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                            }`}
                    >
                        <FiSidebar size={14} /> Backlog ({unassignedTasks.length})
                    </button>

                    <button
                        onClick={() => {
                            setAddTaskDefaults({});
                            setShowAddTask(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-600 hover:from-emerald-500 hover:to-teal-700 text-white rounded-xl cursor-pointer text-xs font-bold border-none shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-all duration-150"
                    >
                        <FiPlus size={14} /> Add Task
                    </button>
                </div>
            </div>

            {/* ── 3. Main Planning Workspace (Backlog + Views) ───────────────── */}
            <div className="flex gap-4 items-start">

                {/* Left Drawer / Sidebar: Unassigned Tasks Backlog */}
                {showBacklog && (
                    <div className="w-[260px] flex-shrink-0 bg-white/[0.03] backdrop-blur-[20px] border border-white/10 rounded-2xl p-3.5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <FiList className="text-amber-400" size={16} />
                                <span className="text-xs font-bold text-slate-100">Unassigned Queue</span>
                            </div>
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                                {unassignedTasks.length}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mb-3">
                            Drag tasks onto any operator&apos;s day to schedule instantly.
                        </p>

                        <div className="max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                            {unassignedTasks.length === 0 ? (
                                <div className="text-center py-8 px-2.5 text-slate-500 border border-dashed border-white/10 rounded-xl">
                                    <FiCheckCircle size={24} className="mb-1.5 mx-auto" />
                                    <p className="text-xs">All tasks assigned!</p>
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
                <div className="flex-1 min-w-0">
                    {filteredEmployees.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 bg-white/[0.03] border border-dashed border-white/10 rounded-2xl">
                            <FiUser size={36} className="mb-3 opacity-30 mx-auto" />
                            <p className="text-sm">No employees found matching filter.</p>
                        </div>
                    ) : (
                        <>
                            {/* VIEW 1: WEEKLY MATRIX */}
                            {viewMode === 'matrix' && (
                                <div className="overflow-x-auto bg-white/[0.03] backdrop-blur-[20px] border border-white/10 rounded-2xl shadow-lg">
                                    <table className="border-collapse w-full min-w-[900px]">
                                        <thead>
                                            <tr>
                                                <th className="px-3.5 py-3 bg-white/[0.04] border-b border-white/10 text-slate-400 text-[11px] font-bold text-left w-[170px] sticky left-0 z-[2]">
                                                    Employee
                                                </th>
                                                <th className="px-2 py-3 bg-white/[0.04] border-b border-white/10 text-rose-400 text-[11px] font-bold text-center w-[120px]">
                                                    Unplanned
                                                </th>
                                                {weekDays.map(d => (
                                                    <th key={d.key} className="px-2 py-3 bg-white/[0.04] border-b border-white/10 text-slate-400 text-[11px] font-bold text-center min-w-[140px]">
                                                        <div className="text-slate-100">{d.label}</div>
                                                        <div className="text-[10px] text-slate-500 mt-0.5">{d.short}</div>
                                                    </th>
                                                ))}
                                                <th className="px-2 py-3 bg-white/[0.04] border-b border-white/10 text-slate-400 text-[11px] font-bold text-center w-[80px]">
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
                                                    <tr key={emp.id} className="border-b border-white/10">
                                                        {/* Employee Info Header */}
                                                        <td className="px-3.5 py-3 border-r border-white/10 bg-[#090914] align-top sticky left-0 z-[1]">
                                                            <div className="font-bold text-sm text-slate-100">{emp.name}</div>
                                                            <div className="text-[10px] text-slate-400 mt-0.5">{emp.job_title || emp.department || 'Operator'}</div>
                                                            <div className="text-[10px] text-emerald-400 font-semibold mt-1.5 flex items-center gap-1">
                                                                <FiClock size={10} /> {totalHours} hrs scheduled
                                                            </div>
                                                        </td>

                                                        {/* Unplanned Queue for Employee */}
                                                        <td
                                                            className="p-2 border-r border-white/10 align-top bg-rose-500/[0.02]"
                                                            onDragOver={e => e.preventDefault()}
                                                            onDrop={e => { e.preventDefault(); handleDrop(emp.name, null); }}
                                                        >
                                                            {unplanned.length === 0 ? (
                                                                <div className="text-[10px] text-slate-500 text-center py-3">—</div>
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
                                                                    className={`p-2 border-r border-white/10 align-top transition-all duration-150 min-h-[70px] ${isOver ? 'bg-emerald-500/10' : 'bg-transparent'
                                                                        }`}
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
                                                                        className="w-full py-1 text-[10px] text-slate-500 rounded-md border border-dashed border-white/10 bg-transparent cursor-pointer mt-1 transition-all duration-150 hover:text-emerald-300 hover:border-emerald-500/40"
                                                                    >
                                                                        + Add task
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}

                                                        {/* Export Daily / Weekly PDF */}
                                                        <td className="p-2 align-middle text-center">
                                                            <button
                                                                onClick={() => setExportEmployee(emp)}
                                                                title="Download Report"
                                                                className="bg-white/[0.03] border border-white/10 text-slate-400 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1 text-[11px] mx-auto hover:text-white hover:border-white/30"
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
                                    <div className="flex gap-3 items-center flex-wrap bg-white/[0.03] backdrop-blur-[20px] border border-white/10 rounded-2xl p-4 relative z-50">
                                        <label className="text-xs font-bold text-slate-400">
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
                                                <div className="text-center py-16 text-slate-400 bg-white/[0.03] border border-dashed border-white/10 rounded-2xl">
                                                    <FiUser size={36} className="mb-3 opacity-30 mx-auto" />
                                                    <p className="text-sm">Please select an employee to view their daily plan.</p>
                                                </div>
                                            );
                                        }

                                        const dayTasks = getTasksForEmployeeDay(emp.name, selectedDay);
                                        const totalMins = dayTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
                                        const totalHours = (totalMins / 60).toFixed(1);
                                        const isOver = dragOverDayCell === emp.id;

                                        return (
                                            <div className="flex flex-col gap-4">
                                                {/* Employee Banner */}
                                                <div className="bg-white/[0.03] backdrop-blur-[20px] border border-white/10 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4">
                                                    <div className="flex items-center gap-3.5">
                                                        <div className="w-[46px] h-[46px] rounded-xl bg-gradient-to-br from-emerald-400 to-blue-600 flex items-center justify-center text-white font-extrabold text-lg">
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-base font-bold text-slate-100 m-0">{emp.name}</h3>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                                {emp.job_title || 'Operator'} · <span className="text-emerald-400 font-semibold">{emp.department || 'Production'}</span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <span className="text-[11px] text-slate-400">Scheduled Workload</span>
                                                            <div className="text-lg font-extrabold text-emerald-400 mt-0.5">
                                                                {totalHours} hrs <span className="text-[11px] text-slate-500 font-normal">({dayTasks.length} tasks)</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setExportEmployee(emp)}
                                                            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/[0.03] border border-white/10 text-slate-100 rounded-xl cursor-pointer text-xs font-semibold hover:text-white hover:border-white/30"
                                                        >
                                                            <FiPrinter size={13} /> PDF Report
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Detailed Tasks Container Dropzone */}
                                                <div
                                                    className={`backdrop-blur-[20px] rounded-2xl p-5 min-h-[200px] transition-all duration-150 border-2 border-dashed ${isOver
                                                            ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
                                                            : 'bg-white/[0.02] border-white/10 shadow-2xl'
                                                        }`}
                                                    onDragOver={e => { e.preventDefault(); setDragOverDayCell(emp.id); }}
                                                    onDragLeave={() => setDragOverDayCell(null)}
                                                    onDrop={e => { e.preventDefault(); handleDrop(emp.name, selectedDay); }}
                                                >
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="text-sm font-bold text-slate-100 m-0">
                                                            Detailed Daily Schedule
                                                        </h4>
                                                        <button
                                                            onClick={() => {
                                                                setAddTaskDefaults({ assigned_to: emp.name, scheduled_date: selectedDay });
                                                                setShowAddTask(true);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-400 text-[11px] font-semibold cursor-pointer hover:text-white hover:border-white/20"
                                                        >
                                                            <FiPlus size={13} /> Add Task
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-col gap-2.5">
                                                        {dayTasks.length === 0 ? (
                                                            <div className="text-center py-16 px-5 text-slate-500 border border-dashed border-white/10 rounded-xl">
                                                                <FiCalendar size={32} className="mb-2.5 opacity-30 mx-auto" />
                                                                <p className="text-sm m-0">No tasks scheduled for {selectedDay}.</p>
                                                                <p className="text-[11px] text-slate-500 mt-1">
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {filteredEmployees.map(emp => {
                                        const empTasks = allTasks.filter(t => t.assigned_to === emp.name);
                                        const totalHrs = (empTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0) / 60).toFixed(1);

                                        return (
                                            <div
                                                key={emp.id}
                                                className="bg-white/[0.03] backdrop-blur-[20px] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between"
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => { e.preventDefault(); handleDrop(emp.name, null); }}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between mb-3.5">
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-100 m-0">{emp.name}</h4>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">{emp.job_title || emp.department || 'Operator'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                                                {totalHrs} hrs
                                                            </span>
                                                            <button
                                                                onClick={() => setExportEmployee(emp)}
                                                                className="block text-[10px] text-slate-400 cursor-pointer mt-1 border-none bg-transparent hover:text-white"
                                                            >
                                                                <FiPrinter size={11} className="inline mr-1" /> PDF Report
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-2 min-h-[120px]">
                                                        {empTasks.length === 0 ? (
                                                            <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-white/10 rounded-xl">
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
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setAddTaskDefaults({ assigned_to: emp.name });
                                                        setShowAddTask(true);
                                                    }}
                                                    className="mt-3 w-full py-2 bg-white/[0.04] border border-dashed border-white/10 rounded-xl text-slate-400 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:text-white hover:border-white/30"
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
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredEmployees.map(emp => {
                                        const empTasks = allTasks.filter(t => t.assigned_to === emp.name);
                                        const scheduledTasks = empTasks.filter(t => t.scheduled_date);
                                        const doneTasks = empTasks.filter(t => t.status === 'done');
                                        const totalMins = scheduledTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
                                        const totalHrs = (totalMins / 60);

                                        // Workload Status
                                        let statusLabel = 'Optimal';
                                        let statusColorClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
                                        let progressColorClass = 'bg-emerald-500';
                                        if (totalHrs > 40) {
                                            statusLabel = 'Overloaded';
                                            statusColorClass = 'text-rose-500 bg-rose-500/10 border-rose-500/30';
                                            progressColorClass = 'bg-rose-500';
                                        } else if (totalHrs < 10) {
                                            statusLabel = 'Light Workload';
                                            statusColorClass = 'text-blue-400 bg-blue-400/10 border-blue-400/30';
                                            progressColorClass = 'bg-blue-400';
                                        }

                                        const pct = empTasks.length > 0 ? Math.round((doneTasks.length / empTasks.length) * 100) : 0;

                                        return (
                                            <div
                                                key={emp.id}
                                                className="bg-white/[0.03] backdrop-blur-[20px] border border-white/10 rounded-2xl p-5 shadow-lg"
                                            >
                                                <div className="flex items-center justify-between mb-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-emerald-400 to-blue-600 flex items-center justify-center text-white font-extrabold text-base">
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-100 m-0">{emp.name}</h4>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">{emp.job_title || emp.department || 'Operator'}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${statusColorClass}`}>
                                                        {statusLabel}
                                                    </span>
                                                </div>

                                                {/* Capacity progress bar */}
                                                <div className="mb-4">
                                                    <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                                                        <span>Weekly Utilization ({totalHrs.toFixed(1)} / 40 hrs)</span>
                                                        <span className="text-slate-100 font-bold">{Math.min(100, Math.round((totalHrs / 40) * 100))}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-300 ${progressColorClass}`}
                                                            style={{ width: `${Math.min(100, (totalHrs / 40) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Quick Metrics */}
                                                <div className="grid grid-cols-3 gap-2 mb-4">
                                                    <div className="bg-black p-2 rounded-lg text-center">
                                                        <div className="text-sm font-bold text-slate-100">{empTasks.length}</div>
                                                        <div className="text-[9px] text-slate-500 uppercase font-semibold">Total Tasks</div>
                                                    </div>
                                                    <div className="bg-black p-2 rounded-lg text-center">
                                                        <div className="text-sm font-bold text-emerald-400">{doneTasks.length}</div>
                                                        <div className="text-[9px] text-slate-500 uppercase font-semibold">Completed</div>
                                                    </div>
                                                    <div className="bg-black p-2 rounded-lg text-center">
                                                        <div className="text-sm font-bold text-emerald-400">{pct}%</div>
                                                        <div className="text-[9px] text-slate-500 uppercase font-semibold">Done Rate</div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setExportEmployee(emp)}
                                                        className="flex-1 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-slate-100 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:text-white hover:border-white/30"
                                                    >
                                                        <FiPrinter size={13} /> Daily PDF Report
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setAddTaskDefaults({ assigned_to: emp.name });
                                                            setShowAddTask(true);
                                                        }}
                                                        className="flex-1 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:bg-emerald-500/20 hover:border-emerald-500/40"
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
