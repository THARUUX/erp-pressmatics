'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiCpu, FiPlayCircle, FiCalendar, FiArrowLeft, FiCheckSquare, FiClock } from 'react-icons/fi';

export default function StandaloneMachinePortalLayout({ children, params }) {
    const { id } = use(params);
    const pathname = usePathname();
    const [machine, setMachine] = useState(null);

    useEffect(() => {
        fetch(`/api/common-portal/machines/${id}`)
            .then(r => r.json())
            .then(d => { if (d.machine) setMachine(d.machine); })
            .catch(() => {});
    }, [id]);

    const isPlanning = pathname.endsWith('/planning');

    return (
        <div className="min-h-screen bg-[#07080f] text-slate-100 font-sans flex flex-col">
            {/* Standalone Header (No ERP Nav Bar) */}
            <header className="bg-black/60 backdrop-blur-xl border-b border-white/10 px-6 py-4 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard/inventory/machines"
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                            title="Back to ERP Machines"
                        >
                            <FiArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400">
                                    Shared Machine Portal
                                </span>
                                {machine?.is_common ? (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                                        Cross-Company (Co 1 &amp; Co 2)
                                    </span>
                                ) : null}
                            </div>
                            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
                                <FiCpu className="text-purple-400" />
                                {machine?.name || 'Machine Portal'}
                            </h1>
                        </div>
                    </div>

                    {/* Portal Tabs */}
                    <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl gap-1">
                        <Link
                            href={`/machines/${id}/portal`}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                !isPlanning
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <FiPlayCircle className="w-4 h-4" /> Task Execution
                        </Link>
                        <Link
                            href={`/machines/${id}/portal/planning`}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                isPlanning
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <FiCalendar className="w-4 h-4" /> Daily Planning
                        </Link>
                    </div>
                </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-6">
                {children}
            </main>
        </div>
    );
}
