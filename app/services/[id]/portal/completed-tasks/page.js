'use client';

import React, { use, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import {
    FiCheckCircle, FiRotateCcw, FiClock, FiUser, FiSearch, FiFilter,
    FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight,
    FiCalendar, FiRefreshCw, FiInfo, FiLayers
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function formatSeconds(secs) {
    if (!secs || secs <= 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

export default function CompletedTasksPage({ params }) {
    const { id } = use(params);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // TanStack Table states
    const [globalFilter, setGlobalFilter] = useState('');
    const [employeeFilter, setEmployeeFilter] = useState('all');
    const [sorting, setSorting] = useState([{ id: 'completed_at', desc: true }]);
    const [expandedTaskId, setExpandedTaskId] = useState(null);

    // Reopen modal state
    const [reopenModalTask, setReopenModalTask] = useState(null);
    const [targetStatus, setTargetStatus] = useState('paused');
    const [processingReopen, setProcessingReopen] = useState(false);

    const loadTasks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/services/${id}/planning`);
            const data = await res.json();
            if (res.ok) {
                const allTasks = data.tasks || [];
                const doneTasks = allTasks.filter(t => t.status === 'done');
                setTasks(doneTasks);
            } else {
                toast.error('Failed to load completed tasks');
            }
        } catch (err) {
            console.error('Error fetching completed tasks:', err);
            toast.error('Error fetching completed tasks');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    // Unique employees list for filter
    const employeesList = useMemo(() => {
        const set = new Set();
        tasks.forEach(t => {
            if (t.assigned_to) set.add(t.assigned_to);
            if (t.completed_by) set.add(t.completed_by);
            if (t.work_logs) {
                t.work_logs.forEach(wl => {
                    if (wl.employee_name) set.add(wl.employee_name);
                });
            }
        });
        return Array.from(set);
    }, [tasks]);

    // Filter tasks based on selected employee dropdown
    const dataForTable = useMemo(() => {
        if (employeeFilter === 'all') return tasks;
        return tasks.filter(t =>
            t.assigned_to === employeeFilter ||
            t.completed_by === employeeFilter ||
            (t.work_logs && t.work_logs.some(wl => wl.employee_name === employeeFilter))
        );
    }, [tasks, employeeFilter]);

    // Reopen action handler
    const handleReopenTask = async () => {
        if (!reopenModalTask) return;
        setProcessingReopen(true);

        const task = reopenModalTask;
        const orderId = task.sales_order_id || 'manual';

        try {
            const res = await fetch(`/api/sales-orders/${orderId}/tasks/${task.id}/work-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reopen',
                    target_status: targetStatus,
                    employee_name: task.assigned_to
                }),
            });

            const resData = await res.json();

            if (res.ok) {
                const pastTime = formatSeconds(task.actual_seconds || 0);
                toast.success(`Task re-opened! Accumulated duration (${pastTime}) preserved.`, {
                    duration: 5000,
                    icon: '🔄',
                });
                setReopenModalTask(null);
                loadTasks();
            } else {
                toast.error(resData.error || 'Failed to re-open task');
            }
        } catch (err) {
            console.error('Error re-opening task:', err);
            toast.error('Network error re-opening task');
        } finally {
            setProcessingReopen(false);
        }
    };

    // Columns configuration for TanStack Table
    const columns = useMemo(() => [
        {
            accessorFn: (row) => (row.name || '').replace(/^Service:.*?—\s*/, ''),
            id: 'task_name',
            header: 'Task Name',
            cell: ({ row, getValue }) => {
                const displayName = getValue();
                const estMins = parseInt(row.original.estimated_minutes || 0);
                const actSecs = parseInt(row.original.actual_seconds || 0);
                const actMins = Math.round(actSecs / 60);

                let varianceBadge = null;
                if (estMins > 0) {
                    const diff = actMins - estMins;
                    if (diff > 0) {
                        varianceBadge = (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono font-semibold">
                                +{diff}m over est.
                            </span>
                        );
                    } else if (diff < 0) {
                        varianceBadge = (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-semibold">
                                {Math.abs(diff)}m under est.
                            </span>
                        );
                    } else {
                        varianceBadge = (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono font-semibold">
                                Exact
                            </span>
                        );
                    }
                }

                return (
                    <div className="space-y-1 py-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{displayName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                                Completed
                            </span>
                            {varianceBadge}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorFn: (row) => `${row.customer_name || ''} ${row.order_code || ''}`,
            id: 'customer',
            header: 'Customer / Order',
            cell: ({ row }) => (
                <div className="space-y-0.5 text-xs">
                    <div className="font-semibold text-zinc-200 flex items-center gap-1">
                        <FiUser className="w-3 h-3 text-indigo-400" />
                        {row.original.customer_name || '—'}
                    </div>
                    {row.original.order_code && (
                        <div className="font-mono text-zinc-400 text-[11px]">
                            {row.original.order_code}
                        </div>
                    )}
                </div>
            ),
        },
        {
            accessorFn: (row) => row.assigned_to || row.completed_by || 'Unassigned',
            id: 'assigned_to',
            header: 'Assigned / Completed By',
            cell: ({ getValue }) => (
                <span className="text-xs font-medium text-zinc-300">
                    {getValue()}
                </span>
            ),
        },
        {
            accessorKey: 'completed_at',
            header: 'Completed Date',
            cell: ({ getValue }) => (
                <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
                    <FiCalendar className="w-3 h-3 text-zinc-500" />
                    {formatDate(getValue())}
                </span>
            ),
        },
        {
            accessorKey: 'actual_seconds',
            header: 'Logged Time',
            cell: ({ row, getValue }) => {
                const actSecs = parseInt(getValue() || 0);
                const estMins = parseInt(row.original.estimated_minutes || 0);
                return (
                    <div className="space-y-0.5 text-xs font-mono">
                        <div className="font-bold text-emerald-400">
                            {formatSeconds(actSecs)}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                            Est: {estMins > 0 ? `${estMins}m` : '—'}
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'actions',
            header: 'Actions',
            enableSorting: false,
            cell: ({ row }) => {
                const task = row.original;
                const isExpanded = expandedTaskId === task.id;
                return (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setReopenModalTask(task)}
                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        >
                            <FiRotateCcw className="w-3.5 h-3.5" /> Re-open
                        </button>
                        <button
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Toggle Work Log History"
                        >
                            {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                        </button>
                    </div>
                );
            },
        },
    ], [expandedTaskId]);

    // TanStack Table Instance
    const table = useReactTable({
        data: dataForTable,
        columns,
        state: { globalFilter, sorting },
        onGlobalFilterChange: setGlobalFilter,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    });

    // Summary statistics from displayed table data
    const filteredRows = table.getFilteredRowModel().rows;
    const stats = useMemo(() => {
        const count = filteredRows.length;
        const totalSecs = filteredRows.reduce((acc, r) => acc + (parseInt(r.original.actual_seconds) || 0), 0);
        const totalEstMins = filteredRows.reduce((acc, r) => acc + (parseInt(r.original.estimated_minutes) || 0), 0);
        const avgSecs = count > 0 ? Math.round(totalSecs / count) : 0;

        return {
            count,
            totalSecs,
            totalEstMins,
            avgSecs,
        };
    }, [filteredRows]);

    return (
        <div className="p-8 space-y-8 bg-[#09090b] text-zinc-100 min-h-screen">
            {/* Header & Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                            <FiCheckCircle className="w-3 h-3" /> Completed Tasks Portal
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Completed Tasks &amp; Work History</h1>
                    <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                        Powered by TanStack Table. Search, sort, inspect detailed per-employee work log histories, and re-open finished tasks with complete time data preservation.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadTasks}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-all cursor-pointer"
                    >
                        <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <Link
                        href={`/services/${id}/portal/tasks`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
                    >
                        Task Board
                    </Link>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Completed Tasks</span>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <FiCheckCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-white font-mono">{stats.count}</div>
                    <p className="text-xs text-zinc-500 mt-1">Archived &amp; finished service tasks</p>
                </div>

                <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Time Logged</span>
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <FiClock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-indigo-300 font-mono">
                        {formatSeconds(stats.totalSecs)}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">Accumulated across all sessions</p>
                </div>

                <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Avg. Time / Task</span>
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            <FiLayers className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-extrabold text-purple-300 font-mono">
                        {formatSeconds(stats.avgSecs)}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">Est: {stats.totalEstMins}m total estimated</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* TanStack Table Global Search */}
                <div className="relative flex-1 w-full">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                    <input
                        type="text"
                        value={globalFilter ?? ''}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        placeholder="TanStack Search: Search by task name, customer, order code, employee..."
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>

                {/* Employee Filter */}
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-300">
                        <FiFilter className="text-zinc-500 w-3.5 h-3.5" />
                        <span className="font-semibold text-zinc-400">Employee:</span>
                        <select
                            value={employeeFilter}
                            onChange={(e) => setEmployeeFilter(e.target.value)}
                            className="bg-transparent text-white focus:outline-none cursor-pointer font-medium"
                        >
                            <option value="all" className="bg-zinc-900">All Employees</option>
                            {employeesList.map(emp => (
                                <option key={emp} value={emp} className="bg-zinc-900">{emp}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Re-open Info Alert */}
            {/* <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 flex items-start gap-3 text-xs text-indigo-200">
                <FiInfo className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                    <span className="font-bold text-white block mb-0.5">Time Preservation Guarantee</span>
                    When you re-open any completed task below, all past work logs and recorded execution time are preserved in full. Future work session timers will continue accumulating on top of the stopped duration rather than starting at 0 seconds.
                </div>
            </div> */}

            {/* TanStack Table Container */}
            <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="py-20 text-center space-y-3">
                        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
                        <p className="text-xs text-zinc-500 font-medium">Loading completed tasks...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-900/60 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400 font-bold select-none">
                                {table.getHeaderGroups().map(hg => (
                                    <tr key={hg.id}>
                                        {hg.headers.map(h => (
                                            <th
                                                key={h.id}
                                                className="px-4 py-3.5 cursor-pointer hover:text-white transition-colors"
                                                onClick={h.column.getToggleSortingHandler()}
                                                style={{ cursor: h.column.getCanSort() ? 'pointer' : 'default' }}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    {flexRender(h.column.columnDef.header, h.getContext())}
                                                    {h.column.getIsSorted() === 'asc' && <FiChevronUp className="w-3.5 h-3.5 text-indigo-400" />}
                                                    {h.column.getIsSorted() === 'desc' && <FiChevronDown className="w-3.5 h-3.5 text-indigo-400" />}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {table.getRowModel().rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length} className="py-16 text-center text-zinc-500 text-xs">
                                            No completed tasks match your search filter.
                                        </td>
                                    </tr>
                                ) : (
                                    table.getRowModel().rows.map(row => {
                                        const task = row.original;
                                        const isExpanded = expandedTaskId === task.id;
                                        return (
                                            <React.Fragment key={row.id}>
                                                <tr className="hover:bg-zinc-800/40 transition-colors">
                                                    {row.getVisibleCells().map(cell => (
                                                        <td key={cell.id} className="px-4 py-3 align-middle">
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    ))}
                                                </tr>

                                                {/* Expanded Work Log Drawer */}
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={columns.length} className="bg-zinc-950/80 p-4 border-b border-zinc-800/80">
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                                                        <FiClock className="w-3.5 h-3.5 text-indigo-400" /> Work Session History Logs
                                                                    </h4>
                                                                    <span className="text-[11px] text-zinc-500 font-mono">
                                                                        Task ID: #{task.id}
                                                                    </span>
                                                                </div>

                                                                {(!task.work_logs || task.work_logs.length === 0) ? (
                                                                    <div className="py-4 text-center text-xs text-zinc-500 bg-zinc-900/40 rounded-lg">
                                                                        No individual work logs recorded for this task.
                                                                    </div>
                                                                ) : (
                                                                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                                                                        <table className="w-full text-left text-xs">
                                                                            <thead className="bg-zinc-950 border-b border-zinc-800 text-[10px] uppercase text-zinc-400 font-bold">
                                                                                <tr>
                                                                                    <th className="p-2.5">Employee</th>
                                                                                    <th className="p-2.5">Started At</th>
                                                                                    <th className="p-2.5">Stopped At</th>
                                                                                    <th className="p-2.5 text-right">Duration</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                                                                                {task.work_logs.map((log, idx) => (
                                                                                    <tr key={log.id || idx} className="hover:bg-zinc-800/40">
                                                                                        <td className="p-2.5 font-sans font-semibold text-white">
                                                                                            {log.employee_name || 'Employee'}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-zinc-400">
                                                                                            {formatDate(log.started_at)}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-zinc-400">
                                                                                            {log.stopped_at ? formatDate(log.stopped_at) : <span className="text-amber-400">Live</span>}
                                                                                        </td>
                                                                                        <td className="p-2.5 text-right font-bold text-indigo-300">
                                                                                            {formatSeconds(log.duration_seconds || 0)}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* TanStack Table Pagination Controls */}
            <div className="flex items-center justify-between text-xs text-zinc-400 bg-[#0e0e12] border border-zinc-800/80 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                    <span>
                        Page <strong className="text-white font-mono">{table.getState().pagination.pageIndex + 1}</strong> of{' '}
                        <strong className="text-white font-mono">{Math.max(1, table.getPageCount())}</strong>
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-500">
                        Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length} completed tasks
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Previous Page"
                    >
                        <FiChevronLeft size={14} />
                    </button>
                    <button
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Next Page"
                    >
                        <FiChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Re-open Task Modal */}
            {reopenModalTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#0e0e12] border border-zinc-700/80 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl">
                        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <FiRotateCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Re-open Task</h3>
                                <p className="text-xs text-zinc-400 truncate max-w-[280px]">
                                    {(reopenModalTask.name || '').replace(/^Service:.*?—\s*/, '')}
                                </p>
                            </div>
                        </div>

                        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between items-center text-zinc-400">
                                <span>Previously Worked Time:</span>
                                <span className="font-mono font-bold text-emerald-400">
                                    {formatSeconds(reopenModalTask.actual_seconds || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-zinc-400">
                                <span>Past Work Sessions:</span>
                                <span className="font-mono font-semibold text-white">
                                    {(reopenModalTask.work_logs || []).length} session(s)
                                </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 border-t border-zinc-800 pt-2 mt-2 leading-relaxed">
                                ✨ Re-opening will <strong className="text-white">NOT reset</strong> your time to 0. New timer logs will accumulate starting from {formatSeconds(reopenModalTask.actual_seconds || 0)}.
                            </div>
                        </div>

                        {/* Select Target Status */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                                Re-open Target Status
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTargetStatus('paused')}
                                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${targetStatus === 'paused'
                                        ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    Paused
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetStatus('in_progress')}
                                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${targetStatus === 'in_progress'
                                        ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    In Progress
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetStatus('pending')}
                                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer text-center ${targetStatus === 'pending'
                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    Pending
                                </button>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
                            <button
                                type="button"
                                onClick={() => setReopenModalTask(null)}
                                disabled={processingReopen}
                                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReopenTask}
                                disabled={processingReopen}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {processingReopen ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Re-opening...
                                    </>
                                ) : (
                                    <>
                                        <FiRotateCcw className="w-3.5 h-3.5" /> Confirm &amp; Re-open
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
