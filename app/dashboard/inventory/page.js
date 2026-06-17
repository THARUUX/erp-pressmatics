'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiFilter, FiCopy, FiAlertTriangle, FiClock } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSettings } from '@/components/SettingsContext';

const CATEGORIES = ['Paper', 'Plate', 'Ink', 'SF', 'RM', 'FG'];

export default function InventoryPage() {
    const { settings } = useSettings();
    const currency = settings.currency;
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [activeCategory, setActiveCategory] = useState('Paper');

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        item_code: '',
        category: 'Paper',
        type: '',
        uom: 'Sheet',
        unit_cost: 0,
        stock_quantity: 0,
        min_stock: 0,
        width_cm: '',
        height_cm: ''
    });

    const [restockItem, setRestockItem] = useState(null);
    const [restockData, setRestockData] = useState({ quantity: 0, notes: '' });

    const [historyItem, setHistoryItem] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const handleViewHistory = async (item) => {
        setHistoryItem(item);
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/inventory/${item.id}/history`);
            if (res.ok) {
                const data = await res.json();
                setHistoryData(data);
            } else {
                setHistoryData([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistory(false);
        }
    };



    const fetchItems = () => {
        setLoading(true);
        fetch(`/api/inventory?category=${activeCategory}`)
            .then(res => res.json())
            .then(data => {
                setItems(data);
                setLoading(false);
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchItems();
    }, [activeCategory]);

    const handleSubmit = async () => {
        try {
            const url = isEditing ? `/api/inventory/${editId}` : '/api/inventory';
            const method = isEditing ? 'PUT' : 'POST';

            // Ensure category is set from active tab if creating new
            const payload = { ...formData, category: isEditing ? formData.category : activeCategory };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                resetForm();
                fetchItems();
            } else {
                alert('Operation failed');
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred');
        }
    };

    const handleRestock = async () => {
        if (!restockItem) return;
        try {
            const res = await fetch('/api/inventory/restock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: restockItem.id,
                    quantity: restockData.quantity,
                    notes: restockData.notes
                })
            });

            if (res.ok) {
                setRestockItem(null);
                setRestockData({ quantity: 0, notes: '' });
                fetchItems();
            } else {
                alert('Restock failed');
            }
        } catch (error) {
            console.error(error);
            alert('Restock error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this item?")) return;
        try {
            const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
            if (res.ok) fetchItems();
            else {
                const data = await res.json();
                alert(data.error || 'Failed to delete');
            }
        } catch (error) { console.error(error); }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setEditId(item.id);
        setFormData({
            name: item.name,
            item_code: item.item_code || '',
            category: item.category,
            type: item.type,
            uom: item.uom || 'Sheet',
            unit_cost: item.unit_cost,
            stock_quantity: item.stock_quantity,
            min_stock: item.min_stock || 0,
            width_cm: item.width_cm || '',
            height_cm: item.height_cm || ''
        });
        setShowAdd(true);
    };

    const handleCopy = (item) => {
        setIsEditing(false); // It's a new item
        setEditId(null);
        setFormData({
            name: `${item.name} (Copy)`,
            item_code: '', // Reset to allow auto-generation
            category: item.category,
            type: item.type,
            uom: item.uom || 'Sheet',
            unit_cost: item.unit_cost,
            stock_quantity: item.stock_quantity,
            min_stock: item.min_stock || 0,
            width_cm: item.width_cm || '',
            height_cm: item.height_cm || ''
        });
        setShowAdd(true);
    };

    const resetForm = () => {
        setShowAdd(false);
        setIsEditing(false);
        setEditId(null);
        setFormData({
            name: '',
            item_code: '',
            category: activeCategory, // Reset to active category
            type: '',
            uom: 'Sheet',
            unit_cost: 0,
            stock_quantity: 0,
            min_stock: 0,
            width_cm: '',
            height_cm: ''
        });
    };

    return (
        <div className="text-white">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tighter">Inventory</h1>
                {!showAdd && (
                    <Button onClick={() => { resetForm(); setShowAdd(true); }} className="flex items-center gap-2 bg-white text-black hover:bg-gray-200">
                        <FiPlus /> Add Item
                    </Button>
                )}
            </header>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-white/10">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === cat
                            ? 'bg-white text-black'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {showAdd && (
                <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 mb-8 animate-in fade-in slide-in-from-top-4">
                    <h2 className="text-lg font-bold mb-4 flex justify-between items-center">
                        <span>{isEditing ? 'Edit Item' : `Add ${activeCategory}`}</span>
                        <button onClick={resetForm}><FiX className="text-gray-400 hover:text-white" /></button>
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <Input
                            label="Item Code"
                            className="bg-secondary border-white/10"
                            value={formData.item_code}
                            onChange={e => setFormData({ ...formData, item_code: e.target.value })}
                            placeholder="Auto-generated if empty"
                        />
                        <Input
                            label="Name"
                            className="bg-secondary border-white/10"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                        {/* Type Selection */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-400">Type</label>
                            {activeCategory === 'Paper' ? (
                                <select
                                    className="w-full bg-secondary border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="">Select Paper Type</option>
                                    <option value="OFFSET">OFFSET</option>
                                    <option value="DIGITAL">DIGITAL</option>
                                    <option value="BOTH">BOTH</option>
                                </select>
                            ) : (
                                <div className="relative">
                                    <input
                                        list="type-suggestions"
                                        className="w-full bg-secondary border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        placeholder="Select or type..."
                                    />
                                    <datalist id="type-suggestions">
                                        <option value="Art" />
                                        <option value="Bond" />
                                        <option value="Gloss" />
                                        <option value="Matte" />
                                        <option value="Offset Plate" />
                                        <option value="Digital Plate" />
                                        <option value="Cyan" />
                                        <option value="Magenta" />
                                        <option value="Yellow" />
                                        <option value="Black" />
                                    </datalist>
                                </div>
                            )}
                        </div>

                        {activeCategory === 'Paper' && (
                            <>
                                <Input
                                    label="Width (cm)"
                                    type="number"
                                    step="0.01"
                                    className="bg-secondary border-white/10"
                                    value={formData.width_cm}
                                    onChange={e => setFormData({ ...formData, width_cm: e.target.value })}
                                />
                                <Input
                                    label="Height (cm)"
                                    type="number"
                                    step="0.01"
                                    className="bg-secondary border-white/10"
                                    value={formData.height_cm}
                                    onChange={e => setFormData({ ...formData, height_cm: e.target.value })}
                                />
                            </>
                        )}

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-400">UoM</label>
                            <input
                                list="uom-suggestions"
                                className="w-full bg-secondary border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                                value={formData.uom}
                                onChange={e => setFormData({ ...formData, uom: e.target.value })}
                            />
                            <datalist id="uom-suggestions">
                                <option value="Sheet" />
                                <option value="Kg" />
                                <option value="Ltr" />
                                <option value="Unit" />
                                <option value="Packet" />
                                <option value="Box" />
                                <option value="Roll" />
                            </datalist>
                        </div>

                        <Input
                            label="Unit Cost"
                            type="number"
                            step="0.00001"
                            className="bg-secondary border-white/10"
                            value={formData.unit_cost}
                            onChange={e => setFormData({ ...formData, unit_cost: e.target.value })}
                        />
                        <Input
                            label="Stock Quantity"
                            type="number"
                            className="bg-secondary border-white/10"
                            value={formData.stock_quantity}
                            onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })}
                        />
                        <Input
                            label="Min Stock"
                            type="number"
                            className="bg-secondary border-white/10"
                            value={formData.min_stock}
                            onChange={e => setFormData({ ...formData, min_stock: e.target.value })}
                        />
                        <div className="flex items-end">
                            <Button onClick={handleSubmit} className="w-full bg-white text-black hover:bg-gray-200 h-[46px]">
                                {isEditing ? 'Update' : 'Save'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Restock Modal */}
            {restockItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                        <h2 className="text-xl font-bold mb-4">Restock Issue Note</h2>
                        <div className="mb-4 text-sm text-gray-400">
                            Updating stock for: <span className="text-white font-semibold">{restockItem.name}</span>
                        </div>
                        <div className="space-y-4">
                            <Input
                                label="Quantity to Add"
                                type="number"
                                autoFocus
                                value={restockData.quantity}
                                onChange={e => setRestockData({ ...restockData, quantity: e.target.value })}
                                className="bg-black/40 border-white/10"
                            />
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Notes / Reference</label>
                                <Input
                                    value={restockData.notes}
                                    onChange={e => setRestockData({ ...restockData, notes: e.target.value })}
                                    className="bg-black/40 border-white/10"
                                    placeholder="e.g. PO #123"
                                />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <Button onClick={() => setRestockItem(null)} className="flex-1 bg-transparent border border-white/10 hover:bg-white/5">Cancel</Button>
                                <Button onClick={handleRestock} className="flex-1 bg-green-600 hover:bg-green-500 text-white">Save Issue Note</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {historyItem && !restockItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Transaction History: {historyItem.name}</h2>
                            <button onClick={() => setHistoryItem(null)}><FiX className="text-gray-400 hover:text-white" /></button>
                        </div>

                        <div className="overflow-y-auto flex-1 pr-2">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-gray-400 sticky top-0">
                                    <tr>
                                        <th className="p-3 rounded-tl-lg">Date</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3 text-right">Qty</th>
                                        <th className="p-3 rounded-tr-lg">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loadingHistory ? (
                                        <tr><td colSpan="4" className="p-4 text-center text-gray-500">Loading history...</td></tr>
                                    ) : historyData.length === 0 ? (
                                        <tr><td colSpan="4" className="p-4 text-center text-gray-500">No transactions found.</td></tr>
                                    ) : (
                                        historyData.map(log => (
                                            <tr key={log.id} className="hover:bg-white/5">
                                                <td className="p-3 text-gray-400">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${log.type === 'issue_note' ? 'bg-green-500/20 text-green-300' :
                                                        log.type === 'usage' ? 'bg-blue-500/20 text-blue-300' :
                                                            'bg-gray-500/20 text-gray-300'
                                                        }`}>
                                                        {log.type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className={`p-3 text-right font-mono ${log.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {log.quantity > 0 ? '+' : ''}{parseFloat(log.quantity)}
                                                </td>
                                                <td className="p-3 text-gray-300">{log.notes}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                            <th className="p-4 font-semibold text-gray-300">Code</th>
                            <th className="p-4 font-semibold text-gray-300">Name</th>
                            <th className="p-4 font-semibold text-gray-300">Type</th>
                            <th className="p-4 font-semibold text-gray-300">UoM</th>
                            <th className="p-4 font-semibold text-gray-300">Stock Qty</th>
                            <th className="p-4 font-semibold text-gray-300 text-right">Unit Cost</th>
                            <th className="p-4 font-semibold text-gray-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan="7" className="p-8 text-center text-gray-500">Loading...</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-gray-500">No items found in {activeCategory}</td></tr>
                        ) : (
                            items.map(item => {
                                const isLowStock = item.stock_quantity < (item.min_stock || 0);
                                const isInactive = item.is_active === 0;

                                return (
                                    <tr key={item.id} className={`hover:bg-white/5 transition-colors ${isLowStock ? 'bg-red-900/10' : ''} ${isInactive ? 'opacity-50' : ''}`}>
                                        <td className="p-4 font-mono text-gray-400 text-sm">
                                            {item.item_code}
                                            {isInactive && <span className="ml-2 text-[10px] bg-red-500/20 text-red-300 px-1 rounded uppercase">Inactive</span>}
                                        </td>
                                        <td className="p-4 font-medium">
                                            {item.name}
                                            {isLowStock && <div className="text-[10px] text-red-400 mt-0.5">Low Stock (Min: {item.min_stock})</div>}
                                        </td>
                                        <td className="p-4 text-gray-400">{item.type}</td>
                                        <td className="p-4 text-gray-400 text-sm">{item.uom}</td>
                                        <td className={`p-4 font-mono ${isLowStock ? 'text-red-400 font-bold' : ''}`}>{item.stock_quantity}</td>
                                        <td className="p-4 font-mono text-right text-green-400">{currency}{parseFloat(item.unit_cost).toFixed(5)}</td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <Button
                                                onClick={() => setRestockItem(item)}
                                                className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 mr-2"
                                            >
                                                Restock
                                            </Button>
                                            <button onClick={() => handleViewHistory(item)} className="p-2 text-gray-400 hover:text-purple-400 transition-colors" title="History"><FiClock /></button>
                                            <button onClick={() => handleCopy(item)} className="p-2 text-gray-400 hover:text-blue-400 transition-colors" title="Copy"><FiCopy /></button>
                                            <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-white transition-colors" title="Edit"><FiEdit2 /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-500 hover:text-red-400 transition-colors" title="Delete"><FiTrash2 /></button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
