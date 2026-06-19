'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiCopy, FiTrash2, FiSave, FiRefreshCw, FiShoppingCart, FiDollarSign } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import { useSettings } from '@/components/SettingsContext';

export default function EditQuotationPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || '$ ';

    const [quote, setQuote] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    // 'idle' | 'saving' | 'saved'
    const [saveStatus, setSaveStatus] = useState('idle');

    const markSaved = () => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
    };

    // Fetch quotation data from API
    const fetchQuote = async () => {
        try {
            const res = await fetch(`/api/quotations/${id}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setQuote(data);
            setItems(data.items || []);
            setLoading(false);
        } catch (error) {
            console.error("Failed to load quotation data:", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuote();
    }, [id]);

    const handleDeleteItem = async (itemId) => {
        if (!confirm("Are you sure you want to remove this item from the quotation?")) return;
        setSaveStatus('saving');
        setProcessing(true);
        try {
            const res = await fetch(`/api/quotations/${id}/items/${itemId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchQuote();
                markSaved();
            } else {
                setSaveStatus('idle');
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
        setSaveStatus('saving');
        setProcessing(true);
        try {
            const res = await fetch(`/api/quotations/${id}/items/duplicate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId })
            });
            if (res.ok) {
                fetchQuote();
                markSaved();
            } else {
                alert('Failed to duplicate');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleQuantityChange = (itemId, val) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: val } : i));
    };

    const handleTaxModeChange = async (itemId, newMode) => {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, tax_mode: newMode } : i));
        setSaveStatus('saving');
        setProcessing(true);
        try {
            const res = await fetch(`/api/quotations/${id}/items/${itemId}/recalculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tax_mode: newMode })
            });
            if (res.ok) { fetchQuote(); markSaved(); }
            else alert('Failed to update tax mode');
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleRecalculateItem = async (itemId, qty) => {
        setSaveStatus('saving');
        setProcessing(true);
        try {
            const res = await fetch(`/api/quotations/${id}/items/${itemId}/recalculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: parseInt(qty) > 0 ? parseInt(qty) : undefined })
            });
            if (res.ok) {
                fetchQuote();
                markSaved();
            } else {
                setSaveStatus('idle');
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
            {/* Header Actions */}
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
                    {quote.status !== 'converted' && (
                        <Button
                            onClick={async () => {
                                if (!confirm("Convert this quotation to a Sales Order?")) return;
                                setProcessing(true);
                                try {
                                    const res = await fetch(`/api/sales-orders`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ quotation_id: quote.id })
                                    });
                                    if (res.ok) {
                                        alert("Sales Order created successfully!");
                                        router.push('/dashboard/sales-orders');
                                    } else {
                                        alert("Failed to convert quotation");
                                    }
                                } catch (error) {
                                    alert("Error converting file context");
                                } finally {
                                    setProcessing(false);
                                }
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <FiShoppingCart className="mr-2" /> Convert to SO
                        </Button>
                    )}
                    {quote.status !== 'draft' && (
                        !quote.has_invoice ? (
                            <Link href={`/dashboard/invoices/new?quotation_id=${id}&customer_name=${encodeURIComponent(quote.customer_name || '')}&customer_id=${quote.customer_id || ''}&amount=${quote.total_amount || 0}&description=${encodeURIComponent(quote.first_item_name || quote.job_description || '')}`}>
                                <Button className="bg-green-600 hover:bg-emerald-500 text-white">
                                    <FiDollarSign className="mr-2" /> Create Invoice
                                </Button>
                            </Link>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <FiDollarSign className="w-3.5 h-3.5" /> Invoice Created
                            </span>
                        )
                    )}
                    <Button onClick={() => router.push(`/dashboard/quotations/${id}`)} className="bg-white/90 hover:bg-white/70">
                        View / Print
                    </Button>
                    <div
                        disabled={processing}
                        className={`transition-all flex items-center justify-center px-10 cursor-default rounded-lg ${
                            saveStatus === 'saving' ? 'bg-yellow-500 text-black' :
                            saveStatus === 'saved'  ? 'bg-green-500 text-white'  :
                            'bg-white/10 text-white/50'
                        }`}
                    >
                        {saveStatus === 'saving' ? (
                            <><FiRefreshCw className="mr-2 animate-spin" /> Saving...</>
                        ) : saveStatus === 'saved' ? (
                            <><FiSave className="mr-2" /> Saved ✓</>
                        ) : (
                            <><FiSave className="mr-2" /> Auto Saved</>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Application Layout */}
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    {items.map((item) => {
                        const rawTotal    = parseFloat(item.total_amount    || 0);
                        const rawSubtotal = parseFloat(item.subtotal_amount || 0);
                        const taxAmount   = parseFloat(item.tax_amount      || 0);
                        const hasTax      = item.tax_mode && item.tax_mode !== 'none';
                        const itemSubtotal = hasTax && rawSubtotal > 0 ? rawSubtotal : rawTotal;

                        return (
                            <div key={item.id} className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 relative group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1 mr-4">
                                        <input
                                            type="text"
                                            defaultValue={item.estimation_name || item.job_description || ''}
                                            onBlur={(e) => {
                                                const val = e.target.value;
                                                if (val !== item.estimation_name) {
                                                    fetch(`/api/quotations/${id}/items/${item.id}/recalculate`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ estimation_name: val })
                                                    }).then(res => { if (res.ok) fetchQuote(); });
                                                }
                                            }}
                                            className="font-bold text-lg bg-transparent border-b border-transparent hover:border-white/30 focus:border-blue-500 focus:bg-black/20 outline-none transition-all w-full"
                                        />
                                        <div className="text-sm text-gray-500 font-mono mt-1">{item.code} &nbsp;·&nbsp; Qty: {item.quantity}</div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <button
                                            onClick={() => handleRecalculateItem(item.id)}
                                            disabled={processing}
                                            className="p-2 hover:bg-white/10 rounded transition-colors text-yellow-400 text-xs flex items-center gap-1"
                                            title="Recalculate using saved parameters"
                                        >
                                            <FiRefreshCw className={processing ? 'animate-spin' : ''} />
                                        </button>
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

                                <div className="flex items-center gap-3 mt-4">
                                    {/* Quantity input */}
                                    <div className="flex items-center gap-2 flex-1">
                                        <label className="text-xs text-gray-400 uppercase whitespace-nowrap">Qty</label>
                                        <input
                                            type="number"
                                            value={item.quantity || ''}
                                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                            onBlur={(e) => {
                                                const q = parseInt(e.target.value);
                                                if (q > 0) handleRecalculateItem(item.id, q);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const q = parseInt(e.currentTarget.value);
                                                    if (q > 0) handleRecalculateItem(item.id, q);
                                                }
                                            }}
                                            className="bg-black/20 border border-white/10 rounded px-3 py-1.5 w-28 text-white focus:border-blue-500 outline-none font-mono text-sm"
                                        />
                                    </div>

                                    {/* Tax mode dropdown */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-gray-400 uppercase">Tax</label>
                                        <select
                                            value={item.tax_mode || 'none'}
                                            onChange={(e) => handleTaxModeChange(item.id, e.target.value)}
                                            disabled={processing}
                                            className="bg-black/20 border border-white/10 rounded px-3 py-1.5 text-white focus:border-blue-500 outline-none appearance-none text-sm"
                                        >
                                            <option value="none"   className="bg-gray-900">No Tax</option>
                                            <option value="add"    className="bg-gray-900">Add Tax</option>
                                            <option value="deduct" className="bg-gray-900">Tax Incl.</option>
                                        </select>
                                    </div>

                                    {/* Total display */}
                                    <div className="text-right ml-auto">
                                        <div className="text-xs text-gray-400 uppercase mb-0.5">
                                            {hasTax ? 'Net Total' : 'Total Amount'}
                                        </div>
                                        <div className="text-2xl font-bold">
                                            {currency}{rawTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        {hasTax && (
                                            <div className="text-xs mt-1 space-y-0.5 border-t border-white/10 pt-1">
                                                <div className="flex gap-4 justify-end text-gray-400">
                                                    <span>Excl. Tax:</span>
                                                    <span className="font-mono">{currency}{itemSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className={`flex gap-4 justify-end ${item.tax_mode === 'add' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                    <span>{item.tax_mode === 'add' ? 'Tax' : 'Tax (Incl.)'} {item.tax_percentage}%:</span>
                                                    <span className="font-mono">+{currency}{Math.abs(taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Terms & Conditions Block */}
                    <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold mb-4">Terms & Conditions</h3>
                        <textarea
                            className="bg-black/20 border border-white/10 rounded-lg p-3 text-sm w-full h-32 font-mono text-gray-300 focus:border-blue-500 outline-none"
                            placeholder="Enter unique billing terms..."
                            defaultValue={quote?.terms_and_conditions || ''}
                            onBlur={(e) => {
                                fetch(`/api/quotations/${id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ terms_and_conditions: e.target.value })
                                });
                            }}
                        />
                    </div>

                    {/* Show Grand Total Toggle */}
                    <div className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={!!(quote?.show_grand_total === 1 || quote?.show_grand_total === true)}
                            onChange={(e) => {
                                const val = e.target.checked;
                                setQuote(prev => ({ ...prev, show_grand_total: val }));
                                fetch(`/api/quotations/${id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ show_grand_total: val ? 1 : 0 })
                                });
                            }}
                            className="w-5 h-5 rounded border-white/10 bg-black/20 focus:ring-blue-500"
                        />
                        <div>
                            <label className="block font-bold text-gray-200">Show Grand Total Section</label>
                            <p className="text-xs text-gray-500">Include tax adjustment records and calculations at the bottom of printouts.</p>
                        </div>
                    </div>
                </div>

                {/* Right Sticky Sidebar Matrix Summary Wrapper */}
                <div className="lg:col-span-1">
                    <div className="bg-black/60 p-6 rounded-xl border border-white/20 sticky top-8 shadow-2xl">
                        <h2 className="text-lg font-bold mb-4">Summary Basket</h2>
                        <div className="space-y-2 mb-6 text-sm">
                            {items.map((item, idx) => (
                                <div key={item.id} className="flex justify-between text-gray-400">
                                    <span className="truncate max-w-[150px]">{idx + 1}. {item.estimation_name || item.job_description || 'Item Specification'}</span>
                                    <span className="font-mono">{currency}{parseFloat(item.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-white/20 pt-4 flex justify-between text-xl font-bold">
                            <span>Grand Total</span>
                            <span className="tracking-tight text-blue-400">
                                {currency}{items.reduce((acc, i) => acc + parseFloat(i.total_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}