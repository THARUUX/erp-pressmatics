'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FiPlus, FiSearch, FiEdit2, FiTrash2, FiCopy, FiStar,
    FiChevronUp, FiChevronDown, FiChevronsLeft, FiChevronLeft,
    FiChevronRight, FiChevronsRight, FiFileText,
} from 'react-icons/fi';
import { useSettings } from '@/components/SettingsContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { ColumnToggle } from '@/components/ui/ColumnToggle';

/* ── Duplicate progress overlay ───────────────────────────────────────────── */
function DuplicateProgress({ visible, progress, label }) {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-[9997] bg-black/65 backdrop-blur-lg flex items-center justify-center">
            <div className="bg-[#0f0f0f]/95 border border-white/10 rounded-2xl p-10 w-80 shadow-[0_24px_64px_rgba(0,0,0,0.6)] text-center">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-white font-bold text-base mb-1">Duplicating Estimation</div>
                <div className="text-gray-500 text-sm mb-6">{label}</div>
                <div className="bg-white/8 rounded-full h-1.5 overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-400"
                        style={{ width: `${progress}%` }} />
                </div>
                <div className="text-gray-600 text-xs">{progress}%</div>
            </div>
        </div>
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
function ActionBtn({ icon, onClick, title, cls = 'hover:text-white hover:bg-white/10', disabled = false }) {
    return (
        <button onClick={e => { e.stopPropagation(); onClick(); }} disabled={disabled} title={title}
            className={`p-1.5 rounded-lg text-gray-500 transition-colors disabled:opacity-40 ${cls}`}>
            {icon}
        </button>
    );
}

export default function EstimationsPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';

    const [data, setData]               = useState([]);
    const [loading, setLoading]         = useState(true);
    const [filterType, setFilterType]   = useState('all');
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnVisibility, setColumnVisibility] = useState({});
    const [duplicating, setDuplicating] = useState(false);
    const [dupProgress, setDupProgress] = useState(0);
    const [dupLabel, setDupLabel]       = useState('');

    const fetchAll = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams({ page: 1, limit: 500 });
        if (filterType === 'favorites') params.append('is_favorite', 'true');
        fetch(`/api/items?${params}`)
            .then(r => r.json())
            .then(res => {
                setData(Array.isArray(res) ? res : (res.items ?? []));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [filterType]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleToggleFav = async (id, cur) => {
        if (cur && !(await confirmDialog('Remove from templates?', { confirmLabel: 'Remove' }))) return;
        setData(prev => prev.map(i => i.id === id ? { ...i, is_favorite: !cur } : i));
        await fetch(`/api/items/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_favorite: !cur }),
        }).catch(fetchAll);
    };

    const runDuplicate = async (id, makeUrl) => {
        setDuplicating(true); setDupProgress(0); setDupLabel('Copying header…');
        const stages = [
            { pct: 20, label: 'Copying header…' }, { pct: 45, label: 'Duplicating components…' },
            { pct: 70, label: 'Copying finishings…' }, { pct: 88, label: 'Finalising…' },
        ];
        let si = 0;
        const tick = setInterval(() => {
            if (si < stages.length) { setDupProgress(stages[si].pct); setDupLabel(stages[si].label); si++; }
        }, 400);
        try {
            const res = await fetch(`/api/items/${id}/duplicate`, { method: 'POST' });
            const d = await res.json();
            clearInterval(tick); setDupProgress(100); setDupLabel('Done!');
            await new Promise(r => setTimeout(r, 500));
            if (res.ok && d.newId) router.push(makeUrl(d.newId));
            else { setDuplicating(false); toast.error(d.error || 'Duplicate failed'); }
        } catch { clearInterval(tick); setDuplicating(false); toast.error('Error duplicating'); }
    };

    const handleDuplicate = async (id) => {
        if (!(await confirmDialog('Copy this estimation as a new draft?', { confirmLabel: 'Duplicate' }))) return;
        await runDuplicate(id, newId => `/dashboard/estimations/${newId}`);
    };

    const handleDelete = async (id) => {
        if (!(await confirmDialog('Delete this estimation? This cannot be undone.', { danger: true, confirmLabel: 'Delete' }))) return;
        const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Estimation deleted'); fetchAll(); }
        else toast.error('Failed to delete');
    };

    const fmt = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });

    const columns = useMemo(() => [
        {
            id: 'fav', header: '', size: 40,
            enableSorting: false, enableColumnFilter: false,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <button onClick={e => { e.stopPropagation(); handleToggleFav(item.id, item.is_favorite); }}
                        title="Toggle Template"
                        className={`text-lg ${item.is_favorite ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'}`}>
                        <FiStar className={item.is_favorite ? 'fill-yellow-400' : ''} />
                    </button>
                );
            },
        },
        {
            accessorKey: 'code', header: 'Code', size: 120,
            cell: ({ getValue }) => <span className="font-mono text-xs text-blue-400">{getValue()}</span>,
        },
        {
            id: 'name',
            accessorFn: row => row.estimation_name || row.customer_name || 'Untitled',
            header: 'Name',
            cell: ({ getValue, row }) => (
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{getValue()}</span>
                    {!!row.original.is_favorite && (
                        <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 rounded">TEMPLATE</span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'customer_name', header: 'Customer',
            cell: ({ getValue }) => <span className="text-gray-400 text-sm">{getValue() || '—'}</span>,
        },
        {
            accessorKey: 'type', header: 'Type', size: 100,
            cell: ({ getValue }) => (
                <span className="text-xs bg-white text-black px-2 py-0.5 rounded uppercase font-bold">{getValue()}</span>
            ),
        },
        {
            accessorKey: 'quantity', header: 'Qty', size: 80,
            cell: ({ getValue }) => <span className="text-gray-400">{getValue()}</span>,
        },
        {
            accessorKey: 'total_amount', header: 'Amount', size: 140,
            cell: ({ getValue, row }) => row.original.is_favorite ? (
                <span className="text-gray-600 text-xs">Template</span>
            ) : (
                <span className="font-mono font-bold text-white">{currency} {fmt(getValue())}</span>
            ),
        },
        {
            accessorKey: 'created_at', header: 'Date', size: 110,
            cell: ({ getValue }) => (
                <span className="text-gray-500 text-xs">{new Date(getValue()).toLocaleDateString('en-GB')}</span>
            ),
        },
        {
            id: 'actions', header: 'Actions', size: 120,
            enableSorting: false, enableColumnFilter: false,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <ActionBtn title="Duplicate" icon={<FiCopy size={14} />}
                            cls="hover:text-blue-400 hover:bg-blue-500/10"
                            onClick={() => handleDuplicate(item.id)} />
                        {!item.is_favorite && (
                            <ActionBtn title="Edit" icon={<FiEdit2 size={14} />}
                                onClick={() => router.push(`/dashboard/estimations/${item.id}`)} />
                        )}
                        <ActionBtn title="Delete" icon={<FiTrash2 size={14} />}
                            cls="hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => handleDelete(item.id)} />
                    </div>
                );
            },
        },
    ], [currency]);

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
            <DuplicateProgress visible={duplicating} progress={dupProgress} label={dupLabel} />

            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Job Estimations</h1>
                    <p className="text-gray-500 text-sm mt-0.5">{table.getFilteredRowModel().rows.length} of {data.length} records</p>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="flex bg-black/30 border border-white/10 rounded-xl p-1">
                        {['all', 'favorites'].map(f => (
                            <button key={f} onClick={() => setFilterType(f)}
                                className={`px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${filterType === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {f === 'favorites' && <FiStar className={filterType === 'favorites' ? 'fill-white' : ''} size={13} />}
                                {f === 'all' ? 'All' : 'Templates'}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
                            placeholder="Search all columns…"
                            className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm w-64 outline-none focus:border-white/30 placeholder-gray-600" />
                    </div>
                    <ColumnToggle table={table} />
                </div>
            </header>

            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="py-24 text-center text-gray-500 animate-pulse">Loading estimations…</div>
                ) : data.length === 0 ? (
                    <div className="py-24 text-center">
                        <FiFileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500">No estimations found</p>
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
                                        onClick={() => {
                                            const item = row.original;
                                            if (item.is_favorite) handleDuplicate(item.id);
                                            else router.push(`/dashboard/estimations/${item.id}`);
                                        }}
                                        className={`border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.04] ${i % 2 === 1 ? 'bg-white/[0.015]' : ''} ${row.original.is_favorite ? 'border-l-2 border-l-yellow-500/40' : ''}`}>
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
