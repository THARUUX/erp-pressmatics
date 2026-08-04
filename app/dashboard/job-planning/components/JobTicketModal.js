'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiX, FiDownload, FiExternalLink, FiPrinter, FiPackage, FiLayers, FiSettings, FiCheckCircle, FiClock, FiUser, FiCalendar, FiCpu, FiChevronDown, FiCheck } from 'react-icons/fi';

function formatFinishingVolume(f, detail, itemQuantity) {
    const speedUnit = f.speed_unit || f.machine_speed_unit || f.cost_unit || '';
    const su = speedUnit.toLowerCase().trim();
    const qtyVal = parseFloat(itemQuantity || (detail && detail.quantity)) || 0;
    let qty = parseFloat(f.quantity) || 0;

    if (su.includes('unit')) {
        qty = qtyVal;
    } else if (detail) {
        const pagesVal = parseInt(detail.pages) || 1;
        const upsVal = parseInt(detail.ups) || 1;
        const sidesVal = parseInt(detail.sides) || 1;
        const divisor = upsVal * sidesVal;
        let netCutSheets = parseFloat(detail.printed_sheets) || 0;
        if (divisor > 0 && qtyVal > 0) {
            netCutSheets = Math.ceil((pagesVal * qtyVal) / divisor);
        }
        const totalCutSheets = netCutSheets + (parseFloat(detail.wastage_sheets) || 0);

        if (su.includes('print')) {
            qty = totalCutSheets * sidesVal;
        } else if (su.includes('sheet')) {
            qty = totalCutSheets;
        }
    }

    const displayUnit = speedUnit.replace(/\/(Hr|Hour|hr|h)$/i, '').trim();
    return `${qty.toLocaleString()} ${displayUnit}`;
}

export default function JobTicketModal({ orderId, onClose }) {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [bom, setBom] = useState([]);
    const [pdfLayout, setPdfLayout] = useState('clean');
    const [showLayoutMenu, setShowLayoutMenu] = useState(false);

    useEffect(() => {
        if (!orderId) return;
        let isMounted = true;
        setLoading(true);
        setError(null);

        async function loadData() {
            try {
                const res = await fetch(`/api/sales-orders/${orderId}`);
                if (!res.ok) throw new Error(`Failed to load sales order (${res.status})`);
                const data = await res.json();
                if (data.error) throw new Error(data.error);

                // Fetch BOM as well
                let bomData = [];
                try {
                    const bomRes = await fetch(`/api/sales-orders/${orderId}/bom`);
                    if (bomRes.ok) {
                        bomData = await bomRes.json();
                    }
                } catch (bErr) {
                    console.error('BOM fetch error:', bErr);
                }

                if (isMounted) {
                    setOrder(data.salesOrder);
                    setBom(Array.isArray(bomData) ? bomData : []);
                }
            } catch (err) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadData();
        return () => { isMounted = false; };
    }, [orderId]);

    const handleDownloadPdf = async (layout = pdfLayout) => {
        if (!orderId) return;
        setPdfLoading(true);
        try {
            const res = await fetch(`/api/sales-orders/${orderId}/pdf?layout=${layout}`);
            if (!res.ok) throw new Error('PDF generation failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `job-ticket-${order?.code || orderId}-${layout}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to download PDF: ' + err.message);
        } finally {
            setPdfLoading(false);
            setShowLayoutMenu(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[99999] bg-black/20 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-black border border-white/15 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-[0_32px_96px_rgba(0,0,0,0.9)] flex flex-col text-slate-100"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between sticky top-0  backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 border border-white/20 rounded-xl text-white">
                            <FiPackage className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-white tracking-tight m-0">Job Ticket Data</h2>
                                {order && (
                                    <Link
                                        href={`/dashboard/sales-orders/${order.id}`}
                                        target="_blank"
                                        className="text-xs font-extrabold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded hover:bg-amber-500/30 transition-all flex items-center gap-1"
                                        title="Open Sales Order page"
                                    >
                                        {order.code} <FiExternalLink className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 m-0 mt-0.5">
                                {order ? `${order.customer_name} • Ref: ${order.quotation?.code || 'QTN-' + order.quotation_id}` : 'Loading job ticket details...'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {order && (
                            <>
                                <div className="relative inline-flex rounded-lg shadow-sm">
                                    <button
                                        onClick={() => handleDownloadPdf(pdfLayout)}
                                        disabled={pdfLoading}
                                        className="px-3 py-1.5 bg-blue-600/30 border border-blue-500/40 hover:bg-blue-600/50 text-blue-200 text-xs font-semibold rounded-l-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <FiDownload className="w-3.5 h-3.5" />
                                        {pdfLoading ? 'Generating...' : pdfLayout === 'clean' ? 'PDF (Clean)' : 'PDF (Boxed)'}
                                    </button>
                                    <button
                                        onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                                        disabled={pdfLoading}
                                        className="px-1.5 py-1.5 bg-blue-600/30 border border-l-0 border-blue-500/40 hover:bg-blue-600/50 text-blue-200 text-xs font-semibold rounded-r-lg transition-all disabled:opacity-50"
                                        title="Select PDF Layout Style"
                                    >
                                        <FiChevronDown className="w-3.5 h-3.5" />
                                    </button>

                                    {showLayoutMenu && (
                                        <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-900 border border-white/20 rounded-xl shadow-2xl z-50 p-1.5 text-xs">
                                            <button
                                                onClick={() => { setPdfLayout('clean'); handleDownloadPdf('clean'); }}
                                                className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between ${pdfLayout === 'clean' ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/40' : 'hover:bg-white/10 text-slate-200'}`}
                                            >
                                                <div>
                                                    <div className="font-semibold">Clean Document</div>
                                                    <div className="text-[10px] text-slate-400 font-normal">Minimalist editorial style</div>
                                                </div>
                                                {pdfLayout === 'clean' && <FiCheck className="w-3.5 h-3.5 text-blue-400" />}
                                            </button>
                                            <button
                                                onClick={() => { setPdfLayout('boxed'); handleDownloadPdf('boxed'); }}
                                                className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between mt-1 ${pdfLayout === 'boxed' ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/40' : 'hover:bg-white/10 text-slate-200'}`}
                                            >
                                                <div>
                                                    <div className="font-semibold">Boxed Cards</div>
                                                    <div className="text-[10px] text-slate-400 font-normal">Structured card containers</div>
                                                </div>
                                                {pdfLayout === 'boxed' && <FiCheck className="w-3.5 h-3.5 text-blue-400" />}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <Link
                                    href={`/dashboard/sales-orders/${order.id}`}
                                    target="_blank"
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
                                >
                                    <FiExternalLink className="w-3.5 h-3.5" />
                                    Open SO Page
                                </Link>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all ml-2"
                        >
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-6 flex flex-col gap-6">
                    {loading ? (
                        <div className="py-16 text-center text-slate-400">
                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-sm">Fetching job ticket specifications...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                            Error loading job ticket: {error}
                        </div>
                    ) : !order ? (
                        <div className="p-4 text-center text-slate-400 text-sm">Sales order not found.</div>
                    ) : (
                        <>
                            {/* Summary Metadata Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white/[0.02] border border-white/[0.08] p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Job Code</span>
                                    <Link
                                        href={`/dashboard/sales-orders/${order.id}`}
                                        target="_blank"
                                        className="text-sm font-bold text-amber-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                                    >
                                        {order.code} <FiExternalLink className="w-3 h-3 text-slate-400" />
                                    </Link>
                                </div>
                                <div className="bg-white/[0.02] border border-white/[0.08] p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer</span>
                                    <div className="text-sm font-bold text-slate-200 truncate mt-0.5">{order.customer_name || '—'}</div>
                                </div>
                                <div className="bg-white/[0.02] border border-white/[0.08] p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Order Status</span>
                                    <span className="inline-block mt-1 text-[11px] font-extrabold px-2 py-0.5 rounded bg-white/15 border border-white/30 text-white">
                                        {order.status || 'Pending'}
                                    </span>
                                </div>
                                <div className="bg-white/[0.02] border border-white/[0.08] p-3 rounded-xl">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Delivery Date</span>
                                    <div className="text-sm font-bold text-emerald-400 mt-0.5">
                                        {order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'TBD'}
                                    </div>
                                </div>
                            </div>

                            {/* Job Description */}
                            {order.quotation?.job_description && (
                                <div className="bg-white/[0.02] border border-white/[0.06] p-3.5 rounded-xl text-xs text-slate-300">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Job Context / Description</span>
                                    {order.quotation.job_description}
                                </div>
                            )}

                            {/* Job Note / Production Instructions */}
                            {order.job_notes && (
                                <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-xs text-amber-200">
                                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">Job Note / Production Instructions</span>
                                    {order.job_notes}
                                </div>
                            )}

                            {/* Job Line Items & Components */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    <FiSettings className="w-4 h-4 text-purple-400" /> Technical Production Items &amp; Component Specs
                                </div>

                                {order.items?.map((item, idx) => (
                                    <div key={item.id || idx} className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
                                        <div className="bg-white/[0.04] px-4 py-2.5 border-b border-white/10 flex justify-between items-center text-xs font-bold text-white">
                                            <span>{idx + 1}. {item.estimation_name || item.job_description || `Item ${item.id}`}</span>
                                            <span className="bg-white/20 text-white px-2 py-0.5 rounded border border-white/30 text-[11px]">
                                                Qty: {item.quantity?.toLocaleString() || '—'}
                                            </span>
                                        </div>

                                        <div className="p-4 flex flex-col gap-3">
                                            {/* Details / Printing Components */}
                                            {item.details?.filter(d => {
                                                const nameLower = (d.component_name || '').toLowerCase();
                                                const isFinishing = nameLower.includes('finish');
                                                const isSFGComp = d.type === 'sfg' || nameLower.includes('assets') || nameLower.includes('sfg');
                                                const isServicesComp = d.type === 'services' || nameLower.includes('service');
                                                const isPrinting = !isFinishing && !isSFGComp && !isServicesComp;

                                                if (isPrinting) return true;
                                                return (d.finishings?.length > 0 || d.services?.length > 0 || d.sfgLines?.length > 0);
                                            }).map((detail, dIdx) => {
                                                const nameLower = (detail.component_name || '').toLowerCase();
                                                const isFinishing = nameLower.includes('finish');
                                                const isSFGComp = detail.type === 'sfg' || nameLower.includes('assets') || nameLower.includes('sfg');
                                                const isServicesComp = detail.type === 'services' || nameLower.includes('service');
                                                const isPrinting = !isFinishing && !isSFGComp && !isServicesComp;

                                                return (
                                                    <div key={detail.id || dIdx} className="bg-white/1 border border-white/10 rounded-lg p-3 text-xs flex flex-col gap-2">
                                                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                                            <span className="font-bold text-white text-xs flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full bg-blue-400" />
                                                                {detail.component_name} ({detail.type?.toUpperCase()})
                                                            </span>
                                                            {detail.machine_name && (
                                                                <span className="text-[11px] text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded font-mono">
                                                                    Machine: {detail.machine_name}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {(() => {
                                                            if (!isPrinting) return null;

                                                            const pagesVal = parseInt(detail.pages) || 1;
                                                            const upsVal = parseInt(detail.ups) || 1;
                                                            const sidesVal = parseInt(detail.sides) || 1;
                                                            const qtyVal = parseFloat(item.quantity || detail.quantity) || 0;
                                                            const divisor = upsVal * sidesVal;

                                                            let netCutSheets = parseFloat(detail.printed_sheets) || 0;
                                                            if (divisor > 0 && qtyVal > 0) {
                                                                netCutSheets = Math.ceil((pagesVal * qtyVal) / divisor);
                                                            }
                                                            const wastageSheets = parseFloat(detail.wastage_sheets) || 0;
                                                            const totalCutSheets = netCutSheets + wastageSheets;

                                                            return (
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-300 pt-1">
                                                                    <div>
                                                                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Paper Stock</span>
                                                                        <span className="font-semibold text-white">{detail.paper_name || '—'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Cut Sheets</span>
                                                                        <span className="font-semibold text-emerald-400 block">
                                                                            {totalCutSheets.toLocaleString()} sheets
                                                                        </span>
                                                                        <span className="text-[9px] text-slate-400 block">
                                                                            ({netCutSheets.toLocaleString()} + {wastageSheets.toLocaleString()} wst)
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Colors &amp; Sides</span>
                                                                        <span>
                                                                            {detail.colors_front ?? detail.colors ?? 0}
                                                                            {detail.colors_back != null ? `+${detail.colors_back}` : ''} colors
                                                                            {' · '}{detail.sides === 2 ? 'Double-sided' : 'Single-sided'}
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Imposition Ups</span>
                                                                        <span>{detail.ups ? `${detail.ups} Ups` : '—'}</span>
                                                                        <span className="text-[9px] text-slate-400 block">
                                                                            Impressions: {(parseFloat(detail.printed_sheets) || 0).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Component SFG Lines */}
                                                        {detail.sfgLines?.length > 0 && (
                                                            <div className="mt-2 rounded py-2 border-t border-white/5">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                                                                    Required SFG &amp; Stock Assets
                                                                </span>
                                                                <div className="flex flex-col gap-1">
                                                                    {detail.sfgLines.map((sfg, sfgIdx) => (
                                                                        <div key={sfgIdx} className="text-[11px] text-slate-300 bg-white/5 border border-white/10 px-2 py-1 rounded flex justify-between">
                                                                            <span>{sfg.item_name || sfg.name} <span className="text-slate-500 font-mono text-[9px]">({sfg.item_code})</span></span>
                                                                            <span className="font-bold text-white">{sfg.quantity} {sfg.uom || 'Unit'}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Component Services */}
                                                        {detail.services?.length > 0 && (
                                                            <div className="mt-2 rounded py-2 border-t border-white/5">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                                                                    Production Services &amp; Assignments
                                                                </span>
                                                                <div className="flex flex-col gap-1.5">
                                                                    {detail.services.map((svc, svcIdx) => (
                                                                        <div key={svcIdx} className="text-[11px] text-slate-300 bg-white/5 border border-white/10 px-2 py-1.5 rounded flex flex-col gap-0.5">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="font-bold text-white">{svc.service_name}</span>
                                                                                {svc.employee_name && <span className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.2 rounded">{svc.employee_name}</span>}
                                                                            </div>
                                                                            {svc.note && <span className="text-[10px] text-slate-400 font-serif italic">{svc.note}</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Component Finishings */}
                                                        {detail.finishings?.length > 0 && (
                                                            <div className="mt-2 rounded py-2 border-t border-white/5">
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                                                                    Component Finishings
                                                                </span>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {detail.finishings.map((f, fIdx) => (
                                                                        <span key={fIdx} className="text-[10px] bg-slate-800 border border-white/10 px-2 py-0.5 rounded text-slate-200">
                                                                            {f.name} {f.machine_name ? `(${f.machine_name})` : ''} {f.quantity ? `— ${formatFinishingVolume(f, detail, item.quantity)}` : ''}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* Global Finishings */}
                                            {item.globalFinishings?.length > 0 && (
                                                <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-3 text-xs">
                                                    <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block mb-1">
                                                        Post-Press &amp; Assembly Finishings
                                                    </span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.globalFinishings.map((gf, gIdx) => (
                                                            <span key={gIdx} className="text-[11px] bg-indigo-900/40 border border-indigo-400/30 px-2 py-0.5 rounded text-indigo-200 font-medium">
                                                                {gf.name} {gf.machine_name ? `(${gf.machine_name})` : ''} {gf.quantity ? `— ${formatFinishingVolume(gf, null, item.quantity)}` : ''}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* BOM Section */}
                            {bom.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        <FiLayers className="w-4 h-4 text-emerald-400" /> Bill of Materials (Raw Materials &amp; Stocks)
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden text-xs">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/10 text-[10px] uppercase text-slate-400 font-bold">
                                                    <th className="p-2.5">Material / Component</th>
                                                    <th className="p-2.5">Type</th>
                                                    <th className="p-2.5 text-right">Required</th>
                                                    <th className="p-2.5 text-right">Issued</th>
                                                    <th className="p-2.5 text-right">Stock</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-slate-300">
                                                {bom.map((b) => (
                                                    <tr key={b.id} className="hover:bg-white/[0.02]">
                                                        <td className="p-2.5 font-medium text-white">{b.component_name}</td>
                                                        <td className="p-2.5 uppercase text-[10px] text-slate-400 font-bold">{b.component_type}</td>
                                                        <td className="p-2.5 text-right font-mono">{b.required_qty} {b.uom}</td>
                                                        <td className="p-2.5 text-right font-mono text-emerald-400">{b.issued_qty} {b.uom}</td>
                                                        <td className="p-2.5 text-right font-mono">{b.available_qty} {b.uom}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Tasks List Summary */}
                            {order.tasks?.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        <FiClock className="w-4 h-4 text-amber-400" /> Scheduled Production Tasks ({order.tasks.length})
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                        {order.tasks.map(t => (
                                            <div key={t.id} className="bg-white/[0.02] border border-white/5 p-2.5 rounded-lg flex items-center justify-between">
                                                <div className="min-w-0 pr-2">
                                                    <div className="font-semibold text-white truncate">{t.name}</div>
                                                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                                        {t.machine_name ? `Machine: ${t.machine_name}` : 'Unassigned'}
                                                        {t.estimated_minutes ? ` · ${t.estimated_minutes} min` : ''}
                                                    </div>
                                                </div>
                                                <span className={`text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded shrink-0 ${t.status === 'done' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                                    t.status === 'in_progress' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                                        'bg-slate-800 text-slate-400 border border-slate-700'
                                                    }`}>
                                                    {t.status?.replace('_', ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
