'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import JobTicketModal from './JobTicketModal';
import AddTaskModal from './AddTaskModal';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import {
    FiChevronLeft, FiChevronRight, FiChevronDown, FiClock, FiPrinter,
    FiTrendingUp, FiAlertTriangle, FiBookOpen, FiActivity, FiDownload,
    FiX, FiInfo, FiZap, FiSettings, FiPackage, FiUser, FiCalendar, FiEdit2, FiLayers, FiMove,
    FiFileText, FiSearch, FiPlus, FiExternalLink
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
    task, order, onUpdateTask, onTaskClick, onViewJobTicket, onQuickCalc, machine, accent,
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    onDrop, columnId, finishings = []
}) {
    const [calcLoading, setCalcLoading] = useState(false);
    const [isEditingTime, setIsEditingTime] = useState(false);
    const [timeInputValue, setTimeInputValue] = useState('');
    const [showTransferDropdown, setShowTransferDropdown] = useState(false);

    const handleTransfer = async (targetFinishing) => {
        if (!targetFinishing) return;
        let newName = targetFinishing.name;
        if (task.name && task.name.includes('—')) {
            const parts = task.name.split('—');
            newName = `${targetFinishing.name} — ${parts.slice(1).join('—').trim()}`;
        }
        const fields = {
            machine_id: null,
            machine_name: null,
            name: newName
        };
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

    const isStandalone = task.sales_order_id === null;
    const jobName = isStandalone
        ? 'Standalone Task'
        : (order?.estimation_names || order?.customer_name || 'No Job Name');
    const customerName = isStandalone ? '' : (order?.customer_name || '');
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
                    {order?.id ? (
                        <Link
                            href={`/dashboard/sales-orders/${order.id}`}
                            target="_blank"
                            onMouseDown={e => e.stopPropagation()}
                            className="text-[9.5px] font-extrabold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded tracking-wider flex-shrink-0 flex items-center gap-0.5 hover:underline"
                            title="Open Sales Order"
                        >
                            {orderCode} <FiExternalLink className="w-2.5 h-2.5 opacity-70" />
                        </Link>
                    ) : (
                        <span className="text-[9.5px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded tracking-wider flex-shrink-0">
                            {orderCode}
                        </span>
                    )}
                    <span className="text-[12px] font-bold text-white truncate block max-w-[140px]" title={jobName}>
                        {jobName}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {order?.id && onViewJobTicket && (
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                onViewJobTicket(order.id);
                            }}
                            onMouseDown={e => e.stopPropagation()}
                            className="bg-white/10 border border-white/25 text-white hover:bg-amber-500/20 rounded p-1 flex items-center transition-all"
                            title="View Job Ticket"
                        >
                            <FiFileText className="w-2.5 h-2.5" />
                        </button>
                    )}
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
                    <div className="relative">
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                setShowTransferDropdown(!showTransferDropdown);
                            }}
                            onMouseDown={e => e.stopPropagation()}
                            className="bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 rounded p-1 flex items-center transition-all"
                            title="Transfer to another operation"
                        >
                            <FiMove className="w-2.5 h-2.5" />
                        </button>
                        {showTransferDropdown && (
                            <>
                                <div
                                    className="fixed inset-0 z-[998]"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowTransferDropdown(false);
                                    }}
                                />
                                <div
                                    className="absolute right-0 mt-1 z-[999] w-[180px] bg-black border border-white/15 rounded-lg shadow-2xl py-1 text-left"
                                    onClick={e => e.stopPropagation()}
                                    onMouseDown={e => e.stopPropagation()}
                                >
                                    <div className="px-2.5 py-1 text-[8.5px] font-extrabold text-gray-500 uppercase tracking-wider border-b border-white/5">
                                        Transfer to Operation
                                    </div>
                                    <div className="max-h-[180px] overflow-y-auto">
                                        {finishings.map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => {
                                                    handleTransfer(f);
                                                    setShowTransferDropdown(false);
                                                }}
                                                className="w-full px-2.5 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5 truncate block font-medium"
                                            >
                                                {f.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
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
                    {(() => {
                        const parts = task.name ? task.name.split('—') : [];
                        if (parts.length >= 2) {
                            return parts[parts.length - 2]?.trim();
                        }
                        return task.name || '';
                    })()}
                </span>
                {customerName && (
                    <span className="text-[9.5px] text-gray-500 truncate max-w-[100px]">
                        {customerName}
                    </span>
                )}
            </div>

            {(task.assigned_to || task.helper_name) && (
                <div className="mt-1 pl-3.5 flex flex-wrap gap-1">
                    {task.assigned_to && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded font-medium" title={`Assigned Operator: ${task.assigned_to}`}>
                            <FiUser className="w-2.5 h-2.5" />
                            {task.assigned_to}
                        </span>
                    )}
                    {task.helper_name && (
                        <span className="inline-flex items-center gap-1 text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium" title={`Assigned Helper: ${task.helper_name}`}>
                            <FiUser className="w-2.5 h-2.5" />
                            {task.helper_name}
                        </span>
                    )}
                </div>
            )}

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

function TaskModal({ task, order, machine, onClose, onSave, onDelete, onRefresh, onViewJobTicket, employees = [] }) {
    const defaultSetup = machine?.make_ready_minutes || 0;
    const defaultSpeed = machine?.speed || 0;
    const defaultUnit = machine?.speed_unit || 'Sheets/Hr';

    const machineEmps = machine?.assigned_employees_list || [];
    const candidateEmps = machineEmps.length > 0 ? machineEmps : employees;

    const machineHelpers = machine?.assigned_helpers_list || [];
    const candidateHelpers = machineHelpers.length > 0 ? machineHelpers : employees;

    const defaultAssignedTo = task.assigned_to
        ? task.assigned_to
        : (machineEmps.length === 1 ? machineEmps[0].name : '');

    const defaultHelperName = task.helper_name
        ? task.helper_name
        : (machineHelpers.length === 1 ? machineHelpers[0].name : '');

    const [assignedTo, setAssignedTo] = useState(defaultAssignedTo);
    const [helperName, setHelperName] = useState(defaultHelperName);

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
            return task.quantity != null && task.quantity !== 0
                ? String(task.quantity)
                : (task.job_qty != null ? String(task.job_qty) : '');
        }
    };

    const [setupMin, setSetupMin] = useState(task.custom_make_ready_minutes != null ? String(task.custom_make_ready_minutes) : '');
    const [speed, setSpeed] = useState(task.custom_speed != null ? String(task.custom_speed) : '');
    const [unit, setUnit] = useState(initialUnit);
    const [calcQty, setCalcQty] = useState(getInitialQty(initialUnit));
    const [multiplier, setMultiplier] = useState(task.custom_multiplier != null ? String(task.custom_multiplier) : '1');
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
        let targetMult = parseFloat(multiplier) || 1;

        let p1Mins = 0;
        let p2Mins = 0;

        if (targetSpeed > 0) {
            p1Mins = Math.ceil(((remainingQty * targetMult) / targetSpeed) * 60) + targetSetup;
            p2Mins = Math.ceil(((splitQty * targetMult) / targetSpeed) * 60) + targetSetup;
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
        const defaultQty = unit.toLowerCase() === 'prints/hr'
            ? ((task.sheet_count || task.quantity || 0) * (task.sides || 1))
            : (task.sheet_count != null ? task.sheet_count : task.quantity);
        const q = parseFloat(calcQty !== '' ? calcQty : defaultQty) || 0;
        const mult = parseFloat(multiplier) || 1;
        const s = parseFloat(speed !== '' ? speed : defaultSpeed) || 0;
        const t = parseFloat(setupMin !== '' ? setupMin : defaultSetup) || 0;

        if (q && s > 0) {
            const runMins = Math.ceil(((q * mult) / s) * 60);
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
            custom_multiplier: multiplier !== '' ? parseFloat(multiplier) : 1,
            estimated_minutes: estimatedMins,
            assigned_to: assignedTo || null,
            helper_name: helperName || null,
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
        setSetupMin(''); setSpeed(''); setUnit(defaultUnit); setMultiplier('1');
        setCalcQty(getInitialQty(defaultUnit));
        setEstimatedMins(task.estimated_minutes || 0);
        await onSave(task.id, order?.id, {
            custom_make_ready_minutes: null,
            custom_speed: null,
            custom_speed_unit: null,
            custom_multiplier: 1,
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
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2.5 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <FiPackage className="w-3.5 h-3.5" /> Job Information
                                </span>
                                {onViewJobTicket && order.id && (
                                    <button
                                        onClick={() => onViewJobTicket(order.id)}
                                        className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-bold transition-all flex items-center gap-1"
                                    >
                                        <FiFileText className="w-3 h-3" /> Open Job Ticket
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3.5">
                                <div>
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Job Code</span>
                                    <div className="text-xs text-gray-300 font-semibold mt-0.5 flex items-center gap-1">
                                        {order.id ? (
                                            <Link
                                                href={`/dashboard/sales-orders/${order.id}`}
                                                target="_blank"
                                                className="text-amber-400 hover:underline flex items-center gap-1 font-bold"
                                            >
                                                {order.code || '—'} <FiExternalLink className="w-3 h-3" />
                                            </Link>
                                        ) : (
                                            order.code || '—'
                                        )}
                                    </div>
                                </div>
                                {[
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

                    {/* Staffing Assignments */}
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-gray-400">
                                <FiUser className="w-3.5 h-3.5" /> Staffing Assignments
                            </div>
                            {(machineEmps.length > 0 || machineHelpers.length > 0) && (
                                <span className="text-[9.5px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-semibold">
                                    Service Staff: Operators ({machineEmps.length > 0 ? machineEmps.map(e => e.name).join(', ') : 'any'}){machineHelpers.length > 0 ? ` · Helpers (${machineHelpers.map(e => e.name).join(', ')})` : ''}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Operator</label>
                                <select
                                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-white/30 [color-scheme:dark]"
                                    value={assignedTo}
                                    onChange={e => setAssignedTo(e.target.value)}
                                >
                                    <option value="">— Unassigned —</option>
                                    {candidateEmps.map(e => (
                                        <option key={e.id || e.name} value={e.name}>
                                            {e.name}
                                        </option>
                                    ))}
                                </select>
                                {machineEmps.length === 1 && (
                                    <p className="text-[10px] text-emerald-400 mt-1.5 italic font-medium">
                                        * Automatically assigned to the only operator assigned to this service ({machineEmps[0].name}).
                                    </p>
                                )}
                                {machineEmps.length > 1 && (
                                    <p className="text-[10px] text-gray-400 mt-1.5 italic">
                                        Multiple operators assigned. Select who is executing this task.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Helper</label>
                                <select
                                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-white/30 [color-scheme:dark]"
                                    value={helperName}
                                    onChange={e => setHelperName(e.target.value)}
                                >
                                    <option value="">— Unassigned —</option>
                                    {candidateHelpers.map(e => (
                                        <option key={e.id || e.name} value={e.name}>
                                            {e.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Custom Overrides */}
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 border-purple-500/20">
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                            <FiZap className="w-3.5 h-3.5" /> Custom Overrides &amp; Calculation
                            <span className="text-[9px] text-gray-500 font-normal lowercase tracking-normal ml-2">(leave blank to use defaults)</span>
                        </div>
                        <div className="grid grid-cols-5 gap-3">
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Run Qty</label>
                                <input
                                    className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-white/30"
                                    type="number"
                                    min="0"
                                    placeholder={String(unit.toLowerCase() === 'prints/hr' ? ((task.sheet_count || task.quantity || 0) * (task.sides || 1)) : (task.sheet_count != null ? task.sheet_count : (task.quantity || 0)))}
                                    value={calcQty}
                                    onChange={e => setCalcQty(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Multiplier</label>
                                <input
                                    className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-white/30"
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    placeholder="1"
                                    value={multiplier}
                                    onChange={e => setMultiplier(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Setup (min)</label>
                                <input
                                    className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-white/30"
                                    type="number"
                                    min="0"
                                    placeholder={`Default: ${defaultSetup || 0}`}
                                    value={setupMin}
                                    onChange={e => setSetupMin(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Speed</label>
                                <input
                                    className="w-full bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-white/30"
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
                                    className="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/30 [color-scheme:dark] cursor-pointer"
                                    value={unit}
                                    onChange={e => {
                                        const newUnit = e.target.value;
                                        setUnit(newUnit);
                                        setCalcQty(getInitialQty(newUnit));
                                    }}
                                >
                                    {['Sheets/Hr', 'Prints/Hr', 'Impressions/Hr', 'Copies/Hr', 'Pcs/Hr', 'm²/Hr', 'Meters/Hr', 'Units/Hr', 'Min/Job'].map(u => (
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
                        {(task.is_manual || task.is_manual === 1) && onDelete && (
                            <button
                                onClick={() => onDelete(task.id, order?.id)}
                                className="px-4 py-2 border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-lg text-xs font-bold transition-all mr-auto"
                            >
                                Delete Task
                            </button>
                        )}
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
    id, title, label, tasks, orderLookup, onUpdateTask, onTaskClick, onViewJobTicket, accent, capacityMins = 480,
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    dragOverColumnId, setDragOverColumnId,
    onDrop, finishings
}) {
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;
    const totalQty = tasks.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);

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
                    {totalQty > 0 && (
                        <div className="text-[9.5px] font-bold text-amber-400 mt-0.5">
                            Qty: {totalQty.toLocaleString()}
                        </div>
                    )}
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
                            onViewJobTicket={onViewJobTicket}
                            accent={accent}
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            dragOverTaskId={dragOverTaskId}
                            setDragOverTaskId={setDragOverTaskId}
                            dragOverPosition={dragOverPosition}
                            setDragOverPosition={setDragOverPosition}
                            onDrop={onDrop}
                            columnId={id}
                            finishings={finishings}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Unplanned Queue Column ────────────────────────────────────────────────
function UnplannedColumn({
    id, tasks, orderLookup, onUpdateTask, onTaskClick, onViewJobTicket, accent,
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    dragOverColumnId, setDragOverColumnId,
    onDrop, finishings, onPrintReport
}) {
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;
    const totalQty = tasks.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
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
                    {totalQty > 0 && (
                        <div className="text-[9.5px] font-bold text-amber-400 mt-0.5">
                            Qty: {totalQty.toLocaleString()}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {onPrintReport && (
                        <button
                            onClick={onPrintReport}
                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-all cursor-pointer"
                            title="Print Unplanned Queue Report"
                        >
                            <FiPrinter className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <div className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-400">
                        {totalHrs}h
                    </div>
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
                            onViewJobTicket={onViewJobTicket}
                            accent="#64748b"
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            dragOverTaskId={dragOverTaskId}
                            setDragOverTaskId={setDragOverTaskId}
                            dragOverPosition={dragOverPosition}
                            setDragOverPosition={setDragOverPosition}
                            onDrop={onDrop}
                            columnId={id}
                            finishings={finishings}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Machine Column ────────────────────────────────────────────────────────
function MachineColumn({
    id, title, label, tasks, orderLookup, onUpdateTask, onTaskClick, onViewJobTicket, accent, capacityMins = 480, widthClass = "w-[230px] flex-shrink-0",
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    dragOverColumnId, setDragOverColumnId,
    onDrop, finishings
}) {
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;
    const totalQty = tasks.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
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
                    {totalQty > 0 && (
                        <div className="text-[9.5px] font-bold text-amber-400 mt-0.5">
                            Qty: {totalQty.toLocaleString()}
                        </div>
                    )}
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
                            onViewJobTicket={onViewJobTicket}
                            accent={accent}
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            dragOverTaskId={dragOverTaskId}
                            setDragOverTaskId={setDragOverTaskId}
                            dragOverPosition={dragOverPosition}
                            setDragOverPosition={setDragOverPosition}
                            onDrop={onDrop}
                            columnId={id}
                            finishings={finishings}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Backlog Column ────────────────────────────────────────────────────────
function BacklogColumn({
    id, tasks, orderLookup, onUpdateTask, onTaskClick, onViewJobTicket, widthClass = "w-[230px] flex-shrink-0",
    draggedTaskId, setDraggedTaskId,
    dragOverTaskId, setDragOverTaskId,
    dragOverPosition, setDragOverPosition,
    dragOverColumnId, setDragOverColumnId,
    onDrop, finishings, onPrintReport
}) {
    const totalMins = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const totalHrs = Math.round((totalMins / 60) * 10) / 10;
    const totalQty = tasks.reduce((sum, t) => sum + (parseFloat(t.quantity) || 0), 0);
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
                    {totalQty > 0 && (
                        <div className="text-[9.5px] font-bold text-amber-400 mt-0.5">
                            Qty: {totalQty.toLocaleString()}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {onPrintReport && (
                        <button
                            onClick={onPrintReport}
                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-all cursor-pointer animate-pulse-subtle"
                            title="Print Unplanned Queue Report"
                        >
                            <FiPrinter className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <div className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-400">
                        {totalHrs}h
                    </div>
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
                            onViewJobTicket={onViewJobTicket}
                            accent="#64748b"
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            dragOverTaskId={dragOverTaskId}
                            setDragOverTaskId={setDragOverTaskId}
                            dragOverPosition={dragOverPosition}
                            setDragOverPosition={setDragOverPosition}
                            onDrop={onDrop}
                            columnId={id}
                            finishings={finishings}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Main FinishingPlanning Component ───────────────────────────────────────
export default function FinishingPlanning({ finishings = [], machines = [], orders, employees = [], onRefresh }) {
    const [viewMode, setViewMode] = useState('daily');
    const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'saved', 'error'
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
    const [printType, setPrintType] = useState('weekly'); // 'weekly' or 'unplanned'
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [showWeeklyPrintModal, setShowWeeklyPrintModal] = useState(false);
    const [weeklyPrintDays, setWeeklyPrintDays] = useState([0, 1, 2, 3, 4, 5, 6]);

    // Export customization options
    const [exportFormat, setExportFormat] = useState('pdf'); // 'pdf' | 'csv'
    const [excludeCompleted, setExcludeCompleted] = useState(false);
    const [includeStats, setIncludeStats] = useState(true);
    const [exportColumns, setExportColumns] = useState(['code', 'customer', 'name', 'delivery', 'quantity', 'specs', 'notes', 'finishings', 'time', 'status']);

    const [weeklyExportFormat, setWeeklyExportFormat] = useState('pdf'); // 'pdf' | 'csv'
    const [weeklyExcludeCompleted, setWeeklyExcludeCompleted] = useState(false);
    const [weeklyIncludeStats, setWeeklyIncludeStats] = useState(true);
    const [weeklyExportColumns, setWeeklyExportColumns] = useState(['code', 'customer', 'name', 'quantity', 'time', 'status']);

    const [showDailyPrintModal, setShowDailyPrintModal] = useState(false);
    const [dailyIsChecksheet, setDailyIsChecksheet] = useState(false);
    const [dailyExportFormat, setDailyExportFormat] = useState('pdf');
    const [dailyExcludeCompleted, setDailyExcludeCompleted] = useState(false);
    const [dailyIncludeStats, setDailyIncludeStats] = useState(true);
    const [dailyExportColumns, setDailyExportColumns] = useState(['code', 'customer', 'name', 'quantity', 'time', 'status']);

    const [printOptions, setPrintOptions] = useState({
        includeSpecs: true,
        includeNotes: true,
        includeFinishings: true,
        includeDates: true,
        groupByOrder: false
    });
    const [filterText, setFilterText] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [jobTicketOrderId, setJobTicketOrderId] = useState(null);

    const filterTask = (task) => {
        if (filterStatus !== 'all' && task.status !== filterStatus) return false;
        if (!filterText.trim()) return true;

        const q = filterText.toLowerCase().trim();
        const order = getOrder(task);
        const orderCode = (order?.code || '').toLowerCase();
        const estNames = (order?.estimation_names || '').toLowerCase();
        const custName = (order?.customer_name || '').toLowerCase();
        const taskName = (task?.name || '').toLowerCase();
        const taskDesc = (task?.description || '').toLowerCase();

        return (
            orderCode.includes(q) ||
            estNames.includes(q) ||
            custName.includes(q) ||
            taskName.includes(q) ||
            taskDesc.includes(q)
        );
    };

    const matchesFinishing = (taskName, finishingName) => {
        if (!taskName || !finishingName) return false;
        const tNorm = taskName.toLowerCase().trim().replace(/gethering/g, 'gathering');
        const fNorm = finishingName.toLowerCase().trim().replace(/gethering/g, 'gathering');
        return tNorm.startsWith(fNorm) || tNorm.includes(fNorm) || fNorm.includes(tNorm);
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

    const handlePrintUnplanned = () => {
        setExportFormat('pdf');
        setExcludeCompleted(false);
        setIncludeStats(true);
        setExportColumns(['code', 'customer', 'name', 'delivery', 'quantity', 'specs', 'notes', 'finishings', 'time', 'status']);
        setShowPrintModal(true);
    };

    const executeDownloadPdf = () => {
        if (!selectedFinishing) return;
        setShowPrintModal(false);
        const params = new URLSearchParams({
            format: exportFormat,
            excludeCompleted: excludeCompleted ? 'true' : 'false',
            columns: exportColumns.join(','),
            specs: exportColumns.includes('specs') ? 'true' : 'false',
            notes: exportColumns.includes('notes') ? 'true' : 'false',
            finishings: exportColumns.includes('finishings') ? 'true' : 'false',
            dates: exportColumns.includes('delivery') ? 'true' : 'false',
            groupByOrder: printOptions.groupByOrder ? 'true' : 'false',
            includeStats: includeStats ? 'true' : 'false'
        }).toString();
        window.open(`/api/job-planning/finishing/${selectedFinishing.id}/unplanned-pdf?${params}`, '_blank');
    };

    const handlePrintWeekly = () => {
        setPrintType('weekly');
        setTimeout(() => {
            window.print();
        }, 100);
    };

    useEffect(() => {
        const handleAfterPrint = () => {
            setPrintType('weekly');
        };
        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, []);

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
        setSaveStatus('saving');
        try {
            const res = await fetch(`/api/sales-orders/${parentOrder.id || 'unassigned'}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    machine_id: null,
                    machine_name: null,
                    scheduled_date: newScheduledDate,
                    machine_position: positionMap[taskId] || null,
                }),
            });
            if (!res.ok) throw new Error('Failed to update task');
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (e) {
            console.error('Drag update error:', e);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 5000);
            setLocalOrders(orders); // Revert
        }
    };

    // Update Task Time
    const handleUpdateTask = async (taskId, orderId, fields) => {
        const targetSO = orderId || 'unassigned';
        setLocalOrders(prev => {
            return prev.map(order => {
                if (order.id === orderId || (orderId == null && order.id == null)) {
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

        setSaveStatus('saving');
        try {
            const res = await fetch(`/api/sales-orders/${targetSO}/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });
            if (!res.ok) throw new Error('Failed to update task');
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (e) {
            console.error('Task update error:', e);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 5000);
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
    const handleTaskModalDelete = async (taskId, orderId) => {
        if (!(await confirmDialog('Are you sure you want to delete this manual task?', { danger: true, confirmLabel: 'Delete' }))) return;
        const targetSO = orderId || 'unassigned';
        setSaveStatus('saving');
        try {
            const res = await fetch(`/api/sales-orders/${targetSO}/tasks/${taskId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete task');
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(null), 3000);
            if (onRefresh) {
                await onRefresh();
            }
            setSelectedTaskModal(null);
        } catch (e) {
            console.error('Task delete error:', e);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 5000);
            alert(e.message);
        }
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
                    .print-report-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 18px;
                    }
                    .print-report-table th, .print-report-table td {
                        border: 1px solid #c0c0c0;
                        padding: 6px 8px;
                        text-align: left;
                        font-size: 10.5px;
                        color: black !important;
                    }
                    .print-report-table th {
                        background-color: #e5e5e5;
                        font-weight: bold;
                    }
                }
                @media screen {
                    .print-only {
                        display: none !important;
                    }
                }
            `}</style>

            {/* ─── PRINT ONLY LAYOUT ─── */}
            {selectedFinishing && printType === 'weekly' && (
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

                    <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 11 }}>
                        <div><strong>Total Tasks Planned:</strong> {totalTasksPlanned} ({Math.round(totalEstimatedMins / 60 * 10) / 10} hrs)</div>
                        <div><strong>Completed Tasks:</strong> {completedTasks}</div>
                        <div><strong>Completion Rate:</strong> {completionRate}%</div>
                    </div>

                    <table className="print-report-table">
                        <thead>
                            <tr>
                                <th style={{ width: '15%' }}>Day / Date</th>
                                <th style={{ width: '10%' }}>Job Code</th>
                                <th style={{ width: '30%' }}>Job Name</th>
                                <th style={{ width: '30%' }}>Task Detail</th>
                                <th style={{ width: '8%' }}>Est. Time</th>
                                <th style={{ width: '7%' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {weekDays.filter(day => (dailyTasksMap[day.dateStr] || []).length > 0).length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                                        No tasks scheduled for this week
                                    </td>
                                </tr>
                            ) : (
                                weekDays.filter(day => (dailyTasksMap[day.dateStr] || []).length > 0).map(day => {
                                    const dayTasks = dailyTasksMap[day.dateStr] || [];
                                    return dayTasks.map((t, idx) => {
                                        const ord = getOrder(t);
                                        return (
                                            <tr key={t.id}>
                                                {idx === 0 && (
                                                    <td rowSpan={dayTasks.length} style={{ verticalAlign: 'top' }}>
                                                        <strong>{day.name}</strong><br />
                                                        <span style={{ fontSize: 8.5, color: '#444' }}>{day.dateStr}</span>
                                                    </td>
                                                )}
                                                <td>{ord?.code || '—'}</td>
                                                <td>{ord?.estimation_names || ord?.customer_name || '—'}</td>
                                                <td>
                                                    {(() => {
                                                        const parts = t.name.split('—');
                                                        const cleanName = parts[parts.length - 1]?.trim() || t.name;
                                                        const operationDetail = parts.length > 2 ? parts[1]?.trim() : '';
                                                        return operationDetail ? `${cleanName} (${operationDetail})` : cleanName;
                                                    })()}
                                                </td>
                                                <td>{t.estimated_minutes ? `${t.estimated_minutes}m` : '0m'}</td>
                                                <td style={{ textTransform: 'capitalize' }}>{t.status}</td>
                                            </tr>
                                        );
                                    });
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Weekly Planner PDF Options Modal */}
            {showWeeklyPrintModal && (
                <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowWeeklyPrintModal(false)}>
                    <div className="bg-black/10 backdrop-blur-lg border border-white/15 rounded-2xl w-full max-w-md shadow-[0_32px_96px_rgba(0,0,0,0.9)] flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                                    <FiPrinter className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-extrabold text-white tracking-tight m-0">Schedule Export Options</h2>
                                    <p className="text-xs text-slate-400 m-0 mt-0.5 font-medium">Customize your schedule report configuration</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowWeeklyPrintModal(false)}
                                className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all cursor-pointer"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1">
                                <button
                                    onClick={() => setWeeklyExportFormat('pdf')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${weeklyExportFormat === 'pdf' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                >
                                    PDF Document
                                </button>
                                <button
                                    onClick={() => setWeeklyExportFormat('csv')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${weeklyExportFormat === 'csv' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                >
                                    CSV Spreadsheet
                                </button>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-white/[0.02] border border-white/5 hover:bg-white/5 rounded-xl transition-all">
                                <input
                                    type="checkbox"
                                    className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                    checked={weeklyExcludeCompleted}
                                    onChange={e => setWeeklyExcludeCompleted(e.target.checked)}
                                />
                                <div>
                                    <div className="text-xs font-bold text-white">Exclude Completed Tasks</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">Filter out tasks that have already been completed</div>
                                </div>
                            </label>

                            {weeklyExportFormat === 'pdf' && (
                                <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-white/[0.02] border border-white/5 hover:bg-white/5 rounded-xl transition-all">
                                    <input
                                        type="checkbox"
                                        className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                        checked={weeklyIncludeStats}
                                        onChange={e => setWeeklyIncludeStats(e.target.checked)}
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Include Stats Summary</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">Show weekly summary analytics in the PDF</div>
                                    </div>
                                </label>
                            )}

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-300">Days to Include</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setWeeklyPrintDays([0, 1, 2, 3, 4, 5, 6])}
                                            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-[10px] text-slate-600">|</span>
                                        <button
                                            onClick={() => setWeeklyPrintDays([])}
                                            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 border border-white/5 rounded-xl bg-white/[0.01] p-3">
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx) => {
                                        const checked = weeklyPrintDays.includes(idx);
                                        return (
                                            <label key={day} className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-white/5 rounded-lg transition-all">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                                    checked={checked}
                                                    onChange={() => {
                                                        setWeeklyPrintDays(prev =>
                                                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                                        );
                                                    }}
                                                />
                                                <span className="text-xs font-medium text-slate-200">{day}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-300">Select Columns to Export</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setWeeklyExportColumns(['code', 'customer', 'name', 'quantity', 'time', 'status'])}
                                            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-[10px] text-slate-600">|</span>
                                        <button
                                            onClick={() => setWeeklyExportColumns(['code', 'customer', 'name'])}
                                            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 border border-white/5 rounded-xl bg-white/[0.01] p-3">
                                    {[
                                        { id: 'code', label: 'Job Code' },
                                        { id: 'customer', label: 'Customer Name' },
                                        { id: 'name', label: 'Task Details' },
                                        { id: 'quantity', label: 'Run Qty' },
                                        { id: 'time', label: 'Est. Time' },
                                        { id: 'status', label: 'Status' }
                                    ].map(col => {
                                        const isChecked = weeklyExportColumns.includes(col.id);
                                        return (
                                            <label key={col.id} className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-white/5 rounded-lg transition-all">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        setWeeklyExportColumns(prev =>
                                                            prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id]
                                                        );
                                                    }}
                                                />
                                                <span className="text-xs font-medium text-slate-200">{col.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setShowWeeklyPrintModal(false)}
                                    className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (weeklyPrintDays.length === 0) {
                                            alert('Please select at least one day.');
                                            return;
                                        }
                                        setShowWeeklyPrintModal(false);
                                        const y = currentWeekStart.getFullYear();
                                        const m = String(currentWeekStart.getMonth() + 1).padStart(2, '0');
                                        const d = String(currentWeekStart.getDate()).padStart(2, '0');
                                        const weekStartStr = `${y}-${m}-${d}`;
                                        const params = new URLSearchParams({
                                            weekStart: weekStartStr,
                                            includeDays: weeklyPrintDays.join(','),
                                            format: weeklyExportFormat,
                                            excludeCompleted: weeklyExcludeCompleted ? 'true' : 'false',
                                            columns: weeklyExportColumns.join(','),
                                            includeStats: weeklyIncludeStats ? 'true' : 'false'
                                        }).toString();
                                        window.open(`/api/job-planning/finishing/${selectedFinishing.id}/pdf?${params}`, '_blank');
                                    }}
                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-purple-950/20 cursor-pointer"
                                >
                                    <FiDownload className="w-4 h-4" />
                                    Generate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Daily Planner PDF/Checksheet Options Modal */}
            {showDailyPrintModal && (
                <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowDailyPrintModal(false)}>
                    <div className="bg-black/10 backdrop-blur-lg border border-white/15 rounded-2xl w-full max-w-md shadow-[0_32px_96px_rgba(0,0,0,0.9)] flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                                    <FiPrinter className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-extrabold text-white tracking-tight m-0">
                                        {dailyIsChecksheet ? 'Task Sheet Export Options' : 'Daily Report Export Options'}
                                    </h2>
                                    <p className="text-xs text-slate-400 m-0 mt-0.5 font-medium">Customize your daily export configuration</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDailyPrintModal(false)}
                                className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all cursor-pointer"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1">
                                <button
                                    onClick={() => setDailyExportFormat('pdf')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${dailyExportFormat === 'pdf' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                >
                                    PDF Document
                                </button>
                                <button
                                    onClick={() => setDailyExportFormat('csv')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${dailyExportFormat === 'csv' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                >
                                    CSV Spreadsheet
                                </button>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-white/[0.02] border border-white/5 hover:bg-white/5 rounded-xl transition-all">
                                <input
                                    type="checkbox"
                                    className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                    checked={dailyExcludeCompleted}
                                    onChange={e => setDailyExcludeCompleted(e.target.checked)}
                                />
                                <div>
                                    <div className="text-xs font-bold text-white">Exclude Completed Tasks</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">Filter out tasks that have already been completed</div>
                                </div>
                            </label>

                            {dailyExportFormat === 'pdf' && (
                                <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-white/[0.02] border border-white/5 hover:bg-white/5 rounded-xl transition-all">
                                    <input
                                        type="checkbox"
                                        className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                        checked={dailyIncludeStats}
                                        onChange={e => setDailyIncludeStats(e.target.checked)}
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Include Stats Summary</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">Show daily summary analytics in the PDF</div>
                                    </div>
                                </label>
                            )}

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-300">Select Columns to Export</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setDailyExportColumns(['code', 'customer', 'name', 'quantity', 'time', 'status'])}
                                            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-[10px] text-slate-600">|</span>
                                        <button
                                            onClick={() => setDailyExportColumns(['code', 'customer', 'name'])}
                                            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 border border-white/5 rounded-xl bg-white/[0.01] p-3">
                                    {[
                                        { id: 'code', label: 'Job Code' },
                                        { id: 'customer', label: 'Customer Name' },
                                        { id: 'name', label: 'Task Details' },
                                        { id: 'quantity', label: 'Run Qty' },
                                        { id: 'time', label: 'Est. Time' },
                                        { id: 'status', label: 'Status' }
                                    ].map(col => {
                                        const isChecked = dailyExportColumns.includes(col.id);
                                        return (
                                            <label key={col.id} className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-white/5 rounded-lg transition-all">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        setDailyExportColumns(prev =>
                                                            prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id]
                                                        );
                                                    }}
                                                />
                                                <span className="text-xs font-medium text-slate-200">{col.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setShowDailyPrintModal(false)}
                                    className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDailyPrintModal(false);
                                        const y = activeDate.getFullYear();
                                        const m = String(activeDate.getMonth() + 1).padStart(2, '0');
                                        const d = String(activeDate.getDate()).padStart(2, '0');
                                        const dateStr = `${y}-${m}-${d}`;
                                        const params = new URLSearchParams({
                                            date: dateStr,
                                            format: dailyExportFormat,
                                            excludeCompleted: dailyExcludeCompleted ? 'true' : 'false',
                                            columns: dailyExportColumns.join(','),
                                            includeStats: dailyIncludeStats ? 'true' : 'false',
                                            ...(dailyIsChecksheet ? { checksheet: 'true' } : {})
                                        }).toString();
                                        window.open(`/api/job-planning/finishing/${selectedFinishing.id}/pdf?${params}`, '_blank');
                                    }}
                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-purple-900/30 cursor-pointer"
                                >
                                    <FiDownload className="w-4 h-4" />
                                    Generate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unplanned Queue PDF Options Modal */}
            {showPrintModal && (
                <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowPrintModal(false)}>
                    <div className="bg-black/10 backdrop-blur-lg border border-white/15 rounded-2xl w-full max-w-md shadow-[0_32px_96px_rgba(0,0,0,0.9)] flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                                    <FiPrinter className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-extrabold text-white tracking-tight m-0">Unplanned Export Options</h2>
                                    <p className="text-xs text-slate-400 m-0 mt-0.5 font-medium">Customize your unplanned report configuration</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPrintModal(false)}
                                className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all cursor-pointer"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1">
                                <button
                                    onClick={() => setExportFormat('pdf')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${exportFormat === 'pdf' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                >
                                    PDF Document
                                </button>
                                <button
                                    onClick={() => setExportFormat('csv')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${exportFormat === 'csv' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                >
                                    CSV Spreadsheet
                                </button>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-white/[0.02] border border-white/5 hover:bg-white/5 rounded-xl transition-all">
                                <input
                                    type="checkbox"
                                    className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                    checked={excludeCompleted}
                                    onChange={e => setExcludeCompleted(e.target.checked)}
                                />
                                <div>
                                    <div className="text-xs font-bold text-white">Exclude Completed Tasks</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">Filter out tasks that have already been completed</div>
                                </div>
                            </label>

                            {exportFormat === 'pdf' && (
                                <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-white/[0.02] border border-white/5 hover:bg-white/5 rounded-xl transition-all">
                                    <input
                                        type="checkbox"
                                        className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                        checked={includeStats}
                                        onChange={e => setIncludeStats(e.target.checked)}
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white">Include Stats Summary</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">Show total tasks, quantity, and hours summary in the PDF</div>
                                    </div>
                                </label>
                            )}

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-300">Select Columns to Export</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setExportColumns(['code', 'customer', 'name', 'delivery', 'quantity', 'specs', 'notes', 'finishings', 'time', 'status'])}
                                            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                            Select All
                                        </button>
                                        <span className="text-[10px] text-slate-600">|</span>
                                        <button
                                            onClick={() => setExportColumns(['code', 'customer', 'name'])}
                                            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 border border-white/5 rounded-xl bg-white/[0.01] p-3 max-h-[220px] overflow-y-auto">
                                    {[
                                        { id: 'code', label: 'Job Code' },
                                        { id: 'customer', label: 'Customer Name' },
                                        { id: 'name', label: 'Task Details' },
                                        { id: 'delivery', label: 'Delivery Date' },
                                        { id: 'quantity', label: 'Run Qty' },
                                        { id: 'specs', label: 'Technical Specs' },
                                        { id: 'notes', label: 'Production Notes' },
                                        { id: 'finishings', label: 'Finishing Details' },
                                        { id: 'time', label: 'Est. Time' },
                                        { id: 'status', label: 'Status' }
                                    ].map(col => {
                                        const isChecked = exportColumns.includes(col.id);
                                        return (
                                            <label key={col.id} className="flex items-center gap-2.5 cursor-pointer p-1.5 hover:bg-white/5 rounded-lg transition-all">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-white/15 bg-slate-900 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                                    checked={isChecked}
                                                    onChange={() => {
                                                        setExportColumns(prev =>
                                                            prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id]
                                                        );
                                                    }}
                                                />
                                                <span className="text-xs font-medium text-slate-200">{col.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setShowPrintModal(false)}
                                    className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeDownloadPdf}
                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-purple-900/30 cursor-pointer"
                                >
                                    <FiDownload className="w-4 h-4" />
                                    Generate
                                </button>
                            </div>
                        </div>
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
                                {saveStatus === 'saving' && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold animate-pulse">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                        Saving...
                                    </div>
                                )}
                                {saveStatus === 'saved' && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Saved
                                    </div>
                                )}
                                {saveStatus === 'error' && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold animate-pulse">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                        Error Saving
                                    </div>
                                )}
                                {/* Search & Filter Toolbar Controls */}
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Filter tasks..."
                                            value={filterText}
                                            onChange={e => setFilterText(e.target.value)}
                                            className="bg-black/20 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 w-[140px] sm:w-[180px] transition-all"
                                        />
                                        {filterText && (
                                            <button
                                                onClick={() => setFilterText('')}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>

                                    <select
                                        value={filterStatus}
                                        onChange={e => setFilterStatus(e.target.value)}
                                        className="bg-black/20 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-purple-500/50 cursor-pointer"
                                    >
                                        <option value="all" className="bg-slate-900 text-white">All Statuses</option>
                                        <option value="pending" className="bg-slate-900 text-white">Pending</option>
                                        <option value="in_progress" className="bg-slate-900 text-white">In Progress</option>
                                        <option value="done" className="bg-slate-900 text-white">Done</option>
                                    </select>

                                    <button
                                        onClick={() => setShowAddTaskModal(true)}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                                    >
                                        <FiPlus className="w-3.5 h-3.5" />
                                        Add Task
                                    </button>
                                </div>

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

                                        {selectedFinishing && (
                                            <button
                                                onClick={() => {
                                                    // Setup weekly print options



                                                    setWeeklyExportFormat('pdf');
                                                    setWeeklyExcludeCompleted(false);
                                                    setWeeklyExportColumns(['code', 'customer', 'name', 'quantity', 'time', 'status']);
                                                    setWeeklyPrintDays([0, 1, 2, 3, 4, 5, 6]);
                                                    setShowWeeklyPrintModal(true);
                                                }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '7px 12px', border: `1px solid ${G.border}`, borderRadius: 8,
                                                    background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer',
                                                    fontSize: 11.5, fontWeight: 600, transition: 'all 0.18s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = G.purple}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = G.border}
                                            >
                                                <FiDownload style={{ fontSize: 12 }} />
                                                PDF
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
                                            <FiClock className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="text-xs font-bold text-gray-300">
                                                Shift limit: {shiftLimitHrs}h
                                            </span>
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
                                        {selectedFinishing && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setDailyIsChecksheet(false);
                                                        setDailyExportFormat('pdf');
                                                        setDailyExcludeCompleted(false);
                                                        setDailyExportColumns(['code', 'customer', 'name', 'quantity', 'time', 'status']);
                                                        setShowDailyPrintModal(true);
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                        padding: '7px 12px', border: `1px solid ${G.border}`, borderRadius: 8,
                                                        background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer',
                                                        fontSize: 11.5, fontWeight: 600, transition: 'all 0.18s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.borderColor = G.purple}
                                                    onMouseLeave={e => e.currentTarget.style.borderColor = G.border}
                                                >
                                                    <FiDownload style={{ fontSize: 12 }} />
                                                    PDF Report
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setDailyIsChecksheet(true);
                                                        setDailyExportFormat('pdf');
                                                        setDailyExcludeCompleted(false);
                                                        setDailyExportColumns(['code', 'customer', 'name', 'quantity', 'time', 'status']);
                                                        setShowDailyPrintModal(true);
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                        padding: '7px 12px', border: `1px solid ${G.border}`, borderRadius: 8,
                                                        background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer',
                                                        fontSize: 11.5, fontWeight: 600, transition: 'all 0.18s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.borderColor = G.purple}
                                                    onMouseLeave={e => e.currentTarget.style.borderColor = G.border}
                                                >
                                                    <FiDownload style={{ fontSize: 12 }} />
                                                    Task Sheet
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Report Panel — shown in both weekly and daily views */}
                    {showReport && selectedFinishing && (() => {
                        // For daily view, compute stats from the selected day's tasks for selected finishing
                        const dailyDateKey = (() => {
                            const y = activeDate.getFullYear();
                            const m = String(activeDate.getMonth() + 1).padStart(2, '0');
                            const d = String(activeDate.getDate()).padStart(2, '0');
                            return `${y}-${m}-${d}`;
                        })();
                        const dailyTasks = viewMode === 'daily'
                            ? (finishingTasksMap[selectedFinishing.id] || [])
                            : scheduledWeekTasks;
                        const dailyTotal = dailyTasks.length;
                        const dailyMins = dailyTasks.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
                        const dailyDone = dailyTasks.filter(t => t.status === 'done').length;
                        const dailyRate = dailyTotal > 0 ? Math.round((dailyDone / dailyTotal) * 100) : 0;
                        return (
                            <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-1.5">
                                    <FiTrendingUp className="text-emerald-400 w-4 h-4" />
                                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-white m-0">
                                        {viewMode === 'weekly' ? 'Finishing Weekly Report & Capacity' : 'Finishing Daily Report & Capacity'}
                                    </h3>
                                </div>

                                <div className="flex flex-col md:flex-row gap-4">
                                    {/* Stat block */}
                                    <div className="flex gap-2 flex-1 min-w-[280px]">
                                        <div className="flex-1 bg-white/[0.01] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                                {viewMode === 'weekly' ? 'Weekly Load' : 'Daily Load'}
                                            </span>
                                            <span className="text-lg font-black text-white mt-1">
                                                {dailyTotal} <span className="text-xs font-normal text-gray-400">tasks</span>
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                                                <FiClock className="w-3 h-3" />
                                                {Math.round((dailyMins / 60) * 10) / 10} hours scheduled
                                            </span>
                                        </div>

                                        <div className="flex-1 bg-white/[0.01] border border-white/5 p-3 rounded-xl flex flex-col justify-between">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Completed</span>
                                            <span className="text-lg font-black text-emerald-400 mt-1">
                                                {dailyRate}%
                                            </span>
                                            <span className="text-[10px] text-gray-400 mt-1.5">
                                                {dailyDone} of {dailyTotal} tasks done
                                            </span>
                                        </div>
                                    </div>

                                    {viewMode === 'weekly' ? (
                                        /* Weekly bar chart — all 7 days */
                                        <div className="flex-[2] min-w-[320px] bg-white/[0.01] border border-white/5 p-3.5 rounded-xl flex flex-col gap-2.5">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Daily Capacity Load ({shiftLimitHrs}h shift)</span>
                                            <div className="flex flex-col gap-2">
                                                {weekDays.map(day => {
                                                    const mins = (dailyTasksMap[day.dateStr] || []).reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
                                                    const hrs = Math.round((mins / 60) * 10) / 10;
                                                    const pct = Math.min(100, Math.round((mins / shiftCapacityMins) * 100));
                                                    const barColor = mins > shiftCapacityMins
                                                        ? 'linear-gradient(90deg, #f97316, #ef4444)'
                                                        : mins > 0
                                                            ? 'linear-gradient(90deg, #10b981, #06b6d4)'
                                                            : 'rgba(255,255,255,0.06)';
                                                    return (
                                                        <div key={day.dateStr} className="flex items-center text-[10px] leading-none">
                                                            <span className="w-16 text-gray-400 font-medium">{day.name.slice(0, 3)} ({day.dateStr.slice(8)})</span>
                                                            <div className="flex-1 h-1.5 bg-white/5 rounded-full mx-2.5 overflow-hidden">
                                                                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: barColor }} />
                                                            </div>
                                                            <span className={`w-20 text-right font-medium ${mins > shiftCapacityMins ? 'text-red-400 font-bold' : mins > 0 ? 'text-white' : 'text-gray-500'}`}>
                                                                {hrs}h / {shiftLimitHrs}h {pct > 0 && `(${pct}%)`}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        /* Daily view — capacity bar for the selected day */
                                        <div className="flex-[2] min-w-[320px] bg-white/[0.01] border border-white/5 p-3.5 rounded-xl flex flex-col gap-3">
                                            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                                                Capacity Load — {activeDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} ({shiftLimitHrs}h shift)
                                            </span>
                                            {(() => {
                                                const pct = Math.min(100, Math.round((dailyMins / shiftCapacityMins) * 100));
                                                const hrs = Math.round((dailyMins / 60) * 10) / 10;
                                                const over = dailyMins > shiftCapacityMins;
                                                const barColor = over
                                                    ? 'linear-gradient(90deg, #f97316, #ef4444)'
                                                    : dailyMins > 0
                                                        ? 'linear-gradient(90deg, #10b981, #06b6d4)'
                                                        : 'rgba(255,255,255,0.06)';
                                                return (
                                                    <>
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className={`text-2xl font-black ${over ? 'text-red-400' : 'text-white'}`}>{hrs}h</span>
                                                            <span className="text-gray-500">/ {shiftLimitHrs}h shift</span>
                                                            {over && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">OVER CAPACITY</span>}
                                                        </div>
                                                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
                                                        </div>
                                                        <span className="text-[10px] text-gray-500">{pct}% of daily capacity used</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Columns grid */}
                    {viewMode === 'weekly' ? (
                        selectedFinishing ? (
                            <div className="flex gap-3 overflow-x-auto pb-4 scroll-smooth">
                                {/* 1. Unplanned Queue lane */}
                                <UnplannedColumn
                                    id="unplanned"
                                    tasks={unplannedTasks.filter(filterTask)}
                                    orderLookup={getOrder}
                                    onUpdateTask={handleUpdateTask}
                                    onTaskClick={handleTaskClick}
                                    onViewJobTicket={setJobTicketOrderId}
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
                                    finishings={finishings}
                                    onPrintReport={handlePrintUnplanned}
                                />

                                {/* 2. Days lanes */}
                                {weekDays.map(day => (
                                    <DayColumn
                                        key={day.dateStr}
                                        id={`day-${day.dateStr}`}
                                        title={day.name}
                                        label={day.label}
                                        tasks={(dailyTasksMap[day.dateStr] || []).filter(filterTask)}
                                        orderLookup={getOrder}
                                        onUpdateTask={handleUpdateTask}
                                        onTaskClick={handleTaskClick}
                                        onViewJobTicket={setJobTicketOrderId}
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
                                        finishings={finishings}
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
                                tasks={backlogTasks.filter(filterTask)}
                                orderLookup={getOrder}
                                onUpdateTask={handleUpdateTask}
                                onTaskClick={handleTaskClick}
                                onViewJobTicket={setJobTicketOrderId}
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
                                finishings={finishings}
                                onPrintReport={handlePrintUnplanned}
                            />

                            {/* 2. Selected Finishing lane */}
                            {selectedFinishing ? (
                                <MachineColumn
                                    id={`finishing-${selectedFinishing.id}`}
                                    title={selectedFinishing.name}
                                    label="FINISHING"
                                    tasks={(finishingTasksMap[selectedFinishing.id] || []).filter(filterTask)}
                                    orderLookup={getOrder}
                                    onUpdateTask={handleUpdateTask}
                                    onTaskClick={handleTaskClick}
                                    onViewJobTicket={setJobTicketOrderId}
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
                                    finishings={finishings}
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
                    machine={
                        machines.find(m => m.id === selectedTaskModal.task.machine_id) ||
                        finishings.find(f => f.id === selectedTaskModal.task.machine_id)
                    }
                    employees={employees}
                    onClose={handleCloseModal}
                    onSave={handleTaskModalSave}
                    onDelete={handleTaskModalDelete}
                    onRefresh={onRefresh}
                    onViewJobTicket={setJobTicketOrderId}
                />
            )}

            {/* Add Manual Task Modal */}
            {showAddTaskModal && (
                <AddTaskModal
                    orders={localOrders}
                    machines={finishings}
                    isFinishing={true}
                    onClose={() => setShowAddTaskModal(false)}
                    onSuccess={() => {
                        setShowAddTaskModal(false);
                        if (onRefresh) onRefresh();
                    }}
                />
            )}

            {/* Job Ticket Modal */}
            {jobTicketOrderId && (
                <JobTicketModal
                    orderId={jobTicketOrderId}
                    onClose={() => setJobTicketOrderId(null)}
                />
            )}
        </>
    );
}
