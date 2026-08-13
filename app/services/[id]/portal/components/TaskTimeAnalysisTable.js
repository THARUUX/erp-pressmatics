'use client';

import { useState, useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    flexRender,
} from '@tanstack/react-table';
import {
    FiSearch, FiClock, FiChevronLeft, FiChevronRight, FiUser, FiArrowUp, FiArrowDown
} from 'react-icons/fi';

function formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function formatSeconds(secs) {
    if (!secs || secs <= 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m < 60) return `${m}m ${s > 0 ? `${s}s` : ''}`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
}

export default function TaskTimeAnalysisTable({ tasks = [] }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([{ id: 'varianceMinutes', desc: true }]);
    const [varianceFilter, setVarianceFilter] = useState('ALL'); // 'ALL' | 'OVER' | 'UNDER' | 'NOT_STARTED'
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [employeeFilter, setEmployeeFilter] = useState('ALL');

    // Extract unique employees
    const employeesList = useMemo(() => {
        const set = new Set();
        tasks.forEach(t => { if (t.assigned_to) set.add(t.assigned_to); });
        return Array.from(set);
    }, [tasks]);

    // Process tasks data with analytics attributes
    const processedTasks = useMemo(() => {
        return tasks.map(t => {
            const estM = parseInt(t.estimated_minutes || 0, 10);
            const actSecs = parseInt(t.actual_seconds || 0, 10);
            const actM = Math.round(actSecs / 60);
            const varianceMinutes = actSecs > 0 ? actM - estM : 0;
            const efficiencyPct = (actM > 0 && estM > 0) ? Math.round((estM / actM) * 100) : null;
            const displayName = t.name?.replace(/^Service:.*?—\s*/, '') || t.name;

            let varianceStatus = 'on_track';
            if (actSecs === 0) varianceStatus = 'not_started';
            else if (varianceMinutes > 0) varianceStatus = 'over';
            else varianceStatus = 'under';

            return {
                ...t,
                displayName,
                estM,
                actSecs,
                actM,
                varianceMinutes,
                efficiencyPct,
                varianceStatus,
            };
        });
    }, [tasks]);

    // Custom filtering
    const filteredData = useMemo(() => {
        return processedTasks.filter(t => {
            if (varianceFilter === 'OVER' && t.varianceStatus !== 'over') return false;
            if (varianceFilter === 'UNDER' && t.varianceStatus !== 'under') return false;
            if (varianceFilter === 'NOT_STARTED' && t.varianceStatus !== 'not_started') return false;

            if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
            if (employeeFilter !== 'ALL' && t.assigned_to !== employeeFilter) return false;

            return true;
        });
    }, [processedTasks, varianceFilter, statusFilter, employeeFilter]);

    // Summary Statistics
    const summaryStats = useMemo(() => {
        let totalEstM = 0;
        let totalActM = 0;
        let overCount = 0;
        let underCount = 0;
        let notStartedCount = 0;

        processedTasks.forEach(t => {
            totalEstM += t.estM;
            totalActM += t.actM;
            if (t.varianceStatus === 'over') overCount++;
            else if (t.varianceStatus === 'under') underCount++;
            else if (t.varianceStatus === 'not_started') notStartedCount++;
        });

        const overallEfficiency = totalActM > 0 ? Math.round((totalEstM / totalActM) * 100) : 100;

        return {
            totalEstM,
            totalActM,
            overCount,
            underCount,
            notStartedCount,
            overallEfficiency,
        };
    }, [processedTasks]);

    // Define TanStack Columns
    const columns = useMemo(() => [
        {
            accessorKey: 'displayName',
            header: 'Task Name',
            cell: ({ row }) => (
                <div>
                    <div className="font-semibold text-white text-xs">{row.original.displayName}</div>
                    {row.original.customer_name && (
                        <span className="text-[10px] text-zinc-400 block truncate max-w-[180px]">
                            {row.original.customer_name} {row.original.order_code ? `(${row.original.order_code})` : ''}
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'assigned_to',
            header: 'Assigned To',
            cell: ({ getValue }) => (
                <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                    <FiUser size={11} className="text-zinc-500" />
                    <span>{getValue() || 'Unassigned'}</span>
                </div>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ getValue }) => {
                const s = getValue();
                const badgeMap = {
                    pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
                    in_progress: 'bg-blue-500/10 text-blue-300 border-blue-500/20 font-semibold',
                    paused: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
                    done: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-bold',
                };
                return (
                    <span className={`text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider ${badgeMap[s] || 'bg-zinc-800 text-zinc-400'}`}>
                        {s?.replace('_', ' ')}
                    </span>
                );
            },
        },
        {
            accessorKey: 'estM',
            header: 'Estimated',
            cell: ({ getValue }) => (
                <span className="font-mono text-xs font-semibold text-zinc-300">
                    {formatDuration(getValue())}
                </span>
            ),
        },
        {
            accessorKey: 'actSecs',
            header: 'Actual Worked',
            cell: ({ getValue }) => (
                <span className="font-mono text-xs font-bold text-blue-300">
                    {formatSeconds(getValue())}
                </span>
            ),
        },
        {
            accessorKey: 'varianceMinutes',
            header: 'Variance (Delta)',
            cell: ({ row }) => {
                const { actSecs, varianceMinutes, varianceStatus } = row.original;
                if (actSecs === 0) {
                    return <span className="text-[11px] text-zinc-500 italic">Not Started</span>;
                }
                if (varianceStatus === 'over') {
                    return (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                            <FiArrowUp size={11} /> +{formatDuration(varianceMinutes)} over
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        <FiArrowDown size={11} /> {formatDuration(Math.abs(varianceMinutes))} saved
                    </span>
                );
            },
        },
        {
            accessorKey: 'efficiencyPct',
            header: 'Efficiency',
            cell: ({ row }) => {
                const { efficiencyPct, actSecs } = row.original;
                if (!efficiencyPct || actSecs === 0) return <span className="text-zinc-500 text-xs">—</span>;
                const color = efficiencyPct >= 100 ? 'text-emerald-400 font-bold' : efficiencyPct >= 80 ? 'text-amber-400' : 'text-rose-400 font-bold';
                return (
                    <span className={`font-mono text-xs ${color}`}>
                        {efficiencyPct}%
                    </span>
                );
            },
        },
    ], []);

    const table = useReactTable({
        data: filteredData,
        columns,
        state: { globalFilter, sorting },
        onGlobalFilterChange: setGlobalFilter,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 10 } },
    });

    return (
        <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5 space-y-5">
            {/* Header & KPI Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <FiClock className="text-purple-400" /> Task Estimated vs. Actual Time Analysis
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Compare allocated task estimates against shop-floor logged time using TanStack filtering &amp; sorting
                    </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                    <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md">
                        <span className="text-zinc-400 block text-[10px] uppercase">Est. Total</span>
                        <span className="font-mono font-bold text-zinc-200">{formatDuration(summaryStats.totalEstM)}</span>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md">
                        <span className="text-zinc-400 block text-[10px] uppercase">Actual Logged</span>
                        <span className="font-mono font-bold text-blue-400">{formatDuration(summaryStats.totalActM)}</span>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md">
                        <span className="text-zinc-400 block text-[10px] uppercase">Overall Efficiency</span>
                        <span className={`font-mono font-bold ${summaryStats.overallEfficiency >= 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {summaryStats.overallEfficiency}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-md border border-zinc-800/80">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5" />
                        <input
                            value={globalFilter ?? ''}
                            onChange={e => setGlobalFilter(e.target.value)}
                            placeholder="Search tasks, customers, code, assigned staff..."
                            className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Variance Filter */}
                    <select
                        value={varianceFilter}
                        onChange={e => setVarianceFilter(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700/80 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                        <option value="ALL">All Time Variances</option>
                        <option value="OVER">Over Estimated Time ({summaryStats.overCount})</option>
                        <option value="UNDER">Within Estimate / On Time ({summaryStats.underCount})</option>
                        <option value="NOT_STARTED">Not Started ({summaryStats.notStartedCount})</option>
                    </select>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700/80 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                        <option value="ALL">All Task Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="paused">Paused</option>
                        <option value="done">Done / Ready</option>
                    </select>

                    {/* Employee Filter */}
                    <select
                        value={employeeFilter}
                        onChange={e => setEmployeeFilter(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700/80 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                    >
                        <option value="ALL">All Staff</option>
                        {employeesList.map(emp => (
                            <option key={emp} value={emp}>{emp}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* TanStack Table */}
            <div className="overflow-x-auto rounded-md border border-zinc-800/80">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-900/80 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th
                                        key={header.id}
                                        onClick={header.column.getToggleSortingHandler()}
                                        className="px-4 py-3 cursor-pointer select-none hover:text-white transition-colors"
                                    >
                                        <div className="flex items-center gap-1">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {{
                                                asc: <span className="text-purple-400">↑</span>,
                                                desc: <span className="text-purple-400">↓</span>,
                                            }[header.column.getIsSorted()] ?? null}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 text-xs">
                        {table.getRowModel().rows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="py-12 text-center text-zinc-500">
                                    No tasks matching the selected filters.
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="hover:bg-zinc-800/40 transition-colors">
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-4 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-2">
                <div>
                    Showing {table.getRowModel().rows.length} of {filteredData.length} filtered tasks ({processedTasks.length} total)
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="p-1.5 rounded-md bg-zinc-800 border border-zinc-700 disabled:opacity-30 cursor-pointer hover:bg-zinc-700"
                    >
                        <FiChevronLeft size={14} />
                    </button>
                    <span className="font-mono text-zinc-300">
                        Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                    </span>
                    <button
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="p-1.5 rounded-md bg-zinc-800 border border-zinc-700 disabled:opacity-30 cursor-pointer hover:bg-zinc-700"
                    >
                        <FiChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
