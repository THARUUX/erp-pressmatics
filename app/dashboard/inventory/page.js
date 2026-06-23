'use client';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import {
    FiPlus, FiEdit2, FiTrash2, FiX, FiCopy, FiAlertTriangle,
    FiClock, FiSearch, FiChevronUp, FiChevronDown, FiChevronsLeft,
    FiChevronsRight, FiChevronLeft, FiChevronRight, FiUpload,
} from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSettings } from '@/components/SettingsContext';
import BulkUploadModal from '@/components/inventory/BulkUploadModal';

const CATEGORIES = ['Paper', 'Plate', 'Ink', 'SF', 'RM', 'FG'];
const EMPTY_FORM = { name: '', item_code: '', category: 'Paper', type: '', uom: 'Sheet', unit_cost: 0, stock_quantity: 0, min_stock: 0, width_cm: '', height_cm: '' };

export default function InventoryPage() {
    const { settings } = useSettings();
    const currency = settings.currency;
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('Paper');
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [restockItem, setRestockItem] = useState(null);
    const [restockData, setRestockData] = useState({ quantity: 0, notes: '' });
    const [historyItem, setHistoryItem] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const fetchItems = () => {
        setLoading(true);
        fetch(`/api/inventory?category=${activeCategory}`)
            .then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
            .catch(() => setLoading(false));
    };
    useEffect(() => { fetchItems(); }, [activeCategory]);

    /* ── TanStack Table columns ── */
    const columns = useMemo(() => [
        {
            accessorKey: 'item_code', header: 'Code', size: 100,
            cell: ({ row, getValue }) => (
                <span className="font-mono text-xs text-white/50">
                    {getValue()}
                    {row.original.is_active === 0 && <span className="ml-2 text-[9px] bg-red-500/20 text-red-300 px-1 rounded uppercase">Inactive</span>}
                </span>
            ),
        },
        {
            accessorKey: 'name', header: 'Name',
            cell: ({ row, getValue }) => {
                const low = row.original.stock_quantity < (row.original.min_stock || 0);
                return (
                    <div>
                        <p className="text-sm font-medium text-white">{getValue()}</p>
                        {low && <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5"><FiAlertTriangle className="w-3 h-3" />Low stock · min {row.original.min_stock}</p>}
                    </div>
                );
            },
        },
        { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => <span className="text-sm text-white/50">{getValue()}</span> },
        { accessorKey: 'uom',  header: 'UoM',  cell: ({ getValue }) => <span className="text-xs text-white/40 font-mono">{getValue()}</span> },
        {
            accessorKey: 'stock_quantity', header: 'Stock', size: 90,
            cell: ({ row, getValue }) => {
                const low = getValue() < (row.original.min_stock || 0);
                return <span className={`font-mono font-semibold ${low ? 'text-red-400' : 'text-white'}`}>{getValue()}</span>;
            },
        },
        { accessorKey: 'min_stock', header: 'Min', size: 70, cell: ({ getValue }) => <span className="font-mono text-white/35 text-sm">{getValue() || 0}</span> },
        {
            accessorKey: 'unit_cost', header: 'Unit Cost', size: 110,
            cell: ({ getValue }) => <span className="font-mono text-white/70 text-sm">{currency}{parseFloat(getValue()).toFixed(4)}</span>,
        },
        {
            id: 'actions', header: '', size: 160, enableSorting: false,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setRestockItem(item)} className="px-2 py-1 text-[11px] rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all">Restock</button>
                        <button onClick={() => handleViewHistory(item)} className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.05]"><FiClock className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleCopy(item)}  className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.05]"><FiCopy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleEdit(item)}  className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.05]"><FiEdit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-white/20 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/[0.07]"><FiTrash2 className="w-3.5 h-3.5" /></button>
                    </div>
                );
            },
        },
    ], [currency]);

    const table = useReactTable({
        data: items,
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

    /* ── Handlers ── */
    const handleViewHistory = async (item) => {
        setHistoryItem(item); setLoadingHistory(true);
        const res = await fetch(`/api/inventory/${item.id}/history`);
        setHistoryData(res.ok ? await res.json() : []);
        setLoadingHistory(false);
    };
    const handleSubmit = async () => {
        const url = isEditing ? `/api/inventory/${editId}` : '/api/inventory';
        const res = await fetch(url, { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, category: isEditing ? formData.category : activeCategory }) });
        if (res.ok) { resetForm(); fetchItems(); } else toast.error('Operation failed');
    };
    const handleRestock = async () => {
        const res = await fetch('/api/inventory/restock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: restockItem.id, ...restockData }) });
        if (res.ok) { setRestockItem(null); setRestockData({ quantity: 0, notes: '' }); fetchItems(); } else toast.error('Restock failed');
    };
    const handleDelete = async (id) => {
        if (!(await confirmDialog('Delete this item?'))) return;
        const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
        if (res.ok) fetchItems(); else { const d = await res.json(); toast.error(d.error || 'Failed'); }
    };
    const handleEdit = (item) => { setIsEditing(true); setEditId(item.id); setFormData({ name: item.name, item_code: item.item_code || '', category: item.category, type: item.type, uom: item.uom || 'Sheet', unit_cost: item.unit_cost, stock_quantity: item.stock_quantity, min_stock: item.min_stock || 0, width_cm: item.width_cm || '', height_cm: item.height_cm || '' }); setShowAdd(true); };
    const handleCopy = (item) => { setIsEditing(false); setEditId(null); setFormData({ ...item, name: `${item.name} (Copy)`, item_code: '' }); setShowAdd(true); };
    const resetForm = () => { setShowAdd(false); setIsEditing(false); setEditId(null); setFormData({ ...EMPTY_FORM, category: activeCategory }); };
    const f = (k, v) => setFormData(p => ({ ...p, [k]: v }));

    const lowStockCount = items.filter(i => i.stock_quantity < (i.min_stock || 0)).length;

    return (
        <div className="text-white space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Inventory</h1>
                    {lowStockCount > 0 && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><FiAlertTriangle className="w-3 h-3" />{lowStockCount} low stock item(s) in {activeCategory}</p>}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-sm text-white/60 hover:text-white transition-all">
                        <FiUpload className="w-4 h-4" /> Bulk Upload
                    </button>
                    {!showAdd && (
                        <button onClick={() => { resetForm(); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all">
                            <FiPlus className="w-4 h-4" /> Add Item
                        </button>
                    )}
                </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => { setActiveCategory(cat); setGlobalFilter(''); }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-white text-black' : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'}`}>
                        {cat}
                    </button>
                ))}
            </div>

            {/* Add/Edit form */}
            {showAdd && (
                <div className="bg-black/50 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold">{isEditing ? 'Edit Item' : `Add ${activeCategory}`}</h2>
                        <button onClick={resetForm} className="p-1 text-white/30 hover:text-white"><FiX /></button>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        <Input label="Item Code" value={formData.item_code} onChange={e => f('item_code', e.target.value)} placeholder="Auto-generated" className="bg-black/40 border-white/10" />
                        <Input label="Name" value={formData.name} onChange={e => f('name', e.target.value)} className="bg-black/40 border-white/10" />
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-400">Type</label>
                            {activeCategory === 'Paper' ? (
                                <select value={formData.type} onChange={e => f('type', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20">
                                    <option value="">Select type</option>
                                    <option>OFFSET</option><option>DIGITAL</option><option>BOTH</option>
                                </select>
                            ) : (
                                <input list="type-list" value={formData.type} onChange={e => f('type', e.target.value)} placeholder="Type…" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                            )}
                            <datalist id="type-list"><option value="Art"/><option value="Bond"/><option value="Gloss"/><option value="Offset Plate"/><option value="Cyan"/><option value="Magenta"/></datalist>
                        </div>
                        {activeCategory === 'Paper' && <>
                            <Input label="Width (cm)" type="number" step="0.01" value={formData.width_cm} onChange={e => f('width_cm', e.target.value)} className="bg-black/40 border-white/10" />
                            <Input label="Height (cm)" type="number" step="0.01" value={formData.height_cm} onChange={e => f('height_cm', e.target.value)} className="bg-black/40 border-white/10" />
                        </>}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-400">UoM</label>
                            <input list="uom-list" value={formData.uom} onChange={e => f('uom', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                            <datalist id="uom-list"><option value="Sheet"/><option value="Kg"/><option value="Ltr"/><option value="Unit"/><option value="Packet"/></datalist>
                        </div>
                        <Input label="Unit Cost" type="number" step="0.00001" value={formData.unit_cost} onChange={e => f('unit_cost', e.target.value)} className="bg-black/40 border-white/10" />
                        <Input label="Stock Qty" type="number" value={formData.stock_quantity} onChange={e => f('stock_quantity', e.target.value)} className="bg-black/40 border-white/10" />
                        <Input label="Min Stock" type="number" value={formData.min_stock} onChange={e => f('min_stock', e.target.value)} className="bg-black/40 border-white/10" />
                        <div className="flex items-end">
                            <Button onClick={handleSubmit} className="w-full bg-white text-black hover:bg-gray-100 h-[44px] text-sm font-semibold">{isEditing ? 'Update' : 'Save'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table toolbar */}
            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
                        placeholder="Search name, code, type…"
                        className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20" />
                </div>
                <p className="text-xs text-white/30 shrink-0">{table.getFilteredRowModel().rows.length} items</p>
            </div>

            {/* TanStack Table */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            {table.getHeaderGroups().map(hg => (
                                <tr key={hg.id} className="border-b border-white/[0.06] bg-white/[0.02]">
                                    {hg.headers.map(header => (
                                        <th key={header.id} style={{ width: header.getSize() }}
                                            className="px-4 py-3 text-left text-[11px] font-semibold text-white/35 uppercase tracking-wider select-none">
                                            {header.column.getCanSort() ? (
                                                <button onClick={header.column.getToggleSortingHandler()} className="flex items-center gap-1 hover:text-white/70 transition-colors">
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    {header.column.getIsSorted() === 'asc' ? <FiChevronUp className="w-3 h-3" /> : header.column.getIsSorted() === 'desc' ? <FiChevronDown className="w-3 h-3" /> : <span className="w-3" />}
                                                </button>
                                            ) : flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {loading ? (
                                <tr><td colSpan={columns.length} className="py-16 text-center text-white/25 text-sm">Loading…</td></tr>
                            ) : table.getRowModel().rows.length === 0 ? (
                                <tr><td colSpan={columns.length} className="py-16 text-center text-white/25 text-sm">No items found in {activeCategory}</td></tr>
                            ) : table.getRowModel().rows.map(row => {
                                const low = row.original.stock_quantity < (row.original.min_stock || 0);
                                const inactive = row.original.is_active === 0;
                                return (
                                    <tr key={row.id} className={`hover:bg-white/[0.02] transition-colors ${low ? 'bg-red-500/[0.04]' : ''} ${inactive ? 'opacity-50' : ''}`}>
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="px-4 py-3">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {table.getPageCount() > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05]">
                        <div className="flex items-center gap-1">
                            <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/[0.06] text-white/40 hover:text-white transition-all"><FiChevronsLeft className="w-3.5 h-3.5" /></button>
                            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/[0.06] text-white/40 hover:text-white transition-all"><FiChevronLeft className="w-3.5 h-3.5" /></button>
                            <span className="text-xs text-white/35 px-2">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
                            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/[0.06] text-white/40 hover:text-white transition-all"><FiChevronRight className="w-3.5 h-3.5" /></button>
                            <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/[0.06] text-white/40 hover:text-white transition-all"><FiChevronsRight className="w-3.5 h-3.5" /></button>
                        </div>
                        <select value={table.getState().pagination.pageSize} onChange={e => table.setPageSize(Number(e.target.value))}
                            className="text-xs bg-black/40 border border-white/[0.07] rounded-lg px-2 py-1.5 text-white/40 focus:outline-none">
                            {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* Restock Modal */}
            {restockItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-base font-semibold mb-1">Restock</h2>
                        <p className="text-xs text-white/40 mb-5">{restockItem.name}</p>
                        <div className="space-y-4">
                            <Input label="Quantity to Add" type="number" autoFocus value={restockData.quantity} onChange={e => setRestockData(p => ({ ...p, quantity: e.target.value }))} className="bg-black/40 border-white/10" />
                            <Input label="Notes / Reference" value={restockData.notes} onChange={e => setRestockData(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. PO #123" className="bg-black/40 border-white/10" />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button onClick={() => setRestockItem(null)} className="flex-1 bg-transparent border border-white/10 hover:bg-white/5">Cancel</Button>
                            <Button onClick={handleRestock} className="flex-1 bg-white text-black hover:bg-white/90">Save</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {historyItem && !restockItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-5">
                            <div><h2 className="text-base font-semibold">Transaction History</h2><p className="text-xs text-white/40 mt-0.5">{historyItem.name}</p></div>
                            <button onClick={() => setHistoryItem(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><FiX /></button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-sm border-collapse">
                                <thead className="sticky top-0">
                                    <tr className="bg-[#111] border-b border-white/[0.06]">
                                        {['Date', 'Type', 'Qty', 'Notes'].map(h => <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-white/35 uppercase tracking-wider">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {loadingHistory ? <tr><td colSpan={4} className="py-8 text-center text-white/25">Loading…</td></tr>
                                        : historyData.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-white/25">No transactions found.</td></tr>
                                            : historyData.map(log => (
                                                <tr key={log.id} className="hover:bg-white/[0.02]">
                                                    <td className="px-3 py-2.5 text-xs text-white/40">{new Date(log.created_at).toLocaleString()}</td>
                                                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${log.type === 'issue_note' ? 'bg-white/[0.06] text-white/60 border-white/[0.1]' : 'bg-white/[0.03] text-white/40 border-white/[0.06]'}`}>{log.type.replace('_', ' ')}</span></td>
                                                    <td className={`px-3 py-2.5 font-mono font-semibold ${log.quantity > 0 ? 'text-white' : 'text-red-400'}`}>{log.quantity > 0 ? '+' : ''}{parseFloat(log.quantity)}</td>
                                                    <td className="px-3 py-2.5 text-sm text-white/50">{log.notes}</td>
                                                </tr>
                                            ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulk && <BulkUploadModal onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); fetchItems(); }} />}
        </div>
    );
}
