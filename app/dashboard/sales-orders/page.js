'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/components/SettingsContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import toast from 'react-hot-toast';
import {
    FiSearch, FiPrinter, FiTrash2, FiFileText, FiDownload,
    FiChevronUp, FiChevronDown, FiChevronsLeft, FiChevronLeft,
    FiChevronRight, FiChevronsRight, FiClock, FiCheckCircle, FiDollarSign,
    FiCpu, FiRefreshCw, FiCalendar, FiFilter, FiLayers, FiPrinter as FiOffsetIcon,
    FiMonitor, FiTool
} from 'react-icons/fi';
import { numericOperatorFilterFn } from '@/lib/numericFilter';
import { dateOperatorFilterFn } from '@/lib/dateFilter';

/* ── Status badge ─────────────────────────────────────────────────────────── */
const STATUS_COLORS = {
    'Pending':       'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'In Production': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Ready':         'bg-green-500/20 text-green-300 border-green-500/30',
    'Delivered':     'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'Cancelled':     'bg-red-500/20 text-red-300 border-red-500/30',
};
function StatusBadge({ status }) {
    const cls = STATUS_COLORS[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
            {status}
        </span>
    );
}

/* ── Category badge ───────────────────────────────────────────────────────── */
function CategoryBadge({ category }) {
    const cat = (category || 'offset').toLowerCase();
    if (cat === 'digital') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                <FiMonitor className="w-3 h-3" /> Digital
            </span>
        );
    }
    if (cat === 'services') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                <FiTool className="w-3 h-3" /> Service
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
            <FiOffsetIcon className="w-3 h-3" /> Offset
        </span>
    );
}

/* ── Shared micro-components ──────────────────────────────────────────────── */
function SortIcon({ dir }) {
    if (!dir) return <span className="opacity-20 text-xs">⇅</span>;
    return dir === 'asc' ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />;
}

function ColFilter({ column }) {
    const val = column.getFilterValue() ?? '';
    const isDateCol = column.id === 'order_date' || column.id === 'delivery_date';
    const isAmountCol = column.id === 'total_amount';
    const placeholder = isDateCol
        ? "Date (>=2026-08-01, today, month)..."
        : isAmountCol
        ? "Amount (>1000, <=5000)..."
        : "Filter…";

    return (
        <input value={val} onChange={e => column.setFilterValue(e.target.value)}
            placeholder={placeholder}
            title={isDateCol ? "Supports formulas: >=2026-08-01, <2026-08-10, 2026-08-01..2026-08-10, today, this week, month, etc." : undefined}
            onClick={e => e.stopPropagation()}
            className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/30" />
    );
}

function PagBtn({ children, onClick, disabled }) {
    return (
        <button onClick={onClick} disabled={disabled}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            {children}
        </button>
    );
}

const CATEGORY_TABS = [
    { key: 'All', label: 'All Categories', icon: FiLayers },
    { key: 'Offset', label: 'Offset Printing', icon: FiOffsetIcon },
    { key: 'Digital', label: 'Digital Printing', icon: FiMonitor },
    { key: 'Services', label: 'Services', icon: FiTool },
];

const STATUS_TABS = ['All', 'Pending', 'In Production', 'Ready', 'Delivered', 'Cancelled'];
const TIME_PRESETS = ['All Time', 'Today', 'Yesterday', 'This Week', 'This Month', 'Last 30 Days', 'This Quarter', 'This Year', 'Custom Range'];

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function SalesOrdersPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';

    const [data, setData]             = useState([]);
    const [stats, setStats]           = useState({ pending_count: 0, production_count: 0, pending_total: 0 });
    const [loading, setLoading]       = useState(true);
    const [categoryFilter, setCategory] = useState('All');
    const [statusFilter, setStatus]   = useState('All');
    const [durationFilter, setDuration] = useState('All Time');
    const [customStartDate, setCustomStart] = useState('');
    const [customEndDate, setCustomEnd]     = useState('');
    const [globalFilter, setGlobal]   = useState('');
    const [columnVisibility, setColVis] = useState({});
    const [columnFilters, setColumnFilters] = useState([]);
    const [exportingPdf, setExportingPdf] = useState(false);

    /* fetch all sales orders */
    const fetchAll = useCallback(() => {
        setLoading(true);
        let url = '/api/sales-orders?limit=1000&offset=0';
        if (statusFilter !== 'All') url += `&status=${encodeURIComponent(statusFilter)}`;
        if (categoryFilter !== 'All') url += `&category=${encodeURIComponent(categoryFilter.toLowerCase())}`;
        
        fetch(url)
            .then(r => r.json())
            .then(d => {
                setData(Array.isArray(d.salesOrders) ? d.salesOrders : []);
                setStats(d.stats || { pending_count: 0, production_count: 0, pending_total: 0 });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [statusFilter, categoryFilter]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /* Category counts calculated from full fetched dataset */
    const categoryCounts = useMemo(() => {
        let offset = 0;
        let digital = 0;
        let services = 0;
        for (const item of data) {
            const cat = (item.job_type || 'offset').toLowerCase();
            if (cat === 'digital') digital++;
            else if (cat === 'services') services++;
            else offset++;
        }
        return {
            all: data.length,
            offset,
            digital,
            services
        };
    }, [data]);

    /* Filter data by category, duration preset, or custom date range */
    const durationFilteredData = useMemo(() => {
        return data.filter(item => {
            // 1. Category Filter
            if (categoryFilter !== 'All') {
                const itemCategory = (item.job_type || 'offset').toLowerCase();
                if (itemCategory !== categoryFilter.toLowerCase()) return false;
            }

            // 2. Duration Filter
            if (!durationFilter || durationFilter === 'All Time') return true;

            if (!item.order_date) return false;
            const d = new Date(item.order_date);
            if (isNaN(d.getTime())) return false;
            d.setHours(0, 0, 0, 0);
            const t = d.getTime();

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTime = today.getTime();

            if (durationFilter === 'Today') {
                return t === todayTime;
            }
            if (durationFilter === 'Yesterday') {
                const yest = new Date(today);
                yest.setDate(yest.getDate() - 1);
                return t === yest.getTime();
            }
            if (durationFilter === 'This Week') {
                const dayOfWeek = today.getDay();
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                return t >= startOfWeek.getTime() && t <= endOfWeek.getTime();
            }
            if (durationFilter === 'This Month') {
                return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
            }
            if (durationFilter === 'Last 30 Days') {
                const start = new Date(today);
                start.setDate(today.getDate() - 30);
                return t >= start.getTime() && t <= todayTime;
            }
            if (durationFilter === 'This Quarter') {
                const currentQuarter = Math.floor(today.getMonth() / 3);
                const itemQuarter = Math.floor(d.getMonth() / 3);
                return d.getFullYear() === today.getFullYear() && itemQuarter === currentQuarter;
            }
            if (durationFilter === 'This Year') {
                return d.getFullYear() === today.getFullYear();
            }
            if (durationFilter === 'Custom Range') {
                let match = true;
                if (customStartDate) {
                    const s = new Date(customStartDate);
                    s.setHours(0, 0, 0, 0);
                    if (t < s.getTime()) match = false;
                }
                if (customEndDate) {
                    const e = new Date(customEndDate);
                    e.setHours(23, 59, 59, 999);
                    if (d.getTime() > e.getTime()) match = false;
                }
                return match;
            }
            return true;
        });
    }, [data, categoryFilter, durationFilter, customStartDate, customEndDate]);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!(await confirmDialog('Delete this sales order? This cannot be undone.', { danger: true, confirmLabel: 'Delete' }))) return;
        const res = await fetch(`/api/sales-orders/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Sales order deleted'); fetchAll(); }
        else toast.error('Failed to delete');
    };

    const handleGenerateTasks = useCallback(async (e, order) => {
        e.stopPropagation();
        const hasTasks = Boolean(order.task_count && order.task_count > 0);
        const promptMsg = hasTasks
            ? `Regenerate tasks for ${order.code}? Existing tasks will be replaced according to current task configurations.`
            : `Generate default tasks for ${order.code}?`;
            
        if (!(await confirmDialog(promptMsg, { confirmLabel: hasTasks ? 'Regenerate' : 'Generate', danger: hasTasks }))) return;
        
        const loadingToast = toast.loading(hasTasks ? 'Regenerating tasks...' : 'Generating tasks...');
        try {
            const res = await fetch(`/api/sales-orders/${order.id}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generateDefaults: true }),
            });
            if (res.ok) {
                toast.success(hasTasks ? 'Tasks regenerated successfully' : 'Tasks generated successfully', { id: loadingToast });
                fetchAll();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to generate tasks', { id: loadingToast });
            }
        } catch (error) {
            console.error('Error generating tasks:', error);
            toast.error('An error occurred while generating tasks', { id: loadingToast });
        }
    }, [fetchAll]);

    const fmt = n => `${currency} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

    /* ── PDF export ─────────────────────────────────────────────────────── */
    const exportToPDF = async () => {
        setExportingPdf(true);
        try {
            const visibleCols = table.getVisibleLeafColumns()
                .filter(col => col.id !== 'actions')
                .map(col => ({
                    key: col.id || col.columnDef.accessorKey,
                    header: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
                }));

            const filteredRows = table.getFilteredRowModel().rows.map(row => row.original);

            const pdfStats = [
                { label: 'Matching Orders', value: `${filteredStats.total_count}` },
                { label: 'Pending Orders', value: `${filteredStats.pending_count}` },
                { label: 'In Production', value: `${filteredStats.production_count}` },
                { label: 'Filtered Total Value', value: `${currency} ${filteredStats.total_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
            ];

            const res = await fetch('/api/pdf/dynamic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Sales Orders Directory Report',
                    subtitle: `Exported Sales Orders (${categoryFilter} Category)`,
                    columns: visibleCols,
                    rows: filteredRows,
                    stats: pdfStats,
                    currency: currency
                })
            });

            if (!res.ok) {
                toast.error('Failed to generate PDF');
                setExportingPdf(false);
                return;
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales_orders_${categoryFilter.toLowerCase()}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Export PDF error:', error);
            toast.error('An error occurred while generating PDF');
        } finally {
            setExportingPdf(false);
        }
    };

    /* ── Column definitions ─────────────────────────────────────────────── */
    const columns = useMemo(() => [
        {
            accessorKey: 'code', header: 'SO Code', size: 120,
            cell: ({ getValue }) => (
                <span className="font-mono text-xs text-blue-400 bg-blue-500/5 border border-blue-500/20 px-2 py-0.5 rounded">
                    {getValue()}
                </span>
            ),
        },
        {
            accessorKey: 'job_type', header: 'Category', size: 110,
            cell: ({ getValue }) => <CategoryBadge category={getValue()} />,
        },
        {
            accessorKey: 'customer_name', header: 'Customer',
            cell: ({ getValue }) => <span className="font-semibold text-white">{getValue()}</span>,
        },
        {
            accessorKey: 'estimation_names', header: 'Jobs',
            cell: ({ getValue }) => (
                <span className="text-gray-400 text-xs truncate max-w-[200px] block">{getValue() || '—'}</span>
            ),
        },
        {
            accessorKey: 'status', header: 'Status', size: 130,
            cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        },
        {
            accessorKey: 'total_amount', header: 'Amount', size: 150,
            filterFn: numericOperatorFilterFn,
            cell: ({ getValue }) => (
                <span className="font-mono font-bold text-white">{fmt(getValue())}</span>
            ),
        },
        {
            accessorKey: 'order_date', header: 'Order Date', size: 110,
            filterFn: dateOperatorFilterFn,
            cell: ({ getValue }) => <div className="text-center"><span className="text-gray-500 text-xs">{fmtDate(getValue())}</span></div>,
        },
        {
            accessorKey: 'delivery_date', header: 'Delivery', size: 110,
            filterFn: dateOperatorFilterFn,
            cell: ({ getValue }) => <div className="text-center">{getValue()
                ? <span className="text-orange-300 text-xs">{fmtDate(getValue())}</span>
                : <span className="text-gray-700 text-xs">—</span>}</div>,
        },
        {
            id: 'actions', header: 'Actions', size: 120,
            enableSorting: false, enableColumnFilter: false,
            cell: ({ row }) => {
                const o = row.original;
                return (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={e => { e.stopPropagation(); window.open(`/dashboard/sales-orders/${o.id}`, '_blank'); }}
                            title="View / Print"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                            <FiPrinter size={14} />
                        </button>
                        <button onClick={e => handleGenerateTasks(e, o)}
                            title={o.task_count ? "Regenerate Tasks" : "Generate Tasks"}
                            className={`p-1.5 rounded-lg transition-colors ${o.task_count ? 'text-gray-400 hover:text-blue-400 hover:bg-white/10' : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 animate-pulse'}`}>
                            {o.task_count ? <FiRefreshCw size={14} /> : <FiCpu size={14} />}
                        </button>
                        <button onClick={e => handleDelete(e, o.id)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <FiTrash2 size={14} />
                        </button>
                    </div>
                );
            },
        },
    ], [currency, handleGenerateTasks]);

    /* ── Table instance ─────────────────────────────────────────────────── */
    const table = useReactTable({
        data: durationFilteredData, columns,
        state: { globalFilter, columnVisibility, columnFilters },
        onGlobalFilterChange: setGlobal,
        onColumnVisibilityChange: setColVis,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    });

    const { pageIndex, pageSize } = table.getState().pagination;
    const pageCount = table.getPageCount();

    /* Dynamic stats calculated directly from active filtered table rows */
    const filteredRows = table.getFilteredRowModel().rows;
    const filteredStats = useMemo(() => {
        let pCount = 0;
        let prodCount = 0;
        let pTotal = 0;
        let totalVal = 0;

        for (const row of filteredRows) {
            const o = row.original;
            const amt = Number(o.total_amount || 0);
            totalVal += amt;
            if (o.status === 'Pending') {
                pCount++;
                pTotal += amt;
            } else if (o.status === 'In Production') {
                prodCount++;
            }
        }
        return {
            total_count: filteredRows.length,
            pending_count: pCount,
            production_count: prodCount,
            pending_total: pTotal,
            total_value: totalVal,
        };
    }, [filteredRows]);

    return (
        <div className="text-white">
            {/* ── Header ────────────────────────────────────────────────── */}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Sales Orders</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {table.getFilteredRowModel().rows.length} of {data.length} orders
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input value={globalFilter} onChange={e => setGlobal(e.target.value)}
                            placeholder="Search all columns…"
                            className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm w-64 outline-none focus:border-white/30 placeholder-gray-600" />
                    </div>
                    <ColumnToggle table={table} />
                    <button onClick={exportToPDF}
                        disabled={exportingPdf}
                        className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-white/20 hover:text-white transition-colors disabled:opacity-50">
                        <FiDownload className="w-4 h-4" /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
                    </button>
                </div>
            </header>

            {/* Dynamic Stats for Filtered Data */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Matching Orders', value: `${filteredStats.total_count} Orders`, sub: 'Active Filtered Total', icon: FiFileText, color: 'text-gray-300' },
                    { label: 'Pending Orders', value: filteredStats.pending_count, sub: `${currency} ${filteredStats.pending_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, icon: FiClock, color: 'text-blue-400' },
                    { label: 'In Production', value: filteredStats.production_count, sub: 'Work in progress', icon: FiCheckCircle, color: 'text-emerald-400' },
                    { label: 'Filtered Total Value', value: `${currency} ${filteredStats.total_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, sub: 'Sum of visible orders', icon: FiDollarSign, color: 'text-indigo-400' },
                ].map(s => (
                    <div key={s.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 shadow-xl">
                        <div className={`p-3 rounded-xl bg-white/5 ${s.color}`}><s.icon className="w-5 h-5" /></div>
                        <div>
                            <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">{s.label}</div>
                            <div className="text-lg font-bold text-white">{s.value}</div>
                            <div className="text-[10px] text-gray-500">{s.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Category Tabs (Offset / Digital / Services) ─────────────── */}
            <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-3 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                        <FiLayers className="w-4 h-4 text-indigo-400" />
                        <span>Production Segment:</span>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        {CATEGORY_TABS.map(cat => {
                            const isActive = categoryFilter.toLowerCase() === cat.key.toLowerCase();
                            const countKey = cat.key.toLowerCase();
                            const count = categoryCounts[countKey] !== undefined ? categoryCounts[countKey] : categoryCounts.all;
                            const Icon = cat.icon;
                            return (
                                <button
                                    key={cat.key}
                                    onClick={() => setCategory(cat.key)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                        isActive
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-purple-600/30'
                                            : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{cat.label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                        isActive ? 'bg-white/20 text-white font-extrabold' : 'bg-white/10 text-gray-400'
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Time Duration Filter Bar ───────────────────────────────── */}
            <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                        <FiCalendar className="w-4 h-4 text-blue-400" />
                        <span>Time Duration:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 items-center">
                        {TIME_PRESETS.map(preset => (
                            <button key={preset} onClick={() => setDuration(preset)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${durationFilter === preset ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold' : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}>
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                {durationFilter === 'Custom Range' && (
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/10 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 font-medium">From:</span>
                            <input type="date" value={customStartDate} onChange={e => setCustomStart(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-white outline-none focus:border-blue-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 font-medium">To:</span>
                            <input type="date" value={customEndDate} onChange={e => setCustomEnd(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-white outline-none focus:border-blue-500" />
                        </div>
                        {(customStartDate || customEndDate) && (
                            <button onClick={() => { setCustomStart(''); setCustomEnd(''); }}
                                className="text-xs text-red-400 hover:text-red-300 underline ml-2">
                                Clear dates
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Status tabs ───────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-1 mb-4">
                {STATUS_TABS.map(s => (
                    <button key={s} onClick={() => setStatus(s)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${statusFilter === s ? 'bg-white text-black font-bold' : 'bg-black/30 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}>
                        {s}
                    </button>
                ))}
            </div>

            {/* ── Table ─────────────────────────────────────────────────── */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="py-24 text-center text-gray-500 animate-pulse">Loading sales orders…</div>
                ) : data.length === 0 ? (
                    <div className="py-24 text-center">
                        <FiFileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500">No sales orders found for selected filters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                {table.getHeaderGroups().map(hg => (
                                    <tr key={hg.id} className="border-b border-white/[0.06]">
                                        {hg.headers.map(h => (
                                            <th key={h.id} style={{ width: h.getSize() }}
                                                className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 bg-black/20 select-none">
                                                {h.column.getCanSort() ? (
                                                    <button onClick={h.column.getToggleSortingHandler()}
                                                        className="flex items-center gap-1 hover:text-white transition-colors">
                                                        {flexRender(h.column.columnDef.header, h.getContext())}
                                                        <SortIcon dir={h.column.getIsSorted()} />
                                                    </button>
                                                ) : flexRender(h.column.columnDef.header, h.getContext())}
                                                {h.column.getCanFilter() && <ColFilter column={h.column} />}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row, i) => (
                                    <tr key={row.id}
                                        onClick={() => router.push(`/dashboard/sales-orders/${row.original.id}`)}
                                        className={`border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.04] ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="px-4 py-3.5 align-middle">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Pagination ─────────────────────────────────────────── */}
                {!loading && data.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-black/20 flex-wrap gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Rows:</span>
                            <select value={pageSize} onChange={e => table.setPageSize(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-gray-300 outline-none">
                                {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <span className="text-xs text-gray-500">
                            Page <strong className="text-gray-300">{pageIndex + 1}</strong> of{' '}
                            <strong className="text-gray-300">{pageCount || 1}</strong>
                            {' · '}{table.getFilteredRowModel().rows.length} results
                        </span>
                        <div className="flex items-center gap-1">
                            <PagBtn onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><FiChevronsLeft className="w-3.5 h-3.5" /></PagBtn>
                            <PagBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><FiChevronLeft className="w-3.5 h-3.5" /></PagBtn>
                            {Array.from({ length: pageCount }, (_, i) => i)
                                .filter(i => Math.abs(i - pageIndex) <= 2)
                                .map(i => (
                                    <button key={i} onClick={() => table.setPageIndex(i)}
                                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${i === pageIndex ? 'bg-white text-black' : 'text-gray-400 hover:bg-white/10'}`}>
                                        {i + 1}
                                    </button>
                                ))}
                            <PagBtn onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><FiChevronRight className="w-3.5 h-3.5" /></PagBtn>
                            <PagBtn onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}><FiChevronsRight className="w-3.5 h-3.5" /></PagBtn>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
