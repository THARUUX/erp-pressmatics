'use client';

import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiUser, FiBox, FiPrinter, FiSettings, FiLogOut, FiFileText, FiHome, FiLayers, FiShoppingCart, FiCalendar, FiBookOpen, FiDollarSign } from 'react-icons/fi';
import Link from 'next/link';

export default function DashboardLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    }

    const menuItems = [
        { icon: FiHome, label: 'Dashboard', href: '/dashboard', exact: true },
        { icon: FiFileText, label: 'Quotations', href: '/dashboard/quotations' },
        { icon: FiShoppingCart, label: 'Sales Orders', href: '/dashboard/sales-orders' },
        { icon: FiDollarSign, label: 'Invoices', href: '/dashboard/invoices' },
        { icon: FiCalendar, label: 'Planning', href: '/dashboard/job-planning' },
        { icon: FiPrinter, label: 'Estimations', href: '/dashboard/estimations' },
        { icon: FiBox, label: 'Inventory Items', href: '/dashboard/inventory' }, // Be careful with sub-routes overlapping
        { icon: FiLayers, label: 'Finishings', href: '/dashboard/inventory/finishings' },
        { icon: FiSettings, label: 'Machines', href: '/dashboard/inventory/machines' }, // This might overlap with inventory if check is vague
        { icon: FiUser, label: 'Customers', href: '/dashboard/customers' },
        { icon: FiBox, label: 'Items', href: '/dashboard/items' },
        { icon: FiUser, label: 'Users', href: '/dashboard/users' },
        { icon: FiSettings, label: 'Settings', href: '/dashboard/settings' },
        { icon: FiBookOpen, label: 'Guide', href: '/dashboard/guide' },
    ];

    return (
        <div className="h-screen bg-transparent text-white flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-black/40 backdrop-blur-xl border-r border-white/10 hidden md:flex flex-col relative z-20 shrink-0 h-full overflow-y-auto">
                <div className="p-6">
                    <Link href="/dashboard">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tighter cursor-pointer">
                            <FiPrinter className="text-white" />
                            Pressmatics
                        </h1>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {menuItems.map((item) => {
                        const isActive = item.exact
                            ? pathname === item.href
                            : pathname.startsWith(item.href) && (item.href !== '/dashboard/inventory' || pathname === '/dashboard/inventory' || pathname.startsWith('/dashboard/inventory/finishings') === false && pathname.startsWith('/dashboard/inventory/machines') === false);
                        // Complex logic for overlapping routes... 
                        // Actually, 'Inventory Items' corresponds to /dashboard/inventory (which lists items?)
                        // Finishings is /dashboard/inventory/finishings? 
                        // Machines is /dashboard/inventory/machines?
                        // If I visit Machines, 'Inventory Items' (parent) might also light up if simple startsWith.
                        // Let's refine the list. 
                        // The original list had:
                        // Inventory Items -> /dashboard/inventory
                        // Finishings -> /dashboard/inventory/finishings
                        // Machines -> /dashboard/inventory/machines
                        // If checking startsWith: /dashboard/inventory/machines matches both Machines and Inventory Items.
                        // I should rely on the longest match or explicit exact checks for parents.
                        // Or just let it be for now, simple startsWith often works if structured well.
                        // But here they are siblings in the menu.
                        // Better Logic:
                        // Simple approach: active if pathname === href OR (pathname starts with href/ and it is not a sub-item in this list).

                        const isSelected = item.exact
                            ? pathname === item.href
                            : pathname.startsWith(item.href) && (
                                item.href === '/dashboard' ? pathname === '/dashboard' : // Redundant if exact used
                                    item.href === '/dashboard/inventory' ? pathname === '/dashboard/inventory' || pathname.startsWith('/dashboard/inventory/items') : // Assuming inventory list is base or items
                                        true
                            );

                        // Let's use a simpler heuristic: strict startsWith, but reverse sort by length to find specific match? No, rendering order matters.
                        // Let's just fix the inventory overlap manually.
                        let active = false;
                        if (item.exact) {
                            active = pathname === item.href;
                        } else {
                            // Specialized check for inventory to avoid highlighting it when in sub-routes of inventory that are also top-level menu items
                            if (item.href === '/dashboard/inventory') {
                                active = pathname === '/dashboard/inventory' || pathname.startsWith('/dashboard/inventory/items');
                            } else {
                                active = pathname.startsWith(item.href);
                            }
                        }

                        return (
                            <Link key={item.label} href={item.href} className="relative block">
                                {active && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-white/10 rounded-lg"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <div className={`relative flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                    <item.icon className="w-5 h-5" />
                                    {item.label}
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <FiLogOut className="w-5 h-5" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <main className="flex-1 p-8 overflow-y-auto relative z-10 h-full">
                {children}
            </main>
        </div>
    );
}
