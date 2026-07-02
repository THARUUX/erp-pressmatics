'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiTrash2, FiDollarSign, FiX, FiCreditCard, FiTrendingUp, FiAlertCircle } from 'react-icons/fi';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

const METHOD_STYLES = {
    cash:          { label: 'Cash',          color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
    bank_transfer: { label: 'Bank Transfer', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
    cheque:        { label: 'Cheque',        color: 'bg-purple-500/10 border-purple-500/20 text-purple-400' },
    credit_note:   { label: 'Credit Note',   color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
};
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(n || 0);
const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-white/30 transition-colors";

function AddPaymentModal({ supplierId, pos, onClose, onAdded }) {
    const [form, setForm] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        method: 'bank_transfer',
        po_id: '',
        reference: '',
        notes: '',
    });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // When a PO is selected, auto-fill outstanding amount
    const handlePoChange = (poId) => {
        set('po_id', poId);
        if (poId) {
            const po = pos.find(p => p.id === parseInt(poId));
            if (po) set('amount', (parseFloat(po.total_amount) - parseFloat(po.paid_amount)).toFixed(2));
        }
    };

    const handleSave = async () => {
        if (!form.payment_date || !form.amount) { toast.error('Date and amount are required'); return; }
        if (parseFloat(form.amount) <= 0) { toast.error('Amount must be positive'); return; }
        setSaving(true);
        const res = await fetch(`/api/suppliers/${supplierId}/payments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        setSaving(false);
        if (res.ok) { toast.success('Payment recorded'); onAdded(); }
        else { const e = await res.json().catch(() => ({})); toast.error(e.error || 'Failed to record payment'); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2"><FiDollarSign className="text-emerald-400" /> Record Payment</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><FiX /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Link to Purchase Order (optional)</label>
                        <select value={form.po_id} onChange={e => handlePoChange(e.target.value)} className={inputCls}>
                            <option value="">— General payment —</option>
                            {pos.filter(p => p.status !== 'cancelled').map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.po_number} — Outstanding: {fmt(p.total_amount - p.paid_amount)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Payment Date *</label>
                            <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Amount *</label>
                            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Payment Method</label>
                        <select value={form.method} onChange={e => set('method', e.target.value)} className={inputCls}>
                            {Object.entries(METHOD_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Reference (Cheque No / Tx ID)</label>
                        <input value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="e.g. CHQ-001234" className={inputCls} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
                    </div>
                </div>
                <div className="p-5 border-t border-white/[0.06] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
                        {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiDollarSign className="w-4 h-4" />}
                        {saving ? 'Saving…' : 'Record Payment'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PaymentsTab({ supplierId }) {
    const [payments, setPayments] = useState([]);
    const [balance, setBalance]   = useState({ total_purchased: 0, total_paid: 0, outstanding: 0 });
    const [pos, setPos]           = useState([]);
    const [loading, setLoading]   = useState(true);
    const [showAdd, setShowAdd]   = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [pmtRes, balRes, posRes] = await Promise.all([
            fetch(`/api/suppliers/${supplierId}/payments`),
            fetch(`/api/suppliers/${supplierId}/balance`),
            fetch(`/api/purchase-orders?supplier_id=${supplierId}`),
        ]);
        const pmtData = await pmtRes.json();
        const balData = await balRes.json();
        const posData = await posRes.json();
        setPayments(Array.isArray(pmtData) ? pmtData : []);
        if (balData && !balData.error) setBalance(balData);
        setPos(Array.isArray(posData) ? posData : []);
        setLoading(false);
    }, [supplierId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleDelete = async (id) => {
        if (!(await confirmDialog('Delete this payment record?', { danger: true, confirmLabel: 'Delete' }))) return;
        const res = await fetch(`/api/suppliers/${supplierId}/payments/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Payment deleted'); fetchAll(); }
        else toast.error('Failed to delete payment');
    };

    const pctPaid = balance.total_purchased > 0
        ? Math.min(100, (balance.total_paid / balance.total_purchased) * 100)
        : 0;

    return (
        <div className="space-y-5">
            {showAdd && (
                <AddPaymentModal supplierId={supplierId} pos={pos}
                    onClose={() => setShowAdd(false)}
                    onAdded={() => { setShowAdd(false); fetchAll(); }} />
            )}

            {/* Balance Summary */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Purchased', value: balance.total_purchased, color: 'text-white', icon: FiTrendingUp },
                    { label: 'Total Paid', value: balance.total_paid, color: 'text-emerald-400', icon: FiCreditCard },
                    { label: 'Outstanding', value: balance.outstanding, color: balance.outstanding > 0 ? 'text-amber-400' : 'text-emerald-400', icon: FiAlertCircle },
                ].map(card => (
                    <div key={card.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <card.icon className="w-4 h-4 text-gray-600" />
                            <span className="text-xs text-gray-500">{card.label}</span>
                        </div>
                        <p className={`text-xl font-bold ${card.color}`}>{fmt(card.value)}</p>
                    </div>
                ))}
            </div>

            {/* Progress bar */}
            {balance.total_purchased > 0 && (
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span>Payment Progress</span>
                        <span>{pctPaid.toFixed(1)}% paid</span>
                    </div>
                    <div className="w-full bg-white/[0.06] rounded-full h-2">
                        <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pctPaid}%`, background: pctPaid >= 100 ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #06b6d4)' }}
                        />
                    </div>
                </div>
            )}

            {/* Payments Table */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                    <span className="text-sm font-semibold text-gray-400">{payments.length} payment record{payments.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => setShowAdd(true)}
                        className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-xl text-sm hover:bg-emerald-500/30 transition-colors">
                        <FiPlus className="w-4 h-4" /> Record Payment
                    </button>
                </div>
                {loading ? (
                    <div className="py-16 text-center text-gray-600 animate-pulse text-sm">Loading payments…</div>
                ) : payments.length === 0 ? (
                    <div className="py-16 text-center space-y-2">
                        <FiDollarSign className="w-10 h-10 text-gray-700 mx-auto" />
                        <p className="text-gray-500 text-sm">No payments recorded</p>
                    </div>
                ) : (
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-white/[0.06] bg-black/20">
                                {['Date', 'Amount', 'Method', 'PO', 'Reference', 'Notes', ''].map(h => (
                                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-600">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(p => {
                                const m = METHOD_STYLES[p.method] || { label: p.method, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' };
                                return (
                                    <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.payment_date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 font-bold text-emerald-400">{fmt(p.amount)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${m.color}`}>{m.label}</span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.po_number || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{p.reference || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px] truncate">{p.notes || '—'}</td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => handleDelete(p.id)}
                                                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                                <FiTrash2 size={13} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
