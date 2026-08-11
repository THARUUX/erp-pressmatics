'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiCpu, FiCalendar, FiClock, FiCheck, FiRefreshCw, FiUser, FiLayers, FiAlertCircle, FiArrowRight, FiMove } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function CommonMachinesPortalPage() {
    const [machines, setMachines] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMachineId, setSelectedMachineId] = useState('all');
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');

    // Main Planning Kanban Drag State
    const [draggedTask, setDraggedTask] = useState(null);
    const [dragOverColumnId, setDragOverColumnId] = useState(null);

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

    const handleDropOnColumn = async (columnId) => {
        if (!draggedTask) return;
        const taskToMove = draggedTask;
        setDraggedTask(null);
        setDragOverColumnId(null);

        if (taskToMove.status !== columnId) {
            await handleUpdateTaskStatus(taskToMove.id, taskToMove.company_id, columnId);
        }
    };

    const filteredTasks = tasks.filter(t => {
        const matchesMachine = selectedMachineId === 'all' || String(t.machine_id) === String(selectedMachineId);
        const matchesCompany = selectedCompanyFilter === 'all' || String(t.company_id) === String(selectedCompanyFilter);
        return matchesMachine && matchesCompany;
    });

    const columns = [
        { id: 'pending', label: 'Unassigned / Pending', color: 'border-amber-500/20 bg-amber-500/5' },
        { id: 'in_progress', label: 'In Production', color: 'border-purple-500/20 bg-purple-500/5' },
        { id: 'done', label: 'Completed', color: 'border-emerald-500/20 bg-emerald-500/5' }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                        <FiCpu className="text-purple-400" /> Shared Machine Resource Portals
                    </h1>
                    <p className="text-gray-400 text-xs mt-1">
                        Cross-company shop-floor portals for shared printing presses, finishing machinery &amp; prepress resources
                    </p>
                </div>

                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold transition-all"
                >
                    <FiRefreshCw className="w-3.5 h-3.5" /> Refresh Portal Data
                </button>
            </div>

            {/* Machine Selection Grid */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Select Shared Machine Portal:</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {machines.map(m => {
                        const mTasks = tasks.filter(t => t.machine_id === m.id);
                        const c1Count = mTasks.filter(t => t.company_id === 1).length;
                        const c2Count = mTasks.filter(t => t.company_id === 2).length;

                        return (
                            <div
                                key={m.id}
                                className="bg-black/40 backdrop-blur-xl border border-white/10 hover:border-purple-500/40 rounded-2xl p-5 space-y-3 transition-all group flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                                            {m.type?.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs font-mono font-bold text-gray-400">
                                            {mTasks.length} tasks
                                        </span>
                                    </div>

                                    <h3 className="text-base font-bold text-white tracking-tight mt-2 group-hover:text-purple-300 transition-colors">
                                        {m.name}
                                    </h3>

                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                                        <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[11px] font-bold">
                                            Company 1: {c1Count}
                                        </span>
                                        <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[11px] font-bold">
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

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filter Tasks:</span>
                    <select
                        value={selectedMachineId}
                        onChange={e => setSelectedMachineId(e.target.value)}
                        className="bg-secondary border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none [color-scheme:dark]"
                    >
                        <option value="all">All Shared Machines</option>
                        {machines.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 w-full sm:w-auto">
                    {[
                        { id: 'all', label: 'All Companies' },
                        { id: '1', label: 'Company 1' },
                        { id: '2', label: 'Company 2' }
                    ].map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedCompanyFilter(c.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                selectedCompanyFilter === c.id ? 'bg-white/10 text-white border border-white/10' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Task Kanban Columns using Main Planning Drag Method */}
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
                        const isOver = dragOverColumnId === col.id;

                        return (
                            <div
                                key={col.id}
                                onDragOver={e => e.preventDefault()}
                                onDragEnter={e => { e.preventDefault(); setDragOverColumnId(col.id); }}
                                onDragLeave={e => { e.preventDefault(); setDragOverColumnId(null); }}
                                onDrop={e => { e.preventDefault(); handleDropOnColumn(col.id); }}
                                className={`border rounded-2xl p-4 ${col.color} backdrop-blur-md min-h-[500px] transition-all ${
                                    isOver ? 'border-purple-500 ring-2 ring-purple-500/30 scale-[1.01] bg-purple-950/20' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                                    <h3 className="font-extrabold text-sm uppercase tracking-wider">{col.label}</h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/10 border border-white/10">
                                        {colTasks.length}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {colTasks.length === 0 ? (
                                        <div className="py-16 text-center text-gray-500 text-xs border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2">
                                            <FiMove className="w-5 h-5 text-purple-400 animate-bounce" />
                                            <span>Drag tasks here to set as {col.label}</span>
                                        </div>
                                    ) : (
                                        colTasks.map(task => {
                                            const isDragged = draggedTask?.id === task.id && draggedTask?.company_id === task.company_id;
                                            return (
                                                <div
                                                    key={`${task.company_id}-${task.id}`}
                                                    draggable="true"
                                                    onDragStart={e => {
                                                        setDraggedTask(task);
                                                        e.dataTransfer.effectAllowed = 'move';
                                                        try { e.dataTransfer.setData('text/plain', String(task.id)); } catch (_) {}
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggedTask(null);
                                                        setDragOverColumnId(null);
                                                    }}
                                                    className={`bg-black/60 border border-white/10 hover:border-purple-500/40 rounded-xl p-4 space-y-3 shadow-lg transition-all cursor-grab active:cursor-grabbing ${
                                                        isDragged ? 'opacity-30' : 'opacity-100'
                                                    }`}
                                                >
                                                    {/* Header Badges */}
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Drag card to move between status columns">
                                                                <FiMove className="w-4 h-4" />
                                                            </div>

                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border tracking-wider uppercase ${
                                                                task.company_id === 1
                                                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                            }`}>
                                                                {task.company_name}
                                                            </span>
                                                        </div>

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
                                                                className="flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors"
                                                            >
                                                                <FiCheck className="w-3.5 h-3.5" /> Mark Done
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
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
