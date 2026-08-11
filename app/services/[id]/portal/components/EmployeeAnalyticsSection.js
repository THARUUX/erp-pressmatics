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
    FiUsers, FiDollarSign, FiClock, FiTrendingUp, FiSearch,
    FiChevronLeft, FiChevronRight, FiCalendar, FiBriefcase, FiLayers, FiPrinter,
    FiX, FiCheckSquare, FiSquare, FiFilter
} from 'react-icons/fi';

function getPeriodKey(dateInput, periodType) {
    if (!dateInput) return 'Unknown';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Unknown';

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    if (periodType === 'day') {
        return `${y}-${m}-${d}`;
    }
    if (periodType === 'week') {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.getTime());
        monday.setDate(diff);
        const monY = monday.getFullYear();
        const monM = String(monday.getMonth() + 1).padStart(2, '0');
        const monD = String(monday.getDate()).padStart(2, '0');
        return `Wk ${monM}/${monD}`;
    }
    if (periodType === 'month') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${y}`;
    }
    if (periodType === 'year') {
        return `${y}`;
    }
    return `${y}-${m}-${d}`;
}

export default function EmployeeAnalyticsSection({ serviceId, employees = [], tasks = [] }) {
    const [periodType, setPeriodType] = useState('day'); // 'day' | 'week' | 'month' | 'year'
    const [valuationMode, setValuationMode] = useState('labor_cost'); // 'labor_cost' | 'so_revenue' | 'both'
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([{ id: 'laborValue', desc: true }]);

    // PDF Task Customization Modal State
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all');
    const [selectedStatuses, setSelectedStatuses] = useState(['done', 'in_progress', 'pending']);
    const [selectedColumns, setSelectedColumns] = useState([
        'code', 'customer', 'name', 'status', 'est_time', 'act_time', 'variance', 'cost'
    ]);

    // Calculate aggregated metrics by employee and grouped by period
    const { employeeSummary, periodMatrix, uniquePeriods } = useMemo(() => {
        const empMap = {};
        const periodsSet = new Set();
        const matrix = {}; // { periodKey: { empName: { hours, laborValue, revValue } } }

        // Initialize from service_employees
        employees.forEach(emp => {
            const name = emp.employee_name;
            empMap[name] = {
                id: emp.id || name,
                name: name,
                hourlyRate: Number(emp.rate || 0),
                role: emp.role || 'Technician',
                loggedSeconds: 0,
                laborValue: 0,
                soRevenueValue: 0,
                tasksCount: 0,
                completedTasksCount: 0,
                totalEstMinutes: 0,
                totalActMinutes: 0,
            };
        });

        tasks.forEach(task => {
            const orderRev = Number(task.order_total_amount || task.total_amount || 0);
            const taskEstM = Number(task.estimated_minutes || 0);
            const taskActSecs = Number(task.actual_seconds || 0);
            const logs = task.work_logs || [];
            const breakdown = task.employee_time_breakdown || {};
            const totalTaskSecs = Object.values(breakdown).reduce((a, b) => a + Number(b), 0) || taskActSecs;

            if (logs.length > 0) {
                logs.forEach(log => {
                    const empName = log.employee_name;
                    if (!empName) return;
                    const secs = Number(log.duration_seconds || 0);
                    const logDate = log.started_at || task.created_at;
                    const pKey = getPeriodKey(logDate, periodType);
                    periodsSet.add(pKey);

                    if (!empMap[empName]) {
                        empMap[empName] = {
                            id: empName,
                            name: empName,
                            hourlyRate: 0,
                            role: 'Technician',
                            loggedSeconds: 0,
                            laborValue: 0,
                            soRevenueValue: 0,
                            tasksCount: 0,
                            completedTasksCount: 0,
                            totalEstMinutes: 0,
                            totalActMinutes: 0,
                        };
                    }

                    const hrs = secs / 3600;
                    const rate = empMap[empName].hourlyRate;
                    const laborVal = hrs * rate;
                    const share = totalTaskSecs > 0 ? (secs / totalTaskSecs) : 0;
                    const revVal = orderRev * share;

                    empMap[empName].loggedSeconds += secs;
                    empMap[empName].laborValue += laborVal;
                    empMap[empName].soRevenueValue += revVal;
                    empMap[empName].totalActMinutes += Math.round(secs / 60);

                    if (!matrix[pKey]) matrix[pKey] = {};
                    if (!matrix[pKey][empName]) matrix[pKey][empName] = { hours: 0, laborValue: 0, revValue: 0 };
                    matrix[pKey][empName].hours += hrs;
                    matrix[pKey][empName].laborValue += laborVal;
                    matrix[pKey][empName].revValue += revVal;
                });
            } else if (task.assigned_to) {
                const empName = task.assigned_to;
                const pKey = getPeriodKey(task.created_at, periodType);
                periodsSet.add(pKey);

                if (!empMap[empName]) {
                    empMap[empName] = {
                        id: empName,
                        name: empName,
                        hourlyRate: 0,
                        role: 'Technician',
                        loggedSeconds: 0,
                        laborValue: 0,
                        soRevenueValue: 0,
                        tasksCount: 0,
                        completedTasksCount: 0,
                        totalEstMinutes: 0,
                        totalActMinutes: 0,
                    };
                }

                const secs = taskActSecs;
                const hrs = secs / 3600;
                const rate = empMap[empName].hourlyRate;
                const laborVal = hrs * rate;

                empMap[empName].loggedSeconds += secs;
                empMap[empName].laborValue += laborVal;
                empMap[empName].soRevenueValue += orderRev;
                empMap[empName].totalEstMinutes += taskEstM;
                empMap[empName].totalActMinutes += Math.round(secs / 60);
                empMap[empName].tasksCount += 1;
                if (task.status === 'done') empMap[empName].completedTasksCount += 1;

                if (!matrix[pKey]) matrix[pKey] = {};
                if (!matrix[pKey][empName]) matrix[pKey][empName] = { hours: 0, laborValue: 0, revValue: 0 };
                matrix[pKey][empName].hours += hrs;
                matrix[pKey][empName].laborValue += laborVal;
                matrix[pKey][empName].revValue += orderRev;
            }
        });

        const summaryList = Object.values(empMap).map(emp => {
            const loggedHours = Math.round((emp.loggedSeconds / 3600) * 10) / 10;
            const laborValue = Math.round(emp.laborValue || (loggedHours * emp.hourlyRate));
            const soRevenueValue = Math.round(emp.soRevenueValue);
            const grossMargin = soRevenueValue - laborValue;
            const marginPct = soRevenueValue > 0 ? Math.round((grossMargin / soRevenueValue) * 100) : 0;
            const efficiencyPct = (emp.totalActMinutes > 0 && emp.totalEstMinutes > 0)
                ? Math.round((emp.totalEstMinutes / emp.totalActMinutes) * 100)
                : null;

            return {
                ...emp,
                loggedHours,
                laborValue,
                soRevenueValue,
                grossMargin,
                marginPct,
                efficiencyPct,
            };
        });

        const sortedPeriods = Array.from(periodsSet).sort().reverse().slice(0, 10);

        return {
            employeeSummary: summaryList,
            periodMatrix: matrix,
            uniquePeriods: sortedPeriods,
        };
    }, [employees, tasks, periodType]);

    // Top Totals
    const totals = useMemo(() => {
        let totalHrs = 0;
        let totalLaborVal = 0;
        let totalSoRev = 0;
        employeeSummary.forEach(e => {
            totalHrs += e.loggedHours;
            totalLaborVal += e.laborValue;
            totalSoRev += e.soRevenueValue;
        });
        return {
            totalHrs: Math.round(totalHrs * 10) / 10,
            totalLaborVal,
            totalSoRev,
        };
    }, [employeeSummary]);

    // TanStack Table Columns
    const columns = useMemo(() => [
        {
            accessorKey: 'name',
            header: 'Employee',
            cell: ({ row }) => (
                <div>
                    <div className="font-bold text-white text-xs">{row.original.name}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                        Rate: LKR {row.original.hourlyRate}/hr
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'loggedHours',
            header: 'Worked Hours',
            cell: ({ getValue }) => (
                <div className="font-mono text-xs font-bold text-zinc-200">
                    {getValue()} hrs
                </div>
            ),
        },
        {
            accessorKey: 'laborValue',
            header: 'Contributed Labor Value',
            cell: ({ row }) => (
                <div>
                    <div className="font-mono text-xs font-bold text-purple-300">
                        LKR {row.original.laborValue.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                        ({row.original.loggedHours} hrs × LKR {row.original.hourlyRate})
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'soRevenueValue',
            header: 'Sales Order Revenue',
            cell: ({ getValue }) => (
                <div className="font-mono text-xs font-bold text-emerald-400">
                    LKR {getValue().toLocaleString()}
                </div>
            ),
        },
        {
            accessorKey: 'grossMargin',
            header: 'Net Value Margin',
            cell: ({ row }) => {
                const margin = row.original.grossMargin;
                const isPos = margin >= 0;
                return (
                    <div>
                        <div className={`font-mono text-xs font-bold ${isPos ? 'text-cyan-400' : 'text-rose-400'}`}>
                            LKR {margin.toLocaleString()}
                        </div>
                        {row.original.soRevenueValue > 0 && (
                            <div className="text-[10px] text-zinc-400 font-mono">
                                ({row.original.marginPct}% margin)
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'efficiencyPct',
            header: 'Time Efficiency',
            cell: ({ getValue }) => {
                const val = getValue();
                if (!val) return <span className="text-zinc-500 text-xs">—</span>;
                const color = val >= 100 ? 'text-emerald-400 font-bold' : val >= 80 ? 'text-amber-400' : 'text-rose-400 font-bold';
                return (
                    <span className={`font-mono text-xs ${color}`}>
                        {val}%
                    </span>
                );
            },
        },
    ], []);

    const table = useReactTable({
        data: employeeSummary,
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
        <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-6 space-y-6">
            {/* Header & Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
                <div>
                    <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        <FiUsers className="text-purple-400" /> Employee Labor &amp; Revenue Analytics
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                        Track daily worked hours, contributed labor value (worked hr × hourly rate), and sales order revenue
                    </p>
                </div>

                {/* Period Selector & PDF Export */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="inline-flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-md gap-1">
                        {[
                            { id: 'day', label: 'Day by Day' },
                            { id: 'week', label: 'Week by Week' },
                            { id: 'month', label: 'Month by Month' },
                            { id: 'year', label: 'Year by Year' },
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPeriodType(p.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${periodType === p.id ? 'bg-purple-600 text-white font-bold shadow' : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {serviceId && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <a
                                href={`/api/services/${serviceId}/portal/analytics/employee-pdf?period=${periodType}&valuation=${valuationMode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                                title="Export Periodic Summary PDF"
                            >
                                <FiPrinter size={14} /> Export Summary PDF
                            </a>
                            <button
                                type="button"
                                onClick={() => setTaskModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                                title="Customize & Export Detailed Employee Tasks PDF"
                            >
                                <FiPrinter size={14} /> Export Detailed Tasks PDF
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Top KPI Totals Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-900/80 border border-purple-500/20 p-4 rounded-md">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                        Total Logged Hours
                    </span>
                    <div className="text-2xl font-bold text-white font-mono flex items-center gap-2">
                        <FiClock className="text-purple-400 w-5 h-5" /> {totals.totalHrs} hrs
                    </div>
                    <span className="text-xs text-zinc-400 mt-1 block">Across all active employees</span>
                </div>

                <div className="bg-zinc-900/80 border border-indigo-500/20 p-4 rounded-md">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                        Contributed Labor Value (hr × rate)
                    </span>
                    <div className="text-2xl font-bold text-indigo-300 font-mono flex items-center gap-2">
                        <FiBriefcase className="text-indigo-400 w-5 h-5" /> LKR {totals.totalLaborVal.toLocaleString()}
                    </div>
                    <span className="text-xs text-zinc-400 mt-1 block">Calculated as logged hr × employee rate</span>
                </div>

                <div className="bg-zinc-900/80 border border-emerald-500/20 p-4 rounded-md">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                        Sales Order Revenue Value
                    </span>
                    <div className="text-2xl font-bold text-emerald-400 font-mono flex items-center gap-2">
                        <FiDollarSign className="text-emerald-400 w-5 h-5" /> LKR {totals.totalSoRev.toLocaleString()}
                    </div>
                    <span className="text-xs text-zinc-400 mt-1 block">Revenue from associated sales orders</span>
                </div>
            </div>

            {/* Valuation View Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/50 p-3 rounded-md border border-zinc-800">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <FiLayers className="text-purple-400" /> Report Valuation Mode:
                </span>
                <div className="inline-flex items-center bg-zinc-900 border border-zinc-700/80 p-1 rounded-lg gap-1 text-xs">
                    <button
                        onClick={() => setValuationMode('labor_cost')}
                        className={`px-3 py-1 rounded-md transition-all cursor-pointer ${valuationMode === 'labor_cost' ? 'bg-purple-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        💼 Labor Value (Worked Hr × Rate)
                    </button>
                    <button
                        onClick={() => setValuationMode('so_revenue')}
                        className={`px-3 py-1 rounded-md transition-all cursor-pointer ${valuationMode === 'so_revenue' ? 'bg-emerald-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        💵 Sales Order Revenue
                    </button>
                    <button
                        onClick={() => setValuationMode('both')}
                        className={`px-3 py-1 rounded-md transition-all cursor-pointer ${valuationMode === 'both' ? 'bg-indigo-600 text-white font-bold' : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        ⚖️ Both &amp; Net Margin
                    </button>
                </div>
            </div>

            {/* Period Breakdown Matrix (Day by Day / Week / Month / Year Matrix) */}
            {uniquePeriods.length > 0 && (
                <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-md space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                        <span className="flex items-center gap-2">
                            <FiCalendar className="text-purple-400" /> Worked Hours &amp; Value Breakdown ({periodType.toUpperCase()})
                        </span>
                        <span className="text-zinc-500 font-normal">Recent {uniquePeriods.length} periods</span>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-zinc-800">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-zinc-950 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                                <tr>
                                    <th className="px-4 py-2.5">Employee</th>
                                    {uniquePeriods.map(pKey => (
                                        <th key={pKey} className="px-3 py-2.5 text-center font-mono">{pKey}</th>
                                    ))}
                                    <th className="px-4 py-2.5 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                                {employeeSummary.map(emp => {
                                    return (
                                        <tr key={emp.name} className="hover:bg-zinc-800/30">
                                            <td className="px-4 py-2.5 font-bold text-white font-sans">{emp.name}</td>
                                            {uniquePeriods.map(pKey => {
                                                const pData = periodMatrix[pKey]?.[emp.name];
                                                if (!pData || pData.hours === 0) {
                                                    return <td key={pKey} className="px-3 py-2.5 text-center text-zinc-600">—</td>;
                                                }
                                                const hrs = Math.round(pData.hours * 10) / 10;
                                                const val = valuationMode === 'so_revenue' ? pData.revValue : pData.laborValue;
                                                return (
                                                    <td key={pKey} className="px-3 py-2.5 text-center">
                                                        <div className="text-zinc-200 font-semibold">{hrs}h</div>
                                                        <div className="text-[10px] text-purple-300">LKR {Math.round(val).toLocaleString()}</div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-2.5 text-right font-bold text-purple-300 font-sans">
                                                {emp.loggedHours}h
                                                <div className="text-[10px] text-emerald-400 font-mono">
                                                    LKR {valuationMode === 'so_revenue' ? emp.soRevenueValue.toLocaleString() : emp.laborValue.toLocaleString()}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TanStack Table & Search */}
            <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5" />
                        <input
                            value={globalFilter ?? ''}
                            onChange={e => setGlobalFilter(e.target.value)}
                            placeholder="Search employee name..."
                            className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                        />
                    </div>
                    <span className="text-xs text-zinc-400 font-mono">
                        {employeeSummary.length} employees
                    </span>
                </div>

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
                                    <td colSpan={columns.length} className="py-10 text-center text-zinc-500">
                                        No employee records found.
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

                {/* Pagination */}
                <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                    <div>
                        Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="p-1.5 rounded-md bg-zinc-800 border border-zinc-700 disabled:opacity-30 cursor-pointer hover:bg-zinc-700"
                        >
                            <FiChevronLeft size={14} />
                        </button>
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

            {/* Task PDF Report Options Modal */}
            {taskModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#121319] border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-5 p-6 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <FiFilter className="text-indigo-400" /> Customize Employee Task PDF
                                </h3>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    Select employees, columns, and task statuses to include in your PDF report
                                </p>
                            </div>
                            <button
                                onClick={() => setTaskModalOpen(false)}
                                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                            {/* 1. Employee Filter */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-300 block">1. Employee Filter</label>
                                <select
                                    value={selectedEmployeeFilter}
                                    onChange={e => setSelectedEmployeeFilter(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="all">All Service Employees ({employeeSummary.length})</option>
                                    {employeeSummary.map(emp => (
                                        <option key={emp.name} value={emp.name}>{emp.name} ({emp.role})</option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. Task Statuses */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-300 block">2. Task Statuses to Include</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'done', label: 'Done', color: 'text-emerald-400' },
                                        { id: 'in_progress', label: 'In-Progress', color: 'text-amber-400' },
                                        { id: 'pending', label: 'Pending', color: 'text-zinc-400' },
                                    ].map(st => {
                                        const isChecked = selectedStatuses.includes(st.id);
                                        return (
                                            <button
                                                key={st.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isChecked) {
                                                        if (selectedStatuses.length > 1) {
                                                            setSelectedStatuses(selectedStatuses.filter(s => s !== st.id));
                                                        }
                                                    } else {
                                                        setSelectedStatuses([...selectedStatuses, st.id]);
                                                    }
                                                }}
                                                className={`px-3 py-2 rounded-md border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${isChecked ? 'bg-indigo-600/20 border-indigo-500/50 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                                                    }`}
                                            >
                                                <span className={st.color}>{st.label}</span>
                                                {isChecked ? <FiCheckSquare className="text-indigo-400" /> : <FiSquare />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Columns Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-300 block">3. Report Columns to Include</label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {[
                                        { id: 'code', label: 'SO Code' },
                                        { id: 'customer', label: 'Customer Name' },
                                        { id: 'name', label: 'Task Name & Details' },
                                        { id: 'status', label: 'Task Status' },
                                        { id: 'est_time', label: 'Estimated Duration' },
                                        { id: 'act_time', label: 'Logged Worked Time' },
                                        { id: 'variance', label: 'Time Variance' },
                                        { id: 'cost', label: 'Labor Cost Allocation' },
                                    ].map(col => {
                                        const isChecked = selectedColumns.includes(col.id);
                                        return (
                                            <button
                                                key={col.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isChecked) {
                                                        if (selectedColumns.length > 1) {
                                                            setSelectedColumns(selectedColumns.filter(c => c !== col.id));
                                                        }
                                                    } else {
                                                        setSelectedColumns([...selectedColumns, col.id]);
                                                    }
                                                }}
                                                className={`px-3 py-2 rounded-md border text-xs flex items-center justify-between transition-all cursor-pointer ${isChecked ? 'bg-zinc-800 border-zinc-700 text-zinc-200 font-semibold' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500'
                                                    }`}
                                            >
                                                <span>{col.label}</span>
                                                {isChecked ? <FiCheckSquare className="text-indigo-400" /> : <FiSquare />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
                            <button
                                type="button"
                                onClick={() => setTaskModalOpen(false)}
                                className="px-4 py-2 rounded-md text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <a
                                href={`/api/services/${serviceId}/portal/analytics/employee-tasks-pdf?employeeName=${selectedEmployeeFilter}&statuses=${selectedStatuses.join(',')}&columns=${selectedColumns.join(',')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setTaskModalOpen(false)}
                                className="px-4 py-2 rounded-md text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <FiPrinter size={14} /> Generate &amp; Download PDF
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
