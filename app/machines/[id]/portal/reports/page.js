'use client';

import { use, useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
    FiBarChart2, FiPieChart, FiCheckCircle, FiClock, FiCalendar,
    FiUser, FiLayers, FiPrinter, FiMonitor, FiTool, FiTrendingUp,
    FiRefreshCw, FiPrinter as FiPrintIcon, FiDownload, FiEye, FiX,
    FiActivity, FiChevronRight, FiFilter, FiInfo, FiPackage, FiAlertTriangle
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { SpotlightCard } from '@/components/magicui/spotlight-card';

// Dynamically import ECharts to prevent SSR hydration mismatches
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

function formatMins(mins) {
    if (mins == null || isNaN(mins)) return '—';
    const abs = Math.abs(mins);
    if (abs < 60) return `${mins}m`;
    const hrs = Math.round((mins / 60) * 10) / 10;
    return `${hrs}h`;
}

function formatDateTime(d) {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function getStatusBadge(status) {
    switch (status) {
        case 'done':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border bg-emerald-500/10 text-emerald-300 border-emerald-500/25">Done</span>;
        case 'in_progress':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border bg-amber-500/10 text-amber-300 border-amber-500/25">In Progress</span>;
        case 'paused':
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border bg-orange-500/10 text-orange-300 border-orange-500/25">Paused</span>;
        default:
            return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border bg-white/5 text-white/50 border-white/10">{status || 'Pending'}</span>;
    }
}

function EstimationBadge({ type }) {
    const t = (type || 'offset').toLowerCase();
    if (t === 'digital') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-purple-400 print:text-purple-900 uppercase tracking-wider">
                <FiMonitor className="w-3 h-3 text-purple-400 print:text-purple-800" /> Digital
            </span>
        );
    }
    if (t === 'services') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-400 print:text-amber-900 uppercase tracking-wider">
                <FiTool className="w-3 h-3 text-amber-400 print:text-amber-800" /> Service
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 print:text-emerald-900 uppercase tracking-wider">
            <FiPrinter className="w-3 h-3 text-emerald-400 print:text-emerald-800" /> Offset
        </span>
    );
}

export default function MachinePortalReportsPage({ params }) {
    const { id } = use(params);
    const [machine, setMachine] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('all'); // 'all', 'today', 'week', 'month'
    const [exportingPdf, setExportingPdf] = useState(false);

    // Daily Production Report State
    const todayStr = new Date().toISOString().slice(0, 10);
    const [dailyReportDate, setDailyReportDate] = useState(todayStr);

    // Detailed Task Explorer Modal State
    const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
    const [selectedTaskDetailLoading, setSelectedTaskDetailLoading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/common-portal/machines/${id}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setMachine(data.machine);
            setTasks(data.tasks || []);
        } catch (e) {
            toast.error(e.message || 'Failed to load report data');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openTaskExplorer = useCallback(async (taskId) => {
        setSelectedTaskDetailLoading(true);
        setSelectedTaskDetail({ loadingId: taskId });
        try {
            const res = await fetch(`/api/analytics/task-explorer?taskId=${taskId}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedTaskDetail(data);
            } else {
                toast.error('Failed to load task details');
                setSelectedTaskDetail(null);
            }
        } catch (err) {
            console.error('Failed to load task explorer:', err);
            toast.error('Error fetching task details');
            setSelectedTaskDetail(null);
        } finally {
            setSelectedTaskDetailLoading(false);
        }
    }, []);

    // Filter tasks based on dateRange
    const filteredTasks = tasks.filter(t => {
        if (dateRange === 'all') return true;

        const dateStr = t.scheduled_date || t.created_at;
        if (!dateStr) return false;
        const taskDate = new Date(dateStr);
        const now = new Date();

        if (dateRange === 'today') {
            return taskDate.toDateString() === now.toDateString();
        }
        if (dateRange === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            return taskDate >= oneWeekAgo;
        }
        if (dateRange === 'month') {
            return taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    // Filter tasks for Daily Production Report: ONLY completed tasks ('done') on the selected dailyReportDate
    const dailyReportTasks = tasks.filter(t => {
        if (t.status !== 'done') return false;
        if (!dailyReportDate) return true;

        const compDate = t.completed_at || t.started_at || t.scheduled_date || t.created_at;
        if (!compDate) return false;

        const taskCompDateStr = new Date(compDate).toISOString().slice(0, 10);
        return taskCompDateStr === dailyReportDate;
    });

    // Report Calculations
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter(t => t.status === 'done');
    const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress');
    const pendingTasks = filteredTasks.filter(t => t.status === 'pending' || !t.status);
    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // Quantity Stats
    const totalRunQty = filteredTasks.reduce((sum, t) => sum + (parseFloat(t.quantity || t.sheet_count || 0) || 0), 0);
    const completedRunQty = completedTasks.reduce((sum, t) => sum + (parseFloat(t.quantity || t.sheet_count || 0) || 0), 0);

    // Estimation Type Breakdown
    const offsetTasks = filteredTasks.filter(t => (t.job_type || 'offset').toLowerCase() === 'offset');
    const digitalTasks = filteredTasks.filter(t => (t.job_type || '').toLowerCase() === 'digital');
    const servicesTasks = filteredTasks.filter(t => (t.job_type || '').toLowerCase() === 'services');

    // Planning / Scheduled Breakdown
    const scheduledTasks = filteredTasks.filter(t => t.scheduled_date || t.planned_date);
    const unscheduledTasks = filteredTasks.filter(t => !t.scheduled_date && !t.planned_date);

    // Group tasks by planned date for Planning Schedule Breakdown
    const scheduleByDateMap = new Map();
    filteredTasks.forEach(t => {
        const rawDate = t.scheduled_date || t.planned_date;
        const dateKey = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Unplanned';
        if (!scheduleByDateMap.has(dateKey)) {
            scheduleByDateMap.set(dateKey, { count: 0, completed: 0, qty: 0, completedQty: 0 });
        }
        const item = scheduleByDateMap.get(dateKey);
        item.count += 1;
        const qtyVal = parseFloat(t.quantity || t.sheet_count || 0) || 0;
        item.qty += qtyVal;
        if (t.status === 'done') {
            item.completed += 1;
            item.completedQty += qtyVal;
        }
    });

    // Operator Performance Summary
    const operatorMap = new Map();
    completedTasks.forEach(t => {
        const opName = t.completed_by || t.assigned_to || 'Unassigned Operator';
        if (!operatorMap.has(opName)) {
            operatorMap.set(opName, { name: opName, count: 0, totalQty: 0 });
        }
        const op = operatorMap.get(opName);
        op.count += 1;
        op.totalQty += (parseFloat(t.quantity || t.sheet_count || 0) || 0);
    });

    // 1. ECharts Option: Estimation Origin Donut Chart
    const estimationPieOption = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            backgroundColor: '#111',
            borderColor: '#333',
            textStyle: { color: '#fff', fontSize: 12 }
        },
        legend: {
            bottom: '0%',
            left: 'center',
            textStyle: { color: '#9ca3af', fontSize: 11 }
        },
        series: [
            {
                name: 'Estimation Type',
                type: 'pie',
                radius: ['45%', '75%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#0f172a',
                    borderWidth: 2
                },
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: '#fff'
                    }
                },
                data: [
                    { value: offsetTasks.length, name: 'Offset', itemStyle: { color: '#10b981' } },
                    { value: digitalTasks.length, name: 'Digital', itemStyle: { color: '#a855f7' } },
                    { value: servicesTasks.length, name: 'Services', itemStyle: { color: '#f59e0b' } }
                ]
            }
        ]
    };

    // 2. ECharts Option: Planning Workload Bar Chart by Date
    const datesArr = Array.from(scheduleByDateMap.keys());
    const totalQtyArr = datesArr.map(d => scheduleByDateMap.get(d).qty);
    const completedQtyArr = datesArr.map(d => scheduleByDateMap.get(d).completedQty);

    const workloadBarOption = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        legend: {
            top: '0%',
            right: '0%',
            textStyle: { color: '#9ca3af', fontSize: 11 }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: datesArr,
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#9ca3af', fontSize: 10 }
        },
        yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#334155' } },
            splitLine: { lineStyle: { color: '#1e293b' } },
            axisLabel: { color: '#9ca3af', fontSize: 10 }
        },
        series: [
            {
                name: 'Total Planned Units',
                type: 'bar',
                data: totalQtyArr,
                itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }
            },
            {
                name: 'Completed Units',
                type: 'bar',
                data: completedQtyArr,
                itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }
            }
        ]
    };

    // 3. ECharts Option: Operator Performance Horizontal Bar Chart
    const operatorNames = Array.from(operatorMap.keys());
    const operatorQtys = operatorNames.map(name => operatorMap.get(name).totalQty);

    const operatorBarOption = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '5%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#334155' } },
            splitLine: { lineStyle: { color: '#1e293b' } },
            axisLabel: { color: '#9ca3af', fontSize: 10 }
        },
        yAxis: {
            type: 'category',
            data: operatorNames,
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#e2e8f0', fontSize: 11, fontWeight: 'bold' }
        },
        series: [
            {
                name: 'Units Produced',
                type: 'bar',
                data: operatorQtys,
                itemStyle: { color: '#8b5cf6', borderRadius: [0, 6, 6, 0] }
            }
        ]
    };

    const handlePrint = () => {
        window.print();
    };

    // Compute timeline elements if selectedTaskDetail is loaded
    let timelineElements = [];
    if (selectedTaskDetail && selectedTaskDetail.logs) {
        selectedTaskDetail.logs.forEach((log, idx) => {
            timelineElements.push({
                type: 'work',
                ...log
            });
            if (idx < selectedTaskDetail.logs.length - 1) {
                const nextLog = selectedTaskDetail.logs[idx + 1];
                if (log.stopped_at && nextLog.started_at) {
                    const pauseStart = new Date(log.stopped_at);
                    const pauseEnd = new Date(nextLog.started_at);
                    const gapSec = Math.round((pauseEnd - pauseStart) / 1000);
                    if (gapSec > 60) {
                        timelineElements.push({
                            type: 'pause',
                            started_at: log.stopped_at,
                            stopped_at: nextLog.started_at,
                            duration_seconds: gapSec
                        });
                    }
                }
            }
        });
    }

    if (loading) {
        return (
            <div className="py-24 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-400 text-xs">Generating machine reports &amp; charts...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full mx-auto  py-10 print:text-black">
            {/* Global Print White Theme & Page Break Styles */}
            <style jsx global>{`
                @media print {
                    body, html {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    header {
                        display: none !important;
                    }
                    .page-break-inside-avoid {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>

            {/* Top Control Header Bar (Hidden in Print) */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/2 border border-white/10 rounded-2xl p-5 print:hidden">
                <div>
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                        <FiBarChart2 className="text-emerald-400" />
                        {machine?.name || 'Machine'} Performance &amp; Analytics Dashboard
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Interactive charts and visual reports for task execution, planned workloads, and operator outputs.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Date Range Selector */}
                    <div className="flex bg-white/3 border border-white/10 rounded-xl p-1 gap-1">
                        {[
                            { id: 'all', label: 'All Time' },
                            { id: 'today', label: 'Today' },
                            { id: 'week', label: 'This Week' },
                            { id: 'month', label: 'This Month' }
                        ].map(r => (
                            <button
                                key={r.id}
                                onClick={() => setDateRange(r.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${dateRange === r.id ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={loadData}
                        className="p-2 rounded-xl bg-white/3 border border-white/10 hover:bg-[#1e293b] text-gray-400 hover:text-white transition-all"
                        title="Refresh Report Data"
                    >
                        <FiRefreshCw className="w-4 h-4" />
                    </button>

                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/3 border border-[#334155] hover:bg-[#1e293b] text-white text-xs font-bold transition-all cursor-pointer"
                    >
                        <FiPrintIcon className="w-3.5 h-3.5" /> Print
                    </button>
                </div>
            </div>

            {/* Container for Printable & PDF Capture Content */}
            <div id="report-printable-content" className="space-y-6 w-full bg-transparent">

                {/* Printable Report Only Header (Visible only in Print) */}
                <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                                {machine?.name || 'Machine'} Production &amp; Planning Report
                            </h1>
                            <p className="text-xs text-slate-600 font-medium mt-1">
                                Pressmatics ERP Machine Performance Summary &bull; Range: <span className="font-bold uppercase">{dateRange}</span>
                            </p>
                        </div>
                        <div className="text-right text-xs text-slate-500 font-mono">
                            <p>Generated Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            <p>Time: {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>
                </div>

                {/* Key Performance Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-3 page-break-inside-avoid">
                    <SpotlightCard
                        dark
                        spotlightColor="rgba(56, 189, 248, 0.2)"
                        className="rounded-2xl print:bg-slate-50 print:border-slate-300"
                    >
                        <div className="bg-sky-400/5 p-5 space-y-1 h-full print:bg-slate-50 print:p-3">
                            <span className="text-xs font-bold text-sky-400 print:text-slate-600 uppercase tracking-wider">Total Workload</span>
                            <p className="text-3xl font-black text-white print:text-slate-900">{totalTasks}</p>
                            <p className="text-[11px] text-gray-400 print:text-slate-500">Tasks in report filter</p>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard
                        dark
                        spotlightColor="rgba(52, 211, 153, 0.25)"
                        className="rounded-2xl print:bg-emerald-50 print:border-emerald-300"
                    >
                        <div className="bg-emerald-400/5 p-5 space-y-1 h-full print:bg-emerald-50 print:p-3">
                            <span className="text-xs font-bold text-emerald-400 print:text-emerald-800 uppercase tracking-wider">Completed Tasks</span>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-black text-emerald-300 print:text-emerald-900">{completedTasks.length}</p>
                                <span className="text-xs font-bold text-emerald-400 print:text-emerald-800">({completionRate}%)</span>
                            </div>
                            <p className="text-[11px] text-emerald-500 print:text-emerald-700 font-medium">Successfully finished</p>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard
                        dark
                        spotlightColor="rgba(168, 85, 247, 0.25)"
                        className="rounded-2xl print:bg-purple-50 print:border-purple-300"
                    >
                        <div className="bg-purple-400/5 p-5 space-y-1 h-full print:bg-purple-50 print:p-3">
                            <span className="text-xs font-bold text-purple-400 print:text-purple-800 uppercase tracking-wider">Total Planned Units</span>
                            <p className="text-3xl font-black text-purple-300 print:text-purple-900">{totalRunQty.toLocaleString()}</p>
                            <p className="text-[11px] text-purple-400/70 print:text-purple-700">{completedRunQty.toLocaleString()} units produced</p>
                        </div>
                    </SpotlightCard>

                    <SpotlightCard
                        dark
                        spotlightColor="rgba(251, 191, 36, 0.25)"
                        className="rounded-2xl print:bg-amber-50 print:border-amber-300"
                    >
                        <div className="bg-amber-400/5 p-5 space-y-1 h-full print:bg-amber-50 print:p-3">
                            <span className="text-xs font-bold text-amber-400 print:text-amber-800 uppercase tracking-wider">Planning Schedule</span>
                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-black text-amber-300 print:text-amber-900">{scheduledTasks.length}</p>
                                <span className="text-xs text-amber-400 print:text-amber-800 font-bold">Planned</span>
                            </div>
                            <p className="text-[11px] text-amber-500 print:text-amber-700">{unscheduledTasks.length} unplanned tasks</p>
                        </div>
                    </SpotlightCard>
                </div>

                {/* Daily Production Report Section */}
                <div className="bg-white/2 border border-white/10 rounded-2xl p-6 space-y-6 print:bg-white print:border-slate-300 print:p-4 page-break-inside-avoid">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 print:border-slate-200 pb-4">
                        <div>
                            <h3 className="text-base font-extrabold text-white print:text-slate-900 flex items-center gap-2">
                                <FiCalendar className="text-emerald-400 print:text-sky-700" /> Daily Production Report
                            </h3>
                            <p className="text-xs text-gray-400 print:text-slate-600 mt-0.5">
                                List of completed tasks for the selected date. Click any task to open the Detailed Task Explorer.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 print:hidden">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date:</label>
                            <input
                                type="date"
                                value={dailyReportDate}
                                onChange={(e) => setDailyReportDate(e.target.value)}
                                className="bg-[#0b0c16] border border-white/15 text-white text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
                            />
                            <button
                                onClick={() => setDailyReportDate(todayStr)}
                                className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white transition-all"
                            >
                                Today
                            </button>
                        </div>
                    </div>

                    {/* Daily Summary Pill Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white/3 border border-white/20 rounded-xl p-3.5">
                            <span className="text-[10px]  text-white/50 uppercase tracking-wider block">Selected Date</span>
                            <span className="text-lg font-black text-white font-mono">{dailyReportDate || 'All'}</span>
                        </div>
                        <div className="bg-white/3 border border-white/20 rounded-xl p-3.5">
                            <span className="text-[10px]  text-white/50 uppercase tracking-wider block">Completed Tasks</span>
                            <span className="text-lg font-black text-white font-mono">
                                {dailyReportTasks.length} tasks
                            </span>
                        </div>
                        <div className="bg-white/3 border border-white/20 rounded-xl p-3.5">
                            <span className="text-[10px]  text-white/50 uppercase tracking-wider block">Total Actual Output</span>
                            <span className="text-lg font-black text-white font-mono">
                                {dailyReportTasks.reduce((sum, t) => sum + (parseFloat(t.actual_sheets_printed || t.quantity || t.sheet_count || 0) || 0), 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="bg-white/3 border border-white/20 rounded-xl p-3.5">
                            <span className="text-[10px]  text-white/50 uppercase tracking-wider block">Total Logged Time</span>
                            <span className="text-lg font-black text-white font-mono">
                                {formatMins(dailyReportTasks.reduce((sum, t) => sum + (t.actual_minutes != null ? parseFloat(t.actual_minutes) : (t.closed_seconds ? Math.round(t.closed_seconds / 60) : 0)), 0))}
                            </span>
                        </div>
                    </div>

                    {/* Tasks Table */}
                    {dailyReportTasks.length === 0 ? (
                        <div className="py-12 text-center text-xs text-gray-500 print:text-slate-500 border border-dashed border-white/10 print:border-slate-300 rounded-xl">
                            No completed production tasks recorded for <span className="font-mono font-bold text-gray-300">{dailyReportDate}</span>.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-white/10 print:border-slate-300 rounded-xl">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="bg-white/5 print:bg-slate-100 border-b border-white/10 print:border-slate-300 text-gray-400 print:text-slate-700 uppercase font-bold text-[10px]">
                                        <th className="py-3 px-3.5">Job Code / Name</th>
                                        <th className="py-3 px-3.5">Customer</th>
                                        <th className="py-3 px-3.5">Task Description</th>
                                        <th className="py-3 px-3.5 text-right">Run Qty</th>
                                        <th className="py-3 px-3.5 text-right">Actual Output</th>
                                        <th className="py-3 px-3.5 text-right">Est. Time</th>
                                        <th className="py-3 px-3.5 text-right">Actual Time</th>
                                        <th className="py-3 px-3.5 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 print:divide-slate-200">
                                    {dailyReportTasks.map(t => {
                                        const actualTimeMins = t.actual_minutes != null
                                            ? parseFloat(t.actual_minutes)
                                            : (t.closed_seconds ? Math.round(t.closed_seconds / 60) : null);

                                        return (
                                            <tr
                                                key={t.id}
                                                onClick={() => openTaskExplorer(t.id)}
                                                className="hover:bg-white/5 print:hover:bg-slate-50 transition-all cursor-pointer group"
                                            >
                                                <td className="py-3 px-3.5 font-bold text-white print:text-slate-900">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-[11px] text-blue-400 print:text-sky-800  py-0.5 rounded ">
                                                            {t.order_code || `TASK-#${t.id}`}
                                                        </span>
                                                        <span className="truncate max-w-[140px] text-gray-200 print:text-slate-800">{t.name.split('—')[2]}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-3.5 text-gray-300 print:text-slate-800 font-semibold truncate max-w-[130px]">
                                                    {t.customer_name || '—'}
                                                </td>
                                                <td className="py-3 px-3.5 text-gray-400 print:text-slate-600 truncate max-w-[160px]">
                                                    {t.name.split('—')[1] || '—'}
                                                </td>
                                                <td className="py-3 px-3.5 text-right font-mono font-bold text-gray-200 print:text-slate-900">
                                                    {t.quantity ? parseFloat(t.quantity).toLocaleString() : (t.sheet_count ? `${t.sheet_count} sh` : '—')}
                                                </td>
                                                <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-400 print:text-emerald-700">
                                                    {t.actual_sheets_printed != null
                                                        ? parseFloat(t.actual_sheets_printed).toLocaleString()
                                                        : (t.status === 'done' ? (parseFloat(t.quantity || t.sheet_count || 0) || '—') : '—')}
                                                </td>
                                                <td className="py-3 px-3.5 text-right font-mono text-gray-400 print:text-slate-700">
                                                    {formatMins(t.estimated_minutes)}
                                                </td>
                                                <td className={`py-3 px-3.5 text-right font-mono font-bold ${actualTimeMins > t.estimated_minutes ? 'text-red-400' : 'text-emerald-400'} print:text-amber-800`}>
                                                    {formatMins(actualTimeMins)}
                                                </td>
                                                <td className="py-3 px-3.5 text-center">
                                                    {getStatusBadge(t.status)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Visualizations & Data Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1 print:gap-6">
                    {/* Chart 1: Estimation Origin Donut Chart */}
                    <div className="bg-white/2 border border-white/10 rounded-2xl p-6 space-y-4 print:bg-white print:border-slate-300 print:p-4 page-break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-white/10 print:border-slate-200 pb-3">
                            <h3 className="text-sm font-extrabold text-white print:text-slate-900 flex items-center gap-2">
                                <FiPieChart className="text-emerald-400 print:text-emerald-700" /> Tasks by Estimation Type
                            </h3>
                            <span className="text-xs text-gray-400 print:text-slate-600 font-bold">{totalTasks} Total Tasks</span>
                        </div>

                        <div className="h-64 w-full min-h-[250px]">
                            <ReactECharts option={estimationPieOption} style={{ height: '100%', width: '100%' }} />
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 print:border-slate-200 text-center text-xs">
                            <div className="bg-emerald-400/3 print:bg-emerald-50 p-2 rounded-xl border border-emerald-400/20 print:border-emerald-200">
                                <span className="block text-[10px] text-emerald-400 print:text-emerald-800 font-bold">Offset</span>
                                <span className="font-mono font-bold text-white print:text-slate-900">{offsetTasks.length} tasks</span>
                            </div>
                            <div className="bg-purple-400/3 print:bg-purple-50 p-2 rounded-xl border border-purple-400/20 print:border-purple-200">
                                <span className="block text-[10px] text-purple-400 print:text-purple-800 font-bold">Digital</span>
                                <span className="font-mono font-bold text-white print:text-slate-900">{digitalTasks.length} tasks</span>
                            </div>
                            <div className="bg-amber-400/3 print:bg-amber-50 p-2 rounded-xl border border-amber-400/20 print:border-amber-200">
                                <span className="block text-[10px] text-amber-400 print:text-amber-800 font-bold">Services</span>
                                <span className="font-mono font-bold text-white print:text-slate-900">{servicesTasks.length} tasks</span>
                            </div>
                        </div>
                    </div>

                    {/* Chart 2: Daily Workload & Output Bar Chart */}
                    <div className="bg-white/2 border border-white/10 rounded-2xl p-6 space-y-4 print:bg-white print:border-slate-300 print:p-4 page-break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-white/10 print:border-slate-200 pb-3">
                            <h3 className="text-sm font-extrabold text-white print:text-slate-900 flex items-center gap-2">
                                <FiCalendar className="text-emerald-400 print:text-emerald-700" /> Workload &amp; Output by Date
                            </h3>
                            <span className="text-xs text-emerald-400 print:text-emerald-800 font-bold">{datesArr.length} Scheduled Days</span>
                        </div>

                        <div className="h-64 w-full min-h-[250px]">
                            <ReactECharts option={workloadBarOption} style={{ height: '100%', width: '100%' }} />
                        </div>

                        <p className="text-[11px] text-gray-400 print:text-slate-500 text-center pt-2 border-t border-white/10 print:border-slate-200">
                            Blue bars show total planned units for each date; green bars show units completed.
                        </p>
                    </div>
                </div>

                {/* Chart 3: Operator Production Leaderboard */}
                <div className="bg-white/2 border border-white/10 rounded-2xl p-6 space-y-6 print:bg-white print:border-slate-300 print:p-4 page-break-inside-avoid">
                    <div className="flex items-center justify-between border-b border-white/10 print:border-slate-200 pb-3">
                        <h3 className="text-sm font-extrabold text-white print:text-slate-900 flex items-center gap-2">
                            <FiUser className="text-emerald-400 print:text-emerald-700" /> Operator Production Summary
                        </h3>
                        <span className="text-xs text-gray-400 print:text-slate-600">{completedTasks.length} Total Finished Tasks</span>
                    </div>

                    {operatorMap.size === 0 ? (
                        <p className="text-xs text-gray-500 print:text-slate-500 text-center py-6">No completed task records found for the selected period.</p>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <div className="h-60 w-full min-h-[220px]">
                                <ReactECharts option={operatorBarOption} style={{ height: '100%', width: '100%' }} />
                            </div>

                            <div className="overflow-x-auto border-t border-white/10 print:border-slate-200 pt-4">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 print:border-slate-300 text-gray-400 print:text-slate-600 uppercase font-bold text-[10px]">
                                            <th className="py-2.5 px-3">Operator Name</th>
                                            <th className="py-2.5 px-3">Completed Tasks</th>
                                            <th className="py-2.5 px-3">Total Produced Quantity</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1e293b] print:divide-slate-200">
                                        {Array.from(operatorMap.values()).map(op => (
                                            <tr key={op.name} className="hover:bg-white/3 transition-all">
                                                <td className="py-3 px-3 font-bold text-white print:text-slate-900 flex items-center gap-2">
                                                    <FiUser className="text-gray-400 print:text-slate-500" /> {op.name}
                                                </td>
                                                <td className="py-3 px-3 font-semibold text-emerald-300 print:text-emerald-700 font-mono">
                                                    {op.count} tasks
                                                </td>
                                                <td className="py-3 px-3 font-bold text-amber-300 print:text-amber-800 font-mono">
                                                    {op.totalQty.toLocaleString()} units
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Task Explorer Modal */}
            {selectedTaskDetail && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fadeIn print:hidden">
                    <div className="bg-black/80 border border-white/15 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 relative text-white">

                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b border-white/10 pb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-md border border-sky-500/20">
                                        SO: {selectedTaskDetail.task?.order_code || 'Unassigned'}
                                    </span>
                                    <span className="text-xs text-gray-400 font-semibold">
                                        {selectedTaskDetail.task?.customer_name || 'No Customer'}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-white flex items-center gap-2">
                                    <FiActivity className="text-emerald-400" />
                                    {selectedTaskDetail.task?.name || 'Task Detail Explorer'}
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Detailed Task Explorer Dashboard &amp; Production Execution History
                                </p>
                            </div>

                            <button
                                onClick={() => setSelectedTaskDetail(null)}
                                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-gray-400 hover:text-white transition-all cursor-pointer"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        {selectedTaskDetailLoading ? (
                            <div className="py-16 text-center space-y-3">
                                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                <p className="text-xs text-gray-400">Loading Detailed Task Explorer Dashboard...</p>
                            </div>
                        ) : !selectedTaskDetail.task ? (
                            <div className="py-12 text-center text-xs text-gray-400">
                                Task details could not be loaded.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Header Description & Status */}
                                <div className="bg-white/3 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Task Description</span>
                                        <p className="text-xs text-gray-200 font-medium">
                                            {selectedTaskDetail.task.description || 'No additional task notes or description.'}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</span>
                                        {getStatusBadge(selectedTaskDetail.task.status)}
                                    </div>
                                </div>

                                {/* Key Metrics Cards Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-white/3 border border-white/10 rounded-xl p-3.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Estimated Time</p>
                                        <p className="text-xl font-bold text-white font-mono">{formatMins(selectedTaskDetail.task.estimated_minutes)}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Planned limit</p>
                                    </div>

                                    <div className="bg-white/3 border border-white/10 rounded-xl p-3.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Logged Duration</p>
                                        <p className="text-xl font-bold text-amber-300 font-mono">
                                            {formatMins(selectedTaskDetail.task.actual_minutes)}
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Active timer total</p>
                                    </div>

                                    <div className="bg-white/3 border border-white/10 rounded-xl p-3.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Planned Qty</p>
                                        <p className="text-xl font-bold text-white font-mono">
                                            {selectedTaskDetail.task.quantity ? parseFloat(selectedTaskDetail.task.quantity).toLocaleString() : '—'}
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                            {selectedTaskDetail.task.sheet_count ? `${selectedTaskDetail.task.sheet_count} sheets` : 'Sheets: —'}
                                        </p>
                                    </div>

                                    <div className="bg-white/3 border border-white/10 rounded-xl p-3.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Actual Output</p>
                                        <p className="text-xl font-bold text-emerald-400 font-mono">
                                            {selectedTaskDetail.task.actual_sheets_printed ? parseFloat(selectedTaskDetail.task.actual_sheets_printed).toLocaleString() : '—'}
                                        </p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                            {selectedTaskDetail.task.actual_sheets_wasted ? `Wasted: ${selectedTaskDetail.task.actual_sheets_wasted}` : 'Wasted: 0'}
                                        </p>
                                    </div>
                                </div>

                                {/* Specifications Grids */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Resource & Specs */}
                                    <div className="bg-white/3 border border-white/10 rounded-2xl p-4 space-y-3">
                                        <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wider border-b border-white/10 pb-1.5">Resource &amp; Config Details</p>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Resource Name</span>
                                                <span className="text-white font-semibold truncate">{selectedTaskDetail.task.machine_name || `ID: ${selectedTaskDetail.task.machine_id || '—'}`}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Type</span>
                                                <span className="text-white font-semibold capitalize">{selectedTaskDetail.task.machine_type || 'Finishing'}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Impressions</span>
                                                <span className="text-white font-semibold font-mono">{selectedTaskDetail.task.impression_count ? Number(selectedTaskDetail.task.impression_count).toLocaleString() : '—'}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Speed Config</span>
                                                <span className="text-white font-semibold">{selectedTaskDetail.task.custom_speed ? `${selectedTaskDetail.task.custom_speed} ${selectedTaskDetail.task.custom_speed_unit || 'sh/hr'}` : 'Auto'}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Plates Used</span>
                                                <span className="text-white font-semibold font-mono">{selectedTaskDetail.task.actual_plates_used || '0'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Operators & Downtime */}
                                    <div className="bg-white/3 border border-white/10 rounded-2xl p-4 space-y-3">
                                        <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider border-b border-white/10 pb-1.5">Operators &amp; Downtime</p>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Assigned Operator</span>
                                                <span className="text-white font-semibold truncate">{selectedTaskDetail.task.assigned_to || 'Unassigned'}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Helper</span>
                                                <span className="text-white font-semibold truncate">{selectedTaskDetail.task.helper_name || 'None'}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Completed By</span>
                                                <span className="text-white font-semibold truncate">{selectedTaskDetail.task.completed_by || '—'}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Completed Helper</span>
                                                <span className="text-white font-semibold truncate">{selectedTaskDetail.task.completed_by_helper || '—'}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Downtime</span>
                                                <span className={`font-bold font-mono ${selectedTaskDetail.task.downtime_minutes ? 'text-red-400' : 'text-white'}`}>
                                                    {selectedTaskDetail.task.downtime_minutes || '0'}m
                                                </span>
                                            </div>
                                        </div>
                                        {selectedTaskDetail.task.downtime_minutes > 0 && selectedTaskDetail.task.downtime_reason && (
                                            <div className="text-[11px] bg-red-500/10 border border-red-500/20 text-red-300 p-2 rounded-lg mt-2">
                                                <strong>Reason:</strong> {selectedTaskDetail.task.downtime_reason}
                                            </div>
                                        )}
                                    </div>

                                    {/* Lifecycle Timestamps */}
                                    <div className="bg-white/3 border border-white/10 rounded-2xl p-4 space-y-3">
                                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider border-b border-white/10 pb-1.5">Lifecycle Timestamps</p>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Started At</span>
                                                <span className="text-white font-semibold truncate">{formatDateTime(selectedTaskDetail.task.started_at)}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Completed At</span>
                                                <span className="text-white font-semibold truncate">{formatDateTime(selectedTaskDetail.task.completed_at)}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Created Date</span>
                                                <span className="text-white font-semibold truncate">{formatDateTime(selectedTaskDetail.task.created_at)}</span>
                                            </div>
                                            <div className="flex justify-between gap-2">
                                                <span className="text-gray-400">Scheduled Date</span>
                                                <span className="text-white font-semibold truncate">
                                                    {selectedTaskDetail.task.scheduled_date ? new Date(selectedTaskDetail.task.scheduled_date).toLocaleDateString('en-GB', { dateStyle: 'medium' }) : '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Work Log Execution Timeline */}
                                <div className="bg-white/3 border border-white/10 rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                            <FiClock className="text-emerald-400" /> Timer Execution Timeline
                                        </h4>
                                        <span className="text-[10px] text-gray-400 font-mono">{timelineElements.length} segments recorded</span>
                                    </div>

                                    {timelineElements.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic text-center py-4">No active work timer logs recorded for this task.</p>
                                    ) : (
                                        <div className="relative pl-4 space-y-3 border-l border-white/15 mt-3">
                                            {timelineElements.map((item, idx) => {
                                                if (item.type === 'work') {
                                                    const isRunning = !item.stopped_at;
                                                    const durMins = item.duration_seconds ? Math.round(item.duration_seconds / 60) : 0;
                                                    return (
                                                        <div key={idx} className="relative group">
                                                            <div className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 ${isRunning ? 'bg-amber-400 border-amber-500 animate-ping' : 'bg-emerald-500 border-emerald-400'}`} />
                                                            <div className="bg-white/3 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-emerald-300">Work Session</span>
                                                                        {item.employee_name && (
                                                                            <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded font-medium">
                                                                                Operator: {item.employee_name}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[11px] text-gray-400 mt-1">
                                                                        {formatDateTime(item.started_at)} &rarr; {item.stopped_at ? formatDateTime(item.stopped_at) : 'Active Now'}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right shrink-0 font-mono font-bold text-emerald-400">
                                                                    {isRunning ? 'Running' : `${durMins}m`}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                } else {
                                                    const pauseMins = item.duration_seconds ? Math.round(item.duration_seconds / 60) : 0;
                                                    return (
                                                        <div key={idx} className="relative">
                                                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-gray-600 border-2 border-gray-500" />
                                                            <div className="bg-white/2 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs text-gray-400">
                                                                <span className="text-[11px]">Paused / Idle Gap</span>
                                                                <span className="font-mono text-gray-500 font-semibold">{pauseMins}m pause</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

