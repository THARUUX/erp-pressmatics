'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/components/SettingsContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import toast from 'react-hot-toast';
import {
    FiSearch, FiPrinter, FiTrash2, FiFileText, FiDownload,
    FiChevronUp, FiChevronDown, FiChevronsLeft, FiChevronLeft,
    FiChevronRight, FiChevronsRight, FiClock, FiCheckCircle, FiDollarSign,
} from 'react-icons/fi';
import { numericOperatorFilterFn } from '@/lib/numericFilter';

/* ── Status badge ─────────────────────────────────────────────────────────── */
const STATUS_COLORS = {
    'Pending':       'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'In Production': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Ready':         'bg-green-500/20 text-green-300 border-green-500/30',
    'Delivered':     'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'Cancelled':     'bg-red-500/20 text-red-300 border-red-500/30',
};
function StatusBadge({ status }) {
    const cls = STATUS_COLORS[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
            {status}
        </span>
    );
}

/* ── Shared micro-components ──────────────────────────────────────────────── */
function SortIcon({ dir }) {
    if (!dir) return <span className="opacity-20 text-xs">⇅</span>;
    return dir === 'asc' ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />;
}

function ColFilter({ column }) {
    const val = column.getFilterValue() ?? '';
    return (
        <input value={val} onChange={e => column.setFilterValue(e.target.value)}
            placeholder="Filter…"
            onClick={e => e.stopPropagation()}
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

const STATUS_TABS = ['All', 'Pending', 'In Production', 'Ready', 'Delivered', 'Cancelled'];

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function SalesOrdersPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';

    const [data, setData]             = useState([]);
    const [stats, setStats]           = useState({ pending_count: 0, production_count: 0, pending_total: 0 });
    const [loading, setLoading]       = useState(true);
    const [statusFilter, setStatus]   = useState('All');
    const [globalFilter, setGlobal]   = useState('');
    const [columnVisibility, setColVis] = useState({});
    const [columnFilters, setColumnFilters] = useState([]);
    const [exportingPdf, setExportingPdf] = useState(false);

    /* fetch all — TanStack handles pagination/sort/filter client-side */
    const fetchAll = useCallback(() => {
        setLoading(true);
        let url = '/api/sales-orders?limit=500&offset=0';
        if (statusFilter !== 'All') url += `&status=${encodeURIComponent(statusFilter)}`;
        fetch(url)
            .then(r => r.json())
            .then(d => {
                setData(Array.isArray(d.salesOrders) ? d.salesOrders : []);
                setStats(d.stats || { pending_count: 0, production_count: 0, pending_total: 0 });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [statusFilter]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!(await confirmDialog('Delete this sales order? This cannot be undone.', { danger: true, confirmLabel: 'Delete' }))) return;
        const res = await fetch(`/api/sales-orders/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Sales order deleted'); fetchAll(); }
        else toast.error('Failed to delete');
    };

    const fmt = n => `${currency} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

    /* ── PDF export ─────────────────────────────────────────────────────── */
    const exportToPDF = async () => {
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
                    title: 'Sales Orders Directory Report',
                    subtitle: 'Exported Sales Orders (Customized & Filtered)',
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
            a.download = `sales_orders_report_${new Date().toISOString().slice(0, 10)}.pdf`;
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

    /* ── Column definitions ─────────────────────────────────────────────── */
    const columns = useMemo(() => [
        {
            accessorKey: 'code', header: 'SO Code', size: 120,
            cell: ({ getValue }) => (
                <span className="font-mono text-xs text-blue-400 bg-blue-500/5 border border-blue-500/20 px-2 py-0.5 rounded">
                    {getValue()}
                </span>
            ),
        },
        {
            accessorKey: 'customer_name', header: 'Customer',
            cell: ({ getValue }) => <span className="font-semibold text-white">{getValue()}</span>,
        },
        {
            accessorKey: 'estimation_names', header: 'Jobs',
            cell: ({ getValue }) => (
                <span className="text-gray-400 text-xs truncate max-w-[200px] block">{getValue() || '—'}</span>
            ),
        },
        {
            accessorKey: 'status', header: 'Status', size: 130,
            cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        },
        {
            accessorKey: 'total_amount', header: 'Amount', size: 150,
            filterFn: numericOperatorFilterFn,
            cell: ({ getValue }) => (
                <span className="font-mono font-bold text-white">{fmt(getValue())}</span>
            ),
        },
        {
            accessorKey: 'order_date', header: 'Order Date', size: 110,
            cell: ({ getValue }) => <span className="text-gray-500 text-xs">{fmtDate(getValue())}</span>,
        },
        {
            accessorKey: 'delivery_date', header: 'Delivery', size: 110,
            cell: ({ getValue }) => getValue()
                ? <span className="text-orange-300 text-xs">{fmtDate(getValue())}</span>
                : <span className="text-gray-700 text-xs">—</span>,
        },
        {
            id: 'actions', header: 'Actions', size: 90,
            enableSorting: false, enableColumnFilter: false,
            cell: ({ row }) => {
                const o = row.original;
                return (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={e => { e.stopPropagation(); window.open(`/dashboard/sales-orders/${o.id}`, '_blank'); }}
                            title="View / Print"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                            <FiPrinter size={14} />
                        </button>
                        <button onClick={e => handleDelete(e, o.id)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <FiTrash2 size={14} />
                        </button>
                    </div>
                );
            },
        },
    ], [currency]);

    /* ── Table instance ─────────────────────────────────────────────────── */
    const table = useReactTable({
        data, columns,
        state: { globalFilter, columnVisibility, columnFilters },
        onGlobalFilterChange: setGlobal,
        onColumnVisibilityChange: setColVis,
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
        <div className="text-white">
            {/* ── Header ────────────────────────────────────────────────── */}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Sales Orders</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {table.getFilteredRowModel().rows.length} of {data.length} orders
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input value={globalFilter} onChange={e => setGlobal(e.target.value)}
                            placeholder="Search all columns…"
                            className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm w-64 outline-none focus:border-white/30 placeholder-gray-600" />
                    </div>
                    <ColumnToggle table={table} />
                    <button onClick={exportToPDF}
                        disabled={exportingPdf}
                        className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-white/20 hover:text-white transition-colors disabled:opacity-50">
                        <FiDownload className="w-4 h-4" /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
                    </button>
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Pending Orders', value: Number(stats.pending_count || 0), icon: FiClock, color: 'text-blue-400' },
                    { label: 'In Production', value: Number(stats.production_count || 0), icon: FiCheckCircle, color: 'text-emerald-400' },
                    { label: 'Pending Total Value', value: Number(stats.pending_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }), icon: FiDollarSign, color: 'text-indigo-400' },
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

            {/* ── Status tabs ───────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-1 mb-4">
                {STATUS_TABS.map(s => (
                    <button key={s} onClick={() => setStatus(s)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${statusFilter === s ? 'bg-white text-black' : 'bg-black/30 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}>
                        {s}
                    </button>
                ))}
            </div>

            {/* ── Table ─────────────────────────────────────────────────── */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="py-24 text-center text-gray-500 animate-pulse">Loading sales orders…</div>
                ) : data.length === 0 ? (
                    <div className="py-24 text-center">
                        <FiFileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500">No sales orders found</p>
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
                                                {h.column.getCanFilter() && <ColFilter column={h.column} />}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row, i) => (
                                    <tr key={row.id}
                                        onClick={() => router.push(`/dashboard/sales-orders/${row.original.id}`)}
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

                {/* ── Pagination ─────────────────────────────────────────── */}
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
                            Page <strong className="text-gray-300">{pageIndex + 1}</strong> of{' '}
                            <strong className="text-gray-300">{pageCount || 1}</strong>
                            {' · '}{table.getFilteredRowModel().rows.length} results
                        </span>
                        <div className="flex items-center gap-1">
                            <PagBtn onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><FiChevronsLeft className="w-3.5 h-3.5" /></PagBtn>
                            <PagBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><FiChevronLeft className="w-3.5 h-3.5" /></PagBtn>
                            {Array.from({ length: pageCount }, (_, i) => i)
                                .filter(i => Math.abs(i - pageIndex) <= 2)
                                .map(i => (
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
