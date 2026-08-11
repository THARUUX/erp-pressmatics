'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import {
    FiSearch, FiChevronUp, FiChevronDown, FiChevronLeft, FiChevronRight,
    FiEye, FiTrash2, FiPlusCircle, FiPlus, FiX, FiUser, FiClock, FiFileText, FiLayers
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const SO_STATUS = {
    Pending: { class: 'bg-amber-500/10 text-amber-300 border-amber-500/20 font-medium', label: 'Pending' },
    'In Production': { class: 'bg-blue-500/10 text-blue-300 border-blue-500/20 font-semibold', label: 'In Production' },
    Ready: { class: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 font-bold', label: 'Ready' },
    Delivered: { class: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 font-bold', label: 'Delivered' },
    Cancelled: { class: 'bg-rose-500/10 text-rose-300 border-rose-500/20', label: 'Cancelled' },
};

const STATUS_TABS = ['All', 'Pending', 'In Production', 'Ready', 'Delivered', 'Cancelled'];

function StatusSelect({ soId, current, onUpdated }) {
    const [updating, setUpdating] = useState(false);
    const handle = async (e) => {
        const newStatus = e.target.value;
        setUpdating(true);
        try {
            const res = await fetch(`/api/sales-orders/${soId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) { onUpdated(soId, newStatus); toast.success('Status updated'); }
            else toast.error('Failed to update status');
        } catch { toast.error('Error'); }
        finally { setUpdating(false); }
    };
    return (
        <select value={current} onChange={handle} disabled={updating}
            className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer disabled:opacity-50 font-medium">
            {Object.keys(SO_STATUS).map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
        </select>
    );
}

export default function PortalSalesOrdersPage({ params }) {
    const { id } = use(params);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([{ id: 'created_at', desc: true }]);
    const [statusTab, setStatusTab] = useState('All');
    const [deleteConfirmSO, setDeleteConfirmSO] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Modal state for Add Sample Order
    const [showSampleModal, setShowSampleModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customerList, setCustomerList] = useState([]);
    const [employeeList, setEmployeeList] = useState([]);
    const [customerMode, setCustomerMode] = useState('select'); // 'select' | 'custom'
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [jobNotes, setJobNotes] = useState('');
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [sampleTasks, setSampleTasks] = useState([
        { name: 'Sample Service Task', description: 'Initial sample execution', assigned_to: '', estimated_minutes: '30', quantity: '1' }
    ]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/services/${id}/sales-orders`);
            const d = await res.json();
            const all = Array.isArray(d.salesOrders) ? d.salesOrders : (Array.isArray(d.orders) ? d.orders : (Array.isArray(d) ? d : []));
            setOrders(all);
        } finally { setLoading(false); }
    }, [id]);

    // Fetch customers and employees for Sample Order modal
    useEffect(() => {
        load();

        fetch('/api/customers')
            .then(r => r.json())
            .then(d => { if (Array.isArray(d)) setCustomerList(d); })
            .catch(() => { });

        fetch('/api/employees')
            .then(r => r.json())
            .then(d => { if (Array.isArray(d)) setEmployeeList(d.filter(e => e.status === 'active')); })
            .catch(() => { });
    }, [load]);

    const handleStatusUpdate = useCallback((soId, newStatus) => {
        setOrders(prev => prev.map(o => o.id === soId ? { ...o, status: newStatus } : o));
    }, []);

    const handleDelete = useCallback((so) => {
        setDeleteConfirmSO(so);
    }, []);

    const confirmDelete = async () => {
        if (!deleteConfirmSO) return;
        const so = deleteConfirmSO;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/services/${id}/sales-orders`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ soId: so.id }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Deleted ${so.code || '#' + so.id}`);
                setOrders(prev => prev.filter(o => o.id !== so.id));
                setDeleteConfirmSO(null);
            } else {
                toast.error(data.error || 'Failed to delete sales order');
            }
        } catch {
            toast.error('Error deleting sales order');
        } finally {
            setIsDeleting(false);
        }
    };

    // Task Row Handlers for Sample Order Modal
    const addTaskRow = () => {
        setSampleTasks(prev => [
            ...prev,
            { name: '', description: '', assigned_to: '', estimated_minutes: '30', quantity: '1' }
        ]);
    };

    const removeTaskRow = (index) => {
        if (sampleTasks.length === 1) {
            toast.error('At least one task is required for a sales order.');
            return;
        }
        setSampleTasks(prev => prev.filter((_, i) => i !== index));
    };

    const updateTaskRow = (index, field, value) => {
        setSampleTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
    };

    const handleCreateSampleOrder = async (e) => {
        e.preventDefault();

        let finalCustName = customerName.trim();
        let finalCustId = null;

        if (customerMode === 'select') {
            const selectedCust = customerList.find(c => String(c.id) === String(selectedCustomerId));
            if (selectedCust) {
                finalCustName = selectedCust.name;
                finalCustId = selectedCust.id;
            }
        }

        if (!finalCustName) {
            finalCustName = 'Sample Customer';
        }

        setIsSubmitting(true);
        try {
            const payload = {
                customer_name: finalCustName,
                customer_id: finalCustId,
                delivery_date: deliveryDate || null,
                total_amount: parseFloat(totalAmount) || 0,
                job_notes: jobNotes || 'Sample Service Order',
                tasks: sampleTasks.filter(t => t.name.trim() !== '')
            };

            const res = await fetch(`/api/services/${id}/sales-orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`Sample Sales Order ${data.code} created with ${sampleTasks.length} task(s)!`);
                setShowSampleModal(false);
                // Reset form
                setCustomerName('');
                setSelectedCustomerId('');
                setCustomerSearchQuery('');
                setIsCustomerDropdownOpen(false);
                setDeliveryDate('');
                setTotalAmount('');
                setJobNotes('');
                setSampleTasks([
                    { name: 'Sample Service Task', description: 'Initial sample execution', assigned_to: '', estimated_minutes: '30', quantity: '1' }
                ]);
                load();
            } else {
                toast.error(data.error || 'Failed to create sample order');
            }
        } catch {
            toast.error('Error creating sample order');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filtered = useMemo(() => {
        if (statusTab === 'All') return orders;
        return orders.filter(o => o.status === statusTab);
    }, [orders, statusTab]);

    const filteredCustomers = useMemo(() => {
        if (!customerSearchQuery.trim()) return customerList;
        const q = customerSearchQuery.toLowerCase();
        return customerList.filter(c =>
            c.name?.toLowerCase().includes(q) ||
            (c.code && c.code.toLowerCase().includes(q)) ||
            (c.phone && c.phone.toLowerCase().includes(q))
        );
    }, [customerList, customerSearchQuery]);

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at',
            header: 'Date',
            cell: ({ getValue }) => <span className="text-xs text-zinc-400">{new Date(getValue()).toLocaleDateString()}</span>,
        },
        {
            accessorKey: 'code',
            header: 'SO Code',
            cell: ({ getValue, row }) => (
                <Link
                    href={`/services/${id}/portal/sales-orders/${row.original.id}`}
                    className="font-mono text-xs font-bold text-indigo-400 hover:underline"
                >
                    {getValue()}
                </Link>
            ),
        },
        {
            accessorKey: 'customer_name',
            header: 'Customer',
            cell: ({ getValue }) => <span className="font-semibold text-white">{getValue()}</span>,
        },
        {
            accessorKey: 'delivery_date',
            header: 'Delivery',
            cell: ({ getValue }) => getValue()
                ? <span className="text-xs text-zinc-400">{new Date(getValue()).toLocaleDateString()}</span>
                : <span className="text-xs text-zinc-500">—</span>,
        },
        {
            accessorKey: 'total_amount',
            header: 'Amount',
            cell: ({ getValue }) => (
                <span className="font-mono font-bold text-white text-sm">
                    LKR {Number(getValue() || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ getValue, row }) => (
                <StatusSelect soId={row.original.id} current={getValue()} onUpdated={handleStatusUpdate} />
            ),
        },
        {
            id: 'actions',
            header: 'Actions',
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Link
                        href={`/services/${id}/portal/sales-orders/${row.original.id}`}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors inline-flex"
                        title="View Sales Order Details"
                    >
                        <FiEye size={13} />
                    </Link>
                    <button
                        onClick={() => handleDelete(row.original)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-colors inline-flex cursor-pointer"
                        title="Delete Sales Order"
                    >
                        <FiTrash2 size={13} />
                    </button>
                </div>
            ),
        },
    ], [id, handleStatusUpdate, handleDelete]);

    const table = useReactTable({
        data: filtered,
        columns,
        state: { globalFilter, sorting },
        onGlobalFilterChange: setGlobalFilter,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    const stats = useMemo(() => ({
        total: orders.length,
        active: orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status)).length,
        delivered: orders.filter(o => o.status === 'Delivered').length,
        value: orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0),
    }), [orders]);

    return (
        <div className="p-8 space-y-6 bg-[#09090b] text-zinc-100 min-h-screen">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        Sales Orders
                    </h1>
                    <p className="text-zinc-400 text-sm mt-0.5">All service-linked sales orders</p>
                </div>
                <button
                    onClick={() => setShowSampleModal(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-md text-xs font-bold shadow-lg shadow-purple-900/20 transition-all cursor-pointer border border-purple-500/30"
                >
                    <FiPlusCircle size={16} /> Add Sample Order
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Orders', value: stats.total, color: 'text-white' },
                    { label: 'Active', value: stats.active, color: 'text-zinc-200' },
                    { label: 'Delivered', value: stats.delivered, color: 'text-zinc-300' },
                    { label: 'Total Value', value: `LKR ${stats.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-white' },
                ].map(s => (
                    <div key={s.label} className="bg-[#0e0e11] border border-zinc-800/80 rounded-2xl px-5 py-4">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Status Tabs + Search */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-1 bg-[#0e0e11] border border-zinc-800/80 rounded-md p-1">
                    {STATUS_TABS.map(t => (
                        <button key={t} onClick={() => setStatusTab(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                                ${statusTab === t ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}>
                            {t}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                    <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
                        placeholder="Search…"
                        className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-700/80 rounded-md text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#0e0e11] border border-zinc-800/80 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" /></div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-zinc-800/80 bg-zinc-900/40">
                            {table.getHeaderGroups().map(hg => (
                                <tr key={hg.id}>
                                    {hg.headers.map(h => (
                                        <th key={h.id}
                                            className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-400 select-none"
                                            onClick={h.column.getToggleSortingHandler()}
                                            style={{ cursor: h.column.getCanSort() ? 'pointer' : 'default' }}>
                                            <div className="flex items-center gap-1">
                                                {flexRender(h.column.columnDef.header, h.getContext())}
                                                {h.column.getIsSorted() === 'asc' && <FiChevronUp size={11} className="text-white" />}
                                                {h.column.getIsSorted() === 'desc' && <FiChevronDown size={11} className="text-white" />}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                            {table.getRowModel().rows.length === 0 ? (
                                <tr><td colSpan={7} className="py-16 text-center text-zinc-500 text-xs">
                                    {statusTab !== 'All' ? `No ${statusTab} orders` : 'No sales orders yet'}
                                </td></tr>
                            ) : table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="hover:bg-zinc-800/40 transition-colors">
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-4 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
                <div className="flex gap-2">
                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-30 cursor-pointer"><FiChevronLeft size={14} /></button>
                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-30 cursor-pointer"><FiChevronRight size={14} /></button>
                </div>
            </div>

            {/* Create Sample Order Modal */}
            {showSampleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
                    <div className="bg-[#0e0e11] border border-purple-500/30 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8 text-zinc-100 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-500/10 rounded-md border border-purple-500/20 text-purple-400">
                                    <FiPlusCircle size={22} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Create Sample Sales Order</h2>
                                    <p className="text-xs text-zinc-400">Direct sales order &amp; shop-floor tasks (no quotation required)</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSampleModal(false)}
                                className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSampleOrder} className="space-y-5">
                            {/* Customer Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                                        <FiUser className="text-purple-400" /> Customer Information
                                    </label>
                                    <div className="flex bg-zinc-800 p-0.5 rounded-md border border-zinc-700 text-[11px]">
                                        <button
                                            type="button"
                                            onClick={() => setCustomerMode('select')}
                                            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${customerMode === 'select' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                                        >
                                            Existing Customer
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCustomerMode('custom')}
                                            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${customerMode === 'custom' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                                        >
                                            Custom Name
                                        </button>
                                    </div>
                                </div>

                                {customerMode === 'select' ? (
                                    <div className="relative">
                                        <div className="relative">
                                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5" />
                                            <input
                                                type="text"
                                                value={customerSearchQuery}
                                                onFocus={() => setIsCustomerDropdownOpen(true)}
                                                onBlur={() => {
                                                    setTimeout(() => setIsCustomerDropdownOpen(false), 200);
                                                }}
                                                onChange={e => {
                                                    setCustomerSearchQuery(e.target.value);
                                                    setIsCustomerDropdownOpen(true);
                                                }}
                                                placeholder="Type to search/filter customer by name, code or phone..."
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-md pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                            />
                                            {customerSearchQuery && (
                                                <button
                                                    type="button"
                                                    onMouseDown={e => e.preventDefault()}
                                                    onClick={() => {
                                                        setCustomerSearchQuery('');
                                                        setSelectedCustomerId('');
                                                        setCustomerName('');
                                                        setIsCustomerDropdownOpen(false);
                                                    }}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
                                                >
                                                    <FiX size={13} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Search Results Dropdown List */}
                                        {isCustomerDropdownOpen && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-zinc-900 border border-zinc-700/90 rounded-md max-h-52 overflow-y-auto z-50 shadow-2xl divide-y divide-zinc-800/80">
                                                {filteredCustomers.length === 0 ? (
                                                    <div className="p-3 text-center text-xs text-zinc-500">No matching customers found</div>
                                                ) : (
                                                    filteredCustomers.map(c => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onMouseDown={e => e.preventDefault()}
                                                            onClick={() => {
                                                                setSelectedCustomerId(c.id);
                                                                setCustomerName(c.name);
                                                                setCustomerSearchQuery(`${c.name} (${c.code || 'CUST'})`);
                                                                setIsCustomerDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center justify-between cursor-pointer ${String(selectedCustomerId) === String(c.id)
                                                                ? 'bg-purple-600/30 text-white font-bold'
                                                                : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                                                                }`}
                                                        >
                                                            <div>
                                                                <span className="font-semibold text-white">{c.name}</span>
                                                                {c.phone && <span className="text-[10px] text-zinc-500 block">{c.phone}</span>}
                                                            </div>
                                                            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                                                {c.code || 'CUST'}
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        placeholder="Enter customer or client name (e.g. Sample Client A)"
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                    />
                                )}
                            </div>

                            {/* Order Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-zinc-300 block mb-1">Total Amount (LKR)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={totalAmount}
                                        onChange={e => setTotalAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-zinc-300 block mb-1">Delivery Date (Optional)</label>
                                    <input
                                        type="date"
                                        value={deliveryDate}
                                        onChange={e => setDeliveryDate(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Job Notes */}
                            <div>
                                <label className="text-xs font-semibold text-zinc-300 block mb-1 flex items-center gap-1.5">
                                    <FiFileText className="text-purple-400" /> Job Notes / Instructions
                                </label>
                                <textarea
                                    rows={2}
                                    value={jobNotes}
                                    onChange={e => setJobNotes(e.target.value)}
                                    placeholder="Add any sample job specifications or floor instructions…"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            {/* Tasks Definition Section */}
                            <div className="space-y-3 pt-2 border-t border-zinc-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <FiLayers className="text-indigo-400" /> Tasks Execution List
                                        </h3>
                                        <p className="text-[11px] text-zinc-400">Define tasks to be generated directly for shop-floor processing</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addTaskRow}
                                        className="flex items-center gap-1 text-[11px] font-bold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1 rounded-lg border border-purple-500/20 transition-all cursor-pointer"
                                    >
                                        <FiPlus size={13} /> Add Task
                                    </button>
                                </div>

                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {sampleTasks.map((t, idx) => (
                                        <div key={idx} className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-md space-y-2 relative group">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                                                    #{idx + 1}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={t.name}
                                                    onChange={e => updateTaskRow(idx, 'name', e.target.value)}
                                                    placeholder="Task Name (e.g. Sample Proof, Digital Print, Stitching)"
                                                    className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeTaskRow(idx)}
                                                    className="text-zinc-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                                                    title="Remove Task"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 block mb-0.5">Assigned Employee</label>
                                                    <select
                                                        value={t.assigned_to}
                                                        onChange={e => updateTaskRow(idx, 'assigned_to', e.target.value)}
                                                        className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {employeeList.map(emp => (
                                                            <option key={emp.id} value={emp.name}>{emp.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 block mb-0.5 flex items-center gap-1">
                                                        <FiClock size={10} /> Est. Minutes
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={t.estimated_minutes}
                                                        onChange={e => updateTaskRow(idx, 'estimated_minutes', e.target.value)}
                                                        placeholder="e.g. 30"
                                                        className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-zinc-400 block mb-0.5">Run Quantity</label>
                                                    <input
                                                        type="number"
                                                        value={t.quantity}
                                                        onChange={e => updateTaskRow(idx, 'quantity', e.target.value)}
                                                        placeholder="1"
                                                        className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setShowSampleModal(false)}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-md text-xs font-bold shadow-lg shadow-purple-950/40 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? 'Creating Order…' : 'Create Sample Sales Order'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Custom Modal Confirmation for Delete */}
            {deleteConfirmSO && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
                    <div className="bg-[#0e0e11] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-400">
                            <div className="p-3 bg-rose-500/10 rounded-md border border-rose-500/20">
                                <FiTrash2 size={22} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Delete Sales Order</h3>
                                <p className="text-xs text-zinc-400 font-mono mt-0.5">{deleteConfirmSO.code || `#${deleteConfirmSO.id}`}</p>
                            </div>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-4 rounded-md border border-zinc-800/80">
                            Are you sure you want to delete <strong className="text-white">{deleteConfirmSO.code || `#${deleteConfirmSO.id}`}</strong>?
                            <br /><br />
                            <span className="text-rose-400 font-semibold">Warning:</span> This will permanently remove the Sales Order and all linked job tasks and work logs. This action cannot be undone.
                        </p>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmSO(null)}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-md text-xs font-bold text-white shadow-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                            >
                                {isDeleting ? 'Deleting…' : 'Yes, Delete Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
