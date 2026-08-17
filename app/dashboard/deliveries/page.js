'use client';

import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
} from '@tanstack/react-table';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { dateOperatorFilterFn } from '@/lib/dateFilter';
import toast from 'react-hot-toast';
import {
    FiSearch, FiTruck, FiClock, FiPackage, FiCheckCircle, 
    FiAlertTriangle, FiX, FiChevronDown, FiChevronUp, 
    FiRefreshCw, FiBookOpen, FiUser, FiDownload,
    FiChevronsLeft, FiChevronLeft, FiChevronRight, FiChevronsRight
} from 'react-icons/fi';

const STATUS_COLORS = {
    'Pending': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'Partially Delivered': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Delivered': 'bg-green-500/20 text-green-300 border-green-500/30',
};

function StatusBadge({ status }) {
    const cls = STATUS_COLORS[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${cls}`}>
            {status}
        </span>
    );
}

function SortIcon({ dir }) {
    if (!dir) return <span className="opacity-20 text-xs">⇅</span>;
    return dir === 'asc' ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />;
}

function ColFilter({ column }) {
    const val = column.getFilterValue() ?? '';
    const isDateCol = column.id === 'so_delivery_date';
    const placeholder = isDateCol
        ? "Date (>=2026-08-01, today)..."
        : "Filter…";

    return (
        <input
            value={val}
            onChange={e => column.setFilterValue(e.target.value)}
            placeholder={placeholder}
            onClick={e => e.stopPropagation()}
            className="w-full mt-1.5 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/30 font-normal normal-case"
        />
    );
}

function PagBtn({ children, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
            {children}
        </button>
    );
}

export default function DeliveriesPage() {
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('All');
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [syncLoading, setSyncLoading] = useState(false);

    // Modal & Form States
    const [dispatchModalDelivery, setDispatchModalDelivery] = useState(null);
    const [dispatchedQuantity, setDispatchedQuantity] = useState('');
    const [booksPerParcel, setBooksPerParcel] = useState(50);
    const [carrierName, setCarrierName] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);

    // Edit Address Modal States
    const [addressModalDelivery, setAddressModalDelivery] = useState(null);
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);

    // Expanded Accordion State
    const [expandedDeliveryId, setExpandedDeliveryId] = useState(null);

    // Fetch all deliveries
    const fetchDeliveries = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/deliveries');
            if (res.ok) {
                const data = await res.json();
                setDeliveries(data.deliveries || []);
            } else {
                toast.error('Failed to load delivery queue');
            }
        } catch (error) {
            console.error('Fetch deliveries error:', error);
            toast.error('An error occurred while loading deliveries');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDeliveries();
    }, [fetchDeliveries]);

    // Manual sync ready & in-production orders
    const handleSync = async () => {
        setSyncLoading(true);
        const loadToast = toast.loading('Scanning for ready & in-production sales orders...');
        try {
            const res = await fetch('/api/deliveries', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                toast.success(data.message || 'Delivery queue synced successfully', { id: loadToast });
                fetchDeliveries();
            } else {
                toast.error('Sync failed', { id: loadToast });
            }
        } catch (error) {
            console.error('Sync error:', error);
            toast.error('An error occurred during sync', { id: loadToast });
        } finally {
            setSyncLoading(false);
        }
    };

    // Open Dispatch Modal
    const openDispatchModal = (delivery) => {
        setDispatchModalDelivery(delivery);
        setDispatchedQuantity(delivery.total_quantity - delivery.delivered_quantity);
        setBooksPerParcel(delivery.books_per_parcel || 50);
        setCarrierName('');
        setTrackingNumber('');
        setNotes('');
    };

    // Handle Preview Download
    const handlePreviewDownload = () => {
        if (!dispatchModalDelivery) return;
        const qty = parseInt(dispatchedQuantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error('Dispatched quantity must be greater than 0 to preview');
            return;
        }
        const remaining = dispatchModalDelivery.total_quantity - dispatchModalDelivery.delivered_quantity;
        if (qty > remaining) {
            toast.error(`Dispatched quantity cannot exceed remaining balance of ${remaining} items`);
            return;
        }
        const url = `/api/deliveries/dispatches/preview/pdf?deliveryId=${dispatchModalDelivery.id}&dispatched_quantity=${qty}&books_per_parcel=${booksPerParcel}&carrier_name=${encodeURIComponent(carrierName)}&tracking_number=${encodeURIComponent(trackingNumber)}&notes=${encodeURIComponent(notes)}`;
        window.open(url, '_blank');
    };

    // Handle Dispatch Submission
    const handleLogDispatch = async (e) => {
        e.preventDefault();
        if (!dispatchModalDelivery) return;

        const qty = parseInt(dispatchedQuantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error('Dispatched quantity must be greater than 0');
            return;
        }

        const remaining = dispatchModalDelivery.total_quantity - dispatchModalDelivery.delivered_quantity;
        if (qty > remaining) {
            toast.error(`Dispatched quantity cannot exceed remaining balance of ${remaining} items`);
            return;
        }

        setIsSubmittingDispatch(true);
        try {
            const res = await fetch(`/api/deliveries/${dispatchModalDelivery.id}/dispatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dispatched_quantity: qty,
                    books_per_parcel: booksPerParcel,
                    carrier_name: carrierName,
                    tracking_number: trackingNumber,
                    notes
                })
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(
                    data.order_delivered 
                        ? 'Dispatch logged! Sales Order fully delivered.' 
                        : 'Dispatch shipment logged successfully'
                );
                setDispatchModalDelivery(null);
                fetchDeliveries();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to log dispatch');
            }
        } catch (error) {
            console.error('Log dispatch error:', error);
            toast.error('An error occurred while logging dispatch');
        } finally {
            setIsSubmittingDispatch(false);
        }
    };

    const openAddressModal = (delivery) => {
        setAddressModalDelivery(delivery);
        setDeliveryAddress(delivery.delivery_address || '');
    };

    const handleSaveAddress = async (e) => {
        e.preventDefault();
        if (!addressModalDelivery) return;

        setIsSubmittingAddress(true);
        try {
            const res = await fetch(`/api/deliveries/${addressModalDelivery.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delivery_address: deliveryAddress })
            });

            if (res.ok) {
                toast.success('Delivery address updated successfully');
                setAddressModalDelivery(null);
                fetchDeliveries();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to update delivery address');
            }
        } catch (error) {
            console.error('Update address error:', error);
            toast.error('An error occurred while updating delivery address');
        } finally {
            setIsSubmittingAddress(false);
        }
    };

    // Filter deliveries based on status tab selection
    const filteredDeliveries = useMemo(() => {
        return deliveries.filter(d => {
            if (statusFilter === 'All') return true;
            if (['Pending', 'Partially Delivered', 'Delivered'].includes(statusFilter)) {
                return d.status === statusFilter;
            }
            if (['In Production', 'Ready'].includes(statusFilter)) {
                return d.sales_order_status === statusFilter;
            }
            return true;
        });
    }, [deliveries, statusFilter]);

    // Status Tab counts
    const statusCounts = useMemo(() => {
        let pending = 0;
        let partial = 0;
        let delivered = 0;
        let inProd = 0;
        let ready = 0;

        deliveries.forEach(d => {
            if (d.status === 'Pending') pending++;
            else if (d.status === 'Partially Delivered') partial++;
            else if (d.status === 'Delivered') delivered++;

            if (d.sales_order_status === 'In Production') inProd++;
            else if (d.sales_order_status === 'Ready') ready++;
        });

        return {
            all: deliveries.length,
            pending,
            partial,
            delivered,
            inProd,
            ready,
        };
    }, [deliveries]);

    // Derived Statistics for Cards
    const stats = useMemo(() => {
        let pendingCount = 0;
        let partialCount = 0;
        let totalParcels = 0;

        deliveries.forEach(d => {
            if (d.status === 'Pending') pendingCount++;
            else if (d.status === 'Partially Delivered') partialCount++;

            if (d.dispatches && Array.isArray(d.dispatches)) {
                d.dispatches.forEach(disp => {
                    totalParcels += (disp.parcels_count || 0);
                });
            }
        });

        return { pendingCount, partialCount, totalParcels };
    }, [deliveries]);

    // Dynamic preview of parcels
    const previewParcels = useMemo(() => {
        const qty = parseInt(dispatchedQuantity) || 0;
        const per = parseInt(booksPerParcel) || 1;
        return Math.ceil(qty / per);
    }, [dispatchedQuantity, booksPerParcel]);

    // TanStack Table Columns
    const columns = useMemo(() => [
        {
            accessorKey: 'sales_order_code',
            id: 'sales_order_code',
            header: 'SO Code',
            size: 130,
            cell: ({ row }) => {
                const d = row.original;
                return (
                    <div className="flex flex-col gap-1.5 items-start">
                        <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/5 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                            {d.sales_order_code}
                        </span>
                        {d.sales_order_status && (
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                                d.sales_order_status === 'In Production'
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                    : d.sales_order_status === 'Ready'
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            }`}>
                                {d.sales_order_status}
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'customer_name',
            id: 'customer_name',
            header: 'Customer',
            cell: ({ row }) => {
                const d = row.original;
                return (
                    <div>
                        <div className="font-semibold text-white">
                            {d.customer_name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                            <span className="truncate max-w-[200px]" title={d.delivery_address || 'No custom address set (falls back to default customer address)'}>
                                {d.delivery_address || 'Default Customer Address'}
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); openAddressModal(d); }}
                                className="text-blue-400 hover:text-blue-300 font-bold hover:underline cursor-pointer"
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'estimation_name',
            id: 'estimation_name',
            header: 'Estimation Item',
            cell: ({ getValue }) => <span className="text-white/80">{getValue()}</span>
        },
        {
            accessorKey: 'so_delivery_date',
            id: 'so_delivery_date',
            header: 'Delivery Date',
            size: 130,
            filterFn: dateOperatorFilterFn,
            cell: ({ getValue }) => {
                const val = getValue();
                return (
                    <span className="text-xs text-orange-300">
                        {val ? new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </span>
                );
            }
        },
        {
            id: 'progress',
            header: 'Progress',
            size: 160,
            accessorFn: row => (row.total_quantity > 0 ? (row.delivered_quantity / row.total_quantity) * 100 : 0),
            cell: ({ row }) => {
                const d = row.original;
                const pct = d.total_quantity > 0 ? (d.delivered_quantity / d.total_quantity) * 100 : 0;
                return (
                    <div className="space-y-1 min-w-[140px]">
                        <div className="flex justify-between text-[11px] font-mono text-gray-400">
                            <span>{d.delivered_quantity.toLocaleString()} / {d.total_quantity.toLocaleString()}</span>
                            <span>{Math.round(pct)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'status',
            id: 'status',
            header: 'Status',
            size: 130,
            cell: ({ getValue }) => (
                <div className="text-center">
                    <StatusBadge status={getValue()} />
                </div>
            )
        },
        {
            id: 'actions',
            header: 'Actions',
            size: 150,
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => {
                const d = row.original;
                const isExpanded = expandedDeliveryId === d.id;
                return (
                    <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        {d.dispatches && d.dispatches.length > 0 && (
                            <button
                                onClick={() => setExpandedDeliveryId(isExpanded ? null : d.id)}
                                className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                            >
                                {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                                Log ({d.dispatches.length})
                            </button>
                        )}
                        {d.status !== 'Delivered' && (
                            <button
                                onClick={() => openDispatchModal(d)}
                                className="px-3 py-1.5 rounded-lg bg-white hover:opacity-90 text-black text-xs font-bold transition-all cursor-pointer"
                            >
                                Log Dispatch
                            </button>
                        )}
                    </div>
                );
            }
        }
    ], [expandedDeliveryId]);

    // TanStack Table Instance
    const table = useReactTable({
        data: filteredDeliveries,
        columns,
        state: { globalFilter, columnVisibility, columnFilters },
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    });

    const { pageIndex, pageSize } = table.getState().pagination;
    const pageCount = table.getPageCount();

    return (
        <div className="text-white space-y-6">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Deliveries & Dispatch</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        Manage parcels, partial dispatches, and carrier tracking for ready &amp; in-production orders.
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search all columns..."
                            value={globalFilter}
                            onChange={e => setGlobalFilter(e.target.value)}
                            className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm w-60 outline-none focus:border-white/30 placeholder-gray-600"
                        />
                    </div>
                    <ColumnToggle table={table} />
                    <button
                        onClick={handleSync}
                        disabled={syncLoading}
                        className="flex items-center gap-2 bg-white text-black font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
                        Sync Orders Queue
                    </button>
                </div>
            </header>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Pending Deliveries', value: stats.pendingCount, icon: FiClock, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
                    { label: 'Partially Dispatched', value: stats.partialCount, icon: FiTruck, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                    { label: 'Total Parcels Dispatched', value: stats.totalParcels, icon: FiPackage, color: 'text-green-400 bg-green-500/10 border-green-500/20' }
                ].map(s => (
                    <div key={s.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
                        <div className={`p-3 rounded-xl border ${s.color}`}><s.icon className="w-5 h-5" /></div>
                        <div>
                            <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
                            <div className="text-2xl font-bold">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
                {[
                    { key: 'All', label: 'All Items', count: statusCounts.all },
                    { key: 'Pending', label: 'Pending Delivery', count: statusCounts.pending },
                    { key: 'Partially Delivered', label: 'Partially Delivered', count: statusCounts.partial },
                    { key: 'Delivered', label: 'Fully Delivered', count: statusCounts.delivered },
                    { key: 'In Production', label: 'In Production Jobs', count: statusCounts.inProd },
                    { key: 'Ready', label: 'Ready Jobs', count: statusCounts.ready }
                ].map(tab => {
                    const isActive = statusFilter === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setStatusFilter(tab.key)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                                isActive
                                    ? 'bg-white text-black border-white shadow-lg'
                                    : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                isActive ? 'bg-black/20 text-black font-extrabold' : 'bg-white/10 text-gray-400'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Queue Table */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                {loading ? (
                    <div className="py-20 text-center text-gray-500 flex items-center justify-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
                        Loading delivery queue...
                    </div>
                ) : filteredDeliveries.length === 0 ? (
                    <div className="py-24 text-center">
                        <FiTruck className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500">No delivery items found for the selected filter</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                {table.getHeaderGroups().map(hg => (
                                    <tr key={hg.id} className="border-b border-white/[0.06] bg-black/20 text-xs font-bold uppercase tracking-widest text-gray-500">
                                        {hg.headers.map(h => (
                                            <th key={h.id} style={{ width: h.getSize() }} className="px-5 py-4 text-left select-none">
                                                {h.column.getCanSort() ? (
                                                    <button
                                                        onClick={h.column.getToggleSortingHandler()}
                                                        className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                                                    >
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
                                {table.getRowModel().rows.map(row => {
                                    const d = row.original;
                                    const isExpanded = expandedDeliveryId === d.id;

                                    return (
                                        <Fragment key={row.id}>
                                            <tr
                                                className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                                                    isExpanded ? 'bg-white/[0.02]' : ''
                                                }`}
                                            >
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="px-5 py-4 align-middle">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>

                                            {/* Historic Dispatch Logs Expanded Row */}
                                            {isExpanded && d.dispatches && d.dispatches.length > 0 && (
                                                <tr className="bg-black/30 border-b border-white/[0.04]">
                                                    <td colSpan={columns.length} className="px-8 py-4">
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                                                <FiBookOpen className="text-emerald-400" />
                                                                Dispatch Shipments for {d.estimation_name}
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                {d.dispatches.map(disp => (
                                                                    <div key={disp.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2">
                                                                        <div className="flex justify-between items-start gap-4">
                                                                            <div>
                                                                                <span className="font-bold text-emerald-400 block text-xs">{disp.dispatched_quantity.toLocaleString()} Books shipped</span>
                                                                                <span className="text-gray-500 text-[10px]">{new Date(disp.dispatched_at).toLocaleString()}</span>
                                                                            </div>
                                                                            <a
                                                                                href={`/api/deliveries/dispatches/${disp.id}/pdf`}
                                                                                download
                                                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-[10px] font-bold transition-all shrink-0"
                                                                            >
                                                                                <FiDownload className="w-3.5 h-3.5" />
                                                                                Delivery Note
                                                                            </a>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                                                                            <div>
                                                                                <span className="text-gray-600 block text-[9px] uppercase font-bold">Parcels Created</span>
                                                                                <span className="text-white font-mono">{disp.parcels_count} parcels</span>
                                                                            </div>
                                                                            {disp.carrier_name && (
                                                                                <div>
                                                                                    <span className="text-gray-600 block text-[9px] uppercase font-bold">Carrier / Driver</span>
                                                                                    <span className="text-white truncate block">{disp.carrier_name}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {disp.tracking_number && (
                                                                            <div className="text-xs text-gray-400 border-t border-white/5 pt-1.5">
                                                                                <span className="text-gray-600 block text-[9px] uppercase font-bold">Waybill / Tracking</span>
                                                                                <span className="text-blue-400 font-mono select-all">{disp.tracking_number}</span>
                                                                            </div>
                                                                        )}
                                                                        {disp.notes && (
                                                                            <div className="text-xs text-gray-400 border-t border-white/5 pt-1.5">
                                                                                <span className="text-gray-600 block text-[9px] uppercase font-bold">Notes</span>
                                                                                <p className="text-gray-300 italic">{disp.notes}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {!loading && filteredDeliveries.length > 0 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06] bg-black/20 flex-wrap gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={e => table.setPageSize(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-300 outline-none"
                            >
                                {[10, 15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <span className="text-xs text-gray-500">
                            Page <strong className="text-gray-300">{pageIndex + 1}</strong> of{' '}
                            <strong className="text-gray-300">{pageCount || 1}</strong>
                            {' · '}{table.getFilteredRowModel().rows.length} total items
                        </span>
                        <div className="flex items-center gap-1">
                            <PagBtn onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                                <FiChevronsLeft className="w-3.5 h-3.5" />
                            </PagBtn>
                            <PagBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                                <FiChevronLeft className="w-3.5 h-3.5" />
                            </PagBtn>
                            {Array.from({ length: pageCount }, (_, i) => i)
                                .filter(i => Math.abs(i - pageIndex) <= 2)
                                .map(i => (
                                    <button
                                        key={i}
                                        onClick={() => table.setPageIndex(i)}
                                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                            i === pageIndex ? 'bg-white text-black font-bold' : 'text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            <PagBtn onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                                <FiChevronRight className="w-3.5 h-3.5" />
                            </PagBtn>
                            <PagBtn onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}>
                                <FiChevronsRight className="w-3.5 h-3.5" />
                            </PagBtn>
                        </div>
                    </div>
                )}
            </div>

            {/* Log Dispatch Modal */}
            {dispatchModalDelivery && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                    <FiTruck className="w-4 h-4 text-white/60" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white text-sm">Log Dispatch Shipment</h3>
                                    <p className="text-xs text-white/30">{dispatchModalDelivery.sales_order_code} · {dispatchModalDelivery.customer_name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDispatchModalDelivery(null)}
                                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white transition-colors cursor-pointer"
                            >
                                <FiX />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleLogDispatch} className="p-6 space-y-4 flex-1">
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Estimation Item</label>
                                <div className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-medium select-none">
                                    {dispatchModalDelivery.estimation_name}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">
                                        Qty to Dispatch (Max {dispatchModalDelivery.total_quantity - dispatchModalDelivery.delivered_quantity})
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max={dispatchModalDelivery.total_quantity - dispatchModalDelivery.delivered_quantity}
                                        value={dispatchedQuantity}
                                        onChange={e => setDispatchedQuantity(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Books per Parcel</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={booksPerParcel}
                                        onChange={e => setBooksPerParcel(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                            </div>

                            {/* Parcels Preview Banner */}
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
                                <FiPackage className="w-5 h-5 text-emerald-400 shrink-0" />
                                <div className="text-xs">
                                    <span className="font-bold text-white">Parcel Calculation:</span> This shipment will consist of{' '}
                                    <span className="font-bold text-emerald-400 font-mono text-sm">{previewParcels}</span> parcels{' '}
                                    <span className="text-white/40">({dispatchedQuantity} books / {booksPerParcel} books per box).</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Carrier / Driver Name</label>
                                    <input
                                        type="text"
                                        value={carrierName}
                                        onChange={e => setCarrierName(e.target.value)}
                                        placeholder="e.g. Acme Logistics, John"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Waybill / Tracking No.</label>
                                    <input
                                        type="text"
                                        value={trackingNumber}
                                        onChange={e => setTrackingNumber(e.target.value)}
                                        placeholder="e.g. TRK984024"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Shipment Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="e.g. Box 1-4 loaded, remaining tomorrow."
                                    rows={3}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30 resize-none"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={() => setDispatchModalDelivery(null)}
                                    className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs text-white/70 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePreviewDownload}
                                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <FiDownload className="w-3.5 h-3.5" />
                                    Download Preview
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingDispatch}
                                    className="px-5 py-2 bg-white text-black font-bold rounded-xl text-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmittingDispatch ? 'Saving...' : 'Submit Shipment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Address Modal */}
            {addressModalDelivery && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-[#0a0a0a] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                    <FiTruck className="w-4 h-4 text-white/60" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white text-sm">Edit Delivery Address</h3>
                                    <p className="text-xs text-white/30">{addressModalDelivery.sales_order_code} · {addressModalDelivery.customer_name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setAddressModalDelivery(null)}
                                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white transition-colors cursor-pointer"
                            >
                                <FiX />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSaveAddress} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Delivery Address</label>
                                <textarea
                                    value={deliveryAddress}
                                    onChange={e => setDeliveryAddress(e.target.value)}
                                    placeholder="Enter custom delivery address for this job..."
                                    rows={4}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30 resize-none font-sans"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">
                                    If left blank, this will fall back to the customer's default address.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={() => setAddressModalDelivery(null)}
                                    className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs text-white/70 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingAddress}
                                    className="px-5 py-2 bg-white text-black font-bold rounded-xl text-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmittingAddress ? 'Saving...' : 'Save Address'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

