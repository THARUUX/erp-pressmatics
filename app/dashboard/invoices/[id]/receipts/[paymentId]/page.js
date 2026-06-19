'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiPrinter } from 'react-icons/fi';
import { useSettings } from '@/components/SettingsContext';

const RECEIPT_FONT = "'Google Sans', 'Product Sans', Roboto, 'Helvetica Neue', Arial, sans-serif";

export default function PaymentReceiptPage({ params }) {
    const { id, paymentId } = use(params);
    const { settings } = useSettings();
    const currency = settings.currency || 'LKR';

    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/invoices/${id}/payments/${paymentId}`)
            .then(r => r.json())
            .then(data => { setPayment(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id, paymentId]);

    const fmt = n => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (loading) return <div className="p-8 text-gray-400">Loading receipt...</div>;
    if (!payment || payment.error) return <div className="p-8 text-red-400">Receipt not found.</div>;

    const receiptNo = `RCP-${String(payment.id).padStart(5, '0')}`;
    const paymentDate = new Date(payment.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-transparent text-white">

            {/* ── TOOLBAR ── */}
            <div className="flex justify-between items-center mb-6 print:hidden">
                <div className="flex items-center gap-4">
                    <Link href={`/dashboard/invoices/${id}`}>
                        <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">
                            <FiArrowLeft />
                        </button>
                    </Link>
                    <div>
                        <p className="text-xs text-gray-500 font-mono">{receiptNo}</p>
                        <h1 className="text-2xl font-bold tracking-tighter">Payment Receipt</h1>
                    </div>
                </div>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-white text-black rounded-xl font-semibold hover:bg-gray-100"
                >
                    <FiPrinter className="w-3.5 h-3.5" /> Print Receipt
                </button>
            </div>

            {/* ══════════════════════════════════
                  A5 PRINTABLE RECEIPT
                ══════════════════════════════════ */}
            <div
                className="max-w-[148mm] mx-auto bg-white text-black rounded-xl shadow-2xl print:shadow-none print:rounded-none print:max-w-none min-h-[210mm] flex flex-col p-10 print:p-8"
                style={{ fontFamily: RECEIPT_FONT }}
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div className="flex gap-3 items-start mt-2">
                        {settings.company_logo && (
                            <img src={settings.company_logo} alt="Logo" className="h-15 object-contain" />
                        )}
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 leading-tight">{settings.company_name || 'Pressmatics'}</h1>
                            {settings.company_address && (
                                <div className="text-xs text-gray-500 whitespace-pre-wrap mt-0.5 max-w-[180px]">{settings.company_address}</div>
                            )}
                            {payment.customer_vat_number ? (
                                settings.company_vat_reg && payment.cus(
                                    <div className="text-xs text-gray-400 mt-0.5">VAT: <span className="font-mono">{settings.company_vat_reg}</span></div>
                                )
                            ) : <></>}
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-bold text-gray-200 uppercase tracking-widest">Receipt</h2>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs mt-1 text-right">
                            <dt className="text-gray-500">No:</dt>
                            <dd className="font-mono font-bold">{receiptNo}</dd>
                            <dt className="text-gray-500">Date:</dt>
                            <dd>{paymentDate}</dd>
                            <dt className="text-gray-500">Invoice:</dt>
                            <dd className="font-mono">{payment.invoice_code}</dd>
                            {payment.quotation_code && <>
                                <dt className="text-gray-500">Quotation:</dt>
                                <dd className="font-mono">{payment.quotation_code}</dd>
                            </>}
                        </dl>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t-2 border-gray-900 mb-6" />

                {/* Received From */}
                <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Received From</p>
                    <p className="text-xl font-bold text-gray-900">{payment.customer_name}</p>
                    {payment.customer_address && (
                        <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap max-w-xs">{payment.customer_address}</p>
                    )}
                    {payment.customer_vat_number && (
                        <p className="text-xs text-gray-500 mt-0.5">VAT No: <span className="font-mono font-semibold text-gray-700">{payment.customer_vat_number}</span></p>
                    )}
                </div>

                {/* Payment Details Box */}
                <div className="bg-gray-50 rounded-lg p-5 mb-6 border border-gray-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Payment Details</p>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">For Invoice</span>
                            <span className="font-mono font-bold text-gray-900">{payment.invoice_code}</span>
                        </div>
                        {payment.invoice_description && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Description</span>
                                <span className="font-semibold text-gray-800 text-right max-w-[55%]">{payment.invoice_description}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-gray-500">Payment Method</span>
                            <span className="font-semibold text-gray-800">{payment.method}</span>
                        </div>
                        {payment.reference && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Reference</span>
                                <span className="font-mono text-gray-700">{payment.reference}</span>
                            </div>
                        )}
                        {payment.notes && (
                            <div className="flex justify-between">
                                <span className="text-gray-500">Notes</span>
                                <span className="text-gray-600 italic text-xs text-right max-w-[55%]">{payment.notes}</span>
                            </div>
                        )}
                    </div>

                    {/* Amount */}
                    <div className="mt-4 pt-4 border-t-2 border-gray-900 flex justify-between items-end">
                        <span className="text-sm font-bold text-gray-900 uppercase tracking-wider">Amount Received</span>
                        <span className="text-3xl font-bold font-mono text-gray-900">{currency} {fmt(payment.amount)}</span>
                    </div>
                </div>

                {/* Balance summary */}
                <div className="flex justify-between text-xs text-gray-500 mb-6 px-1">
                    <span>Invoice Total: <span className="font-mono">{currency} {fmt(payment.amount_due)}</span></span>
                    <span>Total Paid: <span className="font-mono text-emerald-600">{currency} {fmt(payment.amount_paid)}</span></span>
                    <span>Balance: <span className={`font-mono font-semibold ${parseFloat(payment.amount_paid) >= parseFloat(payment.amount_due) ? 'text-emerald-600' : 'text-red-500'}`}>
                        {currency} {fmt(Math.max(0, parseFloat(payment.amount_due) - parseFloat(payment.amount_paid)))}
                    </span></span>
                </div>

                {/* Flex spacer */}
                <div className="flex-1" />

                {/* Footer: Authorized Signature */}
                <div className="border-t border-gray-100 pt-6 mt-4 grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            This is a computer-generated receipt. Please retain for your records.
                        </p>
                    </div>
                    <div className="flex flex-col items-center justify-end">
                        {settings.company_signature && (
                            <img src={settings.company_signature} alt="Signature" className="h-10 mb-2 object-contain" />
                        )}
                        {!settings.company_signature && <div className="h-10 mb-2" />}
                        <div className="border-t border-gray-300 w-full pt-1 text-center">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Authorized Signature</p>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-6 pt-4 border-t border-gray-50">
                    <p className="text-xs text-gray-300 uppercase tracking-widest">Thank you for your payment</p>
                </div>
            </div>
        </div>
    );
}
