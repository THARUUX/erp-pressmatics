'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { FiSearch, FiChevronUp, FiChevronDown, FiChevronLeft, FiChevronRight, FiEye, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

const SO_STATUS = {
    Pending:       { class: 'bg-amber-500/10 text-amber-300 border-amber-500/20 font-medium', label: 'Pending' },
    'In Production': { class: 'bg-blue-500/10 text-blue-300 border-blue-500/20 font-semibold', label: 'In Production' },
    Ready:         { class: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 font-bold', label: 'Ready' },
    Delivered:     { class: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-bold', label: 'Delivered' },
    Cancelled:     { class: 'bg-rose-500/10 text-rose-300 border-rose-500/20', label: 'Cancelled' },
};

const STATUS_TABS = ['All', 'Pending', 'In Production', 'Ready', 'Delivered', 'Cancelled'];

function StatusSelect({ soId, current, onUpdated }) {
    const [updating, setUpdating] = useState(false);
    const handle = async (e) => {
        const newStatus = e.target.value;
        setUpdating(true);
        try {
            const res = await fetch(`/api/sales-orders/${soId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) { onUpdated(soId, newStatus); toast.success('Status updated'); }
            else toast.error('Failed to update status');
        } catch { toast.error('Error'); }
        finally { setUpdating(false); }
    };
    return (
        <select value={current} onChange={handle} disabled={updating}
            className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer disabled:opacity-50 font-medium">
            {Object.keys(SO_STATUS).map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
        </select>
    );
}

export default function PortalSalesOrdersPage({ params }) {
    const { id } = use(params);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([{ id: 'created_at', desc: true }]);
    const [statusTab, setStatusTab] = useState('All');
    const [deleteConfirmSO, setDeleteConfirmSO] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/services/${id}/sales-orders`);
            const d = await res.json();
            const all = Array.isArray(d.salesOrders) ? d.salesOrders : (Array.isArray(d.orders) ? d.orders : (Array.isArray(d) ? d : []));
            setOrders(all);
        } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const handleStatusUpdate = useCallback((soId, newStatus) => {
        setOrders(prev => prev.map(o => o.id === soId ? { ...o, status: newStatus } : o));
    }, []);

    const handleDelete = useCallback((so) => {
        setDeleteConfirmSO(so);
    }, []);

    const confirmDelete = async () => {
        if (!deleteConfirmSO) return;
        const so = deleteConfirmSO;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/services/${id}/sales-orders`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ soId: so.id }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Deleted ${so.code || '#' + so.id}`);
                setOrders(prev => prev.filter(o => o.id !== so.id));
                setDeleteConfirmSO(null);
            } else {
                toast.error(data.error || 'Failed to delete sales order');
            }
        } catch {
            toast.error('Error deleting sales order');
        } finally {
            setIsDeleting(false);
        }
    };

    const filtered = useMemo(() => {
        if (statusTab === 'All') return orders;
        return orders.filter(o => o.status === statusTab);
    }, [orders, statusTab]);

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at',
            header: 'Date',
            cell: ({ getValue }) => <span className="text-xs text-zinc-400">{new Date(getValue()).toLocaleDateString()}</span>,
        },
        {
            accessorKey: 'code',
            header: 'SO Code',
            cell: ({ getValue, row }) => (
                <Link
                    href={`/services/${id}/portal/sales-orders/${row.original.id}`}
                    className="font-mono text-xs font-bold text-indigo-400 hover:underline"
                >
                    {getValue()}
                </Link>
            ),
        },
        {
            accessorKey: 'customer_name',
            header: 'Customer',
            cell: ({ getValue }) => <span className="font-semibold text-white">{getValue()}</span>,
        },
        {
            accessorKey: 'delivery_date',
            header: 'Delivery',
            cell: ({ getValue }) => getValue()
                ? <span className="text-xs text-zinc-400">{new Date(getValue()).toLocaleDateString()}</span>
                : <span className="text-xs text-zinc-500">—</span>,
        },
        {
            accessorKey: 'total_amount',
            header: 'Amount',
            cell: ({ getValue }) => (
                <span className="font-mono font-bold text-white text-sm">
                    LKR {Number(getValue() || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ getValue, row }) => (
                <StatusSelect soId={row.original.id} current={getValue()} onUpdated={handleStatusUpdate} />
            ),
        },
        {
            id: 'actions',
            header: 'Actions',
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Link
                        href={`/services/${id}/portal/sales-orders/${row.original.id}`}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors inline-flex"
                        title="View Sales Order Details"
                    >
                        <FiEye size={13} />
                    </Link>
                    <button
                        onClick={() => handleDelete(row.original)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-colors inline-flex cursor-pointer"
                        title="Delete Sales Order"
                    >
                        <FiTrash2 size={13} />
                    </button>
                </div>
            ),
        },
    ], [id, handleStatusUpdate, handleDelete]);

    const table = useReactTable({
        data: filtered,
        columns,
        state: { globalFilter, sorting },
        onGlobalFilterChange: setGlobalFilter,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    const stats = useMemo(() => ({
        total: orders.length,
        active: orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status)).length,
        delivered: orders.filter(o => o.status === 'Delivered').length,
        value: orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0),
    }), [orders]);

    return (
        <div className="p-8 space-y-6 bg-[#09090b] text-zinc-100 min-h-screen">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-white">Sales Orders</h1>
                <p className="text-zinc-400 text-sm mt-0.5">All service-linked sales orders</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Orders', value: stats.total, color: 'text-white' },
                    { label: 'Active', value: stats.active, color: 'text-zinc-200' },
                    { label: 'Delivered', value: stats.delivered, color: 'text-zinc-300' },
                    { label: 'Total Value', value: `LKR ${stats.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-white' },
                ].map(s => (
                    <div key={s.label} className="bg-[#0e0e11] border border-zinc-800/80 rounded-2xl px-5 py-4">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Status Tabs + Search */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-1 bg-[#0e0e11] border border-zinc-800/80 rounded-xl p-1">
                    {STATUS_TABS.map(t => (
                        <button key={t} onClick={() => setStatusTab(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                                ${statusTab === t ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}>
                            {t}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                    <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
                        placeholder="Search…"
                        className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#0e0e11] border border-zinc-800/80 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" /></div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-zinc-800/80 bg-zinc-900/40">
                            {table.getHeaderGroups().map(hg => (
                                <tr key={hg.id}>
                                    {hg.headers.map(h => (
                                        <th key={h.id}
                                            className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-400 select-none"
                                            onClick={h.column.getToggleSortingHandler()}
                                            style={{ cursor: h.column.getCanSort() ? 'pointer' : 'default' }}>
                                            <div className="flex items-center gap-1">
                                                {flexRender(h.column.columnDef.header, h.getContext())}
                                                {h.column.getIsSorted() === 'asc' && <FiChevronUp size={11} className="text-white" />}
                                                {h.column.getIsSorted() === 'desc' && <FiChevronDown size={11} className="text-white" />}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {table.getRowModel().rows.length === 0 ? (
                                <tr><td colSpan={7} className="py-16 text-center text-zinc-500 text-xs">
                                    {statusTab !== 'All' ? `No ${statusTab} orders` : 'No sales orders yet'}
                                </td></tr>
                            ) : table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="hover:bg-zinc-800/40 transition-colors">
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-4 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
                <div className="flex gap-2">
                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-30 cursor-pointer"><FiChevronLeft size={14} /></button>
                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-30 cursor-pointer"><FiChevronRight size={14} /></button>
                </div>
            </div>

            {/* Custom Modal Confirmation */}
            {deleteConfirmSO && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
                    <div className="bg-[#0e0e11] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-400">
                            <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                <FiTrash2 size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Delete Sales Order</h3>
                                <p className="text-xs text-zinc-400 font-mono mt-0.5">{deleteConfirmSO.code || `#${deleteConfirmSO.id}`}</p>
                            </div>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80">
                            Are you sure you want to delete <strong className="text-white">{deleteConfirmSO.code || `#${deleteConfirmSO.id}`}</strong>?
                            <br /><br />
                            <span className="text-rose-400 font-semibold">Warning:</span> This will permanently remove the Sales Order and all linked job tasks and work logs. This action cannot be undone.
                        </p>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmSO(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white shadow-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                            >
                                {isDeleting ? 'Deleting…' : 'Yes, Delete Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
