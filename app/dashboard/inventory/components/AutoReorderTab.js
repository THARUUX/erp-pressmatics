'use client';

import { useState, useEffect } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiRefreshCw, FiShoppingBag, FiInfo, FiSliders, FiDollarSign } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useSettings } from '@/components/SettingsContext';

const inputCls = "bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 outline-none focus:border-white/30 transition-colors w-24 text-center";
const selectCls = "bg-black border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-white/30 transition-colors w-full";

export default function AutoReorderTab() {
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItems, setSelectedItems] = useState({}); // { itemId: true }
    const [selectedSuppliers, setSelectedSuppliers] = useState({}); // { itemId: supplierId }
    const [quantities, setQuantities] = useState({}); // { itemId: qty }
    const [submitting, setSubmitting] = useState(false);

    const fetchLowStock = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/inventory/low-stock');
            if (res.ok) {
                const data = await res.json();
                setItems(data);

                // Initialize defaults
                const initialSelected = {};
                const initialSuppliers = {};
                const initialQtys = {};

                data.forEach(item => {
                    if (item.suppliers && item.suppliers.length > 0) {
                        initialSelected[item.id] = true; // select by default
                        // Default to the first supplier (often the cheapest because API query sorts by price)
                        const defaultSupplier = item.suppliers[0];
                        initialSuppliers[item.id] = defaultSupplier.supplier_id;

                        // Calculate suggested quantity: max(min_stock - stock_quantity, min_order_qty)
                        const needed = Math.max(0, item.min_stock - item.stock_quantity);
                        const suggested = Math.max(needed, defaultSupplier.min_order_qty || 1);
                        initialQtys[item.id] = suggested;
                    }
                });

                setSelectedItems(initialSelected);
                setSelectedSuppliers(initialSuppliers);
                setQuantities(initialQtys);
            } else {
                toast.error('Failed to load low stock items');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error fetching low stock items');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLowStock();
    }, []);

    const handleSupplierChange = (itemId, supplierId, itemSuppliers) => {
        setSelectedSuppliers(prev => ({ ...prev, [itemId]: supplierId }));
        const supplier = itemSuppliers.find(s => String(s.supplier_id) === String(supplierId));
        if (supplier) {
            const item = items.find(i => i.id === itemId);
            const needed = Math.max(0, item.min_stock - item.stock_quantity);
            const suggested = Math.max(needed, supplier.min_order_qty || 1);
            setQuantities(prev => ({ ...prev, [itemId]: suggested }));
        }
    };

    const handleQuantityChange = (itemId, val) => {
        const num = parseFloat(val);
        setQuantities(prev => ({ ...prev, [itemId]: isNaN(num) ? '' : num }));
    };

    const handleToggleSelect = (itemId) => {
        setSelectedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    const handleToggleAll = () => {
        const allSelected = items.every(item => !item.suppliers?.length || selectedItems[item.id]);
        const nextSelected = {};
        items.forEach(item => {
            if (item.suppliers && item.suppliers.length > 0) {
                nextSelected[item.id] = !allSelected;
            }
        });
        setSelectedItems(nextSelected);
    };

    // Calculate PO previews grouped by supplier
    const getPOPreviews = () => {
        const poMap = {};
        items.forEach(item => {
            if (selectedItems[item.id] && item.suppliers?.length) {
                const supplierId = selectedSuppliers[item.id];
                const supplier = item.suppliers.find(s => String(s.supplier_id) === String(supplierId));
                const qty = parseFloat(quantities[item.id]) || 0;

                if (supplier && qty > 0) {
                    if (!poMap[supplierId]) {
                        poMap[supplierId] = {
                            supplier_id: supplierId,
                            supplier_name: supplier.supplier_name,
                            supplier_code: supplier.supplier_code,
                            items: []
                        };
                    }
                    poMap[supplierId].items.push({
                        inventory_item_id: item.id,
                        supplier_item_id: supplier.supplier_item_id,
                        item_name: supplier.supplier_item_name || item.name,
                        quantity: qty,
                        unit_price: supplier.unit_price,
                        uom: supplier.sku ? `${item.uom} (${supplier.sku})` : item.uom
                    });
                }
            }
        });
        return Object.values(poMap);
    };

    const poPreviews = getPOPreviews();
    const totalOrdersToCreate = poPreviews.length;
    const totalLinesToCreate = poPreviews.reduce((acc, po) => acc + po.items.length, 0);

    const handleGeneratePOs = async () => {
        if (poPreviews.length === 0) {
            toast.error('Please select at least one item to order');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/purchase-orders/auto-reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orders: poPreviews })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                const poNumbers = data.createdPOs.map(po => po.po_number).join(', ');
                toast.success(`Successfully created draft PO(s): ${poNumbers}`);
                fetchLowStock();
            } else {
                toast.error(data.error || 'Failed to generate Purchase Orders');
            }
        } catch (err) {
            console.error(err);
            toast.error('An error occurred while generating Purchase Orders');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="py-16 text-center text-gray-500 animate-pulse text-sm flex flex-col items-center justify-center gap-2">
                <FiRefreshCw className="animate-spin w-5 h-5 text-indigo-400" />
                Loading replenishment recommendations…
            </div>
        );
    }

    const unlinkedItems = items.filter(i => !i.suppliers || i.suppliers.length === 0);
    const reorderableItems = items.filter(i => i.suppliers && i.suppliers.length > 0);

    return (
        <div className="space-y-6">
            {/* Header / Summary Card */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <FiShoppingBag className="text-indigo-400" />
                        Stock Replenishment Engine
                    </h3>
                    <p className="text-xs text-white/40 mt-1">
                        We found {items.length} items below minimum stock level. {reorderableItems.length} items are linked to suppliers and ready for auto-reordering.
                    </p>
                </div>
                {reorderableItems.length > 0 && (
                    <button
                        onClick={handleGeneratePOs}
                        disabled={submitting || totalOrdersToCreate === 0}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/10"
                    >
                        {submitting ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiCheckCircle className="w-4 h-4" />
                        )}
                        {submitting ? 'Generating POs...' : `Generate ${totalOrdersToCreate} Draft PO${totalOrdersToCreate !== 1 ? 's' : ''}`}
                    </button>
                )}
            </div>

            {/* Main Table */}
            {reorderableItems.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl space-y-2">
                    <FiCheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-gray-400 text-sm">All linked inventory items have sufficient stock!</p>
                </div>
            ) : (
                <div className="bg-black/20 border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse text-left">
                            <thead>
                                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                    <th className="px-4 py-3 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={reorderableItems.every(i => selectedItems[i.id])}
                                            onChange={handleToggleAll}
                                            className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">Item Details</th>
                                    <th className="px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider text-center">Current Stock</th>
                                    <th className="px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider text-center">Min Threshold</th>
                                    <th className="px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider">Supplier</th>
                                    <th className="px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider text-center">Reorder Qty</th>
                                    <th className="px-4 py-3 text-white/40 font-semibold text-xs uppercase tracking-wider text-right">Est. Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {reorderableItems.map(item => {
                                    const isSelected = !!selectedItems[item.id];
                                    const activeSupId = selectedSuppliers[item.id];
                                    const activeSup = item.suppliers.find(s => String(s.supplier_id) === String(activeSupId));
                                    const qty = quantities[item.id] || 0;
                                    const price = activeSup ? activeSup.unit_price : 0;
                                    const lineCost = qty * price;

                                    return (
                                        <tr key={item.id} className={`hover:bg-white/[0.01] transition-colors ${isSelected ? 'bg-indigo-500/[0.02]' : ''}`}>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelect(item.id)}
                                                    className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-white">{item.name}</div>
                                                <div className="text-[10px] text-white/35 flex items-center gap-1.5 mt-0.5">
                                                    <span>{item.category}</span>
                                                    <span>•</span>
                                                    <span>{item.type || 'Standard'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono text-red-400 font-semibold">{item.stock_quantity} {item.uom}</td>
                                            <td className="px-4 py-3 text-center font-mono text-white/50">{item.min_stock} {item.uom}</td>
                                            <td className="px-4 py-3 min-w-[200px]">
                                                {item.suppliers.length === 1 ? (
                                                    <div className="text-xs">
                                                        <span className="font-semibold text-white block">{item.suppliers[0].supplier_name}</span>
                                                        <span className="text-[10px] text-white/40 block mt-0.5">
                                                            {currency} {item.suppliers[0].unit_price.toFixed(4)} / {item.uom} (Min order: {item.suppliers[0].min_order_qty})
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={activeSupId}
                                                        onChange={e => handleSupplierChange(item.id, e.target.value, item.suppliers)}
                                                        className={selectCls}
                                                    >
                                                        {item.suppliers.map(s => (
                                                            <option key={s.supplier_id} value={s.supplier_id}>
                                                                {s.supplier_name} ({currency} {s.unit_price.toFixed(2)})
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={quantities[item.id] ?? ''}
                                                    onChange={e => handleQuantityChange(item.id, e.target.value)}
                                                    className={inputCls}
                                                />
                                                {activeSup && qty < activeSup.min_order_qty && (
                                                    <div className="text-[9px] text-amber-500 font-medium mt-1">
                                                        Min order is {activeSup.min_order_qty}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                                                {currency} {lineCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Unlinked Items Warning */}
            {unlinkedItems.length > 0 && (
                <div className="bg-amber-500/[0.02] border border-amber-500/20 rounded-2xl p-5 space-y-3">
                    <div className="flex items-start gap-3">
                        <FiAlertTriangle className="text-amber-500 w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-white">Low Stock Items Missing Supplier Links ({unlinkedItems.length})</h4>
                            <p className="text-xs text-white/50 mt-1">
                                The following items are below minimum stock, but no suppliers have them registered in their catalog. Go to the Supplier Catalog tab to link them.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {unlinkedItems.map(item => (
                            <span key={item.id} className="text-[10px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-gray-400">
                                {item.name} (Stock: {item.stock_quantity}/{item.min_stock})
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
