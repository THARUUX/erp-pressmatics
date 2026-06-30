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
    FiChevronsRight, FiChevronLeft, FiChevronRight, FiUpload, FiGrid,
} from 'react-icons/fi';
import { FiMaximize } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSettings } from '@/components/SettingsContext';
import BulkUploadModal from '@/components/inventory/BulkUploadModal';
import BomEditor from './components/BomEditor';

const CATEGORIES = ['Paper', 'Plate', 'Ink', 'SFG', 'RM', 'FG', 'Statics'];
const BOM_CATEGORIES = ['SFG', 'FG'];
const EMPTY_FORM = { name: '', item_code: '', category: 'Paper', type: '', uom: 'Sheet', unit_cost: 0, stock_quantity: 0, min_stock: 0, width_cm: '', height_cm: '', description: '', is_active: 1 };

export default function InventoryPage() {
    const { settings } = useSettings();
    const currency = settings.currency;
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('Paper');
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([]);
    const [rowSelection, setRowSelection] = useState({});
    const [deleteProgress, setDeleteProgress] = useState(null); // { current, total, currentName }
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
    const [bomLines, setBomLines] = useState([]);
    const [restockBom, setRestockBom] = useState([]);
    const [qrItem, setQrItem] = useState(null); // { id, name, item_code } for QR modal
    const [qrDataUrl, setQrDataUrl] = useState('');

    const fetchItems = () => {
        setLoading(true);
        fetch(`/api/inventory?category=${activeCategory}`)
            .then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
            .catch(() => setLoading(false));
    };
    useEffect(() => {
        setRowSelection({});
        fetchItems();
    }, [activeCategory]);

    const openQrModal = async (item) => {
        setQrItem(item);
        setQrDataUrl('');
        try {
            const QRCode = (await import('qrcode')).default;
            const url = `${window.location.origin}/statics/${item.id}`;
            const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#ffffff', light: '#00000000' } });
            setQrDataUrl(dataUrl);
        } catch (e) { console.error('QR error', e); }
    };

    /* ── TanStack Table columns ── */
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
            id: 'stock_or_status', header: 'Stock / Status', size: 110,
            accessorFn: row => row.stock_quantity,
            cell: ({ row }) => {
                const item = row.original;
                if (item.category === 'Statics') {
                    const active = item.is_active === 1;
                    return (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-red-500/10 text-red-400 border-red-500/25'
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            {active ? 'Active' : 'Inactive'}
                        </span>
                    );
                }
                const low = item.stock_quantity < (item.min_stock || 0);
                return <span className={`font-mono font-semibold ${low ? 'text-red-400' : 'text-white'}`}>{item.stock_quantity}</span>;
            },
        },
        { accessorKey: 'min_stock', header: 'Min', size: 70,
            cell: ({ row, getValue }) => row.original.category === 'Statics' ? null :
                <span className="font-mono text-white/35 text-sm">{getValue() || 0}</span>
        },
        {
            accessorKey: 'unit_cost', header: 'Unit Cost', size: 110,
            cell: ({ getValue }) => <span className="font-mono text-white/70 text-sm">{currency}{parseFloat(getValue()).toFixed(4)}</span>,
        },
        {
            id: 'actions', header: '', size: 180, enableSorting: false,
            cell: ({ row }) => {
                const item = row.original;
                const isStatics = item.category === 'Statics';
                return (
                    <div className="flex items-center justify-end gap-1">
                        {isStatics ? (
                            <button onClick={() => openQrModal(item)} className="px-2 py-1 text-[11px] rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 hover:text-violet-300 transition-all font-medium">QR</button>
                        ) : (
                            <>
                                <button onClick={() => handleOpenRestock(item)} className="px-2 py-1 text-[11px] rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all">Restock</button>
                                <button onClick={() => handleViewHistory(item)} className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.05]"><FiClock className="w-3.5 h-3.5" /></button>
                            </>
                        )}
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
        state: { globalFilter, sorting, rowSelection },
        onGlobalFilterChange: setGlobalFilter,
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    const selectedIds = useMemo(() => {
        return table.getSelectedRowModel().flatRows.map(row => row.original.id);
    }, [rowSelection, items, table]);

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!(await confirmDialog(`Delete ${selectedIds.length} selected item(s)?`, { danger: true, confirmLabel: 'Delete' }))) return;

        const total = selectedIds.length;
        let deleted = 0;
        const failed = [];

        // Build a name map for progress display
        const nameMap = {};
        table.getSelectedRowModel().flatRows.forEach(row => {
            nameMap[row.original.id] = row.original.name;
        });

        for (let i = 0; i < selectedIds.length; i++) {
            const id = selectedIds[i];
            setDeleteProgress({ current: i + 1, total, currentName: nameMap[id] || `Item #${id}` });
            try {
                const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
                if (res.ok) { deleted++; }
                else { failed.push(nameMap[id] || id); }
            } catch { failed.push(nameMap[id] || id); }
        }

        setDeleteProgress(null);
        setRowSelection({});
        fetchItems();

        if (failed.length > 0) {
            toast.error(`Deleted ${deleted} item(s). ${failed.length} could not be deleted.`);
        } else {
            toast.success(`${deleted} item(s) deleted successfully`);
        }
    };

    /* ── Handlers ── */
    const handleViewHistory = async (item) => {
        setHistoryItem(item); setLoadingHistory(true);
        const res = await fetch(`/api/inventory/${item.id}/history`);
        setHistoryData(res.ok ? await res.json() : []);
        setLoadingHistory(false);
    };
    const handleSubmit = async () => {
        const url = isEditing ? `/api/inventory/${editId}` : '/api/inventory';
        const cat = isEditing ? formData.category : activeCategory;
        const res = await fetch(url, { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, category: cat }) });
        if (!res.ok) { toast.error('Operation failed'); return; }
        const data = await res.json();
        const savedId = isEditing ? editId : data.id;
        // Save BOM for SF/FG items
        if (BOM_CATEGORIES.includes(cat) && savedId) {
            await fetch(`/api/inventory/${savedId}/bom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lines: bomLines })
            });
        }
        resetForm();
        fetchItems();
    };
    const handleRestock = async () => {
        const res = await fetch('/api/inventory/restock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: restockItem.id, ...restockData }) });
        if (res.ok) {
            const d = await res.json();
            if (d.bomWarnings?.length > 0) toast.error('Warning: ' + d.bomWarnings[0], { duration: 6000 });
            setRestockItem(null); setRestockData({ quantity: 0, notes: '' }); setRestockBom([]);
            fetchItems();
        } else toast.error('Restock failed');
    };
    const handleDelete = async (id) => {
        if (!(await confirmDialog('Delete this item?'))) return;
        const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
        if (res.ok) fetchItems(); else { const d = await res.json(); toast.error(d.error || 'Failed'); }
    };
    const handleEdit = (item) => {
        setIsEditing(true); setEditId(item.id);
        setFormData({ name: item.name, item_code: item.item_code || '', category: item.category, type: item.type, uom: item.uom || 'Sheet', unit_cost: item.unit_cost, stock_quantity: item.stock_quantity, min_stock: item.min_stock || 0, width_cm: item.width_cm || '', height_cm: item.height_cm || '', description: item.description || '', is_active: item.is_active != null ? item.is_active : 1 });
        setBomLines([]);
        if (BOM_CATEGORIES.includes(item.category)) {
            fetch(`/api/inventory/${item.id}/bom`).then(r => r.json()).then(d => setBomLines(Array.isArray(d) ? d : []));
        }
        setShowAdd(true);
    };
    const handleCopy = (item) => { setIsEditing(false); setEditId(null); setFormData({ ...item, name: `${item.name} (Copy)`, item_code: '' }); setBomLines([]); setShowAdd(true); };
    const resetForm = () => { setShowAdd(false); setIsEditing(false); setEditId(null); setFormData({ ...EMPTY_FORM, category: activeCategory }); setBomLines([]); };
    const handleOpenRestock = async (item) => {
        setRestockItem(item);
        setRestockBom([]);
        if (BOM_CATEGORIES.includes(item.category)) {
            const r = await fetch(`/api/inventory/${item.id}/bom`);
            if (r.ok) setRestockBom(await r.json());
        }
    };
    const f = (k, v) => setFormData(p => ({ ...p, [k]: v }));

    const lowStockCount = items.filter(i => i.stock_quantity < (i.min_stock || 0)).length;

    return (
        <div className="text-white space-y-6">
            {/* ── Bulk Delete Progress Modal ── */}
            {deleteProgress && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#111]/95 border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-8 h-8 rounded-full border-2 border-red-500/50 border-t-red-400 animate-spin shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-white">Deleting items…</p>
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
            {/* QR Modal for Statics */}
            {qrItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setQrItem(null)}>
                    <div className="bg-[#0d0d1a] border border-violet-500/20 rounded-2xl p-8 w-full max-w-xs shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                        <p className="text-[10px] text-violet-400 uppercase tracking-widest font-bold mb-1">Statics QR Code</p>
                        <p className="text-white font-semibold text-sm mb-1 truncate">{qrItem.name}</p>
                        <p className="font-mono text-[11px] text-white/30 mb-5">{qrItem.item_code}</p>
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 mx-auto rounded-xl" />
                        ) : (
                            <div className="w-48 h-48 mx-auto rounded-xl bg-white/5 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border-2 border-violet-500/50 border-t-violet-400 animate-spin" />
                            </div>
                        )}
                        <p className="text-[10px] text-white/20 mt-4 break-all">{typeof window !== 'undefined' ? `${window.location.origin}/statics/${qrItem.id}` : ''}</p>
                        <button onClick={() => setQrItem(null)} className="mt-5 w-full py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-sm transition-all">Close</button>
                    </div>
                </div>
            )}
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
                        {activeCategory !== 'Statics' && <>
                            {isEditing ? null : <Input label="Stock Qty" type="number" value={formData.stock_quantity} onChange={e => f('stock_quantity', e.target.value)} className="bg-black/40 border-white/10" />}
                            <Input label="Min Stock" type="number" value={formData.min_stock} onChange={e => f('min_stock', e.target.value)} className="bg-black/40 border-white/10" />
                        </>}
                        {activeCategory === 'Statics' && (
                            <div className="flex flex-col gap-1.5 justify-end">
                                <label className="text-sm font-medium text-gray-400">Status</label>
                                <button type="button"
                                    onClick={() => f('is_active', formData.is_active ? 0 : 1)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                                        formData.is_active
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                                    }`}>
                                    <span className={`w-2 h-2 rounded-full ${formData.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    {formData.is_active ? 'Active' : 'Inactive'}
                                </button>
                            </div>
                        )}
                        <div className="flex items-end">
                            <Button onClick={handleSubmit} className="w-full bg-white text-black hover:bg-gray-100 h-[44px] text-sm font-semibold">{isEditing ? 'Update' : 'Save'}</Button>
                        </div>
                    </div>
                    {/* Description for Statics */}
                    {activeCategory === 'Statics' && (
                        <div className="mt-3">
                            <label className="text-sm font-medium text-gray-400 block mb-1.5">Description</label>
                            <textarea
                                rows={3}
                                value={formData.description}
                                onChange={e => f('description', e.target.value)}
                                placeholder="Describe this asset…"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none text-sm"
                            />
                        </div>
                    )}
                    {/* BOM Editor — only for SF / FG */}
                    {BOM_CATEGORIES.includes(isEditing ? formData.category : activeCategory) && (
                        <div className="mt-5 pt-5 border-t border-white/[0.06]">
                            <BomEditor bomLines={bomLines} onChange={setBomLines} />
                        </div>
                    )}
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
                <div className="flex items-center gap-3">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 bg-red-950/40 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-red-900/40 hover:border-red-500/50 hover:text-red-300 transition-all shadow-lg shadow-red-950/20"
                        >
                            <FiTrash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.length})
                        </button>
                    )}
                    <p className="text-xs text-white/30 shrink-0">{table.getFilteredRowModel().rows.length} items</p>
                </div>
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
                            {/* BOM deduction preview */}
                            {restockBom.length > 0 && (
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2">
                                    <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">BOM — Components to deduct</p>
                                    {restockBom.map((line, i) => {
                                        const deduct = parseFloat(line.quantity) * (parseFloat(restockData.quantity) || 0);
                                        const insufficient = deduct > parseFloat(line.component_stock || 0);
                                        return (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <span className="text-white/70">{line.component_name}</span>
                                                <span className={`font-mono ${insufficient ? 'text-red-400' : 'text-white/50'}`}>
                                                    -{deduct.toFixed(4)} {line.component_uom}
                                                    {insufficient && <span className="ml-1 text-[10px] text-red-400">(low!)</span>}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
