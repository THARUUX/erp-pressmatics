'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FiArrowLeft, FiEdit2, FiSave, FiX, FiPhone, FiMail, FiMapPin,
    FiFileText, FiShoppingCart, FiDollarSign, FiTrendingUp,
    FiExternalLink, FiAlertCircle, FiCheckCircle, FiClock, FiEye,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useSettings } from '@/components/SettingsContext';
import Input from '@/components/ui/Input';

/* ── helpers ──────────────────────────────────────────────────────────────── */
const fmt = (n, cur) => `${cur} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_COLORS = {
    draft:     'bg-gray-500/20 text-gray-300 border-gray-500/30',
    sent:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
    converted: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    paid:      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    partial:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
    overdue:   'bg-red-500/20 text-red-300 border-red-500/30',
    pending:   'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
};
function Badge({ status }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}>
            {status}
        </span>
    );
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-white' }) {
    return (
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl bg-white/5 ${color}`}><Icon className="w-4 h-4" /></div>
            </div>
            <div className={`text-xl font-bold ${color} mb-0.5`}>{value}</div>
            <div className="text-gray-500 text-xs">{label}</div>
            {sub && <div className="text-gray-600 text-xs mt-0.5">{sub}</div>}
        </div>
    );
}

const TABS = ['Overview', 'Quotations', 'Sales Orders', 'Invoices'];

export default function CustomerProfilePage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const { settings } = useSettings();
    const cur = settings.currency || 'LKR';

    const [profile, setProfile]   = useState(null);
    const [loading, setLoading]   = useState(true);
    const [tab, setTab]           = useState('Overview');
    const [editing, setEditing]   = useState(false);
    const [saving, setSaving]     = useState(false);
    const [form, setForm]         = useState({});

    const loadProfile = () => {
        setLoading(true);
        fetch(`/api/customers/${id}/profile`)
            .then(r => r.json())
            .then(d => { setProfile(d); setForm(d.customer || {}); setLoading(false); })
            .catch(() => { toast.error('Failed to load'); setLoading(false); });
    };

    useEffect(() => { loadProfile(); }, [id]);

    const handleSave = async () => {
        if (!form.name) return toast.error('Name is required');
        setSaving(true);
        const res = await fetch(`/api/customers/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        setSaving(false);
        if (res.ok) { toast.success('Customer updated'); setEditing(false); loadProfile(); }
        else toast.error('Failed to update');
    };

    if (loading) return <div className="py-24 text-center text-gray-500 animate-pulse">Loading customer profile…</div>;
    if (!profile || profile.error) return <div className="py-24 text-center text-red-400">Customer not found</div>;

    const { customer, quotations = [], salesOrders = [], invoices = [], stats = {} } = profile;

    return (
        <div className="text-white max-w-6xl mx-auto">
            {/* ── Back + title ───────────────────────────────────────────── */}
            <div className="flex items-center gap-4 mb-6">
                <Link href="/dashboard/customers">
                    <button className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors">
                        <FiArrowLeft className="w-4 h-4" />
                    </button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tighter">{customer.name}</h1>
                    <p className="text-gray-500 text-sm">{customer.code}</p>
                </div>
                <div className="flex gap-2">
                    {editing ? (
                        <>
                            <button onClick={() => setEditing(false)} className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-colors"><FiX size={15} /></button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50">
                                <FiSave size={14} />{saving ? 'Saving…' : 'Save'}
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setEditing(true)} className="flex items-center gap-2 border border-white/10 text-gray-300 px-4 py-2 rounded-xl text-sm hover:border-white/20 hover:text-white transition-colors">
                            <FiEdit2 size={13} /> Edit
                        </button>
                    )}
                </div>
            </div>

            {/* ── Info card ──────────────────────────────────────────────── */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
                {editing ? (
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Name *</label>
                            <Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-black/40 border-white/10" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Email</label>
                            <Input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="bg-black/40 border-white/10" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                            <Input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-black/40 border-white/10" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">VAT Number</label>
                            <Input value={form.vat_number || ''} onChange={e => setForm(f => ({ ...f, vat_number: e.target.value }))} className="bg-black/40 border-white/10" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-gray-500 mb-1 block">Address</label>
                            <textarea value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 h-20" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="is_vat_edit" checked={!!form.is_vat} onChange={e => setForm(f => ({ ...f, is_vat: e.target.checked }))} className="rounded" />
                            <label htmlFor="is_vat_edit" className="text-sm text-gray-300 cursor-pointer">VAT Registered</label>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-6 items-start">
                        <div className="flex-1 min-w-60">
                            <div className="flex gap-3 flex-wrap">
                                {customer.email && (
                                    <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-sm text-blue-400 hover:underline">
                                        <FiMail size={13} />{customer.email}
                                    </a>
                                )}
                                {customer.phone && (
                                    <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-gray-300">
                                        <FiPhone size={13} />{customer.phone}
                                    </a>
                                )}
                                {customer.address && (
                                    <span className="flex items-center gap-2 text-sm text-gray-400">
                                        <FiMapPin size={13} />{customer.address}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {customer.is_vat && (
                                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full">
                                    VAT Registered {customer.vat_number && `· ${customer.vat_number}`}
                                </span>
                            )}
                            <span className="text-xs bg-white/5 text-gray-400 border border-white/10 px-3 py-1 rounded-full">
                                Since {fmtDate(customer.created_at)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Stats row ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <StatCard icon={FiTrendingUp} label="Total Revenue" value={fmt(stats.total_revenue, cur)} color="text-emerald-400" />
                <StatCard icon={FiAlertCircle} label="Outstanding" value={fmt(stats.outstanding, cur)} color="text-amber-400" />
                <StatCard icon={FiFileText} label="Quotations" value={stats.total_quotes || 0} sub={`${stats.converted_count || 0} converted`} />
                <StatCard icon={FiShoppingCart} label="Sales Orders" value={stats.sales_order_count || 0} />
                <StatCard icon={FiDollarSign} label="Invoices" value={stats.invoice_count || 0} sub={`Avg job ${fmt(stats.avg_job_value, cur)}`} />
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                <div className="flex border-b border-white/[0.07] px-4 pt-2">
                    {TABS.map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${t === tab ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                            {t}
                            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${t === tab ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-600'}`}>
                                {t === 'Quotations' ? quotations.length : t === 'Sales Orders' ? salesOrders.length : t === 'Invoices' ? invoices.length : ''}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="p-4">
                    {/* Overview */}
                    {tab === 'Overview' && (
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Recent quotations */}
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Recent Quotations</p>
                                <div className="space-y-2">
                                    {quotations.slice(0, 5).map(q => (
                                        <div key={q.id} className="flex items-center justify-between bg-black/20 border border-white/[0.06] rounded-xl px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-white">{q.first_item_name || q.code}</p>
                                                <p className="text-xs text-gray-500">{q.code} · {fmtDate(q.quotation_date)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge status={q.status} />
                                                <Link href={`/dashboard/quotations/${q.id}/edit`}>
                                                    <button className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors"><FiEye size={13} /></button>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                    {quotations.length === 0 && <p className="text-gray-600 text-sm">No quotations yet</p>}
                                </div>
                            </div>
                            {/* Recent invoices */}
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Recent Invoices</p>
                                <div className="space-y-2">
                                    {invoices.slice(0, 5).map(inv => (
                                        <div key={inv.id} className="flex items-center justify-between bg-black/20 border border-white/[0.06] rounded-xl px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-white">{inv.code}</p>
                                                <p className="text-xs text-gray-500">Due {fmtDate(inv.due_date)} · Bal {fmt(inv.balance, cur)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge status={inv.status} />
                                                <Link href={`/dashboard/invoices/${inv.id}`}>
                                                    <button className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors"><FiEye size={13} /></button>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                    {invoices.length === 0 && <p className="text-gray-600 text-sm">No invoices yet</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quotations tab */}
                    {tab === 'Quotations' && (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                                    {['Code', 'Job', 'Date', 'Amount', 'Status', ''].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {quotations.length === 0 && (
                                    <tr><td colSpan={6} className="px-3 py-12 text-center text-gray-600">No quotations</td></tr>
                                )}
                                {quotations.map((q, i) => (
                                    <tr key={q.id} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 1 ? 'bg-white/[0.01]' : ''}`}>
                                        <td className="px-3 py-3"><span className="font-mono text-xs text-gray-400">{q.code}</span></td>
                                        <td className="px-3 py-3 text-white max-w-[200px] truncate">{q.first_item_name || '—'}</td>
                                        <td className="px-3 py-3 text-gray-500 text-xs">{fmtDate(q.quotation_date)}</td>
                                        <td className="px-3 py-3 font-mono font-semibold text-white">{fmt(q.total_amount, cur)}</td>
                                        <td className="px-3 py-3"><Badge status={q.status} /></td>
                                        <td className="px-3 py-3">
                                            <div className="flex gap-1">
                                                <Link href={`/dashboard/quotations/${q.id}/edit`}>
                                                    <button className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors" title="Edit"><FiEdit2 size={13} /></button>
                                                </Link>
                                                <button onClick={() => window.open(`/dashboard/quotations/${q.id}`, '_blank')}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors" title="View">
                                                    <FiExternalLink size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Sales Orders tab */}
                    {tab === 'Sales Orders' && (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                                    {['Code', 'Jobs', 'Quotation', 'Amount', 'Status', 'Date', ''].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {salesOrders.length === 0 && (
                                    <tr><td colSpan={7} className="px-3 py-12 text-center text-gray-600">No sales orders</td></tr>
                                )}
                                {salesOrders.map((so, i) => (
                                    <tr key={so.id} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 1 ? 'bg-white/[0.01]' : ''}`}>
                                        <td className="px-3 py-3"><span className="font-mono text-xs text-gray-400">{so.code}</span></td>
                                        <td className="px-3 py-3 text-white text-xs max-w-[160px] truncate">{so.job_names || '—'}</td>
                                        <td className="px-3 py-3"><span className="font-mono text-xs text-blue-400">{so.quotation_code}</span></td>
                                        <td className="px-3 py-3 font-mono font-semibold text-white">{fmt(so.total_amount, cur)}</td>
                                        <td className="px-3 py-3"><Badge status={so.status} /></td>
                                        <td className="px-3 py-3 text-gray-500 text-xs">{fmtDate(so.created_at)}</td>
                                        <td className="px-3 py-3">
                                            <Link href={`/dashboard/sales-orders/${so.id}`}>
                                                <button className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"><FiEye size={13} /></button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Invoices tab */}
                    {tab === 'Invoices' && (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/[0.06]">
                                    {['Invoice', 'Quotation', 'Amount', 'Paid', 'Balance', 'Due', 'Status', ''].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.length === 0 && (
                                    <tr><td colSpan={8} className="px-3 py-12 text-center text-gray-600">No invoices</td></tr>
                                )}
                                {invoices.map((inv, i) => (
                                    <tr key={inv.id} className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 1 ? 'bg-white/[0.01]' : ''}`}>
                                        <td className="px-3 py-3"><span className="font-mono text-xs text-blue-400">{inv.code}</span></td>
                                        <td className="px-3 py-3"><span className="font-mono text-xs text-gray-500">{inv.quotation_code || '—'}</span></td>
                                        <td className="px-3 py-3 font-mono text-white">{fmt(inv.amount_due, cur)}</td>
                                        <td className="px-3 py-3 font-mono text-emerald-400">{fmt(inv.amount_paid, cur)}</td>
                                        <td className="px-3 py-3 font-mono font-semibold text-amber-300">{fmt(inv.balance, cur)}</td>
                                        <td className="px-3 py-3 text-gray-500 text-xs">{fmtDate(inv.due_date)}</td>
                                        <td className="px-3 py-3"><Badge status={inv.status} /></td>
                                        <td className="px-3 py-3">
                                            <Link href={`/dashboard/invoices/${inv.id}`}>
                                                <button className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"><FiEye size={13} /></button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Quick actions ───────────────────────────────────────────── */}
            <div className="flex gap-3 mt-4">
                <Link href={`/dashboard/quotations/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`}>
                    <button className="flex items-center gap-2 text-sm text-gray-400 border border-white/10 px-4 py-2.5 rounded-xl hover:border-white/20 hover:text-white transition-colors">
                        <FiFileText size={14} /> New Quotation
                    </button>
                </Link>
                <Link href={`/dashboard/invoices/new?customer_id=${customer.id}&customer_name=${encodeURIComponent(customer.name)}`}>
                    <button className="flex items-center gap-2 text-sm text-gray-400 border border-white/10 px-4 py-2.5 rounded-xl hover:border-white/20 hover:text-white transition-colors">
                        <FiDollarSign size={14} /> New Invoice
                    </button>
                </Link>
            </div>
        </div>
    );
}
