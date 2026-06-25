'use client';

import { use, useEffect, useState } from 'react';
import { FiPrinter, FiArrowLeft, FiDollarSign } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { useSettings } from '@/components/SettingsContext';

export default function QuotationViewPage({ params }) {
    const { id } = use(params);
    const { settings } = useSettings();
    const currency = settings.currency || '$';

    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
            {/* No Print Header */}
            <div className="flex justify-between items-center mb-8 print:hidden">
                <Link href="/dashboard/quotations">
                    <Button className="bg-white/5 border border-white/20 hover:bg-white/10">
                        <FiArrowLeft className="mr-2" /> Back to List
                    </Button>
                </Link>
                <div className="flex gap-4">
                    <Link href={`/dashboard/quotations/${id}/edit`}>
                        <Button className="bg-blue-600 text-white hover:bg-blue-700">
                            Edit Quote
                        </Button>
                    </Link>
                    {!quote.has_invoice ? (
                        <Link href={`/dashboard/invoices/new?quotation_id=${id}&customer_name=${encodeURIComponent(quote.customer_name || '')}&customer_id=${quote.customer_id || ''}&amount=${quote.total_amount || 0}&description=${encodeURIComponent(quote.first_item_name || quote.job_description || '')}`}>
                            <Button className="bg-emerald-600 text-white hover:bg-emerald-500">
                                <FiDollarSign className="mr-2" /> Create Invoice
                            </Button>
                        </Link>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                            <FiDollarSign className="w-3.5 h-3.5" /> Invoice Created
                        </span>
                    )}
                    <Button onClick={() => window.print()} className="bg-white text-black hover:bg-gray-200">
                        <FiPrinter className="mr-2" /> Print Quote
                    </Button>
                </div>
            </div>

            {/* Printable Area - A4 Size constrained if needed, or fluid */}
            <div className="max-w-[210mm] mx-auto bg-white text-black p-12 rounded-xl shadow-2xl print:shadow-none print:rounded-none print:w-full min-h-[297mm] flex flex-col relative print:p-8"
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
                                <th className="py-3 px-4 text-right">Unit Price <span>( {currency})</span></th>
                                {!showSummary ? (
                                    <>
                                        <th className="py-3 px-4 text-right">Amount (Excl. Tax)</th>
                                        <th className="py-3 px-4 text-right">Tax </th>
                                        <th className="py-3 pl-4 text-right">Net Total</th>
                                    </>
                                ) : (
                                    <th className="py-3 pl-4 text-right">Amount <span>( {currency})</span></th>
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
                                                {currency}{itemSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <div className="flex w-full"/>
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
        </div>
    );
}
