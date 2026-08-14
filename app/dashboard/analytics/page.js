'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
    FiRefreshCw, FiArrowRight, FiTrendingUp, FiDollarSign, FiFileText,
    FiShoppingCart, FiBarChart2, FiActivity, FiClock, FiX, FiUsers, FiUser, FiEye, FiCheckCircle,
    FiPackage, FiAlertTriangle, FiDownload, FiCpu, FiLayers, FiSearch,
    FiPlus, FiTrash2, FiZap, FiExternalLink
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

function fmtCurrency(n = 0) { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(n); }
function fmt(n = 0) { if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`; if (n >= 1000) return `${(n / 1000).toFixed(1)}K`; return Number(n).toLocaleString(); }
function timeAgo(d) { const days = Math.floor((Date.now() - new Date(d)) / 86400000); if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'; return `${days}d ago`; }
function pct(a, b) { return b ? ((a / b) * 100).toFixed(1) : '0.0'; }
function formatMins(mins) {
    if (mins == null) return '—';
    const abs = Math.abs(mins);
    if (abs < 60) return `${mins}m`;
    const hrs = Math.round((mins / 60) * 10) / 10;
    return `${hrs}h`;
}
function formatVar(est, act) {
    if (est == null || act == null) return '—';
    const diff = act - est;
    if (diff === 0) return '0m';
    const abs = Math.abs(diff);
    const sign = diff > 0 ? '+' : '';
    if (abs < 60) return `${sign}${diff}m`;
    const hrs = Math.round((diff / 60) * 10) / 10;
    return `${sign > 0 ? '+' : ''}${hrs}h`;
}

function getStatusBadge(status) {
    switch (status) {
        case 'done':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/10 text-emerald-300 border-emerald-500/20">Done</span>;
        case 'in_progress':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-300 border-amber-500/20">In Progress</span>;
        case 'paused':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-orange-500/10 text-orange-300 border-orange-500/20">Paused</span>;
        default:
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-white/5 text-white/50 border-white/10">{status || 'Pending'}</span>;
    }
}

function formatDateTime(d) {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

const TT = { backgroundColor: 'rgba(8,8,8,0.95)', borderColor: 'rgba(255,255,255,0.08)', textStyle: { color: '#fff', fontSize: 12 } };

function Skel({ h = 'h-8', w = 'w-full' }) { return <div className={`${h} ${w} rounded-xl bg-white/[0.03] animate-pulse`} />; }

function KpiCard({ icon: Icon, label, value, sub, danger, href }) {
    const inner = (
        <div className={`bg-black/40 backdrop-blur-xl border ${danger ? 'border-red-500/20' : 'border-white/[0.07]'} rounded-2xl p-5 hover:border-white/20 hover:bg-white/[0.03] transition-all`}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-2">{label}</p>
                    <p className={`text-2xl font-bold tracking-tight ${danger ? 'text-red-400' : 'text-white'}`}>{value}</p>
                    {sub && <p className={`text-xs mt-1 ${danger ? 'text-red-400/50' : 'text-white/30'}`}>{sub}</p>}
                </div>
                <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${danger ? 'bg-red-500/10 border-red-500/20' : 'bg-white/[0.04] border-white/[0.06]'}`}>
                    <Icon className={`w-4 h-4 ${danger ? 'text-red-400' : 'text-white/50'}`} />
                </div>
            </div>
        </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
}

function SectionCard({ title, sub, href, hrefLabel, children }) {
    return (
        <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
                <div>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
                </div>
                {href && <Link href={href} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/70 transition-colors">{hrefLabel || "View all"} <FiArrowRight className="w-3 h-3" /></Link>}
            </div>
            {children}
        </div>
    );
}

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'finance', label: 'Finance & Profit' },
    { id: 'production', label: 'Production' },
    { id: 'inventory', label: 'Inventory' },
];

function getPlanDateRange(type, customStart, customEnd) {
    const end = new Date();
    let start = new Date();

    // Format helper YYYY-MM-DD
    const format = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    switch (type) {
        case 'today':
            return { startDate: format(end), endDate: format(end) };
        case 'yesterday': {
            const prev = new Date();
            prev.setDate(end.getDate() - 1);
            return { startDate: format(prev), endDate: format(prev) };
        }
        case 'last_7_days':
            start.setDate(end.getDate() - 7);
            return { startDate: format(start), endDate: format(end) };
        case 'last_30_days':
            start.setDate(end.getDate() - 30);
            return { startDate: format(start), endDate: format(end) };
        case 'this_month':
            start = new Date(end.getFullYear(), end.getMonth(), 1);
            return { startDate: format(start), endDate: format(end) };
        case 'last_month': {
            const y = end.getFullYear();
            const m = end.getMonth();
            start = new Date(y, m - 1, 1);
            const prevEnd = new Date(y, m, 0);
            return { startDate: format(start), endDate: format(prevEnd) };
        }
        case 'custom':
            return { startDate: customStart || format(new Date()), endDate: customEnd || format(new Date()) };
        case 'all_time':
        default:
            return { startDate: '', endDate: '' };
    }
}

export default function AnalyticsPage() {
    const [fontSize, setFontSize] = useState('md');
    const [tab, setTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('analytics-font-size');
        if (stored) {
            setFontSize(stored);
        }
    }, []);

    const adjustFontSize = (size) => {
        setFontSize(size);
        localStorage.setItem('analytics-font-size', size);
    };
    const [lastRefresh, setLastRefresh] = useState(null);
    const [machines, setMachines] = useState([]);
    const [machPerf, setMachPerf] = useState({});
    const [machLoading, setMachLoading] = useState(true);
    const [perfMachine, setPerfMachine] = useState(null);
    const [perfData, setPerfData] = useState(null);
    const [perfLoading, setPerfLoading] = useState(false);
    const [detailsTab, setDetailsTab] = useState('performance');
    const [reportDate, setReportDate] = useState(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    const [reportData, setReportData] = useState(null);
    const [reportLoading, setReportLoading] = useState(true);
    const [prodTab, setProdTab] = useState('analytics'); // 'analytics', 'reports', or 'performance'

    // Production Planning States
    const [resType, setResType] = useState('machine'); // 'machine' or 'finishing'
    const [resList, setResList] = useState({ machines: [], finishings: [] });
    const [selectedResId, setSelectedResId] = useState('');
    const [planReport, setPlanReport] = useState(null);
    const [planLoading, setPlanLoading] = useState(false);
    const [planSearch, setPlanSearch] = useState('');
    const [prodRevenueChartMetric, setProdRevenueChartMetric] = useState('revenue'); // 'revenue' or 'rate'
    const [resSearchQuery, setResSearchQuery] = useState('');
    const [resDropdownOpen, setResDropdownOpen] = useState(false);
    const [planDurationType, setPlanDurationType] = useState('last_30_days');
    const [planCustomStart, setPlanCustomStart] = useState('');
    const [planCustomEnd, setPlanCustomEnd] = useState('');

    // Machine Performance Duration States
    const [perfDurationType, setPerfDurationType] = useState('last_30_days');
    const [perfCustomStart, setPerfCustomStart] = useState('');
    const [perfCustomEnd, setPerfCustomEnd] = useState('');

    // Task Explorer States
    const [explorerDate, setExplorerDate] = useState(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    const [explorerResType, setExplorerResType] = useState('machine');
    const [explorerResId, setExplorerResId] = useState('');
    const [explorerResSearchQuery, setExplorerResSearchQuery] = useState('');
    const [explorerResDropdownOpen, setExplorerResDropdownOpen] = useState(false);
    const [explorerTasks, setExplorerTasks] = useState([]);
    const [explorerTasksLoading, setExplorerTasksLoading] = useState(false);
    const [selectedExplorerTaskId, setSelectedExplorerTaskId] = useState(null);
    const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
    const [selectedTaskDetailLoading, setSelectedTaskDetailLoading] = useState(false);


    // Employee Performance States
    const [empPerfDurationType, setEmpPerfDurationType] = useState("last_30_days");
    const [empPerfCustomStart, setEmpPerfCustomStart] = useState("");
    const [empPerfCustomEnd, setEmpPerfCustomEnd] = useState("");
    const [empPerfSearchQuery, setEmpPerfSearchQuery] = useState("");
    const [empPerfData, setEmpPerfData] = useState(null);
    const [empPerfLoading, setEmpPerfLoading] = useState(false);
    const [selectedEmpName, setSelectedEmpName] = useState(null);
    const [taskModalId, setTaskModalId] = useState(null);
    const [taskModalData, setTaskModalData] = useState(null);
    const [taskModalLoading, setTaskModalLoading] = useState(false);

    const openTaskModal = useCallback(async (taskId) => {
        if (!taskId) return;
        setTaskModalId(taskId);
        setTaskModalLoading(true);
        setTaskModalData(null);
        try {
            const res = await fetch(`/api/analytics/task-explorer?taskId=${taskId}`);
            if (res.ok) {
                const data = await res.json();
                setTaskModalData(data);
            }
        } catch (e) {
            console.error("Failed to load task modal details:", e);
        } finally {
            setTaskModalLoading(false);
        }
    }, []);

    const [empModalData, setEmpModalData] = useState(null);
    const [empModalLoading, setEmpModalLoading] = useState(false);

    const activeExplorerResList = explorerResType === 'machine' ? resList.machines : resList.finishings;
    const filteredExplorerResList = (activeExplorerResList || []).filter(item =>
        (item.name || '').toLowerCase().includes(explorerResSearchQuery.toLowerCase())
    );

    const activeResList = resType === 'machine' ? resList.machines : resList.finishings;
    const filteredResList = (activeResList || []).filter(item =>
        (item.name || '').toLowerCase().includes(resSearchQuery.toLowerCase())
    );

    const loadReport = useCallback(async (date) => {
        setReportLoading(true);
        try {
            const r = await fetch(`/api/production-reports?date=${date}`);
            if (r.ok) {
                setReportData(await r.json());
            }
        } catch (e) {
            console.error('Failed to load daily report:', e);
        } finally {
            setReportLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === 'production' && prodTab === 'reports') {
            loadReport(reportDate);
        }
    }, [tab, prodTab, reportDate, loadReport]);

    // Load available machines and finishings
    useEffect(() => {
        async function fetchResources() {
            try {
                const res = await fetch('/api/analytics/production-planning');
                if (res.ok) {
                    const data = await res.json();
                    setResList(data);
                    // Select first machine by default if available
                    if (data.machines?.length > 0) {
                        setSelectedResId(data.machines[0].id.toString());
                        setExplorerResId(data.machines[0].id.toString());
                    }
                }
            } catch (err) {
                console.error('Failed to fetch resources:', err);
            }
        }
        fetchResources();
    }, []);

    const loadPlanReport = useCallback(async (type, id, start, end) => {
        if (!type || !id) return;
        setPlanLoading(true);
        try {
            let url = `/api/analytics/production-planning?type=${type}&id=${id}`;
            if (start && end) {
                url += `&startDate=${start}&endDate=${end}`;
            }
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setPlanReport(data);
            }
        } catch (err) {
            console.error('Failed to load planning report:', err);
        } finally {
            setPlanLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedResId) {
            const { startDate, endDate } = getPlanDateRange(planDurationType, planCustomStart, planCustomEnd);
            loadPlanReport(resType, selectedResId, startDate, endDate);
        } else {
            setPlanReport(null);
        }
    }, [resType, selectedResId, planDurationType, planCustomStart, planCustomEnd, loadPlanReport]);

    useEffect(() => {
        const activeResList = resType === 'machine' ? resList.machines : resList.finishings;
        const currentRes = activeResList.find(r => r.id.toString() === selectedResId.toString());
        if (currentRes) {
            setResSearchQuery(currentRes.name);
        } else {
            setResSearchQuery('');
        }
    }, [selectedResId, resType, resList]);

    const handleResTypeChange = (newType) => {
        setResType(newType);
        const list = newType === 'machine' ? resList.machines : resList.finishings;
        if (list && list.length > 0) {
            setSelectedResId(list[0].id.toString());
        } else {
            setSelectedResId('');
        }
        setPlanSearch('');
    };

    const loadExplorerTasks = useCallback(async (date, type, resourceId) => {
        if (!date || !type || !resourceId) return;
        setExplorerTasksLoading(true);
        try {
            const res = await fetch(`/api/analytics/task-explorer?date=${date}&type=${type}&resourceId=${resourceId}`);
            if (res.ok) {
                const data = await res.json();
                setExplorerTasks(data.tasks || []);
            } else {
                setExplorerTasks([]);
            }
        } catch (err) {
            console.error('Failed to load explorer tasks:', err);
            setExplorerTasks([]);
        } finally {
            setExplorerTasksLoading(false);
        }
    }, []);

    const loadSelectedTaskDetail = useCallback(async (taskId) => {
        if (!taskId) {
            setSelectedTaskDetail(null);
            return;
        }
        setSelectedTaskDetailLoading(true);
        try {
            const res = await fetch(`/api/analytics/task-explorer?taskId=${taskId}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedTaskDetail(data);
            } else {
                setSelectedTaskDetail(null);
            }
        } catch (err) {
            console.error('Failed to load task details:', err);
            setSelectedTaskDetail(null);
        } finally {
            setSelectedTaskDetailLoading(false);
        }
    }, []);

    // Fetch tasks when filters change
    useEffect(() => {
        if (tab === 'production' && prodTab === 'task-details' && explorerResId) {
            loadExplorerTasks(explorerDate, explorerResType, explorerResId);
            setSelectedExplorerTaskId(null);
            setSelectedTaskDetail(null);
        }
    }, [tab, prodTab, explorerDate, explorerResType, explorerResId, loadExplorerTasks]);

    // Fetch task details when selected task changes
    useEffect(() => {
        if (selectedExplorerTaskId) {
            loadSelectedTaskDetail(selectedExplorerTaskId);
        } else {
            setSelectedTaskDetail(null);
        }
    }, [selectedExplorerTaskId, loadSelectedTaskDetail]);

    useEffect(() => {
        const activeList = explorerResType === 'machine' ? resList.machines : resList.finishings;
        const currentRes = (activeList || []).find(r => r.id.toString() === explorerResId.toString());
        if (currentRes) {
            setExplorerResSearchQuery(currentRes.name);
        } else {
            setExplorerResSearchQuery('');
        }
    }, [explorerResId, explorerResType, resList]);

    const handleExplorerResTypeChange = (newType) => {
        setExplorerResType(newType);
        const list = newType === 'machine' ? resList.machines : resList.finishings;
        if (list && list.length > 0) {
            setExplorerResId(list[0].id.toString());
        } else {
            setExplorerResId('');
        }
        setSelectedExplorerTaskId(null);
        setSelectedTaskDetail(null);
    };

    // ── Service Explorer States ─────────────────────────────────────────────────
    const [svcDate, setSvcDate] = useState(() => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    const [svcServiceName, setSvcServiceName] = useState('');
    const [svcServiceTypes, setSvcServiceTypes] = useState([]);
    const [svcTasks, setSvcTasks] = useState([]);
    const [svcTasksLoading, setSvcTasksLoading] = useState(false);
    const [selectedSvcTaskId, setSelectedSvcTaskId] = useState(null);
    const [selectedSvcDetail, setSelectedSvcDetail] = useState(null);
    const [selectedSvcDetailLoading, setSelectedSvcDetailLoading] = useState(false);

    // Fetch available service types
    useEffect(() => {
        if (tab === 'production' && prodTab === 'task-details') {
            fetch('/api/analytics/service-explorer?listTypes=1')
                .then(r => r.ok ? r.json() : { types: [] })
                .then(data => setSvcServiceTypes(data.types || []))
                .catch(() => { });
        }
    }, [tab, prodTab]);

    const loadSvcTasks = useCallback(async (date, serviceName) => {
        if (!date) return;
        setSvcTasksLoading(true);
        try {
            let url = `/api/analytics/service-explorer?date=${date}`;
            if (serviceName) url += `&serviceName=${encodeURIComponent(serviceName)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setSvcTasks(data.tasks || []);
            } else {
                setSvcTasks([]);
            }
        } catch {
            setSvcTasks([]);
        } finally {
            setSvcTasksLoading(false);
        }
    }, []);

    const loadSvcTaskDetail = useCallback(async (taskId) => {
        if (!taskId) { setSelectedSvcDetail(null); return; }
        setSelectedSvcDetailLoading(true);
        try {
            const res = await fetch(`/api/analytics/service-explorer?taskId=${taskId}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedSvcDetail(data);
            } else {
                setSelectedSvcDetail(null);
            }
        } catch {
            setSelectedSvcDetail(null);
        } finally {
            setSelectedSvcDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === 'production' && prodTab === 'task-details') {
            loadSvcTasks(svcDate, svcServiceName);
            setSelectedSvcTaskId(null);
            setSelectedSvcDetail(null);
        }
    }, [tab, prodTab, svcDate, svcServiceName, loadSvcTasks]);

    useEffect(() => {
        if (selectedSvcTaskId) {
            loadSvcTaskDetail(selectedSvcTaskId);
        } else {
            setSelectedSvcDetail(null);
        }
    }, [selectedSvcTaskId, loadSvcTaskDetail]);

    const chartRef = useRef(null);
    const chartInst = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await fetch('/api/dashboard/stats'); if (r.ok) setStats(await r.json()); }
        finally { setLoading(false); setLastRefresh(new Date()); }
    }, []);

    const loadMachines = useCallback(async () => {
        setMachLoading(true);
        try {
            const list = await fetch('/api/machines').then(r => r.json());
            if (!Array.isArray(list)) return;
            setMachines(list);
            const { startDate, endDate } = getPlanDateRange(perfDurationType, perfCustomStart, perfCustomEnd);
            let query = '';
            if (startDate && endDate) {
                query = `?startDate=${startDate}&endDate=${endDate}`;
            }
            const results = await Promise.allSettled(list.map(m => fetch(`/api/machines/${m.id}/performance${query}`).then(r => r.json()).then(d => [m.id, d])));
            const map = {};
            results.forEach(r => { if (r.status === 'fulfilled') { const [id, d] = r.value; map[id] = d; } });
            setMachPerf(map);
        } catch (e) { console.error(e); }
        finally { setMachLoading(false); }
    }, [perfDurationType, perfCustomStart, perfCustomEnd]);

    const openPerf = useCallback((m) => {
        setPerfMachine(m);
        setDetailsTab('performance');
    }, []);


    const loadEmployeePerformance = useCallback(async () => {
        setEmpPerfLoading(true);
        try {
            const { startDate, endDate } = getPlanDateRange(empPerfDurationType, empPerfCustomStart, empPerfCustomEnd);
            const params = new URLSearchParams();
            if (startDate && endDate) {
                params.set("startDate", startDate);
                params.set("endDate", endDate);
            }
            const res = await fetch(`/api/analytics/employee-performance?${params.toString()}`);
            const data = await res.json();
            setEmpPerfData(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load employee performance");
        } finally {
            setEmpPerfLoading(false);
        }
    }, [empPerfDurationType, empPerfCustomStart, empPerfCustomEnd]);

    useEffect(() => {
        if (tab === "production" && prodTab === "employee-performance") {
            loadEmployeePerformance();
        }
    }, [tab, prodTab, empPerfDurationType, empPerfCustomStart, empPerfCustomEnd, loadEmployeePerformance]);

    const openEmpDetail = async (empName) => {
        setSelectedEmpName(empName);
        setEmpModalLoading(true);
        try {
            const { startDate, endDate } = getPlanDateRange(empPerfDurationType, empPerfCustomStart, empPerfCustomEnd);
            const params = new URLSearchParams();
            params.set("employeeName", empName);
            if (startDate && endDate) {
                params.set("startDate", startDate);
                params.set("endDate", endDate);
            }
            const res = await fetch(`/api/analytics/employee-performance?${params.toString()}`);
            const data = await res.json();
            setEmpModalData(data.selectedEmployeeDetail);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load employee detail");
        } finally {
            setEmpModalLoading(false);
        }
    };

    const refreshPerfData = async (machineId) => {
        try {
            const { startDate, endDate } = getPlanDateRange(perfDurationType, perfCustomStart, perfCustomEnd);
            let query = '';
            if (startDate && endDate) {
                query = `?startDate=${startDate}&endDate=${endDate}`;
            }
            const d = await fetch(`/api/machines/${machineId}/performance${query}`).then(r => r.json());
            setPerfData(d);
            loadMachinePerformance();
        } catch { toast.error('Failed to reload data'); }
    };

    useEffect(() => {
        if (perfMachine) {
            const fetchPerfDetails = async () => {
                setPerfLoading(true);
                try {
                    const { startDate, endDate } = getPlanDateRange(perfDurationType, perfCustomStart, perfCustomEnd);
                    let query = '';
                    if (startDate && endDate) {
                        query = `?startDate=${startDate}&endDate=${endDate}`;
                    }
                    const d = await fetch(`/api/machines/${perfMachine.id}/performance${query}`).then(r => r.json());
                    setPerfData(d);
                } catch (e) {
                    console.error(e);
                } finally {
                    setPerfLoading(false);
                }
            };
            fetchPerfDetails();
        }
    }, [perfMachine, perfDurationType, perfCustomStart, perfCustomEnd]);

    useEffect(() => {
        if (!perfData?.monthly?.length || !chartRef.current) return;
        import('echarts').then(e => {
            if (chartInst.current) chartInst.current.dispose();
            chartInst.current = e.init(chartRef.current, null, { renderer: 'svg' });
            chartInst.current.setOption({
                backgroundColor: 'transparent',
                tooltip: { trigger: 'axis', backgroundColor: '#111', borderColor: '#333', textStyle: { color: '#ccc' } },
                grid: { left: 10, right: 10, top: 10, bottom: 30, containLabel: true },
                xAxis: { type: 'category', data: perfData.monthly.map(m => m.month), axisLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#555', fontSize: 10 } },
                yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { color: '#555', fontSize: 10 } },
                series: [
                    { name: 'Tasks Done', type: 'bar', data: perfData.monthly.map(m => m.tasks_done), itemStyle: { color: 'rgba(255,255,255,0.4)', borderRadius: [4, 4, 0, 0] } },
                    { name: 'Avg Mins', type: 'line', data: perfData.monthly.map(m => m.avg_mins), lineStyle: { color: 'rgba(255,255,255,0.2)' }, itemStyle: { color: 'rgba(255,255,255,0.3)' }, smooth: true, symbol: 'circle', symbolSize: 5 },
                ],
            });
        });
        return () => { if (chartInst.current) { chartInst.current.dispose(); chartInst.current = null; } };
    }, [perfData]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { loadMachines(); }, [loadMachines]);

    // ── Chart options ──────────────────────────────────────────────────────────
    const revenueOption = stats?.revenueByMonth?.length ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', ...TT, formatter: p => p.map(i => `<span style="color:${i.color}">${i.seriesName}</span> <b>${fmtCurrency(i.value)}</b>`).join('<br/>') },
        legend: { data: ['Billed', 'Collected'], textStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 11 }, right: 0 },
        grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
        xAxis: { type: 'category', data: stats.revenueByMonth.map(r => r.label), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisTick: { show: false }, axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10 } },
        yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
        series: [
            { name: 'Billed', type: 'bar', data: stats.revenueByMonth.map(r => Number(r.billed)), barMaxWidth: 36, itemStyle: { color: 'rgba(255,255,255,0.08)', borderRadius: [4, 4, 0, 0] } },
            { name: 'Collected', type: 'line', smooth: true, data: stats.revenueByMonth.map(r => Number(r.collected)), lineStyle: { color: 'rgba(255,255,255,0.7)', width: 2 }, symbol: 'circle', symbolSize: 5, itemStyle: { color: 'rgba(255,255,255,0.8)' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,255,255,0.1)' }, { offset: 1, color: 'rgba(0,0,0,0)' }] } } },
        ],
    } : null;

    const makePie = (data, palette) => ({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', ...TT },
        legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: 'rgba(255,255,255,0.35)', fontSize: 11 } },
        series: [{
            type: 'pie', radius: ['52%', '80%'], center: ['36%', '50%'], avoidLabelOverlap: true, label: { show: false }, emphasis: { label: { show: false } },
            data: data.map((s, i) => ({ name: s.status, value: Number(s.count), itemStyle: { color: palette[i % palette.length] } }))
        }],
    });
    const PALETTE = ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.20)', 'rgba(255,255,255,0.12)'];
    const invPie = stats?.invoicesByStatus?.length ? makePie(stats.invoicesByStatus, PALETTE) : null;
    const quotPie = stats?.quotationsByStatus?.length ? makePie(stats.quotationsByStatus, PALETTE) : null;

    const topCustOption = stats?.topCustomers?.length ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'none' }, ...TT, formatter: p => `<b>${p[0].name}</b><br/>${fmtCurrency(p[0].value)}` },
        grid: { left: 0, right: 20, top: 4, bottom: 0, containLabel: true },
        xAxis: { type: 'value', show: false },
        yAxis: { type: 'category', data: stats.topCustomers.map(c => c.customer_name).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11 } },
        series: [{
            type: 'bar', data: stats.topCustomers.map(c => Number(c.revenue)).reverse(), barMaxWidth: 18,
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: 'rgba(255,255,255,0.06)' }, { offset: 1, color: 'rgba(255,255,255,0.45)' }] }, borderRadius: [0, 6, 6, 0] },
            label: { show: true, position: 'right', color: 'rgba(255,255,255,0.3)', fontSize: 10, formatter: p => fmt(p.value) }
        }],
    } : null;

    const profitTrendOption = stats?.profitByMonth?.length ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', ...TT, formatter: p => `<b>${p[0]?.name}</b><br/>` + p.map(i => `<span style="color:${i.color}">${i.seriesName}</span> <b>${fmtCurrency(i.value)}</b>`).join('<br/>') },
        legend: { data: ['Production Cost', 'Markup Profit', 'Billed (ex-tax)'], textStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 11 }, right: 0 },
        grid: { left: 8, right: 8, top: 44, bottom: 0, containLabel: true },
        xAxis: { type: 'category', data: stats.profitByMonth.map(r => r.label), axisLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisTick: { show: false }, axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 11 } },
        yAxis: { type: 'value', axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
        series: [
            { name: 'Production Cost', type: 'bar', stack: 'total', data: stats.profitByMonth.map(r => r.cost), barMaxWidth: 44, itemStyle: { color: 'rgba(255,255,255,0.10)', borderRadius: [0, 0, 4, 4] } },
            { name: 'Markup Profit', type: 'bar', stack: 'total', data: stats.profitByMonth.map(r => r.profit), barMaxWidth: 44, itemStyle: { color: 'rgba(255,255,255,0.40)', borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', color: 'rgba(255,255,255,0.5)', fontSize: 10, formatter: p => p.value > 0 ? fmtCurrency(p.value) : '' } },
            { name: 'Billed (ex-tax)', type: 'line', smooth: true, data: stats.profitByMonth.map(r => r.billed), lineStyle: { color: 'rgba(255,255,255,0.55)', width: 2, type: 'dashed' }, symbol: 'circle', symbolSize: 5, itemStyle: { color: 'rgba(255,255,255,0.7)' } },
        ],
    } : null;

    const custProfitRows = stats?.profitRows ? Object.values(
        stats.profitRows.reduce((acc, r) => {
            if (!acc[r.customer_name]) acc[r.customer_name] = { customer: r.customer_name, profit: 0, billed: 0, cost: 0, jobs: 0 };
            acc[r.customer_name].profit += r.markup_profit; acc[r.customer_name].billed += r.total_billed_ex_tax;
            acc[r.customer_name].cost += r.total_cost; acc[r.customer_name].jobs += r.so_count;
            return acc;
        }, {})
    ).sort((a, b) => b.profit - a.profit).slice(0, 8) : [];

    const custProfitOption = custProfitRows.length ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'none' }, ...TT, formatter: p => { const row = custProfitRows.find(r => r.customer === p[0]?.name) || {}; return `<b>${p[0]?.name}</b><br/>Profit: <b>${fmtCurrency(row.profit)}</b><br/>Margin: ${pct(row.profit, row.cost)}%`; } },
        grid: { left: 0, right: 80, top: 4, bottom: 0, containLabel: true },
        xAxis: { type: 'value', show: false },
        yAxis: { type: 'category', data: custProfitRows.map(r => r.customer).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11 } },
        series: [{
            type: 'bar', data: custProfitRows.map(r => r.profit).reverse(), barMaxWidth: 18,
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: 'rgba(255,255,255,0.06)' }, { offset: 1, color: 'rgba(255,255,255,0.45)' }] }, borderRadius: [0, 6, 6, 0] },
            label: { show: true, position: 'right', color: 'rgba(255,255,255,0.35)', fontSize: 10, formatter: p => fmt(p.value) }
        }],
    } : null;

    const scatterOption = stats?.profitRows?.length ? {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item', ...TT, formatter: p => {
                const vals = Array.isArray(p.value) ? p.value : (p.data && Array.isArray(p.data.value) ? p.data.value : []);
                const [cost, margin] = vals;
                const name = p.name || (p.data && p.data.name) || '';
                return `<b>${name}</b><br/>Cost: ${fmtCurrency(cost || 0)}<br/>Margin: ${margin || 0}%`;
            }
        },
        grid: { left: 8, right: 8, top: 8, bottom: 0, containLabel: true },
        xAxis: { type: 'value', name: 'Cost (LKR)', nameTextStyle: { color: 'rgba(255,255,255,0.2)', fontSize: 10 }, axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => fmt(v) }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
        yAxis: { type: 'value', name: 'Margin %', nameTextStyle: { color: 'rgba(255,255,255,0.2)', fontSize: 10 }, axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
        series: [{ type: 'scatter', data: stats.profitRows.map(r => ({ name: `${r.quotation_code} — ${r.customer_name}`, value: [r.total_cost, r.margin_pct] })), symbolSize: 10, itemStyle: { color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1 }, emphasis: { itemStyle: { color: '#fff', borderWidth: 0 } } }],
    } : null;

    // ── Production Chart options ──────────────────────────────────────────────
    const prodTimeTrendOption = planReport?.dailySummary?.length ? {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            ...TT,
            formatter: p => `<b>${p[0]?.name}</b><br/>` + p.map(i => `<span style="color:${i.color}">${i.seriesName}</span>: <b>${formatMins(i.value)}</b>`).join('<br/>')
        },
        legend: { data: ['Est. Time', 'Act. Time'], textStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 11 }, right: 0 },
        grid: { left: 8, right: 8, top: 32, bottom: 0, containLabel: true },
        xAxis: {
            type: 'category',
            data: planReport.dailySummary.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
            axisTick: { show: false },
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10 }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => formatMins(v) },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
        },
        series: [
            {
                name: 'Est. Time',
                type: 'line',
                smooth: true,
                data: planReport.dailySummary.map(d => d.estMinutes),
                lineStyle: { color: 'rgba(255,255,255,0.35)', width: 2, type: 'dashed' },
                symbol: 'circle',
                symbolSize: 4,
                itemStyle: { color: 'rgba(255,255,255,0.4)' }
            },
            {
                name: 'Act. Time',
                type: 'line',
                smooth: true,
                data: planReport.dailySummary.map(d => d.actMinutes),
                lineStyle: { color: 'rgba(255,255,255,0.85)', width: 2 },
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: { color: 'rgba(255,255,255,1)' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(255,255,255,0.08)' },
                            { offset: 1, color: 'rgba(0,0,0,0)' }
                        ]
                    }
                }
            },
        ],
    } : null;

    const getStatusCounts = () => {
        if (!planReport?.tasks) return [];
        const counts = { done: 0, in_progress: 0, pending: 0 };
        planReport.tasks.forEach(t => {
            if (t.status === 'done') counts.done++;
            else if (t.status === 'in_progress') counts.in_progress++;
            else counts.pending++;
        });
        return [
            { name: 'Completed', value: counts.done, color: 'rgba(52, 211, 153, 0.85)' },       // Emerald
            { name: 'In Progress', value: counts.in_progress, color: 'rgba(251, 191, 36, 0.85)' }, // Amber
            { name: 'Pending / To Do', value: counts.pending, color: 'rgba(255, 255, 255, 0.25)' }   // White/faded
        ].filter(item => item.value > 0);
    };

    const prodStatusData = getStatusCounts();
    const prodStatusPie = prodStatusData.length ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', ...TT, formatter: p => `<b>${p.name}</b>: ${p.value} (${p.percent}%)` },
        legend: { orient: 'horizontal', bottom: 0, left: 'center', textStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 9 } },
        series: [{
            type: 'pie',
            radius: ['45%', '65%'],
            center: ['50%', '40%'],
            avoidLabelOverlap: true,
            label: { show: false },
            emphasis: { label: { show: false } },
            data: prodStatusData.map(item => ({
                name: item.name,
                value: item.value,
                itemStyle: { color: item.color }
            }))
        }],
    } : null;

    // Job-wise Revenue Option (Horizontal Bar Chart)
    const prodRevenueBarOption = planReport?.tasks?.length ? {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            ...TT,
            formatter: p => {
                const item = p[0];
                return `<b>${item.name}</b><br/>Revenue: <b>${fmtCurrency(item.value)}</b>`;
            }
        },
        grid: { left: 10, right: 40, top: 10, bottom: 10, containLabel: true },
        xAxis: {
            type: 'value',
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => fmt(v) },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
        },
        yAxis: {
            type: 'category',
            data: planReport.tasks
                .filter(t => (t.revenue || 0) > 0)
                .sort((a, b) => (a.revenue || 0) - (b.revenue || 0))
                .slice(-10)
                .map(t => {
                    const parts = t.name.split(' — ');
                    const cleanName = parts.length >= 3 ? parts[1] : (parts[0] || 'Job');
                    return `${t.order_code || 'Unassigned'} - ${cleanName.substring(0, 15)}${cleanName.length > 15 ? '...' : ''}`;
                }),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9 }
        },
        series: [{
            type: 'bar',
            data: planReport.tasks
                .filter(t => (t.revenue || 0) > 0)
                .sort((a, b) => (a.revenue || 0) - (b.revenue || 0))
                .slice(-10)
                .map(t => Number(t.revenue || 0)),
            barMaxWidth: 16,
            itemStyle: {
                color: {
                    type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: 'rgba(16, 185, 129, 0.1)' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0.75)' }
                    ]
                },
                borderRadius: [0, 4, 4, 0]
            },
            label: {
                show: true,
                position: 'right',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 9,
                formatter: p => fmtCurrency(p.value)
            }
        }],
    } : null;

    // Job-wise Rate Option (Horizontal Bar Chart)
    const prodRateBarOption = planReport?.tasks?.length ? {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            ...TT,
            formatter: p => {
                const item = p[0];
                const task = planReport.tasks.find(t => {
                    const parts = t.name.split(' — ');
                    const cleanName = parts.length >= 3 ? parts[1] : (parts[0] || 'Job');
                    const label = `${t.order_code || 'Unassigned'} - ${cleanName.substring(0, 15)}${cleanName.length > 15 ? '...' : ''}`;
                    return label === item.name;
                });
                if (!task) return `<b>${item.name}</b><br/>Rate: <b>${fmtCurrency(item.value)}</b>`;
                const unit = task.is_finishing ? (task.rate_unit || 'Unit') : '1k Imps';
                const qty = task.is_finishing
                    ? `${fmt(task.quantity || task.finishing_qty)} ${task.rate_unit || 'Units'}`
                    : `${fmt(task.printed_sheets || task.quantity)} Imps`;
                return `<b>${task.name}</b><br/>
                        Order: <b>${task.order_code || 'Unassigned'}</b><br/>
                        Rate: <b>${fmtCurrency(task.rate)} / ${unit}</b><br/>
                        Qty: <b>${qty}</b><br/>
                        Est. Revenue: <b>${fmtCurrency(task.revenue)}</b>`;
            }
        },
        grid: { left: 10, right: 40, top: 10, bottom: 10, containLabel: true },
        xAxis: {
            type: 'value',
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => fmt(v) },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
        },
        yAxis: {
            type: 'category',
            data: planReport.tasks
                .filter(t => (t.rate || 0) > 0)
                .sort((a, b) => (a.rate || 0) - (b.rate || 0))
                .slice(-10)
                .map(t => {
                    const parts = t.name.split(' — ');
                    const cleanName = parts.length >= 3 ? parts[1] : (parts[0] || 'Job');
                    return `${t.order_code || 'Unassigned'} - ${cleanName.substring(0, 15)}${cleanName.length > 15 ? '...' : ''}`;
                }),
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9 }
        },
        series: [{
            type: 'bar',
            data: planReport.tasks
                .filter(t => (t.rate || 0) > 0)
                .sort((a, b) => (a.rate || 0) - (b.rate || 0))
                .slice(-10)
                .map(t => Number(t.rate || 0)),
            barMaxWidth: 16,
            itemStyle: {
                color: {
                    type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                    colorStops: [
                        { offset: 0, color: 'rgba(59, 130, 246, 0.1)' },
                        { offset: 1, color: 'rgba(59, 130, 246, 0.75)' }
                    ]
                },
                borderRadius: [0, 4, 4, 0]
            },
            label: {
                show: true,
                position: 'right',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 9,
                formatter: p => fmtCurrency(p.value)
            }
        }],
    } : null;

    // Daily Revenue Trend Option
    const prodRevenueTrendOption = planReport?.dailySummary?.length ? {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            ...TT,
            formatter: p => `<b>${p[0]?.name}</b><br/>` + p.map(i => `<span style="color:${i.color}">${i.seriesName}</span>: <b>${fmtCurrency(i.value)}</b>`).join('<br/>')
        },
        legend: { data: ['Potential Revenue', 'Realized Revenue'], textStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 11 }, right: 0 },
        grid: { left: 8, right: 8, top: 32, bottom: 0, containLabel: true },
        xAxis: {
            type: 'category',
            data: planReport.dailySummary.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
            axisTick: { show: false },
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10 }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => fmt(v) },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
        },
        series: [
            {
                name: 'Potential Revenue',
                type: 'line',
                smooth: true,
                data: planReport.dailySummary.map(d => d.revenue),
                lineStyle: { color: 'rgba(59, 130, 246, 0.45)', width: 2, type: 'dashed' },
                symbol: 'circle',
                symbolSize: 4,
                itemStyle: { color: 'rgba(59, 130, 246, 0.6)' }
            },
            {
                name: 'Realized Revenue',
                type: 'line',
                smooth: true,
                data: planReport.dailySummary.map(d => d.completedRevenue),
                lineStyle: { color: 'rgba(16, 185, 129, 0.95)', width: 2 },
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: { color: 'rgba(16, 185, 129, 1)' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(16, 185, 129, 0.08)' },
                            { offset: 1, color: 'rgba(0,0,0,0)' }
                        ]
                    }
                }
            },
        ],
    } : null;

    const dailyMachineBarOption = reportData?.machines?.length ? {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            ...TT,
            formatter: p => `<b>${p[0]?.name}</b><br/>` + p.map(i => `<span style="color:${i.color}">${i.seriesName}</span>: <b>${formatMins(i.value)}</b>`).join('<br/>')
        },
        legend: { data: ['Est. Time', 'Act. Time'], textStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 11 }, right: 0 },
        grid: { left: 8, right: 8, top: 32, bottom: 0, containLabel: true },
        xAxis: {
            type: 'category',
            data: reportData.machines.map(m => m.name),
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
            axisTick: { show: false },
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, rotate: 15 }
        },
        yAxis: {
            type: 'value',
            axisLabel: { color: 'rgba(255,255,255,0.25)', fontSize: 10, formatter: v => formatMins(v) },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
        },
        series: [
            {
                name: 'Est. Time',
                type: 'bar',
                data: reportData.machines.map(m => (m.tasks || []).reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)),
                barMaxWidth: 16,
                itemStyle: { color: 'rgba(255,255,255,0.2)', borderRadius: [3, 3, 0, 0] }
            },
            {
                name: 'Act. Time',
                type: 'bar',
                data: reportData.machines.map(m => (m.tasks || []).reduce((sum, t) => sum + (t.actual_minutes || 0), 0)),
                barMaxWidth: 16,
                itemStyle: { color: 'rgba(255,255,255,0.8)', borderRadius: [3, 3, 0, 0] }
            },
        ],
    } : null;

    const getMachineShares = () => {
        if (!machines?.length) return [];
        return machines.map(m => {
            const p = machPerf[m.id]?.summary;
            return {
                name: m.name,
                value: p?.total_tasks || 0
            };
        }).filter(item => item.value > 0);
    };

    const machineSharesData = getMachineShares();
    const machinesSharePieOption = machineSharesData.length ? {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'item', ...TT, formatter: p => `<b>${p.name}</b>: ${p.value} tasks (${p.percent}%)` },
        legend: { orient: 'horizontal', bottom: 0, left: 'center', textStyle: { color: 'rgba(255,255,255,0.3)', fontSize: 9 } },
        series: [{
            type: 'pie',
            radius: ['35%', '50%'],
            center: ['50%', '35%'],
            avoidLabelOverlap: true,
            label: { show: false },
            emphasis: { label: { show: false } },
            data: machineSharesData.map((item, idx) => ({
                name: item.name,
                value: item.value,
                itemStyle: { color: PALETTE[idx % PALETTE.length] }
            }))
        }],
    } : null;

    // ── Divider label ──────────────────────────────────────────────────────────
    const Divider = ({ label }) => (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.05]" />
            <span className="text-[11px] font-semibold text-white/25 uppercase tracking-widest px-2">{label}</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
        </div>
    );

    // Compute timeline elements if selectedTaskDetail is loaded
    const timelineElements = [];
    if (selectedTaskDetail && selectedTaskDetail.logs) {
        selectedTaskDetail.logs.forEach((log, idx) => {
            timelineElements.push({
                type: 'work',
                log,
                started_at: log.started_at,
                stopped_at: log.stopped_at,
                employee_name: log.employee_name,
                duration_seconds: log.duration_seconds
            });

            if (idx < selectedTaskDetail.logs.length - 1) {
                const nextLog = selectedTaskDetail.logs[idx + 1];
                if (log.stopped_at && nextLog.started_at) {
                    const pauseStart = new Date(log.stopped_at);
                    const pauseEnd = new Date(nextLog.started_at);
                    const pauseMs = pauseEnd.getTime() - pauseStart.getTime();
                    if (pauseMs > 30000) { // greater than 30 seconds
                        const pauseMins = Math.round(pauseMs / 60000);
                        timelineElements.push({
                            type: 'pause',
                            started_at: log.stopped_at,
                            stopped_at: nextLog.started_at,
                            duration_minutes: pauseMins
                        });
                    }
                }
            }
        });
    }

    return (
        <div className={`space-y-6 mx-auto analytics-zoom analytics-container-${fontSize}`}>
            <style dangerouslySetInnerHTML={{
                __html: `
                .analytics-container-sm {
                    --font-scale: 0.9;
                }
                .analytics-container-md {
                    --font-scale: 1.0;
                }
                .analytics-container-lg {
                    --font-scale: 1.15;
                }
                .analytics-container-xl {
                    --font-scale: 1.35;
                }
                
                .analytics-zoom .text-\\[9px\\] { font-size: calc(9px * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-\\[10px\\] { font-size: calc(10px * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-\\[10\\.5px\\] { font-size: calc(10.5px * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-\\[11px\\] { font-size: calc(11px * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-xs { font-size: calc(0.75rem * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-sm { font-size: calc(0.875rem * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-base { font-size: calc(1rem * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-lg { font-size: calc(1.125rem * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-xl { font-size: calc(1.25rem * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-2xl { font-size: calc(1.5rem * var(--font-scale)) !important; line-height: normal !important; }
                .analytics-zoom .text-3xl { font-size: calc(1.875rem * var(--font-scale)) !important; line-height: normal !important; }
            `}} />
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <p className="text-white/25 text-sm mb-1">Reports</p>
                    <h1 className="text-3xl font-bold tracking-tighter text-white flex items-center gap-3">
                        <FiBarChart2 className="w-7 h-7 text-white/40" /> Analytics
                    </h1>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                    {/* Font Size Selector */}
                    <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 shrink-0">
                        <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider px-2 select-none">Font Size</span>
                        {[
                            { id: 'sm', label: 'A-', title: 'Small Text' },
                            { id: 'md', label: 'A', title: 'Normal Text' },
                            { id: 'lg', label: 'A+', title: 'Large Text' },
                            { id: 'xl', label: 'A++', title: 'Extra Large Text' }
                        ].map(sz => (
                            <button
                                key={sz.id}
                                onClick={() => adjustFontSize(sz.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${fontSize === sz.id
                                    ? 'bg-white/[0.08] text-white border border-white/[0.10]'
                                    : 'text-white/35 hover:text-white/60 border border-transparent'
                                    }`}
                                title={sz.title}
                            >
                                {sz.label}
                            </button>
                        ))}
                    </div>

                    <button onClick={load} disabled={loading} className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/15 text-white/35 hover:text-white/70 text-xs font-semibold px-4 py-2 rounded-xl transition-all disabled:opacity-30 cursor-pointer w-fit">
                        <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══ TAB: OVERVIEW ══════════════════════════════════════════════════════════ */}
            {tab === 'overview' && (<>
                <Divider label="Key Performance Indicators" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {loading ? Array(8).fill(0).map((_, i) => (
                        <div key={i} className="bg-black/40 border border-white/[0.07] rounded-2xl p-5 space-y-3"><Skel h="h-2.5" w="w-20" /><Skel h="h-7" w="w-28" /></div>
                    )) : stats ? (<>
                        <KpiCard icon={FiDollarSign} label="Total Revenue" value={fmtCurrency(stats.kpi.totalRevenue)} sub="All-time invoiced" href="/dashboard/invoices" />
                        <KpiCard icon={FiTrendingUp} label="Collected This Month" value={fmtCurrency(stats.kpi.collectedThisMonth)} sub="Payments received" href="/dashboard/invoices" />
                        <KpiCard icon={FiClock} label="Outstanding" value={fmtCurrency(stats.kpi.outstanding)} sub="Awaiting payment" href="/dashboard/invoices?status=sent" />
                        <KpiCard icon={FiAlertTriangle} label="Overdue" value={fmtCurrency(stats.kpi.overdue)} sub="Past due date" href="/dashboard/invoices?status=overdue" danger={stats.kpi.overdue > 0} />
                        <KpiCard icon={FiFileText} label="Quotations" value={fmt(stats.kpi.totalQuotations)} sub={`${stats.kpi.acceptedQuotations} accepted`} href="/dashboard/quotations" />
                        <KpiCard icon={FiShoppingCart} label="Sales Orders" value={fmt(stats.kpi.totalSalesOrders)} sub="All time" href="/dashboard/sales-orders" />
                        <KpiCard icon={FiUsers} label="Customers" value={fmt(stats.kpi.totalCustomers)} sub={`+${stats.kpi.newCustomers} this month`} href="/dashboard/customers" />
                        <KpiCard icon={FiPackage} label="Inventory Items" value={fmt(stats.kpi.totalItems)} sub={stats.kpi.lowStockCount > 0 ? `${stats.kpi.lowStockCount} low stock` : 'All in stock'} href="/dashboard/inventory" danger={stats.kpi.lowStockCount > 0} />
                    </>) : null}
                </div>

                <Divider label="Revenue" />
                <SectionCard title="Revenue — Last 6 Months" href="/dashboard/invoices" hrefLabel="All invoices">
                    <div className="p-4">
                        {loading ? <Skel h="h-52" /> : revenueOption ? <ReactECharts option={revenueOption} style={{ height: 220 }} /> : <p className="text-center text-white/20 py-14 text-sm">No revenue data yet.</p>}
                    </div>
                </SectionCard>

                <div className="grid lg:grid-cols-2 gap-4">
                    <SectionCard title="Invoices by Status">
                        <div className="p-4">{loading ? <Skel h="h-44" /> : invPie ? <ReactECharts option={invPie} style={{ height: 180 }} /> : <p className="text-center text-white/20 py-10 text-sm">No data.</p>}</div>
                    </SectionCard>
                    <SectionCard title="Quotations by Status">
                        <div className="p-4">{loading ? <Skel h="h-44" /> : quotPie ? <ReactECharts option={quotPie} style={{ height: 180 }} /> : <p className="text-center text-white/20 py-10 text-sm">No data.</p>}</div>
                    </SectionCard>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                    <SectionCard title="Top Customers by Revenue" href="/dashboard/customers">
                        <div className="p-4">{loading ? <Skel h="h-52" /> : topCustOption ? <ReactECharts option={topCustOption} style={{ height: 200 }} /> : <p className="text-center text-white/20 py-10 text-sm">No data.</p>}</div>
                    </SectionCard>
                    <SectionCard title="Recent Invoices" href="/dashboard/invoices">
                        {loading ? <div className="p-4 space-y-3">{Array(4).fill(0).map((_, i) => <Skel key={i} h="h-11" />)}</div>
                            : stats?.recentInvoices?.length ? (
                                <div className="divide-y divide-white/[0.04]">
                                    {stats.recentInvoices.map((inv, i) => (
                                        <div key={i} className="flex items-center justify-between px-5 py-3.5 gap-3 hover:bg-white/[0.02] transition-colors">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">{inv.customer_name}</p>
                                                <p className="text-xs text-white/25 font-mono">{inv.code} · {timeAgo(inv.created_at)}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-semibold text-white font-mono">{fmtCurrency(inv.amount_due)}</p>
                                                <span className="inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-white/[0.04] text-white/40 border-white/[0.08]">{inv.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-white/20 py-10 text-sm">No invoices yet.</p>}
                    </SectionCard>
                </div>
            </>)}

            {/* ══ TAB: FINANCE & PROFIT ══════════════════════════════════════════════════ */}
            {tab === 'finance' && (<>
                <Divider label="Profit KPIs — Converted Quotations" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {loading ? Array(4).fill(0).map((_, i) => (
                        <div key={i} className="bg-black/40 border border-white/[0.07] rounded-2xl p-5 space-y-3"><Skel h="h-2.5" w="w-20" /><Skel h="h-7" w="w-28" /></div>
                    )) : stats?.profitKpi ? (<>
                        <KpiCard icon={FiDollarSign} label="Production Cost" value={fmtCurrency(stats.profitKpi.totalCost)} sub={`${stats.profitRows?.length ?? 0} converted jobs`} />
                        <KpiCard icon={FiShoppingCart} label="Billed (ex-tax)" value={fmtCurrency(stats.profitKpi.totalBilled)} sub="Before tax" />
                        <KpiCard icon={FiTrendingUp} label="Markup Profit" value={fmtCurrency(stats.profitKpi.totalProfit)} sub="Billed − production cost" />
                        <KpiCard icon={FiFileText} label="Avg Profit Margin" value={`${stats.profitKpi.avgMarginPct}%`} sub="On cost basis" />
                    </>) : null}
                </div>

                <Divider label="Trends" />
                <SectionCard title="Monthly Profit Trend" sub="Cost vs markup profit (stacked) + billed line — last 6 months">
                    <div className="p-4">{loading ? <Skel h="h-64" /> : profitTrendOption ? <ReactECharts option={profitTrendOption} style={{ height: 280 }} /> : <p className="text-center text-white/20 py-16 text-sm">No data in last 6 months.</p>}</div>
                </SectionCard>

                <div className="grid lg:grid-cols-2 gap-4">
                    <SectionCard title="Customer Profitability" sub="Markup profit per customer (top 8)">
                        <div className="p-4">{loading ? <Skel h="h-52" /> : custProfitOption ? <ReactECharts option={custProfitOption} style={{ height: 220 }} /> : <p className="text-center text-white/20 py-12 text-sm">No data.</p>}</div>
                    </SectionCard>
                    <SectionCard title="Cost vs Margin Scatter" sub="Each dot = one converted quotation">
                        <div className="p-4">{loading ? <Skel h="h-52" /> : scatterOption ? <ReactECharts option={scatterOption} style={{ height: 220 }} /> : <p className="text-center text-white/20 py-12 text-sm">No data.</p>}</div>
                    </SectionCard>
                </div>

                <Divider label="Quotation Breakdown" />
                <SectionCard title="Quotation Profit Breakdown" sub="Only quotations converted to a sales order" href="/dashboard/quotations" hrefLabel="All quotations">
                    {loading ? <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <Skel key={i} h="h-12" />)}</div>
                        : stats?.profitRows?.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                                            {['Quotation', 'Customer', 'Date', 'Production Cost', 'Billed (ex-tax)', 'Markup Profit', 'Markup %', 'Margin'].map(h => (
                                                <th key={h} className={`px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider ${h === 'Quotation' || h === 'Customer' ? 'text-left' : 'text-right'} ${h === 'Margin' ? 'text-left' : ''}`}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {stats.profitRows.map(row => {
                                            const maxP = Math.max(...stats.profitRows.map(r => r.markup_profit));
                                            const bar = maxP > 0 ? (row.markup_profit / maxP) * 100 : 0;
                                            return (
                                                <tr key={row.quotation_id} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-4 py-3.5"><Link href={`/dashboard/quotations/${row.quotation_id}`} className="font-mono text-xs font-semibold text-white/60 hover:text-white">{row.quotation_code}</Link></td>
                                                    <td className="px-4 py-3.5 text-sm text-white font-medium">{row.customer_name}</td>
                                                    <td className="px-4 py-3.5 text-xs text-white/30 text-right">{timeAgo(row.created_at)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono text-sm text-white/55">{fmtCurrency(row.total_cost)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold text-white">{fmtCurrency(row.total_billed_ex_tax)}</td>
                                                    <td className="px-4 py-3.5 text-right"><span className={`font-mono font-bold text-sm ${row.markup_profit > 0 ? 'text-white' : 'text-red-400'}`}>{fmtCurrency(row.markup_profit)}</span></td>
                                                    <td className="px-4 py-3.5 text-right font-mono text-sm text-white/50">{row.avg_markup_pct}%</td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden min-w-[60px]">
                                                                <div className="h-full bg-white/40 rounded-full" style={{ width: `${bar}%` }} />
                                                            </div>
                                                            <span className="text-[11px] text-white/35 font-mono w-10 text-right shrink-0">{row.margin_pct}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                                            <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-white/35 uppercase tracking-wider">Total / Average</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-white/55">{fmtCurrency(stats.profitKpi.totalCost)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-white">{fmtCurrency(stats.profitKpi.totalBilled)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm font-bold text-white">{fmtCurrency(stats.profitKpi.totalProfit)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm text-white/35">—</td>
                                            <td className="px-4 py-3"><span className="text-[11px] font-bold text-white/45 font-mono">{stats.profitKpi.avgMarginPct}% avg</span></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <FiBarChart2 className="w-8 h-8 text-white/10" />
                                <p className="text-white/25 text-sm">No converted quotations yet.</p>
                            </div>
                        )}
                </SectionCard>
            </>)}


            {/* ══ TAB: PRODUCTION ════════════════════════════════════════════════════════ */}
            {tab === 'production' && (<>
                {/* Sub-tabs for Production Section */}
                <div className="flex gap-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-1 w-fit mb-6">
                    <button
                        onClick={() => setProdTab('analytics')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${prodTab === 'analytics' ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}
                    >
                        Production Analytics
                    </button>
                    <button
                        onClick={() => setProdTab('reports')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${prodTab === 'reports' ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}
                    >
                        Daily Production Reports
                    </button>
                    <button
                        onClick={() => setProdTab('performance')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${prodTab === 'performance' ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}
                    >
                        Machine Performance Overview
                    </button>
                    <button
                        onClick={() => setProdTab('employee-performance')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${prodTab === 'employee-performance' ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}
                    >
                        Employee Performance Report
                    </button>
                    <button
                        onClick={() => setProdTab('task-details')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${prodTab === 'task-details' ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}
                    >
                        Detailed Task Explorer
                    </button>
                </div>

                {prodTab === 'reports' && (
                    <SectionCard title="Daily Production Reports" sub="View machine schedule execution times and download printable reports">
                        <div className="p-5 space-y-6">
                            {/* Date Selector & PDF Action */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Select Date:</span>
                                    <input
                                        type="date"
                                        value={reportDate}
                                        onChange={e => setReportDate(e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-white/30"
                                    />
                                </div>
                                <button
                                    onClick={() => window.open(`/api/production-reports/pdf?date=${reportDate}`, '_blank')}
                                    className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer shadow-lg"
                                >
                                    <FiDownload className="w-4 h-4" /> Download PDF Report
                                </button>
                            </div>

                            {reportLoading ? (
                                <div className="py-16 text-center text-white/35 animate-pulse flex flex-col items-center justify-center gap-2">
                                    <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                                    <p className="text-xs">Loading production report...</p>
                                </div>
                            ) : reportData ? (
                                <div className="space-y-6">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Tasks Scheduled', value: reportData.stats.totalTasks, sub: 'Assigned to machines' },
                                            { label: 'Completion Rate', value: `${reportData.stats.totalTasks > 0 ? Math.round((reportData.stats.completedTasks / reportData.stats.totalTasks) * 100) : 0}%`, sub: `${reportData.stats.completedTasks} of ${reportData.stats.totalTasks} done` },
                                            { label: 'Total Est. Time', value: formatMins(reportData.stats.totalEstimatedMinutes), sub: 'Plan duration' },
                                            { label: 'Total Act. Time', value: formatMins(reportData.stats.totalActualMinutes), sub: 'Completed task time' },
                                        ].map(s => (
                                            <div key={s.label} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">{s.label}</p>
                                                <p className="text-xl font-bold text-white tracking-tight">{s.value}</p>
                                                <p className="text-[10px] text-white/30 mt-0.5">{s.sub}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Daily Machine Comparison Bar Chart */}
                                    {dailyMachineBarOption && (
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-3">Machine Workload Comparison (Est. vs Act. Time)</p>
                                            <ReactECharts option={dailyMachineBarOption} style={{ height: 180 }} />
                                        </div>
                                    )}

                                    {/* Machine Sections */}
                                    <div className="space-y-4">
                                        {reportData.machines.length === 0 ? (
                                            <div className="py-12 text-center text-white/20 text-xs border border-dashed border-white/10 rounded-2xl">
                                                No tasks were scheduled or run on any machine for this date.
                                            </div>
                                        ) : (
                                            reportData.machines.map(m => {
                                                const mTasks = m.tasks || [];
                                                const mEst = mTasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
                                                const mAct = mTasks.reduce((sum, t) => sum + (t.actual_minutes || 0), 0);

                                                return (
                                                    <div key={m.id} className="border border-white/[0.05] rounded-xl overflow-hidden bg-black/20">
                                                        {/* Machine Header Row */}
                                                        <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.04]">
                                                            <span className="text-xs font-bold text-white/80 uppercase tracking-wider">{m.name} ({m.type})</span>
                                                            <span className="text-[10px] text-white/40 font-medium">
                                                                {mTasks.length} tasks · Est: {formatMins(mEst)} · Act: {formatMins(mAct)}
                                                            </span>
                                                        </div>

                                                        {/* Machine Tasks Table */}
                                                        {mTasks.length === 0 ? (
                                                            <div className="p-4 text-center text-xs text-white/20 italic">
                                                                No tasks scheduled or run on this machine.
                                                            </div>
                                                        ) : (
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-left text-xs border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-white/[0.01] border-b border-white/[0.04] text-white/35 font-semibold">
                                                                            <th className="px-4 py-2">SO Code</th>
                                                                            <th className="px-4 py-2">Customer</th>
                                                                            <th className="px-4 py-2">Task Details</th>
                                                                            <th className="px-4 py-2 text-center">Status</th>
                                                                            <th className="px-4 py-2 text-right">Run Qty</th>
                                                                            <th className="px-4 py-2 text-right">Actual Output</th>
                                                                            <th className="px-4 py-2 text-right">Est. Time</th>
                                                                            <th className="px-4 py-2 text-right">Act. Time</th>
                                                                            <th className="px-4 py-2 text-right">Variance</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-white/[0.03]">
                                                                        {mTasks.map(t => {
                                                                            const parts = t.name.split('—');
                                                                            const cleanName = parts[parts.length - 1]?.trim() || t.name;
                                                                            const operationDetail = parts.length > 2 ? parts[1]?.trim() : '';
                                                                            const displayText = operationDetail ? `${cleanName} (${operationDetail})` : cleanName;

                                                                            const varVal = t.actual_minutes != null && t.estimated_minutes != null ? t.actual_minutes - t.estimated_minutes : null;
                                                                            const varColor = varVal == null ? 'text-white/30' : varVal > 0 ? 'text-red-400 font-bold' : varVal < 0 ? 'text-emerald-400 font-bold' : 'text-white/40';

                                                                            const statusCls = t.status === 'done'
                                                                                ? ' text-emerald-300 '
                                                                                : t.status === 'in_progress'
                                                                                    ? ' text-amber-300 '
                                                                                    : ' text-white/50 ';

                                                                            const runQty = t.run_quantity || t.quantity || t.sheet_count || 0;
                                                                            const actQty = t.actual_sheets_printed != null ? parseFloat(t.actual_sheets_printed) : null;
                                                                            const wasteQty = t.actual_sheets_wasted != null ? parseFloat(t.actual_sheets_wasted) : 0;

                                                                            return (
                                                                                <tr
                                                                                    key={t.id}
                                                                                    onClick={() => openTaskModal(t.id)}
                                                                                    className="hover:bg-white/[0.05] transition-colors cursor-pointer group"
                                                                                    title="Click to view detailed task specs & work logs"
                                                                                >
                                                                                    <td className="px-4 py-2.5 font-mono text-blue-400 font-semibold">{t.order_code || '—'}</td>
                                                                                    <td className="px-4 py-2.5 text-white/70 max-w-[120px] truncate">{t.customer_name || '—'}</td>
                                                                                    <td className="px-4 py-2.5 text-white font-medium">
                                                                                        {displayText}
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-center">
                                                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${statusCls}`}>
                                                                                            {t.status}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-right font-mono text-white/50 font-bold">
                                                                                        {runQty ? Number(runQty).toLocaleString() : '—'}
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-right font-mono text-white/70 font-bold">
                                                                                        {actQty != null ? (
                                                                                            <>
                                                                                                {actQty.toLocaleString()}
                                                                                                {wasteQty > 0 && <span className="text-red-400 font-normal text-[10px] block">({wasteQty.toLocaleString()} waste)</span>}
                                                                                            </>
                                                                                        ) : '—'}
                                                                                    </td>
                                                                                    <td className="px-4 py-2.5 text-right text-white/50 font-mono">{formatMins(t.estimated_minutes)}</td>
                                                                                    <td className="px-4 py-2.5 text-right text-white/70 font-mono">{formatMins(t.actual_minutes)}</td>
                                                                                    <td className={`px-4 py-2.5 text-right font-mono ${varColor}`}>{formatVar(t.estimated_minutes, t.actual_minutes)}</td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-16 text-center text-white/20 text-xs">
                                    No report data.
                                </div>
                            )}
                        </div>
                    </SectionCard>
                )}

                {prodTab === 'analytics' && (
                    <SectionCard
                        title="Production Analytics"
                        sub="Generate production and planning reports, track unplanned and uncompleted tasks, and view daily progress reports"
                    >
                        <div className="p-5 space-y-6">
                            {/* Selector Controls */}
                            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Resource:</span>
                                        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
                                            <button
                                                onClick={() => handleResTypeChange('machine')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${resType === 'machine' ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}
                                            >
                                                <FiCpu className="w-3.5 h-3.5" /> Machines
                                            </button>
                                            <button
                                                onClick={() => handleResTypeChange('finishing')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${resType === 'finishing' ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}
                                            >
                                                <FiLayers className="w-3.5 h-3.5" /> Finishings
                                            </button>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Type to filter..."
                                                value={resSearchQuery}
                                                onFocus={() => {
                                                    setResDropdownOpen(true);
                                                    setResSearchQuery('');
                                                }}
                                                onChange={e => setResSearchQuery(e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-white/30 cursor-pointer min-w-[200px]"
                                            />

                                            {resDropdownOpen && (
                                                <>
                                                    {/* Click outside overlay */}
                                                    <div className="fixed inset-0 z-20" onClick={() => {
                                                        setResDropdownOpen(false);
                                                        const currentRes = activeResList.find(r => r.id.toString() === selectedResId.toString());
                                                        setResSearchQuery(currentRes ? currentRes.name : '');
                                                    }} />

                                                    {/* Dropdown list */}
                                                    <div className="absolute left-0 mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-white/10 rounded-xl shadow-xl z-30 divide-y divide-white/[0.04] min-w-[200px] w-full">
                                                        {filteredResList.length === 0 ? (
                                                            <div className="px-3.5 py-2.5 text-xs text-white/40 italic">
                                                                No matches found
                                                            </div>
                                                        ) : (
                                                            filteredResList.map(item => (
                                                                <button
                                                                    key={item.id}
                                                                    onClick={() => {
                                                                        setSelectedResId(item.id.toString());
                                                                        setResSearchQuery(item.name);
                                                                        setResDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors hover:bg-white/[0.05] ${item.id.toString() === selectedResId.toString() ? 'text-white font-bold bg-white/[0.03]' : 'text-white/70'}`}
                                                                >
                                                                    {item.name}
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Duration Selector */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Duration:</span>
                                            <select
                                                value={planDurationType}
                                                onChange={e => setPlanDurationType(e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-white/30 cursor-pointer min-w-[140px]"
                                            >
                                                <option value="last_7_days" className="bg-neutral-900 text-white">Last 7 Days</option>
                                                <option value="last_30_days" className="bg-neutral-900 text-white">Last 30 Days</option>
                                                <option value="this_month" className="bg-neutral-900 text-white">This Month</option>
                                                <option value="last_month" className="bg-neutral-900 text-white">Last Month</option>
                                                <option value="custom" className="bg-neutral-900 text-white">Custom Range</option>
                                                <option value="all_time" className="bg-neutral-900 text-white">All Time</option>
                                            </select>
                                        </div>

                                        {planDurationType === 'custom' && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={planCustomStart}
                                                    onChange={e => setPlanCustomStart(e.target.value)}
                                                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-white/30"
                                                />
                                                <span className="text-white/40 text-xs">—</span>
                                                <input
                                                    type="date"
                                                    value={planCustomEnd}
                                                    onChange={e => setPlanCustomEnd(e.target.value)}
                                                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-white/30"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {planReport && (
                                    <button
                                        onClick={() => window.open(`/api/job-planning/${resType}/${selectedResId}/pdf`, '_blank')}
                                        className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer shadow-lg"
                                    >
                                        <FiDownload className="w-4 h-4" /> Download PDF Schedule
                                    </button>
                                )}
                            </div>

                            {planLoading ? (
                                <div className="py-20 text-center text-white/35 animate-pulse flex flex-col items-center justify-center gap-2">
                                    <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
                                    <p className="text-xs">Generating analytics report...</p>
                                </div>
                            ) : planReport ? (
                                <div className="space-y-6">
                                    {/* Active Period Display */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-white/50 bg-white/[0.01] border border-white/[0.03] px-4 py-2.5 rounded-xl">
                                        <span className="flex items-center gap-2">
                                            <FiClock className="w-3.5 h-3.5 text-blue-400" />
                                            {(() => {
                                                const { startDate, endDate } = getPlanDateRange(planDurationType, planCustomStart, planCustomEnd);
                                                if (startDate && endDate) {
                                                    try {
                                                        const startD = new Date(startDate + 'T00:00:00');
                                                        const endD = new Date(endDate + 'T00:00:00');
                                                        const startFormatted = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                                        const endFormatted = endD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                                        return `Report Period: ${startFormatted} – ${endFormatted}`;
                                                    } catch (e) {
                                                        return `Report Period: ${startDate} – ${endDate}`;
                                                    }
                                                }
                                                return 'Report Period: All-Time Data';
                                            })()}
                                        </span>
                                        <span>
                                            Showing data for <strong>{planReport.name}</strong>
                                        </span>
                                    </div>
                                    {/* Report KPI Metrics Cards */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Total Run Quantity</p>
                                            <p className="text-xl font-bold text-white tracking-tight">{fmt(planReport.stats.totalRunQty)}</p>
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                Planned: {fmt(planReport.stats.plannedRunQty)} | Completed: {fmt(planReport.stats.completedRunQty)}
                                            </p>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Unplanned Production</p>
                                            <p className="text-xl font-bold text-amber-400 tracking-tight">{fmt(planReport.stats.unplannedRunQty)}</p>
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                Unplanned Time: {formatMins(planReport.stats.unplannedDuration)}
                                            </p>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Uncompleted Production</p>
                                            <p className="text-xl font-bold text-red-400 tracking-tight">{fmt(planReport.stats.uncompletedRunQty)}</p>
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                Remaining Time: {formatMins(planReport.stats.uncompletedDuration)}
                                            </p>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Duration & Completion</p>
                                            <p className="text-xl font-bold text-white tracking-tight">
                                                {planReport.stats.completedTasks} / {planReport.stats.totalTasks} Done
                                            </p>
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                Est: {formatMins(planReport.stats.totalEstMinutes)} | Act: {formatMins(planReport.stats.totalActMinutes)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Report Revenue KPI Metrics Cards */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Total Potential Revenue</p>
                                            <p className="text-xl font-bold text-blue-400 tracking-tight">{fmtCurrency(planReport.stats.totalRevenue)}</p>
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                Estimated revenue of all jobs
                                            </p>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Realized Revenue</p>
                                            <p className="text-xl font-bold text-emerald-400 tracking-tight">{fmtCurrency(planReport.stats.completedRevenue)}</p>
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                Revenue from completed tasks
                                            </p>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Pending Revenue</p>
                                            <p className="text-xl font-bold text-amber-400 tracking-tight">{fmtCurrency(planReport.stats.pendingRevenue)}</p>
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                Revenue from remaining tasks
                                            </p>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1.5">Average Revenue / Job</p>
                                            <p className="text-xl font-bold text-white tracking-tight">
                                                {fmtCurrency(planReport.tasks.length ? Math.round(planReport.stats.totalRevenue / planReport.tasks.length) : 0)}
                                            </p>
                                            <p className="text-[10px] text-white/30 mt-0.5">
                                                Across {planReport.tasks.length} total tasks
                                            </p>
                                        </div>
                                    </div>

                                    {/* Production Analytics Charts */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                        {/* Daily Production Time Trend */}
                                        <div className="lg:col-span-2 bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-3">Daily Time Trend (Est. vs Act. Time)</p>
                                            {prodTimeTrendOption ? (
                                                <ReactECharts option={prodTimeTrendOption} style={{ height: 200 }} />
                                            ) : (
                                                <div className="h-[200px] flex items-center justify-center text-white/20 text-xs">
                                                    No daily scheduled time data available.
                                                </div>
                                            )}
                                        </div>

                                        {/* Task Status Distribution */}
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-3">Task Status Distribution</p>
                                            {prodStatusPie ? (
                                                <ReactECharts option={prodStatusPie} style={{ height: 200 }} />
                                            ) : (
                                                <div className="h-[200px] flex items-center justify-center text-white/20 text-xs">
                                                    No status data available.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Production Financial / Revenue Charts */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                        {/* Job-wise Revenue or Rate Horizontal Bar Chart */}
                                        <div className="lg:col-span-2 bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col justify-between">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider">
                                                    {prodRevenueChartMetric === 'revenue'
                                                        ? 'Job-wise Revenue Distribution (Top 10)'
                                                        : `Job-wise Rate Comparison (Top 10)`}
                                                </p>
                                                <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/[0.05]">
                                                    <button
                                                        onClick={() => setProdRevenueChartMetric('revenue')}
                                                        className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${prodRevenueChartMetric === 'revenue'
                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                            : 'text-white/40 hover:text-white/70 border border-transparent'
                                                            }`}
                                                    >
                                                        Revenue
                                                    </button>
                                                    <button
                                                        onClick={() => setProdRevenueChartMetric('rate')}
                                                        className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${prodRevenueChartMetric === 'rate'
                                                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                            : 'text-white/40 hover:text-white/70 border border-transparent'
                                                            }`}
                                                    >
                                                        Rate
                                                    </button>
                                                </div>
                                            </div>
                                            {prodRevenueChartMetric === 'revenue' ? (
                                                prodRevenueBarOption ? (
                                                    <ReactECharts option={prodRevenueBarOption} style={{ height: 220 }} />
                                                ) : (
                                                    <div className="h-[220px] flex items-center justify-center text-white/20 text-xs">
                                                        No revenue data available.
                                                    </div>
                                                )
                                            ) : (
                                                prodRateBarOption ? (
                                                    <ReactECharts option={prodRateBarOption} style={{ height: 220 }} />
                                                ) : (
                                                    <div className="h-[220px] flex items-center justify-center text-white/20 text-xs">
                                                        No rate data available.
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        {/* Top Revenue Jobs List */}
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex flex-col justify-between">
                                            <div>
                                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-3.5">Top Jobs by Revenue</p>
                                                <div className="space-y-2">
                                                    {planReport.tasks
                                                        .filter(t => (t.revenue || 0) > 0)
                                                        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                                                        .slice(0, 4)
                                                        .map((t, idx) => {
                                                            const parts = t.name.split(' — ');
                                                            const cleanName = parts.length >= 3 ? parts[1] : (parts[0] || 'Job');
                                                            return (
                                                                <div key={t.id || idx} className="flex items-center justify-between bg-white/[0.01] border border-white/[0.03] rounded-lg p-2 text-xs">
                                                                    <div className="min-w-0">
                                                                        <p className="font-semibold text-white truncate max-w-[120px]">{t.order_code || 'Unassigned'}</p>
                                                                        <p className="text-[10px] text-white/40 truncate max-w-[120px]">{t.customer_name || '—'}</p>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="font-bold text-emerald-400">{fmtCurrency(t.revenue)}</p>
                                                                        <p className="text-[9px] text-white/30">{t.is_finishing ? 'Finishing' : 'Print'}</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    {planReport.tasks.filter(t => (t.revenue || 0) > 0).length === 0 && (
                                                        <div className="h-[120px] flex items-center justify-center text-white/20 text-xs italic">
                                                            No revenue generating tasks.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Daily Revenue Trend Chart */}
                                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-3">Daily Revenue Trend (Potential vs Realized)</p>
                                        {prodRevenueTrendOption ? (
                                            <ReactECharts option={prodRevenueTrendOption} style={{ height: 200 }} />
                                        ) : (
                                            <div className="h-[200px] flex items-center justify-center text-white/20 text-xs">
                                                No daily scheduled revenue data available.
                                            </div>
                                        )}
                                    </div>

                                    {/* Daily Production Progress Report */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider">Daily Production Progress Report</h4>
                                        </div>
                                        {planReport.dailySummary.length === 0 ? (
                                            <div className="py-8 text-center text-white/25 text-xs border border-dashed border-white/10 rounded-xl">
                                                No daily schedules are configured for this resource. All tasks are unplanned.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto border border-white/[0.05] rounded-xl bg-black/20">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead>
                                                        <tr className="bg-white/[0.02] border-b border-white/[0.05] text-white/35 font-semibold">
                                                            <th className="px-4 py-3">Scheduled Date</th>
                                                            <th className="px-4 py-3 text-center">Progress</th>
                                                            <th className="px-4 py-3 text-center">Tasks Count</th>
                                                            <th className="px-4 py-3 text-right">Scheduled Run Qty</th>
                                                            <th className="px-4 py-3 text-right">Completed Run Qty</th>
                                                            <th className="px-4 py-3 text-right">Est. Time</th>
                                                            <th className="px-4 py-3 text-right">Act. Time</th>
                                                            <th className="px-4 py-3 text-right">Variance</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/[0.03]">
                                                        {planReport.dailySummary.map(d => {
                                                            const dVar = d.estMinutes - d.actMinutes;
                                                            const varColor = dVar > 0 ? 'text-red-400 font-bold' : dVar < 0 ? 'text-emerald-400 font-bold' : 'text-white/40';
                                                            const progressPct = d.totalTasks > 0 ? Math.round((d.completedTasks / d.totalTasks) * 100) : 0;
                                                            return (
                                                                <tr key={d.date} className="hover:bg-white/[0.01] transition-colors">
                                                                    <td className="px-4 py-3 font-semibold text-white">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2 max-w-[120px] mx-auto">
                                                                            <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden min-w-[60px]">
                                                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progressPct}%` }} />
                                                                            </div>
                                                                            <span className="text-[10px] text-white/50 font-mono w-8 text-right shrink-0">{progressPct}%</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center text-white/70">{d.completedTasks} / {d.totalTasks}</td>
                                                                    <td className="px-4 py-3 text-right font-mono text-white/70">{fmt(d.runQty)}</td>
                                                                    <td className="px-4 py-3 text-right font-mono text-emerald-400">{fmt(d.completedRunQty)}</td>
                                                                    <td className="px-4 py-3 text-right font-mono text-white/50">{formatMins(d.estMinutes)}</td>
                                                                    <td className="px-4 py-3 text-right font-mono text-white/70">{formatMins(d.actMinutes)}</td>
                                                                    <td className={`px-4 py-3 text-right font-mono ${varColor}`}>{formatVar(d.estMinutes, d.actMinutes)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Detailed Task List */}
                                    <div className="space-y-3 pt-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider">Detailed Task Planning List</h4>
                                            <div className="relative w-full sm:w-64">
                                                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 w-3.5 h-3.5" />
                                                <input
                                                    type="text"
                                                    placeholder="Search tasks..."
                                                    value={planSearch}
                                                    onChange={e => setPlanSearch(e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white outline-none focus:border-white/30"
                                                />
                                            </div>
                                        </div>
                                        {(() => {
                                            const filteredTasks = planReport.tasks.filter(t => {
                                                const term = planSearch.toLowerCase();
                                                return (
                                                    (t.order_code || '').toLowerCase().includes(term) ||
                                                    (t.customer_name || '').toLowerCase().includes(term) ||
                                                    (t.name || '').toLowerCase().includes(term)
                                                );
                                            });

                                            if (filteredTasks.length === 0) {
                                                return (
                                                    <div className="py-12 text-center text-white/20 text-xs border border-dashed border-white/10 rounded-xl">
                                                        No planning tasks match the search query.
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="overflow-x-auto border border-white/[0.05] rounded-xl bg-black/20 max-h-96 overflow-y-auto">
                                                    <table className="w-full text-left text-xs border-collapse">
                                                        <thead className='bg-black/30 backdrop-blur-xl'>
                                                            <tr className="bg-black/30 border-b border-white/[0.05] text-white/35 font-semibold sticky top-0 backdrop-blur-xl z-10">
                                                                <th className="px-4 py-2.5">SO Code</th>
                                                                <th className="px-4 py-2.5">Customer</th>
                                                                <th className="px-4 py-2.5">Task Description</th>
                                                                <th className="px-4 py-2.5 text-right">Run Qty / Imps</th>
                                                                <th className="px-4 py-2.5 text-center">Status</th>
                                                                <th className="px-4 py-2.5">Scheduled Date</th>
                                                                <th className="px-4 py-2.5 text-right font-mono">Rate</th>
                                                                <th className="px-4 py-2.5 text-right font-mono">Revenue</th>
                                                                <th className="px-4 py-2.5 text-right">Est. Time</th>
                                                                <th className="px-4 py-2.5 text-right">Act. Time</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/[0.03]">
                                                            {filteredTasks.map(t => {
                                                                const parts = t.name.split('—');
                                                                const cleanName = parts[parts.length - 1]?.trim() || t.name;
                                                                const operationDetail = parts.length > 2 ? parts[1]?.trim() : '';
                                                                const displayText = operationDetail ? `${cleanName} (${operationDetail})` : cleanName;

                                                                const statusCls = t.status === 'done'
                                                                    ? ' text-emerald-300'
                                                                    : t.status === 'in_progress'
                                                                        ? ' text-amber-300 '
                                                                        : ' text-white/50 ';

                                                                const qtyDisplay = t.is_finishing
                                                                    ? `${fmt(t.quantity || t.finishing_qty)} ${t.rate_unit || 'Units'}`
                                                                    : `${fmt(t.printed_sheets || t.quantity)} Imps`;

                                                                return (
                                                                    <tr
                                                                        key={t.id}
                                                                        onClick={() => openTaskModal(t.id)}
                                                                        className="hover:bg-white/[0.05] transition-colors cursor-pointer group"
                                                                        title="Click to view detailed task specs & work logs"
                                                                    >
                                                                        <td className="px-4 py-2.5 font-mono text-blue-400 font-semibold">{t.order_code || '—'}</td>
                                                                        <td className="px-4 py-2.5 text-white/70 max-w-[120px] truncate">{t.customer_name || '—'}</td>
                                                                        <td className="px-4 py-2.5 text-white font-medium">{displayText}</td>
                                                                        <td className="px-4 py-2.5 text-right font-mono text-white/80">{qtyDisplay}</td>
                                                                        <td className="px-4 py-2.5 text-center">
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${statusCls}`}>
                                                                                {t.status}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-white/50">
                                                                            {t.scheduled_date ? new Date(t.scheduled_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : (
                                                                                <span className="text-amber-400/60 font-semibold">Unplanned</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-right text-white/50 font-mono">
                                                                            {t.rate ? (
                                                                                t.is_finishing ? (
                                                                                    `${fmtCurrency(t.rate)} / ${t.rate_unit || 'Unit'}`
                                                                                ) : (
                                                                                    `${fmtCurrency(t.rate)} / 1k Imps`
                                                                                )
                                                                            ) : '—'}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-right text-emerald-400 font-bold font-mono">
                                                                            {t.revenue ? fmtCurrency(t.revenue) : '—'}
                                                                        </td>
                                                                        <td className="px-4 py-2.5 text-right text-white/50 font-mono">{formatMins(t.estimated_minutes)}</td>
                                                                        <td className="px-4 py-2.5 text-right text-white/70 font-mono">{formatMins(t.actual_minutes)}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-12 text-center text-white/20 text-xs">
                                    Select a resource to view production planning analytics.
                                </div>
                            )}
                        </div>
                    </SectionCard>
                )}

                {prodTab === 'performance' && (
                    <SectionCard title="Machine Performance Overview" sub="Real-time completion progress, average run times, and monthly task outputs by machine">
                        <div className="p-5 space-y-6">
                            {/* Selector Controls */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Duration:</span>
                                        <select
                                            value={perfDurationType}
                                            onChange={e => setPerfDurationType(e.target.value)}
                                            className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-white/30 cursor-pointer min-w-[140px]"
                                        >
                                            <option value="last_7_days" className="bg-neutral-900 text-white">Last 7 Days</option>
                                            <option value="last_30_days" className="bg-neutral-900 text-white">Last 30 Days</option>
                                            <option value="this_month" className="bg-neutral-900 text-white">This Month</option>
                                            <option value="last_month" className="bg-neutral-900 text-white">Last Month</option>
                                            <option value="custom" className="bg-neutral-900 text-white">Custom Range</option>
                                            <option value="all_time" className="bg-neutral-900 text-white">All Time</option>
                                        </select>
                                    </div>

                                    {perfDurationType === 'custom' && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="date"
                                                value={perfCustomStart}
                                                onChange={e => setPerfCustomStart(e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-white/30"
                                            />
                                            <span className="text-white/40 text-xs">—</span>
                                            <input
                                                type="date"
                                                value={perfCustomEnd}
                                                onChange={e => setPerfCustomEnd(e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-white/30"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 text-xs text-white/50 bg-white/[0.01] border border-white/[0.03] px-4 py-2 rounded-xl self-start sm:self-center">
                                    <FiClock className="w-3.5 h-3.5 text-blue-400" />
                                    {(() => {
                                        const { startDate, endDate } = getPlanDateRange(perfDurationType, perfCustomStart, perfCustomEnd);
                                        if (startDate && endDate) {
                                            try {
                                                const startD = new Date(startDate + 'T00:00:00');
                                                const endD = new Date(endDate + 'T00:00:00');
                                                const startFormatted = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                                const endFormatted = endD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                                return `Performance Period: ${startFormatted} – ${endFormatted}`;
                                            } catch (e) {
                                                return `Performance Period: ${startDate} – ${endDate}`;
                                            }
                                        }
                                        return 'Performance Period: All-Time Data';
                                    })()}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {machLoading ? Array(4).fill(0).map((_, i) => (
                                            <div key={i} className="bg-black/40 border border-white/[0.07] rounded-2xl p-5 space-y-3"><Skel h="h-2.5" w="w-24" /><Skel h="h-6" w="w-16" /><Skel h="h-2" /></div>
                                        )) : machines.length === 0 ? (
                                            <p className="col-span-full text-white/20 text-sm text-center py-8">No machines found.</p>
                                        ) : machines.map(m => {
                                            const p = machPerf[m.id]?.summary;
                                            const pct2 = p?.total_tasks > 0 ? Math.round(p.completed / p.total_tasks * 100) : 0;
                                            const running = machPerf[m.id]?.currentTask != null;
                                            return (
                                                <button key={m.id} onClick={() => openPerf(m)}
                                                    className="group text-left bg-black/40 backdrop-blur-xl border border-white/[0.07] hover:border-white/[0.14] rounded-2xl p-5 transition-all hover:bg-white/[0.03] cursor-pointer">
                                                    <div className="flex items-start justify-between gap-2 mb-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                                                            <p className="text-[11px] text-white/30 capitalize mt-0.5">{m.type}</p>
                                                        </div>
                                                        <div className="shrink-0 flex items-center gap-1.5">
                                                            {running && <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />}
                                                            <FiBarChart2 className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                                                        </div>
                                                    </div>
                                                    {p ? (<>
                                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                                            <div><p className="text-[9px] font-bold text-white/20 uppercase tracking-wider">Completed</p><p className="text-lg font-bold text-white mt-0.5">{p.completed}</p></div>
                                                            <div><p className="text-[9px] font-bold text-white/20 uppercase tracking-wider">Avg Time</p><p className="text-lg font-bold text-white mt-0.5">{formatMins(p.avg_active_mins)}</p></div>
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between text-[10px] text-white/25 mb-1"><span>{p.completed}/{p.total_tasks} tasks</span><span>{pct2}%</span></div>
                                                            <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden"><div className="h-full bg-white/35 rounded-full" style={{ width: `${pct2}%` }} /></div>
                                                        </div>
                                                        {running && <p className="text-[10px] text-white/35 mt-2 flex items-center gap-1"><FiActivity className="w-2.5 h-2.5" /> Running now</p>}
                                                    </>) : <p className="text-xs text-white/20 mt-1">No tasks assigned</p>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 h-fit flex flex-col justify-between">
                                    <div>
                                        <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1">Workload Distribution</h4>
                                        <p className="text-[10px] text-white/30">Share of total tasks handled by each machine</p>
                                    </div>
                                    <div className="flex-1 mt-4 flex items-center justify-center">
                                        {machLoading ? (
                                            <Skel h="h-44" />
                                        ) : machinesSharePieOption ? (
                                            <ReactECharts option={machinesSharePieOption} style={{ height: 180, width: '100%' }} />
                                        ) : (
                                            <p className="text-center text-white/20 py-10 text-xs">No data available.</p>
                                        )}
                                    </div>
                                </div> */}
                            </div>
                        </div>
                    </SectionCard>
                )}

                {prodTab === 'employee-performance' && (
                    <SectionCard title="Employee Performance Report" sub="Track operator productivity, work session durations, completed tasks, and efficiency metrics across date ranges.">
                        <div className="p-5 space-y-6">
                            {/* Filter Controls Header */}
                            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Period:</span>
                                        <select
                                            value={empPerfDurationType}
                                            onChange={(e) => setEmpPerfDurationType(e.target.value)}
                                            className="bg-black/40 border border-white/[0.10] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                                        >
                                            <option value="last_30_days">Last 30 Days</option>
                                            <option value="last_7_days">Last 7 Days</option>
                                            <option value="today">Today</option>
                                            <option value="yesterday">Yesterday</option>
                                            <option value="this_month">This Month</option>
                                            <option value="all_time">All Time</option>
                                            <option value="custom">Custom Range</option>
                                        </select>
                                    </div>

                                    {empPerfDurationType === 'custom' && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="date"
                                                value={empPerfCustomStart}
                                                onChange={(e) => setEmpPerfCustomStart(e.target.value)}
                                                className="bg-black/40 border border-white/[0.10] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                                            />
                                            <span className="text-xs text-white/30">to</span>
                                            <input
                                                type="date"
                                                value={empPerfCustomEnd}
                                                onChange={(e) => setEmpPerfCustomEnd(e.target.value)}
                                                className="bg-black/40 border border-white/[0.10] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <FiSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                        <input
                                            type="text"
                                            placeholder="Search operator..."
                                            value={empPerfSearchQuery}
                                            onChange={(e) => setEmpPerfSearchQuery(e.target.value)}
                                            className="bg-black/40 border border-white/[0.10] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none w-48"
                                        />
                                    </div>
                                    <button
                                        onClick={loadEmployeePerformance}
                                        className="p-2 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.08] rounded-xl text-white/70 hover:text-white transition-all cursor-pointer"
                                        title="Refresh Employee Data"
                                    >
                                        <FiRefreshCw className={`w-3.5 h-3.5 ${empPerfLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Top Summary KPI Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white/[0.05] rounded-xl text-white/60"><FiUsers className="w-4 h-4" /></div>
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Active Operators</p>
                                    </div>
                                    <p className="text-2xl font-bold text-white tracking-tight">{empPerfData?.stats?.totalActiveOperators || 0}</p>
                                    <p className="text-[11px] text-white/30 mt-1">Operators with activity</p>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white/[0.05] rounded-xl text-white/60"><FiClock className="w-4 h-4" /></div>
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Total Work Time</p>
                                    </div>
                                    <p className="text-2xl font-bold text-white tracking-tight">
                                        {formatMins((empPerfData?.stats?.totalLoggedSeconds || 0) / 60)}
                                    </p>
                                    <p className="text-[11px] text-white/30 mt-1">Logged work sessions</p>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white/[0.05] rounded-xl text-white/60"><FiCheckCircle className="w-4 h-4" /></div>
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Completed Tasks</p>
                                    </div>
                                    <p className="text-2xl font-bold text-white tracking-tight">{empPerfData?.stats?.totalCompletedTasks || 0}</p>
                                    <p className="text-[11px] text-white/30 mt-1">Finished job tasks</p>
                                </div>

                                <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-white/[0.05] rounded-xl text-white/60"><FiZap className="w-4 h-4" /></div>
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Team Efficiency</p>
                                    </div>
                                    <p className="text-2xl font-bold text-white tracking-tight">
                                        {empPerfData?.stats?.overallEfficiencyPct != null ? `${empPerfData.stats.overallEfficiencyPct}%` : '—'}
                                    </p>
                                    <p className="text-[11px] text-white/30 mt-1">Est. vs Actual time ratio</p>
                                </div>
                            </div>

                            {/* Operator Leaderboard Table */}
                            <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden">
                                <div className="px-5 py-4 border-b border-white/[0.06]">
                                    <h3 className="text-sm font-semibold text-white">Operator Productivity Leaderboard</h3>
                                    <p className="text-xs text-white/40 mt-0.5">Click "Inspect Logs" on any employee to view their individual work log history.</p>
                                </div>

                                {empPerfLoading ? (
                                    <div className="p-8 space-y-3">
                                        <Skel h="h-10" />
                                        <Skel h="h-10" />
                                        <Skel h="h-10" />
                                    </div>
                                ) : !empPerfData?.employees?.length ? (
                                    <div className="text-center py-12 text-white/30 text-xs">
                                        No employee activity found for the selected reporting period.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-white/[0.03] text-white/30 uppercase tracking-wider font-semibold border-b border-white/[0.06]">
                                                <tr>
                                                    <th className="py-3 px-4">Operator Name</th>
                                                    <th className="py-3 px-4 text-center">Work Logs</th>
                                                    <th className="py-3 px-4 text-center">Tasks Completed</th>
                                                    <th className="py-3 px-4 text-center">Active Work Duration</th>
                                                    <th className="py-3 px-4 text-center">Est. Output vs. Act. Output</th>
                                                    <th className="py-3 px-4 text-center">Est. Time vs Act. Time</th>
                                                    <th className="py-3 px-4 text-center">Efficiency Rating</th>
                                                    <th className="py-3 px-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/[0.04]">
                                                {empPerfData.employees
                                                    .filter(e => e.name.toLowerCase().includes(empPerfSearchQuery.toLowerCase()))
                                                    .map(emp => (
                                                        <tr key={emp.name} className="hover:bg-white/[0.02] transition-colors">
                                                            <td className="py-3.5 px-4 font-semibold text-white">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center text-white/60 text-xs">
                                                                        <FiUser className="w-3 h-3" />
                                                                    </div>
                                                                    <span>{emp.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center text-white/60 font-mono">
                                                                {emp.logCount} logs
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                <span className="px-2 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded-md font-mono text-white/80">
                                                                    {emp.completedTasks}
                                                                </span>
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center font-mono text-white">
                                                                {formatMins(emp.loggedSeconds > 0 ? Math.round(emp.loggedSeconds / 60) : emp.actMinsRound)}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center text-white/70 font-mono">
                                                                {emp.estOutput > 0 || emp.actOutput > 0 ? `${fmt(emp.estOutput)} / ${fmt(emp.actOutput)}` : "—"}
                                                                {emp.wastedOutput > 0 && <span className="text-[10px] text-amber-400 block">(${fmt(emp.wastedOutput)} waste)</span>}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center text-white/50 font-mono">
                                                                {formatMins(emp.estMins)} / {formatMins(emp.actMinsRound)}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-center">
                                                                {emp.efficiencyPct != null ? (
                                                                    <span className={`px-2.5 py-0.5 rounded-full font-mono font-semibold text-[11px] ${emp.efficiencyPct >= 100
                                                                        ? 'bg-white/20 text-white border border-white/30'
                                                                        : emp.efficiencyPct >= 75
                                                                            ? 'bg-white/10 text-white/80 border border-white/20'
                                                                            : 'bg-white/[0.05] text-white/50 border border-white/10'
                                                                        }`}>
                                                                        {emp.efficiencyPct}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-white/20">—</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3.5 px-4 text-right">
                                                                <button
                                                                    onClick={() => openEmpDetail(emp.name)}
                                                                    className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] rounded-xl text-white text-xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                                                                >
                                                                    <FiEye className="w-3.5 h-3.5" />
                                                                    <span>Inspect Logs</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </SectionCard>
                )}

                {prodTab === 'task-details' && (
                    <SectionCard title="Detailed Task Explorer" sub="Query daily machine or finishing tasks and explore execution logs, output metrics, and operator histories.">
                        <div className="p-5 space-y-6">
                            {/* Selector Controls */}
                            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 flex-wrap">
                                    {/* Date Selector */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Date:</span>
                                        <input
                                            type="date"
                                            value={explorerDate}
                                            onChange={e => setExplorerDate(e.target.value)}
                                            className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-white/30"
                                        />
                                    </div>

                                    {/* Resource Type */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Resource:</span>
                                        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
                                            <button
                                                onClick={() => handleExplorerResTypeChange('machine')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${explorerResType === 'machine' ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}
                                            >
                                                <FiCpu className="w-3.5 h-3.5" /> Machines
                                            </button>
                                            <button
                                                onClick={() => handleExplorerResTypeChange('finishing')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${explorerResType === 'finishing' ? 'bg-white/[0.08] text-white border border-white/[0.10]' : 'text-white/35 hover:text-white/60'}`}
                                            >
                                                <FiLayers className="w-3.5 h-3.5" /> Finishings
                                            </button>
                                        </div>

                                        {/* Dropdown Input Selector */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Type to filter..."
                                                value={explorerResSearchQuery}
                                                onFocus={() => {
                                                    setExplorerResDropdownOpen(true);
                                                    setExplorerResSearchQuery('');
                                                }}
                                                onChange={e => setExplorerResSearchQuery(e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-white/30 cursor-pointer min-w-[200px]"
                                            />

                                            {explorerResDropdownOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-20" onClick={() => {
                                                        setExplorerResDropdownOpen(false);
                                                        const activeList = explorerResType === 'machine' ? resList.machines : resList.finishings;
                                                        const currentRes = (activeList || []).find(r => r.id.toString() === explorerResId.toString());
                                                        setExplorerResSearchQuery(currentRes ? currentRes.name : '');
                                                    }} />

                                                    <div className="absolute left-0 mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-white/10 rounded-xl shadow-xl z-30 divide-y divide-white/[0.04] min-w-[200px] w-full">
                                                        {filteredExplorerResList.length === 0 ? (
                                                            <div className="px-3.5 py-2.5 text-xs text-white/40 italic">
                                                                No matches found
                                                            </div>
                                                        ) : (
                                                            filteredExplorerResList.map(item => (
                                                                <button
                                                                    key={item.id}
                                                                    onClick={() => {
                                                                        setExplorerResId(item.id.toString());
                                                                        setExplorerResSearchQuery(item.name);
                                                                        setExplorerResDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors hover:bg-white/[0.05] ${item.id.toString() === explorerResId.toString() ? 'text-white font-bold bg-white/[0.03]' : 'text-white/70'}`}
                                                                >
                                                                    {item.name}
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs text-white/45 flex items-center gap-1.5">
                                    <FiActivity className="w-4 h-4 text-indigo-400" />
                                    <span>Task Count: <strong className="text-white">{explorerTasks.length}</strong></span>
                                </div>
                            </div>

                            {/* Explorer Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left column: Tasks List */}
                                <div className="lg:col-span-1 space-y-3 max-h-[600px] overflow-y-auto pr-1">
                                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider px-1">Tasks List</p>

                                    {explorerTasksLoading ? (
                                        <div className="space-y-2">
                                            {Array(4).fill(0).map((_, i) => (
                                                <div key={i} className="bg-white/[0.01] border border-white/[0.05] rounded-xl p-3 space-y-2">
                                                    <Skel h="h-3" w="w-16" />
                                                    <Skel h="h-4" />
                                                    <Skel h="h-3.5" w="w-24" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : explorerTasks.length === 0 ? (
                                        <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl text-white/30 text-xs">
                                            No tasks scheduled for this day.
                                        </div>
                                    ) : (
                                        explorerTasks.map(t => {
                                            const parts = t.name.split('—');
                                            const cleanName = parts[parts.length - 1]?.trim() || t.name;
                                            const operationDetail = parts.length > 2 ? parts[1]?.trim() : '';
                                            const displayText = operationDetail ? `${cleanName} (${operationDetail})` : cleanName;

                                            const isActive = selectedExplorerTaskId === t.id;

                                            return (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setSelectedExplorerTaskId(t.id)}
                                                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer block ${isActive
                                                        ? 'bg-white/[0.06] border-white/25 text-white'
                                                        : 'bg-black/20 border-white/[0.05] hover:border-white/15 text-white/70 hover:text-white'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                                        <span className="font-mono text-xs font-semibold text-indigo-400">{t.order_code || 'Unassigned'}</span>
                                                        {getStatusBadge(t.status)}
                                                    </div>
                                                    <p className="text-xs font-semibold line-clamp-2 mb-1.5">{displayText}</p>
                                                    <div className="flex items-center justify-between text-[10px] text-white/35">
                                                        <span className="truncate max-w-[120px]">{t.customer_name || '—'}</span>
                                                        <span>Est: {formatMins(t.estimated_minutes)}</span>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Right column: Selected Task Details */}
                                <div className="lg:col-span-2 space-y-4">
                                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Task Details Dashboard</p>

                                    {selectedTaskDetailLoading ? (
                                        <div className="bg-white/[0.01] border border-white/[0.05] rounded-2xl p-6 space-y-5 animate-pulse">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-2"><Skel h="h-4" w="w-32" /><Skel h="h-6" w="w-64" /></div>
                                                <Skel h="h-6" w="w-20" />
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Skel h="h-20" /><Skel h="h-20" /><Skel h="h-20" /><Skel h="h-20" /></div>
                                            <div className="space-y-2"><Skel h="h-4" w="w-40" /><Skel h="h-16" /></div>
                                        </div>
                                    ) : !selectedTaskDetail ? (
                                        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-white/10 rounded-2xl text-white/35 gap-3 bg-white/[0.01]">
                                            <FiActivity className="w-10 h-10 text-white/15" />
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold text-white/60">No Task Selected</p>
                                                <p className="text-xs text-white/30 max-w-xs">Select a task from the list on the left to view complete production history and execution metrics.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Header Panel */}
                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5">
                                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                            <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                                                SO: {selectedTaskDetail.task.order_code || 'Unassigned'}
                                                            </span>
                                                            <span className="text-xs text-white/50 font-semibold truncate">
                                                                {selectedTaskDetail.task.customer_name || 'No Customer'}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-base font-bold text-white leading-tight">
                                                            {selectedTaskDetail.task.name}
                                                        </h4>
                                                        {selectedTaskDetail.task.description && (
                                                            <p className="text-xs text-white/45 mt-2 bg-black/20 p-2.5 rounded-lg border border-white/[0.03]">
                                                                {selectedTaskDetail.task.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="sm:text-right shrink-0">
                                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1">Status</p>
                                                        {getStatusBadge(selectedTaskDetail.task.status)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Metrics Grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                    <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Estimated Time</p>
                                                    <p className="text-lg font-bold text-white font-mono">{formatMins(selectedTaskDetail.task.estimated_minutes)}</p>
                                                    <p className="text-[9px] text-white/35 mt-0.5">Planned limit</p>
                                                </div>

                                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                    <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Logged Duration</p>
                                                    <p className="text-lg font-bold text-white font-mono">
                                                        {selectedTaskDetail.task.actual_minutes != null ? formatMins(selectedTaskDetail.task.actual_minutes) : '—'}
                                                    </p>
                                                    <p className="text-[9px] text-white/35 mt-0.5">Active timer total</p>
                                                </div>

                                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                    <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Planned Qty</p>
                                                    <p className="text-lg font-bold text-white font-mono">
                                                        {selectedTaskDetail.task.quantity ? fmt(parseFloat(selectedTaskDetail.task.quantity)) : '—'}
                                                    </p>
                                                    <p className="text-[9px] text-white/35 mt-0.5">
                                                        {selectedTaskDetail.task.sheet_count ? `${fmt(selectedTaskDetail.task.sheet_count)} sheets` : 'Sheets: —'}
                                                    </p>
                                                </div>

                                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                    <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Actual Output</p>
                                                    <p className="text-lg font-bold text-emerald-400 font-mono">
                                                        {selectedTaskDetail.task.actual_sheets_printed ? fmt(parseFloat(selectedTaskDetail.task.actual_sheets_printed)) : '—'}
                                                    </p>
                                                    <p className="text-[9px] text-white/35 mt-0.5">
                                                        {selectedTaskDetail.task.actual_sheets_wasted ? `Wasted: ${fmt(parseFloat(selectedTaskDetail.task.actual_sheets_wasted))}` : 'Wasted: —'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Details & Specifications */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Left details */}
                                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-2.5">
                                                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Resource & Config Details</p>
                                                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                        <span className="text-white/35">Resource Name</span>
                                                        <span className="text-white font-semibold text-right truncate">
                                                            {selectedTaskDetail.task.machine_name || (selectedTaskDetail.task.machine_id ? `ID: ${selectedTaskDetail.task.machine_id}` : 'Finishing (Manual)')}
                                                        </span>

                                                        <span className="text-white/35">Type</span>
                                                        <span className="text-white font-semibold text-right capitalize">
                                                            {selectedTaskDetail.task.machine_type || 'Finishing'}
                                                        </span>

                                                        <span className="text-white/35">Planned Impressions</span>
                                                        <span className="text-white font-semibold text-right">
                                                            {selectedTaskDetail.task.impression_count ? Number(selectedTaskDetail.task.impression_count).toLocaleString() : '—'}
                                                        </span>

                                                        <span className="text-white/35">Speed Configuration</span>
                                                        <span className="text-white font-semibold text-right">
                                                            {selectedTaskDetail.task.custom_speed ? `${selectedTaskDetail.task.custom_speed} ${selectedTaskDetail.task.custom_speed_unit || 'sheets/hr'}` : 'Auto'}
                                                        </span>

                                                        <span className="text-white/35">Plates Used (CTP)</span>
                                                        <span className="text-white font-semibold text-right">
                                                            {selectedTaskDetail.task.actual_plates_used || '0'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Right details */}
                                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-2.5">
                                                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Operators & Downtime</p>
                                                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                        <span className="text-white/35">Assigned Operator</span>
                                                        <span className="text-white font-semibold text-right truncate">{selectedTaskDetail.task.assigned_to || 'Unassigned'}</span>

                                                        <span className="text-white/35">Helper Name</span>
                                                        <span className="text-white font-semibold text-right truncate">{selectedTaskDetail.task.helper_name || 'None'}</span>

                                                        <span className="text-white/35">Completed By</span>
                                                        <span className="text-white font-semibold text-right truncate">{selectedTaskDetail.task.completed_by || '—'}</span>

                                                        <span className="text-white/35">Completed Helper</span>
                                                        <span className="text-white font-semibold text-right truncate">{selectedTaskDetail.task.completed_by_helper || '—'}</span>

                                                        <span className="text-white/35">Downtime Minutes</span>
                                                        <span className={`font-semibold text-right ${selectedTaskDetail.task.downtime_minutes ? 'text-red-400' : 'text-white'}`}>
                                                            {selectedTaskDetail.task.downtime_minutes || '0'}m
                                                        </span>
                                                    </div>
                                                    {selectedTaskDetail.task.downtime_minutes > 0 && selectedTaskDetail.task.downtime_reason && (
                                                        <div className="text-[11px] bg-red-500/10 border border-red-500/20 text-red-300 p-2 rounded-lg mt-2">
                                                            <strong>Reason:</strong> {selectedTaskDetail.task.downtime_reason}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Overall Lifecycle timestamps */}
                                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-2.5">
                                                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Overall Lifecycle Timestamps</p>
                                                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                        <span className="text-white/35">Task Started</span>
                                                        <span className="text-white font-semibold text-right truncate">
                                                            {formatDateTime(selectedTaskDetail.task.started_at)}
                                                        </span>

                                                        <span className="text-white/35">Task Completed</span>
                                                        <span className="text-white font-semibold text-right truncate">
                                                            {formatDateTime(selectedTaskDetail.task.completed_at)}
                                                        </span>

                                                        <span className="text-white/35">Created Date</span>
                                                        <span className="text-white font-semibold text-right truncate">
                                                            {formatDateTime(selectedTaskDetail.task.created_at)}
                                                        </span>

                                                        <span className="text-white/35">Scheduled Date</span>
                                                        <span className="text-white font-semibold text-right truncate">
                                                            {selectedTaskDetail.task.scheduled_date ? new Date(selectedTaskDetail.task.scheduled_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Work Log Timeline */}
                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
                                                <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
                                                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Timer Execution Timeline</p>
                                                    <span className="text-[10px] text-white/45">{timelineElements.length} segments</span>
                                                </div>

                                                {timelineElements.length === 0 ? (
                                                    <div className="text-center py-6 text-xs text-white/35 italic">
                                                        No active timer logs recorded for this task.
                                                    </div>
                                                ) : (
                                                    <div className="relative pl-4 space-y-4 border-l border-white/10 mt-2">
                                                        {timelineElements.map((item, idx) => {
                                                            if (item.type === 'work') {
                                                                const isRunning = !item.stopped_at;
                                                                const durMins = item.duration_seconds
                                                                    ? Math.round(item.duration_seconds / 60)
                                                                    : isRunning
                                                                        ? Math.max(0, Math.floor((Date.now() - new Date(item.started_at).getTime()) / 60000))
                                                                        : 0;

                                                                return (
                                                                    <div key={`work-${idx}`} className="relative">
                                                                        {/* Dot */}
                                                                        <span className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border ${isRunning ? 'bg-amber-400 border-neutral-900 animate-pulse' : 'bg-emerald-400 border-neutral-900'
                                                                            }`} />

                                                                        <div className="flex items-start justify-between gap-4 text-xs">
                                                                            <div>
                                                                                <p className="font-semibold text-white">
                                                                                    {item.employee_name} <span className="text-white/40 font-normal">started timer</span>
                                                                                </p>
                                                                                <p className="text-[10px] text-white/35 font-mono mt-0.5">
                                                                                    {formatDateTime(item.started_at)} – {isRunning ? 'Running Now' : formatDateTime(item.stopped_at)}
                                                                                </p>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <span className={`font-mono font-bold ${isRunning ? 'text-amber-400 animate-pulse' : 'text-white/60'}`}>
                                                                                    {formatMins(durMins)}
                                                                                </span>
                                                                                <p className="text-[9px] text-white/20 mt-0.5">{isRunning ? 'Active' : 'Duration'}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            } else {
                                                                return (
                                                                    <div key={`pause-${idx}`} className="relative">
                                                                        {/* Dash indicator */}
                                                                        <span className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full border border-orange-500/40 bg-neutral-950 flex items-center justify-center">
                                                                            <span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
                                                                        </span>

                                                                        <div className="flex items-start justify-between gap-4 text-xs bg-orange-500/5 border border-orange-500/10 rounded-lg p-2 ml-1">
                                                                            <div>
                                                                                <p className="font-semibold text-orange-300">
                                                                                    Task Paused
                                                                                </p>
                                                                                <p className="text-[10px] text-orange-300/60 font-mono mt-0.5">
                                                                                    {formatDateTime(item.started_at)} – {formatDateTime(item.stopped_at)}
                                                                                </p>
                                                                            </div>
                                                                            <div className="text-right shrink-0">
                                                                                <span className="font-mono font-bold text-orange-300">
                                                                                    {formatMins(item.duration_minutes)}
                                                                                </span>
                                                                                <p className="text-[9px] text-orange-300/45 mt-0.5">Paused Duration</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                )}

                {prodTab === 'task-details' && (() => {
                    // Build service timeline for selected svc task
                    const svcLogs = selectedSvcDetail?.logs || [];
                    const svcWorkLogs = svcLogs.filter(l => l.duration_seconds > 0 || !l.stopped_at);
                    const svcTimeline = [];
                    for (let i = 0; i < svcWorkLogs.length; i++) {
                        svcTimeline.push({ type: 'work', ...svcWorkLogs[i] });
                        if (i < svcWorkLogs.length - 1) {
                            const gapStart = new Date(svcWorkLogs[i].stopped_at);
                            const gapEnd = new Date(svcWorkLogs[i + 1].started_at);
                            const gapMins = Math.round((gapEnd - gapStart) / 60000);
                            if (gapMins > 0) svcTimeline.push({ type: 'pause', started_at: svcWorkLogs[i].stopped_at, stopped_at: svcWorkLogs[i + 1].started_at, duration_minutes: gapMins });
                        }
                    }

                    return (
                        <SectionCard title="Service Task Explorer" sub="Query daily pre-press, quality check, packing, delivery and other service tasks with full execution logs.">
                            <div className="p-5 space-y-6">
                                {/* Controls */}
                                <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 flex-wrap">
                                        {/* Date */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Date:</span>
                                            <input
                                                type="date"
                                                value={svcDate}
                                                onChange={e => setSvcDate(e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-white/30"
                                            />
                                        </div>
                                        {/* Service Type Filter */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Service:</span>
                                            <select
                                                value={svcServiceName}
                                                onChange={e => { setSvcServiceName(e.target.value); setSelectedSvcTaskId(null); }}
                                                className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-white/30 min-w-[180px]"
                                            >
                                                <option value="">All Services</option>
                                                {svcServiceTypes.map((t, i) => (
                                                    <option key={i} value={t.filter_name}>{t.display_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="text-xs text-white/45 flex items-center gap-1.5">
                                        <FiZap className="w-4 h-4 text-purple-400" />
                                        <span>Task Count: <strong className="text-white">{svcTasks.length}</strong></span>
                                    </div>
                                </div>

                                {/* Explorer Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Left: Task List */}
                                    <div className="lg:col-span-1 space-y-3 max-h-[600px] overflow-y-auto pr-1">
                                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider px-1">Service Tasks</p>
                                        {svcTasksLoading ? (
                                            <div className="space-y-2">
                                                {Array(4).fill(0).map((_, i) => (
                                                    <div key={i} className="bg-white/[0.01] border border-white/[0.05] rounded-xl p-3 space-y-2">
                                                        <Skel h="h-3" w="w-16" /><Skel h="h-4" /><Skel h="h-3.5" w="w-24" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : svcTasks.length === 0 ? (
                                            <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl text-white/30 text-xs">
                                                No service tasks found for this day.
                                            </div>
                                        ) : (
                                            svcTasks.map(t => {
                                                const isActive = selectedSvcTaskId === t.id;
                                                return (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setSelectedSvcTaskId(t.id)}
                                                        className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer block ${isActive ? 'bg-white/[0.06] border-white/25 text-white' : 'bg-black/20 border-white/[0.05] hover:border-purple-500/30 text-white/70 hover:text-white'}`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                                            <span className="font-mono text-xs font-semibold text-purple-400">{t.order_code || 'No Order'}</span>
                                                            {getStatusBadge(t.status)}
                                                        </div>
                                                        <p className="text-xs font-semibold line-clamp-2 mb-1.5">{t.name}</p>
                                                        <div className="flex items-center justify-between text-[10px] text-white/35">
                                                            <span className="truncate max-w-[120px]">{t.customer_name || '—'}</span>
                                                            <span>{t.actual_minutes != null ? `${formatMins(t.actual_minutes)} logged` : t.estimated_minutes ? `Est: ${formatMins(t.estimated_minutes)}` : '—'}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Right: Detail Panel */}
                                    <div className="lg:col-span-2 space-y-4">
                                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Service Task Details</p>
                                        {selectedSvcDetailLoading ? (
                                            <div className="bg-white/[0.01] border border-white/[0.05] rounded-2xl p-6 space-y-5 animate-pulse">
                                                <div className="flex items-start justify-between"><div className="space-y-2"><Skel h="h-4" w="w-32" /><Skel h="h-6" w="w-64" /></div><Skel h="h-6" w="w-20" /></div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Skel h="h-20" /><Skel h="h-20" /><Skel h="h-20" /><Skel h="h-20" /></div>
                                            </div>
                                        ) : !selectedSvcDetail ? (
                                            <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-white/10 rounded-2xl text-white/35 gap-3 bg-white/[0.01]">
                                                <FiZap className="w-10 h-10 text-white/15" />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-white/60">No Task Selected</p>
                                                    <p className="text-xs text-white/30 max-w-xs">Select a service task from the list to view its execution details and work log timeline.</p>
                                                </div>
                                            </div>
                                        ) : (() => {
                                            const t = selectedSvcDetail.task;
                                            return (
                                                <div className="space-y-4">
                                                    {/* Header */}
                                                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5">
                                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                                    <span className="font-mono text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                                                        {t.order_code || 'No Order'}
                                                                    </span>
                                                                    <span className="text-xs text-white/50 font-semibold">{t.customer_name || 'No Customer'}</span>
                                                                </div>
                                                                <h4 className="text-base font-bold text-white leading-tight">{t.name}</h4>
                                                                {t.description && (
                                                                    <p className="text-xs text-white/45 mt-2 bg-black/20 p-2.5 rounded-lg border border-white/[0.03]">{t.description}</p>
                                                                )}
                                                            </div>
                                                            <div className="sm:text-right shrink-0">
                                                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1">Status</p>
                                                                {getStatusBadge(t.status)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Metrics */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                            <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Estimated Time</p>
                                                            <p className="text-lg font-bold text-white font-mono">{formatMins(t.estimated_minutes)}</p>
                                                            <p className="text-[9px] text-white/35 mt-0.5">Planned limit</p>
                                                        </div>
                                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                            <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Logged Duration</p>
                                                            <p className="text-lg font-bold text-white font-mono">{t.actual_minutes != null ? formatMins(t.actual_minutes) : '—'}</p>
                                                            <p className="text-[9px] text-white/35 mt-0.5">Net active time</p>
                                                        </div>
                                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                            <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Variance</p>
                                                            <p className={`text-lg font-bold font-mono ${t.estimated_minutes && t.actual_minutes ? (t.actual_minutes > t.estimated_minutes ? 'text-red-400' : 'text-emerald-400') : 'text-white'}`}>
                                                                {formatVar(t.estimated_minutes, t.actual_minutes)}
                                                            </p>
                                                            <p className="text-[9px] text-white/35 mt-0.5">vs estimate</p>
                                                        </div>
                                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                            <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Work Segments</p>
                                                            <p className="text-lg font-bold text-white font-mono">{svcLogs.length}</p>
                                                            <p className="text-[9px] text-white/35 mt-0.5">Log entries</p>
                                                        </div>
                                                    </div>

                                                    {/* Details Row */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Operator & Timestamps */}
                                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-2.5">
                                                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Operators & Timestamps</p>
                                                            <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                                <span className="text-white/35">Assigned To</span>
                                                                <span className="text-white font-semibold text-right truncate">{t.assigned_to || 'Unassigned'}</span>
                                                                <span className="text-white/35">Completed By</span>
                                                                <span className="text-white font-semibold text-right truncate">{t.completed_by || '—'}</span>
                                                                <span className="text-white/35">Task Started</span>
                                                                <span className="text-white font-semibold text-right">{formatDateTime(t.started_at)}</span>
                                                                <span className="text-white/35">Task Completed</span>
                                                                <span className="text-white font-semibold text-right">{formatDateTime(t.completed_at)}</span>
                                                                <span className="text-white/35">Created</span>
                                                                <span className="text-white font-semibold text-right">{formatDateTime(t.created_at)}</span>
                                                            </div>
                                                        </div>
                                                        {/* Downtime */}
                                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-2.5">
                                                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Task Info</p>
                                                            <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                                <span className="text-white/35">Helper Name</span>
                                                                <span className="text-white font-semibold text-right truncate">{t.helper_name || 'None'}</span>
                                                                <span className="text-white/35">Downtime</span>
                                                                <span className={`font-semibold text-right ${t.downtime_minutes > 0 ? 'text-red-400' : 'text-white'}`}>{t.downtime_minutes || 0}m</span>
                                                                <span className="text-white/35">Scheduled Date</span>
                                                                <span className="text-white font-semibold text-right">{t.scheduled_date ? new Date(t.scheduled_date).toLocaleDateString() : '—'}</span>
                                                                <span className="text-white/35">Description</span>
                                                                <span className="text-white font-semibold text-right truncate">{t.description || '—'}</span>
                                                            </div>
                                                            {t.downtime_minutes > 0 && t.downtime_reason && (
                                                                <div className="text-[11px] bg-red-500/10 border border-red-500/20 text-red-300 p-2 rounded-lg mt-2">
                                                                    <strong>Reason:</strong> {t.downtime_reason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Work Log Timeline */}
                                                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
                                                        <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
                                                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Timer Execution Timeline</p>
                                                            <span className="text-[10px] text-white/45">{svcTimeline.length} segments</span>
                                                        </div>
                                                        {svcTimeline.length === 0 ? (
                                                            <div className="text-center py-6 text-xs text-white/35 italic">No active timer logs recorded for this task.</div>
                                                        ) : (
                                                            <div className="relative pl-4 space-y-4 border-l border-white/10 mt-2">
                                                                {svcTimeline.map((item, idx) => {
                                                                    if (item.type === 'work') {
                                                                        const isRunning = !item.stopped_at;
                                                                        const durMins = item.duration_seconds
                                                                            ? Math.round(item.duration_seconds / 60)
                                                                            : isRunning ? Math.max(0, Math.floor((Date.now() - new Date(item.started_at).getTime()) / 60000)) : 0;
                                                                        return (
                                                                            <div key={`sw-${idx}`} className="relative">
                                                                                <span className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border ${isRunning ? 'bg-amber-400 border-neutral-900 animate-pulse' : 'bg-purple-400 border-neutral-900'}`} />
                                                                                <div className="flex items-start justify-between gap-4 text-xs">
                                                                                    <div>
                                                                                        <p className="font-semibold text-white">{item.employee_name} <span className="text-white/40 font-normal">started timer</span></p>
                                                                                        <p className="text-[10px] text-white/35 font-mono mt-0.5">{formatDateTime(item.started_at)} – {isRunning ? 'Running Now' : formatDateTime(item.stopped_at)}</p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <span className={`font-mono font-bold ${isRunning ? 'text-amber-400 animate-pulse' : 'text-white/60'}`}>{formatMins(durMins)}</span>
                                                                                        <p className="text-[9px] text-white/20 mt-0.5">{isRunning ? 'Active' : 'Duration'}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <div key={`sp-${idx}`} className="relative">
                                                                                <span className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full border border-orange-500/40 bg-neutral-950 flex items-center justify-center">
                                                                                    <span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
                                                                                </span>
                                                                                <div className="flex items-start justify-between gap-4 text-xs bg-orange-500/5 border border-orange-500/10 rounded-lg p-2 ml-1">
                                                                                    <div>
                                                                                        <p className="font-semibold text-orange-300">Task Paused</p>
                                                                                        <p className="text-[10px] text-orange-300/60 font-mono mt-0.5">{formatDateTime(item.started_at)} – {formatDateTime(item.stopped_at)}</p>
                                                                                    </div>
                                                                                    <div className="text-right shrink-0">
                                                                                        <span className="font-mono font-bold text-orange-300">{formatMins(item.duration_minutes)}</span>
                                                                                        <p className="text-[9px] text-orange-300/45 mt-0.5">Paused Duration</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    );
                })()}
            </>)}

            {/* ══ TAB: INVENTORY ═════════════════════════════════════════════════════════ */}
            {tab === 'inventory' && (<>
                <Divider label="Stock Levels" />
                <div className="grid lg:grid-cols-3 gap-3">
                    {loading ? Array(3).fill(0).map((_, i) => (
                        <div key={i} className="bg-black/40 border border-white/[0.07] rounded-2xl p-5 space-y-3"><Skel h="h-2.5" w="w-20" /><Skel h="h-7" w="w-28" /></div>
                    )) : stats ? (<>
                        <KpiCard icon={FiPackage} label="Inventory Items" value={fmt(stats.kpi.totalItems)} sub="Total tracked items" href="/dashboard/inventory" />
                        <KpiCard icon={FiAlertTriangle} label="Low Stock Items" value={fmt(stats.kpi.lowStockCount)} sub="Below minimum level" href="/dashboard/inventory" danger={stats.kpi.lowStockCount > 0} />
                        <KpiCard icon={FiPackage} label="Well Stocked" value={fmt(stats.kpi.totalItems - stats.kpi.lowStockCount)} sub="Items above minimum" />
                    </>) : null}
                </div>

                <Divider label="Alerts" />
                <SectionCard title="Low Stock Alerts" sub="Items below minimum stock level" href="/dashboard/inventory">
                    {loading ? <div className="p-4 space-y-3">{Array(5).fill(0).map((_, i) => <Skel key={i} h="h-11" />)}</div>
                        : stats?.lowStock?.length ? (
                            <div className="divide-y divide-white/[0.04]">
                                {stats.lowStock.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between px-5 py-4 gap-3 hover:bg-white/[0.02] transition-colors">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                                            <p className="text-xs text-white/25 mt-0.5">Minimum: {item.min_stock} {item.uom}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <span className="font-mono font-bold text-red-400 text-lg">{item.stock_quantity}</span>
                                            <p className="text-[10px] text-white/25">{item.uom}</p>
                                        </div>
                                        <div className="w-24">
                                            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                                <div className="h-full bg-red-400/50 rounded-full" style={{ width: `${Math.min(100, item.min_stock > 0 ? (item.stock_quantity / item.min_stock) * 100 : 0)}%` }} />
                                            </div>
                                            <p className="text-[10px] text-white/20 mt-1 text-right">{item.min_stock > 0 ? Math.round((item.stock_quantity / item.min_stock) * 100) : 0}% of min</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <FiPackage className="w-8 h-8 text-white/10" />
                                <p className="text-white/25 text-sm">All items are well stocked.</p>
                            </div>
                        )}
                </SectionCard>
            </>)}

            {/* ══ Machine Performance Slide-in Panel (shared) ════════════════════════════ */}
            {perfMachine && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => { setPerfMachine(null); setPerfData(null); }} />
                    <div className="w-full max-w-2xl bg-[#0a0a0a] border-l border-white/[0.08] flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center"><FiActivity className="w-4 h-4 text-white/50" /></div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{perfMachine.name}</p>
                                    <p className="text-xs text-white/30 capitalize">{perfMachine.type} · Performance & Maintenance</p>
                                </div>
                            </div>
                            <button onClick={() => { setPerfMachine(null); setPerfData(null); }} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white transition-all"><FiX /></button>
                        </div>

                        <div className="flex border-b border-white/[0.06] bg-white/[0.02]">
                            <button
                                onClick={() => setDetailsTab('performance')}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${detailsTab === 'performance'
                                    ? 'border-white text-white bg-white/[0.03]'
                                    : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.01]'
                                    }`}
                            >
                                Performance
                            </button>
                            <button
                                onClick={() => setDetailsTab('maintenance')}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${detailsTab === 'maintenance'
                                    ? 'border-white text-white bg-white/[0.03]'
                                    : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.01]'
                                    }`}
                            >
                                Parts & Maintenance
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                            {(perfLoading && !machPerf[perfMachine?.id]) ? (
                                <div className="flex items-center justify-center py-20"><div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" /></div>
                            ) : (() => {
                                const d = perfData || machPerf[perfMachine?.id];
                                if (!d) return <p className="text-center text-white/25 text-sm py-12">No analytics data available.</p>;

                                if (detailsTab === 'maintenance') {
                                    return (
                                        <MachinePartsList
                                            machineId={perfMachine.id}
                                            parts={d.parts || []}
                                            onRefresh={() => refreshPerfData(perfMachine.id)}
                                        />
                                    );
                                }

                                const s = d.summary;
                                return (<>
                                    <div className="flex items-center gap-2 text-xs text-white/50 bg-white/[0.01] border border-white/[0.03] px-4 py-2.5 rounded-xl">
                                        <FiClock className="w-3.5 h-3.5 text-blue-400" />
                                        {(() => {
                                            const { startDate, endDate } = getPlanDateRange(perfDurationType, perfCustomStart, perfCustomEnd);
                                            if (startDate && endDate) {
                                                try {
                                                    const startD = new Date(startDate + 'T00:00:00');
                                                    const endD = new Date(endDate + 'T00:00:00');
                                                    const startFormatted = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                                    const endFormatted = endD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                                    return `Reporting Period: ${startFormatted} – ${endFormatted}`;
                                                } catch (e) {
                                                    return `Reporting Period: ${startDate} – ${endDate}`;
                                                }
                                            }
                                            return 'Reporting Period: All-Time Data';
                                        })()}
                                    </div>
                                    {d.currentTask && (
                                        <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FiActivity className="w-3 h-3" />Currently Running</p>
                                            <p className="text-sm font-semibold text-white">{d.currentTask.name}</p>
                                            <p className="text-xs text-white/40 mt-0.5">{d.currentTask.order_code} · {d.currentTask.customer_name}</p>
                                            {d.currentTask.started_at && <p className="text-xs text-white/30 mt-1 flex items-center gap-1"><FiClock className="w-3 h-3" />Started {new Date(d.currentTask.started_at).toLocaleString()}</p>}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[['Total Tasks', s.total_tasks, 'assigned'], ['Completed', s.completed, `${s.total_tasks > 0 ? Math.round(s.completed / s.total_tasks * 100) : 0}% done`], ['Avg Active', formatMins(s.avg_active_mins), 'started → done'], ['Total Time', formatMins(s.total_active_mins), 'machine time']].map(([label, value, sub]) => (
                                            <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-2">{label}</p>
                                                <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
                                                <p className="text-[11px] text-white/25 mt-1">{sub}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Task Status Breakdown</p>
                                        <div className="space-y-2">
                                            {[['Completed', s.completed, 'bg-white/50'], ['In Progress', s.in_progress, 'bg-white/25'], ['Pending', s.pending, 'bg-white/10']].map(([label, count, bar]) => (
                                                <div key={label} className="flex items-center gap-3">
                                                    <span className="text-xs text-white/40 w-20 shrink-0">{label}</span>
                                                    <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden"><div className={`h-full ${bar} rounded-full`} style={{ width: `${s.total_tasks > 0 ? Math.round(count / s.total_tasks * 100) : 0}%` }} /></div>
                                                    <span className="text-xs font-mono text-white/40 w-6 text-right">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {d.monthly?.length > 0 && (
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Monthly Output (last 6 months)</p>
                                            <div ref={chartRef} style={{ height: 180 }} />
                                        </div>
                                    )}
                                    {d.recent?.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Recent Completed Tasks</p>
                                            <div className="space-y-1.5">
                                                {d.recent.map(t => (
                                                    <div key={t.id} className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                                                        <div className="min-w-0"><p className="text-sm font-medium text-white/70 truncate">{t.name}</p><p className="text-[11px] text-white/25 mt-0.5">{t.order_code} · {t.customer_name}</p></div>
                                                        <div className="text-right shrink-0">
                                                            {t.active_mins != null ? <p className="text-xs font-mono text-white/50">{formatMins(t.active_mins)} active</p> : <p className="text-xs text-white/20">—</p>}
                                                            <p className="text-[10px] text-white/20 mt-0.5">{t.completed_at ? new Date(t.completed_at).toLocaleDateString() : ''}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>);
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Task Detail Inspector Modal */}
            {taskModalId && (
                <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                                    <FiActivity className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                            {taskModalData?.task?.order_code ? `SO: ${taskModalData.task.order_code}` : "Unassigned Task"}
                                        </span>
                                        {taskModalData?.task?.customer_name && (
                                            <span className="text-xs text-white/50 truncate font-medium">
                                                {taskModalData.task.customer_name}
                                            </span>
                                        )}
                                        {taskModalData?.task?.status && getStatusBadge(taskModalData.task.status)}
                                    </div>
                                    <h3 className="text-base font-bold text-white mt-1 truncate">
                                        {taskModalData?.task?.name || "Loading Task Specifications..."}
                                    </h3>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                {taskModalData?.task?.id && (
                                    <button
                                        onClick={() => {
                                            const tid = taskModalData.task.id;
                                            const resId = taskModalData.task.machine_id;
                                            setProdTab('task-details');
                                            if (resId) {
                                                setExplorerResType('machine');
                                                setExplorerResId(resId.toString());
                                            }
                                            if (taskModalData.task.scheduled_date) {
                                                setExplorerDate(taskModalData.task.scheduled_date.split('T')[0]);
                                            }
                                            if (tid) {
                                                setSelectedExplorerTaskId(tid);
                                            }
                                            setTaskModalId(null);
                                            setTaskModalData(null);
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                                        title="View in Detailed Task Explorer tab"
                                    >
                                        <FiExternalLink className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Open in Task Explorer</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => { setTaskModalId(null); setTaskModalData(null); }}
                                    className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] text-white/60 hover:text-white transition-colors cursor-pointer"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {taskModalLoading ? (
                                <div className="space-y-4 py-8">
                                    <Skel h="h-12" />
                                    <Skel h="h-12" />
                                    <Skel h="h-12" />
                                </div>
                            ) : taskModalData?.task ? (() => {
                                const t = taskModalData.task;
                                const modalTimelineElements = [];
                                if (taskModalData.logs) {
                                    taskModalData.logs.forEach((log, idx) => {
                                        modalTimelineElements.push({
                                            type: 'work',
                                            log,
                                            started_at: log.started_at,
                                            stopped_at: log.stopped_at,
                                            employee_name: log.employee_name,
                                            duration_seconds: log.duration_seconds
                                        });

                                        if (idx < taskModalData.logs.length - 1) {
                                            const nextLog = taskModalData.logs[idx + 1];
                                            if (log.stopped_at && nextLog.started_at) {
                                                const pauseStart = new Date(log.stopped_at);
                                                const pauseEnd = new Date(nextLog.started_at);
                                                const pauseMs = pauseEnd.getTime() - pauseStart.getTime();
                                                if (pauseMs > 30000) {
                                                    const pauseMins = Math.round(pauseMs / 60000);
                                                    modalTimelineElements.push({
                                                        type: 'pause',
                                                        started_at: log.stopped_at,
                                                        stopped_at: nextLog.started_at,
                                                        duration_minutes: pauseMins
                                                    });
                                                }
                                            }
                                        }
                                    });
                                }

                                return (
                                    <div className="space-y-5">
                                        {/* Task Description */}
                                        {t.description && (
                                            <div className="bg-black/30 border border-white/[0.05] rounded-xl p-3.5">
                                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Task Instructions / Specs</p>
                                                <p className="text-xs text-white/80 leading-relaxed">{t.description}</p>
                                            </div>
                                        )}

                                        {/* 4 Metrics Grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Estimated Time</p>
                                                <p className="text-lg font-bold text-white font-mono">{formatMins(t.estimated_minutes)}</p>
                                                <p className="text-[9px] text-white/35 mt-0.5">Planned limit</p>
                                            </div>

                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Logged Duration</p>
                                                <p className="text-lg font-bold text-white font-mono">
                                                    {t.actual_minutes != null ? formatMins(t.actual_minutes) : '—'}
                                                </p>
                                                <p className="text-[9px] text-white/35 mt-0.5">Active timer total</p>
                                            </div>

                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Planned Qty</p>
                                                <p className="text-lg font-bold text-white font-mono">
                                                    {t.run_quantity || t.quantity ? fmt(parseFloat(t.run_quantity || t.quantity)) : '—'}
                                                </p>
                                                <p className="text-[9px] text-white/35 mt-0.5">
                                                    {t.sheet_count ? `${fmt(parseFloat(t.sheet_count))} sheets` : 'Sheets: —'}
                                                </p>
                                            </div>

                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5">
                                                <p className="text-[9px] font-bold text-white/35 uppercase tracking-wider mb-1">Actual Output</p>
                                                <p className="text-lg font-bold text-emerald-400 font-mono">
                                                    {t.actual_sheets_printed ? fmt(parseFloat(t.actual_sheets_printed)) : (t.status === "done" ? fmt(parseFloat(t.quantity || 0)) : '—')}
                                                </p>
                                                <p className="text-[9px] text-white/35 mt-0.5">
                                                    {parseFloat(t.actual_sheets_wasted) > 0 ? (
                                                        <span className="text-red-400 font-semibold">Wasted: {fmt(parseFloat(t.actual_sheets_wasted))}</span>
                                                    ) : 'Wasted: —'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Details & Specifications Grid (3 Columns) */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Column 1: Resource & Config Details */}
                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-2.5">
                                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Resource & Config Details</p>
                                                <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                    <span className="text-white/35">Resource Name</span>
                                                    <span className="text-white font-semibold text-right truncate">
                                                        {t.machine_name || (t.machine_id ? `ID: ${t.machine_id}` : 'Finishing (Manual)')}
                                                    </span>

                                                    <span className="text-white/35">Type</span>
                                                    <span className="text-white font-semibold text-right capitalize">
                                                        {t.machine_type || 'Finishing'}
                                                    </span>

                                                    <span className="text-white/35">Planned Impressions</span>
                                                    <span className="text-white font-semibold text-right">
                                                        {t.impression_count ? Number(t.impression_count).toLocaleString() : '—'}
                                                    </span>

                                                    <span className="text-white/35">Speed Configuration</span>
                                                    <span className="text-white font-semibold text-right">
                                                        {t.custom_speed ? `${t.custom_speed} ${t.custom_speed_unit || 'sheets/hr'}` : 'Auto'}
                                                    </span>

                                                    <span className="text-white/35">Plates Used (CTP)</span>
                                                    <span className="text-white font-semibold text-right">
                                                        {t.actual_plates_used || '0'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Column 2: Operators & Downtime */}
                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-2.5">
                                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Operators & Downtime</p>
                                                <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                    <span className="text-white/35">Assigned Operator</span>
                                                    <span className="text-white font-semibold text-right truncate">{t.assigned_to || 'Unassigned'}</span>

                                                    <span className="text-white/35">Helper Name</span>
                                                    <span className="text-white font-semibold text-right truncate">{t.helper_name || 'None'}</span>

                                                    <span className="text-white/35">Completed By</span>
                                                    <span className="text-white font-semibold text-right truncate">{t.completed_by || '—'}</span>

                                                    <span className="text-white/35">Completed Helper</span>
                                                    <span className="text-white font-semibold text-right truncate">{t.completed_by_helper || '—'}</span>

                                                    <span className="text-white/35">Downtime Minutes</span>
                                                    <span className={`font-semibold text-right ${t.downtime_minutes ? 'text-red-400' : 'text-white'}`}>
                                                        {t.downtime_minutes || '0'}m
                                                    </span>
                                                </div>
                                                {t.downtime_minutes > 0 && t.downtime_reason && (
                                                    <div className="text-[11px] bg-red-500/10 border border-red-500/20 text-red-300 p-2 rounded-lg mt-2">
                                                        <strong>Reason:</strong> {t.downtime_reason}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Column 3: Overall Lifecycle Timestamps */}
                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-2.5">
                                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Overall Lifecycle Timestamps</p>
                                                <div className="grid grid-cols-2 gap-y-2 text-xs">
                                                    <span className="text-white/35">Task Started</span>
                                                    <span className="text-white font-semibold text-right truncate">
                                                        {formatDateTime(t.started_at)}
                                                    </span>

                                                    <span className="text-white/35">Task Completed</span>
                                                    <span className="text-white font-semibold text-right truncate">
                                                        {formatDateTime(t.completed_at)}
                                                    </span>

                                                    <span className="text-white/35">Created Date</span>
                                                    <span className="text-white font-semibold text-right truncate">
                                                        {formatDateTime(t.created_at)}
                                                    </span>

                                                    <span className="text-white/35">Scheduled Date</span>
                                                    <span className="text-white font-semibold text-right truncate">
                                                        {t.scheduled_date ? new Date(t.scheduled_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Work Log Timeline */}
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
                                            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
                                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Timer Execution Timeline</p>
                                                <span className="text-[10px] text-white/45">{modalTimelineElements.length} segments</span>
                                            </div>

                                            {modalTimelineElements.length === 0 ? (
                                                <div className="text-center py-6 text-xs text-white/35 italic">
                                                    No active timer logs recorded for this task.
                                                </div>
                                            ) : (
                                                <div className="relative pl-4 space-y-4 border-l border-white/10 mt-2">
                                                    {modalTimelineElements.map((item, idx) => {
                                                        if (item.type === 'work') {
                                                            const isRunning = !item.stopped_at;
                                                            const durMins = item.duration_seconds
                                                                ? Math.round(item.duration_seconds / 60)
                                                                : isRunning
                                                                    ? Math.max(0, Math.floor((Date.now() - new Date(item.started_at).getTime()) / 60000))
                                                                    : 0;

                                                            return (
                                                                <div key={`work-${idx}`} className="relative">
                                                                    {/* Dot */}
                                                                    <span className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border ${isRunning ? 'bg-amber-400 border-neutral-900 animate-pulse' : 'bg-emerald-400 border-neutral-900'
                                                                        }`} />

                                                                    <div className="flex items-start justify-between gap-4 text-xs">
                                                                        <div>
                                                                            <p className="font-semibold text-white">
                                                                                {item.employee_name} <span className="text-white/40 font-normal">started timer</span>
                                                                            </p>
                                                                            <p className="text-[10px] text-white/35 font-mono mt-0.5">
                                                                                {formatDateTime(item.started_at)} – {isRunning ? 'Running Now' : formatDateTime(item.stopped_at)}
                                                                            </p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className={`font-mono font-bold ${isRunning ? 'text-amber-400 animate-pulse' : 'text-white/60'}`}>
                                                                                {formatMins(durMins)}
                                                                            </span>
                                                                            <p className="text-[9px] text-white/20 mt-0.5">{isRunning ? 'Active' : 'Duration'}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <div key={`pause-${idx}`} className="relative">
                                                                    {/* Dash indicator */}
                                                                    <span className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full border border-orange-500/40 bg-neutral-950 flex items-center justify-center">
                                                                        <span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" />
                                                                    </span>

                                                                    <div className="flex items-start justify-between gap-4 text-xs bg-orange-500/5 border border-orange-500/10 rounded-lg p-2 ml-1">
                                                                        <div>
                                                                            <p className="font-semibold text-orange-300">
                                                                                Machine / Task Paused
                                                                            </p>
                                                                            <p className="text-[10px] text-orange-200/50 font-mono mt-0.5">
                                                                                {formatDateTime(item.started_at)} – {formatDateTime(item.stopped_at)}
                                                                            </p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="font-mono font-bold text-orange-400">
                                                                                {formatMins(item.duration_minutes)}
                                                                            </span>
                                                                            <p className="text-[9px] text-orange-400/50 mt-0.5">Idle / Pause</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })() : (
                                <p className="text-center py-8 text-white/30 text-xs">Task details not found.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Employee Performance Work Log Detail Modal */}
            {selectedEmpName && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/[0.08] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/[0.06] rounded-xl text-white">
                                    <FiUser className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{selectedEmpName}</h3>
                                    <p className="text-xs text-white/40">Work Session & Task Execution Log History</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setSelectedEmpName(null); setEmpModalData(null); }}
                                className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] text-white/60 hover:text-white transition-colors cursor-pointer"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {empModalLoading ? (
                                <div className="space-y-4 py-8">
                                    <Skel h="h-12" />
                                    <Skel h="h-12" />
                                    <Skel h="h-12" />
                                </div>
                            ) : empModalData ? (
                                <>
                                    {/* Employee Summary Banner */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Logged Work Logs</p>
                                            <p className="text-xl font-bold text-white mt-1">{empModalData.summary?.logCount || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Tasks Completed</p>
                                            <p className="text-xl font-bold text-white mt-1">{empModalData.summary?.completedTasks || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Total Active Time</p>
                                            <p className="text-xl font-bold text-white mt-1">{formatMins(empModalData.summary?.loggedSeconds > 0 ? Math.round(empModalData.summary.loggedSeconds / 60) : empModalData.summary?.actMinsRound)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Est. Output vs Act. Output</p>
                                            <p className="text-sm font-bold text-white mt-1 font-mono">
                                                {empModalData.summary?.estOutput > 0 || empModalData.summary?.actOutput > 0 ? `${fmt(empModalData.summary.estOutput)} / ${fmt(empModalData.summary.actOutput)}` : "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Efficiency Rating</p>
                                            <p className="text-xl font-bold text-white mt-1">
                                                {empModalData.summary?.efficiencyPct != null ? (empModalData.summary.efficiencyPct + "%") : "—"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Work Sessions Table */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Recorded Work Sessions</h4>
                                        {!empModalData.logs?.length ? (
                                            <div className="text-center py-8 text-white/30 text-xs">
                                                No individual work logs recorded for this operator in the selected period.
                                            </div>
                                        ) : (
                                            <div className="bg-black/30 border border-white/[0.06] rounded-xl overflow-hidden">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-white/[0.03] text-white/30 uppercase tracking-wider font-semibold border-b border-white/[0.06]">
                                                        <tr>
                                                            <th className="py-2.5 px-3">Date / Start Time</th>
                                                            <th className="py-2.5 px-3">Order / Customer</th>
                                                            <th className="py-2.5 px-3">Task Name</th>
                                                            <th className="py-2.5 px-3">Resource / Machine</th>
                                                            <th className="py-2.5 px-3 text-right">Session Duration</th>
                                                            <th className="py-2.5 px-3 text-center">Task Detail</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/[0.04]">
                                                        {empModalData.logs.map(log => (
                                                            <tr key={log.id} onClick={() => openTaskModal(log.task_id)} className="hover:bg-white/[0.06] transition-colors cursor-pointer group" title="Click to view full task details">
                                                                <td className="py-2.5 px-3 text-white/70 font-mono">
                                                                    {log.started_at ? new Date(log.started_at).toLocaleString() : "—"}
                                                                </td>
                                                                <td className="py-2.5 px-3">
                                                                    <p className="font-semibold text-white">{log.order_code || "—"}</p>
                                                                    <p className="text-[10px] text-white/30">{log.customer_name || "—"}</p>
                                                                </td>
                                                                <td className="py-2.5 px-3 text-white/80 font-medium">{log.task_name}</td>
                                                                <td className="py-2.5 px-3 text-white/50">{log.machine_name || "Finishing / Service"}</td>
                                                                <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                                                                    {formatMins(Math.round(log.duration_seconds / 60))}
                                                                </td>
                                                                <td className="py-2.5 px-3 text-center">
                                                                    <button onClick={(e) => { e.stopPropagation(); openTaskModal(log.task_id); }} className="px-2 py-1 bg-white/[0.06] group-hover:bg-white/[0.12] border border-white/[0.08] rounded text-[11px] text-white/70 group-hover:text-white transition-all">View Task</button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

function MachinePartsList({ machineId, parts = [], onRefresh }) {
    const [isAdding, setIsAdding] = useState(false);
    const [name, setName] = useState('');
    const [runLimit, setRunLimit] = useState('');
    const [hoursLimit, setHoursLimit] = useState('');

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/machines/${machineId}/parts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    part_name: name,
                    limit_run_quantity: runLimit || null,
                    limit_hours: hoursLimit || null
                })
            });
            if (res.ok) {
                toast.success('Machine part added successfully');
                setName('');
                setRunLimit('');
                setHoursLimit('');
                setIsAdding(false);
                onRefresh();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to add part');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        }
    };

    const handleReplace = async (partId) => {
        if (!confirm('Are you sure you have replaced this part? This will reset the run and time balances.')) return;
        try {
            const res = await fetch(`/api/machines/${machineId}/parts/${partId}/replace`, {
                method: 'POST'
            });
            if (res.ok) {
                toast.success('Part wear balance reset successfully');
                onRefresh();
            } else {
                toast.error('Failed to replace part');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        }
    };

    const handleDelete = async (partId) => {
        if (!confirm('Are you sure you want to delete this part?')) return;
        try {
            const res = await fetch(`/api/machines/${machineId}/parts/${partId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success('Part deleted successfully');
                onRefresh();
            } else {
                toast.error('Failed to delete part');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                    <h3 className="font-semibold text-white text-sm">Machine Lifespan Parts</h3>
                    <p className="text-xs text-white/30">Track wear on rollers, blades, plates, etc.</p>
                </div>
            </div>

            {/* Add Part Area */}
            {isAdding ? (
                <form onSubmit={handleAdd} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-1">
                        <h5 className="text-xs font-bold text-white uppercase tracking-wider">New Machine Part</h5>
                        <button type="button" onClick={() => setIsAdding(false)} className="text-white/40 hover:text-white"><FiX className="w-4 h-4" /></button>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Part Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Suction Belts"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Run Limit (optional)</label>
                            <input
                                type="number"
                                min="1"
                                value={runLimit}
                                onChange={e => setRunLimit(e.target.value)}
                                placeholder="e.g. 100000"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Hours Limit (optional)</label>
                            <input
                                type="number"
                                min="1"
                                value={hoursLimit}
                                onChange={e => setHoursLimit(e.target.value)}
                                placeholder="e.g. 200"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-3 py-1.5 text-[10.5px] border border-white/10 hover:bg-white/5 rounded text-white/60 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-1.5 text-[10.5px] bg-white text-black font-bold rounded hover:opacity-90 transition-colors"
                        >
                            Add Part
                        </button>
                    </div>
                </form>
            ) : (
                <button
                    onClick={() => setIsAdding(true)}
                    className="w-full py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-dashed border-white/10 hover:border-white/20 rounded-xl text-xs text-white/60 hover:text-white flex items-center justify-center gap-1.5 transition-all"
                >
                    <FiPlus className="w-3.5 h-3.5" /> Add Machine Part
                </button>
            )}

            {/* Parts Cards List */}
            <div className="space-y-3">
                {parts.length === 0 ? (
                    <p className="text-center text-white/20 text-xs py-8 bg-white/[0.01] border border-dashed border-white/5 rounded-xl">No parts tracked for this machine yet.</p>
                ) : (
                    parts.map(part => {
                        let remainingPct = 100;
                        const runPct = part.limit_run_quantity > 0 ? (part.balance_run_quantity / part.limit_run_quantity) * 100 : null;
                        const hoursPct = part.limit_hours > 0 ? (part.balance_hours / part.limit_hours) * 100 : null;

                        if (runPct !== null && hoursPct !== null) {
                            remainingPct = Math.min(runPct, hoursPct);
                        } else if (runPct !== null) {
                            remainingPct = runPct;
                        } else if (hoursPct !== null) {
                            remainingPct = hoursPct;
                        }
                        remainingPct = Math.max(0, Math.min(100, remainingPct));

                        return (
                            <div key={part.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h4 className="font-semibold text-white text-sm">{part.part_name}</h4>
                                        <p className="text-[10px] text-white/30">Last changed: {part.last_changed_at ? new Date(part.last_changed_at).toLocaleDateString() : 'Never'}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => handleReplace(part.id)}
                                            className="px-2.5 py-1 text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
                                        >
                                            Replace Part
                                        </button>
                                        <button
                                            onClick={() => handleDelete(part.id)}
                                            className="p-1 text-white/30 hover:text-red-400 rounded transition-colors"
                                            title="Remove Part"
                                        >
                                            <FiTrash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-white/40">Lifespan Remaining</span>
                                        <span className={`font-bold ${remainingPct <= 15 ? 'text-red-400 animate-pulse' : remainingPct <= 50 ? 'text-amber-400' : 'text-emerald-400'
                                            }`}>{Math.round(remainingPct)}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${remainingPct <= 15 ? 'bg-red-500' : remainingPct <= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`}
                                            style={{ width: `${remainingPct}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-1 text-[11px] text-white/50">
                                    {part.limit_run_quantity !== null && (
                                        <div>
                                            <span className="text-white/25 block text-[9px] uppercase font-bold">Run Balance</span>
                                            <span className="font-mono text-white/80">{Math.round(part.balance_run_quantity).toLocaleString()}</span> / {Math.round(part.limit_run_quantity).toLocaleString()} runs
                                        </div>
                                    )}
                                    {part.limit_hours !== null && (
                                        <div>
                                            <span className="text-white/25 block text-[9px] uppercase font-bold">Hours Balance</span>
                                            <span className="font-mono text-white/80">{Number(part.balance_hours).toFixed(1)}</span> / {Number(part.limit_hours).toFixed(1)} hrs
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
