'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    FiArrowLeft,
    FiX,
    FiCheckCircle,
    FiLayers,
    FiDollarSign,
    FiActivity,
    FiInfo,
    FiClock,
    FiChevronLeft
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const STATUS_CFG = {
    pending: { label: 'Pending', accent: '#f59e0b', bg: '#f59e0b15' },
    in_progress: { label: 'In Progress', accent: '#3b82f6', bg: '#3b82f615' },
    done: { label: 'Completed', accent: '#10b981', bg: '#10b98115' }
};

function parseDescription(desc) {
    if (!desc) return {};
    const parts = desc.split(' · ');
    const res = {};
    for (const p of parts) {
        if (p.startsWith('Unit:')) res.unit = p.replace('Unit:', '').trim();
        else if (p.startsWith('Rate:')) res.rate = parseFloat(p.replace('Rate:', '').trim()) || 0;
        else if (p.startsWith('Multiply By:')) res.multiply_by = parseFloat(p.replace('Multiply By:', '').trim()) || 0;
        else if (p.startsWith('Total Cost:')) res.total_cost = parseFloat(p.replace('Total Cost:', '').trim()) || 0;
        else if (p.startsWith('Note:')) res.note = p.replace('Note:', '').trim();
    }
    return res;
}

function formatDuration(start, end) {
    if (!start || !end) return '—';
    const diff = new Date(end) - new Date(start);
    if (diff <= 0) return '—';
    const totalMins = Math.round(diff / 60000);
    if (totalMins < 60) return `${totalMins}m`;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function StatCard({ label, value, accent, icon: Icon }) {
    return (
        <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold block">{label}</span>
                <span className="text-xl font-extrabold text-white mt-1 block">{value}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]" style={{ color: accent }}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );
}

export default function EmployeeWorkspacePage({ params }) {
    const { id, employeeName: rawEmployeeName } = use(params);
    const employeeName = decodeURIComponent(rawEmployeeName);
    const router = useRouter();

    const [service, setService] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [noteModal, setNoteModal] = useState(null);
    const [greeting, setGreeting] = useState('Hello');

    // Get time-based greeting
    useEffect(() => {
        const hr = new Date().getHours();
        if (hr < 12) setGreeting('Good morning');
        else if (hr < 17) setGreeting('Good afternoon');
        else setGreeting('Good evening');
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/services/${id}/planning`);
            if (!res.ok) throw new Error('Failed to load planning data');
            const data = await res.json();
            setService(data.service);
            
            // Filter tasks assigned to this employee
            const empTasks = (data.tasks || []).filter(t => t.assigned_to === employeeName);
            setTasks(empTasks);
        } catch (e) {
            console.error(e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [id, employeeName]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleStatusChange = async (task, newStatus) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? {
            ...t,
            status: newStatus,
            completed_at: newStatus === 'done' ? new Date().toISOString() : t.completed_at,
            started_at: newStatus === 'in_progress' ? new Date().toISOString() : t.started_at
        } : t));

        try {
            const res = await fetch(`/api/sales-orders/${task.sales_order_id}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    completed_at: newStatus === 'done' ? new Date().toISOString() : null
                }),
            });
            if (!res.ok) throw new Error('Failed to update status');
            toast.success(`Task marked as ${STATUS_CFG[newStatus].label}`);
        } catch (e) {
            console.error(e);
            toast.error('Failed to update task status');
            loadData(); // Revert
        }
    };

    const handleUnassign = async (task) => {
        const updatedName = `Service: ${service?.name || ''}`;
        setTasks(prev => prev.filter(item => item.id !== task.id));
        try {
            const res = await fetch(`/api/sales-orders/${task.sales_order_id}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assigned_to: null, name: updatedName }),
            });
            if (!res.ok) throw new Error('Failed to unassign task');
            toast.success('Task moved to Backlog');
        } catch (e) {
            console.error(e);
            toast.error('Failed to unassign task');
            loadData();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#07070f] flex items-center justify-center flex-col space-y-4">
                <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                <p className="text-sm text-white/40">Loading workspace for {employeeName}…</p>
            </div>
        );
    }

    if (error || !service) {
        return (
            <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl text-center max-w-md w-full mx-4">
                    <p className="font-semibold">Error loading workspace</p>
                    <p className="text-xs mt-1 text-red-400/80">{error || 'Service details not found'}</p>
                    <div className="flex gap-4 justify-center mt-6">
                        <Link href={`/dashboard/services/${id}/planning`} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white text-xs font-semibold">
                            Back to Board
                        </Link>
                        <button onClick={loadData} className="px-4 py-2 bg-white/10 rounded-xl hover:bg-white/20 text-white text-xs font-semibold">
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const empMeta = service.employees.find(e => e.employee_name === employeeName);
    const activeTasksList = tasks.filter(t => t.status !== 'done' && t.order_status !== 'Delivered' && t.order_status !== 'Cancelled');
    const completedTasksList = tasks.filter(t => t.status === 'done');

    let totalEarned = 0;
    completedTasksList.forEach(t => {
        const details = parseDescription(t.description);
        if (details.total_cost) totalEarned += details.total_cost;
    });

    return (
        <div className="min-h-screen bg-[#07070f] text-white p-6 md:p-12 font-sans relative overflow-x-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                {/* Back Link */}
                <Link
                    href={`/dashboard/services/${id}/planning`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.05] rounded-xl text-xs text-white/70 transition-colors"
                >
                    <FiArrowLeft className="w-4 h-4" /> Back to Planning Board
                </Link>

                {/* Greeting Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/[0.08] pb-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                            {greeting}, {employeeName}!
                        </h1>
                        <p className="text-white/40 text-sm mt-1">
                            Welcome back to your workspace for <span className=" font-semibold">{service.name}</span>. Here is your schedule.
                        </p>
                    </div>

                    <div className="bg-white/[0.02] border border-white/[0.08] px-4 py-3 rounded-2xl flex flex-col items-start shrink-0">
                        <span className="text-[9px] uppercase tracking-wider text-white/40 font-mono">Assigned Rate Unit</span>
                        <span className="text-sm font-bold  mt-0.5">
                            {empMeta ? `LKR ${empMeta.rate.toFixed(2)} (${empMeta.default_rate_unit})` : 'Custom Assignment Rates'}
                        </span>
                    </div>
                </header>

                {/* Stats row */}
                <div className="flex flex-wrap gap-6">
                    <StatCard label="Active Tasks" value={activeTasksList.length} accent="#3b82f6" icon={FiLayers} />
                    <StatCard label="Completed Tasks" value={completedTasksList.length} accent="#10b981" icon={FiCheckCircle} />
                    <StatCard label="Total Cost Accumulated" value={`LKR ${totalEarned.toLocaleString()}`} accent="#a78bfa" icon={FiDollarSign} />
                </div>

                {/* Active Service Tickets */}
                <section className="bg-white/[0.02] border border-white/[0.08] rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-lg">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <FiActivity className="text-blue-400" /> Active Service Tickets
                    </h3>
                    {activeTasksList.length === 0 ? (
                        <div className="py-12 text-center text-white/30 text-sm italic">
                            No active tasks are scheduled for you at this time.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b border-white/[0.08] text-white/40 text-[10px] uppercase font-bold tracking-wider">
                                        <th className="py-3 pl-2">Sales Order</th>
                                        <th className="py-3">Client</th>
                                        <th className="py-3">Note</th>
                                        <th className="py-3 text-center">Status</th>
                                        <th className="py-3 text-right pr-2">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {activeTasksList.map(t => {
                                        const details = parseDescription(t.description);
                                        return (
                                            <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                                                <td className="py-4 pl-2 font-bold">
                                                    <span className="hover:underline text-white/90">
                                                        SO #{t.order_code || t.sales_order_id}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-white/60">{t.customer_name}</td>
                                                <td className="py-4">
                                                    {details.note ? (
                                                        <button
                                                            onClick={() => setNoteModal({ task: t, note: details.note })}
                                                            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-bold"
                                                        >
                                                            <FiInfo className="shrink-0" /> View Note
                                                        </button>
                                                    ) : (
                                                        <span className="text-white/20 italic text-[11px]">—</span>
                                                    )}
                                                </td>
                                                <td className="py-4 text-center">
                                                    <select
                                                        value={t.status || 'pending'}
                                                        onChange={e => handleStatusChange(t, e.target.value)}
                                                        className="bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer focus:border-white/30"
                                                        style={{ color: STATUS_CFG[t.status || 'pending'].accent }}
                                                    >
                                                        <option value="pending">● Pending</option>
                                                        <option value="in_progress">● In Progress</option>
                                                        <option value="done">● Completed</option>
                                                    </select>
                                                </td>
                                                <td className="py-4 text-right pr-2">
                                                    <button
                                                        onClick={() => handleUnassign(t)}
                                                        className="text-xs text-red-400 hover:text-red-300 font-bold"
                                                    >
                                                        Unassign
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Completed Tasks Table */}
                <section className="bg-white/[0.02] border border-white/[0.08] rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-lg">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <FiCheckCircle className="text-emerald-400" /> Completed Job Logs
                    </h3>
                    {completedTasksList.length === 0 ? (
                        <div className="py-12 text-center text-white/30 text-sm italic">
                            No completed tasks logged in this cycle yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b border-white/[0.08] text-white/40 text-[10px] uppercase font-bold tracking-wider">
                                        <th className="py-3 pl-2">Date Completed</th>
                                        <th className="py-3">Sales Order</th>
                                        <th className="py-3">Client</th>
                                        <th className="py-3 text-right">Duration</th>
                                        <th className="py-3 text-right pr-2">Earnings Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {completedTasksList.map(t => {
                                        const details = parseDescription(t.description);
                                        return (
                                            <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                                                <td className="py-4 pl-2 text-white/60">
                                                    {new Date(t.completed_at).toLocaleDateString()}
                                                </td>
                                                <td className="py-4 font-bold">
                                                    <span className="hover:underline text-white/80">
                                                        SO #{t.order_code || t.sales_order_id}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-white/60">{t.customer_name}</td>
                                                <td className="py-4 text-right font-mono text-white/60">
                                                    {formatDuration(t.started_at, t.completed_at)}
                                                </td>
                                                <td className="py-4 text-right pr-2 font-mono font-bold text-emerald-400">
                                                    {details.total_cost ? `LKR ${details.total_cost.toLocaleString()}` : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {/* Note Modal Overlay */}
            {noteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-opacity">
                    <div className="bg-[#0c0c16] border border-white/10 rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl flex flex-col">
                        <header className="flex justify-between items-center px-6 py-4 border-b border-white/[0.08] bg-white/[0.01]">
                            <div>
                                <span className="font-mono text-[9px] font-bold text-white/30 uppercase tracking-wider block">
                                    SO #{noteModal.task.order_code || noteModal.task.sales_order_id}
                                </span>
                                <h3 className="text-sm font-bold text-white mt-0.5">
                                    Task Note Details
                                </h3>
                            </div>
                            <button
                                onClick={() => setNoteModal(null)}
                                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </header>
                        <div className="p-6 space-y-4 text-sm leading-relaxed max-h-[350px] overflow-y-auto scrollbar-thin">
                            <p className="text-white/80 whitespace-pre-wrap">{noteModal.note}</p>
                        </div>
                        <footer className="px-6 py-3 border-t border-white/[0.08] bg-white/[0.01] flex justify-end">
                            <button
                                onClick={() => setNoteModal(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xs font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
