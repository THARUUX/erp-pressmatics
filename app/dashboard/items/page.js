'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import {
    FiPlus, FiEdit2, FiTrash2, FiSearch, FiStar, FiCopy,
    FiX, FiCheckCircle, FiAlertCircle, FiList, FiGrid,
    FiChevronUp, FiChevronDown, FiChevronsLeft, FiChevronLeft,
    FiChevronRight, FiChevronsRight,
} from 'react-icons/fi';
import Button from '@/components/ui/Button';
import { useSettings } from '@/components/SettingsContext';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

/* ── Duplicate Progress ─────────────────────────────────────────────────────── */
function DuplicateProgress({ visible, progress, label }) {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-[9997] bg-black/65 backdrop-blur-lg flex items-center justify-center">
            <div className="bg-[#0f0f0f]/95 border border-white/10 rounded-2xl p-10 w-80 shadow-[0_24px_64px_rgba(0,0,0,0.6)] text-center">
                <div className="flex items-center justify-center mb-5">
                    <div className="relative flex items-center justify-center w-16 h-16">
                        <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 64 64" fill="none">
                            <circle cx="32" cy="32" r="28" stroke="url(#dupGradItems)" strokeWidth="3" strokeLinecap="round" strokeDasharray="120 60" />
                            <defs>
                                <linearGradient id="dupGradItems" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#7c3aed" />
                                    <stop offset="100%" stopColor="#a78bfa" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="relative z-10 w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                            <FiCopy size={18} className="text-violet-400" />
                        </div>
                    </div>
                </div>
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

/* ── TanStack helpers ───────────────────────────────────────────────────────── */
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

/* ── Main Page ──────────────────────────────────────────────────────────────── */
export default function ItemsPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || '$';

    const [data, setData]               = useState([]);
    const [loading, setLoading]         = useState(true);
    const [filterType, setFilterType]   = useState('all');
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnVisibility, setColumnVisibility] = useState({});
    const [sorting, setSorting]         = useState([]);
    const [viewMode, setViewMode]       = useState('card'); // 'card' | 'table'
    const [duplicating, setDuplicating] = useState(false);
    const [dupProgress, setDupProgress] = useState(0);
    const [dupLabel, setDupLabel]       = useState('');

    /* ── Fetch all ────────────────────────────────────────────────────────────── */
    const fetchAll = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams({ page: 1, limit: 500 });
        if (filterType === 'favorites') params.append('is_favorite', 'true');
        fetch(`/api/items?${params}`)
            .then(r => r.json())
            .then(res => { setData(Array.isArray(res) ? res : (res.items ?? [])); setLoading(false); })
            .catch(() => setLoading(false));
    }, [filterType]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /* ── Actions ──────────────────────────────────────────────────────────────── */
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
        await runDuplicate(id, newId => `/dashboard/items/${newId}`);
    };

    const handleDelete = async (id) => {
        if (!(await confirmDialog('Delete this estimation? This cannot be undone.', { danger: true, confirmLabel: 'Delete' }))) return;
        const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Estimation deleted'); fetchAll(); }
        else toast.error('Failed to delete');
    };

    const fmt = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    /* ── TanStack columns ─────────────────────────────────────────────────────── */
    const columns = useMemo(() => [
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
            accessorKey: 'job_description', header: 'Description',
            cell: ({ getValue }) => <span className="text-gray-400 text-sm truncate max-w-[200px] block">{getValue() || '—'}</span>,
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
            id: 'actions', header: '', size: 110,
            enableSorting: false, enableColumnFilter: false,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <ActionBtn title="Toggle Template" icon={<FiStar size={14} className={item.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''} />}
                            onClick={() => handleToggleFav(item.id, item.is_favorite)} />
                        <ActionBtn title="Duplicate" icon={<FiCopy size={14} />}
                            cls="hover:text-blue-400 hover:bg-blue-500/10"
                            onClick={() => handleDuplicate(item.id)} />
                        <ActionBtn title="Edit" icon={<FiEdit2 size={14} />}
                            onClick={() => router.push(`/dashboard/items/${item.id}`)} />
                        {!item.is_favorite && (
                            <ActionBtn title="Delete" icon={<FiTrash2 size={14} />}
                                cls="hover:text-red-400 hover:bg-red-500/10"
                                onClick={() => handleDelete(item.id)} />
                        )}
                    </div>
                );
            },
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [currency]);

    /* ── Table instance ───────────────────────────────────────────────────────── */
    const table = useReactTable({
        data,
        columns,
        state: { globalFilter, columnVisibility, sorting },
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    });

    const { pageIndex, pageSize } = table.getState().pagination;
    const pageCount = table.getPageCount();

    /* ── Filtered data for card view ──────────────────────────────────────────── */
    const filteredCards = useMemo(() => {
        const q = globalFilter.toLowerCase();
        return data.filter(item => {
            const matchFav = filterType !== 'favorites' || item.is_favorite;
            const matchQ = !q || [item.code, item.estimation_name, item.customer_name, item.job_description, item.type]
                .some(v => (v || '').toLowerCase().includes(q));
            return matchFav && matchQ;
        });
    }, [data, globalFilter, filterType]);

    return (
        <div className="text-white">
            <DuplicateProgress visible={duplicating} progress={dupProgress} label={dupLabel} />

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Job Estimations</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {table.getFilteredRowModel().rows.length} of {data.length} records
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Filter: All / Favorites */}
                    <div className="flex bg-black/30 border border-white/10 rounded-xl p-1">
                        {['all', 'favorites'].map(f => (
                            <button key={f} onClick={() => setFilterType(f)}
                                className={`px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 ${filterType === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>
                                {f === 'favorites' && <FiStar className={filterType === 'favorites' ? 'fill-white' : ''} size={13} />}
                                {f === 'all' ? 'All' : 'Templates'}
                            </button>
                        ))}
                    </div>

                    {/* Global search */}
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
                            placeholder="Search all columns…"
                            className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm w-64 outline-none focus:border-white/30 placeholder-gray-600" />
                    </div>

                    {/* Column visibility (table mode only) */}
                    {viewMode === 'table' && <ColumnToggle table={table} />}

                    {/* View toggle */}
                    <div className="flex bg-black/30 border border-white/10 rounded-xl p-1">
                        <button onClick={() => setViewMode('card')}
                            title="Card view"
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'card' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>
                            <FiGrid size={15} />
                        </button>
                        <button onClick={() => setViewMode('table')}
                            title="Table view"
                            className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>
                            <FiList size={15} />
                        </button>
                    </div>

                    <Link href="/dashboard/items/new">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors">
                            <FiPlus /> New Estimate
                        </button>
                    </Link>
                </div>
            </header>

            {/* ══════════════════════════════════════════════════════════════════
                  CARD VIEW
                ══════════════════════════════════════════════════════════════════ */}
            {viewMode === 'card' && (
                <div className="space-y-4">
                    <div className="grid gap-3">
                        {loading && (
                            <div className="text-center py-12 text-gray-500 animate-pulse">Loading estimations…</div>
                        )}
                        {!loading && table.getRowModel().rows.length === 0 && (
                            <div className="text-center py-12 text-gray-500 bg-black/40 rounded-xl border border-white/10">
                                No estimations found.
                            </div>
                        )}
                        {table.getRowModel().rows.map(row => {
                            const item = row.original;
                            return (
                                <div key={item.id}
                                    onClick={() => router.push(`/dashboard/items/${item.id}`)}
                                    className={`bg-black/40 backdrop-blur-md px-6 py-5 rounded-xl border hover:bg-white/5 transition-all flex justify-between items-center group cursor-pointer ${item.is_favorite ? 'border-yellow-500/30' : 'border-white/10'}`}>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={e => { e.stopPropagation(); handleToggleFav(item.id, item.is_favorite); }}
                                                className={`text-lg transition-colors ${item.is_favorite ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                                                title="Toggle Template">
                                                <FiStar className={item.is_favorite ? 'fill-yellow-400' : ''} />
                                            </button>
                                            <h3 className="text-base font-semibold">{item.estimation_name || item.customer_name || 'Untitled'}</h3>
                                            {!!item.is_favorite && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 rounded">TEMPLATE</span>}
                                        </div>
                                        <div className="text-xs text-blue-400 font-mono mt-1 mb-0.5">{item.code}</div>
                                        <p className="text-gray-400 text-sm">{item.customer_name} • {item.job_description} • {item.quantity} units</p>
                                        <div className="mt-2">
                                            <span className="text-xs bg-white text-black px-2 py-0.5 rounded uppercase font-bold">{item.type}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="text-xl font-bold">{currency} {fmt(item.total_amount)}</div>
                                            <div className="text-xs text-gray-500 mt-1">{new Date(item.created_at).toLocaleDateString('en-GB')}</div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={e => { e.stopPropagation(); handleDuplicate(item.id); }}
                                                className="p-2 text-gray-400 hover:text-blue-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors" title="Duplicate">
                                                <FiCopy />
                                            </button>
                                            <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/items/${item.id}`); }}
                                                className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors" title="Edit">
                                                <FiEdit2 />
                                            </button>
                                            {!item.is_favorite && (
                                                <button onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                                                    className="p-2 text-gray-400 hover:text-red-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors" title="Delete">
                                                    <FiTrash2 />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── Pagination footer for Card View ─────────────────── */}
                    {!loading && data.length > 0 && (
                        <div className="flex items-center justify-between px-6 py-4 border border-white/10 bg-black/40 rounded-xl flex-wrap gap-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Rows:</span>
                                <select value={pageSize} onChange={e => table.setPageSize(Number(e.target.value))}
                                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-gray-300 outline-none">
                                    {[10, 15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <span className="text-xs text-gray-500">
                                Page <strong className="text-gray-300">{pageIndex + 1}</strong> of <strong className="text-gray-300">{pageCount || 1}</strong>
                                {' '}— {table.getFilteredRowModel().rows.length} results
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
            )}

            {/* ══════════════════════════════════════════════════════════════════
                  TABLE VIEW (TanStack)
                ══════════════════════════════════════════════════════════════════ */}
            {viewMode === 'table' && (
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    {loading ? (
                        <div className="py-24 text-center text-gray-500 animate-pulse">Loading estimations…</div>
                    ) : data.length === 0 ? (
                        <div className="py-24 text-center text-gray-500">No estimations found.</div>
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
                                                router.push(`/dashboard/items/${item.id}`);
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

                    {/* ── Pagination footer ─────────────────────────────────── */}
                    {!loading && data.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-black/20 flex-wrap gap-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Rows:</span>
                                <select value={pageSize} onChange={e => table.setPageSize(Number(e.target.value))}
                                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-gray-300 outline-none">
                                    {[10, 15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <span className="text-xs text-gray-500">
                                Page <strong className="text-gray-300">{pageIndex + 1}</strong> of <strong className="text-gray-300">{pageCount || 1}</strong>
                                {' '}— {table.getFilteredRowModel().rows.length} results
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
            )}
        </div>
    );
}
