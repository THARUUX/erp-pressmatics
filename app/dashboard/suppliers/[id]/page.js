'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiArrowLeft, FiTruck, FiPackage, FiShoppingBag,
    FiDollarSign, FiInfo, FiCheckCircle, FiAlertCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import OverviewTab       from './OverviewTab';
import CatalogTab        from './CatalogTab';
import PurchaseOrdersTab from './PurchaseOrdersTab';
import PaymentsTab       from './PaymentsTab';

const TABS = [
    { id: 'overview',  label: 'Overview',        icon: FiInfo },
    { id: 'catalog',   label: 'Catalog',          icon: FiPackage },
    { id: 'orders',    label: 'Purchase Orders',  icon: FiShoppingBag },
    { id: 'payments',  label: 'Payments',         icon: FiDollarSign },
];

export default function SupplierDetailPage() {
    const { id }   = useParams();
    const router   = useRouter();
    const [supplier, setSupplier] = useState(null);
    const [balance, setBalance]   = useState(null);
    const [loading, setLoading]   = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    const fetchSupplier = async () => {
        try {
            const res = await fetch(`/api/suppliers/${id}`);
            if (!res.ok) { toast.error('Supplier not found'); router.push('/dashboard/suppliers'); return; }
            const data = await res.json();
            setSupplier(data);
        } catch { toast.error('Failed to load supplier'); }
        setLoading(false);
    };

    const fetchBalance = async () => {
        try {
            const res = await fetch(`/api/suppliers/${id}/balance`);
            if (res.ok) setBalance(await res.json());
        } catch { /* silent */ }
    };

    useEffect(() => {
        fetchSupplier();
        fetchBalance();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (!supplier) return null;

    const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(n || 0);

    return (
        <div className="text-white space-y-6 max-w-5xl mx-auto">
            {/* ── Header ── */}
            <div className="flex items-start gap-4">
                <Link href="/dashboard/suppliers">
                    <button className="p-2 mt-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <FiArrowLeft className="w-4 h-4" />
                    </button>
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <FiTruck className="text-indigo-400 shrink-0" />
                            {supplier.name}
                        </h1>
                        <span className="font-mono text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-gray-400">
                            {supplier.code}
                        </span>
                        {supplier.is_active ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full">
                                <FiCheckCircle className="w-3 h-3" /> Active
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[11px] font-semibold bg-gray-500/10 border border-gray-500/20 text-gray-500 px-2.5 py-0.5 rounded-full">
                                <FiAlertCircle className="w-3 h-3" /> Inactive
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                        {supplier.email && <span>✉ {supplier.email}</span>}
                        {supplier.phone && <span>📞 {supplier.phone}</span>}
                        {supplier.payment_terms && <span>💳 {supplier.payment_terms}</span>}
                    </div>
                </div>

                {/* Balance quick-view */}
                {balance && (
                    <div className="shrink-0 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-3 text-right">
                        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-0.5">Outstanding</p>
                        <p className={`text-xl font-bold ${balance.outstanding > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {fmt(balance.outstanding)}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{fmt(balance.total_paid)} / {fmt(balance.total_purchased)} paid</p>
                    </div>
                )}
            </div>

            {/* ── Tabs ── */}
            <div className="relative">
                <div className="flex gap-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 w-fit">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors z-10 ${
                                activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="supplierTabBg"
                                    className="absolute inset-0 bg-white/10 rounded-xl"
                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                                />
                            )}
                            <tab.icon className="w-4 h-4 relative z-10" />
                            <span className="relative z-10">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tab Content ── */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                >
                    {activeTab === 'overview'  && <OverviewTab supplier={supplier} onRefresh={fetchSupplier} />}
                    {activeTab === 'catalog'   && <CatalogTab supplierId={id} />}
                    {activeTab === 'orders'    && <PurchaseOrdersTab supplierId={id} />}
                    {activeTab === 'payments'  && <PaymentsTab supplierId={id} />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
