'use client';
import toast from 'react-hot-toast';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    FiSave, FiArrowLeft, FiPlus, FiCheck, FiSearch,
    FiChevronUp, FiChevronDown, FiChevronsLeft,
    FiChevronLeft, FiChevronRight, FiChevronsRight
} from 'react-icons/fi';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
} from '@tanstack/react-table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { useSettings } from '@/components/SettingsContext';

/* ── Sort icon ────────────────────────────────────────────────────────────── */
function SortIcon({ dir }) {
    if (!dir) return <span className="opacity-20 text-xs ml-1">⇅</span>;
    return dir === 'asc' ? <FiChevronUp className="w-3 h-3 ml-1" /> : <FiChevronDown className="w-3 h-3 ml-1" />;
}

/* ── Column filter input ──────────────────────────────────────────────────── */
function ColumnFilter({ column }) {
    const val = column.getFilterValue() ?? '';
    return (
        <input
            value={val}
            onClick={e => e.stopPropagation()} // Prevent toggling selection or sorting on input click
            onChange={e => column.setFilterValue(e.target.value)}
            placeholder="Filter…"
            className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/30"
        />
    );
}

/* ── Pagination Button ────────────────────────────────────────────────────── */
function PagBtn({ children, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
            {children}
        </button>
    );
}

export default function NewQuotationContainerPage() {
    const { settings } = useSettings();
    const currency = settings.currency || '$';
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Header Data
    const [customerName, setCustomerName] = useState('');
    const [customerId, setCustomerId] = useState(null); // Selected Customer ID

    // Autocomplete Data
    const [customers, setCustomers] = useState([]);
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

    // Items Selection
    const [availableItems, setAvailableItems] = useState([]);
    const [selectedItemIds, setSelectedItemIds] = useState([]);

    // TanStack Table State
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState([]);
    const [sorting, setSorting] = useState([]);

    useEffect(() => {
        // Fetch Customers
        fetch('/api/customers')
            .then(res => res.json())
            .then(d => setCustomers(Array.isArray(d) ? d : []))
            .catch(console.error);

        // Initial Fetch of Items (fetch more than default limit so sorting/filtering works well)
        fetchItems();
    }, []);

    useEffect(() => {
        // Refetch items when customerId changes
        fetchItems(customerId);
    }, [customerId]);

    const fetchItems = (cId = null) => {
        let url = '/api/items';
        if (cId) url += `?customer_id=${cId}`;
        // Fetch more items for high-fidelity client-side pagination/filtering
        url += (cId ? '&' : '?') + 'limit=500';

        fetch(url)
            .then(res => res.json())
            .then(data => {
                // API returns { items: [], pagination: {} }
                if (data.items && Array.isArray(data.items)) {
                    setAvailableItems(data.items);
                } else if (Array.isArray(data)) {
                    // Fallback in case API changes back to array
                    setAvailableItems(data);
                } else {
                    console.error("Expected array or { items: [] } from /api/items, got:", data);
                    setAvailableItems([]);
                }
            })
            .catch(err => {
                console.error(err);
                setAvailableItems([]);
            });
    };

    const toggleItem = (id) => {
        const item = availableItems.find(i => i.id === id);
        if (!item) return;

        if (selectedItemIds.includes(id)) {
            setSelectedItemIds(prev => prev.filter(itemId => itemId !== id));
        } else {
            setSelectedItemIds(prev => [...prev, id]);
            // Automatically detect customer name & ID if not already selected
            if (!customerId && !customerName) {
                if (item.customer_id) {
                    setCustomerId(item.customer_id);
                    const matchingCustomer = customers.find(c => c.id === item.customer_id);
                    if (matchingCustomer) {
                        setCustomerName(matchingCustomer.name);
                    } else if (item.customer_name) {
                        setCustomerName(item.customer_name);
                    }
                } else if (item.customer_name) {
                    setCustomerName(item.customer_name);
                    setCustomerId(null);
                }
            }
        }
    };

    const handleSave = async () => {
        if (!customerName || selectedItemIds.length === 0) {
            toast.error("Please enter customer name and select at least one item.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/quotations/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: customerName,
                    customer_id: customerId,
                    selected_item_ids: selectedItemIds
                })
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/dashboard/quotations/${data.quotationId}/edit`);
            } else {
                toast.error('Failed to save quotation.');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate total on the fly for display
    const currentTotal = availableItems
        .filter(item => selectedItemIds.includes(item.id))
        .reduce((sum, item) => sum + parseFloat(item.total_amount), 0);

    /* ── Columns definition for TanStack Table ───────────────────────────── */
    const columns = useMemo(() => [
        {
            id: 'select',
            header: '',
            size: 40,
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => {
                const isSelected = selectedItemIds.includes(row.original.id);
                return (
                    <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <div
                            onClick={() => toggleItem(row.original.id)}
                            className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all ${
                                isSelected ? 'bg-white border-white' : 'border-gray-500'
                            }`}
                        >
                            {isSelected && <FiCheck className="text-black text-xs" />}
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'code',
            header: 'Code',
            size: 110,
            cell: ({ getValue }) => <span className="font-mono text-xs text-blue-400">{getValue() || '—'}</span>,
        },
        {
            id: 'description',
            accessorFn: row => row.estimation_name || row.job_description || 'Untitled',
            header: 'Name / Description',
            cell: ({ getValue }) => <span className="font-semibold text-white truncate max-w-[200px] block">{getValue()}</span>,
        },
        {
            accessorKey: 'customer_name',
            header: 'Customer',
            cell: ({ getValue }) => <span className="text-gray-400 text-sm">{getValue() || '—'}</span>,
        },
        {
            accessorKey: 'quantity',
            header: 'Qty',
            size: 80,
            cell: ({ getValue }) => <span className="text-gray-400 font-mono">{getValue()}</span>,
        },
        {
            accessorKey: 'total_amount',
            header: 'Amount',
            size: 140,
            cell: ({ getValue }) => (
                <span className="font-mono font-bold text-white">
                    {currency}{parseFloat(getValue() || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            accessorKey: 'created_at',
            header: 'Date',
            size: 110,
            cell: ({ getValue }) => (
                <span className="text-gray-500 text-xs">
                    {getValue() ? new Date(getValue()).toLocaleDateString('en-GB') : '—'}
                </span>
            ),
        }
    ], [selectedItemIds, currency, customers, customerId, customerName, availableItems]);

    /* ── TanStack Table Instance ─────────────────────────────────────────── */
    const table = useReactTable({
        data: availableItems,
        columns,
        state: { globalFilter, columnFilters, sorting },
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 10 } },
    });

    return (
        <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/quotations">
                        <Button className="bg-transparent border border-white/10 hover:bg-white/10 p-2">
                            <FiArrowLeft />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tighter">Create Master Quotation</h1>
                </div>
                <Button onClick={handleSave} disabled={loading} className="bg-white text-black hover:bg-gray-200">
                    {loading ? 'Saving...' : 'Finalize Quotation'}
                </Button>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column: Selection */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="bg-black/40 relative z-20 backdrop-blur-md p-6 rounded-xl border border-white/10">
                        <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">Client Details</h2>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Customer Name</label>
                            <div className="relative z-10">
                                <Input
                                    value={customerName}
                                    onChange={(e) => {
                                        setCustomerName(e.target.value);
                                        setCustomerId(null);
                                        setShowCustomerSuggestions(true);
                                        setSelectedItemIds([]); // Clear selection when customer changes
                                    }}
                                    onFocus={() => setShowCustomerSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                                    className="bg-secondary border-white/10"
                                    placeholder="Search or Enter Client Name"
                                />
                                {showCustomerSuggestions && (
                                    <ul className="absolute z-50 w-full bg-secondary border border-white/10 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                                        {customers
                                            .filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()))
                                            .map(c => (
                                                <li
                                                    key={c.id}
                                                    onClick={() => {
                                                        setCustomerName(c.name);
                                                        setCustomerId(c.id);
                                                        setShowCustomerSuggestions(false);
                                                        setSelectedItemIds([]); // Clear selection when customer changes
                                                    }}
                                                    className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between"
                                                >
                                                    <span>{c.name}</span>
                                                    <span className="text-gray-500 text-xs">{c.phone || c.email}</span>
                                                </li>
                                            ))}
                                        {customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).length === 0 && customerName && (
                                            <li className="px-4 py-2 text-gray-500 text-sm italic">New customer (won't be saved to database automatically)</li>
                                        )}
                                    </ul>
                                )}
                            </div>
                            {customerId && <p className="text-green-400 text-xs mt-1">✔ Customer selected. Showing their items.</p>}
                        </div>
                    </section>

                    <section className="bg-black/40 backdrop-blur-md p-6 relative z-10 rounded-xl border border-white/10">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <div>
                                <h2 className="text-lg font-semibold">Select Job Estimations</h2>
                                <p className="text-gray-500 text-xs mt-0.5">
                                    {table.getFilteredRowModel().rows.length} of {availableItems.length} records
                                </p>
                            </div>
                            <Link href="/dashboard/items/new">
                                <span className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1">
                                    <FiPlus /> Create New Estimation
                                </span>
                            </Link>
                        </div>

                        {/* Global Search and Table Filters */}
                        <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                            <div className="relative w-full md:w-64">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search estimations..."
                                    value={globalFilter}
                                    onChange={e => setGlobalFilter(e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-white/30 placeholder-gray-600 text-white"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/20">
                            {availableItems.length === 0 ? (
                                <p className="text-gray-500 text-sm p-8 text-center">No estimations found.</p>
                            ) : (
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        {table.getHeaderGroups().map(hg => (
                                            <tr key={hg.id} className="border-b border-white/[0.06]">
                                                {hg.headers.map(h => (
                                                    <th
                                                        key={h.id}
                                                        style={{ width: h.getSize() }}
                                                        className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500 bg-black/20 select-none"
                                                    >
                                                        {h.column.getCanSort() ? (
                                                            <button
                                                                onClick={h.column.getToggleSortingHandler()}
                                                                className="flex items-center gap-1 hover:text-white transition-colors"
                                                            >
                                                                {flexRender(h.column.columnDef.header, h.getContext())}
                                                                <SortIcon dir={h.column.getIsSorted()} />
                                                            </button>
                                                        ) : (
                                                            flexRender(h.column.columnDef.header, h.getContext())
                                                        )}
                                                        {h.column.getCanFilter() && <ColumnFilter column={h.column} />}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody>
                                        {table.getRowModel().rows.map((row, i) => {
                                            const isSelected = selectedItemIds.includes(row.original.id);
                                            return (
                                                <tr
                                                    key={row.id}
                                                    onClick={() => toggleItem(row.original.id)}
                                                    className={`border-b border-white/[0.04] cursor-pointer transition-colors hover:bg-white/[0.04] ${
                                                        isSelected ? 'bg-white/10 text-white' : i % 2 === 1 ? 'bg-white/[0.015]' : ''
                                                    }`}
                                                >
                                                    {row.getVisibleCells().map(cell => (
                                                        <td key={cell.id} className="px-4 py-3 align-middle">
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination footer */}
                        {!loading && availableItems.length > 0 && (
                            <div className="flex items-center justify-between mt-4 px-2 py-1 flex-wrap gap-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>Rows:</span>
                                    <select
                                        value={table.getState().pagination.pageSize}
                                        onChange={e => table.setPageSize(Number(e.target.value))}
                                        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-gray-300 outline-none"
                                    >
                                        {[5, 10, 20, 50].map(n => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </div>
                                <span className="text-xs text-gray-500">
                                    Page <strong className="text-gray-300">{table.getState().pagination.pageIndex + 1}</strong> of{' '}
                                    <strong className="text-gray-300">{table.getPageCount() || 1}</strong>
                                    {' '}— {table.getFilteredRowModel().rows.length} results
                                </span>
                                <div className="flex items-center gap-1">
                                    <PagBtn onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                                        <FiChevronsLeft className="w-3.5 h-3.5" />
                                    </PagBtn>
                                    <PagBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                                        <FiChevronLeft className="w-3.5 h-3.5" />
                                    </PagBtn>
                                    <PagBtn onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                                        <FiChevronRight className="w-3.5 h-3.5" />
                                    </PagBtn>
                                    <PagBtn onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                                        <FiChevronsRight className="w-3.5 h-3.5" />
                                    </PagBtn>
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column: Summary */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 bg-black/60 backdrop-blur-xl p-6 rounded-xl border border-white/20 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Quote Summary</h2>
                        <div className="space-y-2 mb-4">
                            {availableItems
                                .filter(item => selectedItemIds.includes(item.id))
                                .map((item, idx) => (
                                    <div key={item.id} className="flex justify-between text-sm text-gray-300">
                                        <span>{idx + 1}. {item.job_description}</span>
                                        <span>{currency}{parseFloat(item.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="border-t border-white/20 pt-4 flex justify-between text-xl font-bold text-white">
                            <span>Total</span>
                            <span>{currency}{currentTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
