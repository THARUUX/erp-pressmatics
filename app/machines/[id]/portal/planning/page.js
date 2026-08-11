'use client';

import { use, useState, useEffect, useCallback } from 'react';
import {
    FiCalendar, FiClock, FiPlus, FiTrash2, FiChevronUp, FiChevronDown,
    FiUser, FiLayers, FiAlertCircle, FiCheck, FiRefreshCw, FiCheckCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function MachineDailyPlanningPage({ params }) {
    const { id } = use(params);
    const [machine, setMachine] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    // Selected Planning Date (YYYY-MM-DD)
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

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
            toast.error(e.message || 'Failed to load planning data');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const updateTask = async (task, fields) => {
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

            toast.success('Task updated');

            // Optimistic update
            setTasks(prev => prev.map(t => {
                if (t.id === task.id && t.company_id === task.company_id) {
                    return { ...t, ...fields };
                }
                return t;
            }));
        } catch (e) {
            toast.error(e.message);
        }
    };

    const scheduleForSelectedDate = (task) => {
        updateTask(task, { planned_date: selectedDate });
    };

    const unscheduleTask = (task) => {
        updateTask(task, { planned_date: null });
    };

    const movePosition = async (taskIndex, direction, currentScheduledTasks) => {
        const targetIndex = taskIndex + direction;
        if (targetIndex < 0 || targetIndex >= currentScheduledTasks.length) return;

        const taskA = currentScheduledTasks[taskIndex];
        const taskB = currentScheduledTasks[targetIndex];

        const posA = taskB.machine_position || targetIndex + 1;
        const posB = taskA.machine_position || taskIndex + 1;

        await Promise.all([
            updateTask(taskA, { machine_position: posA }),
            updateTask(taskB, { machine_position: posB })
        ]);
    };

    // Filter tasks planned for selected date vs unplanned
    const scheduledTasks = tasks.filter(t => {
        if (!t.planned_date) return false;
        const pDate = new Date(t.planned_date).toISOString().split('T')[0];
        return pDate === selectedDate;
    });

    // Sort scheduled by position
    scheduledTasks.sort((a, b) => (a.machine_position || 999) - (b.machine_position || 999));

    const unplannedTasks = tasks.filter(t => {
        if (!t.planned_date) return true;
        const pDate = new Date(t.planned_date).toISOString().split('T')[0];
        return pDate !== selectedDate && t.status !== 'done';
    });

    // Capacity calculations
    const shiftLimitHours = machine?.shift_limit || 8;
    const shiftLimitMins = shiftLimitHours * 60;
    const totalPlannedMins = scheduledTasks.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);
    const totalPlannedHours = (totalPlannedMins / 60).toFixed(1);
    const capacityPct = Math.round((totalPlannedMins / shiftLimitMins) * 100);

    if (loading) {
        return (
            <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-400 text-xs">Loading daily planning workspace...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Date Selector & Capacity Bar */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                            <FiCalendar className="text-purple-400" /> Daily Task Scheduler
                        </h2>
                        <p className="text-xs text-gray-400">Plan and sequence daily shop-floor workloads across companies</p>
                    </div>

                    {/* Date Picker Control */}
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Date:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-purple-300 focus:outline-none focus:border-purple-500 [color-scheme:dark]"
                        />
                    </div>
                </div>

                {/* Shift Capacity Progress Bar */}
                <div className="space-y-2 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                            <FiClock className="text-purple-400" /> Shift Capacity Utilization ({selectedDate})
                        </span>
                        <span className={`font-mono font-bold ${capacityPct > 100 ? 'text-red-400' : capacityPct > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {totalPlannedHours}h / {shiftLimitHours}h ({capacityPct}%)
                        </span>
                    </div>

                    <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden border border-white/5">
                        <div
                            className={`h-full transition-all duration-500 ${
                                capacityPct > 100 ? 'bg-red-500' : capacityPct > 80 ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min(capacityPct, 100)}%` }}
                        />
                    </div>
                    {capacityPct > 100 && (
                        <p className="text-[11px] font-bold text-red-400 flex items-center gap-1">
                            <FiAlertCircle /> Shift capacity exceeded by {(totalPlannedMins - shiftLimitMins)} minutes!
                        </p>
                    )}
                </div>
            </div>

            {/* Two Column Layout: Scheduled for Selected Date vs Unassigned Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column 1: Scheduled Tasks for Selected Date */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                            <FiCheckCircle className="text-emerald-400" /> Scheduled for {selectedDate} ({scheduledTasks.length})
                        </h3>
                        <span className="text-xs font-mono font-bold text-purple-300">
                            {totalPlannedMins} mins total
                        </span>
                    </div>

                    {scheduledTasks.length === 0 ? (
                        <div className="py-16 text-center bg-black/30 border border-dashed border-white/10 rounded-2xl text-gray-500 text-xs">
                            No tasks scheduled for {selectedDate}. Select from the available queue to assign.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {scheduledTasks.map((task, idx) => (
                                <div
                                    key={`${task.company_id}-${task.id}`}
                                    className="bg-black/50 border border-white/10 hover:border-purple-500/40 rounded-2xl p-4 space-y-3 shadow-lg"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            {/* Sequence Position */}
                                            <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-extrabold text-xs flex items-center justify-center border border-purple-500/30">
                                                {idx + 1}
                                            </span>

                                            {/* Company Badge */}
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase ${
                                                task.company_id === 1 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                            }`}>
                                                {task.company_name}
                                            </span>

                                            <span className="text-xs font-mono font-bold text-gray-400">
                                                {task.order_code}
                                            </span>
                                        </div>

                                        {/* Sequence Re-order controls */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => movePosition(idx, -1, scheduledTasks)}
                                                disabled={idx === 0}
                                                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move Up"
                                            >
                                                <FiChevronUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => movePosition(idx, 1, scheduledTasks)}
                                                disabled={idx === scheduledTasks.length - 1}
                                                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Move Down"
                                            >
                                                <FiChevronDown className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => unscheduleTask(task)}
                                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs ml-2"
                                                title="Unschedule Task"
                                            >
                                                <FiTrash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-sm text-white">{task.name}</h4>
                                        {task.customer_name && <p className="text-xs text-gray-400">{task.customer_name}</p>}
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs text-gray-400">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-purple-300 font-bold">
                                                {task.estimated_minutes ? `${task.estimated_minutes} min` : '—'}
                                            </span>
                                            <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                Run Qty: {(task.run_quantity || task.quantity || task.sheet_count || 0).toLocaleString()}
                                            </span>
                                        </div>

                                        <select
                                            value={task.assigned_to || ''}
                                            onChange={e => updateTask(task, { assigned_to: e.target.value || null })}
                                            className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
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
                            ))}
                        </div>
                    )}
                </div>

                {/* Column 2: Unplanned / Available Tasks Queue */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                            <FiLayers className="text-amber-400" /> Unplanned / Available Queue ({unplannedTasks.length})
                        </h3>
                    </div>

                    {unplannedTasks.length === 0 ? (
                        <div className="py-16 text-center bg-black/30 border border-white/10 rounded-2xl text-gray-500 text-xs">
                            No unscheduled tasks remaining.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {unplannedTasks.map(task => (
                                <div
                                    key={`${task.company_id}-${task.id}`}
                                    className="bg-black/40 border border-white/10 hover:border-white/20 rounded-2xl p-4 space-y-3"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase ${
                                                task.company_id === 1 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                            }`}>
                                                {task.company_name}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-gray-400">
                                                {task.order_code}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => scheduleForSelectedDate(task)}
                                            className="flex items-center gap-1.5 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 text-purple-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                        >
                                            <FiPlus className="w-3.5 h-3.5" /> Schedule ({selectedDate})
                                        </button>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-sm text-white">{task.name}</h4>
                                        {task.customer_name && <p className="text-xs text-gray-400">{task.customer_name}</p>}
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-white/5">
                                        <span>Run Qty: <strong className="text-amber-300 font-mono">{(task.run_quantity || task.quantity || task.sheet_count || 0).toLocaleString()}</strong></span>
                                        <span>Est: <strong className="text-purple-300 font-mono">{task.estimated_minutes ? `${task.estimated_minutes} min` : '—'}</strong></span>
                                        <span>Delivery: <strong className="text-gray-300">{task.delivery_date ? new Date(task.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</strong></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
