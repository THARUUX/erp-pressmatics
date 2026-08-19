'use me';
'use client';

import { useState, useEffect } from 'react';
import {
    FiActivity, FiSearch, FiRefreshCw, FiUser, FiClock,
    FiFileText, FiShoppingCart, FiDollarSign, FiCopy, FiTrash2, FiEdit, FiPlusCircle, FiCheckCircle
} from 'react-icons/fi';

const ACTION_BADGES = {
    CREATE: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: FiPlusCircle },
    UPDATE: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: FiEdit },
    DUPLICATE: { color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', icon: FiCopy },
    DELETE: { color: 'bg-rose-500/15 text-rose-400 border-rose-500/30', icon: FiTrash2 },
    STATUS_CHANGE: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: FiCheckCircle },
};

const ENTITY_ICONS = {
    estimation: FiFileText,
    quotation: FiFileText,
    sales_order: FiShoppingCart,
    invoice: FiDollarSign,
};

export default function ActivityLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [entityFilter, setEntityFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (entityFilter) params.set('entity_type', entityFilter);
            if (actionFilter) params.set('action', actionFilter);
            params.set('limit', '200');

            const res = await fetch(`/api/activity-logs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [entityFilter, actionFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchLogs();
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                            <FiActivity className="w-6 h-6" />
                        </div>
                        Activity Audit Logs
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Track persistent audit trails for user actions across Estimations, Quotations, Sales Orders, and Invoices.
                    </p>
                </div>

                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 text-white rounded-xl font-medium text-sm transition-all cursor-pointer disabled:opacity-50"
                >
                    <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Logs
                </button>
            </div>

            {/* Filters & Search */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="md:col-span-6 relative">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search username, entity ID, or details..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-colors"
                    />
                </form>

                {/* Entity Filter */}
                <div className="md:col-span-3">
                    <select
                        value={entityFilter}
                        onChange={(e) => setEntityFilter(e.target.value)}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors"
                    >
                        <option value="">All Module Entities</option>
                        <option value="estimation">Estimations</option>
                        <option value="quotation">Quotations</option>
                        <option value="sales_order">Sales Orders</option>
                        <option value="invoice">Invoices</option>
                    </select>
                </div>

                {/* Action Filter */}
                <div className="md:col-span-3">
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 transition-colors"
                    >
                        <option value="">All Action Types</option>
                        <option value="CREATE">CREATE</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DUPLICATE">DUPLICATE</option>
                        <option value="DELETE">DELETE</option>
                        <option value="STATUS_CHANGE">STATUS CHANGE</option>
                    </select>
                </div>
            </div>

            {/* Logs List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white/5 border border-white/10 rounded-2xl">
                    <FiRefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-400" />
                    <p className="text-sm">Loading activity log history...</p>
                </div>
            ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white/5 border border-white/10 rounded-2xl">
                    <FiActivity className="w-10 h-10 text-gray-600 mb-3" />
                    <p className="text-base font-semibold text-gray-300">No activity logs recorded yet</p>
                    <p className="text-xs text-gray-500 mt-1">Actions perform on estimations, quotations, sales orders, and invoices will show up here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {logs.map((log) => {
                        const badgeInfo = ACTION_BADGES[log.action] || { color: 'bg-gray-500/15 text-gray-400 border-gray-500/30', icon: FiActivity };
                        const ActionIcon = badgeInfo.icon;
                        const EntityIcon = ENTITY_ICONS[log.entity_type] || FiFileText;

                        return (
                            <div
                                key={log.id}
                                className="bg-white/5 hover:bg-white/[0.07] border border-white/10 transition-all rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 shrink-0 mt-0.5">
                                        <EntityIcon className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center flex-wrap gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${badgeInfo.color}`}>
                                                <ActionIcon className="w-3 h-3" />
                                                {log.action}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                {log.entity_type} {log.entity_id ? `· ${log.entity_id}` : ''}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-200">{log.details}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-gray-400 shrink-0 border-t md:border-t-0 border-white/10 pt-2 md:pt-0">
                                    <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                                        <FiUser className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-gray-200 font-semibold">{log.username}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <FiClock className="w-3.5 h-3.5 text-gray-500" />
                                        <span>{new Date(log.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
