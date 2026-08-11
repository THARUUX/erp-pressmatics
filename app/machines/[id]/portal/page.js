'use client';

import { use, useState, useEffect, useCallback } from 'react';
import {
    FiPlay, FiPause, FiCheckCircle, FiClock, FiUser, FiLayers,
    FiRefreshCw, FiCheck, FiX, FiAlertCircle, FiSearch, FiFilter
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function toLocalDt(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
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

    // Completion Modal State
    const [completingTask, setCompletingTask] = useState(null);
    const [completedBy, setCompletedBy] = useState('');
    const [completedByHelper, setCompletedByHelper] = useState('');
    const [completedAt, setCompletedAt] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
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
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleUpdateTaskStatus = async (task, newStatus, extraFields = {}) => {
        try {
            const res = await fetch(`/api/common-portal/machines/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: task.id,
                    companyId: task.company_id,
                    fields: {
                        status: newStatus,
                        ...extraFields
                    }
                })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to update task');

            toast.success(`Task status changed to ${newStatus.replace('_', ' ')}`);

            // Optimistic local update
            setTasks(prev => prev.map(t => {
                if (t.id === task.id && t.company_id === task.company_id) {
                    return { ...t, status: newStatus, ...extraFields };
                }
                return t;
            }));
        } catch (e) {
            toast.error(e.message);
        }
    };

    const handleStart = (task) => {
        handleUpdateTaskStatus(task, 'in_progress', {
            started_at: new Date().toISOString()
        });
    };

    const handlePause = (task) => {
        handleUpdateTaskStatus(task, 'pending');
    };

    const openCompletionModal = (task) => {
        setCompletingTask(task);
        setCompletedBy(task.assigned_to || task.completed_by || '');
        setCompletedByHelper(task.completed_by_helper || '');
        setCompletedAt(toLocalDt(new Date().toISOString()));
    };

    const submitCompletion = async (e) => {
        e.preventDefault();
        if (!completingTask) return;
        setSaving(true);
        try {
            await handleUpdateTaskStatus(completingTask, 'done', {
                completed_by: completedBy || null,
                completed_by_helper: completedByHelper || null,
                completed_at: completedAt ? new Date(completedAt).toISOString() : new Date().toISOString()
            });
            setCompletingTask(null);
        } finally {
            setSaving(false);
        }
    };

    const filteredTasks = tasks.filter(t => {
        if (companyFilter !== 'all' && t.company_id !== parseInt(companyFilter)) return false;
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
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

    if (loading) {
        return (
            <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-400 text-xs">Loading machine tasks...</p>
            </div>
        );
    }

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
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-black/40 border border-white/10 rounded-2xl p-4">
                <div className="relative w-full md:w-72">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search task, order code, customer..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
                    {/* Company Filter */}
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 shrink-0">
                        {[
                            { id: 'all', label: 'All Companies' },
                            { id: '1', label: 'Company 1' },
                            { id: '2', label: 'Company 2' }
                        ].map(c => (
                            <button
                                key={c.id}
                                onClick={() => setCompanyFilter(c.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    companyFilter === c.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>

                    {/* Status Filter */}
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 shrink-0">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'pending', label: 'Pending' },
                            { id: 'in_progress', label: 'In Production' },
                            { id: 'done', label: 'Done' }
                        ].map(s => (
                            <button
                                key={s.id}
                                onClick={() => setStatusFilter(s.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    statusFilter === s.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={loadData}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-all shrink-0"
                        title="Refresh"
                    >
                        <FiRefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Task Cards List */}
            {filteredTasks.length === 0 ? (
                <div className="py-16 text-center bg-black/30 border border-white/10 rounded-2xl text-gray-500 text-sm">
                    No tasks match the selected search or filters.
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTasks.map(task => {
                        const isRunning = task.status === 'in_progress';
                        const isDone = task.status === 'done';
                        const isC1 = task.company_id === 1;

                        return (
                            <div
                                key={`${task.company_id}-${task.id}`}
                                className={`bg-black/40 border rounded-2xl p-5 transition-all space-y-4 ${
                                    isRunning
                                        ? 'border-purple-500/50 shadow-lg shadow-purple-500/10 bg-purple-950/10'
                                        : isDone
                                            ? 'border-emerald-500/30 opacity-80'
                                            : 'border-white/10 hover:border-white/20'
                                }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Company Badge */}
                                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                                                isC1 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                            }`}>
                                                {task.company_name}
                                            </span>

                                            {/* Order Code */}
                                            <span className="text-xs font-mono font-bold text-gray-300 bg-white/5 px-2 py-0.5 rounded">
                                                {task.order_code}
                                            </span>

                                            {/* Status Badge */}
                                            {isRunning && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase animate-pulse">
                                                    ● In Production
                                                </span>
                                            )}
                                            {isDone && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                                                    ✓ Completed
                                                </span>
                                            )}
                                            {!isRunning && !isDone && (
                                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/20 uppercase">
                                                    Pending / Paused
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-base font-bold text-white">
                                            {task.name}
                                        </h3>
                                        {task.customer_name && (
                                            <p className="text-xs text-gray-400">Customer: <span className="text-gray-200 font-medium">{task.customer_name}</span></p>
                                        )}
                                    </div>

                                    {/* Action Buttons: START, PAUSE, DONE */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {!isRunning && !isDone && (
                                            <button
                                                onClick={() => handleStart(task)}
                                                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
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
                                                <FiCheckCircle className="w-3.5 h-3.5" /> Mark Done
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
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-white/5 text-xs text-gray-400">
                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase font-semibold">Run Quantity</span>
                                        <span className="font-bold font-mono text-amber-300">
                                            {(task.run_quantity || task.quantity || task.sheet_count || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase">Assigned Operator</span>
                                        <span className="font-semibold text-gray-200">{task.assigned_to || 'Unassigned'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase">Est. Duration</span>
                                        <span className="font-semibold text-purple-300 font-mono">{task.estimated_minutes ? `${task.estimated_minutes} min` : '—'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase">Planned Date</span>
                                        <span className="font-semibold text-gray-200">
                                            {task.planned_date ? new Date(task.planned_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Unplanned'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase">Completed By</span>
                                        <span className="font-semibold text-emerald-400">
                                            {task.completed_by ? `${task.completed_by} ${task.completed_by_helper ? `(Helper: ${task.completed_by_helper})` : ''}` : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Mark Done Dialog Modal */}
            {completingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="font-extrabold text-base text-white">Complete Task</h3>
                            <button onClick={() => setCompletingTask(null)} className="text-gray-400 hover:text-white">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={submitCompletion} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Completed By (Operator)</label>
                                <input
                                    type="text"
                                    placeholder="Operator Name"
                                    value={completedBy}
                                    onChange={e => setCompletedBy(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Completed By (Helper)</label>
                                <input
                                    type="text"
                                    placeholder="Helper Name (Optional)"
                                    value={completedByHelper}
                                    onChange={e => setCompletedByHelper(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date &amp; Time</label>
                                <input
                                    type="datetime-local"
                                    value={completedAt}
                                    onChange={e => setCompletedAt(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 [color-scheme:dark]"
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
