'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    DndContext, DragOverlay, closestCorners,
    PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { FiUser, FiInfo, FiLayers, FiDollarSign } from 'react-icons/fi';

const G = {
    bg: '#070710',
    glass: 'rgba(255,255,255,0.04)',
    glassHov: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.07)',
    borderHov: 'rgba(255,255,255,0.15)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
    dim: '#1e293b',
};

const COLUMN_CFG = {
    'pending': { label: 'Unassigned / Backlog', accent: '#f59e0b', glow: 'rgba(245,158,11,0.12)' },
    'in_progress': { label: 'Scheduled / In Progress', accent: '#a78bfa', glow: 'rgba(167,139,250,0.12)' },
    'done': { label: 'Completed', accent: '#10b981', glow: 'rgba(16,185,129,0.12)' }
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

function DraggableTaskCard({ task, employees, isDragging, onEmployeeChange }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(task.id) });
    const serviceName = extractServiceName(task.name);
    const details = parseDescription(task.description);

    const style = {
        transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        background: G.glass,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${G.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 10,
        transition: 'border-color 0.2s',
        userSelect: 'none',
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: G.text, margin: '0 0 2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {serviceName}
                    </h4>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11, color: G.subtle }}>
                        SO #{task.order_code || task.sales_order_id}
                    </span>
                </div>
            </div>
            
            <p style={{ fontSize: 11, color: G.muted, margin: '0 0 8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {task.customer_name}
            </p>

            {/* Service cost details */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '4px 12px',
                fontSize: 10, color: G.subtle, margin: '8px 0',
                padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)'
            }}>
                {details.unit && <div>Unit: <span style={{ color: G.muted }}>{details.unit}</span></div>}
                {details.rate !== undefined && <div>Rate: <span style={{ color: G.muted }}>LKR {details.rate.toFixed(2)}</span></div>}
                {details.multiply_by !== undefined && <div>Qty: <span style={{ color: G.muted }}>{details.multiply_by}</span></div>}
                {details.total_cost !== undefined && (
                    <div style={{ width: '100%', marginTop: 2, display: 'flex', alignItems: 'center', color: '#10b981', fontWeight: 600 }}>
                        LKR {details.total_cost.toFixed(2)}
                    </div>
                )}
            </div>

            {details.note && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '6px 0', fontSize: 10, color: '#f59e0b' }}>
                    <FiInfo style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{details.note}</span>
                </div>
            )}

            {/* Employee assignment dropdown */}
            <div 
                style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}
                onPointerDown={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
            >
                <FiUser style={{ fontSize: 12, color: G.subtle }} />
                <select
                    value={task.assigned_to || ''}
                    onChange={e => onEmployeeChange(task, e.target.value)}
                    style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${G.border}`,
                        borderRadius: 6,
                        color: G.text,
                        fontSize: 11,
                        padding: '4px 6px',
                        outline: 'none',
                        cursor: 'pointer',
                    }}
                >
                    <option value="">Unassigned</option>
                    {employees.map(emp => (
                        <option key={emp} value={emp}>{emp}</option>
                    ))}
                </select>
            </div>

            <Link
                href={`/dashboard/sales-orders/${task.sales_order_id}`}
                onClick={e => e.stopPropagation()}
                style={{ display: 'inline-block', marginTop: 12, fontSize: 10, color: G.subtle, textDecoration: 'none', letterSpacing: 0.4 }}
            >
                View Order →
            </Link>
        </div>
    );
}

function DroppableColumn({ status, tasks, employees, activeId, onEmployeeChange }) {
    const cfg = COLUMN_CFG[status];
    const { isOver, setNodeRef } = useDroppable({ id: status });
    return (
        <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: `2px solid ${cfg.accent}33` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}` }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: cfg.accent, textTransform: 'uppercase', letterSpacing: 1 }}>{cfg.label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.glow, color: cfg.accent, border: `1px solid ${cfg.accent}33` }}>
                    {tasks.length}
                </span>
            </div>
            <div
                ref={setNodeRef}
                style={{
                    minHeight: 120, borderRadius: 12, padding: 8,
                    background: isOver ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: isOver ? `2px dashed ${cfg.accent}55` : '2px dashed transparent',
                    transition: 'all 0.2s',
                }}
            >
                {tasks.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: G.subtle, fontSize: 12 }}>
                        Drop tasks here
                    </div>
                ) : (
                    tasks.map(t => (
                        <DraggableTaskCard 
                            key={t.id} 
                            task={t} 
                            employees={employees} 
                            isDragging={String(t.id) === activeId} 
                            onEmployeeChange={onEmployeeChange}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default function ServicesPlanning() {
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [servicesList, setServicesList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeId, setActiveId] = useState(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/job-planning/services');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setTasks(data.tasks || []);
            setEmployees(data.employees || []);

            const sRes = await fetch('/api/services');
            if (sRes.ok) {
                const sData = await sRes.json();
                setServicesList(sData || []);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleEmployeeChange = async (task, newEmployee) => {
        // Optimistically update employee name in task list
        const serviceName = extractServiceName(task.name);
        const updatedName = newEmployee ? `Service: ${serviceName} — ${newEmployee}` : `Service: ${serviceName}`;
        
        setTasks(prev => prev.map(t => t.id === task.id ? { 
            ...t, 
            assigned_to: newEmployee || null,
            name: updatedName
        } : t));

        try {
            await fetch(`/api/sales-orders/${task.sales_order_id}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    assigned_to: newEmployee || null,
                    name: updatedName
                }),
            });
        } catch (e) {
            console.error('Failed to update employee assignment:', e);
        }
    };

    const handleDragEnd = async ({ active, over }) => {
        setActiveId(null);
        if (!over || !active) return;
        const newStatus = over.id;
        const taskId = parseInt(active.id);
        const task = tasks.find(t => t.id === taskId);
        
        if (!task || task.status === newStatus) return;

        // Optimistically update status
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

        try {
            await fetch(`/api/sales-orders/${task.sales_order_id}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
        } catch (e) {
            console.error('Failed to update task status:', e);
            // Revert on error
            loadData();
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    border: `2px solid ${G.border}`, borderTop: `2px solid ${G.muted}`,
                    margin: '0 auto 16px', animation: 'spin 0.9s linear infinite',
                }} />
                <p style={{ color: G.subtle, fontSize: 13 }}>Loading services planning board…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 12, padding: '20px 24px', color: '#f87171', fontSize: 13,
            }}>
                Error: {error}
            </div>
        );
    }

    const grouped = { pending: [], in_progress: [], done: [] };
    tasks.forEach(t => {
        if (grouped[t.status]) {
            grouped[t.status].push(t);
        } else {
            grouped.pending.push(t); // Default fallback
        }
    });

    const activeTask = activeId ? tasks.find(t => String(t.id) === activeId) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Quick Service Links */}
            {servicesList.length > 0 && (
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: G.glass, border: `1px solid ${G.border}`, borderRadius: 12,
                    padding: '14px 20px',
                }}>
                    <span style={{ fontSize: 13, color: G.muted, fontWeight: 400 }}>
                        Looking for employee payroll, work reports, or time logs?
                    </span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <select
                            onChange={e => {
                                if (e.target.value) {
                                    window.location.href = `/dashboard/services/${e.target.value}/planning`;
                                }
                            }}
                            style={{
                                background: 'rgba(0,0,0,0.4)', border: `1px solid ${G.border}`,
                                borderRadius: 8, color: G.text, fontSize: 12,
                                padding: '8px 16px', outline: 'none', cursor: 'pointer',
                                transition: 'border-color 0.2s',
                            }}
                        >
                            <option value="">Select Service Dashboard...</option>
                            {servicesList.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={({ active }) => setActiveId(String(active.id))}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                    {Object.keys(COLUMN_CFG).map(status => (
                        <DroppableColumn 
                            key={status} 
                            status={status} 
                            tasks={grouped[status]} 
                            employees={employees}
                            activeId={activeId} 
                            onEmployeeChange={handleEmployeeChange}
                        />
                    ))}
                </div>
                <DragOverlay>
                    {activeTask ? (
                        <div style={{
                            background: 'rgba(15,15,30,0.95)', backdropFilter: 'blur(24px)',
                            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '14px 16px',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.6)', width: 260,
                        }}>
                            <h4 style={{ fontSize: 12, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
                                {extractServiceName(activeTask.name)}
                            </h4>
                            <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 0' }}>
                                {activeTask.customer_name}
                            </p>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
