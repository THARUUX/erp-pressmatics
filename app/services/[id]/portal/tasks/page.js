'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import { FiList, FiGrid, FiClock, FiUser, FiPlay, FiSquare, FiCheck, FiX, FiInfo, FiBarChart2, FiRotateCcw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import TaskTimeAnalysisTable from '../components/TaskTimeAnalysisTable';

const COLUMNS = [
    { id: 'pending', label: 'Pending', color: 'border-zinc-800/80 bg-[#0e0e12]', dot: 'bg-amber-400' },
    { id: 'in_progress', label: 'In Progress', color: 'border-zinc-800/80 bg-[#0e0e12]', dot: 'bg-blue-400' },
    { id: 'paused', label: 'Paused', color: 'border-zinc-800/80 bg-[#0e0e12]', dot: 'bg-orange-400' },
    { id: 'done', label: "Today's Ready / Done", color: 'border-zinc-800/80 bg-[#0e0e12]', dot: 'bg-emerald-400' },
];

const STATUS_COLORS = {
    pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
    in_progress: 'bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium',
    paused: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
    done: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold',
};

function formatSeconds(secs) {
    if (!secs || secs <= 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
}

function isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
}

function TaskCard({ task, onRefresh }) {
    const [updating, setUpdating] = useState(false);

    const handleStartTimer = async () => {
        setUpdating(true);
        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', employee_name: task.assigned_to }),
            });
            if (res.ok) { toast.success('Timer started!'); onRefresh(); }
            else toast.error('Failed to start timer');
        } catch { toast.error('Error starting timer'); }
        finally { setUpdating(false); }
    };

    const handleStopTimer = async () => {
        setUpdating(true);
        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' }),
            });
            if (res.ok) { toast.success('Timer stopped!'); onRefresh(); }
            else toast.error('Failed to stop timer');
        } catch { toast.error('Error stopping timer'); }
        finally { setUpdating(false); }
    };

    const handlePushReady = async () => {
        setUpdating(true);
        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ready' }),
            });
            if (res.ok) { toast.success('Task pushed to Ready!'); onRefresh(); }
            else toast.error('Failed to update status');
        } catch { toast.error('Error updating status'); }
        finally { setUpdating(false); }
    };

    const handleReopen = async () => {
        setUpdating(true);
        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reopen', target_status: 'paused', employee_name: task.assigned_to }),
            });
            if (res.ok) {
                toast.success('Task re-opened! Accumulated time preserved.');
                onRefresh();
            } else toast.error('Failed to re-open task');
        } catch { toast.error('Error re-opening task'); }
        finally { setUpdating(false); }
    };

    const handleChangeStatus = async (newStatus) => {
        setUpdating(true);
        try {
            const orderId = task.sales_order_id || 'manual';
            await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            onRefresh();
        } catch { toast.error('Error updating status'); }
        finally { setUpdating(false); }
    };

    const displayName = task.name?.replace(/^Service:.*?—\s*/, '') || task.name;
    const estMinutes = parseInt(task.estimated_minutes || 0);
    const actSeconds = parseInt(task.actual_seconds || 0);

    return (
        <div className="bg-[#09090b] border border-zinc-800 rounded-md p-4 space-y-3 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white leading-tight">{displayName}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0 ${STATUS_COLORS[task.status] || 'bg-zinc-800 text-zinc-400'}`}>
                    {task.status?.replace('_', ' ')}
                </span>
            </div>

            {task.customer_name && (
                <p className="text-xs text-zinc-400 truncate">{task.customer_name}</p>
            )}

            {/* Time Stats */}
            <div className="grid grid-cols-2 gap-2 text-[10px] bg-zinc-900 border border-zinc-800/80 rounded-lg p-2">
                <div>
                    <span className="text-zinc-400 block uppercase">Est. Time</span>
                    <span className="font-mono font-bold text-zinc-200 mt-0.5 block">{estMinutes > 0 ? `${estMinutes}m` : '—'}</span>
                </div>
                <div className="border-l border-zinc-800 pl-2">
                    <span className="text-zinc-400 block uppercase">Actual Worked</span>
                    <span className="font-mono font-bold text-blue-300 mt-0.5 block">{formatSeconds(actSeconds)}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
                {/* {task.is_running ? (
                    <button onClick={handleStopTimer} disabled={updating}
                        className="flex-1 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer animate-pulse">
                        <FiSquare size={12} /> Stop
                    </button>
                ) : task.status !== 'done' ? (
                    <button onClick={handleStartTimer} disabled={updating}
                        className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm">
                        <FiPlay size={12} /> Start
                    </button>
                ) : null}

                {task.status !== 'done' ? (
                    <button onClick={handlePushReady} disabled={updating}
                        className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer">
                        <FiCheck size={12} /> Ready
                    </button>
                ) : (
                    <button onClick={handleReopen} disabled={updating}
                        className="w-full py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors">
                        <FiRotateCcw size={12} /> Re-open Task
                    </button>
                )} */}
                {task.status == 'done' ? (
                    <button onClick={handleReopen} disabled={updating}
                        className="w-full py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors">
                        <FiRotateCcw size={12} /> Re-open Task
                    </button>
                ) : (
                    <></>
                )}
            </div>

            {/* <select value={task.status} onChange={e => handleChangeStatus(e.target.value)} disabled={updating}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none cursor-pointer disabled:opacity-40">
                <option value="pending" className="bg-zinc-900">Pending</option>
                <option value="in_progress" className="bg-zinc-900">In Progress</option>
                <option value="paused" className="bg-zinc-900">Paused</option>
                <option value="done" className="bg-zinc-900">Done / Ready</option>
            </select> */}
        </div>
    );
}

function TaskRow({ task, onRefresh }) {
    const displayName = task.name?.replace(/^Service:.*?—\s*/, '') || task.name;
    const estMinutes = parseInt(task.estimated_minutes || 0);
    const actSeconds = parseInt(task.actual_seconds || 0);

    const handlePushReady = async () => {
        try {
            const orderId = task.sales_order_id || 'manual';
            await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ready' }),
            });
            toast.success('Task ready!');
            onRefresh();
        } catch { toast.error('Error'); }
    };

    const handleReopen = async () => {
        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reopen', target_status: 'paused', employee_name: task.assigned_to }),
            });
            if (res.ok) {
                toast.success('Task re-opened! Accumulated time preserved.');
                onRefresh();
            } else toast.error('Failed to re-open task');
        } catch { toast.error('Error'); }
    };

    return (
        <tr className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors">
            <td className="px-4 py-3">
                <div className="text-sm font-semibold text-white">{displayName}</div>
                {task.customer_name && <div className="text-xs text-zinc-400 mt-0.5">{task.customer_name}</div>}
            </td>
            <td className="px-4 py-3 text-xs text-zinc-400">{task.assigned_to || '—'}</td>
            <td className="px-4 py-3 font-mono text-xs text-zinc-200 font-bold">{estMinutes > 0 ? `${estMinutes}m` : '—'}</td>
            <td className="px-4 py-3 font-mono text-xs text-white font-bold">{formatSeconds(actSeconds)}</td>
            <td className="px-4 py-3">
                {task.status !== 'done' ? (
                    <button onClick={handlePushReady} className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer">
                        <FiCheck size={12} /> Push Ready
                    </button>
                ) : (
                    <button onClick={handleReopen} className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors">
                        <FiRotateCcw size={12} /> Re-open Task
                    </button>
                )}
            </td>
        </tr>
    );
}

export default function PortalTasksPage({ params }) {
    const { id } = use(params);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('kanban');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/services/${id}/planning`);
            const d = await res.json();
            setTasks(d.tasks || []);
        } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const byStatus = useMemo(() => {
        const map = {};
        COLUMNS.forEach(c => {
            if (c.id === 'done') {
                map[c.id] = tasks.filter(t => t.status === 'done' && isToday(t.completed_at || t.updated_at));
            } else {
                map[c.id] = tasks.filter(t => t.status === c.id);
            }
        });
        return map;
    }, [tasks]);

    const stats = useMemo(() => ({
        total: tasks.length,
        done: tasks.filter(t => t.status === 'done').length,
        active: tasks.filter(t => t.status === 'in_progress').length,
        pct: tasks.length > 0 ? Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100) : 0,
    }), [tasks]);

    return (
        <div className="p-8 space-y-6 bg-[#09090b] text-zinc-100 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">Tasks &amp; Multi-Employee Time Log</h1>
                    <p className="text-zinc-400 text-sm mt-0.5">{stats.total} total · {stats.pct}% complete</p>
                </div>
                {/* View Toggle */}
                <div className="flex gap-1 bg-[#0e0e11] border border-zinc-800/80 rounded-md p-1 text-xs font-semibold">
                    <button onClick={() => setView('kanban')} title="Kanban View" className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${view === 'kanban' ? 'bg-white text-black font-bold shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}><FiGrid size={14} /> Kanban</button>
                    <button onClick={() => setView('list')} title="Quick List View" className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${view === 'list' ? 'bg-white text-black font-bold shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}><FiList size={14} /> Quick List</button>
                    <button onClick={() => setView('analysis')} title="Time Analysis Table" className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${view === 'analysis' ? 'bg-purple-600 text-white font-bold shadow' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}><FiBarChart2 size={14} /> Est. vs Actual Analysis</button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-[#0e0e11] border border-zinc-800/80 rounded-md px-5 py-3 flex items-center gap-4">
                <div className="flex-1 bg-zinc-900 rounded-full h-2">
                    <div className="h-full bg-white rounded-full transition-all duration-500"
                        style={{ width: `${stats.pct}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-zinc-400 shrink-0">
                    <span className="text-white font-semibold">{stats.done} done / ready</span>
                    <span className="text-zinc-200 font-semibold">{stats.active} active</span>
                    <span>{stats.total - stats.done - stats.active} pending</span>
                </div>
            </div>

            {loading ? (
                <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" /></div>
            ) : view === 'analysis' ? (
                <TaskTimeAnalysisTable tasks={tasks} />
            ) : view === 'kanban' ? (
                /* Kanban */
                <div className="grid grid-cols-4 gap-4">
                    {COLUMNS.map(col => (
                        <div key={col.id} className={`border rounded-2xl p-4 ${col.color}`}>
                            <div className="flex items-center gap-2 mb-4">
                                <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{col.label}</span>
                                <span className="ml-auto text-xs text-zinc-400">{(byStatus[col.id] || []).length}</span>
                            </div>
                            <div className="space-y-3">
                                {(byStatus[col.id] || []).length === 0 ? (
                                    <div className="py-6 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-md">Empty</div>
                                ) : (byStatus[col.id] || []).map(task => (
                                    <TaskCard key={task.id} task={task} onRefresh={load} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* List View */
                <div className="bg-[#0e0e11] border border-zinc-800/80 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="border-b border-zinc-800/80 bg-zinc-900/40">
                            <tr>
                                {['Task', 'Assigned To', 'Est. Time', 'Actual Worked', 'Action'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-400">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {tasks.length === 0 ? (
                                <tr><td colSpan={5} className="py-16 text-center text-zinc-500 text-xs">No tasks found</td></tr>
                            ) : tasks.map(t => (
                                <TaskRow key={t.id} task={t} onRefresh={load} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
