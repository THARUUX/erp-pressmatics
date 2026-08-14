'use client';

import { use, useState, useEffect, useCallback } from 'react';
import {
    FiPlay, FiPause, FiCheckCircle, FiClock, FiUser, FiLayers,
    FiRefreshCw, FiCheck, FiX, FiAlertCircle, FiSearch, FiFilter,
    FiPrinter, FiMonitor, FiTool, FiCalendar, FiChevronDown, FiChevronUp,
    FiAlertTriangle
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function toLocalDt(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function getTaskDateStr(task) {
    const raw = task.scheduled_date || task.planned_date;
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatPlannedDate(task) {
    const raw = task.scheduled_date || task.planned_date;
    if (!raw) return 'Unplanned';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return 'Unplanned';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function EstimationBadge({ type }) {
    const t = (type || 'offset').toLowerCase();
    if (t === 'digital') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-purple-300 uppercase tracking-wider">
                <FiMonitor className="w-3 h-3 text-purple-400" /> Digital
            </span>
        );
    }
    if (t === 'services') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                <FiTool className="w-3 h-3 text-amber-400" /> Service
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">
            <FiPrinter className="w-3 h-3 text-emerald-400" /> Offset
        </span>
    );
}

function ElapsedTimer({ task }) {
    const [totalSeconds, setTotalSeconds] = useState(0);
    const isRunning = task.status === 'in_progress';

    useEffect(() => {
        const closedSecs = parseInt(task.closed_seconds || 0, 10);
        const startTimeStr = task.active_started_at || task.started_at;
        const startTime = startTimeStr ? new Date(startTimeStr).getTime() : Date.now();

        if (!isRunning) {
            setTotalSeconds(closedSecs);
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const currentSessionSecs = Math.max(0, Math.floor((now - startTime) / 1000));
            setTotalSeconds(closedSecs + currentSessionSecs);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [task.closed_seconds, task.active_started_at, task.started_at, task.status, isRunning]);

    const formatTime = (secs) => {
        const hrs = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        const p = n => String(n).padStart(2, '0');
        if (hrs > 0) {
            return `${hrs}h ${p(mins)}m ${p(s)}s`;
        }
        return `${p(mins)}m ${p(s)}s`;
    };

    if (totalSeconds <= 0 && !isRunning) return null;

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-mono font-bold ${
            isRunning
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse'
                : 'bg-white/5 text-gray-400 border border-white/10'
        }`}>
            <FiClock className={`w-3.5 h-3.5 ${isRunning ? 'text-purple-400' : 'text-gray-400'}`} />
            <span>{formatTime(totalSeconds)}</span>
        </span>
    );
}

export default function MachineTaskExecutionPage({ params }) {
    const { id } = use(params);
    const [machine, setMachine] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [companyFilter, setCompanyFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [estimationFilter, setEstimationFilter] = useState('all');

    // Date Filtering State
    const [dateFilterMode, setDateFilterMode] = useState('today'); // 'all', 'today', 'specific', 'unscheduled'
    const [selectedDate, setSelectedDate] = useState('');

    // Collapsible Completed Tasks State (Hidden by default)
    const [showCompletedTasks, setShowCompletedTasks] = useState(false);

    // Completion Modal State
    const [completingTask, setCompletingTask] = useState(null);
    const [completedBy, setCompletedBy] = useState('');
    const [completedByHelper, setCompletedByHelper] = useState('');
    const [completedAt, setCompletedAt] = useState('');
    const [actualSheets, setActualSheets] = useState('');
    const [actualWastage, setActualWastage] = useState('0');
    const [downtimeMinutes, setDowntimeMinutes] = useState('0');
    const [downtimeReason, setDowntimeReason] = useState('');
    const [saving, setSaving] = useState(false);

    const todayStr = (() => {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    })();

    const loadData = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const res = await fetch(`/api/common-portal/machines/${id}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setMachine(data.machine);
            setTasks(data.tasks || []);
            setEmployees(data.employees || []);
        } catch (e) {
            toast.error(e.message || 'Failed to load tasks');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData(true);
    }, [loadData]);

    const handleStart = async (task) => {
        const activeEmp = task.assigned_to || task.completed_by || (employees.length > 0 ? employees[0].name : 'Operator');
        const nowIso = new Date().toISOString();

        // Optimistically update state immediately without page reload
        setTasks(prev => prev.map(t => {
            if (t.id === task.id && t.company_id === task.company_id) {
                return {
                    ...t,
                    status: 'in_progress',
                    assigned_to: activeEmp,
                    active_started_at: nowIso,
                    started_at: t.started_at || nowIso
                };
            }
            return t;
        }));

        try {
            const res = await fetch(`/api/common-portal/machines/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: task.id,
                    companyId: task.company_id,
                    action: 'start',
                    employee_name: activeEmp
                })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to start task');
            toast.success(`Task started for ${activeEmp}`);
            loadData(false);
        } catch (e) {
            toast.error(e.message);
            loadData(false);
        }
    };

    const handlePause = async (task) => {
        // Optimistically update state immediately without page reload
        setTasks(prev => prev.map(t => {
            if (t.id === task.id && t.company_id === task.company_id) {
                const currentSession = t.active_started_at ? Math.max(0, Math.floor((Date.now() - new Date(t.active_started_at).getTime()) / 1000)) : 0;
                return {
                    ...t,
                    status: 'pending',
                    closed_seconds: (t.closed_seconds || 0) + currentSession,
                    active_started_at: null
                };
            }
            return t;
        }));

        try {
            const res = await fetch(`/api/common-portal/machines/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: task.id,
                    companyId: task.company_id,
                    action: 'pause'
                })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to pause task');
            toast.success('Task paused and time logged');
            loadData(false);
        } catch (e) {
            toast.error(e.message);
            loadData(false);
        }
    };

    const openCompletionModal = (task) => {
        setCompletingTask(task);
        setCompletedBy(task.assigned_to || task.completed_by || '');
        setCompletedByHelper(task.completed_by_helper || '');
        setCompletedAt(toLocalDt(new Date().toISOString()));
        const targetOutput = task.run_quantity || task.quantity || task.sheet_count || '';
        setActualSheets(task.actual_sheets_printed != null ? String(task.actual_sheets_printed) : String(targetOutput));
        setActualWastage(task.actual_sheets_wasted != null ? String(task.actual_sheets_wasted) : '0');
        setDowntimeMinutes(task.downtime_minutes != null ? String(task.downtime_minutes) : '0');
        setDowntimeReason(task.downtime_reason || '');
    };

    const submitCompletion = async (e) => {
        e.preventDefault();
        if (!completingTask) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/common-portal/machines/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: completingTask.id,
                    companyId: completingTask.company_id,
                    action: 'complete',
                    actual_sheets_printed: actualSheets !== '' ? parseFloat(actualSheets) : null,
                    actual_sheets_wasted: actualWastage !== '' ? parseFloat(actualWastage) : 0,
                    downtime_minutes: parseInt(downtimeMinutes) || 0,
                    downtime_reason: downtimeReason.trim() || null,
                    completed_by: completedBy || null,
                    completed_by_helper: completedByHelper || null,
                    completed_at: completedAt ? new Date(completedAt).toISOString() : new Date().toISOString()
                })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to complete task');
            toast.success('Task marked as completed!');
            setCompletingTask(null);
            loadData(false);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const filteredTasks = tasks.filter(t => {
        if (companyFilter !== 'all' && t.company_id !== parseInt(companyFilter)) return false;
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (estimationFilter !== 'all' && (t.job_type || 'offset').toLowerCase() !== estimationFilter.toLowerCase()) return false;

        // Date Filtering
        const taskDate = getTaskDateStr(t);
        if (dateFilterMode === 'today') {
            if (taskDate !== todayStr) return false;
        } else if (dateFilterMode === 'specific' && selectedDate) {
            if (taskDate !== selectedDate) return false;
        } else if (dateFilterMode === 'unscheduled') {
            if (taskDate !== null) return false;
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            return t.name?.toLowerCase().includes(q) ||
                t.order_code?.toLowerCase().includes(q) ||
                t.customer_name?.toLowerCase().includes(q);
        }
        return true;
    });

    const activeTasks = tasks.filter(t => t.status === 'in_progress');
    const pendingTasks = tasks.filter(t => t.status === 'pending' || !t.status);
    const doneTasks = tasks.filter(t => t.status === 'done');

    const activeAndPendingList = filteredTasks.filter(t => t.status !== 'done');
    const completedTasksList = filteredTasks.filter(t => t.status === 'done');

    if (loading) {
        return (
            <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-400 text-xs">Loading machine tasks...</p>
            </div>
        );
    }

    const renderTaskCard = (task) => {
        const isRunning = task.status === 'in_progress';
        const isDone = task.status === 'done';

        const displayName = task.name?.includes('—')
            ? task.name.split('—').slice(2).join('—').trim() || task.name
            : task.name;

        return (
            <div
                key={`${task.company_id}-${task.id}`}
                className={`bg-black/40 border rounded-2xl p-5 transition-all space-y-4 ${isRunning
                    ? 'border-purple-500/50 shadow-lg shadow-purple-500/10 bg-purple-950/10'
                    : isDone
                        ? 'border-emerald-500/30 opacity-80'
                        : 'border-white/10 hover:border-white/20'
                    }`}
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Order Code */}
                            <span className="text-xs font-mono font-bold text-gray-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                                {task.order_code}
                            </span>

                            {/* Estimation Source Badge (Digital / Offset / Services) */}
                            <EstimationBadge type={task.job_type} />

                            {/* Status Badge */}
                            {isDone && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                                    ✓ Completed
                                </span>
                            )}
                        </div>

                        <h3 className="text-base font-bold text-white pt-0.5">
                            {displayName}
                        </h3>
                        {task.customer_name && (
                            <p className="text-xs text-gray-400">Customer: <span className="text-gray-200 font-medium">{task.customer_name}</span></p>
                        )}
                    </div>

                    {/* Action Buttons & Live Timer */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Always show ElapsedTimer if running or if past time was logged */}
                        <ElapsedTimer task={task} />

                        {!isRunning && !isDone && (
                            <button
                                onClick={() => handleStart(task)}
                                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                            >
                                <FiPlay className="w-3.5 h-3.5 fill-current" /> Start Task
                            </button>
                        )}

                        {isRunning && (
                            <button
                                onClick={() => handlePause(task)}
                                className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                            >
                                <FiPause className="w-3.5 h-3.5 fill-current" /> Pause Task
                            </button>
                        )}

                        {!isDone && (
                            <button
                                onClick={() => openCompletionModal(task)}
                                className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-300 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                            >
                                <FiCheckCircle className="w-3.5 h-3.5" /> Done
                            </button>
                        )}

                        {isDone && (
                            <button
                                onClick={() => handleStart(task)}
                                className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Re-open Task
                            </button>
                        )}
                    </div>
                </div>

                {/* Task Details */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-3 border-t border-white/5 text-xs text-gray-400">
                    <div>
                        <span className="block text-[10px] text-gray-500 uppercase font-semibold">Run Quantity</span>
                        <span className="font-bold font-mono text-amber-300">
                            {(task.run_quantity || task.quantity || task.sheet_count || 0).toLocaleString()}
                        </span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-gray-500 uppercase">Actual Output</span>
                        <span className="font-bold font-mono text-emerald-300">
                            {task.actual_sheets_printed != null ? parseFloat(task.actual_sheets_printed).toLocaleString() : '—'}
                            {task.actual_sheets_wasted > 0 && (
                                <span className="text-red-400 font-normal text-[10px] ml-1">
                                    ({task.actual_sheets_wasted} waste)
                                </span>
                            )}
                        </span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-gray-500 uppercase">Downtime</span>
                        <span className="font-semibold text-amber-300 font-mono">
                            {task.downtime_minutes > 0 ? `${task.downtime_minutes} min` : 'None'}
                        </span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-gray-500 uppercase">Assigned Operator</span>
                        <span className="font-semibold text-gray-200">{task.assigned_to || 'Unassigned'}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-gray-500 uppercase">Planned Date</span>
                        <span className="font-semibold text-emerald-300 font-mono">
                            {formatPlannedDate(task)}
                        </span>
                    </div>
                    <div>
                        <span className="block text-[10px] text-gray-500 uppercase">Completed By</span>
                        <span className="font-semibold text-emerald-400">
                            {task.completed_by ? `${task.completed_by} ${task.completed_by_helper ? `(Helper: ${task.completed_by_helper})` : ''}` : '—'}
                        </span>
                    </div>
                </div>

                {/* Downtime Reason Banner if present */}
                {task.downtime_reason && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-xs text-amber-200 flex items-start gap-2">
                        <FiAlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold uppercase text-[10px] text-amber-400 block">Downtime Reason:</span>
                            <span className="text-amber-100">{task.downtime_reason}</span>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
                    <p className="text-gray-400 text-[11px] font-bold uppercase">Total Tasks</p>
                    <p className="text-2xl font-black text-white mt-0.5">{tasks.length}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                    <p className="text-amber-400 text-[11px] font-bold uppercase">Pending / Paused</p>
                    <p className="text-2xl font-black text-amber-300 mt-0.5">{pendingTasks.length}</p>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
                    <p className="text-purple-400 text-[11px] font-bold uppercase">In Production</p>
                    <p className="text-2xl font-black text-purple-300 mt-0.5">{activeTasks.length}</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                    <p className="text-emerald-400 text-[11px] font-bold uppercase font-sans">Completed</p>
                    <p className="text-2xl font-black text-emerald-300 mt-0.5">{doneTasks.length}</p>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col gap-4 bg-black/40 border border-white/10 rounded-2xl p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="relative w-full md:w-72">
                        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search task, order code, customer..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
                        {/* Estimation Filter */}
                        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 shrink-0">
                            {[
                                { id: 'all', label: 'All Estimations' },
                                { id: 'offset', label: 'Offset' },
                                { id: 'digital', label: 'Digital' },
                                { id: 'services', label: 'Services' }
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setEstimationFilter(cat.id)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${estimationFilter === cat.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                        {/* Status Filter */}
                        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 shrink-0">
                            {[
                                { id: 'all', label: 'All Status' },
                                { id: 'pending', label: 'Pending' },
                                { id: 'in_progress', label: 'In Production' },
                                { id: 'done', label: 'Done' }
                            ].map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setStatusFilter(s.id)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${statusFilter === s.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => loadData(true)}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all shrink-0"
                            title="Refresh"
                        >
                            <FiRefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Planned Date Filter Row */}
                <div className="flex items-center gap-3 pt-2 border-t border-white/5 flex-wrap">
                    <span className="text-xs font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <FiCalendar className="text-emerald-400" /> Planned Date:
                    </span>
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 flex-wrap">
                        <button
                            onClick={() => setDateFilterMode('all')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateFilterMode === 'all' ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:text-white'}`}
                        >
                            All Dates
                        </button>
                        <button
                            onClick={() => setDateFilterMode('today')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateFilterMode === 'today' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setDateFilterMode('unscheduled')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateFilterMode === 'unscheduled' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-gray-400 hover:text-white'}`}
                        >
                            Unplanned
                        </button>
                        <button
                            onClick={() => setDateFilterMode('specific')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateFilterMode === 'specific' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-400 hover:text-white'}`}
                        >
                            Select Date
                        </button>
                    </div>

                    {dateFilterMode === 'specific' && (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1 text-xs text-white focus:outline-none focus:border-purple-500 [color-scheme:dark]"
                        />
                    )}
                </div>
            </div>

            {/* Task Cards List */}
            {filteredTasks.length === 0 ? (
                <div className="py-16 text-center bg-black/30 border border-white/10 rounded-2xl text-gray-500 text-sm">
                    No tasks match the selected search or filters.
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Active & Pending Tasks */}
                    {activeAndPendingList.length > 0 ? (
                        <div className="space-y-4">
                            {activeAndPendingList.map(renderTaskCard)}
                        </div>
                    ) : (
                        completedTasksList.length > 0 && (
                            <div className="py-8 text-center bg-black/20 border border-white/5 rounded-2xl text-gray-400 text-xs">
                                All active tasks for this selection are completed!
                            </div>
                        )
                    )}

                    {/* Collapsible Completed Tasks Section */}
                    {completedTasksList.length > 0 && (
                        <div className="pt-2 space-y-4">
                            <button
                                onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                                className="w-full flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 rounded-2xl text-emerald-300 font-bold text-xs transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    <FiCheckCircle className="w-4 h-4 text-emerald-400" />
                                    <span>Completed Tasks ({completedTasksList.length})</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-400">
                                    <span>{showCompletedTasks ? 'Hide' : 'Show'}</span>
                                    {showCompletedTasks ? <FiChevronUp className="w-4 h-4 text-emerald-400" /> : <FiChevronDown className="w-4 h-4 text-emerald-400" />}
                                </div>
                            </button>

                            {showCompletedTasks && (
                                <div className="space-y-4 animate-fadeIn">
                                    {completedTasksList.map(renderTaskCard)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Mark Done Dialog Modal */}
            {completingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                                <h3 className="font-extrabold text-base text-white">Complete Task</h3>
                                <p className="text-[11px] text-gray-400 mt-0.5">{completingTask.name}</p>
                            </div>
                            <button onClick={() => setCompletingTask(null)} className="text-gray-400 hover:text-white">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={submitCompletion} className="space-y-4">
                            {/* Output & Wastage Fields */}
                            <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                                        Actual Output Quantity
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="Units / Sheets"
                                        value={actualSheets}
                                        onChange={e => setActualSheets(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                                    />
                                    <span className="text-[9px] text-gray-400 block mt-0.5">
                                        Target: {(completingTask.run_quantity || completingTask.quantity || completingTask.sheet_count || 0).toLocaleString()}
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                                        Wasted / Scrap
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="Wasted Quantity"
                                        value={actualWastage}
                                        onChange={e => setActualWastage(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-red-300 font-mono font-bold focus:outline-none focus:border-red-500"
                                    />
                                    <span className="text-[9px] text-gray-400 block mt-0.5">Default: 0</span>
                                </div>
                            </div>

                            {/* Downtime & Reason Fields */}
                            <div className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/10">
                                <div>
                                    <label className="block text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <FiClock className="w-3 h-3 text-amber-400" /> Downtime (Minutes)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={downtimeMinutes}
                                        onChange={e => setDowntimeMinutes(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-amber-200 font-mono font-bold focus:outline-none focus:border-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                                        Downtime Reason / Remarks
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="Describe downtime cause (e.g. machine maintenance, paper jam, plate replacement)..."
                                        value={downtimeReason}
                                        onChange={e => setDowntimeReason(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Completed By (Operator)</label>
                                <input
                                    type="text"
                                    placeholder="Operator Name"
                                    value={completedBy}
                                    onChange={e => setCompletedBy(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Completed By (Helper)</label>
                                <input
                                    type="text"
                                    placeholder="Helper Name (Optional)"
                                    value={completedByHelper}
                                    onChange={e => setCompletedByHelper(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date &amp; Time</label>
                                <input
                                    type="datetime-local"
                                    value={completedAt}
                                    onChange={e => setCompletedAt(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setCompletingTask(null)}
                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30"
                                >
                                    {saving ? 'Saving...' : 'Confirm Completion'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
