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
    FiChevronRight, FiChevronsRight, FiUsers,
} from 'react-icons/fi';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { BulkImportModal } from '@/components/ui/BulkImportModal';
import { FiUpload } from 'react-icons/fi';

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

export default function CustomersPage() {
    const router = useRouter();
    const [data, setData]               = useState([]);
    const [loading, setLoading]         = useState(true);
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnVisibility, setColumnVisibility] = useState({});
    const [showImport, setShowImport]   = useState(false);

    const fetchAll = () => {
        setLoading(true);
        fetch('/api/customers?limit=500')
            .then(r => r.json())
            .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
            .catch(() => setLoading(false));
    };


    useEffect(() => { fetchAll(); }, []);

    const handleDelete = async (id) => {
        if (!(await confirmDialog('Delete this customer?', { danger: true, confirmLabel: 'Delete' }))) return;
        const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Customer deleted'); fetchAll(); }
        else toast.error('Failed to delete (may be used in quotations)');
    };

    const columns = useMemo(() => [
        {
            accessorKey: 'code', header: 'ID', size: 100,
            cell: ({ getValue, row }) => (
                <span className="font-mono text-xs text-gray-400">{getValue() || `#${row.original.id}`}</span>
            ),
        },
        {
            accessorKey: 'name', header: 'Name',
            cell: ({ getValue }) => <span className="font-semibold text-white">{getValue()}</span>,
        },
        {
            accessorKey: 'email', header: 'Email',
            cell: ({ getValue }) => getValue()
                ? <a href={`mailto:${getValue()}`} onClick={e => e.stopPropagation()}
                    className="text-blue-400 hover:underline text-sm">{getValue()}</a>
                : <span className="text-gray-600 text-sm">—</span>,
        },
        {
            accessorKey: 'phone', header: 'Phone', size: 140,
            cell: ({ getValue }) => <span className="text-gray-400 text-sm">{getValue() || '—'}</span>,
        },
        {
            accessorKey: 'address', header: 'Address',
            cell: ({ getValue }) => (
                <span className="text-gray-500 text-xs truncate max-w-[200px] block">{getValue() || '—'}</span>
            ),
        },
        {
            accessorKey: 'is_vat', header: 'Tax Status',
            cell: ({ getValue }) => (
                <span className="text-gray-900 text-xs bg-white px-4 rounded py-1 w-fit truncate max-w-[200px] block">{getValue() === 1 ? 'VAT' : 'Non VAT'}</span>
            ),
        },
        {
            id: 'actions', header: 'Actions', size: 100,
            enableSorting: false, enableColumnFilter: false,
            cell: ({ row }) => (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => router.push(`/dashboard/customers/${row.original.id}`)}
                        title="Edit" className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <FiEdit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(row.original.id)}
                        title="Delete" className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <FiTrash2 size={14} />
                    </button>
                </div>
            ),
        },
    ], []);

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
        <div className="text-white">
            {showImport && (
                <BulkImportModal
                    onClose={() => setShowImport(false)}
                    onComplete={() => { fetchAll(); toast.success('Customer list updated!'); }}
                />
            )}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Customers</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {table.getFilteredRowModel().rows.length} of {data.length} clients
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
                            placeholder="Search all columns…"
                            className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm w-64 outline-none focus:border-white/30 placeholder-gray-600" />
                    </div>
                    <ColumnToggle table={table} />
                    <button
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-white/20 hover:text-white transition-colors">
                        <FiUpload className="w-4 h-4" /> Import CSV
                    </button>
                    <Link href="/dashboard/customers/new">
                        <button className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors">
                            <FiPlus className="w-4 h-4" /> New Customer
                        </button>
                    </Link>
                </div>
            </header>

            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="py-24 text-center text-gray-500 animate-pulse">Loading customers…</div>
                ) : data.length === 0 ? (
                    <div className="py-24 text-center">
                        <FiUsers className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500">No customers found</p>
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
                                        onClick={() => router.push(`/dashboard/customers/${row.original.id}`)}
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
