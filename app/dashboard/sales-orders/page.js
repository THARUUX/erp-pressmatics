'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '@/components/SettingsContext';
import { FiFileText, FiClock, FiSearch, FiPrinter, FiTrash2, FiEdit2, FiFilter } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export default function SalesOrdersPage() {
    const { settings } = useSettings();
    const currency = settings.currency || '$';

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    const limit = 20;

    const fetchOrders = () => {
        setLoading(true);
        const offset = (page - 1) * limit;
        let url = `/api/sales-orders?limit=${limit}&offset=${offset}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (statusFilter && statusFilter !== 'All') url += `&status=${encodeURIComponent(statusFilter)}`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.salesOrders) {
                    setOrders(data.salesOrders);
                    setTotal(data.total);
                } else {
                    setOrders([]);
                    setTotal(0);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch sales orders", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchOrders();
    }, [page, statusFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchOrders();
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this sales order?")) return;

        try {
            const res = await fetch(`/api/sales-orders/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchOrders();
            } else {
                alert("Failed to delete sales order");
            }
        } catch (error) {
            console.error(error);
            alert("Error deleting sales order");
        }
    };

    const handlePrint = (e, id) => {
        e.stopPropagation();
        window.open(`/dashboard/sales-orders/${id}`, '_blank');
    };

    const StatusBadge = ({ status }) => {
        const colors = {
            'Pending': 'bg-yellow-500/20 text-yellow-300',
            'In Production': 'bg-blue-500/20 text-blue-300',
            'Ready': 'bg-green-500/20 text-green-300',
            'Delivered': 'bg-purple-500/20 text-purple-300',
            'Cancelled': 'bg-red-500/20 text-red-300'
        };
        const color = colors[status] || 'bg-gray-500/20 text-gray-300';
        return <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${color}`}>{status}</span>;
    };

    return (
        <div className="min-h-screen bg-transparent text-white p-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Sales Orders</h1>
                    <p className="text-gray-400">Manage order statuses and job tickets.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-3 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search Customer or SO..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 focus:border-white/30 outline-none text-sm w-64"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="bg-black/20 border border-white/10 rounded-lg pl-4 pr-10 py-2 focus:border-white/30 outline-none text-sm appearance-none"
                        >
                            <option value="All" className="bg-gray-900">All Statuses</option>
                            <option value="Pending" className="bg-gray-900">Pending</option>
                            <option value="In Production" className="bg-gray-900">In Production</option>
                            <option value="Ready" className="bg-gray-900">Ready</option>
                            <option value="Delivered" className="bg-gray-900">Delivered</option>
                            <option value="Cancelled" className="bg-gray-900">Cancelled</option>
                        </select>
                        <FiFilter className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="text-center py-20">Loading...</div>
            ) : orders.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/20 rounded-xl bg-black/20">
                    <FiFileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-300">No Sales Orders Found</h3>
                </div>
            ) : (
                <div className="grid gap-4">
                    {orders.map(order => (
                        <div key={order.id}
                            onClick={() => window.location.href = `/dashboard/sales-orders/${order.id}`}
                            className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all flex justify-between items-center group cursor-pointer relative">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-lg">{order.customer_name}</h3>
                                    <span className="text-xs font-mono text-white/50 bg-white-900/30 px-2 py-0.5 rounded border border-blue-500/20">
                                        {order.code}
                                    </span>
                                </div>
                                {order.estimation_names && (
                                    <p className="text-sm text-white/70 font-medium mt-0.5 truncate max-w-xl">
                                        {order.estimation_names}
                                    </p>
                                )}
                                <div className="flex gap-4 mt-2 text-xs text-gray-500 items-center">
                                    <StatusBadge status={order.status} />
                                    <span className="flex items-center gap-1"><FiClock /> {new Date(order.order_date).toLocaleDateString()}</span>
                                    {order.delivery_date && (
                                        <span className="text-orange-300">Delivery: {new Date(order.delivery_date).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-6 relative z-10">
                                <div>
                                    <span className="block text-2xl font-bold">{currency}{Number(order.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => handlePrint(e, order.id)}
                                        className="p-2 hover:bg-white/20 rounded-full text-gray-300 hover:text-white transition-colors"
                                        title="Job Ticket / Print View"
                                    >
                                        <FiPrinter size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, order.id)}
                                        className="p-2 hover:bg-red-500/20 rounded-full text-gray-300 hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <FiTrash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Pagination */}
                    {total > limit && (
                        <div className="flex justify-center gap-4 mt-8">
                            <Button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
                            >
                                Previous
                            </Button>
                            <span className="flex items-center text-sm text-gray-400">
                                Page {page} of {Math.ceil(total / limit)}
                            </span>
                            <Button
                                onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                                disabled={page === Math.ceil(total / limit)}
                                className="bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
