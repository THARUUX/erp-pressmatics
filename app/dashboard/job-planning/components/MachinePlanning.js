'use client';
import { useState } from 'react';
import {
    DndContext, DragOverlay, closestCorners,
    PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const G = {
    glass: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.07)',
    borderHov: 'rgba(255,255,255,0.16)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
    dim: '#999999',
};

const STATUS_DOT = { pending: '#64748b', in_progress: '#f59e0b', done: '#10b981' };

const CAT_TABS = [
    { key: 'prepress',   label: 'Pre-press',  accent: '#94a3b8' },
    { key: 'offset',     label: 'Offset',     accent: '#f59e0b' },
    { key: 'digital',    label: 'Digital',    accent: '#a78bfa' },
    { key: 'finishing',  label: 'Finishing',  accent: '#10b981' },
    { key: 'unassigned', label: 'Unassigned', accent: '#ef4444' },
];

// ── SortableTask ──────────────────────────────────────────────────────────
function SortableTask({ task, order, accent }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `task-${task.id}`,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.2 : 1,
        cursor: 'grab',
        background: G.glass,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${G.border}`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 6,
        userSelect: 'none',
    };
    const dot = STATUS_DOT[task.status] || STATUS_DOT.pending;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <div style={{
                    width: 7, height: 7, borderRadius: '50%', background: dot,
                    boxShadow: task.status === 'done' ? `0 0 5px ${dot}` : 'none',
                    flexShrink: 0, marginTop: 5,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                        fontSize: 11, fontWeight: 600, color: task.status === 'done' ? G.subtle : G.text,
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        margin: 0, lineHeight: 1.4,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>{order?.estimation_names || order?.customer_name || ''}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{
                            fontSize: 9, fontWeight: 700, color: '#f59e0b',
                            background: 'rgba(245,158,11,0.1)', padding: '1px 6px',
                            borderRadius: 4, letterSpacing: 0.4, flexShrink: 0,
                        }}>{order?.code || '—'}</span>
                        <span style={{ fontSize: 10, color: G.subtle, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {task.name.split('—')[task.name.split('—').length - 1].trim()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── MachineColumn ─────────────────────────────────────────────────────────
function MachineColumn({ machine, tasks, orders, accent }) {
    const { isOver, setNodeRef } = useDroppable({ id: `machine-${machine.id}` });
    const taskIds = tasks.map(t => `task-${t.id}`);
    const getOrder = t => orders.find(o => o.id === t.sales_order_id);
    const done = tasks.filter(t => t.status === 'done').length;
    const pct = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;

    return (
        <div style={{
            background: isOver ? 'rgba(255,255,255,0.06)' : G.glass,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${isOver ? accent + '66' : G.border}`,
            borderTop: `2px solid ${accent}`,
            borderRadius: 14,
            padding: 14,
            transition: 'all 0.2s',
            boxShadow: isOver ? `0 0 24px ${accent}22` : 'none',
            minWidth: 320, width: 320, flexShrink: 0,
        }}>
            {/* Header */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a
                        href={`/machines/${machine.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open machine tracker"
                        style={{
                            fontSize: 12, fontWeight: 800, color: G.text, letterSpacing: '-0.2px',
                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                            textDecoration: 'none', cursor: 'pointer',
                            borderBottom: `1px dashed ${G.border}`,
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.target.style.color = accent}
                        onMouseLeave={e => e.target.style.color = G.text}
                    >{machine.name} ↗</a>
                    <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                        background: `${accent}18`, color: accent, border: `1px solid ${accent}33`, marginLeft: 4,
                    }}>{done}/{tasks.length}</span>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, marginTop: 8 }}>
                    <div style={{
                        height: '100%', width: `${pct}%`, background: accent,
                        borderRadius: 1, transition: 'width 0.4s',
                    }} />
                </div>
            </div>

            {/* Drop area */}
            <div ref={setNodeRef} style={{
                minHeight: 80, borderRadius: 8,
                padding: isOver ? 4 : 0,
                background: isOver ? 'rgba(255,255,255,0.02)' : 'transparent',
                border: isOver ? `1px dashed ${accent}44` : '1px dashed transparent',
                transition: 'all 0.2s',
            }}>
                <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                    {tasks.length === 0
                        ? <div style={{ padding: '20px 8px', textAlign: 'center', color: G.dim, fontSize: 11 }}>Drop tasks here</div>
                        : tasks.map(t => <SortableTask key={t.id} task={t} order={getOrder(t)} accent={accent} />)
                    }
                </SortableContext>
            </div>
        </div>
    );
}

// ── Unassigned Column ─────────────────────────────────────────────────────
function UnassignedColumn({ tasks, orders }) {
    const accent = '#ef4444';
    const { isOver, setNodeRef } = useDroppable({ id: 'machine-unassigned' });
    const taskIds = tasks.map(t => `task-${t.id}`);
    const getOrder = t => orders.find(o => o.id === t.sales_order_id);

    return (
        <div style={{
            background: 'rgba(239,68,68,0.03)', backdropFilter: 'blur(20px)',
            border: `1px solid ${isOver ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.15)'}`,
            borderTop: `2px solid ${accent}`,
            borderRadius: 14, padding: 14, transition: 'all 0.2s',
            minWidth: 220, width: 220, flexShrink: 0,
        }}>
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: accent }}>Unassigned</span>
                    <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: 'rgba(239,68,68,0.12)', color: accent,
                    }}>{tasks.length}</span>
                </div>
                <p style={{ fontSize: 9, color: G.subtle, margin: '4px 0 0' }}>Drag to assign a machine</p>
            </div>
            <div ref={setNodeRef} style={{ minHeight: 60 }}>
                <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                    {tasks.length === 0
                        ? <div style={{ padding: '20px 8px', textAlign: 'center', color: G.dim, fontSize: 11 }}>No unassigned tasks</div>
                        : tasks.map(t => <SortableTask key={t.id} task={t} order={getOrder(t)} accent={accent} />)
                    }
                </SortableContext>
            </div>
        </div>
    );
}

// PrepressPanel removed — prepress machines (e.g. CTP) now render as MachineColumn

// ── Main MachinePlanning ──────────────────────────────────────────────────
export default function MachinePlanning({ machines, orders }) {
    const [activeTab, setActiveTab] = useState('offset');
    const [activeTask, setActiveTask] = useState(null);

    const [tasksByMachine, setTasksByMachine] = useState(() => {
        const map = { unassigned: [] };
        machines.forEach(m => { map[m.id] = []; });
        orders.forEach(o => {
            (o.tasks || []).forEach(t => {
                const key = t.machine_id != null && map[t.machine_id] !== undefined
                    ? t.machine_id
                    : 'unassigned';
                if (!map[key]) map[key] = [];
                map[key].push(t);
            });
        });
        // Re-sort each machine bucket by machine_position so the global queue
        // order is preserved regardless of the order-grouping traversal above
        for (const key of Object.keys(map)) {
            if (key === 'unassigned') continue;
            map[key].sort((a, b) => {
                if (a.machine_position != null && b.machine_position != null)
                    return a.machine_position - b.machine_position;
                if (a.machine_position != null) return -1;
                if (b.machine_position != null) return 1;
                return 0;
            });
        }
        return map;
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const findContainer = (dndId) => {
        const taskId = parseInt(String(dndId).replace('task-', ''));
        for (const [key, tasks] of Object.entries(tasksByMachine)) {
            if (tasks.some(t => t.id === taskId)) return key;
        }
        return null;
    };

    const handleDragStart = ({ active }) => {
        const taskId = parseInt(String(active.id).replace('task-', ''));
        for (const tasks of Object.values(tasksByMachine)) {
            const found = tasks.find(t => t.id === taskId);
            if (found) { setActiveTask(found); return; }
        }
    };

    const handleDragEnd = async ({ active, over }) => {
        setActiveTask(null);
        if (!over) return;

        const srcKey = findContainer(active.id);
        const overId = String(over.id);
        let destKey;
        if (overId.startsWith('machine-')) {
            const raw = overId.replace('machine-', '');
            destKey = raw === 'unassigned' ? 'unassigned' : parseInt(raw);
        } else {
            destKey = findContainer(overId);
        }
        if (!srcKey || !destKey) return;

        const taskId = parseInt(String(active.id).replace('task-', ''));

        if (String(srcKey) === String(destKey)) {
            const items = [...(tasksByMachine[srcKey] || [])];
            const oldIdx = items.findIndex(t => t.id === taskId);
            if (oldIdx === -1) return;

            let newIdx;
            if (over.id.toString().startsWith('machine-')) {
                // Dropped on column container (empty space) → move to end
                newIdx = items.length - 1;
            } else {
                const overTaskId = parseInt(String(over.id).replace('task-', ''));
                newIdx = items.findIndex(t => t.id === overTaskId);
            }

            if (newIdx === -1 || oldIdx === newIdx) return;

            const reordered = arrayMove(items, oldIdx, newIdx);
            setTasksByMachine(prev => ({ ...prev, [srcKey]: reordered }));

            if (srcKey !== 'unassigned') {
                fetch(`/api/machines/${srcKey}/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskIds: reordered.map(t => t.id) }),
                }).catch(e => console.error('Reorder error:', e));
            }
            return;
        }

        // ── Cross-machine move ──────────────────────────────────────────────
        const srcItems = [...(tasksByMachine[srcKey] || [])];
        const destItems = [...(tasksByMachine[destKey] || [])];
        const taskIdx = srcItems.findIndex(t => t.id === taskId);
        if (taskIdx === -1) return;

        const [movedTask] = srcItems.splice(taskIdx, 1);
        const newMachineId = destKey === 'unassigned' ? null : destKey;
        const newMachineName = newMachineId ? (machines.find(m => m.id === newMachineId)?.name || null) : null;
        movedTask.machine_id = newMachineId;
        movedTask.machine_name = newMachineName;
        destItems.push(movedTask);
        setTasksByMachine(prev => ({ ...prev, [srcKey]: srcItems, [destKey]: destItems }));

        try {
            await fetch(`/api/sales-orders/${movedTask.sales_order_id}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ machine_id: newMachineId, machine_name: newMachineName }),
            });
            if (newMachineId) {
                await fetch(`/api/machines/${newMachineId}/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskIds: destItems.map(t => t.id) }),
                });
            }
            if (srcKey !== 'unassigned') {
                await fetch(`/api/machines/${srcKey}/reorder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskIds: srcItems.map(t => t.id) }),
                });
            }
        } catch (e) { console.error('Task reassign error:', e); }
    };


    const activeOrder = activeTask ? orders.find(o => o.id === activeTask.sales_order_id) : null;

    // Tab counts
    const tabCounts = CAT_TABS.map(tab => {
        if (tab.key === 'prepress') return 0;
        if (tab.key === 'unassigned') return (tasksByMachine['unassigned'] || []).length;
        const catMachines = machines.filter(m => (m.type || '').toLowerCase() === tab.key);
        return catMachines.reduce((a, m) => a + (tasksByMachine[m.id] || []).length, 0);
    });

    const activeCat = CAT_TABS.find(t => t.key === activeTab);
    const catMachines = machines.filter(m => (m.type || '').toLowerCase() === activeTab);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveTask(null)}
        >
            {/* ── Tab Bar ── */}
            <div style={{
                display: 'flex', gap: 2, marginBottom: 24,
                background: G.glass, backdropFilter: 'blur(12px)',
                border: `1px solid ${G.border}`, borderRadius: 12,
                padding: 4, width: 'fit-content',
            }}>
                {CAT_TABS.map((tab, i) => {
                    const isActive = activeTab === tab.key;
                    const count = tabCounts[i];
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 7,
                                padding: '8px 18px', borderRadius: 9, cursor: 'pointer',
                                border: 'none', fontFamily: 'Inter, sans-serif',
                                fontWeight: isActive ? 700 : 500, fontSize: 12,
                                color: isActive ? tab.accent : G.subtle,
                                background: isActive ? `${tab.accent}14` : 'transparent',
                                boxShadow: isActive ? `0 0 0 1px ${tab.accent}33` : 'none',
                                transition: 'all 0.18s',
                            }}
                        >
                            {tab.label}
                            {count > 0 && (
                                <span style={{
                                    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                                    background: isActive ? `${tab.accent}25` : 'rgba(255,255,255,0.06)',
                                    color: isActive ? tab.accent : G.dim,
                                    border: `1px solid ${isActive ? tab.accent + '44' : G.border}`,
                                    minWidth: 18, textAlign: 'center',
                                }}>{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Tab Content ── */}
            {activeTab === 'unassigned' && (
                <div style={{ display: 'flex', gap: 14 }}>
                    <UnassignedColumn tasks={tasksByMachine['unassigned'] || []} orders={orders} />
                </div>
            )}

            {['prepress', 'offset', 'digital', 'finishing'].includes(activeTab) && (
                <>
                    {catMachines.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '48px 24px',
                            background: G.glass, border: `1px dashed ${G.border}`, borderRadius: 14,
                        }}>
                            <p style={{ color: G.subtle, fontSize: 13 }}>
                                No {activeCat?.label} machines configured.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12 }}>
                            {catMachines.map(m => (
                                <MachineColumn
                                    key={m.id}
                                    machine={m}
                                    tasks={tasksByMachine[m.id] || []}
                                    orders={orders}
                                    accent={activeCat?.accent || '#94a3b8'}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ── Drag Overlay ── */}
            <DragOverlay>
                {activeTask && (
                    <div style={{
                        background: 'rgba(10,10,20,0.97)', backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10,
                        padding: '10px 14px', boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                        width: 230, cursor: 'grabbing',
                    }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', margin: 0, lineHeight: 1.4 }}>
                            {activeTask.name}
                        </p>
                        {activeOrder && (
                            <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, letterSpacing: 0.4 }}>
                                {activeOrder.code} · {activeOrder.customer_name}
                            </span>
                        )}
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}
