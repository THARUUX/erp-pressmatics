'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiStar, FiCopy, FiX, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import { useSettings } from '@/components/SettingsContext';

/* ─── React Alert Toast ─────────────────────────────────────────────────────── */
function Toast({ toasts, dismiss }) {
    return (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {toasts.map(t => (
                <div
                    key={t.id}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: t.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                        border: `1px solid ${t.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                        color: t.type === 'error' ? '#f87171' : '#4ade80',
                        borderRadius: 12, padding: '12px 16px',
                        backdropFilter: 'blur(16px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        minWidth: 280, maxWidth: 380,
                        animation: 'slideIn 0.2s ease',
                    }}
                >
                    {t.type === 'error' ? <FiAlertCircle size={16} /> : <FiCheckCircle size={16} />}
                    <span style={{ flex: 1, fontSize: 14 }}>{t.message}</span>
                    <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
                        <FiX size={14} />
                    </button>
                </div>
            ))}
            <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
    );
}

/* ─── React Confirm Dialog ──────────────────────────────────────────────────── */
function ConfirmDialog({ confirm, onClose }) {
    if (!confirm) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16, padding: '28px 32px', maxWidth: 400, width: '90%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}>
                <p style={{ color: '#fff', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>{confirm.message}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => onClose(false)}
                        style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 14 }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onClose(true)}
                        style={{
                            padding: '8px 20px', borderRadius: 8,
                            background: confirm.danger ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.9)',
                            border: 'none', color: confirm.danger ? '#fff' : '#000',
                            cursor: 'pointer', fontSize: 14, fontWeight: 600
                        }}
                    >
                        {confirm.confirmLabel || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Duplicate Progress Overlay ────────────────────────────────────────────── */
function DuplicateProgress({ visible, progress, label }) {
    if (!visible) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9997,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '36px 40px', width: 340,
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)', textAlign: 'center',
            }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                    Duplicating Estimation
                </div>
                <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>{label}</div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 6, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{
                        height: '100%', width: `${progress}%`,
                        background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                        borderRadius: 999, transition: 'width 0.4s ease',
                    }} />
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>{progress}%</div>
            </div>
        </div>
    );
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */
export default function ItemsPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || '$';

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 5;

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');

    // React alert state
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null);

    // Duplicate progress
    const [duplicating, setDuplicating] = useState(false);
    const [dupProgress, setDupProgress] = useState(0);
    const [dupLabel, setDupLabel] = useState('');

    /* Helpers */
    const showToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };
    const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

    const reactConfirm = (message, options = {}) =>
        new Promise(resolve => setConfirmState({ message, ...options, resolve }));

    const handleConfirmClose = (result) => {
        confirmState?.resolve(result);
        setConfirmState(null);
    };

    /* Fetch */
    const fetchItems = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (filterType === 'favorites') params.append('is_favorite', 'true');
        params.append('page', page);
        params.append('limit', limit);

        fetch(`/api/items?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setItems(data);
                    setTotalPages(1);
                } else {
                    setItems(data.items || []);
                    setTotalPages(data.pagination?.totalPages || 1);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [searchTerm, filterType, page]);

    useEffect(() => {
        const timer = setTimeout(fetchItems, 300);
        return () => clearTimeout(timer);
    }, [fetchItems]);

    /* Handlers */
    const handleDelete = async (id) => {
        const ok = await reactConfirm('Are you sure you want to delete this estimation? This cannot be undone.', { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        try {
            const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchItems();
                showToast('Estimation deleted.');
            } else {
                showToast('Failed to delete estimation.', 'error');
            }
        } catch {
            showToast('Error deleting estimation.', 'error');
        }
    };

    const handleToggleFavorite = async (id, currentStatus) => {
        if (currentStatus) {
            const ok = await reactConfirm('Remove this item from favourites?', { confirmLabel: 'Remove' });
            if (!ok) return;
        }
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, is_favorite: !currentStatus } : item
        ));
        try {
            await fetch(`/api/items/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_favorite: !currentStatus }),
            });
        } catch {
            fetchItems();
        }
    };

    const runDuplicate = async (id, redirectPath) => {
        setDuplicating(true);
        setDupProgress(0);
        setDupLabel('Copying estimation header…');

        const stages = [
            { pct: 20, label: 'Copying estimation header…' },
            { pct: 45, label: 'Duplicating components…' },
            { pct: 70, label: 'Copying finishings…' },
            { pct: 88, label: 'Finalising…' },
        ];

        let stageIndex = 0;
        const ticker = setInterval(() => {
            if (stageIndex < stages.length) {
                setDupProgress(stages[stageIndex].pct);
                setDupLabel(stages[stageIndex].label);
                stageIndex++;
            }
        }, 400);

        try {
            const res = await fetch(`/api/items/${id}/duplicate`, { method: 'POST' });
            const data = await res.json();

            clearInterval(ticker);
            setDupProgress(100);
            setDupLabel('Done!');

            await new Promise(r => setTimeout(r, 500));

            if (res.ok && data.newId) {
                router.push(redirectPath(data.newId));
            } else {
                setDuplicating(false);
                showToast(data.error || 'Failed to duplicate estimation.', 'error');
            }
        } catch {
            clearInterval(ticker);
            setDuplicating(false);
            showToast('Error duplicating estimation.', 'error');
        }
    };

    const handleDuplicate = async (id) => {
        const ok = await reactConfirm('Copy this estimation as a new draft?', { confirmLabel: 'Duplicate' });
        if (!ok) return;
        await runDuplicate(id, (newId) => `/dashboard/items/${newId}`);
    };

    const handleDuplicateFav = async (id) => {
        const ok = await reactConfirm('Copy this template as a new draft?', { confirmLabel: 'Copy Template' });
        if (!ok) return;
        await runDuplicate(id, (newId) => `/dashboard/items/temp/${newId}`);
    };

    return (
        <div className="text-white">
            {/* Overlays */}
            <DuplicateProgress visible={duplicating} progress={dupProgress} label={dupLabel} />
            <ConfirmDialog confirm={confirmState} onClose={handleConfirmClose} />
            <Toast toasts={toasts} dismiss={dismissToast} />

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Job Estimations</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage, search, and duplicate your quotes</p>
                </div>
                <Link href="/dashboard/items/new">
                    <Button className="flex items-center gap-2 bg-white text-black hover:bg-gray-200">
                        <FiPlus /> New Estimate
                    </Button>
                </Link>
            </header>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by customer or description..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-white/30 outline-none transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex bg-black/40 border border-white/10 rounded-lg p-1">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`px-4 py-1.5 rounded-md text-sm transition-colors ${filterType === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterType('favorites')}
                        className={`px-4 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${filterType === 'favorites' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <FiStar className={filterType === 'favorites' ? "fill-white" : ""} /> Favorites
                    </button>
                </div>
            </div>

            <div className="grid gap-4">
                {items.length === 0 && !loading && (
                    <div className="text-center py-12 text-gray-500 bg-black/40 rounded-xl border border-white/10">
                        No estimations found matching criteria.
                    </div>
                )}
                {loading && items.length === 0 && (
                    <div className="text-center py-12 text-gray-500">Loading...</div>
                )}

                {items.map(item => (
                    <div
                        key={item.id}
                        onClick={() => router.push(`/dashboard/items/${item.id}`)}
                        className={`bg-black/40 backdrop-blur-md p-6 rounded-xl border hover:bg-white/5 transition-all flex justify-between items-center group cursor-pointer ${item.is_favorite ? 'border-yellow-500/30' : 'border-white/10'}`}
                    >
                        <div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id, item.is_favorite); }}
                                    className={`text-lg transition-colors ${item.is_favorite ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                                    title="Toggle Favourite"
                                >
                                    <FiStar className={item.is_favorite ? "fill-yellow-400" : ""} />
                                </button>
                                <h3 className="text-lg font-semibold">{item.estimation_name || item.customer_name || 'Untitled'}</h3>
                                {!!item.is_favorite && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 rounded">FAV</span>}
                            </div>
                            <div className="text-xs text-blue-400 font-mono mt-1 mb-0.5">{item.code}</div>
                            <p className="text-gray-400 text-sm">{item.customer_name} • {item.job_description} • {item.quantity} units</p>
                            <div className="mt-2">
                                <span className="text-xs text-secondary bg-white px-2 py-0.5 rounded uppercase font-bold">{item.type}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className="text-xl font-bold">{currency}{parseFloat(item.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                <div className="text-xs text-gray-500 mt-1">{new Date(item.created_at).toLocaleDateString()}</div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDuplicate(item.id); }}
                                    className="p-2 text-gray-400 hover:text-blue-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                    title="Duplicate"
                                >
                                    <FiCopy />
                                </button>
                                <Link href={`/dashboard/items/${item.id}`} onClick={(e) => e.stopPropagation()}>
                                    <button className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors" title="Edit">
                                        <FiEdit2 />
                                    </button>
                                </Link>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                    className="p-2 text-gray-400 hover:text-red-400 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <FiTrash2 />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center mt-8 gap-2">
                    <Button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="bg-white hover:bg-white/70 disabled:opacity-50">
                        Previous
                    </Button>
                    <span className="flex items-center px-4 text-sm text-gray-400">
                        Page {page} of {totalPages}
                    </span>
                    <Button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="bg-white hover:bg-white/70 disabled:opacity-50">
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}
