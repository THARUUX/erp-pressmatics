'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FiArrowLeft, FiTruck, FiSave, FiUser, FiPhone, FiMail,
    FiMapPin, FiDollarSign, FiFileText, FiPlus, FiTrash2, FiPackage,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useSettings } from '@/components/SettingsContext';

const PAYMENT_TERMS = ['Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'COD', 'Prepaid', 'Custom'];

function Field({ label, icon: Icon, children }) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                {Icon && <Icon className="w-3.5 h-3.5" />} {label}
            </label>
            {children}
        </div>
    );
}
const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30 transition-colors";

export default function NewSupplierPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const { settings } = useSettings();
    const currency = settings.currency;

    const [form, setForm] = useState({
        name: '', email: '', phone: '', address: '',
        contact_name: '', contact_phone: '', contact_email: '',
        payment_terms: 'Net 30', credit_limit: '', notes: '', starting_outstanding: '',
    });

    // Supplier items added at creation time
    const [items, setItems] = useState([]);
    const [newItem, setNewItem] = useState({
        item_name: '', sku: '', unit_price: '', uom: 'Unit', min_order_qty: '1', lead_time_days: '0', notes: '',
    });

    const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const setItemField = (k, v) => setNewItem(f => ({ ...f, [k]: v }));

    const addItem = () => {
        if (!newItem.item_name.trim()) { toast.error('Item name is required'); return; }
        setItems(prev => [...prev, { ...newItem, id: Date.now() }]);
        setNewItem({ item_name: '', sku: '', unit_price: '', uom: 'Unit', min_order_qty: '1', lead_time_days: '0', notes: '' });
    };
    const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Supplier name is required'); return; }
        setSaving(true);
        try {
            const res  = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || 'Failed to create supplier'); setSaving(false); return; }

            const supplierId = data.id;

            // Create catalog items
            for (const item of items) {
                await fetch(`/api/suppliers/${supplierId}/items`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item),
                });
            }

            toast.success('Supplier created!');
            router.push(`/dashboard/suppliers/${supplierId}`);
        } catch {
            toast.error('An error occurred');
            setSaving(false);
        }
    };

    return (
        <div className="text-white max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/suppliers">
                    <button className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <FiArrowLeft className="w-4 h-4" />
                    </button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FiTruck className="text-indigo-400" /> New Supplier
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">Add a supplier and their catalog</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* ── Basic Info ── */}
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest flex items-center gap-2">
                        <FiTruck className="w-4 h-4" /> Company Details
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Supplier Name *" icon={FiTruck}>
                            <input value={form.name} onChange={e => setField('name', e.target.value)}
                                placeholder="e.g. Acme Paper Supplies" className={inputCls} required />
                        </Field>
                        <Field label="Email" icon={FiMail}>
                            <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
                                placeholder="supplier@example.com" className={inputCls} />
                        </Field>
                        <Field label="Phone" icon={FiPhone}>
                            <input value={form.phone} onChange={e => setField('phone', e.target.value)}
                                placeholder="+94 77 567 8900" className={inputCls} />
                        </Field>
                        <Field label="Payment Terms" icon={FiDollarSign}>
                            <select value={form.payment_terms} onChange={e => setField('payment_terms', e.target.value)} className={inputCls}>
                                {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                        <Field label="Credit Limit" icon={FiDollarSign}>
                            <input type="number" min="0" step="0.01" value={form.credit_limit}
                                onChange={e => setField('credit_limit', e.target.value)}
                                placeholder="0.00" className={inputCls} />
                        </Field>
                        <Field label="Starting Outstanding" icon={FiDollarSign}>
                            <input type="number" min="0" step="0.01" value={form.starting_outstanding}
                                onChange={e => setField('starting_outstanding', e.target.value)}
                                placeholder="0.00" className={inputCls} />
                        </Field>
                        <Field label="Address" icon={FiMapPin}>
                            <input value={form.address} onChange={e => setField('address', e.target.value)}
                                placeholder="123 Street, City, Country" className={inputCls} />
                        </Field>
                    </div>
                    <Field label="Notes" icon={FiFileText}>
                        <textarea value={form.notes} onChange={e => setField('notes', e.target.value)}
                            rows={2} placeholder="Internal notes about this supplier…" className={`${inputCls} resize-none`} />
                    </Field>
                </div>

                {/* ── Contact Person ── */}
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest flex items-center gap-2">
                        <FiUser className="w-4 h-4" /> Contact Person
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field label="Name" icon={FiUser}>
                            <input value={form.contact_name} onChange={e => setField('contact_name', e.target.value)}
                                placeholder="John Doe" className={inputCls} />
                        </Field>
                        <Field label="Phone" icon={FiPhone}>
                            <input value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)}
                                placeholder="+1 234 567 8901" className={inputCls} />
                        </Field>
                        <Field label="Email" icon={FiMail}>
                            <input type="email" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)}
                                placeholder="john@supplier.com" className={inputCls} />
                        </Field>
                    </div>
                </div>

                {/* ── Catalog Items ── */}
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest flex items-center gap-2">
                        <FiPackage className="w-4 h-4" /> Supplier Catalog (optional)
                    </h2>
                    <p className="text-xs text-gray-600">Add items this supplier provides. You can also add them later from the supplier detail page.</p>

                    {/* New item row */}
                    <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3">
                            <label className="text-xs text-gray-500 mb-1 block">Item Name</label>
                            <input value={newItem.item_name} onChange={e => setItemField('item_name', e.target.value)}
                                placeholder="e.g. A4 Paper 80gsm" className={inputCls} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-gray-500 mb-1 block">SKU</label>
                            <input value={newItem.sku} onChange={e => setItemField('sku', e.target.value)}
                                placeholder="SUP-SKU-001" className={inputCls} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-gray-500 mb-1 block">Unit Price</label>
                            <input type="number" min="0" step="0.0001" value={newItem.unit_price}
                                onChange={e => setItemField('unit_price', e.target.value)}
                                placeholder="0.00" className={inputCls} />
                        </div>
                        <div className="col-span-1">
                            <label className="text-xs text-gray-500 mb-1 block">UOM</label>
                            <input value={newItem.uom} onChange={e => setItemField('uom', e.target.value)}
                                placeholder="Unit" className={inputCls} />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-gray-500 mb-1 block">Min Qty</label>
                            <input type="number" min="0" step="0.01" value={newItem.min_order_qty}
                                onChange={e => setItemField('min_order_qty', e.target.value)}
                                className={inputCls} />
                        </div>
                        <div className="col-span-2">
                            <button type="button" onClick={addItem}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-3 py-2.5 rounded-xl text-sm hover:bg-indigo-500/30 transition-colors">
                                <FiPlus className="w-4 h-4" /> Add
                            </button>
                        </div>
                    </div>

                    {items.length > 0 && (
                        <div className="space-y-2 mt-2">
                            {items.map(item => (
                                <div key={item.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5">
                                    <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                                        <span className="font-medium text-white">{item.item_name}</span>
                                        <span className="text-gray-500 font-mono text-xs">{item.sku || '—'}</span>
                                        <span className="text-emerald-400 font-semibold">{currency} {parseFloat(item.unit_price || 0).toFixed(2)} / {item.uom}</span>
                                        <span className="text-gray-500 text-xs">Min: {item.min_order_qty}</span>
                                    </div>
                                    <button type="button" onClick={() => removeItem(item.id)}
                                        className="text-gray-600 hover:text-red-400 transition-colors">
                                        <FiTrash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Actions ── */}
                <div className="flex justify-end gap-3 pb-8">
                    <Link href="/dashboard/suppliers">
                        <button type="button" className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors text-sm">
                            Cancel
                        </button>
                    </Link>
                    <button type="submit" disabled={saving}
                        className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-60">
                        {saving ? (
                            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        ) : (
                            <FiSave className="w-4 h-4" />
                        )}
                        {saving ? 'Saving…' : 'Create Supplier'}
                    </button>
                </div>
            </form>
        </div>
    );
}
