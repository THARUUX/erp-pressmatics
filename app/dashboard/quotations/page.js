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
    FiEdit2, FiFileText,
} from 'react-icons/fi';
import { useSettings } from '@/components/SettingsContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { ColumnToggle } from '@/components/ui/ColumnToggle';

/* ── Status badge ─────────────────────────────────────────────────────────── */
const STATUS = {
    draft:     'bg-gray-500/20 text-gray-300 border-gray-500/30',
    converted: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
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
    const [loading, setLoading]     = useState(true);
    const [deleting, setDeleting]   = useState(null);
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnVisibility, setColumnVisibility] = useState({});

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

    const handleConvert = async (id) => {
        if (!(await confirmDialog("Convert to Sales Order? Stock will be deducted and this can't be undone.", {
            danger: true, confirmLabel: 'Convert',
        }))) return;
        try {
            const res = await fetch('/api/sales-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quotation_id: id }),
            });
            const d = await res.json();
            if (res.ok) { toast.success('Sales Order created!'); fetchAll(); }
            else toast.error('Failed to convert: ' + (d.error || 'Unknown error'));
        } catch { toast.error('Error converting to sales order'); }
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
            cell: ({ getValue }) => <StatusBadge status={getValue()} />,
            filterFn: 'equalsString',
        },
        {
            accessorKey: 'total_amount',
            header: 'Amount',
            size: 140,
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
    ], [currency, deleting]);

    /* ── Table instance ────────────────────────────────────────────────────── */
    const table = useReactTable({
        data,
        columns,
        state: { globalFilter, columnVisibility },
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
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
                    <Link href="/dashboard/quotations/new">
                        <button className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors">
                            <FiPlus className="w-4 h-4" /> New Quote
                        </button>
                    </Link>
                </div>
            </header>

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
