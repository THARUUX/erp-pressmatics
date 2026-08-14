'use client';

import { use, useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
    FiBarChart2, FiPieChart, FiCheckCircle, FiClock, FiCalendar,
    FiUser, FiLayers, FiPrinter, FiMonitor, FiTool, FiTrendingUp,
    FiRefreshCw, FiPrinter as FiPrintIcon, FiDownload
} from 'react-icons/fi';
import toast from 'react-hot-toast';

// Dynamically import ECharts to prevent SSR hydration mismatches
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

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

    const handleDownloadPdf = async () => {
        setExportingPdf(true);
        const toastId = toast.loading('Generating high-resolution PDF report...');
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const input = document.getElementById('report-printable-content');
            if (!input) throw new Error('Report container not found');

            const canvas = await html2canvas(input, {
                scale: 2,
                backgroundColor: '#07080f',
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    const win = clonedDoc.defaultView || window;
                    const origGetComputedStyle = win.getComputedStyle.bind(win);

                    win.getComputedStyle = function (el, pseudoElt) {
                        const style = origGetComputedStyle(el, pseudoElt);
                        return new Proxy(style, {
                            get(target, prop) {
                                if (typeof prop === 'symbol' || prop === 'inspect') return target[prop];
                                const val = target[prop];
                                if (typeof val === 'string' && (val.includes('lab(') || val.includes('oklch('))) {
                                    const p = String(prop).toLowerCase();
                                    if (p.includes('border')) return 'rgb(30, 41, 59)';
                                    if (p.includes('color') || p.includes('text')) return 'rgb(255, 255, 255)';
                                    return 'rgba(0, 0, 0, 0)';
                                }
                                if (typeof val === 'function') {
                                    return function (...args) {
                                        const res = val.apply(target, args);
                                        if (typeof res === 'string' && (res.includes('lab(') || res.includes('oklch('))) {
                                            return 'rgba(0, 0, 0, 0)';
                                        }
                                        return res;
                                    };
                                }
                                return val;
                            }
                        });
                    };
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 5) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const fileName = `${machine?.name || 'Machine'}_Report_${dateRange}_${new Date().toISOString().slice(0, 10)}.pdf`;
            pdf.save(fileName);
            toast.success('PDF report downloaded successfully!', { id: toastId });
        } catch (err) {
            console.error('PDF export error:', err);
            toast.error('Falling back to browser print view...', { id: toastId });
            window.print();
        } finally {
            setExportingPdf(false);
        }
    };

    if (loading) {
        return (
            <div className="py-24 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-400 text-xs">Generating machine reports &amp; charts...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full max-w-7xl mx-auto px-20 py-10 print:text-black">
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

                    {/* <button
                        onClick={handleDownloadPdf}
                        disabled={exportingPdf}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                        <FiDownload className="w-4 h-4" />
                        {exportingPdf ? 'Exporting PDF...' : 'Download PDF'}
                    </button> */}

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
                    <div className="bg-white/2 border border-white/10 rounded-2xl p-5 space-y-1 print:bg-slate-50 print:border-slate-300 print:p-3">
                        <span className="text-xs font-bold text-gray-400 print:text-slate-600 uppercase tracking-wider">Total Workload</span>
                        <p className="text-3xl font-black text-white print:text-slate-900">{totalTasks}</p>
                        <p className="text-[11px] text-gray-500 print:text-slate-500">Tasks in report filter</p>
                    </div>

                    <div className="bg-[#0b291d] border border-[#10b981] rounded-2xl p-5 space-y-1 print:bg-emerald-50 print:border-emerald-300 print:p-3">
                        <span className="text-xs font-bold text-emerald-400 print:text-emerald-800 uppercase tracking-wider">Completed Tasks</span>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-emerald-300 print:text-emerald-900">{completedTasks.length}</p>
                            <span className="text-xs font-bold text-emerald-400 print:text-emerald-800">({completionRate}%)</span>
                        </div>
                        <p className="text-[11px] text-emerald-500 print:text-emerald-700 font-medium">Successfully finished</p>
                    </div>

                    <div className="bg-[#211138] border border-[#a855f7] rounded-2xl p-5 space-y-1 print:bg-purple-50 print:border-purple-300 print:p-3">
                        <span className="text-xs font-bold text-purple-400 print:text-purple-800 uppercase tracking-wider">Total Planned Units</span>
                        <p className="text-3xl font-black text-purple-300 print:text-purple-900">{totalRunQty.toLocaleString()}</p>
                        <p className="text-[11px] text-purple-400/70 print:text-purple-700">{completedRunQty.toLocaleString()} units produced</p>
                    </div>

                    <div className="bg-[#2b1f0d] border border-[#f59e0b] rounded-2xl p-5 space-y-1 print:bg-amber-50 print:border-amber-300 print:p-3">
                        <span className="text-xs font-bold text-amber-400 print:text-amber-800 uppercase tracking-wider">Planning Schedule</span>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black text-amber-300 print:text-amber-900">{scheduledTasks.length}</p>
                            <span className="text-xs text-amber-400 print:text-amber-800 font-bold">Planned</span>
                        </div>
                        <p className="text-[11px] text-amber-500 print:text-amber-700">{unscheduledTasks.length} unplanned tasks</p>
                    </div>
                </div>

                {/* Visualizations & Data Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1 print:gap-6">
                    {/* Chart 1: Estimation Origin Donut Chart */}
                    <div className="bg-white/2 border border-white/10 rounded-2xl p-6 space-y-4 print:bg-white print:border-slate-300 print:p-4 page-break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-white/10 print:border-slate-200 pb-3">
                            <h3 className="text-sm font-extrabold text-white print:text-slate-900 flex items-center gap-2">
                                <FiPieChart className="text-purple-400 print:text-purple-700" /> Tasks by Estimation Type
                            </h3>
                            <span className="text-xs text-gray-400 print:text-slate-600 font-bold">{totalTasks} Total Tasks</span>
                        </div>

                        <div className="h-64 w-full min-h-[250px]">
                            <ReactECharts option={estimationPieOption} style={{ height: '100%', width: '100%' }} />
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 print:border-slate-200 text-center text-xs">
                            <div className="bg-[#0b291d] print:bg-emerald-50 p-2 rounded-xl border border-[#10b981] print:border-emerald-200">
                                <span className="block text-[10px] text-emerald-400 print:text-emerald-800 font-bold">Offset</span>
                                <span className="font-mono font-bold text-white print:text-slate-900">{offsetTasks.length} tasks</span>
                            </div>
                            <div className="bg-[#211138] print:bg-purple-50 p-2 rounded-xl border border-[#a855f7] print:border-purple-200">
                                <span className="block text-[10px] text-purple-400 print:text-purple-800 font-bold">Digital</span>
                                <span className="font-mono font-bold text-white print:text-slate-900">{digitalTasks.length} tasks</span>
                            </div>
                            <div className="bg-[#2b1f0d] print:bg-amber-50 p-2 rounded-xl border border-[#f59e0b] print:border-amber-200">
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
        </div>
    );
}
