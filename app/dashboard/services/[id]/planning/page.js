'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
    FiArrowLeft, FiClock, FiUsers, FiDollarSign, FiLayers, FiActivity,
    FiInfo, FiUser, FiCalendar, FiCheckCircle, FiTrendingUp, FiList, FiX,
    FiChevronLeft, FiChevronRight, FiMaximize2, FiBriefcase
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const G = {
    glass: 'rgba(255, 255, 255, 0.03)',
    glassHov: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHov: 'rgba(255, 255, 255, 0.15)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
};

const STATUS_CFG = {
    'pending': { label: 'Pending', accent: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    'in_progress': { label: 'In Progress', accent: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    'done': { label: 'Completed', accent: '#10b981', bg: 'rgba(16,185,129,0.1)' }
};

function parseDescription(desc) {
    if (!desc) return {};
    const parts = desc.split(' · ');
    const res = {};
    for (const p of parts) {
        if (p.startsWith('Unit:')) res.unit = p.replace('Unit:', '').trim();
        else if (p.startsWith('Rate:')) res.rate = parseFloat(p.replace('Rate:', '').trim());
        else if (p.startsWith('Mult:')) res.multiply_by = parseFloat(p.replace('Mult:', '').trim());
        else if (p.startsWith('Note:')) res.note = p.replace('Note:', '').trim();
    }
    if (res.rate !== undefined && res.multiply_by !== undefined) {
        res.total_cost = res.rate * res.multiply_by;
    }
    return res;
}

function extractServiceName(name) {
    const match = name.match(/^Service:\s*(.*?)\s*—\s*(.*)$/);
    return match ? match[1] : name.replace(/^Service:\s*/, '');
}

function extractJobName(name) {
    if (!name) return '';
    const match = name.match(/^Service:\s*(.*?)\s*—\s*(.*)$/);
    return match ? match[2] : name.replace(/^Service:\s*/, '');
}

function formatDuration(startedAt, completedAt) {
    if (!startedAt || !completedAt) return '—';
    const diffMs = new Date(completedAt) - new Date(startedAt);
    if (diffMs < 0) return '—';
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function StatPill({ label, value, accent, icon: Icon }) {
    return (
        <div className="flex-1 min-w-[200px] flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl backdrop-blur-xl">
            <div>
                <span className="text-xs text-white/40 uppercase tracking-wider block font-semibold">{label}</span>
                <span className="text-2xl font-bold font-mono tracking-tight mt-1.5 block" style={{ color: accent }}>{value}</span>
            </div>
            {Icon && (
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/[0.04] border border-white/[0.08]" style={{ color: accent }}>
                    <Icon className="w-5 h-5" />
                </div>
            )}
        </div>
    );
}

function DraggableTaskCard({ task, isDragging, onStatusChange, onViewNote }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(task.id) });
    const serviceName = extractServiceName(task.name);
    const details = parseDescription(task.description);

    const style = {
        transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/15 rounded-xl p-4 transition-colors active:cursor-grabbing group select-none flex flex-col justify-between"
        >
            <div>
                <div className="flex justify-between items-start gap-4 mb-1">
                    <div className="min-w-0 flex-1">
                        <span className="font-mono text-[9px] font-bold text-white/30 uppercase tracking-wider">
                            SO #{task.order_code || task.sales_order_id}
                        </span>
                        <h4 className="text-xs font-bold text-white truncate mt-0.5" title={extractJobName(task.name)}>
                            {extractJobName(task.name)}
                        </h4>
                    </div>
                </div>

                <p className="text-[11px] text-white/50 truncate mb-2.5">
                    {task.customer_name}
                </p>

                {/* Price details */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/40 bg-white/[0.01] border border-white/[0.03] rounded-lg p-2 mb-2.5">
                    {details.unit && <div>Unit: <span className="text-white/60">{details.unit}</span></div>}
                    {details.rate !== undefined && <div>Rate: <span className="text-white/60">{details.rate.toLocaleString()}</span></div>}
                    {details.multiply_by !== undefined && <div>Qty: <span className="text-white/60">{details.multiply_by}</span></div>}
                    {details.total_cost !== undefined && (
                        <div className="w-full mt-1 pt-1 border-t border-white/[0.04] flex items-center text-emerald-400 font-semibold">
                            <FiDollarSign className="mr-0.5" />
                            LKR {details.total_cost.toLocaleString()}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-2 border-t border-white/[0.04] pt-2.5">
                {/* Note button */}
                {details.note ? (
                    <button
                        type="button"
                        onClick={e => {
                            e.stopPropagation();
                            onViewNote(task, details.note);
                        }}
                        onPointerDown={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        className="w-full flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-[10px] font-bold py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                    >
                        <FiInfo className="shrink-0" /> View Task Note
                    </button>
                ) : (
                    <div className="text-[10px] text-white/20 italic text-center py-1">No note provided</div>
                )}

                {/* Status Dropdown */}
                <div
                    className="flex items-center gap-2"
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <select
                        value={task.status || 'pending'}
                        onChange={e => onStatusChange(task, e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none cursor-pointer focus:border-white/30 font-semibold"
                        style={{ color: STATUS_CFG[task.status || 'pending'].accent }}
                    >
                        <option value="pending" style={{ color: STATUS_CFG.pending.accent }}>● Pending</option>
                        <option value="in_progress" style={{ color: STATUS_CFG.in_progress.accent }}>● In Progress</option>
                        <option value="done" style={{ color: STATUS_CFG.done.accent }}>● Completed</option>
                    </select>
                </div>
            </div>
        </div>
    );
}

function DroppableColumn({ id, label, tasks, activeId, onStatusChange, onViewNote, onOpenWorkspace, subtitle }) {
    const { isOver, setNodeRef } = useDroppable({ id });

    return (
        <div className="w-[300px] shrink-0 flex flex-col bg-white/[0.01] border border-white/[0.06] rounded-2xl backdrop-blur-xl p-4">
            {/* Header */}
            <div className="flex justify-between items-start mb-2 border-b border-white/[0.06] pb-3">
                <div className="min-w-0 flex-1">
                    <button
                        onClick={onOpenWorkspace}
                        className="text-sm font-bold text-white hover:text-purple-300 transition-colors flex items-center gap-2 text-left"
                    >
                        <div className="w-6 h-6 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-xs text-white/70">
                            {label.charAt(0).toUpperCase()}
                        </div>
                        {label}
                    </button>
                    <p className="text-[10px] text-white/40 mt-1 pl-8 truncate">{subtitle}</p>
                </div>
                <button
                    onClick={onOpenWorkspace}
                    title="Open Detailed Workspace"
                    className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors shrink-0 ml-2"
                >
                    <FiMaximize2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* List */}
            <div
                ref={setNodeRef}
                className={`flex-1 flex flex-col gap-3 rounded-xl py-3 px-1 transition-all min-h-[350px] max-h-[500px] overflow-y-auto scrollbar-thin ${
                    isOver ? 'bg-white/[0.03] border border-dashed border-white/20' : 'border border-transparent'
                }`}
            >
                {tasks.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-white/20 text-xs italic py-16 text-center">
                        Drag tasks here to assign
                    </div>
                ) : (
                    tasks.map(t => (
                        <DraggableTaskCard
                            key={t.id}
                            task={t}
                            isDragging={String(t.id) === activeId}
                            onStatusChange={onStatusChange}
                            onViewNote={onViewNote}
                        />
                    ))
                )}
            </div>
            
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between items-center text-[10px] font-mono text-white/30 uppercase">
                <span>Task count</span>
                <span>{tasks.length}</span>
            </div>
        </div>
    );
}

function BacklogDrawer({ tasks, isOpen, onToggle, activeId, onStatusChange, onViewNote }) {
    const { isOver, setNodeRef } = useDroppable({ id: 'unassigned' });

    return (
        <div
            className={`shrink-0 flex transition-all duration-300 ${
                isOpen ? 'w-80' : 'w-12'
            } bg-white/[0.01] border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-xl flex-col`}
        >
            <button
                onClick={onToggle}
                className="w-full py-4 px-3 flex items-center justify-between border-b border-white/[0.06] text-xs font-bold text-white hover:bg-white/[0.02] transition-colors"
            >
                {isOpen ? (
                    <>
                        <span className="flex items-center gap-2">
                            <FiList className="text-amber-400" /> Unassigned Backlog
                        </span>
                        <FiChevronLeft className="w-4 h-4 text-white/40" />
                    </>
                ) : (
                    <div className="w-full flex flex-col items-center gap-4">
                        <FiChevronRight className="w-4 h-4 text-white/40" />
                        <FiList className="text-amber-400 w-5 h-5" />
                        <span className="text-[9px] font-mono tracking-widest uppercase writing-mode-vertical py-2">
                            Backlog
                        </span>
                    </div>
                )}
            </button>

            {isOpen && (
                <div
                    ref={setNodeRef}
                    className={`flex-1 flex flex-col gap-3 p-4 overflow-y-auto scrollbar-thin ${
                        isOver ? 'bg-white/[0.04]' : ''
                    }`}
                >
                    <p className="text-[10px] text-white/40 mb-2">
                        List of tasks currently waiting for employee scheduling. Drag card onto an employee column to assign.
                    </p>
                    {tasks.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-white/20 text-xs italic py-16 text-center">
                            Backlog is clean
                        </div>
                    ) : (
                        tasks.map(t => (
                            <DraggableTaskCard
                                key={t.id}
                                task={t}
                                isDragging={String(t.id) === activeId}
                                onStatusChange={onStatusChange}
                                onViewNote={onViewNote}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default function ServicePlanningPage({ params }) {
    const { id } = use(params);
    const router = useRouter();

    const [service, setService] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('kanban');
    const [activeId, setActiveId] = useState(null);

    // Modal & Workspace states
    const [noteModal, setNoteModal] = useState(null);
    const [backlogOpen, setBacklogOpen] = useState(true);

    // Filter states
    const [reportEmployee, setReportEmployee] = useState('');
    const [timeRange, setTimeRange] = useState('all');

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/services/${id}/planning`);
            if (!res.ok) throw new Error('Failed to load planning data');
            const data = await res.json();
            setService(data.service);
            setTasks(data.tasks || []);
        } catch (e) {
            console.error(e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

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

    const handleDragEnd = async ({ active, over }) => {
        setActiveId(null);
        if (!over || !active) return;
        
        const taskId = parseInt(active.id);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const targetContainer = over.id; // 'unassigned' or employeeName
        const targetEmployee = targetContainer === 'unassigned' ? null : targetContainer;

        if (task.assigned_to === targetEmployee) return;

        // Update task's employee and name
        const serviceName = service ? service.name : extractServiceName(task.name);
        const updatedName = targetEmployee ? `Service: ${serviceName} — ${targetEmployee}` : `Service: ${serviceName}`;

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? {
            ...t,
            assigned_to: targetEmployee,
            name: updatedName
        } : t));

        try {
            const res = await fetch(`/api/sales-orders/${task.sales_order_id}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assigned_to: targetEmployee,
                    name: updatedName
                }),
            });
            if (!res.ok) throw new Error('Failed to update employee assignment');
            toast.success(targetEmployee ? `Assigned to ${targetEmployee}` : 'Task moved to Backlog');
        } catch (e) {
            console.error(e);
            toast.error('Failed to update task assignment');
            loadData(); // Revert
        }
    };

    if (loading) {
        return (
            <div className="py-24 text-center text-white/40 space-y-4">
                <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin mx-auto" />
                <p className="text-sm">Loading planning workspace…</p>
            </div>
        );
    }

    if (error || !service) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl text-center max-w-md mx-auto my-12">
                <p className="font-semibold">Error loading planning workspace</p>
                <p className="text-xs mt-1 text-red-400/80">{error || 'Service not found'}</p>
                <button onClick={loadData} className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-white text-xs font-semibold">
                    Retry
                </button>
            </div>
        );
    }

    // Filter active planning tasks vs all historical tasks
    const activeTasks = tasks.filter(t => t.order_status !== 'Delivered' && t.order_status !== 'Cancelled');
    const completedTasks = tasks.filter(t => t.status === 'done');

    // Stats calculations
    const pendingCount = activeTasks.filter(t => t.status === 'pending').length;
    const progressCount = activeTasks.filter(t => t.status === 'in_progress').length;
    const completedCount = completedTasks.length;

    // Cycle times
    let totalMins = 0;
    let timedTasksCount = 0;
    completedTasks.forEach(t => {
        if (t.started_at && t.completed_at) {
            const diff = new Date(t.completed_at) - new Date(t.started_at);
            if (diff > 0) {
                totalMins += diff / 60000;
                timedTasksCount++;
            }
        }
    });
    const avgCycleTime = timedTasksCount > 0
        ? totalMins / timedTasksCount < 60
            ? `${Math.round(totalMins / timedTasksCount)}m`
            : `${(totalMins / timedTasksCount / 60).toFixed(1)}h`
        : '—';

    // Earnings calculation
    let totalEarnings = 0;
    completedTasks.forEach(t => {
        const details = parseDescription(t.description);
        if (details.total_cost) totalEarnings += details.total_cost;
    });

    // Employee List configured or previously assigned
    const serviceEmployees = service.employees.map(e => e.employee_name);
    const assignedInTasks = [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))];
    const allEmployeesList = [...new Set([...serviceEmployees, ...assignedInTasks])];

    // Reports calculations
    const employeeReports = allEmployeesList.map(emp => {
        const empTasks = tasks.filter(t => t.assigned_to === emp);
        const done = empTasks.filter(t => t.status === 'done');
        const active = empTasks.filter(t => t.status !== 'done' && t.order_status !== 'Delivered' && t.order_status !== 'Cancelled');

        let hours = 0;
        let units = 0;
        let jobs = 0;
        let earnings = 0;

        done.forEach(t => {
            const details = parseDescription(t.description);
            if (details.total_cost) earnings += details.total_cost;

            if (details.unit === 'per hour') hours += details.multiply_by || 0;
            else if (details.unit === 'per unit') units += details.multiply_by || 0;
            else if (details.unit === 'per job') jobs += details.multiply_by || 0;
        });

        return {
            name: emp,
            completedCount: done.length,
            activeCount: active.length,
            hours,
            units,
            jobs,
            earnings
        };
    }).sort((a, b) => b.earnings - a.earnings);

    // Time Logs Calculations & Filter
    const filteredLogs = tasks.filter(t => {
        if (t.status !== 'done') return false;
        if (reportEmployee && t.assigned_to !== reportEmployee) return false;

        if (timeRange !== 'all') {
            const compDate = new Date(t.completed_at);
            const now = new Date();
            if (timeRange === 'today') {
                return compDate.toDateString() === now.toDateString();
            } else if (timeRange === 'week') {
                const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return compDate >= oneWeekAgo;
            } else if (timeRange === 'month') {
                return compDate.getMonth() === now.getMonth() && compDate.getFullYear() === now.getFullYear();
            }
        }
        return true;
    }).sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

    const activeTask = activeId ? tasks.find(t => String(t.id) === activeId) : null;



    return (
        <div className="text-white space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/services"
                        className="p-2.5 bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.05] rounded-xl transition-colors shrink-0"
                    >
                        <FiArrowLeft className="w-5 h-5 text-white/70" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight block">
                            {service.name} Planning
                        </h1>
                        <p className="text-white/40 text-sm mt-1">
                            {service.description || 'Employee scheduling, production workflow, and payroll reports'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.08] rounded-xl p-1 shrink-0">
                    <button
                        onClick={() => setTab('kanban')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                            tab === 'kanban' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
                        }`}
                    >
                        <FiLayers size={13} /> Kanban Board
                    </button>
                    <button
                        onClick={() => setTab('reports')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                            tab === 'reports' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
                        }`}
                    >
                        <FiTrendingUp size={13} /> Reports &amp; Payroll
                    </button>
                    <button
                        onClick={() => setTab('timelogs')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                            tab === 'timelogs' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
                        }`}
                    >
                        <FiClock size={13} /> Time Logs
                    </button>
                </div>
            </header>

            {/* Stats Dashboard */}
            <div className="flex flex-wrap gap-4">
                <StatPill label="Active Backlog" value={pendingCount} accent="#f59e0b" icon={FiList} />
                <StatPill label="In Progress" value={progressCount} accent="#3b82f6" icon={FiActivity} />
                <StatPill label="Completed Tasks" value={completedCount} accent="#10b981" icon={FiCheckCircle} />
                <StatPill label="Total Cost / Payroll" value={`LKR ${totalEarnings.toLocaleString()}`} accent="#a78bfa" icon={FiDollarSign} />
                <StatPill label="Avg. Cycle Duration" value={avgCycleTime} accent="#f43f5e" icon={FiClock} />
            </div>

            {/* Body Tabs */}
            <div className="bg-black/20 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-xl">
                {/* ─── KANBAN TAB ─── */}
                {tab === 'kanban' && (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCorners}
                        onDragStart={({ active }) => setActiveId(String(active.id))}
                        onDragEnd={handleDragEnd}
                        onDragCancel={() => setActiveId(null)}
                    >
                        <div className="flex gap-6 items-start overflow-x-auto pb-4 scrollbar-thin">
                            {/* Backlog Drawer */}
                            <BacklogDrawer
                                isOpen={backlogOpen}
                                onToggle={() => setBacklogOpen(!backlogOpen)}
                                tasks={activeTasks.filter(t => !t.assigned_to)}
                                activeId={activeId}
                                onStatusChange={handleStatusChange}
                                onViewNote={(task, note) => setNoteModal({ task, note })}
                            />

                            {/* Employee columns */}
                            {allEmployeesList.map(emp => {
                                const empMeta = service.employees.find(e => e.employee_name === emp);
                                const rateText = empMeta ? `Rate: LKR ${empMeta.rate.toFixed(2)} (${empMeta.default_rate_unit})` : 'Custom rate';
                                return (
                                    <DroppableColumn
                                        key={emp}
                                        id={emp}
                                        label={emp}
                                        subtitle={rateText}
                                        tasks={activeTasks.filter(t => t.assigned_to === emp)}
                                        activeId={activeId}
                                        onStatusChange={handleStatusChange}
                                        onViewNote={(task, note) => setNoteModal({ task, note })}
                                        onOpenWorkspace={() => router.push(`/services/${id}/planning/employees/${encodeURIComponent(emp)}`)}
                                    />
                                );
                            })}
                        </div>

                        <DragOverlay>
                            {activeTask ? (
                                <div className="bg-[#111] border border-white/20 rounded-xl p-4 shadow-2xl w-[260px] opacity-90 select-none cursor-grabbing">
                                    <span className="font-mono text-[9px] font-bold text-white/30 uppercase">SO #{activeTask.order_code || activeTask.sales_order_id}</span>
                                    <h4 className="text-xs font-bold text-white truncate mt-0.5">
                                        {extractJobName(activeTask.name)}
                                    </h4>
                                    <p className="text-[10px] text-white/50 truncate mt-0.5">{activeTask.customer_name}</p>
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )}

                {/* ─── REPORTS & PAYROLL TAB ─── */}
                {tab === 'reports' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-bold">Employee Payroll &amp; Yield Statement</h3>
                            <p className="text-xs text-white/40 mt-1">
                                Summary of accumulated service logs and costs generated from completed tasks. Click an employee to view their detailed workspace.
                            </p>
                        </div>

                        {employeeReports.length === 0 ? (
                            <div className="py-12 text-center text-white/20 text-sm">
                                No payroll metrics available yet. Complete service tasks to aggregate.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-white/[0.08] text-white/40 text-[11px] uppercase tracking-wider text-left">
                                            <th className="py-3 pl-2">Employee</th>
                                            <th className="py-3 text-center">Completed Tasks</th>
                                            <th className="py-3 text-center">Active Scheduling</th>
                                            <th className="py-3 text-right">Hours Logged</th>
                                            <th className="py-3 text-right">Units Processed</th>
                                            <th className="py-3 text-right">Jobs Finished</th>
                                            <th className="py-3 pr-2 text-right">Total Earnings</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {employeeReports.map(rep => (
                                            <tr
                                                key={rep.name}
                                                onClick={() => router.push(`/services/${id}/planning/employees/${encodeURIComponent(rep.name)}`)}
                                                className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                                            >
                                                <td className="py-4 pl-2 font-bold flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-xs text-white/60">
                                                        {rep.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {rep.name}
                                                </td>
                                                <td className="py-4 text-center font-mono font-semibold text-emerald-400">
                                                    {rep.completedCount}
                                                </td>
                                                <td className="py-4 text-center font-mono font-semibold text-white/40">
                                                    {rep.activeCount}
                                                </td>
                                                <td className="py-4 text-right font-mono">
                                                    {rep.hours > 0 ? `${rep.hours.toFixed(1)} hrs` : '—'}
                                                </td>
                                                <td className="py-4 text-right font-mono">
                                                    {rep.units > 0 ? `${rep.units.toLocaleString()} units` : '—'}
                                                </td>
                                                <td className="py-4 text-right font-mono">
                                                    {rep.jobs > 0 ? `${rep.jobs} jobs` : '—'}
                                                </td>
                                                <td className="py-4 pr-2 text-right font-bold font-mono text-purple-300">
                                                    LKR {rep.earnings.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── TIME LOGS TAB ─── */}
                {tab === 'timelogs' && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold">Productivity Audit Logs</h3>
                                <p className="text-xs text-white/40 mt-1">
                                    Trace exact cycle completion times for each service ticket.
                                </p>
                            </div>

                            {/* Filters */}
                            <div className="flex gap-3">
                                <div>
                                    <select
                                        value={reportEmployee}
                                        onChange={e => setReportEmployee(e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-white/30"
                                    >
                                        <option value="">All Employees</option>
                                        {allEmployeesList.map(emp => (
                                            <option key={emp} value={emp}>{emp}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <select
                                        value={timeRange}
                                        onChange={e => setTimeRange(e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-white/30"
                                    >
                                        <option value="all">All Time</option>
                                        <option value="today">Today</option>
                                        <option value="week">Past 7 Days</option>
                                        <option value="month">This Month</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {filteredLogs.length === 0 ? (
                            <div className="py-12 text-center text-white/20 text-sm">
                                No logged activities match your criteria.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-white/[0.08] text-white/40 text-[11px] uppercase tracking-wider text-left">
                                            <th className="py-3 pl-2">Completed Date</th>
                                            <th className="py-3">Order Code</th>
                                            <th className="py-3">Client</th>
                                            <th className="py-3">Employee</th>
                                            <th className="py-3 text-right">Cycle Duration</th>
                                            <th className="py-3 text-right pr-2">Assessed Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {filteredLogs.map(log => {
                                            const details = parseDescription(log.description);
                                            return (
                                                <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="py-3.5 pl-2 font-semibold">
                                                        {new Date(log.completed_at).toLocaleDateString()}
                                                        <span className="text-[10px] text-white/30 ml-2">
                                                            {new Date(log.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5">
                                                        <Link href={`/dashboard/sales-orders/${log.sales_order_id}`} className="font-mono text-xs font-bold text-white/60 hover:text-white underline">
                                                            SO #{log.order_code || log.sales_order_id}
                                                        </Link>
                                                    </td>
                                                    <td className="py-3.5 text-white/80 max-w-[150px] truncate">
                                                        {log.customer_name}
                                                    </td>
                                                    <td className="py-3.5 font-semibold text-white/60">
                                                        {log.assigned_to || '—'}
                                                    </td>
                                                    <td className="py-3.5 text-right font-mono">
                                                        <div className="flex justify-end items-center gap-1.5">
                                                            <FiClock className="text-white/30 text-xs" />
                                                            {formatDuration(log.started_at, log.completed_at)}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 pr-2 text-right font-mono font-bold text-emerald-400">
                                                        {details.total_cost ? `LKR ${details.total_cost.toLocaleString()}` : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>



            {/* ─── NOTE MODAL OVERLAY ─── */}
            {noteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-opacity">
                    <div className="bg-[#0c0c16] border border-white/10 rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl flex flex-col">
                        <header className="flex justify-between items-center px-6 py-4 border-b border-white/[0.08] bg-white/[0.01]">
                            <div>
                                <span className="font-mono text-[9px] font-bold text-white/30 uppercase tracking-wider block">
                                    SO #{noteModal.task.order_code || noteModal.task.sales_order_id}
                                </span>
                                <h3 className="text-sm font-bold text-white mt-0.5">
                                    {extractServiceName(noteModal.task.name)} Note
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNoteModal(null)}
                                className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </header>
                        
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block">Client</span>
                                <span className="text-xs text-white/80 font-medium block mt-0.5">{noteModal.task.customer_name}</span>
                            </div>

                            <div>
                                <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold block">Full Instructions / Notes</span>
                                <div className="mt-1.5 p-3.5 bg-black/50 border border-white/[0.06] rounded-xl text-xs text-amber-200 leading-relaxed font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                                    {noteModal.note}
                                </div>
                            </div>
                        </div>

                        <footer className="px-6 py-3.5 border-t border-white/[0.08] bg-white/[0.01] flex justify-end">
                            <button
                                type="button"
                                onClick={() => setNoteModal(null)}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer"
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
