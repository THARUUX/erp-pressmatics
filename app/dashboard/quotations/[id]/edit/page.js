'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiCopy, FiTrash2, FiSave, FiRefreshCw } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input'; // Assuming Input component exists
import { useSettings } from '@/components/SettingsContext';

export default function EditQuotationPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || '$';

    const [quote, setQuote] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const fetchQuote = async () => {
        try {
            const res = await fetch(`/api/quotations/${id}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setQuote(data);
            setItems(data.items || []);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuote();
    }, [id]);

    const handleDeleteItem = async (itemId) => {
        if (!confirm("Are you sure you want to remove this item from the quotation?")) return;
        setProcessing(true);
        try {
            const res = await fetch(`/api/quotations/${id}/items/${itemId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchQuote();
            } else {
                alert('Failed to delete item');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleDuplicateItem = async (itemId) => {
        if (!confirm("Duplicate this item?")) return;
        setProcessing(true);
        try {
            const res = await fetch(`/api/quotations/${id}/items/duplicate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId })
            });
            if (res.ok) {
                fetchQuote(); // Refresh list
            } else {
                alert('Failed to duplicate');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleQuantityChange = async (itemId, newQty) => {
        // Optimistic UI update? No, prefer safe recalculation on blur/enter
        // For now just update local state to allow typing
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i));
    };

    const handleRecalculate = async (itemId, newQty) => {
        setProcessing(true);
        try {
            // Logic: 
            // 1. We need to call an endpoint that Re-calculates this item with new Quantity.
            // Since we built a '/api/items/calculate' that takes components, we could use that BUT we want to update the DB too.
            // Best: Create a dedicated 'recalculate' endpoint for an existing item
            // OR use a general update endpoint.
            // Let's assume we call a new route: /api/quotations/[id]/items/[itemId]/recalculate

            const res = await fetch(`/api/quotations/${id}/items/${itemId}/recalculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: newQty })
            });

            if (res.ok) {
                fetchQuote();
            } else {
                alert('Recalculation failed');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (!quote) return <div className="text-white p-8">Quotation not found</div>;

    return (
        <div className="min-h-screen bg-transparent text-white p-8">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/quotations">
                        <Button className="bg-transparent border border-white/10 hover:bg-white/10 p-2">
                            <FiArrowLeft />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tighter">Edit Quotation #{quote.id}</h1>
                        <p className="text-gray-400 text-sm">{quote.customer_name}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => router.push(`/dashboard/quotations/${id}`)} className="bg-white/10 hover:bg-white/20">
                        View / Print
                    </Button>
                    <Button className="bg-white text-black">
                        <FiSave className="mr-2" /> Save Changes
                    </Button>
                </div>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="lg:col-span-2 space-y-4">
                        {/* Items List */}
                        {items.map((item, index) => (
                            <div key={item.id} className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 relative group">
                                {/* ... item content ... (I should not replace this whole block to avoid complexity, but I need to append below items) */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <input
                                            type="text"
                                            defaultValue={item.estimation_name || item.job_description}
                                            onBlur={(e) => {
                                                const val = e.target.value;
                                                if (val !== item.estimation_name) {
                                                    // Trigger update name
                                                    fetch(`/api/quotations/${id}/items/${item.id}/recalculate`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ estimation_name: val })
                                                    }).then(res => {
                                                        if (res.ok) fetchQuote();
                                                    });
                                                }
                                            }}
                                            className="font-bold text-lg bg-transparent border-b border-transparent hover:border-white/30 focus:border-blue-500 focus:bg-black/20 outline-none transition-all w-full"
                                        />
                                        <div className="text-sm text-gray-500 font-mono">{item.code}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDuplicateItem(item.id)}
                                            disabled={processing}
                                            className="p-2 hover:bg-white/10 rounded transition-colors text-blue-400"
                                            title="Duplicate Item"
                                        >
                                            <FiCopy />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            disabled={processing}
                                            className="p-2 hover:bg-white/10 rounded transition-colors text-red-400"
                                            title="Remove Item"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-3 gap-6 items-end">
                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase mb-1">Quantity</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                onBlur={(e) => handleRecalculate(item.id, e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleRecalculate(item.id, e.currentTarget.value)}
                                                className="bg-black/20 border border-white/10 rounded px-3 py-2 w-full text-white focus:border-blue-500 outline-none"
                                            />
                                            <div className="absolute right-2 top-2.5 text-xs text-gray-500 pointer-events-none">
                                                {processing ? '...' : <FiRefreshCw />}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-400 uppercase mb-1">Tax Mode</label>
                                        <select
                                            value={item.tax_mode || 'none'}
                                            onChange={(e) => {
                                                // Optimistic update
                                                const newMode = e.target.value;
                                                setItems(prev => prev.map(i => i.id === item.id ? { ...i, tax_mode: newMode } : i));
                                                // Trigger Recalc
                                                fetch(`/api/quotations/${id}/items/${item.id}/recalculate`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ quantity: item.quantity, tax_mode: newMode })
                                                }).then(res => {
                                                    if (res.ok) fetchQuote();
                                                });
                                            }}
                                            className="bg-black/20 border border-white/10 rounded px-3 py-2 w-full text-white focus:border-blue-500 outline-none appearance-none"
                                        >
                                            <option value="none" className="bg-gray-900">No Tax</option>
                                            <option value="add" className="bg-gray-900">Add Tax</option>
                                            <option value="deduct" className="bg-gray-900">Deduct Tax</option>
                                        </select>
                                    </div>

                                    <div className="text-right">
                                        <label className="block text-xs text-gray-400 uppercase mb-1">
                                            {item.tax_mode === 'none' ? 'Total Amount' : 'Net Total'}
                                        </label>
                                        <div className="text-2xl font-bold">{currency}{parseFloat(item.total_amount).toFixed(2)}</div>
                                        {item.tax_mode !== 'none' && (
                                            <div className="text-xs flex flex-col items-end gap-0.5 mt-1 border-t border-white/10 pt-1">
                                                <div className="text-gray-400 flex gap-2">
                                                    <span>Amount w/o Tax:</span>
                                                    <span className="font-mono">{currency}{parseFloat(item.subtotal_amount || 0).toFixed(2)}</span>
                                                </div>
                                                <div className={item.tax_mode === 'add' ? 'text-red-300' : 'text-green-300 flex gap-2'}>
                                                    <span>{item.tax_mode === 'add' ? 'Add' : 'Deduct'} Tax ({item.tax_percentage}%):</span>
                                                    <span className="font-mono">
                                                        {item.tax_mode === 'add' ? '+' : '-'}{currency}{parseFloat(item.tax_amount || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Terms & Conditions Section */}
                        <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10">
                            <h3 className="text-lg font-bold mb-4">Terms & Conditions</h3>
                            <textarea
                                className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm w-full h-32 font-mono text-gray-300 focus:border-blue-500 outline-none"
                                placeholder="Enter terms and conditions..."
                                defaultValue={quote?.terms_and_conditions || settings.default_terms || ''}
                                onBlur={(e) => {
                                    fetch(`/api/quotations/${id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ terms_and_conditions: e.target.value })
                                    });
                                }}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Automatically saved on blur. Leave empty to use system default on print.
                            </p>
                        </div>

                        <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={quote?.show_grand_total === 1 || quote?.show_grand_total === true}
                                onChange={(e) => {
                                    const val = e.target.checked;
                                    setQuote(prev => ({ ...prev, show_grand_total: val }));
                                    fetch(`/api/quotations/${id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ show_grand_total: val })
                                    });
                                }}
                                className="w-5 h-5 rounded border-white/10 bg-black/20 focus:ring-blue-500"
                            />
                            <div>
                                <label className="block font-bold text-gray-200">Show Grand Total Section</label>
                                <p className="text-xs text-gray-500">Include tax summary and grand total at the bottom of the quotation.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="bg-black/60 p-6 rounded-xl border border-white/20 sticky top-8">
                        <h2 className="text-lg font-bold mb-4">Summary</h2>
                        <div className="space-y-2 mb-6 text-sm">
                            {items.map((item, idx) => (
                                <div key={item.id} className="flex justify-between text-gray-400">
                                    <span className="truncate max-w-[150px]">{idx + 1}. {item.estimation_name || item.job_description || 'Item'}</span>
                                    <span>{currency}{parseFloat(item.total_amount).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-white/20 pt-4 flex justify-between text-xl font-bold">
                            <span>Grand Total</span>
                            <span>{currency}{items.reduce((acc, i) => acc + parseFloat(i.total_amount || 0), 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
