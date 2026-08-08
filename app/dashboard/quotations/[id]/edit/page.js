'use client';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiCopy, FiTrash2, FiSave, FiRefreshCw, FiShoppingCart, FiDollarSign, FiAlertTriangle, FiPackage } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import { useSettings } from '@/components/SettingsContext';

function SalesOrderProgress({ visible, progress, label }) {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-lg flex items-center justify-center">
            <div className="bg-[#0f0f0f]/95 border border-white/10 rounded-2xl p-10 w-80 shadow-[0_24px_64px_rgba(0,0,0,0.6)] text-center">
                <div className="flex items-center justify-center mb-5">
                    <div className="relative flex items-center justify-center w-16 h-16">
                        <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 64 64" fill="none">
                            <circle cx="32" cy="32" r="28" stroke="url(#soGrad)" strokeWidth="3" strokeLinecap="round" strokeDasharray="120 60" />
                            <defs>
                                <linearGradient id="soGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#10b981" />
                                    <stop offset="100%" stopColor="#34d399" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="relative z-10 w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                            <FiShoppingCart size={18} className="text-emerald-400" />
                        </div>
                    </div>
                </div>
                <div className="text-white font-bold text-base mb-1">Creating Sales Order</div>
                <div className="text-gray-500 text-sm mb-6">{label}</div>
                <div className="bg-white/8 rounded-full h-1.5 overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-400"
                        style={{ width: `${progress}%` }} />
                </div>
                <div className="text-gray-600 text-xs">{progress}%</div>
            </div>
        </div>
    );
}

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
    const [stockShortages, setStockShortages] = useState(null); // null | shortage[]

    const [convertingId, setConvertingId] = useState(null);
    const [autoDeduct, setAutoDeduct] = useState(false);
    const [splitTasks, setSplitTasks] = useState(false);
    const [convertingProgressVisible, setConvertingProgressVisible] = useState(false);
    const [convertingProgress, setConvertingProgress] = useState(0);
    const [convertingLabel, setConvertingLabel] = useState('');

    const handleConvert = (id) => {
        setConvertingId(id);
        setAutoDeduct(false);
        setSplitTasks(false);
    };

    const submitConvert = async () => {
        if (!convertingId) return;
        const id = convertingId;
        setConvertingId(null);

        setConvertingProgressVisible(true);
        setConvertingProgress(0);
        setConvertingLabel('Initializing conversion...');

        const stages = [
            { pct: 15, label: 'Reading quotation details...' },
            { pct: 35, label: 'Creating Sales Order header...' },
            { pct: 55, label: 'Creating Sales Order items...' },
            { pct: 75, label: 'Generating job tasks & routing...' },
            { pct: 90, label: 'Allocating material requirements...' }
        ];

        let si = 0;
        const tick = setInterval(() => {
            if (si < stages.length) {
                setConvertingProgress(stages[si].pct);
                setConvertingLabel(stages[si].label);
                si++;
            }
        }, 300);

        try {
            const res = await fetch('/api/sales-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quotation_id: id, auto_deduct_stock: autoDeduct, split_tasks: splitTasks }),
            });
            const d = await res.json();
            clearInterval(tick);

            if (res.ok) {
                setConvertingProgress(100);
                setConvertingLabel('Done!');
                await new Promise(r => setTimeout(r, 600));
                setConvertingProgressVisible(false);
                toast.success('Sales Order created successfully!');
                router.push('/dashboard/sales-orders');
            } else {
                setConvertingProgressVisible(false);
                if (res.status === 422) {
                    if (d.error === 'insufficient_stock' && d.shortages) {
                        setStockShortages(d.shortages);
                    } else {
                        toast.error(d.message || 'Insufficient stock to convert');
                    }
                } else {
                    toast.error('Failed to convert: ' + (d.error || 'Unknown error'));
                }
            }
        } catch {
            clearInterval(tick);
            setConvertingProgressVisible(false);
            toast.error('Error converting to sales order');
        }
    };

    const markSaved = () => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
    };

    // Fetch quotation data from API
    const fetchQuote = async () => {
        try {
            const res = await fetch(`/api/quotations/${id}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Server error (${res.status})`);
            }
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setQuote(data);
            setItems(data.items || []);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load quotation data:', error);
            toast.error('Failed to load quotation: ' + error.message);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuote();
    }, [id]);

    const handleDeleteItem = async (itemId) => {
        if (!(await confirmDialog("Are you sure you want to remove this item from the quotation?"))) return;
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
                toast.error('Failed to delete item');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const handleDuplicateItem = async (itemId) => {
        if (!(await confirmDialog("Duplicate this item?"))) return;
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
                toast.error('Failed to duplicate');
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
            else toast.error('Failed to update tax mode');
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
                toast.error('Recalculation failed');
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
            <SalesOrderProgress visible={convertingProgressVisible} progress={convertingProgress} label={convertingLabel} />
            
            {/* ── Conversion Modal ─────────────────────────────────────────── */}
            {convertingId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl shadow-black/80">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                                <FiShoppingCart className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Convert to Sales Order</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Configure stock settings for the new order</p>
                            </div>
                        </div>

                        <div className="my-6 space-y-4">
                            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left">
                                <input
                                    type="radio"
                                    name="autoDeduct"
                                    checked={!autoDeduct}
                                    onChange={() => setAutoDeduct(false)}
                                    className="mt-1 accent-emerald-500"
                                />
                                <div>
                                    <span className="block text-sm font-semibold text-white">Issue stocks manually / partially later</span>
                                    <span className="block text-xs text-gray-400 mt-0.5">Recommended. Create the Sales Order immediately and issue items from the warehouse as they become available.</span>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left">
                                <input
                                    type="radio"
                                    name="autoDeduct"
                                    checked={autoDeduct}
                                    onChange={() => setAutoDeduct(true)}
                                    className="mt-1 accent-emerald-500"
                                />
                                <div>
                                    <span className="block text-sm font-semibold text-white">Auto-deduct stock immediately</span>
                                    <span className="block text-xs text-gray-400 mt-0.5">Deduct all required materials from inventory right now. Fails if there is insufficient stock.</span>
                                </div>
                            </label>

                            {items.some(i => (parseFloat(i.quantity) || 1) > 1) && (
                                <div className="pt-3 border-t border-white/10 space-y-2 text-left">
                                    <label className="block text-xs font-bold text-gray-300">
                                        Multi-Unit Items Task Handling
                                    </label>
                                    <p className="text-xs text-gray-500">Some items have quantity &gt; 1. Choose task generation mode:</p>
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${!splitTasks ? 'bg-emerald-500/10 border-emerald-500/40 text-white' : 'bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/[0.04]'}`}>
                                            <div className="flex items-center gap-2 mb-1 font-semibold text-xs text-white">
                                                <input type="radio" name="splitTasks" checked={!splitTasks} onChange={() => setSplitTasks(false)} className="accent-emerald-500" />
                                                Merge Tasks
                                            </div>
                                            <span className="text-[10px] text-gray-400 leading-tight">Keep 1 task for total item quantity</span>
                                        </label>

                                        <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${splitTasks ? 'bg-emerald-500/10 border-emerald-500/40 text-white' : 'bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/[0.04]'}`}>
                                            <div className="flex items-center gap-2 mb-1 font-semibold text-xs text-white">
                                                <input type="radio" name="splitTasks" checked={splitTasks} onChange={() => setSplitTasks(true)} className="accent-emerald-500" />
                                                Separate Tasks
                                            </div>
                                            <span className="text-[10px] text-gray-400 leading-tight">Multiply tasks by unit count</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setConvertingId(null)}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitConvert}
                                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-sm font-semibold text-white transition-colors"
                            >
                                Convert
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Stock Shortage Modal ─────────────────────────────────────── */}
            {stockShortages && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-red-500/30 rounded-2xl p-8 w-full max-w-lg shadow-2xl shadow-red-950/40">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                                <FiAlertTriangle className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Insufficient Stock</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Cannot convert — the following items are short</p>
                            </div>
                        </div>
                        <div className="mt-5 rounded-xl overflow-hidden border border-white/[0.07]">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-white/[0.04] border-b border-white/[0.07]">
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Item</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Required</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Available</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-red-500/70">Short</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stockShortages.map((s, i) => (
                                        <tr key={i} className={`border-b border-white/[0.04] ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                    s.type === 'sfg'
                                                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                                        : s.type === 'statics'
                                                        ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                                                        : s.type === 'plate'
                                                        ? 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20'
                                                        : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                                }`}>
                                                    <FiPackage className="w-2.5 h-2.5" />
                                                    {s.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-200 font-medium text-xs">{s.name}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{s.required}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{s.available}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-red-400">{s.shortfall}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-600 mt-4">Restock the items above, then try converting again.</p>
                        <div className="flex justify-end mt-5">
                            <button
                                onClick={() => setStockShortages(null)}
                                className="px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm font-semibold text-white transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
                            onClick={() => handleConvert(quote.id)}
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
                    <Button onClick={async () => router.push(`/dashboard/quotations/${id}`)} className="bg-white/90 hover:bg-white/70">
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
                                            onClick={async () => handleRecalculateItem(item.id)}
                                            disabled={processing}
                                            className="p-2 hover:bg-white/10 rounded transition-colors text-yellow-400 text-xs flex items-center gap-1"
                                            title="Recalculate using saved parameters"
                                        >
                                            <FiRefreshCw className={processing ? 'animate-spin' : ''} />
                                        </button>
                                        <button
                                            onClick={async () => handleDuplicateItem(item.id)}
                                            disabled={processing}
                                            className="p-2 hover:bg-white/10 rounded transition-colors text-blue-400"
                                            title="Duplicate Item"
                                        >
                                            <FiCopy />
                                        </button>
                                        <button
                                            onClick={async () => handleDeleteItem(item.id)}
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