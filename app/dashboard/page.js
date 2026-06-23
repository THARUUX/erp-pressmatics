'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
    FiTrendingUp, FiDollarSign, FiUsers, FiFileText,
    FiAlertTriangle, FiShoppingCart, FiPackage, FiClock,
    FiArrowRight, FiRefreshCw, FiSun, FiMoon
} from 'react-icons/fi';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

/* ─── Helpers ─────────────────────────────────────────────────── */
function fmt(n = 0) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return Number(n).toLocaleString();
}
function fmtCurrency(n = 0) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(n);
}
function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    return `${d}d ago`;
}
function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

/* ─── Palettes ────────────────────────────────────────────────── */
// Colorful accent palette
const COLOR_PALETTE = ['#a78bfa', '#38bdf8', '#34d399', '#fb923c', '#f472b6', '#facc15'];
// Monochrome palette (white opacity steps)
const MONO_PALETTE  = [
    'rgba(255,255,255,0.85)',
    'rgba(255,255,255,0.55)',
    'rgba(255,255,255,0.35)',
    'rgba(255,255,255,0.20)',
    'rgba(255,255,255,0.12)',
];

// Per-card accent colors for colorful mode
const KPI_COLORS_COLORFUL = [
    { icon: 'text-violet-400',  ring: 'bg-violet-500/10 border-violet-500/20',  glow: 'bg-violet-600' },
    { icon: 'text-emerald-400', ring: 'bg-emerald-500/10 border-emerald-500/20',glow: 'bg-emerald-600' },
    { icon: 'text-amber-400',   ring: 'bg-amber-500/10  border-amber-500/20',   glow: 'bg-amber-600' },
    { icon: 'text-red-400',     ring: 'bg-red-500/10    border-red-500/20',     glow: 'bg-red-600' },
    { icon: 'text-sky-400',     ring: 'bg-sky-500/10    border-sky-500/20',     glow: 'bg-sky-600' },
    { icon: 'text-indigo-400',  ring: 'bg-indigo-500/10 border-indigo-500/20',  glow: 'bg-indigo-600' },
    { icon: 'text-pink-400',    ring: 'bg-pink-500/10   border-pink-500/20',    glow: 'bg-pink-600' },
    { icon: 'text-teal-400',    ring: 'bg-teal-500/10   border-teal-500/20',    glow: 'bg-teal-600' },
];

/* ─── KPI Card ────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, danger, href, colorful, colorIdx = 0 }) {
    const c = colorful && !danger ? KPI_COLORS_COLORFUL[colorIdx % KPI_COLORS_COLORFUL.length] : null;
    const card = (
        <div className={`group relative bg-black/40 backdrop-blur-xl border ${danger ? 'border-white/10' : 'border-white/[0.07]'} rounded-2xl p-5 overflow-hidden hover:border-white/20 hover:bg-white/[0.03] transition-all duration-200 ${href ? 'cursor-pointer' : ''}`}>
            {/* Colorful glow blob */}
            {c && <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 ${c.glow}`} />}
            <div className="relative flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-2">{label}</p>
                    <p className={`text-2xl font-bold tracking-tight ${danger ? 'text-red-400' : 'text-white'}`}>{value}</p>
                    {sub && <p className={`text-xs mt-1 ${danger ? 'text-red-400/50' : 'text-white/30'}`}>{sub}</p>}
                </div>
                <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${
                    c ? c.ring : 'bg-white/[0.04] border-white/[0.06]'
                }`}>
                    <Icon className={`w-4 h-4 ${c ? c.icon : danger ? 'text-red-400' : 'text-white/50'}`} />
                </div>
            </div>
        </div>
    );
    return href ? <Link href={href}>{card}</Link> : card;
}

/* ─── Section Card ────────────────────────────────────────────── */
function Card({ title, children, href, hrefLabel }) {
    return (
        <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                {href && (
                    <Link href={href} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/70 transition-colors">
                        {hrefLabel || 'View all'} <FiArrowRight className="w-3 h-3" />
                    </Link>
                )}
            </div>
            {children}
        </div>
    );
}

/* ─── Status badge ────────────────────────────────────────────── */
const STATUS_MONO = {
    draft:     'bg-white/[0.04] text-white/40 border-white/[0.08]',
    sent:      'bg-white/[0.06] text-white/60 border-white/[0.12]',
    partial:   'bg-white/[0.05] text-white/50 border-white/[0.10]',
    paid:      'bg-white/[0.08] text-white/80 border-white/[0.15]',
    overdue:   'bg-red-500/10   text-red-400  border-red-500/20',
    accepted:  'bg-white/[0.08] text-white/80 border-white/[0.15]',
    pending:   'bg-white/[0.05] text-white/50 border-white/[0.10]',
    rejected:  'bg-red-500/10   text-red-400  border-red-500/20',
    converted: 'bg-white/[0.08] text-white/80 border-white/[0.15]',
};
const STATUS_COLORFUL = {
    draft:     'bg-gray-500/15  text-gray-400   border-gray-500/20',
    sent:      'bg-blue-500/15  text-blue-400   border-blue-500/20',
    partial:   'bg-amber-500/15 text-amber-400  border-amber-500/20',
    paid:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    overdue:   'bg-red-500/15   text-red-400    border-red-500/20',
    accepted:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    pending:   'bg-amber-500/15 text-amber-400  border-amber-500/20',
    rejected:  'bg-red-500/15   text-red-400    border-red-500/20',
    converted: 'bg-sky-500/15   text-sky-400    border-sky-500/20',
};
function Badge({ status, colorful }) {
    const map = colorful ? STATUS_COLORFUL : STATUS_MONO;
    return (
        <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[status] || map.draft}`}>
            {status}
        </span>
    );
}

const CHART_TT = {
    backgroundColor: 'rgba(8,8,8,0.95)',
    borderColor: 'rgba(255,255,255,0.08)',
    textStyle: { color: '#fff', fontSize: 12 },
};

/* ─── Main Dashboard ──────────────────────────────────────────── */
export default function Dashboard() {
    const [user,      setUser]      = useState(null);
    const [stats,     setStats]     = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [colorful,  setColorful]  = useState(false); // ← theme state

    // Persist theme in localStorage
    useEffect(() => {
        const saved = localStorage.getItem('dashboard_theme');
        if (saved === 'colorful') setColorful(true);
    }, []);
    const toggleTheme = () => {
        setColorful(v => {
            localStorage.setItem('dashboard_theme', !v ? 'colorful' : 'mono');
            return !v;
        });
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [meRes, statsRes] = await Promise.all([
                fetch('/api/auth/me'),
                fetch('/api/dashboard/stats'),
            ]);
            if (meRes.ok)    { const u = await meRes.json();    if (u?.id) setUser(u); }
            if (statsRes.ok) { const s = await statsRes.json(); setStats(s); }
        } finally {
            setLoading(false);
            setLastRefresh(new Date());
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const palette = colorful ? COLOR_PALETTE : MONO_PALETTE;

    /* Revenue trend */
    const revenueOption = stats ? {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis', ...CHART_TT,
            formatter: p => p.map(i =>
                `<div style="display:flex;justify-content:space-between;gap:20px">
                    <span style="color:${i.color}">${i.seriesName}</span>
                    <b>${fmtCurrency(i.value)}</b>
                </div>`
            ).join(''),
        },
        legend: {
            data: ['Billed', 'Collected'],
            textStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
            right: 0,
        },
        grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
        xAxis: {
            type: 'category',
            data: stats.revenueByMonth.map(r => r.label),
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
            axisTick: { show: false },
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10 },
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
        },
        series: [
            {
                name: 'Billed',
                type: 'bar',
                data: stats.revenueByMonth.map(r => Number(r.billed)),
                barMaxWidth: 36,
                itemStyle: {
                    color: colorful ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.08)',
                    borderRadius: [4,4,0,0],
                },
            },
            {
                name: 'Collected',
                type: 'line',
                smooth: true,
                data: stats.revenueByMonth.map(r => Number(r.collected)),
                lineStyle: { color: colorful ? '#a78bfa' : 'rgba(255,255,255,0.7)', width: 2 },
                symbol: 'circle', symbolSize: 5,
                itemStyle: { color: colorful ? '#a78bfa' : 'rgba(255,255,255,0.8)' },
                areaStyle: {
                    color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: colorful ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.1)' },
                            { offset: 1, color: 'rgba(0,0,0,0)' },
                        ],
                    },
                },
            },
        ],
    } : null;

    /* Invoice donut */
    const invoicePieOption = stats ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', ...CHART_TT },
        legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: 'rgba(255,255,255,0.35)', fontSize: 11 } },
        series: [{
            type: 'pie',
            radius: ['52%', '80%'],
            center: ['36%', '50%'],
            avoidLabelOverlap: true,
            label: { show: false },
            emphasis: { label: { show: false } },
            data: stats.invoicesByStatus.map((s, i) => ({
                name: s.status, value: Number(s.count),
                itemStyle: { color: palette[i % palette.length] },
            })),
        }],
    } : null;

    /* Quotation donut */
    const quotePieOption = stats ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', ...CHART_TT },
        legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: 'rgba(255,255,255,0.35)', fontSize: 11 } },
        series: [{
            type: 'pie',
            radius: ['52%', '80%'],
            center: ['36%', '50%'],
            avoidLabelOverlap: true,
            label: { show: false },
            emphasis: { label: { show: false } },
            data: stats.quotationsByStatus.map((s, i) => ({
                name: s.status, value: Number(s.count),
                itemStyle: { color: palette[i % palette.length] },
            })),
        }],
    } : null;

    /* Top customers bar */
    const topCustOption = stats ? {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'none' }, ...CHART_TT,
            formatter: p => `<b>${p[0].name}</b><br/>${fmtCurrency(p[0].value)}`,
        },
        grid: { left: 0, right: 20, top: 4, bottom: 0, containLabel: true },
        xAxis: { type: 'value', show: false },
        yAxis: {
            type: 'category',
            data: stats.topCustomers.map(c => c.customer_name).reverse(),
            axisLine: { show: false }, axisTick: { show: false },
            axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
        },
        series: [{
            type: 'bar',
            data: stats.topCustomers.map(c => Number(c.revenue)).reverse(),
            barMaxWidth: 18,
            itemStyle: {
                color: {
                    type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: colorful
                        ? [{ offset: 0, color: 'rgba(167,139,250,0.15)' }, { offset: 1, color: 'rgba(167,139,250,0.65)' }]
                        : [{ offset: 0, color: 'rgba(255,255,255,0.06)' }, { offset: 1, color: 'rgba(255,255,255,0.45)' }],
                },
                borderRadius: [0, 6, 6, 0],
            },
            label: {
                show: true, position: 'right',
                color: 'rgba(255,255,255,0.3)', fontSize: 10,
                formatter: p => fmt(p.value),
            },
        }],
    } : null;

    const Skel = ({ h = 'h-8', w = 'w-full' }) => (
        <div className={`${h} ${w} rounded-xl bg-white/[0.03] animate-pulse`} />
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <p className="text-white/25 text-sm mb-1">{getGreeting()}</p>
                    <h1 className="text-3xl font-bold tracking-tighter text-white">
                        Welcome back, {user?.name ?? '…'}
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        title={colorful ? 'Switch to monochrome' : 'Switch to colorful'}
                        className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/15 text-white/40 hover:text-white/80 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                    >
                        {colorful ? <FiMoon className="w-3.5 h-3.5" /> : <FiSun className="w-3.5 h-3.5" />}
                        {colorful ? 'Mono' : 'Color'}
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={load}
                        disabled={loading}
                        className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/15 text-white/35 hover:text-white/70 text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-30 cursor-pointer"
                    >
                        <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {lastRefresh ? `Refreshed ${timeAgo(lastRefresh)}` : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {loading ? (
                    Array(8).fill(0).map((_, i) => (
                        <div key={i} className="bg-black/40 border border-white/[0.07] rounded-2xl p-5 space-y-3">
                            <Skel h="h-2.5" w="w-20" />
                            <Skel h="h-7" w="w-28" />
                        </div>
                    ))
                ) : stats ? (
                    <>
                        <KpiCard icon={FiDollarSign}    colorIdx={0} colorful={colorful} label="Total Revenue"        value={fmtCurrency(stats.kpi.totalRevenue)}        sub="All-time invoiced"              href="/dashboard/invoices" />
                        <KpiCard icon={FiTrendingUp}    colorIdx={1} colorful={colorful} label="Collected This Month" value={fmtCurrency(stats.kpi.collectedThisMonth)}  sub="Payments received"              href="/dashboard/invoices" />
                        <KpiCard icon={FiClock}         colorIdx={2} colorful={colorful} label="Outstanding"          value={fmtCurrency(stats.kpi.outstanding)}         sub="Awaiting payment"               href="/dashboard/invoices?status=sent" />
                        <KpiCard icon={FiAlertTriangle} colorIdx={3} colorful={colorful} label="Overdue"              value={fmtCurrency(stats.kpi.overdue)}             sub="Past due date"                  href="/dashboard/invoices?status=overdue" danger={stats.kpi.overdue > 0} />
                        <KpiCard icon={FiFileText}      colorIdx={4} colorful={colorful} label="Quotations"           value={fmt(stats.kpi.totalQuotations)}             sub={`${stats.kpi.acceptedQuotations} accepted`} href="/dashboard/quotations" />
                        <KpiCard icon={FiShoppingCart}  colorIdx={5} colorful={colorful} label="Sales Orders"         value={fmt(stats.kpi.totalSalesOrders)}            sub="All time"                       href="/dashboard/sales-orders" />
                        <KpiCard icon={FiUsers}         colorIdx={6} colorful={colorful} label="Customers"            value={fmt(stats.kpi.totalCustomers)}              sub={`+${stats.kpi.newCustomers} this month`} href="/dashboard/customers" />
                        <KpiCard icon={FiPackage}       colorIdx={7} colorful={colorful} label="Inventory Items"      value={fmt(stats.kpi.totalItems)}                  sub={stats.kpi.lowStockCount > 0 ? `${stats.kpi.lowStockCount} low stock` : 'All in stock'} href="/dashboard/inventory" danger={stats.kpi.lowStockCount > 0} />
                    </>
                ) : null}
            </div>

            {/* Revenue chart */}
            <Card title="Revenue — Last 6 Months" href="/dashboard/invoices" hrefLabel="All invoices">
                <div className="p-4">
                    {loading ? <Skel h="h-52" /> : revenueOption ? (
                        <ReactECharts option={revenueOption} style={{ height: 220 }} />
                    ) : (
                        <p className="text-center text-white/20 py-14 text-sm">No revenue data yet.</p>
                    )}
                </div>
            </Card>

            {/* Pie charts */}
            <div className="grid lg:grid-cols-2 gap-4">
                <Card title="Invoices by Status">
                    <div className="p-4">
                        {loading ? <Skel h="h-44" /> : invoicePieOption ? (
                            <ReactECharts option={invoicePieOption} style={{ height: 180 }} />
                        ) : <p className="text-center text-white/20 py-10 text-sm">No invoice data.</p>}
                    </div>
                </Card>
                <Card title="Quotations by Status">
                    <div className="p-4">
                        {loading ? <Skel h="h-44" /> : quotePieOption ? (
                            <ReactECharts option={quotePieOption} style={{ height: 180 }} />
                        ) : <p className="text-center text-white/20 py-10 text-sm">No quotation data.</p>}
                    </div>
                </Card>
            </div>

            {/* Bottom row */}
            <div className="grid lg:grid-cols-3 gap-4">
                {/* Recent Invoices */}
                <Card title="Recent Invoices" href="/dashboard/invoices">
                    {loading ? (
                        <div className="p-4 space-y-3">{Array(4).fill(0).map((_,i) => <Skel key={i} h="h-11" />)}</div>
                    ) : stats?.recentInvoices?.length ? (
                        <div className="divide-y divide-white/[0.04]">
                            {stats.recentInvoices.map((inv, i) => (
                                <div key={i} className="flex items-center justify-between px-5 py-3.5 gap-3 hover:bg-white/[0.02] transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{inv.customer_name}</p>
                                        <p className="text-xs text-white/25 font-mono">{inv.code} · {timeAgo(inv.created_at)}</p>
                                    </div>
                                    <div className="text-right shrink-0 space-y-1">
                                        <p className="text-sm font-semibold text-white font-mono">{fmtCurrency(inv.amount_due)}</p>
                                        <Badge status={inv.status} colorful={colorful} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-center text-white/20 py-10 text-sm">No invoices yet.</p>}
                </Card>

                {/* Top Customers */}
                <Card title="Top Customers by Revenue" href="/dashboard/customers">
                    <div className="p-4">
                        {loading ? <Skel h="h-52" /> : topCustOption ? (
                            <ReactECharts option={topCustOption} style={{ height: 200 }} />
                        ) : <p className="text-center text-white/20 py-10 text-sm">No data yet.</p>}
                    </div>
                </Card>

                {/* Low Stock */}
                <Card title="Low Stock Alerts" href="/dashboard/inventory">
                    {loading ? (
                        <div className="p-4 space-y-3">{Array(4).fill(0).map((_,i) => <Skel key={i} h="h-11" />)}</div>
                    ) : stats?.lowStock?.length ? (
                        <div className="divide-y divide-white/[0.04]">
                            {stats.lowStock.map((item, i) => (
                                <div key={i} className="flex items-center justify-between px-5 py-3.5 gap-3 hover:bg-white/[0.02] transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                                        <p className="text-xs text-white/25">Min: {item.min_stock} {item.uom}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <span className="font-mono font-bold text-red-400 text-sm">{item.stock_quantity}</span>
                                        <p className="text-[10px] text-white/25">{item.uom}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                            <FiPackage className="w-5 h-5 text-white/20" />
                            <p className="text-sm text-white/25">All items are well stocked.</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

