'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FiPlus, FiSearch, FiEdit2, FiTrash2,
    FiChevronUp, FiChevronDown, FiChevronsLeft, FiChevronLeft,
    FiChevronRight, FiChevronsRight, FiTruck,
    FiAlertCircle, FiCheckCircle, FiDollarSign, FiPackage, FiUpload, FiPenTool,
} from 'react-icons/fi';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useSettings } from '@/components/SettingsContext';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { BulkImportModal } from '@/components/ui/BulkImportModal';
import { BulkEditModal } from '@/components/ui/BulkEditModal';

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


export default function SuppliersPage() {
    const { settings } = useSettings();
    const currency = (settings?.currency || 'LKR');
    const router = useRouter();
    const [data, setData]             = useState([]);
    const [loading, setLoading]       = useState(true);
    const [globalFilter, setGlobalFilter] = useState('');
    const [balances, setBalances]     = useState({});
    const [stats, setStats]           = useState({ total: 0, active: 0, outstanding: 0 });
    const [columnVisibility, setColumnVisibility] = useState({});
    const [showImport, setShowImport]     = useState(false);
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [rowSelection, setRowSelection] = useState({});
    const [deleteProgress, setDeleteProgress] = useState(null); // { current, total, currentName }

    const fetchAll = async () => {
        setLoading(true);
        try {
            const res  = await fetch('/api/suppliers');
            const rows = await res.json();
            const list = Array.isArray(rows) ? rows : [];
            setData(list);

            // Fetch balances for each supplier (parallel, fire-and-forget summaries)
            const balMap = {};
            await Promise.all(list.map(async (s) => {
                try {
                    const br = await fetch(`/api/suppliers/${s.id}/balance`);
                    if (br.ok) balMap[s.id] = await br.json();
                } catch { /* ignore */ }
            }));
            setBalances(balMap);

            const totalOut = Object.values(balMap).reduce((sum, b) => sum + (b?.outstanding || 0), 0);
            setStats({
                total:       list.length,
                active:      list.filter(s => s.is_active).length,
                outstanding: totalOut,
            });
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    const handleDelete = async (id, name) => {
        if (!(await confirmDialog(`Delete supplier "${name}"?`, { danger: true, confirmLabel: 'Delete' }))) return;
        const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Supplier deleted'); fetchAll(); }
        else {
            const err = await res.json().catch(() => ({}));
            toast.error(err.error || 'Failed to delete supplier');
        }
    };

    const columns = useMemo(() => [
        {
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    checked={table.getIsAllPageRowsSelected()}
                    ref={(el) => {
                        if (el) el.indeterminate = table.getIsSomePageRowsSelected();
                    }}
                    onChange={table.getToggleAllPageRowsSelectedHandler()}
                    className="rounded border-white/10 bg-white/5 text-white focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer"
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    checked={row.getIsSelected()}
                    onChange={row.getToggleSelectedHandler()}
                    onClick={e => e.stopPropagation()}
                    className="rounded border-white/10 bg-white/5 text-white focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer"
                />
            ),
            size: 40,
            enableSorting: false,
            enableColumnFilter: false,
        },
        {
            accessorKey: 'code', header: 'Code', size: 100,
            cell: ({ getValue }) => <span className="font-mono text-xs text-gray-400">{getValue()}</span>,
        },
        {
            accessorKey: 'name', header: 'Name',
            cell: ({ getValue }) => <span className="font-semibold text-white">{getValue()}</span>,
        },
        {
            accessorKey: 'contact_name', header: 'Contact',
            cell: ({ getValue }) => <span className="text-gray-400 text-sm">{getValue() || '—'}</span>,
        },
        {
            accessorKey: 'phone', header: 'Phone', size: 140,
            cell: ({ getValue }) => <span className="text-gray-400 text-sm">{getValue() || '—'}</span>,
        },
        {
            accessorKey: 'payment_terms', header: 'Terms', size: 120,
            cell: ({ getValue }) => (
                <span className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full">
                    {getValue() || '—'}
                </span>
            ),
        },
        {
            id: 'outstanding', header: 'Outstanding', size: 140,
            cell: ({ row }) => {
                const b = balances[row.original.id];
                const amt = parseFloat(b?.outstanding || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                    <span className={`text-sm font-semibold ${amt > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                        {currency + (amt)}
                    </span>
                );
            },
        },
        {
            accessorKey: 'is_active', header: 'Status', size: 100,
            cell: ({ getValue }) => getValue() ? (
                <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                    <FiCheckCircle className="w-3 h-3" /> Active
                </span>
            ) : (
                <span className="flex items-center gap-1 text-gray-600 text-xs">
                    <FiAlertCircle className="w-3 h-3" /> Inactive
                </span>
            ),
        },
        {
            id: 'actions', header: 'Actions', size: 90,
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => router.push(`/dashboard/suppliers/${row.original.id}`)}
                        title="Edit" className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <FiEdit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(row.original.id, row.original.name)}
                        title="Delete" className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <FiTrash2 size={14} />
                    </button>
                </div>
            ),
        },
    ], [balances, currency, router]);

    const table = useReactTable({
        data, columns,
        state: { globalFilter, columnVisibility, rowSelection },
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel:       getCoreRowModel(),
        getSortedRowModel:     getSortedRowModel(),
        getFilteredRowModel:   getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    });

    const selectedIds = useMemo(() => {
        return table.getSelectedRowModel().flatRows.map(row => row.original.id);
    }, [rowSelection, data, table]);

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!(await confirmDialog(`Delete ${selectedIds.length} selected supplier(s)?`, { danger: true, confirmLabel: 'Delete' }))) return;

        const total = selectedIds.length;
        let deleted = 0;
        const failed = [];

        const nameMap = {};
        table.getSelectedRowModel().flatRows.forEach(row => {
            nameMap[row.original.id] = row.original.name;
        });

        for (let i = 0; i < selectedIds.length; i++) {
            const id = selectedIds[i];
            setDeleteProgress({ current: i + 1, total, currentName: nameMap[id] || `Supplier #${id}` });
            try {
                const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
                if (res.ok) { deleted++; }
                else { failed.push(nameMap[id] || id); }
            } catch { failed.push(nameMap[id] || id); }
        }

        setDeleteProgress(null);
        setRowSelection({});
        fetchAll();

        if (failed.length > 0) {
            toast.error(`Deleted ${deleted} supplier(s). ${failed.length} could not be deleted.`);
        } else {
            toast.success(`${deleted} supplier(s) deleted successfully`);
        }
    };

    const { pageIndex, pageSize } = table.getState().pagination;
    const pageCount = table.getPageCount();

    return (
        <div className="text-white space-y-6">
            {/* ── Bulk Delete Progress Modal ── */}
            {deleteProgress && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#111]/95 border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-8 h-8 rounded-full border-2 border-red-500/50 border-t-red-400 animate-spin shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-white">Deleting suppliers…</p>
                                <p className="text-xs text-white/40 mt-0.5 truncate max-w-[220px]">{deleteProgress.currentName}</p>
                            </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden mb-3">
                            <div
                                className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-white/30">
                            <span>{deleteProgress.current} of {deleteProgress.total}</span>
                            <span>{Math.round((deleteProgress.current / deleteProgress.total) * 100)}%</span>
                        </div>
                    </div>
                </div>
            )}
            {showImport && (
                <BulkImportModal
                    type="suppliers"
                    onClose={() => setShowImport(false)}
                    onComplete={() => { fetchAll(); toast.success('Supplier list updated!'); }}
                />
            )}
            {showBulkEdit && (
                <BulkEditModal
                    type="suppliers"
                    data={data}
                    onClose={() => setShowBulkEdit(false)}
                    onComplete={() => { fetchAll(); toast.success('Suppliers updated!'); }}
                />
            )}

            {/* ── Header ── */}
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter flex items-center gap-3">
                        Suppliers
                    </h1>
                    <p className="text-gray-500 text-sm mt-1.5 ml-1">
                        {table.getFilteredRowModel().rows.length} of {data.length} suppliers
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 bg-red-950/40 border border-red-500/30 text-red-400 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-900/40 hover:border-red-500/50 hover:text-red-300 transition-all shadow-lg shadow-red-950/20"
                        >
                            <FiTrash2 className="w-4 h-4" /> Delete ({selectedIds.length})
                        </button>
                    )}
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
                            placeholder="Search suppliers…"
                            className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm w-60 outline-none focus:border-white/30 placeholder-gray-600" />
                    </div>
                    <ColumnToggle table={table} />
                    <button
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-white/20 hover:text-white transition-colors">
                        <FiUpload className="w-4 h-4" /> Import CSV
                    </button>
                    <button
                        onClick={() => setShowBulkEdit(true)}
                        className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-white/20 hover:text-white transition-colors">
                        <FiPenTool className="w-4 h-4" /> Bulk Edit
                    </button>
                    <Link href="/dashboard/suppliers/new">
                        <button className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors">
                            <FiPlus className="w-4 h-4" /> New Supplier
                        </button>
                    </Link>
                </div>
            </header>

            {/* ── Stats Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Total Suppliers', value: stats.total, icon: FiTruck, color: 'text-white', bg: 'border-white/20' },
                    { label: 'Active Suppliers', value: stats.active, icon: FiCheckCircle, color: 'text-emerald-400', bg: ' border-emerald-500/20' },
                    { label: 'Total Outstanding', value: currency + ' ' + parseFloat(stats.outstanding || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: FiDollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                ].map(card => (
                    <div key={card.label} className={`${card.bg} bg-black/40 backdrop-blur-xl border rounded-2xl p-5 flex items-center gap-4`}>
                        <div className={`p-3 rounded-xl bg-black/30 border border-white/5`}>
                            <card.icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">{card.label}</p>
                            <p className={`text-2xl font-bold mt-0.5 ${card.color}`}>{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Table ── */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="py-24 text-center text-gray-500 animate-pulse">Loading suppliers…</div>
                ) : data.length === 0 ? (
                    <div className="py-24 text-center space-y-3">
                        <FiPackage className="w-12 h-12 text-gray-700 mx-auto" />
                        <p className="text-gray-500">No suppliers found</p>
                        <Link href="/dashboard/suppliers/new">
                            <button className="mt-2 inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm px-4 py-2 rounded-xl transition-colors">
                                <FiPlus className="w-4 h-4" /> Add your first supplier
                            </button>
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
                                        onClick={() => router.push(`/dashboard/suppliers/${row.original.id}`)}
                                        className={`border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.04] ${i % 2 === 1 ? 'bg-white/[0.015]' : ''} ${row.getIsSelected() ? 'bg-white/[0.03]' : ''}`}>
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
