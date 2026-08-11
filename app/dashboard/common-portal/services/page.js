'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiLayers, FiCalendar, FiClock, FiCheck, FiRefreshCw, FiUser, FiPlus, FiAlertCircle, FiArrowRight, FiInbox, FiList } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function CommonServicesPortalPage() {
    const [services, setServices] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [unplannedQueue, setUnplannedQueue] = useState([]);
    const [plannedTasks, setPlannedTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedServiceId, setSelectedServiceId] = useState('all');
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/common-portal/services');
            if (res.ok) {
                const data = await res.json();
                setServices(data.services || []);
                setTasks(data.tasks || []);
                setUnplannedQueue(data.unplannedQueue || []);
                setPlannedTasks(data.plannedTasks || []);
                setEmployees(data.employees || []);
            } else {
                toast.error('Failed to load shared service portal data');
            }
        } catch (err) {
            console.error(err);
            toast.error('Network error loading shared services');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateTask = async (taskId, companyId, fields) => {
        try {
            const res = await fetch('/api/common-portal/services', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, companyId, fields })
            });
            if (res.ok) {
                toast.success('Task updated successfully');
                fetchData();
            } else {
                toast.error('Failed to update task');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error updating task');
        }
    };

    const filterTasks = (taskList) => {
        return taskList.filter(t => {
            const matchesService = selectedServiceId === 'all' || String(t.service_id) === String(selectedServiceId);
            const matchesCompany = selectedCompanyFilter === 'all' || String(t.company_id) === String(selectedCompanyFilter);
            return matchesService && matchesCompany;
        });
    };

    const filteredUnplanned = filterTasks(unplannedQueue);
    const filteredPlanned = filterTasks(plannedTasks);

    return (
        <div className="min-h-screen text-white space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                        <FiLayers className="text-indigo-400 w-7 h-7" />
                        Unified Cross-Company Service Portal
                    </h1>
                    <p className="text-gray-400 text-xs mt-1">
                        Centralized queue and planning for common services across Company 1 &amp; Company 2
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    >
                        <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Queue
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-black/30 border border-white/10 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Shared Service</label>
                    <select
                        value={selectedServiceId}
                        onChange={e => setSelectedServiceId(e.target.value)}
                        className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]"
                    >
                        <option value="all">All Common Services ({services.length})</option>
                        {services.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div className="bg-black/30 border border-white/10 p-3 rounded-xl">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Filter Company</label>
                    <select
                        value={selectedCompanyFilter}
                        onChange={e => setSelectedCompanyFilter(e.target.value)}
                        className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none [color-scheme:dark]"
                    >
                        <option value="all">Both Companies</option>
                        <option value="1">Company 1 Only</option>
                        <option value="2">Company 2 Only</option>
                    </select>
                </div>

                <div className="bg-black/30 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase">Unplanned Queue Count</div>
                        <div className="text-xl font-black text-amber-400 mt-0.5">{filteredUnplanned.length} Tasks</div>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                            Co 1: {filteredUnplanned.filter(t => t.company_id === 1).length}
                        </span>
                        <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            Co 2: {filteredUnplanned.filter(t => t.company_id === 2).length}
                        </span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="py-24 text-center text-gray-500 animate-pulse">Loading service portal...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Unplanned Queue Section */}
                    <div className="lg:col-span-1 bg-black/40 border border-amber-500/20 rounded-2xl p-5 backdrop-blur-xl flex flex-col min-h-[600px]">
                        <div className="flex items-center justify-between mb-4 border-b border-amber-500/20 pb-3">
                            <h2 className="font-extrabold text-sm uppercase tracking-wider text-amber-400 flex items-center gap-2">
                                <FiInbox className="w-4 h-4" />
                                Unplanned Queue ({filteredUnplanned.length})
                            </h2>
                            <span className="text-[10px] text-gray-400">Incoming SO Tasks</span>
                        </div>

                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[700px] pr-1">
                            {filteredUnplanned.length === 0 ? (
                                <div className="py-16 text-center text-gray-500 text-xs border border-dashed border-white/10 rounded-xl">
                                    No pending service tasks in unplanned queue
                                </div>
                            ) : (
                                filteredUnplanned.map(task => (
                                    <div
                                        key={`${task.company_id}-${task.id}`}
                                        className="bg-black/60 border border-white/10 hover:border-amber-500/40 rounded-xl p-4 space-y-3 shadow-lg transition-all"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider ${
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

                                        <div>
                                            <div className="font-bold text-sm text-white">{task.name}</div>
                                            {task.customer_name && (
                                                <div className="text-xs text-gray-400 mt-0.5">{task.customer_name}</div>
                                            )}
                                        </div>

                                        <div className="text-[11px] text-gray-500 bg-white/5 p-2 rounded border border-white/5 flex justify-between">
                                            <span>Qty: {task.quantity || 1}</span>
                                            <span>Est: {task.estimated_minutes ? `${task.estimated_minutes}m` : '—'}</span>
                                        </div>

                                        <div className="pt-2 border-t border-white/10 flex gap-2">
                                            <button
                                                onClick={() => handleUpdateTask(task.id, task.company_id, {
                                                    status: 'in_progress',
                                                    planned_date: new Date().toISOString().substring(0, 10)
                                                })}
                                                className="flex-1 flex items-center justify-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 py-1.5 rounded-lg text-xs font-bold transition-all"
                                            >
                                                Start / Plan Today <FiArrowRight size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Active & Scheduled Services Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 backdrop-blur-xl min-h-[600px] flex flex-col">
                            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                                <h2 className="font-extrabold text-sm uppercase tracking-wider text-white flex items-center gap-2">
                                    <FiList className="w-4 h-4 text-purple-400" />
                                    Active &amp; Scheduled Shared Tasks ({filteredPlanned.length})
                                </h2>
                            </div>

                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[700px] pr-1">
                                {filteredPlanned.length === 0 ? (
                                    <div className="py-16 text-center text-gray-500 text-xs border border-dashed border-white/10 rounded-xl">
                                        No active planned service tasks
                                    </div>
                                ) : (
                                    filteredPlanned.map(task => (
                                        <div
                                            key={`${task.company_id}-${task.id}`}
                                            className="bg-black/60 border border-white/10 hover:border-purple-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg transition-all"
                                        >
                                            <div className="space-y-1.5 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border uppercase tracking-wider ${
                                                        task.company_id === 1
                                                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                    }`}>
                                                        {task.company_name}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-mono">
                                                        SO: {task.order_code || `#${task.sales_order_id}`}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                        task.status === 'done'
                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                    }`}>
                                                        {task.status?.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                <div className="font-bold text-sm text-white">{task.name}</div>
                                                {task.customer_name && (
                                                    <div className="text-xs text-gray-400">{task.customer_name}</div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0">
                                                <select
                                                    value={task.assigned_to || ''}
                                                    onChange={e => handleUpdateTask(task.id, task.company_id, { assigned_to: e.target.value || null })}
                                                    className="bg-secondary border border-white/10 rounded-lg text-xs px-2.5 py-1.5 text-white focus:outline-none [color-scheme:dark]"
                                                >
                                                    <option value="">Unassigned Operator</option>
                                                    {employees.map(e => (
                                                        <option key={e.name} value={e.name}>{e.name}</option>
                                                    ))}
                                                </select>

                                                {task.status !== 'done' ? (
                                                    <button
                                                        onClick={() => handleUpdateTask(task.id, task.company_id, { status: 'done' })}
                                                        className="flex items-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                                    >
                                                        <FiCheck size={13} /> Complete
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                                        <FiCheck size={13} /> Done
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
