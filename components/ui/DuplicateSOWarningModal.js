'use client';

import { FiAlertTriangle, FiShoppingCart, FiClock, FiCheckCircle, FiX } from 'react-icons/fi';

export default function DuplicateSOWarningModal({
    isOpen,
    customerName,
    matchingOrders = [],
    onCancel,
    onConfirm,
    isSubmitting = false
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn">
            <div className="bg-[#0f0f0f] border border-amber-500/30 rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-[0_24px_64px_rgba(245,158,11,0.15)] text-left relative overflow-hidden">
                {/* Decorative Amber Gradient Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400" />

                {/* Close X Button */}
                <button
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-50"
                >
                    <FiX className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3.5 mb-5">
                    <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 shrink-0">
                        <FiAlertTriangle className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight">Existing Sales Order Found</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Customer: <span className="text-amber-300 font-semibold">{customerName || 'N/A'}</span>
                        </p>
                    </div>
                </div>

                {/* Description Body */}
                <p className="text-xs text-gray-300 leading-relaxed mb-4">
                    A Sales Order with the <span className="text-white font-semibold underline decoration-amber-500/50">same job name and customer</span> already exists in the system. Please verify if this is a duplicate order:
                </p>

                {/* Existing Matching Orders Table/List */}
                <div className="my-4 max-h-56 overflow-y-auto space-y-2.5 pr-1">
                    {matchingOrders.map((order, idx) => (
                        <div
                            key={order.id || idx}
                            className="bg-white/[0.03] border border-amber-500/20 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.05] transition-all"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                        {order.code || `#${order.id}`}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-200 truncate">
                                        {order.job_names || 'Existing Job'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <FiClock className="w-3 h-3 text-gray-500" />
                                        {order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}
                                    </span>
                                    {order.total_amount && (
                                        <span className="font-mono text-gray-300">
                                            LKR {parseFloat(order.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="shrink-0">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                    order.status === 'Completed' || order.status === 'Delivered'
                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}>
                                    <FiCheckCircle className="w-3 h-3" />
                                    {order.status || 'Active'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Warning Note */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 mb-6 flex items-start gap-2">
                    <FiAlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                        Continuing will create an additional Sales Order with duplicate job parameters.
                    </span>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                    >
                        <FiShoppingCart className="w-3.5 h-3.5" />
                        {isSubmitting ? 'Converting...' : 'Proceed & Create Order'}
                    </button>
                </div>
            </div>
        </div>
    );
}
