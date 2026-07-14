'use client';
import { useState, useEffect } from 'react';
import {
    FiChevronLeft, FiChevronRight, FiChevronDown, FiClock, FiPrinter,
    FiTrendingUp, FiAlertTriangle, FiBookOpen, FiActivity, FiDownload,
    FiX, FiInfo, FiZap, FiSettings, FiPackage, FiUser, FiCalendar, FiEdit2, FiLayers, FiMove
} from 'react-icons/fi';

const G = {
    bg: '#070710',
    glass: 'rgba(255,255,255,0.03)',
    border: 'rgba(255,255,255,0.08)',
    borderHov: 'rgba(255,255,255,0.15)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
    dim: '#64748b',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#a78bfa'
};

const STATUS_DOT = { pending: '#64748b', in_progress: '#f59e0b', done: '#10b981' };

const getStartOfWeek = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const start = new Date(date.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
};

const formatDateKey = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getLocalDateString = (dateVal) => {
    if (!dateVal) return '';
    if (dateVal instanceof Date) {
        const y = dateVal.getFullYear();
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        const d = String(dateVal.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const str = String(dateVal);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.substring(0, 10);
    }
    try {
        const d = new Date(str);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch {
        return '';
    }
};

// ── DroppableContainer Wrapper ────────────────────────────────────────────
function DroppableContainer({ id, children, style, onDrop, dragOverColumnId, setDragOverColumnId }) {
    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        setDragOverColumnId(id);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDrop={(e) => {
                e.preventDefault();
                onDrop && onDrop(null, id);
            }}
            style={{ ...style }}
        >
            {children}
        </div>
    );
}

// ── Sortable Task Card Helpers ───────────────────────────────────────────
const formatTimeDisplay = (mins) => {
    if (!mins) return '0m';
    if (mins < 60) return `${mins}m`;
    const hrs = (mins / 60).toFixed(1);
    const cleanHrs = hrs.endsWith('.0') ? hrs.slice(0, -2) : hrs;
    return `${cleanHrs}h`;
};

const parseTimeInput = (val) => {
    const clean = val.toLowerCase().trim();
    if (!clean) return 0;
    
    // Check for hour patterns (e.g. h, hr, hrs, hour, hours)
    const hourMatch = clean.match(/^([\d.]+)\s*(h|hr|hrs|hour|hours)$/);
    if (hourMatch) {
        const hrs = parseFloat(hourMatch[1]);
        return isNaN(hrs) ? 0 : Math.round(hrs * 60);
    }
    
    // Check for minute patterns (e.g. m, min, mins, minute, minutes)
    const minMatch = clean.match(/^([\d.]+)\s*(m|min|mins|minute|minutes)$/);
    if (minMatch) {
        const mins = parseFloat(minMatch[1]);
        return isNaN(mins) ? 0 : Math.round(mins);
    }
    
    // Fallback: raw number is treated as minutes
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num);
};

// ── Sortable Task Card ───────────────────────────────────────────
function TaskCard({
    task, order, onUpdateTask, onTaskClick, onQuickCalc, machine, accent,
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    onDrop, columnId, machines = []
}) {
    const [calcLoading, setCalcLoading] = useState(false);
    const [isEditingTime, setIsEditingTime] = useState(false);
    const [timeInputValue, setTimeInputValue] = useState('');
    const [showTransferDropdown, setShowTransferDropdown] = useState(false);

    const handleTransfer = async (newMachineId) => {
        const targetMachine = machines.find(m => m.id === newMachineId) || null;
        const newMachineName = targetMachine ? targetMachine.name : null;

        const fields = {
            machine_id: newMachineId,
            machine_name: newMachineName
        };

        // Recalculate estimated minutes if using machine defaults (no custom overrides)
        if (!task.custom_speed && task.custom_make_ready_minutes === null) {
            const speed = targetMachine?.speed || 0;
            const setup = targetMachine?.make_ready_minutes || 0;
            const qty = parseFloat(task.quantity) || 0;
            if (qty && speed > 0) {
                fields.estimated_minutes = Math.ceil((qty / speed) * 60) + setup;
            }
        }

        await onUpdateTask(task.id, order?.id, fields);
    };

    const handleTimeSubmit = async () => {
        setIsEditingTime(false);
        const newMins = parseTimeInput(timeInputValue);
        if (newMins !== task.estimated_minutes) {
            await onUpdateTask(task.id, order?.id, { estimated_minutes: newMins });
        }
    };

    const handleQuickCalc = async (e) => {
        e.stopPropagation();
        const qty = parseFloat(task.quantity) || 0;
        const speed = parseFloat(task.custom_speed || machine?.speed) || 0;
        const setup = parseFloat(task.custom_make_ready_minutes != null ? task.custom_make_ready_minutes : (machine?.make_ready_minutes || 0));
        if (!qty || !speed) return;
        const newMins = Math.ceil((qty / speed) * 60) + setup;
        setCalcLoading(true);
        await onUpdateTask(task.id, order?.id, { estimated_minutes: newMins });
        setCalcLoading(false);
    };

    const isDragged = task.id === draggedTaskId;

    const handleDragStart = (e) => {
        setDraggedTaskId(task.id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(task.id));
    };

    const handleDragEnd = () => {
        setDraggedTaskId(null);
        setDragOverTaskId(null);
        setDragOverPosition(null);
    };

    const handleDragOver = (e) => {
        if (draggedTaskId === task.id) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const isUpper = relativeY < rect.height / 2;

        setDragOverTaskId(task.id);
        setDragOverPosition(isUpper ? 'before' : 'after');
    };

    const handleDragLeave = () => {
        setDragOverTaskId(null);
        setDragOverPosition(null);
    };

    const handleDropOnCard = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop(draggedTaskId, columnId, task.id, dragOverPosition);
    };

    const jobName = order?.estimation_names || order?.customer_name || 'No Job Name';
    const customerName = order?.customer_name || '';
    const orderCode = order?.code || '—';
    const dot = STATUS_DOT[task.status] || STATUS_DOT.pending;
    const hasCustom = task.custom_speed || task.custom_make_ready_minutes != null;
    const canCalc = (parseFloat(task.quantity) || 0) > 0 && (parseFloat(task.custom_speed || machine?.speed) || 0) > 0;

    return (
        <div
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropOnCard}
            className={`w-full text-left bg-transparent border-b border-white/10 py-3.5 px-1.5 cursor-grab select-none relative group transition-all hover:bg-white/[0.01] last:border-b-0 ${isDragged ? 'opacity-25' : 'opacity-100'
                }`}
        >
            {dragOverTaskId === task.id && dragOverPosition === 'before' && (
                <div
                    className="absolute top-0 left-0 right-0 h-[3px] rounded z-[99] animate-pulse"
                    style={{ backgroundColor: accent || '#a78bfa' }}
                />
            )}

            <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                            backgroundColor: dot,
                            boxShadow: task.status === 'done' ? `0 0 6px ${dot}` : 'none'
                        }}
                    />
                    <span className="text-[9.5px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded tracking-wider flex-shrink-0">
                        {orderCode}
                    </span>
                    <span className="text-[12px] font-bold text-white truncate block max-w-[140px]" title={jobName}>
                        {jobName}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isEditingTime ? (
                        <input
                            type="text"
                            value={timeInputValue}
                            onChange={e => setTimeInputValue(e.target.value)}
                            onBlur={handleTimeSubmit}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleTimeSubmit();
                                if (e.key === 'Escape') setIsEditingTime(false);
                            }}
                            autoFocus
                            className="text-[9.5px] font-bold text-white bg-purple-950/80 border border-purple-500 rounded px-1.5 py-0.5 w-[55px] text-center focus:outline-none"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                setTimeInputValue(formatTimeDisplay(task.estimated_minutes));
                                setIsEditingTime(true);
                            }}
                            className="text-[9.5px] font-bold text-white/50 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-white/10 hover:text-white transition-all select-none"
                            title="Click to edit time (e.g. 45m or 1.5h)"
                            onMouseDown={e => e.stopPropagation()}
                        >
                            {formatTimeDisplay(task.estimated_minutes)}
                        </span>
                    )}
                    {canCalc && (
                        <button
                            onClick={handleQuickCalc}
                            onMouseDown={e => e.stopPropagation()}
                            disabled={calcLoading}
                            className="bg-purple-500/10 border border-purple-500/25 text-purple-400 hover:bg-purple-500/20 rounded p-1 flex items-center transition-all disabled:opacity-50"
                            title={`Recalculate: ${parseFloat(task.quantity) || 0} qty ÷ ${parseFloat(task.custom_speed || machine?.speed) || 0} speed + ${parseFloat(task.custom_make_ready_minutes ?? machine?.make_ready_minutes ?? 0)}m setup`}
                        >
                            <FiZap className="w-2.5 h-2.5" />
                        </button>
                    )}
                    
                    {/* Transfer Button & Dropdown */}
                    <div 
                        className="relative"
                        onMouseLeave={() => setShowTransferDropdown(false)}
                    >
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                setShowTransferDropdown(!showTransferDropdown);
                            }}
                            onMouseDown={e => e.stopPropagation()}
                            className="bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 rounded p-1 flex items-center transition-all"
                            title="Transfer to another machine"
                        >
                            <FiMove className="w-2.5 h-2.5" />
                        </button>
                        {showTransferDropdown && (
                            <div 
                                className="absolute right-0 mt-1 z-[999] w-[180px] bg-slate-950 border border-white/15 rounded-lg shadow-2xl py-1 text-left"
                                onClick={e => e.stopPropagation()}
                                onMouseDown={e => e.stopPropagation()}
                            >
                                <div className="px-2.5 py-1 text-[8.5px] font-extrabold text-gray-500 uppercase tracking-wider border-b border-white/5">
                                    Transfer to Machine
                                </div>
                                <div className="max-h-[180px] overflow-y-auto">
                                    <button
                                        onClick={() => {
                                            handleTransfer(null);
                                            setShowTransferDropdown(false);
                                        }}
                                        className="w-full px-2.5 py-1.5 text-left text-xs text-red-400 hover:bg-white/5 truncate block font-medium"
                                    >
                                        Manual / Unassigned
                                    </button>
                                    {machines.map(m => (
                                        <button
                                            key={m.id}
                                            disabled={m.id === task.machine_id}
                                            onClick={() => {
                                                handleTransfer(m.id);
                                                setShowTransferDropdown(false);
                                            }}
                                            className={`w-full px-2.5 py-1.5 text-left text-xs truncate block ${
                                                m.id === task.machine_id
                                                    ? 'text-gray-600 bg-white/[0.01]'
                                                    : 'text-gray-300 hover:bg-white/5'
                                            }`}
                                        >
                                            {m.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={e => { e.stopPropagation(); onTaskClick && onTaskClick(task, order); }}
                        onMouseDown={e => e.stopPropagation()}
                        className="bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 rounded p-1 flex items-center transition-all"
                        title="View / edit task details"
                    >
                        <FiEdit2 className="w-2.5 h-2.5" />
                    </button>
                </div>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-400 pl-3.5">
                <span className="font-semibold text-gray-200 truncate pr-2 max-w-[160px]">
                    {console.log(task.name)}
                    {task.name.split('—')[task.name.split('—').length - 2]?.trim()}
                </span>
                {customerName && (
                    <span className="text-[9.5px] text-gray-500 truncate max-w-[100px]">
                        {customerName}
                    </span>
                )}
            </div>

            {dragOverTaskId === task.id && dragOverPosition === 'after' && (
                <div
                    className="absolute bottom-0 left-0 right-0 h-[3px] rounded z-[99] animate-pulse"
                    style={{ backgroundColor: accent || '#a78bfa' }}
                />
            )}
        </div>
    );
}

// ── Task Detail & Override Modal ─────────────────────────────────────────

function TaskModal({ task, order, machine, onClose, onSave, onRefresh }) {
    const defaultSetup = machine?.make_ready_minutes || 0;
    const defaultSpeed = machine?.speed || 0;
    const defaultUnit = machine?.speed_unit || 'Sheets/Hr';

    const initialUnit = task.custom_speed_unit || defaultUnit;
    const getInitialQty = (u) => {
        const lowerU = (u || '').toLowerCase();
        if (lowerU === 'impressions/hr') {
            return task.impression_count != null && task.impression_count !== 0
                ? String(task.impression_count)
                : (task.quantity != null ? String(task.quantity) : '');
        } else if (lowerU === 'sheets/hr') {
            return task.sheet_count != null && task.sheet_count !== 0
                ? String(task.sheet_count)
                : (task.quantity != null ? String(task.quantity) : '');
        } else {
            return task.job_qty != null && task.job_qty !== 0
                ? String(task.job_qty)
                : (task.quantity != null ? String(task.quantity) : '');
        }
    };

    const [setupMin, setSetupMin] = useState(task.custom_make_ready_minutes != null ? String(task.custom_make_ready_minutes) : '');
    const [speed, setSpeed] = useState(task.custom_speed != null ? String(task.custom_speed) : '');
    const [unit, setUnit] = useState(initialUnit);
    const [calcQty, setCalcQty] = useState(getInitialQty(initialUnit));
    const [estimatedMins, setEstimatedMins] = useState(task.estimated_minutes || 0);
    const [saving, setSaving] = useState(false);

    // Split states
    const [splitQtyInput, setSplitQtyInput] = useState('');
    const [splitPreview, setSplitPreview] = useState(null);
    const [splitLoading, setSplitLoading] = useState(false);
    const [splitError, setSplitError] = useState('');

    const handlePreviewSplit = () => {
        setSplitError('');
        const splitQty = parseFloat(splitQtyInput);
        const originalQty = parseFloat(task.quantity) || 0;
        if (isNaN(splitQty) || splitQty <= 0) {
            setSplitError('Please enter a valid quantity.');
            setSplitPreview(null);
            return;
        }
        if (splitQty >= originalQty) {
            setSplitError('Split quantity must be less than the total task quantity.');
            setSplitPreview(null);
            return;
        }
        const remainingQty = originalQty - splitQty;
        
        let targetSpeed = parseFloat(speed !== '' ? speed : defaultSpeed);
        let targetSetup = parseFloat(setupMin !== '' ? setupMin : defaultSetup);
        
        let p1Mins = 0;
        let p2Mins = 0;
        
        if (targetSpeed > 0) {
            p1Mins = Math.ceil((remainingQty / targetSpeed) * 60) + targetSetup;
            p2Mins = Math.ceil((splitQty / targetSpeed) * 60) + targetSetup;
        } else {
            const originalMins = task.estimated_minutes || 0;
            p2Mins = Math.round((splitQty / originalQty) * originalMins);
            p1Mins = Math.max(0, originalMins - p2Mins);
        }
        
        setSplitPreview({
            part1: { qty: remainingQty, mins: p1Mins },
            part2: { qty: splitQty, mins: p2Mins }
        });
    };

    const handleExecuteSplit = async () => {
        setSplitError('');
        const splitQty = parseFloat(splitQtyInput);
        const originalQty = parseFloat(task.quantity) || 0;
        if (isNaN(splitQty) || splitQty <= 0) {
            setSplitError('Please enter a valid quantity.');
            return;
        }
        if (splitQty >= originalQty) {
            setSplitError('Split quantity must be less than the total task quantity.');
            return;
        }

        setSplitLoading(true);
        try {
            const res = await fetch(`/api/sales-orders/${order.id}/tasks/${task.id}/split`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partialQty: splitQty })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to split task');
            }
            if (onRefresh) {
                await onRefresh();
            }
            onClose();
        } catch (err) {
            setSplitError(err.message);
        } finally {
            setSplitLoading(false);
        }
    };

    const modeColor = {
        offset: G.warning, digital: G.purple, finishing: G.success,
        prepress: '#38bdf8', default: G.muted
    };
    const accentColor = modeColor[(machine?.type || '').toLowerCase()] || modeColor.default;

    const statusLabel = { pending: 'Pending', in_progress: 'In Progress', done: 'Done' };
    const statusColor = { pending: G.dim, in_progress: G.warning, done: G.success };

    const handleCalculate = () => {
        const defaultQty = unit.toLowerCase() === 'impressions/hr'
            ? (task.impression_count != null ? task.impression_count : task.quantity)
            : (task.sheet_count != null ? task.sheet_count : task.quantity);
        const q = parseFloat(calcQty !== '' ? calcQty : defaultQty) || 0;
        const s = parseFloat(speed !== '' ? speed : defaultSpeed) || 0;
        const t = parseFloat(setupMin !== '' ? setupMin : defaultSetup) || 0;

        if (q && s > 0) {
            const runMins = Math.ceil((q / s) * 60);
            setEstimatedMins(runMins + t);
        } else if (t) {
            setEstimatedMins(t);
        } else {
            setEstimatedMins(0);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const payload = {
            custom_make_ready_minutes: setupMin !== '' ? parseInt(setupMin) : null,
            custom_speed: speed !== '' ? parseFloat(speed) : null,
            custom_speed_unit: speed !== '' ? unit : null,
            estimated_minutes: estimatedMins,
        };
        if (calcQty !== '') {
            const numQty = parseFloat(calcQty);
            payload.quantity = numQty;
            if (unit.toLowerCase() === 'impressions/hr') {
                payload.impression_count = numQty;
            } else {
                payload.sheet_count = numQty;
            }
        }
        await onSave(task.id, order?.id, payload);
        setSaving(false);
        onClose();
    };

    const handleReset = async () => {
        setSaving(true);
        setSetupMin(''); setSpeed(''); setUnit(defaultUnit);
        setCalcQty(getInitialQty(defaultUnit));
        setEstimatedMins(task.estimated_minutes || 0);
        await onSave(task.id, order?.id, {
            custom_make_ready_minutes: null,
            custom_speed: null,
            custom_speed_unit: null,
            estimated_minutes: task.estimated_minutes,
            quantity: task.quantity,
            sheet_count: task.sheet_count,
            impression_count: task.impression_count,
        });
        setSaving(false);
        onClose();
    };

    const inp = {
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#fff', borderRadius: 8, padding: '8px 11px', fontSize: 12,
        outline: 'none', width: '100%', boxSizing: 'border-box',
    };
    const lbl = { fontSize: 10, color: G.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' };
    const card = {
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, padding: '12px 14px',
    };

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-black/40 backdrop-blur-lg border border-white/12 rounded-[18px] w-full max-w-[680px] max-h-[90vh] overflow-y-auto shadow-[0_32px_80px_rgba(0,0,0,0.95)]"
                style={{ borderTop: `3px solid ${accentColor}` }}
                onClick={e => e.stopPropagation()}
            >

                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span
                                className="text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border"
                                style={{
                                    backgroundColor: `${accentColor}18`,
                                    color: accentColor,
                                    borderColor: `${accentColor}33`
                                }}
                            >
                                {machine?.type || 'Task'}
                            </span>
                            <span
                                className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border tracking-wider"
                                style={{
                                    backgroundColor: `${statusColor[task.status] || G.dim}18`,
                                    color: statusColor[task.status] || G.dim,
                                    borderColor: `${statusColor[task.status] || G.dim}33`
                                }}
                            >
                                {statusLabel[task.status] || task.status}
                            </span>
                            {(task.custom_speed || task.custom_make_ready_minutes) && (
                                <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 inline-flex items-center gap-0.5">
                                    <FiZap className="w-2.5 h-2.5" /> Custom Override Active
                                </span>
                            )}
                        </div>
                        <h2 className="m-0 text-base font-extrabold text-[#f1f5f9] leading-snug">{task.name}</h2>
                        {task.description && <p className="m-0 mt-1 text-xs text-gray-400 leading-normal">{task.description}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all flex-shrink-0 ml-3"
                    >
                        <FiX className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">

                    {/* Job Info */}
                    {order && (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                            <div className="text-[10px]  font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1">
                                <FiPackage className="w-3.5 h-3.5" /> Job Information
                            </div>
                            <div className="grid grid-cols-2 gap-3.5">
                                {[
                                    ['Job Code', order.code || '—'],
                                    ['Job Name', order.estimation_names || '—'],
                                    ['Customer', order.customer_name || '—'],
                                    ['Status', order.status || '—'],
                                    ['Delivery', order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : '—'],
                                    ['Scheduled', task.scheduled_date ? new Date(task.scheduled_date).toLocaleDateString() : 'Unplanned'],
                                ].map(([k, v]) => (
                                    <div key={k}>
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{k}</span>
                                        <div className="text-xs text-gray-300 font-semibold mt-0.5">{v}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Machine Specs */}
                    {machine && (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                            <div
                                className="text-[10px] font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1"
                                style={{}}
                            >
                                <FiSettings className="w-3.5 h-3.5" /> Machine Specs — {machine.name}
                            </div>
                            <div className="grid grid-cols-3 gap-3.5">
                                {[
                                    ['Default Speed', defaultSpeed ? `${defaultSpeed} ${defaultUnit}` : '—'],
                                    ['Setup Time', defaultSetup ? `${defaultSetup} min` : '—'],
                                    ['Shift Limit', `${machine.shift_limit || 8} hrs`],
                                    ['Sheet Factor', machine.sheet_factor || '—'],
                                    ['Assigned To', machine.assigned_employee_name || machine.assigned_team_name || '—'],
                                    ['Quantity', task.quantity ? task.quantity.toLocaleString() : '—'],
                                ].map(([k, v]) => (
                                    <div key={k}>
                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{k}</span>
                                        <div className="text-xs text-gray-300 font-semibold mt-0.5">{v}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Custom Overrides */}
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 border-purple-500/20">
                        <div className="text-[10px]  font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                            <FiZap className="w-3.5 h-3.5" /> Custom Overrides
                            <span className="text-[9px] text-gray-500 font-normal lowercase tracking-normal ml-2">(leave blank to use defaults)</span>
                        </div>
                        <div className="grid grid-cols-4 gap-3.5">
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Run Qty</label>
                                <input
                                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-white/30"
                                    type="number"
                                    min="0"
                                    placeholder={String(unit.toLowerCase() === 'impressions/hr' ? (task.impression_count != null ? task.impression_count : (task.quantity || 0)) : (task.sheet_count != null ? task.sheet_count : (task.quantity || 0)))}
                                    value={calcQty}
                                    onChange={e => setCalcQty(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Setup Time (min)</label>
                                <input
                                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-white/30"
                                    type="number"
                                    min="0"
                                    placeholder={`Default: ${defaultSetup || 0}`}
                                    value={setupMin}
                                    onChange={e => setSetupMin(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Machine Speed</label>
                                <input
                                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-white/30"
                                    type="number"
                                    min="1"
                                    placeholder={`Default: ${defaultSpeed || '—'}`}
                                    value={speed}
                                    onChange={e => setSpeed(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Speed Unit</label>
                                <select
                                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-white/30 [color-scheme:dark] cursor-pointer"
                                    value={unit}
                                    onChange={e => {
                                        const newUnit = e.target.value;
                                        setUnit(newUnit);
                                        setCalcQty(getInitialQty(newUnit));
                                    }}
                                >
                                    {['Sheets/Hr', 'Impressions/Hr', 'Copies/Hr', 'Pcs/Hr', 'm²/Hr', 'Meters/Hr', 'Units/Hr', 'Min/Job'].map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Estimated Time Result */}
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                <FiClock className="w-3.5 h-3.5" /> Estimated Time
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="number"
                                    className="bg-transparent text-2xl font-black text-white w-20 focus:outline-none border-b border-white/20 focus:border-white/50 text-center"
                                    value={estimatedMins}
                                    onChange={e => setEstimatedMins(parseInt(e.target.value) || 0)}
                                />
                                <span className="text-xs text-gray-400 font-normal">min</span>
                                <span className="text-xs text-gray-500 font-normal ml-2">({Math.round((estimatedMins / 60) * 10) / 10} hrs)</span>

                                <button
                                    type="button"
                                    onClick={handleCalculate}
                                    className="ml-4 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-500/50 rounded-md text-xs font-bold transition-all flex items-center gap-1"
                                >
                                    <FiZap className="w-3.5 h-3.5" /> Calculate
                                </button>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-0.5">Original Est.</div>
                            <div className="text-sm font-bold text-gray-400">{task.estimated_minutes || 0}m</div>
                        </div>
                    </div>

                    {/* Split Task Section */}
                    {task.quantity > 1 && (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 border-dashed border-amber-500/20">
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1 text-amber-400">
                                <FiLayers className="w-3.5 h-3.5" /> Split Task / Partial Scheduling
                            </div>
                            <div className="flex flex-col gap-3">
                                <p className="text-[11px] text-gray-400 m-0">
                                    Partition this task by run quantity. This will update the original task to the remaining quantity and create a new Part 2 task with the partial quantity.
                                </p>
                                <div className="grid grid-cols-3 gap-3.5 items-end">
                                    <div>
                                        <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            Partial Qty to Split
                                        </label>
                                        <input
                                            className="w-full bg-black border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-white/30"
                                            type="number"
                                            min="1"
                                            max={task.quantity - 1}
                                            placeholder={`Max: ${task.quantity - 1}`}
                                            value={splitQtyInput}
                                            onChange={e => setSplitQtyInput(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handlePreviewSplit}
                                            className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 rounded-lg text-xs font-bold transition-all"
                                        >
                                            Preview Split
                                        </button>
                                        <button
                                            type="button"
                                            disabled={splitLoading || !splitQtyInput}
                                            onClick={handleExecuteSplit}
                                            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {splitLoading ? 'Splitting...' : 'Execute Split'}
                                        </button>
                                    </div>
                                </div>
                                {splitPreview && (
                                    <div className="mt-2 p-3 bg-white/[0.01] border border-white/5 rounded-lg flex flex-col gap-2 text-xs">
                                        <div className="flex justify-between items-center text-gray-400">
                                            <span>Part 1 (Remaining):</span>
                                            <span className="font-semibold text-white">
                                                {splitPreview.part1.qty} qty — {formatTimeDisplay(splitPreview.part1.mins)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-gray-400">
                                            <span>Part 2 (New Task):</span>
                                            <span className="font-semibold text-white">
                                                {splitPreview.part2.qty} qty — {formatTimeDisplay(splitPreview.part2.mins)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {splitError && (
                                    <div className="text-red-400 text-xs mt-1">
                                        {splitError}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-2 border-t border-white/5">
                        {(task.custom_speed || task.custom_make_ready_minutes) && (
                            <button
                                onClick={handleReset}
                                disabled={saving}
                                className="px-4 py-2 border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-300 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            >
                                Reset to Defaults
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                backgroundColor: `${accentColor}`,
                                borderColor: `${accentColor}33`
                            }}
                            className="px-5 py-2  text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                        >
                            {saving ? 'Saving…' : 'Apply & Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Days Columns ─────────────────────────────────────────────────────────
function DayColumn({
    id, title, label, tasks, orderLookup, onUpdateTask, onTaskClick, accent, capacityMins = 480,
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    dragOverColumnId, setDragOverColumnId,
    onDrop, machines
}) {
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;

    const isOverloaded = totalMins > capacityMins;
    const isOver = dragOverColumnId === id;

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        setDragOverColumnId(id);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        onDrop(draggedTaskId, id);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDrop={handleDrop}
            className={`backdrop-blur-md rounded-2xl p-3.5 transition-all w-[230px] flex-shrink-0 flex flex-col min-h-[480px] border border-white/15 border-t-[3px] ${isOver ? 'bg-white/[0.06] border-white/30' : 'bg-white/[0.01]'
                }`}
            style={{
                borderTopColor: isOverloaded ? '#ef4444' : accent,
                boxShadow: isOver ? `${accent}15 0px 0px 16px` : 'none'
            }}
        >
            <div className="mb-3 flex justify-between items-center">
                <div>
                    <div className="font-extrabold text-[12px] text-white leading-tight">{title}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                </div>
                <div
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isOverloaded
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : totalMins > 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-white/5 text-gray-500 border-transparent'
                        }`}
                >
                    {totalHrs}h
                </div>
            </div>

            <div
                className={`flex-1 rounded-xl p-1 transition-all min-h-[140px] ${isOver ? 'bg-white/[0.01] border border-dashed border-white/20' : 'border border-dashed border-transparent'
                    }`}
            >
                {tasks.length === 0 ? (
                    <div className="py-10 text-center text-[11px] text-gray-500 italic">
                        No tasks scheduled
                    </div>
                ) : (
                    tasks.map(t => (
                        <TaskCard
                            key={t.id}
                            task={t}
                            order={orderLookup(t)}
                            onUpdateTask={onUpdateTask}
                            onTaskClick={onTaskClick}
                            accent={accent}
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            dragOverTaskId={dragOverTaskId}
                            setDragOverTaskId={setDragOverTaskId}
                            dragOverPosition={dragOverPosition}
                            setDragOverPosition={setDragOverPosition}
                            onDrop={onDrop}
                            columnId={id}
                            machines={machines}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Unplanned Queue Column ────────────────────────────────────────────────
function UnplannedColumn({
    id, tasks, orderLookup, onUpdateTask, onTaskClick, accent,
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    dragOverColumnId, setDragOverColumnId,
    onDrop, machines
}) {
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;
    const isOver = dragOverColumnId === id;

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        setDragOverColumnId(id);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        onDrop(draggedTaskId, id);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDrop={handleDrop}
            className={`backdrop-blur-md rounded-2xl p-3.5 transition-all w-[230px] flex-shrink-0 flex flex-col min-h-[480px] border border-white/15 border-t-[3px] border-t-gray-500 ${isOver ? 'bg-white/[0.06] border-white/30' : 'bg-white/[0.01]'
                }`}
            style={{
                boxShadow: isOver ? `${accent}15 0px 0px 16px` : 'none'
            }}
        >
            <div className="mb-3 flex justify-between items-center">
                <div>
                    <div className="font-extrabold text-[12px] text-white leading-tight">Unplanned Queue</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Machine backlog</div>
                </div>
                <div className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-400">
                    {totalHrs}h
                </div>
            </div>

            <div
                className={`flex-1 rounded-xl p-1 transition-all min-h-[140px] ${isOver ? 'bg-white/[0.01] border border-dashed border-white/20' : 'border border-dashed border-transparent'
                    }`}
            >
                {tasks.length === 0 ? (
                    <div className="py-10 text-center text-[11px] text-gray-500 italic">
                        Empty Queue
                    </div>
                ) : (
                    tasks.map(t => (
                        <TaskCard
                            key={t.id}
                            task={t}
                            order={orderLookup(t)}
                            onUpdateTask={onUpdateTask}
                            onTaskClick={onTaskClick}
                            accent="#64748b"
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            dragOverTaskId={dragOverTaskId}
                            setDragOverTaskId={setDragOverTaskId}
                            dragOverPosition={dragOverPosition}
                            setDragOverPosition={setDragOverPosition}
                            onDrop={onDrop}
                            columnId={id}
                            machines={machines}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Machine Column ────────────────────────────────────────────────────────
function MachineColumn({
    id, title, label, tasks, orderLookup, onUpdateTask, onTaskClick, accent, capacityMins = 480, widthClass = "w-[230px] flex-shrink-0",
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    dragOverColumnId, setDragOverColumnId,
    onDrop, machines
}) {
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;
    const isOverloaded = totalMins > capacityMins;
    const isOver = dragOverColumnId === id;

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        setDragOverColumnId(id);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        onDrop(draggedTaskId, id);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDrop={handleDrop}
            className={`backdrop-blur-md rounded-2xl p-3.5 transition-all flex flex-col min-h-[480px] border border-white/15 border-t-[3px] ${isOver ? 'bg-white/[0.06] border-white/30' : 'bg-white/[0.01]'
                } ${widthClass}`}
            style={{
                borderTopColor: isOverloaded ? '#ef4444' : accent,
                boxShadow: isOver ? `${accent}15 0px 0px 16px` : 'none'
            }}
        >
            <div className="mb-3 flex justify-between items-center">
                <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-[12px] text-white leading-tight truncate" title={title}>{title}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
                </div>
                <div
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${isOverloaded
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : totalMins > 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-white/5 text-gray-500 border-transparent'
                        }`}
                >
                    {totalHrs}h
                </div>
            </div>

            <div
                className={`flex-1 rounded-xl p-1 transition-all min-h-[140px] ${isOver ? 'bg-white/[0.01] border border-dashed border-white/20' : 'border border-dashed border-transparent'
                    }`}
            >
                {tasks.length === 0 ? (
                    <div className="py-10 text-center text-[11px] text-gray-500 italic">
                        No tasks scheduled
                    </div>
                ) : (
                    tasks.map(t => (
                        <TaskCard
                            key={t.id}
                            task={t}
                            order={orderLookup(t)}
                            onUpdateTask={onUpdateTask}
                            onTaskClick={onTaskClick}
                            accent={accent}
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            dragOverTaskId={dragOverTaskId}
                            setDragOverTaskId={setDragOverTaskId}
                            dragOverPosition={dragOverPosition}
                            setDragOverPosition={setDragOverPosition}
                            onDrop={onDrop}
                            columnId={id}
                            machines={machines}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Backlog Column ────────────────────────────────────────────────────────
function BacklogColumn({
    id, tasks, orderLookup, onUpdateTask, onTaskClick, widthClass = "w-[230px] flex-shrink-0",
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    dragOverColumnId, setDragOverColumnId,
    onDrop, machines
}) {
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;
    const isOver = dragOverColumnId === id;

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        setDragOverColumnId(id);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        onDrop(draggedTaskId, id);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDrop={handleDrop}
            className={`backdrop-blur-md rounded-2xl p-3.5 transition-all flex flex-col min-h-[480px] border border-white/15 border-t-[3px] border-t-gray-500 ${isOver ? 'bg-white/[0.06] border-white/30' : 'bg-white/[0.01]'
                } ${widthClass}`}
            style={{
                boxShadow: isOver ? `rgba(255,255,255,0.05) 0px 0px 16px` : 'none'
            }}
        >
            <div className="mb-3 flex justify-between items-center">
                <div>
                    <div className="font-extrabold text-[12px] text-white leading-tight">Backlog / Unplanned</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">All pending tasks</div>
                </div>
                <div className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-400">
                    {totalHrs}h
                </div>
            </div>

            <div
                className={`flex-1 rounded-xl p-1 transition-all min-h-[140px] ${isOver ? 'bg-white/[0.01] border border-dashed border-white/20' : 'border border-dashed border-transparent'
                    }`}
            >
                {tasks.length === 0 ? (
                    <div className="py-10 text-center text-[11px] text-gray-500 italic">
                        Empty Backlog
                    </div>
                ) : (
                    tasks.map(t => (
                        <TaskCard
                            key={t.id}
                            task={t}
                            order={orderLookup(t)}
                            onUpdateTask={onUpdateTask}
                            onTaskClick={onTaskClick}
                            accent="#64748b"
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            dragOverTaskId={dragOverTaskId}
                            setDragOverTaskId={setDragOverTaskId}
                            dragOverPosition={dragOverPosition}
                            setDragOverPosition={setDragOverPosition}
                            onDrop={onDrop}
                            columnId={id}
                            machines={machines}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Main FinishingPlanning Component ───────────────────────────────────────
export default function FinishingPlanning({ finishings = [], machines = [], orders, onRefresh }) {
    const [viewMode, setViewMode] = useState('daily');
    const [activeDate, setActiveDate] = useState(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    });
    const [localOrders, setLocalOrders] = useState(orders);
    const [activeFinishingId, setActiveFinishingId] = useState(() => {
        return finishings.length > 0 ? finishings[0].id : null;
    });

    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        return getStartOfWeek(new Date());
    });

    const [activeTask, setActiveTask] = useState(null);
    const [selectedTaskModal, setSelectedTaskModal] = useState(null); // { task, order }
    const [showReport, setShowReport] = useState(true);

    const matchesFinishing = (taskName, finishingName) => {
        if (!taskName || !finishingName) return false;
        return taskName.toLowerCase().startsWith(finishingName.toLowerCase());
    };

    // Sync prop changes
    useEffect(() => {
        setLocalOrders(orders);
    }, [orders]);

    const [draggedTaskId, setDraggedTaskId] = useState(null);
    const [dragOverTaskId, setDragOverTaskId] = useState(null);
    const [dragOverPosition, setDragOverPosition] = useState(null);
    const [dragOverColumnId, setDragOverColumnId] = useState(null);

    const selectedFinishing = finishings.find(f => f.id === activeFinishingId) || finishings[0];

    // Navigate Weeks
    const handlePrevWeek = () => {
        setCurrentWeekStart(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 7);
            return d;
        });
    };

    const handleNextWeek = () => {
        setCurrentWeekStart(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 7);
            return d;
        });
    };

    const handleToday = () => {
        setCurrentWeekStart(getStartOfWeek(new Date()));
    };

    // Navigate Days
    const handlePrevDay = () => {
        setActiveDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 1);
            return d;
        });
    };

    const handleNextDay = () => {
        setActiveDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 1);
            return d;
        });
    };

    const handleTodayDay = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setActiveDate(today);
    };

    // Calculate Week Days
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(currentWeekStart);
        day.setDate(currentWeekStart.getDate() + i);
        weekDays.push({
            dateStr: formatDateKey(day),
            label: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            name: day.toLocaleDateString('en-US', { weekday: 'long' }),
        });
    }

    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(currentWeekStart.getDate() + 6);
    const dateRangeStr = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const getOrder = t => localOrders.find(o => o.id === t.sales_order_id);

    // Grouping Tasks
    const unplannedTasks = [];
    const dailyTasksMap = {};
    weekDays.forEach(day => { dailyTasksMap[day.dateStr] = []; });

    // Daily View specific groupings
    const backlogTasks = [];
    const finishingTasksMap = {};
    finishings.forEach(f => { finishingTasksMap[f.id] = []; });

    const finishingUnplannedCounts = {};
    finishings.forEach(f => { finishingUnplannedCounts[f.id] = 0; });

    localOrders.forEach(o => {
        const isCompletedOrCancelled = ['delivered', 'cancelled', 'completed', 'ready'].includes(String(o.status || '').toLowerCase());

        (o.tasks || []).forEach(t => {
            // A task belongs to a finishing operation if it does not have a machine assigned and name matches
            if (t.machine_id === null && !isCompletedOrCancelled) {
                const matchingFin = finishings.find(f => matchesFinishing(t.name, f.name));
                if (matchingFin) {
                    if (!t.scheduled_date) {
                        finishingUnplannedCounts[matchingFin.id]++;
                    }
                }
            }

            const isAssignedToActive = t.machine_id === null && selectedFinishing && matchesFinishing(t.name, selectedFinishing.name);
            if (isAssignedToActive) {
                if (!t.scheduled_date) {
                    unplannedTasks.push(t);
                } else {
                    const dStr = getLocalDateString(t.scheduled_date);
                    if (dailyTasksMap[dStr]) {
                        dailyTasksMap[dStr].push(t);
                    }
                }
            }

            // Daily groupings
            if (!isCompletedOrCancelled) {
                if (isAssignedToActive) {
                    if (!t.scheduled_date) {
                        backlogTasks.push(t);
                    } else {
                        const dStr = getLocalDateString(t.scheduled_date);
                        const activeStr = getLocalDateString(activeDate);
                        if (dStr === activeStr) {
                            if (selectedFinishing && finishingTasksMap[selectedFinishing.id]) {
                                finishingTasksMap[selectedFinishing.id].push(t);
                            }
                        }
                    }
                }
            }
        });
    });

    // Sort tasks in each list by machine_position, delivery date & display_order
    const sortTasks = list => {
        return list.sort((a, b) => {
            const posA = a.machine_position != null ? a.machine_position : 999999;
            const posB = b.machine_position != null ? b.machine_position : 999999;
            if (posA !== posB) return posA - posB;

            const dateA = getOrder(a)?.delivery_date ? new Date(getOrder(a).delivery_date).getTime() : 0;
            const dateB = getOrder(b)?.delivery_date ? new Date(getOrder(b).delivery_date).getTime() : 0;
            if (dateA !== dateB) return dateA - dateB;

            return (a.display_order || 0) - (b.display_order || 0);
        });
    };

    sortTasks(unplannedTasks);
    Object.keys(dailyTasksMap).forEach(k => sortTasks(dailyTasksMap[k]));
    sortTasks(backlogTasks);
    Object.keys(finishingTasksMap).forEach(k => sortTasks(finishingTasksMap[k]));

    // arrayMove helper for reordering
    const arrayMove = (arr, fromIndex, toIndex) => {
        const element = arr[fromIndex];
        const newArr = [...arr];
        newArr.splice(fromIndex, 1);
        newArr.splice(toIndex, 0, element);
        return newArr;
    };

    // Unified HTML5 drag-and-drop drop handler
    const handleDrop = async (draggedId, overId, targetTaskId = null, dragPosition = null) => {
        // Clear drag states
        setDraggedTaskId(null);
        setDragOverTaskId(null);
        setDragOverPosition(null);
        setDragOverColumnId(null);

        if (!draggedId) return;

        const taskId = parseInt(draggedId);

        let parentOrder = null;
        for (const order of localOrders) {
            if ((order.tasks || []).some(t => t.id === taskId)) {
                parentOrder = order;
                break;
            }
        }
        if (!parentOrder) return;

        const originalTask = parentOrder.tasks.find(t => t.id === taskId);

        const checkIsActiveFinishing = (mId, taskName) => {
            return mId === null && selectedFinishing && matchesFinishing(taskName, selectedFinishing.name);
        };

        let newMachineId = null;
        let newMachineName = null;
        let newScheduledDate = originalTask.scheduled_date;

        if (viewMode === 'weekly') {
            if (overId === 'unplanned') {
                newScheduledDate = null;
            } else if (overId.startsWith('day-')) {
                newScheduledDate = overId.replace('day-', '');
            }
        } else {
            // Daily View
            if (overId === 'backlog') {
                newScheduledDate = null;
            } else if (overId.startsWith('finishing-')) {
                newScheduledDate = formatDateKey(activeDate);
            }
        }

        // If targetTaskId is specified (i.e. dropped on a card)
        if (targetTaskId) {
            let targetTask = null;
            for (const order of localOrders) {
                const found = (order.tasks || []).find(t => t.id === targetTaskId);
                if (found) { targetTask = found; break; }
            }
            if (targetTask) {
                newMachineId = null;
                newMachineName = null;
                newScheduledDate = targetTask.scheduled_date;
            }
        }

        const containerChanged = originalTask.scheduled_date !== newScheduledDate;

        // 1. Gather all tasks for the active finishing (including active task, with updated container properties)
        const unplannedList = [];
        const dailyLists = {};

        localOrders.forEach(order => {
            (order.tasks || []).forEach(task => {
                const isTargetFinishing = checkIsActiveFinishing(task.id === taskId ? null : task.machine_id, task.id === taskId ? originalTask.name : task.name);
                if (isTargetFinishing) {
                    const taskObj = {
                        ...task,
                        ...(task.id === taskId ? {
                            machine_id: null,
                            machine_name: null,
                            scheduled_date: newScheduledDate,
                        } : {})
                    };

                    const container = taskObj.scheduled_date ? getLocalDateString(taskObj.scheduled_date) : 'unplanned';
                    if (container === 'unplanned') {
                        unplannedList.push(taskObj);
                    } else {
                        if (!dailyLists[container]) {
                            dailyLists[container] = [];
                        }
                        dailyLists[container].push(taskObj);
                    }
                }
            });
        });

        // Sort each container by current position/fallback order
        const sortWithFallback = list => {
            return list.sort((a, b) => {
                const isAActiveChanged = a.id === taskId && containerChanged;
                const isBActiveChanged = b.id === taskId && containerChanged;

                const posA = isAActiveChanged ? 999999 : (a.machine_position != null ? a.machine_position : 999999);
                const posB = isBActiveChanged ? 999999 : (b.machine_position != null ? b.machine_position : 999999);
                if (posA !== posB) return posA - posB;

                const dateA = getOrder(a)?.delivery_date ? new Date(getOrder(a).delivery_date).getTime() : 0;
                const dateB = getOrder(b)?.delivery_date ? new Date(getOrder(b).delivery_date).getTime() : 0;
                if (dateA !== dateB) return dateA - dateB;

                return (a.display_order || 0) - (b.display_order || 0);
            });
        };

        sortWithFallback(unplannedList);
        Object.keys(dailyLists).forEach(dKey => {
            sortWithFallback(dailyLists[dKey]);
        });

        if (checkIsActiveFinishing(null, originalTask.name)) {
            const targetContainer = newScheduledDate ? getLocalDateString(newScheduledDate) : 'unplanned';

            if (targetTaskId) {
                if (targetContainer === 'unplanned') {
                    const oldIndex = unplannedList.findIndex(t => t.id === taskId);
                    let newIndex = unplannedList.findIndex(t => t.id === targetTaskId);
                    if (oldIndex !== -1 && newIndex !== -1) {
                        if (dragPosition === 'after') {
                            newIndex = newIndex + 1;
                        }
                        const moved = arrayMove(unplannedList, oldIndex, newIndex);
                        unplannedList.length = 0;
                        unplannedList.push(...moved);
                    }
                } else {
                    const list = dailyLists[targetContainer] || [];
                    const oldIndex = list.findIndex(t => t.id === taskId);
                    let newIndex = list.findIndex(t => t.id === targetTaskId);
                    if (oldIndex !== -1 && newIndex !== -1) {
                        if (dragPosition === 'after') {
                            newIndex = newIndex + 1;
                        }
                        const moved = arrayMove(list, oldIndex, newIndex);
                        dailyLists[targetContainer] = moved;
                    }
                }
            }
        }

        // Flatten all tasks in logical order: unplanned first, then daily columns sorted by date key
        const sortedDayKeys = Object.keys(dailyLists).sort();
        const finalFlatTasks = [
            ...unplannedList,
        ];
        sortedDayKeys.forEach(dKey => {
            finalFlatTasks.push(...(dailyLists[dKey] || []));
        });

        // Map of taskId -> new machine_position
        const positionMap = {};
        finalFlatTasks.forEach((task, idx) => {
            positionMap[task.id] = idx + 1;
        });

        // Optimistically update
        setLocalOrders(prev => {
            return prev.map(order => {
                return {
                    ...order,
                    tasks: (order.tasks || []).map(t => {
                        if (t.id === taskId) {
                            return {
                                ...t,
                                machine_id: null,
                                machine_name: null,
                                scheduled_date: newScheduledDate,
                                machine_position: positionMap[t.id] || null,
                            };
                        } else {
                            const newPos = positionMap[t.id];
                            if (newPos !== undefined) {
                                return {
                                    ...t,
                                    machine_position: newPos,
                                };
                            }
                            return t;
                        }
                    })
                };
            });
        });

        // Persist to DB
        try {
            await fetch(`/api/sales-orders/${parentOrder.id}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: null,
                    machine_name: null,
                    scheduled_date: newScheduledDate,
                    machine_position: positionMap[taskId] || null,
                }),
            });
        } catch (e) {
            console.error('Drag update error:', e);
            setLocalOrders(orders); // Revert
        }
    };

    // Update Task Time
    const handleUpdateTask = async (taskId, orderId, fields) => {
        setLocalOrders(prev => {
            return prev.map(order => {
                if (order.id === orderId) {
                    return {
                        ...order,
                        tasks: order.tasks.map(t => {
                            if (t.id === taskId) {
                                return { ...t, ...fields };
                            }
                            return t;
                        })
                    };
                }
                return order;
            });
        });

        try {
            await fetch(`/api/sales-orders/${orderId}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });
        } catch (e) {
            console.error('Task update error:', e);
            setLocalOrders(orders);
        }
    };

    // Report Calculations
    const scheduledWeekTasks = [];
    Object.values(dailyTasksMap).forEach(tasks => {
        scheduledWeekTasks.push(...tasks);
    });

    const totalTasksPlanned = scheduledWeekTasks.length;
    const totalEstimatedMins = scheduledWeekTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const completedTasks = scheduledWeekTasks.filter(t => t.status === 'done').length;
    const completionRate = totalTasksPlanned > 0 ? Math.round((completedTasks / totalTasksPlanned) * 100) : 0;

    // Task Modal handlers
    const handleTaskClick = (task, order) => {
        setSelectedTaskModal({ task, order });
    };
    const handleTaskModalSave = async (taskId, orderId, fields) => {
        await handleUpdateTask(taskId, orderId, fields);
    };
    const handleCloseModal = () => setSelectedTaskModal(null);

    // Capacity: default to 8h for manual finishing operations
    const shiftLimitHrs = 8;
    const shiftCapacityMins = shiftLimitHrs * 60;

    const machineAccent = G.success; // Green accent for Finishing Planning

    return (
        <>
            <style>{`
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                }
                @media screen {
                    .print-only {
                        display: none !important;
                    }
                }
            `}</style>

            {/* ─── PRINT ONLY LAYOUT ─── */}
            {selectedFinishing && (
                <div className="print-only" style={{ padding: 24, background: '#fff', color: '#000' }}>
                    <div style={{ borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 16 }}>
                        <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#000', margin: 0 }}>Weekly Finishing Schedule Report</h1>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#333' }}>
                            Finishing: <strong>{selectedFinishing.name}</strong>
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#333' }}>
                            Week: <strong>{dateRangeStr}</strong>
                        </p>
                    </div>
                </div>
            )}

            {/* ─── SCREEN LAYOUT ─── */}
            <div className="no-print flex flex-col lg:flex-row gap-6 min-h-[80vh]">

                {/* 1. Left Sidebar Finishing Selector */}
                <div className="w-full lg:w-[250px] bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col gap-5 h-fit max-h-[90vh] overflow-y-auto">
                    <div>
                        <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 mb-3">
                            Finishing Operations
                        </h3>
                        <div className="flex flex-col gap-0.5">
                            {finishings.map(f => {
                                const isSelected = activeFinishingId === f.id;
                                const unplannedCount = finishingUnplannedCounts[f.id] || 0;
                                const countStr = unplannedCount > 0 ? ` (${unplannedCount})` : '';
                                return (
                                    <button
                                        key={f.id}
                                        onClick={() => {
                                            setActiveFinishingId(f.id);
                                        }}
                                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-all cursor-pointer ${isSelected
                                            ? 'bg-white/[0.08] text-white font-semibold'
                                            : 'text-gray-400 hover:text-white bg-transparent'
                                            }`}
                                    >
                                        <span className="truncate block pr-2">
                                            {f.name}{countStr}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 2. Main Planner Area */}
                <div className="flex-1 flex flex-col gap-4.5 min-w-0">

                    {/* Header toolbar */}
                    {(selectedFinishing || viewMode === 'daily') && (
                        <div className="flex flex-wrap justify-between items-center bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 gap-3">
                            <div>
                                {viewMode === 'weekly' ? (
                                    <>
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h2 className="text-base font-extrabold text-white m-0">
                                                {selectedFinishing?.name}
                                            </h2>
                                            <span
                                                className="text-[9.5px] font-bold px-2.5 py-0.5 rounded-full border uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                            >
                                                MANUAL / HAND
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handlePrevDay}
                                            className="p-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                                        >
                                            <FiChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={handleTodayDay}
                                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-white transition-all"
                                        >
                                            Today
                                        </button>
                                        <button
                                            onClick={handleNextDay}
                                            className="p-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                                        >
                                            <FiChevronRight className="w-4 h-4" />
                                        </button>
                                        <span className="text-sm font-bold text-white ml-2">
                                            {activeDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2.5 flex-wrap">
                                {/* Daily / Weekly switch */}
                                <div className="bg-black/20 p-1 rounded-lg border border-white/10 flex">
                                    <button
                                        onClick={() => setViewMode('daily')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'daily'
                                            ? 'bg-white/[0.08] text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        <FiCalendar className="w-3.5 h-3.5" />
                                        Daily
                                    </button>
                                    <button
                                        onClick={() => setViewMode('weekly')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'weekly'
                                            ? 'bg-white/[0.08] text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        <FiLayers className="w-3.5 h-3.5" />
                                        Weekly
                                    </button>
                                </div>

                                {viewMode === 'weekly' ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 3, border: `1px solid ${G.border}` }}>
                                            <button onClick={handlePrevWeek} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 5, borderRadius: 5 }}><FiChevronLeft style={{ fontSize: 14 }} /></button>
                                            <button onClick={handleToday} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10.5, fontWeight: 600, padding: '4px 8px', borderRadius: 4, margin: '0 4px' }}>Today</button>
                                            <button onClick={handleNextWeek} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 5, borderRadius: 5 }}><FiChevronRight style={{ fontSize: 14 }} /></button>
                                        </div>

                                        <button
                                            onClick={() => setShowReport(!showReport)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '7px 12px', border: 'none', borderRadius: 8,
                                                background: showReport ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
                                                color: showReport ? G.purple : G.muted, cursor: 'pointer',
                                                fontSize: 11.5, fontWeight: 600, transition: 'all 0.18s'
                                            }}
                                        >
                                            <FiActivity style={{ fontSize: 12 }} />
                                            Report
                                        </button>

                                        <button
                                            onClick={() => window.print()}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '7px 12px', border: `1px solid ${G.border}`, borderRadius: 8,
                                                background: 'rgba(255,255,255,0.03)', color: G.text, cursor: 'pointer',
                                                fontSize: 11.5, fontWeight: 600, transition: 'all 0.15s'
                                            }}
                                        >
                                            <FiPrinter style={{ fontSize: 12 }} />
                                            Print / PDF
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
                                        <FiClock className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="text-xs font-bold text-gray-300">
                                            Shift limit: {shiftLimitHrs}h
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Report Analytics Widget */}
                    {viewMode === 'weekly' && showReport && selectedFinishing && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/[0.02] border border-white/8 rounded-2xl p-4">
                            <div className="bg-white/2 rounded-xl p-3 border border-white/5 flex flex-col justify-center">
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Tasks</div>
                                <div className="text-xl font-black text-white">{totalTasksPlanned}</div>
                            </div>
                            <div className="bg-white/2 rounded-xl p-3 border border-white/5 flex flex-col justify-center">
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Duration</div>
                                <div className="text-xl font-black text-white">{(totalEstimatedMins / 60).toFixed(1)}h</div>
                            </div>
                            <div className="bg-white/2 rounded-xl p-3 border border-white/5 flex flex-col justify-center">
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Completed</div>
                                <div className="text-xl font-black text-emerald-400">{completedTasks}</div>
                            </div>
                            <div className="bg-white/2 rounded-xl p-3 border border-white/5 flex flex-col justify-center">
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Completion Rate</div>
                                <div className="text-xl font-black text-purple-400">{completionRate}%</div>
                            </div>
                        </div>
                    )}

                    {/* Columns grid */}
                    {viewMode === 'weekly' ? (
                        selectedFinishing ? (
                            <div className="flex gap-3 overflow-x-auto pb-4 scroll-smooth">
                                {/* 1. Unplanned Queue lane */}
                                <UnplannedColumn
                                    id="unplanned"
                                    tasks={unplannedTasks}
                                    orderLookup={getOrder}
                                    onUpdateTask={handleUpdateTask}
                                    onTaskClick={handleTaskClick}
                                    accent={machineAccent}
                                    draggedTaskId={draggedTaskId}
                                    setDraggedTaskId={setDraggedTaskId}
                                    dragOverTaskId={dragOverTaskId}
                                    setDragOverTaskId={setDragOverTaskId}
                                    dragOverPosition={dragOverPosition}
                                    setDragOverPosition={setDragOverPosition}
                                    dragOverColumnId={dragOverColumnId}
                                    setDragOverColumnId={setDragOverColumnId}
                                    onDrop={handleDrop}
                                    machines={machines}
                                />

                                {/* 2. Days lanes */}
                                {weekDays.map(day => (
                                    <DayColumn
                                        key={day.dateStr}
                                        id={`day-${day.dateStr}`}
                                        title={day.name}
                                        label={day.label}
                                        tasks={dailyTasksMap[day.dateStr] || []}
                                        orderLookup={getOrder}
                                        onUpdateTask={handleUpdateTask}
                                        onTaskClick={handleTaskClick}
                                        accent={machineAccent}
                                        capacityMins={shiftCapacityMins}
                                        draggedTaskId={draggedTaskId}
                                        setDraggedTaskId={setDraggedTaskId}
                                        dragOverTaskId={dragOverTaskId}
                                        setDragOverTaskId={setDragOverTaskId}
                                        dragOverPosition={dragOverPosition}
                                        setDragOverPosition={setDragOverPosition}
                                        dragOverColumnId={dragOverColumnId}
                                        setDragOverColumnId={setDragOverColumnId}
                                        onDrop={handleDrop}
                                        machines={machines}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                                <p className="text-3xl mb-2">✨</p>
                                <p className="text-gray-400 text-xs">No finishing operation selected.</p>
                            </div>
                        )
                    ) : (
                        <div className="flex gap-4 pb-4">
                            {/* 1. Backlog Queue lane */}
                            <BacklogColumn
                                id="backlog"
                                tasks={backlogTasks}
                                orderLookup={getOrder}
                                onUpdateTask={handleUpdateTask}
                                onTaskClick={handleTaskClick}
                                widthClass="flex-1 max-w-[650px] min-w-[320px]"
                                draggedTaskId={draggedTaskId}
                                setDraggedTaskId={setDraggedTaskId}
                                dragOverTaskId={dragOverTaskId}
                                setDragOverTaskId={setDragOverTaskId}
                                dragOverPosition={dragOverPosition}
                                setDragOverPosition={setDragOverPosition}
                                dragOverColumnId={dragOverColumnId}
                                setDragOverColumnId={setDragOverColumnId}
                                onDrop={handleDrop}
                                machines={machines}
                            />

                            {/* 2. Selected Finishing lane */}
                            {selectedFinishing ? (
                                <MachineColumn
                                    id={`finishing-${selectedFinishing.id}`}
                                    title={selectedFinishing.name}
                                    label="FINISHING"
                                    tasks={finishingTasksMap[selectedFinishing.id] || []}
                                    orderLookup={getOrder}
                                    onUpdateTask={handleUpdateTask}
                                    onTaskClick={handleTaskClick}
                                    accent={machineAccent}
                                    capacityMins={shiftCapacityMins}
                                    widthClass="flex-1 max-w-[650px] min-w-[320px]"
                                    draggedTaskId={draggedTaskId}
                                    setDraggedTaskId={setDraggedTaskId}
                                    dragOverTaskId={dragOverTaskId}
                                    setDragOverTaskId={setDragOverTaskId}
                                    dragOverPosition={dragOverPosition}
                                    setDragOverPosition={setDragOverPosition}
                                    dragOverColumnId={dragOverColumnId}
                                    setDragOverColumnId={setDragOverColumnId}
                                    onDrop={handleDrop}
                                    machines={machines}
                                />
                            ) : (
                                <div className="flex-1 text-center py-16 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                                    <p className="text-3xl mb-2">✨</p>
                                    <p className="text-gray-400 text-xs">No finishing operation selected.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Task Detail Modal */}
            {selectedTaskModal && (
                <TaskModal
                    task={selectedTaskModal.task}
                    order={selectedTaskModal.order}
                    machine={machines.find(m => m.id === selectedTaskModal.task.machine_id) || selectedMachine}
                    onClose={handleCloseModal}
                    onSave={handleTaskModalSave}
                    onRefresh={onRefresh}
                />
            )}
        </>
    );
}
