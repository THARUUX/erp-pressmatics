'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { 
    FiUsers, FiCalendar, FiClock, FiPlus, FiSearch, 
    FiFilter, FiX, FiCheckCircle, FiActivity, FiArrowRight, FiTrash2,
    FiGrid, FiList, FiChevronUp, FiChevronDown, FiDownload
} from 'react-icons/fi';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender
} from '@tanstack/react-table';
import { ColumnToggle } from '@/components/ui/ColumnToggle';

const statusDotColor = (status) => {
    if (status === 'Checked In') return 'bg-emerald-400 border-emerald-500/30 text-emerald-400';
    if (status === 'On Break') return 'bg-amber-400 border-amber-500/30 text-amber-400';
    if (status === 'Checked Out') return 'bg-zinc-400 border-zinc-500/30 text-zinc-400';
    return 'bg-zinc-600 border-zinc-700/30 text-zinc-400';
};

const statusBadgeColor = (status) => {
    if (status === 'Checked In') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (status === 'On Break') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (status === 'Checked Out') return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
};

const avatarColor = (name) => {
    const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const cols = ['from-violet-500', 'from-blue-500', 'from-emerald-500', 'from-rose-500', 'from-amber-500', 'from-pink-500'];
    return cols[h % cols.length];
};

const parseLocalTime = (isoString) => {
    if (!isoString) return null;
    const cleanStr = isoString.endsWith('Z') ? isoString.slice(0, -1) : isoString;
    return new Date(cleanStr);
};

const getTimelineSegments = (todayLogs, currentStatus) => {
    if (!todayLogs || todayLogs.length === 0) return [];

    const sortedLogs = [...todayLogs].sort((a, b) => parseLocalTime(a.timestamp) - parseLocalTime(b.timestamp));

    const START_MINS = 8 * 60;   // 8:00 AM
    const END_MINS = 18 * 60;     // 6:00 PM
    const TOTAL_MINS = END_MINS - START_MINS;

    const getPercent = (timeStr) => {
        const d = parseLocalTime(timeStr);
        const mins = d.getHours() * 60 + d.getMinutes();
        return Math.max(0, Math.min(100, ((mins - START_MINS) / TOTAL_MINS) * 100));
    };

    const formatTimeLabel = (timeStr) => {
        return parseLocalTime(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const segments = [];
    let lastPct = 0;
    let currentMode = 'inactive'; // 'inactive', 'working', 'break'
    let lastTimeLabel = '08:00 AM';

    for (let i = 0; i < sortedLogs.length; i++) {
        const log = sortedLogs[i];
        const logPct = getPercent(log.timestamp);
        const timeLabel = formatTimeLabel(log.timestamp);

        if (logPct > lastPct) {
            segments.push({
                type: currentMode,
                width: logPct - lastPct,
                startLabel: lastTimeLabel,
                endLabel: timeLabel
            });
        }

        lastPct = logPct;
        lastTimeLabel = timeLabel;

        if (log.state === 0 || log.state === 5) {
            currentMode = 'working';
        } else if (log.state === 4) {
            currentMode = 'break';
        } else if (log.state === 1) {
            currentMode = 'inactive';
        }
    }

    if (currentMode !== 'inactive' && lastPct < 100) {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const nowPct = Math.max(0, Math.min(100, ((nowMins - START_MINS) / TOTAL_MINS) * 100));
        const nowTimeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (nowPct > lastPct) {
            segments.push({
                type: currentMode,
                width: nowPct - lastPct,
                startLabel: lastTimeLabel,
                endLabel: nowTimeLabel + ' (Now)'
            });
            lastPct = nowPct;
            lastTimeLabel = nowTimeLabel;
        }
    }

    if (lastPct < 100) {
        segments.push({
            type: 'inactive',
            width: 100 - lastPct,
            startLabel: lastTimeLabel,
            endLabel: '06:00 PM'
        });
    }

    return segments;
};

function ColumnFilter({ column }) {
    const val = column.getFilterValue() ?? '';
    return (
        <input 
            value={val} 
            onChange={e => column.setFilterValue(e.target.value)} 
            placeholder="Filter…"
            onClick={e => e.stopPropagation()}
            className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/30" 
        />
    );
}

export default function AttendancePage() {
    const [tab, setTab] = useState('status'); // 'status' or 'logs'
    const [statusData, setStatusData] = useState({ summary: {}, employees: [] });
    const [logsData, setLogsData] = useState({ data: [], pagination: {} });
    const [employeesList, setEmployeesList] = useState([]); // For manual log dropdown
    const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
    const [sorting, setSorting] = useState([]);
    const [columnFilters, setColumnFilters] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [exportingPdf, setExportingPdf] = useState(false);

    const handleExportPDF = async () => {
        setExportingPdf(true);
        try {
            const visibleCols = table.getVisibleLeafColumns()
                .filter(col => col.id !== 'timeline' && col.id !== 'actions')
                .map(col => ({
                    key: col.id || col.columnDef.accessorKey,
                    header: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
                }));

            const filteredRows = table.getFilteredRowModel().rows.map(row => row.original);

            const res = await fetch('/api/pdf/dynamic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Biometric Attendance Report',
                    subtitle: `Live Status - ${new Date().toLocaleDateString('en-GB')}`,
                    columns: visibleCols,
                    rows: filteredRows
                })
            });

            if (!res.ok) {
                toast.error('Failed to generate PDF');
                setExportingPdf(false);
                return;
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance_status_report_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Export PDF error:', error);
            toast.error('An error occurred while generating PDF');
        } finally {
            setExportingPdf(false);
        }
    };
    
    // Status filters
    const [statusSearch, setStatusSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Logs filters
    const [logsSearch, setLogsSearch] = useState('');
    const [logsState, setLogsState] = useState('');
    const [logsStartDate, setLogsStartDate] = useState('');
    const [logsEndDate, setLogsEndDate] = useState('');
    const [logsPage, setLogsPage] = useState(1);
    const [logsLimit] = useState(25);

    // Modal state
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualForm, setManualForm] = useState({
        employee_id: '',
        timestamp: '',
        state: '0'
    });
    const [savingLog, setSavingLog] = useState(false);
    const [loading, setLoading] = useState(true);

    // Report Modal state
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportEmployee, setReportEmployee] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [reportYear, setReportYear] = useState(new Date().getFullYear());
    const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
    const [loadingReport, setLoadingReport] = useState(false);

    // Mappings tab state
    const [mappings, setMappings] = useState([]);
    const [mappingChanges, setMappingChanges] = useState({});
    const [mappingSearch, setMappingSearch] = useState('');

    // Leaves and Holidays state
    const [leaves, setLeaves] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [leaveForm, setLeaveForm] = useState({ employee_id: '', start_date: '', end_date: '', leave_type: 'casual', reason: '' });
    const [holidayForm, setHolidayForm] = useState({ date: '', name: '' });
    const [fetchingHolidays, setFetchingHolidays] = useState(false);

    const deleteSingleMapping = async (empId) => {
        setSavingLog(true);
        try {
            const res = await fetch('/api/attendance/mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: empId,
                    device_user_id: ''
                })
            });
            if (res.ok) {
                toast.success('Mapping deleted successfully');
                setMappingChanges(prev => {
                    const next = { ...prev };
                    delete next[empId];
                    return next;
                });
                loadMappings();
                loadStatus();
            } else {
                toast.error('Failed to delete mapping');
            }
        } catch {
            toast.error('Error deleting mapping');
        } finally {
            setSavingLog(false);
        }
    };

    const loadMappings = async () => {
        try {
            const res = await fetch('/api/attendance/mapping');
            const data = await res.json();
            if (res.ok) {
                setMappings(data);
            } else {
                toast.error('Failed to load employee mappings');
            }
        } catch {
            toast.error('Error loading employee mappings');
        }
    };

    const handleMappingChange = (empId, deviceUserId) => {
        setMappingChanges(prev => ({
            ...prev,
            [empId]: deviceUserId
        }));
    };

    const saveMappings = async () => {
        const changedIds = Object.keys(mappingChanges);
        if (changedIds.length === 0) {
            toast.error('No mapping changes to save');
            return;
        }

        setSavingLog(true);
        let errorCount = 0;

        for (const empId of changedIds) {
            const devId = mappingChanges[empId];
            try {
                const res = await fetch('/api/attendance/mapping', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        employee_id: parseInt(empId, 10),
                        device_user_id: devId
                    })
                });
                if (!res.ok) errorCount++;
            } catch {
                errorCount++;
            }
        }

        if (errorCount === 0) {
            toast.success('Biometric mappings saved successfully!');
            setMappingChanges({});
            loadMappings();
            loadStatus();
        } else {
            toast.error(`Failed to save ${errorCount} mappings`);
        }
        setSavingLog(false);
    };

    const loadEmployeeReport = async (empId, yearVal, monthVal) => {
        setLoadingReport(true);
        try {
            const query = new URLSearchParams({
                year: yearVal.toString(),
                month: monthVal.toString()
            });
            const res = await fetch(`/api/attendance/employee/${empId}?${query.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setReportData(data);
            } else {
                toast.error(data.error || 'Failed to load report');
            }
        } catch {
            toast.error('Error loading report');
        } finally {
            setLoadingReport(false);
        }
    };

    const openReport = (emp) => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        setReportEmployee(emp);
        setReportYear(y);
        setReportMonth(m);
        setReportData(null);
        setShowReportModal(true);
        loadEmployeeReport(emp.id, y, m);
    };

    const handleReportPeriodChange = (y, m) => {
        setReportYear(y);
        setReportMonth(m);
        loadEmployeeReport(reportEmployee.id, y, m);
    };

    const loadLeaves = async () => {
        try {
            const res = await fetch('/api/leaves');
            const data = await res.json();
            if (res.ok) {
                setLeaves(Array.isArray(data) ? data : []);
            }
        } catch {
            toast.error('Failed to load leaves');
        }
    };

    const loadHolidays = async (yr = holidayYear) => {
        try {
            const res = await fetch(`/api/holidays?year=${yr}`);
            const data = await res.json();
            if (res.ok) {
                setHolidays(Array.isArray(data) ? data : []);
            }
        } catch {
            toast.error('Failed to load holidays');
        }
    };

    const handleHolidayYearChange = (newYear) => {
        setHolidayYear(newYear);
        loadHolidays(newYear);
    };

    const handleAutoFetchHolidays = async () => {
        if (!confirm(`Are you sure you want to fetch Sri Lankan public holidays for the year ${holidayYear}? Existing holidays for this year will be updated.`)) return;
        setFetchingHolidays(true);
        try {
            const res = await fetch('/api/holidays', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fetchSriLankaHolidaysForYear: holidayYear })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || 'Holidays fetched successfully!');
                loadHolidays(holidayYear);
            } else {
                toast.error(data.error || 'Failed to fetch holidays');
            }
        } catch {
            toast.error('Error fetching Sri Lankan holidays');
        } finally {
            setFetchingHolidays(false);
        }
    };

    const handleSaveHoliday = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/holidays', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(holidayForm)
            });
            if (res.ok) {
                toast.success('Holiday saved successfully');
                setShowHolidayModal(false);
                setHolidayForm({ date: '', name: '' });
                loadHolidays(holidayYear);
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save holiday');
            }
        } catch {
            toast.error('Error saving holiday');
        }
    };

    const handleDeleteHoliday = async (id) => {
        if (!confirm('Are you sure you want to delete this holiday?')) return;
        try {
            const res = await fetch(`/api/holidays?id=${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success('Holiday deleted successfully');
                loadHolidays(holidayYear);
            } else {
                toast.error('Failed to delete holiday');
            }
        } catch {
            toast.error('Error deleting holiday');
        }
    };

    const handleSaveLeave = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leaveForm)
            });
            if (res.ok) {
                toast.success('Leave form created successfully');
                setShowLeaveModal(false);
                setLeaveForm({ employee_id: '', start_date: '', end_date: '', leave_type: 'casual', reason: '' });
                loadLeaves();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save leave form');
            }
        } catch {
            toast.error('Error saving leave form');
        }
    };

    const handleUpdateLeaveStatus = async (id, status) => {
        try {
            const res = await fetch(`/api/leaves/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                toast.success(`Leave ${status} successfully`);
                loadLeaves();
            } else {
                toast.error('Failed to update leave status');
            }
        } catch {
            toast.error('Error updating leave status');
        }
    };

    const handleDeleteLeave = async (id) => {
        if (!confirm('Are you sure you want to delete this leave application?')) return;
        try {
            const res = await fetch(`/api/leaves/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success('Leave application deleted successfully');
                loadLeaves();
            } else {
                toast.error('Failed to delete leave application');
            }
        } catch {
            toast.error('Error deleting leave application');
        }
    };

    const loadStatus = async () => {
        try {
            const res = await fetch('/api/attendance/current-status');
            const data = await res.json();
            if (res.ok) {
                setStatusData(data);
            } else {
                toast.error('Failed to load status board');
            }
        } catch {
            toast.error('Error connecting to status API');
        }
    };

    const loadLogs = async () => {
        try {
            const query = new URLSearchParams({
                search: logsSearch,
                state: logsState,
                startDate: logsStartDate,
                endDate: logsEndDate,
                page: logsPage.toString(),
                limit: logsLimit.toString()
            });
            const res = await fetch(`/api/attendance?${query.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setLogsData(data);
            } else {
                toast.error('Failed to load attendance logs');
            }
        } catch {
            toast.error('Error connecting to logs API');
        }
    };

    const loadEmployees = async () => {
        try {
            const res = await fetch('/api/employees');
            const data = await res.json();
            if (res.ok) {
                // Only allow employees that are mapped to device user ids
                setEmployeesList(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error('Failed loading employees dropdown', e);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        if (tab === 'status') {
            await loadStatus();
        } else if (tab === 'logs') {
            await loadLogs();
        } else if (tab === 'mapping') {
            await loadMappings();
            setMappingChanges({});
        } else if (tab === 'leaves') {
            await loadLeaves();
            await loadEmployees();
        } else if (tab === 'holidays') {
            await loadHolidays();
        }
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, [tab, logsPage]);

    // Refetch logs when filters change (with debounce logic if wanted, but direct works fine here)
    const handleLogsSearch = (e) => {
        setLogsSearch(e.target.value);
        setLogsPage(1);
    };

    const applyLogsFilters = () => {
        setLogsPage(1);
        loadLogs();
    };

    const openManualLog = async () => {
        setManualForm({
            employee_id: '',
            timestamp: new Date().toISOString().slice(0, 16), // current datetime formatted for input datetime-local
            state: '0'
        });
        await loadEmployees();
        setShowManualModal(true);
    };

    const saveManualLog = async (e) => {
        e.preventDefault();
        if (!manualForm.employee_id) {
            toast.error('Please select an employee');
            return;
        }

        setSavingLog(true);
        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: parseInt(manualForm.employee_id, 10),
                    timestamp: manualForm.timestamp.replace('T', ' ') + ':00',
                    state: parseInt(manualForm.state, 10)
                })
            });
            const d = await res.json();
            if (res.ok) {
                toast.success('Manual log entry added successfully');
                setShowManualModal(false);
                if (tab === 'logs') loadLogs();
                else loadStatus();
            } else {
                toast.error(d.error || 'Failed to save log');
            }
        } catch {
            toast.error('Error saving manual log');
        } finally {
            setSavingLog(false);
        }
    };

    // Filter status list in client
    const filteredStatusEmployees = (statusData.employees || []).filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(statusSearch.toLowerCase()) || 
                             (emp.job_title || '').toLowerCase().includes(statusSearch.toLowerCase()) ||
                             (emp.erp_code || '').toLowerCase().includes(statusSearch.toLowerCase());
        const matchesStatus = !statusFilter || emp.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const columns = useMemo(() => [
        {
            accessorKey: 'name',
            header: 'Employee',
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor(emp.name)} to-black/50 flex items-center justify-center text-white font-bold text-xs`}>
                            {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-semibold text-white text-xs leading-none">{emp.name}</p>
                            <p className="text-zinc-500 text-[10px] mt-1">{emp.job_title || '—'}</p>
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'erp_code',
            header: 'ERP Code',
            cell: ({ row }) => <span className="font-mono text-zinc-400 text-xs">{row.original.erp_code || '—'}</span>
        },
        {
            accessorKey: 'department',
            header: 'Department',
            cell: ({ row }) => <span className="text-zinc-400 text-xs">{row.original.department || '—'}</span>
        },
        {
            accessorKey: 'shift',
            header: 'Shift',
            cell: ({ row }) => <span className="text-zinc-400 text-xs">{row.original.shift || 'Day'}</span>
        },
        {
            accessorKey: 'device_user_id',
            header: 'Biometric ID',
            cell: ({ row }) => <span className="font-mono text-zinc-400 text-xs">{row.original.device_user_id || 'Unmapped'}</span>
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const emp = row.original;
                return (
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadgeColor(emp.status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(emp.status)}`} />
                        {emp.status}
                    </span>
                );
            }
        },
        {
            id: 'timeline',
            header: 'Today\'s Progress',
            cell: ({ row }) => {
                const emp = row.original;
                if (!emp.device_user_id) {
                    return <span className="text-[10px] text-zinc-600 font-medium">No biometric mapping</span>;
                }
                const segments = getTimelineSegments(emp.todayLogs, emp.status);
                return (
                    <div className="w-48 space-y-1">
                        <div className="w-full h-2.5 bg-zinc-900/60 rounded-full overflow-hidden flex border border-white/5 relative">
                            {segments.map((seg, idx) => (
                                <div 
                                    key={idx} 
                                    style={{ width: `${seg.width}%` }} 
                                    className={`h-full ${
                                        seg.type === 'working' ? 'bg-emerald-500' :
                                        seg.type === 'break' ? 'bg-amber-400' :
                                        'bg-zinc-800/10'
                                    }`}
                                    title={`${seg.type === 'working' ? 'Working' : seg.type === 'break' ? 'On Break' : 'Away'}: ${seg.startLabel} - ${seg.endLabel}`}
                                />
                            ))}
                        </div>
                    </div>
                );
            }
        },
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => (
                <button
                    onClick={() => openReport(row.original)}
                    className="py-1 px-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-[10px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                    <FiCalendar className="w-3 h-3 text-zinc-400" /> View Report
                </button>
            )
        }
    ], []);

    const table = useReactTable({
        data: filteredStatusEmployees,
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: {
                pageSize: 15
            }
        }
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter text-white">Biometric Attendance</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Track live status and review swiping log history from the biometric systems.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-1 bg-black/30 border border-white/10 p-1 rounded-xl overflow-x-auto">
                        <button 
                            onClick={() => setTab('status')} 
                            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                                tab === 'status' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Live Status
                        </button>
                        <button 
                            onClick={() => setTab('logs')} 
                            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                                tab === 'logs' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Swipe History
                        </button>
                        <button 
                            onClick={() => setTab('mapping')} 
                            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                                tab === 'mapping' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Device Mapping
                        </button>
                        <button 
                            onClick={() => setTab('leaves')} 
                            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                                tab === 'leaves' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Leaves
                        </button>
                        <button 
                            onClick={() => setTab('holidays')} 
                            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all whitespace-nowrap ${
                                tab === 'holidays' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Holidays
                        </button>
                    </div>
                    {tab === 'leaves' ? (
                        <button 
                            onClick={() => {
                                setLeaveForm({ employee_id: '', start_date: '', end_date: '', leave_type: 'casual', reason: '' });
                                setShowLeaveModal(true);
                            }}
                            className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer shrink-0"
                        >
                            <FiPlus className="w-4 h-4" /> Fill Leave Form
                        </button>
                    ) : tab === 'holidays' ? (
                        <div className="flex gap-2 shrink-0">
                            <button 
                                onClick={handleAutoFetchHolidays}
                                disabled={fetchingHolidays}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {fetchingHolidays ? 'Fetching...' : 'Auto-Fetch Holidays'}
                            </button>
                            <button 
                                onClick={() => {
                                    setHolidayForm({ date: '', name: '' });
                                    setShowHolidayModal(true);
                                }}
                                className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                                <FiPlus className="w-4 h-4" /> Add Holiday
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={openManualLog}
                            className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer shrink-0"
                        >
                            <FiPlus className="w-4 h-4" /> Add Manual Log
                        </button>
                    )}
                </div>
            </div>

            {/* LIVE STATUS TAB */}
            {tab === 'status' && (
                <div className="space-y-5">
                    {/* Status Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {[
                            ['Total Active', statusData.summary?.totalActive || 0, 'text-white'],
                            ['Checked In', statusData.summary?.checkedIn || 0, 'text-emerald-400'],
                            ['On Break', statusData.summary?.onBreak || 0, 'text-amber-400'],
                            ['Checked Out', statusData.summary?.checkedOut || 0, 'text-zinc-400'],
                            ['Absent / Off', statusData.summary?.absent || 0, 'text-zinc-500']
                        ].map(([l, v, c]) => (
                            <div key={l} className="bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">{l}</p>
                                <p className={`text-3xl font-bold tracking-tight ${c}`}>{v}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filter bar */}
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[240px]">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4"/>
                            <input 
                                value={statusSearch} 
                                onChange={e => setStatusSearch(e.target.value)} 
                                placeholder="Search by name, ID or role..." 
                                className="w-full pl-9 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-white/30"
                            />
                        </div>
                        <select 
                            value={statusFilter} 
                            onChange={e => setStatusFilter(e.target.value)} 
                            className="px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"
                        >
                            <option value="">All Statuses</option>
                            <option value="Checked In">Checked In</option>
                            <option value="On Break">On Break</option>
                            <option value="Checked Out">Checked Out</option>
                            <option value="Absent">Absent / Off</option>
                        </select>
                        <button 
                            onClick={loadStatus}
                            className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer ml-auto sm:ml-0"
                        >
                            <FiActivity className="w-4 h-4 text-emerald-400" /> Refresh Board
                        </button>
                        {viewMode === 'list' && <ColumnToggle table={table} />}
                        <button
                            onClick={handleExportPDF}
                            disabled={exportingPdf}
                            className="px-4 py-2.5 bg-black/30 border border-white/10 text-gray-300 rounded-xl text-sm font-semibold hover:border-white/20 hover:text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                            <FiDownload className="w-4 h-4" /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
                        </button>
                        
                        {/* View Mode Toggle */}
                        <div className="flex gap-0.5 bg-black/30 border border-white/10 p-1 rounded-xl">
                            <button 
                                type="button"
                                onClick={() => setViewMode('card')} 
                                className={`p-1.5 rounded-lg text-sm transition-all flex items-center justify-center gap-1 ${
                                    viewMode === 'card' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                                }`}
                                title="Card View"
                            >
                                <FiGrid className="w-4 h-4" />
                            </button>
                            <button 
                                type="button"
                                onClick={() => setViewMode('list')} 
                                className={`p-1.5 rounded-lg text-sm transition-all flex items-center justify-center gap-1 ${
                                    viewMode === 'list' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                                }`}
                                title="List View"
                            >
                                <FiList className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Status View Render (Grid or TanStack Table) */}
                    {loading ? (
                        <div className="text-center py-16 text-gray-500">Loading live status board...</div>
                    ) : filteredStatusEmployees.length === 0 ? (
                        <div className="text-center py-16 text-zinc-500 bg-black/20 border border-white/5 rounded-2xl">
                            <FiUsers className="w-10 h-10 mx-auto mb-3 opacity-30"/>
                            <p className="font-semibold">No employees match filters</p>
                        </div>
                    ) : viewMode === 'card' ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredStatusEmployees.map(emp => (
                                <div key={emp.id} className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all group flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${avatarColor(emp.name)} to-black/50 flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                                                {emp.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statusBadgeColor(emp.status)}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(emp.status)}`} />
                                                {emp.status}
                                            </span>
                                        </div>
                                        <p className="font-semibold text-white text-sm leading-tight">{emp.name}</p>
                                        <p className="text-gray-500 text-xs mt-0.5">{emp.job_title || '—'}</p>
                                        {emp.department && <p className="text-gray-600 text-xs mt-0.5">{emp.department}</p>}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-1 text-[10px] text-gray-500">
                                        <div className="flex justify-between">
                                            <span>Shift:</span>
                                            <span className="text-gray-400 font-medium">{emp.shift || 'Day'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Biometric ID:</span>
                                            <span className="text-gray-400 font-mono">{emp.device_user_id || 'Unmapped'}</span>
                                        </div>
                                        <div className="flex justify-between mt-1 text-zinc-400">
                                            <span>Last Action:</span>
                                            <span className="font-semibold text-right">
                                                {emp.lastPunchTime ? (
                                                    <span className="flex items-center gap-1 justify-end">
                                                        <FiClock className="w-3 h-3 text-zinc-500" /> {parseLocalTime(emp.lastPunchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                ) : '—'}
                                            </span>
                                        </div>

                                        {/* Day Progress Timeline */}
                                        {emp.device_user_id ? (
                                            <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                                                <div className="flex justify-between items-center text-[9px] text-zinc-500 font-semibold tracking-wider uppercase">
                                                    <span>Day Progress</span>
                                                    <span>08 AM - 06 PM</span>
                                                </div>
                                                <div className="w-full h-2.5 bg-zinc-900/60 rounded-full overflow-hidden flex border border-white/5 relative">
                                                    {getTimelineSegments(emp.todayLogs, emp.status).map((seg, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            style={{ width: `${seg.width}%` }} 
                                                            className={`h-full transition-all ${
                                                                seg.type === 'working' ? 'bg-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' :
                                                                seg.type === 'break' ? 'bg-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' :
                                                                'bg-zinc-800/10'
                                                            }`}
                                                            title={`${seg.type === 'working' ? 'Working' : seg.type === 'break' ? 'On Break' : 'Away'}: ${seg.startLabel} - ${seg.endLabel}`}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex items-center justify-between text-[8px] text-zinc-600 font-medium">
                                                    <div className="flex gap-2">
                                                        <span className="flex items-center gap-0.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Work
                                                        </span>
                                                        <span className="flex items-center gap-0.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Break
                                                        </span>
                                                    </div>
                                                    <span>Hover for times</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-3 pt-3 border-t border-white/5">
                                                <div className="w-full py-1.5 bg-zinc-950/40 border border-white/[0.03] rounded-lg text-center">
                                                    <span className="text-[9px] text-zinc-600 font-medium">No biometric mapping configured</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => openReport(emp)}
                                        className="mt-3 w-full py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                    >
                                        <FiCalendar className="w-3.5 h-3.5 text-zinc-400" /> View Report
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-sm">
                                    <thead>
                                        {table.getHeaderGroups().map(headerGroup => (
                                            <tr key={headerGroup.id} className="border-b border-white/10 bg-white/[0.02]">
                                                {headerGroup.headers.map(header => {
                                                    const isSortable = header.column.getCanSort();
                                                    return (
                                                        <th 
                                                            key={header.id} 
                                                            onClick={header.column.getToggleSortingHandler()}
                                                            className={`p-4 text-xs font-bold uppercase tracking-wider text-zinc-400 select-none ${
                                                                isSortable ? 'cursor-pointer hover:text-white' : ''
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-1">
                                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                                {isSortable && (
                                                                    {
                                                                        asc: <FiChevronUp className="w-3.5 h-3.5 text-zinc-400" />,
                                                                        desc: <FiChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                                                                    }[header.column.getIsSorted()] || null
                                                                )}
                                                            </div>
                                                            {header.column.getCanFilter() && <ColumnFilter column={header.column} />}
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {table.getRowModel().rows.map(row => (
                                            <tr key={row.id} className="transition-colors hover:bg-white/[0.01]">
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="p-4 align-middle">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination controls for TanStack Table */}
                            {table.getPageCount() > 1 && (
                                <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/[0.01]">
                                    <p className="text-xs text-zinc-500">
                                        Showing page <span className="text-white font-medium">{table.getState().pagination.pageIndex + 1}</span> of{' '}
                                        <span className="text-white font-medium">{table.getPageCount()}</span>
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            disabled={!table.getCanPreviousPage()}
                                            onClick={() => table.previousPage()}
                                            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                                        >
                                            Previous
                                        </button>
                                        <button 
                                            disabled={!table.getCanNextPage()}
                                            onClick={() => table.nextPage()}
                                            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* SWIPE HISTORY TAB */}
            {tab === 'logs' && (
                <div className="space-y-4">
                    {/* Filters panel */}
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Search Employee</label>
                                <div className="relative">
                                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4"/>
                                    <input 
                                        value={logsSearch} 
                                        onChange={handleLogsSearch} 
                                        placeholder="Search name, ERP code, Device ID..." 
                                        className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">State</label>
                                <select 
                                    value={logsState} 
                                    onChange={e => { setLogsState(e.target.value); setLogsPage(1); }} 
                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"
                                >
                                    <option value="">All Actions</option>
                                    <option value="0">Check In Only</option>
                                    <option value="1">Check Out Only</option>
                                    <option value="4">Break Out Only</option>
                                    <option value="5">Break In Only</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Start Date</label>
                                <input 
                                    type="date"
                                    value={logsStartDate} 
                                    onChange={e => { setLogsStartDate(e.target.value); setLogsPage(1); }} 
                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30 [color-scheme:dark]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">End Date</label>
                                <input 
                                    type="date"
                                    value={logsEndDate} 
                                    onChange={e => { setLogsEndDate(e.target.value); setLogsPage(1); }} 
                                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30 [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                            <button 
                                onClick={() => {
                                    setLogsSearch('');
                                    setLogsState('');
                                    setLogsStartDate('');
                                    setLogsEndDate('');
                                    setLogsPage(1);
                                }}
                                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                            >
                                Clear Filters
                            </button>
                            <button 
                                onClick={applyLogsFilters}
                                className="px-5 py-2 text-xs font-semibold bg-white text-black hover:bg-zinc-200 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <FiFilter className="w-3.5 h-3.5" /> Apply Filters
                            </button>
                        </div>
                    </div>

                    {/* Table list */}
                    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/[0.02]">
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Timestamp</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Employee</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">ERP Code</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">ZKTeco User ID</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Department</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Action</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Verification</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-zinc-500">Loading logs...</td>
                                        </tr>
                                    ) : !logsData.data || logsData.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-zinc-500">No swipe history records found matching current criteria.</td>
                                        </tr>
                                    ) : (
                                        logsData.data.map(log => (
                                            <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                                                <td className="p-4 font-mono text-zinc-300">
                                                    {parseLocalTime(log.timestamp).toLocaleString('en-US', {
                                                        year: 'numeric', month: 'short', day: '2-digit',
                                                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                    })}
                                                </td>
                                                <td className="p-4 font-semibold text-white">
                                                    {log.employee_name || <span className="text-zinc-500 italic">Unmapped User</span>}
                                                </td>
                                                <td className="p-4 font-mono text-zinc-400">{log.erp_code || '—'}</td>
                                                <td className="p-4 font-mono text-zinc-400">{log.device_user_id}</td>
                                                <td className="p-4 text-zinc-400">{log.department || '—'}</td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                        log.state === 0 
                                                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                                                            : log.state === 4
                                                            ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                                            : log.state === 5
                                                            ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                                                            : 'text-zinc-400 bg-zinc-500/10 border border-zinc-500/20'
                                                    }`}>
                                                        {log.state === 0 ? 'Check In' : log.state === 4 ? 'Break Out' : log.state === 5 ? 'Break In' : 'Check Out'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs text-zinc-500">
                                                        {log.verification_type === 9 ? (
                                                            <span className="text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">Manual Adj.</span>
                                                        ) : log.verification_type === 15 ? (
                                                            'Face ID'
                                                        ) : log.verification_type === 4 ? (
                                                            'Card'
                                                        ) : (
                                                            'Fingerprint'
                                                        )}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination controls */}
                        {logsData.pagination && logsData.pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/[0.01]">
                                <p className="text-xs text-zinc-500">
                                    Showing <span className="text-white font-medium">{((logsPage - 1) * logsLimit) + 1}</span> to{' '}
                                    <span className="text-white font-medium">
                                        {Math.min(logsPage * logsLimit, logsData.pagination.total)}
                                    </span> of{' '}
                                    <span className="text-white font-medium">{logsData.pagination.total}</span> records
                                </p>
                                <div className="flex items-center gap-2">
                                    <button 
                                        disabled={logsPage === 1}
                                        onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                                        className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-xs text-zinc-400">
                                        Page <span className="text-white font-medium">{logsPage}</span> of {logsData.pagination.totalPages}
                                    </span>
                                    <button 
                                        disabled={logsPage === logsData.pagination.totalPages}
                                        onClick={() => setLogsPage(p => Math.min(logsData.pagination.totalPages, p + 1))}
                                        className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* DEVICE MAPPING TAB */}
            {tab === 'mapping' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-black/30 border border-white/10 p-4 rounded-2xl">
                        <div className="relative flex-1 max-w-md">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4"/>
                            <input 
                                value={mappingSearch} 
                                onChange={e => setMappingSearch(e.target.value)} 
                                placeholder="Search by name, ERP code, role..." 
                                className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                            />
                        </div>
                        <button 
                            onClick={saveMappings}
                            disabled={savingLog || Object.keys(mappingChanges).length === 0}
                            className="bg-white text-black px-5 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-all"
                        >
                            {savingLog && <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                            Save Mappings
                        </button>
                    </div>

                    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/[0.02]">
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Employee</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">ERP Code</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Department</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Job Title</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">ZKTeco Biometric User ID</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-zinc-500">Loading mappings...</td>
                                        </tr>
                                    ) : mappings.filter(m => 
                                        m.name.toLowerCase().includes(mappingSearch.toLowerCase()) || 
                                        (m.erp_code || '').toLowerCase().includes(mappingSearch.toLowerCase()) ||
                                        (m.job_title || '').toLowerCase().includes(mappingSearch.toLowerCase())
                                    ).length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-zinc-500">No employees match criteria.</td>
                                        </tr>
                                    ) : (
                                        mappings
                                            .filter(m => 
                                                m.name.toLowerCase().includes(mappingSearch.toLowerCase()) || 
                                                (m.erp_code || '').toLowerCase().includes(mappingSearch.toLowerCase()) ||
                                                (m.job_title || '').toLowerCase().includes(mappingSearch.toLowerCase())
                                            )
                                            .map(mapItem => {
                                                const localChange = mappingChanges[mapItem.employee_id];
                                                const deviceUserId = localChange !== undefined ? localChange : (mapItem.device_user_id || '');
                                                const isChanged = localChange !== undefined;

                                                return (
                                                    <tr key={mapItem.employee_id} className={`transition-colors hover:bg-white/[0.01] ${isChanged ? 'bg-indigo-500/5' : ''}`}>
                                                        <td className="p-4 font-semibold text-white">{mapItem.name}</td>
                                                        <td className="p-4 font-mono text-zinc-400">{mapItem.erp_code || '—'}</td>
                                                        <td className="p-4 text-zinc-400">{mapItem.department || '—'}</td>
                                                        <td className="p-4 text-zinc-400">{mapItem.job_title || '—'}</td>
                                                        <td className="p-2">
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    type="text"
                                                                    value={deviceUserId}
                                                                    placeholder="e.g. 1045"
                                                                    onChange={e => handleMappingChange(mapItem.employee_id, e.target.value)}
                                                                    className="w-40 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30 font-mono"
                                                                />
                                                                {mapItem.device_user_id && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (confirm(`Remove biometric mapping for ${mapItem.name}?`)) {
                                                                                deleteSingleMapping(mapItem.employee_id);
                                                                            }
                                                                        }}
                                                                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                                                                        title="Delete Mapping"
                                                                    >
                                                                        <FiTrash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            {mapItem.device_user_id ? (
                                                                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">Mapped</span>
                                                            ) : (
                                                                <span className="text-[10px] text-zinc-500 bg-zinc-500/5 border border-zinc-500/10 px-2 py-0.5 rounded-md font-semibold font-sans">Not Configured</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* LEAVES TAB */}
            {tab === 'leaves' && (
                <div className="space-y-4">
                    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/[0.02]">
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Employee</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Leave Type</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Duration</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Reason</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Status</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-zinc-500">Loading leave requests...</td>
                                        </tr>
                                    ) : leaves.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-zinc-500">No leave applications registered.</td>
                                        </tr>
                                    ) : (
                                        leaves.map(leave => (
                                            <tr key={leave.id} className="transition-colors hover:bg-white/[0.01]">
                                                <td className="p-4 font-semibold text-white">
                                                    <div>
                                                        <p className="font-semibold text-white text-xs">{leave.employee_name}</p>
                                                        <p className="text-zinc-500 text-[10px] mt-0.5">{leave.job_title} ({leave.erp_code})</p>
                                                    </div>
                                                </td>
                                                <td className="p-4 capitalize">
                                                    <span className="text-xs text-zinc-300 font-medium">{leave.leave_type}</span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-xs text-zinc-300">
                                                        <span>{new Date(leave.start_date).toLocaleDateString('en-GB')}</span>
                                                        <span className="text-zinc-500 mx-1">to</span>
                                                        <span>{new Date(leave.end_date).toLocaleDateString('en-GB')}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-xs text-zinc-400 max-w-xs truncate" title={leave.reason}>
                                                    {leave.reason || '—'}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                                        leave.status === 'approved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                                                        leave.status === 'rejected' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
                                                        'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                                            leave.status === 'approved' ? 'bg-emerald-400' :
                                                            leave.status === 'rejected' ? 'bg-rose-400' :
                                                            'bg-amber-400'
                                                        }`} />
                                                        {leave.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        {leave.status === 'pending' && (
                                                            <>
                                                                <button 
                                                                    onClick={() => handleUpdateLeaveStatus(leave.id, 'approved')}
                                                                    className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold rounded-lg transition-all cursor-pointer"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleUpdateLeaveStatus(leave.id, 'rejected')}
                                                                    className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-[10px] font-semibold rounded-lg transition-all cursor-pointer"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </>
                                                        )}
                                                        <button 
                                                            onClick={() => handleDeleteLeave(leave.id)}
                                                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                                                            title="Delete Leave Application"
                                                        >
                                                            <FiTrash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* HOLIDAYS TAB */}
            {tab === 'holidays' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-black/30 border border-white/10 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Year Filter</label>
                            <select 
                                value={holidayYear} 
                                onChange={e => handleHolidayYearChange(parseInt(e.target.value, 10))}
                                className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none [color-scheme:dark]"
                            >
                                <option value="2026">2026</option>
                                <option value="2025">2025</option>
                                <option value="2024">2024</option>
                            </select>
                        </div>
                        <p className="text-xs text-zinc-500">
                            Holidays are excluded from the employee's absenteeism calculations in payroll runs.
                        </p>
                    </div>

                    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/[0.02]">
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Date</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Day</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Holiday Name</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-zinc-500">Loading holidays...</td>
                                        </tr>
                                    ) : holidays.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-zinc-500">No holidays registered for {holidayYear}. Use "Auto-Fetch Holidays" or "Add Holiday" to register.</td>
                                        </tr>
                                    ) : (
                                        holidays.map(holiday => {
                                            const dayName = new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'long' });
                                            return (
                                                <tr key={holiday.id} className="transition-colors hover:bg-white/[0.01]">
                                                    <td className="p-4 font-mono text-zinc-300">
                                                        {new Date(holiday.date).toLocaleDateString('en-GB')}
                                                    </td>
                                                    <td className="p-4 text-zinc-400">
                                                        {dayName}
                                                    </td>
                                                    <td className="p-4 font-semibold text-white">
                                                        {holiday.name}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button 
                                                            onClick={() => handleDeleteHoliday(holiday.id)}
                                                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                                                            title="Delete Holiday"
                                                        >
                                                            <FiTrash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* LEAVE APPLICATION MODAL */}
            {showLeaveModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowLeaveModal(false)}>
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
                            <h3 className="text-lg font-bold text-white">New Leave Application</h3>
                            <button onClick={() => setShowLeaveModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 cursor-pointer"><FiX /></button>
                        </div>
                        <form onSubmit={handleSaveLeave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Select Employee *</label>
                                <select 
                                    required
                                    value={leaveForm.employee_id}
                                    onChange={e => setLeaveForm(p => ({ ...p, employee_id: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"
                                >
                                    <option value="">-- Choose Employee --</option>
                                    {employeesList.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Start Date *</label>
                                    <input 
                                        required
                                        type="date"
                                        value={leaveForm.start_date}
                                        onChange={e => setLeaveForm(p => ({ ...p, start_date: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">End Date *</label>
                                    <input 
                                        required
                                        type="date"
                                        value={leaveForm.end_date}
                                        onChange={e => setLeaveForm(p => ({ ...p, end_date: e.target.value }))}
                                        className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30 [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Leave Type *</label>
                                <select 
                                    required
                                    value={leaveForm.leave_type}
                                    onChange={e => setLeaveForm(p => ({ ...p, leave_type: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"
                                >
                                    <option value="casual">Casual</option>
                                    <option value="medical">Medical</option>
                                    <option value="annual">Annual</option>
                                    <option value="nopay">No Pay / Absent with permission</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Reason / Description</label>
                                <textarea 
                                    value={leaveForm.reason}
                                    onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                                    rows={3}
                                    placeholder="Enter reason for leave..."
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30"
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowLeaveModal(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 cursor-pointer">Cancel</button>
                                <button type="submit" className="bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 cursor-pointer">
                                    Save Leave Form
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* HOLIDAY MODAL */}
            {showHolidayModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowHolidayModal(false)}>
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
                            <h3 className="text-lg font-bold text-white">Add Custom Holiday</h3>
                            <button onClick={() => setShowHolidayModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 cursor-pointer"><FiX /></button>
                        </div>
                        <form onSubmit={handleSaveHoliday} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Date *</label>
                                <input 
                                    required
                                    type="date"
                                    value={holidayForm.date}
                                    onChange={e => setHolidayForm(p => ({ ...p, date: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30 [color-scheme:dark]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Holiday Name *</label>
                                <input 
                                    required
                                    type="text"
                                    placeholder="e.g. Sinhala & Tamil New Year"
                                    value={holidayForm.name}
                                    onChange={e => setHolidayForm(p => ({ ...p, name: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30"
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowHolidayModal(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 cursor-pointer">Cancel</button>
                                <button type="submit" className="bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 cursor-pointer">
                                    Save Holiday
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MANUAL ADJUSTMENT MODAL */}
            {showManualModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowManualModal(false)}>
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
                            <h3 className="text-lg font-bold text-white">Manual Punch Entry</h3>
                            <button onClick={() => setShowManualModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 cursor-pointer"><FiX /></button>
                        </div>
                        <form onSubmit={saveManualLog} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Select Employee *</label>
                                <select 
                                    required
                                    value={manualForm.employee_id}
                                    onChange={e => setManualForm(p => ({ ...p, employee_id: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"
                                >
                                    <option value="">-- Choose Employee --</option>
                                    {employeesList.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Punch State *</label>
                                <select 
                                    required
                                    value={manualForm.state}
                                    onChange={e => setManualForm(p => ({ ...p, state: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"
                                >
                                    <option value="0">Check In</option>
                                    <option value="1">Check Out</option>
                                    <option value="4">Break Out</option>
                                    <option value="5">Break In</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Date & Time *</label>
                                <input 
                                    required
                                    type="datetime-local"
                                    value={manualForm.timestamp}
                                    onChange={e => setManualForm(p => ({ ...p, timestamp: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-white/30 [color-scheme:dark]"
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowManualModal(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 cursor-pointer">Cancel</button>
                                <button type="submit" disabled={savingLog} className="flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 cursor-pointer">
                                    {savingLog && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                                    Save Punch
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EMPLOYEE-WISE ATTENDANCE REPORT MODAL */}
            {showReportModal && reportEmployee && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowReportModal(false)}>
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] bg-white/[0.01]">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span>Attendance Report:</span>
                                    <span className="text-zinc-400 font-semibold">{reportEmployee.name}</span>
                                </h3>
                                <p className="text-xs text-zinc-500 mt-0.5">{reportEmployee.job_title} ({reportEmployee.erp_code}) • Biometric ID: {reportEmployee.device_user_id || 'Unmapped'}</p>
                            </div>
                            <button onClick={() => setShowReportModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 cursor-pointer"><FiX /></button>
                        </div>

                        {/* Filter period */}
                        <div className="px-6 py-4 bg-black/30 border-b border-white/5 flex flex-wrap gap-4 items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div>
                                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Year</label>
                                    <select 
                                        value={reportYear} 
                                        onChange={e => handleReportPeriodChange(parseInt(e.target.value, 10), reportMonth)}
                                        className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none [color-scheme:dark]"
                                    >
                                        <option value="2026">2026</option>
                                        <option value="2025">2025</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Month</label>
                                    <select 
                                        value={reportMonth} 
                                        onChange={e => handleReportPeriodChange(reportYear, parseInt(e.target.value, 10))}
                                        className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white outline-none [color-scheme:dark]"
                                    >
                                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                                            <option key={m} value={idx + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {reportData && (
                                <div className="flex gap-2">
                                    {[
                                        ['Present', reportData.summary.present, 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'],
                                        ['Absent', reportData.summary.absent, 'text-rose-400 bg-rose-500/10 border-rose-500/20'],
                                        ['Incomplete', reportData.summary.incomplete, 'text-amber-400 bg-amber-500/10 border-amber-500/20'],
                                        ['Total Hours', `${reportData.summary.totalHours.toFixed(1)}h`, 'text-white bg-white/5 border-white/10'],
                                        ['OT Hours', `${reportData.summary.totalOvertime.toFixed(1)}h`, 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20']
                                    ].map(([label, val, style]) => (
                                        <div key={label} className={`px-3 py-1.5 rounded-xl border text-[10px] font-semibold flex flex-col items-center min-w-[70px] ${style}`}>
                                            <span className="opacity-50 text-[8px] uppercase tracking-wider mb-0.5">{label}</span>
                                            <span>{val}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingReport ? (
                                <div className="text-center py-16 text-zinc-500">Generating report sheet...</div>
                            ) : !reportData ? (
                                <div className="text-center py-16 text-zinc-500">No report available. Mapped biometric logs are required.</div>
                            ) : (
                                <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-white/10 bg-white/[0.02]">
                                                <th className="p-3 font-bold uppercase text-zinc-400">Date</th>
                                                <th className="p-3 font-bold uppercase text-zinc-400 text-center">Check-In</th>
                                                <th className="p-3 font-bold uppercase text-zinc-400 text-center">Check-Out</th>
                                                <th className="p-3 font-bold uppercase text-zinc-400 text-center">Regular Hours</th>
                                                <th className="p-3 font-bold uppercase text-zinc-400 text-center">Overtime Hours</th>
                                                <th className="p-3 font-bold uppercase text-zinc-400 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {reportData.days.map(day => (
                                                <tr key={day.date} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="p-3 font-mono text-zinc-300">
                                                        {day.date} <span className="text-[10px] text-zinc-500">({day.dayName})</span>
                                                    </td>
                                                    <td className="p-3 text-center font-mono text-zinc-300">{day.checkIn || '—'}</td>
                                                    <td className="p-3 text-center font-mono text-zinc-300">{day.checkOut || '—'}</td>
                                                    <td className="p-3 text-center font-mono text-zinc-300">
                                                        {day.status === 'Present' ? (Math.max(0, day.totalHours - day.overtimeHours)).toFixed(2) : '0.00'} hrs
                                                    </td>
                                                    <td className="p-3 text-center font-mono text-zinc-300">{day.overtimeHours.toFixed(2)} hrs</td>
                                                    <td className="p-3 text-right">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                            day.status === 'Present' 
                                                                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                                                : day.status === 'Incomplete'
                                                                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                                                : day.status === 'Weekly Off'
                                                                ? 'text-zinc-500 bg-zinc-500/5 border border-zinc-500/10'
                                                                : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                                                        }`}>
                                                            {day.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end px-6 py-4 border-t border-white/[0.07] bg-white/[0.01]">
                            <button type="button" onClick={() => setShowReportModal(false)} className="px-5 py-2 rounded-xl border border-white/10 text-gray-400 text-xs font-semibold hover:bg-white/5 cursor-pointer">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
