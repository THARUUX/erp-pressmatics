'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiSearch, FiX } from 'react-icons/fi';

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
    'Pending':       { accent: '#ffffff', glow: 'rgba(245,158,11,0.12)' },
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

function DraggableCard({
    order,
    isDragging,
    onDragStart,
    onDragEnd,
    draggedOrderId,
    dragOverOrderId,
    dragOverPosition,
    onDragOverCard,
    onDragLeaveCard,
    onDropCard,
    status
}) {
    const done = order.tasks.filter(t => t.status === 'done').length;
    const total = order.tasks.length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const uc = urgencyColor(order.delivery_date);
    const cfg = STATUS_CFG[status] || { accent: '#64748b' };
    const style = {
        opacity: isDragging ? 0.25 : 1,
        cursor: 'grab',
        background: G.glass,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${G.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 10,
        transition: 'border-color 0.2s',
        userSelect: 'none',
        position: 'relative',
    };
    return (
        <div
            draggable="true"
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOverCard}
            onDragLeave={onDragLeaveCard}
            onDrop={onDropCard}
            style={style}
        >
            {dragOverOrderId === order.id && dragOverPosition === 'before' && (
                <div
                    className="animate-pulse"
                    style={{
                        position: 'absolute',
                        top: -6,
                        left: 0,
                        right: 0,
                        height: 3,
                        borderRadius: 2,
                        zIndex: 99,
                        backgroundColor: cfg.accent,
                    }}
                />
            )}
            {dragOverOrderId === order.id && dragOverPosition === 'after' && (
                <div
                    className="animate-pulse"
                    style={{
                        position: 'absolute',
                        bottom: -6,
                        left: 0,
                        right: 0,
                        height: 3,
                        borderRadius: 2,
                        zIndex: 99,
                        backgroundColor: cfg.accent,
                    }}
                />
            )}

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

function DroppableColumn({
    status,
    orders,
    draggedOrderId,
    dragOverStatus,
    setDragOverStatus,
    dragOverOrderId,
    dragOverPosition,
    onDragOverCard,
    onDragLeaveCard,
    onDrop,
    onDragStartCard,
    onDragEndCard
}) {
    const cfg = STATUS_CFG[status] || { accent: '#64748b', glow: 'rgba(100,116,139,0.1)' };
    const isOver = dragOverStatus === status;

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        setDragOverStatus(status);
    };

    const getSortTime = (dateStr) => {
        if (!dateStr) return 0;
        const t = new Date(dateStr).getTime();
        return isNaN(t) ? 0 : t;
    };

    const sortWithFallback = (list) => {
        return [...list].sort((a, b) => {
            const posA = a.kanban_position != null ? a.kanban_position : 999999;
            const posB = b.kanban_position != null ? b.kanban_position : 999999;
            if (posA !== posB) return posA - posB;
            
            const da = getSortTime(a.delivery_date);
            const db = getSortTime(b.delivery_date);
            if (da !== db) return da - db;
            return b.id - a.id;
        });
    };

    const displayOrders = sortWithFallback(orders);

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
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDrop={(e) => {
                    e.preventDefault();
                    onDrop(draggedOrderId, status);
                }}
                style={{
                    minHeight: 120, borderRadius: 12, padding: 8,
                    background: isOver ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: isOver ? `2px dashed ${cfg.accent}55` : '2px dashed transparent',
                    transition: 'all 0.2s',
                }}
            >
                {displayOrders.length === 0 ? (
                    <div style={{ padding: '28px 16px', textAlign: 'center', color: G.subtle, fontSize: 12 }}>
                        Drop orders here
                    </div>
                ) : (
                    displayOrders.map(o => (
                        <DraggableCard
                            key={o.id}
                            order={o}
                            isDragging={o.id === draggedOrderId}
                            onDragStart={(e) => onDragStartCard(e, o.id)}
                            onDragEnd={onDragEndCard}
                            draggedOrderId={draggedOrderId}
                            dragOverOrderId={dragOverOrderId}
                            dragOverPosition={dragOverPosition}
                            onDragOverCard={onDragOverCard}
                            onDragLeaveCard={onDragLeaveCard}
                            onDropCard={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDrop(draggedOrderId, status, o.id, dragOverPosition);
                            }}
                            status={status}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default function KanbanBoard({ orders, onOrderMoved }) {
    const [localOrders, setLocalOrders] = useState(orders);
    const [draggedOrderId, setDraggedOrderId] = useState(null);
    const [dragOverStatus, setDragOverStatus] = useState(null);
    const [dragOverOrderId, setDragOverOrderId] = useState(null);
    const [dragOverPosition, setDragOverPosition] = useState(null);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('all');

    useEffect(() => {
        setLocalOrders(orders);
    }, [orders]);

    const STATUSES = ['Pending', 'In Production', 'Ready'];

    // Filter calculations
    const isToday = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    const isOverdue = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        return d < today;
    };

    const isThisWeek = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        return d >= today && d <= nextWeek;
    };

    const filteredOrders = localOrders.filter(o => {
        // 1. Text Search Filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const matchesText = (
                (o.code || '').toLowerCase().includes(term) ||
                (o.customer_name || '').toLowerCase().includes(term) ||
                (o.estimation_names || '').toLowerCase().includes(term)
            );
            if (!matchesText) return false;
        }

        // 2. Date Filter
        if (dateFilter === 'overdue') {
            return isOverdue(o.delivery_date) && o.status !== 'Ready';
        }
        if (dateFilter === 'today') {
            return isToday(o.delivery_date);
        }
        if (dateFilter === 'week') {
            return isThisWeek(o.delivery_date);
        }
        if (dateFilter === 'future') {
            const d = new Date(o.delivery_date);
            const today = new Date();
            today.setHours(0,0,0,0);
            const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            return d > nextWeek;
        }
        if (dateFilter === 'unscheduled') {
            return !o.delivery_date;
        }

        return true;
    });

    const grouped = {};
    STATUSES.forEach(s => { grouped[s] = []; });
    filteredOrders.forEach(o => {
        if (STATUSES.includes(o.status)) grouped[o.status].push(o);
    });

    const arrayMove = (arr, fromIndex, toIndex) => {
        const element = arr[fromIndex];
        const newArr = [...arr];
        newArr.splice(fromIndex, 1);
        if (toIndex > fromIndex) {
            toIndex = toIndex - 1;
        }
        newArr.splice(toIndex, 0, element);
        return newArr;
    };

    const handleDragStartCard = (e, orderId) => {
        setDraggedOrderId(orderId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(orderId));
    };

    const handleDragEndCard = () => {
        setDraggedOrderId(null);
        setDragOverStatus(null);
        setDragOverOrderId(null);
        setDragOverPosition(null);
    };

    const handleDragOverCard = (e, cardId) => {
        if (draggedOrderId === cardId) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const isUpper = relativeY < rect.height / 2;

        setDragOverOrderId(cardId);
        setDragOverPosition(isUpper ? 'before' : 'after');
    };

    const handleDragLeaveCard = () => {
        setDragOverOrderId(null);
        setDragOverPosition(null);
    };

    const handleDrop = async (draggedId, overId, targetOrderId = null, dragPosition = null) => {
        setDraggedOrderId(null);
        setDragOverStatus(null);
        setDragOverOrderId(null);
        setDragOverPosition(null);

        if (!draggedId) return;

        const orderId = parseInt(draggedId);
        const originalOrder = localOrders.find(o => o.id === orderId);
        if (!originalOrder) return;

        let newStatus = overId;

        if (targetOrderId) {
            const targetOrder = localOrders.find(o => o.id === targetOrderId);
            if (targetOrder) {
                newStatus = targetOrder.status;
            }
        }

        const containerChanged = originalOrder.status !== newStatus;

        // 1. Gather all orders for each column
        const lists = {
            'Pending': [],
            'In Production': [],
            'Ready': [],
        };

        localOrders.forEach(order => {
            const status = order.id === orderId ? newStatus : order.status;
            if (lists[status]) {
                lists[status].push({
                    ...order,
                    ...(order.id === orderId ? { status: newStatus } : {})
                });
            }
        });

        // 2. Sort each container by current kanban_position / fallback delivery_date
        const getSortTime = (dateStr) => {
            if (!dateStr) return 0;
            const t = new Date(dateStr).getTime();
            return isNaN(t) ? 0 : t;
        };

        const sortWithFallback = list => {
            return list.sort((a, b) => {
                const isAActiveChanged = a.id === orderId && containerChanged;
                const isBActiveChanged = b.id === orderId && containerChanged;

                const posA = isAActiveChanged ? 999999 : (a.kanban_position != null ? a.kanban_position : 999999);
                const posB = isBActiveChanged ? 999999 : (b.kanban_position != null ? b.kanban_position : 999999);
                if (posA !== posB) return posA - posB;

                const dateA = getSortTime(a.delivery_date);
                const dateB = getSortTime(b.delivery_date);
                if (dateA !== dateB) return dateA - dateB;

                return b.id - a.id;
            });
        };

        Object.keys(lists).forEach(statusKey => {
            sortWithFallback(lists[statusKey]);
        });

        // 3. If targetOrderId is specified, find it and splice/reorder the list
        if (targetOrderId) {
            const list = lists[newStatus] || [];
            const oldIndex = list.findIndex(o => o.id === orderId);
            let newIndex = list.findIndex(o => o.id === targetOrderId);
            if (oldIndex !== -1 && newIndex !== -1) {
                if (dragPosition === 'after') {
                    newIndex = newIndex + 1;
                }
                const moved = arrayMove(list, oldIndex, newIndex);
                lists[newStatus] = moved;
            }
        }

        // 4. Map of orderId -> new position
        const positionMap = {};
        Object.keys(lists).forEach(statusKey => {
            lists[statusKey].forEach((order, idx) => {
                positionMap[order.id] = idx + 1;
            });
        });

        // 5. Optimistically update state
        const updatedOrders = localOrders.map(o => {
            const newPos = positionMap[o.id];
            const isDraggedOrder = o.id === orderId;
            return {
                ...o,
                status: isDraggedOrder ? newStatus : o.status,
                kanban_position: newPos !== undefined ? newPos : o.kanban_position,
            };
        });

        setLocalOrders(updatedOrders);
        onOrderMoved(orderId, newStatus, updatedOrders);

        // 6. Persist to DB
        try {
            await fetch(`/api/sales-orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    kanban_position: positionMap[orderId] || null,
                }),
            });

            const targetList = lists[newStatus] || [];
            for (const item of targetList) {
                if (item.id === orderId) continue;
                await fetch(`/api/sales-orders/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        kanban_position: positionMap[item.id],
                    }),
                });
            }

            if (containerChanged) {
                const sourceList = lists[originalOrder.status] || [];
                for (const item of sourceList) {
                    await fetch(`/api/sales-orders/${item.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            kanban_position: positionMap[item.id],
                        }),
                    });
                }
            }
        } catch (e) {
            console.error('Reorder update failed:', e);
            setLocalOrders(orders);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Filter Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
            }}>
                {/* Search Input Container */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: G.glass,
                    border: `1px solid ${G.border}`,
                    borderRadius: 10,
                    padding: '8px 14px',
                    width: 260,
                    position: 'relative',
                }}>
                    <FiSearch style={{ color: G.subtle, fontSize: 14 }} />
                    <input
                        type="text"
                        placeholder="Filter by code, customer, items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: G.text,
                            fontSize: 12,
                            fontFamily: 'Inter, sans-serif',
                        }}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: G.subtle,
                                cursor: 'pointer',
                                fontSize: 12,
                                display: 'flex',
                                alignItems: 'center',
                                padding: 0,
                            }}
                        >
                            <FiX style={{ fontSize: 14 }} />
                        </button>
                    )}
                </div>

                {/* Date Dropdown */}
                <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    style={{
                        background: G.glass,
                        border: `1px solid ${G.border}`,
                        borderRadius: 10,
                        padding: '8px 12px',
                        color: G.text,
                        fontSize: 12,
                        outline: 'none',
                        cursor: 'pointer',
                        fontFamily: 'Inter, sans-serif',
                        height: 36,
                    }}
                >
                    <option value="all" style={{ background: '#0e0e20', color: '#fff' }}>All Dates</option>
                    <option value="overdue" style={{ background: '#0e0e20', color: '#ff6b6b' }}>Overdue</option>
                    <option value="today" style={{ background: '#0e0e20', color: '#fff' }}>Due Today</option>
                    <option value="week" style={{ background: '#0e0e20', color: '#fff' }}>Due This Week</option>
                    <option value="future" style={{ background: '#0e0e20', color: '#fff' }}>Future Dates</option>
                    <option value="unscheduled" style={{ background: '#0e0e20', color: '#fff' }}>Unscheduled</option>
                </select>
            </div>

            {/* Columns Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                {STATUSES.map(status => (
                    <DroppableColumn
                        key={status}
                        status={status}
                        orders={grouped[status] || []}
                        draggedOrderId={draggedOrderId}
                        dragOverStatus={dragOverStatus}
                        setDragOverStatus={setDragOverStatus}
                        dragOverOrderId={dragOverOrderId}
                        dragOverPosition={dragOverPosition}
                        onDragOverCard={handleDragOverCard}
                        onDragLeaveCard={handleDragLeaveCard}
                        onDrop={handleDrop}
                        onDragStartCard={handleDragStartCard}
                        onDragEndCard={handleDragEndCard}
                    />
                ))}
            </div>
        </div>
    );
}
