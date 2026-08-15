'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    FiPrinter, FiLayers, FiCpu, FiSettings, FiSearch, FiX,
    FiCamera, FiPlay, FiPause, FiCheckCircle, FiClock,
    FiAlertTriangle, FiCheck, FiArrowLeft, FiLogOut,
    FiChevronDown, FiChevronUp, FiCalendar
} from 'react-icons/fi';
import { Html5Qrcode } from 'html5-qrcode';

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function toLocalDt(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function nowDt() { return toLocalDt(new Date().toISOString()); }
function getTodayDateStr() { return new Date().toISOString().slice(0, 10); }

const MACHINE_CATEGORIES = {
    offset: { name: 'Offset Press', icon: <FiPrinter className="w-4 h-4 text-emerald-400" /> },
    digital: { name: 'Digital Press', icon: <FiPrinter className="w-4 h-4 text-emerald-400" /> },
    prepress: { name: 'Pre-Press', icon: <FiCpu className="w-4 h-4 text-emerald-400" /> },
    finishing: { name: 'Finishing Machines', icon: <FiLayers className="w-4 h-4 text-emerald-400" /> },
    other: { name: 'Other Machines', icon: <FiSettings className="w-4 h-4 text-emerald-400" /> },
    standalone_finishing: { name: 'Manual Finishing Processes', icon: <FiLayers className="w-4 h-4 text-emerald-400" /> }
};

export default function OperatorConsole() {
    const router = useRouter();
    const [machines, setMachines] = useState([]);
    const [finishings, setFinishings] = useState([]);
    const [selectedTarget, setSelectedTarget] = useState(null); // { type: 'machine'|'finishing', id, name }
    const [selectedDate, setSelectedDate] = useState(getTodayDateStr());

    // Collapsible category state: true = collapsed
    const [collapsedCats, setCollapsedCats] = useState({});

    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'running', 'done'
    const [searchQuery, setSearchQuery] = useState('');

    // Scanner state
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState('');

    // Task actions/modals state
    const [startTaskModal, setStartTaskModal] = useState(null); // task to start
    const [startTime, setStartTime] = useState(nowDt());
    const [startAssignee, setStartAssignee] = useState('');
    const [startHelper, setStartHelper] = useState('');

    const [quickDoneTaskModal, setQuickDoneTaskModal] = useState(null); // task for quick completion
    const [quickDoneTime, setQuickDoneTime] = useState(nowDt());

    const [completingTask, setCompletingTask] = useState(null); // task for log & finish
    const [completionTime, setCompletionTime] = useState(nowDt());
    const [actualSheets, setActualSheets] = useState('');
    const [actualWastage, setActualWastage] = useState('');
    const [actualPlates, setActualPlates] = useState('');
    const [downtimeMinutes, setDowntimeMinutes] = useState('0');
    const [downtimeReason, setDowntimeReason] = useState('None');
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch machines & finishings on mount
    useEffect(() => {
        setLoading(true);
        fetch('/api/operator/machines')
            .then(res => res.ok ? res.json() : { machines: [], finishings: [] })
            .then(data => {
                const mList = data.machines || [];
                const fList = data.finishings || [];
                setMachines(mList);
                setFinishings(fList);
            })
            .catch(err => {
                console.error('Failed to load configurations:', err);
                setError('Failed to load machines & finishings.');
            })
            .finally(() => setLoading(false));
    }, []);

    // Fetch tasks whenever selected target or selected date changes
    useEffect(() => {
        if (!selectedTarget) {
            setTasks([]);
            return;
        }
        loadTasks();
    }, [selectedTarget, selectedDate]);

    // Handle QR scanner lifecycle
    useEffect(() => {
        let html5Qrcode = null;
        if (scanning) {
            const timer = setTimeout(() => {
                try {
                    setScanError('');
                    html5Qrcode = new Html5Qrcode('qr-reader-container');
                    html5Qrcode.start(
                        { facingMode: 'environment' },
                        { fps: 10, qrbox: { width: 250, height: 250 } },
                        (decodedText) => {
                            handleScanSuccess(decodedText);
                            if (html5Qrcode && html5Qrcode.isScanning) {
                                html5Qrcode.stop().then(() => setScanning(false)).catch(console.error);
                            }
                        },
                        () => { }
                    ).catch(err => {
                        console.error('Failed to start camera:', err);
                        setScanError(String(err.message || err));
                    });
                } catch (e) {
                    console.error('Html5Qrcode init error:', e);
                    setScanError(String(e.message || e));
                }
            }, 300);

            return () => {
                clearTimeout(timer);
                if (html5Qrcode && html5Qrcode.isScanning) {
                    html5Qrcode.stop().catch(console.error);
                }
            };
        }
    }, [scanning]);

    const loadTasks = async () => {
        if (!selectedTarget) return;
        setLoading(true);
        setError('');
        try {
            let url = '';
            if (selectedTarget.type === 'machine') {
                url = `/api/operator/tasks?machineId=${selectedTarget.id}&date=${selectedDate}`;
            } else {
                url = `/api/operator/tasks?finishingId=${selectedTarget.id}&date=${selectedDate}`;
            }

            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to load tasks');
            const data = await res.json();
            setTasks(data.tasks || []);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
            setError('Could not retrieve task queue for selected date.');
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (catKey) => {
        setCollapsedCats(prev => {
            const isCurrentlyCollapsed = prev[catKey] !== false; // defaults to true (collapsed)
            return { ...prev, [catKey]: !isCurrentlyCollapsed };
        });
    };

    const handleSelectTarget = (target) => {
        setSelectedTarget(target);
        localStorage.setItem('operator_selected_target', JSON.stringify(target));
    };

    const handleChangeTarget = () => {
        setSelectedTarget(null);
        localStorage.removeItem('operator_selected_target');
        setTasks([]);
    };

    const handleScanSuccess = async (text) => {
        setScanning(false);
        setSearchQuery(text);

        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/operator/tasks?search=${encodeURIComponent(text)}`);
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();

            if (data.tasks && data.tasks.length > 0) {
                setTasks(data.tasks);
                setActiveTab('queue');
            } else {
                setError('No active tasks found matching this scan.');
                loadTasks();
            }
        } catch (err) {
            console.error('Scan query error:', err);
            setError('Error resolving scan content.');
            loadTasks();
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            loadTasks();
            return;
        }
        handleScanSuccess(searchQuery);
    };

    /* ── Task Actions ───────────────────────────────────────────────────────── */
    const handleOpenStartModal = (task) => {
        setStartTaskModal(task);
        setStartTime(nowDt());
        setStartAssignee(task.assigned_to || '');
        setStartHelper(task.helper_name || '');
    };

    const handleConfirmStart = async () => {
        if (!startTaskModal) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/sales-orders/${startTaskModal.sales_order_id || 'unassigned'}/tasks/${startTaskModal.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'in_progress',
                    started_at: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
                    assigned_to: startAssignee || null,
                    helper_name: startHelper || null
                })
            });
            if (!res.ok) throw new Error('Failed to start task');

            setStartTaskModal(null);
            await loadTasks();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handlePauseTask = async (task) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/sales-orders/${task.sales_order_id || 'unassigned'}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'paused' })
            });
            if (!res.ok) throw new Error('Failed to pause task');

            await loadTasks();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenQuickDoneModal = (task) => {
        setQuickDoneTaskModal(task);
        setQuickDoneTime(nowDt());
    };

    const handleConfirmQuickDone = async () => {
        if (!quickDoneTaskModal) return;
        const task = quickDoneTaskModal;

        setActionLoading(true);
        try {
            const estSheets = task.sheet_count != null ? parseFloat(task.sheet_count) : 0;
            const estWastage = task.wastage_sheets != null ? parseFloat(task.wastage_sheets) : 0;
            const estPlates = task.plate_count != null ? parseInt(task.plate_count) : 0;

            const res = await fetch(`/api/sales-orders/${task.sales_order_id || 'unassigned'}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'done',
                    actual_sheets_printed: estSheets - estWastage > 0 ? estSheets - estWastage : estSheets,
                    actual_sheets_wasted: estWastage,
                    actual_plates_used: estPlates,
                    downtime_minutes: 0,
                    downtime_reason: 'None',
                    completed_at: quickDoneTime ? new Date(quickDoneTime).toISOString() : new Date().toISOString()
                })
            });
            if (!res.ok) throw new Error('Failed to complete task');

            setQuickDoneTaskModal(null);
            await loadTasks();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenCompleteModal = (task) => {
        setCompletingTask(task);
        setCompletionTime(nowDt());
        setActualSheets(task.sheet_count != null ? String(task.sheet_count) : '');
        setActualWastage(task.wastage_sheets != null ? String(task.wastage_sheets) : '0');
        setActualPlates(task.plate_count != null ? String(task.plate_count) : '0');
        setDowntimeMinutes('0');
        setDowntimeReason('None');
    };

    const handleSubmitCompletion = async (e) => {
        e.preventDefault();
        if (!completingTask) return;

        setActionLoading(true);
        try {
            const res = await fetch(`/api/sales-orders/${completingTask.sales_order_id || 'unassigned'}/tasks/${completingTask.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'done',
                    actual_sheets_printed: actualSheets !== '' ? parseFloat(actualSheets) : null,
                    actual_sheets_wasted: actualWastage !== '' ? parseFloat(actualWastage) : null,
                    actual_plates_used: actualPlates !== '' ? parseInt(actualPlates) : null,
                    downtime_minutes: parseInt(downtimeMinutes) || 0,
                    downtime_reason: downtimeReason !== 'None' ? downtimeReason : null,
                    completed_at: completionTime ? new Date(completionTime).toISOString() : new Date().toISOString()
                })
            });
            if (!res.ok) throw new Error('Failed to complete task');

            setCompletingTask(null);
            await loadTasks();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Filter tasks based on selected tab
    const filteredTasks = tasks.filter(t => {
        if (activeTab === 'running') return t.status === 'in_progress';
        if (activeTab === 'done') return t.status === 'done';
        return t.status === 'pending' || t.status === 'paused';
    });

    return (
        <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans select-none relative pb-10">
            {/* Subtle background ambient light */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[100px]" />
            </div>

            {/* Top Navigation Header */}
            <header className="sticky top-0 z-40 bg-neutral-900/90 backdrop-blur-md border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    {selectedTarget && (
                        <button
                            onClick={handleChangeTarget}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                            title="Back to Machine / Process list"
                        >
                            <FiArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-base font-bold tracking-tight text-white m-0 flex items-center gap-2">
                            Pressmatics Console
                        </h1>
                        <p className="text-[10px] text-neutral-400 m-0 uppercase tracking-wider font-semibold">
                            {selectedTarget ? `${selectedTarget.type === 'machine' ? 'Machine' : 'Process'}: ${selectedTarget.name}` : 'Shop Floor Management'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push('/dashboard/resources')}
                        className="p-2 bg-white/5 border border-white/10 text-blue-400 hover:bg-white/10 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                        title="Open Resources Explorer"
                    >
                        <FiLayers className="w-4 h-4 text-blue-400" />
                        <span className="hidden sm:inline">Resources</span>
                    </button>
                    {selectedTarget && (
                        <button
                            onClick={() => { setScanError(''); setScanning(true); }}
                            className="p-2 bg-white/5 border border-white/10 text-emerald-400 hover:bg-white/10 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
                            title="Scan Ticket QR"
                        >
                            <FiCamera className="w-4 h-4 text-emerald-400" />
                            <span>Scan</span>
                        </button>
                    )}
                    <button
                        onClick={() => {
                            document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                            router.push('/login');
                        }}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-neutral-400 hover:text-white transition-all"
                        title="Sign Out"
                    >
                        <FiLogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Main Container */}
            <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 z-10 relative">
                {/* 1. Collapsible Machine & Finishing Selection */}
                {!selectedTarget ? (
                    <div className="space-y-5 animate-[fadeIn_0.3s_ease]">
                        <div className="text-center space-y-1 py-2">
                            <h2 className="text-xl font-extrabold text-white">Select Operation</h2>
                            <p className="text-xs text-neutral-400">Select a machine or finishing process to view planned tasks.</p>
                        </div>

                        {loading ? (
                            <div className="py-20 text-center text-neutral-400">
                                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                <p className="text-xs text-neutral-400 font-medium">Loading available operations...</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {Object.keys(MACHINE_CATEGORIES).map((catKey) => {
                                    let items = [];
                                    if (catKey === 'standalone_finishing') {
                                        items = finishings.map(f => ({ type: 'finishing', id: f.id, name: f.name }));
                                    } else {
                                        items = (machines || [])
                                            .filter(m => m.type === catKey || (!MACHINE_CATEGORIES[m.type] && catKey === 'other'))
                                            .map(m => ({ type: 'machine', id: m.id, name: m.name, machineType: m.type }));
                                    }

                                    if (items.length === 0) return null;
                                    const isCollapsed = collapsedCats[catKey] !== false; // collapsed by default

                                    return (
                                        <div key={catKey} className="bg-neutral-900/60 border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg">
                                            {/* Category Accordion Header */}
                                            <button
                                                onClick={() => toggleCategory(catKey)}
                                                className="w-full px-4 py-3 bg-neutral-900 hover:bg-neutral-800/80 border-b border-white/[0.06] flex items-center justify-between transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-emerald-400">
                                                        {MACHINE_CATEGORIES[catKey].icon}
                                                    </div>
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                                                        {MACHINE_CATEGORIES[catKey].name} ({items.length})
                                                    </h3>
                                                </div>
                                                <div className="text-neutral-400">
                                                    {isCollapsed ? <FiChevronDown className="w-4 h-4" /> : <FiChevronUp className="w-4 h-4" />}
                                                </div>
                                            </button>

                                            {/* Collapsible Content Grid */}
                                            {!isCollapsed && (
                                                <div className="p-3 grid grid-cols-2 gap-2.5 bg-black/40">
                                                    {items.map((item) => (
                                                        <button
                                                            key={`${item.type}-${item.id}`}
                                                            onClick={() => handleSelectTarget(item)}
                                                            className="bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/50 hover:bg-emerald-500/5 active:scale-95 p-3.5 rounded-xl flex flex-col items-center justify-center text-center gap-2 transition-all group"
                                                        >
                                                            <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg group-hover:bg-emerald-500/10 transition-colors">
                                                                {item.type === 'finishing' ? (
                                                                    <FiLayers className="w-5 h-5 text-neutral-300 group-hover:text-emerald-400" />
                                                                ) : (
                                                                    <FiPrinter className="w-5 h-5 text-neutral-300 group-hover:text-emerald-400" />
                                                                )}
                                                            </div>
                                                            <div className="font-bold text-xs text-neutral-200 group-hover:text-white leading-tight">
                                                                {item.name}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    /* 2. Tasks View Screen */
                    <div className="space-y-4 animate-[fadeIn_0.3s_ease]">
                        {/* Date Selector & Search Bar */}
                        <div className="bg-neutral-900/60 border border-white/[0.08] p-3 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-bold uppercase tracking-wider">
                                    <FiCalendar className="w-4 h-4 text-emerald-400" />
                                    <span>Planned Date</span>
                                </div>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="px-3 py-1.5 bg-black border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-emerald-500 [color-scheme:dark]"
                                />
                            </div>

                            <form onSubmit={handleSearchSubmit} className="flex gap-2">
                                <div className="relative flex-1">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                    <input
                                        type="text"
                                        placeholder="Search SO code, task name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-8 py-2 bg-black border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 outline-none focus:border-emerald-500 transition-all"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => { setSearchQuery(''); loadTasks(); }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5"
                                        >
                                            <FiX className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    className="px-3.5 bg-white/5 border border-white/10 text-neutral-200 hover:bg-white/10 rounded-xl text-xs font-bold transition-all"
                                >
                                    Search
                                </button>
                            </form>
                        </div>

                        {/* Navigation / Filter Tabs */}
                        <div className="flex bg-neutral-900/80 p-1 rounded-xl border border-white/[0.08] gap-1">
                            <button
                                onClick={() => setActiveTab('queue')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center ${activeTab === 'queue'
                                    ? 'bg-neutral-800 text-white shadow border border-white/10'
                                    : 'text-neutral-400 hover:text-white'
                                    }`}
                            >
                                Up Next ({tasks.filter(t => t.status === 'pending' || t.status === 'paused').length})
                            </button>
                            <button
                                onClick={() => setActiveTab('running')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center relative ${activeTab === 'running'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'text-neutral-400 hover:text-white'
                                    }`}
                            >
                                Running ({tasks.filter(t => t.status === 'in_progress').length})
                                {tasks.filter(t => t.status === 'in_progress').length > 0 && (
                                    <span className="absolute top-1 right-2 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('done')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center ${activeTab === 'done'
                                    ? 'bg-neutral-800 text-white shadow border border-white/10'
                                    : 'text-neutral-400 hover:text-white'
                                    }`}
                            >
                                Done ({tasks.filter(t => t.status === 'done').length})
                            </button>
                        </div>

                        {/* Error Indicator */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-xl flex gap-2 text-red-400 text-xs">
                                <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>{error}</div>
                            </div>
                        )}

                        {/* Task Cards List */}
                        {loading ? (
                            <div className="py-16 text-center text-neutral-400">
                                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-xs text-neutral-400 font-medium">Updating planned tasks...</p>
                            </div>
                        ) : filteredTasks.length === 0 ? (
                            <div className="py-16 text-center text-neutral-500 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                                <FiCheckCircle className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                                <p className="text-xs font-medium text-neutral-400">No tasks in this list for {selectedDate}.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className={`bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3 transition-all relative overflow-hidden ${task.status === 'in_progress' ? 'border-emerald-500/40 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : ''
                                            }`}
                                    >
                                        {/* Status shimmer border for active jobs */}
                                        {task.status === 'in_progress' && (
                                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-emerald-300 to-emerald-500 animate-pulse" />
                                        )}

                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-extrabold text-neutral-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                        {task.order_code || `SO #${task.sales_order_id}`}
                                                    </span>
                                                    {task.delivery_date && (
                                                        <span className="text-[9px] text-neutral-400">
                                                            Due: {new Date(task.delivery_date).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-sm font-bold text-white mt-1.5 leading-snug">{task.name.split('—')[2]}</h3>
                                                {task.name?.includes('—') && task.name.split('—')[1] && (
                                                    <h4 className="text-xs font-semibold text-neutral-400 mt-0.5 leading-snug">
                                                        {task.name.split('—')[1].trim()}
                                                    </h4>
                                                )}
                                                <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{task.customer_name}</p>
                                            </div>

                                            {/* Status Badge */}
                                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 border ${task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                task.status === 'in_progress' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 animate-pulse' :
                                                    task.status === 'paused' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                                                        'bg-white/5 text-neutral-400 border-white/10'
                                                }`}>
                                                {task.status?.replace('_', ' ')}
                                            </span>
                                        </div>

                                        {/* Description / Extra Details */}
                                        {task.description && (
                                            <div className="text-[11px] text-neutral-400 font-medium bg-black/40 border border-white/[0.04] p-2.5 rounded-xl leading-relaxed">
                                                {task.description}
                                            </div>
                                        )}

                                        {/* Estimation Details Grid */}
                                        {(task.sheet_count > 0 || task.plate_count > 0 || task.quantity > 0) && (
                                            <div className="grid grid-cols-3 gap-2 bg-black/40 border border-white/[0.06] p-2.5 rounded-xl text-center">
                                                {task.sheet_count > 0 && (
                                                    <div>
                                                        <span className="text-[9px] text-neutral-400 block font-semibold uppercase">Est. Sheets</span>
                                                        <span className="text-xs font-bold text-neutral-200">{task.sheet_count}</span>
                                                    </div>
                                                )}
                                                {task.plate_count > 0 && (
                                                    <div>
                                                        <span className="text-[9px] text-neutral-400 block font-semibold uppercase">Est. Plates</span>
                                                        <span className="text-xs font-bold text-neutral-200">{task.plate_count}</span>
                                                    </div>
                                                )}
                                                {task.quantity > 0 && (
                                                    <div>
                                                        <span className="text-[9px] text-neutral-400 block font-semibold uppercase">Est. Output</span>
                                                        <span className="text-xs font-bold text-neutral-200">{task.quantity}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Task Action Buttons */}
                                        {task.status !== 'done' && (
                                            <div className="flex gap-2 pt-1">
                                                {(task.status === 'pending' || task.status === 'paused') && (
                                                    <button
                                                        onClick={() => handleOpenStartModal(task)}
                                                        disabled={actionLoading}
                                                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                                                    >
                                                        <FiPlay className="w-3.5 h-3.5 fill-current" />
                                                        <span>Start Job</span>
                                                    </button>
                                                )}

                                                {task.status === 'in_progress' && (
                                                    <>
                                                        <button
                                                            onClick={() => handlePauseTask(task)}
                                                            disabled={actionLoading}
                                                            className="px-3.5 py-2.5 bg-neutral-900 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold text-neutral-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                                        >
                                                            <FiPause className="w-3.5 h-3.5 fill-current" />
                                                            <span>Pause</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleOpenQuickDoneModal(task)}
                                                            disabled={actionLoading}
                                                            className="px-3.5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-neutral-300 flex items-center justify-center gap-1 transition-all cursor-pointer"
                                                            title="Quick complete with estimated quantities"
                                                        >
                                                            <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
                                                            <span>Quick Done</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleOpenCompleteModal(task)}
                                                            disabled={actionLoading}
                                                            className="flex-1 py-2.5 bg-emerald-600 border border-emerald-500 hover:bg-emerald-500 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-950/30"
                                                        >
                                                            <FiCheckCircle className="w-3.5 h-3.5" />
                                                            <span>Log &amp; Finish</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ── MODAL 1: START TASK MODAL ────────────────────────────────────────── */}
            {startTaskModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setStartTaskModal(null)}>
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl text-neutral-100" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                                    <FiPlay className="w-4 h-4 text-emerald-400 fill-current" />
                                    Start Task
                                </h3>
                                <p className="text-[10px] text-neutral-400 mt-0.5">Confirm start time and assignment</p>
                            </div>
                            <button onClick={() => setStartTaskModal(null)} className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-400 hover:text-white"><FiX className="w-4 h-4" /></button>
                        </div>

                        <div className="bg-black border border-white/10 p-3 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-white">{startTaskModal.name}</div>
                            <div className="text-[10px] text-neutral-400 font-mono">SO Code: {startTaskModal.order_code || '—'}</div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Start Time</label>
                                <input
                                    type="datetime-local"
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                    className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Assigned Operator</label>
                                <input
                                    type="text"
                                    value={startAssignee}
                                    onChange={e => setStartAssignee(e.target.value)}
                                    placeholder="Operator Name..."
                                    className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Helper / Assistant (Optional)</label>
                                <input
                                    type="text"
                                    value={startHelper}
                                    onChange={e => setStartHelper(e.target.value)}
                                    placeholder="Helper Name..."
                                    className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setStartTaskModal(null)}
                                className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-neutral-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmStart}
                                disabled={actionLoading}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-xl text-xs font-bold text-white transition-all"
                            >
                                {actionLoading ? 'Starting...' : 'Confirm & Start'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL 2: QUICK DONE MODAL ───────────────────────────────────────── */}
            {quickDoneTaskModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQuickDoneTaskModal(null)}>
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl text-neutral-100" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                                    <FiCheck className="w-4 h-4 text-emerald-400" />
                                    Quick Complete
                                </h3>
                                <p className="text-[10px] text-neutral-400 mt-0.5">Complete task using estimated production values</p>
                            </div>
                            <button onClick={() => setQuickDoneTaskModal(null)} className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-400 hover:text-white"><FiX className="w-4 h-4" /></button>
                        </div>

                        <div className="bg-black border border-white/10 p-3 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-white">{quickDoneTaskModal.name}</div>
                            <div className="text-[10px] text-neutral-400 font-mono">SO Code: {quickDoneTaskModal.order_code || '—'}</div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Completed Time</label>
                            <input
                                type="datetime-local"
                                value={quickDoneTime}
                                onChange={e => setQuickDoneTime(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]"
                            />
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setQuickDoneTaskModal(null)}
                                className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-neutral-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmQuickDone}
                                disabled={actionLoading}
                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-xl text-xs font-bold text-white transition-all"
                            >
                                {actionLoading ? 'Completing...' : 'Mark Done'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL 3: LOG & FINISH MODAL ─────────────────────────────────────── */}
            {completingTask && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCompletingTask(null)}>
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl text-neutral-100" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                                    <FiCheckCircle className="w-4 h-4 text-emerald-400" />
                                    Log &amp; Finish Task
                                </h3>
                                <p className="text-[10px] text-neutral-400 mt-0.5">Enter actual production numbers to close task #{completingTask.id}</p>
                            </div>
                            <button onClick={() => setCompletingTask(null)} className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-400 hover:text-white"><FiX className="w-4 h-4" /></button>
                        </div>

                        <div className="bg-black border border-white/10 p-3 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-white">{completingTask.name}</div>
                            <div className="text-[10px] text-neutral-400 font-mono">SO: {completingTask.order_code || '—'}</div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Completed Time</label>
                            <input
                                type="datetime-local"
                                value={completionTime}
                                onChange={e => setCompletionTime(e.target.value)}
                                className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]"
                            />
                        </div>

                        <form onSubmit={handleSubmitCompletion} className="space-y-3">
                            {(completingTask.sheet_count > 0 || completingTask.name.toLowerCase().includes('printing')) && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Printed Sheets</label>
                                        <input
                                            type="number"
                                            value={actualSheets}
                                            onChange={e => setActualSheets(e.target.value)}
                                            placeholder="Quantity"
                                            className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Wastage Sheets</label>
                                        <input
                                            type="number"
                                            value={actualWastage}
                                            onChange={e => setActualWastage(e.target.value)}
                                            placeholder="Wastage"
                                            className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {(completingTask.plate_count > 0 || completingTask.name.toLowerCase().includes('plate') || completingTask.name.toLowerCase().includes('offset')) && (
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Actual Plates Used</label>
                                    <input
                                        type="number"
                                        value={actualPlates}
                                        onChange={e => setActualPlates(e.target.value)}
                                        placeholder="Plates"
                                        className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                                        required
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Downtime (Min)</label>
                                    <input
                                        type="number"
                                        value={downtimeMinutes}
                                        onChange={e => setDowntimeMinutes(e.target.value)}
                                        placeholder="Minutes"
                                        className="w-full px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Downtime Reason</label>
                                    <select
                                        value={downtimeReason}
                                        onChange={e => setDowntimeReason(e.target.value)}
                                        className="w-full px-2 py-2 bg-black border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500 [color-scheme:dark]"
                                    >
                                        <option value="None">None (Smooth run)</option>
                                        <option value="Paper Jam">Paper Jam</option>
                                        <option value="Plate Break">Plate Break</option>
                                        <option value="Ink Washup">Ink Washup</option>
                                        <option value="Machine Stoppage">Machine Stoppage</option>
                                        <option value="Preflight Issue">Preflight Issue</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={actionLoading}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                            >
                                <FiCheckCircle className="w-4 h-4" />
                                <span>{actionLoading ? 'Saving...' : 'Submit & Mark Completed'}</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL 4: QR SCANNER OVERLAY ────────────────────────────────────── */}
            {scanning && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 overflow-y-auto">
                    <div className="flex items-center justify-between text-white pb-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Scan Job Ticket QR</h2>
                        <button
                            onClick={() => setScanning(false)}
                            className="p-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="w-full max-w-sm mx-auto space-y-4 my-auto">
                        {scanError ? (
                            <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl text-center space-y-3">
                                <FiAlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                                <div className="text-xs font-bold text-white">Camera Access Blocked</div>
                                <p className="text-[10px] text-neutral-400 leading-relaxed">
                                    Camera permission was denied or is blocked by your browser settings.
                                    Browsers require HTTPS connection to access physical cameras.
                                </p>
                            </div>
                        ) : (
                            <div className="relative w-full aspect-square overflow-hidden rounded-3xl border border-white/20 shadow-2xl bg-neutral-900">
                                <div id="qr-reader-container" className="w-full h-full relative">
                                    <div className="absolute inset-8 border-2 border-emerald-500/50 rounded-2xl pointer-events-none z-10 flex items-center justify-center">
                                        <div className="w-full h-0.5 bg-emerald-400 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-neutral-900 border border-white/10 p-4 rounded-2xl space-y-2.5">
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                Manual Code Input
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="SO-0142..."
                                    id="modal-manual-input"
                                    className="flex-1 px-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white placeholder-neutral-600 outline-none focus:border-emerald-500"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.target.value;
                                            if (val) handleScanSuccess(val);
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const val = document.getElementById('modal-manual-input')?.value;
                                        if (val) handleScanSuccess(val);
                                    }}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-xl text-xs font-bold text-white transition-all"
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
