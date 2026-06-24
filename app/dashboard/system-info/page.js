'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
    FiServer, FiDatabase, FiCode, FiLayers, FiZap, FiShield,
    FiPackage, FiGlobe, FiCpu, FiBox, FiGrid, FiActivity,
    FiCheck, FiStar, FiAward, FiTrendingUp, FiLock, FiRefreshCw
} from 'react-icons/fi';
import {
    SiNextdotjs, SiReact, SiTailwindcss, SiMysql, SiJsonwebtokens
} from 'react-icons/si';


/* ── helpers ── */
function useCounter(target, duration = 1500) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= target) { setCount(target); clearInterval(timer); }
            else setCount(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [inView, target, duration]);
    return [count, ref];
}

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

function Stat({ label, value, suffix = '', duration }) {
    const [count, ref] = useCounter(value, duration);
    return (
        <div ref={ref} className="text-center">
            <div className="text-3xl font-black text-white tabular-nums">{count.toLocaleString()}{suffix}</div>
            <div className="text-xs text-white/40 mt-1 uppercase tracking-wider">{label}</div>
        </div>
    );
}

function TechCard({ Icon, name, version, desc, accent, delay = 0 }) {
    return (
        <motion.div
            variants={fadeUp}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group rounded-2xl p-5 flex flex-col gap-3 cursor-default"
            style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px ${accent}12`,
            }}
        >
            <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}>
                    <Icon className="w-5 h-5" style={{ color: accent }} />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 text-white/30">{version}</span>
            </div>
            <div>
                <p className="font-semibold text-white text-sm">{name}</p>
                <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{desc}</p>
            </div>
            <div className="h-px w-0 group-hover:w-full transition-all duration-500 rounded-full" style={{ background: `linear-gradient(to right, ${accent}, transparent)` }} />
        </motion.div>
    );
}

function FeatureRow({ icon: Icon, label, accent = '#6366f1' }) {
    return (
        <motion.div variants={fadeUp} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${accent}18`, backdropFilter: 'blur(8px)', border: `1px solid ${accent}25` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
            </div>
            <span className="text-sm text-white/65">{label}</span>
            <FiCheck className="ml-auto w-3.5 h-3.5 text-emerald-400 shrink-0" />
        </motion.div>
    );
}

function PulsingDot({ color }) {
    return (
        <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: color }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
        </span>
    );
}

function AbstractBg() {
    return (
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none select-none" aria-hidden>
            {/* Grain texture */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.04]">
                <filter id="grain">
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#grain)" />
            </svg>
            {/* Dot grid */}
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
            {/* Diagonal lines */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
                {[0,1,2,3,4,5,6,7,8].map(i => (
                    <line key={i} x1={i * 120 - 200} y1="0" x2={i * 120 + 100} y2="400" stroke="white" strokeWidth="1" />
                ))}
            </svg>
            {/* Floating orbs */}
            <motion.div animate={{ y: [-18, 18, -18], x: [0, 12, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full"
                style={{ background: 'radial-gradient(circle at 40% 40%, rgba(255,255,255,0.08), transparent 70%)' }} />
            <motion.div animate={{ y: [14, -14, 14], x: [0, -10, 0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full"
                style={{ background: 'radial-gradient(circle at 60% 60%, rgba(255,255,255,0.06), transparent 70%)' }} />
            <motion.div animate={{ y: [-8, 8, -8] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04), transparent 70%)' }} />
            {/* Rotating rings */}
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-32 -right-32 w-96 h-96 rounded-full border border-white/[0.04]" />
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-20 -right-20 w-72 h-72 rounded-full border border-white/[0.03]" />
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full border border-white/[0.03]" />
            {/* Corner accents */}
            <div className="absolute top-0 right-0 w-64 h-px bg-gradient-to-l from-white/20 to-transparent" />
            <div className="absolute top-0 right-0 h-64 w-px bg-gradient-to-b from-white/20 to-transparent" />
            <div className="absolute bottom-0 left-0 w-64 h-px bg-gradient-to-r from-white/15 to-transparent" />
        </div>
    );
}

export default function SystemInfoPage() {
    const [uptime, setUptime] = useState('');
    const [time, setTime] = useState('');
    const [dbMs, setDbMs] = useState(null);

    useEffect(() => {
        const start = Date.now();
        const tick = () => {
            const s = Math.floor((Date.now() - start) / 1000);
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
            setUptime(`${h}h ${m}m ${ss}s`);
            setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const t0 = performance.now();
        fetch('/api/auth/me').then(() => setDbMs(Math.round(performance.now() - t0)));
    }, []);

    const TECH = [
        { Icon: SiNextdotjs,   name: 'Next.js',            version: '16.1.1',  accent: '#ffffff', desc: 'Full-stack React framework with App Router, server actions and API routes.' },
        { Icon: SiReact,       name: 'React',               version: '19.2.3',  accent: '#61dafb', desc: 'UI library powering all interactive client components.' },
        { Icon: SiTailwindcss, name: 'Tailwind CSS',        version: '4.x',     accent: '#38bdf8', desc: 'Utility-first CSS for rapid, consistent styling across all pages.' },
        { Icon: SiMysql,       name: 'MySQL 2',             version: '3.16.0',  accent: '#f59e0b', desc: 'Relational database storing all ERP data with connection pooling.' },
        { Icon: FiZap,         name: 'Framer Motion',       version: '12.x',    accent: '#e879f9', desc: 'Animation library for transitions, collapsibles and micro-interactions.' },
        { Icon: FiPackage,     name: '@react-pdf/renderer', version: '4.5.1',   accent: '#f87171', desc: 'Server-side PDF generation for job tickets, quotations and reports.' },
        { Icon: FiActivity,    name: 'Apache ECharts',      version: '6.1.0',   accent: '#f97316', desc: 'High-performance charting library for the Analytics dashboard.' },
        { Icon: FiGrid,        name: 'TanStack Table',      version: '8.21.3',  accent: '#34d399', desc: 'Headless table engine with sorting, filtering and column visibility.' },
        { Icon: FiLayers,      name: '@dnd-kit',            version: '6.x',     accent: '#818cf8', desc: 'Drag-and-drop toolkit for sortable lists and machine queue ordering.' },
        { Icon: SiJsonwebtokens, name: 'JWT / Jose',        version: '6.x',     accent: '#fbbf24', desc: 'Session authentication with signed HTTP-only cookie tokens.' },
        { Icon: FiShield,      name: 'bcryptjs',            version: '3.0.3',   accent: '#6ee7b7', desc: 'Password hashing for secure user credential storage.' },
        { Icon: FiZap,         name: 'react-hot-toast',     version: '2.6.0',   accent: '#fb923c', desc: 'Lightweight toast notifications for user feedback.' },
    ];

    const FEATURES = [
        { icon: FiServer,    label: 'Next.js App Router with server-side API routes',          accent: '#6366f1' },
        { icon: FiDatabase,  label: 'MySQL connection pool with prepared statements',            accent: '#f59e0b' },
        { icon: FiLock,      label: 'JWT authentication with HTTP-only cookie sessions',        accent: '#10b981' },
        { icon: FiShield,    label: 'Role-based access control (Admin / Manager / Operator)',   accent: '#ec4899' },
        { icon: FiRefreshCw, label: 'Automatic inventory deduction on Sales Order conversion',  accent: '#0ea5e9' },
        { icon: FiActivity,  label: 'Real-time imposition visualizer & cost calculation',       accent: '#8b5cf6' },
        { icon: FiBox,       label: 'SFG / BOM tracking with cascade stock management',         accent: '#f97316' },
        { icon: FiGlobe,     label: 'PDF generation (job tickets, quotations, reports)',        accent: '#14b8a6' },
        { icon: FiCpu,       label: 'Machine queue & production time estimation engine',        accent: '#a78bfa' },
        { icon: FiTrendingUp,label: 'Analytics with revenue, cost & customer reporting',        accent: '#fb923c' },
        { icon: FiStar,      label: 'Competitor price analysis with exportable PDF reports',    accent: '#84cc16' },
        { icon: FiAward,     label: 'QR-coded job tickets with mobile operator task tracking',  accent: '#38bdf8' },
    ];

    return (
        <div className="text-white space-y-12 pb-16">

            {/* ── Hero ── */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-black/40 p-10"
            >
                    {/* Abstract B&W background */}
                <AbstractBg />

                <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <PulsingDot color="#34d399" />
                            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">System Online</span>
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter text-white mb-2">Pressmatics ERP</h1>
                        <p className="text-white/45 text-sm max-w-md">A full-stack print production management platform — built for precision, performance and reliability.</p>
                        <div className="flex gap-3 mt-4 flex-wrap">
                            <span className="px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium">v0.1.0</span>
                            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-medium">Next.js 16</span>
                            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-medium">React 19</span>
                            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-medium">Internal Use</span>
                        </div>
                    </div>

                    {/* Live clock */}
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 min-w-[200px] text-center shrink-0">
                        <div className="text-4xl font-mono font-bold text-white tracking-widest tabular-nums">{time}</div>
                        <div className="text-xs text-white/30 mt-2 uppercase tracking-wider">Local Time</div>
                        <div className="mt-3 pt-3 border-t border-white/[0.06] text-xs text-white/40">
                            Session uptime: <span className="text-white/70 font-mono">{uptime}</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── Stats Row ── */}
            <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
                {[
                    { label: 'Dependencies', value: 21, suffix: '' },
                    { label: 'API Routes',   value: 38, suffix: '+' },
                    { label: 'DB Tables',    value: 24, suffix: '+' },
                    { label: 'React Pages',  value: 30, suffix: '+' },
                ].map(s => (
                    <motion.div key={s.label} variants={fadeUp}
                        className="rounded-2xl p-6"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.35)' }}>
                        <Stat {...s} duration={1200} />
                    </motion.div>
                ))}
            </motion.div>

            {/* ── Live Metrics ── */}
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="grid md:grid-cols-3 gap-4">
                <motion.div variants={fadeUp} className="rounded-2xl px-5 py-4"
                    style={{ background: 'rgba(16,185,129,0.07)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(52,211,153,0.2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <PulsingDot color="#34d399" />
                        <span className="text-xs uppercase tracking-wider text-emerald-400 font-medium">API Status</span>
                    </div>
                    <p className="text-2xl font-bold text-white">Healthy</p>
                    <p className="text-xs text-white/40 mt-1">All routes responding normally</p>
                </motion.div>
                <motion.div variants={fadeUp} className="rounded-2xl px-5 py-4"
                    style={{ background: 'rgba(14,165,233,0.07)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(56,189,248,0.2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <FiDatabase className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs uppercase tracking-wider text-blue-400 font-medium">Database</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                        {dbMs !== null ? `${dbMs} ms` : '—'}
                    </p>
                    <p className="text-xs text-white/40 mt-1">MySQL round-trip latency</p>
                </motion.div>
                <motion.div variants={fadeUp} className="rounded-2xl px-5 py-4"
                    style={{ background: 'rgba(139,92,246,0.07)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(167,139,250,0.2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <FiCpu className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs uppercase tracking-wider text-purple-400 font-medium">Runtime</span>
                    </div>
                    <p className="text-2xl font-bold text-white">Node.js</p>
                    <p className="text-xs text-white/40 mt-1">Server-side rendering & API</p>
                </motion.div>
            </motion.div>

            {/* ── Tech Stack ── */}
            <div>
                <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                    className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <FiCode className="w-5 h-5 text-white/40" /> Technology Stack
                </motion.h2>
                <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {TECH.map(t => <TechCard key={t.name} {...t} />)}
                </motion.div>
            </div>

            {/* ── Architecture ── */}
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <motion.h2 variants={fadeUp} className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <FiLayers className="w-5 h-5 text-white/40" /> Architecture
                </motion.h2>
                <div className="grid md:grid-cols-3 gap-4">
                    {[
                        { title: 'Frontend', accent: '#6366f1', icon: FiGlobe, items: ['Next.js App Router', 'React 19 Client Components', 'Tailwind CSS v4', 'Framer Motion animations', 'TanStack Table for data grids', 'ECharts for analytics', 'react-icons (Feather set)'] },
                        { title: 'Backend',  accent: '#10b981', icon: FiServer, items: ['Next.js API Routes (REST)', 'MySQL2 connection pool', 'JWT via jose + HTTP-only cookies', 'bcryptjs password hashing', 'Role-based middleware', 'QR code generation (qrcode)', 'PDF generation (@react-pdf)'] },
                        { title: 'Database', accent: '#f59e0b', icon: FiDatabase, items: ['MySQL relational DB', 'Tables: users, customers, items, quotations, sales_orders, invoices, inventory, finishings, machines, planning, analytics…', 'ON DELETE CASCADE constraints', 'Connection pooling via mysql2', 'Prepared statements throughout'] },
                    ].map(col => (
                        <motion.div key={col.title} variants={fadeUp}
                            className="rounded-2xl border border-white/[0.07] bg-black/40 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${col.accent}20`, border: `1px solid ${col.accent}30` }}>
                                    <col.icon className="w-4 h-4" style={{ color: col.accent }} />
                                </div>
                                <h3 className="font-bold text-white">{col.title}</h3>
                            </div>
                            <ul className="space-y-2">
                                {col.items.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-white/55">
                                        <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: col.accent }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* ── Features ── */}
            <div>
                <motion.h2 variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                    className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <FiStar className="w-5 h-5 text-white/40" /> System Capabilities
                </motion.h2>
                <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                    className="grid md:grid-cols-2 gap-x-8 rounded-2xl border border-white/[0.07] bg-black/40 p-6">
                    {FEATURES.map(f => <FeatureRow key={f.label} {...f} />)}
                </motion.div>
            </div>

            {/* ── Build Info ── */}
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <motion.h2 variants={fadeUp} className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <FiActivity className="w-5 h-5 text-white/40" /> Build Information
                </motion.h2>
                <motion.div variants={fadeUp} className="rounded-2xl border border-white/[0.07] bg-black/40 overflow-hidden">
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-white/[0.04]">
                            {[
                                ['Application',       'Pressmatics ERP'],
                                ['Version',           'v0.1.0 (Development)'],
                                ['Framework',         'Next.js 16.1.1 (App Router)'],
                                ['React Version',     '19.2.3'],
                                ['Node Runtime',      'Node.js LTS'],
                                ['CSS Engine',        'Tailwind CSS v4 + PostCSS'],
                                ['Database',          'MySQL (mysql2 v3.16.0)'],
                                ['Auth Strategy',     'JWT (jose v6) + HTTP-only Cookies'],
                                ['PDF Engine',        '@react-pdf/renderer v4.5.1'],
                                ['Charts Library',    'Apache ECharts v6.1.0 via echarts-for-react'],
                                ['Animation',         'Framer Motion v12'],
                                ['Icon Set',          'React Icons v5 — Feather Icons (Fi)'],
                                ['Drag & Drop',       '@dnd-kit/core + @dnd-kit/sortable v6/10'],
                                ['Table Engine',      '@tanstack/react-table v8.21.3'],
                                ['QR Codes',          'qrcode v1.5.4'],
                                ['Toast Alerts',      'react-hot-toast v2.6.0'],
                                ['Deployment Mode',   'Self-hosted / Internal'],
                                ['License',           'Private — Internal Use Only'],
                            ].map(([key, val]) => (
                                <tr key={key} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-3 text-white/35 font-medium text-xs uppercase tracking-wider w-48 shrink-0">{key}</td>
                                    <td className="px-6 py-3 text-white/75 font-mono text-xs">{val}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
            </motion.div>

            {/* ── Footer ── */}
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                className="text-center pt-4 border-t border-white/[0.05] space-y-1">
                <p className="text-xs text-white/25">Pressmatics ERP · Built for internal production management</p>
                <p className="text-xs text-white/15">All rights reserved · Confidential & proprietary</p>
            </motion.div>

        </div>
    );
}
