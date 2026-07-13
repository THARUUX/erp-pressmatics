'use client';
import { use, useEffect, useState } from 'react';
import {
    FiPhone, FiMail, FiMapPin, FiFileText, FiShoppingCart, FiDollarSign,
    FiExternalLink, FiCheckCircle, FiClock, FiAlertCircle, FiTrendingUp,
    FiPackage, FiSun, FiMoon, FiInfo, FiMenu, FiX, FiShield, FiSend
} from 'react-icons/fi';

import { Dock, DockIcon } from '@/components/magicui/dock';
import { AnimatedThemeToggler } from '@/components/magicui/animated-theme-toggler';
import { TextAnimate } from '@/components/magicui/text-animate';
import GradualSpacing from '@/components/magicui/gradual-spacing';
import { SpotlightCard } from '@/components/magicui/spotlight-card';

const fmt = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const getStatusStyles = (status, isDark) => {
    const darkStyles = {
        paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        partial: 'bg-amber-500/10  text-amber-300  border-amber-500/20',
        overdue: 'bg-red-500/10    text-red-300    border-red-500/20',
        pending: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
        draft: 'bg-white/10      text-white/50   border-white/15',
        sent: 'bg-blue-500/10   text-blue-300   border-blue-500/20',
        converted: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        cancelled: 'bg-red-500/10    text-red-300    border-red-500/20',
        Delivered: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        'In Production': 'bg-blue-500/10   text-blue-300   border-blue-500/20',
        'Ready': 'bg-purple-500/10 text-purple-300  border-purple-500/20',
    };

    const lightStyles = {
        paid: 'bg-emerald-50 text-emerald-700 border-emerald-250',
        partial: 'bg-amber-50  text-amber-750  border-amber-250',
        overdue: 'bg-red-50    text-red-700    border-red-250',
        pending: 'bg-yellow-50 text-yellow-750 border-yellow-250',
        draft: 'bg-slate-55  text-slate-550  border-slate-250',
        sent: 'bg-blue-50   text-blue-700   border-blue-250',
        converted: 'bg-emerald-50 text-emerald-700 border-emerald-250',
        completed: 'bg-emerald-50 text-emerald-700 border-emerald-250',
        cancelled: 'bg-red-50    text-red-700    border-red-250',
        Delivered: 'bg-emerald-50 text-emerald-700 border-emerald-250',
        'In Production': 'bg-blue-50   text-blue-750   border-blue-250',
        'Ready': 'bg-purple-50 text-purple-750  border-purple-250',
    };

    const styles = isDark ? darkStyles : lightStyles;
    return styles[status] || styles.draft;
};

function Badge({ status, dark }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-400/40 ${getStatusStyles(status, dark)}`}>
            {status}
        </span>
    );
}

const TABS = [
    { name: 'Overview', icon: FiTrendingUp },
    { name: 'Invoices', icon: FiFileText },
    { name: 'Orders', icon: FiShoppingCart },
    { name: 'Quotations', icon: FiSend }
];

export default function CustomerPortal({ params }) {
    const { token } = use(params);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('Overview');
    const [dark, setDark] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('portal-theme');
        if (saved) setDark(saved === 'dark');
        setMounted(true);

        fetch(`/api/portal/${token}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [token]);

    const toggleTheme = () => {
        const next = !dark;
        setDark(next);
        localStorage.setItem('portal-theme', next ? 'dark' : 'light');
    };

    if (loading) return (
        <div className="min-h-screen bg-[#07080f] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        </div>
    );

    if (!data || data.error) return (
        <div className="min-h-screen bg-[#07080f] flex flex-col items-center justify-center gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-2 shadow-2xl">
                <FiAlertCircle className="w-7 h-7 text-indigo-400 animate-bounce" />
            </div>
            <h2 className="text-white text-xl font-bold">Portal Link Expired or Invalid</h2>
            <p className="text-white/40 text-sm max-w-sm">Please verify the URL you entered, or request your account manager to generate a new portal link.</p>
        </div>
    );

    const { customer, quotations = [], invoices = [], salesOrders = [], stats = {}, brand = {} } = data;
    const outstanding = parseFloat(stats.outstanding || 0);
    const totalPaid = parseFloat(stats.total_paid || 0);
    const totalBilled = parseFloat(stats.total_billed || 0);

    const d = dark;

    return (
        <div className={`min-h-screen relative flex flex-col md:flex-row overflow-x-hidden transition-colors duration-500 pb-24 md:pb-0 ${d ? 'bg-[#07080f] text-white' : 'bg-[#f4f7fb] text-slate-800'}`}
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.4s' }}>

            {/* ── Background decoration (Static Green Linear Gradient) ───────────────────────── */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className={`absolute inset-0 transition-opacity duration-500 ${
                    d ? 'bg-gradient-to-br from-emerald-950/10 via-[#07080f] to-teal-950/10'
                      : 'bg-gradient-to-br from-emerald-100/25 via-[#f4f7fb] to-teal-100/15'
                }`} />
            </div>

            <style>{`
                .hover-spin:hover svg {
                    transform: rotate(15deg) scale(1.1);
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .hover-pulse:hover svg {
                    transform: scale(1.18);
                    transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
            `}</style>

            {/* ── Mobile Navigation Header (Glassmorphic) ─────────────────────────── */}
            <div className={`md:hidden sticky top-0 z-40 w-full flex items-center justify-between px-5 py-4 border-b backdrop-blur-md transition-colors duration-300 ${d ? 'bg-[#07080f]/80 border-white/[0.08]' : 'bg-white/80 border-slate-200/80 shadow-sm'
                }`}>
                <div className="flex items-center gap-3">
                    {brand.company_logo ? (
                        <img src={brand.company_logo} alt="Logo" className="w-8 h-8 object-contain rounded-lg border border-slate-200/50 p-0.5 bg-white" />
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-indigo-650 flex items-center justify-center text-white font-black text-sm">
                            {(brand.company_name || 'C')[0]}
                        </div>
                    )}
                    <span className="font-extrabold text-sm tracking-tight truncate max-w-[150px]">{brand.company_name || 'Portal'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <AnimatedThemeToggler dark={d} toggleTheme={toggleTheme} className="w-9 h-9 rounded-xl" />
                </div>
            </div>

            {/* ── Left Sidebar (Glassmorphism layout) ─────────────────────────── */}
            <aside className={`hidden md:flex md:sticky top-0 left-0 h-[100dvh] z-50 w-72 shrink-0 border-r backdrop-blur-xl ${d ? 'bg-[#090b14]/90 border-white/[0.07] text-white/90'
                : 'bg-white/90 border-slate-200/90 shadow-lg text-slate-700'
                } flex-col justify-between`}>

                <div className="flex flex-col">
                    {/* Sidebar Brand header */}
                    <div className={`p-6 border-b transition-colors ${d ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                            {brand.company_logo ? (
                                <img src={brand.company_logo} alt="Logo" className="w-10 h-10 object-contain rounded-xl p-1 bg-white border border-slate-100 shadow-sm" />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-lg">
                                    {(brand.company_name || 'C')[0]}
                                </div>
                            )}
                            <div className="min-w-0">
                                <h2 className={`font-black text-sm tracking-tight truncate ${d ? 'text-white' : 'text-slate-800'}`}>
                                    {brand.company_name || 'Customer Portal'}
                                </h2>
                                {brand.company_tagline && (
                                    <p className={`text-[10px] mt-0.5 truncate font-medium ${d ? 'text-white/40' : 'text-slate-400'}`}>{brand.company_tagline}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Navigation list (as fallback, but primary is the bottom Dock) */}
                    <nav className="p-4 space-y-1.5 mt-4">
                        {TABS.map((t) => {
                            let count = 0;
                            if (t.name === 'Invoices') count = invoices.length;
                            else if (t.name === 'Orders') count = salesOrders.length;
                            else if (t.name === 'Quotations') count = quotations.length;

                            const isActive = tab === t.name;

                            return (
                                <button
                                    key={t.name}
                                    onClick={() => { setTab(t.name); setSidebarOpen(false); }}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all hover-pulse ${isActive
                                        ? (d ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border border-indigo-100')
                                        : `border border-transparent ${d ? 'text-white/60 hover:text-white hover:bg-white/[0.03]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'}`
                                        }`}
                                >
                                    <span className="flex items-center gap-3">
                                        <t.icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'scale-110' : ''}`} />
                                        {t.name}
                                    </span>
                                    {t.name !== 'Overview' && count > 0 && (
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isActive
                                            ? (d ? 'bg-indigo-400/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                                            : `${d ? 'bg-white/[0.05] text-white/35' : 'bg-slate-100 text-slate-400'}`
                                            }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Customer bottom card */}
                <SpotlightCard dark={d} className="m-4">
                    <div className="p-4">
                        <p className={`text-[9px] font-bold uppercase tracking-wider ${d ? 'text-white/30' : 'text-slate-400'}`}>Account</p>
                        <h3 className={`text-sm font-extrabold truncate mt-1 ${d ? 'text-white' : 'text-slate-800'}`}>{customer.name}</h3>
                        {customer.category && (
                            <span className={`inline-block mt-2 text-[8px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${d ? 'text-amber-300 border-amber-500/20 bg-amber-500/10' : 'text-amber-700 border-amber-500/20 bg-amber-50/70'
                                }`}>
                                {customer.category}
                            </span>
                        )}

                        {customer.email && (
                            <div className="mt-3.5 pt-3 border-t border-dashed border-slate-200/50 dark:border-white/5 space-y-2">
                                <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-[11px] opacity-75 hover:underline">
                                    <FiMail className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{customer.email}</span>
                                </a>
                            </div>
                        )}
                    </div>
                </SpotlightCard>
            </aside>



            {/* ── Main Layout Area ─────────────────────────── */}
            <main className="flex-1 min-w-0 z-10 flex flex-col min-h-screen">

                {/* Desktop Topbar */}
                <header className={`hidden md:flex items-center justify-between px-8 py-5 border-b backdrop-blur-md transition-colors ${d ? 'bg-[#07080f]/50 border-white/[0.06]' : 'bg-[#f4f7fb]/60 border-slate-200'
                    }`}>
                    <h1 className={`text-xl font-black tracking-tight ${d ? 'text-white' : 'text-slate-800'}`}>
                        {tab}
                    </h1>
                    <div className="flex items-center gap-4">
                        {brand.company_email && (
                            <a
                                href={`mailto:${brand.company_email}?subject=Portal Inquiry - ${encodeURIComponent(customer.name)}`}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-4.5 py-2.5 rounded-2xl transition-all duration-300 border shadow-sm ${d ? 'bg-white/[0.03] hover:bg-white/[0.08] border-white/10 text-white/80 hover:text-white'
                                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-800'
                                    }`}
                            >
                                <FiMail className="w-3.5 h-3.5" /> Support Email
                            </a>
                        )}
                        <AnimatedThemeToggler dark={d} toggleTheme={toggleTheme} className="w-10 h-10 rounded-2xl" />
                    </div>
                </header>

                {/* Content Body */}
                <div className="flex-1 p-5 md:p-8 space-y-6 max-w-5xl w-full mx-auto">

                    {/* Welcome greeting header with Magic UI TextAnimate and GradualSpacing */}
                    <div className="mb-6">
                        <p className={`text-xs font-bold uppercase tracking-widest ${d ? 'text-white/40' : 'text-slate-400'}`}>
                            <TextAnimate text="Welcome back to your dashboard" animation="blurInUp" delay={0.1} />
                        </p>
                        <h2 className="text-2xl md:text-3xl font-black mt-2 tracking-tight flex justify-start">
                            <GradualSpacing text={customer.name} duration={0.6} delayMultiple={0.03} className={d ? 'text-white font-black' : 'text-slate-800 font-black'} />
                        </h2>
                    </div>

                    {/* Financial Outstanding Glass Card */}
                    {outstanding > 0 && (
                        <SpotlightCard
                            dark={d}
                            className="shadow-md"
                            spotlightColor={d ? "rgba(245, 158, 11, 0.18)" : "rgba(245, 158, 11, 0.08)"}
                        >
                            <div className="p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                                        <FiAlertCircle className="w-6 h-6 text-amber-500 dark:text-amber-400 animate-pulse" />
                                    </div>
                                    <div>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${d ? 'text-amber-300/80' : 'text-amber-700/80'}`}>Outstanding Balance</p>
                                        <h3 className={`text-3xl font-black font-mono tracking-tight mt-0.5 ${d ? 'text-amber-300' : 'text-amber-600'}`}>{fmt(outstanding)}</h3>
                                    </div>
                                </div>
                                {brand.company_email && (
                                    <a
                                        href={`mailto:${brand.company_email}?subject=Payment Details Request - ${customer.name}`}
                                        className="inline-flex items-center justify-center font-bold text-xs bg-amber-550 hover:bg-amber-600 dark:bg-amber-450 dark:hover:bg-amber-350 text-black px-5 py-3 rounded-2xl transition-all shadow-md active:scale-98 shrink-0 text-center"
                                    >
                                        Request Bank Details
                                    </a>
                                )}
                            </div>
                        </SpotlightCard>
                    )}

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Invoiced', value: fmt(totalBilled), icon: FiTrendingUp, colorClass: d ? 'text-white/80' : 'text-slate-700' },
                            { label: 'Total Settled', value: fmt(totalPaid), icon: FiCheckCircle, colorClass: 'text-emerald-500 dark:text-emerald-450' },
                            { label: 'Pending Orders', value: salesOrders.filter(so => so.status !== 'Delivered').length, icon: FiShoppingCart, colorClass: 'text-indigo-500 dark:text-indigo-400' },
                            { label: 'Quotes Requested', value: stats.total_quotes || 0, icon: FiFileText, colorClass: 'text-purple-600 dark:text-purple-400' }
                        ].map((item, idx) => (
                            <SpotlightCard
                                key={idx}
                                dark={d}
                                className="hover:-translate-y-1 transition-all duration-300"
                                spotlightColor={
                                    idx === 1 ? (d ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.08)") : // Emerald for Settled
                                    idx === 2 ? (d ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.08)") : // Indigo for Orders
                                    idx === 3 ? (d ? "rgba(168, 85, 247, 0.15)" : "rgba(168, 85, 247, 0.08)") : // Purple for Quotes
                                    undefined // default
                                }
                            >
                                <div className="p-4 hover-spin">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <item.icon className={`w-4.5 h-4.5 ${item.colorClass} opacity-80`} />
                                    </div>
                                    <p className={`text-xl font-bold font-mono ${item.colorClass}`}>{item.value}</p>
                                    <p className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 ${d ? 'text-white/35' : 'text-slate-450'}`}>{item.label}</p>
                                </div>
                            </SpotlightCard>
                        ))}
                    </div>

                    {/* Content Detail Cards */}
                    <SpotlightCard dark={d} className="shadow-xl">
                        <div className="p-5 md:p-6">

                            {/* OVERVIEW CONTENT */}
                            {tab === 'Overview' && (
                                <div className="space-y-6">
                                    {/* Brand Support Banner */}
                                    <div className={`rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border ${d ? 'bg-indigo-500/[0.02] border-indigo-500/10' : 'bg-indigo-50/20 border-indigo-100/60'
                                        }`}>
                                        <div className="flex items-center gap-3">
                                            <FiInfo className="w-5 h-5 text-indigo-650 dark:text-indigo-400 shrink-0" />
                                            <p className={`text-xs font-semibold leading-relaxed ${d ? 'text-white/70' : 'text-slate-700'}`}>
                                                Need help or have questions about your invoices or order status?
                                            </p>
                                        </div>
                                        {brand.company_phone && (
                                            <a href={`tel:${brand.company_phone}`} className={`shrink-0 text-xs font-extrabold transition-all hover:underline ${d ? 'text-indigo-455' : 'text-indigo-650'}`}>
                                                Call Support →
                                            </a>
                                        )}
                                    </div>

                                    {/* Active Orders List */}
                                    <div>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${d ? 'text-white/35' : 'text-slate-450'}`}>Active Jobs & Delivery Status</p>
                                        {salesOrders.length === 0 ? (
                                            <p className="text-sm italic opacity-50 py-2">No active orders at this time.</p>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {salesOrders.slice(0, 3).map((so) => (
                                                    <div
                                                        key={so.code}
                                                        className={`flex items-center justify-between rounded-2xl px-4 py-3.5 border transition-all hover-pulse ${d ? 'bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03]' : 'bg-white border-slate-200/80 hover:bg-slate-50/50'
                                                            }`}
                                                    >
                                                        <div className="min-w-0">
                                                            <p className={`text-sm font-semibold font-mono tracking-tight ${d ? 'text-white' : 'text-slate-800'}`}>{so.code}</p>
                                                            <p className={`text-xs truncate mt-0.5 ${d ? 'text-white/40' : 'text-slate-500'}`}>{so.job_names || 'General Print Order'}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <Badge status={so.status} dark={d} />
                                                            <a
                                                                href={`/timeline/${so.order_id}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-xl border transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${d ? 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/55 text-indigo-300 hover:bg-indigo-500/25'
                                                                    : 'bg-indigo-50/60 border-indigo-200 hover:border-indigo-355 text-indigo-750 hover:bg-indigo-50/90'
                                                                    }`}
                                                            >
                                                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                                                </span>
                                                                <FiPackage className="w-3.5 h-3.5" />
                                                                <span>Track</span>
                                                            </a>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Unsettled Invoices */}
                                    <div>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${d ? 'text-white/35' : 'text-slate-450'}`}>Recent Billing & Invoices</p>
                                        {invoices.length === 0 ? (
                                            <p className="text-sm italic opacity-50 py-2">No billing records found.</p>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {invoices.slice(0, 3).map((inv) => (
                                                    <div
                                                        key={inv.code}
                                                        className={`flex items-center justify-between rounded-2xl px-4 py-3.5 border transition-all ${d ? 'bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03]' : 'bg-white border-slate-200/80 hover:bg-slate-50/50'
                                                            }`}
                                                    >
                                                        <div className="min-w-0">
                                                            <p className={`text-sm font-semibold font-mono tracking-tight ${d ? 'text-white' : 'text-slate-800'}`}>{inv.code}</p>
                                                            <p className={`text-xs mt-0.5 ${d ? 'text-white/40' : 'text-slate-500'}`}>Due {fmtDate(inv.due_date)}</p>
                                                        </div>
                                                        <div className="text-right shrink-0 flex items-center gap-4">
                                                            <div>
                                                                <p className={`text-sm font-bold font-mono ${d ? 'text-white' : 'text-slate-800'}`}>{fmt(inv.balance)}</p>
                                                                <Badge status={inv.status} dark={d} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* INVOICES CONTENT */}
                            {tab === 'Invoices' && (
                                <div className="space-y-3">
                                    {invoices.length === 0 ? (
                                        <p className="text-center py-8 opacity-40 text-sm">No invoice history available.</p>
                                    ) : (
                                        invoices.map((inv) => (
                                            <div
                                                key={inv.code}
                                                className={`rounded-2xl p-4 sm:p-5 border transition-all duration-300 ${d ? 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]' : 'bg-white border-slate-200/80 hover:bg-slate-50/30'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className={`text-sm font-semibold font-mono ${d ? 'text-white' : 'text-slate-800'}`}>{inv.code}</p>
                                                        {inv.quotation_code && <p className="text-[11px] opacity-45 mt-0.5">Reference: {inv.quotation_code}</p>}
                                                    </div>
                                                    <Badge status={inv.status} dark={d} />
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-dashed border-slate-200 dark:border-white/5">
                                                    <div>
                                                        <p className={`text-[9px] font-extrabold uppercase tracking-wider ${d ? 'text-white/30' : 'text-slate-450'}`}>Billed</p>
                                                        <p className="text-sm font-mono font-bold mt-0.5">{fmt(inv.amount_due)}</p>
                                                    </div>
                                                    <div>
                                                        <p className={`text-[9px] font-extrabold uppercase tracking-wider ${d ? 'text-white/30' : 'text-slate-450'}`}>Paid</p>
                                                        <p className="text-sm font-mono font-bold text-emerald-555 dark:text-emerald-400 mt-0.5">{fmt(inv.amount_paid)}</p>
                                                    </div>
                                                    <div>
                                                        <p className={`text-[9px] font-extrabold uppercase tracking-wider ${d ? 'text-white/30' : 'text-slate-450'}`}>Balance</p>
                                                        <p className={`text-sm font-mono font-bold mt-0.5 ${parseFloat(inv.balance) > 0 ? (d ? 'text-amber-400' : 'text-amber-600') : ''}`}>{fmt(inv.balance)}</p>
                                                    </div>
                                                </div>

                                                {inv.due_date && (
                                                    <div className="flex items-center gap-1.5 text-[11px] opacity-50 mt-3 pt-1">
                                                        <FiClock className="w-3 h-3" />
                                                        <span>Due date: {fmtDate(inv.due_date)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* ORDERS CONTENT */}
                            {tab === 'Orders' && (
                                <div className="space-y-3">
                                    {salesOrders.length === 0 ? (
                                        <p className="text-center py-8 opacity-40 text-sm">No order records.</p>
                                    ) : (
                                        salesOrders.map((so) => (
                                            <div
                                                key={so.code}
                                                className={`rounded-2xl p-4 sm:p-5 border transition-all duration-300 ${d ? 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]' : 'bg-white border-slate-200/80 hover:bg-slate-50/30'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className={`text-sm font-semibold font-mono ${d ? 'text-white' : 'text-slate-800'}`}>{so.code}</p>
                                                        <p className={`text-xs mt-1 leading-relaxed ${d ? 'text-white/50' : 'text-slate-650'}`}>{so.job_names || 'Production Order'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge status={so.status} dark={d} />
                                                        <a
                                                            href={`/timeline/${so.order_id}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-1.5 rounded-xl border transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${d ? 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/55 text-indigo-300 hover:bg-indigo-500/25'
                                                                : 'bg-indigo-50/60 border-indigo-200 hover:border-indigo-350 text-indigo-750 hover:bg-indigo-50/90'
                                                                }`}
                                                        >
                                                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                                            </span>
                                                            <FiPackage className="w-3.5 h-3.5" />
                                                            <span>Track</span>
                                                        </a>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-3 border-t border-slate-100 dark:border-white/5 text-xs opacity-60">
                                                    {so.delivery_date && (
                                                        <span className="flex items-center gap-1">
                                                            <FiClock className="w-3 h-3" /> Expected Delivery: {fmtDate(so.delivery_date)}
                                                        </span>
                                                    )}
                                                    {so.total_amount && <span className="font-mono">Order Value: {fmt(so.total_amount)}</span>}
                                                    <span>Ref: {so.quotation_code || '—'}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* QUOTATIONS CONTENT */}
                            {tab === 'Quotations' && (
                                <div className="space-y-3">
                                    {quotations.length === 0 ? (
                                        <p className="text-center py-8 opacity-40 text-sm">No estimation or quotation history.</p>
                                    ) : (
                                        quotations.map((q) => (
                                            <div
                                                key={q.code}
                                                className={`rounded-2xl p-4 sm:p-5 border transition-all duration-300 flex items-center justify-between gap-3 ${d ? 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]' : 'bg-white border-slate-200/80 hover:bg-slate-50/30'
                                                    }`}
                                            >
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-semibold font-mono ${d ? 'text-white' : 'text-slate-800'}`}>{q.code}</p>
                                                    <p className={`text-xs truncate mt-0.5 ${d ? 'text-white/40' : 'text-slate-500'}`}>{q.first_item_name || 'General Printing Spec'}</p>
                                                    <p className="text-[10px] opacity-45 mt-1">{fmtDate(q.quotation_date)}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className={`text-base font-bold font-mono ${d ? 'text-white' : 'text-slate-800'}`}>{fmt(q.total_amount)}</p>
                                                    <div className="mt-1"><Badge status={q.status} dark={d} /></div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </SpotlightCard>

                    {/* Contact Info Details Card */}
                    <SpotlightCard dark={d} className="shadow-sm">
                        <div className="p-5 md:p-6">
                            <h3 className={`text-sm font-extrabold mb-4 uppercase tracking-wider ${d ? 'text-white/40' : 'text-slate-400'}`}>Contact & Billing Addresses</h3>
                            <div className="grid md:grid-cols-2 gap-6">
                                {customer.phone && (
                                    <div className="space-y-1">
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${d ? 'text-white/30' : 'text-slate-450'}`}>Contact Phone</p>
                                        <a href={`tel:${customer.phone}`} className="text-sm font-semibold hover:underline block">{customer.phone}</a>
                                    </div>
                                )}
                                {customer.address && (
                                    <div className="space-y-1">
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${d ? 'text-white/30' : 'text-slate-450'}`}>Billing Address</p>
                                        <p className="text-sm leading-relaxed">{customer.address}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </SpotlightCard>
                </div>

                {/* Sticky Footer */}
                <footer className={`mt-auto py-6 border-t text-center space-y-2 transition-colors duration-500 ${d ? 'border-white/[0.05] bg-[#07080f]/50' : 'border-slate-200 bg-[#f4f7fb]/60'
                    }`}>
                    <div className="flex justify-center gap-6 text-[11px] font-semibold">
                        {brand.company_phone && (
                            <a href={`tel:${brand.company_phone}`} className={`flex items-center gap-1.5 transition-colors ${d ? 'text-white/45 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                                <FiPhone className="w-3 h-3" /> {brand.company_phone}
                            </a>
                        )}
                        {brand.company_email && (
                            <a href={`mailto:${brand.company_email}`} className={`flex items-center gap-1.5 transition-colors ${d ? 'text-white/45 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                                <FiMail className="w-3 h-3" /> {brand.company_email}
                            </a>
                        )}
                    </div>
                    <p className={`text-[10px] transition-colors ${d ? 'text-white/15' : 'text-slate-400'}`}>
                        {brand.company_name ? `© ${brand.company_name}` : 'Powered by Pressmatics'}
                    </p>
                </footer>
            </main>

            {/* ── Magic UI Floating Nav Dock (Fixed Bottom Center) ────────────────────── */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto md:hidden">
                <Dock
                    iconSize={42}
                    iconMagnification={58}
                    iconDistance={120}
                    className={d ? ' border-white/[0.09] shadow-black/50 shadow-2xl' : ' border-slate-200/90 shadow-xl'}
                >
                    {TABS.map((t) => {
                        const isActive = tab === t.name;
                        return (
                            <div key={t.name} className="relative group">
                                <DockIcon
                                    onClick={() => setTab(t.name)}
                                    className={`relative ${isActive
                                        ? (d ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700')
                                        : (d ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-900')
                                        }`}
                                >
                                    <t.icon className="w-5 h-5 shrink-0" />
                                    {/* Active dot indicator */}
                                    {isActive && (
                                        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                                    )}
                                </DockIcon>
                                {/* Tooltip */}
                                <div className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-black/90 text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
                                    {t.name}
                                </div>
                            </div>
                        );
                    })}
                </Dock>
            </div>
        </div>
    );
}
