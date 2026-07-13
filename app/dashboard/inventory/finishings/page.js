'use client';

import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { FiPlus, FiTrash2, FiSearch, FiEdit2, FiX, FiClock, FiCpu, FiChevronUp, FiChevronDown, FiDollarSign } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSettings } from '@/components/SettingsContext';

export default function FinishingsPage() {
    const { settings } = useSettings();
    const currency = settings.currency || '$';
    
    const [machines, setMachines] = useState([]);
    const [finishings, setFinishings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sorting, setSorting] = useState([]);

    // Modals
    const [showFormModal, setShowFormModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        unit_cost: '',
        is_machine: false,
        machine_id: '',
        cost_unit: 'Unit',
        variants: [],
        speed: '',
        speed_unit: 'Sheets/Hr'
    });

    useEffect(() => {
        fetchFinishings();
        fetchMachines();
    }, []);

    const fetchMachines = async () => {
        try {
            const res = await fetch('/api/machines');
            const data = await res.json();
            setMachines(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            setMachines([]);
        }
    };

    const fetchFinishings = async () => {
        try {
            const res = await fetch('/api/finishings');
            const data = await res.json();
            setFinishings(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            setFinishings([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = isEditing ? `/api/finishings/${editId}` : '/api/finishings';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(isEditing ? 'Service updated successfully' : 'Service added successfully');
                setShowFormModal(false);
                fetchFinishings();
                resetForm();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Operation failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        }
    };

    const handleDelete = async (id) => {
        if (!(await confirmDialog("Are you sure you want to delete this service?"))) return;
        try {
            const res = await fetch(`/api/finishings/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Service deleted successfully');
                fetchFinishings();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to delete');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete');
        }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setEditId(item.id);
        setFormData({
            name: item.name,
            unit_cost: item.unit_cost,
            is_machine: item.is_machine === 1,
            machine_id: item.machine_id || '',
            cost_unit: item.cost_unit || 'Unit',
            variants: item.variants || [],
            speed: item.speed || '',
            speed_unit: item.speed_unit || 'Sheets/Hr'
        });
        setShowFormModal(true);
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setFormData({
            name: '',
            unit_cost: '',
            is_machine: false,
            machine_id: '',
            cost_unit: 'Unit',
            variants: [],
            speed: '',
            speed_unit: 'Sheets/Hr'
        });
    };

    const addVariant = () => {
        setFormData(prev => ({
            ...prev,
            variants: [...(prev.variants || []), { name: '', unit_cost: '' }]
        }));
    };

    const removeVariant = (index) => {
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.filter((_, i) => i !== index)
        }));
    };

    const updateVariant = (index, field, value) => {
        const newVariants = [...(formData.variants || [])];
        newVariants[index][field] = value;
        setFormData(prev => ({ ...prev, variants: newVariants }));
    };

    const filteredData = useMemo(() => {
        return finishings.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [finishings, searchTerm]);

    const columns = useMemo(() => [
        {
            accessorKey: 'name',
            header: 'Service',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div>
                        <div className="font-bold text-white text-[14px]">{item.name}</div>                  
                    </div>
                );
            }
        },
        {
            accessorKey: 'type',
            header: 'Operation',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                            {item.is_machine ? (
                                <span className="inline-block text-[9.5px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                                    Machine: {item.machine_name || 'Unassigned'}
                                </span>
                            ) : (
                                <span className="inline-block text-[9.5px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    Manual Operation
                                </span>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'speed',
            header: 'Processing Speed',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="text-xs text-gray-300">
                        {item.speed > 0 ? (
                            <div>
                                Speed: <span className="font-semibold text-white">{parseFloat(item.speed).toLocaleString()}</span> {item.speed_unit}
                            </div>
                        ) : (
                            <span className="text-gray-500 italic">— No speed defined —</span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'variants',
            header: 'Variants & Rates',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex flex-wrap gap-1">
                        {item.variants && item.variants.length > 0 ? (
                            item.variants.map((v, i) => (
                                <span key={i} className="inline-flex text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-300">
                                    {v.name}: {currency}{parseFloat(v.unit_cost).toFixed(2)}
                                </span>
                            ))
                        ) : (
                            <span className="text-gray-500 text-xs italic">No variants</span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'unit_cost',
            header: () => <div className="text-right">Base Cost</div>,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="text-right font-mono text-xs font-semibold text-white">
                        {currency}{parseFloat(item.unit_cost).toFixed(5)}
                        <span className="text-gray-500 text-[10px] ml-1 font-sans">/ {item.cost_unit || 'Unit'}</span>
                    </div>
                );
            }
        },
        {
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex justify-end gap-1">
                        <button onClick={() => handleEdit(item)}
                            className="p-2 text-purple-400 hover:text-purple-300 bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/15 rounded-lg transition-colors" title="Edit">
                            <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(item.id)}
                            className="p-2 text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/15 rounded-lg transition-colors" title="Delete">
                            <FiTrash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            }
        }
    ], [currency]);

    const table = useReactTable({
        data: filteredData,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel()
    });

    return (
        <div className="text-white min-h-screen">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">Finishings & Services</h1>
                    <p className="text-gray-400 text-sm">Configure manual or machine post-press services, variants and costs</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsEditing(false); setShowFormModal(true); }}
                    className="flex items-center gap-2 bg-white hover:bg-gray-200 text-black px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg"
                >
                    <FiPlus /> Add Service
                </button>
            </header>

            {/* Search Filter */}
            <div className="relative mb-6">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    type="text"
                    placeholder="Search finishings..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-secondary/40 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-white focus:outline-none focus:border-white/30 transition-all text-sm placeholder:text-gray-500"
                />
            </div>

            {/* TanStack Table */}
            <div className="bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id} className="border-b border-white/10 bg-white/[0.01]">
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                                            className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer select-none transition-colors hover:text-white"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {header.column.getCanSort() && (
                                                    {
                                                        asc: <FiChevronUp className="w-3.5 h-3.5" />,
                                                        desc: <FiChevronDown className="w-3.5 h-3.5" />
                                                    }[header.column.getIsSorted()] || <FiChevronDown className="w-3.5 h-3.5 text-gray-600 opacity-50" />
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-8 text-center text-gray-500 text-sm">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 rounded-full border-2 border-white/10 border-t-white animate-spin" />
                                            Loading services...
                                        </div>
                                    </td>
                                </tr>
                            ) : table.getRowModel().rows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-12 text-center text-gray-500 text-sm">
                                        No services found matching search query.
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map(row => (
                                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="p-4 align-middle">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Form Modal */}
            {showFormModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#0d0d1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <h3 className="font-bold text-lg text-white">
                                {isEditing ? 'Edit Finishing Service' : 'Add Post-Press Service'}
                            </h3>
                            <button
                                onClick={() => { setShowFormModal(false); resetForm(); }}
                                className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all"
                            >
                                <FiX />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Service Name</label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Gold Foiling"
                                    required
                                    className="bg-secondary border-white/10"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Operation Type</label>
                                    <select
                                        className="w-full bg-[#1b1b2d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 [color-scheme:dark]"
                                        value={formData.is_machine ? 'machine' : 'manual'}
                                        onChange={e => setFormData(prev => ({ ...prev, is_machine: e.target.value === 'machine' }))}
                                    >
                                        <option value="manual">Manual Operation</option>
                                        <option value="machine">Machine Bound</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Cost Basis</label>
                                    <select
                                        className="w-full bg-[#1b1b2d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 [color-scheme:dark]"
                                        value={formData.cost_unit}
                                        onChange={e => setFormData(prev => ({ ...prev, cost_unit: e.target.value }))}
                                    >
                                        <option value="Unit">Per Unit (Job)</option>
                                        <option value="Cut Sheet">Per Cut Sheet (Input)</option>
                                        <option value="Page">Per Page</option>
                                        <option value="Form">Per Form</option>
                                        <option value="Impression">Per Impression</option>
                                        <option value="SqInch">Sq Inch</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Base Cost ({currency})</label>
                                <Input
                                    type="number"
                                    step="0.00001"
                                    value={formData.unit_cost}
                                    onChange={e => setFormData(prev => ({ ...prev, unit_cost: e.target.value }))}
                                    placeholder="0.00"
                                    required
                                    className="bg-secondary border-white/10"
                                />
                            </div>

                            {formData.is_machine ? (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Link Machine</label>
                                    <select
                                        className="w-full bg-[#1b1b2d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 [color-scheme:dark]"
                                        value={formData.machine_id}
                                        onChange={e => setFormData(prev => ({ ...prev, machine_id: e.target.value }))}
                                    >
                                        <option value="">-- Select Machine --</option>
                                        {machines.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Manual Speed</label>
                                        <Input
                                            type="number"
                                            value={formData.speed}
                                            onChange={e => setFormData(prev => ({ ...prev, speed: e.target.value }))}
                                            placeholder="500"
                                            className="bg-secondary border-white/10"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Speed Unit</label>
                                        <select
                                            className="w-full bg-[#1b1b2d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 [color-scheme:dark]"
                                            value={formData.speed_unit}
                                            onChange={e => setFormData(prev => ({ ...prev, speed_unit: e.target.value }))}
                                        >
                                            <option value="Prints/Hr">Prints/Hr</option>
                                            <option value="Sheets/Hr">Sheets/Hr</option>
                                            <option value="Units/Hr">Units/Hr</option>
                                            <option value="Forms/Hr">Forms/Hr</option>
                                            <option value="Impressions/Hr">Impressions/Hr</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Variants Section */}
                            <div className="border-t border-white/10 pt-4">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Variants (Optional)</label>
                                    <button
                                        type="button"
                                        onClick={addVariant}
                                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold"
                                    >
                                        <FiPlus /> Add Variant
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {formData.variants && formData.variants.map((variant, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <Input
                                                placeholder="Variant Name"
                                                value={variant.name}
                                                onChange={e => updateVariant(index, 'name', e.target.value)}
                                                className="bg-secondary border-white/10 text-sm py-1 flex-1"
                                            />
                                            <Input
                                                type="number"
                                                step="0.00001"
                                                placeholder="Cost"
                                                value={variant.unit_cost}
                                                onChange={e => updateVariant(index, 'unit_cost', e.target.value)}
                                                className="bg-secondary border-white/10 w-28 text-sm py-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeVariant(index)}
                                                className="text-gray-500 hover:text-red-400 p-2"
                                            >
                                                <FiTrash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {(!formData.variants || formData.variants.length === 0) && (
                                        <p className="text-xs text-gray-500 italic">No variants added yet.</p>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-4 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowFormModal(false); resetForm(); }}
                                    className="px-4 py-2 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <Button
                                    type="submit"
                                    className={`px-6 text-black font-bold hover:opacity-90 ${isEditing ? 'bg-amber-400' : 'bg-white'}`}
                                >
                                    {isEditing ? 'Update Service' : 'Add Service'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
