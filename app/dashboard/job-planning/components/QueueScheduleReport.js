'use client';

import { useState, useRef, useMemo } from 'react';
import { FiCalendar, FiCpu, FiLayers, FiDownload, FiEye, FiSliders, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { isInactiveSOStatus, isDoneTaskStatus } from '@/lib/constants/status';
import { calculateJobDeliveryRisk } from '@/lib/utils/bottleneckPredictor';

function today() {
    return new Date().toISOString().split('T')[0];
}
function fmtMins(m) {
    if (!m) return '—';
    const h = Math.floor(m / 60), mins = m % 60;
    return h > 0 ? `${h}h ${mins}m` : `${mins}m`;
}
function statusColor(s) {
    if (s === 'done') return '#10b981';
    if (s === 'in_progress') return '#f59e0b';
    return '#6366f1';
}
function statusLabel(s) {
    if (s === 'done') return 'Done';
    if (s === 'in_progress') return 'In Progress';
    return 'Pending';
}

const ALL_COLUMNS = [
    { key: 'order_code', label: 'Order Code' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'task_name', label: 'Task Name' },
    { key: 'queue_type', label: 'Queue' },
    { key: 'status', label: 'Status' },
    { key: 'est_time', label: 'Est. Time' },
    { key: 'actual_time', label: 'Actual Time' },
    { key: 'notes', label: 'Notes' },
];

function Toggle({ checked, onChange, label }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-300">
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`w-9 h-5 rounded-full transition-colors relative ${checked ? 'bg-indigo-500' : 'bg-white/10'}`}
            >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
            </button>
            {label}
        </label>
    );
}

function CheckBox({ checked, onChange, label }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-300">
            <button type="button" onClick={() => onChange(!checked)} className="text-indigo-400">
                {checked ? <FiCheckSquare className="w-4 h-4" /> : <FiSquare className="w-4 h-4 text-gray-600" />}
            </button>
            {label}
        </label>
    );
}

function ReportTable({ title, rows, columns, showStats, mergedLabel, accentColor = '#6366f1', viewMode = 'task' }) {
    const visibleCols = ALL_COLUMNS.filter(c => columns.includes(c.key));
    const done = rows.filter(r => r.status === 'done').length;
    const totalMins = rows.reduce((s, r) => s + (r.est_time || 0), 0);
    const actualMins = rows.reduce((s, r) => s + (r.actual_time || 0), 0);

    // For job-wise: group rows by order_code
    const jobGroups = viewMode === 'job' ? Object.values(
        rows.reduce((acc, row) => {
            const key = row.order_code || '—';
            const parts = (row.task_name || '').split(' — ');
            const singleJobName = parts.length >= 3 ? parts[2].trim() : (parts[parts.length - 1] || row.task_name || '—');

            if (!acc[key]) {
                acc[key] = {
                    order_code: key,
                    customer_name: row.customer_name || '—',
                    job_name: singleJobName,
                    status: row.status,
                    queue_type: row._queue,
                    est_time: row.est_time || 0,
                    actual_time: row.actual_time || 0,
                    notes: row.notes || '',
                    hasUnplanned: row._queue === 'unplanned',
                    hasPlanned: row._queue === 'planned',
                    allDone: row.status === 'done',
                    anyInProg: row.status === 'in_progress',
                };
            } else {
                acc[key].est_time += (row.est_time || 0);
                acc[key].actual_time += (row.actual_time || 0);
                if (row._queue === 'unplanned') acc[key].hasUnplanned = true;
                if (row._queue === 'planned') acc[key].hasPlanned = true;
                if (row.status !== 'done') acc[key].allDone = false;
                if (row.status === 'in_progress') acc[key].anyInProg = true;
                if (row.notes && !acc[key].notes.includes(row.notes)) {
                    acc[key].notes += (acc[key].notes ? '; ' : '') + row.notes;
                }
            }
            return acc;
        }, {})
    ) : [];

    function taskShortName(fullName) {
        const parts = (fullName || '').split(' — ');
        return parts.length >= 3 ? parts[2].trim() : (parts[parts.length - 1] || fullName || '—');
    }

    return (
        <div style={{ marginBottom: 32, pageBreakInside: 'avoid' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 4, height: 20, borderRadius: 2, background: accentColor }} />
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{title}</h3>
                {mergedLabel && <span style={{ fontSize: 10, color: accentColor, marginLeft: 4, fontWeight: 600 }}>— merged</span>}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#64748b' }}>
                    {viewMode === 'job' ? `${jobGroups.length} job${jobGroups.length !== 1 ? 's' : ''}` : `${rows.length} task${rows.length !== 1 ? 's' : ''}`}
                </span>
            </div>

            {showStats && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                    {[
                        { l: viewMode === 'job' ? 'Total Jobs' : 'Total Tasks', v: viewMode === 'job' ? jobGroups.length : rows.length, c: '#6366f1' },
                        { l: 'Tasks Done', v: done, c: '#10b981' },
                        { l: 'Pending', v: rows.length - done, c: '#f59e0b' },
                        { l: 'Est. Hours', v: fmtMins(totalMins), c: '#06b6d4' },
                        { l: 'Actual Hours', v: fmtMins(actualMins), c: '#8b5cf6' },
                        { l: '% Done', v: rows.length > 0 ? `${Math.round((done / rows.length) * 100)}%` : '0%', c: '#10b981' },
                    ].map(s => (
                        <div key={s.l} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', minWidth: 90 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
                            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>{s.l}</div>
                        </div>
                    ))}
                </div>
            )}

            {rows.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 12, border: '1px dashed #e2e8f0', borderRadius: 8 }}>
                    No tasks found for this selection.
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                        <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>#</th>
                            {visibleCols.map(c => (
                                <th key={c.key} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', borderBottom: '2px solid #e2e8f0' }}>
                                    {c.key === 'task_name' && viewMode === 'job' ? 'Task' : c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {viewMode === 'job' ? (
                            jobGroups.map((job, ji) => (
                                <tr key={`job-${job.order_code}-${ji}`} style={{ borderBottom: '1px solid #f1f5f9', background: ji % 2 === 1 ? '#fafbfd' : 'white' }}>
                                    <td style={{ padding: '6px 10px', color: '#94a3b8', fontWeight: 600 }}>{ji + 1}</td>
                                    {visibleCols.map(c => (
                                        <td key={c.key} style={{ padding: '6px 10px', color: '#334155', maxWidth: 220 }}>
                                            {c.key === 'order_code' ? job.order_code
                                            : c.key === 'customer_name' ? job.customer_name
                                            : c.key === 'task_name'
                                                ? <span style={{ fontSize: 10, color: '#475569', fontWeight: 500 }}>
                                                    {job.job_name}
                                                  </span>
                                            : c.key === 'status'
                                                ? (() => {
                                                    const sv = job.allDone ? 'done' : job.anyInProg ? 'in_progress' : 'pending';
                                                    return <span style={{ fontSize: 10, fontWeight: 600, color: statusColor(sv), background: `${statusColor(sv)}18`, padding: '2px 8px', borderRadius: 20 }}>{statusLabel(sv)}</span>;
                                                  })()
                                            : c.key === 'queue_type'
                                                ? (() => {
                                                    const lbl = job.hasUnplanned && job.hasPlanned ? 'Mixed' : job.hasUnplanned ? 'Unplanned' : 'Planned';
                                                    const col = job.hasUnplanned && job.hasPlanned ? '#8b5cf6' : job.hasUnplanned ? '#f59e0b' : '#6366f1';
                                                    return <span style={{ fontSize: 10, fontWeight: 600, color: col, background: `${col}18`, padding: '2px 8px', borderRadius: 20 }}>{lbl}</span>;
                                                  })()
                                            : c.key === 'est_time' ? fmtMins(job.est_time)
                                            : c.key === 'actual_time' ? fmtMins(job.actual_time)
                                            : c.key === 'notes' ? (job.notes || '—')
                                            : '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            rows.map((row, i) => (
                                <tr key={row.id || i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 1 ? '#fafbfd' : 'white' }}>
                                    <td style={{ padding: '6px 10px', color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                                    {visibleCols.map(c => (
                                        <td key={c.key} style={{ padding: '6px 10px', color: '#334155', maxWidth: 200 }}>
                                            {c.key === 'status' ? (
                                                <span style={{ fontSize: 10, fontWeight: 600, color: statusColor(row.status), background: `${statusColor(row.status)}18`, padding: '2px 8px', borderRadius: 20 }}>
                                                    {statusLabel(row.status)}
                                                </span>
                                            ) : c.key === 'queue_type' ? (
                                                <span style={{ fontSize: 10, fontWeight: 600, color: row._queue === 'unplanned' ? '#f59e0b' : '#6366f1', background: row._queue === 'unplanned' ? '#fef3c730' : '#6366f118', padding: '2px 8px', borderRadius: 20 }}>
                                                    {row._queue === 'unplanned' ? 'Unplanned' : 'Planned'}
                                                </span>
                                            ) : c.key === 'est_time' ? fmtMins(row.est_time)
                                                : c.key === 'actual_time' ? fmtMins(row.actual_time)
                                                    : c.key === 'task_name' ? (row.task_name || '—')
                                                        : c.key === 'order_code' ? (row.order_code || '—')
                                                            : c.key === 'customer_name' ? (row.customer_name || '—')
                                                                : c.key === 'notes' ? (row.notes || '—')
                                                                    : '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
}

const GROUP_OPTIONS = [
    { value: 'none', label: 'No Merge', color: '#475569' },
    { value: 'g1', label: 'Group 1', color: '#6366f1' },
    { value: 'g2', label: 'Group 2', color: '#10b981' },
    { value: 'g3', label: 'Group 3', color: '#f59e0b' },
    { value: 'g4', label: 'Group 4', color: '#ef4444' },
];

export default function QueueScheduleReport({ machines = [], finishings = [], orders = [] }) {
    const previewRef = useRef(null);
    const [selectedDate, setSelectedDate] = useState(today());
    const [selectedMachines, setSelectedMachines] = useState([]);
    const [selectedFinishings, setSelectedFinishings] = useState([]);
    const [queueTypes, setQueueTypes] = useState({});
    const [mergeGroups, setMergeGroups] = useState({}); // resourceKey -> 'none'|'g1'|'g2'|'g3'|'g4'
    const [columns, setColumns] = useState(ALL_COLUMNS.map(c => c.key));
    const [showStats, setShowStats] = useState(true);
    const [viewMode, setViewMode] = useState('task'); // 'task' | 'job'
    const [generating, setGenerating] = useState(false);

    const allTasks = useMemo(() => {
        const result = [];
        orders.forEach(o => {
            if (isInactiveSOStatus(o.status)) return;
            (o.tasks || []).forEach(t => {
                if (isDoneTaskStatus(t.status) || isInactiveSOStatus(t.status)) return;
                const risk = calculateJobDeliveryRisk({ ...t, delivery_date: o.delivery_date }, 0, 8);
                result.push({
                    ...t,
                    order_code: o.code || '—',
                    customer_name: o.customer_name || '—',
                    task_name: t.name || '—',
                    est_time: t.estimated_minutes || 0,
                    actual_time: t.actual_minutes || 0,
                    notes: t.notes || '',
                    delivery_date: o.delivery_date || t.delivery_date,
                    deliveryRisk: risk
                });
            });
        });
        return result;
    }, [orders]);

    function getKey(type, id) { return `${type}_${id}`; }
    function getQueueType(key) { return queueTypes[key] || 'both'; }
    function setQueueType(key, val) { setQueueTypes(prev => ({ ...prev, [key]: val })); }
    function getMergeGroup(key) { return mergeGroups[key] || 'none'; }
    function setMergeGroup(key, val) { setMergeGroups(prev => ({ ...prev, [key]: val })); }

    function toggleResource(type, id, selected, setSelected) {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
    function toggleColumn(key) {
        setColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }

    function getTasksForResource(type, id) {
        const key = getKey(type, id);
        const qt = getQueueType(key);
        const field = type === 'machine' ? 'machine_id' : 'finishing_id';
        return allTasks
            .filter(t => t[field] === id)
            .filter(t => {
                const isPlanned = t.scheduled_date === selectedDate;
                const isUnplanned = !t.scheduled_date;
                if (qt === 'planned') return isPlanned;
                if (qt === 'unplanned') return isUnplanned;
                return isPlanned || isUnplanned;
            })
            .map(t => ({
                ...t,
                _queue: t.scheduled_date === selectedDate ? 'planned' : 'unplanned',
                _resourceName: type === 'machine'
                    ? (machines.find(m => m.id === id)?.name || id)
                    : (finishings.find(f => f.id === id)?.name || id),
            }));
    }

    // Build flat sections first, each with its merge group
    const flatSections = useMemo(() => {
        const sections = [];
        selectedMachines.forEach(id => {
            const m = machines.find(x => x.id === id);
            if (!m) return;
            const key = getKey('machine', id);
            sections.push({ title: ` ${m.name}`, rows: getTasksForResource('machine', id), id: key, group: getMergeGroup(key) });
        });
        selectedFinishings.forEach(id => {
            const f = finishings.find(x => x.id === id);
            if (!f) return;
            const key = getKey('finishing', id);
            sections.push({ title: ` ${f.name}`, rows: getTasksForResource('finishing', id), id: key, group: getMergeGroup(key) });
        });
        return sections;
    }, [selectedMachines, selectedFinishings, allTasks, selectedDate, queueTypes, mergeGroups]);

    // Collapse sections into render units: merged groups share one entry, 'none' sections stay individual
    const reportSections = useMemo(() => {
        const result = [];
        const seen = new Set();
        flatSections.forEach(s => {
            if (s.group === 'none') {
                result.push({ ...s, merged: false });
            } else {
                if (!seen.has(s.group)) {
                    seen.add(s.group);
                    const grouped = flatSections.filter(x => x.group === s.group);
                    const gOpt = GROUP_OPTIONS.find(g => g.value === s.group);
                    result.push({
                        id: `group_${s.group}`,
                        title: `${gOpt?.label || s.group} — ${grouped.map(x => x.title).join(', ')}`,
                        rows: grouped.flatMap(x => x.rows),
                        merged: true,
                        groupColor: gOpt?.color,
                    });
                }
            }
        });
        return result;
    }, [flatSections]);

    async function downloadPDF() {
        if (!previewRef.current) return;
        setGenerating(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).jsPDF;
            const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const imgW = pageW - 20;
            const imgH = (canvas.height * imgW) / canvas.width;
            let y = 10;
            let remaining = imgH;
            while (remaining > 0) {
                const sliceH = Math.min(remaining, pageH - 20);
                pdf.addImage(imgData, 'PNG', 10, y, imgW, imgH, '', 'FAST');
                remaining -= sliceH;
                if (remaining > 0) { pdf.addPage(); y = 10; }
            }
            pdf.save(`Queue-Report-${selectedDate}.pdf`);
        } catch (e) {
            console.error('PDF error', e);
        } finally {
            setGenerating(false);
        }
    }

    const hasSelection = selectedMachines.length > 0 || selectedFinishings.length > 0;

    return (
        <div className="flex flex-col gap-6">
            {/* ── Config Panel ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

                {/* Date + Merge + Stats */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                        <FiSliders className="w-3.5 h-3.5" /> Report Settings
                    </h4>
                    <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Date</label>
                        <div className="relative">
                            <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 pt-1 border-t border-white/5">
                        <Toggle checked={showStats} onChange={setShowStats} label="Show stats block" />
                        {/* View mode toggle */}
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1.5">View Mode</label>
                            <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-xl">
                                <button
                                    onClick={() => setViewMode('task')}
                                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${viewMode === 'task' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white'
                                        }`}
                                >Task-wise</button>
                                <button
                                    onClick={() => setViewMode('job')}
                                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${viewMode === 'job' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white'
                                        }`}
                                >Job-wise</button>
                            </div>
                        </div>
                        <p className="text-[10px] text-gray-600 leading-relaxed">Assign resources to merge groups in the resource panel to combine their data into one table.</p>
                    </div>
                </div>

                {/* Resource Selector */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                        <FiCpu className="w-3.5 h-3.5" /> Machines & Finishings
                    </h4>

                    {machines.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1.5"><FiCpu className="w-3 h-3" /> Machines</p>
                            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                                {machines.map(m => (
                                    <div key={m.id} className="flex items-center justify-between">
                                        <CheckBox
                                            checked={selectedMachines.includes(m.id)}
                                            onChange={() => toggleResource('machine', m.id, selectedMachines, setSelectedMachines)}
                                            label={m.name}
                                        />
                                        {selectedMachines.includes(m.id) && (
                                            <div className="flex items-center gap-1.5">
                                                <select
                                                    value={getQueueType(getKey('machine', m.id))}
                                                    onChange={e => setQueueType(getKey('machine', m.id), e.target.value)}
                                                    className="bg-black/40 border border-white/10 rounded-lg text-[10px] text-white px-2 py-0.5 focus:outline-none"
                                                >
                                                    <option value="both">Both</option>
                                                    <option value="planned">Planned</option>
                                                    <option value="unplanned">Unplanned</option>
                                                </select>
                                                <select
                                                    value={getMergeGroup(getKey('machine', m.id))}
                                                    onChange={e => setMergeGroup(getKey('machine', m.id), e.target.value)}
                                                    className="bg-black/40 border border-white/10 rounded-lg text-[10px] px-2 py-0.5 focus:outline-none font-bold"
                                                    style={{ color: GROUP_OPTIONS.find(g => g.value === getMergeGroup(getKey('machine', m.id)))?.color || '#475569' }}
                                                >
                                                    {GROUP_OPTIONS.map(g => <option key={g.value} value={g.value} style={{ color: g.color }}>{g.label}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {finishings.length > 0 && (
                        <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1.5"><FiLayers className="w-3 h-3" /> Finishings</p>
                            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                                {finishings.map(f => (
                                    <div key={f.id} className="flex items-center justify-between">
                                        <CheckBox
                                            checked={selectedFinishings.includes(f.id)}
                                            onChange={() => toggleResource('finishing', f.id, selectedFinishings, setSelectedFinishings)}
                                            label={f.name}
                                        />
                                        {selectedFinishings.includes(f.id) && (
                                            <div className="flex items-center gap-1.5">
                                                <select
                                                    value={getQueueType(getKey('finishing', f.id))}
                                                    onChange={e => setQueueType(getKey('finishing', f.id), e.target.value)}
                                                    className="bg-black/40 border border-white/10 rounded-lg text-[10px] text-white px-2 py-0.5 focus:outline-none"
                                                >
                                                    <option value="both">Both</option>
                                                    <option value="planned">Planned</option>
                                                    <option value="unplanned">Unplanned</option>
                                                </select>
                                                <select
                                                    value={getMergeGroup(getKey('finishing', f.id))}
                                                    onChange={e => setMergeGroup(getKey('finishing', f.id), e.target.value)}
                                                    className="bg-black/40 border border-white/10 rounded-lg text-[10px] px-2 py-0.5 focus:outline-none font-bold"
                                                    style={{ color: GROUP_OPTIONS.find(g => g.value === getMergeGroup(getKey('finishing', f.id)))?.color || '#475569' }}
                                                >
                                                    {GROUP_OPTIONS.map(g => <option key={g.value} value={g.value} style={{ color: g.color }}>{g.label}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Column Selector + Download */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                        <FiEye className="w-3.5 h-3.5" /> Columns & Export
                    </h4>
                    <div className="flex flex-col gap-2">
                        {ALL_COLUMNS.map(c => (
                            <CheckBox key={c.key} checked={columns.includes(c.key)} onChange={() => toggleColumn(c.key)} label={c.label} />
                        ))}
                    </div>
                    <div className="mt-auto pt-3 border-t border-white/5 flex flex-col gap-2">
                        <button
                            onClick={downloadPDF}
                            disabled={!hasSelection || generating}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                        >
                            <FiDownload className="w-4 h-4" />
                            {generating ? 'Generating PDF...' : 'Download PDF'}
                        </button>
                        {!hasSelection && (
                            <p className="text-[10px] text-gray-600 text-center">Select at least one machine or finishing to generate a report.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Report Preview ───────────────────────────────────── */}
            {hasSelection && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Report Preview</span>
                        <span className="text-[10px] text-gray-600 font-mono">{selectedDate} · {reportSections.length} section{reportSections.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* White print-ready canvas */}
                    <div ref={previewRef} style={{ background: 'white', padding: '28px 32px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {/* Report Header */}
                        <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Queue &amp; Schedule Report</div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                                    Date: <strong>{selectedDate}</strong> &nbsp;·&nbsp; {reportSections.length} Section{reportSections.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>
                                Generated: {new Date().toLocaleString()}<br />
                                <span style={{ color: '#6366f1', fontWeight: 600 }}>Pressmatics ERP</span>
                            </div>
                        </div>

                        {/* Tables */}
                        {reportSections.map(s => (
                            <ReportTable
                                key={s.id}
                                title={s.title}
                                rows={s.rows}
                                columns={columns}
                                showStats={showStats}
                                mergedLabel={s.merged}
                                accentColor={s.groupColor}
                                viewMode={viewMode}
                            />
                        ))}

                        {/* Footer */}
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 16, fontSize: 9, color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Pressmatics ERP · Queue & Schedule Report</span>
                            <span>Confidential — Internal Use Only</span>
                        </div>
                    </div>
                </div>
            )}

            {!hasSelection && (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-2xl text-center gap-3">
                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                        <FiCpu className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className="text-gray-400 text-sm font-semibold">Select machines or finishings to generate a report</p>
                    <p className="text-gray-600 text-xs max-w-xs">Choose resources from the panel above, configure queue types, and the report will appear here instantly.</p>
                </div>
            )}
        </div>
    );
}
