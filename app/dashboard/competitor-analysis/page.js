'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiPlus, FiTrendingDown, FiTrendingUp, FiMinus, FiTrash2, FiTarget, FiSearch } from 'react-icons/fi';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useSettings } from '@/components/SettingsContext';

function PriceBadge({ ours, theirs }) {
    if (!ours || !theirs) return null;
    const diff = ((theirs - ours) / ours) * 100;
    if (diff > 0) return (
        <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
            <FiTrendingDown className="w-3 h-3" /> {diff.toFixed(3)}% cheaper
        </span>
    );
    if (diff < 0) return (
        <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
            <FiTrendingUp className="w-3 h-3" /> {Math.abs(diff).toFixed(3)}% more expensive
        </span>
    );
    return <span className="flex items-center gap-1 text-white/40 text-xs"><FiMinus className="w-3 h-3" /> At par</span>;
}

export default function CompetitorAnalysisListPage() {
    const { settings } = useSettings();
    const currency = settings.currency || '';
    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchData = () => {
        setLoading(true);
        fetch('/api/competitor-analysis')
            .then(r => r.json())
            .then(d => { setAnalyses(Array.isArray(d) ? d : []); setLoading(false); })
            .catch(() => setLoading(false));
    };
    useEffect(fetchData, []);

    const handleDelete = async (id, e) => {
        e.preventDefault();
        if (!(await confirmDialog('Delete this analysis?'))) return;
        const res = await fetch(`/api/competitor-analysis/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Deleted'); fetchData(); } else toast.error('Failed to delete');
    };

    return (
        <div className="text-white space-y-6">
            {/* Header */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Competitor Analysis</h1>
                    <p className="text-sm text-white/40 mt-1">Compare your pricing against the market</p>
                </div>
                <div className="flex items-center gap-3 flex-1 justify-end">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search analyses…"
                            className="pl-9 pr-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 w-56 transition-all"
                        />
                    </div>
                    <Link href="/dashboard/competitor-analysis/new"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all whitespace-nowrap">
                        <FiPlus className="w-4 h-4" /> New Analysis
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="py-24 text-center text-white/25">Loading…</div>
            ) : analyses.length === 0 ? (
                <div className="py-24 text-center space-y-3">
                    <FiTarget className="w-10 h-10 text-white/10 mx-auto" />
                    <p className="text-white/25 text-sm">No analyses yet. Create one to start tracking competitor pricing.</p>
                    <Link href="/dashboard/competitor-analysis/new" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
                        <FiPlus className="w-4 h-4" /> Create your first analysis
                    </Link>
                </div>
            ) : (() => {
                const filtered = analyses.filter(a =>
                    a.name?.toLowerCase().includes(search.toLowerCase())
                );
                if (filtered.length === 0) return (
                    <div className="py-24 text-center space-y-2">
                        <FiSearch className="w-8 h-8 text-white/10 mx-auto" />
                        <p className="text-white/25 text-sm">No analyses match “{search}”</p>
                    </div>
                );
                return (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(a => {
                        const minComp = parseFloat(a.min_competitor_price);
                        const maxComp = parseFloat(a.max_competitor_price);
                        const ours = parseFloat(a.our_total);
                        // Unit prices — competitors already store unit price; ours = total/qty
                        const snapQty = a.estimation_snapshot
                            ? (typeof a.estimation_snapshot === 'string'
                                ? JSON.parse(a.estimation_snapshot)?.quantity
                                : a.estimation_snapshot?.quantity)
                            : null;
                        const ourUnit = (ours && snapQty) ? ours / snapQty : null;
                        return (
                            <Link key={a.id} href={`/dashboard/competitor-analysis/${a.id}`}
                                className="group relative bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-5 hover:border-white/20 transition-all block">
                                {/* Delete button */}
                                <button onClick={(e) => handleDelete(a.id, e)}
                                    className="absolute top-3 right-3 p-1.5 opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all">
                                    <FiTrash2 className="w-3.5 h-3.5" />
                                </button>

                                <p className="text-xs text-white/30 font-mono mb-1">{new Date(a.created_at).toLocaleDateString()}</p>
                                <h2 className="text-base font-semibold text-white mb-3 pr-6">{a.name}</h2>

                                {/* Price row */}
                                <div className="flex items-end justify-between mb-3">
                                    <div>
                                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Our Unit Price</p>
                                        <p className="text-2xl font-bold tracking-tight text-white">
                                            {ourUnit ? `${currency}${ourUnit.toFixed(2)}` : ours ? `${currency}${ours.toFixed(2)}` : '—'}
                                        </p>
                                        {ourUnit && <p className="text-[10px] text-white/25 font-mono mt-0.5">{currency}{ours.toFixed(2)} total · {snapQty?.toLocaleString()} units</p>}
                                    </div>
                                    {a.competitor_count > 0 && (
                                        <div className="text-right">
                                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Competitors (unit)</p>
                                            <p className="text-sm text-white/60">
                                                {currency}{minComp.toFixed(2)}
                                                {minComp !== maxComp && ` – ${currency}${maxComp.toFixed(2)}`}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                    <PriceBadge ours={ourUnit || ours} theirs={minComp} />
                                    <span className="text-[11px] text-white/25">
                                        {a.competitor_count} competitor{a.competitor_count !== 1 ? 's' : ''}
                                        {a.estimation_id && <span className="ml-2 text-indigo-400/70">· linked</span>}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
                );
            })()}
        </div>
    );
}
