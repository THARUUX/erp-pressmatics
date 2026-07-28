'use client';

import { use, useEffect, useState } from 'react';
import { FiPrinter, FiArrowLeft, FiDollarSign, FiShoppingCart, FiAlertTriangle, FiPackage, FiMessageCircle, FiLink, FiFileText, FiX, FiSend, FiWifi } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/components/SettingsContext';
import toast from 'react-hot-toast';

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

const STATUS_COLORS = {
    draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    converted: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
    sent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

export default function QuotationViewPage({ params }) {
    const { id } = use(params);
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || '$';

    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [stockShortages, setStockShortages] = useState(null);
    const [convertingId, setConvertingId] = useState(null);
    const [autoDeduct, setAutoDeduct] = useState(false);
    const [convertingProgressVisible, setConvertingProgressVisible] = useState(false);
    const [convertingProgress, setConvertingProgress] = useState(0);
    const [convertingLabel, setConvertingLabel] = useState('');

    // ── WhatsApp Quote Modal State ───────────────────────────────────────────
    const [waModal, setWaModal] = useState(false);
    const [waMode, setWaMode] = useState('link');  // 'link' | 'pdf'
    const [waStatus, setWaStatus] = useState('LOADING'); // 'LOADING' | 'CONNECTED' | 'DISCONNECTED'
    const [waPortalLink, setWaPortalLink] = useState('');
    const [waMessage, setWaMessage] = useState('');
    const [waSending, setWaSending] = useState(false);

    const openWaModal = async () => {
        setWaModal(true);
        setWaMode('link');
        setWaSending(false);
        setWaStatus('LOADING');
        setWaMessage('');
        setWaPortalLink('');

        // 1. Check WhatsApp connection status
        try {
            const statusRes = await fetch('/api/whatsapp/status');
            const statusData = await statusRes.json();
            setWaStatus(statusData.state === 'CONNECTED' ? 'CONNECTED' : 'DISCONNECTED');
        } catch {
            setWaStatus('DISCONNECTED');
        }

        // 2. Resolve customer portal token/link
        if (quote?.customer_id) {
            try {
                const tokenRes = await fetch(`/api/customers/${quote.customer_id}/portal-token`, { method: 'GET' });
                const tokenData = await tokenRes.json();
                const baseUrl = window.location.origin;
                const portalUrl = tokenData.token
                    ? `${baseUrl}/portal/${tokenData.token}`
                    : `${baseUrl}/portal`;
                setWaPortalLink(portalUrl);

                // 3. Build message from template
                const tpl = settings.whatsapp_template_quote ||
                    'Hello {customer_name}, here is your quotation {quote_code} for {quote_amount}. View it here: {portal_link}';
                const resolved = tpl
                    .replace('{customer_name}', quote.customer_name || '')
                    .replace('{quote_code}', quote.code || `#${quote.id}`)
                    .replace('{quote_amount}', `${currency}${parseFloat(quote.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                    .replace('{portal_link}', portalUrl);
                setWaMessage(resolved);
            } catch {
                setWaMessage('');
            }
        }
    };

    const handleSendWhatsApp = async () => {
        if (!quote?.customer_phone) {
            toast.error('No phone number linked to this customer.');
            return;
        }
        setWaSending(true);

        try {
            if (waMode === 'pdf') {
                // Fetch generated PDF as a base64 blob
                const pdfRes = await fetch(`/api/quotations/${id}/pdf`);
                if (!pdfRes.ok) throw new Error('Failed to generate PDF');
                const pdfBuffer = await pdfRes.arrayBuffer();
                // Chunked base64 — spreading a large Uint8Array causes "max call stack" errors
                const bytes = new Uint8Array(pdfBuffer);
                let binary = '';
                const CHUNK = 8192;
                for (let i = 0; i < bytes.length; i += CHUNK) {
                    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
                }
                const base64 = btoa(binary);

                const res = await fetch('/api/whatsapp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        number: quote.customer_phone,
                        quotation_id: quote.id,
                        message: waMessage,
                        media: {
                            data: base64,
                            mimetype: 'application/pdf',
                            filename: `Quotation-${quote.code || id}.pdf`
                        }
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Send failed');
                toast.success('Quotation PDF sent via WhatsApp!');
            } else {
                // Send as plain text with the portal link
                const res = await fetch('/api/whatsapp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number: quote.customer_phone, quotation_id: quote.id, message: waMessage })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Send failed');
                toast.success('Quotation link sent via WhatsApp!');
            }
            setWaModal(false);
        } catch (err) {
            toast.error(err.message || 'Failed to send WhatsApp message');
        } finally {
            setWaSending(false);
        }
    };

    // ── WhatsApp Acceptance Notification ────────────────────────────────────
    const [acceptanceNotif, setAcceptanceNotif] = useState(null);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/whatsapp/notifications?quotation_id=${id}&limit=1`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.notifications?.length) {
                    setAcceptanceNotif(data.notifications[0]);
                }
            })
            .catch(() => { });
    }, [id]);

    const handleConvert = (id) => {
        setConvertingId(id);
        setAutoDeduct(false);
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
                body: JSON.stringify({ quotation_id: id, auto_deduct_stock: autoDeduct }),
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

    const handleStatusChange = async (newStatus) => {
        try {
            const res = await fetch(`/api/quotations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setQuote(prev => ({ ...prev, status: newStatus }));
                toast.success('Status updated');
            } else {
                toast.error('Failed to update status');
            }
        } catch {
            toast.error('Error updating status');
        }
    };

    useEffect(() => {
        if (!id) return;
        fetch(`/api/quotations/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to load quotation');
                return res.json();
            })
            .then(data => {
                if (data.error) throw new Error(data.error);
                setQuote(data);
                console.log(data);
                if (data.code || data.id) {
                    document.title = data.code || `Quotation-${data.id}`;
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load quote", err);
                setError(err.message);
                setLoading(false);
            });
    }, [id]);

    if (loading) return <div className="text-white p-8">Loading...</div>;
    if (error || !quote) return <div className="text-white p-8">Error: {error || 'Quotation not found'}</div>;

    const subtotal = quote.items ? quote.items.reduce((acc, i) => acc + parseFloat(i.subtotal_amount || i.total_amount || 0), 0) : 0;
    const totalTax = quote.items ? quote.items.reduce((acc, i) => {
        return acc + parseFloat(i.tax_amount || 0);
    }, 0) : 0;
    const finalTotal = parseFloat(quote.total_amount);
    // Default to true if undefined, but DB should have it. MySQL returns 1 for true.
    const showSummary = quote.show_grand_total !== 0 && quote.show_grand_total !== false && quote.show_grand_total !== 'false';

    return (
        <div className="min-h-screen bg-transparent text-white p-8 print:bg-white print:text-black print:p-0">
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
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.type === 'sfg'
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
                                            <td className="px-4 py-3 text-gray-200 font-medium text-xs text-left">{s.name}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{s.required}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{s.available}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-red-400">{s.shortfall}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-600 mt-4 text-left">Restock the items above, then try converting again.</p>
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
            {/* ── WhatsApp Quotation Modal ─────────────────────────────────── */}
            {waModal && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-8 w-full max-w-lg shadow-2xl shadow-black/80">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <FiMessageCircle className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">Send Quotation via WhatsApp</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {quote.customer_phone
                                            ? <span>To: <span className="text-gray-300 font-mono">{quote.customer_phone}</span></span>
                                            : <span className="text-red-400">No phone number on customer record</span>}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setWaModal(false)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Connection Status */}
                        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl mb-5 border ${waStatus === 'LOADING' ? 'bg-yellow-500/5 border-yellow-500/20'
                            : waStatus === 'CONNECTED' ? 'bg-emerald-500/10 border-emerald-500/20'
                                : 'bg-red-500/10 border-red-500/20'
                            }`}>
                            <FiWifi className={`w-4 h-4 ${waStatus === 'LOADING' ? 'text-yellow-400 animate-pulse'
                                : waStatus === 'CONNECTED' ? 'text-emerald-400'
                                    : 'text-red-400'
                                }`} />
                            <span className={`text-xs font-semibold ${waStatus === 'LOADING' ? 'text-yellow-300'
                                : waStatus === 'CONNECTED' ? 'text-emerald-300'
                                    : 'text-red-300'
                                }`}>
                                {waStatus === 'LOADING' ? 'Checking WhatsApp connection…'
                                    : waStatus === 'CONNECTED' ? 'WhatsApp Connected — Ready to Send'
                                        : 'WhatsApp Disconnected — Connect in Settings'}
                            </span>
                        </div>

                        {/* Share Mode Toggle */}
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            <button
                                onClick={() => setWaMode('link')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${waMode === 'link'
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                    : 'bg-white/[0.03] border-white/[0.07] text-gray-400 hover:bg-white/[0.06]'
                                    }`}
                            >
                                <FiLink className="w-5 h-5" />
                                <span className="text-xs font-semibold">Send as Link</span>
                                <span className="text-[10px] text-center opacity-70">Portal link in message text</span>
                            </button>
                            <button
                                onClick={() => setWaMode('pdf')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${waMode === 'pdf'
                                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                                    : 'bg-white/[0.03] border-white/[0.07] text-gray-400 hover:bg-white/[0.06]'
                                    }`}
                            >
                                <FiFileText className="w-5 h-5" />
                                <span className="text-xs font-semibold">Send as PDF</span>
                                <span className="text-[10px] text-center opacity-70">Generated PDF as attachment</span>
                            </button>
                        </div>

                        {/* Message Preview/Editor */}
                        <div className="mb-6">
                            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Message Preview</label>
                            <textarea
                                value={waMessage}
                                onChange={e => setWaMessage(e.target.value)}
                                rows={5}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20 resize-none font-mono leading-relaxed"
                                placeholder="Message to send…"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setWaModal(false)}
                                disabled={waSending}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendWhatsApp}
                                disabled={waSending || waStatus !== 'CONNECTED' || !quote?.customer_phone}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                                {waSending ? (
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="40 20" />
                                    </svg>
                                ) : (
                                    <FiSend className="w-4 h-4" />
                                )}
                                {waSending ? 'Sending…' : waMode === 'pdf' ? 'Send PDF' : 'Send Link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Page Header (screen only) ───────────────────────────────── */}
            <div className="mb-8 print:hidden space-y-4">

                {/* Row 1: Navigation + Quote Identity */}
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/quotations">
                        <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-400 hover:text-white text-sm transition-all">
                            <FiArrowLeft className="w-4 h-4" />
                            <span>Back</span>
                        </button>
                    </Link>
                    <div className="h-5 w-px bg-white/10" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <span className="text-xl font-bold text-white tracking-tight">
                                {quote.code || `#${quote.id}`}
                            </span>
                            <span className="text-gray-600">·</span>
                            <span className="text-sm text-gray-400 truncate">{quote.customer_name}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                            {new Date(quote.created_at).toLocaleDateString('en-GB', { dateStyle: 'long' })}
                            {quote.total_amount && (
                                <> · <span className="text-gray-500 font-medium">{currency}{parseFloat(quote.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></>
                            )}
                        </p>
                    </div>

                    {/* WhatsApp Acceptance Badge — floats right in row 1 */}
                    {acceptanceNotif && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold shrink-0">
                            <FiMessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Accepted via WhatsApp</span>
                            <span className="text-emerald-600 font-normal">
                                {new Date(acceptanceNotif.received_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                        </div>
                    )}
                </div>

                {/* Row 2: Actions */}
                <div className="flex items-center gap-2 flex-wrap">

                    {/* Status selector */}
                    <select
                        value={quote.status || 'draft'}
                        onChange={e => handleStatusChange(e.target.value)}
                        className={`h-9 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border cursor-pointer bg-black/60 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all ${STATUS_COLORS[quote.status] || STATUS_COLORS.draft}`}
                    >
                        <option value="draft" className="bg-[#111] text-gray-300">Draft</option>
                        <option value="sent" className="bg-[#111] text-blue-300">Sent</option>
                        <option value="converted" className={`bg-[#111] text-emerald-300 ${quote.status !== 'converted' ? 'hidden' : ''}`}>Converted</option>
                        <option value="cancelled" className="bg-[#111] text-red-300">Cancelled</option>
                    </select>

                    <div className="h-6 w-px bg-white/10 mx-1" />

                    {/* Edit */}
                    <Link href={`/dashboard/quotations/${id}/edit`}>
                        <button className="h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-all">
                            <FiFileText className="w-3.5 h-3.5" />
                            Edit
                        </button>
                    </Link>

                    {/* Convert to SO */}
                    {quote.status !== 'converted' && (
                        <button
                            onClick={() => handleConvert(quote.id)}
                            className="h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-sm font-semibold transition-all"
                        >
                            <FiShoppingCart className="w-3.5 h-3.5" />
                            Convert to SO
                        </button>
                    )}

                    {/* Invoice */}
                    {!quote.has_invoice ? (
                        <Link href={`/dashboard/invoices/new?quotation_id=${id}&customer_name=${encodeURIComponent(quote.customer_name || '')}&customer_id=${quote.customer_id || ''}&amount=${quote.total_amount || 0}&description=${encodeURIComponent(quote.first_item_name || quote.job_description || '')}`}>
                            <button className="h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/30 text-blue-300 hover:text-blue-200 text-sm font-semibold transition-all">
                                <FiDollarSign className="w-3.5 h-3.5" />
                                Create Invoice
                            </button>
                        </Link>
                    ) : (
                        <div className="h-9 inline-flex items-center gap-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold">
                            <FiDollarSign className="w-3.5 h-3.5" />
                            Invoice Created
                        </div>
                    )}

                    <div className="h-6 w-px bg-white/10 mx-1" />

                    {/* WhatsApp */}
                    <button
                        onClick={openWaModal}
                        className="h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-[#128c7e]/20 hover:bg-[#128c7e]/40 border border-[#25d366]/25 text-[#25d366] hover:text-[#2edb6f] text-sm font-semibold transition-all"
                    >
                        <FiMessageCircle className="w-3.5 h-3.5" />
                        Send via WhatsApp
                    </button>

                    {/* Print */}
                    <button
                        onClick={() => window.print()}
                        className="h-9 inline-flex items-center gap-2 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-gray-400 hover:text-white text-sm font-medium transition-all"
                    >
                        <FiPrinter className="w-3.5 h-3.5" />
                        Print
                    </button>
                </div>
            </div>


            {/* Printable Area - A4 Size constrained if needed, or fluid */}
            <div className="quotation-print-container max-w-[210mm] mx-auto bg-white text-black p-12 rounded-xl shadow-2xl print:shadow-none print:rounded-none print:w-full min-h-[297mm] flex flex-col relative print:p-8"
                style={{ fontFamily: "'Google Sans', 'Product Sans', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>

                {/* Header */}
                <div className="flex justify-between items-start mb-12">
                    <div className="flex gap-4 items-start">
                        {settings.company_logo && (
                            <img src={settings.company_logo} alt="Company Logo" className="h-19 object-contain" />
                        )}
                        <div className=''>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{settings.company_name || 'Pressmatics Printing'}</h1>
                            <div className="text-sm text-gray-500 max-w-[250px] whitespace-pre-wrap mt-1">
                                {settings.company_address || 'Address Line 1\nAddress Line 2'}
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
                        {/* Left: Name + Address */}
                        <div>
                            <p className="text-xl font-bold text-gray-900">{quote.customer_name}</p>

                            {quote.customer_address && (
                                <p className="text-sm text-gray-400 mt-0 max-w-xs whitespace-pre-wrap leading-relaxed">
                                    {quote.customer_address}
                                </p>
                            )}
                            {(quote.customer_phone || quote.customer_email) && (
                                <div className="flex text-sm text-gray-400 gap-2">
                                    {quote.customer_phone && (
                                        <p className="flex items-center justify-end gap-1.5">
                                            {/* <span className="text-gray-400">☎</span> */}
                                            {quote.customer_phone}
                                        </p>
                                    )}
                                    <span className="text-gray-400">|</span>
                                    {quote.customer_email && (
                                        <p className="flex items-center justify-end gap-1.5">
                                            {/* <span className="text-gray-400">✉</span> */}
                                            {quote.customer_email}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right: Contact details */}

                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-8">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-900 text-xs font-bold text-gray-900 uppercase tracking-wider">
                                <th className="py-3 pr-4">Description</th>
                                <th className="py-3 px-4 text-center">Qty</th>
                                <th className="py-3 px-4 text-right">Unit Price <span>({currency})</span></th>
                                {!showSummary ? (
                                    <>
                                        <th className="py-3 px-4 text-right">Amount (Excl. Tax)</th>
                                        <th className="py-3 px-4 text-right">Tax </th>
                                        <th className="py-3 pl-4 text-right">Net Total</th>
                                    </>
                                ) : (
                                    <th className="py-3 pl-4 text-right">Amount <span>({currency})</span></th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {quote.items && quote.items.map((item, idx) => {
                                // 1. Parse values safely to numbers
                                const rawSubtotal = parseFloat(item.subtotal_amount || 0);
                                const rawTotal = parseFloat(item.total_amount || 0);
                                const taxAmount = parseFloat(item.tax_amount || 0);

                                // 2. Fallback to total_amount if the database subtotal is zero or empty
                                const itemSubtotal = rawSubtotal > 0 ? rawSubtotal : rawTotal;

                                // 3. Calculate unit price based on the correct item subtotal
                                const unitPrice = item.quantity > 0 ? itemSubtotal / item.quantity : 0;

                                const isTaxAdd = item.tax_mode === 'add';
                                const isTaxDeduct = item.tax_mode === 'deduct';

                                return (
                                    <tr key={item.id} className="border-b border-gray-100 align-top">
                                        <td className="py-4 pr-4">
                                            <div className="font-bold text-gray-900">{item.estimation_name}</div>
                                            <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">
                                                {item.job_description}
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-center font-mono">{item.quantity}</td>
                                        <td className="py-4 px-4 text-center font-mono text-gray-500">
                                            {unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>

                                        {!showSummary ? (
                                            <>
                                                <td className="py-4 px-4 text-right font-mono font-medium text-gray-700">
                                                    {itemSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-4 px-4 text-right font-mono text-xs text-gray-500">
                                                    {item.tax_mode !== 'none' ? (
                                                        <>
                                                            {/* <div>{item.tax_percentage}%</div> */}
                                                            <div>+{Math.abs(taxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                        </>
                                                    ) : '-'}
                                                </td>
                                                <td className="py-4 pl-4 text-right font-mono font-bold text-gray-900">
                                                    {currency}{rawTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </>
                                        ) : (
                                            /* FIXED: Changed from 'subtotal' to 'itemSubtotal' to prevent variable clashing */
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
                    <div className="flex justify-end mb-16 break-inside-avoid">
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
                                <span className="  tracking-tight">{currency}{finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer: Terms & Signature */}
                <div className="grid grid-cols-3 gap-12 border-t border-gray-100 pt-8 break-inside-avoid">
                    <div className='col-span-2'>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Terms & Conditions</h4>
                        <div className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
                            {quote.terms_and_conditions || settings.default_terms || 'No specific terms.'}
                        </div>
                    </div>
                </div>
                <div className="flex w-full" />
                <div className="flex flex-col items-end justify-end text-center mt-10">
                    <div className="flex flex-col items-center">
                        {settings.company_signature && (
                            <img src={settings.company_signature} alt="Signature" className="h-15 mb-[-10px] object-contain" />
                        )}
                        <div className="border-t border-gray-300 w-48 mt-0 pt-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Authorized Signature</p>
                        </div>
                    </div>
                </div>

            </div>

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

                    body::before {
                        display: none !important;
                    }

                    aside,
                    nav,
                    .print\\:hidden,
                    button {
                        display: none !important;
                    }

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

                    @page {
                        margin: 0;
                        size: A4 portrait;
                    }
                }
            `}} />
        </div>
    );
}
