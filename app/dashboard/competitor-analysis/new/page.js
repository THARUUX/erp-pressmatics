'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiPlus, FiTrash2, FiLink, FiSearch, FiInfo } from 'react-icons/fi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useSettings } from '@/components/SettingsContext';

const EMPTY_COMPETITOR = { competitor_name: '', quoted_price: '', notes: '' };

export default function NewCompetitorAnalysisPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || '';

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [usdRate, setUsdRate] = useState('');
    const [competitors, setCompetitors] = useState([{ ...EMPTY_COMPETITOR }]);
    const [saving, setSaving] = useState(false);

    // Estimation picker
    const [recentEstimations, setRecentEstimations] = useState([]);
    const [estSearch, setEstSearch] = useState('');
    const [showEstSuggestions, setShowEstSuggestions] = useState(false);
    const [selectedEst, setSelectedEst] = useState(null);

    useEffect(() => {
        fetch('/api/estimations/recent')
            .then(r => r.json())
            .then(d => setRecentEstimations(Array.isArray(d) ? d : []))
            .catch(() => {});
    }, []);

    const filteredEst = recentEstimations.filter(e =>
        (e.estimation_name || e.job_description || '').toLowerCase().includes(estSearch.toLowerCase())
    );

    const handleSelectEst = (est) => {
        setSelectedEst(est);
        setEstSearch(est.estimation_name || est.job_description || `Estimation #${est.id}`);
        setShowEstSuggestions(false);
        if (!name) setName(est.estimation_name || est.job_description || '');
    };

    const updateComp = (idx, field, val) =>
        setCompetitors(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));

    const addComp = () => setCompetitors(prev => [...prev, { ...EMPTY_COMPETITOR }]);
    const removeComp = (idx) => setCompetitors(prev => prev.filter((_, i) => i !== idx));

    const handleSave = async () => {
        if (!name.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        const res = await fetch('/api/competitor-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description,
                estimation_id: selectedEst?.id || null,
                usd_rate: usdRate || null,
                competitors: competitors.filter(c => c.competitor_name && c.quoted_price)
            })
        });
        const data = await res.json();
        setSaving(false);
        if (res.ok) {
            toast.success('Analysis created');
            router.push(`/dashboard/competitor-analysis/${data.id}`);
        } else {
            toast.error(data.error || 'Failed to save');
        }
    };

    return (
        <div className="text-white space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/competitor-analysis" className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all">
                    <FiArrowLeft className="w-4 h-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tighter">New Analysis</h1>
                    <p className="text-sm text-white/40">Record pricing data and compare with competitors</p>
                </div>
            </div>

            {/* Basic Info */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Basic Info</h2>
                <Input label="Analysis Name" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. Tendor 01 — June 2026" className="bg-black/40 border-white/10" />
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-400">Description (optional)</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)}
                        rows={2} placeholder="Job specs, context…"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 resize-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-400">USD Rate <span className="text-white/30 text-xs font-normal">(1 USD = ? local)</span></label>
                    <input type="number" step="0.01" value={usdRate} onChange={e => setUsdRate(e.target.value)}
                        placeholder="e.g. 325.50"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20" />
                </div>
            </div>

            {/* Link Estimation */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-5 space-y-4 relative z-20">
                <div className="flex items-center gap-2">
                    <FiLink className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Link Estimation</h2>
                    <span className="text-[10px] text-white/25 bg-white/[0.04] border border-white/[0.07] rounded-full px-2 py-0.5">optional · max 30 days old</span>
                </div>

                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input value={estSearch} onChange={e => { setEstSearch(e.target.value); setShowEstSuggestions(true); setSelectedEst(null); }}
                        onFocus={() => setShowEstSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowEstSuggestions(false), 150)}
                        placeholder="Search recent estimations…"
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20" />
                    {showEstSuggestions && filteredEst.length > 0 && (
                        <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-56 overflow-y-auto">
                            {filteredEst.map(est => (
                                <li key={est.id}>
                                    <button type="button" onMouseDown={() => handleSelectEst(est)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/[0.06] transition-colors text-left">
                                        <div>
                                            <span className="text-white font-medium">
                                                {est.estimation_name || est.job_description || `Estimation #${est.id}`}
                                            </span>
                                            <span className="ml-2 text-xs text-white/30">{new Date(est.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <span className="text-sm font-mono text-white/50">{currency}{parseFloat(est.total_amount || 0).toFixed(2)}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {recentEstimations.length === 0 && (
                        <p className="text-xs text-white/25 mt-2 flex items-center gap-1.5">
                            <FiInfo className="w-3.5 h-3.5" /> No estimations from the past 30 days found.
                        </p>
                    )}
                </div>

                {selectedEst && (
                    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4 space-y-1">
                        <p className="text-xs font-semibold text-indigo-400">Snapshot will be captured at save</p>
                        <p className="text-sm text-white/70">{selectedEst.estimation_name || selectedEst.job_description}</p>
                        <p className="text-xs text-white/40">Qty: {selectedEst.quantity} · Total: {currency}{parseFloat(selectedEst.total_amount || 0).toFixed(2)}</p>
                    </div>
                )}
            </div>

            {/* Competitor Entries */}
            <div className="bg-black/40 z-10 relative backdrop-blur-xl border border-white/[0.07] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Competitor Pricing</h2>
                    <button onClick={addComp}
                        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] transition-all">
                        <FiPlus className="w-3.5 h-3.5" /> Add Competitor
                    </button>
                </div>

                <div className="space-y-3">
                    {competitors.map((c, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_140px_1fr_36px] gap-2 items-start">
                            <div>
                                {idx === 0 && <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">Competitor Name</label>}
                                <input value={c.competitor_name} onChange={e => updateComp(idx, 'competitor_name', e.target.value)}
                                    placeholder="e.g. Acme Printers"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20" />
                            </div>
                            <div>
                                {idx === 0 && <label className="text-[10px] text-white/30 uppercase tracking-wider block mb-1">Unit Price ({currency})</label>}
                                <input type="number" step="0.01" value={c.quoted_price} onChange={e => updateComp(idx, 'quoted_price', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20" />
                            </div>
                            <div className={idx === 0 ? 'mt-5' : ''}>
                                <button onClick={() => removeComp(idx)} disabled={competitors.length === 1}
                                    className="p-2 text-white/20 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                                    <FiTrash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <Link href="/dashboard/competitor-analysis"
                    className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 hover:text-white transition-all">
                    Cancel
                </Link>
                <Button onClick={handleSave} disabled={saving}
                    className="flex-1 bg-white text-black hover:bg-white/90 font-semibold text-sm h-[44px]">
                    {saving ? 'Saving…' : 'Save Analysis'}
                </Button>
            </div>
        </div>
    );
}
