'use client';

import { useMemo, useState } from 'react';
import {
    FiActivity, FiAlertTriangle, FiBarChart2, FiCheckCircle, FiClock,
    FiCpu, FiInbox, FiLayers, FiList, FiTrendingUp, FiZap,
} from 'react-icons/fi';

// ─── helpers ────────────────────────────────────────────────────────────────
function getWeekStart(d = new Date()) {
    const day = new Date(d);
    const diff = day.getDay() === 0 ? -6 : 1 - day.getDay();
    day.setDate(day.getDate() + diff);
    day.setHours(0, 0, 0, 0);
    return day;
}
function formatDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}
function formatHours(mins) {
    if (!mins) return '0h';
    const h = Math.round((mins / 60) * 10) / 10;
    return `${h}h`;
}

// ─── color helpers ───────────────────────────────────────────────────────────
const GRAD_GREEN  = 'linear-gradient(90deg, #10b981, #06b6d4)';
const GRAD_RED    = 'linear-gradient(90deg, #f97316, #ef4444)';
const GRAD_PURPLE = 'linear-gradient(90deg, #8b5cf6, #a78bfa)';
const GRAD_AMBER  = 'linear-gradient(90deg, #f59e0b, #fbbf24)';

// ─── sub-components ──────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent, grad }) {
    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col gap-2 min-w-[140px] flex-1">
            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: `${accent}20` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
            </div>
            <span className="text-2xl font-black" style={{
                background: grad || accent, WebkitBackgroundClip: grad ? 'text' : undefined,
                WebkitTextFillColor: grad ? 'transparent' : accent, color: grad ? undefined : accent,
            }}>{value}</span>
            {sub && <span className="text-[10px] text-gray-500">{sub}</span>}
        </div>
    );
}

function SectionTitle({ icon: Icon, title, accent = '#10b981' }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <Icon className="w-4 h-4" style={{ color: accent }} />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white m-0">{title}</h3>
            <div className="flex-1 h-px bg-white/5 ml-2" />
        </div>
    );
}

function HorizBar({ label, used, total, usedLabel, pct, over, accent }) {
    const barGrad = over ? GRAD_RED : (accent ? `linear-gradient(90deg, ${accent}, ${accent}cc)` : GRAD_GREEN);
    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px]">
                <span className={`font-semibold truncate max-w-[180px] ${over ? 'text-red-400' : 'text-gray-300'}`}>{label}</span>
                <span className={`font-bold tabular-nums ${over ? 'text-red-400' : 'text-gray-400'}`}>
                    {usedLabel}{total != null ? ` / ${total}` : ''}
                    {over && <span className="ml-1 text-[9px] bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">OVER</span>}
                </span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, pct)}%`, background: barGrad }} />
            </div>
        </div>
    );
}

function StatusBadge({ count, label, color, grad }) {
    return (
        <div className="flex-1 bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1.5 items-center text-center min-w-[90px]">
            <span className="text-2xl font-black" style={{
                background: grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>{count}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
        </div>
    );
}

// ─── main component ──────────────────────────────────────────────────────────
export default function AnalyticsDashboard({ machines, finishings, orders }) {
    const weekStart = useMemo(() => getWeekStart(), []);

    // Build week date keys (Mon–Sun)
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return { dateStr: formatDateKey(d), label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) };
        });
    }, [weekStart]);

    const allTasks = useMemo(() => orders.flatMap(o => o.tasks || []), [orders]);

    // ─── global stats ─────────────────────────────────────────────────────────
    const totalOrders  = orders.filter(o => o.id != null).length;
    const totalTasks   = allTasks.length;
    const doneTasks    = allTasks.filter(t => t.status === 'done').length;
    const inProgTasks  = allTasks.filter(t => t.status === 'in_progress').length;
    const pendingTasks = allTasks.filter(t => t.status === 'pending').length;
    const globalPct    = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const inProd       = orders.filter(o => o.status === 'In Production').length;
    const totalScheduledMins = allTasks.filter(t => t.scheduled_date).reduce((s, t) => s + (t.estimated_minutes || 0), 0);

    // ─── this-week tasks ─────────────────────────────────────────────────────
    const weekDaySet = new Set(weekDays.map(d => d.dateStr));
    const weekTasks  = allTasks.filter(t => t.scheduled_date && weekDaySet.has(t.scheduled_date));
    const weekMins   = weekTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
    const weekDone   = weekTasks.filter(t => t.status === 'done').length;
    const weekPct    = weekTasks.length > 0 ? Math.round((weekDone / weekTasks.length) * 100) : 0;

    // Unplanned (no scheduled_date, no machine_id) — backlog
    const unplannedTasks = allTasks.filter(t => !t.scheduled_date && !t.machine_id && !t.finishing_id);

    // ─── machine load this week ───────────────────────────────────────────────
    const SHIFT_MINS = 8 * 60;      // single daily shift (480 min)
    const WEEK_DAYS  = 5;           // Mon–Fri working days
    const machineStats = useMemo(() => machines.map(m => {
        const mTasks  = weekTasks.filter(t => t.machine_id === m.id);
        const mins    = mTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
        const dayCap  = (m.shift_limit || 8) * 60;
        const weekCap = dayCap * WEEK_DAYS;          // 5-day weekly capacity
        return { ...m, mins, cap: weekCap, dayCap, pct: Math.round((mins / weekCap) * 100), over: mins > weekCap, tasks: mTasks.length };
    }).sort((a, b) => b.pct - a.pct), [machines, weekTasks]);

    // ─── finishing load this week ─────────────────────────────────────────────
    const finishingStats = useMemo(() => finishings.map(f => {
        const fTasks  = weekTasks.filter(t => t.finishing_id === f.id);
        const mins    = fTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
        const weekCap = SHIFT_MINS * WEEK_DAYS;      // 5-day weekly capacity
        return { ...f, mins, cap: weekCap, pct: Math.round((mins / weekCap) * 100), over: mins > weekCap, tasks: fTasks.length };
    }).sort((a, b) => b.pct - a.pct), [finishings, weekTasks]);

    // ─── daily load this week (all resources combined) ────────────────────────
    const dailyLoad = useMemo(() => weekDays.map(day => {
        const dayTasks = weekTasks.filter(t => t.scheduled_date === day.dateStr);
        const mins = dayTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
        return { ...day, mins, tasks: dayTasks.length };
    }), [weekDays, weekTasks]);
    const maxDayMins = Math.max(...dailyLoad.map(d => d.mins), SHIFT_MINS);

    // ─── top orders by scheduled hours ───────────────────────────────────────
    const topOrders = useMemo(() => {
        return orders
            .filter(o => o.id != null)
            .map(o => {
                const oTasks = (o.tasks || []);
                const scheduledMins = oTasks.filter(t => t.scheduled_date).reduce((s, t) => s + (t.estimated_minutes || 0), 0);
                const done = oTasks.filter(t => t.status === 'done').length;
                const pct = oTasks.length > 0 ? Math.round((done / oTasks.length) * 100) : 0;
                return { ...o, scheduledMins, taskCount: oTasks.length, done, pct };
            })
            .sort((a, b) => b.scheduledMins - a.scheduledMins)
            .slice(0, 8);
    }, [orders]);
    const maxOrderMins = Math.max(...topOrders.map(o => o.scheduledMins), 1);

    // ─── overloaded check ─────────────────────────────────────────────────────
    const overloadedMachines  = machineStats.filter(m => m.over);
    const overloadedFinishing = finishingStats.filter(f => f.over);

    return (
        <div className="flex flex-col gap-6">

            {/* ── KPI row ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3">
                <KpiCard icon={FiList}        label="Active Orders"    value={totalOrders}         sub={`${inProd} in production`}      accent="#a78bfa" grad={GRAD_PURPLE} />
                <KpiCard icon={FiBarChart2}   label="Total Tasks"      value={totalTasks}           sub={`${weekTasks.length} this week`} accent="#06b6d4" />
                <KpiCard icon={FiCheckCircle} label="Completed"        value={`${globalPct}%`}      sub={`${doneTasks} of ${totalTasks}`} accent="#10b981" grad={GRAD_GREEN} />
                <KpiCard icon={FiZap}         label="In Progress"      value={inProgTasks}          sub={`${pendingTasks} pending`}       accent="#f59e0b" grad={GRAD_AMBER} />
                <KpiCard icon={FiClock}       label="Scheduled (Week)" value={formatHours(weekMins)} sub={`${weekPct}% complete`}         accent="#8b5cf6" />
                <KpiCard icon={FiInbox}       label="Unplanned Queue"  value={unplannedTasks.length} sub="tasks without schedule"        accent="#f87171" />
            </div>

            {/* ── Alert row: overloaded ────────────────────────────────────── */}
            {(overloadedMachines.length > 0 || overloadedFinishing.length > 0) && (
                <div className="bg-orange-500/[0.06] border border-orange-500/20 rounded-2xl p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-orange-400">
                        <FiAlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Over-Capacity This Week</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {overloadedMachines.map(m => (
                            <span key={m.id} className="text-[11px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded-full">
                                🖨️ {m.name} ({m.pct}%)
                            </span>
                        ))}
                        {overloadedFinishing.map(f => (
                            <span key={f.id} className="text-[11px] font-semibold bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full">
                                ✂️ {f.name} ({f.pct}%)
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Two column row ───────────────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row gap-6">

                {/* Left: Daily load this week */}
                <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col">
                    <SectionTitle icon={FiActivity} title="Daily Load This Week (All Resources)" />
                    <div className="flex flex-col gap-3 flex-1">
                        {dailyLoad.map(day => {
                            const pct = Math.round((day.mins / maxDayMins) * 100);
                            const over = day.mins > SHIFT_MINS;
                            return (
                                <div key={day.dateStr} className="flex items-center gap-3 text-[11px]">
                                    <span className="w-24 text-gray-400 font-medium shrink-0">{day.label}</span>
                                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
                                        <div className="h-full rounded-full transition-all duration-500 flex items-center"
                                            style={{ width: `${pct}%`, background: over ? GRAD_RED : GRAD_GREEN }}>
                                        </div>
                                        {/* Capacity line */}
                                        <div className="absolute top-0 bottom-0 w-px bg-white/20"
                                            style={{ left: `${Math.round((SHIFT_MINS / maxDayMins) * 100)}%` }} />
                                    </div>
                                    <span className={`w-28 text-right font-bold tabular-nums shrink-0 ${over ? 'text-red-400' : day.mins > 0 ? 'text-white' : 'text-gray-600'}`}>
                                        {formatHours(day.mins)} · {day.tasks} tasks
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[9px] text-gray-600 mt-3">Vertical line = 8h shift capacity. Red = over capacity.</p>
                </div>

                {/* Right: Task status breakdown */}
                <div className="xl:w-[280px] bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                    <SectionTitle icon={FiBarChart2} title="Task Status Breakdown" accent="#a78bfa" />

                    <div className="flex gap-2">
                        <StatusBadge count={doneTasks}    label="Done"        grad={GRAD_GREEN} />
                        <StatusBadge count={inProgTasks}  label="In Progress" grad={GRAD_AMBER} />
                        <StatusBadge count={pendingTasks} label="Pending"     grad={GRAD_PURPLE} />
                    </div>

                    <div className="flex flex-col gap-2 mt-1">
                        {[
                            { label: 'Done',        count: doneTasks,    grad: GRAD_GREEN },
                            { label: 'In Progress', count: inProgTasks,  grad: GRAD_AMBER },
                            { label: 'Pending',     count: pendingTasks, grad: GRAD_PURPLE },
                        ].map(s => (
                            <div key={s.label} className="flex flex-col gap-1">
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>{s.label}</span>
                                    <span className="font-bold">{totalTasks > 0 ? Math.round((s.count / totalTasks) * 100) : 0}%</span>
                                </div>
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${totalTasks > 0 ? Math.round((s.count / totalTasks) * 100) : 0}%`, background: s.grad }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-auto pt-3 border-t border-white/5">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">Overall progress</span>
                            <span className="font-black text-white">{globalPct}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1.5">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${globalPct}%`, background: GRAD_GREEN }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Machine load this week ───────────────────────────────────── */}
            {machines.length > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                    <SectionTitle icon={FiCpu} title="Machine Load This Week" accent="#06b6d4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
                        {machineStats.map(m => (
                            <HorizBar
                                key={m.id}
                                label={`${m.name}${m.type ? ` · ${m.type}` : ''}`}
                                pct={m.pct}
                                usedLabel={`${formatHours(m.mins)} (${m.tasks} tasks)`}
                                total={`${formatHours(m.cap)} weekly cap`}
                                over={m.over}
                            />
                        ))}
                        {machineStats.length === 0 && (
                            <p className="text-gray-600 text-xs">No machine tasks scheduled this week.</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Finishing load this week ─────────────────────────────────── */}
            {finishings.length > 0 && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                    <SectionTitle icon={FiLayers} title="Finishing Operations Load This Week" accent="#a78bfa" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3">
                        {finishingStats.map(f => (
                            <HorizBar
                                key={f.id}
                                label={f.name}
                                pct={f.pct}
                                usedLabel={`${formatHours(f.mins)} (${f.tasks} tasks)`}
                                total={`${formatHours(f.cap)} weekly cap`}
                                over={f.over}
                                accent="#a78bfa"
                            />
                        ))}
                        {finishingStats.length === 0 && (
                            <p className="text-gray-600 text-xs">No finishing tasks scheduled this week.</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Top Orders by Load ───────────────────────────────────────── */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                <SectionTitle icon={FiTrendingUp} title="Top Orders by Scheduled Load" accent="#f59e0b" />
                <div className="flex flex-col gap-3">
                    {topOrders.map(o => {
                        const pct = maxOrderMins > 0 ? Math.round((o.scheduledMins / maxOrderMins) * 100) : 0;
                        const overdue = o.delivery_date && new Date(o.delivery_date) < new Date();
                        return (
                            <div key={o.id} className="flex items-center gap-3 text-[11px]">
                                <div className="w-32 shrink-0 flex flex-col gap-0.5">
                                    <span className="font-bold text-white truncate">{o.code}</span>
                                    <span className="text-gray-500 truncate text-[10px]">{o.customer_name}</span>
                                </div>
                                <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden relative">
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%`, background: overdue ? GRAD_RED : GRAD_AMBER, minWidth: pct > 0 ? 4 : 0 }}>
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-3 w-52 justify-end">
                                    <span className="text-gray-400 tabular-nums">{formatHours(o.scheduledMins)} · {o.taskCount} tasks</span>
                                    <div className="flex items-center gap-1">
                                        <div className="w-10 h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${o.pct}%`, background: GRAD_GREEN }} />
                                        </div>
                                        <span className="text-[10px] text-gray-500">{o.pct}%</span>
                                    </div>
                                    {overdue && <span className="text-[9px] text-red-400 border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 rounded-full">OVERDUE</span>}
                                </div>
                            </div>
                        );
                    })}
                    {topOrders.length === 0 && (
                        <p className="text-gray-600 text-xs">No orders with scheduled tasks yet.</p>
                    )}
                </div>
            </div>

        </div>
    );
}
