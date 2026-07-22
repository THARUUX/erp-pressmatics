'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiRefreshCw, FiGrid, FiCpu, FiLayers, FiActivity, FiTrendingUp, FiList, FiCalendar } from 'react-icons/fi';
import dynamic from 'next/dynamic';

// Dynamically import DnD components (client-only)
const KanbanBoard = dynamic(() => import('./components/KanbanBoard'), { ssr: false });
const RoutingPlanner = dynamic(() => import('./components/RoutingPlanner'), { ssr: false });
const JobWeeklyPlanner = dynamic(() => import('./components/JobWeeklyPlanner'), { ssr: false });
const MachinePlanning = dynamic(() => import('./components/MachinePlanning'), { ssr: false });
const FinishingPlanning = dynamic(() => import('./components/FinishingPlanning'), { ssr: false });
const ServicesPlanning = dynamic(() => import('./components/ServicesPlanning'), { ssr: false });
const AnalyticsDashboard = dynamic(() => import('./components/AnalyticsDashboard'), { ssr: false });

const G = {
    bg: '#070710',
    glass: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.07)',
    borderStr: 'rgba(255,255,255,0.12)',
    text: '#f1f5f9',
    muted: '#94a3b8',
    subtle: '#475569',
};

function StatPill({ label, value, accent }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '14px 28px',
            background: G.glass, backdropFilter: 'blur(16px)',
            border: `1px solid ${G.border}`, borderRadius: 14,
        }}>
            <span style={{ fontSize: 22, fontWeight: 600, fontFamily: 'monospace', color: accent || G.text, letterSpacing: '-1px' }}>{value}</span>
            <span style={{ fontSize: 10, color: G.subtle, fontWeight: 400, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{label}</span>
        </div>
    );
}

export default function JobPlanningPage() {
    const [tab, setTab] = useState('kanban');
    const [data, setData] = useState({ machines: [], finishings: [], orders: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/job-planning');
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // When kanban moves a card, update local state immediately (optimistic)
    const handleOrderMoved = (orderId, newStatus) => {
        setData(prev => ({
            ...prev,
            orders: prev.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o),
        }));
    };

    const machines = Array.isArray(data?.machines) ? data.machines : [];
    const finishings = Array.isArray(data?.finishings) ? data.finishings : [];
    const orders = Array.isArray(data?.orders) ? data.orders : [];

    const totalTasks = orders.reduce((a, o) => a + (Array.isArray(o?.tasks) ? o.tasks.length : 0), 0);
    const doneTasks = orders.reduce((a, o) => a + (Array.isArray(o?.tasks) ? o.tasks.filter(t => t?.status === 'done').length : 0), 0);
    const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
    const inProd = orders.filter(o => o?.status === 'In Production').length;

    const tabs = [
        { key: 'kanban',     label: 'Job Planning',        icon: FiGrid },
        { key: 'routing',    label: 'Routing Planner',     icon: FiList },
        { key: 'job_weekly', label: 'Job Weekly Planner',  icon: FiCalendar },
        { key: 'machine',    label: 'Machine Planning',     icon: FiCpu },
        { key: 'finishing',  label: 'Finishing Planning',   icon: FiActivity },
        { key: 'services',   label: 'Services Planning',    icon: FiLayers },
        { key: 'analytics',  label: 'Analytics',            icon: FiTrendingUp },
    ];

    return (
        <div style={{
            fontFamily: 'Inter, sans-serif',
            color: G.text,
            minHeight: '100vh',
            background: 'transparent',
            padding: '32px 32px 80px',
        }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 30, fontWeight: 800, color: G.text, margin: 0}}>
                        Planning Workspace
                    </h1>
                    <p style={{ color: G.subtle, margin: '4px 0 0', fontSize: 13 }}>
                        Drag &amp; drop to manage production flow
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 18px',
                        background: G.glass, backdropFilter: 'blur(12px)',
                        border: `1px solid ${G.border}`, borderRadius: 10,
                        color: G.muted, cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                        transition: 'all 0.2s',
                    }}
                >
                    <FiRefreshCw style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none', fontSize: 14 }} />
                    Refresh
                </button>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

            {/* ── Stats ── */}
            {!loading && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
                    <StatPill label="Active Orders" value={orders.length} />
                    <StatPill label="In Production" value={inProd} accent="#a78bfa" />
                    <StatPill label="Total Tasks" value={totalTasks} />
                    <StatPill label="Completed" value={`${pct}%`} accent="#10b981" />
                    <StatPill label="Machines" value={machines.length} accent="#ffffff" />
                </div>
            )}

            {/* ── Tab Bar ── */}
            <div style={{
                display: 'flex', gap: 4, marginBottom: 24,
                background: G.glass, backdropFilter: 'blur(12px)',
                border: `1px solid ${G.border}`, borderRadius: 12,
                padding: 4, width: 'fit-content',
            }}>
                {tabs.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '9px 20px', borderRadius: 9, cursor: 'pointer',
                            border: 'none', fontFamily: 'Inter, sans-serif',
                            fontWeight: tab === key ? 500 : 300,
                            fontSize: 13, letterSpacing: 0.2,
                            color: tab === key ? G.text : G.subtle,
                            background: tab === key ? 'rgba(255,255,255,0.09)' : 'transparent',
                            boxShadow: tab === key ? '0 1px 8px rgba(0,0,0,0.3)' : 'none',
                            transition: 'all 0.2s',
                        }}
                    >
                        <Icon style={{ fontSize: 14 }} />
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        border: `2px solid ${G.border}`, borderTop: `2px solid ${G.muted}`,
                        margin: '0 auto 16px', animation: 'spin 0.9s linear infinite',
                    }} />
                    <p style={{ color: G.subtle, fontSize: 13 }}>Loading production data…</p>
                </div>
            ) : error ? (
                <div style={{
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 12, padding: '20px 24px', color: '#f87171', fontSize: 13,
                }}>
                    Error: {error}
                </div>
            ) : (
                <>
                    {/* Kanban Board */}
                    {tab === 'kanban' && (
                        <KanbanBoard orders={orders} onOrderMoved={handleOrderMoved} />
                    )}

                    {/* Routing Planner */}
                    {tab === 'routing' && (
                        <RoutingPlanner
                            machines={machines}
                            finishings={finishings}
                            orders={orders}
                            onRefresh={load}
                        />
                    )}

                    {/* Job Weekly Planner */}
                    {tab === 'job_weekly' && (
                        <JobWeeklyPlanner
                            machines={machines}
                            finishings={finishings}
                            orders={orders}
                            onRefresh={load}
                        />
                    )}

                    {/* Machine Planning */}
                    {tab === 'machine' && (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ fontSize: 13, color: G.subtle, margin: 0, lineHeight: 1.6 }}>
                                    Each column shows tasks assigned to that machine across all active sales orders.
                                    Drag tasks between machines to reassign them. Tasks in <span style={{ color: '#f87171' }}>Unassigned</span> have no machine linked yet.
                                </p>
                            </div>
                            {machines.length === 0 ? (
                                <div style={{
                                    textAlign: 'center', padding: '60px 24px',
                                    background: G.glass, border: `1px dashed ${G.border}`,
                                    borderRadius: 16,
                                }}>
                                    <p style={{ fontSize: 32, marginBottom: 10 }}>🖨️</p>
                                    <p style={{ color: G.subtle, fontSize: 14 }}>No machines configured yet.</p>
                                    <p style={{ color: G.subtle, fontSize: 12 }}>Add machines in Settings → Machines.</p>
                                </div>
                            ) : (
                                <MachinePlanning machines={machines} finishings={finishings} orders={orders} onRefresh={load} />
                            )}
                        </div>
                    )}

                    {/* Finishing Planning */}
                    {tab === 'finishing' && (
                        <div>
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ fontSize: 13, color: G.subtle, margin: 0, lineHeight: 1.6 }}>
                                    Plan daily and weekly manual finishing operations that do not have a dedicated machine assigned.
                                </p>
                            </div>
                            {finishings.length === 0 ? (
                                <div style={{
                                    textAlign: 'center', padding: '60px 24px',
                                    background: G.glass, border: `1px dashed ${G.border}`,
                                    borderRadius: 16,
                                }}>
                                    <p style={{ fontSize: 32, marginBottom: 10 }}>✨</p>
                                    <p style={{ color: G.subtle, fontSize: 14 }}>No finishing operations configured yet.</p>
                                </div>
                            ) : (
                                <FinishingPlanning finishings={finishings} machines={machines} orders={orders} onRefresh={load} />
                            )}
                        </div>
                    )}

                    {/* Services Planning */}
                    {tab === 'services' && (
                        <ServicesPlanning />
                    )}

                    {/* Analytics Dashboard */}
                    {tab === 'analytics' && (
                        <AnalyticsDashboard
                            machines={machines}
                            finishings={finishings}
                            orders={orders}
                        />
                    )}
                </>
            )}
        </div>
    );
}
