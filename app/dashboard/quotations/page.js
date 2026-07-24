'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
} from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    FiPlus, FiSearch, FiPrinter, FiTrash2, FiCopy,
    FiShoppingCart, FiDollarSign, FiChevronUp, FiChevronDown,
    FiChevronsLeft, FiChevronLeft, FiChevronRight, FiChevronsRight,
    FiEdit2, FiFileText, FiClock, FiCheckCircle,
    FiAlertTriangle, FiPackage, FiDownload,
} from 'react-icons/fi';
import { useSettings } from '@/components/SettingsContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { numericOperatorFilterFn } from '@/lib/numericFilter';

/* ── Status badge ─────────────────────────────────────────────────────────── */
const STATUS = {
    draft:     'bg-gray-500/20 text-gray-300 border-gray-500/30',
    converted: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hidden',
    cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
    sent:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${STATUS[status] || STATUS.draft}`}>
            {status}
        </span>
    );
}

function SalesOrderProgress({ visible, progress, label }) {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-lg flex items-center justify-center">
            <div className="bg-[#0f0f0f]/95 border border-white/10 rounded-2xl p-10 w-80 shadow-[0_24px_64px_rgba(0,0,0,0.6)] text-center">
                <div className="flex items-center justify-center mb-5">
                    <div className="relative flex items-center justify-center w-16 h-16">
                        <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 64 64" fill="none">
                            <circle cx="32" cy="32" r="28" stroke="url(#soGrad)" strokeWidth="3" strokeLinecap="round" strokeDasharray="120 60" />
                            <defs>
                                <linearGradient id="soGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#10b981" />
                                    <stop offset="100%" stopColor="#34d399" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="relative z-10 w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                            <FiShoppingCart size={18} className="text-emerald-400" />
                        </div>
                    </div>
                </div>
                <div className="text-white font-bold text-base mb-1">Creating Sales Order</div>
                <div className="text-gray-500 text-sm mb-6">{label}</div>
                <div className="bg-white/8 rounded-full h-1.5 overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-400"
                        style={{ width: `${progress}%` }} />
                </div>
                <div className="text-gray-600 text-xs">{progress}%</div>
            </div>
        </div>
    );
}

/* ── Sort icon ────────────────────────────────────────────────────────────── */
function SortIcon({ dir }) {
    if (!dir) return <span className="w-3 opacity-20">⇅</span>;
    return dir === 'asc' ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />;
}

/* ── Column filter input ──────────────────────────────────────────────────── */
function ColumnFilter({ column }) {
    const val = column.getFilterValue() ?? '';
    return (
        <input
            value={val}
            onChange={e => column.setFilterValue(e.target.value)}
            placeholder="Filter…"
            className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/30"
        />
    );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function QuotationsPage() {
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';
    const router = useRouter();
    const [data, setData]           = useState([]);
    const stats = useMemo(() => {
        const sent = data.reduce((acc, q) => (q.status === 'sent') ? acc + 1 : acc, 0);
        const converted = data.reduce((acc, q) => q.status === 'converted' ? acc + 1 : acc, 0);
        const total = data.reduce((acc, q) => q.status === 'converted' ? acc + Number(q.total_amount || 0) : acc, 0);
        return { sent, converted, total };
    }, [data]);
    const [loading, setLoading]     = useState(true);
    const [deleting, setDeleting]   = useState(null);
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnVisibility, setColumnVisibility] = useState({});
    const [stockShortages, setStockShortages] = useState(null);
    const [convertingId, setConvertingId] = useState(null);
    const [autoDeduct, setAutoDeduct] = useState(false);
    const [convertingProgressVisible, setConvertingProgressVisible] = useState(false);
    const [convertingProgress, setConvertingProgress] = useState(0);
    const [convertingLabel, setConvertingLabel] = useState('');
    const [columnFilters, setColumnFilters] = useState([]);
    const [exportingPdf, setExportingPdf] = useState(false);

    const handleExportPDF = async () => {
        setExportingPdf(true);
        try {
            const visibleCols = table.getVisibleLeafColumns()
                .filter(col => col.id !== 'select' && col.id !== 'actions')
                .map(col => ({
                    key: col.id || col.columnDef.accessorKey,
                    header: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
                }));

            const filteredRows = table.getFilteredRowModel().rows.map(row => row.original);

            const res = await fetch('/api/pdf/dynamic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Quotations Report',
                    subtitle: 'Exported Quotations List (Customized & Filtered)',
                    columns: visibleCols,
                    rows: filteredRows,
                    currency: currency
                })
            });

            if (!res.ok) {
                toast.error('Failed to generate PDF');
                setExportingPdf(false);
                return;
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `quotations_report_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Export PDF error:', error);
            toast.error('An error occurred while generating PDF');
        } finally {
            setExportingPdf(false);
        }
    };

    /* ── Fetch all (TanStack handles pagination client-side) ───────────────── */
    const fetchAll = useCallback(() => {
        setLoading(true);
        fetch('/api/quotations?page=1&limit=500')
            .then(r => r.json())
            .then(res => {
                setData(Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                return;
            }
            if (e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                router.push('/dashboard/quotations/new');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [router]);

    const handleStatusChange = useCallback(async (id, status) => {
        try {
            const res = await fetch(`/api/quotations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                toast.success('Status updated');
                fetchAll();
            } else {
                toast.error('Failed to update status');
            }
        } catch {
            toast.error('Error updating status');
        }
    }, [fetchAll]);

    /* ── Action handlers ───────────────────────────────────────────────────── */
    const handleDelete = async (id) => {
        if (!(await confirmDialog('Delete this quotation? This cannot be undone.', {
            danger: true, confirmLabel: 'Delete',
        }))) return;
        setDeleting(id);
        try {
            const res = await fetch(`/api/quotations/${id}/delete`, { method: 'DELETE' });
            if (res.ok) { toast.success('Quotation deleted'); fetchAll(); }
            else toast.error('Failed to delete');
        } catch { toast.error('Error deleting quotation'); }
        finally { setDeleting(null); }
    };

    const handleDuplicate = async (id) => {
        if (!(await confirmDialog('Duplicate this quotation?', { confirmLabel: 'Duplicate' }))) return;
        try {
            const res = await fetch(`/api/quotations/${id}/duplicate`, { method: 'POST' });
            if (res.ok) { toast.success('Quotation duplicated'); fetchAll(); }
            else toast.error('Failed to duplicate');
        } catch { toast.error('Error duplicating quotation'); }
    };

    const handleConvert = (id) => {
        setConvertingId(id);
        setAutoDeduct(false);
    };

    const submitConvert = async () => {
        if (!convertingId) return;
        const id = convertingId;
        setConvertingId(null);

        setConvertingProgressVisible(true);
        setConvertingProgress(0);
        setConvertingLabel('Initializing conversion...');

        const stages = [
            { pct: 15, label: 'Reading quotation details...' },
            { pct: 35, label: 'Creating Sales Order header...' },
            { pct: 55, label: 'Creating Sales Order items...' },
            { pct: 75, label: 'Generating job tasks & routing...' },
            { pct: 90, label: 'Allocating material requirements...' }
        ];

        let si = 0;
        const tick = setInterval(() => {
            if (si < stages.length) {
                setConvertingProgress(stages[si].pct);
                setConvertingLabel(stages[si].label);
                si++;
            }
        }, 300);

        try {
            const res = await fetch('/api/sales-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quotation_id: id, auto_deduct_stock: autoDeduct }),
            });
            const d = await res.json();
            clearInterval(tick);

            if (res.ok) {
                setConvertingProgress(100);
                setConvertingLabel('Done!');
                await new Promise(r => setTimeout(r, 600));
                setConvertingProgressVisible(false);
                toast.success('Sales Order created!');
                fetchAll();
            } else {
                setConvertingProgressVisible(false);
                if (res.status === 422) {
                    if (d.error === 'insufficient_stock' && d.shortages) {
                        setStockShortages(d.shortages);
                    } else {
                        toast.error(d.message || 'Insufficient stock to convert');
                    }
                } else {
                    toast.error('Failed to convert: ' + (d.error || 'Unknown error'));
                }
            }
        } catch {
            clearInterval(tick);
            setConvertingProgressVisible(false);
            toast.error('Error converting to sales order');
        }
    };

    const fmt = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    /* ── Column definitions ────────────────────────────────────────────────── */
    const columns = useMemo(() => [
        {
            accessorKey: 'code',
            header: 'Code',
            size: 110,
            cell: ({ getValue }) => (
                <span className="font-mono text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                    {getValue() || '—'}
                </span>
            ),
        },
        {
            accessorKey: 'customer_name',
            header: 'Customer',
            cell: ({ getValue }) => (
                <span className="font-semibold text-white">{getValue()}</span>
            ),
        },
        {
            id: 'description',
            accessorFn: row => row.first_item_name || row.job_description || '',
            header: 'Description',
            cell: ({ getValue }) => (
                <span className="text-gray-400 text-sm truncate max-w-[180px] block">{getValue() || '—'}</span>
            ),
        },
        {
            accessorKey: 'quotation_date',
            header: 'Date',
            size: 110,
            cell: ({ getValue }) => (
                <span className="text-gray-400 text-sm">
                    {getValue() ? new Date(getValue()).toLocaleDateString('en-GB') : '—'}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            size: 110,
            cell: ({ getValue, row }) => {
                const status = getValue();
                const qId = row.original.id;
                return (
                    <>
                        <select
                            value={status}
                            onClick={e => e.stopPropagation()}
                            onChange={e => handleStatusChange(qId, e.target.value)}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border cursor-pointer bg-black/60 focus:outline-none focus:ring-1 focus:ring-white/20 ${STATUS[status] || STATUS.draft}`}
                        >
                            <option value="draft" className="bg-[#111] text-gray-300">Draft</option>
                            <option value="sent" className="bg-[#111] text-blue-300">Sent</option>
                            <option value="converted" className={`bg-[#111] ${!status === "converted" ? "" : "hidden"} text-green-300`}>Converted</option>
                            <option value="cancelled" className="bg-[#111] text-red-300">Cancelled</option>
                        </select>
                    </>
                );
            },
            filterFn: 'equalsString',
        },
        {
            accessorKey: 'total_amount',
            header: 'Amount',
            size: 140,
            filterFn: numericOperatorFilterFn,
            cell: ({ getValue }) => (
                <span className="font-mono font-bold text-white">
                    {currency} {fmt(getValue())}
                </span>
            ),
        },
        {
            id: 'actions',
            header: 'Actions',
            size: 180,
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => {
                const q = row.original;
                return (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {/* Edit */}
                        <ActionBtn
                            title="Edit"
                            icon={<FiEdit2 size={14} />}
                            onClick={() => router.push(`/dashboard/quotations/${q.id}/edit`)}
                        />
                        {/* Print */}
                        <ActionBtn
                            title="View / Print"
                            icon={<FiPrinter size={14} />}
                            onClick={() => window.open(`/dashboard/quotations/${q.id}`, '_blank')}
                        />
                        {/* Duplicate */}
                        <ActionBtn
                            title="Duplicate"
                            icon={<FiCopy size={14} />}
                            onClick={() => handleDuplicate(q.id)}
                        />
                        {/* Convert to SO */}
                        {q.status !== 'converted' && (
                            <ActionBtn
                                title="Convert to Sales Order"
                                icon={<FiShoppingCart size={14} />}
                                hoverClass="hover:text-emerald-400 hover:bg-emerald-500/10"
                                onClick={() => handleConvert(q.id)}
                            />
                        )}
                        {/* Create Invoice */}
                        {q.status === 'converted' && !q.has_invoice && (
                            <ActionBtn
                                title="Create Invoice"
                                icon={<FiDollarSign size={14} />}
                                hoverClass="hover:text-blue-400 hover:bg-blue-500/10"
                                onClick={() => {
                                    const url = `/dashboard/invoices/new?quotation_id=${q.id}&customer_name=${encodeURIComponent(q.customer_name || '')}&customer_id=${q.customer_id || ''}&amount=${q.total_amount || 0}&description=${encodeURIComponent(q.first_item_name || q.job_description || '')}`;
                                    router.push(url);
                                }}
                            />
                        )}
                        {q.status === 'converted' && !!q.has_invoice && (
                            <span className="p-1.5 text-emerald-500" title="Invoice already created">
                                <FiDollarSign size={14} />
                            </span>
                        )}
                        {/* Delete */}
                        <ActionBtn
                            title="Delete"
                            icon={deleting === q.id ? <span className="text-[10px]">…</span> : <FiTrash2 size={14} />}
                            hoverClass="hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => handleDelete(q.id)}
                            disabled={deleting === q.id}
                        />
                    </div>
                );
            },
        },
    ], [currency, deleting, handleStatusChange]);

    /* ── Table instance ────────────────────────────────────────────────────── */
    const table = useReactTable({
        data,
        columns,
        state: { globalFilter, columnVisibility, columnFilters },
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    });

    const pageCount = table.getPageCount();
    const { pageIndex, pageSize } = table.getState().pagination;

    return (
        <div className="min-h-screen text-white">
            <SalesOrderProgress visible={convertingProgressVisible} progress={convertingProgress} label={convertingLabel} />
            {/* ── Conversion Modal ─────────────────────────────────────────── */}
            {convertingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl shadow-black/80">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                                <FiShoppingCart className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Convert to Sales Order</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Configure stock settings for the new order</p>
                            </div>
                        </div>

                        <div className="my-6 space-y-4">
                            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                                <input
                                    type="radio"
                                    name="autoDeduct"
                                    checked={!autoDeduct}
                                    onChange={() => setAutoDeduct(false)}
                                    className="mt-1 accent-emerald-500"
                                />
                                <div>
                                    <span className="block text-sm font-semibold text-white">Issue stocks manually / partially later</span>
                                    <span className="block text-xs text-gray-400 mt-0.5">Recommended. Create the Sales Order immediately and issue items from the warehouse as they become available.</span>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                                <input
                                    type="radio"
                                    name="autoDeduct"
                                    checked={autoDeduct}
                                    onChange={() => setAutoDeduct(true)}
                                    className="mt-1 accent-emerald-500"
                                />
                                <div>
                                    <span className="block text-sm font-semibold text-white">Auto-deduct stock immediately</span>
                                    <span className="block text-xs text-gray-400 mt-0.5">Deduct all required materials from inventory right now. Fails if there is insufficient stock.</span>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setConvertingId(null)}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitConvert}
                                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-sm font-semibold text-white transition-colors"
                            >
                                Convert
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Stock Shortage Modal ─────────────────────────────────────── */}
            {stockShortages && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-red-500/30 rounded-2xl p-8 w-full max-w-lg shadow-2xl shadow-red-950/40">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                                <FiAlertTriangle className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Insufficient Stock</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Cannot convert — the following items are short</p>
                            </div>
                        </div>
                        <div className="mt-5 rounded-xl overflow-hidden border border-white/[0.07]">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-white/[0.04] border-b border-white/[0.07]">
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Item</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Required</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Available</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-red-500/70">Short</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stockShortages.map((s, i) => (
                                        <tr key={i} className={`border-b border-white/[0.04] ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                    s.type === 'sfg'
                                                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                                        : s.type === 'statics'
                                                        ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                                                        : s.type === 'plate'
                                                        ? 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20'
                                                        : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                                }`}>
                                                    <FiPackage className="w-2.5 h-2.5" />
                                                    {s.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-200 font-medium text-xs">{s.name}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{s.required}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{s.available}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-red-400">{s.shortfall}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-600 mt-4">Restock the items above, then try converting again.</p>
                        <div className="flex justify-end mt-5">
                            <button
                                onClick={() => setStockShortages(null)}
                                className="px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm font-semibold text-white transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Quotations</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {table.getFilteredRowModel().rows.length} of {data.length} records
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    {/* Global search */}
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search all columns…"
                            value={globalFilter}
                            onChange={e => setGlobalFilter(e.target.value)}
                            className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm w-64 outline-none focus:border-white/30 placeholder-gray-600"
                        />
                    </div>
                    <ColumnToggle table={table} />
                    <button
                        onClick={handleExportPDF}
                        disabled={exportingPdf}
                        className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-white/20 hover:text-white transition-colors disabled:opacity-50">
                        <FiDownload className="w-4 h-4" /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
                    </button>
                    <Link href="/dashboard/quotations/new">
                        <button className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors">
                            <FiPlus className="w-4 h-4" /> New Quote
                        </button>
                    </Link>
                </div>
            </header>
            
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Sent Quotations', value: stats.sent, icon: FiClock, color: 'text-blue-400' },
                    { label: 'Converted Quotations', value: stats.converted, icon: FiCheckCircle, color: 'text-emerald-400' },
                    { label: 'Total Coverted Value', value: `${currency} ${fmt(stats.total)}`, icon: FiDollarSign, color: 'text-indigo-400' },
                ].map(s => (
                    <div key={s.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
                        <div className={`p-3 rounded-xl bg-white/5 ${s.color}`}><s.icon className="w-5 h-5" /></div>
                        <div>
                            <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
                            <div className="text-xl font-bold">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Table ──────────────────────────────────────────────────── */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="py-24 text-center text-gray-500 animate-pulse">Loading quotations…</div>
                ) : data.length === 0 ? (
                    <div className="py-24 text-center">
                        <FiFileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500">No quotations found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                {table.getHeaderGroups().map(hg => (
                                    <tr key={hg.id} className="border-b border-white/[0.06]">
                                        {hg.headers.map(header => (
                                            <th
                                                key={header.id}
                                                style={{ width: header.getSize() }}
                                                className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 bg-black/20 select-none"
                                            >
                                                {/* Sort toggle */}
                                                {header.column.getCanSort() ? (
                                                    <button
                                                        onClick={header.column.getToggleSortingHandler()}
                                                        className="flex items-center gap-1 hover:text-white transition-colors"
                                                    >
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                        <SortIcon dir={header.column.getIsSorted()} />
                                                    </button>
                                                ) : (
                                                    flexRender(header.column.columnDef.header, header.getContext())
                                                )}
                                                {/* Per-column filter */}
                                                {header.column.getCanFilter() && (
                                                    <ColumnFilter column={header.column} />
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row, i) => (
                                    <tr
                                        key={row.id}
                                        onClick={() => router.push(`/dashboard/quotations/${row.original.id}/edit`)}
                                        className={`border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
                                    >
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="px-4 py-3.5 align-middle">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Pagination bar ──────────────────────────────────────── */}
                {!loading && data.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-black/20 flex-wrap gap-3">
                        {/* Page size */}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={e => table.setPageSize(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-gray-300 outline-none"
                            >
                                {[10, 15, 25, 50, 100].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>

                        {/* Info */}
                        <span className="text-xs text-gray-500">
                            Page <strong className="text-gray-300">{pageIndex + 1}</strong> of{' '}
                            <strong className="text-gray-300">{pageCount || 1}</strong>
                            {' · '}
                            {table.getFilteredRowModel().rows.length} results
                        </span>

                        {/* Page controls */}
                        <div className="flex items-center gap-1">
                            <PagBtn onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} title="First">
                                <FiChevronsLeft className="w-3.5 h-3.5" />
                            </PagBtn>
                            <PagBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} title="Prev">
                                <FiChevronLeft className="w-3.5 h-3.5" />
                            </PagBtn>

                            {/* Page number pills */}
                            {Array.from({ length: pageCount }, (_, i) => i)
                                .filter(i => Math.abs(i - pageIndex) <= 2)
                                .map(i => (
                                    <button
                                        key={i}
                                        onClick={() => table.setPageIndex(i)}
                                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${i === pageIndex
                                            ? 'bg-white text-black'
                                            : 'text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))
                            }

                            <PagBtn onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} title="Next">
                                <FiChevronRight className="w-3.5 h-3.5" />
                            </PagBtn>
                            <PagBtn onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()} title="Last">
                                <FiChevronsRight className="w-3.5 h-3.5" />
                            </PagBtn>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function ActionBtn({ icon, onClick, title, hoverClass = 'hover:text-white hover:bg-white/10', disabled = false }) {
    return (
        <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            disabled={disabled}
            title={title}
            className={`p-1.5 rounded-lg text-gray-500 transition-colors disabled:opacity-40 ${hoverClass}`}
        >
            {icon}
        </button>
    );
}

function PagBtn({ children, onClick, disabled, title }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
            {children}
        </button>
    );
}
