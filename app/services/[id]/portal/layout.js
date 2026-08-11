'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    FiGrid, FiFileText, FiShoppingCart, FiCheckSquare,
    FiArrowLeft, FiBriefcase, FiChevronRight, FiUsers, FiActivity,
    FiBarChart2, FiDollarSign
} from 'react-icons/fi';

function NavItem({ href, icon: Icon, label, active }) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150
                ${active
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
        >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
            {active && <FiChevronRight className="w-3.5 h-3.5 ml-auto text-white/70" />}
        </Link>
    );
}

export default function ServicePortalLayout({ children, params }) {
    const { id } = use(params);
    const pathname = usePathname();
    const [service, setService] = useState(null);

    const loadService = () => {
        fetch(`/api/services/${id}/portal`)
            .then(r => r.json())
            .then(d => { if (d.service) setService(d.service); })
            .catch(() => { });
    };

    useEffect(() => {
        loadService();
    }, [id]);

    const nav = [
        { href: `/services/${id}/portal`, label: 'Dashboard', icon: FiGrid },
        { href: `/services/${id}/portal/planning`, label: 'Planning Workspace', icon: FiActivity },
        { href: `/services/${id}/portal/quotations`, label: 'Quotations', icon: FiFileText },
        { href: `/services/${id}/portal/sales-orders`, label: 'Sales Orders', icon: FiShoppingCart },
        { href: `/services/${id}/portal/invoices`, label: 'Invoices', icon: FiDollarSign },
        { href: `/services/${id}/portal/analytics`, label: 'Analytics & Charts', icon: FiBarChart2 },
        { href: `/services/${id}/portal/employees`, label: 'Employees', icon: FiUsers },
        { href: `/services/${id}/portal/tasks`, label: 'Task Timers', icon: FiCheckSquare },
    ];

    const isActive = (href) => {
        if (href === `/services/${id}/portal`) return pathname === href;
        return pathname.startsWith(href);
    };

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex relative font-sans">
            {/* ── Sidebar ────────────────────────────────────────────── */}
            <aside className="w-64 shrink-0 flex flex-col border-r border-zinc-800/80 bg-[#0c0c0f] sticky top-0 h-screen">
                {/* Brand */}
                <div className="px-5 py-6 border-b border-zinc-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400">
                            <FiBriefcase className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">Service Portal</p>
                            <p className="text-sm font-bold text-white truncate leading-tight mt-0.5">
                                {service?.name || '…'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    <p className="px-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-400 mb-2">Main Menu</p>
                    {nav.map(item => (
                        <NavItem
                            key={item.href}
                            href={item.href}
                            icon={item.icon}
                            label={item.label}
                            active={isActive(item.href)}
                        />
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-3 py-4 border-t border-zinc-800/80 space-y-1">
                    <Link
                        href={`/dashboard/services/${id}/planning`}
                        className="flex items-center gap-2.5 px-4 py-2 rounded-md text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-all font-medium"
                    >
                        <FiGrid className="w-3.5 h-3.5 text-indigo-400" />
                        Main Planning Board
                    </Link>
                    <Link
                        href="/dashboard/services"
                        className="flex items-center gap-2.5 px-4 py-2 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                    >
                        <FiArrowLeft className="w-3.5 h-3.5" />
                        Back to Services
                    </Link>
                </div>
            </aside>

            {/* ── Main Content ────────────────────────────────────────── */}
            <main className="flex-1 min-w-0 bg-[#09090b]">
                {children}
            </main>
        </div>
    );
}
