'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiCpu, FiCalendar, FiClock, FiCheck, FiRefreshCw, FiUser, FiLayers, FiAlertCircle, FiArrowRight } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function CommonMachinesPortalPage() {
    const [machines, setMachines] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMachineId, setSelectedMachineId] = useState('all');
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/common-portal/machines');
            if (res.ok) {
                const data = await res.json();
                setMachines(data.machines || []);
                setTasks(data.tasks || []);
                setEmployees(data.employees || []);
            } else {
                toast.error('Failed to load shared machine data');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error loading shared machines');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateTaskStatus = async (taskId, companyId, newStatus) => {
        try {
            const res = await fetch('/api/common-portal/machines', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId,
                    companyId,
                    fields: { status: newStatus }
                })
            });
            if (res.ok) {
                toast.success('Task status updated');
                fetchData();
            } else {
                toast.error('Failed to update task');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error updating task');
        }
    };

    const filteredTasks = tasks.filter(t => {
        const matchesMachine = selectedMachineId === 'all' || String(t.machine_id) === String(selectedMachineId);
        const matchesCompany = selectedCompanyFilter === 'all' || String(t.company_id) === String(selectedCompanyFilter);
        return matchesMachine && matchesCompany;
    });

    const columns = [
        { id: 'pending', label: 'Unassigned / Pending', color: 'border-amber-500/20 bg-amber-500/5' },
        { id: 'in_progress', label: 'In Production', color: 'border-blue-500/20 bg-blue-500/5' },
        { id: 'done', label: 'Completed', color: 'border-emerald-500/20 bg-emerald-500/5' }
    ];

    return (
        <div className="min-h-screen text-white space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                        <FiCpu className="text-purple-400 w-7 h-7" />
                        Common Machines & Finishing Portal
                    </h1>
                    <p className="text-gray-400 text-xs mt-1">
                        Unified cross-company planning workspace for Company 1 &amp; Company 2 shared resources
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    >
                        <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Portal
                    </button>
                </div>
            </div>

            {/* Shared Machine Cards Directory */}
            <div className="space-y-3">
                <h2 className="text-sm font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <FiCpu className="text-purple-400" /> Dedicated Shared Machine Portals ({machines.length})
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {machines.map(m => {
                        const mTasks = tasks.filter(t => String(t.machine_id) === String(m.id) || t.machine_name?.toLowerCase() === m.name?.toLowerCase());
                        const c1Count = mTasks.filter(t => t.company_id === 1).length;
                        const c2Count = mTasks.filter(t => t.company_id === 2).length;

                        return (
                            <div
                                key={m.id}
                                className="bg-black/40 backdrop-blur-xl border border-white/10 hover:border-purple-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all group shadow-xl"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h3 className="font-bold text-base text-white group-hover:text-purple-300 transition-colors">
                                                {m.name}
                                            </h3>
                                            <p className="text-xs text-gray-400 capitalize">{m.type?.replace('_', ' ')} machine</p>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                                            Shared
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs bg-white/5 p-2.5 rounded-xl border border-white/5">
                                        <div>
                                            <span className="text-[10px] text-gray-500 uppercase block font-semibold">Speed</span>
                                            <span className="font-mono text-purple-300 font-bold">{m.speed} {m.speed_unit || 'uph'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500 uppercase block font-semibold">Active Tasks</span>
                                            <span className="font-bold text-white">{mTasks.length} queued</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                                            Company 1: {c1Count}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                            Company 2: {c2Count}
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-4 mt-4 border-t border-white/10">
                                    <a
                                        href={`/machines/${m.id}/portal`}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl shadow-lg transition-all"
                                    >
                                        Open Shared Machine Portal <FiArrowRight className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Task Kanban Columns */}
            {loading ? (
                <div className="py-24 text-center text-gray-500 animate-pulse">Loading shared machine tasks...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {columns.map(col => {
                        const colTasks = filteredTasks.filter(t => {
                            if (col.id === 'pending') return t.status === 'pending' || !t.status;
                            if (col.id === 'in_progress') return t.status === 'in_progress';
                            if (col.id === 'done') return t.status === 'done';
                            return false;
                        });

                        return (
                            <div key={col.id} className={`border rounded-2xl p-4 ${col.color} backdrop-blur-md min-h-[500px]`}>
                                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                                    <h3 className="font-extrabold text-sm uppercase tracking-wider">{col.label}</h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/10 border border-white/10">
                                        {colTasks.length}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {colTasks.length === 0 ? (
                                        <div className="py-12 text-center text-gray-500 text-xs border border-dashed border-white/10 rounded-xl">
                                            No tasks in this stage
                                        </div>
                                    ) : (
                                        colTasks.map(task => (
                                            <div
                                                key={`${task.company_id}-${task.id}`}
                                                className="bg-black/60 border border-white/10 hover:border-purple-500/40 rounded-xl p-4 space-y-3 shadow-lg transition-all"
                                            >
                                                {/* Header Badges */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border tracking-wider uppercase ${
                                                        task.company_id === 1
                                                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                    }`}>
                                                        {task.company_name}
                                                    </span>

                                                    <span className="text-[10px] text-gray-400 font-mono">
                                                        SO: {task.order_code || `#${task.sales_order_id}`}
                                                    </span>
                                                </div>

                                                {/* Task Title & Details */}
                                                <div>
                                                    <div className="font-bold text-sm text-white">{task.name}</div>
                                                    {task.customer_name && (
                                                        <div className="text-xs text-gray-400 mt-0.5">{task.customer_name}</div>
                                                    )}
                                                    {task.description && (
                                                        <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">{task.description}</div>
                                                    )}
                                                </div>

                                                {/* Meta details */}
                                                <div className="grid grid-cols-3 gap-2 text-[10px] bg-white/5 p-2 rounded-lg border border-white/5 text-gray-300">
                                                    <div>
                                                        <span className="text-gray-500 block uppercase font-semibold">Run Qty</span>
                                                        <span className="font-bold font-mono text-amber-300">{(task.run_quantity || task.quantity || task.sheet_count || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 block uppercase">Est. Time</span>
                                                        <span className="font-bold font-mono text-purple-300">{task.estimated_minutes ? `${task.estimated_minutes}m` : '—'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 block uppercase">Machine</span>
                                                        <span className="font-bold truncate block">{task.machine_name || 'Shared'}</span>
                                                    </div>
                                                </div>

                                                {/* Status Action Button */}
                                                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                                                    <select
                                                        value={task.status || 'pending'}
                                                        onChange={e => handleUpdateTaskStatus(task.id, task.company_id, e.target.value)}
                                                        className="bg-secondary border border-white/10 rounded-lg text-xs px-2.5 py-1 text-white focus:outline-none cursor-pointer [color-scheme:dark]"
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="in_progress">In Production</option>
                                                        <option value="done">Completed</option>
                                                    </select>
                                                    {task.status !== 'done' && (
                                                        <button
                                                            onClick={() => handleUpdateTaskStatus(task.id, task.company_id, 'done')}
                                                            className="flex items-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                                                        >
                                                            <FiCheck size={12} /> Mark Done
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
