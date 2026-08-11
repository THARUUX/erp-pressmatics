'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CustomerSuggestInput from '@/components/CustomerSuggestInput';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import {
    FiPlus, FiTrash2, FiExternalLink, FiFileText, FiDollarSign,
    FiShoppingCart, FiSearch, FiChevronUp, FiChevronDown,
    FiChevronLeft, FiChevronRight, FiAlertTriangle, FiCheckCircle,
    FiPlusCircle, FiX, FiEdit2, FiCopy
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
    draft: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    sent: 'bg-zinc-800/80 text-zinc-200 border-zinc-700',
    approved: 'bg-zinc-800 text-white border-zinc-600 font-bold',
    converted: 'bg-white text-black border-white font-bold',
    cancelled: 'bg-zinc-900 text-zinc-500 border-zinc-800',
};

function Badge({ status }) {
    return (
        <span className={`text-[10px] px-2.5 py-0.5 rounded-md border font-semibold capitalize ${STATUS_COLORS[status] || 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
            {status}
        </span>
    );
}

export default function PortalQuotationsPage({ params }) {
    const { id } = use(params);
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([{ id: 'created_at', desc: true }]);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [convertModal, setConvertModal] = useState(null);
    const [converting, setConverting] = useState(false);
    const [splitTasks, setSplitTasks] = useState(false);
    const [duplicatingId, setDuplicatingId] = useState(null);

    const handleDuplicateQuotation = async (q) => {
        setDuplicatingId(q.id);
        try {
            const res = await fetch(`/api/services/${id}/quotations/${q.id}/duplicate`, {
                method: 'POST',
            });
            const d = await res.json();
            if (res.ok) {
                toast.success(d.message || `Quotation duplicated as ${d.code}`);
                loadQuotations();
            } else {
                toast.error(d.error || 'Failed to duplicate quotation');
            }
        } catch {
            toast.error('Error duplicating quotation');
        } finally {
            setDuplicatingId(null);
        }
    };

    // Create quote modal state
    const [quoteModalOpen, setQuoteModalOpen] = useState(false);
    const [quoteForm, setQuoteForm] = useState({
        customer_name: '', customer_phone: '', customer_email: '',
        customer_address: '', tax_mode: 'none', tax_percentage: 0,
        terms_and_conditions: '', items: [{ item_name: '', quantity: 1, unit_price: 0 }]
    });

    // Edit quote modal state
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingQuoteId, setEditingQuoteId] = useState(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editForm, setEditForm] = useState({
        customer_name: '', customer_phone: '', customer_email: '',
        customer_address: '', status: 'approved', tax_mode: 'none',
        tax_percentage: 0, terms_and_conditions: '',
        items: [{ item_name: '', quantity: 1, unit_price: 0, description: '' }]
    });

    const loadQuotations = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/services/${id}/planning`);
            const d = await res.json();
            setQuotations(d.quotations || []);
        } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { loadQuotations(); }, [loadQuotations]);

    const handleOpenEdit = async (q) => {
        setEditingQuoteId(q.id);
        try {
            const res = await fetch(`/api/services/${id}/quotations/${q.id}`);
            const fullQuote = await res.json();
            if (fullQuote && !fullQuote.error) {
                setEditForm({
                    customer_name: fullQuote.customer_name || '',
                    customer_phone: fullQuote.customer_phone || '',
                    customer_email: fullQuote.customer_email || '',
                    customer_address: fullQuote.customer_address || '',
                    status: fullQuote.status || 'approved',
                    tax_mode: fullQuote.items?.[0]?.tax_mode || 'none',
                    tax_percentage: fullQuote.items?.[0]?.tax_percentage || 0,
                    terms_and_conditions: fullQuote.terms_and_conditions || '',
                    items: fullQuote.items && fullQuote.items.length > 0 ? fullQuote.items.map(i => ({
                        item_name: i.estimation_name || i.item_name || '',
                        quantity: i.quantity || 1,
                        unit_price: i.quantity > 0 ? (i.subtotal_amount || i.total_amount) / i.quantity : 0,
                        description: i.job_description || i.description || ''
                    })) : [{ item_name: '', quantity: 1, unit_price: 0, description: '' }]
                });
            } else {
                setEditForm({
                    customer_name: q.customer_name || '',
                    customer_phone: '', customer_email: '', customer_address: '',
                    status: q.status || 'approved', tax_mode: 'none', tax_percentage: 0,
                    terms_and_conditions: q.terms_and_conditions || '',
                    items: [{ item_name: q.job_description || '', quantity: 1, unit_price: q.total_amount || 0 }]
                });
            }
        } catch {
            setEditForm({
                customer_name: q.customer_name || '',
                customer_phone: '', customer_email: '', customer_address: '',
                status: q.status || 'approved', tax_mode: 'none', tax_percentage: 0,
                terms_and_conditions: q.terms_and_conditions || '',
                items: [{ item_name: q.job_description || '', quantity: 1, unit_price: q.total_amount || 0 }]
            });
        }
        setEditModalOpen(true);
    };

    const handleUpdateQuotation = async (e) => {
        e.preventDefault();
        setSavingEdit(true);
        try {
            const res = await fetch(`/api/services/${id}/quotations/${editingQuoteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            const d = await res.json();
            if (res.ok) {
                toast.success('Quotation updated!');
                setEditModalOpen(false);
                loadQuotations();
            } else {
                toast.error(d.error || 'Failed to update quotation');
            }
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/services/${id}/quotations/${deleteConfirm.id}`, { method: 'DELETE' });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            toast.success('Quotation deleted');
            setDeleteConfirm(null);
            loadQuotations();
        } catch (e) { toast.error(e.message); }
        finally { setDeleting(false); }
    };

    const handleOpenConvertModal = async (q) => {
        setSplitTasks(false);
        let hasMulti = false;
        try {
            const res = await fetch(`/api/services/${id}/quotations/${q.id}`);
            if (res.ok) {
                const qData = await res.json();
                hasMulti = (qData.items || []).some(i => (parseFloat(i.quantity) || 1) > 1);
            }
        } catch (e) {
            console.error('Error fetching quotation details:', e);
        }
        setConvertModal({ ...q, hasMultiQtyItems: hasMulti });
    };

    const handleConvert = async () => {
        if (!convertModal) return;
        setConverting(true);
        try {
            const res = await fetch('/api/sales-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quotation_id: convertModal.id, auto_deduct_stock: false, split_tasks: splitTasks }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Failed');
            toast.success('Sales Order created!');
            setConvertModal(null);
            loadQuotations();
        } catch (e) { toast.error(e.message); }
        finally { setConverting(false); }
    };

    const handleCreateQuotation = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/services/${id}/planning`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_quotation', ...quoteForm }),
            });
            const d = await res.json();
            if (d.error) throw new Error(d.error);
            toast.success(`Quotation ${d.code} created`);
            setQuoteModalOpen(false);
            setQuoteForm({ customer_name: '', customer_phone: '', customer_email: '', customer_address: '', tax_mode: 'none', tax_percentage: 0, terms_and_conditions: '', items: [{ item_name: '', quantity: 1, unit_price: 0 }] });
            loadQuotations();
        } catch (e) { toast.error(e.message); }
    };

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at',
            header: 'Date',
            cell: ({ getValue }) => <span className="text-xs text-zinc-400">{new Date(getValue()).toLocaleDateString()}</span>,
        },
        {
            accessorKey: 'code',
            header: 'Code',
            cell: ({ getValue }) => <span className="font-mono text-xs font-bold text-zinc-200">{getValue()}</span>,
        },
        {
            accessorKey: 'customer_name',
            header: 'Customer',
            cell: ({ getValue }) => <span className="font-semibold text-white">{getValue()}</span>,
        },
        {
            accessorKey: 'job_description',
            header: 'Description',
            cell: ({ getValue }) => <span className="text-xs text-zinc-400 max-w-[160px] truncate block" title={getValue()}>{getValue()}</span>,
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
            cell: ({ getValue }) => <Badge status={getValue()} />,
        },
        {
            id: 'actions',
            header: 'Actions',
            enableSorting: false,
            cell: ({ row }) => {
                const q = row.original;
                return (
                    <div className="flex gap-1.5 items-center justify-end">
                        <button onClick={() => handleOpenEdit(q)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer" title="Edit Quotation">
                            <FiEdit2 size={13} />
                        </button>
                        <button onClick={() => handleDuplicateQuotation(q)} disabled={duplicatingId === q.id}
                            className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-colors cursor-pointer disabled:opacity-50" title="Duplicate Quotation">
                            <FiCopy size={13} />
                        </button>
                        <Link href={`/services/${id}/portal/quotations/${q.id}`}
                            className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 transition-colors" title="View">
                            <FiExternalLink size={13} />
                        </Link>
                        <a href={`/api/quotations/${q.id}/pdf`} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 transition-colors" title="PDF">
                            <FiFileText size={13} />
                        </a>
                        {q.status !== 'converted' && (
                            <button onClick={() => handleOpenConvertModal(q)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer" title="Convert to SO">
                                <FiShoppingCart size={13} />
                            </button>
                        )}
                        <button onClick={() => setDeleteConfirm(q)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                            <FiTrash2 size={13} />
                        </button>
                    </div>
                );
            },
        },
    ], [id]);

    const table = useReactTable({
        data: quotations,
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

    const quoteTotal = useMemo(() => {
        const sub = quoteForm.items.reduce((s, i) => s + parseFloat(i.quantity || 1) * parseFloat(i.unit_price || 0), 0);
        const pct = parseFloat(quoteForm.tax_percentage || 0);
        if (quoteForm.tax_mode === 'add') return sub + sub * pct / 100;
        return sub;
    }, [quoteForm]);

    const editTotal = useMemo(() => {
        const sub = editForm.items.reduce((s, i) => s + parseFloat(i.quantity || 1) * parseFloat(i.unit_price || 0), 0);
        const pct = parseFloat(editForm.tax_percentage || 0);
        if (editForm.tax_mode === 'add') return sub + sub * pct / 100;
        return sub;
    }, [editForm]);

    return (
        <div className="p-8 space-y-6 bg-[#09090b] min-h-screen text-zinc-100">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white">Quotations</h1>
                    <p className="text-zinc-400 text-sm mt-0.5">{quotations.length} total</p>
                </div>
                <button onClick={() => setQuoteModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-200 rounded-md text-xs font-bold text-black transition-colors cursor-pointer shadow-sm">
                    <FiPlus size={15} /> New Quotation
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                    <input
                        value={globalFilter}
                        onChange={e => setGlobalFilter(e.target.value)}
                        placeholder="Search quotations…"
                        className="w-full pl-9 pr-4 py-2 bg-[#0e0e11] border border-zinc-800 rounded-md text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                    />
                </div>
                <div className="text-xs text-zinc-400">{table.getFilteredRowModel().rows.length} results</div>
            </div>

            {/* Table */}
            <div className="bg-[#0e0e11] border border-zinc-800/80 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center">
                        <div className="w-7 h-7 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
                    </div>
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
                                <tr><td colSpan={7} className="py-16 text-center text-zinc-500 text-xs">No quotations found</td></tr>
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
                <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
                <div className="flex gap-2">
                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                        className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-30 cursor-pointer">
                        <FiChevronLeft size={14} />
                    </button>
                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                        className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 disabled:opacity-30 cursor-pointer">
                        <FiChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* ── Delete Confirm ── */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0e0e11] border border-zinc-800 rounded-2xl p-7 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-md bg-zinc-800 border border-zinc-700">
                                <FiAlertTriangle className="w-5 h-5 text-zinc-200" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">Delete Quotation</h2>
                                <p className="text-xs text-zinc-400 mt-0.5">{deleteConfirm.code}</p>
                            </div>
                        </div>
                        <p className="text-sm text-zinc-400 mb-6">This action cannot be undone. The quotation and its line items will be permanently removed.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 cursor-pointer">Cancel</button>
                            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-semibold text-white bg-zinc-700 hover:bg-zinc-600 rounded-md disabled:opacity-50 cursor-pointer">
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Convert to SO Confirm ── */}
            {convertModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0e0e11] border border-zinc-800 rounded-2xl p-7 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-md bg-zinc-800 border border-zinc-700">
                                <FiShoppingCart className="w-5 h-5 text-zinc-200" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">Convert to Sales Order</h2>
                                <p className="text-xs text-zinc-400 mt-0.5">{convertModal.code} · {convertModal.customer_name}</p>
                            </div>
                        </div>
                        <p className="text-xs text-zinc-400 mb-4">Creates a Sales Order without deducting stock automatically.</p>

                        {convertModal.hasMultiQtyItems && (
                            <div className="mb-6 pt-3 border-t border-zinc-800 space-y-2 text-left">
                                <label className="block text-xs font-bold text-zinc-300">
                                    Multi-Unit Items Task Handling
                                </label>
                                <p className="text-xs text-zinc-400">Some items have quantity &gt; 1. Choose task generation mode:</p>
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <label className={`flex flex-col p-3 rounded-md border cursor-pointer transition-all ${!splitTasks ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'}`}>
                                        <div className="flex items-center gap-2 mb-1 font-semibold text-xs text-white">
                                            <input type="radio" name="splitTasks" checked={!splitTasks} onChange={() => setSplitTasks(false)} className="accent-white" />
                                            Merge Tasks
                                        </div>
                                        <span className="text-[10px] text-zinc-400 leading-tight">Keep 1 task for total item quantity</span>
                                    </label>

                                    <label className={`flex flex-col p-3 rounded-md border cursor-pointer transition-all ${splitTasks ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'}`}>
                                        <div className="flex items-center gap-2 mb-1 font-semibold text-xs text-white">
                                            <input type="radio" name="splitTasks" checked={splitTasks} onChange={() => setSplitTasks(true)} className="accent-white" />
                                            Separate Tasks
                                        </div>
                                        <span className="text-[10px] text-zinc-400 leading-tight">Multiply tasks by unit count</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConvertModal(null)} className="px-4 py-2 text-sm font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 cursor-pointer">Cancel</button>
                            <button onClick={handleConvert} disabled={converting} className="px-4 py-2 text-sm font-semibold text-black bg-white hover:bg-zinc-200 rounded-md disabled:opacity-50 cursor-pointer">
                                {converting ? 'Converting…' : 'Convert'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Quotation Modal ── */}
            {editModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
                    <form onSubmit={handleUpdateQuotation} className="bg-[#0e0e11] border border-zinc-800 rounded-2xl max-w-2xl w-full mx-4 shadow-2xl flex flex-col max-h-[90vh]">
                        <header className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <FiEdit2 className="text-zinc-400" /> Edit Quotation
                            </h3>
                            <button type="button" onClick={() => setEditModalOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"><FiX /></button>
                        </header>
                        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 text-zinc-200">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-3">Client &amp; Quotation Details</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs text-zinc-400 mb-1.5">Client / Company Name *</label>
                                        <CustomerSuggestInput
                                            required
                                            value={editForm.customer_name}
                                            customerPhone={editForm.customer_phone}
                                            customerEmail={editForm.customer_email}
                                            customerAddress={editForm.customer_address}
                                            onChange={({ name, id, phone, email, address }) => {
                                                setEditForm(p => ({
                                                    ...p,
                                                    customer_name: name,
                                                    customer_id: id,
                                                    customer_phone: phone || p.customer_phone,
                                                    customer_email: email || p.customer_email,
                                                    customer_address: address || p.customer_address
                                                }));
                                            }}
                                            placeholder="Search or enter customer name..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-400 mb-1.5">Phone</label>
                                        <input value={editForm.customer_phone} onChange={e => setEditForm(p => ({ ...p, customer_phone: e.target.value }))}
                                            className="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-400 mb-1.5">Email</label>
                                        <input type="email" value={editForm.customer_email} onChange={e => setEditForm(p => ({ ...p, customer_email: e.target.value }))}
                                            className="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-zinc-400 mb-1.5">Billing Address</label>
                                        <input value={editForm.customer_address} onChange={e => setEditForm(p => ({ ...p, customer_address: e.target.value }))}
                                            className="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-400 mb-1.5">Status</label>
                                        <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                                            className="w-full bg-zinc-900/80 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                                            <option value="draft" className="bg-zinc-900">Draft</option>
                                            <option value="sent" className="bg-zinc-900">Sent</option>
                                            <option value="approved" className="bg-zinc-900">Approved</option>
                                            <option value="converted" className="bg-zinc-900">Converted</option>
                                            <option value="cancelled" className="bg-zinc-900">Cancelled</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Line Items *</p>
                                    <button type="button" onClick={() => setEditForm(p => ({ ...p, items: [...p.items, { item_name: '', description: '', quantity: 1, unit_price: 0 }] }))}
                                        className="text-xs text-zinc-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer">
                                        <FiPlus size={11} /> Add Row
                                    </button>
                                </div>
                                {editForm.items.map((item, idx) => (
                                    <div key={idx} className="bg-zinc-900/40 border border-zinc-800 rounded-md p-3 space-y-2">
                                        <div className="grid grid-cols-[1fr_70px_100px_28px] gap-2 items-center">
                                            <input required value={item.item_name} onChange={e => { const it = [...editForm.items]; it[idx].item_name = e.target.value; setEditForm(p => ({ ...p, items: it })); }}
                                                placeholder="Item Name *"
                                                className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-zinc-500" />
                                            <input type="number" min="1" value={item.quantity} onChange={e => { const it = [...editForm.items]; it[idx].quantity = parseInt(e.target.value) || 1; setEditForm(p => ({ ...p, items: it })); }}
                                                placeholder="Qty"
                                                className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-2 text-white text-xs font-mono text-center focus:outline-none focus:border-zinc-500" />
                                            <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => { const it = [...editForm.items]; it[idx].unit_price = parseFloat(e.target.value) || 0; setEditForm(p => ({ ...p, items: it })); }}
                                                placeholder="Price"
                                                className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-2 text-white text-xs font-mono text-right focus:outline-none focus:border-zinc-500" />
                                            {editForm.items.length > 1 ? (
                                                <button type="button" onClick={() => setEditForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))} className="p-1 text-zinc-400 hover:text-white cursor-pointer"><FiTrash2 size={12} /></button>
                                            ) : <span />}
                                        </div>
                                        <input value={item.description || ''} onChange={e => { const it = [...editForm.items]; it[idx].description = e.target.value; setEditForm(p => ({ ...p, items: it })); }}
                                            placeholder="Item details / custom specifications (optional)…"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-300 text-xs focus:outline-none focus:border-zinc-600" />
                                    </div>
                                ))}
                            </div>

                            {/* Tax */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1.5">Tax Mode</label>
                                    <select value={editForm.tax_mode} onChange={e => setEditForm(p => ({ ...p, tax_mode: e.target.value }))}
                                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                                        <option value="none" className="bg-zinc-900">No Tax</option>
                                        <option value="add" className="bg-zinc-900">Add Tax (on top)</option>
                                        <option value="deduct" className="bg-zinc-900">Deduct Tax (inclusive)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1.5">Tax %</label>
                                    <input type="number" min="0" max="100" step="0.01" disabled={editForm.tax_mode === 'none'}
                                        value={editForm.tax_percentage} onChange={e => setEditForm(p => ({ ...p, tax_percentage: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none disabled:opacity-30" />
                                </div>
                            </div>

                            {/* Terms */}
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1.5">Terms &amp; Conditions</label>
                                <textarea rows={3} value={editForm.terms_and_conditions} onChange={e => setEditForm(p => ({ ...p, terms_and_conditions: e.target.value }))}
                                    placeholder="Payment terms, delivery terms…"
                                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none font-mono" />
                            </div>

                            {/* Live Total */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-md px-5 py-3 flex justify-between items-center">
                                <span className="text-xs text-zinc-400 font-semibold">Grand Total</span>
                                <span className="font-mono font-bold text-white text-base">
                                    LKR {editTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <footer className="px-6 py-3.5 border-t border-zinc-800 flex justify-end gap-2.5">
                            <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 cursor-pointer">Cancel</button>
                            <button type="submit" disabled={savingEdit} className="px-4 py-2 text-xs font-bold text-black bg-white hover:bg-zinc-200 rounded-md cursor-pointer disabled:opacity-50">
                                {savingEdit ? 'Saving…' : 'Save Changes'}
                            </button>
                        </footer>
                    </form>
                </div>
            )}

            {/* ── Create Quotation Modal ── */}
            {quoteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
                    <form onSubmit={handleCreateQuotation} className="bg-[#0e0e11] border border-zinc-800 rounded-2xl max-w-2xl w-full mx-4 shadow-2xl flex flex-col max-h-[90vh]">
                        <header className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <FiPlusCircle className="text-zinc-400" /> New Custom Quotation
                            </h3>
                            <button type="button" onClick={() => setQuoteModalOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"><FiX /></button>
                        </header>
                        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 text-zinc-200">
                            {/* Client Info */}
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-3">Client Information</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs text-zinc-400 mb-1.5">Client / Company Name *</label>
                                        <CustomerSuggestInput
                                            required
                                            value={quoteForm.customer_name}
                                            customerPhone={quoteForm.customer_phone}
                                            customerEmail={quoteForm.customer_email}
                                            customerAddress={quoteForm.customer_address}
                                            onChange={({ name, id, phone, email, address }) => {
                                                setQuoteForm(p => ({
                                                    ...p,
                                                    customer_name: name,
                                                    customer_id: id,
                                                    customer_phone: phone || p.customer_phone,
                                                    customer_email: email || p.customer_email,
                                                    customer_address: address || p.customer_address
                                                }));
                                            }}
                                            placeholder="Search or enter customer name..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-400 mb-1.5">Phone</label>
                                        <input value={quoteForm.customer_phone} onChange={e => setQuoteForm(p => ({ ...p, customer_phone: e.target.value }))}
                                            placeholder="+94 77 123 4567"
                                            className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-400 mb-1.5">Email</label>
                                        <input type="email" value={quoteForm.customer_email} onChange={e => setQuoteForm(p => ({ ...p, customer_email: e.target.value }))}
                                            placeholder="contact@acme.com"
                                            className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-zinc-400 mb-1.5">Billing Address</label>
                                        <input value={quoteForm.customer_address} onChange={e => setQuoteForm(p => ({ ...p, customer_address: e.target.value }))}
                                            placeholder="123 Main Street, Colombo 03"
                                            className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Line Items *</p>
                                    <button type="button" onClick={() => setQuoteForm(p => ({ ...p, items: [...p.items, { item_name: '', description: '', quantity: 1, unit_price: 0 }] }))}
                                        className="text-xs text-zinc-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer">
                                        <FiPlus size={11} /> Add Row
                                    </button>
                                </div>
                                {quoteForm.items.map((item, idx) => (
                                    <div key={idx} className="bg-zinc-900/40 border border-zinc-800 rounded-md p-3 space-y-2">
                                        <div className="grid grid-cols-[1fr_70px_100px_28px] gap-2 items-center">
                                            <input required value={item.item_name} onChange={e => { const it = [...quoteForm.items]; it[idx].item_name = e.target.value; setQuoteForm(p => ({ ...p, items: it })); }}
                                                placeholder="Item Name *"
                                                className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-zinc-500" />
                                            <input type="number" min="1" value={item.quantity} onChange={e => { const it = [...quoteForm.items]; it[idx].quantity = parseInt(e.target.value) || 1; setQuoteForm(p => ({ ...p, items: it })); }}
                                                placeholder="Qty"
                                                className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-2 text-white text-xs font-mono text-center focus:outline-none focus:border-zinc-500" />
                                            <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => { const it = [...quoteForm.items]; it[idx].unit_price = parseFloat(e.target.value) || 0; setQuoteForm(p => ({ ...p, items: it })); }}
                                                placeholder="Price"
                                                className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-2 text-white text-xs font-mono text-right focus:outline-none focus:border-zinc-500" />
                                            {quoteForm.items.length > 1 ? (
                                                <button type="button" onClick={() => setQuoteForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))} className="p-1 text-zinc-400 hover:text-white cursor-pointer"><FiTrash2 size={12} /></button>
                                            ) : <span />}
                                        </div>
                                        <input value={item.description || ''} onChange={e => { const it = [...quoteForm.items]; it[idx].description = e.target.value; setQuoteForm(p => ({ ...p, items: it })); }}
                                            placeholder="Item details / custom specifications (optional)…"
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-300 text-xs focus:outline-none focus:border-zinc-600" />
                                    </div>
                                ))}
                            </div>

                            {/* Tax */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1.5">Tax Mode</label>
                                    <select value={quoteForm.tax_mode} onChange={e => setQuoteForm(p => ({ ...p, tax_mode: e.target.value }))}
                                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                                        <option value="none" className="bg-zinc-900">No Tax</option>
                                        <option value="add" className="bg-zinc-900">Add Tax (on top)</option>
                                        <option value="deduct" className="bg-zinc-900">Deduct Tax (inclusive)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-400 mb-1.5">Tax %</label>
                                    <input type="number" min="0" max="100" step="0.01" disabled={quoteForm.tax_mode === 'none'}
                                        value={quoteForm.tax_percentage} onChange={e => setQuoteForm(p => ({ ...p, tax_percentage: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none disabled:opacity-30" />
                                </div>
                            </div>

                            {/* Terms */}
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1.5">Terms &amp; Conditions</label>
                                <textarea rows={3} value={quoteForm.terms_and_conditions} onChange={e => setQuoteForm(p => ({ ...p, terms_and_conditions: e.target.value }))}
                                    placeholder="Payment terms, delivery terms…"
                                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none font-mono" />
                            </div>

                            {/* Live Total */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-md px-5 py-3 flex justify-between items-center">
                                <span className="text-xs text-zinc-400 font-semibold">Grand Total</span>
                                <span className="font-mono font-bold text-white text-base">
                                    LKR {quoteTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <footer className="px-6 py-3.5 border-t border-zinc-800 flex justify-end gap-2.5">
                            <button type="button" onClick={() => setQuoteModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 cursor-pointer">Cancel</button>
                            <button type="submit" className="px-4 py-2 text-xs font-bold text-black bg-white hover:bg-zinc-200 rounded-md cursor-pointer">Generate Quotation</button>
                        </footer>
                    </form>
                </div>
            )}
        </div>
    );
}
