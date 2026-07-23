'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    FiCalendar, FiChevronLeft, FiChevronRight, FiSearch,
    FiCpu, FiClock, FiAlertCircle, FiRefreshCw, FiLayers, FiX
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

// Utility to match a task name to a finishing operation name
function matchesFinishing(taskName, finishingName) {
    if (!taskName || !finishingName) return false;
    return taskName.toLowerCase().startsWith(finishingName.toLowerCase());
}

export default function JobWeeklyPlanner({ machines = [], finishings = [], orders = [], onRefresh }) {
    const [localOrders, setLocalOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentWeekStart, setCurrentWeekStart] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null); // format: "rowKey-dateStr"
    const [savingTaskId, setSavingTaskId] = useState(null);

    // Modal state for viewing a cell's daily planner
    const [activeCellModal, setActiveCellModal] = useState(null); // { row, dateStr }

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

    // Find and sort rows sequentially based on the selected order's tasks sequence
    const rows = [];
    if (selectedOrder) {
        selectedOrderTasks.forEach(task => {
            if (task.machine_id) {
                const mac = machines.find(m => m.id === task.machine_id);
                if (mac) {
                    const rowKey = `mac_${mac.id}`;
                    if (!rows.some(r => r.rowKey === rowKey)) {
                        rows.push({ ...mac, rowType: 'machine', rowKey });
                    }
                }
            } else {
                const fin = finishings.find(f => matchesFinishing(task.name, f.name));
                if (fin) {
                    const rowKey = `fin_${fin.id}`;
                    if (!rows.some(r => r.rowKey === rowKey)) {
                        rows.push({ ...fin, rowType: 'finishing', rowKey });
                    }
                }
            }
        });
    }

    // Drag and drop event handlers
    const handleDragStart = (e, taskId, orderId) => {
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.setData('orderId', orderId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, rowKey, dateStr) => {
        e.preventDefault();
        setDragOverCell(`${rowKey}-${dateStr}`);
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const handleDrop = async (e, row, dateStr) => {
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
        if (row.rowType === 'machine') {
            fields.machine_id = row.id;
            fields.machine_name = row.name;
        } else {
            // Drop on finishing resets machine assignments
            fields.machine_id = null;
            fields.machine_name = null;
        }

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
            if (!res.ok) throw new Error('Failed to update task schedule');
            if (onRefresh) await onRefresh(true); // pass true for background silent reload!
        } catch (err) {
            console.error(err);
            // Revert on failure
            setLocalOrders(orders);
        } finally {
            setSavingTaskId(null);
        }
    };

    // Get all tasks scheduled on a row and day
    const getScheduledTasks = (row, dateStr) => {
        if (!row) return [];
        const list = [];
        localOrders.forEach(order => {
            (order.tasks || []).forEach(task => {
                const taskDate = formatDateToYYYYMMDD(task.scheduled_date);
                if (taskDate === dateStr) {
                    if (row.rowType === 'machine') {
                        if (task.machine_id === row.id) {
                            list.push({ task, order });
                        }
                    } else if (row.rowType === 'finishing') {
                        if (task.machine_id === null && matchesFinishing(task.name, row.name)) {
                            list.push({ task, order });
                        }
                    }
                }
            });
        });
        return list;
    };

    const getStatusColor = (status) => {
        const s = String(status || '').toLowerCase();
        if (['done', 'completed', 'ready', 'delivered'].includes(s)) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (['in progress', 'in_progress', 'started'].includes(s)) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        if (s === 'paused') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return 'bg-neutral-800 text-neutral-400 border-white/5';
    };

    const getStatusColorDot = (status) => {
        const s = String(status || '').toLowerCase();
        if (['done', 'completed', 'ready', 'delivered'].includes(s)) return 'bg-emerald-400';
        if (['in progress', 'in_progress', 'started'].includes(s)) return 'bg-purple-400';
        if (s === 'paused') return 'bg-amber-400';
        return 'bg-neutral-500';
    };

    // Modal tasks list for active cell
    const modalTasks = activeCellModal ? getScheduledTasks(activeCellModal.row, activeCellModal.dateStr) : [];

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
                    ) : rows.length === 0 ? (
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
                                    {rows.map(row => (
                                        <tr key={row.rowKey} className="border-b border-white/5 last:border-0">
                                            {/* Header Column */}
                                            <td className="py-4 pr-3 align-top">
                                                {row.rowType === 'machine' ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-neutral-900 border border-white/5 rounded-lg text-neutral-400">
                                                            <FiCpu className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-white truncate" title={row.name}>
                                                                {row.name}
                                                            </div>
                                                            <div className="text-[9px] text-neutral-500 font-semibold uppercase tracking-wider">
                                                                {row.type || 'machine'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-neutral-900 border border-white/5 rounded-lg text-neutral-400">
                                                            <FiLayers className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-bold text-white truncate" title={row.name}>
                                                                {row.name}
                                                            </div>
                                                            <div className="text-[9px] text-neutral-500 font-semibold uppercase tracking-wider">
                                                                Finishing
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Days Cells */}
                                            {weekDates.map(date => {
                                                const dateStr = formatDateToYYYYMMDD(date);
                                                const cellTasks = getScheduledTasks(row, dateStr);
                                                const isOver = dragOverCell === `${row.rowKey}-${dateStr}`;

                                                return (
                                                    <td
                                                        key={dateStr}
                                                        onClick={() => setActiveCellModal({ row, dateStr })}
                                                        onDragEnter={(e) => {
                                                            e.preventDefault();
                                                            // Hover drag-in triggers opening cell modal
                                                            setActiveCellModal({ row, dateStr });
                                                        }}
                                                        onDragOver={e => handleDragOver(e, row.rowKey, dateStr)}
                                                        onDragLeave={handleDragLeave}
                                                        onDrop={e => handleDrop(e, row, dateStr)}
                                                        className={`p-2.5 align-top border-l border-white/5 transition-all min-h-[100px] cursor-pointer hover:bg-white/[0.01] ${
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
                                                                        onDragStart={e => {
                                                                            e.stopPropagation();
                                                                            handleDragStart(e, task.id, order.id);
                                                                        }}
                                                                        onClick={e => e.stopPropagation()} // Stop click propagating to cell click
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
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Daily Planner Modal */}
            {activeCellModal && (
                <div 
                    className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                    onDragEnter={() => {
                        // Drag out onto backdrop closes modal
                        setActiveCellModal(null);
                    }}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => setActiveCellModal(null)}
                >
                    <div 
                        className="bg-neutral-950 border border-white/10 rounded-2xl w-full max-w-lg shadow-[0_32px_96px_rgba(0,0,0,0.9)] flex flex-col text-neutral-100 overflow-hidden" 
                        onClick={e => e.stopPropagation()}
                        onDragEnter={e => {
                            // Prevent event bubbling to backdrop closing trigger
                            e.stopPropagation();
                        }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => handleDrop(e, activeCellModal.row, activeCellModal.dateStr)}
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                                    {activeCellModal.row.rowType === 'machine' ? <FiCpu className="w-5 h-5" /> : <FiLayers className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h2 className="text-base font-extrabold text-white tracking-tight m-0">
                                        {activeCellModal.row.name}
                                    </h2>
                                    <p className="text-xs text-neutral-400 m-0 mt-0.5 font-medium">
                                        Daily Planner — {new Date(activeCellModal.dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setActiveCellModal(null)} 
                                className="p-1.5 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all cursor-pointer"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 max-h-[400px] overflow-y-auto flex flex-col gap-3">
                            {modalTasks.length === 0 ? (
                                <div className="text-center py-10 flex flex-col items-center justify-center text-neutral-500 gap-2">
                                    <FiAlertCircle className="w-8 h-8 text-neutral-600" />
                                    <span className="text-xs font-bold">No tasks scheduled for this day</span>
                                </div>
                            ) : (
                                modalTasks.map(({ task, order }) => {
                                    const isSelectedOrder = String(order.id) === String(selectedOrderId);
                                    
                                    return (
                                        <div
                                            key={task.id}
                                            draggable={isSelectedOrder}
                                            onDragStart={e => {
                                                handleDragStart(e, task.id, order.id);
                                                // Close modal instantly on dragstart so user can see and drop onto the grid
                                                setActiveCellModal(null);
                                            }}
                                            className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
                                                isSelectedOrder
                                                    ? 'bg-purple-950/30 border-purple-500/40 text-white shadow-lg cursor-grab active:cursor-grabbing'
                                                    : 'bg-neutral-900/30 border-white/5 text-neutral-400 opacity-40'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Link 
                                                        href={`/dashboard/sales-orders/${order.id}`}
                                                        className={`text-xs font-extrabold tracking-wider ${isSelectedOrder ? 'text-white hover:text-purple-400 hover:underline' : 'text-neutral-400'}`}
                                                    >
                                                        {order.code}
                                                    </Link>
                                                    <span className="text-neutral-600 text-[10px]">•</span>
                                                    <span className="text-[10px] font-bold truncate max-w-[150px]">{order.customer_name}</span>
                                                </div>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(task.status)}`}>
                                                    {task.status || 'Pending'}
                                                </span>
                                            </div>

                                            <div>
                                                <div className="text-xs font-bold text-white">{task.name}</div>
                                                {task.description && (
                                                    <p className="text-[10px] text-neutral-500 m-0 mt-0.5 font-medium">{task.description}</p>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                                                <span className="text-[9px] text-neutral-500 font-semibold truncate max-w-[200px]">
                                                    {order.estimation_names || 'General Job'}
                                                </span>
                                                {task.estimated_minutes && (
                                                    <span className="text-[9px] text-neutral-400 font-bold font-mono flex items-center gap-1">
                                                        <FiClock className="w-3 h-3 text-neutral-500" />
                                                        {task.estimated_minutes} min
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
