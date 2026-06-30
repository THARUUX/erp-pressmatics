'use client';

import { use, useState, useEffect } from 'react';

export default function StaticsItemPage({ params }) {
    const { id } = use(params);
    const [item, setItem]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState(null);

    useEffect(() => {
        fetch(`/api/statics/${id}`)
            .then(r => r.json())
            .then(d => {
                if (d.error) throw new Error(d.error);
                setItem(d);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
            <div className="text-center">
                <div className="w-10 h-10 rounded-full border-2 border-white/[0.07] border-t-violet-400 mx-auto mb-4 animate-spin" />
                <p className="text-slate-600 text-sm">Loading…</p>
            </div>
        </div>
    );

    if (error || !item) return (
        <div className="min-h-screen bg-[#07070f] flex items-center justify-center">
            <div className="text-center space-y-2">
                <p className="text-4xl">⚠️</p>
                <p className="text-red-400 text-sm">{error || 'Item not found'}</p>
            </div>
        </div>
    );

    const isActive = item.is_active === 1;

    return (
        <div className="min-h-screen bg-[#07070f] font-sans text-slate-100">
            {/* Top gradient wash */}
            <div className="fixed top-0 left-0 right-0 h-72 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(139,92,246,0.15)_0%,transparent_70%)] pointer-events-none z-0" />

            <div className="relative z-10 max-w-[480px] mx-auto px-5 pt-10 pb-16">
                {/* Brand header */}
                <div className="mb-8 text-center">
                    <p className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.2em] mb-2">
                        Pressmatics · Static Asset
                    </p>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                        isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-red-500/10 text-red-400 border-red-500/25'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        {isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>

                {/* Main card */}
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
                    {/* Item name header */}
                    <div className="px-6 py-5 border-b border-white/[0.06]">
                        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">{item.name}</h1>
                        <p className="font-mono text-[11px] text-slate-600 mt-1">{item.item_code}</p>
                    </div>

                    {/* Details grid */}
                    <div className="px-6 py-5 grid grid-cols-2 gap-3">
                        {[
                            { label: 'Category', val: item.category },
                            { label: 'Type', val: item.type || '—' },
                            { label: 'Unit', val: item.uom || '—' },
                            { label: 'Unit Cost', val: item.unit_cost != null ? `${parseFloat(item.unit_cost).toFixed(4)}` : '—' },
                        ].map(({ label, val }) => (
                            <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                                <span className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">{label}</span>
                                <span className="text-sm font-semibold text-slate-200">{val}</span>
                            </div>
                        ))}
                    </div>

                    {/* Description */}
                    {item.description && (
                        <div className="px-6 pb-5">
                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-4">
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-2">Description</p>
                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{item.description}</p>
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-center mt-8 text-[10px] text-slate-800 tracking-widest uppercase">
                    Pressmatics ERP · Asset Catalogue
                </p>
            </div>
        </div>
    );
}
