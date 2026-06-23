'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
    FiUser, FiBox, FiPrinter, FiSettings, FiLogOut, FiFileText, FiHome,
    FiLayers, FiShoppingCart, FiCalendar, FiBookOpen, FiDollarSign, FiAlertTriangle, FiUsers, FiBarChart2, FiTarget
} from 'react-icons/fi';
import Link from 'next/link';
import { Toaster, toast } from 'react-hot-toast';
import { ConfirmDialogContainer } from '@/components/ui/ConfirmDialog';

// Each menu item has an optional `roles` array — if absent, all roles may see it
const ALL_MENU_ITEMS = [
    { icon: FiHome,         label: 'Dashboard',      href: '/dashboard',                    exact: true },
    { icon: FiFileText,     label: 'Quotations',     href: '/dashboard/quotations',          roles: ['admin', 'manager'] },
    { icon: FiShoppingCart, label: 'Sales Orders',   href: '/dashboard/sales-orders',        roles: ['admin', 'manager'] },
    { icon: FiDollarSign,   label: 'Invoices',       href: '/dashboard/invoices',            roles: ['admin', 'manager'] },
    { icon: FiCalendar,     label: 'Planning',       href: '/dashboard/job-planning' },
    { icon: FiPrinter,      label: 'Estimations',    href: '/dashboard/estimations',         roles: ['admin', 'manager'] },
    { icon: FiBox,          label: 'Inventory Items',href: '/dashboard/inventory' },
    { icon: FiLayers,       label: 'Finishings',     href: '/dashboard/inventory/finishings' },
    { icon: FiSettings,     label: 'Machines',       href: '/dashboard/inventory/machines' },
    { icon: FiUser,         label: 'Customers',      href: '/dashboard/customers',           roles: ['admin', 'manager'] },
    { icon: FiBox,          label: 'Items',          href: '/dashboard/items',               roles: ['admin', 'manager'] },
    { icon: FiBarChart2,    label: 'Analytics',          href: '/dashboard/analytics',                roles: ['admin', 'manager'] },
    { icon: FiTarget,       label: 'Competitor Analysis', href: '/dashboard/competitor-analysis',      roles: ['admin', 'manager'] },
    { icon: FiUsers,        label: 'Users',          href: '/dashboard/users',               roles: ['admin'] },
    { icon: FiSettings,     label: 'Settings',       href: '/dashboard/settings',            roles: ['admin'] },
    { icon: FiBookOpen,     label: 'Guide',          href: '/dashboard/guide' },
];

const ROLE_BADGE = {
    admin:    { label: 'Admin',    color: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
    manager:  { label: 'Manager', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    operator: { label: 'Operator',color: 'bg-gray-500/15 text-gray-400 border-gray-500/25' },
};

function DeniedBanner({ onDismiss }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-300 text-xs"
        >
            <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>You don&apos;t have permission to access that page.</span>
            <button onClick={onDismiss} className="ml-auto text-amber-400/60 hover:text-amber-300 cursor-pointer">✕</button>
        </motion.div>
    );
}

function LayoutInner({ children }) {
    const pathname = usePathname();
    const router   = useRouter();
    const searchParams = useSearchParams();

    const [currentUser, setCurrentUser] = useState(null);
    const [showDenied, setShowDenied] = useState(false);

    // Fetch current user role on mount
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.id) setCurrentUser(data);
            })
            .catch(() => {});
    }, []);

    // Show access-denied banner when redirected with ?denied=1
    useEffect(() => {
        if (searchParams.get('denied') === '1') {
            setShowDenied(true);
            // Remove query param from URL without navigation
            const url = new URL(window.location.href);
            url.searchParams.delete('denied');
            window.history.replaceState({}, '', url.toString());
        }
    }, [searchParams]);

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    }

    const role = currentUser?.role || 'operator';

    // Filter nav items visible to this role
    const menuItems = ALL_MENU_ITEMS.filter(item =>
        !item.roles || item.roles.includes(role)
    );

    const badge = ROLE_BADGE[role] || ROLE_BADGE.operator;

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

                {/* Access-denied banner (inside sidebar) */}
                {showDenied && <DeniedBanner onDismiss={() => setShowDenied(false)} />}

                <nav className="flex-1 px-4 space-y-1 mt-2">
                    {menuItems.map((item) => {
                        let active = false;
                        if (item.exact) {
                            active = pathname === item.href;
                        } else if (item.href === '/dashboard/inventory') {
                            active = pathname === '/dashboard/inventory' || pathname.startsWith('/dashboard/inventory/items');
                        } else {
                            active = pathname.startsWith(item.href);
                        }

                        return (
                            <Link key={item.href} href={item.href} className="relative block">
                                {active && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-white/10 rounded-lg"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <div className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                                    active ? 'text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}>
                                    <item.icon className="w-4 h-4" />
                                    <span className="text-sm">{item.label}</span>
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                {/* Current user strip */}
                <div className="p-4 border-t border-white/10 space-y-3">
                    {currentUser ? (
                        <div className="flex items-center gap-3 px-2 py-2">
                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                                {currentUser.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{currentUser.name}</p>
                                <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${badge.color}`}>
                                    {badge.label}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="px-2 py-2">
                            <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
                        </div>
                    )}

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2.5 w-full text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm cursor-pointer"
                    >
                        <FiLogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <main className="flex-1 p-8 overflow-y-auto relative z-10 h-full">
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: '#1a1a2e',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '14px',
                        },
                        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                        error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                    }}
                />
                <ConfirmDialogContainer />
                {children}
            </main>
        </div>
    );
}

export default function DashboardLayout({ children }) {
    return (
        <Suspense>
            <LayoutInner>{children}</LayoutInner>
        </Suspense>
    );
}
