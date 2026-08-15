'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { motion } from 'framer-motion';
import {
    FiUser, FiBox, FiPrinter, FiSettings, FiLogOut, FiFileText, FiHome,
    FiLayers, FiShoppingCart, FiCalendar, FiBookOpen, FiDollarSign,
    FiAlertTriangle, FiUsers, FiBarChart2, FiTarget, FiChevronRight, FiInfo,
    FiTruck, FiBriefcase, FiUserCheck, FiBell, FiMessageCircle, FiX, FiCreditCard,
} from 'react-icons/fi';
import Link from 'next/link';
import { Toaster, toast } from 'react-hot-toast';
import { ConfirmDialogContainer } from '@/components/ui/ConfirmDialog';
import ScreenPet from '@/components/ui/ScreenPet';


// Grouped nav — each group has a label and its items
const NAV_GROUPS = [
    {
        label: 'Overview',
        items: [
            { icon: FiHome, label: 'Dashboard', href: '/dashboard', exact: true, permission: 'access_dashboard' },
        ],
    },
    {
        label: 'Sales',
        items: [
            { icon: FiUser, label: 'Customers', href: '/dashboard/customers', permission: 'access_sales' },
            { icon: FiFileText, label: 'Quotations', href: '/dashboard/quotations', permission: 'access_sales' },
            { icon: FiShoppingCart, label: 'Sales Orders', href: '/dashboard/sales-orders', permission: 'access_sales' },
            { icon: FiTruck, label: 'Deliveries', href: '/dashboard/deliveries', permission: 'access_sales' },
            { icon: FiDollarSign, label: 'Invoices', href: '/dashboard/invoices', permission: 'access_sales' },
        ],
    },
    {
        label: 'Production',
        items: [
            { icon: FiPrinter, label: 'Estimations', href: '/dashboard/items', permission: 'access_production' },
            // { icon: FiBox, label: 'Items', href: '/dashboard/items', permission: 'access_production' },
            { icon: FiBriefcase, label: 'Services', href: '/dashboard/services', permission: 'access_production' },
            { icon: FiCalendar, label: 'Planning', href: '/dashboard/job-planning', permission: 'access_production' },
        ],
    },
    {
        label: 'HR & Payroll',
        items: [
            { icon: FiUserCheck, label: 'Employees', href: '/dashboard/employees', permission: 'access_hr' },
            { icon: FiCalendar, label: 'Attendance', href: '/dashboard/attendance', permission: 'access_hr' },
            { icon: FiDollarSign, label: 'Payroll', href: '/dashboard/payroll', permission: 'access_hr' },
        ],
    },
    {
        label: 'Inventory',
        items: [
            { icon: FiBox, label: 'Stock Items', href: '/dashboard/inventory', permission: 'access_inventory' },
            { icon: FiLayers, label: 'Finishings', href: '/dashboard/inventory/finishings', permission: 'access_inventory' },
            { icon: FiSettings, label: 'Machines', href: '/dashboard/inventory/machines', permission: 'access_inventory' },
            { icon: FiTruck, label: 'Suppliers', href: '/dashboard/suppliers', permission: 'access_inventory' },
        ],
    },
    {
        label: 'Intelligence',
        items: [
            { icon: FiBarChart2, label: 'Analytics', href: '/dashboard/analytics', permission: 'access_dashboard' },
            { icon: FiTarget, label: 'Competitor Analysis', href: '/dashboard/competitor-analysis', permission: 'access_dashboard' },
        ],
    },
    {
        label: 'System',
        items: [
            { icon: FiLayers, label: 'Resources', href: '/dashboard/resources' },
            { icon: FiUsers, label: 'Users', href: '/dashboard/users', permission: 'access_system' },
            { icon: FiSettings, label: 'Settings', href: '/dashboard/settings', permission: 'access_system' },
            { icon: FiBookOpen, label: 'Guide', href: '/dashboard/guide' },
            { icon: FiInfo, label: 'System Info', href: '/dashboard/system-info', permission: 'access_system' },
            { icon: FiMessageCircle, label: 'WhatsApp', href: '/dashboard/whatsapp', permission: 'access_system' },
            { icon: FiCreditCard, label: 'Billing', href: '/dashboard/billing', permission: 'access_system' },
        ],
    },
];

const ROLE_BADGE = {
    admin: { label: 'Admin', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    manager: { label: 'Manager', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    operator: { label: 'Operator', color: 'bg-gray-500/15 text-gray-400 border-gray-500/25' },
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
    const router = useRouter();
    const searchParams = useSearchParams();

    const [currentUser, setCurrentUser] = useState(null);
    const [showDenied, setShowDenied] = useState(false);
    const [isSidebarHidden, setIsSidebarHidden] = useState(false);
    const [activeCompany, setActiveCompany] = useState('1');
    const [companyNames, setCompanyNames] = useState({
        company1: 'Pressmatics Co. 1',
        company2: 'Pressmatics Co. 2'
    });

    useEffect(() => {
        const match = document.cookie.match(/(?:^|; )company_id=([^;]*)/);
        if (match) {
            setActiveCompany(match[1]);
        }
    }, []);

    useEffect(() => {
        fetch('/api/auth/companies')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) {
                    setCompanyNames({
                        company1: data.company1,
                        company2: data.company2
                    });
                }
            })
            .catch(() => { });
    }, []);

    // WhatsApp notification state removed (moved to dedicated WhatsApp section page)

    useEffect(() => {
        const saved = localStorage.getItem('sidebarHidden');
        if (saved === 'true') {
            setIsSidebarHidden(true);
        }
    }, []);

    const toggleSidebar = () => {
        setIsSidebarHidden(prev => {
            const next = !prev;
            localStorage.setItem('sidebarHidden', String(next));
            return next;
        });
    };

    // Fetch current user role on mount
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && data.id) setCurrentUser(data);
            })
            .catch(() => { });
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

    // Global keyboard navigation shortcuts (Alt + Ctrl + [Key])
    useEffect(() => {
        const handleNavigationKeys = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                return;
            }

            if (e.altKey && e.ctrlKey) {
                const key = e.key.toLowerCase();
                let targetPath = null;

                if (key === 's') {
                    targetPath = '/dashboard/sales-orders';
                } else if (key === 'i') {
                    targetPath = '/dashboard/items';
                } else if (key === 'q') {
                    targetPath = '/dashboard/quotations';
                } else if (key === 'c') {
                    targetPath = '/dashboard/customers';
                } else if (key === 'p') {
                    targetPath = '/dashboard/job-planning';
                } else if (key === 'n') {
                    targetPath = '/dashboard/invoices';
                }

                if (targetPath) {
                    e.preventDefault();
                    router.push(targetPath);
                }
            }
        };

        window.addEventListener('keydown', handleNavigationKeys);
        return () => window.removeEventListener('keydown', handleNavigationKeys);
    }, [router]);

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    }

    const role = currentUser?.role || 'operator';

    const userPermissions = currentUser?.permissions || {};

    // Filter groups — remove items by permission, hide entire group if empty
    const visibleGroups = NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (role === 'admin') return true;
            if (item.permission) {
                if (Array.isArray(item.permission)) {
                    return item.permission.some(p => !!userPermissions[p]);
                }
                return !!userPermissions[item.permission];
            }
            if (item.roles) {
                return item.roles.includes(role);
            }
            return true;
        })
    })).filter(group => group.items.length > 0);

    const badge = ROLE_BADGE[role] || {
        label: role.charAt(0).toUpperCase() + role.slice(1),
        color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25'
    };

    // Collapsed state: initialize so the active group is open, rest closed
    const getInitialCollapsed = () => {
        const state = {};
        visibleGroups.forEach(group => {
            const hasActive = group.items.some(item => {
                if (item.exact) return pathname === item.href;
                if (item.href === '/dashboard/inventory') return pathname === '/dashboard/inventory' || pathname.startsWith('/dashboard/inventory/items');
                return pathname.startsWith(item.href);
            });
            state[group.label] = !hasActive;
        });
        return state;
    };
    const [collapsed, setCollapsed] = useState(getInitialCollapsed);

    const toggleGroup = (label) =>
        setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));

    const isItemActive = (item) => {
        if (item.exact) return pathname === item.href;
        if (item.href === '/dashboard/inventory') return pathname === '/dashboard/inventory' || pathname.startsWith('/dashboard/inventory/items');
        return pathname.startsWith(item.href);
    };

    const renderNavItem = (item) => {
        const active = isItemActive(item);
        return (
            <Link key={item.href} href={item.href} className="relative block">
                {active && (
                    <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-white/10 rounded-lg"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                )}
                <div className={`relative flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${active ? 'text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm">{item.label}</span>
                </div>
            </Link>
        );
    };

    return (
        <div className="h-screen bg-transparent text-white flex overflow-hidden">
            {/* Sidebar */}
            <aside className={`bg-black/40 backdrop-blur-xl border-r border-white/10 hidden md:flex flex-col relative z-20 shrink-0 h-full overflow-y-auto transition-all duration-300 print:hidden ${isSidebarHidden ? 'w-0 border-r-0 overflow-hidden opacity-0 pointer-events-none' : 'w-64'
                }`}>
                <div className="p-6 pb-4 flex items-center justify-between">
                    <Link href="/dashboard">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tighter cursor-pointer">
                            <FiPrinter className="text-white" />
                            Pressmatics
                        </h1>
                    </Link>
                    <button
                        onClick={toggleSidebar}
                        className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5 cursor-pointer transition-colors"
                        title="Hide Sidebar"
                    >
                        <FiChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                </div>

                {/* Access-denied banner (inside sidebar) */}
                {showDenied && <DeniedBanner onDismiss={() => setShowDenied(false)} />}

                <nav className="flex-1 px-3 mt-2 pb-4 space-y-1">
                    {visibleGroups.map((group) => {
                        const isOpen = !collapsed[group.label];
                        const hasActive = group.items.some(isItemActive);
                        return (
                            <div key={group.label}>
                                {/* Group header — clickable to toggle */}
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors group ${hasActive ? 'text-white/60' : 'text-white/25 hover:text-white/50'
                                        }`}
                                >
                                    <span className="text-[10px] font-semibold uppercase tracking-widest select-none">
                                        {group.label}
                                    </span>
                                    <motion.span
                                        animate={{ rotate: isOpen ? 90 : 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="text-current"
                                    >
                                        <FiChevronRight className="w-3 h-3" />
                                    </motion.span>
                                </button>

                                {/* Collapsible items */}
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            key="content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-0.5 pt-0.5 pb-1">
                                                {group.items.map(renderNavItem)}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </nav>

                {/* WhatsApp Notification Bell removed (moved to WhatsApp Center) */}

                {/* Current user strip */}

                <div className="p-4 border-t border-white/10 space-y-3">
                    {/* Active Company Name (Read-Only) */}
                    <div className="px-2 pb-1">
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-gray-500 block mb-1.5 select-none">
                            Active Workspace
                        </span>
                        <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-center select-none truncate">
                            {activeCompany === '2' ? companyNames.company2 : companyNames.company1}
                        </div>
                    </div>

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
            <main className="flex-1 p-8 overflow-y-auto relative z-10 h-full print:p-0 print:overflow-visible print:h-auto print:bg-white">
                {isSidebarHidden && (
                    <button
                        onClick={toggleSidebar}
                        className="fixed left-4 top-4 z-50 flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 backdrop-blur-md border border-white/10 text-white cursor-pointer transition-all print:hidden"
                        title="Show Sidebar"
                    >
                        <FiChevronRight className="w-4 h-4" />
                    </button>
                )}
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
                        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                    }}
                />
                <ConfirmDialogContainer />
                <div className="print:hidden">
                    <ScreenPet />
                </div>
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
