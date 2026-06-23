'use client';
import toast from 'react-hot-toast';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiPrinter, FiSave, FiCheckCircle, FiDownload, FiPlus, FiTrash2, FiExternalLink, FiChevronDown, FiChevronUp, FiLayers, FiCpu, FiActivity, FiLink, FiMenu } from 'react-icons/fi';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from '@/components/ui/Button';
import ImpositionVisualizer from '@/app/dashboard/items/components/ImpositionVisualizer';

function SortableTaskItem({ task, idx }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined };

    const statusColor = task.status === 'done' ? 'border-white/60 bg-white/10 text-white'
        : task.status === 'in_progress' ? 'border-white/30 bg-white/[0.05] text-white/70'
        : 'border-white/[0.10] bg-transparent text-white/30';

    return (
        <div ref={setNodeRef} style={style} className={`flex items-start gap-4 ${isDragging ? 'opacity-50' : ''}`}>
            {/* Step node */}
            <div className={`relative z-10 shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border ${statusColor}`}>
                {task.status === 'done' ? <FiCheckCircle className="w-4 h-4" /> : idx + 1}
            </div>
            {/* Card */}
            <div className="flex-1 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] rounded-xl px-4 py-3 transition-colors">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${task.status === 'done' ? 'line-through text-white/40' : 'text-white'}`}>{task.name}</p>
                        {task.description && <p className="text-xs text-white/25 mt-0.5 truncate">{task.description}</p>}
                        {task.machine_name && <p className="text-[11px] text-white/20 mt-0.5">{task.machine_name}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            task.status === 'done' ? 'bg-white/[0.06] text-white/50 border-white/[0.10]' :
                            task.status === 'in_progress' ? 'bg-white/[0.04] text-white/40 border-white/[0.07]' :
                            'bg-transparent text-white/20 border-white/[0.06]'
                        }`}>{task.status?.replace('_', ' ')}</span>
                        {/* Drag handle */}
                        <button {...attributes} {...listeners}
                            className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.05] cursor-grab active:cursor-grabbing transition-colors touch-none">
                            <FiMenu className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SalesOrderDetailPage({ params }) {

    const { id } = use(params);
    const router = useRouter();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [newTaskName, setNewTaskName] = useState('');
    const [addingTask, setAddingTask] = useState(false);
    const [generatingTasks, setGeneratingTasks] = useState(false);
    const [showBOM, setShowBOM] = useState(true);
    const [showRouting, setShowRouting] = useState(true);
    const [showTimeline, setShowTimeline] = useState(true);
    const [linkCopied, setLinkCopied] = useState(false);
    const [showAllTasks, setShowAllTasks] = useState(false);
    const TASK_PREVIEW = 5;

    const publicTimelineUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/timeline/${id}` : '';

    const copyLink = () => {
        navigator.clipboard.writeText(publicTimelineUrl);
        setLinkCopied(true);
        toast.success('Link copied!');
        setTimeout(() => setLinkCopied(false), 2500);
    };

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIdx = tasks.findIndex(t => t.id === active.id);
        const newIdx = tasks.findIndex(t => t.id === over.id);
        const reordered = arrayMove(tasks, oldIdx, newIdx);
        setTasks(reordered);
        await fetch(`/api/sales-orders/${id}/tasks/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: reordered.map(t => t.id) }),
        });
    };

    const handleDownloadPdf = async () => {
        setPdfLoading(true);
        try {
            const res = await fetch(`/api/sales-orders/${id}/pdf`);
            if (!res.ok) throw new Error('PDF generation failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `job-ticket-${order?.code || id}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error('Failed to generate PDF: ' + err.message);
        } finally {
            setPdfLoading(false);
        }
    };

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/sales-orders/${id}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setOrder(data.salesOrder);
            setStatus(data.salesOrder.status);
            setDeliveryDate(data.salesOrder.delivery_date ? new Date(data.salesOrder.delivery_date).toISOString().split('T')[0] : '');
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const fetchTasks = async (autoGenerate = false) => {
        const res = await fetch(`/api/sales-orders/${id}/tasks`);
        const data = await res.json();
        if (Array.isArray(data)) {
            setTasks(data);
            // Auto-generate from job components if no tasks exist
            if (data.length === 0 && autoGenerate) {
                setGeneratingTasks(true);
                const genRes = await fetch(`/api/sales-orders/${id}/tasks`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ generateFromJob: true })
                });
                const generated = await genRes.json();
                if (Array.isArray(generated)) setTasks(generated);
                setGeneratingTasks(false);
            }
        }
    };

    const handleAddTask = async () => {
        if (!newTaskName.trim()) return;
        setAddingTask(true);
        const res = await fetch(`/api/sales-orders/${id}/tasks`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newTaskName.trim() })
        });
        const task = await res.json();
        setTasks(prev => [...prev, task]);
        setNewTaskName('');
        setAddingTask(false);
    };

    const handleGenerateTasks = async () => {
        setGeneratingTasks(true);
        const res = await fetch(`/api/sales-orders/${id}/tasks`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generateDefaults: true })
        });
        const data = await res.json();
        if (Array.isArray(data)) setTasks(data);
        setGeneratingTasks(false);
    };

    const handleDeleteTask = async (taskId) => {
        await fetch(`/api/sales-orders/${id}/tasks/${taskId}`, { method: 'DELETE' });
        setTasks(prev => prev.filter(t => t.id !== taskId));
    };

    const handleToggleTaskStatus = async (task) => {
        const newStatus = task.status === 'done' ? 'pending' : 'done';
        const body = {
            status: newStatus,
            completed_at: newStatus === 'done' ? new Date().toISOString() : null,
        };
        const res = await fetch(`/api/sales-orders/${id}/tasks/${task.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    };

    useEffect(() => {
        fetchOrder();
        fetchTasks(true); // auto-generate from job if no tasks exist
    }, [id]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/sales-orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, delivery_date: deliveryDate || null })
            });
            if (res.ok) {
                toast.success('Sales Order updated successfully');
                fetchOrder();
            } else {
                toast.error('Failed to update sales order');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error updating sales order');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!order) return <div className="text-white p-8">Sales Order not found</div>;

    return (
        <div className="min-h-screen bg-transparent text-white p-8 pb-32">

            {/* UI Header (Not printed) */}
            <div className="print:hidden">
                <header className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/sales-orders">
                            <Button className="bg-transparent border border-white/10 hover:bg-white/10 p-2">
                                <FiArrowLeft />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tighter">Sales Order {order.code}</h1>
                            <p className="text-gray-400 text-sm">{order.customer_name} • Ref: {order.quotation?.code || `QTN-${order.quotation_id}`}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20">
                            <FiPrinter className="mr-2" /> Print Job Ticket
                        </Button>
                        <Button
                            onClick={handleDownloadPdf}
                            disabled={pdfLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {pdfLoading ? (
                                <><span className="mr-2 animate-spin inline-block">⟳</span> Generating PDF...</>
                            ) : (
                                <><FiDownload className="mr-2" /> Download PDF</>
                            )}
                        </Button>
                    </div>
                </header>

                <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 mb-8 flex flex-wrap gap-8 items-end">
                    <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">Job Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded px-4 py-2 text-white focus:border-blue-500 outline-none w-48"
                        >
                            <option value="Pending" className="bg-gray-900">Pending</option>
                            <option value="In Production" className="bg-gray-900">In Production</option>
                            <option value="Ready" className="bg-gray-900">Ready</option>
                            <option value="Delivered" className="bg-gray-900">Delivered</option>
                            <option value="Cancelled" className="bg-gray-900">Cancelled</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">Estimated Delivery Date</label>
                        <input
                            type="date"
                            value={deliveryDate}
                            onChange={(e) => setDeliveryDate(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded px-4 py-2 text-white outline-none focus:border-blue-500 w-48 style-calendar"
                        />
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        {saving ? '...' : <><FiSave className="mr-2" /> Update Order</>}
                    </Button>
                </div>
            </div>

            {/* Tasks Panel (not printed) */}
            <div className="print:hidden mb-8">
                <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-white/10">
                        <div>
                            <h2 className="text-base font-bold text-white">Production Tasks</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {tasks.filter(t => t.status === 'done').length}/{tasks.length} completed
                                {tasks.length > 0 && ` · ${Math.round(tasks.filter(t=>t.status==='done').length/tasks.length*100)}%`}
                            </p>
                        </div>
                        <div className="flex gap-2 items-center">
                            <a href={`/jobs/${id}`} target="_blank" rel="noreferrer"
                               className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-semibold hover:bg-indigo-600/30 transition-colors">
                                <FiExternalLink className="text-xs" /> Live View
                            </a>
                            <img src={`/api/sales-orders/${id}/qr`} alt="QR" className="w-12 h-12 rounded" />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {tasks.length > 0 && (
                        <div className="h-1 bg-white/5">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-500"
                                 style={{ width: `${Math.round(tasks.filter(t=>t.status==='done').length/tasks.length*100)}%` }} />
                        </div>
                    )}

                    {/* Task List */}
                    <div className="divide-y divide-white/5">
                        {(showAllTasks ? tasks : tasks.slice(0, TASK_PREVIEW)).map(task => (
                            <div key={task.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors group">
                                <button onClick={() => handleToggleTaskStatus(task)}
                                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                        task.status === 'done' ? 'bg-green-500 border-green-500' :
                                        task.status === 'in_progress' ? 'border-blue-500' : 'border-white/20'
                                    }`}>
                                    {task.status === 'done' && <FiCheckCircle className="text-white text-xs" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-500' : 'text-white'}`}>
                                        {task.name}
                                    </span>
                                    {task.completed_by && task.status === 'done' && (
                                        <span className="text-xs text-gray-500 ml-2">· {task.completed_by}</span>
                                    )}
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    task.status === 'done' ? 'bg-green-500/10 text-green-400' :
                                    task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                                    'bg-white/5 text-gray-500'
                                }`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                                <button onClick={() => handleDeleteTask(task.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all p-1">
                                    <FiTrash2 className="text-xs" />
                                </button>
                            </div>
                        ))}

                        {/* Show more / Show less toggle */}
                        {tasks.length > TASK_PREVIEW && (
                            <button
                                onClick={() => setShowAllTasks(v => !v)}
                                className="w-full flex items-center justify-center gap-2 py-3 text-xs text-white/35 hover:text-white/60 hover:bg-white/[0.03] transition-all border-t border-white/[0.04]">
                                {showAllTasks ? (
                                    <><FiChevronUp className="w-3.5 h-3.5" /> Show less</>
                                ) : (
                                    <><FiChevronDown className="w-3.5 h-3.5" /> Show {tasks.length - TASK_PREVIEW} more tasks</>
                                )}
                            </button>
                        )}

                        {tasks.length === 0 && (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                No tasks yet.
                                <button onClick={handleGenerateTasks} disabled={generatingTasks}
                                    className="ml-2 text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                                    {generatingTasks ? 'Generating…' : 'Generate default tasks'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Add Task */}
                    <div className="p-4 border-t border-white/10 flex gap-2">
                        <input
                            value={newTaskName}
                            onChange={e => setNewTaskName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                            placeholder="Add a task…"
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30"
                        />
                        <Button onClick={handleAddTask} disabled={addingTask || !newTaskName.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-sm px-4">
                            <FiPlus className="mr-1" /> Add
                        </Button>
                        {tasks.length === 0 && (
                            <Button onClick={handleGenerateTasks} disabled={generatingTasks}
                                className="bg-white/10 hover:bg-white/20 text-sm px-4">
                                {generatingTasks ? '…' : 'Defaults'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Timeline ────────────────────────────────────────────────────────── */}
            <div className="print:hidden mb-4">
                <div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4">
                        <button onClick={() => setShowTimeline(v => !v)} className="flex items-center gap-2.5 cursor-pointer">
                            <FiActivity className="w-4 h-4 text-white/40" />
                            <span className="text-sm font-semibold text-white">Production Timeline</span>
                            <span className="text-xs text-white/30 ml-1">— drag to reorder tasks</span>
                            {showTimeline ? <FiChevronUp className="w-4 h-4 text-white/30" /> : <FiChevronDown className="w-4 h-4 text-white/30" />}
                        </button>
                        <div className="flex items-center gap-2">
                            <a href={publicTimelineUrl} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 text-xs transition-all">
                                <FiExternalLink className="w-3.5 h-3.5" /> Open
                            </a>
                            <button onClick={copyLink}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${linkCopied ? 'bg-white/10 border-white/20 text-white/80' : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70'}`}>
                                <FiLink className="w-3.5 h-3.5" />
                                {linkCopied ? 'Copied!' : 'Copy Link'}
                            </button>
                        </div>
                    </div>

                    {showTimeline && (
                        <div className="border-t border-white/[0.05]">
                            {tasks.length === 0 ? (
                                <p className="text-center text-white/25 text-sm py-10">No tasks yet — generate tasks above first.</p>
                            ) : (
                                <div className="p-5">
                                    {/* Progress */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between text-xs text-white/30 mb-2">
                                            <span>{tasks.filter(t => t.status === 'done').length}/{tasks.length} completed</span>
                                            <span className="font-mono font-semibold text-white/50">
                                                {tasks.length ? Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100) : 0}%
                                            </span>
                                        </div>
                                        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                                            <div className="h-full bg-white/40 rounded-full transition-all duration-500"
                                                style={{ width: `${tasks.length ? Math.round(tasks.filter(t => t.status === 'done').length / tasks.length * 100) : 0}%` }} />
                                        </div>
                                    </div>

                                    {/* Draggable list */}
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                            <div className="relative">
                                                <div className="absolute left-[18px] top-5 bottom-5 w-px bg-white/[0.05]" />
                                                <div className="space-y-2">
                                                    {tasks.map((task, idx) => (
                                                        <SortableTaskItem key={task.id} task={task} idx={idx} />
                                                    ))}
                                                </div>
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── BOM (Bill of Materials) ─────────────────────────────────────────── */}

            <div className="print:hidden mb-4">
                <div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setShowBOM(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2.5">
                            <FiLayers className="w-4 h-4 text-white/40" />
                            <span className="text-sm font-semibold text-white">Bill of Materials</span>
                            <span className="text-xs text-white/30 ml-1">— paper &amp; materials consumed per component</span>
                        </div>
                        {showBOM ? <FiChevronUp className="w-4 h-4 text-white/30" /> : <FiChevronDown className="w-4 h-4 text-white/30" />}
                    </button>

                    {showBOM && (
                        <div className="border-t border-white/[0.05]">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                                            <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Component</th>
                                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Type</th>
                                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Material / Paper</th>
                                            <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Sheet Size</th>
                                            <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Ups</th>
                                            <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Printed Sheets</th>
                                            <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Wastage</th>
                                            <th className="text-right px-5 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Total Sheets</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {order.items?.flatMap((item, iIdx) =>
                                            item.details
                                                ?.filter(d => d.component_name !== 'Finishing')
                                                .map((d, dIdx) => (
                                                    <tr key={`${item.id}-${d.id || dIdx}`} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="px-5 py-3">
                                                            <p className="font-semibold text-white text-sm">
                                                                {iIdx + 1}.{dIdx + 1} {item.estimation_name || item.job_description}
                                                            </p>
                                                            {item.details.filter(x => x.component_name !== 'Finishing').length > 1 && (
                                                                <p className="text-xs text-white/30 mt-0.5">{d.component_name}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                                                d.type === 'digital'
                                                                    ? 'bg-white/[0.05] text-white/50 border-white/[0.10]'
                                                                    : 'bg-white/[0.04] text-white/40 border-white/[0.08]'
                                                            }`}>{d.type || 'offset'}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-white text-sm font-medium">{d.paper_name || <span className="text-white/25 italic">Not specified</span>}</p>
                                                            {d.paper_width_cm && (
                                                                <p className="text-xs text-white/30 mt-0.5">Stock: {d.paper_width_cm} × {d.paper_height_cm} cm</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-white/70 text-sm font-mono">
                                                            {d.cut_width_cm && d.cut_height_cm
                                                                ? `${d.cut_width_cm} × ${d.cut_height_cm} cm`
                                                                : d.paper_width_cm
                                                                    ? `${d.paper_width_cm} × ${d.paper_height_cm} cm`
                                                                    : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-white font-semibold font-mono">{d.ups ?? '—'}</td>
                                                        <td className="px-4 py-3 text-right text-white font-mono">{d.printed_sheets ?? '—'}</td>
                                                        <td className="px-4 py-3 text-right text-red-400/70 font-mono">{d.wastage_sheets ?? '—'}</td>
                                                        <td className="px-5 py-3 text-right">
                                                            <span className="font-bold text-white font-mono">{d.total_sheets ?? '—'}</span>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Global Finishings material note */}
                            {order.items?.some(i => i.globalFinishings?.length > 0) && (
                                <div className="px-5 py-3 border-t border-white/[0.05] bg-white/[0.01]">
                                    <p className="text-xs text-white/25 font-medium">Note: Global finishings (applied to full item) are listed in the Routing section below.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Routing (Operation Sequence) ────────────────────────────────────── */}
            <div className="print:hidden mb-8">
                <div className="bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setShowRouting(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2.5">
                            <FiCpu className="w-4 h-4 text-white/40" />
                            <span className="text-sm font-semibold text-white">Routing</span>
                            <span className="text-xs text-white/30 ml-1">— machine &amp; operation sequence</span>
                        </div>
                        {showRouting ? <FiChevronUp className="w-4 h-4 text-white/30" /> : <FiChevronDown className="w-4 h-4 text-white/30" />}
                    </button>

                    {showRouting && (
                        <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
                            {order.items?.map((item, iIdx) => {
                                // Build ordered operation list: component details (printing) + their per-component finishings + global finishings
                                const ops = [];
                                let step = 1;

                                item.details
                                    ?.filter(d => d.component_name !== 'Finishing')
                                    .forEach(d => {
                                        ops.push({
                                            step: step++,
                                            kind: 'print',
                                            label: d.component_name || 'Print',
                                            machine: d.machine_name || '—',
                                            detail: [
                                                d.type === 'digital' ? 'Digital print' : `${d.colors} color${d.colors > 1 ? 's' : ''} · ${d.sides === 2 ? 'double-sided' : 'single-sided'}`,
                                                d.total_sheets ? `${d.total_sheets} sheets` : '',
                                                d.machine_speed ? `${d.machine_speed} ${d.machine_speed_unit || 'sph'}` : '',
                                            ].filter(Boolean).join(' · '),
                                        });
                                        // Per-component finishings
                                        (d.finishings || []).forEach(f => {
                                            ops.push({
                                                step: step++,
                                                kind: 'finishing',
                                                label: f.name,
                                                machine: f.machine_name || '—',
                                                detail: [
                                                    f.quantity ? `${f.quantity} ${f.cost_unit || ''}` : '',
                                                    f.total_time > 0 ? `${parseFloat(f.total_time).toFixed(1)} min` : '',
                                                ].filter(Boolean).join(' · '),
                                            });
                                        });
                                    });

                                // Global finishings last
                                (item.globalFinishings || []).forEach(f => {
                                    ops.push({
                                        step: step++,
                                        kind: 'global',
                                        label: f.name,
                                        machine: f.machine_name || '—',
                                        detail: [
                                            f.quantity ? `${f.quantity} ${f.cost_unit || ''}` : '',
                                            f.total_time > 0 ? `${parseFloat(f.total_time).toFixed(1)} min` : '',
                                        ].filter(Boolean).join(' · '),
                                    });
                                });

                                if (ops.length === 0) return null;

                                return (
                                    <div key={item.id} className="p-5">
                                        <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-4">
                                            {iIdx + 1}. {item.estimation_name || item.job_description}
                                            <span className="ml-2 text-white/20 normal-case font-normal">Qty: {item.quantity}</span>
                                        </p>

                                        <div className="relative">
                                            {/* Vertical connector line */}
                                            <div className="absolute left-[18px] top-6 bottom-0 w-px bg-white/[0.06]" />

                                            <div className="space-y-3">
                                                {ops.map(op => (
                                                    <div key={op.step} className="flex items-start gap-4 group">
                                                        {/* Step badge */}
                                                        <div className={`relative z-10 shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border ${
                                                            op.kind === 'print'
                                                                ? 'bg-white/[0.07] border-white/[0.12] text-white/70'
                                                                : op.kind === 'global'
                                                                ? 'bg-white/[0.04] border-white/[0.08] text-white/40'
                                                                : 'bg-white/[0.04] border-white/[0.07] text-white/40'
                                                        }`}>
                                                            {op.step}
                                                        </div>
                                                        {/* Step info */}
                                                        <div className="flex-1 min-w-0 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] rounded-xl px-4 py-3 transition-colors">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-white truncate">{op.label}</p>
                                                                    {op.detail && <p className="text-xs text-white/30 mt-0.5">{op.detail}</p>}
                                                                </div>
                                                                <div className="shrink-0 text-right">
                                                                    <p className="text-xs font-medium text-white/50">{op.machine}</p>
                                                                    <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border mt-1 ${
                                                                        op.kind === 'print'
                                                                            ? 'bg-white/[0.06] text-white/50 border-white/[0.10]'
                                                                            : 'bg-white/[0.03] text-white/30 border-white/[0.06]'
                                                                    }`}>
                                                                        {op.kind === 'print' ? 'Print' : op.kind === 'global' ? 'Finishing (Global)' : 'Finishing'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            {/* <div className="print-pages">

            <div className="bg-white text-black p-8 rounded-xl print:m-0 print:shadow-none shadow-xl mx-auto max-w-[21cm] min-h-[29.7cm] job-ticket-container">

                <div className="border-b-4 border-black pb-4 mb-6 relative">
                    <h1 className="text-3xl font-black uppercase tracking-tight mb-1">Production Job Ticket</h1>
                    <div className="flex justify-between items-end">
                        <div className="space-y-1 mt-4">
                            <p className="font-bold text-lg">{order.customer_name}</p>
                            <p className="text-sm">Job Name: <span className="font-bold">{order.quotation?.job_description || 'N/A'}</span></p>
                        </div>
                        <div className="text-right space-y-1">
                            <p className="text-xs text-gray-600 uppercase font-bold">SO Number</p>
                            <p className="text-xl font-bold font-mono">{order.code}</p>
                            <p className="text-sm pt-2">Date: {new Date(order.order_date).toLocaleDateString()}</p>
                            <p className="text-sm font-bold text-red-600">Delivery: {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'TBD'}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    {order.items?.map((item, idx) => (
                        <div key={item.id} className="relative">
                            <div className="bg-gray-100 p-2 font-bold mb-4 flex justify-between uppercase text-sm border-b-2 border-black">
                                <span>{idx + 1}. {item.estimation_name || item.job_description}</span>
                                <span>Qty: {item.quantity}</span>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                {item.details?.map((detail, dIdx) => (
                                    <div key={detail.id} className="border border-gray-300 rounded p-4 text-sm relative">
                                        <div className="absolute -top-3 left-4 bg-white px-2 font-bold text-gray-500 uppercase text-xs">
                                            {detail.component_name} ({detail.type})
                                        </div>

                                        {detail.component_name === 'Finishing' ? null : (
                                            <>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 mb-4">
                                                    <div>
                                                        <div className="text-xs text-gray-500 uppercase">Machine</div>
                                                        <div className="font-bold">{detail.machine_name || 'N/A'}</div>
                                                    </div>
                                                    {detail.type !== 'digital' && (
                                                        <>
                                                            <div>
                                                                <div className="text-xs text-gray-500 uppercase">Colors (F/B)</div>
                                                                <div className="font-bold">{detail.colors} Colors</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs text-gray-500 uppercase">Sides</div>
                                                                <div className="font-bold">{detail.sides === 2 ? 'Double Sided' : 'Single Sided'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs text-gray-500 uppercase">Pages</div>
                                                                <div className="font-bold">{detail.pages}</div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                <div className="bg-blue-50 p-3 rounded grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 border border-blue-100">
                                                    <div className="md:col-span-2">
                                                        <div className="text-xs text-blue-800 uppercase font-bold">Paper / Material</div>
                                                        <div className="font-bold text-lg">{detail.paper_name || 'Not specified'}</div>
                                                        {detail.paper_width_cm && <div className="text-xs">Original Size: {detail.paper_width_cm} x {detail.paper_height_cm}</div>}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-blue-800 uppercase font-bold">Total Sheets Req</div>
                                                        <div className="font-bold text-lg">{detail.total_sheets}</div>
                                                        <div className="text-xs">(inc. {detail.wastage_sheets} waste)</div>
                                                    </div>
                                                    {detail.type !== 'digital' && (
                                                        <div>
                                                            <div className="text-xs text-blue-800 uppercase font-bold">Layout (UPS)</div>
                                                            <div className="font-bold text-lg">{detail.ups} Ups</div>
                                                            <div className="text-xs">Prints: {detail.printed_sheets}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}


                                        {detail.finishings && detail.finishings.length > 0 && (
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase mb-2 font-bold border-b pb-1">Component Operations</div>
                                                <table className="w-full text-left text-xs mb-2">
                                                    <thead>
                                                        <tr className="text-gray-500 uppercase">
                                                            <th className="py-1">Operation / Finishing</th>
                                                            <th>Machine</th>
                                                            <th className="text-right">Quantity</th>
                                                            <th className="text-right">Est. Time</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {detail.finishings.map(f => (
                                                            <tr key={f.id} className="border-t border-dashed">
                                                                <td className="py-2 font-bold">{f.name}</td>
                                                                <td>{f.machine_name || '-'}</td>
                                                                <td className="text-right">{f.quantity} {f.cost_unit}</td>
                                                                <td className="text-right">{f.total_time > 0 ? `${parseFloat(f.total_time).toFixed(1)} mins` : '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {item.globalFinishings && item.globalFinishings.length > 0 && (
                                <div className="mt-6 border-l-4 border-gray-800 pl-4 py-2 bg-gray-50">
                                    <div className="text-sm font-black uppercase mb-3 text-gray-800">Final Item Finishings (Global)</div>
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="text-gray-500 uppercase text-xs">
                                                <th className="py-1">Operation</th>
                                                <th className="text-right">Qty</th>
                                                <th className="text-right">Est. Time</th>
                                                <th className="text-center w-24">Done ✓</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {item.globalFinishings.map(f => (
                                                <tr key={f.id} className="border-t border-gray-300">
                                                    <td className="py-3 font-bold">{f.name}</td>
                                                    <td className="text-right">{f.quantity} {f.cost_unit}</td>
                                                    <td className="text-right text-gray-600">{f.total_time > 0 ? `${parseFloat(f.total_time).toFixed(1)} mins` : '-'}</td>
                                                    <td className="text-center"><div className="w-6 h-6 border-2 border-gray-400 rounded mx-auto"></div></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="flex justify-end mt-4 text-xs">
                                <div className="w-48 text-center pt-8 border-t border-gray-400 mt-4">
                                    QC / Operator Sign-off
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 pt-4 border-t-2 border-dashed border-gray-300 text-xs text-gray-500 text-center">
                    Auto-generated Job Ticket by Pressmatics ERP • {new Date().toLocaleString()}
                </div>
            </div>

            {order.items?.some(item =>
                item.details?.some(d => d.type !== 'digital' && d.comp_width_cm && d.comp_height_cm)
            ) && (
                <div
                    className="bg-white text-black p-8 rounded-xl print:m-0 print:p-8 shadow-xl mx-auto max-w-[29.7cm] min-h-[21cm] mt-8 job-ticket-container imposition-layouts-container"
                    style={{ pageBreakBefore: 'always' }}
                >
                    <div className="border-b-4 border-black pb-4 mb-8">
                        <h1 className="text-2xl font-black uppercase tracking-tight">Imposition Layout Plans</h1>
                        <div className="flex justify-between items-end mt-2">
                            <p className="text-sm text-gray-600">{order.customer_name} — {order.quotation?.job_description || 'Job Specification'}</p>
                            <p className="text-sm font-mono font-bold">{order.code}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {order.items?.map((item, itemIdx) =>
                            item.details
                                ?.filter(d => d.type !== 'digital' && d.comp_width_cm && d.comp_height_cm && d.component_name !== 'Finishing')
                                .map((detail, dIdx) => (
                                    <div key={`${item.id}-${detail.id || dIdx}`} className="break-inside-avoid">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h2 className="font-black text-sm uppercase leading-tight">
                                                {itemIdx + 1}.{dIdx + 1}&nbsp; {item.estimation_name || item.job_description}
                                                {item.details.length > 1 && (
                                                    <span className="font-normal text-gray-500 text-xs ml-1">— {detail.component_name}</span>
                                                )}
                                            </h2>
                                            <span className="text-[10px] text-gray-500 font-mono ml-2 shrink-0">
                                                {detail.ups} ups
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 mb-2 pb-2 border-b border-gray-200">
                                            <span>Sheet: <strong className="text-black">{detail.paper_width_cm}×{detail.paper_height_cm} cm</strong></span>
                                            <span>Cut: <strong className="text-black">{detail.cut_width_cm}×{detail.cut_height_cm} cm</strong></span>
                                            <span>Bleed: <strong className="text-black">{detail.bleed_mm ?? 3} mm</strong></span>
                                            <span className="text-gray-400">{detail.paper_name}</span>
                                        </div>

                                        <ImpositionVisualizer
                                            ups={detail.ups}
                                            paperWidthCm={detail.paper_width_cm}
                                            paperHeightCm={detail.paper_height_cm}
                                            compWidthCm={detail.comp_width_cm}
                                            compHeightCm={detail.comp_height_cm}
                                            bleedMm={detail.bleed_mm ?? 3}
                                            printMode={true}
                                        />
                                    </div>
                                ))
                        )}
                    </div>

                    <div className="mt-12 pt-4 border-t-2 border-dashed border-gray-300 text-xs text-gray-500 text-center">
                        Imposition Plans • Auto-generated by Pressmatics ERP • {new Date().toLocaleString()}
                    </div>
                </div>
            )}
            </div>  */}

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* Collapse all layout wrappers so they don't push content down */
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        background: white !important;
                    }

                    /* Hide EVERYTHING with display:none — this collapses space */
                    body * { display: none !important; }

                    /* Restore only the print wrapper and all its descendants */
                    .print-pages                { display: block !important; }
                    .print-pages *              { display: revert !important; }

                    /* Re-assert specific display types inside print-pages */
                    .print-pages table          { display: table !important; }
                    .print-pages thead          { display: table-header-group !important; }
                    .print-pages tbody          { display: table-row-group !important; }
                    .print-pages tr             { display: table-row !important; }
                    .print-pages td,
                    .print-pages th             { display: table-cell !important; }

                    /* print-pages stays in normal flow — page-break works here */
                    .print-pages {
                        width: 100%;
                        margin: 0;
                        padding: 0;
                    }

                    /* Each page block */
                    .job-ticket-container {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 1cm !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        background: white !important;
                        min-height: 0 !important;
                    }

                    /* Force page break before every container after the first */
                    .job-ticket-container + .job-ticket-container {
                        page-break-before: always;
                        break-before: page;
                    }

                    /* Landscape A3 for the imposition layouts page */
                    .imposition-layouts-container { page: landscape-page; }
                    @page landscape-page { size: A3 landscape; margin: 1cm; }
                    @page { margin: 1.5cm; }
                }
            `}} />
        </div>
    );
}
