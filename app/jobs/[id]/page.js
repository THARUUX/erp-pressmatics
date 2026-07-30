'use client';

import { use, useState, useEffect, useCallback } from 'react';
import {
    FiCheck, FiClock, FiPrinter, FiPlay, FiPause, FiZap,
    FiCheckCircle, FiX, FiChevronDown, FiCalendar, FiClipboard,
    FiAlertCircle
} from 'react-icons/fi';

/* ── Task status config ───────────────────────────────────────────────────── */
const STATUS_CFG = {
    pending: { label: 'Pending', dot: 'bg-neutral-500', ring: 'border-neutral-500', badge: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20', btn: 'border-neutral-500/60 bg-neutral-500/10 text-neutral-300' },
    in_progress: { label: 'In Progress', dot: 'bg-amber-400', ring: 'border-amber-400', badge: 'bg-amber-400/10  text-amber-300  border-amber-400/20', btn: 'border-amber-400/60  bg-amber-400/10  text-amber-200' },
    paused: { label: 'Paused', dot: 'bg-rose-500', ring: 'border-rose-500', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', btn: 'border-rose-500/60 bg-rose-500/10 text-rose-300' },
    done: { label: 'Done', dot: 'bg-emerald-500', ring: 'border-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', btn: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300' },
};

const SO_STATUS_PILL = {
    Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    'In Production': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
    Ready: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    Delivered: 'bg-violet-500/10 text-violet-400 border-violet-500/25',
    Cancelled: 'bg-red-500/10 text-red-400 border-red-500/25',
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function toLocalDt(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function nowDt() { return toLocalDt(new Date().toISOString()); }
function fmtDt(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    // Convert UTC → IST (UTC+5:30) manually
    const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
    const day = String(ist.getUTCDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[ist.getUTCMonth()];
    const hr = String(ist.getUTCHours()).padStart(2, '0');
    const mn = String(ist.getUTCMinutes()).padStart(2, '0');
    return `${day} ${mon}, ${hr}:${mn}`;
}

/* ── Cell (spec detail box) ───────────────────────────────────────────────── */
function Cell({ label, val }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5">
            <span className="block text-[9px] font-bold text-neutral-600 uppercase tracking-wider mb-0.5">{label}</span>
            <span className="text-xs font-semibold text-neutral-200">{val}</span>
        </div>
    );
}

/* ── TaskItem ─────────────────────────────────────────────────────────────── */
function TaskItem({ task, orderId, onUpdated, onOpenComplete, allEmployees = [], allTeams = [] }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(task.status);
    const [completedAt, setCA] = useState(toLocalDt(task.completed_at) || nowDt());
    const [completedBy, setCB] = useState(task.completed_by || '');
    const [dtError, setDtError] = useState(false);
    const [quickDoneConfirm, setQuickDoneConfirm] = useState(false);
    const [startConfirm, setStartConfirm] = useState(false);
    const [startAssignee, setStartAssignee] = useState(task.assigned_to || '');
    const [isCustomAssignee, setIsCustomAssignee] = useState(false);

    const st = STATUS_CFG[status] || STATUS_CFG.pending;

    const save = async (forceStatus, extras = {}) => {
        const s = forceStatus || status;
        setSaving(true);
        try {
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: s, ...extras }),
            });
            const updated = await res.json();
            if (updated.error) throw new Error(updated.error);
            setStatus(updated.status);
            setOpen(false);
            onUpdated(updated);
        } catch (e) { console.error('Save error:', e); }
        finally { setSaving(false); }
    };

    const handleStart = () => {
        const taskAssignedEmps = task.assigned_options?.assigned_employees || [];
        const taskAssignedTeams = task.assigned_options?.assigned_teams || [];
        const defaultAssignee = task.assigned_to || (taskAssignedEmps[0]?.name) || (taskAssignedTeams[0]?.name) || '';
        setStartAssignee(defaultAssignee);
        setIsCustomAssignee(false);
        setStartConfirm(true);
    };
    const confirmStart = () => {
        setStartConfirm(false);
        save('in_progress', { assigned_to: startAssignee || null });
    };
    const handlePause = () => save('paused');
    const handleQuickDone = () => setQuickDoneConfirm(true);
    const confirmQuickDone = () => {
        setQuickDoneConfirm(false);
        const estSheets = task.sheet_count != null ? parseFloat(task.sheet_count) : 0;
        const estWastage = task.wastage_sheets != null ? parseFloat(task.wastage_sheets) : 0;
        const estPlates = task.plate_count != null ? parseInt(task.plate_count) : 0;
        save('done', {
            actual_sheets_printed: estSheets - estWastage > 0 ? estSheets - estWastage : estSheets,
            actual_sheets_wasted: estWastage,
            actual_plates_used: estPlates,
            downtime_minutes: 0, downtime_reason: 'None',
        });
    };

    const toggle = () => {
        if (open) { setOpen(false); setDtError(false); setStatus(task.status); setCA(toLocalDt(task.completed_at) || nowDt()); setCB(task.completed_by || ''); }
        else { setOpen(true); }
    };

    const hasEst = task.sheet_count > 0 || task.plate_count > 0 || task.quantity > 0;
    const hasActuals = task.status === 'done' && (parseFloat(task.actual_sheets_printed) > 0 || parseInt(task.actual_plates_used) > 0);

    return (
        <div className="mb-2">
            <button onClick={toggle}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left backdrop-blur-xl transition-all duration-200 border
                    ${open ? 'bg-white/[0.06] border-white/[0.12] rounded-t-2xl' : 'bg-white/[0.03] border-white/[0.07] rounded-2xl hover:bg-white/[0.05]'}
                    ${status === 'in_progress' ? 'border-emerald-500/30 bg-emerald-950/5 shadow-[0_0_15px_rgba(16,185,129,0.08)]' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all duration-200 ${st.ring} ${status === 'done' ? st.dot : 'bg-transparent'} ${status === 'done' ? 'shadow-[0_0_8px_rgba(16,185,129,0.5)]' : ''} ${status === 'in_progress' ? 'animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.6)]' : ''}`}>
                    {status === 'done' && <FiCheck className="w-2.5 h-2.5 text-white" />}
                    {status === 'in_progress' && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className={`font-semibold text-sm truncate ${status === 'done' ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>{task.name}</div>
                        {task.estimated_minutes > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-neutral-400 font-semibold flex-shrink-0 inline-flex items-center gap-0.5"><FiClock className="w-3 h-3" /> {task.estimated_minutes < 60 ? `${task.estimated_minutes}m` : `${(task.estimated_minutes / 60).toFixed(1)}h`}</span>}
                    </div>
                    {task.machine_name && <div className="text-[10px] text-indigo-400 mt-0.5 inline-flex items-center gap-0.5"><FiPrinter className="w-3 h-3" /> {task.machine_name}</div>}
                    {task.description && <div className="text-[11px] text-neutral-600 mt-0.5 truncate">{task.description}</div>}
                    {task.status === 'done' && <div className="text-[11px] text-emerald-500 mt-0.5 inline-flex items-center gap-0.5"><FiCheck className="w-3 h-3" /> {task.completed_by || task.assigned_to || 'Completed'}{task.completed_at && ` · ${fmtDt(task.completed_at)}`}</div>}
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${st.badge} ${status === 'in_progress' ? 'animate-pulse' : ''}`}>{st.label}</span>
                    {open ? <FiX className="w-4 h-4 text-neutral-500" /> : <FiChevronDown className="w-4 h-4 text-neutral-700" />}
                </div>
            </button>

            {open && (
                <div className="bg-black/50 backdrop-blur-xl border border-white/[0.12] border-t-0 rounded-b-2xl px-4 pt-4 pb-4 flex flex-col gap-3.5">
                    {/* Estimation Grid */}
                    {hasEst && (
                        <div>
                            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Estimated Values</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                {task.sheet_count > 0 && <Cell label="Est. Sheets" val={task.sheet_count} />}
                                {task.plate_count > 0 && <Cell label="Est. Plates" val={task.plate_count} />}
                                {task.quantity > 0 && <Cell label="Est. Output" val={task.quantity} />}
                                {task.wastage_sheets > 0 && <Cell label="Wastage" val={task.wastage_sheets} />}
                            </div>
                        </div>
                    )}

                    {/* Actual vs Estimated (for completed tasks) */}
                    {hasActuals && (
                        <div>
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Actual Values</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                {parseFloat(task.actual_sheets_printed) > 0 && <Cell label="Printed" val={parseFloat(task.actual_sheets_printed).toFixed(0)} />}
                                {parseFloat(task.actual_sheets_wasted) > 0 && <Cell label="Wastage" val={parseFloat(task.actual_sheets_wasted).toFixed(0)} />}
                                {parseInt(task.actual_plates_used) > 0 && <Cell label="Plates Used" val={task.actual_plates_used} />}
                                {parseInt(task.downtime_minutes) > 0 && <Cell label="Downtime" val={`${task.downtime_minutes}m`} />}
                                {task.downtime_reason && task.downtime_reason !== 'None' && <Cell label="Reason" val={task.downtime_reason} />}
                            </div>
                        </div>
                    )}

                    {/* Time Log */}
                    {(task.started_at || task.completed_at) && (
                        <div>
                            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Time Log</p>
                            <div className={`grid ${task.started_at && task.completed_at ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-center`}>
                                {task.started_at && <Cell label="Started" val={fmtDt(task.started_at)} />}
                                {task.completed_at && <Cell label="Completed" val={fmtDt(task.completed_at)} />}
                                {task.started_at && task.completed_at && (() => {
                                    const ms = new Date(task.completed_at) - new Date(task.started_at);
                                    const mins = Math.round(ms / 60000);
                                    const dur = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
                                    return <Cell label="Duration" val={dur} />;
                                })()}
                                {task.started_at && !task.completed_at && task.status === 'in_progress' && (() => {
                                    const ms = Date.now() - new Date(task.started_at).getTime();
                                    const mins = Math.round(ms / 60000);
                                    const dur = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
                                    return <Cell label="Running For" val={dur} />;
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    {task.status !== 'done' && (
                        <div>
                            <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Quick Actions</p>
                            <div className="flex gap-2">
                                {(task.status === 'pending' || task.status === 'paused') && (
                                    <button onClick={handleStart} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[11px] font-bold border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-all disabled:opacity-40 inline-flex items-center justify-center gap-1"><FiPlay className="w-3.5 h-3.5" />Start</button>
                                )}
                                {task.status === 'in_progress' && (
                                    <>
                                        <button onClick={handlePause} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[11px] font-bold border border-amber-400/60 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 transition-all disabled:opacity-40 inline-flex items-center justify-center gap-1"><FiPause className="w-3.5 h-3.5" />Pause</button>
                                        <button onClick={handleQuickDone} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[11px] font-bold border border-blue-500/60 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-all disabled:opacity-40 inline-flex items-center justify-center gap-1"><FiZap className="w-3.5 h-3.5" />Quick Done</button>
                                        <button onClick={() => onOpenComplete(task)} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[11px] font-bold border border-emerald-500/60 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-all disabled:opacity-40 inline-flex items-center justify-center gap-1"><FiCheckCircle className="w-3.5 h-3.5" />Log & Finish</button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}


                    {task.status === 'done' && <p className="text-[10px] text-neutral-700 text-center">This task is complete — no further changes allowed.</p>}
                </div>
            )}

            {/* Quick Done Confirmation Modal */}
            {quickDoneConfirm && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQuickDoneConfirm(false)}>
                    <div className="bg-neutral-950 border border-white/10 rounded-2xl w-full max-w-xs p-5 space-y-4 shadow-[0_24px_64px_rgba(0,0,0,0.8)] text-neutral-100" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-2"><FiZap className="w-6 h-6 text-blue-400" /></div>
                            <h3 className="font-extrabold text-white text-base">Quick Complete</h3>
                            <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">This will mark <span className="text-white font-semibold">{task.name}</span> as done using the estimated values.</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setQuickDoneConfirm(false)} className="flex-1 py-2.5 rounded-xl text-[11px] font-bold border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 transition-all">Cancel</button>
                            <button onClick={confirmQuickDone} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[11px] font-bold border border-emerald-500/60 bg-emerald-600 text-white hover:bg-emerald-500 transition-all disabled:opacity-40 inline-flex items-center justify-center gap-1"><FiCheck className="w-3.5 h-3.5" />Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Start Task Modal */}
            {startConfirm && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setStartConfirm(false)}>
                    <div className="bg-neutral-950 border border-white/10 rounded-2xl w-full max-w-xs p-5 space-y-4 shadow-[0_24px_64px_rgba(0,0,0,0.8)] text-neutral-100" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2"><FiPlay className="w-6 h-6 text-emerald-400" /></div>
                            <h3 className="font-extrabold text-white text-base">Start Task</h3>
                            <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">Starting <span className="text-white font-semibold">{task.name}</span></p>
                        </div>

                        <div className="space-y-3 bg-white/[0.02] border border-white/[0.06] p-3 rounded-xl">
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Start Time (IST)</label>
                                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                                    <FiClock className="w-3.5 h-3.5" />
                                    {fmtDt(new Date().toISOString())}
                                </div>
                            </div>
                            <div>
                                {(() => {
                                    const taskAssignedEmps = task.assigned_options?.assigned_employees || [];
                                    const taskAssignedTeams = task.assigned_options?.assigned_teams || [];
                                    const sourceName = task.assigned_options?.source_name;
                                    const taskEmpIds = new Set(taskAssignedEmps.map(e => e.id));
                                    const taskTeamIds = new Set(taskAssignedTeams.map(t => t.id));

                                    const otherEmployees = (allEmployees || []).filter(e => !taskEmpIds.has(e.id));
                                    const otherTeams = (allTeams || []).filter(t => !taskTeamIds.has(t.id));

                                    const knownNames = [
                                        ...taskAssignedEmps.map(e => e.name),
                                        ...taskAssignedTeams.map(t => t.name),
                                        ...otherEmployees.map(e => e.name),
                                        ...otherTeams.map(t => t.name)
                                    ];

                                    return (
                                        <>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="block text-[10px] font-bold text-neutral-500 uppercase">Assigned Operator / Team</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCustomAssignee(!isCustomAssignee)}
                                                    className="text-[10px] text-indigo-400 hover:underline"
                                                >
                                                    {isCustomAssignee ? 'Select from list' : 'Custom name'}
                                                </button>
                                            </div>

                                            {isCustomAssignee ? (
                                                <input
                                                    type="text"
                                                    value={startAssignee}
                                                    onChange={e => setStartAssignee(e.target.value)}
                                                    placeholder="Enter Operator or Team Name"
                                                    className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-xl text-xs text-white outline-none focus:border-emerald-500 placeholder-neutral-600"
                                                />
                                            ) : (
                                                <select
                                                    value={startAssignee}
                                                    onChange={e => {
                                                        if (e.target.value === '__CUSTOM__') {
                                                            setIsCustomAssignee(true);
                                                            setStartAssignee('');
                                                        } else {
                                                            setStartAssignee(e.target.value);
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                                                >
                                                    <option value="">-- Select Operator / Team --</option>
                                                    {taskAssignedEmps.length > 0 && (
                                                        <optgroup label={`Assigned to ${sourceName || task.machine_name || 'Machine'}`}>
                                                            {taskAssignedEmps.map(emp => (
                                                                <option key={`m-emp-${emp.id}`} value={emp.name}>
                                                                    {emp.name} {emp.job_title ? `(${emp.job_title})` : ''}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {taskAssignedTeams.length > 0 && (
                                                        <optgroup label={`Assigned Teams for ${sourceName || task.machine_name || 'Machine'}`}>
                                                            {taskAssignedTeams.map(t => (
                                                                <option key={`m-team-${t.id}`} value={t.name}>
                                                                    Team: {t.name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {otherEmployees.length > 0 && (
                                                        <optgroup label={taskAssignedEmps.length > 0 ? "Other Employees" : "All Employees"}>
                                                            {otherEmployees.map(emp => (
                                                                <option key={`emp-${emp.id}`} value={emp.name}>
                                                                    {emp.name} {emp.job_title ? `(${emp.job_title})` : ''}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {otherTeams.length > 0 && (
                                                        <optgroup label={taskAssignedTeams.length > 0 ? "Other Teams" : "All Teams"}>
                                                            {otherTeams.map(t => (
                                                                <option key={`team-${t.id}`} value={t.name}>
                                                                    Team: {t.name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    {startAssignee && !knownNames.includes(startAssignee) && (
                                                        <optgroup label="Current Assigned">
                                                            <option value={startAssignee}>{startAssignee}</option>
                                                        </optgroup>
                                                    )}
                                                    <option value="__CUSTOM__">+ Custom / Enter Other…</option>
                                                </select>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setStartConfirm(false)} className="flex-1 py-2.5 rounded-xl text-[11px] font-bold border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 transition-all">Cancel</button>
                            <button onClick={confirmStart} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[11px] font-bold border border-emerald-500/60 bg-emerald-600 text-white hover:bg-emerald-500 transition-all disabled:opacity-40 inline-flex items-center justify-center gap-1"><FiPlay className="w-3.5 h-3.5" />Start Now</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function JobTrackerPage({ params }) {
    const { id } = use(params);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('active_tasks');
    const [completingTask, setCompletingTask] = useState(null);
    const [actualSheets, setActualSheets] = useState('');
    const [actualWastage, setActualWastage] = useState('');
    const [actualPlates, setActualPlates] = useState('');
    const [downtimeMinutes, setDowntimeMinutes] = useState('0');
    const [downtimeReason, setDowntimeReason] = useState('None');
    const [modalSaving, setModalSaving] = useState(false);

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

    const handleTaskUpdated = (updated) => {
        setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === updated.id ? updated : t) }));
        load(); // reload to get updated SO status
    };

    const handleOpenComplete = (task) => {
        setCompletingTask(task);
        setActualSheets(task.sheet_count > 0 ? String(Math.ceil(parseFloat(task.sheet_count) - (parseFloat(task.wastage_sheets) || 0))) : '');
        setActualWastage(task.wastage_sheets > 0 ? String(task.wastage_sheets) : '');
        setActualPlates(task.plate_count > 0 ? String(task.plate_count) : '');
        setDowntimeMinutes('0');
        setDowntimeReason('None');
    };

    const handleSubmitCompletion = async (e) => {
        e.preventDefault();
        if (!completingTask) return;
        setModalSaving(true);
        try {
            const res = await fetch(`/api/sales-orders/${id}/tasks/${completingTask.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'done',
                    actual_sheets_printed: parseFloat(actualSheets) || 0,
                    actual_sheets_wasted: parseFloat(actualWastage) || 0,
                    actual_plates_used: parseInt(actualPlates) || 0,
                    downtime_minutes: parseInt(downtimeMinutes) || 0,
                    downtime_reason: downtimeReason,
                }),
            });
            const updated = await res.json();
            if (updated.error) throw new Error(updated.error);
            handleTaskUpdated(updated);
            setCompletingTask(null);
        } catch (err) { alert('Failed: ' + err.message); }
        finally { setModalSaving(false); }
    };

    /* Loading */
    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-center">
                <div className="w-10 h-10 rounded-full border-2 border-white/[0.07] border-t-neutral-400 mx-auto mb-4 animate-spin" />
                <p className="text-neutral-600 text-sm">Loading…</p>
            </div>
        </div>
    );

    /* Error */
    if (error || !data) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <p className="text-red-400 text-sm">{error || 'Not found'}</p>
        </div>
    );

    const { order, items, tasks } = data;
    const done = tasks.filter(t => t.status === 'done').length;
    const pct = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0;
    const soPill = SO_STATUS_PILL[order.status] || 'bg-neutral-500/10 text-neutral-400 border-neutral-500/25';

    return (
        <div className="font-sans bg-black min-h-screen text-neutral-100">

            {/* Top gradient wash */}
            <div className="fixed top-0 left-0 right-0 h-72 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(99,102,241,0.12)_0%,transparent_70%)] pointer-events-none z-0" />

            <div className="relative z-10">
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="px-5 pt-7 pb-0 border-b border-white/[0.07] backdrop-blur-xl bg-black/80">
                    <div className="max-w-[620px] mx-auto">
                        {/* Brand row */}
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-1.5">
                                    Production Job Tracker
                                </p>
                                <h1 className="text-[26px] font-extrabold text-neutral-100 m-0 tracking-tight">
                                    {order.code}
                                </h1>
                                <p className="text-neutral-400 mt-1 text-sm">{order.customer_name}</p>
                            </div>
                            <div className="text-right">
                                <span className={`inline-block px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide border ${soPill}`}>
                                    {order.status}
                                </span>
                                {order.delivery_date && (
                                    <p className="text-neutral-600 text-[11px] mt-1.5">
                                        <FiCalendar className="w-3 h-3 inline" /> {new Date(order.delivery_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Progress bar */}
                        {tasks.length > 0 && (
                            <div className="pb-5">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Progress</span>
                                    <span className={`text-xs font-bold ${pct === 100 ? 'text-emerald-400' : 'text-neutral-400'}`}>
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
                <div className="sticky top-0 z-10 backdrop-blur-xl bg-black/85 border-b border-white/[0.07]">
                    <div className="max-w-[620px] mx-auto flex px-5">
                        {[
                            { key: 'active_tasks', label: 'Active', badge: tasks.filter(t => t.status !== 'done').length },
                            { key: 'completed_tasks', label: 'Completed', badge: tasks.filter(t => t.status === 'done').length },
                            { key: 'details', label: 'Details', badge: items.length },
                        ].map(({ key, label, badge }) => (
                            <button key={key} onClick={() => setTab(key)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all duration-200 border-b-2
                                    ${tab === key
                                        ? 'border-indigo-400 text-neutral-100 font-bold'
                                        : 'border-transparent text-neutral-600 hover:text-neutral-400'}`}>
                                {label}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-all duration-200
                                    ${tab === key
                                        ? 'bg-indigo-400/15 text-indigo-400 border-indigo-400/30'
                                        : 'bg-white/[0.03] text-neutral-700 border-white/[0.07]'}`}>
                                    {badge}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Content ─────────────────────────────────────────────── */}
                <div className="max-w-[620px] mx-auto px-5 pt-5 pb-16">

                    {/* Active Tasks tab */}
                    {tab === 'active_tasks' && (
                        <>
                            {tasks.filter(t => t.status !== 'done').length > 0
                                ? tasks.filter(t => t.status !== 'done').map(task => (
                                    <TaskItem key={task.id} task={task} orderId={id} onUpdated={handleTaskUpdated} onOpenComplete={handleOpenComplete} allEmployees={data.employees} allTeams={data.teams} />
                                ))
                                : (
                                    <div className="text-center py-12 px-6 bg-white/[0.03] border border-dashed border-white/[0.07] rounded-2xl backdrop-blur-xl">
                                        <div className="mx-auto w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-2.5"><FiClipboard className="w-5 h-5 text-neutral-600" /></div>
                                        <p className="text-neutral-600 text-sm">No active tasks</p>
                                    </div>
                                )
                            }
                        </>
                    )}

                    {/* Completed Tasks tab */}
                    {tab === 'completed_tasks' && (
                        <>
                            {tasks.filter(t => t.status === 'done').length > 0
                                ? tasks.filter(t => t.status === 'done').map(task => (
                                    <TaskItem key={task.id} task={task} orderId={id} onUpdated={handleTaskUpdated} onOpenComplete={handleOpenComplete} allEmployees={data.employees} allTeams={data.teams} />
                                ))
                                : (
                                    <div className="text-center py-12 px-6 bg-white/[0.03] border border-dashed border-white/[0.07] rounded-2xl backdrop-blur-xl">
                                        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2.5"><FiCheckCircle className="w-5 h-5 text-emerald-500" /></div>
                                        <p className="text-neutral-600 text-sm">No completed tasks yet</p>
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
                                            <span className="font-bold text-sm text-neutral-100">{item.estimation_name || item.job_description}</span>
                                            <span className="text-[11px] text-neutral-600 bg-white/[0.03] border border-white/[0.07] rounded-full px-2.5 py-0.5">
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
                                                <div className="mt-3.5 pt-3.5 border-t border-white/[0.07]">
                                                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">
                                                        Finishings
                                                    </p>
                                                    <div className="flex flex-col gap-1.5">
                                                        {item.finishings.map((f, fi) => (
                                                            <div key={fi} className="flex items-center justify-between bg-amber-500/[0.05] border border-amber-500/[0.12] rounded-lg px-3 py-2">
                                                                <div>
                                                                    <span className="text-sm font-semibold text-neutral-100">{f.name}</span>
                                                                    {f.machine_name && (
                                                                        <span className="text-[11px] text-neutral-600 ml-2">· {f.machine_name}</span>
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
                                    <div className="text-center py-12 px-6 text-neutral-600 text-sm">
                                        No components found
                                    </div>
                                )
                            }
                        </>
                    )}

                    <p className="text-center mt-8 text-[10px] text-neutral-800 tracking-widest uppercase">
                        Pressmatics ERP · Production Tracking
                    </p>
                </div>
            </div>

            {/* ── Log & Finish Modal ────────────────────────────────── */}
            {completingTask && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCompletingTask(null)}>
                    <div className="bg-neutral-950 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] text-neutral-100" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-extrabold text-white text-base">Log & Finish</h3>
                                <p className="text-[10px] text-neutral-500 mt-0.5">Input actuals for task #{completingTask.id}</p>
                            </div>
                            <button onClick={() => setCompletingTask(null)} className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-400 hover:text-white"><FiX className="w-4 h-4" /></button>
                        </div>
                        <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-xl text-xs space-y-1">
                            <div className="font-semibold text-neutral-300">{completingTask.name}</div>
                            {completingTask.machine_name && <div className="text-[10px] text-indigo-400 inline-flex items-center gap-0.5"><FiPrinter className="w-3 h-3" /> {completingTask.machine_name}</div>}
                        </div>
                        <form onSubmit={handleSubmitCompletion} className="space-y-3">
                            {(completingTask.sheet_count > 0 || completingTask.name.toLowerCase().includes('printing')) && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1"><label className="block text-[10px] font-bold text-neutral-500 uppercase">Printed Sheets</label><input type="number" value={actualSheets} onChange={e => setActualSheets(e.target.value)} className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-xl text-xs text-white outline-none focus:border-emerald-500" required /></div>
                                    <div className="space-y-1"><label className="block text-[10px] font-bold text-neutral-500 uppercase">Wastage</label><input type="number" value={actualWastage} onChange={e => setActualWastage(e.target.value)} className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-xl text-xs text-white outline-none focus:border-emerald-500" required /></div>
                                </div>
                            )}
                            {(completingTask.plate_count > 0 || completingTask.name.toLowerCase().includes('plate')) && (
                                <div className="space-y-1"><label className="block text-[10px] font-bold text-neutral-500 uppercase">Plates Used</label><input type="number" value={actualPlates} onChange={e => setActualPlates(e.target.value)} className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-xl text-xs text-white outline-none focus:border-emerald-500" required /></div>
                            )}
                            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-3">
                                <div className="space-y-1"><label className="block text-[10px] font-bold text-neutral-500 uppercase">Downtime (Min)</label><input type="number" value={downtimeMinutes} onChange={e => setDowntimeMinutes(e.target.value)} className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-xl text-xs text-white outline-none focus:border-emerald-500" /></div>
                                <div className="space-y-1"><label className="block text-[10px] font-bold text-neutral-500 uppercase">Reason</label><select value={downtimeReason} onChange={e => setDowntimeReason(e.target.value)} className="w-full px-2 py-2 bg-black border border-white/[0.09] rounded-xl text-[11px] text-white outline-none focus:border-emerald-500"><option value="None">None</option><option value="Paper Jam">Paper Jam</option><option value="Plate Break">Plate Break</option><option value="Ink Washup">Ink Washup</option><option value="Machine Stoppage">Machine Stoppage</option><option value="Other">Other</option></select></div>
                            </div>
                            <button type="submit" disabled={modalSaving} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 transition-all disabled:opacity-40">
                                {modalSaving ? 'Saving…' : <><FiCheckCircle className="w-4 h-4" /> Submit & Mark Completed</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
