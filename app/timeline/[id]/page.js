'use client';
import { use, useEffect, useState } from 'react';
import { FiCheckCircle, FiClock, FiCircle, FiLoader, FiPackage } from 'react-icons/fi';

function statusMeta(status) {
    switch (status) {
        case 'done':        return { icon: FiCheckCircle, label: 'Completed', color: 'text-white',      ring: 'border-white/60      bg-white/10',   line: 'bg-white/40' };
        case 'in_progress': return { icon: FiLoader,      label: 'In Progress', color: 'text-white/80', ring: 'border-white/40      bg-white/[0.06]',line: 'bg-white/10' };
        default:            return { icon: FiCircle,      label: 'Pending',    color: 'text-white/30',  ring: 'border-white/[0.12]  bg-transparent', line: 'bg-white/[0.05]' };
    }
}

export default function PublicTimeline({ params }) {
    const { id } = use(params);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/timeline/${id}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        </div>
    );
    if (!data || data.error) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-white/30 text-sm">
            Timeline not found.
        </div>
    );

    const { order, tasks, brand = {} } = data;
    const done = tasks.filter(t => t.status === 'done').length;
    const pct  = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

    return (
        <div className="min-h-screen bg-black text-white">
            {/* ambient glow */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-white/[0.02] blur-3xl" />
            </div>

            <div className="relative max-w-2xl mx-auto px-5 py-12">

                {/* ── Brand header ── */}
                <div className="flex items-center gap-4 mb-10 pb-8 border-b border-white/[0.06]">
                    {brand.company_logo && (
                        <img
                            src={brand.company_logo}
                            alt={brand.company_name || 'Logo'}
                            className="w-12 h-12 rounded-xl object-contain bg-white/[0.04] border border-white/[0.08] p-1.5 shrink-0"
                        />
                    )}
                    <div>
                        {brand.company_name && (
                            <p className="text-base font-bold tracking-tight text-white">{brand.company_name}</p>
                        )}
                        {brand.company_tagline && (
                            <p className="text-xs text-white/35 mt-0.5">{brand.company_tagline}</p>
                        )}
                        {brand.company_address && (
                            <p className="text-[11px] text-white/25 mt-0.5">{brand.company_address}</p>
                        )}
                    </div>
                </div>

                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-4">
                        <FiPackage className="w-4 h-4 text-white/30" />
                        <span className="text-xs font-mono text-white/30">{order.code}</span>
                        <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            order.status === 'Delivered'     ? 'bg-white/10 text-white/70 border-white/20' :
                            order.status === 'In Production' ? 'bg-white/[0.06] text-white/50 border-white/[0.1]' :
                            'bg-white/[0.03] text-white/30 border-white/[0.06]'
                        }`}>{order.status}</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">{order.customer_name}</h1>
                    {order.delivery_date && (
                        <p className="text-sm text-white/35 mt-1 flex items-center gap-1.5">
                            <FiClock className="w-3.5 h-3.5" />
                            Delivery: {new Date(order.delivery_date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                        </p>
                    )}

                    {/* Progress bar */}
                    <div className="mt-6">
                        <div className="flex items-center justify-between text-xs text-white/30 mb-2">
                            <span>{done} of {tasks.length} tasks complete</span>
                            <span className="font-mono font-semibold text-white/50">{pct}%</span>
                        </div>
                        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                            <div className="h-full bg-white/50 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                {tasks.length === 0 ? (
                    <p className="text-center text-white/25 text-sm py-12">No tasks yet.</p>
                ) : (
                    <div className="relative">
                        {/* Vertical spine */}
                        <div className="absolute left-[18px] top-3 bottom-3 w-px bg-white/[0.05]" />

                        <div className="space-y-1">
                            {tasks.map((task, idx) => {
                                const { icon: Icon, label, color, ring, line } = statusMeta(task.status);
                                const isLast = idx === tasks.length - 1;
                                return (
                                    <div key={task.id} className="flex items-start gap-5">
                                        {/* Node */}
                                        <div className={`relative z-10 shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${ring} mt-0.5`}>
                                            <Icon className={`w-4 h-4 ${color} ${task.status === 'in_progress' ? 'animate-spin' : ''}`} />
                                        </div>
                                        {/* Card */}
                                        <div className={`flex-1 mb-${isLast ? '0' : '2'} bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] rounded-2xl px-4 py-3.5 transition-colors`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className={`text-sm font-semibold leading-snug ${color}`}>{task.name}</p>
                                                    {/* {task.description && <p className="text-xs text-white/30 mt-0.5">{task.description}</p>} */}
                                                    {/* {task.machine_name && <p className="text-[11px] text-white/20 mt-1">📍 {task.machine_name}</p>} */}
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border inline-block ${
                                                        task.status === 'done' ? 'bg-white/[0.08] text-white/60 border-white/[0.12]' :
                                                        task.status === 'in_progress' ? 'bg-white/[0.05] text-white/50 border-white/[0.08]' :
                                                        'bg-transparent text-white/20 border-white/[0.06]'
                                                    }`}>{label}</span>
                                                    {task.completed_at && (
                                                        <p className="text-[10px] text-white/20 mt-1">{new Date(task.completed_at).toLocaleDateString()}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <p className="text-center text-xs text-white/15 mt-16">Powered by Pressmatics ERP</p>
            </div>
        </div>
    );
}
