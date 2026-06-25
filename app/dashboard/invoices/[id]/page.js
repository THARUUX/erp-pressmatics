'use client';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiPrinter, FiPlus, FiTrash2, FiEdit2, FiSave, FiX, FiCheckCircle, FiFileText } from 'react-icons/fi';
import { useSettings } from '@/components/SettingsContext';


const STATUS_CONFIG = {
    draft:   { label: 'Draft',   color: 'bg-gray-500/20 text-gray-300 border-gray-500/30', print: 'border-gray-300 text-gray-400' },
    sent:    { label: 'Sent',    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', print: 'border-blue-400 text-blue-500' },
    partial: { label: 'Partial', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', print: 'border-amber-400 text-amber-500' },
    paid:    { label: 'Paid',    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', print: 'border-green-400 text-green-600' },
    overdue: { label: 'Overdue', color: 'bg-red-500/20 text-red-300 border-red-500/30', print: 'border-red-400 text-red-600' },
};

const METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Card', 'Online', 'Other'];

export default function InvoiceDetailPage({ params }) {
    const { id } = use(params);
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';

    const [invoice, setInvoice]   = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving]     = useState(false);
    const [showPayForm, setShowPayForm] = useState(false);
    const [payForm, setPayForm] = useState({ amount: '', method: 'Cash', reference: '', paid_at: new Date().toISOString().slice(0,10), notes: '' });
    const [recordingPay, setRecordingPay] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const data = await fetch(`/api/invoices/${id}`).then(r => r.json());
            setInvoice(data);
            setPayments(data.payments || []);
            setEditForm({ 
                customer_name: data.customer_name, 
                description: data.description, 
                amount_due: data.amount_due, 
                due_date: data.due_date?.slice(0,10) || '', 
                notes: data.notes, 
                invoice_notes: data.invoice_notes || '',
                status: data.status 
            });
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [id]);

    const handleSave = async () => {
        setSaving(true);
        await fetch(`/api/invoices/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({...invoice,...editForm}) });
        setSaving(false); setEditMode(false); load();
    };

    const handlePay = async () => {
        if (!payForm.amount || parseFloat(payForm.amount) <= 0) return toast.error('Enter a valid amount');
        setRecordingPay(true);
        await fetch(`/api/invoices/${id}/payments`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payForm) });
        setRecordingPay(false); setShowPayForm(false);
        setPayForm({ amount: '', method: 'Cash', reference: '', paid_at: new Date().toISOString().slice(0,10), notes: '' });
        load();
    };

    const handleDelPay = async (pid) => {
        if (!(await confirmDialog('Delete this payment?'))) return;
        await fetch(`/api/invoices/${id}/payments/${pid}`, { method: 'DELETE' });
        load();
    };

    const fmt = n => parseFloat(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});

    if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
    if (!invoice) return <div className="p-8 text-red-400">Invoice not found</div>;

    const balance = parseFloat(invoice.amount_due) - parseFloat(invoice.amount_paid);
    const paidPct = invoice.amount_due > 0 ? Math.min(100, (invoice.amount_paid / invoice.amount_due) * 100) : 0;
    const st = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;

    return (
        <div className="min-h-screen bg-transparent text-white">

            {/* ── TOOLBAR ── */}
            <div className="flex justify-between items-center mb-6 print:hidden">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/invoices">
                        <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"><FiArrowLeft /></button>
                    </Link>
                    <div>
                        <p className="text-xs text-gray-500 font-mono">{invoice.code}</p>
                        <h1 className="text-2xl font-bold tracking-tighter">{invoice.customer_name}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!editMode ? (<>
                        <button onClick={async () => setEditMode(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-white/5 border border-white/10 rounded-xl hover:bg-white/10"><FiEdit2 className="w-3.5 h-3.5"/>Edit</button>
                        <button onClick={async () => setShowPayForm(v=>!v)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-500"><FiPlus className="w-3.5 h-3.5"/>Record Payment</button>
                        <button onClick={async () => window.print()} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-white text-black rounded-xl font-semibold hover:bg-gray-100"><FiPrinter className="w-3.5 h-3.5"/>Print</button>
                    </>) : (<>
                        <button onClick={async () => setEditMode(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-white/5 border border-white/10 rounded-xl hover:bg-white/10"><FiX className="w-3.5 h-3.5"/>Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 disabled:opacity-50"><FiSave className="w-3.5 h-3.5"/>{saving?'Saving...':'Save'}</button>
                    </>)}
                </div>
            </div>

            {/* ── STATUS + BALANCE CARDS (outside A4) ── */}
            <div className="print:hidden grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className={`rounded-xl border px-4 py-3 ${st.color}`}>
                    <p className="text-[10px] uppercase tracking-widest mb-0.5 opacity-70">Status</p>
                    <p className="font-bold text-sm">{st.label}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Amount Due</p>
                    <p className="font-bold text-sm">{currency} {fmt(invoice.amount_due)}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-500 mb-0.5">Collected</p>
                    <p className="font-bold text-sm text-emerald-400">{currency} {fmt(invoice.amount_paid)}</p>
                </div>
                <div className={`rounded-xl border px-4 py-3 ${balance > 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
                    <p className={`text-[10px] uppercase tracking-widest mb-0.5 ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>Balance</p>
                    <p className={`font-bold text-sm ${balance > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{currency} {fmt(balance)}</p>
                </div>
            </div>

            {/* ── PROGRESS BAR (outside A4) ── */}
            <div className="print:hidden mb-5">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{paidPct.toFixed(0)}% collected</span>
                    {invoice.due_date && <span className={new Date(invoice.due_date) < new Date() && balance > 0 ? 'text-red-400' : 'text-gray-500'}>Due {new Date(invoice.due_date).toLocaleDateString('en-GB')}</span>}
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700" style={{width:`${paidPct}%`}}/>
                </div>
            </div>

            {/* ── DESCRIPTION CARD (outside A4) ── */}
            {invoice.description && (
                <div className="print:hidden mb-5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{invoice.description}</p>
                </div>
            )}

            {/* ── EDIT FORM (outside A4) ── */}
            {editMode && (
                <div className="print:hidden mb-5 bg-black/40 backdrop-blur-xl border border-blue-500/20 rounded-xl p-5">
                    <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold mb-4">Edit Invoice</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[['Customer Name','customer_name','text'],['Amount Due','amount_due','number'],['Due Date','due_date','date']].map(([label,key,type])=>(
                            <div key={key}>
                                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                                <input type={type} value={editForm[key]||''} onChange={e=>setEditForm(p=>({...p,[key]:e.target.value}))}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"/>
                            </div>
                        ))}
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Status</label>
                            <select value={editForm.status||'draft'} onChange={e=>setEditForm(p=>({...p,status:e.target.value}))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                                {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-400 mb-1">Description</label>
                            <input value={editForm.description||''} onChange={e=>setEditForm(p=>({...p,description:e.target.value}))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"/>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TERMS & CONDITIONS EDIT (outside A4) ── */}
            <div className="print:hidden mb-5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">Invoice Notes / Terms &amp; Conditions</p>
                <textarea
                    value={editForm.invoice_notes !== undefined ? editForm.invoice_notes : (invoice.invoice_notes || settings.default_invoice_notes || '')}
                    onChange={e => setEditForm(p => ({...p, invoice_notes: e.target.value}))}
                    onBlur={async () => {
                        const val = editForm.invoice_notes !== undefined ? editForm.invoice_notes : '';
                        await fetch(`/api/invoices/${id}`, {
                            method: 'PUT',
                            headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({...invoice, invoice_notes: val})
                        });
                    }}
                    rows={3}
                    placeholder={settings.default_invoice_notes || 'Enter invoice notes or terms and conditions...'}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 resize-none font-mono"
                />
                <p className="text-xs text-gray-600 mt-1">Auto-saved on blur. Leave empty to use default from Settings.</p>
            </div>

            {/* ── RECORD PAYMENT FORM (outside A4) ── */}
            {showPayForm && (
                <div className="print:hidden mb-5 bg-black/40 backdrop-blur-xl border border-emerald-500/20 rounded-xl p-5">
                    <p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold mb-4">Record Payment</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Amount ({currency}) *</label>
                            <input type="number" value={payForm.amount} onChange={e=>setPayForm(p=>({...p,amount:e.target.value}))} placeholder="0.00"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400"/>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Method</label>
                            <select value={payForm.method} onChange={e=>setPayForm(p=>({...p,method:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                                {METHODS.map(m=><option key={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Date *</label>
                            <input type="date" value={payForm.paid_at} onChange={e=>setPayForm(p=>({...p,paid_at:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"/>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Reference</label>
                            <input type="text" value={payForm.reference} onChange={e=>setPayForm(p=>({...p,reference:e.target.value}))} placeholder="Optional" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"/>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Notes</label>
                            <input type="text" value={payForm.notes} onChange={e=>setPayForm(p=>({...p,notes:e.target.value}))} placeholder="Optional" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"/>
                        </div>
                        <div className="flex items-end gap-2">
                            <button onClick={handlePay} disabled={recordingPay} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 flex items-center justify-center gap-1.5 disabled:opacity-50">
                                <FiCheckCircle className="w-3.5 h-3.5"/>{recordingPay?'Saving...':'Record'}
                            </button>
                            <button onClick={async () =>setShowPayForm(false)} className="py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:bg-white/10"><FiX className="w-3.5 h-3.5"/></button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PAYMENT LOG (outside A4) ── */}
            {payments.length > 0 && (
                <div className="print:hidden mb-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center">
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Payment Log</p>
                        <p className="text-xs text-emerald-400 font-semibold">{currency} {fmt(invoice.amount_paid)} collected of {currency} {fmt(invoice.amount_due)}</p>
                    </div>
                    {payments.map(p => (
                        <div key={p.id} className="flex items-center justify-between px-5 py-3 border-b border-white/5 last:border-0 text-sm group hover:bg-white/[0.02]">
                            <div className="flex items-center gap-3 text-gray-300">
                                <span className="text-sm text-gray-500 w-20">{new Date(p.paid_at).toLocaleDateString('en-GB')}</span>
                                <span className="text-sm bg-white/10 px-2 py-0.5 rounded-full">{p.method}</span>
                                {p.reference && <span className="text-sm font-mono text-gray-500">{p.reference}</span>}
                                {p.notes && <span className="text-sm text-gray-500">{p.notes}</span>}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-semibold font-mono text-emerald-400">{currency} {fmt(p.amount)}</span>
                                <Link
                                    href={`/dashboard/invoices/${id}/receipts/${p.id}`}
                                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-400 transition-all"
                                    title="View Receipt"
                                >
                                    <FiFileText className="w-3.5 h-3.5"/>
                                </Link>
                                <button onClick={async () =>handleDelPay(p.id)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"><FiTrash2 className="text-sm"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ══════════════════════════════════
                  A4 PRINTABLE INVOICE DOCUMENT
                ══════════════════════════════════ */}
            <div className="max-w-[210mm] mx-auto bg-white text-black p-12 rounded-xl shadow-2xl print:shadow-none print:rounded-none print:w-full min-h-[297mm] flex flex-col relative print:p-8"
                style={{ fontFamily: "'Google Sans', 'Product Sans', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>

                {/* Header */}
                <div className="flex justify-between items-start mb-12">
                    <div className="flex gap-4 items-start">
                        {settings.company_logo && <img src={settings.company_logo} alt="Logo" className="h-19 object-contain"/>}
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{settings.company_name || 'Pressmatics'}</h1>
                            <div className="text-sm text-gray-500 max-w-[250px] whitespace-pre-wrap mt-1">{settings.company_address || ''}</div>
                            {settings.company_vat_reg && invoice.customer_vat_reg && (
                                <div className="text-xs text-gray-400 mt-1">VAT Reg: <span className="font-mono">{settings.company_vat_reg}</span></div>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-4xl font-bold text-gray-200 uppercase tracking-widest mb-2">Invoice</h2>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-right">
                            <dt className="text-gray-500">Number:</dt><dd className="font-mono font-bold">{invoice.code}</dd>
                            <dt className="text-gray-500">Date:</dt><dd>{new Date(invoice.created_at).toLocaleDateString('en-GB')}</dd>
                            {invoice.due_date && <><dt className="text-gray-500">Due:</dt><dd className={balance > 0 && new Date(invoice.due_date) < new Date() ? 'text-red-600 font-bold' : ''}>{new Date(invoice.due_date).toLocaleDateString('en-GB')}</dd></>}
                            {invoice.quotation_code && <><dt className="text-gray-500">Ref:</dt><dd className="font-mono">{invoice.quotation_code}</dd></>}
                        </dl>
                    </div>
                </div>

                {/* Bill To */}
                <div className="mb-12">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 border-b border-gray-100 pb-1 w-32">Bill To</h3>
                    <p className="text-xl font-bold text-gray-900">{invoice.customer_name}</p>
                    {invoice.customer_address && <p className="text-sm text-gray-400 mt-1 max-w-md whitespace-pre-wrap leading-relaxed">{invoice.customer_address}</p>}
                    {(invoice.customer_phone || invoice.customer_email) && (
                        <div className="flex text-sm text-gray-400 gap-2 mt-1">
                            {invoice.customer_phone && <span>{invoice.customer_phone}</span>}
                            {invoice.customer_phone && invoice.customer_email && <span>|</span>}
                            {invoice.customer_email && <span>{invoice.customer_email}</span>}
                        </div>
                    )}
                    {invoice.customer_vat_number && (
                        <div className="text-xs text-gray-500 mt-1">VAT No: <span className="font-mono font-semibold text-gray-700">{invoice.customer_vat_number}</span></div>
                    )}
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-900 text-xs font-bold text-gray-900 uppercase tracking-wider">
                                <th className="py-3 pr-4">Description</th>
                                <th className="py-3 pl-4 text-right">Amount ({currency})</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            <tr className="border-b border-gray-100">
                                <td className="py-5 pr-4">
                                    <div className="font-bold text-gray-900">{invoice.description || 'Services Rendered'}</div>
                                    {invoice.quotation_code && <div className="text-xs text-gray-400 mt-1">Quotation Ref: {invoice.quotation_code}</div>}
                                </td>
                                <td className="py-5 pl-4 text-right font-mono font-bold text-gray-900">{fmt(invoice.amount_due)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-10">
                    <div className="w-64 space-y-2">
                        {parseFloat(invoice.amount_paid) > 0 && <>
                            <div className="flex justify-between text-sm text-gray-500">
                                <span>Invoice Amount</span><span className="font-mono">{fmt(invoice.amount_due)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-emerald-600">
                                <span>Amount Paid</span><span className="font-mono">− {fmt(invoice.amount_paid)}</span>
                            </div>
                        </>}
                        <div className="flex justify-between items-end border-t-2 border-gray-900 pt-3">
                            <span className="font-bold text-gray-900">{parseFloat(invoice.amount_paid) > 0 ? 'Balance Due' : 'Total Due'}</span>
                            <span className={`font-bold font-mono text-lg ${balance <= 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{fmt(balance > 0 ? balance : invoice.amount_due)}</span>
                        </div>
                    </div>
                </div>

                {/* Payment History (print only) */}
                {/* {payments.length > 0 && (
                    <div className="mb-10">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 border-b border-gray-100 pb-1">Payment History</h4>
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase border-b border-gray-200">
                                    <th className="py-2 pr-4">Date</th><th className="py-2 px-4">Method</th><th className="py-2 px-4">Reference</th><th className="py-2 pl-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.id} className="border-b border-gray-50">
                                        <td className="py-2 pr-4 text-gray-600">{new Date(p.paid_at).toLocaleDateString('en-GB')}</td>
                                        <td className="py-2 px-4 text-gray-600">{p.method}</td>
                                        <td className="py-2 px-4 font-mono text-xs text-gray-500">{p.reference || '—'}</td>
                                        <td className="py-2 pl-4 text-right font-mono font-semibold text-emerald-700">{fmt(p.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )} */}

                    {/* Terms */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Terms &amp; Conditions</h4>
                        <div className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
                            {(editForm.invoice_notes !== undefined ? editForm.invoice_notes : invoice.invoice_notes) || settings.default_invoice_notes || 'Payment is due by the date specified above.'}
                        </div>
                    </div>
                <div className="flex-1"/>

                {/* Footer: 3-column signature layout */}
                <div className="grid grid-cols-3 gap-8 border-t border-gray-100 pt-8 mt-8">
                    {/* Customer Signature */}
                    <div className="flex flex-col justify-end items-center">
                        <div className="h-10 mb-2 w-full"/>{/* Space for customer to sign */}
                        <div className="border-t border-gray-300 w-full pt-1 text-center">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Customer Signature</p>
                        </div>
                    </div>
                    <div className="flex flex-col justify-end items-center">
                        <div className="h-10 mb-2 w-full"/>{/* Space for customer to sign */}
                        <div className="border-t border-gray-300 w-full pt-1 text-center">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Prepared By</p>
                        </div>
                    </div>
                    {/* Authorized Signature */}
                    <div className="flex flex-col justify-end items-center">
                        {settings.company_signature && <img src={settings.company_signature} alt="Signature" className="h-10 mb-2 object-contain"/>}
                        {!settings.company_signature && <div className="h-10 mb-2 w-full"/>}
                        <div className="border-t border-gray-300 w-full pt-1 text-center">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Authorized Signature</p>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-8 pt-4 border-t border-gray-50">
                    <p className="text-xs text-gray-300 uppercase tracking-widest">Thank you for your business</p>
                </div>
            </div>
        </div>
    );
}
