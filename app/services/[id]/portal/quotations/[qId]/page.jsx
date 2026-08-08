'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    FiArrowLeft, FiPrinter, FiFileText, FiShoppingCart, FiEye, FiEyeOff,
    FiEdit2, FiX, FiCheck, FiPlus, FiTrash2, FiPlusCircle, FiCopy
} from 'react-icons/fi';
import { useSettings } from '@/components/SettingsContext';
import toast from 'react-hot-toast';

export default function ServiceQuotationView({ params }) {
    const { id, qId } = use(params);
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings?.currency || 'LKR';

    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [converting, setConverting] = useState(false);
    const [duplicating, setDuplicating] = useState(false);
    const [progress, setProgress] = useState({ visible: false, pct: 0, label: '' });

    // Document Customization Controls
    const [termsModalOpen, setTermsModalOpen] = useState(false);
    const [editTerms, setEditTerms] = useState('');
    const [savingTerms, setSavingTerms] = useState(false);

    // Full Quotation Edit Modal Controls
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [savingQuote, setSavingQuote] = useState(false);
    const [editForm, setEditForm] = useState({
        customer_name: '', customer_phone: '', customer_email: '',
        customer_address: '', status: 'approved', tax_mode: 'none',
        tax_percentage: 0, terms_and_conditions: '',
        items: [{ item_name: '', quantity: 1, unit_price: 0, description: '' }]
    });

    const loadQuote = () => {
        fetch(`/api/services/${id}/quotations/${qId}`)
            .then(r => r.json())
            .then(d => {
                if (!d.error) {
                    setQuote(d);
                    setEditTerms(d.terms_and_conditions || settings?.default_terms || '1. Quotation valid for 30 days.\n2. Payment terms: 50% advance.\n3. Prices subject to change if specs alter.');
                } else setQuote(null);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadQuote();
    }, [id, qId, settings]);

    const openEditModal = () => {
        if (!quote) return;
        setEditForm({
            customer_name: quote.customer_name || '',
            customer_phone: quote.customer_phone || '',
            customer_email: quote.customer_email || '',
            customer_address: quote.customer_address || '',
            status: quote.status || 'approved',
            tax_mode: quote.items?.[0]?.tax_mode || 'none',
            tax_percentage: quote.items?.[0]?.tax_percentage || 0,
            terms_and_conditions: quote.terms_and_conditions || '',
            items: quote.items && quote.items.length > 0 ? quote.items.map(i => ({
                item_name: i.estimation_name || i.item_name || '',
                quantity: i.quantity || 1,
                unit_price: i.quantity > 0 ? (i.subtotal_amount || i.total_amount) / i.quantity : 0,
                description: i.job_description || i.description || ''
            })) : [{ item_name: '', quantity: 1, unit_price: 0, description: '' }]
        });
        setEditModalOpen(true);
    };

    const handleSaveFullQuote = async (e) => {
        e.preventDefault();
        setSavingQuote(true);
        try {
            const res = await fetch(`/api/services/${id}/quotations/${qId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            const d = await res.json();
            if (res.ok) {
                toast.success('Quotation updated successfully!');
                setEditModalOpen(false);
                loadQuote();
            } else {
                toast.error(d.error || 'Failed to update quotation');
            }
        } catch {
            toast.error('Error saving quotation edits');
        } finally {
            setSavingQuote(false);
        }
    };

    const handleToggleGrandTotal = async () => {
        if (!quote) return;
        const nextVal = !(quote.show_grand_total !== 0 && quote.show_grand_total !== false && quote.show_grand_total !== 'false');
        setQuote(prev => ({ ...prev, show_grand_total: nextVal ? 1 : 0 }));
        try {
            await fetch(`/api/services/${id}/quotations/${qId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ show_grand_total: nextVal ? 1 : 0 }),
            });
            toast.success(`Grand total section ${nextVal ? 'shown' : 'hidden'}`);
        } catch { toast.error('Error updating setting'); }
    };

    const handleToggleSignature = async () => {
        if (!quote) return;
        const nextVal = !(quote.show_signature !== 0 && quote.show_signature !== false && quote.show_signature !== 'false');
        setQuote(prev => ({ ...prev, show_signature: nextVal ? 1 : 0 }));
        try {
            await fetch(`/api/services/${id}/quotations/${qId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ show_signature: nextVal ? 1 : 0 }),
            });
            toast.success(`Signature section ${nextVal ? 'shown' : 'hidden'}`);
        } catch { toast.error('Error updating setting'); }
    };

    const handleSaveTerms = async () => {
        setSavingTerms(true);
        try {
            const res = await fetch(`/api/services/${id}/quotations/${qId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ terms_and_conditions: editTerms }),
            });
            if (res.ok) {
                setQuote(prev => ({ ...prev, terms_and_conditions: editTerms }));
                toast.success('Terms & Conditions updated');
                setTermsModalOpen(false);
            } else toast.error('Failed to update terms');
        } catch { toast.error('Error saving terms'); }
        finally { setSavingTerms(false); }
    };

    const [convertModalOpen, setConvertModalOpen] = useState(false);
    const [splitTasks, setSplitTasks] = useState(false);

    const onConvertButtonClick = () => {
        setSplitTasks(false);
        const hasMulti = quote?.items?.some(i => (parseFloat(i.quantity) || 1) > 1);
        if (hasMulti) {
            setConvertModalOpen(true);
        } else {
            handleConvertToSO();
        }
    };

    const handleConvertToSO = async () => {
        setConvertModalOpen(false);
        setConverting(true);
        setProgress({ visible: true, pct: 10, label: 'Initializing…' });
        const steps = [
            { pct: 30, label: 'Reading quotation details…' },
            { pct: 60, label: 'Creating Sales Order…' },
            { pct: 85, label: 'Finalizing order & routing…' },
        ];
        let si = 0;
        const tick = setInterval(() => {
            if (si < steps.length) { setProgress({ visible: true, ...steps[si] }); si++; }
        }, 300);
        try {
            const res = await fetch('/api/sales-orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quotation_id: quote.id, auto_deduct_stock: false, split_tasks: splitTasks }),
            });
            const d = await res.json();
            clearInterval(tick);
            if (res.ok) {
                setProgress({ visible: true, pct: 100, label: 'Done!' });
                await new Promise(r => setTimeout(r, 600));
                setProgress({ visible: false, pct: 0, label: '' });
                toast.success('Sales Order created!');
                setQuote(q => ({ ...q, status: 'converted' }));
            } else {
                setProgress({ visible: false, pct: 0, label: '' });
                toast.error(d.error || 'Failed to create sales order');
            }
        } catch {
            clearInterval(tick);
            setProgress({ visible: false, pct: 0, label: '' });
            toast.error('Error converting to sales order');
        }
        setConverting(false);
    };

    const handleDuplicate = async () => {
        setDuplicating(true);
        try {
            const res = await fetch(`/api/services/${id}/quotations/${qId}/duplicate`, {
                method: 'POST',
            });
            const d = await res.json();
            if (res.ok) {
                toast.success(d.message || `Quotation duplicated as ${d.code}`);
                if (d.quotationId) {
                    router.push(`/services/${id}/portal/quotations/${d.quotationId}`);
                }
            } else {
                toast.error(d.error || 'Failed to duplicate quotation');
            }
        } catch {
            toast.error('Error duplicating quotation');
        } finally {
            setDuplicating(false);
        }
    };

    const editTotal = useMemo(() => {
        const sub = editForm.items.reduce((s, i) => s + parseFloat(i.quantity || 1) * parseFloat(i.unit_price || 0), 0);
        const pct = parseFloat(editForm.tax_percentage || 0);
        if (editForm.tax_mode === 'add') return sub + sub * pct / 100;
        return sub;
    }, [editForm]);

    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <div className="w-8 h-8 border-2 border-white/10 border-t-purple-500 rounded-full animate-spin" />
        </div>
    );

    if (!quote) return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <p className="text-white/40 mb-4">Quotation not found</p>
                <Link href={`/services/${id}/portal/quotations`} className="text-purple-400 hover:text-purple-300 text-sm">← Back to Quotations</Link>
            </div>
        </div>
    );

    const subtotal = quote.items ? quote.items.reduce((acc, i) => acc + parseFloat(i.subtotal_amount || i.total_amount || 0), 0) : 0;
    const totalTax = quote.items ? quote.items.reduce((acc, i) => acc + parseFloat(i.tax_amount || 0), 0) : 0;
    const finalTotal = parseFloat(quote.total_amount || 0);
    const hasTax = totalTax !== 0;

    const showSummary = quote.show_grand_total !== 0 && quote.show_grand_total !== false && quote.show_grand_total !== 'false';
    const showSignature = quote.show_signature !== 0 && quote.show_signature !== false && quote.show_signature !== 'false';

    return (
        <div className="min-h-screen text-white p-8 print:bg-white print:text-black print:p-0">
            {/* Progress overlay */}
            {progress.visible && (
                <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-lg flex items-center justify-center">
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-10 w-72 text-center shadow-2xl">
                        <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-5" />
                        <div className="text-white font-bold mb-1">Creating Sales Order</div>
                        <div className="text-white/40 text-sm mb-5">{progress.label}</div>
                        <div className="bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress.pct}%` }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Toolbar Header (screen only) */}
            <div className="mb-8 print:hidden flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                    <Link href={`/services/${id}/portal/quotations`}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-400 hover:text-white text-sm transition-all">
                        <FiArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </Link>
                    <div className="h-5 w-px bg-white/10" />
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-white tracking-tight">
                            {quote.code || `#${quote.id}`}
                        </span>
                        <span className="text-gray-600">·</span>
                        <span className="text-sm text-gray-400 truncate">{quote.customer_name}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* EDIT QUOTATION BUTTON */}
                    <button onClick={openEditModal}
                        className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all cursor-pointer shadow-sm">
                        <FiEdit2 size={13} /> Edit Quotation
                    </button>

                    {/* DUPLICATE QUOTATION BUTTON */}
                    <button onClick={handleDuplicate} disabled={duplicating}
                        className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50">
                        <FiCopy size={13} /> {duplicating ? 'Duplicating...' : 'Duplicate Quote'}
                    </button>

                    {/* Grand Total Toggle */}
                    <button onClick={handleToggleGrandTotal}
                        className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${showSummary ? 'bg-zinc-800 border-zinc-700 text-white font-bold' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                        {showSummary ? <FiEye size={13} /> : <FiEyeOff size={13} />} Grand Total: {showSummary ? 'ON' : 'OFF'}
                    </button>

                    {/* Signature Toggle */}
                    <button onClick={handleToggleSignature}
                        className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${showSignature ? 'bg-zinc-800 border-zinc-700 text-white font-bold' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                        {showSignature ? <FiEye size={13} /> : <FiEyeOff size={13} />} Signature: {showSignature ? 'ON' : 'OFF'}
                    </button>

                    {/* Edit Terms */}
                    <button onClick={() => setTermsModalOpen(true)}
                        className="h-9 inline-flex items-center gap-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold transition-all cursor-pointer">
                        <FiEdit2 size={12} /> Edit Terms
                    </button>

                    <a href={`/api/quotations/${qId}/pdf`} target="_blank" rel="noopener noreferrer"
                        className="h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-medium transition-all">
                        <FiFileText className="w-3.5 h-3.5" /> PDF
                    </a>
                    <button onClick={() => window.print()}
                        className="h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-medium transition-all cursor-pointer">
                        <FiPrinter className="w-3.5 h-3.5" /> Print
                    </button>
                    {quote.status !== 'converted' ? (
                        <button onClick={onConvertButtonClick} disabled={converting}
                            className="h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-bold transition-all cursor-pointer disabled:opacity-50">
                            <FiShoppingCart className="w-3.5 h-3.5" /> Convert to SO
                        </button>
                    ) : (
                        <span className="h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm font-semibold">
                            ✓ Converted
                        </span>
                    )}
                </div>
            </div>

            {/* ── Convert Modal ── */}
            {convertModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm print:hidden">
                    <div className="bg-[#0e0e11] border border-zinc-800 rounded-2xl p-7 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700">
                                <FiShoppingCart className="w-5 h-5 text-zinc-200" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-white">Convert to Sales Order</h2>
                                <p className="text-xs text-zinc-400 mt-0.5">{quote.code} · {quote.customer_name}</p>
                            </div>
                        </div>
                        <p className="text-xs text-zinc-400 mb-4">Creates a Sales Order without deducting stock automatically.</p>

                        <div className="mb-6 pt-3 border-t border-zinc-800 space-y-2 text-left">
                            <label className="block text-xs font-bold text-zinc-300">
                                Multi-Unit Items Task Handling
                            </label>
                            <p className="text-xs text-zinc-400">Some items have quantity &gt; 1. Choose task generation mode:</p>
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${!splitTasks ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'}`}>
                                    <div className="flex items-center gap-2 mb-1 font-semibold text-xs text-white">
                                        <input type="radio" name="splitTasks" checked={!splitTasks} onChange={() => setSplitTasks(false)} className="accent-white" />
                                        Merge Tasks
                                    </div>
                                    <span className="text-[10px] text-zinc-400 leading-tight">Keep 1 task for total item quantity</span>
                                </label>

                                <label className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${splitTasks ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'}`}>
                                    <div className="flex items-center gap-2 mb-1 font-semibold text-xs text-white">
                                        <input type="radio" name="splitTasks" checked={splitTasks} onChange={() => setSplitTasks(true)} className="accent-white" />
                                        Separate Tasks
                                    </div>
                                    <span className="text-[10px] text-zinc-400 leading-tight">Multiply tasks by unit count</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConvertModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 cursor-pointer">Cancel</button>
                            <button onClick={handleConvertToSO} disabled={converting} className="px-4 py-2 text-sm font-semibold text-black bg-white hover:bg-zinc-200 rounded-xl disabled:opacity-50 cursor-pointer">
                                {converting ? 'Converting…' : 'Convert'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Printable Document Area — Matches Main Quotation View Layout */}
            <div className="quotation-print-container max-w-[210mm] mx-auto bg-white text-black p-12 rounded-xl shadow-2xl print:shadow-none print:rounded-none print:w-full min-h-[297mm] flex flex-col relative print:p-8"
                style={{ fontFamily: "'Google Sans', 'Product Sans', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>

                {/* Header */}
                <div className="flex justify-between items-start mb-12">
                    <div className="flex gap-4 items-start">
                        {settings?.company_logo && (
                            <img src={settings.company_logo} alt="Company Logo" className="h-19 object-contain" />
                        )}
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{settings?.company_name || 'Pressmatics Printing'}</h1>
                            <div className="text-sm text-gray-500 max-w-[250px] whitespace-pre-wrap mt-1">
                                {settings?.company_address || 'Address Line 1\nAddress Line 2'}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-4xl font-bold text-gray-200 uppercase tracking-widest mb-2">Quotation</h2>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-right">
                            <dt className="text-gray-500">Number:</dt>
                            <dd className="font-mono font-bold">{quote.code || `#${quote.id}`}</dd>
                            <dt className="text-gray-500">Date:</dt>
                            <dd>{new Date(quote.created_at).toLocaleDateString()}</dd>
                        </dl>
                    </div>
                </div>

                {/* Bill To */}
                <div className="mb-12">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 border-b border-gray-100 pb-1 w-32">Bill To</h3>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xl font-bold text-gray-900">{quote.customer_name}</p>
                            {quote.customer_address && (
                                <p className="text-sm text-gray-400 mt-0 max-w-xs whitespace-pre-wrap leading-relaxed">
                                    {quote.customer_address}
                                </p>
                            )}
                            {(quote.customer_phone || quote.customer_email) && (
                                <div className="flex text-sm text-gray-400 gap-2 mt-1">
                                    {quote.customer_phone && (
                                        <p className="flex items-center gap-1.5">{quote.customer_phone}</p>
                                    )}
                                    {quote.customer_phone && quote.customer_email && <span>|</span>}
                                    {quote.customer_email && (
                                        <p className="flex items-center gap-1.5">{quote.customer_email}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-900 text-xs font-bold text-gray-900 uppercase tracking-wider">
                                <th className="py-3 pr-4">Description</th>
                                <th className="py-3 px-4 text-center">Qty</th>
                                <th className="py-3 px-4 text-right">Unit Price ({currency})</th>
                                {!showSummary && hasTax ? (
                                    <>
                                        <th className="py-3 px-4 text-right">Amount (Excl. Tax)</th>
                                        <th className="py-3 px-4 text-right">Tax</th>
                                        <th className="py-3 pl-4 text-right">Net Total</th>
                                    </>
                                ) : (
                                    <th className="py-3 pl-4 text-right">Amount ({currency})</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {quote.items && quote.items.map((item) => {
                                const rawSubtotal = parseFloat(item.subtotal_amount || 0);
                                const rawTotal = parseFloat(item.total_amount || 0);
                                const taxAmount = parseFloat(item.tax_amount || 0);
                                const itemSubtotal = rawSubtotal > 0 ? rawSubtotal : rawTotal;
                                const unitPrice = item.quantity > 0 ? itemSubtotal / item.quantity : 0;
                                const descText = item.job_description || item.description;

                                return (
                                    <tr key={item.id} className="align-top">
                                        <td className="py-4 pr-4">
                                            <div className="font-bold text-gray-900">{item.estimation_name || item.item_name}</div>
                                            {descText && (
                                                <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">
                                                    {descText}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-4 text-center font-mono">{item.quantity}</td>
                                        <td className="py-4 px-4 text-right font-mono text-gray-500">
                                            {unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        {!showSummary && hasTax ? (
                                            <>
                                                <td className="py-4 px-4 text-right font-mono font-medium text-gray-700">
                                                    {itemSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-4 px-4 text-right font-mono text-xs text-gray-500">
                                                    {item.tax_mode !== 'none' ? (
                                                        <div>+{Math.abs(taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    ) : '-'}
                                                </td>
                                                <td className="py-4 pl-4 text-right font-mono font-bold text-gray-900">
                                                    {currency}{rawTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </>
                                        ) : (
                                            <td className="py-4 pl-4 text-right font-mono font-medium text-gray-900">
                                                {itemSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Totals & Summary */}
                {showSummary && (
                    <div className="flex justify-end mb-8 break-inside-avoid">
                        <div className="w-64 space-y-3">
                            {totalTax !== 0 && (
                                <>
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>Subtotal</span>
                                        <span>{currency}{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className={`flex justify-between text-sm ${totalTax > 0 ? 'text-gray-500' : 'text-green-600'}`}>
                                        <span>Tax Adjustment</span>
                                        <span>{totalTax > 0 ? '+' : ''}{currency}{totalTax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between items-end border-t-2 border-gray-900 pt-3">
                                <span className="font-bold text-gray-900">Total</span>
                                <span className="font-mono font-bold tracking-tight text-lg">{currency}{finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Terms & Conditions — Placed directly after Item Details & Totals */}
                <div className="border-t border-gray-200 pt-6 mb-8 break-inside-avoid">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Terms &amp; Conditions</h4>
                        <button onClick={() => setTermsModalOpen(true)} className="print:hidden text-[11px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer">
                            <FiEdit2 size={10} /> Edit
                        </button>
                    </div>
                    <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-w-2xl">
                        {quote.terms_and_conditions || settings?.default_terms || 'No specific terms.'}
                    </div>
                </div>

                <div className="mt-auto" />

                {showSignature && (
                    <div className="flex flex-col items-end justify-end text-center pt-6 break-inside-avoid">
                        <div className="flex flex-col items-center">
                            {settings?.company_signature && (
                                <img src={settings.company_signature} alt="Signature" className="h-15 mb-[-10px] object-contain" />
                            )}
                            <div className="border-t border-gray-300 w-48 mt-0 pt-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Authorized Signature</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* FULL EDIT QUOTATION MODAL */}
            {editModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md print:hidden">
                    <form onSubmit={handleSaveFullQuote} className="bg-[#0c0c16] border border-white/10 rounded-2xl max-w-2xl w-full mx-4 shadow-2xl flex flex-col max-h-[90vh]">
                        <header className="flex justify-between items-center px-6 py-4 border-b border-white/[0.08]">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <FiEdit2 className="text-purple-400" /> Edit Quotation ({quote.code || `#${quote.id}`})
                            </h3>
                            <button type="button" onClick={() => setEditModalOpen(false)} className="p-1 rounded-lg text-white/50 hover:text-white cursor-pointer"><FiX /></button>
                        </header>
                        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                            {/* Client & Status Info */}
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold mb-3">Client &amp; Quotation Information</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-xs text-white/40 mb-1.5">Client / Company Name *</label>
                                        <input required value={editForm.customer_name} onChange={e => setEditForm(p => ({ ...p, customer_name: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 mb-1.5">Phone</label>
                                        <input value={editForm.customer_phone} onChange={e => setEditForm(p => ({ ...p, customer_phone: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 mb-1.5">Email</label>
                                        <input type="email" value={editForm.customer_email} onChange={e => setEditForm(p => ({ ...p, customer_email: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-white/40 mb-1.5">Billing Address</label>
                                        <input value={editForm.customer_address} onChange={e => setEditForm(p => ({ ...p, customer_address: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/40 mb-1.5">Quotation Status</label>
                                        <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none">
                                            <option value="draft">Draft</option>
                                            <option value="sent">Sent</option>
                                            <option value="approved">Approved</option>
                                            <option value="converted">Converted</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold">Line Items *</p>
                                    <button type="button" onClick={() => setEditForm(p => ({ ...p, items: [...p.items, { item_name: '', description: '', quantity: 1, unit_price: 0 }] }))}
                                        className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer">
                                        <FiPlus size={11} /> Add Row
                                    </button>
                                </div>
                                {editForm.items.map((item, idx) => (
                                    <div key={idx} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2">
                                        <div className="grid grid-cols-[1fr_70px_100px_28px] gap-2 items-center">
                                            <input required value={item.item_name} onChange={e => { const it = [...editForm.items]; it[idx].item_name = e.target.value; setEditForm(p => ({ ...p, items: it })); }}
                                                placeholder="Item Name *"
                                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500/50" />
                                            <input type="number" min="1" value={item.quantity} onChange={e => { const it = [...editForm.items]; it[idx].quantity = parseInt(e.target.value) || 1; setEditForm(p => ({ ...p, items: it })); }}
                                                placeholder="Qty"
                                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-xs font-mono text-center focus:outline-none focus:border-purple-500/50" />
                                            <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => { const it = [...editForm.items]; it[idx].unit_price = parseFloat(e.target.value) || 0; setEditForm(p => ({ ...p, items: it })); }}
                                                placeholder="Price"
                                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-xs font-mono text-right focus:outline-none focus:border-purple-500/50" />
                                            {editForm.items.length > 1 ? (
                                                <button type="button" onClick={() => setEditForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))} className="p-1 text-red-400 hover:text-red-300 cursor-pointer"><FiTrash2 size={12} /></button>
                                            ) : <span />}
                                        </div>
                                        <input value={item.description || ''} onChange={e => { const it = [...editForm.items]; it[idx].description = e.target.value; setEditForm(p => ({ ...p, items: it })); }}
                                            placeholder="Item details / custom specifications (optional)…"
                                            className="w-full bg-white/5 border border-white/[0.06] rounded-lg px-3 py-1.5 text-white/80 text-xs focus:outline-none focus:border-purple-500/40" />
                                    </div>
                                ))}
                            </div>

                            {/* Tax */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-white/40 mb-1.5">Tax Mode</label>
                                    <select value={editForm.tax_mode} onChange={e => setEditForm(p => ({ ...p, tax_mode: e.target.value }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none">
                                        <option value="none">No Tax</option>
                                        <option value="add">Add Tax (on top)</option>
                                        <option value="deduct">Deduct Tax (inclusive)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-white/40 mb-1.5">Tax %</label>
                                    <input type="number" min="0" max="100" step="0.01" disabled={editForm.tax_mode === 'none'}
                                        value={editForm.tax_percentage} onChange={e => setEditForm(p => ({ ...p, tax_percentage: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none disabled:opacity-30" />
                                </div>
                            </div>

                            {/* Terms */}
                            <div>
                                <label className="block text-xs text-white/40 mb-1.5">Terms &amp; Conditions</label>
                                <textarea rows={3} value={editForm.terms_and_conditions} onChange={e => setEditForm(p => ({ ...p, terms_and_conditions: e.target.value }))}
                                    placeholder="Payment terms, delivery terms…"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none font-mono" />
                            </div>

                            {/* Live Total */}
                            <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl px-5 py-3 flex justify-between items-center">
                                <span className="text-xs text-white/40 font-semibold">Grand Total</span>
                                <span className="font-mono font-bold text-purple-300">
                                    LKR {editTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <footer className="px-6 py-3.5 border-t border-white/[0.08] flex justify-end gap-2.5">
                            <button type="button" onClick={() => setEditModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-white/60 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer">Cancel</button>
                            <button type="submit" disabled={savingQuote} className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl cursor-pointer disabled:opacity-50">
                                {savingQuote ? 'Saving…' : 'Save Changes'}
                            </button>
                        </footer>
                    </form>
                </div>
            )}

            {/* Terms Edit Modal */}
            {termsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm print:hidden">
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <FiEdit2 className="text-purple-400" /> Edit Terms &amp; Conditions
                            </h3>
                            <button onClick={() => setTermsModalOpen(false)} className="p-1 rounded-lg text-white/50 hover:text-white cursor-pointer"><FiX /></button>
                        </div>
                        <textarea
                            rows={6}
                            value={editTerms}
                            onChange={e => setEditTerms(e.target.value)}
                            placeholder="Enter terms and conditions…"
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-purple-500/50 resize-none font-mono mb-4"
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setTermsModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-white/60 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 cursor-pointer">Cancel</button>
                            <button onClick={handleSaveTerms} disabled={savingTerms} className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl cursor-pointer disabled:opacity-50">
                                {savingTerms ? 'Saving…' : 'Save Terms'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        background: white !important;
                        color: black !important;
                    }
                    body::before { display: none !important; }
                    aside, nav, .print\\:hidden, button { display: none !important; }
                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        height: auto !important;
                        background: white !important;
                    }
                    .quotation-print-container {
                        position: relative !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        padding: 1cm !important;
                        margin: 0 auto !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        background: white !important;
                        color: black !important;
                    }
                    @page { margin: 0; size: A4 portrait; }
                }
            `}} />
        </div>
    );
}
