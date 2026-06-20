'use client';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiPlus, FiTrash2, FiSearch, FiEdit2, FiX } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSettings } from '@/components/SettingsContext';

export default function PlatesPage() {
    const { settings } = useSettings();
    const currency = settings.currency;
    const [plates, setPlates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        unit_cost: ''
    });

    useEffect(() => {
        fetchPlates();
    }, []);

    const fetchPlates = async () => {
        try {
            const res = await fetch('/api/plates');
            const data = await res.json();
            setPlates(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = isEditing ? `/api/plates/${editId}` : '/api/plates';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                resetForm();
                fetchPlates();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id) => {
        if (!(await confirmDialog("Are you sure you want to delete this plate?"))) return;
        try {
            const res = await fetch(`/api/plates/${id}`, { method: 'DELETE' });
            if (res.ok) fetchPlates();
        } catch (error) { console.error(error); }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setEditId(item.id);
        setFormData({
            name: item.name,
            unit_cost: item.unit_cost
        });
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setFormData({ name: '', unit_cost: '' });
    };

    const filtered = plates.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="text-white">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter mb-2">Plate Inventory</h1>
                    <p className="text-gray-400">Manage printing plates and costs</p>
                </div>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Form */}
                <div className="lg:col-span-1">
                    <section className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 sticky top-8">
                        <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-2">{isEditing ? <FiEdit2 /> : <FiPlus />} {isEditing ? 'Edit Plate' : 'Add Plate'}</span>
                            {isEditing && (
                                <button onClick={resetForm} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1">
                                    <FiX /> Cancel
                                </button>
                            )}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Plate Name</label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. GTO 52 Plate"
                                    required
                                    className="bg-secondary border-white/10"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Unit Cost ({currency})</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.unit_cost}
                                    onChange={e => setFormData(prev => ({ ...prev, unit_cost: e.target.value }))}
                                    placeholder="0.00"
                                    required
                                    className="bg-secondary border-white/10"
                                />
                            </div>

                            <Button type="submit" className={`w-full text-black hover:bg-gray-200 mt-2 ${isEditing ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-white'}`}>
                                {isEditing ? 'Update Plate' : 'Add Plate'}
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
                                    placeholder="Search plates..."
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
                                        <th className="p-4 font-medium">Plate Name</th>
                                        <th className="p-4 font-medium text-right">Unit Cost</th>
                                        <th className="p-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="3" className="p-8 text-center text-gray-500">Loading...</td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan="3" className="p-8 text-center text-gray-500">No plates found</td></tr>
                                    ) : (
                                        filtered.map(item => (
                                            <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-medium">{item.name}</td>
                                                <td className="p-4 text-right font-mono">{currency}{parseFloat(item.unit_cost).toFixed(2)}</td>
                                                <td className="p-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={async () => handleEdit(item)}
                                                        className="p-2 text-gray-400 hover:text-white transition-colors"
                                                        title="Edit"
                                                    >
                                                        <FiEdit2 />
                                                    </button>
                                                    <button
                                                        onClick={async () => handleDelete(item.id)}
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
