'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiPlus, FiTrash2, FiSearch, FiEdit2, FiX } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSettings } from '@/components/SettingsContext';

export default function FinishingsPage() {
    const { settings } = useSettings();
    const currency = settings.currency;
    const [machines, setMachines] = useState([]);
    const [finishings, setFinishings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // New/Edit Finishing Form
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
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

    useEffect(() => {
        fetchFinishings();
        fetchMachines();
    }, []);

    const fetchMachines = async () => {
        try {
            const res = await fetch('/api/machines');
            const data = await res.json();
            if (Array.isArray(data)) {
                setMachines(data);
            } else {
                console.error("API returned non-array for machines:", data);
                setMachines([]);
            }
        } catch (error) {
            console.error("Error fetching machines:", error);
            setMachines([]);
        }
    };

    const fetchFinishings = async () => {
        try {
            const res = await fetch('/api/finishings');
            const data = await res.json();
            if (Array.isArray(data)) {
                setFinishings(data);
            } else {
                console.error("API returned non-array:", data);
                setFinishings([]);
            }
        } catch (error) {
            console.error("Error fetching finishings:", error);
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
                resetForm();
                fetchFinishings();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this service?")) return;
        try {
            const res = await fetch(`/api/finishings/${id}`, { method: 'DELETE' });
            if (res.ok) fetchFinishings();
        } catch (error) { console.error(error); }
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
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setFormData({ name: '', unit_cost: '', is_machine: false, machine_id: '', cost_unit: 'Unit', variants: [], speed: '', speed_unit: 'Sheets/Hr' });
    };

    const filtered = finishings.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="text-white">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter mb-2">Finishings & Services</h1>
                    <p className="text-gray-400">Manage post-press services and base rates</p>
                </div>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Add/Edit Form */}
                <div className="lg:col-span-1">
                    <section className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 sticky top-8">
                        <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-2">{isEditing ? <FiEdit2 /> : <FiPlus />} {isEditing ? 'Edit Service' : 'Add Service'}</span>
                            {isEditing && (
                                <button onClick={resetForm} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1">
                                    <FiX /> Cancel
                                </button>
                            )}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Service Name</label>
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
                                    <label className="block text-sm text-gray-400 mb-1">Type</label>
                                    <select
                                        className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                        value={formData.is_machine ? 'machine' : 'manual'}
                                        onChange={e => setFormData(prev => ({ ...prev, is_machine: e.target.value === 'machine' }))}
                                    >
                                        <option value="manual">Manual</option>
                                        <option value="machine">Machine</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Cost Basis</label>
                                    <select
                                        className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                        value={formData.cost_unit}
                                        onChange={e => setFormData(prev => ({ ...prev, cost_unit: e.target.value }))}
                                    >
                                        <option value="Unit">Per Unit (Job)</option>
                                        <option value="Cut Sheet">Per Cut Sheet (Input)</option>
                                        <option value="Page">Per Page</option>
                                    </select>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm text-gray-400 mb-1">Base Cost ({currency})</label>
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
                            </div>

                            {formData.is_machine ? (
                                <div className="space-y-2 p-3 bg-white/5 rounded-lg border border-white/10">
                                    <label className="block text-sm text-gray-400">Select Machine</label>
                                    <select
                                        className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                        value={formData.machine_id}
                                        onChange={e => setFormData(prev => ({ ...prev, machine_id: e.target.value }))}
                                    >
                                        <option value="">-- Choose Machine --</option>
                                        {machines.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 p-3 bg-white/5 rounded-lg border border-white/10">
                                    <div className="col-span-2 text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Manual Speed</div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Speed</label>
                                        <Input
                                            type="number"
                                            value={formData.speed}
                                            onChange={e => setFormData(prev => ({ ...prev, speed: e.target.value }))}
                                            placeholder="e.g. 500"
                                            className="bg-secondary border-white/10"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Unit</label>
                                        <select
                                            className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                            value={formData.speed_unit}
                                            onChange={e => setFormData(prev => ({ ...prev, speed_unit: e.target.value }))}
                                        >
                                            <option value="Sheets/Hr">Sheets/Hr</option>
                                            <option value="Units/Hr">Units/Hr</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Variants Section */}
                            <div className="border-t border-white/10 pt-4 mt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm text-gray-400">Variants (Optional)</label>
                                    <button type="button" onClick={addVariant} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
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
                                                className="bg-secondary border-white/10 text-sm py-1"
                                            />
                                            <Input
                                                type="number"
                                                step="0.00001"
                                                placeholder="Cost"
                                                value={variant.unit_cost}
                                                onChange={e => updateVariant(index, 'unit_cost', e.target.value)}
                                                className="bg-secondary border-white/10 w-24 text-sm py-1"
                                            />
                                            <button type="button" onClick={() => removeVariant(index)} className="text-gray-500 hover:text-red-400 p-1">
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    ))}
                                    {(!formData.variants || formData.variants.length === 0) && (
                                        <p className="text-xs text-gray-500 italic">No variants added.</p>
                                    )}
                                </div>
                            </div>

                            <Button type="submit" className={`w-full text-black hover:bg-gray-200 mt-2 ${isEditing ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-white'}`}>
                                {isEditing ? 'Update Service' : 'Add Service'}
                            </Button>
                        </form>
                    </section>
                </div>

                {/* List */}
                <div className="lg:col-span-2">
                    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex gap-4">
                            <div className="relative flex-1">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search finishings..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-secondary/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-white/30"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                                        <th className="p-4 font-medium">Service Name</th>
                                        <th className="p-4 font-medium">Details</th>
                                        <th className="p-4 font-medium text-right">Base Cost</th>
                                        <th className="p-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="4" className="p-8 text-center text-gray-500">Loading...</td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan="4" className="p-8 text-center text-gray-500">No services found</td></tr>
                                    ) : (
                                        filtered.map(item => (
                                            <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-medium">{item.name}</td>
                                                <td className="p-4 text-sm text-gray-400">
                                                    <div>
                                                        {item.is_machine
                                                            ? <span className="text-blue-300 block mb-1">Machine: {item.machine_name || 'Unassigned'}</span>
                                                            : <span className="block mb-1 text-green-300">Manual Operation</span>
                                                        }
                                                        {item.speed > 0 && (
                                                            <div className="text-xs text-gray-500 mb-1">
                                                                Speed: {parseFloat(item.speed).toLocaleString()} {item.speed_unit}
                                                            </div>
                                                        )}
                                                        {item.variants && item.variants.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {item.variants.map(v => (
                                                                    <span key={v.id} className="text-xs bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-300">
                                                                        {v.name}: {currency}{parseFloat(v.unit_cost).toFixed(2)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono">
                                                    {currency}{parseFloat(item.unit_cost).toFixed(5)} <span className="text-gray-500 text-xs">/ {item.cost_unit || 'Unit'}</span>
                                                </td>
                                                <td className="p-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="p-2 text-gray-400 hover:text-white transition-colors"
                                                        title="Edit"
                                                    >
                                                        <FiEdit2 />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
