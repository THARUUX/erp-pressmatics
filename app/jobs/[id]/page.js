'use client';

import { use, useState, useEffect, useCallback } from 'react';

/* ── Task status config ───────────────────────────────────────────────────── */
const STATUS_CFG = {
    pending:     { label: 'Pending',     dot: 'bg-slate-500',  ring: 'border-slate-500',  badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',  btn: 'border-slate-500/60 bg-slate-500/10 text-slate-300' },
    in_progress: { label: 'In Progress', dot: 'bg-amber-400',  ring: 'border-amber-400',  badge: 'bg-amber-400/10  text-amber-300  border-amber-400/20',  btn: 'border-amber-400/60  bg-amber-400/10  text-amber-200' },
    done:        { label: 'Done',        dot: 'bg-emerald-500',ring: 'border-emerald-500',badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',btn: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300' },
};

const SO_STATUS_PILL = {
    Pending:        'bg-amber-500/10 text-amber-400 border-amber-500/25',
    'In Production':'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
    Ready:          'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    Delivered:      'bg-violet-500/10 text-violet-400 border-violet-500/25',
    Cancelled:      'bg-red-500/10 text-red-400 border-red-500/25',
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function toLocalDt(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function nowDt() { return toLocalDt(new Date().toISOString()); }

/* ── Cell (spec detail box) ───────────────────────────────────────────────── */
function Cell({ label, val }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5">
            <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">{label}</span>
            <span className="text-xs font-semibold text-slate-200">{val}</span>
        </div>
    );
}

/* ── TaskItem ─────────────────────────────────────────────────────────────── */
function TaskItem({ task, orderId, onUpdated }) {
    const [open, setOpen]           = useState(false);
    const [saving, setSaving]       = useState(false);
    const [status, setStatus]       = useState(task.status);
    const [completedAt, setCA]      = useState(toLocalDt(task.completed_at) || nowDt());
    const [completedBy, setCB]      = useState(task.completed_by || '');
    const [dtError, setDtError]     = useState(false);

    const st = STATUS_CFG[status] || STATUS_CFG.pending;

    const save = async (forceStatus) => {
        const s = forceStatus || status;
        // Require date/time for any status change
        if (!completedAt) {
            setDtError(true);
            return;
        }
        setDtError(false);
        setSaving(true);
        try {
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: s,
                    completed_at: new Date(completedAt).toISOString(),
                    completed_by: completedBy || null,
                }),
            });
            const updated = await res.json();
            if (updated.error) throw new Error(updated.error);
            setStatus(updated.status);
            setOpen(false);
            onUpdated(updated);
        } catch (e) { console.error('Save error:', e); }
        finally { setSaving(false); }
    };

    const toggle = () => {
        if (open) {
            setOpen(false);
            setDtError(false);
            setStatus(task.status);
            setCA(toLocalDt(task.completed_at) || nowDt());
            setCB(task.completed_by || '');
        } else {
            // Always open the panel — never auto-undo
            setOpen(true);
        }
    };

    return (
        <div className="mb-2">
            {/* Row */}
            <button onClick={toggle}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left backdrop-blur-xl transition-all duration-200 border
                    ${open ? 'bg-white/[0.06] border-white/[0.12] rounded-t-2xl' : 'bg-white/[0.03] border-white/[0.07] rounded-2xl hover:bg-white/[0.05]'}`}>

                {/* Status dot */}
                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all duration-200
                    ${st.ring} ${status === 'done' ? st.dot : 'bg-transparent'} ${status === 'done' ? 'shadow-[0_0_8px_rgba(16,185,129,0.5)]' : ''}`}>
                    {status === 'done'  && <span className="text-white text-[10px] font-black">✓</span>}
                    {status === 'in_progress' && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate transition-colors
                        ${status === 'done' ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                        {task.name}
                    </div>
                    {task.description && (
                        <div className="text-[11px] text-slate-600 mt-0.5 truncate">{task.description}</div>
                    )}
                    {task.status === 'done' && task.completed_by && (
                        <div className="text-[11px] text-emerald-500 mt-0.5">
                            ✓ {task.completed_by}
                            {task.completed_at && ` · ${new Date(task.completed_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                    )}
                </div>

                {/* Badge + chevron */}
                <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${st.badge}`}>
                        {st.label}
                    </span>
                    {open
                        ? <span className="text-slate-500 text-sm">✕</span>
                        : <span className="text-slate-700 text-base">⌄</span>
                    }
                </div>
            </button>

            {/* Expansion panel */}
            {open && (
                <div className="bg-black/50 backdrop-blur-xl border border-white/[0.12] border-t-0 rounded-b-2xl px-4 pt-4 pb-4 flex flex-col gap-3.5">
                    {/* Status buttons */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Set Status</p>
                        <div className="flex gap-2">
                            {Object.entries(STATUS_CFG).map(([s, cfg]) => (
                                <button key={s} onClick={() => setStatus(s)}
                                    className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all duration-150 border
                                        ${status === s ? cfg.btn : 'border-transparent bg-white/[0.03] text-slate-500 hover:bg-white/[0.06]'}`}>
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date + Completed By */}
                    <div className="grid grid-cols-2 gap-2.5">
                        <div>
                            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${dtError ? 'text-red-400' : 'text-slate-600'}`}>
                                Date & Time {dtError && '— required'}
                            </label>
                            <input type="datetime-local" value={completedAt}
                                onChange={e => { setCA(e.target.value); if (e.target.value) setDtError(false); }}
                                required
                                className={`w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 text-slate-100 text-sm outline-none [color-scheme:dark] transition-colors
                                    ${dtError ? 'border-red-500/60 focus:border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]' : 'border-white/[0.07] focus:border-white/20'}`} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1.5">Completed By</label>
                            <input type="text" value={completedBy} placeholder="Name / Team"
                                onChange={e => setCB(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-slate-100 text-sm outline-none focus:border-white/20 placeholder-slate-600" />
                        </div>
                    </div>

                    {/* Save */}
                    <button onClick={() => save()} disabled={saving}
                        className="py-3 rounded-xl border border-white/[0.12] bg-white/[0.08] hover:bg-white/[0.12] text-slate-100 font-bold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-xl">
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            )}
        </div>
    );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function JobTrackerPage({ params }) {
    const { id } = use(params);
    const [data, setData]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState(null);
    const [tab, setTab]       = useState('tasks');

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

    /* Loading */
    if (loading) return (
        <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
            <div className="text-center">
                <div className="w-10 h-10 rounded-full border-2 border-white/[0.07] border-t-slate-400 mx-auto mb-4 animate-spin" />
                <p className="text-slate-600 text-sm">Loading…</p>
            </div>
        </div>
    );

    /* Error */
    if (error || !data) return (
        <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
            <p className="text-red-400 text-sm">{error || 'Not found'}</p>
        </div>
    );

    const { order, items, tasks } = data;
    const done = tasks.filter(t => t.status === 'done').length;
    const pct  = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;
    const soPill = SO_STATUS_PILL[order.status] || 'bg-slate-500/10 text-slate-400 border-slate-500/25';

    return (
        <div className="font-sans bg-[#07070f] min-h-screen text-slate-100">

            {/* Top gradient wash */}
            <div className="fixed top-0 left-0 right-0 h-72 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(99,102,241,0.12)_0%,transparent_70%)] pointer-events-none z-0" />

            <div className="relative z-10">
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="px-5 pt-7 pb-0 border-b border-white/[0.07] backdrop-blur-xl bg-[rgba(7,7,15,0.8)]">
                    <div className="max-w-[620px] mx-auto">
                        {/* Brand row */}
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-1.5">
                                    Production Job Tracker
                                </p>
                                <h1 className="text-[26px] font-extrabold text-slate-100 m-0 tracking-tight">
                                    {order.code}
                                </h1>
                                <p className="text-slate-400 mt-1 text-sm">{order.customer_name}</p>
                            </div>
                            <div className="text-right">
                                <span className={`inline-block px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide border ${soPill}`}>
                                    {order.status}
                                </span>
                                {order.delivery_date && (
                                    <p className="text-slate-600 text-[11px] mt-1.5">
                                        📅 {new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Progress bar */}
                        {tasks.length > 0 && (
                            <div className="pb-5">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Progress</span>
                                    <span className={`text-xs font-bold ${pct === 100 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {done}/{tasks.length} · {pct}%
                                    </span>
                                </div>
                                <div className="h-1 bg-white/[0.03] border border-white/[0.07] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${pct}%`,
                                            background: pct === 100 ? '#10b981' : 'linear-gradient(90deg,#818cf8,#10b981)',
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Tab bar ─────────────────────────────────────────────── */}
                <div className="sticky top-0 z-10 backdrop-blur-xl bg-[rgba(7,7,15,0.85)] border-b border-white/[0.07]">
                    <div className="max-w-[620px] mx-auto flex px-5">
                        {[
                            { key: 'tasks',   label: 'Tasks',   badge: `${done}/${tasks.length}` },
                            { key: 'details', label: 'Details', badge: items.length },
                        ].map(({ key, label, badge }) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all duration-200 border-b-2
                                    ${tab === key
                                        ? 'border-indigo-400 text-slate-100 font-bold'
                                        : 'border-transparent text-slate-600 hover:text-slate-400'}`}>
                                {label}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-all duration-200
                                    ${tab === key
                                        ? 'bg-indigo-400/15 text-indigo-400 border-indigo-400/30'
                                        : 'bg-white/[0.03] text-slate-700 border-white/[0.07]'}`}>
                                    {badge}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Content ─────────────────────────────────────────────── */}
                <div className="max-w-[620px] mx-auto px-5 pt-5 pb-16">

                    {/* Tasks tab */}
                    {tab === 'tasks' && (
                        <>
                            {tasks.length > 0
                                ? tasks.map(task => (
                                    <TaskItem key={task.id} task={task} orderId={id} onUpdated={handleTaskUpdated} />
                                ))
                                : (
                                    <div className="text-center py-12 px-6 bg-white/[0.03] border border-dashed border-white/[0.07] rounded-2xl backdrop-blur-xl">
                                        <div className="text-3xl mb-2.5">📋</div>
                                        <p className="text-slate-600 text-sm">No tasks assigned yet</p>
                                    </div>
                                )
                            }
                        </>
                    )}

                    {/* Details tab */}
                    {tab === 'details' && (
                        <>
                            {items.length > 0
                                ? items.map((item, i) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl mb-2.5 overflow-hidden backdrop-blur-xl">
                                        {/* Item header */}
                                        <div className="flex justify-between items-center px-4 py-3 border-b border-white/[0.07]">
                                            <span className="font-bold text-sm text-slate-100">{item.estimation_name || item.job_description}</span>
                                            <span className="text-[11px] text-slate-600 bg-white/[0.03] border border-white/[0.07] rounded-full px-2.5 py-0.5">
                                                × {item.quantity}
                                            </span>
                                        </div>

                                        {/* Spec details */}
                                        <div className="px-4 py-3">
                                            {item.details?.map((d, di) => (
                                                d.component_name !== 'Finishing' && (
                                                    <div key={di} className={di < item.details.length - 1 ? 'mb-3.5' : ''}>
                                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">
                                                            {d.component_name} · {d.type}
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-1.5">
                                                            {d.machine_name        && <Cell label="Machine"     val={d.machine_name} />}
                                                            {d.paper_name          && <Cell label="Paper"       val={d.paper_name} />}
                                                            {d.colors_front > 0    && <Cell label="Front"       val={`${d.colors_front ?? d.colors} clr`} />}
                                                            {d.colors_back  > 0    && <Cell label="Back"        val={`${d.colors_back} clr`} />}
                                                            {d.plate_count  > 0    && <Cell label="Plates"      val={d.plate_count} />}
                                                            {d.printed_sheets > 0  && <Cell label="Sheets"      val={d.printed_sheets.toLocaleString()} />}
                                                            {d.wastage_sheets > 0  && <Cell label="Wastage"     val={d.wastage_sheets.toLocaleString()} />}
                                                            {d.full_sheets_used > 0 && <Cell label="Total Sheets" val={d.full_sheets_used.toLocaleString()} />}
                                                        </div>
                                                    </div>
                                                )
                                            ))}

                                            {/* Finishings */}
                                            {item.finishings?.length > 0 && (
                                                <div className="mt-3.5 pt-3.5 border-t border-white/[0.07]">
                                                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">
                                                        Finishings
                                                    </p>
                                                    <div className="flex flex-col gap-1.5">
                                                        {item.finishings.map((f, fi) => (
                                                            <div key={fi} className="flex items-center justify-between bg-amber-500/[0.05] border border-amber-500/[0.12] rounded-lg px-3 py-2">
                                                                <div>
                                                                    <span className="text-sm font-semibold text-slate-100">{f.name}</span>
                                                                    {f.machine_name && (
                                                                        <span className="text-[11px] text-slate-600 ml-2">· {f.machine_name}</span>
                                                                    )}
                                                                </div>
                                                                {f.quantity > 0 && (
                                                                    <span className="text-[11px] font-bold text-amber-300 px-2 py-0.5 bg-amber-400/10 rounded-full">
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
                                    <div className="text-center py-12 px-6 text-slate-600 text-sm">
                                        No components found
                                    </div>
                                )
                            }
                        </>
                    )}

                    <p className="text-center mt-8 text-[10px] text-slate-800 tracking-widest uppercase">
                        Pressmatics ERP · Production Tracking
                    </p>
                </div>
            </div>
        </div>
    );
}
