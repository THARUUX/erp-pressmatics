'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPackage, FiCheck, FiX, FiLink } from 'react-icons/fi';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useSettings } from '@/components/SettingsContext';

const inputCls = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30 transition-colors w-full";

const EMPTY_ITEM = { item_name: '', sku: '', unit_price: '', uom: 'Unit', min_order_qty: '1', lead_time_days: '0', notes: '' };

function ItemRow({ item, supplierId, onRefresh }) {
    const {settings} = useSettings();
    const currency = settings.currency;
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(item);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        const res = await fetch(`/api/suppliers/${supplierId}/items/${item.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        if (res.ok) { toast.success('Item updated'); setEditing(false); onRefresh(); }
        else toast.error('Failed to update item');
    };

    const handleDelete = async () => {
        if (!(await confirmDialog(`Remove "${item.item_name}" from catalog?`, { danger: true, confirmLabel: 'Remove' }))) return;
        const res = await fetch(`/api/suppliers/${supplierId}/items/${item.id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Item removed'); onRefresh(); }
        else toast.error('Failed to remove item');
    };

    if (editing) {
        return (
            <tr className="border-b border-white/[0.06] bg-indigo-500/5">
                <td className="px-3 py-2"><input value={form.item_name} onChange={e => set('item_name', e.target.value)} className={inputCls} /></td>
                <td className="px-3 py-2"><input value={form.sku || ''} onChange={e => set('sku', e.target.value)} className={inputCls} /></td>
                <td className="px-3 py-2"><input type="number" min="0" step="0.0001" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} className={inputCls} /></td>
                <td className="px-3 py-2"><input value={form.uom} onChange={e => set('uom', e.target.value)} className={inputCls} /></td>
                <td className="px-3 py-2"><input type="number" min="0" value={form.min_order_qty} onChange={e => set('min_order_qty', e.target.value)} className={inputCls} /></td>
                <td className="px-3 py-2"><input type="number" min="0" value={form.lead_time_days} onChange={e => set('lead_time_days', e.target.value)} className={inputCls} /></td>
                <td className="px-3 py-2">
                    <div className="flex gap-1">
                        <button onClick={handleSave} className="p-1.5 rounded text-emerald-400 hover:bg-emerald-500/10"><FiCheck size={14} /></button>
                        <button onClick={() => { setForm(item); setEditing(false); }} className="p-1.5 rounded text-gray-500 hover:bg-white/5"><FiX size={14} /></button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
            <td className="px-3 py-3 text-sm font-medium text-white">
                {item.item_name}
                {item.inventory_item_id && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
                        <FiLink className="w-2.5 h-2.5" /> {item.item_code || 'linked'}
                    </span>
                )}
            </td>
            <td className="px-3 py-3 text-xs text-gray-500 font-mono">{item.sku || '—'}</td>
            <td className="px-3 py-3 text-sm font-semibold text-emerald-400">{currency}{parseFloat(item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td className="px-3 py-3 text-xs text-gray-400">{item.uom}</td>
            <td className="px-3 py-3 text-xs text-gray-400">{parseFloat(item.min_order_qty || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td className="px-3 py-3 text-xs text-gray-400">{item.lead_time_days}d</td>
            <td className="px-3 py-3">
                <div className="flex gap-1">
                    <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"><FiEdit2 size={13} /></button>
                    <button onClick={handleDelete} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"><FiTrash2 size={13} /></button>
                </div>
            </td>
        </tr>
    );
}

export default function CatalogTab({ supplierId }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newItem, setNewItem] = useState(EMPTY_ITEM);
    const [invItems, setInvItems] = useState([]);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`/api/suppliers/${supplierId}/items`);
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
    }, [supplierId]);

    useEffect(() => {
        fetchItems();
        fetch('/api/inventory').then(r => r.json()).then(d => setInvItems(Array.isArray(d) ? d : []));
    }, [fetchItems]);

    const setField = (k, v) => setNewItem(f => ({ ...f, [k]: v }));

    const handleAdd = async () => {
        if (!newItem.item_name.trim()) { toast.error('Item name is required'); return; }
        const res = await fetch(`/api/suppliers/${supplierId}/items`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newItem),
        });
        if (res.ok) { toast.success('Item added'); setNewItem(EMPTY_ITEM); setShowAdd(false); fetchItems(); }
        else toast.error('Failed to add item');
    };

    // If an inventory item is selected, pre-fill name and UOM
    const handleInvLink = (invId) => {
        const inv = invItems.find(i => i.id === parseInt(invId));
        if (inv) setNewItem(f => ({ ...f, inventory_item_id: inv.id, item_name: inv.name, uom: inv.uom || 'Unit' }));
        else setNewItem(f => ({ ...f, inventory_item_id: null }));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400">{items.length} catalog item{items.length !== 1 ? 's' : ''}</h3>
                <button onClick={() => setShowAdd(v => !v)}
                    className="flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-2 rounded-xl text-sm hover:bg-indigo-500/30 transition-colors">
                    <FiPlus className="w-4 h-4" /> Add Item
                </button>
            </div>

            {/* Add form */}
            {showAdd && (
                <div className="bg-black/40 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">New Catalog Item</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="text-xs text-gray-500 mb-1 block">Link to Inventory Item (optional)</label>
                            <select onChange={e => handleInvLink(e.target.value)} className={inputCls}>
                                <option value="">— None —</option>
                                {invItems.map(i => <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Item Name *</label>
                            <input value={newItem.item_name} onChange={e => setField('item_name', e.target.value)} placeholder="e.g. A4 Paper" className={inputCls} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Supplier SKU</label>
                            <input value={newItem.sku} onChange={e => setField('sku', e.target.value)} placeholder="SKU-001" className={inputCls} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Unit Price</label>
                            <input type="number" min="0" step="0.0001" value={newItem.unit_price} onChange={e => setField('unit_price', e.target.value)} placeholder="0.0000" className={inputCls} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">UOM</label>
                            <input value={newItem.uom} onChange={e => setField('uom', e.target.value)} placeholder="Unit" className={inputCls} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Min Order Qty</label>
                            <input type="number" min="0" step="0.01" value={newItem.min_order_qty} onChange={e => setField('min_order_qty', e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Lead Time (days)</label>
                            <input type="number" min="0" value={newItem.lead_time_days} onChange={e => setField('lead_time_days', e.target.value)} className={inputCls} />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                        <button onClick={handleAdd} className="flex items-center gap-2 bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 px-4 py-2 rounded-xl text-sm hover:bg-indigo-500/40 transition-colors">
                            <FiPlus className="w-3.5 h-3.5" /> Add to Catalog
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-gray-600 animate-pulse text-sm">Loading catalog…</div>
                ) : items.length === 0 ? (
                    <div className="py-16 text-center space-y-2">
                        <FiPackage className="w-10 h-10 text-gray-700 mx-auto" />
                        <p className="text-gray-500 text-sm">No items in catalog yet</p>
                    </div>
                ) : (
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-white/[0.06] bg-black/20">
                                {['Item Name', 'SKU', 'Unit Price', 'UOM', 'Min Qty', 'Lead Time', ''].map(h => (
                                    <th key={h} className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-600">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <ItemRow key={item.id} item={item} supplierId={supplierId} onRefresh={fetchItems} />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
