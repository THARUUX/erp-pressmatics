'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
    FiFileText, FiShoppingCart, FiCheckSquare, FiDollarSign,
    FiTrendingUp, FiActivity, FiPlus, FiArrowUpRight, FiClock,
    FiPackage, FiUsers
} from 'react-icons/fi';
import ManageEmployeesModal from './components/ManageEmployeesModal';
import ColorModeToggle from './components/ColorModeToggle';

const STATUS_COLORS = {
    draft:     'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    sent:      'bg-blue-500/10 text-blue-300 border-blue-500/20 font-medium',
    approved:  'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 font-semibold',
    converted: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-bold',
    cancelled: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
};

const TASK_STATUS_COLORS = {
    pending:     'bg-amber-500/10 text-amber-300 border border-amber-500/20',
    in_progress: 'bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium',
    paused:      'bg-orange-500/10 text-orange-300 border border-orange-500/20',
    done:        'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold',
};

const THEME_ACCENTS = {
    mono: { container: 'bg-[#0e0e12] border-zinc-800/80 text-white', iconBg: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20', textMuted: 'text-zinc-400' },
    purple: { container: 'bg-[#0e0e12] border-zinc-800/80 text-white', iconBg: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20', textMuted: 'text-zinc-400' },
    emerald: { container: 'bg-[#0e0e12] border-zinc-800/80 text-white', iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', textMuted: 'text-zinc-400' },
    blue: { container: 'bg-[#0e0e12] border-zinc-800/80 text-white', iconBg: 'bg-blue-500/10 text-blue-400 border border-blue-500/20', textMuted: 'text-zinc-400' },
    amber: { container: 'bg-[#0e0e12] border-zinc-800/80 text-white', iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', textMuted: 'text-zinc-400' },
};

const THEME_CONFIG = {
    mono: {
        container: 'bg-[#09090b] text-white p-8 space-y-8 min-h-screen',
        btnPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 font-bold transition-all shadow-md',
        btnSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold transition-all',
        btnDefault: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all',
        chart1: 'bg-indigo-500 hover:bg-indigo-400',
        chart2: 'bg-emerald-500 hover:bg-emerald-400',
        chartIcon1: 'text-indigo-400',
        chartIcon2: 'text-emerald-400',
        linkText: 'text-indigo-400 hover:text-indigo-300',
        cardBg: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl',
        cardHeaderBorder: 'border-zinc-800/80',
    },
    purple: {
        container: 'p-8 space-y-8',
        btnPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 font-bold transition-all shadow-md',
        btnSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold transition-all',
        btnDefault: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all',
        chart1: 'bg-indigo-500 hover:bg-indigo-400',
        chart2: 'bg-emerald-500 hover:bg-emerald-400',
        chartIcon1: 'text-indigo-400',
        chartIcon2: 'text-emerald-400',
        linkText: 'text-indigo-400 hover:text-indigo-300',
        cardBg: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl',
        cardHeaderBorder: 'border-zinc-800/80',
    },
    emerald: {
        container: 'p-8 space-y-8',
        btnPrimary: 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 font-bold transition-all shadow-md',
        btnSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold transition-all',
        btnDefault: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all',
        chart1: 'bg-emerald-500 hover:bg-emerald-400',
        chart2: 'bg-cyan-500 hover:bg-cyan-400',
        chartIcon1: 'text-emerald-400',
        chartIcon2: 'text-cyan-400',
        linkText: 'text-emerald-400 hover:text-emerald-300',
        cardBg: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl',
        cardHeaderBorder: 'border-zinc-800/80',
    },
    blue: {
        container: 'p-8 space-y-8',
        btnPrimary: 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/30 font-bold transition-all shadow-md',
        btnSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold transition-all',
        btnDefault: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all',
        chart1: 'bg-blue-500 hover:bg-blue-400',
        chart2: 'bg-indigo-500 hover:bg-indigo-400',
        chartIcon1: 'text-blue-400',
        chartIcon2: 'text-indigo-400',
        linkText: 'text-blue-400 hover:text-blue-300',
        cardBg: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl',
        cardHeaderBorder: 'border-zinc-800/80',
    },
    amber: {
        container: 'p-8 space-y-8',
        btnPrimary: 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/30 font-bold transition-all shadow-md',
        btnSecondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold transition-all',
        btnDefault: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all',
        chart1: 'bg-amber-500 hover:bg-amber-400',
        chart2: 'bg-orange-500 hover:bg-orange-400',
        chartIcon1: 'text-amber-400',
        chartIcon2: 'text-orange-400',
        linkText: 'text-amber-400 hover:text-amber-300',
        cardBg: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl',
        cardHeaderBorder: 'border-zinc-800/80',
    },
};

function KpiCard({ icon: Icon, label, value, sub, accentColor = 'indigo' }) {
    const accents = {
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };

    const iconCls = accents[accentColor] || accents.indigo;

    return (
        <div className="relative rounded-2xl p-5 overflow-hidden border border-zinc-800/80 bg-[#0e0e12] transition-all">
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl border ${iconCls}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight mb-0.5">{value}</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</div>
            {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
        </div>
    );
}

// Mini inline SVG bar chart
function MiniChart({ data, color }) {
    if (!data || data.length === 0) return (
        <div className="flex items-center justify-center h-16 text-zinc-400 text-xs">No data yet</div>
    );
    const max = Math.max(...data.map(d => d.value || 0), 1);
    return (
        <div className="flex items-end gap-1.5 h-16">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                        className={`w-full rounded-t-md transition-all ${color}`}
                        style={{ height: `${Math.max(4, ((d.value || 0) / max) * 56)}px` }}
                        title={`${d.label}: ${d.value?.toLocaleString()}`}
                    />
                </div>
            ))}
        </div>
    );
}

function AreaChart({ data, strokeColor = '#6366f1' }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!data || data.length === 0) return (
        <div className="flex items-center justify-center h-28 text-zinc-400 text-xs">No revenue data available</div>
    );

    const height = 110;
    const paddingX = 25;
    const paddingTop = 15;
    const paddingBottom = 25;
    const viewBoxWidth = 400;
    const chartWidth = viewBoxWidth - paddingX * 2;
    const chartHeight = height - paddingTop - paddingBottom;

    const values = data.map(d => Number(d.value || d.collected || 0));
    const maxVal = Math.max(...values, 1);

    const points = data.map((d, i) => {
        const x = paddingX + (i / Math.max(data.length - 1, 1)) * chartWidth;
        const val = Number(d.value || d.collected || 0);
        const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
        return { x, y, label: d.label || d.month, value: val };
    });

    const pathD = points.reduce((acc, p, i) => (
        i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`
    ), '');

    const areaD = points.length > 0 
        ? `${pathD} L ${points[points.length - 1].x},${paddingTop + chartHeight} L ${points[0].x},${paddingTop + chartHeight} Z`
        : '';

    const gradId = `areaGrad_dash`;

    return (
        <div className="relative w-full">
            <svg viewBox={`0 0 ${viewBoxWidth} ${height}`} className="w-full h-auto overflow-visible">
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
                        <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                <line x1={paddingX} y1={paddingTop + chartHeight} x2={viewBoxWidth - paddingX} y2={paddingTop + chartHeight} stroke="#27272a" strokeWidth="1" />

                <path d={areaD} fill={`url(#${gradId})`} />
                <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {points.map((p, i) => (
                    <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredIndex === i ? "6" : "4"}
                            fill="#09090b"
                            stroke={strokeColor}
                            strokeWidth="2.5"
                            className="transition-all"
                        />
                    </g>
                ))}
            </svg>

            {hoveredIndex !== null && points[hoveredIndex] && (
                <div
                    className="absolute z-20 pointer-events-none bg-zinc-900 border border-zinc-700 text-white text-[11px] px-2.5 py-1 rounded-lg shadow-xl -translate-x-1/2 -translate-y-full"
                    style={{
                        left: `${(points[hoveredIndex].x / viewBoxWidth) * 100}%`,
                        top: `${(points[hoveredIndex].y / height) * 100 - 5}%`
                    }}
                >
                    <div className="font-bold text-[10px] text-zinc-400">{points[hoveredIndex].label}</div>
                    <div className="text-emerald-400 font-mono font-bold">LKR {points[hoveredIndex].value.toLocaleString()}</div>
                </div>
            )}
        </div>
    );
}

export default function ServicePortalDashboard({ params }) {
    const { id } = use(params);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [colorMode, setColorMode] = useState('mono');
    const [manageEmpOpen, setManageEmpOpen] = useState(false);

    const theme = THEME_CONFIG[colorMode] || THEME_CONFIG.mono;

    const loadData = useCallback(() => {
        setLoading(true);
        fetch(`/api/services/${id}/portal`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load portal data');
                return r.json();
            })
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(e => {
                setError(e.message);
                setLoading(false);
            });
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#09090b] text-white p-8 space-y-8 animate-pulse">
                {/* Header Skeleton */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
                    <div className="space-y-2">
                        <div className="h-5 w-32 bg-indigo-500/20 rounded-full" />
                        <div className="h-8 w-64 bg-zinc-800 rounded-lg" />
                        <div className="h-4 w-80 bg-zinc-800/60 rounded-md" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-28 bg-zinc-800 rounded-xl" />
                        <div className="h-10 w-32 bg-zinc-800 rounded-xl" />
                        <div className="h-10 w-36 bg-indigo-600/40 rounded-xl" />
                    </div>
                </div>

                {/* KPI Cards Grid Skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="p-5 bg-[#0e0e12] border border-zinc-800/80 rounded-2xl space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800" />
                            <div className="h-7 w-32 bg-zinc-800 rounded" />
                            <div className="h-3 w-24 bg-zinc-800/60 rounded" />
                        </div>
                    ))}
                </div>

                {/* Charts Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="p-6 bg-[#0e0e12] border border-zinc-800/80 rounded-2xl space-y-4">
                            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-3">
                                <div className="h-4 w-44 bg-zinc-800 rounded" />
                                <div className="h-3 w-20 bg-zinc-800/60 rounded" />
                            </div>
                            <div className="h-32 bg-zinc-900/60 rounded-xl" />
                        </div>
                    ))}
                </div>

                {/* Recent Grid Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="p-6 bg-[#0e0e12] border border-zinc-800/80 rounded-2xl space-y-4">
                            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-3">
                                <div className="h-4 w-36 bg-zinc-800 rounded" />
                                <div className="h-3 w-16 bg-zinc-800/60 rounded" />
                            </div>
                            <div className="space-y-3">
                                {[...Array(4)].map((_, j) => (
                                    <div key={j} className="h-12 bg-zinc-900/60 rounded-xl" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
                <div className="bg-[#0e0e12] border border-rose-500/30 rounded-2xl p-6 max-w-md text-center">
                    <p className="text-rose-400 font-semibold mb-2">Failed to load portal</p>
                    <p className="text-xs text-zinc-400 mb-4">{error}</p>
                    <button
                        onClick={loadData}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const { service, stats, recentQuotations, recentTasks } = data || {};
    const employeesCount = service?.employees?.length || 0;

    return (
        <div className={theme.container}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                            Service Dashboard
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">{service?.name}</h1>
                    <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                        {service?.description || 'Service Portal overview and operations.'}
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <ColorModeToggle colorMode={colorMode} onChange={setColorMode} />

                    <button
                        onClick={() => setManageEmpOpen(true)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${theme.btnSecondary}`}
                    >
                        <FiUsers className="w-4 h-4 text-indigo-400" />
                        Employees ({employeesCount})
                    </button>

                    <Link
                        href={`/services/${id}/portal/quotations/new`}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold ${theme.btnPrimary}`}
                    >
                        <FiPlus className="w-4 h-4" />
                        New Quotation
                    </Link>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    icon={FiDollarSign}
                    label="Total Revenue"
                    value={`LKR ${(stats?.totalRevenue || 0).toLocaleString()}`}
                    sub={`${stats?.convertedQuotationsCount || 0} converted quotes`}
                    accentColor="emerald"
                />
                <KpiCard
                    icon={FiFileText}
                    label="Total Quotations"
                    value={stats?.totalQuotations || 0}
                    sub={`LKR ${(stats?.totalQuotationsValue || 0).toLocaleString()} pipeline`}
                    accentColor="blue"
                />
                <KpiCard
                    icon={FiShoppingCart}
                    label="Sales Orders"
                    value={stats?.totalSalesOrders || 0}
                    sub="Converted from portal"
                    accentColor="indigo"
                />
                <KpiCard
                    icon={FiCheckSquare}
                    label="Active Tasks"
                    value={stats?.activeTasksCount || 0}
                    sub={`${stats?.inProgressTasksCount || 0} currently in progress`}
                    accentColor="amber"
                />
            </div>

            {/* Mini Analytics Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Trend */}
                <div className={`p-6 ${theme.cardBg}`}>
                    <div className={`flex items-center justify-between pb-4 mb-4 border-b ${theme.cardHeaderBorder}`}>
                        <div className="flex items-center gap-2">
                            <FiTrendingUp className={`w-4 h-4 ${theme.chartIcon1}`} />
                            <h3 className="text-sm font-bold text-white">Monthly Revenue Trend</h3>
                        </div>
                        <Link href={`/services/${id}/portal/analytics`} className={`text-xs font-semibold flex items-center gap-1 ${theme.linkText}`}>
                            Full Analytics <FiArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                    <AreaChart data={stats?.monthlyRevenue || []} strokeColor="#6366f1" />
                </div>

                {/* Quotations Trend */}
                <div className={`p-6 ${theme.cardBg}`}>
                    <div className={`flex items-center justify-between pb-4 mb-4 border-b ${theme.cardHeaderBorder}`}>
                        <div className="flex items-center gap-2">
                            <FiFileText className={`w-4 h-4 ${theme.chartIcon2}`} />
                            <h3 className="text-sm font-bold text-white">Quotations Created (Monthly)</h3>
                        </div>
                        <Link href={`/services/${id}/portal/quotations`} className={`text-xs font-semibold flex items-center gap-1 ${theme.linkText}`}>
                            View Quotations <FiArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                    <MiniChart data={stats?.monthlyQuotations || []} color={theme.chart2} />
                </div>
            </div>

            {/* Recent Section Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Quotations */}
                <div className={`p-6 ${theme.cardBg}`}>
                    <div className={`flex items-center justify-between pb-4 mb-4 border-b ${theme.cardHeaderBorder}`}>
                        <div className="flex items-center gap-2">
                            <FiFileText className="w-4 h-4 text-blue-400" />
                            <h3 className="text-sm font-bold text-white">Recent Quotations</h3>
                        </div>
                        <Link href={`/services/${id}/portal/quotations`} className={`text-xs font-semibold flex items-center gap-1 ${theme.linkText}`}>
                            View All <FiArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {(!recentQuotations || recentQuotations.length === 0) ? (
                        <div className="py-8 text-center text-zinc-400 text-xs">No quotations created yet.</div>
                    ) : (
                        <div className="space-y-2.5">
                            {recentQuotations.slice(0, 5).map(q => (
                                <Link
                                    key={q.id}
                                    href={`/services/${id}/portal/quotations/${q.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all group"
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                                                {q.quotation_number}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-md border uppercase tracking-wider font-semibold ${STATUS_COLORS[q.status] || STATUS_COLORS.draft}`}>
                                                {q.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-0.5">{q.customer_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-white font-mono">
                                            LKR {(q.grand_total || 0).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-zinc-400">{new Date(q.created_at).toLocaleDateString()}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Active Tasks */}
                <div className={`p-6 ${theme.cardBg}`}>
                    <div className={`flex items-center justify-between pb-4 mb-4 border-b ${theme.cardHeaderBorder}`}>
                        <div className="flex items-center gap-2">
                            <FiCheckSquare className="w-4 h-4 text-amber-400" />
                            <h3 className="text-sm font-bold text-white">Active Service Tasks</h3>
                        </div>
                        <Link href={`/services/${id}/portal/tasks`} className={`text-xs font-semibold flex items-center gap-1 ${theme.linkText}`}>
                            Task Board <FiArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {(!recentTasks || recentTasks.length === 0) ? (
                        <div className="py-8 text-center text-zinc-400 text-xs">No active tasks currently.</div>
                    ) : (
                        <div className="space-y-2.5">
                            {recentTasks.slice(0, 5).map(t => (
                                <div
                                    key={t.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80"
                                >
                                    <div className="min-w-0 pr-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-white truncate">
                                                {t.assigned_to ? `@${t.assigned_to}` : 'Unassigned'}
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold ${TASK_STATUS_COLORS[t.status] || TASK_STATUS_COLORS.pending}`}>
                                                {t.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                                            {t.customer_name ? `${t.customer_name} · ` : ''}SO #{t.sales_order_id}
                                        </p>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-indigo-300">
                                            <FiClock className="w-3 h-3 text-indigo-400" />
                                            {Math.floor((t.actual_seconds || 0) / 60)}m
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Manage Employees Modal */}
            <ManageEmployeesModal
                isOpen={manageEmpOpen}
                onClose={() => setManageEmpOpen(false)}
                serviceId={id}
                onSaved={loadData}
            />
        </div>
    );
}
