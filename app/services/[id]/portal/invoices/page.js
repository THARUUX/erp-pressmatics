'use client';

import { use, useEffect, useState, useMemo, useCallback } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FiSearch, FiEye, FiTrash2,
    FiAlertCircle, FiCheckCircle, FiClock,
    FiChevronUp, FiChevronDown, FiChevronsLeft, FiChevronLeft,
    FiChevronRight, FiChevronsRight, FiFileText, FiDownload, FiExternalLink,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { numericOperatorFilterFn } from '@/lib/numericFilter';

const STATUS_CONFIG = {
    draft:   { label: 'Draft',    color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
    sent:    { label: 'Sent',     color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    partial: { label: 'Partial',  color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    paid:    { label: 'Paid',     color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    overdue: { label: 'Overdue',  color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${cfg.color}`}>
            {cfg.label}
        </span>
    );
}

function SortIcon({ dir }) {
    if (!dir) return <span className="opacity-20 text-xs">⇅</span>;
    return dir === 'asc' ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />;
}

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

function PagBtn({ children, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
            {children}
        </button>
    );
}

const FILTER_TABS = ['all', 'draft', 'sent', 'partial', 'overdue', 'paid'];

export default function PortalInvoicesPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const currency = 'LKR';

    const [data, setData]                 = useState([]);
    const [stats, setStats]               = useState({});
    const [loading, setLoading]           = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnVisibility, setColumnVisibility] = useState({});
    const [columnFilters, setColumnFilters] = useState([]);
    const [exportingPdf, setExportingPdf] = useState(false);

    // Custom Modal Delete state
    const [deleteModal, setDeleteModal]   = useState(null);
    const [deleting, setDeleting]         = useState(false);

    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: 500, status: statusFilter, service_id: id });
            const res = await fetch(`/api/invoices?${params}`);
            const d = await res.json();
            setData(Array.isArray(d.invoices) ? d.invoices : []);
            setStats(d.stats || {});
        } catch (e) {
            console.error('Failed to load portal invoices:', e);
            toast.error('Failed to load invoices');
        } finally {
            setLoading(false);
        }
    }, [id, statusFilter]);

    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    const confirmDeleteInvoice = async () => {
        if (!deleteModal) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/invoices/${deleteModal.id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(`Invoice ${deleteModal.code || '#' + deleteModal.id} deleted`);
                setData(prev => prev.filter(inv => inv.id !== deleteModal.id));
                setDeleteModal(null);
                loadInvoices();
            } else {
                toast.error('Failed to delete invoice');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error deleting invoice');
        } finally {
            setDeleting(false);
        }
    };

    const handleExportPDF = async () => {
        setExportingPdf(true);
        try {
            const visibleCols = table.getVisibleLeafColumns()
                .filter(col => col.id !== 'actions')
                .map(col => ({
                    key: col.id || col.columnDef.accessorKey,
                    header: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
                }));

            const filteredRows = table.getFilteredRowModel().rows.map(row => row.original);

            const res = await fetch('/api/pdf/dynamic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Service Portal Invoices Report',
                    subtitle: `Exported Invoices List for Service #${id}`,
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
            a.download = `service_${id}_invoices_${new Date().toISOString().slice(0, 10)}.pdf`;
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

    const fmt = n => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    const columns = useMemo(() => [
        {
            accessorKey: 'code',
            header: 'Invoice Code',
            size: 130,
            cell: ({ getValue }) => <span className="font-mono text-xs font-bold text-indigo-400">{getValue()}</span>,
        },
        {
            accessorKey: 'customer_name',
            header: 'Customer',
            cell: ({ getValue }) => <span className="font-semibold text-white">{getValue()}</span>,
        },
        {
            accessorKey: 'quotation_code',
            header: 'Quotation',
            size: 120,
            cell: ({ getValue }) => getValue()
                ? <span className="text-xs text-zinc-400 font-mono">{getValue()}</span>
                : <span className="text-zinc-600 text-xs">—</span>,
        },
        {
            accessorKey: 'amount_due',
            header: 'Amount Due',
            size: 140,
            filterFn: numericOperatorFilterFn,
            cell: ({ getValue }) => <span className="font-mono font-medium">{currency} {fmt(getValue())}</span>,
        },
        {
            accessorKey: 'amount_paid',
            header: 'Paid',
            size: 140,
            filterFn: numericOperatorFilterFn,
            cell: ({ getValue }) => <span className="font-mono text-emerald-400 font-medium">{currency} {fmt(getValue())}</span>,
        },
        {
            accessorKey: 'balance',
            header: 'Balance',
            size: 140,
            filterFn: numericOperatorFilterFn,
            cell: ({ getValue }) => <span className="font-mono text-amber-300 font-bold">{currency} {fmt(getValue())}</span>,
        },
        {
            accessorKey: 'due_date',
            header: 'Due Date',
            size: 120,
            cell: ({ getValue }) => (
                <span className="text-zinc-400 text-xs">
                    {getValue() ? new Date(getValue()).toLocaleDateString('en-GB') : '—'}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            size: 110,
            cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        },
        {
            id: 'actions',
            header: 'Actions',
            size: 100,
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => {
                const inv = row.original;
                return (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <Link
                            href={`/dashboard/invoices/${inv.id}`}
                            target="_blank"
                            title="Open in Main ERP"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors inline-flex"
                        >
                            <FiExternalLink size={13} />
                        </Link>
                        <button
                            onClick={() => setDeleteModal(inv)}
                            title="Delete Invoice"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        >
                            <FiTrash2 size={13} />
                        </button>
                    </div>
                );
            },
        },
    ], [currency]);

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

    const { pageIndex, pageSize } = table.getState().pagination;
    const pageCount = table.getPageCount();

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <p className="text-xs text-indigo-400 uppercase tracking-widest font-semibold">Service Finance</p>
                    <h1 className="text-3xl font-bold tracking-tight text-white mt-0.5">Invoices Directory</h1>
                    <p className="text-zinc-400 text-xs mt-1">
                        Showing {table.getFilteredRowModel().rows.length} of {data.length} invoices associated with this service.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2.5 items-center">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                        <input
                            value={globalFilter}
                            onChange={e => setGlobalFilter(e.target.value)}
                            placeholder="Search invoices…"
                            className="bg-zinc-900 border border-zinc-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white w-56 outline-none focus:border-indigo-500 placeholder-zinc-500"
                        />
                    </div>
                    <ColumnToggle table={table} />
                    <button
                        onClick={handleExportPDF}
                        disabled={exportingPdf}
                        className="flex items-center gap-2 bg-zinc-900 border border-zinc-700/80 text-zinc-300 px-3.5 py-2 rounded-xl text-xs font-semibold hover:border-zinc-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <FiDownload className="w-3.5 h-3.5" /> {exportingPdf ? 'Exporting…' : 'Export PDF'}
                    </button>
                    <Link href="/dashboard/invoices/new" target="_blank">
                        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer">
                            + New Invoice
                        </button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Total Outstanding', value: fmt(stats.outstanding), icon: FiClock, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/10' },
                    { label: 'Overdue Balance',   value: fmt(stats.overdue),     icon: FiAlertCircle, color: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/10' },
                    { label: 'Collected (Month)', value: fmt(stats.collected_month), icon: FiCheckCircle, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10' },
                ].map(s => (
                    <div key={s.label} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg backdrop-blur-sm">
                        <div className={`p-3 rounded-xl border ${s.bg} ${s.border} ${s.color}`}>
                            <s.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs text-zinc-400 font-medium mb-0.5">{s.label}</div>
                            <div className="text-xl font-bold text-white font-mono">{currency} {s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Table Container */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
                {/* Status Filter Tabs */}
                <div className="flex flex-wrap gap-1 px-4 pt-4 pb-2 border-b border-zinc-800/80 bg-zinc-950/40">
                    {FILTER_TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setStatusFilter(tab)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize cursor-pointer ${
                                statusFilter === tab
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="py-24 text-center text-zinc-400 animate-pulse text-xs">Loading service invoices…</div>
                ) : data.length === 0 ? (
                    <div className="py-24 text-center">
                        <FiFileText className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                        <p className="text-zinc-400 text-sm font-medium">No invoices found for this service</p>
                        <Link href="/dashboard/invoices/new" target="_blank" className="text-indigo-400 text-xs mt-2 inline-block hover:underline font-semibold">
                            Create an invoice in main ERP →
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                {table.getHeaderGroups().map(hg => (
                                    <tr key={hg.id} className="border-b border-zinc-800/80 bg-zinc-950/50">
                                        {hg.headers.map(h => (
                                            <th
                                                key={h.id}
                                                style={{ width: h.getSize() }}
                                                className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 select-none"
                                            >
                                                {h.column.getCanSort() ? (
                                                    <button
                                                        onClick={h.column.getToggleSortingHandler()}
                                                        className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        {flexRender(h.column.columnDef.header, h.getContext())}
                                                        <SortIcon dir={h.column.getIsSorted()} />
                                                    </button>
                                                ) : flexRender(h.column.columnDef.header, h.getContext())}
                                                {h.column.getCanFilter() && <ColumnFilter column={h.column} />}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {table.getRowModel().rows.map((row, i) => (
                                    <tr
                                        key={row.id}
                                        className={`hover:bg-zinc-800/40 transition-colors ${i % 2 === 1 ? 'bg-zinc-900/40' : ''}`}
                                    >
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="px-4 py-3 align-middle text-xs">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Table Footer / Pagination */}
                {!loading && data.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/80 bg-zinc-950/40 flex-wrap gap-3 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                            <span>Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={e => table.setPageSize(Number(e.target.value))}
                                className="bg-zinc-900 border border-zinc-700/80 rounded px-2 py-1 text-zinc-200 outline-none cursor-pointer"
                            >
                                {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <span>
                            Page <strong className="text-white">{pageIndex + 1}</strong> of <strong className="text-white">{pageCount || 1}</strong>
                            {' · '}{table.getFilteredRowModel().rows.length} total results
                        </span>
                        <div className="flex items-center gap-1">
                            <PagBtn onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><FiChevronsLeft className="w-3.5 h-3.5" /></PagBtn>
                            <PagBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><FiChevronLeft className="w-3.5 h-3.5" /></PagBtn>
                            {Array.from({ length: pageCount }, (_, i) => i)
                                .filter(i => Math.abs(i - pageIndex) <= 2)
                                .map(i => (
                                    <button
                                        key={i}
                                        onClick={() => table.setPageIndex(i)}
                                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                            i === pageIndex ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                        }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            <PagBtn onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><FiChevronRight className="w-3.5 h-3.5" /></PagBtn>
                            <PagBtn onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}><FiChevronsRight className="w-3.5 h-3.5" /></PagBtn>
                        </div>
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
                                <h3 className="text-base font-bold text-white">Delete Invoice</h3>
                                <p className="text-xs text-zinc-400 font-mono mt-0.5">{deleteModal.code || `#${deleteModal.id}`}</p>
                            </div>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                            Are you sure you want to delete invoice <strong className="text-white">{deleteModal.code || `#${deleteModal.id}`}</strong> for <strong className="text-white">{deleteModal.customer_name}</strong>?
                            <br /><br />
                            <span className="text-rose-400 font-semibold">Warning:</span> This action cannot be undone.
                        </p>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModal(null)}
                                disabled={deleting}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteInvoice}
                                disabled={deleting}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white shadow-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                            >
                                {deleting ? 'Deleting…' : 'Yes, Delete Invoice'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
