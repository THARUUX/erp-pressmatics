'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    FiCalendar, FiChevronLeft, FiChevronRight, FiSearch,
    FiCpu, FiClock, FiAlertCircle, FiRefreshCw, FiUser, FiInfo
} from 'react-icons/fi';

// Date utility to convert UTC/date objects to YYYY-MM-DD local format
function formatDateToYYYYMMDD(dateVal) {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    } catch {
        return '';
    }
}

// Get the Monday of the week for a given date
function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

export default function JobWeeklyPlanner({ machines = [], finishings = [], orders = [], onRefresh }) {
    const [localOrders, setLocalOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentWeekStart, setCurrentWeekStart] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null); // format: "machineId-dateStr"
    const [savingTaskId, setSavingTaskId] = useState(null);

    // Initialize week and sync orders
    useEffect(() => {
        setLocalOrders(orders);
        if (!currentWeekStart) {
            setCurrentWeekStart(getMonday(new Date()));
        }
    }, [orders]);

    // Calculate dates for the 7 days of the active week
    const weekDates = [];
    if (currentWeekStart) {
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);
            weekDates.push(date);
        }
    }

    // Week navigation controls
    const handlePrevWeek = () => {
        setCurrentWeekStart(prev => {
            const next = new Date(prev);
            next.setDate(prev.getDate() - 7);
            return next;
        });
    };

    const handleNextWeek = () => {
        setCurrentWeekStart(prev => {
            const next = new Date(prev);
            next.setDate(prev.getDate() + 7);
            return next;
        });
    };

    const handleTodayWeek = () => {
        setCurrentWeekStart(getMonday(new Date()));
    };

    // Format week header label (e.g. "Jul 20 - Jul 26, 2026")
    const getWeekRangeLabel = () => {
        if (weekDates.length < 7) return '';
        const options = { month: 'short', day: 'numeric' };
        const startStr = weekDates[0].toLocaleDateString('en-US', options);
        const endStr = weekDates[6].toLocaleDateString('en-US', { ...options, year: 'numeric' });
        return `${startStr} — ${endStr}`;
    };

    // Filtered list of jobs for the sidebar
    const filteredOrders = localOrders.filter(order => {
        const code = (order.code || '').toLowerCase();
        const customer = (order.customer_name || '').toLowerCase();
        const estimation = (order.estimation_names || '').toLowerCase();
        const q = searchQuery.toLowerCase().trim();

        // Match text query
        const matchesQuery = code.includes(q) || customer.includes(q) || estimation.includes(q);
        if (!matchesQuery) return false;

        // Hide inactive/cancelled/delivered orders to keep it clean
        const status = String(order.status || '').toLowerCase();
        return !['cancelled', 'delivered'].includes(status);
    });

    // Currently selected order
    const selectedOrder = localOrders.find(o => String(o.id) === String(selectedOrderId));
    const selectedOrderTasks = selectedOrder ? (selectedOrder.tasks || []) : [];

    // Find all unique machines associated with the selected order's tasks
    const relatedMachines = [];
    let hasManualTasks = false;

    if (selectedOrder) {
        selectedOrderTasks.forEach(task => {
            if (task.machine_id) {
                const mac = machines.find(m => m.id === task.machine_id);
                if (mac && !relatedMachines.some(m => m.id === mac.id)) {
                    relatedMachines.push(mac);
                }
            } else {
                hasManualTasks = true;
            }
        });
    }

    // Drag and drop event handlers
    const handleDragStart = (e, taskId, orderId) => {
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.setData('orderId', orderId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, machineId, dateStr) => {
        e.preventDefault();
        setDragOverCell(`${machineId}-${dateStr}`);
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = async (e, machineId, dateStr) => {
        e.preventDefault();
        setDragOverCell(null);

        const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const orderId = parseInt(e.dataTransfer.getData('orderId'), 10);
        if (isNaN(taskId) || isNaN(orderId)) return;

        // Find the task we are dragging
        const targetOrder = localOrders.find(o => o.id === orderId);
        if (!targetOrder) return;
        const task = (targetOrder.tasks || []).find(t => t.id === taskId);
        if (!task) return;

        // Build updating fields
        const fields = { scheduled_date: dateStr };

        // Optimistically update local UI state
        setLocalOrders(prev => prev.map(order => {
            if (order.id === orderId) {
                return {
                    ...order,
                    tasks: (order.tasks || []).map(t => {
                        if (t.id === taskId) {
                            return { ...t, ...fields };
                        }
                        return t;
                    })
                };
            }
            return order;
        }));

        setSavingTaskId(taskId);
        try {
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields)
            });
            if (!res.ok) throw new Error('Failed to update task schedule date');
            if (onRefresh) await onRefresh();
        } catch (err) {
            console.error(err);
            // Revert on failure
            setLocalOrders(orders);
        } finally {
            setSavingTaskId(null);
        }
    };

    // Get all tasks scheduled on a machine/manual on a date
    const getScheduledTasks = (machineId, dateStr) => {
        const list = [];
        localOrders.forEach(order => {
            (order.tasks || []).forEach(task => {
                const taskDate = formatDateToYYYYMMDD(task.scheduled_date);
                if (taskDate === dateStr) {
                    if (machineId === 'manual') {
                        if (!task.machine_id) {
                            list.push({ task, order });
                        }
                    } else {
                        if (task.machine_id === machineId) {
                            list.push({ task, order });
                        }
                    }
                }
            });
        });
        return list;
    };

    const getStatusColorDot = (status) => {
        const s = String(status || '').toLowerCase();
        if (['done', 'completed', 'ready', 'delivered'].includes(s)) return 'bg-emerald-400';
        if (['in progress', 'in_progress', 'started'].includes(s)) return 'bg-purple-400';
        if (s === 'paused') return 'bg-amber-400';
        return 'bg-neutral-500';
    };

    return (
        <div className="flex h-[calc(100vh-280px)] min-h-[500px] gap-6 text-neutral-200">
            {/* Left Sidebar: Jobs List */}
            <div className="w-80 flex flex-col bg-black border border-white/10 rounded-2xl overflow-hidden flex-shrink-0">
                <div className="p-4 border-b border-white/10 flex flex-col gap-2.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 m-0">Active Jobs</h3>
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-3.5 h-3.5" />
                        <input
                            type="text"
                            placeholder="Filter jobs by code/cust..."
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-0"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-8 text-neutral-500 text-xs">No active jobs match filters</div>
                    ) : (
                        filteredOrders.map(order => {
                            const isSelected = String(order.id) === String(selectedOrderId);
                            const tasks = order.tasks || [];
                            const scheduled = tasks.filter(t => t.scheduled_date !== null).length;
                            
                            return (
                                <button
                                    key={order.id}
                                    onClick={() => setSelectedOrderId(order.id)}
                                    className={`w-full text-left p-3 rounded-xl transition-all border flex flex-col gap-1 cursor-pointer select-none ${
                                        isSelected 
                                            ? 'bg-purple-950/20 border-purple-500/35 text-white shadow-md shadow-purple-950/30' 
                                            : 'bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/5'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs font-black tracking-wider text-white">{order.code}</span>
                                        <span className="text-[9px] font-bold text-neutral-400 font-mono">
                                            {scheduled}/{tasks.length} Scheduled
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-neutral-400 font-medium truncate w-full">
                                        {order.customer_name}
                                    </span>
                                    <span className="text-[9px] text-neutral-500 font-semibold truncate w-full">
                                        {order.estimation_names || 'General Job'}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Panel: Weekly Grid */}
            <div className="flex-1 flex flex-col bg-black border border-white/10 rounded-2xl overflow-hidden">
                {/* Header Navigation */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0 bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrevWeek}
                            className="p-1.5 hover:bg-white/5 border border-white/10 rounded-lg text-neutral-300 hover:text-white transition-all cursor-pointer"
                            title="Previous week"
                        >
                            <FiChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleTodayWeek}
                            className="px-3 py-1.5 hover:bg-white/5 border border-white/10 rounded-lg text-neutral-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                        >
                            This Week
                        </button>
                        <button
                            onClick={handleNextWeek}
                            className="p-1.5 hover:bg-white/5 border border-white/10 rounded-lg text-neutral-300 hover:text-white transition-all cursor-pointer"
                            title="Next week"
                        >
                            <FiChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <span className="text-xs font-black tracking-wider text-white">
                        {getWeekRangeLabel()}
                    </span>

                    <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-widest flex items-center gap-1.5">
                        <FiCalendar className="w-3.5 h-3.5" /> Weekly Machine Planner
                    </span>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-auto">
                    {!selectedOrderId ? (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-2">
                            <FiCalendar className="w-12 h-12 text-neutral-600 animate-pulse" />
                            <h4 className="text-sm font-bold text-neutral-300 m-0">No Job Selected</h4>
                            <p className="text-xs text-neutral-500 m-0 mt-0.5">Please select a job from the active sidebar list to view its weekly machine workload.</p>
                        </div>
                    ) : relatedMachines.length === 0 && !hasManualTasks ? (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-2 p-6 text-center">
                            <FiAlertCircle className="w-12 h-12 text-neutral-600" />
                            <h4 className="text-sm font-bold text-neutral-300 m-0">No Tasks in Routing</h4>
                            <p className="text-xs text-neutral-500 m-0 mt-0.5 max-w-sm">This job doesn't have any routing tasks. Navigate to the **Routing Planner** tab to auto-generate default tasks or add manual operations.</p>
                        </div>
                    ) : (
                        <div className="p-4 flex flex-col gap-6 min-w-[900px]">
                            {/* Grid Table */}
                            <table className="w-full table-fixed border-collapse">
                                <thead>
                                    <tr>
                                        {/* Row Label header */}
                                        <th className="w-48 text-left pb-3 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                            Machine / Operation
                                        </th>
                                        
                                        {/* Daily headers */}
                                        {weekDates.map(date => {
                                            const isToday = formatDateToYYYYMMDD(date) === formatDateToYYYYMMDD(new Date());
                                            return (
                                                <th
                                                    key={date.toString()}
                                                    className={`pb-3 text-center text-xs font-bold ${
                                                        isToday ? 'text-purple-400 font-extrabold' : 'text-neutral-400'
                                                    }`}
                                                >
                                                    <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                                    <div className={`text-[10px] mt-0.5 font-semibold font-mono ${
                                                        isToday ? 'bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20' : 'text-neutral-500'
                                                    }`}>
                                                        {date.getDate()}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Related Machine Rows */}
                                    {relatedMachines.map(machine => (
                                        <tr key={machine.id} className="border-b border-white/5 last:border-0">
                                            {/* Machine Header */}
                                            <td className="py-4 pr-3 align-top">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-neutral-900 border border-white/5 rounded-lg text-neutral-400">
                                                        <FiCpu className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-white truncate" title={machine.name}>
                                                            {machine.name}
                                                        </div>
                                                        <div className="text-[9px] text-neutral-500 font-semibold uppercase tracking-wider">
                                                            {machine.type || 'machine'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Cells */}
                                            {weekDates.map(date => {
                                                const dateStr = formatDateToYYYYMMDD(date);
                                                const cellTasks = getScheduledTasks(machine.id, dateStr);
                                                const isOver = dragOverCell === `${machine.id}-${dateStr}`;

                                                return (
                                                    <td
                                                        key={dateStr}
                                                        onDragOver={e => handleDragOver(e, machine.id, dateStr)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={e => handleDrop(e, machine.id, dateStr)}
                                                        className={`p-2.5 align-top border-l border-white/5 transition-all min-h-[100px] ${
                                                            isOver ? 'bg-purple-500/10 border-dashed border-purple-500/30' : 'bg-transparent'
                                                        }`}
                                                        style={{ height: 110 }}
                                                    >
                                                        <div className="flex flex-col gap-1.5 h-full overflow-y-auto pr-0.5">
                                                            {cellTasks.map(({ task, order }) => {
                                                                const isSelectedOrder = String(order.id) === String(selectedOrderId);
                                                                const isSaving = savingTaskId === task.id;

                                                                return (
                                                                    <div
                                                                        key={task.id}
                                                                        draggable={isSelectedOrder}
                                                                        onDragStart={e => handleDragStart(e, task.id, order.id)}
                                                                        className={`p-2 rounded-lg border text-[10px] transition-all flex flex-col gap-1 ${
                                                                            isSelectedOrder
                                                                                ? 'bg-purple-950/40 border-purple-500 text-white shadow-[0_0_12px_rgba(167,139,250,0.15)] opacity-100 cursor-grab active:cursor-grabbing font-semibold'
                                                                                : 'bg-neutral-950/20 border-white/5 text-neutral-400 opacity-35'
                                                                        }`}
                                                                        title={`${order.code} - ${task.name}`}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-1">
                                                                            <span className="font-extrabold truncate">{order.code}</span>
                                                                            <div className="flex items-center gap-1">
                                                                                {isSaving && (
                                                                                    <FiRefreshCw className="w-2.5 h-2.5 animate-spin text-purple-400" />
                                                                                )}
                                                                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColorDot(task.status)}`} />
                                                                            </div>
                                                                        </div>
                                                                        <div className="truncate font-medium">{task.name}</div>
                                                                        {task.estimated_minutes && (
                                                                            <div className="text-[9px] text-neutral-500 font-bold flex items-center gap-0.5 mt-0.5">
                                                                                <FiClock className="w-2.5 h-2.5" />
                                                                                {task.estimated_minutes}m
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}

                                    {/* Special Manual/Finishing Operations Row (if hasManualTasks is true) */}
                                    {hasManualTasks && (
                                        <tr className="border-b border-white/5 last:border-0">
                                            {/* Manual Header */}
                                            <td className="py-4 pr-3 align-top">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-neutral-900 border border-white/5 rounded-lg text-neutral-400">
                                                        <FiInfo className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-white">Manual / Finishing</div>
                                                        <div className="text-[9px] text-neutral-500 font-semibold uppercase tracking-wider">
                                                            Operations
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Cells */}
                                            {weekDates.map(date => {
                                                const dateStr = formatDateToYYYYMMDD(date);
                                                const cellTasks = getScheduledTasks('manual', dateStr);
                                                const isOver = dragOverCell === `manual-${dateStr}`;

                                                return (
                                                    <td
                                                        key={dateStr}
                                                        onDragOver={e => handleDragOver(e, 'manual', dateStr)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={e => handleDrop(e, 'manual', dateStr)}
                                                        className={`p-2.5 align-top border-l border-white/5 transition-all min-h-[100px] ${
                                                            isOver ? 'bg-purple-500/10 border-dashed border-purple-500/30' : 'bg-transparent'
                                                        }`}
                                                        style={{ height: 110 }}
                                                    >
                                                        <div className="flex flex-col gap-1.5 h-full overflow-y-auto pr-0.5">
                                                            {cellTasks.map(({ task, order }) => {
                                                                const isSelectedOrder = String(order.id) === String(selectedOrderId);
                                                                const isSaving = savingTaskId === task.id;

                                                                return (
                                                                    <div
                                                                        key={task.id}
                                                                        draggable={isSelectedOrder}
                                                                        onDragStart={e => handleDragStart(e, task.id, order.id)}
                                                                        className={`p-2 rounded-lg border text-[10px] transition-all flex flex-col gap-1 ${
                                                                            isSelectedOrder
                                                                                ? 'bg-purple-950/40 border-purple-500 text-white shadow-[0_0_12px_rgba(167,139,250,0.15)] opacity-100 cursor-grab active:cursor-grabbing font-semibold'
                                                                                : 'bg-neutral-950/20 border-white/5 text-neutral-400 opacity-35'
                                                                        }`}
                                                                        title={`${order.code} - ${task.name}`}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-1">
                                                                            <span className="font-extrabold truncate">{order.code}</span>
                                                                            <div className="flex items-center gap-1">
                                                                                {isSaving && (
                                                                                    <FiRefreshCw className="w-2.5 h-2.5 animate-spin text-purple-400" />
                                                                                )}
                                                                                <span className={`w-1.5 h-1.5 rounded-full ${getStatusColorDot(task.status)}`} />
                                                                            </div>
                                                                        </div>
                                                                        <div className="truncate font-medium">{task.name}</div>
                                                                        {task.estimated_minutes && (
                                                                            <div className="text-[9px] text-neutral-500 font-bold flex items-center gap-0.5 mt-0.5">
                                                                                <FiClock className="w-2.5 h-2.5" />
                                                                                {task.estimated_minutes}m
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
