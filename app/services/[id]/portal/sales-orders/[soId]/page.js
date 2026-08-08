'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    FiArrowLeft, FiSave, FiCheckCircle, FiDownload, FiTrash2,
    FiExternalLink, FiLayers, FiActivity, FiClock, FiFileText,
    FiUser, FiCalendar, FiDollarSign, FiInfo
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
    'Pending':       { color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    'In Production': { color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    'Ready':         { color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    'Delivered':     { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    'Cancelled':     { color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
};

export default function SimpleServiceSalesOrderPage({ params }) {
    const { id, soId } = use(params);
    const router = useRouter();

    const [order, setOrder]             = useState(null);
    const [loading, setLoading]         = useState(true);
    const [status, setStatus]           = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [jobNotes, setJobNotes]       = useState('');
    const [saving, setSaving]           = useState(false);

    // Tasks & BOM
    const [tasks, setTasks]             = useState([]);
    const [bom, setBom]                 = useState([]);
    const [bomLoading, setBomLoading]   = useState(true);
    const [pdfLoading, setPdfLoading]   = useState(false);

    // Delete Modal
    const [deleteModal, setDeleteModal] = useState(false);
    const [deleting, setDeleting]       = useState(false);

    const fetchOrder = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sales-orders/${soId}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setOrder(data.salesOrder);
            setStatus(data.salesOrder.status || 'Pending');
            setDeliveryDate(data.salesOrder.delivery_date ? new Date(data.salesOrder.delivery_date).toISOString().split('T')[0] : '');
            setJobNotes(data.salesOrder.job_notes || '');
        } catch (err) {
            console.error('Error fetching sales order:', err);
            toast.error('Failed to load Sales Order');
        } finally {
            setLoading(false);
        }
    }, [soId]);

    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch(`/api/sales-orders/${soId}/tasks`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setTasks(data);
            }
        } catch (err) {
            console.error('Error fetching tasks:', err);
        }
    }, [soId]);

    const fetchBOM = useCallback(async () => {
        try {
            const res = await fetch(`/api/sales-orders/${soId}/bom`);
            if (res.ok) {
                const data = await res.json();
                setBom(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Error fetching BOM:', err);
        } finally {
            setBomLoading(false);
        }
    }, [soId]);

    useEffect(() => {
        fetchOrder();
        fetchTasks();
        fetchBOM();
    }, [fetchOrder, fetchTasks, fetchBOM]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/sales-orders/${soId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    delivery_date: deliveryDate || null,
                    job_notes: jobNotes || null
                })
            });
            if (res.ok) {
                toast.success('Sales Order updated successfully');
                fetchOrder();
            } else {
                toast.error('Failed to update sales order');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error updating sales order');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleTaskStatus = async (task) => {
        const newStatus = task.status === 'done' ? 'pending' : 'done';
        try {
            const res = await fetch(`/api/sales-orders/${soId}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    completed_at: newStatus === 'done' ? new Date().toISOString() : null,
                })
            });
            if (res.ok) {
                const updated = await res.json();
                if (updated && updated.id) {
                    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
                }
            }
        } catch (err) {
            console.error('Error updating task:', err);
        }
    };

    const handleDownloadPdf = async () => {
        setPdfLoading(true);
        try {
            const res = await fetch(`/api/sales-orders/${soId}/pdf?layout=clean`);
            if (!res.ok) throw new Error('PDF generation failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Job-Ticket-${order?.code || soId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Job ticket PDF downloaded');
        } catch (err) {
            toast.error('Failed to generate PDF: ' + err.message);
        } finally {
            setPdfLoading(false);
        }
    };

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/services/${id}/sales-orders?so_id=${soId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(`Sales Order ${order?.code || `#${soId}`} deleted`);
                router.push(`/services/${id}/portal/sales-orders`);
            } else {
                toast.error('Failed to delete Sales Order');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error deleting Sales Order');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-zinc-400 animate-pulse">
                Loading Sales Order details…
            </div>
        );
    }

    if (!order) {
        return (
            <div className="p-8 text-center space-y-4">
                <p className="text-zinc-400">Sales Order not found.</p>
                <Link
                    href={`/services/${id}/portal/sales-orders`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
                >
                    <FiArrowLeft /> Back to Sales Orders
                </Link>
            </div>
        );
    }

    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG['Pending'];

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            {/* Top Navigation & Action Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/services/${id}/portal/sales-orders`}
                        className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                        title="Back to Sales Orders List"
                    >
                        <FiArrowLeft size={18} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Service Sales Order</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.color}`}>
                                {status}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5 font-mono">
                            {order.code}
                        </h1>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleDownloadPdf}
                        disabled={pdfLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700/80 hover:border-zinc-500 text-zinc-200 hover:text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                    >
                        <FiDownload size={14} />
                        {pdfLoading ? 'Generating PDF…' : 'Job Ticket PDF'}
                    </button>
                    <button
                        onClick={() => setDeleteModal(true)}
                        className="flex items-center gap-2 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                        <FiTrash2 size={14} /> Delete
                    </button>
                </div>
            </div>

            {/* General Order Info & Status Control Card */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                            <FiUser size={13} className="text-indigo-400" /> Customer Name
                        </span>
                        <p className="text-sm font-bold text-white truncate">{order.customer_name || 'N/A'}</p>
                        {order.customer_phone && (
                            <p className="text-xs text-zinc-400 font-mono mt-0.5">{order.customer_phone}</p>
                        )}
                    </div>

                    <div>
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                            <FiFileText size={13} className="text-indigo-400" /> Quotation Reference
                        </span>
                        {order.quotation?.code || order.quotation_id ? (
                            <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-md inline-block">
                                {order.quotation?.code || `QTN-${order.quotation_id}`}
                            </span>
                        ) : (
                            <span className="text-xs text-zinc-500">Direct Order</span>
                        )}
                    </div>

                    <div>
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                            <FiCalendar size={13} className="text-indigo-400" /> Date Created
                        </span>
                        <p className="text-xs font-mono text-zinc-300">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : '—'}
                        </p>
                    </div>

                    <div>
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                            <FiDollarSign size={13} className="text-indigo-400" /> Total Value
                        </span>
                        <p className="text-base font-bold font-mono text-white">
                            LKR {Number(order.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {/* Status & Delivery Control Form */}
                <div className="pt-6 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            Update Order Status
                        </label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs font-medium text-white outline-none focus:border-indigo-500"
                        >
                            <option value="Pending">Pending</option>
                            <option value="In Production">In Production</option>
                            <option value="Ready">Ready</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                            Estimated Delivery Date
                        </label>
                        <input
                            type="date"
                            value={deliveryDate}
                            onChange={e => setDeliveryDate(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs font-medium text-white outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md"
                        >
                            <FiSave size={14} />
                            {saving ? 'Saving changes…' : 'Save Status & Delivery'}
                        </button>
                    </div>
                </div>

                {/* Job Notes / Instructions */}
                <div className="pt-4 border-t border-zinc-800/80">
                    <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-2 flex items-center gap-1.5">
                        <FiInfo size={13} /> Job Notes & Production Instructions
                    </label>
                    <textarea
                        value={jobNotes}
                        onChange={e => setJobNotes(e.target.value)}
                        placeholder="Enter special notes or production instructions for operators..."
                        rows={2}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-600 outline-none focus:border-amber-500/50 resize-y"
                    />
                </div>
            </div>

            {/* Production Tasks & Progress */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
                <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <FiActivity className="text-indigo-400" />
                            Production Tasks Checklist
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            {completedTasks} of {tasks.length} tasks completed ({taskProgress}%)
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                {tasks.length > 0 && (
                    <div className="h-1.5 bg-zinc-950 w-full">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${taskProgress}%` }}
                        />
                    </div>
                )}

                {/* Task Items List */}
                <div className="divide-y divide-zinc-800/60">
                    {tasks.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 text-xs italic">
                            No production tasks associated with this sales order.
                        </div>
                    ) : (
                        tasks.map((task, idx) => (
                            <div
                                key={task.id}
                                className="p-4 flex items-center justify-between hover:bg-zinc-800/40 transition-colors gap-4"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <button
                                        onClick={() => handleToggleTaskStatus(task)}
                                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                            task.status === 'done'
                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                : 'border-zinc-600 hover:border-zinc-400 text-transparent'
                                        }`}
                                    >
                                        <FiCheckCircle size={14} />
                                    </button>
                                    <div className="min-w-0">
                                        <p className={`text-xs font-semibold truncate ${
                                            task.status === 'done' ? 'line-through text-zinc-500' : 'text-white'
                                        }`}>
                                            {idx + 1}. {task.name}
                                        </p>
                                        {task.description && (
                                            <p className="text-[11px] text-zinc-400 truncate mt-0.5">{task.description}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    {task.estimated_minutes > 0 && (
                                        <span className="text-[10px] font-mono font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <FiClock size={11} /> {task.estimated_minutes}m
                                        </span>
                                    )}
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                        task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                        'bg-zinc-800 text-zinc-400 border-zinc-700'
                                    }`}>
                                        {task.status?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Bill of Materials (BOM) */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
                <div className="p-5 border-b border-zinc-800/80">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <FiLayers className="text-indigo-400" />
                        Bill of Materials & Materials Summary
                    </h2>
                </div>

                {bomLoading ? (
                    <div className="py-12 text-center text-zinc-400 animate-pulse text-xs">Loading materials list…</div>
                ) : bom.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-xs italic">
                        No material requirements logged for this order.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-800/80 bg-zinc-950/50 text-zinc-400 uppercase tracking-wider font-semibold">
                                    <th className="py-3 px-4 text-left">Component / Material</th>
                                    <th className="py-3 px-4 text-left">Type</th>
                                    <th className="py-3 px-4 text-right">Required</th>
                                    <th className="py-3 px-4 text-right">Issued</th>
                                    <th className="py-3 px-4 text-right">Remaining</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {bom.map((item, i) => {
                                    const req = parseFloat(item.required_qty || 0);
                                    const issued = parseFloat(item.issued_qty || 0);
                                    const rem = Math.max(0, req - issued);
                                    return (
                                        <tr key={item.id || i} className="hover:bg-zinc-800/40 transition-colors">
                                            <td className="py-3 px-4 font-semibold text-white">{item.component_name}</td>
                                            <td className="py-3 px-4">
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                                    {item.component_type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-white font-medium">{req} {item.uom}</td>
                                            <td className="py-3 px-4 text-right font-mono text-emerald-400 font-medium">{issued} {item.uom}</td>
                                            <td className="py-3 px-4 text-right font-mono text-amber-300 font-bold">{rem} {item.uom}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Custom Modal Confirmation for Delete */}
            {deleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#0e0e11] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-400">
                            <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                <FiTrash2 size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Delete Sales Order</h3>
                                <p className="text-xs text-zinc-400 font-mono mt-0.5">{order.code}</p>
                            </div>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                            Are you sure you want to delete Sales Order <strong className="text-white">{order.code}</strong> for <strong className="text-white">{order.customer_name}</strong>?
                            <br /><br />
                            <span className="text-rose-400 font-semibold">Warning:</span> Associated job tasks will be deleted and linked quotation status will be reset.
                        </p>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModal(false)}
                                disabled={deleting}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white shadow-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                            >
                                {deleting ? 'Deleting…' : 'Yes, Delete Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
