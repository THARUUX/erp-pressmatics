'use client';

import { use, useEffect, useState, useCallback } from 'react';
import {
    FiBarChart2, FiTrendingUp, FiDollarSign,
    FiCheckCircle, FiActivity, FiPieChart, FiUsers, FiFilter
} from 'react-icons/fi';
import TaskTimeAnalysisTable from '../components/TaskTimeAnalysisTable';
import EmployeeAnalyticsSection from '../components/EmployeeAnalyticsSection';

const ANALYTICS_THEMES = {
    mono: {
        container: 'bg-[#09090b] text-white p-8 space-y-8 max-w-7xl mx-auto min-h-screen font-sans',
        card: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5',
        cardHeader: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-6 space-y-6',
        bar1: 'bg-indigo-500 hover:bg-indigo-400',
        bar2: 'bg-cyan-500 hover:bg-cyan-400',
        activeBtn: 'bg-indigo-600 text-white font-bold shadow-md',
        iconBg1: 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400',
        iconBg2: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400',
        accentText: 'text-indigo-400',
        workloadGrad: 'from-indigo-500 to-cyan-400',
        legend1: 'bg-indigo-500',
        legend2: 'bg-cyan-500',
    },
    purple: {
        container: 'bg-[#09090b] text-white p-8 space-y-8 max-w-7xl mx-auto min-h-screen font-sans',
        card: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5',
        cardHeader: 'bg-[#0e0e11] border border-zinc-800/80 rounded-2xl p-6 space-y-6',
        bar1: 'bg-purple-500 hover:bg-purple-400',
        bar2: 'bg-indigo-500 hover:bg-indigo-400',
        activeBtn: 'bg-purple-600 text-white font-bold shadow-md',
        iconBg1: 'bg-purple-500/10 border border-purple-500/20 text-purple-400',
        iconBg2: 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400',
        accentText: 'text-purple-400',
        workloadGrad: 'from-purple-500 to-indigo-400',
        legend1: 'bg-purple-500',
        legend2: 'bg-indigo-500',
    },
    emerald: {
        container: 'bg-[#09090b] text-white p-8 space-y-8 max-w-7xl mx-auto min-h-screen font-sans',
        card: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5',
        cardHeader: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-6 space-y-6',
        bar1: 'bg-emerald-500 hover:bg-emerald-400',
        bar2: 'bg-cyan-500 hover:bg-cyan-400',
        activeBtn: 'bg-emerald-600 text-white font-bold shadow-md',
        iconBg1: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
        iconBg2: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400',
        accentText: 'text-emerald-400',
        workloadGrad: 'from-emerald-500 to-cyan-400',
        legend1: 'bg-emerald-500',
        legend2: 'bg-cyan-500',
    },
    blue: {
        container: 'bg-[#09090b] text-white p-8 space-y-8 max-w-7xl mx-auto min-h-screen font-sans',
        card: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5',
        cardHeader: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-6 space-y-6',
        bar1: 'bg-blue-500 hover:bg-blue-400',
        bar2: 'bg-indigo-500 hover:bg-indigo-400',
        activeBtn: 'bg-blue-600 text-white font-bold shadow-md',
        iconBg1: 'bg-blue-500/10 border border-blue-500/20 text-blue-400',
        iconBg2: 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400',
        accentText: 'text-blue-400',
        workloadGrad: 'from-blue-500 to-indigo-400',
        legend1: 'bg-blue-500',
        legend2: 'bg-indigo-500',
    },
    amber: {
        container: 'bg-[#09090b] text-white p-8 space-y-8 max-w-7xl mx-auto min-h-screen font-sans',
        card: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5',
        cardHeader: 'bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-6 space-y-6',
        bar1: 'bg-amber-500 hover:bg-amber-400',
        bar2: 'bg-orange-500 hover:bg-orange-400',
        activeBtn: 'bg-amber-600 text-white font-bold shadow-md',
        iconBg1: 'bg-amber-500/10 border border-amber-500/20 text-amber-400',
        iconBg2: 'bg-orange-500/10 border border-orange-500/20 text-orange-400',
        accentText: 'text-amber-400',
        workloadGrad: 'from-amber-500 to-orange-400',
        legend1: 'bg-amber-500',
        legend2: 'bg-orange-500',
    },
};

function RevenueAreaChart({ monthlyRevenue, monthlyQuotations, themeColor = '#6366f1' }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!monthlyRevenue || monthlyRevenue.length === 0) return (
        <div className="py-20 text-center text-zinc-400 text-xs">
            No financial records found for this period.
        </div>
    );

    const height = 200;
    const paddingX = 40;
    const paddingTop = 20;
    const paddingBottom = 30;
    const viewBoxWidth = 600;
    const chartWidth = viewBoxWidth - paddingX * 2;
    const chartHeight = height - paddingTop - paddingBottom;

    const values = monthlyRevenue.map(d => Number(d.value || d.collected || 0));
    const maxVal = Math.max(...values, 1);

    const points = monthlyRevenue.map((d, i) => {
        const x = paddingX + (i / Math.max(monthlyRevenue.length - 1, 1)) * chartWidth;
        const val = Number(d.value || d.collected || 0);
        const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
        const qVal = Number(monthlyQuotations[i]?.value || monthlyQuotations[i]?.total_value || 0);
        return { x, y, label: d.label || d.month, value: val, qVal };
    });

    const pathD = points.reduce((acc, p, i) => (
        i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`
    ), '');

    const areaD = points.length > 0
        ? `${pathD} L ${points[points.length - 1].x},${paddingTop + chartHeight} L ${points[0].x},${paddingTop + chartHeight} Z`
        : '';

    return (
        <div className="relative w-full pt-4">
            <svg viewBox={`0 0 ${viewBoxWidth} ${height}`} className="w-full h-auto overflow-visible">
                <defs>
                    <linearGradient id="analyticsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={themeColor} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={themeColor} stopOpacity="0.0" />
                    </linearGradient>
                </defs>

                {[0, 0.5, 1].map((pct, i) => {
                    const y = paddingTop + chartHeight * (1 - pct);
                    return (
                        <line key={i} x1={paddingX} y1={y} x2={viewBoxWidth - paddingX} y2={y} stroke="#27272a" strokeDasharray="3 3" strokeWidth="1" />
                    );
                })}

                <path d={areaD} fill="url(#analyticsAreaGrad)" />
                <path d={pathD} fill="none" stroke={themeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                {points.map((p, i) => (
                    <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredIndex === i ? "7" : "5"}
                            fill="#09090b"
                            stroke={themeColor}
                            strokeWidth="3"
                            className="transition-all"
                        />
                        <text x={p.x} y={height - 8} textAnchor="middle" fill="#a1a1aa" fontSize="10" className="font-mono font-semibold">
                            {p.label}
                        </text>
                    </g>
                ))}
            </svg>

            {hoveredIndex !== null && points[hoveredIndex] && (
                <div
                    className="absolute z-20 pointer-events-none bg-zinc-900 border border-zinc-700 text-white text-xs px-3 py-1.5 rounded-md shadow-2xl -translate-x-1/2 -translate-y-full"
                    style={{
                        left: `${(points[hoveredIndex].x / viewBoxWidth) * 100}%`,
                        top: `${(points[hoveredIndex].y / height) * 100 - 8}%`
                    }}
                >
                    <div className="font-bold text-zinc-300 mb-0.5">{points[hoveredIndex].label}</div>
                    <div className="text-emerald-400 font-mono font-bold">Revenue: LKR {points[hoveredIndex].value.toLocaleString()}</div>
                    {points[hoveredIndex].qVal > 0 && (
                        <div className="text-cyan-400 font-mono text-[11px]">Quotes: LKR {points[hoveredIndex].qVal.toLocaleString()}</div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function DedicatedAnalyticsPage({ params }) {
    const { id } = use(params);
    const [portalData, setPortalData] = useState(null);
    const [allTasks, setAllTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('30d');
    const [colorMode, setColorMode] = useState('mono');
    const [activeTab, setActiveTab] = useState('financial'); // 'financial' | 'tasks' | 'employees'

    useEffect(() => {
        const saved = localStorage.getItem('erp_color_mode');
        if (saved) setColorMode(saved);
    }, []);

    const activeThemeKey = ANALYTICS_THEMES[colorMode] ? colorMode : 'mono';
    const t = ANALYTICS_THEMES[activeThemeKey] || ANALYTICS_THEMES.mono;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [pRes, planRes] = await Promise.all([
                fetch(`/api/services/${id}/portal`),
                fetch(`/api/services/${id}/planning`)
            ]);
            const d = await pRes.json();
            const planData = await planRes.json();
            setPortalData(d);
            setAllTasks(planData.tasks || []);
        } catch (err) {
            console.error('Analytics load error:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen text-zinc-400">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin mb-3" />
            </div>
        );
    }

    const service = portalData?.service;
    const stats = portalData?.stats || {};
    const tasks = portalData?.recent_tasks || [];
    const monthlyRevenue = portalData?.monthly_revenue || [];
    const monthlyQuotations = portalData?.monthly_quotations || [];

    // Financial totals
    const totalRev = monthlyRevenue.reduce((acc, curr) => acc + Number(curr.collected || 0), 0);
    const totalQuoteVal = monthlyQuotations.reduce((acc, curr) => acc + Number(curr.value || 0), 0);
    const maxRev = Math.max(...monthlyRevenue.map(r => Number(r.collected || 0)), 1);

    // Task counts
    const totalTasks = stats.tasks?.total || tasks.length || 0;
    const doneTasks = stats.tasks?.done || tasks.filter(t => t.status === 'done').length || 0;
    const inProgressTasks = stats.tasks?.in_progress || tasks.filter(t => t.status === 'in_progress').length || 0;
    const pendingTasks = stats.tasks?.pending || tasks.filter(t => t.status === 'pending').length || 0;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // Multi-Employee Hours Distribution
    const empHours = {};
    tasks.forEach(task => {
        const name = task.assigned_to || 'Unassigned';
        const hours = (task.actual_seconds || 0) / 3600;
        empHours[name] = (empHours[name] || 0) + hours;
    });

    const maxEmpHours = Math.max(...Object.values(empHours), 1);

    return (
        <div className={t.container}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-md ${t.iconBg1}`}>
                            <FiBarChart2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">
                                Analytics &amp; Reports
                            </h1>
                            <p className="text-zinc-400 text-xs mt-0.5">
                                {service?.name || 'Service'} · Financial &amp; Workload Performance
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-md gap-1">
                        {['7d', '30d', '90d', '1y'].map(tf => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${timeframe === tf ? t.activeBtn : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                {tf.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Analytics Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-zinc-800/80 pb-4">
                <button
                    onClick={() => setActiveTab('financial')}
                    className={`px-4 py-2.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'financial'
                            ? 'bg-indigo-600 text-white shadow-lg font-bold'
                            : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                >
                    <FiPieChart size={15} /> Financial &amp; Revenue Overview
                </button>
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`px-4 py-2.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'tasks'
                            ? 'bg-indigo-600 text-white shadow-lg font-bold'
                            : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                >
                    <FiActivity size={15} /> Task Est. vs Actual Time Analysis
                </button>
                <button
                    onClick={() => setActiveTab('employees')}
                    className={`px-4 py-2.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'employees'
                            ? 'bg-purple-600 text-white shadow-lg font-bold'
                            : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
                        }`}
                >
                    <FiUsers size={15} /> Employee Labor &amp; Revenue Analytics
                </button>
            </div>

            {/* TAB 1: FINANCIAL OVERVIEW */}
            {activeTab === 'financial' && (
                <>
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className={t.card}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">Total Collections</span>
                                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <FiDollarSign className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-white font-mono">
                                LKR {totalRev.toLocaleString()}
                            </div>
                            <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                                <FiTrendingUp className="w-3.5 h-3.5" /> Service revenue generated
                            </div>
                        </div>

                        <div className={t.card}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">Quotation Pipeline</span>
                                <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                    <FiPieChart className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-white font-mono">
                                LKR {totalQuoteVal.toLocaleString()}
                            </div>
                            <div className="text-xs text-zinc-400 mt-1">Total estimated quotes</div>
                        </div>

                        <div className={t.card}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">Task Completion Rate</span>
                                <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    <FiCheckCircle className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-white font-mono">
                                {completionRate}%
                            </div>
                            <div className="text-xs text-indigo-300 mt-1 font-semibold">
                                {doneTasks} of {totalTasks} tasks completed
                            </div>
                        </div>

                        <div className={t.card}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">Active Workload</span>
                                <div className="p-2 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <FiActivity className="w-4 h-4" />
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-white font-mono">
                                {inProgressTasks + pendingTasks} tasks
                            </div>
                            <div className="text-xs text-amber-300 mt-1 font-semibold">
                                {inProgressTasks} in-progress · {pendingTasks} pending
                            </div>
                        </div>
                    </div>

                    {/* Main Bar Chart Panel */}
                    <div className={t.cardHeader}>
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <FiTrendingUp className={t.accentText} /> Monthly Collections vs. Quotations
                                </h3>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    Comparison of revenue collected vs quotation values created over time
                                </p>
                            </div>

                            <div className="flex items-center gap-4 text-xs font-semibold">
                                <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded ${t.legend1} inline-block`} />
                                    <span className="text-zinc-300">Revenue Collected</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded ${t.legend2} inline-block`} />
                                    <span className="text-zinc-400">Quotations Created</span>
                                </div>
                            </div>
                        </div>

                        <RevenueAreaChart monthlyRevenue={monthlyRevenue} monthlyQuotations={monthlyQuotations} themeColor="#6366f1" />
                    </div>

                    {/* Staff Workload Panel */}
                    <div className={t.card}>
                        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <FiUsers className={t.accentText} /> Staff Workload &amp; Logged Hours
                            </h3>
                            <span className="text-xs text-zinc-400">Total logged hours across tasks</span>
                        </div>

                        {Object.keys(empHours).length === 0 ? (
                            <div className="py-10 text-center text-zinc-400 text-xs">
                                No work log hours recorded yet.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.entries(empHours).map(([empName, hours]) => {
                                    const pct = Math.round((hours / maxEmpHours) * 100);
                                    return (
                                        <div key={empName} className="space-y-1.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-white">@{empName}</span>
                                                <span className="font-mono text-zinc-300 font-semibold">
                                                    {hours.toFixed(1)} hrs logged
                                                </span>
                                            </div>
                                            <div className="w-full bg-zinc-900 border border-zinc-800 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full bg-gradient-to-r ${t.workloadGrad} transition-all duration-300`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* TAB 2: TASKS PERFORMANCE */}
            {activeTab === 'tasks' && (
                <TaskTimeAnalysisTable tasks={allTasks} />
            )}

            {/* TAB 3: EMPLOYEE ANALYTICS */}
            {activeTab === 'employees' && (
                <EmployeeAnalyticsSection serviceId={id} employees={service?.employees || []} tasks={allTasks} />
            )}
        </div>
    );
}
