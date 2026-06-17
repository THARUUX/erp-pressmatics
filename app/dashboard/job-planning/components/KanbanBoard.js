'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
    DndContext, DragOverlay, closestCorners,
    PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';

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

const STATUS_CFG = {
    'Pending':       { accent: '#f59e0b', glow: 'rgba(245,158,11,0.12)' },
    'In Production': { accent: '#a78bfa', glow: 'rgba(167,139,250,0.12)' },
    'Ready':         { accent: '#10b981', glow: 'rgba(16,185,129,0.12)' },
};

function urgencyColor(d) {
    if (!d) return null;
    const diff = (new Date(d) - Date.now()) / 86400000;
    if (diff < 0) return '#ef4444';
    if (diff <= 1) return '#f97316';
    if (diff <= 3) return '#f59e0b';
    return '#10b981';
}

function DraggableCard({ order, isDragging }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(order.id) });
    const done = order.tasks.filter(t => t.status === 'done').length;
    const total = order.tasks.length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const uc = urgencyColor(order.delivery_date);
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
                    {order.estimation_names && (
                        <p style={{ fontSize: 13, fontWeight: 800, color: G.text, margin: '0 0 2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {order.estimation_names}
                        </p>
                    )}
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11, color: G.subtle }}>{order.code}</span>
                </div>
                {uc && order.delivery_date && (
                    <span style={{ fontSize: 11, color: uc, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                        {new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                )}
            </div>
            <p style={{ fontSize: 11, color: G.muted, margin: '0 0 2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{order.customer_name}</p>
            {total > 0 && (
                <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: G.subtle, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tasks</span>
                        <span style={{ fontSize: 10, color: pct === 100 ? '#10b981' : G.muted, fontWeight: 700 }}>{done}/{total}</span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10b981' : 'linear-gradient(90deg,#a78bfa,#10b981)', borderRadius: 2, transition: 'width 0.4s' }} />
                    </div>
                </div>
            )}
            <Link
                href={`/dashboard/sales-orders/${order.id}`}
                onClick={e => e.stopPropagation()}
                style={{ display: 'inline-block', marginTop: 8, fontSize: 10, color: G.subtle, textDecoration: 'none', letterSpacing: 0.4 }}
            >
                View Order →
            </Link>
        </div>
    );
}

function DroppableColumn({ status, orders, activeId }) {
    const cfg = STATUS_CFG[status] || { accent: '#64748b', glow: 'rgba(100,116,139,0.1)' };
    const { isOver, setNodeRef } = useDroppable({ id: status });
    return (
        <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: `2px solid ${cfg.accent}33` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.accent, boxShadow: `0 0 8px ${cfg.accent}` }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: cfg.accent, textTransform: 'uppercase', letterSpacing: 1 }}>{status}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.glow, color: cfg.accent, border: `1px solid ${cfg.accent}33` }}>
                    {orders.length}
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
                {orders.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: G.subtle, fontSize: 12 }}>
                        Drop orders here
                    </div>
                ) : (
                    orders.map(o => <DraggableCard key={o.id} order={o} isDragging={String(o.id) === activeId} />)
                )}
            </div>
        </div>
    );
}

export default function KanbanBoard({ orders, onOrderMoved }) {
    const [activeId, setActiveId] = useState(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const STATUSES = ['Pending', 'In Production', 'Ready'];
    const grouped = {};
    STATUSES.forEach(s => { grouped[s] = []; });
    orders.forEach(o => {
        if (STATUSES.includes(o.status)) grouped[o.status].push(o);
    });

    const activeOrder = activeId ? orders.find(o => String(o.id) === activeId) : null;

    const handleDragEnd = async ({ active, over }) => {
        setActiveId(null);
        if (!over || !active) return;
        const newStatus = over.id;
        const orderId = parseInt(active.id);
        const order = orders.find(o => o.id === orderId);
        if (!order || order.status === newStatus || !STATUSES.includes(newStatus)) return;
        onOrderMoved(orderId, newStatus);
        try {
            await fetch(`/api/sales-orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
        } catch (e) { console.error('Status update failed:', e); }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={({ active }) => setActiveId(String(active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
        >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                {STATUSES.map(status => (
                    <DroppableColumn key={status} status={status} orders={grouped[status] || []} activeId={activeId} />
                ))}
            </div>
            <DragOverlay>
                {activeOrder ? (
                    <div style={{
                        background: 'rgba(15,15,30,0.95)', backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '14px 16px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6)', width: 260,
                    }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{activeOrder.code}</span>
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>{activeOrder.customer_name}</p>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
