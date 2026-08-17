'use client';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

import { useState, useEffect, useMemo } from 'react';
import {
    FiPlus, FiBox, FiEdit2, FiTrash2, FiX, FiLayers, FiZap,
    FiSearch, FiAlertTriangle, FiCheckCircle, FiGrid
} from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

import { useSettings } from '@/components/SettingsContext';

export default function PapersPage() {
    const { settings } = useSettings();
    const currency = settings.currency;
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [activeTab, setActiveTab] = useState('All'); // 'All', 'Offset', 'Digital'
    const [searchQuery, setSearchQuery] = useState('');

    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'Offset', // 'Offset', 'Digital', 'Both'
        type: 'Art',
        cost_per_sheet: 0,
        stock_quantity: 0,
        min_stock: 0
    });

    const fetchPapers = () => {
        fetch('/api/papers')
            .then(res => res.json())
            .then(data => {
                setPapers(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchPapers();
    }, []);

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast.error('Paper Name is required');
            return;
        }

        try {
            const url = isEditing ? `/api/papers/${editId}` : '/api/papers';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(isEditing ? 'Paper updated successfully' : 'Paper added to stock');
                resetForm();
                fetchPapers();
            } else {
                toast.error('Operation failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        }
    };

    const handleDelete = async (id) => {
        if (!(await confirmDialog("Delete this paper stock item?"))) return;
        try {
            const res = await fetch(`/api/papers/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Paper stock deleted');
                fetchPapers();
            } else {
                toast.error('Failed to delete paper');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setEditId(item.id);
        setFormData({
            name: item.name || '',
            category: item.category || (item.type?.toUpperCase() === 'DIGITAL' ? 'Digital' : 'Offset'),
            type: item.type || 'Art',
            cost_per_sheet: item.cost_per_sheet || 0,
            stock_quantity: item.stock_quantity || 0,
            min_stock: item.min_stock || 0
        });
        setShowAdd(true);
    };

    const resetForm = () => {
        setShowAdd(false);
        setIsEditing(false);
        setEditId(null);
        setFormData({
            name: '',
            category: activeTab === 'Digital' ? 'Digital' : 'Offset',
            type: 'Art',
            cost_per_sheet: 0,
            stock_quantity: 0,
            min_stock: 0
        });
    };

    // Filter papers according to active tab and search query
    const filteredPapers = useMemo(() => {
        return papers.filter(paper => {
            const cat = (paper.category || '').toUpperCase();
            const type = (paper.type || '').toUpperCase();

            let matchesTab = true;
            if (activeTab === 'Offset') {
                matchesTab = cat === 'OFFSET' || cat === 'BOTH' || (!cat && type !== 'DIGITAL');
            } else if (activeTab === 'Digital') {
                matchesTab = cat === 'DIGITAL' || cat === 'BOTH' || (!cat && type === 'DIGITAL');
            }

            const matchesSearch = !searchQuery.trim() ||
                paper.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (paper.type || '').toLowerCase().includes(searchQuery.toLowerCase());

            return matchesTab && matchesSearch;
        });
    }, [papers, activeTab, searchQuery]);

    // Calculate metrics based on currently filtered papers
    const stats = useMemo(() => {
        const totalItems = filteredPapers.length;
        const totalSheets = filteredPapers.reduce((acc, p) => acc + (parseInt(p.stock_quantity) || 0), 0);

        const offsetPapers = filteredPapers.filter(p => {
            const cat = (p.category || '').toUpperCase();
            const type = (p.type || '').toUpperCase();
            return cat === 'OFFSET' || cat === 'BOTH' || (!cat && type !== 'DIGITAL');
        });

        const digitalPapers = filteredPapers.filter(p => {
            const cat = (p.category || '').toUpperCase();
            const type = (p.type || '').toUpperCase();
            return cat === 'DIGITAL' || cat === 'BOTH' || (!cat && type === 'DIGITAL');
        });

        const offsetSheets = offsetPapers.reduce((acc, p) => acc + (parseInt(p.stock_quantity) || 0), 0);
        const digitalSheets = digitalPapers.reduce((acc, p) => acc + (parseInt(p.stock_quantity) || 0), 0);

        const lowStockCount = filteredPapers.filter(p => (parseInt(p.stock_quantity) || 0) < (parseInt(p.min_stock) || 0)).length;

        return {
            totalItems,
            totalSheets,
            offsetItems: offsetPapers.length,
            offsetSheets,
            digitalItems: digitalPapers.length,
            digitalSheets,
            lowStockCount
        };
    }, [filteredPapers]);

    const renderCategoryBadge = (paper) => {
        const cat = (paper.category || '').toUpperCase();
        const type = (paper.type || '').toUpperCase();

        if (cat === 'BOTH') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    Universal (Both)
                </span>
            );
        }

        if (cat === 'DIGITAL' || (!cat && type === 'DIGITAL')) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <FiZap className="w-3 h-3 text-amber-400" />
                    Digital
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <FiLayers className="w-3 h-3 text-emerald-400" />
                Offset
            </span>
        );
    };

    return (
        <div className="text-white space-y-8">
            {/* Page Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <FiBox className="text-emerald-400" /> Paper Stock Inventory
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Separate and manage Offset &amp; Digital paper stocks, cost metrics, and stock thresholds.
                    </p>
                </div>
                {!showAdd && (
                    <Button
                        onClick={() => {
                            resetForm();
                            setShowAdd(true);
                        }}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-4 py-2.5 rounded-xl shadow-lg transition-all"
                    >
                        <FiPlus className="text-lg" /> Add Paper Stock
                    </Button>
                )}
            </header>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/[0.03] backdrop-blur-md p-5 rounded-2xl border border-white/10 flex flex-col justify-between shadow-xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Stock</span>
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-300">
                            <FiGrid className="text-base" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-bold text-white font-mono">{stats.totalItems}</span>
                        <span className="text-xs text-gray-400 ml-2">items</span>
                        <p className="text-xs font-mono text-gray-400 mt-1">{stats.totalSheets.toLocaleString()} sheets total</p>
                    </div>
                </div>

                <div className="bg-emerald-500/[0.04] backdrop-blur-md p-5 rounded-2xl border border-emerald-500/20 flex flex-col justify-between shadow-xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Offset Papers</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <FiLayers className="text-base" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-bold text-emerald-400 font-mono">{stats.offsetItems}</span>
                        <span className="text-xs text-emerald-400/70 ml-2">items</span>
                        <p className="text-xs font-mono text-emerald-400/80 mt-1">{stats.offsetSheets.toLocaleString()} sheets</p>
                    </div>
                </div>

                <div className="bg-amber-500/[0.04] backdrop-blur-md p-5 rounded-2xl border border-amber-500/20 flex flex-col justify-between shadow-xl">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Digital Papers</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                            <FiZap className="text-base" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-bold text-amber-400 font-mono">{stats.digitalItems}</span>
                        <span className="text-xs text-amber-400/70 ml-2">items</span>
                        <p className="text-xs font-mono text-amber-400/80 mt-1">{stats.digitalSheets.toLocaleString()} sheets</p>
                    </div>
                </div>

                <div className={`backdrop-blur-md p-5 rounded-2xl border flex flex-col justify-between shadow-xl ${
                    stats.lowStockCount > 0
                        ? 'bg-red-500/[0.06] border-red-500/30'
                        : 'bg-white/[0.03] border-white/10'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium uppercase tracking-wider ${stats.lowStockCount > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            Low Stock Alert
                        </span>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats.lowStockCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-gray-300'}`}>
                            {stats.lowStockCount > 0 ? <FiAlertTriangle className="text-base" /> : <FiCheckCircle className="text-base text-emerald-400" />}
                        </div>
                    </div>
                    <div className="mt-3">
                        <span className={`text-2xl font-bold font-mono ${stats.lowStockCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {stats.lowStockCount}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">items low</span>
                        <p className="text-xs text-gray-400 mt-1">{stats.lowStockCount > 0 ? 'Below minimum threshold' : 'All stock levels healthy'}</p>
                    </div>
                </div>
            </div>

            {/* Add / Edit Paper Form Modal / Card */}
            {showAdd && (
                <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/15 shadow-2xl animate-in fade-in slide-in-from-top-4 space-y-4">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            {isEditing ? <FiEdit2 className="text-emerald-400" /> : <FiPlus className="text-emerald-400" />}
                            <span>{isEditing ? 'Edit Paper Stock' : 'Add New Paper Stock'}</span>
                        </h2>
                        <button onClick={resetForm} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all">
                            <FiX className="text-xl" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                                Paper Name <span className="text-red-400">*</span>
                            </label>
                            <Input
                                placeholder="e.g. Art Paper 130gsm"
                                className="bg-secondary border-white/10 focus:border-emerald-500/50"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                                Category / Method
                            </label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-secondary border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                            >
                                <option value="Offset">🖨️ Offset Only</option>
                                <option value="Digital">⚡ Digital Only</option>
                                <option value="Both">🌐 Both (Universal)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                                Paper Type / Material
                            </label>
                            <Input
                                placeholder="e.g. Art, Board, Bond"
                                className="bg-secondary border-white/10"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                                Cost / Sheet ({currency})
                            </label>
                            <Input
                                type="number"
                                step="0.0001"
                                placeholder="0.0000"
                                className="bg-secondary border-white/10 font-mono text-emerald-400"
                                value={formData.cost_per_sheet}
                                onChange={e => setFormData({ ...formData, cost_per_sheet: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                                Stock Quantity
                            </label>
                            <Input
                                type="number"
                                placeholder="0"
                                className="bg-secondary border-white/10 font-mono"
                                value={formData.stock_quantity}
                                onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                                Min Stock Threshold
                            </label>
                            <Input
                                type="number"
                                placeholder="0"
                                className="bg-secondary border-white/10 font-mono"
                                value={formData.min_stock}
                                onChange={e => setFormData({ ...formData, min_stock: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-6 flex justify-end gap-3 pt-2">
                            <button
                                onClick={resetForm}
                                className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-gray-300 text-sm transition-all"
                            >
                                Cancel
                            </button>
                            <Button
                                onClick={handleSubmit}
                                className="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-6 py-2.5 rounded-xl shadow-lg transition-all"
                            >
                                {isEditing ? 'Update Paper Stock' : 'Save Paper Stock'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Tabs & Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10 self-start">
                    <button
                        onClick={() => setActiveTab('All')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === 'All'
                                ? 'bg-white text-black shadow-md'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <FiGrid className="text-base" />
                        <span>All Papers</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${activeTab === 'All' ? 'bg-black/10 text-black' : 'bg-white/10 text-gray-300'}`}>
                            {stats.totalItems}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('Offset')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === 'Offset'
                                ? 'bg-emerald-500 text-black shadow-md'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <FiLayers className="text-base" />
                        <span>Offset Papers</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${activeTab === 'Offset' ? 'bg-black/20 text-black' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {stats.offsetItems}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('Digital')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === 'Digital'
                                ? 'bg-amber-500 text-black shadow-md'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <FiZap className="text-base" />
                        <span>Digital Papers</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${activeTab === 'Digital' ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-400'}`}>
                            {stats.digitalItems}
                        </span>
                    </button>
                </div>

                <div className="relative min-w-[260px]">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
                    <input
                        type="text"
                        placeholder="Search paper by name or type..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-all"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Paper Inventory Data Table */}
            <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/[0.04] border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                            <tr>
                                <th className="p-4 font-semibold">Paper Name</th>
                                <th className="p-4 font-semibold">Category</th>
                                <th className="p-4 font-semibold">Type</th>
                                <th className="p-4 font-semibold">Stock Qty</th>
                                <th className="p-4 font-semibold">Min Threshold</th>
                                <th className="p-4 font-semibold text-right">Cost Per Sheet</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-gray-500 italic">
                                        Loading paper inventory...
                                    </td>
                                </tr>
                            ) : filteredPapers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-gray-500 italic">
                                        {searchQuery
                                            ? `No papers found matching "${searchQuery}"`
                                            : `No paper stock found in ${activeTab === 'All' ? 'inventory' : activeTab + ' category'}`}
                                    </td>
                                </tr>
                            ) : (
                                filteredPapers.map(paper => {
                                    const isLowStock = (parseInt(paper.stock_quantity) || 0) < (parseInt(paper.min_stock) || 0);
                                    return (
                                        <tr key={paper.id} className="hover:bg-white/[0.03] transition-colors group">
                                            <td className="p-4 font-medium text-white">
                                                <div className="flex items-center gap-2">
                                                    <span>{paper.name}</span>
                                                    {isLowStock && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20">
                                                            <FiAlertTriangle className="w-3 h-3" /> Low Stock
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {renderCategoryBadge(paper)}
                                            </td>
                                            <td className="p-4 text-gray-400 font-mono text-xs">
                                                {paper.type || 'Standard'}
                                            </td>
                                            <td className="p-4 font-mono font-semibold">
                                                <span className={isLowStock ? 'text-red-400 font-bold' : 'text-white'}>
                                                    {(parseInt(paper.stock_quantity) || 0).toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-gray-400 text-xs">
                                                {(parseInt(paper.min_stock) || 0).toLocaleString()}
                                            </td>
                                            <td className="p-4 font-mono text-right text-emerald-400 font-bold">
                                                {currency}{parseFloat(paper.cost_per_sheet || 0).toFixed(4)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleEdit(paper)}
                                                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                        title="Edit Paper"
                                                    >
                                                        <FiEdit2 className="text-base" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(paper.id)}
                                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Delete Paper"
                                                    >
                                                        <FiTrash2 className="text-base" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
