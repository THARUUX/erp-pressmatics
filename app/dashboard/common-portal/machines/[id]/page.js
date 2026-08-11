'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    FiArrowLeft, FiPrinter, FiClock, FiCheckCircle, FiPlayCircle,
    FiAlertCircle, FiRefreshCw, FiCalendar, FiUser, FiLayers, FiCpu,
    FiCheck, FiFilter
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
    pending: { label: 'Pending / Queued', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400' },
    in_progress: { label: 'In Production', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-400' },
    done: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' }
};

export default function SingleSharedMachinePortal({ params }) {
    const { id } = use(params);
    const [machine, setMachine] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [companyFilter, setCompanyFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [savingTaskId, setSavingTaskId] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/common-portal/machines/${id}`);
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to load machine portal');
            setMachine(data.machine);
            setTasks(data.tasks || []);
            setEmployees(data.employees || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const updateTask = async (task, fields) => {
        setSavingTaskId(task.id);
        try {
            const res = await fetch(`/api/common-portal/machines/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: task.id,
                    companyId: task.company_id,
                    fields
                })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Failed to update task');
            toast.success('Task updated successfully');
            
            // Optimistic update
            setTasks(prev => prev.map(t => {
                if (t.id === task.id && t.company_id === task.company_id) {
                    return { ...t, ...fields };
                }
                return t;
            }));
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSavingTaskId(null);
        }
    };

    const filteredTasks = tasks.filter(t => {
        if (companyFilter !== 'all' && t.company_id !== parseInt(companyFilter)) return false;
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        return true;
    });

    const c1Tasks = tasks.filter(t => t.company_id === 1);
    const c2Tasks = tasks.filter(t => t.company_id === 2);
    const doneTasks = tasks.filter(t => t.status === 'done');
    const completionPct = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

    if (loading) {
        return (
            <div className="min-h-screen bg-[#07080f] text-white flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-gray-400 text-sm">Loading Shared Machine Portal…</p>
                </div>
            </div>
        );
    }

    if (error || !machine) {
        return (
            <div className="min-h-screen bg-[#07080f] text-white p-8">
                <Link href="/dashboard/common-portal/machines" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6">
                    <FiArrowLeft /> Back to Shared Machines
                </Link>
                <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-center max-w-md mx-auto">
                    <FiAlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>{error || 'Machine not found'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#07080f] text-white p-6 space-y-6">
            {/* Header Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Link
                        href="/dashboard/common-portal/machines"
                        className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                    >
                        <FiArrowLeft className="w-4 h-4" /> Shared Machines Directory
                    </Link>
                    <div className="flex items-center gap-3 pt-1">
                        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                            <FiCpu className="text-purple-400" /> {machine.name}
                        </h1>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-widest">
                            Shared Machine Portal
                        </span>
                    </div>
                </div>

                <button
                    onClick={loadData}
                    className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold transition-all"
                >
                    <FiRefreshCw className="w-3.5 h-3.5" /> Refresh Data
                </button>
            </div>

            {/* Overview Stats Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-1">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Machine Type / Speed</p>
                    <p className="text-xl font-black capitalize text-white">{machine.type?.replace('_', ' ')}</p>
                    <p className="text-xs text-purple-300 font-semibold">{machine.speed} {machine.speed_unit || 'units/hr'}</p>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-1">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Company 1 Tasks</p>
                    <p className="text-2xl font-black text-blue-400">{c1Tasks.length}</p>
                    <p className="text-xs text-gray-500">Active jobs queued from Company 1</p>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-1">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Company 2 Tasks</p>
                    <p className="text-2xl font-black text-amber-400">{c2Tasks.length}</p>
                    <p className="text-xs text-gray-500">Active jobs queued from Company 2</p>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-1">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Completion Progress</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-emerald-400">{completionPct}%</span>
                        <span className="text-xs text-gray-400">({doneTasks.length}/{tasks.length})</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${completionPct}%` }} />
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <FiFilter className="text-gray-400 w-4 h-4" />
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Filter By:</span>
                    
                    {/* Company Filter */}
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
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
                </div>

                {/* Status Filter */}
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 w-full sm:w-auto">
                    {[
                        { id: 'all', label: 'All Statuses' },
                        { id: 'pending', label: 'Pending' },
                        { id: 'in_progress', label: 'In Progress' },
                        { id: 'done', label: 'Done' }
                    ].map(s => (
                        <button
                            key={s.id}
                            onClick={() => setStatusFilter(s.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                                statusFilter === s.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Task Kanban / List Section */}
            {filteredTasks.length === 0 ? (
                <div className="py-16 text-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl space-y-3">
                    <FiLayers className="w-10 h-10 text-gray-600 mx-auto" />
                    <p className="text-gray-400 text-sm font-medium">No tasks found for this machine matching the selected filters.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredTasks.map(task => {
                        const st = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                        const isC1 = task.company_id === 1;
                        const isSaving = savingTaskId === task.id;

                        return (
                            <div
                                key={`${task.company_id}-${task.id}`}
                                className="bg-black/40 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-5 transition-all space-y-4"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Company Badge */}
                                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                                                isC1 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                            }`}>
                                                {task.company_name}
                                            </span>

                                            {/* Order Code */}
                                            <span className="text-xs font-bold font-mono text-gray-300 bg-white/5 px-2 py-0.5 rounded">
                                                {task.order_code}
                                            </span>

                                            {/* Status Badge */}
                                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${st.bg} ${st.color} ${st.border}`}>
                                                {st.label}
                                            </span>
                                        </div>

                                        <h3 className="text-base font-bold text-white tracking-tight">
                                            {task.name}
                                        </h3>
                                        {task.customer_name && (
                                            <p className="text-xs text-gray-400">Customer: <span className="text-gray-200 font-medium">{task.customer_name}</span></p>
                                        )}
                                    </div>

                                    {/* Actions: Start, Pause, Done & Dropdown */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {task.status !== 'in_progress' && task.status !== 'done' && (
                                            <button
                                                onClick={() => updateTask(task, { status: 'in_progress', started_at: new Date().toISOString() })}
                                                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all"
                                            >
                                                ▶ Start
                                            </button>
                                        )}
                                        {task.status === 'in_progress' && (
                                            <button
                                                onClick={() => updateTask(task, { status: 'pending' })}
                                                className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all"
                                            >
                                                ⏸ Pause
                                            </button>
                                        )}
                                        {task.status !== 'done' && (
                                            <button
                                                onClick={() => updateTask(task, { status: 'done', completed_at: new Date().toISOString() })}
                                                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all"
                                            >
                                                ✓ Done
                                            </button>
                                        )}

                                        {/* Assigned Operator Dropdown */}
                                        <select
                                            value={task.assigned_to || ''}
                                            disabled={isSaving}
                                            onChange={(e) => updateTask(task, { assigned_to: e.target.value || null })}
                                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-300 focus:outline-none focus:border-purple-500"
                                        >
                                            <option value="" className="bg-gray-900 text-gray-400">Unassigned</option>
                                            {employees.map(emp => (
                                                <option key={emp.name} value={emp.name} className="bg-gray-900 text-white">
                                                    {emp.name} ({emp.company_id === 1 ? 'C1' : 'C2'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Details Row with Run Qty */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-white/5 text-xs text-gray-400">
                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Run Quantity</span>
                                        <span className="font-bold font-mono text-amber-300">
                                            {(task.run_quantity || task.quantity || task.sheet_count || 0).toLocaleString()}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Delivery Date</span>
                                        <span className="font-semibold text-gray-200">
                                            {task.delivery_date ? new Date(task.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Planned Date</span>
                                        <input
                                            type="date"
                                            value={task.planned_date ? new Date(task.planned_date).toISOString().split('T')[0] : ''}
                                            onChange={(e) => updateTask(task, { planned_date: e.target.value || null })}
                                            className="bg-transparent text-xs font-semibold text-purple-300 border-b border-white/10 hover:border-purple-400 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Est. Duration</span>
                                        <span className="font-semibold text-gray-200">
                                            {task.estimated_minutes ? `${task.estimated_minutes} min` : '—'}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="block text-[10px] text-gray-500 uppercase tracking-wider">Completed By</span>
                                        <span className="font-semibold text-emerald-400">
                                            {task.completed_by || '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
