'use client';
import toast from 'react-hot-toast';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import { useSettings } from '@/components/SettingsContext';

function NewInvoiceForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';

    const [saving, setSaving] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [form, setForm] = useState({
        customer_id: searchParams.get('customer_id') || null,
        customer_name: searchParams.get('customer_name') || '',
        quotation_id: searchParams.get('quotation_id') || '',
        description: searchParams.get('description') || '',
        amount_due: searchParams.get('amount') || '',
        due_date: '',
        notes: '',
        status: 'draft',
    });

    useEffect(() => {
        Promise.all([
            fetch('/api/customers').then(r => r.json()),
            fetch('/api/quotations?limit=100').then(r => r.json()),
        ]).then(([cData, qData]) => {
            setCustomers(Array.isArray(cData) ? cData : []);
            setQuotations(Array.isArray(qData?.quotations) ? qData.quotations : (Array.isArray(qData) ? qData : []));
        }).catch(console.error);
    }, []);

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    // When quotation selected, auto-fill amount + description
    const handleQuotationChange = (qId) => {
        set('quotation_id', qId);
        if (!qId) return;
        const q = quotations.find(q => String(q.id) === String(qId));
        if (q) {
            set('amount_due', q.total_amount || '');
            if (!form.description) set('description', q.job_description || q.estimation_name || '');
        }
    };

    const handleSave = async () => {
        if (!form.customer_name) return toast.error('Customer name is required');
        if (!form.amount_due || parseFloat(form.amount_due) <= 0) return toast.error('Amount due must be > 0');

        setSaving(true);
        try {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                router.push(`/dashboard/invoices/${data.id}`);
            } else {
                toast.error('Failed to create invoice: ' + data.error);
            }
        } catch (e) {
            console.error(e);
            toast.error('Error saving invoice');
        } finally {
            setSaving(false);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-transparent text-white p-4 md:p-8 max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/dashboard/invoices">
                    <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <FiArrowLeft />
                    </button>
                </Link>
                <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">New</p>
                    <h1 className="text-2xl font-bold tracking-tighter">Create Invoice</h1>
                </div>
            </div>

            <div className="space-y-5">
                {/* Customer */}
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Bill To</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {/* Customer Search */}
                        <div className="relative sm:col-span-2">
                            <label className="block text-xs text-gray-400 mb-1.5">Customer *</label>
                            <input
                                value={form.customer_name || customerSearch}
                                onChange={e => {
                                    setCustomerSearch(e.target.value);
                                    set('customer_name', e.target.value);
                                    set('customer_id', null);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                placeholder="Search customer..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30"
                            />
                            {showSuggestions && filteredCustomers.length > 0 && (
                                <ul className="absolute z-50 w-full mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl max-h-52 overflow-y-auto">
                                    {filteredCustomers.map(c => (
                                        <li
                                            key={c.id}
                                            onClick={() => {
                                                set('customer_name', c.name);
                                                set('customer_id', c.id);
                                                setCustomerSearch('');
                                                setShowSuggestions(false);
                                            }}
                                            className="px-4 py-2.5 text-sm hover:bg-white/10 cursor-pointer flex justify-between"
                                        >
                                            <span>{c.name}</span>
                                            <span className="text-gray-500 text-xs">{c.phone || c.email}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Link Quotation */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1.5">Link to Quotation (optional)</label>
                            <select
                                value={form.quotation_id}
                                onChange={e => handleQuotationChange(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30"
                            >
                                <option value="">— None —</option>
                                {quotations.map(q => (
                                    <option key={q.id} value={q.id}>
                                        {q.code} — {q.customer_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1.5">Status</label>
                            <select
                                value={form.status}
                                onChange={e => set('status', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30"
                            >
                                <option value="draft">Draft</option>
                                <option value="sent">Sent</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Billing Details */}
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Billing Details</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-400 mb-1.5">Description</label>
                            <textarea
                                value={form.description}
                                onChange={e => set('description', e.target.value)}
                                rows={2}
                                placeholder="Invoice description / job reference..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30 resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1.5">Amount Due ({currency}) *</label>
                            <input
                                type="number"
                                value={form.amount_due}
                                onChange={e => set('amount_due', e.target.value)}
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1.5">Due Date</label>
                            <input
                                type="date"
                                value={form.due_date}
                                onChange={e => set('due_date', e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-400 mb-1.5">Notes (internal)</label>
                            <textarea
                                value={form.notes}
                                onChange={e => set('notes', e.target.value)}
                                rows={2}
                                placeholder="Any internal notes..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30 resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Split-bill hint */}
                {form.quotation_id && (() => {
                    const q = quotations.find(q => String(q.id) === String(form.quotation_id));
                    return q ? (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-5 py-3 text-xs text-blue-300">
                            <strong>Quotation total:</strong> {currency} {parseFloat(q.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}.
                            You can invoice a partial amount (e.g. deposit) — create another invoice for the remainder later.
                        </div>
                    ) : null;
                })()}

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black rounded-xl font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 shadow-lg"
                >
                    <FiSave /> {saving ? 'Creating...' : 'Create Invoice'}
                </button>
            </div>
        </div>
    );
}

export default function NewInvoicePage() {
    return (
        <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
            <NewInvoiceForm />
        </Suspense>
    );
}
