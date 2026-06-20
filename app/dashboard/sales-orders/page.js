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
    FiChevronRight, FiChevronsRight,
} from 'react-icons/fi';

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
    const [loading, setLoading]       = useState(true);
    const [statusFilter, setStatus]   = useState('All');
    const [globalFilter, setGlobal]   = useState('');
    const [columnVisibility, setColVis] = useState({});

    /* fetch all — TanStack handles pagination/sort/filter client-side */
    const fetchAll = useCallback(() => {
        setLoading(true);
        let url = '/api/sales-orders?limit=500&offset=0';
        if (statusFilter !== 'All') url += `&status=${encodeURIComponent(statusFilter)}`;
        fetch(url)
            .then(r => r.json())
            .then(d => { setData(Array.isArray(d.salesOrders) ? d.salesOrders : []); setLoading(false); })
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
    const exportToPDF = () => {
        const rows = table.getFilteredRowModel().rows;
        const totalAmt = rows.reduce((sum, r) => sum + Number(r.original.total_amount || 0), 0);
        const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const filterDesc = [statusFilter !== 'All' && `Status: ${statusFilter}`, globalFilter && `Search: "${globalFilter}"`].filter(Boolean).join(' · ') || 'All orders';

        const STATUS_PRINT = {
            'Pending': '#d97706',
            'In Production': '#3b82f6',
            'Ready': '#22c55e',
            'Delivered': '#a855f7',
            'Cancelled': '#ef4444',
        };

        const rowsHTML = rows.map((row, i) => {
            const o = row.original;
            const statusColor = STATUS_PRINT[o.status] || '#6b7280';
            return `
                <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                    <td style="padding:8px 10px;font-family:monospace;font-size:11px;color:#2563eb;border-bottom:1px solid #e5e7eb">${o.code || ''}</td>
                    <td style="padding:8px 10px;font-weight:600;border-bottom:1px solid #e5e7eb">${o.customer_name || ''}</td>
                    <td style="padding:8px 10px;font-size:11px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-bottom:1px solid #e5e7eb">${o.estimation_names || '—'}</td>
                    <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">
                        <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}55">${o.status || ''}</span>
                    </td>
                    <td style="padding:8px 10px;font-family:monospace;font-weight:700;text-align:right;border-bottom:1px solid #e5e7eb">${fmt(o.total_amount)}</td>
                    <td style="padding:8px 10px;font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb">${fmtDate(o.order_date)}</td>
                    <td style="padding:8px 10px;font-size:11px;color:#f97316;border-bottom:1px solid #e5e7eb">${fmtDate(o.delivery_date)}</td>
                </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Sales Orders Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; background: #fff; padding: 32px; }
  @page { size: A4 landscape; margin: 20mm 15mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  .header { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .title { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .subtitle { font-size: 12px; color: #6b7280; margin-top: 4px; }
  .meta { text-align: right; font-size: 11px; color: #6b7280; line-height: 1.6; }
  .stats { display: flex; gap: 24px; margin-bottom: 20px; }
  .stat { background: #f3f4f6; border-radius: 10px; padding: 12px 20px; }
  .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: .8px; color: #9ca3af; margin-bottom: 4px; }
  .stat-value { font-size: 18px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #111; color: #fff; }
  thead th { padding: 10px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .8px; white-space: nowrap; }
  thead th:last-child { text-align: right; }
  tbody tr:hover { background: #f0f9ff; }
  .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #111; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>
<div class="header">
  <div>
    <div class="title">Sales Orders Report</div>
    <div class="subtitle">Filter: ${filterDesc}</div>
  </div>
  <div class="meta">
    Generated: ${now}<br/>
    Total shown: ${rows.length} order${rows.length !== 1 ? 's' : ''}
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-label">Total Orders</div><div class="stat-value">${rows.length}</div></div>
  <div class="stat"><div class="stat-label">Total Amount</div><div class="stat-value">${fmt(totalAmt)}</div></div>
  <div class="stat"><div class="stat-label">Filter Applied</div><div class="stat-value" style="font-size:13px">${filterDesc}</div></div>
</div>
<table>
  <thead><tr>
    <th>SO Code</th><th>Customer</th><th>Jobs</th><th>Status</th><th style="text-align:right">Amount</th><th>Order Date</th><th>Delivery</th>
  </tr></thead>
  <tbody>${rowsHTML}</tbody>
  <tfoot><tr style="background:#f3f4f6;font-weight:700">
    <td colspan="4" style="padding:10px;border-top:2px solid #111">Total (${rows.length} orders)</td>
    <td style="padding:10px;font-family:monospace;text-align:right;border-top:2px solid #111">${fmt(totalAmt)}</td>
    <td colspan="2" style="border-top:2px solid #111"></td>
  </tr></tfoot>
</table>
<div class="footer">
  <span>Pressmatics ERP · Sales Orders Report</span>
  <span>${now}</span>
</div>
<script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
</body></html>`;

        const win = window.open('', '_blank', 'width=1100,height=800');
        win.document.write(html);
        win.document.close();
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
        state: { globalFilter, columnVisibility },
        onGlobalFilterChange: setGlobal,
        onColumnVisibilityChange: setColVis,
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
                        className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-white/20 hover:text-white transition-colors">
                        <FiDownload className="w-4 h-4" /> Export PDF
                    </button>
                </div>
            </header>

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
