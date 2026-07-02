'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    FiPlus, FiTrash2, FiShoppingBag, FiDownload, FiX,
    FiChevronDown, FiChevronUp, FiCheck, FiClock, FiAlertCircle, FiSearch,
} from 'react-icons/fi';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
    draft:      'bg-gray-500/10 border-gray-500/20 text-gray-400',
    ordered:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
    partial:    'bg-amber-500/10 border-amber-500/20 text-amber-400',
    received:   'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    cancelled:  'bg-red-500/10 border-red-500/20 text-red-400',
};
const STATUS_ICONS = { draft: FiClock, ordered: FiShoppingBag, partial: FiAlertCircle, received: FiCheck, cancelled: FiX };
const inputCls = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30 transition-colors w-full";
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(n || 0);

// ── New PO Modal ────────────────────────────────────────────────────────────
function NewPOModal({ supplierId, catalogItems, onClose, onCreated }) {
    const [form, setForm] = useState({ order_date: new Date().toISOString().split('T')[0], expected_date: '', notes: '' });
    const [lines, setLines] = useState([]);
    const [saving, setSaving] = useState(false);

    const addLine = (catItem) => {
        if (lines.find(l => l._catId === catItem.id)) return;
        setLines(prev => [...prev, {
            _catId: catItem.id,
            supplier_item_id: catItem.id,
            inventory_item_id: catItem.inventory_item_id || null,
            item_name: catItem.item_name,
            quantity: 1,
            unit_price: parseFloat(catItem.unit_price || 0),
            uom: catItem.uom || 'Unit',
        }]);
    };

    const addCustomLine = () => setLines(prev => [...prev, { _catId: Date.now(), supplier_item_id: null, inventory_item_id: null, item_name: '', quantity: 1, unit_price: 0, uom: 'Unit' }]);
    const updateLine = (idx, k, v) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [k]: v } : l));
    const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));

    const subtotal = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0);

    const handleCreate = async () => {
        if (!lines.length) { toast.error('Add at least one item'); return; }
        if (lines.some(l => !l.item_name.trim())) { toast.error('All items need a name'); return; }
        setSaving(true);
        const res = await fetch('/api/purchase-orders', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ supplier_id: supplierId, ...form, items: lines }),
        });
        setSaving(false);
        if (res.ok) { const d = await res.json(); toast.success(`PO ${d.po_number} created`); onCreated(); }
        else { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to create PO'); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0d0d0d] z-10">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2"><FiShoppingBag className="text-blue-400" /> New Purchase Order</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><FiX /></button>
                </div>
                <div className="p-5 space-y-5">
                    {/* Dates & Notes */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Order Date *</label>
                            <input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Expected Delivery</label>
                            <input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} className={inputCls} />
                        </div>
                    </div>

                    {/* Quick-add from catalog */}
                    {catalogItems.length > 0 && (
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Add from Catalog</p>
                            <div className="flex flex-wrap gap-2">
                                {catalogItems.map(c => (
                                    <button key={c.id} onClick={() => addLine(c)}
                                        disabled={!!lines.find(l => l._catId === c.id)}
                                        className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                        {c.item_name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lines */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-500 uppercase tracking-widest">Order Lines</p>
                            <button onClick={addCustomLine} className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
                                <FiPlus className="w-3 h-3" /> Custom Line
                            </button>
                        </div>
                        {lines.length === 0 ? (
                            <p className="text-center text-gray-600 text-sm py-6 border border-dashed border-white/10 rounded-xl">No items added yet</p>
                        ) : (
                            <div className="space-y-2">
                                {lines.map((line, idx) => (
                                    <div key={line._catId} className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-4"><input value={line.item_name} onChange={e => updateLine(idx, 'item_name', e.target.value)} placeholder="Item name" className={inputCls} /></div>
                                        <div className="col-span-2"><input type="number" min="0" step="0.01" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} placeholder="Qty" className={inputCls} /></div>
                                        <div className="col-span-2"><input type="number" min="0" step="0.0001" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} placeholder="Price" className={inputCls} /></div>
                                        <div className="col-span-2"><input value={line.uom} onChange={e => updateLine(idx, 'uom', e.target.value)} placeholder="Unit" className={inputCls} /></div>
                                        <div className="col-span-1 text-right text-xs text-emerald-400 font-semibold">{fmt(line.quantity * line.unit_price)}</div>
                                        <div className="col-span-1 text-right"><button onClick={() => removeLine(idx)} className="text-gray-600 hover:text-red-400 transition-colors"><FiX className="w-3.5 h-3.5" /></button></div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {lines.length > 0 && (
                            <div className="flex justify-end pt-3 border-t border-white/[0.06] mt-3">
                                <span className="text-sm font-semibold text-white">Subtotal: <span className="text-emerald-400">{fmt(subtotal)}</span></span>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
                    </div>
                </div>
                <div className="p-5 border-t border-white/[0.06] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                    <button onClick={handleCreate} disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                        {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiShoppingBag className="w-4 h-4" />}
                        {saving ? 'Creating…' : 'Create PO'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Searchable Inventory Select ──────────────────────────────────────────────
function SearchableInventorySelect({ it, invLinks, setInvLinks, invItems }) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const selectedId = invLinks[it.id];
    const selectedItem = invItems.find(inv => String(inv.id) === String(selectedId));

    const filteredItems = invItems.filter(inv => {
        const term = search.toLowerCase();
        return (
            inv.name.toLowerCase().includes(term) ||
            (inv.item_code || '').toLowerCase().includes(term)
        );
    });

    return (
        <div className="relative w-full">
            <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/50 w-3.5 h-3.5" />
                <input
                    type="text"
                    placeholder="Search inventory items..."
                    value={isOpen ? search : (selectedItem ? `${selectedItem.name} (${selectedItem.item_code}) · Stock: ${selectedItem.stock_quantity} ${selectedItem.uom}` : '— Skip stock update —')}
                    onFocus={() => {
                        setSearch('');
                        setIsOpen(true);
                    }}
                    onBlur={() => {
                        setTimeout(() => setIsOpen(false), 200);
                    }}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-amber-500/30 rounded-lg pl-9 pr-8 py-1.5 text-sm text-white outline-none focus:border-amber-500/50 transition-colors"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                    <FiChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <ul className="absolute z-50 w-full bg-[#0d0d0d] border border-amber-500/30 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-2xl">
                    <li
                        onMouseDown={() => {
                            setInvLinks(l => ({ ...l, [it.id]: '' }));
                            setSearch('');
                            setIsOpen(false);
                        }}
                        className="px-3 py-2 text-gray-400 hover:bg-white/10 cursor-pointer text-sm font-medium border-b border-white/[0.06]"
                    >
                        — Skip stock update —
                    </li>
                    {filteredItems.map(inv => (
                        <li
                            key={inv.id}
                            onMouseDown={() => {
                                setInvLinks(l => ({ ...l, [it.id]: String(inv.id) }));
                                setSearch('');
                                setIsOpen(false);
                            }}
                            className={`px-3 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between items-center ${
                                String(selectedId) === String(inv.id) ? 'bg-amber-500/10 text-amber-400' : 'text-gray-300'
                            }`}
                        >
                            <div>
                                <span className="font-semibold block">{inv.name}</span>
                                <span className="text-[10px] text-gray-500">{inv.item_code}</span>
                            </div>
                            <span className="text-xs text-gray-400 font-mono">
                                Stock: {inv.stock_quantity} {inv.uom}
                            </span>
                        </li>
                    ))}
                    {filteredItems.length === 0 && (
                        <li className="px-3 py-2 text-gray-500 text-xs italic text-center">
                            No matching items found
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

// ── Receive Modal ───────────────────────────────────────────────────────────
function ReceiveModal({ po, onClose, onReceived }) {
    const [qtys, setQtys] = useState(() =>
        po.items.reduce((acc, it) => ({ ...acc, [it.id]: Math.max(0, it.quantity - it.received_qty) }), {})
    );
    // Override inventory_item_id for unlinked lines — keyed by poi_id
    const [invLinks, setInvLinks] = useState(() =>
        po.items.reduce((acc, it) => ({ ...acc, [it.id]: it.inventory_item_id || '' }), {})
    );
    const [invItems, setInvItems] = useState([]);
    const [saving, setSaving] = useState(false);

    // Check if any line is unlinked
    const hasUnlinked = po.items.some(it => !it.inventory_item_id);

    useEffect(() => {
        if (hasUnlinked) {
            fetch('/api/inventory')
                .then(r => r.json())
                .then(d => setInvItems(Array.isArray(d) ? d : []))
                .catch(() => {});
        }
    }, [hasUnlinked]);

    const handleReceive = async () => {
        const items = po.items
            .map(it => ({
                poi_id:              it.id,
                received_qty:        parseFloat(qtys[it.id] || 0),
                // Pass override link if user selected one for an unlinked item
                inventory_item_id:   invLinks[it.id] ? parseInt(invLinks[it.id]) : undefined,
            }))
            .filter(it => it.received_qty > 0);

        if (!items.length) { toast.error('Enter quantities to receive'); return; }
        setSaving(true);
        const res = await fetch(`/api/purchase-orders/${po.id}/receive`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
        });
        setSaving(false);
        if (res.ok) { const d = await res.json(); toast.success(`Stock received — PO is now ${d.status}`); onReceived(); }
        else toast.error('Failed to receive items');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] ">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0d0d0d] z-10">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2"><FiDownload className="text-emerald-400" /> Receive Stock — {po.po_number}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><FiX /></button>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-xs text-gray-500">Enter quantities received. For unlinked items, select an inventory item so stock is updated automatically.</p>
                    {po.items.map(it => {
                        const linked = it.inventory_item_id || invLinks[it.id];
                        return (
                            <div key={it.id} className={`rounded-xl space-y-2`}>
                                {/* Item name + ordered info */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-white">{it.item_name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Ordered: <span className="text-gray-300">{parseFloat(it.quantity || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {it.uom}</span>
                                            {' · '}Received so far: <span className="text-gray-300">{parseFloat(it.received_qty || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </p>
                                    </div>
                                    {/* Qty input */}
                                    <div className="shrink-0">
                                        <label className="text-[10px] text-gray-600 block text-center mb-0.5">Receive Qty</label>
                                        <input
                                            type="number" min="0"
                                            max={it.quantity - it.received_qty}
                                            step="0.01"
                                            value={qtys[it.id] ?? 0}
                                            onChange={e => setQtys(q => ({ ...q, [it.id]: e.target.value }))}
                                            className="w-28 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white text-center outline-none focus:border-white/30"
                                        />
                                    </div>
                                </div>

                                {/* Inventory link row */}
                                {it.inventory_item_id ? (
                                    <p className="text-xs text-indigo-400 flex items-center gap-1">
                                        <span className="text-indigo-500">→</span> Updates: {it.inv_item_name || it.item_code}
                                    </p>
                                ) : (
                                    <div>
                                        <label className="text-[10px] text-amber-400 uppercase tracking-widest mb-1 block">
                                            ⚠ No inventory link — select one to update stock:
                                        </label>
                                        <SearchableInventorySelect
                                            it={it}
                                            invLinks={invLinks}
                                            setInvLinks={setInvLinks}
                                            invItems={invItems}
                                        />
                                        {invLinks[it.id] && (
                                            <p className="text-[10px] text-emerald-400 mt-1">✓ Will update selected inventory item</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="p-5 border-t border-white/[0.06] flex justify-end gap-3 sticky bottom-0 bg-[#0d0d0d]">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                    <button onClick={handleReceive} disabled={saving}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                        {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiDownload className="w-4 h-4" />}
                        {saving ? 'Receiving…' : 'Confirm Receipt'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── PO Row ──────────────────────────────────────────────────────────────────
function PORow({ po, onRefresh }) {
    const [expanded, setExpanded] = useState(false);
    const [detail, setDetail] = useState(null);
    const [showReceive, setShowReceive] = useState(false);
    const StatusIcon = STATUS_ICONS[po.status] || FiClock;

    const loadDetail = async () => {
        if (!detail) {
            const res = await fetch(`/api/purchase-orders/${po.id}`);
            const d = await res.json();
            setDetail(d);
        }
        setExpanded(v => !v);
    };

    const handleDelete = async () => {
        if (!(await confirmDialog(`Delete PO ${po.po_number}?`, { danger: true, confirmLabel: 'Delete' }))) return;
        const res = await fetch(`/api/purchase-orders/${po.id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('PO deleted'); onRefresh(); }
        else { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Cannot delete PO'); }
    };

    const handleReceived = () => { setShowReceive(false); setDetail(null); onRefresh(); };

    const openReceive = async () => {
        const res = await fetch(`/api/purchase-orders/${po.id}`);
        const d = await res.json();
        setDetail(d);
        setShowReceive(true);
    };

    return (
        <>
            {showReceive && detail && <ReceiveModal po={detail} onClose={() => setShowReceive(false)} onReceived={handleReceived} />}
            <div className="border border-white/[0.06] rounded-xl bg-black/20 overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={loadDetail}>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLES[po.status]}`}>
                        <StatusIcon className="w-3 h-3" /> {po.status}
                    </span>
                    <span className="font-mono text-sm text-white font-semibold">{po.po_number}</span>
                    <span className="text-gray-500 text-xs">{new Date(po.order_date).toLocaleDateString()}</span>
                    <span className="ml-auto text-sm font-semibold text-white">{fmt(po.total_amount)}</span>
                    <span className={`text-xs ${po.paid_amount >= po.total_amount ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {fmt(po.paid_amount)} paid
                    </span>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        {(po.status === 'ordered' || po.status === 'partial') && (
                            <button onClick={openReceive} title="Receive stock"
                                className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                                <FiDownload size={13} />
                            </button>
                        )}
                        {po.status !== 'received' && (
                            <button onClick={handleDelete} title="Delete PO"
                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <FiTrash2 size={13} />
                            </button>
                        )}
                    </div>
                    {expanded ? <FiChevronUp className="w-4 h-4 text-gray-600" /> : <FiChevronDown className="w-4 h-4 text-gray-600" />}
                </div>
                {expanded && detail && (
                    <div className="border-t border-white/[0.06] px-4 pb-3">
                        <table className="w-full text-xs mt-3">
                            <thead><tr className="text-gray-600 border-b border-white/[0.04]">
                                {['Item', 'Qty', 'Unit Price', 'Total', 'Received', 'UOM'].map(h => <th key={h} className="text-left py-1.5 pr-3">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {(detail.items || []).map(it => (
                                    <tr key={it.id} className="border-b border-white/[0.03]">
                                        <td className="py-2 pr-3 text-white">{it.item_name}</td>
                                        <td className="py-2 pr-3 text-gray-400">{it.quantity}</td>
                                        <td className="py-2 pr-3 text-gray-400">{fmt(it.unit_price)}</td>
                                        <td className="py-2 pr-3 text-emerald-400 font-semibold">{fmt(it.total_price)}</td>
                                        <td className="py-2 pr-3">
                                            <span className={parseFloat(it.received_qty) >= parseFloat(it.quantity) ? 'text-emerald-400' : 'text-amber-400'}>
                                                {it.received_qty}/{it.quantity}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-3 text-gray-600">{it.uom}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {po.notes && <p className="text-xs text-gray-600 mt-2 italic">{po.notes}</p>}
                    </div>
                )}
            </div>
        </>
    );
}

// ── Main Tab ────────────────────────────────────────────────────────────────
export default function PurchaseOrdersTab({ supplierId }) {
    const [pos, setPos] = useState([]);
    const [catalogItems, setCatalogItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [posRes, catRes] = await Promise.all([
            fetch(`/api/purchase-orders?supplier_id=${supplierId}`),
            fetch(`/api/suppliers/${supplierId}/items`),
        ]);
        const posData = await posRes.json();
        const catData = await catRes.json();
        setPos(Array.isArray(posData) ? posData : []);
        setCatalogItems(Array.isArray(catData) ? catData : []);
        setLoading(false);
    }, [supplierId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleCreated = () => { setShowNew(false); fetchAll(); };

    return (
        <div className="space-y-4">
            {showNew && <NewPOModal supplierId={supplierId} catalogItems={catalogItems} onClose={() => setShowNew(false)} onCreated={handleCreated} />}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400">{pos.length} purchase order{pos.length !== 1 ? 's' : ''}</h3>
                <button onClick={() => setShowNew(true)}
                    className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 px-3 py-2 rounded-xl text-sm hover:bg-blue-500/30 transition-colors">
                    <FiPlus className="w-4 h-4" /> New PO
                </button>
            </div>
            {loading ? (
                <div className="py-16 text-center text-gray-600 animate-pulse text-sm">Loading orders…</div>
            ) : pos.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                    <FiShoppingBag className="w-10 h-10 text-gray-700 mx-auto" />
                    <p className="text-gray-500 text-sm">No purchase orders yet</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {pos.map(po => <PORow key={po.id} po={po} onRefresh={fetchAll} />)}
                </div>
            )}
        </div>
    );
}
