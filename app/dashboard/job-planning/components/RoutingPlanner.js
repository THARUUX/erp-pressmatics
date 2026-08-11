'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    FiSearch, FiFilter, FiChevronDown, FiChevronUp, FiCpu,
    FiCalendar, FiCheck, FiX, FiEdit, FiTrash, FiArrowUp,
    FiArrowDown, FiPlusCircle, FiList, FiAlertCircle, FiRefreshCw, FiClock
} from 'react-icons/fi';
import AddTaskModal from './AddTaskModal';
import EstimatedTimeInput, { evaluateTimeExpression } from '@/app/components/EstimatedTimeInput';

const G = {
    bg: '#000000',
    glass: 'rgba(255,255,255,0.03)',
    glassHov: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.06)',
    borderHov: 'rgba(255,255,255,0.12)',
    text: '#f1f5f9',
    muted: '#a3a3a3',
    subtle: '#525252',
    dim: '#171717',
};

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

// Light Edit Task Modal Component
function EditTaskModal({ task, order, onClose, onSave }) {
    const [name, setName] = useState(task.name || '');
    const [description, setDescription] = useState(task.description || '');
    const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimated_minutes || '');
    const [quantity, setQuantity] = useState(task.quantity || '');
    const [status, setStatus] = useState(task.status || 'pending');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const evalMins = evaluateTimeExpression(estimatedMinutes);
            const finalEstMins = evalMins !== null ? evalMins : (estimatedMinutes ? parseInt(estimatedMinutes) : null);
            await onSave(order.id, task.id, {
                name: name.trim(),
                description: description.trim() || null,
                estimated_minutes: finalEstMins,
                quantity: quantity ? parseFloat(quantity) : null,
                status
            });
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-neutral-950 border border-white/10 rounded-2xl w-full max-w-md shadow-[0_32px_96px_rgba(0,0,0,0.9)] flex flex-col text-neutral-100 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                            <FiEdit className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-extrabold text-white tracking-tight m-0">Edit Task</h2>
                            <p className="text-xs text-neutral-400 m-0 mt-0.5 font-medium">Update parameters for SO #{order.code}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all cursor-pointer">
                        <FiX className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Task Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Description / Spec Notes</label>
                        <textarea
                            rows={2}
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Quantity</label>
                        <input
                            type="number"
                            min="0"
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                        />
                    </div>
                    <div>
                        <EstimatedTimeInput
                            value={estimatedMinutes}
                            onChange={setEstimatedMinutes}
                            label="Estimated Time"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Task Status</label>
                        <select
                            className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 [color-scheme:dark]"
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                        >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="paused">Paused</option>
                            <option value="done">Completed</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t border-white/10">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-300 text-xs font-semibold rounded-xl transition-all cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" disabled={submitting} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-purple-900/30 cursor-pointer disabled:opacity-50">
                            <FiCheck className="w-4 h-4" />
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function RoutingPlanner({ machines = [], finishings = [], orders = [], onRefresh }) {
    const [localOrders, setLocalOrders] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCompleted, setShowCompleted] = useState(false);
    const [expandedOrders, setExpandedOrders] = useState({});
    
    // Saving indicators for tasks & orders
    const [savingTasks, setSavingTasks] = useState({});
    const [generatingTasks, setGeneratingTasks] = useState({});

    // Modal states
    const [editingTask, setEditingTask] = useState(null);
    const [addingTaskOrder, setAddingTaskOrder] = useState(null);

    useEffect(() => {
        setLocalOrders(orders);
        // Expand active orders by default
        if (orders.length > 0) {
            const initialExpanded = {};
            orders.forEach(o => {
                const isCompletedOrCancelled = ['delivered', 'cancelled', 'completed'].includes(String(o.status || '').toLowerCase());
                if (!isCompletedOrCancelled) {
                    initialExpanded[o.id] = true;
                }
            });
            setExpandedOrders(initialExpanded);
        }
    }, [orders]);

    // Handle updates to specific task fields (e.g. date, machine, status)
    const handleUpdateTaskField = async (orderId, taskId, fields) => {
        // Optimistically update local state
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

        setSavingTasks(prev => ({ ...prev, [taskId]: true }));
        try {
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields)
            });
            if (!res.ok) throw new Error('Failed to update task');
            if (onRefresh) await onRefresh();
        } catch (e) {
            console.error('Task update error:', e);
            // Revert state on error
            setLocalOrders(orders);
        } finally {
            setSavingTasks(prev => ({ ...prev, [taskId]: false }));
        }
    };

    // Handle reordering of tasks in sequence
    const handleMoveTask = async (orderId, taskId, direction) => {
        const order = localOrders.find(o => o.id === orderId);
        if (!order) return;
        const tasks = [...(order.tasks || [])];
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx === -1) return;

        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= tasks.length) return;

        // Swap the elements
        const temp = tasks[idx];
        tasks[idx] = tasks[newIdx];
        tasks[newIdx] = temp;

        // Reset display order locally based on index
        const updatedTasks = tasks.map((t, index) => ({
            ...t,
            display_order: index
        }));

        setLocalOrders(prev => prev.map(o => {
            if (o.id === orderId) {
                return { ...o, tasks: updatedTasks };
            }
            return o;
        }));

        try {
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: updatedTasks.map(t => t.id) })
            });
            if (!res.ok) throw new Error('Failed to save task order');
            if (onRefresh) await onRefresh();
        } catch (e) {
            console.error('Reorder tasks error:', e);
            // Revert
            setLocalOrders(orders);
        }
    };

    // Delete task handler
    const handleDeleteTask = async (orderId, taskId) => {
        if (!confirm('Are you sure you want to delete this task from the routing?')) return;

        setLocalOrders(prev => prev.map(order => {
            if (order.id === orderId) {
                return {
                    ...order,
                    tasks: (order.tasks || []).filter(t => t.id !== taskId)
                };
            }
            return order;
        }));

        try {
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${taskId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to delete task');
            if (onRefresh) await onRefresh();
        } catch (e) {
            console.error('Delete task error:', e);
            setLocalOrders(orders);
        }
    };

    // Auto-generate / Regenerate default routing tasks
    const handleAutoGenerateTasks = async (orderId) => {
        const order = localOrders.find(o => o.id === orderId);
        const hasTasks = (order?.tasks || []).length > 0;
        if (hasTasks) {
            if (!confirm(`Are you sure you want to regenerate tasks for ${order?.code || 'this sales order'}? Existing task sequence and statuses will be reset according to current task configurations.`)) return;
        }
        setGeneratingTasks(prev => ({ ...prev, [orderId]: true }));
        try {
            const res = await fetch(`/api/sales-orders/${orderId}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generateDefaults: true })
            });
            if (!res.ok) throw new Error('Failed to generate defaults');
            if (onRefresh) await onRefresh();
        } catch (e) {
            console.error('Auto-generate error:', e);
            alert('Failed to regenerate default routing tasks: ' + e.message);
        } finally {
            setGeneratingTasks(prev => ({ ...prev, [orderId]: false }));
        }
    };

    // Toggle expand/collapse of individual order card
    const toggleExpand = (orderId) => {
        setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
    };

    // Toggle all order cards
    const handleExpandAll = () => {
        const allExpanded = {};
        filteredOrders.forEach(o => { allExpanded[o.id] = true; });
        setExpandedOrders(allExpanded);
    };

    const handleCollapseAll = () => {
        setExpandedOrders({});
    };

    // Machine selection change
    const handleMachineChange = (orderId, taskId, val) => {
        if (val === '') {
            handleUpdateTaskField(orderId, taskId, { machine_id: null, machine_name: null });
        } else {
            const selectedMac = machines.find(m => String(m.id) === String(val));
            if (selectedMac) {
                handleUpdateTaskField(orderId, taskId, {
                    machine_id: selectedMac.id,
                    machine_name: selectedMac.name
                });
            }
        }
    };

    // Filter logic
    const filteredOrders = localOrders.filter(order => {
        const orderCode = (order.code || '').toLowerCase();
        const estNames = (order.estimation_names || '').toLowerCase();
        const custName = (order.customer_name || '').toLowerCase();
        const q = searchQuery.toLowerCase().trim();

        // 1. Text filter match
        const matchesQuery = orderCode.includes(q) || estNames.includes(q) || custName.includes(q);
        if (!matchesQuery) return false;

        // 2. Status match
        const orderStatus = String(order.status || '').toLowerCase();
        const isCompleted = ['delivered', 'cancelled', 'completed', 'ready'].includes(orderStatus);
        
        // Hide completed if toggled
        if (isCompleted && !showCompleted) return false;

        if (statusFilter !== 'all') {
            if (statusFilter === 'in_production' && orderStatus !== 'in production') return false;
            if (statusFilter === 'pending' && orderStatus !== 'pending') return false;
            if (statusFilter === 'completed' && !isCompleted) return false;
        }

        return true;
    });

    const getStatusColor = (status) => {
        const s = String(status || '').toLowerCase();
        if (['delivered', 'completed', 'done', 'ready'].includes(s)) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (['in progress', 'in_progress', 'started'].includes(s)) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        if (s === 'paused') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return 'bg-neutral-800 text-neutral-400 border-white/10';
    };

    const getDeliveryAlert = (dateStr) => {
        if (!dateStr) return { text: 'No delivery date', style: 'text-neutral-400' };
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return { text: dateStr, style: 'text-neutral-400' };
        
        const today = new Date();
        today.setHours(0,0,0,0);
        const target = new Date(d);
        target.setHours(0,0,0,0);

        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { text: `Overdue (${Math.abs(diffDays)}d ago)`, style: 'text-rose-400 font-extrabold' };
        } else if (diffDays === 0) {
            return { text: 'Delivering today', style: 'text-amber-400 font-extrabold animate-pulse' };
        } else if (diffDays <= 3) {
            return { text: `Due in ${diffDays} days`, style: 'text-amber-400 font-semibold' };
        }
        return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), style: 'text-neutral-300' };
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Toolbar Panel */}
            <div className="flex flex-wrap justify-between items-center bg-white/[0.02] border border-white/10 rounded-2xl p-4 gap-4">
                {/* Search / Filter input */}
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search jobs by code, customer name, products..."
                            className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 focus:ring-0 placeholder:text-neutral-500"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs cursor-pointer">
                                Clear
                            </button>
                        )}
                    </div>
                    <select
                        className="bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 [color-scheme:dark] cursor-pointer"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Jobs</option>
                        <option value="in_production">In Production</option>
                        <option value="pending">Pending Jobs</option>
                        <option value="completed">Completed / Ready</option>
                    </select>
                </div>

                {/* Collapsible status & controls */}
                <div className="flex items-center gap-4.5 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            className="rounded border-white/10 bg-neutral-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            checked={showCompleted}
                            onChange={e => setShowCompleted(e.target.checked)}
                        />
                        <span className="text-xs text-neutral-300 font-semibold">Show Completed Jobs</span>
                    </label>

                    <div className="h-5 w-[1px] bg-white/10" />

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExpandAll}
                            className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-neutral-300 text-xs font-semibold transition-all cursor-pointer"
                        >
                            Expand All
                        </button>
                        <button
                            onClick={handleCollapseAll}
                            className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-neutral-300 text-xs font-semibold transition-all cursor-pointer"
                        >
                            Collapse All
                        </button>
                    </div>
                </div>
            </div>

            {/* Sales Orders List */}
            <div className="flex flex-col gap-4">
                {filteredOrders.length === 0 ? (
                    <div className="text-center py-16 bg-white/[0.01] border border-white/5 rounded-2xl">
                        <FiList className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                        <h4 className="text-sm font-bold text-neutral-300 m-0">No Sales Orders Found</h4>
                        <p className="text-xs text-neutral-500 m-0 mt-1 max-w-md mx-auto">Try adjusting your filters or searching for different keywords.</p>
                    </div>
                ) : (
                    filteredOrders.map(order => {
                        const isExpanded = !!expandedOrders[order.id];
                        const orderTasks = order.tasks || [];
                        const scheduledCount = orderTasks.filter(t => t.scheduled_date !== null).length;
                        const progressPercent = orderTasks.length > 0 ? Math.round((scheduledCount / orderTasks.length) * 100) : 0;
                        const isGenerating = !!generatingTasks[order.id];

                        return (
                            <div
                                key={order.id}
                                className={`bg-neutral-950/40 border rounded-2xl transition-all overflow-hidden ${
                                    isExpanded ? 'border-white/10 shadow-lg shadow-black' : 'border-white/5 hover:border-white/10'
                                }`}
                            >
                                {/* Accordion Header Card */}
                                <div
                                    onClick={() => toggleExpand(order.id)}
                                    className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-white/[0.01] transition-all cursor-pointer select-none"
                                >
                                    <div className="flex items-center gap-3 min-w-[240px] flex-1">
                                        <div className={`p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex-shrink-0`}>
                                            <FiList className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Link
                                                    href={`/dashboard/sales-orders/${order.id}`}
                                                    onClick={e => e.stopPropagation()}
                                                    className="text-xs font-black text-white hover:text-purple-400 hover:underline tracking-wider"
                                                >
                                                    {order.code}
                                                </Link>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(order.status)}`}>
                                                    {order.status || 'Pending'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-neutral-400 mt-1 font-semibold truncate">
                                                {order.customer_name} <span className="text-neutral-600">·</span> {order.estimation_names || 'General Job'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress indicator */}
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-extrabold text-neutral-300">
                                                {scheduledCount} of {orderTasks.length} Scheduled
                                            </span>
                                            <div className="w-[120px] h-1.5 bg-black border border-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Delivery Date Alert */}
                                        <div className="flex flex-col items-end gap-0.5 px-3 py-1 bg-white/[0.01] border border-white/5 rounded-xl min-w-[120px]">
                                            <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">Delivery Deadline</span>
                                            <span className={`text-xs ${getDeliveryAlert(order.delivery_date).style}`}>
                                                {getDeliveryAlert(order.delivery_date).text}
                                            </span>
                                        </div>

                                        <button className="p-1.5 text-neutral-400 hover:text-white transition-all">
                                            {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Accordion Content Tasks */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-1 border-t border-white/10 bg-black/20">
                                        {isGenerating ? (
                                            <div className="flex flex-col items-center justify-center py-12 gap-3 text-neutral-400">
                                                <FiRefreshCw className="w-6 h-6 animate-spin text-purple-500" />
                                                <span className="text-xs font-bold">Auto-generating routing tasks from estimate...</span>
                                            </div>
                                        ) : orderTasks.length === 0 ? (
                                            <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center bg-black/20">
                                                <FiAlertCircle className="w-8 h-8 text-neutral-500 mb-2" />
                                                <h5 className="text-xs font-bold text-neutral-300 m-0">No Routing Tasks Configured</h5>
                                                <p className="text-[10px] text-neutral-500 m-0 mt-0.5 max-w-sm">No tasks have been set up for this job yet. You can auto-generate them or add them manually.</p>
                                                
                                                <div className="flex items-center gap-3 mt-4">
                                                    <button
                                                        onClick={() => handleAutoGenerateTasks(order.id)}
                                                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-900/30 cursor-pointer"
                                                    >
                                                        Auto-Generate from Estimate
                                                    </button>
                                                    <button
                                                        onClick={() => setAddingTaskOrder(order)}
                                                        className="px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                                                    >
                                                        Add Manual Task
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                        <tr className="border-b border-white/5 text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest">
                                                            <th className="py-2.5 px-2 w-[8%] text-center">Seq</th>
                                                            <th className="py-2.5 px-3 w-[27%]">Task & Spec Details</th>
                                                            <th className="py-2.5 px-3 w-[12%]">Status</th>
                                                            <th className="py-2.5 px-3 w-[18%]">Scheduled Date</th>
                                                            <th className="py-2.5 px-3 w-[20%]">Assigned Machine / Op</th>
                                                            <th className="py-2.5 px-2 w-[7%] text-right pr-4">Est Time</th>
                                                            <th className="py-2.5 px-3 w-[8%] text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {orderTasks.map((task, index) => {
                                                            const isSaving = !!savingTasks[task.id];
                                                            return (
                                                                <tr key={task.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-all group">
                                                                    {/* Sequence Index & Reordering arrows */}
                                                                    <td className="py-2.5 px-2 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                            <span className="font-mono text-neutral-500 text-[10px] font-bold">#{index + 1}</span>
                                                                            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button
                                                                                    disabled={index === 0}
                                                                                    onClick={() => handleMoveTask(order.id, task.id, 'up')}
                                                                                    className={`p-0.5 text-neutral-400 hover:text-white disabled:opacity-20 cursor-pointer`}
                                                                                    title="Move task up"
                                                                                >
                                                                                    <FiArrowUp className="w-3 h-3" />
                                                                                </button>
                                                                                <button
                                                                                    disabled={index === orderTasks.length - 1}
                                                                                    onClick={() => handleMoveTask(order.id, task.id, 'down')}
                                                                                    className={`p-0.5 text-neutral-400 hover:text-white disabled:opacity-20 cursor-pointer`}
                                                                                    title="Move task down"
                                                                                >
                                                                                    <FiArrowDown className="w-3 h-3" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </td>

                                                                    {/* Task Name & Description */}
                                                                    <td className="py-2.5 px-3 font-semibold text-white">
                                                                        <div className="truncate max-w-[280px]" title={task.name}>
                                                                            {task.name}
                                                                        </div>
                                                                        {task.description && (
                                                                            <div className="text-[10px] text-neutral-500 font-medium truncate max-w-[280px]" title={task.description}>
                                                                                {task.description}
                                                                            </div>
                                                                        )}
                                                                    </td>

                                                                    {/* Task Status */}
                                                                    <td className="py-2.5 px-3">
                                                                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(task.status)}`}>
                                                                            <span className={`w-1 h-1 rounded-full ${
                                                                                task.status === 'done' ? 'bg-emerald-400' :
                                                                                task.status === 'in_progress' ? 'bg-purple-400' :
                                                                                task.status === 'paused' ? 'bg-amber-400' : 'bg-neutral-500'
                                                                            }`} />
                                                                            {task.status || 'Pending'}
                                                                        </span>
                                                                    </td>

                                                                    {/* Scheduled Date picker */}
                                                                    <td className="py-2.5 px-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <input
                                                                                type="date"
                                                                                className={`bg-neutral-900 border text-[11px] rounded-lg px-2 py-1 text-neutral-200 outline-none focus:border-purple-500 [color-scheme:dark] cursor-pointer transition-all ${
                                                                                    task.scheduled_date ? 'border-purple-500/30' : 'border-white/10'
                                                                                }`}
                                                                                value={formatDateToYYYYMMDD(task.scheduled_date)}
                                                                                onChange={e => handleUpdateTaskField(order.id, task.id, {
                                                                                    scheduled_date: e.target.value || null
                                                                                })}
                                                                            />
                                                                            {isSaving && (
                                                                                <FiRefreshCw className="w-3 h-3 text-purple-400 animate-spin flex-shrink-0" />
                                                                            )}
                                                                        </div>
                                                                    </td>

                                                                    {/* Assigned Machine select */}
                                                                    <td className="py-2.5 px-3">
                                                                        <select
                                                                            className={`w-full bg-neutral-900 border text-[11px] rounded-lg px-2 py-1 text-neutral-200 outline-none focus:border-purple-500 [color-scheme:dark] cursor-pointer transition-all ${
                                                                                task.machine_id ? 'border-purple-500/30' : 'border-white/10'
                                                                            }`}
                                                                            value={task.machine_id || ''}
                                                                            onChange={e => handleMachineChange(order.id, task.id, e.target.value)}
                                                                        >
                                                                            <option value="">Unassigned / Manual Queue</option>
                                                                            
                                                                            {/* Prepress Group */}
                                                                            <optgroup label="Prepress Machines">
                                                                                {machines.filter(m => m.type === 'prepress').map(m => (
                                                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                                                ))}
                                                                            </optgroup>

                                                                            {/* Offset Printing Group */}
                                                                            <optgroup label="Offset Press Machines">
                                                                                {machines.filter(m => m.type === 'offset').map(m => (
                                                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                                                ))}
                                                                            </optgroup>

                                                                            {/* Digital Press Group */}
                                                                            <optgroup label="Digital Press Machines">
                                                                                {machines.filter(m => m.type === 'digital').map(m => (
                                                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                                                ))}
                                                                            </optgroup>

                                                                            {/* Finishing Machines Group */}
                                                                            <optgroup label="Finishing / Processing Machines">
                                                                                {machines.filter(m => m.type === 'finishing').map(m => (
                                                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                                                ))}
                                                                            </optgroup>

                                                                            {/* Unknown/Other machines */}
                                                                            <optgroup label="Other Machines">
                                                                                {machines.filter(m => !['offset', 'digital', 'prepress', 'finishing'].includes(m.type)).map(m => (
                                                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                                                ))}
                                                                            </optgroup>
                                                                        </select>
                                                                    </td>

                                                                    {/* Estimated time */}
                                                                    <td className="py-2.5 px-2 text-right font-semibold text-neutral-300 pr-4 font-mono">
                                                                        {task.estimated_minutes ? `${task.estimated_minutes}m` : '—'}
                                                                    </td>

                                                                    {/* Action buttons */}
                                                                    <td className="py-2.5 px-3 text-right">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            <button
                                                                                onClick={() => setEditingTask({ task, order })}
                                                                                className="p-1 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg text-neutral-400 hover:text-white transition-all cursor-pointer"
                                                                                title="Edit task parameters"
                                                                            >
                                                                                <FiEdit className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteTask(order.id, task.id)}
                                                                                className="p-1 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg text-neutral-400 hover:text-red-400 transition-all cursor-pointer"
                                                                                title="Delete task"
                                                                            >
                                                                                <FiTrash className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>

                                                {/* Card Footer Actions */}
                                                <div className="flex items-center justify-between mt-4.5 pt-3 border-t border-white/5">
                                                    <div className="text-[10px] text-neutral-500 font-semibold">
                                                        Total Production Time: <span className="text-neutral-300 font-mono font-bold">
                                                            {Math.round(orderTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0) / 60 * 10) / 10} hrs
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleAutoGenerateTasks(order.id)}
                                                            className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-neutral-300 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <FiRefreshCw className="w-3 h-3" />
                                                            Regenerate Tasks
                                                        </button>
                                                        <button
                                                            onClick={() => setAddingTaskOrder(order)}
                                                            className="px-3 py-1.5 bg-purple-600/20 border border-purple-500/20 hover:bg-purple-600/30 text-purple-300 text-[10px] font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <FiPlusCircle className="w-3 h-3" />
                                                            Add Custom Task
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Render Modal: Edit Task parameters */}
            {editingTask && (
                <EditTaskModal
                    task={editingTask.task}
                    order={editingTask.order}
                    onClose={() => setEditingTask(null)}
                    onSave={handleUpdateTaskField}
                />
            )}

            {/* Render Modal: Add Task manually */}
            {addingTaskOrder && (
                <AddTaskModal
                    orders={localOrders}
                    machines={machines}
                    initialMachineId={null}
                    initialMachineName=""
                    onClose={() => setAddingTaskOrder(null)}
                    onSuccess={() => {
                        setAddingTaskOrder(null);
                        if (onRefresh) onRefresh(true);
                    }}
                />
            )}
        </div>
    );
}
