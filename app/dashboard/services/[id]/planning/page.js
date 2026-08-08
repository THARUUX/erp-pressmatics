'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    DndContext,
    useDraggable,
    useDroppable,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    FiPlus, FiList, FiClock, FiMaximize2, FiDollarSign,
    FiUserCheck, FiUsers, FiBarChart2, FiCheckCircle,
    FiInfo, FiChevronRight, FiChevronLeft, FiPlay, FiSquare,
    FiFileText, FiTrash2, FiPlusCircle, FiExternalLink, FiCheck, FiShoppingCart,
    FiEdit3, FiX, FiMove, FiTarget, FiUser
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import ManageEmployeesModal from '@/app/services/[id]/portal/components/ManageEmployeesModal';


const theme = {
    container: 'p-8 space-y-8 min-h-screen bg-[#09090b] text-white',
    textAccent: 'text-indigo-400',
    bgAccent: 'bg-indigo-500/10',
    borderAccent: 'border-zinc-800',
    activeTab: 'border-indigo-500 text-indigo-400',
    btnPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md',
    btnSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold transition-all',
    badge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    spinner: 'border-t-indigo-500 border-zinc-800',
    subCompanyBadge: 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400',
    iconAccent: 'text-indigo-400',
};

const G = {
    glass: 'rgba(255, 255, 255, 0.03)',
    glassHov: 'rgba(255, 255, 255, 0.06)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHov: 'rgba(255, 255, 255, 0.15)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
};

const STATUS_CFG = {
    'pending': { label: 'Pending', accent: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'border-l-amber-500', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    'in_progress': { label: 'In Progress', accent: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'border-l-blue-500', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    'paused': { label: 'Paused', accent: '#f43f5e', bg: 'rgba(244,63,94,0.1)', border: 'border-l-rose-500', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    'done': { label: 'Ready / Done', accent: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'border-l-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
};

function parseDescription(desc) {
    if (!desc) return {};
    const parts = desc.split(' · ');
    const res = {};
    for (const p of parts) {
        if (p.startsWith('Unit:')) res.unit = p.replace('Unit:', '').trim();
        else if (p.startsWith('Rate:')) res.rate = parseFloat(p.replace('Rate:', '').trim());
        else if (p.startsWith('Mult:')) res.multiply_by = parseFloat(p.replace('Mult:', '').trim());
        else if (p.startsWith('Note:')) res.note = p.replace('Note:', '').trim();
    }
    if (res.rate !== undefined && res.multiply_by !== undefined) {
        res.total_cost = res.rate * res.multiply_by;
    }
    return res;
}

function extractServiceName(name) {
    if (!name) return '';
    const match = name.match(/^Service:\s*(.*?)\s*—\s*(.*)$/);
    return match ? match[1] : name.replace(/^Service:\s*/, '');
}

function extractJobName(name) {
    if (!name) return '';
    const match = name.match(/^Service:\s*(.*?)\s*—\s*(.*)$/);
    return match ? match[2] : name.replace(/^Service:\s*/, '');
}

function formatMinutes(mins) {
    if (!mins || mins <= 0) return '—';
    const m = Math.round(mins);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function formatSeconds(secs) {
    if (!secs || secs <= 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
}

function StatPill({ label, value, accent, icon: Icon }) {
    const finalAccent = accent || '#6366f1';
    return (
        <div className="flex-1 min-w-[200px] flex items-center justify-between p-5 border border-zinc-800 bg-[#0e0e12] rounded-2xl backdrop-blur-xl transition-all text-white">
            <div>
                <span className="text-xs uppercase tracking-wider block font-semibold text-zinc-400">{label}</span>
                <span className="text-2xl font-bold font-mono tracking-tight mt-1.5 block" style={{ color: finalAccent }}>{value}</span>
            </div>
            {Icon && (
                <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-zinc-800 bg-zinc-900" style={{ color: finalAccent }}>
                    <Icon className="w-5 h-5" />
                </div>
            )}
        </div>
    );
}

function DraggableTaskCard({
    task,
    isDragging,
    allEmployeesList = [],
    onStatusChange,
    onViewNote,
    onEditEstimate,
    onStartTimer,
    onStopTimer,
    onPushReady,
    onViewLogs,
    onReassignEmployee
}) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(task.id) });
    const details = parseDescription(task.description);

    const style = {
        transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
    };

    const isManual = !task.sales_order_id;
    const taskTitle = isManual
        ? (details.note ? details.note.split(' - ')[0] : 'Manual Task')
        : extractJobName(task.name);

    const estMinutes = parseInt(task.estimated_minutes || 0);
    const actualSeconds = parseInt(task.actual_seconds || 0);

    const cfg = STATUS_CFG[task.status || 'pending'] || STATUS_CFG.pending;

    const cardBorder = `border-l-4 ${cfg.border} border-white/[0.08] hover:border-white/25 bg-white/[0.03] hover:bg-white/[0.06] shadow-md`;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`rounded-xl p-3 transition-all active:cursor-grabbing group select-none flex flex-col justify-between space-y-2 shadow-md ${cardBorder}`}
        >
            {/* Header: SO Code & Status */}
            <div>
                <div className="flex justify-between items-center gap-1 mb-1">
                    <span className="font-mono text-[9px] font-bold text-white/40 uppercase tracking-wider">
                        {isManual ? 'MANUAL' : `SO #${task.order_code || task.sales_order_id}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                        {task.is_running && (
                            <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                <span className="w-1 h-1 rounded-full bg-emerald-400" /> Running
                            </span>
                        )}
                        <span className="text-[9px] text-white/30 group-hover:text-white/60 transition-colors flex items-center gap-0.5 font-mono">
                            <FiMove size={10} /> Drag
                        </span>
                    </div>
                </div>

                <h4 className="text-xs font-bold text-white truncate leading-tight" title={taskTitle}>
                    {taskTitle}
                </h4>
                <p className="text-[10px] text-white/40 truncate mt-0.5">
                    {task.customer_name || 'Internal'}
                </p>

                {/* Inline Employee Select & Quick Page Link */}
                <div
                    className="mt-2"
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between gap-1">
                        <select
                            value={task.assigned_to || ''}
                            onChange={e => onReassignEmployee(task, e.target.value)}
                            className="flex-1 min-w-0 bg-black/60 border border-white/10 hover:border-white/25 rounded-md px-2 py-1 text-[10px] text-white font-medium focus:outline-none cursor-pointer"
                        >
                            <option value="" className="bg-[#0c0c16] text-white/40">Unassigned</option>
                            {allEmployeesList.map(emp => (
                                <option key={emp} value={emp} className="bg-[#0c0c16] text-white">{emp}</option>
                            ))}
                        </select>
                        {task.assigned_to && (
                            <a
                                href={`/services/${encodeURIComponent(task.service_id || '1')}/planning/employees/${encodeURIComponent(task.assigned_to)}`}
                                target="_blank"
                                rel="noreferrer"
                                title={`Open ${task.assigned_to}'s Task Page`}
                                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-md transition-colors shrink-0"
                            >
                                <FiExternalLink size={11} />
                            </a>
                        )}
                    </div>
                </div>

                {/* Compact Time Bar */}
                <div className="flex items-center justify-between text-[10px] bg-white/[0.02] border border-white/[0.05] rounded-lg px-2 py-1 mt-2">
                    <div className="flex items-center gap-1">
                        <span className="text-white/40 text-[9px] uppercase font-semibold">Est:</span>
                        {estMinutes > 0 ? (
                            <span className="font-mono font-bold text-white text-[10px]">
                                {estMinutes}m
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); onEditEstimate(task); }}
                                onPointerDown={e => e.stopPropagation()}
                                onMouseDown={e => e.stopPropagation()}
                                className="text-white/60 hover:text-white font-semibold text-[9px] flex items-center gap-0.5 underline"
                            >
                                <FiClock size={10} /> Set
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onEditEstimate(task); }}
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            className="text-white/30 hover:text-white transition-colors ml-0.5"
                            title="Edit estimate"
                        >
                            <FiEdit3 size={10} />
                        </button>
                    </div>
                    <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                        <span className="text-white/40 text-[9px] uppercase font-semibold">Act:</span>
                        <span className="font-mono font-bold text-blue-300 text-[10px]">
                            {formatSeconds(actualSeconds)}
                        </span>
                    </div>
                </div>

                {/* Price if present */}
                {(details.unit || details.total_cost !== undefined) && (
                    <div className="flex items-center justify-between text-[9px] text-white/40 bg-white/[0.01] border border-white/[0.03] rounded-md px-2 py-0.5 mt-1">
                        {details.unit && <span>Unit: {details.unit}</span>}
                        {details.total_cost !== undefined && (
                            <span className="text-emerald-400 font-semibold ml-auto">
                                LKR {details.total_cost.toLocaleString()}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Compact Bottom Actions */}
            <div className="space-y-1 border-t border-white/[0.06] pt-1.5">
                {details.note && (
                    <button
                        type="button"
                        onClick={e => {
                            e.stopPropagation();
                            onViewNote(task, details.note);
                        }}
                        onPointerDown={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        className="w-full flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-amber-200 text-[9px] font-semibold py-0.5 px-2 rounded-md transition-colors cursor-pointer"
                    >
                        <FiInfo size={10} className="shrink-0" /> Note
                    </button>
                )}

                <div
                    className="flex items-center gap-1"
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                >
                    {task.status !== 'done' ? (
                        <button
                            type="button"
                            onClick={() => onPushReady(task)}
                            title="Push Task to Ready / Completed"
                            className="flex-1 flex items-center justify-center gap-1 bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold py-1 px-1.5 rounded-md transition-all cursor-pointer"
                        >
                            <FiCheck size={11} /> Ready
                        </button>
                    ) : (
                        <span className="flex-1 text-center text-emerald-400 font-semibold text-[10px] bg-emerald-500/10 border border-emerald-500/20 py-1 rounded-md inline-flex items-center justify-center gap-1">
                            <FiCheck size={11} /> Done
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => onViewLogs(task)}
                        title="View Work Logs"
                        className="p-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white rounded-md transition-colors cursor-pointer"
                    >
                        <FiClock size={11} />
                    </button>

                    <select
                        value={task.status || 'pending'}
                        onChange={e => onStatusChange(task, e.target.value)}
                        className="bg-black/60 border border-white/10 rounded-md px-1 py-1 text-[9px] text-white outline-none cursor-pointer focus:border-white/30 font-semibold max-w-[80px]"
                        style={{ color: STATUS_CFG[task.status || 'pending']?.accent || '#fff' }}
                    >
                        <option value="pending" style={{ color: STATUS_CFG.pending.accent }}>Pending</option>
                        <option value="in_progress" style={{ color: STATUS_CFG.in_progress.accent }}>Progress</option>
                        <option value="paused" style={{ color: STATUS_CFG.paused.accent }}>Paused</option>
                        <option value="done" style={{ color: STATUS_CFG.done.accent }}>Done</option>
                    </select>
                </div>
            </div>
        </div>
    );
}

const COLUMN_ACCENTS = [
    { avatar: 'from-purple-600/40 to-indigo-600/40 border-purple-500/30 text-purple-200', top: 'border-t-purple-500/50' },
    { avatar: 'from-emerald-600/40 to-teal-600/40 border-emerald-500/30 text-emerald-200', top: 'border-t-emerald-500/50' },
    { avatar: 'from-amber-600/40 to-orange-600/40 border-amber-500/30 text-amber-200', top: 'border-t-amber-500/50' },
    { avatar: 'from-blue-600/40 to-cyan-600/40 border-blue-500/30 text-blue-200', top: 'border-t-blue-500/50' },
    { avatar: 'from-rose-600/40 to-pink-600/40 border-rose-500/30 text-rose-200', top: 'border-t-rose-500/50' },
];

function DroppableColumn({
    id,
    label,
    tasks,
    activeId,
    allEmployeesList = [],
    columnIndex = 0,
    onStatusChange,
    onViewNote,
    onEditEstimate,
    onStartTimer,
    onStopTimer,
    onPushReady,
    onViewLogs,
    onReassignEmployee,
    onOpenWorkspace,
    subtitle
}) {
    const { isOver, setNodeRef } = useDroppable({ id });
    const isUnassigned = id === 'unassigned';

    const accent = COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length];

    const avatarStyle = isUnassigned
        ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
        : `bg-gradient-to-br ${accent.avatar}`;

    const columnTopBorder = isUnassigned ? 'border-t-white/10' : accent.top;

    const containerStyle = `w-[275px] shrink-0 flex flex-col border-t-2 ${columnTopBorder} bg-white/[0.01] border-x border-b rounded-2xl backdrop-blur-xl p-3 transition-all ${isOver ? 'border-white/40 bg-white/5 shadow-2xl' : 'border-white/[0.06]'
        }`;

    return (
        <div className={containerStyle}>
            <div className="flex justify-between items-start mb-2 pb-3 border-b border-white/[0.06]">
                <div className="min-w-0 flex-1">
                    <button
                        onClick={onOpenWorkspace}
                        className="text-sm font-bold text-white hover:text-indigo-300 transition-colors flex items-center gap-2 text-left cursor-pointer"
                    >
                        <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${avatarStyle}`}>
                            {label.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{label}</span>
                    </button>
                    <p className="text-[10px] text-white/40 mt-1 pl-9 truncate">{subtitle}</p>
                </div>

                {!isUnassigned && (
                    <button
                        onClick={onOpenWorkspace}
                        title={`Open ${label}'s Employee Task Page`}
                        className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all shrink-0 ml-2 cursor-pointer"
                    >
                        <FiExternalLink size={12} /> Task Page
                    </button>
                )}
            </div>

            <div
                ref={setNodeRef}
                className={`flex-1 flex flex-col gap-3 rounded-xl py-3 px-1.5 transition-all min-h-[360px] max-h-[560px] overflow-y-auto scrollbar-thin ${isOver ? 'bg-white/5 border-2 border-dashed border-white/30' : 'border border-transparent'
                    }`}
            >
                {tasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/30 text-xs italic py-16 text-center border-2 border-dashed border-white/5 rounded-xl">
                        <FiTarget className="w-5 h-5 text-white/30 mb-1" />
                        <span>Drag & Drop tasks here</span>
                        <span className="text-[10px] text-white/20 not-italic mt-1">to assign to {label}</span>
                    </div>
                ) : (
                    tasks.map(t => (
                        <DraggableTaskCard
                            key={t.id}
                            task={t}
                            isDragging={String(t.id) === activeId}
                            allEmployeesList={allEmployeesList}
                            onStatusChange={onStatusChange}
                            onViewNote={onViewNote}
                            onEditEstimate={onEditEstimate}
                            onStartTimer={onStartTimer}
                            onStopTimer={onStopTimer}
                            onPushReady={onPushReady}
                            onViewLogs={onViewLogs}
                            onReassignEmployee={onReassignEmployee}
                        />
                    ))
                )}
            </div>

            <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between items-center text-[10px] font-mono text-white/40 uppercase font-bold">
                <span>Assigned Tasks</span>
                <span className="px-2 py-0.5 bg-white/5 rounded-md text-white">{tasks.length}</span>
            </div>
        </div>
    );
}

function BacklogDrawer({
    tasks,
    isOpen,
    onToggle,
    activeId,
    allEmployeesList = [],
    onStatusChange,
    onViewNote,
    onEditEstimate,
    onStartTimer,
    onStopTimer,
    onPushReady,
    onViewLogs,
    onReassignEmployee
}) {
    const { isOver, setNodeRef } = useDroppable({ id: 'unassigned' });

    return (
        <div
            className={`shrink-0 flex transition-all duration-300 ${isOpen ? 'w-80' : 'w-12'
                } bg-[#0c0c16] border border-white/[0.06] rounded-2xl overflow-hidden backdrop-blur-xl flex-col`}
        >
            <button
                onClick={onToggle}
                className="w-full py-4 px-3 flex items-center justify-between border-b border-white/[0.06] text-xs font-bold text-white hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
                {isOpen ? (
                    <>
                        <span className="flex items-center gap-2">
                            <FiList className="text-amber-400" /> Pending Queue / Backlog
                        </span>
                        <FiChevronLeft className="w-4 h-4 text-white/40" />
                    </>
                ) : (
                    <div className="w-full flex flex-col items-center gap-4">
                        <FiChevronRight className="w-4 h-4 text-white/40" />
                        <FiList className="text-amber-400 w-5 h-5" />
                        <span className="text-[9px] font-mono tracking-widest uppercase writing-mode-vertical py-2">
                            Pending Queue
                        </span>
                    </div>
                )}
            </button>

            {isOpen && (
                <div
                    ref={setNodeRef}
                    className={`flex-1 flex flex-col gap-3 p-4 overflow-y-auto scrollbar-thin ${isOver ? 'bg-white/[0.04]' : ''
                        }`}
                >
                    <p className="text-[10px] text-white/40 mb-2">
                        Tasks waiting for scheduling. Select employee from dropdown or drag card onto an employee column.
                    </p>
                    {tasks.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-white/20 text-xs italic py-16 text-center">
                            Backlog is clean
                        </div>
                    ) : (
                        tasks.map(t => (
                            <DraggableTaskCard
                                key={t.id}
                                task={t}
                                isDragging={String(t.id) === activeId}
                                allEmployeesList={allEmployeesList}
                                onStatusChange={onStatusChange}
                                onViewNote={onViewNote}
                                onEditEstimate={onEditEstimate}
                                onStartTimer={onStartTimer}
                                onStopTimer={onStopTimer}
                                onPushReady={onPushReady}
                                onViewLogs={onViewLogs}
                                onReassignEmployee={onReassignEmployee}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default function ServicePlanningPage({ params }) {
    const { id } = use(params);
    const router = useRouter();

    const [service, setService] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('kanban');
    const [activeId, setActiveId] = useState(null);
    const [syncState, setSyncState] = useState('saved'); // 'saving' | 'saved'


    // Modal & Workspace states
    const [noteModal, setNoteModal] = useState(null);
    const [backlogOpen, setBacklogOpen] = useState(true);
    const [estimateModal, setEstimateModal] = useState({ isOpen: false, task: null, value: '' });
    const [workLogsModal, setWorkLogsModal] = useState({ isOpen: false, task: null });
    const [manageEmployeesModalOpen, setManageEmployeesModalOpen] = useState(false);

    // Action modals
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [quoteModalOpen, setQuoteModalOpen] = useState(false);
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [promoteModal, setPromoteModal] = useState(null);
    const [convertModal, setConvertModal] = useState(null);
    const [convertingProgress, setConvertingProgress] = useState({ visible: false, pct: 0, label: '' });

    // Modal form states
    const [taskForm, setTaskForm] = useState({
        task_name: '',
        customer_name: '',
        notes: '',
        estimated_minutes: '',
        assigned_to: ''
    });

    const [quoteForm, setQuoteForm] = useState({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        customer_address: '',
        tax_mode: 'none',
        tax_percentage: 0,
        terms_and_conditions: '',
        items: [{ item_name: '', quantity: 1, unit_price: 0 }]
    });

    const [invoiceForm, setInvoiceForm] = useState({
        customer_name: '',
        description: '',
        amount_due: '',
        due_date: '',
        notes: ''
    });

    const [promoteForm, setPromoteForm] = useState({
        due_date: '',
        notes: ''
    });

    // Filter states
    const [reportEmployee, setReportEmployee] = useState('');
    const [timeRange, setTimeRange] = useState('all');

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const loadData = useCallback(async (isInitial = false) => {
        if (isInitial) {
            setLoading(true);
        } else {
            setSyncState('saving');
        }
        setError(null);
        try {
            const res = await fetch(`/api/services/${id}/planning`);
            if (!res.ok) throw new Error('Failed to load planning data');
            const data = await res.json();
            setService(data.service);
            setTasks(data.tasks || []);
            setQuotations(data.quotations || []);
            setInvoices(data.invoices || []);
        } catch (e) {
            console.error(e);
            if (isInitial) setError(e.message);
        } finally {
            if (isInitial) setLoading(false);
            setSyncState('saved');
        }
    }, [id]);

    useEffect(() => {
        loadData(true);
    }, [loadData]);

    // Live timer pulse update every second
    useEffect(() => {
        const interval = setInterval(() => {
            setTasks(prev => prev.map(t => {
                if (t.is_running && t.work_logs && t.work_logs.length > 0) {
                    const activeLog = t.work_logs.find(l => !l.stopped_at);
                    if (activeLog && activeLog.started_at) {
                        const startMs = new Date(activeLog.started_at).getTime();
                        const nowMs = Date.now();
                        const currentSessionSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));

                        const prevSessionsSecs = t.work_logs
                            .filter(l => l.stopped_at)
                            .reduce((acc, l) => acc + (l.duration_seconds || 0), 0);

                        return {
                            ...t,
                            actual_seconds: prevSessionsSecs + currentSessionSecs,
                            actual_minutes: Math.round((prevSessionsSecs + currentSessionSecs) / 60)
                        };
                    }
                }
                return t;
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleStatusChange = async (task, newStatus) => {
        setTasks(prev => prev.map(t => t.id === task.id ? {
            ...t,
            status: newStatus,
            completed_at: newStatus === 'done' ? new Date().toISOString() : t.completed_at,
            started_at: newStatus === 'in_progress' ? new Date().toISOString() : t.started_at
        } : t));

        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    completed_at: newStatus === 'done' ? new Date().toISOString() : null
                }),
            });
            if (!res.ok) throw new Error('Failed to update status');
            toast.success(`Task status updated to ${STATUS_CFG[newStatus]?.label || newStatus}`);
            loadData(false);
        } catch (e) {
            console.error(e);
            toast.error('Failed to update task status');
            loadData(false);
        }
    };

    const handleStartTimer = async (task, empName) => {
        const targetEmp = empName || task.assigned_to;
        if (!targetEmp) {
            toast.error('Please assign an employee to this task first!');
            return;
        }
        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', employee_name: targetEmp }),
            });
            if (!res.ok) throw new Error('Failed to start timer');
            toast.success(`Timer started for ${targetEmp}`);
            loadData(false);
        } catch (err) {
            toast.error(err.message || 'Error starting timer');
        }
    };

    const handleStopTimer = async (task) => {
        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop' }),
            });
            if (!res.ok) throw new Error('Failed to stop timer');
            toast.success('Timer stopped & work log recorded');
            loadData(false);
        } catch (err) {
            toast.error(err.message || 'Error stopping timer');
        }
    };

    const handlePushReady = async (task) => {
        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'ready' }),
            });
            if (!res.ok) throw new Error('Failed to mark task ready');
            toast.success('Task pushed to Ready!');
            loadData(false);
        } catch (err) {
            toast.error(err.message || 'Error marking task ready');
        }
    };

    const handleSaveEstimate = async (e) => {
        e.preventDefault();
        const { task, value } = estimateModal;
        if (!task) return;
        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_estimate', estimated_minutes: value }),
            });
            if (!res.ok) throw new Error('Failed to set estimate');
            toast.success('Estimated time updated!');
            setEstimateModal({ isOpen: false, task: null, value: '' });
            loadData(false);
        } catch (err) {
            toast.error(err.message || 'Error setting estimate');
        }
    };

    const handleReassignEmployee = async (task, targetEmployee) => {
        const serviceName = service ? service.name : extractServiceName(task.name);
        const updatedName = targetEmployee ? `Service: ${serviceName} — ${targetEmployee}` : `Service: ${serviceName}`;

        setTasks(prev => prev.map(t => t.id === task.id ? {
            ...t,
            assigned_to: targetEmployee || null,
            name: updatedName
        } : t));

        try {
            const orderId = task.sales_order_id || 'manual';
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assigned_to: targetEmployee || null,
                    name: updatedName
                }),
            });
            if (!res.ok) throw new Error('Failed to update employee assignment');
            toast.success(targetEmployee ? `Assigned to ${targetEmployee}` : 'Moved to Pending Queue');
            loadData(false);
        } catch (e) {
            console.error(e);
            toast.error('Failed to update task assignment');
            loadData(false);
        }
    };

    const handleDragEnd = async ({ active, over }) => {
        setActiveId(null);
        if (!over || !active) return;

        const taskId = parseInt(active.id);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const targetContainer = over.id;
        const targetEmployee = targetContainer === 'unassigned' ? null : targetContainer;

        if (task.assigned_to === targetEmployee) return;

        await handleReassignEmployee(task, targetEmployee);
    };

    // Sub-Company POST actions
    const handleAddTask = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/services/${id}/planning`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_task',
                    ...taskForm
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success('Manual task added successfully');
            setTaskModalOpen(false);
            setTaskForm({ task_name: '', customer_name: '', notes: '', estimated_minutes: '', assigned_to: '' });
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to add manual task');
        }
    };

    const handleCreateQuotation = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/services/${id}/planning`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_quotation',
                    ...quoteForm
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success(`Quotation ${data.code} created!`);
            setQuoteModalOpen(false);
            setQuoteForm({
                customer_name: '', customer_phone: '', customer_email: '', customer_address: '',
                tax_mode: 'none', tax_percentage: 0, terms_and_conditions: '',
                items: [{ item_name: '', quantity: 1, unit_price: 0 }]
            });
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to create quotation');
        }
    };

    const handleConvertToSalesOrder = async (quote) => {
        setConvertModal(null);
        setConvertingProgress({ visible: true, pct: 15, label: 'Reading quotation items…' });

        const steps = [
            { pct: 45, label: 'Creating Sales Order…' },
            { pct: 75, label: 'Generating pending tasks for planning queue…' },
            { pct: 90, label: 'Finalizing order & notifications…' }
        ];

        let i = 0;
        const interval = setInterval(() => {
            if (i < steps.length) {
                setConvertingProgress({ visible: true, ...steps[i] });
                i++;
            }
        }, 350);

        try {
            const res = await fetch('/api/sales-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quotation_id: quote.id,
                    auto_deduct_stock: false
                })
            });
            const data = await res.json();
            clearInterval(interval);

            if (res.ok) {
                setConvertingProgress({ visible: true, pct: 100, label: 'Tasks added to pending queue!' });
                await new Promise(r => setTimeout(r, 600));
                setConvertingProgress({ visible: false, pct: 0, label: '' });
                toast.success('Sales Order created! Tasks added to pending queue.');
                loadData();
            } else {
                setConvertingProgress({ visible: false, pct: 0, label: '' });
                toast.error(data.message || data.error || 'Failed to convert quotation');
            }
        } catch {
            clearInterval(interval);
            setConvertingProgress({ visible: false, pct: 0, label: '' });
            toast.error('Error converting quotation to Sales Order');
        }
    };

    const handleDuplicateQuote = async (quoteId) => {
        try {
            const res = await fetch(`/api/services/${id}/quotations/${quoteId}/duplicate`, {
                method: 'POST',
            });
            const d = await res.json();
            if (res.ok) {
                toast.success(d.message || `Quotation duplicated as ${d.code}`);
                loadData();
            } else {
                toast.error(d.error || 'Failed to duplicate quotation');
            }
        } catch {
            toast.error('Error duplicating quotation');
        }
    };

    const handleCreateInvoice = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/services/${id}/planning`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_invoice',
                    ...invoiceForm
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success(`Invoice ${data.code} generated!`);
            setInvoiceModalOpen(false);
            setInvoiceForm({ customer_name: '', description: '', amount_due: '', due_date: '', notes: '' });
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to create invoice');
        }
    };

    const allEmployeesList = useMemo(() => {
        if (!service) return [];
        return service.employees ? service.employees.map(e => e.employee_name) : [];
    }, [service]);

    const tasksByEmployee = useMemo(() => {
        const map = { unassigned: [] };
        allEmployeesList.forEach(emp => { map[emp] = []; });

        tasks.forEach(t => {
            const emp = t.assigned_to;
            if (emp && map[emp]) {
                map[emp].push(t);
            } else {
                map.unassigned.push(t);
            }
        });

        return map;
    }, [tasks, allEmployeesList]);

    // Summary KPIs
    const kpis = useMemo(() => {
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'done').length;
        const active = tasks.filter(t => t.status === 'in_progress').length;
        const unassigned = tasksByEmployee.unassigned.length;

        let estMins = 0;
        let actualSecs = 0;
        tasks.forEach(t => {
            estMins += parseInt(t.estimated_minutes || 0);
            actualSecs += parseInt(t.actual_seconds || 0);
        });

        return {
            total,
            done,
            active,
            unassigned,
            estHours: (estMins / 60).toFixed(1),
            actualHours: (actualSecs / 3600).toFixed(1),
        };
    }, [tasks, tasksByEmployee]);

    // Detailed Multi-Employee Reports
    const employeeReports = useMemo(() => {
        const map = {};
        allEmployeesList.forEach(emp => {
            map[emp] = {
                name: emp,
                completedCount: 0,
                activeCount: 0,
                totalSecsLogged: 0,
                tasksWorked: new Set(),
            };
        });

        tasks.forEach(t => {
            if (t.assigned_to && map[t.assigned_to]) {
                if (t.status === 'done') map[t.assigned_to].completedCount++;
                else map[t.assigned_to].activeCount++;
            }
            if (t.work_logs) {
                t.work_logs.forEach(l => {
                    if (map[l.employee_name]) {
                        map[l.employee_name].totalSecsLogged += (l.duration_seconds || 0);
                        map[l.employee_name].tasksWorked.add(t.id);
                    }
                });
            }
        });

        return Object.values(map);
    }, [allEmployeesList, tasks]);

    const filteredLogs = useMemo(() => {
        const logsList = [];
        tasks.forEach(t => {
            if (t.work_logs) {
                t.work_logs.forEach(l => {
                    if (reportEmployee && l.employee_name !== reportEmployee) return;
                    logsList.push({
                        ...l,
                        task_id: t.id,
                        task_name: t.name,
                        customer_name: t.customer_name,
                        order_code: t.order_code || t.sales_order_id,
                    });
                });
            }
        });
        return logsList;
    }, [tasks, reportEmployee]);

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-[#09090b]">
            <div className={`w-8 h-8 border-2 ${theme.borderAccent} ${theme.spinner} rounded-full animate-spin`} />
        </div>
    );

    if (error || !service) return (
        <div className="flex items-center justify-center h-screen bg-[#09090b] text-white">
            <div className="text-center">
                <p className="text-rose-400 mb-4">{error || 'Service not found'}</p>
                <button onClick={() => router.push('/dashboard/services')} className="px-4 py-2 bg-white/10 rounded-xl text-sm">Back to Services</button>
            </div>
        </div>
    );

    return (
        <div className={`min-h-screen ${theme.container}`}>
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-white/[0.08] pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        {/* <span className={`px-2.5 py-1 rounded-lg ${theme.subCompanyBadge} font-mono text-xs font-semibold uppercase tracking-wider`}>
                            Sub-Company Portal
                        </span> */}
                        <h1 className="text-2xl font-bold tracking-tight text-white">{service.name}</h1>
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                        Service ID #{id} · Multi-Employee Task Planning &amp; Productivity Center
                    </p>
                </div>

                {/* Top Action Toolbar */}
                <div className="flex items-center gap-3">
                    {/* Sync Status Badge */}
                    {syncState === 'saving' ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                            <span>Saving...</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold">
                            <FiCheck size={13} className="text-emerald-400" />
                            <span>Saved</span>
                        </div>
                    )}

                    {/* <button
                        onClick={() => setManageEmployeesModalOpen(true)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <FiUsers className="text-amber-400" /> Edit Employees
                    </button>
                    <button
                        onClick={() => setTaskModalOpen(true)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <FiPlus className={theme.iconAccent} /> Manual Task
                    </button>
                    <button
                        onClick={() => setQuoteModalOpen(true)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <FiPlusCircle className="text-emerald-400" /> New Quotation
                    </button>
                    <button
                        onClick={() => setInvoiceModalOpen(true)}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <FiDollarSign className="text-blue-400" /> Issue Invoice
                    </button>


                    <Link
                        href={`/services/${id}/portal`}
                        className={`px-4 py-2 ${theme.btnSecondary} rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors`}
                    >
                        <FiExternalLink /> Open Portal
                    </Link> */}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="flex flex-wrap gap-4">
                <StatPill label="Total Tasks" value={kpis.total} accent="#818cf8" icon={FiList} />
                <StatPill label="Pending Queue" value={kpis.unassigned} accent="#f59e0b" icon={FiClock} />
                <StatPill label="Est. Hours" value={`${kpis.estHours} hrs`} accent="#3b82f6" icon={FiBarChart2} />
                <StatPill label="Actual Worked" value={`${kpis.actualHours} hrs`} accent="#8b5cf6" icon={FiUsers} />
                <StatPill label="Ready / Done" value={kpis.done} accent="#10b981" icon={FiCheckCircle} />
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/[0.08] gap-6 text-sm font-semibold">
                <button
                    onClick={() => setTab('kanban')}
                    className={`pb-3 transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${tab === 'kanban' ? theme.activeTab : 'border-transparent text-white/40 hover:text-white/70'
                        }`}
                >
                    <FiList /> Task Planning Board
                </button>
                {/* <button
                    onClick={() => setTab('quotations')}
                    className={`pb-3 transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${tab === 'quotations' ? theme.activeTab : 'border-transparent text-white/40 hover:text-white/70'
                        }`}
                >
                    <FiFileText /> Quotations ({quotations.length})
                </button> */}
                <button
                    onClick={() => setTab('reports')}
                    className={`pb-3 transition-colors border-b-2 flex items-center gap-2 cursor-pointer ${tab === 'reports' ? theme.activeTab : 'border-transparent text-white/40 hover:text-white/70'
                        }`}
                >
                    <FiBarChart2 /> Multi-Employee Time Analysis &amp; Reports
                </button>
            </div>

            {/* TAB CONTENTS */}
            <div>
                {/* ─── TAB 1: KANBAN PLANNING BOARD ─── */}
                {tab === 'kanban' && (
                    <div>
                        <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd}>
                            <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin min-h-[600px]">
                                {/* Backlog Drawer */}
                                <BacklogDrawer
                                    tasks={(tasksByEmployee.unassigned || []).filter(t => t.status !== 'done')}
                                    isOpen={backlogOpen}
                                    onToggle={() => setBacklogOpen(!backlogOpen)}
                                    activeId={activeId}
                                    allEmployeesList={allEmployeesList}
                                    onStatusChange={handleStatusChange}
                                    onViewNote={(t, note) => setNoteModal({ task: t, note })}
                                    onEditEstimate={t => setEstimateModal({ isOpen: true, task: t, value: t.estimated_minutes || '' })}
                                    onStartTimer={handleStartTimer}
                                    onStopTimer={handleStopTimer}
                                    onPushReady={handlePushReady}
                                    onViewLogs={t => setWorkLogsModal({ isOpen: true, task: t })}
                                    onReassignEmployee={handleReassignEmployee}
                                />

                                {/* Employee Columns */}
                                {allEmployeesList.map((emp, idx) => (
                                    <DroppableColumn
                                        key={emp}
                                        id={emp}
                                        label={emp}
                                        subtitle="Assigned tasks"
                                        tasks={(tasksByEmployee[emp] || []).filter(t => t.status !== 'done')}
                                        activeId={activeId}
                                        allEmployeesList={allEmployeesList}
                                        columnIndex={idx}
                                        onStatusChange={handleStatusChange}
                                        onViewNote={(t, note) => setNoteModal({ task: t, note })}
                                        onEditEstimate={t => setEstimateModal({ isOpen: true, task: t, value: t.estimated_minutes || '' })}
                                        onStartTimer={handleStartTimer}
                                        onStopTimer={handleStopTimer}
                                        onPushReady={handlePushReady}
                                        onViewLogs={t => setWorkLogsModal({ isOpen: true, task: t })}
                                        onReassignEmployee={handleReassignEmployee}
                                        onOpenWorkspace={() => router.push(`/services/${id}/planning/employees/${encodeURIComponent(emp)}`)}
                                    />
                                ))}
                            </div>
                        </DndContext>

                        {/* Completed Tasks Section */}
                        {tasks.filter(t => t.status === 'done').length > 0 && (
                            <div className="mt-8 bg-white/[0.01] border border-emerald-500/20 rounded-2xl p-5">
                                <div className="flex items-center gap-3 mb-4">
                                    <FiCheckCircle className="text-emerald-400 w-5 h-5" />
                                    <h3 className="text-sm font-bold text-white">Completed Tasks</h3>
                                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md">
                                        {tasks.filter(t => t.status === 'done').length}
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/[0.06] text-white/40 text-[11px] uppercase tracking-wider">
                                                <th className="py-2 px-3">Task</th>
                                                <th className="py-2 px-3">Customer</th>
                                                <th className="py-2 px-3">Employee</th>
                                                <th className="py-2 px-3 text-center">Est.</th>
                                                <th className="py-2 px-3 text-center">Actual</th>
                                                <th className="py-2 px-3 text-center">Completed</th>
                                                <th className="py-2 px-3 text-center">Logs</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04]">
                                            {tasks.filter(t => t.status === 'done').map(t => {
                                                const details = parseDescription(t.description);
                                                const title = !t.sales_order_id
                                                    ? (details.note ? details.note.split(' - ')[0] : 'Manual Task')
                                                    : extractJobName(t.name);
                                                const estMins = parseInt(t.estimated_minutes || 0);
                                                const actSecs = parseInt(t.actual_seconds || 0);
                                                const actMins = Math.round(actSecs / 60);
                                                return (
                                                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="py-2.5 px-3 font-semibold text-white">
                                                            {title}
                                                            <div className="text-[10px] font-mono text-white/30">
                                                                {t.sales_order_id ? `SO #${t.order_code || t.sales_order_id}` : 'Manual'}
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-white/60 text-xs">{t.customer_name || '—'}</td>
                                                        <td className="py-2.5 px-3">
                                                            <span className="text-xs bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-md text-white/70">
                                                                {t.assigned_to || 'Unassigned'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center font-mono text-xs text-amber-300">
                                                            {estMins > 0 ? formatMinutes(estMins) : '—'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center font-mono text-xs text-emerald-300">
                                                            {actMins > 0 ? formatMinutes(actMins) : '—'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center text-[10px] text-white/40">
                                                            {t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-GB') : '—'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center">
                                                            <button
                                                                onClick={() => setWorkLogsModal({ isOpen: true, task: t })}
                                                                className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                                                            >
                                                                View Logs
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── TAB 2: QUOTATIONS LIST ─── */}
                {tab === 'quotations' && (
                    <div className="bg-white/[0.01] border border-white/[0.06] rounded-2xl backdrop-blur-xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold">Service Quotations</h3>
                                <p className="text-xs text-white/40 mt-1">Quotations created for this service sub-company.</p>
                            </div>
                            <button
                                onClick={() => setQuoteModalOpen(true)}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-colors cursor-pointer"
                            >
                                <FiPlusCircle /> Create Custom Quotation
                            </button>
                        </div>

                        {quotations.length === 0 ? (
                            <div className="py-16 text-center text-white/20 text-sm italic">No quotations issued yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-white/[0.08] text-white/40 text-[11px] uppercase tracking-wider">
                                            <th className="py-3 px-4">Quote #</th>
                                            <th className="py-3 px-4">Customer</th>
                                            <th className="py-3 px-4">Date</th>
                                            <th className="py-3 px-4 text-right">Amount</th>
                                            <th className="py-3 px-4 text-center">Status</th>
                                            <th className="py-3 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {quotations.map(q => (
                                            <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-3.5 px-4 font-mono font-bold text-white">
                                                    <Link href={`/services/${id}/portal/quotations/${q.id}`} className={`underline hover:opacity-85 ${theme.textAccent}`}>
                                                        {q.code || `#${q.id}`}
                                                    </Link>
                                                </td>
                                                <td className="py-3.5 px-4 text-white/80">{q.customer_name}</td>
                                                <td className="py-3.5 px-4 text-white/40 text-xs">{new Date(q.created_at).toLocaleDateString()}</td>
                                                <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                                                    LKR {parseFloat(q.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${q.status === 'converted' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                                        }`}>
                                                        {q.status}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-right space-x-2">
                                                    <Link
                                                        href={`/services/${id}/portal/quotations/${q.id}`}
                                                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 transition-colors"
                                                    >
                                                        View
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDuplicateQuote(q.id)}
                                                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-blue-300 transition-colors cursor-pointer"
                                                    >
                                                        Duplicate
                                                    </button>
                                                    {q.status !== 'converted' && (
                                                        <button
                                                            onClick={() => setConvertModal(q)}
                                                            className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 rounded-lg text-xs font-semibold text-indigo-200 transition-colors cursor-pointer"
                                                        >
                                                            Convert to SO
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── TAB 3: MULTI-EMPLOYEE TIME ANALYSIS & REPORTS ─── */}
                {tab === 'reports' && (
                    <div className="space-y-8">
                        {/* Task Time Variance & Multi-Employee Breakdown */}
                        <div className="bg-white/[0.01] border border-white/[0.06] rounded-2xl backdrop-blur-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold">Task Estimated vs. Actual Time Analysis</h3>
                                    <p className="text-xs text-white/40 mt-1">
                                        Track cumulative time logged across multiple employees per task against estimated duration.
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-white/[0.08] text-white/40 text-[11px] uppercase tracking-wider">
                                            <th className="py-3 px-4">Task Name &amp; Code</th>
                                            <th className="py-3 px-4">Customer</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-center">Est. Time</th>
                                            <th className="py-3 px-4 text-center">Actual Worked</th>
                                            <th className="py-3 px-4 text-center">Variance</th>
                                            <th className="py-3 px-4 text-right">Work History</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {tasks.length === 0 ? (
                                            <tr><td colSpan={7} className="py-12 text-center text-white/20 text-xs">No tasks recorded</td></tr>
                                        ) : (
                                            tasks.map(t => {
                                                const estMins = parseInt(t.estimated_minutes || 0);
                                                const actSecs = parseInt(t.actual_seconds || 0);
                                                const actMins = Math.round(actSecs / 60);
                                                const diffMins = estMins > 0 ? actMins - estMins : 0;

                                                return (
                                                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="py-3.5 px-4 font-bold text-white">
                                                            {extractJobName(t.name) || t.name}
                                                            <div className="text-[10px] font-mono text-white/40 font-normal">
                                                                {t.sales_order_id ? `SO #${t.order_code || t.sales_order_id}` : 'Manual Task'}
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-white/80">{t.customer_name || 'Internal'}</td>
                                                        <td className="py-3.5 px-4">
                                                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase" style={{ color: STATUS_CFG[t.status]?.accent }}>
                                                                {STATUS_CFG[t.status]?.label || t.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-300">
                                                            {estMins > 0 ? `${estMins}m` : '—'}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-300">
                                                            {formatSeconds(actSecs)}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-center font-mono text-xs">
                                                            {estMins === 0 ? (
                                                                <span className="text-white/30">—</span>
                                                            ) : diffMins > 0 ? (
                                                                <span className="text-amber-400 font-bold">+{diffMins}m (Over)</span>
                                                            ) : (
                                                                <span className="text-emerald-400 font-bold">{diffMins}m (Under)</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3.5 px-4 text-right">
                                                            <button
                                                                onClick={() => setWorkLogsModal({ isOpen: true, task: t })}
                                                                className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                                                            >
                                                                View Session Logs
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Employee Summary Breakdown */}
                        <div className="bg-white/[0.01] border border-white/[0.06] rounded-2xl backdrop-blur-xl p-6">
                            <h3 className="text-lg font-bold mb-4">Employee Hours &amp; Work Productivity</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {employeeReports.map(rep => (
                                    <div key={rep.name} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-white">{rep.name}</span>
                                            <span className="text-xs font-mono text-purple-400 font-bold">{rep.tasksWorked.size} Tasks Worked</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-white/50 pt-2 border-t border-white/[0.04]">
                                            <span>Completed Tasks: <strong className="text-emerald-400">{rep.completedCount}</strong></span>
                                            <span>Active: <strong className="text-blue-400">{rep.activeCount}</strong></span>
                                        </div>
                                        <div className="text-xs text-white/40 font-mono pt-1">
                                            Total Time Logged: <strong className="text-white">{formatSeconds(rep.totalSecsLogged)}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── ESTIMATE TIME MODAL ─── */}
            {estimateModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
                    <form onSubmit={handleSaveEstimate} className="bg-[#0c0c16] border border-white/10 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <FiClock className="text-amber-400" /> Set Estimated Time
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEstimateModal({ isOpen: false, task: null, value: '' })}
                                className="text-white/40 hover:text-white"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-white/50">
                            Task: <span className="text-white font-bold">{estimateModal.task?.name}</span>
                        </p>

                        <div>
                            <label className="block text-xs text-gray-400 mb-1.5 font-semibold">Estimated Time (Minutes)</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={estimateModal.value}
                                onChange={e => setEstimateModal(prev => ({ ...prev, value: e.target.value }))}
                                placeholder="e.g. 45"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        {/* Presets */}
                        <div className="flex gap-2 text-xs">
                            {[15, 30, 45, 60, 120].map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setEstimateModal(prev => ({ ...prev, value: String(m) }))}
                                    className="flex-1 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 text-center font-mono cursor-pointer"
                                >
                                    {m}m
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setEstimateModal({ isOpen: false, task: null, value: '' })}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-semibold text-white shadow-lg cursor-pointer"
                            >
                                Save Estimate
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ─── WORK LOGS HISTORY MODAL ─── */}
            {workLogsModal.isOpen && workLogsModal.task && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
                    <div className="bg-[#0c0c16] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-center border-b border-white/[0.08] pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <FiClock className="text-blue-400" /> Multi-Employee Work Sessions
                                </h3>
                                <p className="text-xs text-white/40 mt-0.5">{workLogsModal.task.name}</p>
                            </div>
                            <button
                                onClick={() => setWorkLogsModal({ isOpen: false, task: null })}
                                className="text-white/40 hover:text-white"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                            <div>
                                <span className="text-white/40 uppercase">Est. Minutes</span>
                                <div className="font-mono font-bold text-amber-300 text-sm mt-0.5">
                                    {workLogsModal.task.estimated_minutes ? `${workLogsModal.task.estimated_minutes} min` : 'Not set'}
                                </div>
                            </div>
                            <div>
                                <span className="text-white/40 uppercase">Total Worked</span>
                                <div className="font-mono font-bold text-blue-300 text-sm mt-0.5">
                                    {formatSeconds(workLogsModal.task.actual_seconds || 0)}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            <h4 className="text-xs font-bold text-white/60 uppercase">Session History</h4>
                            {!workLogsModal.task.work_logs || workLogsModal.task.work_logs.length === 0 ? (
                                <div className="py-8 text-center text-white/20 text-xs italic">No logged sessions yet.</div>
                            ) : (
                                workLogsModal.task.work_logs.map((log, idx) => (
                                    <div key={log.id || idx} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 text-xs flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-white">{log.employee_name}</div>
                                            <div className="text-[10px] text-white/40 mt-0.5">
                                                {new Date(log.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {' → '}
                                                {log.stopped_at ? new Date(log.stopped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Running...'}
                                            </div>
                                        </div>
                                        <div className="font-mono font-bold text-purple-300">
                                            {log.stopped_at ? formatSeconds(log.duration_seconds) : '● Active'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end border-t border-white/[0.08] pt-3">
                            <button
                                onClick={() => setWorkLogsModal({ isOpen: false, task: null })}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-white cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── ADD MANUAL TASK MODAL ─── */}
            {taskModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
                    <form onSubmit={handleAddTask} className="bg-[#0c0c16] border border-white/10 rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl flex flex-col">
                        <header className="flex justify-between items-center px-6 py-4 border-b border-white/[0.08] bg-white/[0.01]">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <FiPlus className="text-purple-400" /> Add Manual Task
                            </h3>
                            <button type="button" onClick={() => setTaskModalOpen(false)} className="p-1 text-white/60 hover:text-white cursor-pointer">
                                <FiX className="w-5 h-5" />
                            </button>
                        </header>

                        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[60vh]">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 font-semibold">Task Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={taskForm.task_name}
                                    onChange={e => setTaskForm(prev => ({ ...prev, task_name: e.target.value }))}
                                    placeholder="e.g. Logo Design, Custom Setup"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 font-semibold">Customer Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={taskForm.customer_name}
                                    onChange={e => setTaskForm(prev => ({ ...prev, customer_name: e.target.value }))}
                                    placeholder="e.g. Client Name"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 font-semibold">Assign Employee (Optional)</label>
                                <select
                                    value={taskForm.assigned_to}
                                    onChange={e => setTaskForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30"
                                >
                                    <option value="">Pending Queue (Unassigned)</option>
                                    {allEmployeesList.map(emp => (
                                        <option key={emp} value={emp}>{emp}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 font-semibold">Estimated Minutes</label>
                                <input
                                    type="number"
                                    value={taskForm.estimated_minutes}
                                    onChange={e => setTaskForm(prev => ({ ...prev, estimated_minutes: e.target.value }))}
                                    placeholder="e.g. 45"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-white/30"
                                />
                            </div>
                        </div>

                        <footer className="px-6 py-3.5 border-t border-white/[0.08] bg-white/[0.01] flex justify-end gap-2.5">
                            <button type="button" onClick={() => setTaskModalOpen(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-white">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-purple-600 rounded-xl text-xs font-semibold text-white shadow-lg">Add Task</button>
                        </footer>
                    </form>
                </div>
            )}

            {/* ─── CONVERT TO SO PROGRESS OVERLAY ─── */}
            {convertingProgress.visible && (
                <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-lg flex items-center justify-center">
                    <div className="bg-[#0f0f0f]/95 border border-white/10 rounded-2xl p-10 w-80 shadow-2xl text-center">
                        <div className="flex items-center justify-center mb-5">
                            <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin flex items-center justify-center" />
                        </div>
                        <div className="text-white font-bold text-base mb-1">Creating Sales Order</div>
                        <div className="text-gray-500 text-sm mb-6">{convertingProgress.label}</div>
                        <div className="bg-white/8 rounded-full h-1.5 overflow-hidden mb-2">
                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-400" style={{ width: `${convertingProgress.pct}%` }} />
                        </div>
                        <div className="text-gray-600 text-xs">{convertingProgress.pct}%</div>
                    </div>
                </div>
            )}

            {/* ─── CONVERT TO SO CONFIRMATION MODAL ─── */}
            {convertModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-lg font-bold text-white mb-2">Convert Quotation to Sales Order</h2>
                        <p className="text-xs text-gray-400 mb-6">
                            Quotation {convertModal.code} for <strong className="text-white">{convertModal.customer_name}</strong> will create a Sales Order and push items to the <span className="text-amber-300 font-bold">Pending Planning Queue</span>.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConvertModal(null)} className="px-4 py-2 bg-white/5 rounded-xl text-sm font-semibold text-gray-300">Cancel</button>
                            <button onClick={() => handleConvertToSalesOrder(convertModal)} className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-semibold text-white shadow-lg">Confirm &amp; Convert</button>
                        </div>
                    </div>
                </div>
            )}

            {/* TASK NOTE VIEW MODAL */}
            {noteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center border-b border-white/[0.08] pb-3 mb-4">
                            <h3 className="text-sm font-bold text-white">Task Note</h3>
                            <button onClick={() => setNoteModal(null)} className="text-white/40 hover:text-white"><FiX size={18} /></button>
                        </div>
                        <p className="text-xs text-amber-200 whitespace-pre-wrap leading-relaxed bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                            {noteModal.note}
                        </p>
                    </div>
                </div>
            )}

            {/* EDIT EMPLOYEES MODAL */}
            <ManageEmployeesModal
                isOpen={manageEmployeesModalOpen}
                onClose={() => setManageEmployeesModalOpen(false)}
                serviceId={id}
                onSaved={() => loadData(false)}
            />
        </div>
    );
}
