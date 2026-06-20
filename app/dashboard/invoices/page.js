'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FiPlus, FiSearch, FiEye, FiTrash2,
    FiAlertCircle, FiCheckCircle, FiClock,
    FiChevronUp, FiChevronDown, FiChevronsLeft, FiChevronLeft,
    FiChevronRight, FiChevronsRight, FiFileText,
} from 'react-icons/fi';
import { useSettings } from '@/components/SettingsContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { ColumnToggle } from '@/components/ui/ColumnToggle';

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
        <input value={val} onChange={e => column.setFilterValue(e.target.value)} placeholder="Filter…"
            className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/30" />
    );
}
function PagBtn({ children, onClick, disabled }) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            {children}
        </button>
    );
}

const FILTER_TABS = ['all', 'draft', 'sent', 'partial', 'overdue', 'paid'];

export default function InvoicesPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';

    const [data, setData]           = useState([]);
    const [stats, setStats]         = useState({});
    const [loading, setLoading]     = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnVisibility, setColumnVisibility] = useState({});
    const [deletingId, setDeletingId] = useState(null);

    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: 500, status: statusFilter });
            const res = await fetch(`/api/invoices?${params}`);
            const d = await res.json();
            setData(Array.isArray(d.invoices) ? d.invoices : []);
            setStats(d.stats || {});
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [statusFilter]);

    useEffect(() => { loadInvoices(); }, [loadInvoices]);

    const handleDelete = async (id, code) => {
        if (!(await confirmDialog(`Delete invoice ${code}? This cannot be undone.`, { danger: true, confirmLabel: 'Delete' }))) return;
        setDeletingId(id);
        await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
        setDeletingId(null);
        toast.success('Invoice deleted');
        loadInvoices();
    };

    const fmt = n => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    const columns = useMemo(() => [
        {
            accessorKey: 'code', header: 'Invoice', size: 120,
            cell: ({ getValue }) => <span className="font-mono text-xs text-blue-400">{getValue()}</span>,
        },
        {
            accessorKey: 'customer_name', header: 'Customer',
            cell: ({ getValue }) => <span className="font-semibold text-white">{getValue()}</span>,
        },
        {
            accessorKey: 'quotation_code', header: 'Quotation', size: 110,
            cell: ({ getValue }) => getValue()
                ? <span className="text-xs text-gray-400 font-mono">{getValue()}</span>
                : <span className="text-gray-600 text-xs">—</span>,
        },
        {
            accessorKey: 'amount_due', header: 'Amount Due', size: 130,
            cell: ({ getValue }) => <span className="font-mono">{currency} {fmt(getValue())}</span>,
        },
        {
            accessorKey: 'amount_paid', header: 'Paid', size: 130,
            cell: ({ getValue }) => <span className="font-mono text-emerald-400">{currency} {fmt(getValue())}</span>,
        },
        {
            accessorKey: 'balance', header: 'Balance', size: 130,
            cell: ({ getValue }) => <span className="font-mono text-amber-300 font-semibold">{currency} {fmt(getValue())}</span>,
        },
        {
            accessorKey: 'due_date', header: 'Due Date', size: 110,
            cell: ({ getValue }) => (
                <span className="text-gray-400 text-xs">
                    {getValue() ? new Date(getValue()).toLocaleDateString('en-GB') : '—'}
                </span>
            ),
        },
        {
            accessorKey: 'status', header: 'Status', size: 110,
            cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        },
        {
            id: 'actions', header: 'Actions', size: 100,
            enableSorting: false, enableColumnFilter: false,
            cell: ({ row }) => {
                const inv = row.original;
                return (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                            title="View" className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                            <FiEye size={14} />
                        </button>
                        <button
                            onClick={() => handleDelete(inv.id, inv.code)}
                            disabled={deletingId === inv.id}
                            title="Delete"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                            <FiTrash2 size={14} />
                        </button>
                    </div>
                );
            },
        },
    ], [currency, deletingId]);

    const table = useReactTable({
        data, columns,
        state: { globalFilter, columnVisibility },
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    });

    const { pageIndex, pageSize } = table.getState().pagination;
    const pageCount = table.getPageCount();

    return (
        <div className="min-h-screen text-white">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Finance</p>
                    <h1 className="text-3xl font-bold tracking-tighter">Invoices</h1>
                    <p className="text-gray-500 text-sm mt-0.5">{table.getFilteredRowModel().rows.length} of {data.length} records</p>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
                            placeholder="Search invoices…"
                            className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm w-60 outline-none focus:border-white/30 placeholder-gray-600" />
                    </div>
                    <ColumnToggle table={table} />
                    <Link href="/dashboard/invoices/new">
                        <button className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors">
                            <FiPlus className="w-4 h-4" /> New Invoice
                        </button>
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Outstanding', value: fmt(stats.outstanding), icon: FiClock, color: 'text-amber-400' },
                    { label: 'Overdue Balance',   value: fmt(stats.overdue),     icon: FiAlertCircle, color: 'text-red-400' },
                    { label: 'Collected (Month)', value: fmt(stats.collected_month), icon: FiCheckCircle, color: 'text-emerald-400' },
                ].map(s => (
                    <div key={s.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
                        <div className={`p-3 rounded-xl bg-white/5 ${s.color}`}><s.icon className="w-5 h-5" /></div>
                        <div>
                            <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
                            <div className="text-xl font-bold">{currency} {s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {/* Status filter tabs */}
                <div className="flex flex-wrap gap-1 px-4 pt-4 pb-2 border-b border-white/[0.06]">
                    {FILTER_TABS.map(tab => (
                        <button key={tab} onClick={() => setStatusFilter(tab)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                                statusFilter === tab ? 'bg-white text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}>
                            {tab}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="py-24 text-center text-gray-500 animate-pulse">Loading invoices…</div>
                ) : data.length === 0 ? (
                    <div className="py-24 text-center">
                        <FiFileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">No invoices found</p>
                        <Link href="/dashboard/invoices/new" className="text-blue-400 text-xs mt-2 inline-block hover:underline">
                            Create your first invoice →
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                {table.getHeaderGroups().map(hg => (
                                    <tr key={hg.id} className="border-b border-white/[0.06]">
                                        {hg.headers.map(h => (
                                            <th key={h.id} style={{ width: h.getSize() }}
                                                className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 bg-black/20 select-none">
                                                {h.column.getCanSort() ? (
                                                    <button onClick={h.column.getToggleSortingHandler()}
                                                        className="flex items-center gap-1 hover:text-white transition-colors">
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
                            <tbody>
                                {table.getRowModel().rows.map((row, i) => (
                                    <tr key={row.id}
                                        onClick={() => router.push(`/dashboard/invoices/${row.original.id}`)}
                                        className={`border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.04] ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
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

                {!loading && data.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-black/20 flex-wrap gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Rows:</span>
                            <select value={pageSize} onChange={e => table.setPageSize(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-gray-300 outline-none">
                                {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <span className="text-xs text-gray-500">
                            Page <strong className="text-gray-300">{pageIndex + 1}</strong> of <strong className="text-gray-300">{pageCount || 1}</strong>
                            {' · '}{table.getFilteredRowModel().rows.length} results
                        </span>
                        <div className="flex items-center gap-1">
                            <PagBtn onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><FiChevronsLeft className="w-3.5 h-3.5" /></PagBtn>
                            <PagBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><FiChevronLeft className="w-3.5 h-3.5" /></PagBtn>
                            {Array.from({ length: pageCount }, (_, i) => i).filter(i => Math.abs(i - pageIndex) <= 2).map(i => (
                                <button key={i} onClick={() => table.setPageIndex(i)}
                                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${i === pageIndex ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/10'}`}>
                                    {i + 1}
                                </button>
                            ))}
                            <PagBtn onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><FiChevronRight className="w-3.5 h-3.5" /></PagBtn>
                            <PagBtn onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}><FiChevronsRight className="w-3.5 h-3.5" /></PagBtn>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
