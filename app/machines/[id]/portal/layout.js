'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiCpu, FiPlayCircle, FiCalendar, FiArrowLeft, FiBarChart2 } from 'react-icons/fi';

export default function StandaloneMachinePortalLayout({ children, params }) {
    const { id } = use(params);
    const pathname = usePathname();
    const [machine, setMachine] = useState(null);

    useEffect(() => {
        fetch(`/api/common-portal/machines/${id}`)
            .then(r => r.json())
            .then(d => { if (d.machine) setMachine(d.machine); })
            .catch(() => { });
    }, [id]);

    const isPlanning = pathname.endsWith('/planning');
    const isReports = pathname.endsWith('/reports');
    const isTasks = !isPlanning && !isReports;

    return (
        <div className="min-h-screen bg-black text-slate-100 font-sans flex flex-col print:bg-white print:text-black">
            {/* Standalone Header (Hidden in Print) */}
            <header className="bg-black/60 backdrop-blur-xl border-b border-white/10 px-6 py-4 sticky top-0 z-40 print:hidden">
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
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                                    Machine Portal
                                </span>
                            </div>
                            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
                                {machine?.name || 'Machine Portal'}
                            </h1>
                        </div>
                    </div>

                    {/* Navigation Tabs (Tasks, Planning, Reports) */}
                    <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl gap-1">
                        <Link
                            href={`/machines/${id}/portal`}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isTasks
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <FiPlayCircle className="w-4 h-4" /> Tasks
                        </Link>
                        <Link
                            href={`/machines/${id}/portal/planning`}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isPlanning
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <FiCalendar className="w-4 h-4" /> Planning
                        </Link>
                        <Link
                            href={`/machines/${id}/portal/reports`}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isReports
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <FiBarChart2 className="w-4 h-4" /> Reports
                        </Link>
                    </div>
                </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-6 print:p-0 print:max-w-none print:w-full">
                {children}
            </main>
        </div>
    );
}
