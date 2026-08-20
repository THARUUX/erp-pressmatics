'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    FiCalendar, FiChevronLeft, FiChevronRight, FiSearch,
    FiCpu, FiClock, FiAlertCircle, FiRefreshCw, FiLayers, FiX, FiGrid,
    FiRotateCcw, FiRotateCw, FiFileText
} from 'react-icons/fi';
import Link from 'next/link';
import JobTicketModal from './JobTicketModal';

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
    const tNorm = taskName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    const fNorm = finishingName.toLowerCase().trim().replace(/gethering/g, 'gathering');
    return tNorm.startsWith(fNorm) || tNorm.includes(fNorm) || fNorm.includes(tNorm);
}

const formatTime = (mins) => {
    if (!mins) return '0m';
    if (mins >= 60) {
        const hrs = mins / 60;
        return `${Number(hrs.toFixed(1))}h`;
    }
    return `${mins}m`;
};

export default function JobWeeklyPlanner({ machines = [], finishings = [], orders = [], onRefresh }) {
    const [localOrders, setLocalOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentWeekStart, setCurrentWeekStart] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null); // format: "taskId-dateStr"
    const [savingTaskId, setSavingTaskId] = useState(null);
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [showJobTicket, setShowJobTicket] = useState(false);

    const searchParams = useSearchParams();

    // Initialize week and sync orders
    useEffect(() => {
        setLocalOrders(orders);
        if (!currentWeekStart) {
            setCurrentWeekStart(getMonday(new Date()));
        }
        
        const soParam = searchParams.get('so');
        if (soParam && orders.length > 0) {
            const matchedOrder = orders.find(o => String(o.id) === String(soParam) || String(o.code) === String(soParam));
            if (matchedOrder) {
                setSelectedOrderId(matchedOrder.id);
                return;
            }
        }

        if (orders.length > 0 && !selectedOrderId) {
            // Auto-select first active order
            const firstActive = orders.find(o => !['cancelled', 'delivered'].includes(String(o.status || '').toLowerCase()));
            if (firstActive) {
                setSelectedOrderId(firstActive.id);
            } else {
                setSelectedOrderId(orders[0].id);
            }
        }
    }, [orders, searchParams]);

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

        // Hide cancelled orders, or delivered/completed orders that have no scheduled tasks
        const status = String(order.status || '').toLowerCase();
        if (status === 'cancelled') return false;
        if (['delivered', 'completed'].includes(status)) {
            const hasScheduledTasks = (order.tasks || []).some(t => t.scheduled_date !== null);
            return hasScheduledTasks;
        }
        return true;
    });

    // Currently selected order
    const selectedOrder = localOrders.find(o => String(o.id) === String(selectedOrderId));
    const selectedOrderTasks = selectedOrder ? [...(selectedOrder.tasks || [])].sort((a, b) => a.id - b.id) : [];

    // Resolve machine or operation details for a task
    const getTaskAssignmentInfo = (task) => {
        if (task.machine_name) {
            return { name: task.machine_name, type: 'Machine' };
        }
        const fin = finishings.find(f => matchesFinishing(task.name, f.name));
        if (fin) {
            return { name: fin.name, type: 'Finishing' };
        }
        return { name: 'Unassigned', type: 'Operation' };
    };

    // Drag and drop event handlers
    const handleDragStart = (e, taskId, orderId) => {
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.setData('orderId', orderId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, taskId, dateStr) => {
        e.preventDefault();
        setDragOverCell(`${taskId}-${dateStr}`);
    };

    const handleDragLeave = () => {
        setDragOverCell(null);
    };

    const updateTaskScheduleAPI = async (orderId, taskId, dateStr) => {
        const fields = { scheduled_date: dateStr };
        const res = await fetch(`/api/sales-orders/${orderId}/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
        });
        if (!res.ok) throw new Error('Failed to update task schedule');
    };

    const updateLocalTaskScheduleState = (orderId, taskId, dateStr) => {
        setLocalOrders(prev => prev.map(order => {
            if (order.id === orderId) {
                return {
                    ...order,
                    tasks: (order.tasks || []).map(t => {
                        if (t.id === taskId) {
                            return { ...t, scheduled_date: dateStr };
                        }
                        return t;
                    })
                };
            }
            return order;
        }));
    };

    const handleUndo = useCallback(async () => {
        if (undoStack.length === 0) return;

        const action = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));

        setRedoStack(prev => [...prev, {
            orderId: action.orderId,
            taskId: action.taskId,
            from: action.to,
            to: action.from
        }]);

        setSavingTaskId(action.taskId);
        try {
            updateLocalTaskScheduleState(action.orderId, action.taskId, action.from);
            await updateTaskScheduleAPI(action.orderId, action.taskId, action.from);
            if (onRefresh) await onRefresh(true);
        } catch (err) {
            console.error(err);
            setLocalOrders(orders);
        } finally {
            setSavingTaskId(null);
        }
    }, [undoStack, orders, onRefresh]);

    const handleRedo = useCallback(async () => {
        if (redoStack.length === 0) return;

        const action = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));

        setUndoStack(prev => [...prev, {
            orderId: action.orderId,
            taskId: action.taskId,
            from: action.to,
            to: action.from
        }]);

        setSavingTaskId(action.taskId);
        try {
            updateLocalTaskScheduleState(action.orderId, action.taskId, action.from);
            await updateTaskScheduleAPI(action.orderId, action.taskId, action.from);
            if (onRefresh) await onRefresh(true);
        } catch (err) {
            console.error(err);
            setLocalOrders(orders);
        } finally {
            setSavingTaskId(null);
        }
    }, [redoStack, orders, onRefresh]);

    // Keyboard shortcut listeners for Undo / Redo
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
                e.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    const handleDrop = async (e, task, dateStr) => {
        e.preventDefault();
        setDragOverCell(null);

        const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const orderId = parseInt(e.dataTransfer.getData('orderId'), 10);
        if (isNaN(taskId) || isNaN(orderId)) return;

        // We only schedule the dragged task
        if (taskId !== task.id) return;

        const prevDate = task.scheduled_date ? formatDateToYYYYMMDD(task.scheduled_date) : null;
        if (prevDate === dateStr) return;

        setUndoStack(prev => [...prev, {
            orderId,
            taskId,
            from: prevDate,
            to: dateStr
        }]);
        setRedoStack([]);

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
            await updateTaskScheduleAPI(orderId, taskId, dateStr);
            if (onRefresh) await onRefresh(true);
        } catch (err) {
            console.error(err);
            setLocalOrders(orders);
        } finally {
            setSavingTaskId(null);
        }
    };

    const handleCellClick = async (task, dateStr) => {
        const currentScheduledDate = formatDateToYYYYMMDD(task.scheduled_date);
        if (currentScheduledDate === dateStr) return;

        const prevDate = task.scheduled_date ? formatDateToYYYYMMDD(task.scheduled_date) : null;
        setUndoStack(prev => [...prev, {
            orderId: selectedOrderId,
            taskId: task.id,
            from: prevDate,
            to: dateStr
        }]);
        setRedoStack([]);

        const fields = { scheduled_date: dateStr };

        // Optimistically update local UI state
        setLocalOrders(prev => prev.map(order => {
            if (order.id === selectedOrderId) {
                return {
                    ...order,
                    tasks: (order.tasks || []).map(t => {
                        if (t.id === task.id) {
                            return { ...t, ...fields };
                        }
                        return t;
                    })
                };
            }
            return order;
        }));

        setSavingTaskId(task.id);
        try {
            await updateTaskScheduleAPI(selectedOrderId, task.id, dateStr);
            if (onRefresh) await onRefresh(true);
        } catch (err) {
            console.error(err);
            setLocalOrders(orders);
        } finally {
            setSavingTaskId(null);
        }
    };

    const handleUnscheduleTask = async (e, task) => {
        e.stopPropagation();
        const prevDate = task.scheduled_date ? formatDateToYYYYMMDD(task.scheduled_date) : null;
        if (prevDate === null) return;

        setUndoStack(prev => [...prev, {
            orderId: selectedOrderId,
            taskId: task.id,
            from: prevDate,
            to: null
        }]);
        setRedoStack([]);

        const fields = { scheduled_date: null };

        // Optimistically update local UI state
        setLocalOrders(prev => prev.map(order => {
            if (order.id === selectedOrderId) {
                return {
                    ...order,
                    tasks: (order.tasks || []).map(t => {
                        if (t.id === task.id) {
                            return { ...t, ...fields };
                        }
                        return t;
                    })
                };
            }
            return order;
        }));

        setSavingTaskId(task.id);
        try {
            await updateTaskScheduleAPI(selectedOrderId, task.id, null);
            if (onRefresh) await onRefresh(true);
        } catch (err) {
            console.error(err);
            setLocalOrders(orders);
        } finally {
            setSavingTaskId(null);
        }
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
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 focus:ring-0"
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
                                    className={`w-full text-left p-3 rounded-xl transition-all border flex flex-col gap-1 cursor-pointer select-none ${isSelected
                                        ? 'bg-emerald-950/20 border-emerald-500/35 text-white shadow-md shadow-emerald-950/30'
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

                        {/* Undo / Redo controls */}
                        <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
                            <button
                                onClick={handleUndo}
                                disabled={undoStack.length === 0}
                                className="p-1.5 hover:bg-white/5 disabled:opacity-20 border border-white/10 rounded-lg text-neutral-300 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
                                title="Undo last change (Ctrl+Z)"
                            >
                                <FiRotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={handleRedo}
                                disabled={redoStack.length === 0}
                                className="p-1.5 hover:bg-white/5 disabled:opacity-20 border border-white/10 rounded-lg text-neutral-300 hover:text-white transition-all cursor-pointer disabled:cursor-not-allowed"
                                title="Redo change (Ctrl+Y)"
                            >
                                <FiRotateCw className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <span className="text-xs font-black tracking-wider text-white">
                        {getWeekRangeLabel()}
                    </span>

                    <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-widest flex items-center gap-1.5">
                        <FiCalendar className="w-3.5 h-3.5" /> Weekly Job Planner
                    </span>
                </div>

                {/* Selected Job Info Bar */}
                {selectedOrder && (
                    <div className="px-5 py-3 border-b border-white/10 bg-white/[0.005] flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-black tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                                {selectedOrder.code}
                            </span>
                            <div>
                                <h2 className="text-sm font-extrabold text-white m-0">
                                    {selectedOrder.estimation_names || 'General Job'}
                                </h2>
                                <p className="text-[10px] text-neutral-400 font-medium m-0 mt-0.5">
                                    Customer: {selectedOrder.customer_name}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setShowJobTicket(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all cursor-pointer"
                            >
                                <FiFileText className="w-3.5 h-3.5" />
                                Job Ticket
                            </button>

                            <Link
                                href={`/dashboard/sales-orders/${selectedOrder.id}`}
                                target="_blank"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-350 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 rounded-xl transition-all"
                            >
                                View Sales Order
                            </Link>

                            <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 bg-neutral-900/50 border border-white/10 px-3 py-1.5 rounded-xl font-mono">
                                <span>Total Tasks: {selectedOrderTasks.length}</span>
                                <span className="text-neutral-600">•</span>
                                <span className="text-emerald-400">Scheduled: {selectedOrderTasks.filter(t => t.scheduled_date !== null).length}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-auto">
                    {!selectedOrderId ? (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-2">
                            <FiCalendar className="w-12 h-12 text-neutral-600 animate-pulse" />
                            <h4 className="text-sm font-bold text-neutral-300 m-0">No Job Selected</h4>
                            <p className="text-xs text-neutral-500 m-0 mt-0.5">Please select a job from the active sidebar list to view its weekly workload.</p>
                        </div>
                    ) : selectedOrderTasks.length === 0 ? (
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
                                    <tr className="border-b border-white/10">
                                        {/* Task / Assigned Operation header */}
                                        <th className="sticky top-0 bg-black z-20 w-[32%] text-left pb-3 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                            Task / Assigned Operation
                                        </th>

                                        {/* Daily headers */}
                                        {weekDates.map(date => {
                                            const isToday = formatDateToYYYYMMDD(date) === formatDateToYYYYMMDD(new Date());
                                            return (
                                                <th
                                                    key={date.toString()}
                                                    className={`sticky top-0 bg-black z-20 pb-3 text-center text-xs font-bold ${isToday ? 'text-emerald-400 font-extrabold' : 'text-neutral-400'
                                                        }`}
                                                >
                                                    <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                                    <div className={`text-[10px] mt-0.5 font-semibold font-mono inline-block ${isToday ? 'bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20' : 'text-neutral-500'
                                                        }`}>
                                                        {date.getDate()}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedOrderTasks.map((task, index) => {
                                        const assignment = getTaskAssignmentInfo(task);
                                        return (
                                            <tr key={task.id} className="border-b border-white/10 last:border-0 hover:bg-white/[0.015]">
                                                {/* Header Column: Task Details */}
                                                <td className="py-4 pr-3 align-middle">
                                                    <div className="flex items-start gap-2.5">
                                                        {/* Drag Handle */}
                                                        <div
                                                            draggable
                                                            onDragStart={e => handleDragStart(e, task.id, selectedOrder.id)}
                                                            className="mt-1 cursor-grab active:cursor-grabbing text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded transition-all flex-shrink-0"
                                                            title="Drag to schedule this task"
                                                        >
                                                            <FiGrid className="w-3.5 h-3.5 text-neutral-400" />
                                                        </div>

                                                        {/* Task Info */}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-[9px] bg-white/10 text-neutral-300 px-1.5 py-0.5 rounded font-mono font-extrabold">
                                                                    #{index + 1}
                                                                </span>
                                                                <span className="truncate max-w-[170px]" title={task.name}>
                                                                    {task.name.includes('—') ? task.name.split('—')[1]?.trim() || task.name : task.name}
                                                                </span>
                                                            </div>

                                                            {/* Assignment Badges */}
                                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                                {assignment.type === 'Machine' ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                                        <FiCpu className="w-2.5 h-2.5" />
                                                                        {assignment.name}
                                                                    </span>
                                                                ) : assignment.type === 'Finishing' ? (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                        <FiLayers className="w-2.5 h-2.5" />
                                                                        {assignment.name}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                                                        <FiAlertCircle className="w-2.5 h-2.5" />
                                                                        Unassigned
                                                                    </span>
                                                                )}

                                                                {task.estimated_minutes && (
                                                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-neutral-500 font-mono">
                                                                        <FiClock className="w-2.5 h-2.5" />
                                                                        {formatTime(task.estimated_minutes)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Days Cells */}
                                                {weekDates.map(date => {
                                                    const dateStr = formatDateToYYYYMMDD(date);
                                                    const isScheduledOnDay = formatDateToYYYYMMDD(task.scheduled_date) === dateStr;
                                                    const isOver = dragOverCell === `${task.id}-${dateStr}`;

                                                    return (
                                                        <td
                                                            key={dateStr}
                                                            onClick={() => handleCellClick(task, dateStr)}
                                                            onDragOver={e => handleDragOver(e, task.id, dateStr)}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={e => handleDrop(e, task, dateStr)}
                                                            className={`p-2 align-middle border-l border-white/10 transition-all cursor-pointer group relative ${isOver ? 'bg-emerald-500/15 border-dashed border-emerald-500/40' : 'bg-transparent hover:bg-emerald-500/[0.04] hover:border-l-emerald-500/40'
                                                                }`}
                                                            style={{ height: 64 }}
                                                        >
                                                            {isScheduledOnDay ? (
                                                                <div
                                                                    draggable
                                                                    onDragStart={e => {
                                                                        e.stopPropagation();
                                                                        handleDragStart(e, task.id, selectedOrder.id);
                                                                    }}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className={`group/card relative p-2 rounded-xl border text-[10px] transition-all flex flex-col gap-1 cursor-grab active:cursor-grabbing hover:border-emerald-500/50 hover:shadow-[0_0_12px_rgba(16,185,129,0.15)] h-full justify-center ${['done', 'completed', 'ready', 'delivered'].includes(String(task.status).toLowerCase())
                                                                        ? 'bg-emerald-950/20 border-emerald-500/20 text-white font-semibold'
                                                                        : ['in progress', 'in_progress', 'started'].includes(String(task.status).toLowerCase())
                                                                            ? 'bg-emerald-950/20 border-emerald-500/20 text-white font-semibold'
                                                                            : 'bg-neutral-900/40 border-white/10 text-neutral-300 font-medium'
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center justify-between gap-1">
                                                                        {savingTaskId === task.id ? (
                                                                            <span className="flex items-center gap-1 text-[9px] text-neutral-400">
                                                                                <FiRefreshCw className="w-2.5 h-2.5 animate-spin text-emerald-400" />
                                                                                Updating
                                                                            </span>
                                                                        ) : (
                                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider ${['done', 'completed', 'ready', 'delivered'].includes(String(task.status).toLowerCase())
                                                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                                                : ['in progress', 'in_progress', 'started'].includes(String(task.status).toLowerCase())
                                                                                    ? 'bg-emerald-500/10 text-emerald-400'
                                                                                    : 'bg-neutral-800 text-neutral-400'
                                                                                }`}>
                                                                                <span className={`w-1 h-1 rounded-full ${['done', 'completed', 'ready', 'delivered'].includes(String(task.status).toLowerCase())
                                                                                    ? 'bg-emerald-400'
                                                                                    : ['in progress', 'in_progress', 'started'].includes(String(task.status).toLowerCase())
                                                                                        ? 'bg-emerald-400'
                                                                                        : 'bg-neutral-500'
                                                                                    }`} />
                                                                                {task.status || 'Pending'}
                                                                            </span>
                                                                        )}

                                                                        <button
                                                                            onClick={e => handleUnscheduleTask(e, task)}
                                                                            className="opacity-0 group-hover/card:opacity-100 p-0.5 hover:bg-white/10 rounded text-neutral-400 hover:text-white transition-all cursor-pointer flex-shrink-0"
                                                                            title="Unschedule task"
                                                                        >
                                                                            <FiX className="w-2.5 h-2.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="h-full flex items-center justify-center text-neutral-700 group-hover:text-emerald-500/30 transition-all">
                                                                    <span className="text-sm font-light opacity-0 group-hover:opacity-100 transition-all">+</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            {showJobTicket && (
                <JobTicketModal
                    orderId={selectedOrderId}
                    onClose={() => setShowJobTicket(false)}
                />
            )}
        </div>
    );
}
