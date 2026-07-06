'use client';
import { useState, useEffect } from 'react';
import {
    DndContext, DragOverlay, closestCorners,
    PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { 
    FiChevronLeft, FiChevronRight, FiChevronDown, FiClock, FiPrinter, 
    FiTrendingUp, FiAlertTriangle, FiBookOpen, FiActivity, FiDownload
} from 'react-icons/fi';

const G = {
    bg: '#070710',
    glass: 'rgba(255,255,255,0.03)',
    border: 'rgba(255,255,255,0.08)',
    borderHov: 'rgba(255,255,255,0.15)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
    dim: '#64748b',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#a78bfa'
};

const STATUS_DOT = { pending: '#64748b', in_progress: '#f59e0b', done: '#10b981' };

const getStartOfWeek = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const start = new Date(date.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
};

const formatDateKey = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// ── DroppableContainer Wrapper ────────────────────────────────────────────
function DroppableContainer({ id, children, style }) {
    const { setNodeRef } = useDroppable({ id });
    return (
        <div ref={setNodeRef} style={{ ...style }}>
            {children}
        </div>
    );
}

// ── Sortable Task Card ───────────────────────────────────────────────────
function TaskCard({ task, order, onUpdateTask, accent }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `task-${task.id}`,
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(task.estimated_minutes || 0);

    const handleSave = () => {
        setIsEditing(false);
        const val = parseInt(editValue);
        if (isNaN(val) || val < 0) return;
        onUpdateTask(task.id, order.id, { estimated_minutes: val });
    };

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 6,
        cursor: isEditing ? 'default' : 'grab',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        userSelect: 'none',
    };

    const jobName = order?.estimation_names || order?.customer_name || 'No Job Name';
    const customerName = order?.customer_name || '';
    const orderCode = order?.code || '—';
    const dot = STATUS_DOT[task.status] || STATUS_DOT.pending;

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            {...(isEditing ? {} : listeners)} 
            {...(isEditing ? {} : attributes)}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                        width: 7, height: 7, borderRadius: '50%', background: dot,
                        boxShadow: task.status === 'done' ? `0 0 6px ${dot}` : 'none',
                    }} />
                    <span style={{
                        fontSize: 9, fontWeight: 700, color: '#f59e0b',
                        background: 'rgba(245,158,11,0.1)', padding: '2px 5px',
                        borderRadius: 4, letterSpacing: 0.4
                    }}>{orderCode}</span>
                </div>
                
                {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={e => e.stopPropagation()}>
                        <input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                            autoFocus
                            style={{
                                width: 44,
                                background: '#111',
                                color: '#fff',
                                border: '1px solid #a78bfa',
                                borderRadius: 4,
                                padding: '1px 3px',
                                fontSize: 9,
                                textAlign: 'center',
                                outline: 'none',
                            }}
                        />
                        <span style={{ fontSize: 9, color: G.muted }}>m</span>
                    </div>
                ) : (
                    <span
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                            setEditValue(task.estimated_minutes || 0);
                        }}
                        style={{
                            fontSize: 9, fontWeight: 700, color: G.purple,
                            background: 'rgba(167,139,250,0.1)', padding: '2px 6px',
                            borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(167,139,250,0.2)',
                            transition: 'all 0.15s',
                        }}
                        title="Click to edit estimated minutes"
                    >
                        {task.estimated_minutes ? `${task.estimated_minutes}m` : '0m'}
                    </span>
                )}
            </div>

            <div style={{ marginTop: 6 }}>
                <p style={{
                    fontSize: 11, fontWeight: 700, color: '#f1f5f9',
                    margin: '0 0 1px 0', overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }} title={jobName}>{jobName}</p>
                
                <p style={{
                    fontSize: 9.5, color: G.muted, margin: '0 0 5px 0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>{customerName}</p>
                
                <div style={{
                    fontSize: 10, color: '#cbd5e1', background: 'rgba(255,255,255,0.02)',
                    padding: '4px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.04)',
                    wordBreak: 'break-word', lineHeight: 1.3
                }}>
                    {task.name.split('—')[task.name.split('—').length - 1].trim()}
                </div>
            </div>
        </div>
    );
}

// ── Days Columns ─────────────────────────────────────────────────────────
function DayColumn({ id, title, label, tasks, orderLookup, onUpdateTask, accent, capacityMins = 480 }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;
    
    const isOverloaded = totalMins > capacityMins;
    const badgeColor = isOverloaded ? G.danger : totalMins > 0 ? '#34d399' : G.dim;
    const badgeBg = isOverloaded ? 'rgba(239,68,68,0.1)' : totalMins > 0 ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.03)';

    return (
        <div style={{
            background: isOver ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${isOver ? accent + '44' : G.border}`,
            borderTop: `2px solid ${isOverloaded ? G.danger : accent}`,
            borderRadius: 14,
            padding: 10,
            transition: 'all 0.2s',
            boxShadow: isOver ? `0 0 16px ${accent}15` : 'none',
            minWidth: 220, width: 220, flexShrink: 0,
            display: 'flex', flexDirection: 'column', minHeight: 450
        }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: G.text }}>{title}</div>
                    <div style={{ fontSize: 9, color: G.dim }}>{label}</div>
                </div>
                <div style={{
                    fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                    background: badgeBg, color: badgeColor, border: `1px solid ${badgeColor}22`
                }}>
                    {totalHrs}h
                </div>
            </div>

            <div ref={setNodeRef} style={{
                flex: 1, borderRadius: 8,
                padding: isOver ? 2 : 0,
                background: isOver ? 'rgba(255,255,255,0.01)' : 'transparent',
                border: isOver ? `1px dashed ${accent}33` : '1px dashed transparent',
                transition: 'all 0.2s',
                minHeight: 120
            }}>
                <SortableContext items={tasks.map(t => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
                    {tasks.length === 0 ? (
                        <div style={{ padding: '30px 8px', textAlign: 'center', color: G.dim, fontSize: 10, fontStyle: 'italic' }}>
                            No tasks
                        </div>
                    ) : (
                        tasks.map(t => (
                            <TaskCard
                                key={t.id}
                                task={t}
                                order={orderLookup(t)}
                                onUpdateTask={onUpdateTask}
                                accent={accent}
                            />
                        ))
                    )}
                </SortableContext>
            </div>
        </div>
    );
}

// ── Unplanned Queue Column ────────────────────────────────────────────────
function UnplannedColumn({ id, tasks, orderLookup, onUpdateTask, accent }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;

    return (
        <div style={{
            background: isOver ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.01)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${isOver ? accent + '44' : G.border}`,
            borderTop: `2px solid ${G.dim}`,
            borderRadius: 14,
            padding: 10,
            transition: 'all 0.2s',
            minWidth: 220, width: 220, flexShrink: 0,
            display: 'flex', flexDirection: 'column', minHeight: 450
        }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: G.text }}>Unplanned Queue</div>
                    <div style={{ fontSize: 9, color: G.dim }}>Machine backlog</div>
                </div>
                <div style={{
                    fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.03)', color: G.dim, border: `1px solid ${G.border}`
                }}>
                    {totalHrs}h
                </div>
            </div>

            <div ref={setNodeRef} style={{
                flex: 1, borderRadius: 8,
                padding: isOver ? 2 : 0,
                background: isOver ? 'rgba(255,255,255,0.01)' : 'transparent',
                border: isOver ? `1px dashed ${accent}33` : '1px dashed transparent',
                transition: 'all 0.2s',
                minHeight: 120
            }}>
                <SortableContext items={tasks.map(t => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
                    {tasks.length === 0 ? (
                        <div style={{ padding: '30px 8px', textAlign: 'center', color: G.dim, fontSize: 10, fontStyle: 'italic' }}>
                            Empty Queue
                        </div>
                    ) : (
                        tasks.map(t => (
                            <TaskCard
                                key={t.id}
                                task={t}
                                order={orderLookup(t)}
                                onUpdateTask={onUpdateTask}
                                accent={G.dim}
                            />
                        ))
                    )}
                </SortableContext>
            </div>
        </div>
    );
}

// ── Main MachinePlanning Component ───────────────────────────────────────
export default function MachinePlanning({ machines, orders }) {
    const [localOrders, setLocalOrders] = useState(orders);
    const [activeMachineId, setActiveMachineId] = useState(() => {
        return machines.length > 0 ? machines[0].id : null;
    });

    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        return getStartOfWeek(new Date());
    });

    const [activeTask, setActiveTask] = useState(null);
    const [showReport, setShowReport] = useState(true);
    const [collapsedCategories, setCollapsedCategories] = useState({
        prepress: false,
        offset: false,
        digital: false,
        finishing: false,
    });

    const toggleCategory = (type) => {
        setCollapsedCategories(prev => ({
            ...prev,
            [type]: !prev[type]
        }));
    };

    // Sync prop changes
    useEffect(() => {
        setLocalOrders(orders);
    }, [orders]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const selectedMachine = machines.find(m => m.id === activeMachineId) || machines[0];

    // Navigate Weeks
    const handlePrevWeek = () => {
        setCurrentWeekStart(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 7);
            return d;
        });
    };

    const handleNextWeek = () => {
        setCurrentWeekStart(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 7);
            return d;
        });
    };

    const handleToday = () => {
        setCurrentWeekStart(getStartOfWeek(new Date()));
    };

    // Calculate Week Days
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(currentWeekStart);
        day.setDate(currentWeekStart.getDate() + i);
        weekDays.push({
            dateStr: formatDateKey(day),
            label: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            name: day.toLocaleDateString('en-US', { weekday: 'long' }),
        });
    }

    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(currentWeekStart.getDate() + 6);
    const dateRangeStr = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const getOrder = t => localOrders.find(o => o.id === t.sales_order_id);

    // Grouping Tasks
    const unplannedTasks = [];
    const dailyTasksMap = {};
    weekDays.forEach(day => { dailyTasksMap[day.dateStr] = []; });
    const unassignedTasks = [];

    localOrders.forEach(o => {
        (o.tasks || []).forEach(t => {
            if (t.machine_id === activeMachineId) {
                if (!t.scheduled_date) {
                    unplannedTasks.push(t);
                } else {
                    let dStr = '';
                    try {
                        const d = new Date(t.scheduled_date);
                        dStr = formatDateKey(d);
                    } catch {}
                    if (dailyTasksMap[dStr]) {
                        dailyTasksMap[dStr].push(t);
                    }
                }
            } else if (t.machine_id === null) {
                unassignedTasks.push(t);
            }
        });
    });

    // Sort tasks in each list by order delivery date & display_order
    const sortTasks = list => {
        return list.sort((a, b) => {
            const dateA = getOrder(a)?.delivery_date ? new Date(getOrder(a).delivery_date).getTime() : 0;
            const dateB = getOrder(b)?.delivery_date ? new Date(getOrder(b).delivery_date).getTime() : 0;
            if (dateA !== dateB) return dateA - dateB;
            return (a.display_order || 0) - (b.display_order || 0);
        });
    };

    sortTasks(unplannedTasks);
    sortTasks(unassignedTasks);
    Object.keys(dailyTasksMap).forEach(k => sortTasks(dailyTasksMap[k]));

    // Drag-and-drop end handler
    const handleDragStart = ({ active }) => {
        const taskId = parseInt(String(active.id).replace('task-', ''));
        for (const order of localOrders) {
            const found = (order.tasks || []).find(t => t.id === taskId);
            if (found) { setActiveTask(found); return; }
        }
    };

    const handleDragEnd = async ({ active, over }) => {
        setActiveTask(null);
        if (!over) return;

        const taskId = parseInt(String(active.id).replace('task-', ''));
        const overId = String(over.id);

        let parentOrder = null;
        for (const order of localOrders) {
            if ((order.tasks || []).some(t => t.id === taskId)) {
                parentOrder = order;
                break;
            }
        }
        if (!parentOrder) return;

        let newMachineId = selectedMachine?.id || null;
        let newMachineName = selectedMachine?.name || null;
        let newScheduledDate = null;

        if (overId === 'unassigned') {
            newMachineId = null;
            newMachineName = null;
            newScheduledDate = null;
        } else if (overId === 'unplanned') {
            newScheduledDate = null;
        } else if (overId.startsWith('day-')) {
            newScheduledDate = overId.replace('day-', '');
        }

        // Optimistically update
        setLocalOrders(prev => {
            return prev.map(order => {
                if (order.id === parentOrder.id) {
                    return {
                        ...order,
                        tasks: order.tasks.map(t => {
                            if (t.id === taskId) {
                                return {
                                    ...t,
                                    machine_id: newMachineId,
                                    machine_name: newMachineName,
                                    scheduled_date: newScheduledDate,
                                };
                            }
                            return t;
                        })
                    };
                }
                return order;
            });
        });

        // Persist to DB
        try {
            await fetch(`/api/sales-orders/${parentOrder.id}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: newMachineId,
                    machine_name: newMachineName,
                    scheduled_date: newScheduledDate
                }),
            });
        } catch (e) {
            console.error('Drag update error:', e);
            setLocalOrders(orders); // Revert
        }
    };

    // Update Task Time
    const handleUpdateTask = async (taskId, orderId, fields) => {
        setLocalOrders(prev => {
            return prev.map(order => {
                if (order.id === orderId) {
                    return {
                        ...order,
                        tasks: order.tasks.map(t => {
                            if (t.id === taskId) {
                                return { ...t, ...fields };
                            }
                            return t;
                        })
                    };
                }
                return order;
            });
        });

        try {
            await fetch(`/api/sales-orders/${orderId}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });
        } catch (e) {
            console.error('Task update error:', e);
            setLocalOrders(orders);
        }
    };

    // Report Calculations
    const scheduledWeekTasks = [];
    Object.values(dailyTasksMap).forEach(tasks => {
        scheduledWeekTasks.push(...tasks);
    });

    const totalTasksPlanned = scheduledWeekTasks.length;
    const totalEstimatedMins = scheduledWeekTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const completedTasks = scheduledWeekTasks.filter(t => t.status === 'done').length;
    const completedMins = scheduledWeekTasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const completionRate = totalTasksPlanned > 0 ? Math.round((completedTasks / totalTasksPlanned) * 100) : 0;

    const machineAccent = selectedMachine?.type?.toLowerCase() === 'digital' ? G.purple : selectedMachine?.type?.toLowerCase() === 'finishing' ? G.success : G.warning;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveTask(null)}
        >
            <style>{`
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    .print-report-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 18px;
                    }
                    .print-report-table th, .print-report-table td {
                        border: 1px solid #c0c0c0;
                        padding: 6px 8px;
                        text-align: left;
                        font-size: 10.5px;
                        color: black !important;
                    }
                    .print-report-table th {
                        background-color: #e5e5e5;
                        font-weight: bold;
                    }
                }
                @media screen {
                    .print-only {
                        display: none !important;
                    }
                }
            `}</style>

            {/* ─── PRINT ONLY LAYOUT ─── */}
            {selectedMachine && (
                <div className="print-only" style={{ padding: 24, background: '#fff', color: '#000' }}>
                    <div style={{ borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 16 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#000', margin: 0 }}>Weekly Machine Schedule Report</h1>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#333' }}>
                            Machine: <strong>{selectedMachine.name}</strong> ({selectedMachine.type})
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#333' }}>
                            Week: <strong>{dateRangeStr}</strong>
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 11 }}>
                        <div><strong>Total Tasks Planned:</strong> {totalTasksPlanned} ({Math.round(totalEstimatedMins/60*10)/10} hrs)</div>
                        <div><strong>Completed Tasks:</strong> {completedTasks} ({Math.round(completedMins/60*10)/10} hrs)</div>
                        <div><strong>Completion Rate:</strong> {completionRate}%</div>
                    </div>

                    <table className="print-report-table">
                        <thead>
                            <tr>
                                <th style={{ width: '15%' }}>Day / Date</th>
                                <th style={{ width: '10%' }}>Job Code</th>
                                <th style={{ width: '30%' }}>Job Name</th>
                                <th style={{ width: '30%' }}>Task Detail</th>
                                <th style={{ width: '8%' }}>Est. Time</th>
                                <th style={{ width: '7%' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {weekDays.map(day => {
                                const dayTasks = dailyTasksMap[day.dateStr] || [];
                                if (dayTasks.length === 0) {
                                    return (
                                        <tr key={day.dateStr}>
                                            <td><strong>{day.name}</strong><br/><span style={{ fontSize: 8.5, color: '#444' }}>{day.dateStr}</span></td>
                                            <td colSpan="5" style={{ color: '#666', fontStyle: 'italic' }}>No tasks scheduled</td>
                                        </tr>
                                    );
                                }
                                return dayTasks.map((t, idx) => {
                                    const ord = getOrder(t);
                                    return (
                                        <tr key={t.id}>
                                            {idx === 0 && (
                                                <td rowSpan={dayTasks.length} style={{ verticalAlign: 'top' }}>
                                                    <strong>{day.name}</strong><br/>
                                                    <span style={{ fontSize: 8.5, color: '#444' }}>{day.dateStr}</span>
                                                </td>
                                            )}
                                            <td>{ord?.code || '—'}</td>
                                            <td>{ord?.estimation_names || ord?.customer_name || '—'}</td>
                                            <td>{t.name.split('—')[t.name.split('—').length - 1].trim()}</td>
                                            <td>{t.estimated_minutes ? `${t.estimated_minutes}m` : '0m'}</td>
                                            <td style={{ textTransform: 'capitalize' }}>{t.status}</td>
                                        </tr>
                                    );
                                });
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ─── SCREEN LAYOUT ─── */}
            <div className="no-print" style={{ display: 'flex', gap: 24, minHeight: '80vh' }}>
                
                {/* 1. Left Sidebar Machine Selector & Unassigned List */}
                <div style={{
                    width: 250,
                    background: G.glass,
                    backdropFilter: 'blur(16px)',
                    border: `1px solid ${G.border}`,
                    borderRadius: 14,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                    height: 'fit-content',
                    maxHeight: '100vh',
                    overflowY: 'auto'
                }}>
                    <div>
                        <h3 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: G.dim, letterSpacing: 0.8, marginBottom: 12 }}>
                            Machines
                        </h3>
                        {['prepress', 'offset', 'digital', 'finishing'].map(type => {
                            const typeMachines = machines.filter(m => (m.type || '').toLowerCase() === type);
                            if (typeMachines.length === 0) return null;
                            const isCollapsed = collapsedCategories[type];
                            return (
                                <div key={type} style={{ marginBottom: 14 }}>
                                    <div 
                                        onClick={() => toggleCategory(type)}
                                        style={{ 
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            fontSize: 9.5, fontWeight: 700, color: G.muted, textTransform: 'uppercase', 
                                            marginBottom: 5, letterSpacing: 0.4, cursor: 'pointer', userSelect: 'none'
                                        }}
                                    >
                                        <span>{type}</span>
                                        {isCollapsed ? <FiChevronRight style={{ fontSize: 10 }} /> : <FiChevronDown style={{ fontSize: 10 }} />}
                                    </div>
                                    {!isCollapsed && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {typeMachines.map(m => {
                                                const isSelected = activeMachineId === m.id;
                                                // Task count for this machine in current week
                                                const mTasksCount = localOrders.reduce((sum, o) => {
                                                    return sum + (o.tasks || []).filter(t => t.machine_id === m.id).length;
                                                }, 0);

                                                return (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => setActiveMachineId(m.id)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            padding: '7px 9px', borderRadius: 8, border: 'none',
                                                            background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                                                            color: isSelected ? '#fff' : G.muted,
                                                            cursor: 'pointer', textAlign: 'left', fontSize: 11.5,
                                                            transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {m.name}
                                                        </span>
                                                        {mTasksCount > 0 && (
                                                            <span style={{
                                                                fontSize: 8.5, background: isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                                                                padding: '1px 5px', borderRadius: 10, color: isSelected ? '#fff' : G.dim
                                                            }}>{mTasksCount}</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ borderTop: `1px solid ${G.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', minHeight: 180 }}>
                        <h3 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: G.danger, letterSpacing: 0.8, marginBottom: 4 }}>
                            Unassigned ({unassignedTasks.length})
                        </h3>
                        <p style={{ fontSize: 9, color: G.dim, margin: '0 0 8px 0' }}>
                            Drag to schedule
                        </p>
                        <div style={{
                            flex: 1, overflowY: 'auto',
                            background: 'rgba(239,68,68,0.01)', borderRadius: 10, border: '1px dashed rgba(239,68,68,0.12)',
                            padding: 6, minHeight: 120, maxHeight: 300
                        }}>
                            <DroppableContainer id="unassigned" style={{ minHeight: '100%' }}>
                                <SortableContext items={unassignedTasks.map(t => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
                                    {unassignedTasks.length === 0 ? (
                                        <div style={{ fontSize: 9.5, color: G.dim, textAlign: 'center', padding: '30px 0', fontStyle: 'italic' }}>
                                            No unassigned tasks
                                        </div>
                                    ) : (
                                        unassignedTasks.map(t => (
                                            <TaskCard
                                                key={t.id}
                                                task={t}
                                                order={getOrder(t)}
                                                onUpdateTask={handleUpdateTask}
                                                accent={G.danger}
                                            />
                                        ))
                                    )}
                                </SortableContext>
                            </DroppableContainer>
                        </div>
                    </div>
                </div>

                {/* 2. Main Planner Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
                    
                    {/* Header toolbar */}
                    {selectedMachine && (
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: G.glass, backdropFilter: 'blur(12px)',
                            border: `1px solid ${G.border}`, borderRadius: 14,
                            padding: '12px 18px', flexWrap: 'wrap', gap: 10
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <h2 style={{ fontSize: 16, fontWeight: 800, color: G.text, margin: 0 }}>
                                        {selectedMachine.name}
                                    </h2>
                                    <span style={{
                                        fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                        background: `${machineAccent}18`, color: machineAccent, border: `1px solid ${machineAccent}33`,
                                        textTransform: 'uppercase'
                                    }}>{selectedMachine.type}</span>
                                    
                                    <a
                                        href={`/machines/${selectedMachine.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            fontSize: 9.5, color: G.muted, textDecoration: 'none',
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            padding: '2px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${G.border}`, transition: 'all 0.15s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                        onMouseLeave={e => e.currentTarget.style.color = G.muted}
                                    >
                                        Live Tracker ↗
                                    </a>
                                </div>
                                <p style={{ fontSize: 11, color: G.muted, margin: '2px 0 0 0' }}>
                                    Schedule &amp; track weekly tasks and machine reports
                                </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {/* Week navigation */}
                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 3, border: `1px solid ${G.border}` }}>
                                    <button 
                                        onClick={handlePrevWeek} 
                                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 5, borderRadius: 5 }}
                                        title="Previous Week"
                                    >
                                        <FiChevronLeft style={{ fontSize: 14 }} />
                                    </button>
                                    <button 
                                        onClick={handleToday}
                                        style={{ 
                                            background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', cursor: 'pointer',
                                            fontSize: 10.5, fontWeight: 600, padding: '4px 8px', borderRadius: 4, margin: '0 4px'
                                        }}
                                    >
                                        Today
                                    </button>
                                    <button 
                                        onClick={handleNextWeek} 
                                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 5, borderRadius: 5 }}
                                        title="Next Week"
                                    >
                                        <FiChevronRight style={{ fontSize: 14 }} />
                                    </button>
                                </div>

                                <span style={{ fontSize: 11.5, fontWeight: 600, color: G.text, fontFamily: 'monospace' }}>
                                    {dateRangeStr}
                                </span>

                                <button
                                    onClick={() => setShowReport(!showReport)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '7px 12px', border: 'none', borderRadius: 8,
                                        background: showReport ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
                                        color: showReport ? G.purple : G.muted, cursor: 'pointer',
                                        fontSize: 11.5, fontWeight: 600, transition: 'all 0.18s'
                                    }}
                                >
                                    <FiActivity style={{ fontSize: 12 }} />
                                    Report
                                </button>

                                <button
                                    onClick={() => window.print()}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '7px 12px', border: `1px solid ${G.border}`, borderRadius: 8,
                                        background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer',
                                        fontSize: 11.5, fontWeight: 600, transition: 'all 0.18s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = G.muted}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = G.border}
                                >
                                    <FiPrinter style={{ fontSize: 12 }} />
                                    Print
                                </button>

                                <button
                                    onClick={() => {
                                        if (!selectedMachine) return;
                                        const y = currentWeekStart.getFullYear();
                                        const m = String(currentWeekStart.getMonth() + 1).padStart(2, '0');
                                        const d = String(currentWeekStart.getDate()).padStart(2, '0');
                                        const weekStartStr = `${y}-${m}-${d}`;
                                        window.open(`/api/job-planning/machine/${selectedMachine.id}/pdf?weekStart=${weekStartStr}`, '_blank');
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '7px 12px', border: `1px solid ${G.border}`, borderRadius: 8,
                                        background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer',
                                        fontSize: 11.5, fontWeight: 600, transition: 'all 0.18s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = G.purple}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = G.border}
                                >
                                    <FiDownload style={{ fontSize: 12 }} />
                                    PDF
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Report Panel */}
                    {showReport && selectedMachine && (
                        <div style={{
                            background: G.glass, backdropFilter: 'blur(16px)',
                            border: `1px solid ${G.border}`, borderRadius: 14,
                            padding: 16, display: 'flex', flexDirection: 'column', gap: 12
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FiTrendingUp style={{ color: G.purple, fontSize: 13 }} />
                                <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#fff', margin: 0, letterSpacing: 0.6 }}>
                                    Machine Weekly Report &amp; Capacity
                                </h3>
                            </div>

                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {/* Stat block */}
                                <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 280 }}>
                                    <div style={{
                                        flex: 1, background: 'rgba(255,255,255,0.02)', border: `1px solid ${G.border}`,
                                        padding: '10px 14px', borderRadius: 10, display: 'flex', flexDirection: 'column'
                                    }}>
                                        <span style={{ fontSize: 9, color: G.dim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Weekly Load</span>
                                        <span style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: '#fff' }}>
                                            {totalTasksPlanned} <span style={{ fontSize: 11, fontWeight: 400, color: G.muted }}>tasks</span>
                                        </span>
                                        <span style={{ fontSize: 10.5, color: G.muted, marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <FiClock style={{ fontSize: 10 }} />
                                            {Math.round((totalEstimatedMins/60)*10)/10} hours scheduled
                                        </span>
                                    </div>

                                    <div style={{
                                        flex: 1, background: 'rgba(255,255,255,0.02)', border: `1px solid ${G.border}`,
                                        padding: '10px 14px', borderRadius: 10, display: 'flex', flexDirection: 'column'
                                    }}>
                                        <span style={{ fontSize: 9, color: G.dim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Completed</span>
                                        <span style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: G.success }}>
                                            {completionRate}%
                                        </span>
                                        <span style={{ fontSize: 10.5, color: G.muted, marginTop: 1 }}>
                                            {completedTasks} of {totalTasksPlanned} tasks done
                                        </span>
                                    </div>
                                </div>

                                {/* Daily bar chart */}
                                <div style={{
                                    flex: 2, minWidth: 350, background: 'rgba(255,255,255,0.01)', border: `1px solid ${G.border}`,
                                    padding: '10px 16px', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6
                                }}>
                                    <span style={{ fontSize: 9, color: G.dim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Daily Capacity Load (8h shift limit)</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {weekDays.map(day => {
                                            const dayTasks = dailyTasksMap[day.dateStr] || [];
                                            const mins = dayTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
                                            const hrs = Math.round((mins / 60) * 10) / 10;
                                            const pct = Math.min(100, Math.round((mins / 480) * 100));
                                            
                                            const barColor = mins > 480 ? G.danger : mins > 0 ? '#34d399' : 'rgba(255,255,255,0.1)';

                                            return (
                                                <div key={day.dateStr} style={{ display: 'flex', alignItems: 'center', fontSize: 10.5 }}>
                                                    <span style={{ width: 65, color: G.muted, fontWeight: 500 }}>{day.name.slice(0, 3)} ({day.dateStr.slice(8)})</span>
                                                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, margin: '0 10px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                                                    </div>
                                                    <span style={{ width: 85, textAlign: 'right', color: mins > 480 ? G.danger : G.text, fontWeight: mins > 0 ? 600 : 400 }}>
                                                        {hrs}h / 8h {pct > 0 && `(${pct}%)`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Columns grid */}
                    {selectedMachine ? (
                        <div style={{
                            display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16,
                            scrollSnapType: 'x mandatory'
                        }}>
                            {/* 1. Unplanned Queue lane */}
                            <UnplannedColumn
                                id="unplanned"
                                tasks={unplannedTasks}
                                orderLookup={getOrder}
                                onUpdateTask={handleUpdateTask}
                                accent={machineAccent}
                            />

                            {/* 2. Days lanes */}
                            {weekDays.map(day => (
                                <DayColumn
                                    key={day.dateStr}
                                    id={`day-${day.dateStr}`}
                                    title={day.name}
                                    label={day.label}
                                    tasks={dailyTasksMap[day.dateStr] || []}
                                    orderLookup={getOrder}
                                    onUpdateTask={handleUpdateTask}
                                    accent={machineAccent}
                                />
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            textAlign: 'center', padding: '60px 24px',
                            background: G.glass, border: `1px dashed ${G.border}`, borderRadius: 14,
                        }}>
                            <p style={{ fontSize: 28, marginBottom: 8 }}>🖨️</p>
                            <p style={{ color: G.subtle, fontSize: 13 }}>No machine selected or available.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
                {activeTask && (
                    <div style={{
                        background: 'rgba(10,10,20,0.97)', backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10,
                        padding: '10px 14px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                        width: 220, cursor: 'grabbing',
                    }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', margin: 0, lineHeight: 1.4 }}>
                            {activeTask.name}
                        </p>
                        {getOrder(activeTask) && (
                            <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, letterSpacing: 0.4 }}>
                                {getOrder(activeTask).code} · {getOrder(activeTask).customer_name}
                            </span>
                        )}
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}
