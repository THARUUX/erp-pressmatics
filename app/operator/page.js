'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    FiPrinter, FiLayers, FiCpu, FiSettings, FiSearch, FiX,
    FiCamera, FiPlay, FiPause, FiCheckCircle, FiClock,
    FiAlertTriangle, FiRefreshCw, FiCheck, FiArrowLeft,
    FiLogOut, FiUser
} from 'react-icons/fi';
import { Html5Qrcode } from 'html5-qrcode';

const MACHINE_CATEGORIES = {
    prepress: { name: 'Pre-Press', icon: <FiCpu className="w-4 h-4 text-cyan-400" /> },
    offset: { name: 'Offset Press', icon: <FiPrinter className="w-4 h-4 text-emerald-400" /> },
    digital: { name: 'Digital Press', icon: <FiPrinter className="w-4 h-4 text-violet-400" /> },
    finishing: { name: 'Finishing & Post-Press', icon: <FiLayers className="w-4 h-4 text-amber-400" /> },
    other: { name: 'Other Stations', icon: <FiSettings className="w-4 h-4 text-neutral-400" /> }
};

export default function OperatorConsole() {
    const router = useRouter();
    const [machines, setMachines] = useState([]);
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'running', 'done'
    const [searchQuery, setSearchQuery] = useState('');

    // Scanner state
    const [scanning, setScanning] = useState(false);
    const [scanError, setScanError] = useState('');

    // Task actions/completion state
    const [completingTask, setCompletingTask] = useState(null);
    const [actualSheets, setActualSheets] = useState('');
    const [actualWastage, setActualWastage] = useState('');
    const [actualPlates, setActualPlates] = useState('');
    const [downtimeMinutes, setDowntimeMinutes] = useState('0');
    const [downtimeReason, setDowntimeReason] = useState('None');
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch machines on load
    useEffect(() => {
        setLoading(true);
        fetch('/api/operator/machines')
            .then(res => res.ok ? res.json() : { machines: [] })
            .then(data => {
                setMachines(data.machines || []);
                // Load previously saved machine from localStorage if valid
                const savedMachineId = localStorage.getItem('operator_machine_id');
                if (savedMachineId && data.machines) {
                    const found = data.machines.find(m => String(m.id) === String(savedMachineId));
                    if (found) setSelectedMachine(found);
                }
            })
            .catch(err => {
                console.error('Failed to load machines:', err);
                setError('Failed to load machine configurations.');
            })
            .finally(() => setLoading(false));
    }, []);

    // Fetch tasks for the selected machine
    useEffect(() => {
        if (!selectedMachine) {
            setTasks([]);
            return;
        }
        loadTasks();
    }, [selectedMachine]);

    // Handle QR code scanner lifecycle
    useEffect(() => {
        let html5Qrcode = null;
        if (scanning) {
            // Delay slightly to ensure DOM container is mounted
            const timer = setTimeout(() => {
                try {
                    // Reset error state on start
                    setScanError('');
                    html5Qrcode = new Html5Qrcode('qr-reader-container');
                    html5Qrcode.start(
                        { facingMode: 'environment' },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 }
                        },
                        (decodedText) => {
                            handleScanSuccess(decodedText);
                            if (html5Qrcode && html5Qrcode.isScanning) {
                                html5Qrcode.stop()
                                    .then(() => setScanning(false))
                                    .catch(console.error);
                            }
                        },
                        (errorMessage) => {
                            // Suppress noisy frame scan errors
                        }
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
        if (!selectedMachine) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/operator/tasks?machineId=${selectedMachine.id}`);
            if (!res.ok) throw new Error('Failed to load tasks');
            const data = await res.json();
            setTasks(data.tasks || []);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
            setError('Could not retrieve active tasks queue.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMachine = (machine) => {
        setSelectedMachine(machine);
        localStorage.setItem('operator_machine_id', machine.id);
    };

    const handleChangeMachine = () => {
        setSelectedMachine(null);
        localStorage.removeItem('operator_machine_id');
        setTasks([]);
    };

    const handleScanSuccess = async (text) => {
        setScanning(false);
        setSearchQuery(text);

        // Query tasks matching scanned text
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/operator/tasks?search=${encodeURIComponent(text)}`);
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();

            if (data.tasks && data.tasks.length > 0) {
                // If scanned order has tasks, display them. If they belong to other machines, note it.
                setTasks(data.tasks);
                // Switch tab to queue to show search results
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

    const handleStartTask = async (task) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/sales-orders/${task.sales_order_id || 'unassigned'}/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' })
            });
            if (!res.ok) throw new Error('Failed to start task');

            // Refresh list
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

            // Refresh list
            await loadTasks();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenCompleteModal = (task) => {
        setCompletingTask(task);
        // Pre-fill fields with estimated/planned values
        setActualSheets(task.sheet_count != null ? String(task.sheet_count) : '');
        setActualWastage(task.wastage_sheets != null ? String(task.wastage_sheets) : '0');
        setActualPlates(task.plate_count != null ? String(task.plate_count) : '0');
        setDowntimeMinutes('0');
        setDowntimeReason('None');
    };

    const handleQuickComplete = async (task) => {
        if (!confirm(`Are you sure you want to Quick Complete task "${task.name}" using estimated quantities?`)) return;

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
                    downtime_reason: 'None'
                })
            });
            if (!res.ok) throw new Error('Failed to complete task');

            await loadTasks();
        } catch (err) {
            alert(err.message);
        } finally {
            setActionLoading(false);
        }
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
                    downtime_reason: downtimeReason !== 'None' ? downtimeReason : null
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

    const getMachineIcon = (type) => {
        switch (type) {
            case 'offset': return <FiPrinter className="w-8 h-8 text-emerald-400" />;
            case 'prepress': return <FiCpu className="w-8 h-8 text-cyan-400" />;
            case 'digital': return <FiPrinter className="w-8 h-8 text-violet-400" />;
            case 'finishing': return <FiLayers className="w-8 h-8 text-amber-400" />;
            default: return <FiSettings className="w-8 h-8 text-neutral-400" />;
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
            {/* Ambient glowing blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-20 left-0 w-[350px] h-[350px] bg-indigo-600/5 rounded-full blur-[90px]" />
            </div>

            {/* Header bar */}
            <header className="sticky top-0 z-40 bg-neutral-900/80 backdrop-blur-md border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    {selectedMachine && (
                        <button
                            onClick={handleChangeMachine}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        >
                            <FiArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div>
                        <h1 className="text-base font-bold tracking-tight text-white m-0 flex items-center gap-1.5">
                            Pressmatics Console
                        </h1>
                        <p className="text-[10px] text-neutral-400 m-0 uppercase tracking-wider font-semibold">
                            {selectedMachine ? `Machine: ${selectedMachine.name}` : 'Shop Floor Console'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {selectedMachine && (
                        <button
                            onClick={() => { setScanError(''); setScanning(true); }}
                            className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-md transition-all flex items-center gap-1.5 text-xs font-bold"
                            title="Scan QR Ticket"
                        >
                            <FiCamera className="w-4 h-4" />
                            <span>Scan Ticket</span>
                        </button>
                    )}
                    <button
                        onClick={() => {
                            document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                            router.push('/login');
                        }}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-neutral-300 hover:text-white transition-all"
                        title="Sign Out"
                    >
                        <FiLogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4 z-10 relative">
                {/* 1. Machine Selection Screen */}
                {!selectedMachine ? (
                    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
                        <div className="text-center space-y-1">
                            <h2 className="text-xl font-extrabold text-white">Select Your Machine</h2>
                            <p className="text-xs text-neutral-400">Choose the machine you are operating today to view your task queue.</p>
                        </div>

                        {loading ? (
                            <div className="py-20 text-center text-neutral-400">
                                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                <p className="text-xs">Loading machine configurations...</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.keys(MACHINE_CATEGORIES).map((catKey) => {
                                    const catMachines = (machines || []).filter(
                                        m => m.type === catKey || (!MACHINE_CATEGORIES[m.type] && catKey === 'other')
                                    );
                                    if (catMachines.length === 0) return null;
                                    return (
                                        <div key={catKey} className="space-y-2.5">
                                            <div className="flex items-center gap-2 px-1">
                                                {MACHINE_CATEGORIES[catKey].icon}
                                                <h3 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                                                    {MACHINE_CATEGORIES[catKey].name} ({catMachines.length})
                                                </h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {catMachines.map((machine) => (
                                                    <button
                                                        key={machine.id}
                                                        onClick={() => handleSelectMachine(machine)}
                                                        className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 active:scale-95 p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-white/[0.05]"
                                                    >
                                                        <div className="p-3 bg-white/5 rounded-md border border-white/10">
                                                            {getMachineIcon(machine.type)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-xs text-white leading-tight">{machine.name}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    /* 2. Operator Task Queue Screen */
                    <div className="space-y-4 animate-[fadeIn_0.3s_ease]">
                        {/* Search & Manual Scan Form */}
                        <form onSubmit={handleSearchSubmit} className="flex gap-2">
                            <div className="relative flex-1">
                                <FiSearch className="absolute left-3.5 top-1/2 -tranneutral-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Enter SO code, Task ID or scan..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 bg-neutral-900 border border-white/[0.09] rounded-md text-xs text-white placeholder-neutral-500 outline-none focus:border-emerald-500 transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => { setSearchQuery(''); loadTasks(); }}
                                        className="absolute right-3 top-1/2 -tranneutral-y-1/2 text-neutral-400 hover:text-white p-0.5"
                                    >
                                        <FiX className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <button
                                type="submit"
                                className="px-3 bg-neutral-900 border border-white/[0.09] hover:bg-white/5 rounded-md text-xs font-semibold"
                            >
                                Search
                            </button>
                        </form>

                        {/* Navigation / Filter Tabs */}
                        <div className="flex bg-neutral-900/80 p-1 rounded-md border border-white/[0.06] gap-1">
                            <button
                                onClick={() => setActiveTab('queue')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center ${activeTab === 'queue'
                                    ? 'bg-neutral-800 text-white shadow-sm border border-white/[0.08]'
                                    : 'text-neutral-400 hover:text-white'
                                    }`}
                            >
                                Up Next ({tasks.filter(t => t.status === 'pending' || t.status === 'paused').length})
                            </button>
                            <button
                                onClick={() => setActiveTab('running')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all text-center relative ${activeTab === 'running'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
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
                                    ? 'bg-neutral-800 text-white shadow-sm border border-white/[0.08]'
                                    : 'text-neutral-400 hover:text-white'
                                    }`}
                            >
                                Completed ({tasks.filter(t => t.status === 'done').length})
                            </button>
                        </div>

                        {/* Error Indicator */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/25 p-3 rounded-md flex gap-2 text-red-400 text-xs">
                                <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>{error}</div>
                            </div>
                        )}

                        {/* Task List */}
                        {loading ? (
                            <div className="py-16 text-center text-neutral-400">
                                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-xs">Updating task queue...</p>
                            </div>
                        ) : filteredTasks.length === 0 ? (
                            <div className="py-16 text-center text-neutral-500 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                                <FiCheckCircle className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
                                <p className="text-xs">No tasks in this list.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className={`bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3 transition-all relative overflow-hidden ${task.status === 'in_progress' ? 'border-emerald-500/30 bg-emerald-950/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : ''
                                            }`}
                                    >
                                        {/* Status shimmer border for active jobs */}
                                        {task.status === 'in_progress' && (
                                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse" />
                                        )}

                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                                                        {task.order_code || `SO #${task.sales_order_id}`}
                                                    </span>
                                                    {task.delivery_date && (
                                                        <span className="text-[9px] text-neutral-400">
                                                            Due: {new Date(task.delivery_date).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-sm font-bold text-white mt-1 leading-snug">{task.name}</h3>
                                                <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{task.customer_name}</p>
                                            </div>

                                            {/* Status Badge */}
                                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded shrink-0 border ${task.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                task.status === 'in_progress' ? 'bg-amber-500/15 text-amber-300 border-amber-500/20 animate-pulse' :
                                                    task.status === 'paused' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' :
                                                        'bg-white/5 text-neutral-400 border-white/10'
                                                }`}>
                                                {task.status?.replace('_', ' ')}
                                            </span>
                                        </div>

                                        {/* Description / Estimates */}
                                        {task.description && (
                                            <div className="text-[11px] text-neutral-400 font-medium bg-white/[0.01] border border-white/[0.04] p-2 rounded-lg leading-relaxed">
                                                {task.description}
                                            </div>
                                        )}

                                        {/* Estimation Details Grid */}
                                        {(task.sheet_count > 0 || task.plate_count > 0 || task.quantity > 0) && (
                                            <div className="grid grid-cols-3 gap-2 bg-white/[0.01] border border-white/[0.06] p-2.5 rounded-md text-center">
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

                                        {/* Actions */}
                                        {task.status !== 'done' && (
                                            <div className="flex gap-2 pt-1">
                                                {(task.status === 'pending' || task.status === 'paused') && (
                                                    <button
                                                        onClick={() => handleStartTask(task)}
                                                        disabled={actionLoading}
                                                        className="flex-1 py-2 bg-emerald-600 border border-emerald-500 hover:bg-emerald-500 rounded-md text-xs font-extrabold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
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
                                                            className="px-4 py-2 bg-neutral-900 border border-white/[0.09] hover:bg-white/5 rounded-md text-xs font-bold text-neutral-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                                        >
                                                            <FiPause className="w-3.5 h-3.5 fill-current" />
                                                            <span>Pause</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleQuickComplete(task)}
                                                            disabled={actionLoading}
                                                            className="px-3 py-2 bg-blue-900/30 border border-blue-500/30 hover:bg-blue-600/30 rounded-md text-[10px] font-bold text-blue-300 flex items-center justify-center gap-1 transition-all cursor-pointer"
                                                            title="Quick Complete using estimates"
                                                        >
                                                            <FiCheck className="w-3.5 h-3.5" />
                                                            <span>Quick Done</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleOpenCompleteModal(task)}
                                                            disabled={actionLoading}
                                                            className="flex-1 py-2 bg-emerald-600 border border-emerald-500 hover:bg-emerald-500 rounded-md text-xs font-extrabold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
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

            {/* 3. Live Scanner overlay modal */}
            {scanning && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4 overflow-y-auto">
                    <div className="flex items-center justify-between text-white pb-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider">Scan Job Ticket QR</h2>
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
                                    Note: Browsers require a secure HTTPS connection to access physical cameras.
                                </p>
                            </div>
                        ) : (
                            <div className="relative w-full aspect-square overflow-hidden rounded-3xl border border-white/20 shadow-2xl bg-neutral-900">
                                <div id="qr-reader-container" className="w-full h-full relative">
                                    {/* Scanning indicator box overlay */}
                                    <div className="absolute inset-8 border-2 border-emerald-500/50 rounded-2xl pointer-events-none z-10 flex items-center justify-center">
                                        <div className="w-full h-0.5 bg-emerald-400 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Fallback Input inside scanner view */}
                        <div className="bg-neutral-900 border border-white/10 p-4 rounded-2xl space-y-2.5">
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                Manual Fallback Input
                            </label>
                            <p className="text-[9px] text-neutral-500">
                                Enter the Sales Order Code (e.g. SO-0142) or paste the Job Ticket URL.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="SO-XXXX or URL..."
                                    id="modal-manual-input"
                                    className="flex-1 px-3 py-2 bg-black border border-white/[0.09] rounded-md text-xs text-white placeholder-neutral-600 outline-none focus:border-emerald-500"
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
                                    className="px-4 py-2 bg-emerald-600 border border-emerald-500 hover:bg-emerald-500 rounded-md text-xs font-bold text-white transition-all cursor-pointer"
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    </div>

                    {!scanError && (
                        <div className="text-center text-neutral-500 text-[10px] py-4">
                            Center the ticket QR code in the viewport to scan automatically.
                        </div>
                    )}
                </div>
            )}

            {/* 4. Complete / Logging actuals Modal */}
            {completingTask && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
                    onClick={() => setCompletingTask(null)}
                >
                    <div
                        className="bg-neutral-900 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-5 space-y-5 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] sm:shadow-[0_24px_64px_rgba(0,0,0,0.8)] text-neutral-100"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-extrabold text-white text-base">Complete Job Task</h3>
                                <p className="text-[10px] text-neutral-400 mt-0.5">Input actual numbers to close task #{completingTask.id}</p>
                            </div>
                            <button
                                onClick={() => setCompletingTask(null)}
                                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Quick details */}
                        <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-md text-xs space-y-1">
                            <div className="font-semibold text-neutral-300">{completingTask.name}</div>
                            <div className="text-[10px] text-neutral-500 font-mono">SO: {completingTask.order_code || '—'}</div>
                        </div>

                        {/* Completion Form */}
                        <form onSubmit={handleSubmitCompletion} className="space-y-4">
                            {/* Sheets printed */}
                            {(completingTask.sheet_count > 0 || completingTask.name.toLowerCase().includes('printing')) && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                            Printed Sheets
                                        </label>
                                        <input
                                            type="number"
                                            value={actualSheets}
                                            onChange={(e) => setActualSheets(e.target.value)}
                                            placeholder="Quantity"
                                            className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-md text-xs text-white outline-none focus:border-emerald-500"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                            Wastage Sheets
                                        </label>
                                        <input
                                            type="number"
                                            value={actualWastage}
                                            onChange={(e) => setActualWastage(e.target.value)}
                                            placeholder="Wastage"
                                            className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-md text-xs text-white outline-none focus:border-emerald-500"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Plates used */}
                            {(completingTask.plate_count > 0 || completingTask.name.toLowerCase().includes('plate') || completingTask.name.toLowerCase().includes('offset')) && (
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                        Actual Plates Used
                                    </label>
                                    <input
                                        type="number"
                                        value={actualPlates}
                                        onChange={(e) => setActualPlates(e.target.value)}
                                        placeholder="Plates"
                                        className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-md text-xs text-white outline-none focus:border-emerald-500"
                                        required
                                    />
                                </div>
                            )}

                            {/* Downtime log */}
                            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-3">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                        Downtime (Min)
                                    </label>
                                    <input
                                        type="number"
                                        value={downtimeMinutes}
                                        onChange={(e) => setDowntimeMinutes(e.target.value)}
                                        placeholder="Minutes"
                                        className="w-full px-3 py-2 bg-black border border-white/[0.09] rounded-md text-xs text-white outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                        Downtime Reason
                                    </label>
                                    <select
                                        value={downtimeReason}
                                        onChange={(e) => setDowntimeReason(e.target.value)}
                                        className="w-full px-2 py-2 bg-black border border-white/[0.09] rounded-md text-[11px] text-white outline-none focus:border-emerald-500"
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

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={actionLoading}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-md text-xs font-extrabold text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                            >
                                <FiCheckCircle className="w-4 h-4" />
                                <span>{actionLoading ? 'Saving...' : 'Submit & Mark Completed'}</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
