'use client';

import { use, useState, useEffect, useCallback } from 'react';

const G = {
    bg: '#07070f',
    glass: 'rgba(255,255,255,0.04)',
    glassMed: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.07)',
    borderStr: 'rgba(255,255,255,0.13)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
    dim: '#334155',
};

const STATUS = {
    pending:     { dot: '#64748b', glow: '#64748b22', text: '#94a3b8', label: 'Pending' },
    in_progress: { dot: '#f59e0b', glow: '#f59e0b22', text: '#fbbf24', label: 'In Progress' },
    done:        { dot: '#10b981', glow: '#10b98122', text: '#34d399', label: 'Done' },
};

const CAT_ACCENT = {
    prepress:  '#94a3b8',
    offset:    '#f59e0b',
    digital:   '#a78bfa',
    finishing: '#10b981',
};

const ORDER_STATUS_COLOR = {
    Pending: '#f59e0b', 'In Production': '#a78bfa',
    Ready: '#10b981', Delivered: '#6366f1', Cancelled: '#ef4444',
};

function toLocalDt(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function nowDt() { return toLocalDt(new Date().toISOString()); }

// ── TaskRow ───────────────────────────────────────────────────────────────
function TaskRow({ task, onUpdated }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(task.status);
    const [completedAt, setCompletedAt] = useState(toLocalDt(task.completed_at) || nowDt());
    const [completedBy, setCompletedBy] = useState(task.completed_by || '');

    const st = STATUS[status] || STATUS.pending;

    const save = async (forceStatus) => {
        setSaving(true);
        const s = forceStatus || status;
        try {
            const res = await fetch(`/api/sales-orders/${task.sales_order_id}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: s,
                    completed_at: s === 'done' ? new Date(completedAt).toISOString() : null,
                    completed_by: completedBy || null,
                }),
            });
            const updated = await res.json();
            if (updated.error) throw new Error(updated.error);
            setStatus(updated.status);
            setOpen(false);
            onUpdated(task.id, updated.status, updated.completed_by, updated.completed_at);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const toggle = () => {
        if (open) {
            setOpen(false);
            setStatus(task.status);
        } else if (status === 'done') {
            save('pending');
        } else {
            setOpen(true);
        }
    };

    return (
        <div style={{ marginBottom: 6 }}>
            <button onClick={toggle} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                background: open ? 'rgba(255,255,255,0.06)' : G.glass,
                backdropFilter: 'blur(12px)',
                border: `1px solid ${open ? G.borderStr : G.border}`,
                borderRadius: open ? '12px 12px 0 0' : 12,
                padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.18s',
            }}>
                {/* Status indicator */}
                <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${st.dot}`,
                    background: status === 'done' ? st.dot : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: status === 'done' ? `0 0 8px ${st.dot}66` : 'none',
                    transition: 'all 0.2s',
                }}>
                    {status === 'done' && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                    {status === 'in_progress' && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, boxShadow: `0 0 5px ${st.dot}` }} />
                    )}
                </div>

                {/* Task name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                        fontSize: 13, fontWeight: 600, margin: 0,
                        color: status === 'done' ? G.subtle : G.text,
                        textDecoration: status === 'done' ? 'line-through' : 'none',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>{task.name}</p>
                    {task.description && (
                        <p style={{ fontSize: 10, color: G.subtle, margin: '2px 0 0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {task.description}
                        </p>
                    )}
                    {status === 'done' && task.completed_by && (
                        <p style={{ fontSize: 10, color: STATUS.done.text, margin: '2px 0 0' }}>
                            ✓ {task.completed_by}
                            {task.completed_at && ` · ${new Date(task.completed_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}`}
                        </p>
                    )}
                </div>

                {/* Badge */}
                <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: st.glow, color: st.text, border: `1px solid ${st.dot}33`,
                    textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
                }}>{st.label}</span>

                {open
                    ? <span style={{ color: G.subtle, fontSize: 12, flexShrink: 0 }}>✕</span>
                    : status !== 'done' && <span style={{ color: G.dim, fontSize: 14, flexShrink: 0 }}>⌄</span>
                }
            </button>

            {/* Expand panel */}
            {open && (
                <div style={{
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
                    border: `1px solid ${G.borderStr}`, borderTop: 'none',
                    borderRadius: '0 0 12px 12px', padding: '16px',
                    display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                    {/* Status buttons */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        {Object.entries(STATUS).map(([s, cfg]) => (
                            <button key={s} onClick={() => setStatus(s)} style={{
                                flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                                fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5,
                                border: `1px solid ${status === s ? cfg.dot : 'transparent'}`,
                                background: status === s ? `${cfg.dot}22` : 'rgba(255,255,255,0.03)',
                                color: status === s ? cfg.text : G.subtle,
                                transition: 'all 0.15s',
                            }}>{cfg.label}</button>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: G.subtle, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Date & Time</label>
                            <input type="datetime-local" value={completedAt} onChange={e => setCompletedAt(e.target.value)} style={{
                                width: '100%', background: 'rgba(255,255,255,0.04)',
                                border: `1px solid ${G.border}`, borderRadius: 8,
                                padding: '9px 10px', color: G.text, fontSize: 12,
                                outline: 'none', boxSizing: 'border-box', colorScheme: 'dark',
                            }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: G.subtle, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Completed By</label>
                            <input type="text" value={completedBy} placeholder="Name / Team" onChange={e => setCompletedBy(e.target.value)} style={{
                                width: '100%', background: 'rgba(255,255,255,0.04)',
                                border: `1px solid ${G.border}`, borderRadius: 8,
                                padding: '9px 10px', color: G.text, fontSize: 12,
                                outline: 'none', boxSizing: 'border-box',
                            }} />
                        </div>
                    </div>

                    <button onClick={() => save()} disabled={saving} style={{
                        padding: '11px 0', borderRadius: 8, border: `1px solid ${G.borderStr}`,
                        background: saving ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(12px)', color: G.text,
                        fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                    }}>
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ── QueueTask — flat row for the machine page ─────────────────────────────
function QueueTask({ task, order, accent, onUpdated, machine }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(task.status);
    const [completedAt, setCompletedAt] = useState(toLocalDt(task.completed_at) || nowDt());
    const [completedBy, setCompletedBy] = useState(task.completed_by || '');

    const st = STATUS[status] || STATUS.pending;
    const soColor = ORDER_STATUS_COLOR[order?.status] || '#64748b';

    // Estimated time: quantity ÷ speed
    const speedUnit = (machine?.speed_unit || '').toLowerCase();
    const isSheetSpeed = speedUnit.includes('sheet');
    const isUnitSpeed  = speedUnit.includes('unit');

    // ── Display quantity ──────────────────────────────────────────────────────
    // Printing (Sheets/Hr):  total_cut_sheets (printed_sheets + wastage per machine)
    // Finishing (Sheets/Hr): total_finishing_qty (sheets processed by this finishing op)
    // Unit-speed:            total_finishing_qty ?? total_units
    const sheetQty = order?.total_cut_sheets ?? order?.total_finishing_qty ?? null;
    const unitQty  = order?.total_finishing_qty ?? order?.total_units ?? null;
    const speedQty = isSheetSpeed ? sheetQty : isUnitSpeed ? unitQty : null;

    // ── Time estimate ─────────────────────────────────────────────────────────
    // Printing:  est = total_press_passes / speed   (cut_sheets × sides, summed per component)
    // Finishing: est = total_finishing_qty  / speed  (no sides factor)
    // Unit-speed:est = unitQty / speed
    const timeQty = (isSheetSpeed && order?.total_press_passes != null)
        ? order.total_press_passes        // printing: accounts for sides
        : speedQty;                        // finishing / unit: use display qty directly

    const estHrs = machine?.speed > 0 && timeQty
        ? timeQty / machine.speed
        : null;
    const estLabel = estHrs !== null
        ? estHrs < 1
            ? `~${Math.ceil(estHrs * 60)}min`
            : `~${estHrs % 1 === 0 ? estHrs : estHrs.toFixed(1)}hr`
        : null;
    const save = async (forceStatus) => {
        setSaving(true);
        const s = forceStatus || status;
        try {
            const res = await fetch(`/api/sales-orders/${task.sales_order_id}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: s,
                    completed_at: s === 'done' ? new Date(completedAt).toISOString() : null,
                    completed_by: completedBy || null,
                }),
            });
            const updated = await res.json();
            if (updated.error) throw new Error(updated.error);
            setStatus(updated.status);
            setOpen(false);
            onUpdated(task.id, updated.status, updated.completed_by, updated.completed_at);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const toggle = () => {
        if (open) { setOpen(false); setStatus(task.status); }
        else if (status === 'done') { save('pending'); }
        else { setOpen(true); }
    };

    return (
        <div className="mb-1.5">
            <button
                onClick={toggle}
                className={`w-full text-left transition-all duration-150 ${open ? 'rounded-t-xl bg-white/[0.06]' : 'rounded-xl bg-white/[0.03] hover:bg-white/[0.05]'}`}
                style={{
                    borderTop:    `1px solid ${open ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
                    borderRight:  `1px solid ${open ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
                    borderBottom: `1px solid ${open ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
                    borderLeft:   `3px solid ${st.dot}`,
                }}
            >
                {/* ── Row 1: Position · Title · Status ── */}
                <div className="flex items-center gap-4 px-5 pt-5 pb-2">
                    <span className="text-sm font-bold text-white/25 tabular-nums shrink-0 w-8 text-center">
                        {task.machine_position || '—'}
                    </span>
                    <p className={`flex-1 text-base font-bold truncate leading-snug ${status === 'done' ? 'text-white/30 line-through' : 'text-white'}`}>
                        {order?.estimation_names || '—'}
                    </p>
                    <span
                        className="text-[11px] font-bold px-3 py-1 rounded-full shrink-0 uppercase tracking-widest"
                        style={{ background: st.glow, color: st.text, border: `1px solid ${st.dot}55` }}
                    >
                        {st.label}
                    </span>
                </div>

                {/* ── Row 2: Code · Component · Customer ── */}
                <div className="flex items-center gap-3 px-5 pb-3 flex-wrap">
                    <span className="text-xs font-semibold font-mono text-white/50 bg-white/[0.06] px-2.5 py-1 rounded">
                        {order?.code || '—'}
                    </span>
                    <span className="text-sm text-white/50">
                        {task?.name?.split('—').at(-1)?.trim()}
                    </span>
                    {order?.customer_name && (
                        <span className="text-sm text-white/60 ml-auto truncate">
                            {order.customer_name}
                        </span>
                    )}
                    {status === 'done' && task.completed_by && (
                        <span className="text-sm text-white/50 font-medium">✓ {task.completed_by}</span>
                    )}
                </div>

                {/* ── Row 3: Stats · Delivery ── */}
                <div className="flex items-center gap-4 px-5 pb-4 pt-3 border-t border-white/[0.05]">
                    {order?.total_units != null && order?.total_cut_sheets != null && (
                        <span className="text-sm text-white/40">
                            <span className="text-white/70 font-semibold">{Number(order.total_units).toLocaleString()}</span> units
                        </span>
                    )}
                    {speedQty != null && (
                        <span className="text-sm text-white/40">
                            <span className="text-white/70 font-semibold">{Number(speedQty).toLocaleString()}</span> {isSheetSpeed ? 'cut sheets' : 'units'}
                        </span>
                    )}
                    {order?.total_forms != null && (
                        <span className="text-sm text-white/40">
                            <span className="text-white/70 font-semibold">{Number(order.total_forms).toLocaleString()}</span> plates
                        </span>
                    )}
                    {estLabel && (
                        <span className="text-sm text-white/60 font-semibold">{estLabel}</span>
                    )}
                    {order?.delivery_date && (() => {
                        const diff = (new Date(order.delivery_date) - Date.now()) / 86400000;
                        const urgent = diff < 0 ? 'text-white/90 font-bold' : diff <= 3 ? 'text-white/70 font-semibold' : 'text-white/35';
                        const label  = diff < 0 ? '⚠ Overdue' : `Due ${new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
                        return (
                            <span className={`ml-auto text-sm ${urgent}`}>{label}</span>
                        );
                    })()}
                </div>
            </button>

            {open && (
                <div className="bg-black/60 backdrop-blur-xl border border-white/15 border-t-0 rounded-b-xl p-5 flex flex-col gap-4">
                    {/* Status buttons */}
                    <div className="flex gap-2">
                        {Object.entries(STATUS).map(([s, cfg]) => (
                            <button
                                key={s}
                                onClick={() => setStatus(s)}
                                className="flex-1 py-2.5 rounded-lg cursor-pointer font-bold text-xs uppercase tracking-wider transition-all duration-150"
                                style={{
                                    border: `1px solid ${status === s ? cfg.dot : 'transparent'}`,
                                    background: status === s ? `${cfg.dot}22` : 'rgba(255,255,255,0.03)',
                                    color: status === s ? cfg.text : 'rgba(255,255,255,0.4)',
                                }}
                            >
                                {cfg.label}
                            </button>
                        ))}
                    </div>

                    {/* Date & By */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Date &amp; Time</label>
                            <input
                                type="datetime-local"
                                value={completedAt}
                                onChange={e => setCompletedAt(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none"
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Completed By</label>
                            <input
                                type="text"
                                value={completedBy}
                                placeholder="Name / Team"
                                onChange={e => setCompletedBy(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none placeholder:text-white/20"
                            />
                        </div>
                    </div>

                    {/* Save */}
                    <button
                        onClick={() => save()}
                        disabled={saving}
                        className={`py-3 rounded-lg border border-white/15 font-bold text-sm transition-all duration-200 ${saving ? 'bg-white/[0.03] text-white/25 cursor-not-allowed' : 'bg-white/[0.07] text-white hover:bg-white/10 cursor-pointer'}`}
                    >
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            )}

        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function MachinePage({ params }) {
    const { id } = use(params);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/machines/${id}/tasks`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json);
            setLastRefreshed(new Date());
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
        console.log('Loaded data:', data);
    }, [id]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 60000);
        return () => clearInterval(interval);
    }, [load]);

    // Flat update — works on the orders-grouped structure
    const handleTaskUpdated = (taskId, newStatus, completedBy, completedAt) => {
        setData(prev => ({
            ...prev,
            orders: prev.orders.map(o => ({
                ...o,
                tasks: o.tasks.map(t => t.id === taskId
                    ? { ...t, status: newStatus, completed_by: completedBy, completed_at: completedAt }
                    : t
                ),
            })),
        }));
    };

    const accent = data ? (CAT_ACCENT[(data.machine.type || '').toLowerCase()] || '#94a3b8') : '#94a3b8';

    if (loading) return (
        <div style={{ minHeight: '100vh', background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${G.border}`, borderTop: `2px solid ${G.muted}`, margin: '0 auto 14px', animation: 'spin 0.9s linear infinite' }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <p style={{ color: G.subtle, fontSize: 13 }}>Loading machine data…</p>
            </div>
        </div>
    );

    if (error || !data) return (
        <div style={{ minHeight: '100vh', background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
            <p style={{ color: '#f87171' }}>{error || 'Not found'}</p>
        </div>
    );

    const { machine, orders } = data;

    // Build flat task list in machine_position order, with order context per task
    const ordersMap = {};
    orders.forEach(o => { ordersMap[o.id] = o; });
    const allTasks = orders.flatMap(o => o.tasks.map(t => ({ ...t, _order: o })));
    // Sort by machine_position, then delivery_date, then display_order
    allTasks.sort((a, b) => {
        if (a.machine_position != null && b.machine_position != null) return a.machine_position - b.machine_position;
        if (a.machine_position != null) return -1;
        if (b.machine_position != null) return 1;
        return 0;
    });

    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter(t => t.status === 'done').length;
    const activeOrders = Object.keys(ordersMap).length;
    const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;

    return (
        <div style={{ fontFamily: 'Inter, sans-serif', background: G.bg, minHeight: '100vh', color: G.text }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}} * { box-sizing: border-box; } input { font-family: Inter, sans-serif; } button { font-family: Inter, sans-serif; }`}</style>

            {/* Top ambient glow */}
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 260, background: `radial-gradient(ellipse at 50% -10%, ${accent}18 0%, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
                {/* ── Header ── */}
                <div style={{ padding: '28px 24px 0', borderBottom: `1px solid ${G.border}`, backdropFilter: 'blur(20px)', background: 'rgba(7,7,15,0.8)' }}>
                    <div style={{ maxWidth: 760, margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <div>
                                <p style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
                                    {machine.type || 'Machine'} · Pressmatics ERP
                                </p>
                                <h1 style={{ fontSize: 28, fontWeight: 800, color: G.text, margin: 0, letterSpacing: '-0.5px' }}>
                                    {machine.name}
                                </h1>
                                <p style={{ color: G.muted, margin: '4px 0 0', fontSize: 13 }}>
                                    {activeOrders} active orders · {totalTasks} tasks · {pct}% complete
                                </p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <button onClick={load} style={{
                                    padding: '8px 16px', background: G.glass, backdropFilter: 'blur(12px)',
                                    border: `1px solid ${G.border}`, borderRadius: 9, color: G.muted,
                                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                }}>↺ Refresh</button>
                                {lastRefreshed && (
                                    <span style={{ fontSize: 9, color: G.dim, letterSpacing: 0.5 }}>
                                        synced {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · auto ↺ 1m
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Overall progress bar */}
                        {totalTasks > 0 && (
                            <div style={{ paddingBottom: 18 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: G.subtle, textTransform: 'uppercase', letterSpacing: 1 }}>Queue Progress</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#10b981' : G.muted }}>{doneTasks}/{totalTasks} · {pct}%</span>
                                </div>
                                <div style={{ height: 4, background: G.glass, borderRadius: 2, border: `1px solid ${G.border}` }}>
                                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, transition: 'width 0.5s ease', background: pct === 100 ? '#10b981' : accent }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Stats row ── */}
                <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px 0' }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                        {[
                            { label: 'Orders', value: activeOrders },
                            { label: 'Queue', value: totalTasks },
                            { label: 'Done', value: doneTasks, color: '#10b981' },
                            { label: 'Remaining', value: totalTasks - doneTasks, color: '#f59e0b' },
                        ].map(s => (
                            <div key={s.label} style={{
                                padding: '12px 20px', background: G.glass, backdropFilter: 'blur(12px)',
                                border: `1px solid ${G.border}`, borderRadius: 12, textAlign: 'center',
                            }}>
                                <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: s.color || G.text }}>{s.value}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: G.subtle, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Queue label ── */}
                    {totalTasks > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: G.subtle, textTransform: 'uppercase', letterSpacing: 1.2 }}>Machine Queue — in order</span>
                            <span style={{ fontSize: 9, color: G.dim }}>Reorder via Job Planning ↗</span>
                        </div>
                    )}

                    {/* ── Flat task queue ── */}
                    {allTasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 24px', background: G.glass, border: `1px dashed ${G.border}`, borderRadius: 16 }}>
                            <p style={{ color: G.subtle, fontSize: 14 }}>No active tasks assigned to this machine.</p>
                        </div>
                    ) : (
                        <div style={{ paddingBottom: 64 }}>
                            {allTasks.map(task => (
                                <QueueTask
                                    key={task.id}
                                    task={task}
                                    order={task._order}
                                    accent={accent}
                                    machine={machine}
                                    onUpdated={handleTaskUpdated}
                                />
                            ))}
                        </div>
                    )}

                    <p style={{ textAlign: 'center', fontSize: 10, color: G.dim, letterSpacing: 1, paddingBottom: 32 }}>
                        PRESSMATICS ERP · MACHINE TRACKER
                    </p>
                </div>
            </div>
        </div>
    );
}
