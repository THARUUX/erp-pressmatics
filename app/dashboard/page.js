'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiBox, FiPrinter, FiSettings, FiLogOut, FiFileText, FiAlertTriangle } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Dashboard() {
    const router = useRouter();
    const [lowStockItems, setLowStockItems] = useState([]);
    const [user, setUser] = useState(null);

    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }

    useEffect(() => {
        // Fetch real logged-in user
        fetch('/api/auth/me')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.id) setUser(data); })
            .catch(() => {});

        // Fetch inventory for low stock alerts
        fetch('/api/inventory')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const low = data.filter(i => i.stock_quantity < (i.min_stock || 0));
                    setLowStockItems(low);
                }
            })
            .catch(err => console.error(err));
    }, []);

    const menuItems = [
        { icon: FiFileText, label: 'Quotations', href: '/dashboard/quotations', color: 'bg-purple-500' },
        { icon: FiUser, label: 'Users', href: '#', color: 'bg-blue-500' },
        { icon: FiBox, label: 'Inventory', href: '/dashboard/inventory', color: 'bg-green-500' },
        { icon: FiPrinter, label: 'Jobs', href: '#', color: 'bg-indigo-500' },
        { icon: FiSettings, label: 'Settings', href: '#', color: 'bg-gray-500' },
    ];

    return (
        <div>
            <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                <div>
                    <p className="text-gray-500 text-sm font-medium mb-1">{getGreeting()}</p>
                    <h2 className="text-3xl font-bold text-white tracking-tighter">
                        Welcome back, {user?.name ?? '…'}
                    </h2>
                </div>
            </header>

            {lowStockItems.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-8 bg-red-900/20 border border-red-500/30 p-6 rounded-xl"
                >
                    <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                        <FiAlertTriangle /> Low Stock Alerts ({lowStockItems.length})
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lowStockItems.slice(0, 6).map(item => (
                            <div key={item.id} className="bg-black/40 p-3 rounded flex justify-between items-center border border-white/5">
                                <div>
                                    <div className="font-semibold text-white">{item.name}</div>
                                    <div className="text-xs text-gray-500">Min: {item.min_stock}</div>
                                </div>
                                <div className="text-red-400 font-mono font-bold">{item.stock_quantity}</div>
                            </div>
                        ))}
                    </div>
                    {lowStockItems.length > 6 && (
                        <Link href="/dashboard/inventory" className="text-sm text-red-300 mt-2 inline-block hover:underline">
                            View all low stock items &rarr;
                        </Link>
                    )}
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {menuItems.map((item, index) => (
                    <Link key={item.label} href={item.href}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 hover:bg-white/5 transition-colors group h-full"
                        >
                            <div className={`${item.color} w-12 h-12 flex items-center justify-center text-white mb-4 bg-transparent border border-white/20 group-hover:border-white/50 rounded-lg`}>
                                <item.icon className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-semibold text-white group-hover:text-white">{item.label}</h3>
                            <p className="text-gray-500 text-sm mt-1">Manage {item.label.toLowerCase()}</p>
                        </motion.div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
