'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    FiPlus, FiSearch, FiEye, FiTrash2, FiDollarSign,
    FiAlertCircle, FiCheckCircle, FiClock, FiSend, FiFileText
} from 'react-icons/fi';
import { useSettings } from '@/components/SettingsContext';

const STATUS_CONFIG = {
    draft:   { label: 'Draft',    color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
    sent:    { label: 'Sent',     color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    partial: { label: 'Partial',  color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    paid:    { label: 'Paid',     color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    overdue: { label: 'Overdue',  color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const FILTER_TABS = [
    { key: 'all',       label: 'All' },
    { key: 'draft',     label: 'Draft' },
    { key: 'sent',      label: 'Sent' },
    { key: 'partial',   label: 'Partial' },
    { key: 'overdue',   label: 'Overdue' },
    { key: 'paid',      label: 'Paid' },
];

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
            {cfg.label}
        </span>
    );
}

export default function InvoicesPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';

    const [invoices, setInvoices] = useState([]);
    const [stats, setStats]       = useState({});
    const [loading, setLoading]   = useState(true);
    const [search, setSearch]     = useState('');
    const [filter, setFilter]     = useState('all');
    const [deletingId, setDeletingId] = useState(null);

    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: 50, status: filter, search });
            const res  = await fetch(`/api/invoices?${params}`);
            const data = await res.json();
            if (Array.isArray(data.invoices)) {
                setInvoices(data.invoices);
                setStats(data.stats || {});
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [filter, search]);

    useEffect(() => { loadInvoices(); }, [loadInvoices]);

    const handleDelete = async (id, code) => {
        if (!confirm(`Delete invoice ${code}? This cannot be undone.`)) return;
        setDeletingId(id);
        await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
        setDeletingId(null);
        loadInvoices();
    };

    const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-transparent text-white">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Finance</p>
                    <h1 className="text-3xl font-bold tracking-tighter">Invoices</h1>
                </div>
                <Link href="/dashboard/invoices/new">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl font-semibold text-sm hover:bg-gray-100 transition-all shadow-lg">
                        <FiPlus /> New Invoice
                    </button>
                </Link>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                {[
                    { label: 'Total Outstanding', value: fmt(stats.outstanding), icon: FiClock,        color: 'text-amber-400' },
                    { label: 'Overdue Balance',   value: fmt(stats.overdue),     icon: FiAlertCircle,  color: 'text-red-400' },
                    { label: 'Collected (Month)', value: fmt(stats.collected_month), icon: FiCheckCircle, color: 'text-emerald-400' },
                ].map(s => (
                    <div key={s.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
                        <div className={`p-3 rounded-xl bg-white/5 ${s.color}`}>
                            <s.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
                            <div className="text-xl font-bold">{currency} {s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter + Search */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 border-b border-white/10">
                    {/* Tabs */}
                    <div className="flex flex-wrap gap-1">
                        {FILTER_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setFilter(tab.key)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    filter === tab.key
                                        ? 'bg-white text-black'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search invoices..."
                            className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30 w-56"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                                <th className="px-5 py-3 text-left">Invoice</th>
                                <th className="px-5 py-3 text-left">Customer</th>
                                <th className="px-5 py-3 text-left">Quotation</th>
                                <th className="px-5 py-3 text-right">Amount Due</th>
                                <th className="px-5 py-3 text-right">Paid</th>
                                <th className="px-5 py-3 text-right">Balance</th>
                                <th className="px-5 py-3 text-left">Due Date</th>
                                <th className="px-5 py-3 text-left">Status</th>
                                <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={9} className="px-5 py-12 text-center text-gray-500">Loading...</td></tr>
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-5 py-16 text-center">
                                        <FiFileText className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                                        <p className="text-gray-500 text-sm">No invoices found</p>
                                        <Link href="/dashboard/invoices/new" className="text-blue-400 text-xs mt-2 inline-block hover:underline">Create your first invoice →</Link>
                                    </td>
                                </tr>
                            ) : invoices.map(inv => (
                                <tr key={inv.id} className="hover:bg-white/[0.03] transition-colors group">
                                    <td className="px-5 py-4">
                                        <span className="font-mono text-xs text-blue-400">{inv.code}</span>
                                    </td>
                                    <td className="px-5 py-4 font-medium">{inv.customer_name}</td>
                                    <td className="px-5 py-4">
                                        {inv.quotation_code
                                            ? <span className="text-xs text-gray-400 font-mono">{inv.quotation_code}</span>
                                            : <span className="text-xs text-gray-600">—</span>
                                        }
                                    </td>
                                    <td className="px-5 py-4 text-right font-mono">{currency} {fmt(inv.amount_due)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-emerald-400">{currency} {fmt(inv.amount_paid)}</td>
                                    <td className="px-5 py-4 text-right font-mono text-amber-300 font-semibold">
                                        {currency} {fmt(inv.balance)}
                                    </td>
                                    <td className="px-5 py-4 text-gray-400 text-xs">
                                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '—'}
                                    </td>
                                    <td className="px-5 py-4"><StatusBadge status={inv.status} /></td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link href={`/dashboard/invoices/${inv.id}`}>
                                                <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="View">
                                                    <FiEye className="w-3.5 h-3.5" />
                                                </button>
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(inv.id, inv.code)}
                                                disabled={deletingId === inv.id}
                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <FiTrash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
