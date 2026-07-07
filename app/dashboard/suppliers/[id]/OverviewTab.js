'use client';

import { useState, useEffect } from 'react';
import { FiSave, FiTruck, FiMail, FiPhone, FiMapPin, FiDollarSign, FiFileText, FiUser, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import toast from 'react-hot-toast';

const PAYMENT_TERMS = ['Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'COD', 'Prepaid', 'Custom'];
const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30 transition-colors";

function Field({ label, icon: Icon, children }) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                {Icon && <Icon className="w-3 h-3" />} {label}
            </label>
            {children}
        </div>
    );
}

export default function OverviewTab({ supplier, onRefresh }) {
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (supplier) setForm({ ...supplier });
    }, [supplier]);

    if (!form) return null;

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        const res = await fetch(`/api/suppliers/${supplier.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setSaving(false);
        if (res.ok) { toast.success('Supplier updated'); onRefresh(); }
        else toast.error('Failed to update supplier');
    };

    return (
        <div className="space-y-5">
            {/* Company Info */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <FiTruck className="w-3.5 h-3.5" /> Company Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Supplier Name *" icon={FiTruck}>
                        <input value={form.name || ''} onChange={e => set('name', e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Email" icon={FiMail}>
                        <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="—" className={inputCls} />
                    </Field>
                    <Field label="Phone" icon={FiPhone}>
                        <input value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="—" className={inputCls} />
                    </Field>
                    <Field label="Payment Terms" icon={FiDollarSign}>
                        <select value={form.payment_terms || 'Net 30'} onChange={e => set('payment_terms', e.target.value)} className={inputCls}>
                            {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </Field>
                    <Field label="Credit Limit" icon={FiDollarSign}>
                        <input type="number" min="0" step="0.01" value={form.credit_limit || ''} onChange={e => set('credit_limit', e.target.value)} placeholder="0.00" className={inputCls} />
                    </Field>
                    <Field label="Starting Outstanding" icon={FiDollarSign}>
                        <input type="number" min="0" step="0.01" value={form.starting_outstanding || ''} onChange={e => set('starting_outstanding', e.target.value)} placeholder="0.00" className={inputCls} />
                    </Field>
                    <Field label="Address" icon={FiMapPin}>
                        <input value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="—" className={inputCls} />
                    </Field>
                </div>
                <Field label="Notes" icon={FiFileText}>
                    <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
                </Field>
                {/* Active toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                    <span className="text-sm text-gray-400">Active Status</span>
                    <button type="button" onClick={() => set('is_active', form.is_active ? 0 : 1)}
                        className="flex items-center gap-2 text-sm transition-colors">
                        {form.is_active
                            ? <><FiToggleRight className="w-6 h-6 text-emerald-400" /><span className="text-emerald-400">Active</span></>
                            : <><FiToggleLeft className="w-6 h-6 text-gray-600" /><span className="text-gray-600">Inactive</span></>}
                    </button>
                </div>
            </div>

            {/* Contact */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <FiUser className="w-3.5 h-3.5" /> Contact Person
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="Name" icon={FiUser}>
                        <input value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} placeholder="—" className={inputCls} />
                    </Field>
                    <Field label="Phone" icon={FiPhone}>
                        <input value={form.contact_phone || ''} onChange={e => set('contact_phone', e.target.value)} placeholder="—" className={inputCls} />
                    </Field>
                    <Field label="Email" icon={FiMail}>
                        <input type="email" value={form.contact_email || ''} onChange={e => set('contact_email', e.target.value)} placeholder="—" className={inputCls} />
                    </Field>
                </div>
            </div>

            <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-60">
                    {saving ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
