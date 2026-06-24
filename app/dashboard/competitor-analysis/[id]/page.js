'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiTrendingDown, FiTrendingUp, FiMinus, FiChevronDown, FiChevronUp, FiDownload } from 'react-icons/fi';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useSettings } from '@/components/SettingsContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

const EMPTY_COMP = { competitor_name: '', quoted_price: '', usd_rate: '', notes: '' };

function DiffBadge({ ours, theirs }) {
    if (!ours || !theirs) return <span className="text-white/25 text-sm">—</span>;
    const diff = ((theirs - ours) / ours) * 100;
    if (diff > 0) return (
        <span className="flex items-center gap-1 text-emerald-400 font-semibold text-sm">
            <FiTrendingDown className="w-3.5 h-3.5" /> +{diff.toFixed(3)}%
        </span>
    );
    if (diff < 0) return (
        <span className="flex items-center gap-1 text-red-400 font-semibold text-sm">
            <FiTrendingUp className="w-3.5 h-3.5" /> {diff.toFixed(3)}%
        </span>
    );
    return <span className="flex items-center gap-1 text-white/40 text-sm"><FiMinus className="w-3 h-3" /> At par</span>;
}

export default function CompetitorAnalysisDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || '';

    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [competitors, setCompetitors] = useState([]);
    const [usdRate, setUsdRate] = useState('');
    const [saving, setSaving] = useState(false);
    const [showSnapshot, setShowSnapshot] = useState(false);

    useEffect(() => {
        fetch(`/api/competitor-analysis/${id}`)
            .then(r => r.json())
            .then(d => {
                setAnalysis(d);
                setName(d.name || '');
                setDescription(d.description || '');
                setUsdRate(d.usd_rate?.toString() || '');
                setCompetitors((d.competitors || []).map(c => ({
                    ...c,
                    competitor_name: c.competitor_name || '',
                    quoted_price: c.quoted_price != null ? c.quoted_price.toString() : '',
                    usd_rate: c.usd_rate != null ? c.usd_rate.toString() : '',
                    notes: c.notes || '',
                })));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [id]);

    const updateComp = (idx, field, val) =>
        setCompetitors(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
    const addComp = () => setCompetitors(prev => [...prev, { ...EMPTY_COMP }]);
    const removeComp = (idx) => setCompetitors(prev => prev.filter((_, i) => i !== idx));

    const handleSave = async () => {
        if (!name.trim()) { toast.error('Name required'); return; }
        setSaving(true);
        const res = await fetch(`/api/competitor-analysis/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, usd_rate: usdRate || null, competitors: competitors.filter(c => c.competitor_name && c.quoted_price) })
        });
        setSaving(false);
        if (res.ok) toast.success('Saved');
        else toast.error('Failed to save');
    };

    const handleDelete = async () => {
        if (!(await confirmDialog('Delete this analysis permanently?'))) return;
        const res = await fetch(`/api/competitor-analysis/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Deleted'); router.push('/dashboard/competitor-analysis'); }
        else toast.error('Failed to delete');
    };

    if (loading) return <div className="py-24 text-center text-white/25">Loading…</div>;
    if (!analysis) return <div className="py-24 text-center text-white/25">Analysis not found.</div>;

    const snap = analysis.estimation_snapshot;
    const ours = parseFloat(analysis.our_total) || null;
    const qty = parseFloat(snap?.quantity) || null;
    const ourUnitPrice = (ours && qty) ? ours / qty : null;

    return (
        <div className="text-white space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/competitor-analysis" className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all">
                        <FiArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tighter">{analysis.name}</h1>
                        <p className="text-xs text-white/30 mt-0.5">Created {new Date(analysis.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <a href={`/api/competitor-analysis/${id}/pdf`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.04] text-sm transition-all whitespace-nowrap">
                        <FiDownload className="w-3.5 h-3.5" /> Export PDF
                    </a>
                    <button onClick={handleDelete} className="px-3 py-2 rounded-xl border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 text-sm transition-all whitespace-nowrap">Delete</button>
                    <Button onClick={handleSave} disabled={saving} className="bg-white text-black hover:bg-white/90 font-semibold text-sm h-[36px] px-4">
                        <FiSave className="w-4 h-4 mr-1.5" />{saving ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>

            {/* Name / Description */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-5 space-y-4">
                <Input label="Analysis Name" value={name} onChange={e => setName(e.target.value)} className="bg-black/40 border-white/10" />
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-400">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 resize-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-400">USD Rate <span className="text-white/30 text-xs font-normal">(1 USD = ? local)</span></label>
                    <input type="number" step="0.01" value={usdRate} onChange={e => setUsdRate(e.target.value)}
                        placeholder="e.g. 325.50"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20" />
                </div>
            </div>

            {/* Estimation Snapshot */}
            {snap && (
                <div className="bg-black/40 backdrop-blur-xl border border-indigo-500/20 rounded-2xl overflow-hidden">
                    <button onClick={() => setShowSnapshot(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Linked Estimation Snapshot</span>
                            <span className="text-xs text-white/25">{snap.estimation_name}</span>
                            <span className="text-xs text-white/25">— {new Date(snap.linked_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-white">{currency}{parseFloat(snap.total_amount || 0).toFixed(2)}</span>
                            {showSnapshot ? <FiChevronUp className="w-4 h-4 text-white/40" /> : <FiChevronDown className="w-4 h-4 text-white/40" />}
                        </div>
                    </button>
                    {showSnapshot && (
                        <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
                            {snap.components?.map((comp, i) => (
                                <div key={i} className="px-5 py-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <span className="text-sm font-semibold text-white">{comp.name}</span>
                                            <span className="ml-2 text-xs text-white/30 capitalize">{comp.type}</span>
                                            {comp.machine_name && <span className="ml-2 text-xs text-white/25">· {comp.machine_name}</span>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {comp.paper_name && (
                                            <div className="bg-white/[0.03] rounded-xl p-3">
                                                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Paper</p>
                                                <p className="text-sm text-white font-medium">{comp.paper_name}</p>
                                                <p className="text-xs text-white/40 font-mono mt-0.5">
                                                    Est: {currency}{comp.paper_cost_per_sheet?.toFixed(2)}/sheet
                                                </p>
                                                {comp.current_paper_unit_cost != null && (
                                                    <p className={`text-xs font-mono mt-0.5 ${
                                                        comp.current_paper_unit_cost > comp.paper_cost_per_sheet
                                                            ? 'text-red-400' : 'text-emerald-400'
                                                    }`}>
                                                        Now: {currency}{comp.current_paper_unit_cost?.toFixed(2)}/{comp.current_paper_uom || 'sheet'}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {comp.plate_cost_unit > 0 && (
                                            <div className="bg-white/[0.03] rounded-xl p-3">
                                                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Plate Rate</p>
                                                <p className="text-xs text-white/40 font-mono">Est: {currency}{comp.plate_cost_unit?.toFixed(2)}/plate</p>
                                                {comp.current_machine_plate_cost != null && (
                                                    <p className={`text-xs font-mono mt-0.5 ${
                                                        comp.current_machine_plate_cost > comp.plate_cost_unit
                                                            ? 'text-red-400' : 'text-emerald-400'
                                                    }`}>
                                                        Now: {currency}{comp.current_machine_plate_cost?.toFixed(2)}/plate
                                                    </p>
                                                )}
                                                <p className="text-xs text-white/30 mt-1">{comp.plate_count} plates</p>
                                            </div>
                                        )}
                                        {comp.impression_cost_unit > 0 && (
                                            <div className="bg-white/[0.03] rounded-xl p-3">
                                                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Impression Rate</p>
                                                <p className="text-xs text-white/40 font-mono">Est: {currency}{comp.impression_cost_unit?.toFixed(2)}</p>
                                                {comp.current_machine_impression_cost != null && (
                                                    <p className={`text-xs font-mono mt-0.5 ${
                                                        comp.current_machine_impression_cost > comp.impression_cost_unit
                                                            ? 'text-red-400' : 'text-emerald-400'
                                                    }`}>
                                                        Now: {currency}{comp.current_machine_impression_cost?.toFixed(2)}
                                                    </p>
                                                )}
                                                <p className="text-xs text-white/30 mt-1">{comp.printed_sheets?.toLocaleString()} sheets</p>
                                            </div>
                                        )}
                                        <div className="bg-white/[0.03] rounded-xl p-3">
                                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Component Total</p>
                                            <p className="text-sm text-white font-bold font-mono">
                                                {currency}{((comp.final_paper_cost || 0) + (comp.final_plate_cost || 0) + (comp.final_printing_cost || 0) + (comp.final_finishing_cost || 0)).toFixed(2)}
                                            </p>
                                            <div className="mt-1 space-y-0.5 text-[10px] text-white/25 font-mono">
                                                {comp.final_paper_cost > 0 && <p>Paper: {currency}{comp.final_paper_cost?.toFixed(2)}</p>}
                                                {comp.final_plate_cost > 0 && <p>Plate: {currency}{comp.final_plate_cost?.toFixed(2)}</p>}
                                                {comp.final_printing_cost > 0 && <p>Print: {currency}{comp.final_printing_cost?.toFixed(2)}</p>}
                                                {comp.final_finishing_cost > 0 && <p>Finish: {currency}{comp.final_finishing_cost?.toFixed(2)}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Comparison Table */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Price Comparison</h2>
                    <button onClick={addComp}
                        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] transition-all">
                        <FiPlus className="w-3.5 h-3.5" /> Add Competitor
                    </button>
                </div>

                {/* Our unit price row */}
                {ourUnitPrice && (
                    <div className="px-5 py-3 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span>
                            <div>
                                <span className="text-sm font-semibold text-white">Our Unit Price</span>
                                {snap && <span className="ml-2 text-xs text-white/25">{snap.estimation_name}</span>}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-mono font-bold text-white text-base">
                                {currency}{ourUnitPrice.toFixed(2)}<span className="text-white/30 text-xs font-normal ml-1">/unit</span>
                            </p>
                            {ours && qty && <p className="text-[11px] text-white/30 font-mono mt-0.5">{currency}{ours.toFixed(2)} total · {qty.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} units</p>}
                        </div>
                    </div>
                )}

                {/* Competitor rows (editable) */}
                <div className="divide-y divide-white/[0.04]">
                    {competitors.map((c, idx) => {
                        const theirUnitPrice = parseFloat(c.quoted_price) || null;
                        return (
                            <div key={idx} className="px-5 py-3">
                                <div className="grid grid-cols-[1fr_180px_1fr_auto] gap-2 items-center">
                                    <input value={c.competitor_name} onChange={e => updateComp(idx, 'competitor_name', e.target.value)}
                                        placeholder="Competitor name"
                                        className="bg-transparent border-b border-white/10 pb-1 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30" />
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-white/30 text-xs">{currency}</span>
                                        <input type="number" step="0.01" value={c.quoted_price} onChange={e => updateComp(idx, 'quoted_price', e.target.value)}
                                            placeholder="unit price"
                                            className="w-24 bg-transparent border-b border-white/10 pb-1 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-white/30" />
                                        <span className="text-white/20 text-xs">/unit</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <DiffBadge ours={ourUnitPrice} theirs={theirUnitPrice} />
                                        <input value={c.notes} onChange={e => updateComp(idx, 'notes', e.target.value)}
                                            placeholder="Notes…"
                                            className="flex-1 bg-transparent border-b border-white/10 pb-1 text-xs text-white/50 placeholder-white/20 focus:outline-none focus:border-white/30" />
                                    </div>
                                    <button onClick={() => removeComp(idx)}
                                        className="p-1.5 text-white/20 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all ml-2">
                                        <FiTrash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {competitors.length === 0 && (
                        <div className="px-5 py-8 text-center text-white/25 text-sm">
                            No competitors added yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
