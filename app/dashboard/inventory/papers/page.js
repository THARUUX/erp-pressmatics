'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiBox, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

import { useSettings } from '@/components/SettingsContext';

export default function PapersPage() {
    const { settings } = useSettings();
    const currency = settings.currency;
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'Art',
        cost_per_sheet: 0,
        stock_quantity: 0
    });

    const fetchPapers = () => {
        fetch('/api/papers')
            .then(res => res.json())
            .then(data => {
                setPapers(data);
                setLoading(false);
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchPapers();
    }, []);

    const handleSubmit = async () => {
        try {
            const url = isEditing ? `/api/papers/${editId}` : '/api/papers';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                resetForm();
                fetchPapers();
            } else {
                alert('Operation failed');
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this paper?")) return;
        try {
            const res = await fetch(`/api/papers/${id}`, { method: 'DELETE' });
            if (res.ok) fetchPapers();
            else alert('Failed to delete');
        } catch (error) { console.error(error); }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setEditId(item.id);
        setFormData({
            name: item.name,
            type: item.type,
            cost_per_sheet: item.cost_per_sheet,
            stock_quantity: item.stock_quantity
        });
        setShowAdd(true);
    };

    const resetForm = () => {
        setShowAdd(false);
        setIsEditing(false);
        setEditId(null);
        setFormData({ name: '', type: 'Art', cost_per_sheet: 0, stock_quantity: 0 });
    };

    return (
        <div className="text-white">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tighter">Paper Inventory</h1>
                {!showAdd && (
                    <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-white text-black hover:bg-gray-200">
                        <FiPlus /> Add New Paper
                    </Button>
                )}
            </header>

            {showAdd && (
                <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 mb-8 animate-in fade-in slide-in-from-top-4">
                    <h2 className="text-lg font-bold mb-4 flex justify-between items-center">
                        <span>{isEditing ? 'Edit Paper' : 'Add Paper Stock'}</span>
                        <button onClick={resetForm}><FiX className="text-gray-400 hover:text-white" /></button>
                    </h2>
                    <div className="grid md:grid-cols-4 gap-4">
                        <Input
                            label="Paper Name"
                            className="bg-secondary border-white/10"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                        <Input
                            label="Type"
                            className="bg-secondary border-white/10"
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                        />
                        <Input
                            label="Cost / Sheet"
                            type="number"
                            className="bg-secondary border-white/10"
                            value={formData.cost_per_sheet}
                            onChange={e => setFormData({ ...formData, cost_per_sheet: e.target.value })}
                        />
                        <Input
                            label="Stock Quantity"
                            type="number"
                            className="bg-secondary border-white/10"
                            value={formData.stock_quantity}
                            onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })}
                        />
                        <div className="flex items-end md:col-span-4">
                            <Button onClick={handleSubmit} className="w-full bg-white text-black hover:bg-gray-200 h-[46px]">
                                {isEditing ? 'Update Stock' : 'Save Stock'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                            <th className="p-4 font-semibold text-gray-300">Name</th>
                            <th className="p-4 font-semibold text-gray-300">Type</th>
                            <th className="p-4 font-semibold text-gray-300">Stock Qty</th>
                            <th className="p-4 font-semibold text-gray-300 text-right">Cost Per Sheet</th>
                            <th className="p-4 font-semibold text-gray-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {papers.map(paper => (
                            <tr key={paper.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-medium">{paper.name}</td>
                                <td className="p-4 text-gray-400">{paper.type}</td>
                                <td className="p-4 font-mono">{paper.stock_quantity}</td>
                                <td className="p-4 font-mono text-right text-green-400">{currency}{parseFloat(paper.cost_per_sheet).toFixed(4)}</td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button onClick={() => handleEdit(paper)} className="p-2 text-gray-400 hover:text-white transition-colors"><FiEdit2 /></button>
                                    <button onClick={() => handleDelete(paper.id)} className="p-2 text-gray-500 hover:text-red-400 transition-colors"><FiTrash2 /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
