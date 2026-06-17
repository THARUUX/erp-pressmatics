'use client';

import { use, useState, useEffect, useCallback } from 'react';

// ─── Design Tokens ───────────────────────────────────────────────────────────
const G = {
    bg: '#07070f',
    surface: 'rgba(255,255,255,0.03)',
    surfaceHov: 'rgba(255,255,255,0.06)',
    glass: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.07)',
    borderStr: 'rgba(255,255,255,0.12)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
    dim: '#334155',
};

const STATUS = {
    pending: { dot: '#64748b', glow: '#64748b22', text: '#94a3b8', label: 'Pending' },
    in_progress: { dot: '#f59e0b', glow: '#f59e0b22', text: '#fbbf24', label: 'In Progress' },
    done: { dot: '#10b981', glow: '#10b98122', text: '#34d399', label: 'Done' },
};

const ORDER_STATUS_COLOR = {
    Pending: '#f59e0b', 'In Production': '#818cf8', Ready: '#10b981',
    Delivered: '#a78bfa', Cancelled: '#f87171',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toLocalDt(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function nowDt() { return toLocalDt(new Date().toISOString()); }

// ─── TaskItem ─────────────────────────────────────────────────────────────────
function TaskItem({ task, orderId, onUpdated }) {
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
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: s,
                    completed_at: s === 'done' ? new Date(completedAt).toISOString() : null,
                    completed_by: completedBy || null,
                })
            });
            const updated = await res.json();
            if (updated.error) throw new Error(updated.error);
            setStatus(updated.status);
            setOpen(false);
            onUpdated(updated);
        } catch (e) {
            console.error('Save error:', e);
        } finally {
            setSaving(false);
        }
    };

    const toggle = () => {
        if (open) {
            setOpen(false);
            setStatus(task.status);
            setCompletedAt(toLocalDt(task.completed_at) || nowDt());
            setCompletedBy(task.completed_by || '');
        } else if (task.status === 'done') {
            save('pending');
        } else {
            setOpen(true);
        }
    };

    return (
        <div style={{ marginBottom: 8 }}>
            {/* Row */}
            <button onClick={toggle} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                background: open ? 'rgba(255,255,255,0.06)' : G.surface,
                border: `1px solid ${open ? G.borderStr : G.border}`,
                borderRadius: open ? '14px 14px 0 0' : 14,
                padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s', backdropFilter: 'blur(12px)',
            }}>
                {/* Status dot */}
                <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${st.dot}`,
                    background: status === 'done' ? st.dot : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: status === 'done' ? `0 0 8px ${st.dot}66` : 'none',
                    transition: 'all 0.25s',
                }}>
                    {status === 'done' && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                    {status === 'in_progress' && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: st.dot, boxShadow: `0 0 6px ${st.dot}` }} />
                    )}
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        color: status === 'done' ? G.subtle : G.text,
                        fontWeight: 600, fontSize: 14,
                        textDecoration: status === 'done' ? 'line-through' : 'none',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {task.name}
                    </div>
                    {task.description && (
                        <div style={{ color: G.subtle, fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.description}
                        </div>
                    )}
                    {task.status === 'done' && task.completed_by && (
                        <div style={{ color: STATUS.done.text, fontSize: 11, marginTop: 2 }}>
                            ✓ {task.completed_by}
                            {task.completed_at && ` · ${new Date(task.completed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                    )}
                </div>

                {/* Badge + chevron */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: st.glow, color: st.text,
                        border: `1px solid ${st.dot}33`,
                        textTransform: 'uppercase', letterSpacing: 0.6,
                    }}>
                        {st.label}
                    </span>
                    {open
                        ? <span style={{ color: G.subtle, fontSize: 13 }}>✕</span>
                        : status !== 'done' && <span style={{ color: G.dim, fontSize: 16 }}>⌄</span>
                    }
                </div>
            </button>

            {/* Expansion Panel */}
            {open && (
                <div style={{
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
                    border: `1px solid ${G.borderStr}`, borderTop: 'none',
                    borderRadius: '0 0 14px 14px', padding: '18px 18px 16px',
                    display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                    {/* Status selector */}
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: G.subtle, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            Set Status
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {Object.entries(STATUS).map(([s, st]) => (
                                <button key={s} onClick={() => setStatus(s)} style={{
                                    flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer',
                                    fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                                    border: `1px solid ${status === s ? st.dot : 'transparent'}`,
                                    background: status === s ? `${st.dot}22` : 'rgba(255,255,255,0.03)',
                                    color: status === s ? st.text : G.subtle,
                                    transition: 'all 0.15s', boxShadow: status === s ? `0 0 10px ${st.dot}33` : 'none',
                                }}>
                                    {st.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date/Time + Completed By */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: G.subtle, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                                Date &amp; Time
                            </label>
                            <input type="datetime-local" value={completedAt}
                                onChange={e => setCompletedAt(e.target.value)}
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${G.border}`, borderRadius: 10,
                                    padding: '10px 12px', color: G.text, fontSize: 13,
                                    outline: 'none', boxSizing: 'border-box',
                                    colorScheme: 'dark',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: G.subtle, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                                Completed By
                            </label>
                            <input type="text" value={completedBy} placeholder="Name / Team"
                                onChange={e => setCompletedBy(e.target.value)}
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${G.border}`, borderRadius: 10,
                                    padding: '10px 12px', color: G.text, fontSize: 13,
                                    outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    </div>

                    {/* Save */}
                    <button onClick={() => save()} disabled={saving} style={{
                        padding: '13px 0', borderRadius: 10, border: `1px solid ${G.borderStr}`,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        background: saving ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(12px)',
                        color: G.text, fontWeight: 700, fontSize: 14,
                        transition: 'all 0.2s', letterSpacing: 0.3,
                    }}>
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function JobTrackerPage({ params }) {
    const { id } = use(params);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('tasks');

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/jobs/${id}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const handleTaskUpdated = (updated) =>
        setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === updated.id ? updated : t) }));

    if (loading) return (
        <div style={{ minHeight: '100vh', background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${G.border}`, borderTop: `2px solid ${G.muted}`, margin: '0 auto 16px', animation: 'spin 0.9s linear infinite' }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <p style={{ color: G.subtle, fontFamily: 'Inter,sans-serif', fontSize: 13 }}>Loading…</p>
            </div>
        </div>
    );

    if (error || !data) return (
        <div style={{ minHeight: '100vh', background: G.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#f87171', fontFamily: 'Inter,sans-serif' }}>{error || 'Not found'}</p>
        </div>
    );

    const { order, items, tasks } = data;
    console.log(items[0]);
    const done = tasks.filter(t => t.status === 'done').length;
    const pct = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;
    const soColor = ORDER_STATUS_COLOR[order.status] || '#64748b';

    return (
        <div style={{ fontFamily: 'Inter,sans-serif', background: G.bg, minHeight: '100vh', color: G.text }}>

            {/* Top gradient wash */}
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 300, background: 'radial-gradient(ellipse at 50% -20%, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div style={{ padding: '28px 20px 0', borderBottom: `1px solid ${G.border}`, backdropFilter: 'blur(20px)', background: 'rgba(7,7,15,0.8)' }}>
                    <div style={{ maxWidth: 620, margin: '0 auto' }}>
                        {/* Brand + status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                            <div>
                                <p style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
                                    Production Job Tracker
                                </p>
                                <h1 style={{ fontSize: 26, fontWeight: 800, color: G.text, margin: 0, letterSpacing: '-0.5px' }}>
                                    {order.code}
                                </h1>
                                <p style={{ color: G.muted, margin: '4px 0 0', fontSize: 13 }}>{order.customer_name}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{
                                    display: 'inline-block', padding: '5px 14px', borderRadius: 20,
                                    fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                                    background: `${soColor}18`, color: soColor,
                                    border: `1px solid ${soColor}33`,
                                }}>
                                    {order.status}
                                </span>
                                {order.delivery_date && (
                                    <p style={{ color: G.subtle, fontSize: 11, marginTop: 6 }}>
                                        📅 {new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Progress */}
                        {tasks.length > 0 && (
                            <div style={{ paddingBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: G.subtle, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Progress
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? STATUS.done.text : G.muted }}>
                                        {done}/{tasks.length} · {pct}%
                                    </span>
                                </div>
                                <div style={{ height: 4, background: G.surface, borderRadius: 2, overflow: 'hidden', border: `1px solid ${G.border}` }}>
                                    <div style={{
                                        height: '100%', width: `${pct}%`, borderRadius: 2, transition: 'width 0.5s ease',
                                        background: pct === 100 ? STATUS.done.dot : 'linear-gradient(90deg, #818cf8, #10b981)'
                                    }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab Bar */}
                <div style={{
                    position: 'sticky', top: 0, zIndex: 10,
                    backdropFilter: 'blur(20px)', background: 'rgba(7,7,15,0.85)',
                    borderBottom: `1px solid ${G.border}`,
                }}>
                    <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', padding: '0 20px' }}>
                        {[
                            { key: 'tasks', label: 'Tasks', badge: `${done}/${tasks.length}` },
                            { key: 'details', label: 'Details', badge: items.length },
                        ].map(({ key, label, badge }) => (
                            <button key={key} onClick={() => setTab(key)} style={{
                                flex: 1, padding: '14px 0', cursor: 'pointer',
                                background: 'transparent', border: 'none',
                                borderBottom: `2px solid ${tab === key ? '#818cf8' : 'transparent'}`,
                                color: tab === key ? G.text : G.subtle,
                                fontFamily: 'Inter,sans-serif',
                                fontWeight: tab === key ? 700 : 500,
                                fontSize: 13, letterSpacing: 0.2,
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}>
                                {label}
                                <span style={{
                                    fontSize: 10, fontWeight: 700,
                                    padding: '2px 7px', borderRadius: 20,
                                    background: tab === key ? 'rgba(129,140,248,0.15)' : G.surface,
                                    color: tab === key ? '#818cf8' : G.dim,
                                    border: `1px solid ${tab === key ? 'rgba(129,140,248,0.3)' : G.border}`,
                                    transition: 'all 0.2s',
                                }}>
                                    {badge}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div style={{ maxWidth: 620, margin: '0 auto', padding: '20px 20px 60px' }}>

                    {/* ── Tasks tab ── */}
                    {tab === 'tasks' && (
                        <>
                            {tasks.length > 0
                                ? tasks.map(task => (
                                    <TaskItem key={task.id} task={task} orderId={id} onUpdated={handleTaskUpdated} />
                                ))
                                : (
                                    <div style={{
                                        textAlign: 'center', padding: '48px 24px',
                                        background: G.surface, border: `1px dashed ${G.border}`,
                                        borderRadius: 16, backdropFilter: 'blur(12px)',
                                    }}>
                                        <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                                        <p style={{ fontSize: 13, color: G.subtle }}>No tasks assigned yet</p>
                                    </div>
                                )
                            }
                        </>
                    )}

                    {/* ── Details tab ── */}
                    {tab === 'details' && (
                        <>
                            {items.length > 0
                                ? items.map((item, i) => (
                                    <div key={i} style={{
                                        background: G.surface, border: `1px solid ${G.border}`,
                                        borderRadius: 14, marginBottom: 10, overflow: 'hidden',
                                        backdropFilter: 'blur(12px)',
                                    }}>
                                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${G.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700, fontSize: 13, color: G.text }}>{item.estimation_name || item.job_description}</span>
                                            <span style={{ fontSize: 11, color: G.subtle, background: G.surface, border: `1px solid ${G.border}`, borderRadius: 20, padding: '2px 10px' }}>× {item.quantity}</span>
                                        </div>
                                        <div style={{ padding: '12px 16px' }}>
                                            {item.details?.map((d, di) => (
                                                d.component_name !== 'Finishing' && (
                                                    <div key={di} style={{ marginBottom: di < item.details.length - 1 ? 14 : 0 }}>
                                                        <p style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                                                            {d.component_name} · {d.type}
                                                        </p>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                                            {d.machine_name && <Cell label="Machine" val={d.machine_name} />}
                                                            {d.paper_name && <Cell label="Paper" val={d.paper_name} />}
                                                            {d.colors_front > 0 && <Cell label="Front" val={`${d.colors_front ?? d.colors} clr`} />}
                                                            {d.colors_back > 0 && <Cell label="Back" val={`${d.colors_back} clr`} />}
                                                            {d.plate_count > 0 && <Cell label="Plates" val={d.plate_count} />}
                                                            {d.printed_sheets > 0 && <Cell label="Sheets" val={d.printed_sheets.toLocaleString()} />}
                                                            {d.wastage_sheets > 0 && <Cell label="Wastage" val={d.wastage_sheets.toLocaleString()} />}
                                                            {d.full_sheets_used > 0 && <Cell label="Total Sheets" val={d.full_sheets_used.toLocaleString()} />}
                                                        </div>
                                                    </div>
                                                )
                                            ))}

                                            {/* Finishings */}
                                            {item.finishings?.length > 0 && (
                                                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${G.border}` }}>
                                                    <p style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                                                        Finishings
                                                    </p>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {item.finishings.map((f, fi) => (
                                                            <div key={fi} style={{
                                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)',
                                                                borderRadius: 8, padding: '8px 12px',
                                                            }}>
                                                                <div>
                                                                    <span style={{ fontSize: 13, fontWeight: 600, color: G.text }}>{f.name}</span>
                                                                    {f.machine_name && (
                                                                        <span style={{ fontSize: 11, color: G.subtle, marginLeft: 8 }}>· {f.machine_name}</span>
                                                                    )}
                                                                </div>
                                                                {f.quantity > 0 && (
                                                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', padding: '2px 8px', background: 'rgba(245,158,11,0.12)', borderRadius: 20 }}>
                                                                        ×{f.quantity}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                                : (
                                    <div style={{ textAlign: 'center', padding: '48px 24px', color: G.subtle, fontSize: 13 }}>
                                        No components found
                                    </div>
                                )
                            }
                        </>
                    )}

                    <p style={{ textAlign: 'center', marginTop: 32, fontSize: 10, color: G.dim, letterSpacing: 1 }}>
                        PRESSMATICS ERP · PRODUCTION TRACKING
                    </p>
                </div>
            </div>
        </div>
    );
}

function Cell({ label, val }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '7px 10px',
        }}>
            <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
                {label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{val}</span>
        </div>
    );
}
