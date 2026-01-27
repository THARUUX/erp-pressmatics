'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiStar, FiCopy, FiFilter } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSettings } from '@/components/SettingsContext';

export default function ItemsPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency || '$';
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // all, favorites

    const fetchItems = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (filterType === 'favorites') params.append('is_favorite', 'true');
        params.append('page', page);
        params.append('limit', limit);

        fetch(`/api/items?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                // If API returns array (backward compatibility or error), handle it often.
                // But we expect object { items: [], pagination: {} }
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
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchItems();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, filterType, page]);

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this estimation? This cannot be undone.")) return;
        try {
            const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchItems();
            } else {
                alert('Failed to delete item');
            }
        } catch (err) {
            console.error(err);
            alert('Error deleting item');
        }
    };

    const handleToggleFavorite = async (id, currentStatus) => {
        // Confirm before removing from favorites
        if (currentStatus && !confirm("Are you sure you want to remove this item from favorites?")) {
            return;
        }

        // Optimistic update
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, is_favorite: !currentStatus } : item
        ));

        try {
            await fetch(`/api/items/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_favorite: !currentStatus }) // Partial update
            });
            // No need to refetch if successful
        } catch (err) {
            console.error(err);
            fetchItems(); // Revert on error
        }
    };

    const handleDuplicate = async (id) => {
        if (!confirm("Duplicate this estimation?")) return;
        try {
            const res = await fetch(`/api/items/${id}/duplicate`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.newId) {
                router.push(`/dashboard/items/${data.newId}`);
            } else {
                alert('Failed to duplicate item');
            }
        } catch (err) {
            console.error(err);
            alert('Error duplicating item');
        }
    };

    return (
        <div className="text-white">
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

                {/* Items List */}
                {items.map(item => (
                    <div
                        key={item.id}
                        onClick={() => router.push(`/dashboard/items/${item.id}`)}
                        className={`bg-black/40 backdrop-blur-md p-6 rounded-xl border hover:bg-white/5 transition-all flex justify-between items-center group cursor-pointer ${item.is_favorite ? 'border-yellow-500/30' : 'border-white/10'}`}
                    >
                        <div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleFavorite(item.id, item.is_favorite);
                                    }}
                                    className={`text-lg transition-colors ${item.is_favorite ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}
                                    title="Toggle Favorite"
                                >
                                    <FiStar className={item.is_favorite ? "fill-yellow-400" : ""} />
                                </button>
                                <h3 className="text-lg font-semibold">{item.estimation_name || item.customer_name || 'Untitled'}</h3>
                                {!!item.is_favorite && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 rounded">FAV</span>}
                            </div>
                            <div className="text-xs text-blue-400 font-mono mt-1 mb-0.5">{item.code}</div>
                            <p className="text-gray-400 text-sm ml-0">{item.customer_name} • {item.job_description} • {item.quantity} units</p>
                            <div className="mt-2">
                                <span className="text-xs text-secondary bg-white px-2 py-0.5 rounded uppercase font-bold">{item.type}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className="text-xl font-bold">{currency}{parseFloat(item.total_amount || 0).toFixed(2)}</div>
                                <div className="text-xs text-gray-500 mt-1">{new Date(item.created_at).toLocaleDateString()}</div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicate(item.id);
                                    }}
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
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item.id);
                                    }}
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

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-8 gap-2">
                    <Button
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="bg-white/5 hover:bg-white/10 disabled:opacity-50"
                    >
                        Previous
                    </Button>
                    <span className="flex items-center px-4 text-sm text-gray-400">
                        Page {page} of {totalPages}
                    </span>
                    <Button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className="bg-white/5 hover:bg-white/10 disabled:opacity-50"
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}
