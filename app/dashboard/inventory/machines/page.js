'use client';

import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { FiPlus, FiTrash2, FiSearch, FiEdit2, FiX, FiActivity, FiClock, FiBarChart2, FiUsers, FiCpu, FiChevronUp, FiChevronDown, FiZap, FiExternalLink } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const TYPE_BADGES = {
    offset: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    digital: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    finishing: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    prepress: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

export default function MachinesPage() {
    const [machines, setMachines] = useState([]);
    const [plates, setPlates] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sorting, setSorting] = useState([]);

    // Modals
    const [showFormModal, setShowFormModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    // Performance Analytics Modal
    const [perfMachine, setPerfMachine] = useState(null);
    const [perfData, setPerfData] = useState(null);
    const [perfLoading, setPerfLoading] = useState(false);
    const [detailsTab, setDetailsTab] = useState('performance');
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    // Form State
    const [plateSearch, setPlateSearch] = useState('');
    const [showPlateSuggestions, setShowPlateSuggestions] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: 'offset',
        sheet_factor: 1.0,
        speed: 10000,
        speed_unit: 'Sheets/Hr',
        plate_id: '',
        digital_price_max: 0,
        digital_price_medium: 0,
        digital_price_min: 0,
        assigned_employee_id: '',
        assigned_team_id: '',
        assigned_employee_ids: [],
        assigned_team_ids: [],
        assigned_helper_ids: [],
        make_ready_minutes: 0,
        setup_minutes_per_plate: 0,
        shift_limit: 8,
        is_common: false,
    });

    useEffect(() => {
        fetchMachines();
        fetchPlates();
        fetch('/api/employees').then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : []));
        fetch('/api/teams').then(r => r.json()).then(d => setTeams(Array.isArray(d) ? d : []));
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                return;
            }
            if (e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                resetForm();
                setIsEditing(false);
                setShowFormModal(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const fetchPlates = async () => {
        try {
            const res = await fetch('/api/inventory?category=Plate');
            const data = await res.json();
            setPlates(data);
        } catch (error) { console.error(error); }
    };

    const fetchMachines = async () => {
        try {
            const res = await fetch('/api/machines');
            const data = await res.json();
            setMachines(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = isEditing ? `/api/machines/${editId}` : '/api/machines';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(isEditing ? 'Machine updated successfully' : 'Machine added successfully');
                setShowFormModal(false);
                fetchMachines();
                resetForm();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Operation failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('An error occurred');
        }
    };

    const handleDelete = async (id) => {
        if (!(await confirmDialog("Are you sure you want to delete this machine?"))) return;
        try {
            const res = await fetch(`/api/machines/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Machine deleted successfully');
                fetchMachines();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to delete');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete');
        }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setEditId(item.id);
        const assignedPlate = plates.find(p => p.id === item.plate_id);
        setPlateSearch(assignedPlate ? assignedPlate.name : '');
        setFormData({
            name: item.name,
            type: item.type,
            sheet_factor: item.sheet_factor || 1.0,
            speed: item.speed || 0,
            speed_unit: item.speed_unit || 'Sheets/Hr',
            plate_id: item.plate_id || '',
            digital_price_max: item.digital_price_max || 0,
            digital_price_medium: item.digital_price_medium || 0,
            digital_price_min: item.digital_price_min || 0,
            assigned_employee_id: item.assigned_employee_id || '',
            assigned_team_id: item.assigned_team_id || '',
            assigned_employee_ids: item.assigned_employee_ids || (item.assigned_employee_id ? [item.assigned_employee_id] : []),
            assigned_team_ids: item.assigned_team_ids || (item.assigned_team_id ? [item.assigned_team_id] : []),
            assigned_helper_ids: item.assigned_helper_ids || [],
            make_ready_minutes: item.make_ready_minutes || 0,
            setup_minutes_per_plate: item.setup_minutes_per_plate || 0,
            shift_limit: item.shift_limit || 8,
            is_common: !!item.is_common,
        });
        setShowFormModal(true);
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setPlateSearch('');
        setFormData({
            name: '',
            type: 'offset',
            sheet_factor: 1.0,
            speed: 10000,
            speed_unit: 'Sheets/Hr',
            plate_id: '',
            digital_price_max: 0,
            digital_price_medium: 0,
            digital_price_min: 0,
            assigned_employee_id: '',
            assigned_team_id: '',
            assigned_employee_ids: [],
            assigned_team_ids: [],
            assigned_helper_ids: [],
            make_ready_minutes: 0,
            setup_minutes_per_plate: 0,
            shift_limit: 8,
            is_common: false,
        });
    };

    const openPerf = useCallback(async (machine) => {
        setPerfMachine(machine);
        setPerfData(null);
        setPerfLoading(true);
        setDetailsTab('performance');
        try {
            const res = await fetch(`/api/machines/${machine.id}/performance`);
            const data = await res.json();
            setPerfData(data);
        } catch { toast.error('Failed to load analytics'); }
        finally { setPerfLoading(false); }
    }, []);

    const refreshPerfData = async (machineId) => {
        try {
            const res = await fetch(`/api/machines/${machineId}/performance`);
            const data = await res.json();
            setPerfData(data);
            fetchMachines();
        } catch { toast.error('Failed to reload data'); }
    };

    // Render ECharts bar chart when perfData changes
    useEffect(() => {
        if (!perfData?.monthly?.length || !chartRef.current) return;
        import('echarts').then(echarts => {
            if (chartInstance.current) chartInstance.current.dispose();
            chartInstance.current = echarts.init(chartRef.current, null, { renderer: 'svg' });
            const months = perfData.monthly.map(m => m.month);
            chartInstance.current.setOption({
                backgroundColor: 'transparent',
                tooltip: { trigger: 'axis', backgroundColor: '#111', borderColor: '#333', textStyle: { color: '#ccc' } },
                grid: { left: 10, right: 10, top: 10, bottom: 30, containLabel: true },
                xAxis: { type: 'category', data: months, axisLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#555', fontSize: 10 } },
                yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1a1a1a' } }, axisLabel: { color: '#555', fontSize: 10 } },
                series: [
                    { name: 'Tasks Done', type: 'bar', data: perfData.monthly.map(m => m.tasks_done), itemStyle: { color: 'rgba(167,139,250,0.5)', borderRadius: [4, 4, 0, 0] } },
                    { name: 'Avg Mins', type: 'line', yAxisIndex: 0, data: perfData.monthly.map(m => m.avg_mins), lineStyle: { color: 'rgba(255,255,255,0.2)' }, itemStyle: { color: 'rgba(255,255,255,0.3)' }, smooth: true, symbol: 'circle', symbolSize: 5 },
                ],
            });
        });
        return () => { if (chartInstance.current) { chartInstance.current.dispose(); chartInstance.current = null; } };
    }, [perfData]);

    const filteredData = useMemo(() => {
        return machines.filter(m => {
            const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === 'all' || m.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [machines, searchTerm, typeFilter]);

    const columns = useMemo(() => [
        {
            accessorKey: 'name',
            header: 'Machine Name',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div>
                        <div className="font-bold text-white text-[14px] flex items-center gap-2">
                            {item.name}
                            {item.is_common ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                                    Shared / Common
                                </span>
                            ) : null}
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'type',
            header: 'Machine Type',
            cell: ({ row }) => {
                const item = row.original;
                const badgeClass = 'bg-white/10 text-white/70 border-white/20';
                return (
                    <div>
                        <span className={`inline-block text-[9.5px] uppercase tracking-wider px-2 py-0.5 mt-1.5 rounded-full border font-bold ${badgeClass}`}>
                            {item.type?.replace('_', ' ')}
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'speed',
            header: 'Speed / Specs',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="text-xs text-gray-300">
                        {item.type === 'offset' && (
                            <>
                                <div>Speed: <span className="font-semibold text-white">{Number(item.speed).toLocaleString()}</span> {item.speed_unit === 'Units/Hr' ? 'uph' : 'sph'}</div>
                                <div className="text-gray-500 mt-0.5">Factor: {item.sheet_factor} {item.plate_name && <span className="text-amber-500/80">· Plate: {item.plate_name}</span>}</div>
                            </>
                        )}
                        {item.type === 'digital' && (
                            <>
                                <div>Speed: <span className="font-semibold text-white">{Number(item.speed).toLocaleString()}</span> sph</div>
                                <div className="text-amber-500/80 mt-0.5">Rates: Max {item.digital_price_max} · Med {item.digital_price_medium} · Min {item.digital_price_min}</div>
                            </>
                        )}
                        {item.type === 'finishing' && (
                            <div>Speed: <span className="font-semibold text-white">{Number(item.speed).toLocaleString()}</span> uph</div>
                        )}
                        {item.type === 'prepress' && (
                            <div>Prepress Equipment</div>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'make_ready_minutes',
            header: 'Setup & Shift Limit',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px]  border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                            <FiClock className="w-2.5 h-2.5" />{item.make_ready_minutes || 0}m setup
                        </span>
                        {item.type === 'offset' && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/5 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                                <FiClock className="w-2.5 h-2.5" />Plate Setup: {item.setup_minutes_per_plate || 0}m/plate
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[10px]  border border-sky-500/20 px-2 py-0.5 rounded-full font-medium">
                            <FiClock className="w-2.5 h-2.5" />Shift: {item.shift_limit || 8}h
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'assigned_employee_name',
            header: 'Assignments',
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex flex-wrap gap-1.5">
                        {item.assigned_employee_name && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full" title={`Operators: ${item.assigned_employee_name}`}>
                                <FiUsers className="w-2.5 h-2.5" />{item.assigned_employee_name}
                            </span>
                        )}
                        {item.assigned_helper_name && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full" title={`Helpers: ${item.assigned_helper_name}`}>
                                <FiUsers className="w-2.5 h-2.5" />Helpers: {item.assigned_helper_name}
                            </span>
                        )}
                        {item.assigned_team_name && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded-full" title={`Teams: ${item.assigned_team_name}`}>
                                <FiUsers className="w-2.5 h-2.5" />{item.assigned_team_name}
                            </span>
                        )}
                        {!item.assigned_employee_name && !item.assigned_team_name && !item.assigned_helper_name && (
                            <span className="text-gray-600 text-xs">—</span>
                        )}
                    </div>
                );
            }
        },
        {
            id: 'parts_status',
            header: 'Parts & Maintenance',
            cell: ({ row }) => {
                const item = row.original;
                if (!item.total_parts) {
                    return <span className="text-white/20 text-xs">No parts defined</span>;
                }
                if (item.warning_parts > 0) {
                    return (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
                            <FiZap className="w-2.5 h-2.5 text-red-400 animate-pulse" /> {item.warning_parts} part(s) low
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                        <FiZap className="w-2.5 h-2.5 text-emerald-400" /> {item.total_parts} parts OK
                    </span>
                );
            }
        },
        {
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex justify-end gap-1">
                        <a
                            href={`/machines/${item.id}/portal`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-indigo-400 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-colors flex items-center gap-1"
                            title="Open Machine Shop-Floor Portal"
                        >
                            <FiExternalLink className="w-4 h-4" />
                        </a>
                        <button onClick={() => openPerf(item)}
                            className="p-2 text-white/40 hover:text-white/80 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] rounded-lg transition-colors" title="Performance Analytics">
                            <FiBarChart2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(item)}
                            className="p-2 text-white/40 hover:text-purple-400 bg-white/[0.02] hover:bg-purple-500/10 border border-purple-500/15 rounded-lg transition-colors" title="Edit">
                            <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(item.id)}
                            className="p-2 text-white/40 hover:text-red-400 bg-white/[0.02] hover:bg-red-500/10 border border-red-500/15 rounded-lg transition-colors" title="Delete">
                            <FiTrash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            }
        }
    ], [plates]);

    const table = useReactTable({
        data: filteredData,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel()
    });

    return (
        <div className="text-white min-h-screen">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight mb-2">Machines</h1>
                    <p className="text-gray-400 text-sm">Manage press machines, speeds, plate assignments and shifts</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/common-portal/machines"
                        className="flex items-center gap-2 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 text-purple-300 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg"
                    >
                        <FiCpu /> Shared Machines Portal
                    </Link>
                    <button
                        onClick={() => { resetForm(); setIsEditing(false); setShowFormModal(true); }}
                        className="flex items-center gap-2 bg-white hover:bg-gray-200 text-black px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg"
                    >
                        <FiPlus /> Add Machine
                    </button>
                </div>
            </header>

            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search machines..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-secondary/40 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-white focus:outline-none focus:border-white/30 transition-all text-sm placeholder:text-gray-500"
                    />
                </div>
                <div className="flex bg-secondary/30 border border-white/10 rounded-xl p-1 gap-1">
                    {['all', 'offset', 'digital', 'finishing', 'prepress'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTypeFilter(t)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${typeFilter === t
                                ? 'bg-white/10 text-white border border-white/10'
                                : 'text-gray-400 hover:text-white border border-transparent'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* TanStack Table */}
            <div className="bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id} className="border-b border-white/10 bg-white/[0.01]">
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                                            className={`p-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer select-none transition-colors hover:text-white ${header.column.getCanSort() ? 'select-none' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {header.column.getCanSort() && (
                                                    {
                                                        asc: <FiChevronUp className="w-3.5 h-3.5" />,
                                                        desc: <FiChevronDown className="w-3.5 h-3.5" />
                                                    }[header.column.getIsSorted()] || <FiChevronDown className="w-3.5 h-3.5 text-gray-600 opacity-50" />
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-8 text-center text-gray-500 text-sm">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 rounded-full border-2 border-white/10 border-t-white animate-spin" />
                                            Loading machines...
                                        </div>
                                    </td>
                                </tr>
                            ) : table.getRowModel().rows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="p-12 text-center text-gray-500 text-sm">
                                        No machines found matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map(row => (
                                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="p-4 align-middle">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Machine Modal */}
            {showFormModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-4xl bg-black border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <h3 className="font-bold text-lg text-white">
                                {isEditing ? 'Edit Machine Settings' : 'Add New Machine'}
                            </h3>
                            <button
                                onClick={() => { setShowFormModal(false); resetForm(); }}
                                className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all"
                            >
                                <FiX />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Machine Name</label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Heidelberg SM 74"
                                    required
                                    className="bg-secondary border-white/10"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Machine Type</label>
                                    <select
                                        className="w-full  border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 [color-scheme:dark]"
                                        value={formData.type}
                                        onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                    >
                                        <option value="offset">Offset Machine</option>
                                        <option value="digital">Digital Machine</option>
                                        <option value="finishing">Finishing Machine</option>
                                        <option value="prepress">Prepress</option>
                                    </select>
                                </div>
                                {formData.type === 'offset' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Sheet Factor</label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={formData.sheet_factor}
                                            onChange={e => setFormData(prev => ({ ...prev, sheet_factor: parseFloat(e.target.value) || 1.0 }))}
                                            placeholder="1.0"
                                            className="bg-secondary border-white/10"
                                        />
                                    </div>
                                ) : <div />}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Machine Speed</label>
                                    <Input
                                        type="number"
                                        value={formData.speed}
                                        onChange={e => setFormData(prev => ({ ...prev, speed: parseInt(e.target.value) || 0 }))}
                                        placeholder="10000"
                                        className="bg-secondary border-white/10"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Speed Unit</label>
                                    <select
                                        className="w-full  border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 [color-scheme:dark]"
                                        value={formData.speed_unit}
                                        onChange={e => setFormData(prev => ({ ...prev, speed_unit: e.target.value }))}
                                    >
                                        <option value="Prints/Hr">Prints/Hr</option>
                                        <option value="Sheets/Hr">Sheets/Hr</option>
                                        <option value="Forms/Hr">Forms/Hr</option>
                                        <option value="Impressions/Hr">Impressions/Hr</option>
                                        <option value="Units/Hr">Units/Hr</option>
                                        <option value="Copies/Hr">Copies/Hr</option>
                                        <option value="Pcs/Hr">Pcs/Hr</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Default Setup (min)</label>
                                    <Input
                                        type="number"
                                        value={formData.make_ready_minutes}
                                        onChange={e => setFormData(prev => ({ ...prev, make_ready_minutes: parseInt(e.target.value) || 0 }))}
                                        className="bg-secondary border-white/10"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Shift Capacity (hrs)</label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="24"
                                        value={formData.shift_limit}
                                        onChange={e => setFormData(prev => ({ ...prev, shift_limit: parseInt(e.target.value) || 8 }))}
                                        className="bg-secondary border-white/10"
                                    />
                                </div>
                            </div>

                            {formData.type === 'offset' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Default Plate</label>
                                        <Input
                                            value={plateSearch}
                                            onChange={(e) => {
                                                setPlateSearch(e.target.value);
                                                setShowPlateSuggestions(true);
                                                if (e.target.value === '') setFormData(prev => ({ ...prev, plate_id: '' }));
                                            }}
                                            onFocus={() => setShowPlateSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowPlateSuggestions(false), 200)}
                                            placeholder="Search plate inventory..."
                                            className="bg-secondary border-white/10"
                                        />
                                        {showPlateSuggestions && (
                                            <ul className="absolute z-50 w-full  border border-white/10 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-xl">
                                                {plates.filter(p => p.name.toLowerCase().includes(plateSearch.toLowerCase())).map(p => (
                                                    <li
                                                        key={p.id}
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, plate_id: p.id }));
                                                            setPlateSearch(p.name);
                                                            setShowPlateSuggestions(false);
                                                        }}
                                                        className="px-4 py-2 hover:bg-white/5 cursor-pointer text-sm flex justify-between"
                                                    >
                                                        <span>{p.name}</span>
                                                        <span className="text-gray-500 text-xs">Cost: {p.unit_cost}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Plate Setup Time (min)</label>
                                        <Input
                                            type="number"
                                            value={formData.setup_minutes_per_plate}
                                            onChange={e => setFormData(prev => ({ ...prev, setup_minutes_per_plate: parseInt(e.target.value) || 0 }))}
                                            className="bg-secondary border-white/10"
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.type === 'digital' && (
                                <div className="grid grid-cols-3 gap-3 bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Max Color Rate</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.digital_price_max}
                                            onChange={e => setFormData(prev => ({ ...prev, digital_price_max: parseFloat(e.target.value) || 0 }))}
                                            className="bg-secondary border-white/10"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Med Color Rate</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.digital_price_medium}
                                            onChange={e => setFormData(prev => ({ ...prev, digital_price_medium: parseFloat(e.target.value) || 0 }))}
                                            className="bg-secondary border-white/10"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Min Color Rate</label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={formData.digital_price_min}
                                            onChange={e => setFormData(prev => ({ ...prev, digital_price_min: parseFloat(e.target.value) || 0 }))}
                                            className="bg-secondary border-white/10"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-white/5 pt-4 grid grid-cols-3 gap-4">
                                <div>
                                    <MultiSelect
                                        label="Assign Operators"
                                        options={employees.filter(e => e.status === 'active').map(e => ({
                                            value: e.id,
                                            label: e.name,
                                            sublabel: e.job_title || 'Operator'
                                        }))}
                                        selectedValues={formData.assigned_employee_ids || []}
                                        onChange={ids => setFormData(prev => ({ ...prev, assigned_employee_ids: ids }))}
                                        placeholder="Select Operators..."
                                    />
                                </div>
                                <div>
                                    <MultiSelect
                                        label="Assign Helpers"
                                        options={employees.filter(e => e.status === 'active').map(e => ({
                                            value: e.id,
                                            label: e.name,
                                            sublabel: e.job_title || 'Helper'
                                        }))}
                                        selectedValues={formData.assigned_helper_ids || []}
                                        onChange={ids => setFormData(prev => ({ ...prev, assigned_helper_ids: ids }))}
                                        placeholder="Select Helpers..."
                                    />
                                </div>
                                <div>
                                    <MultiSelect
                                        label="Assign Teams"
                                        options={teams.map(t => ({
                                            value: t.id,
                                            label: t.name,
                                            sublabel: `${t.member_count || 0} members`
                                        }))}
                                        selectedValues={formData.assigned_team_ids || []}
                                        onChange={ids => setFormData(prev => ({ ...prev, assigned_team_ids: ids }))}
                                        placeholder="Select Teams..."
                                    />
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-4">
                                <label className="flex items-center gap-3 cursor-pointer bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl hover:bg-purple-500/15 transition-all">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_common}
                                        onChange={e => setFormData(prev => ({ ...prev, is_common: e.target.checked }))}
                                        className="w-4 h-4 rounded border-white/20 bg-black/40 text-purple-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-purple-300">Shared / Common Machine</div>
                                        <div className="text-[11px] text-gray-400">Available across both Company 1 and Company 2 in the Common Machine Portal</div>
                                    </div>
                                </label>
                            </div>

                            <div className="border-t border-white/10 pt-4 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowFormModal(false); resetForm(); }}
                                    className="px-4 py-2 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <Button
                                    type="submit"
                                    className={`px-6 text-black font-bold hover:opacity-90 ${isEditing ? 'bg-amber-400' : 'bg-white'}`}
                                >
                                    {isEditing ? 'Update Machine' : 'Add Machine'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Performance Analytics Panel */}
            {perfMachine && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => { setPerfMachine(null); setPerfData(null); }} />
                    <div className="w-full max-w-2xl bg-[#0a0a0a] border-l border-white/[0.08] flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                    <FiActivity className="w-4 h-4 text-white/50" />
                                </div>
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
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                                    detailsTab === 'performance'
                                        ? 'border-white text-white bg-white/[0.03]'
                                        : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.01]'
                                }`}
                            >
                                Performance
                            </button>
                            <button
                                onClick={() => setDetailsTab('maintenance')}
                                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                                    detailsTab === 'maintenance'
                                        ? 'border-white text-white bg-white/[0.03]'
                                        : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.01]'
                                }`}
                            >
                                Parts & Maintenance
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                            {perfLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
                                </div>
                            ) : perfData ? (
                                detailsTab === 'maintenance' ? (
                                    <MachinePartsList
                                        machineId={perfMachine.id}
                                        parts={perfData.parts || []}
                                        onRefresh={() => refreshPerfData(perfMachine.id)}
                                    />
                                ) : (
                                    <>
                                        {perfData.currentTask && (
                                            <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl p-4">
                                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FiActivity className="w-3 h-3 text-purple-400" />Currently Running</p>
                                                <p className="text-sm font-semibold text-white">{perfData.currentTask.name}</p>
                                                <p className="text-xs text-white/40 mt-0.5">{perfData.currentTask.order_code} · {perfData.currentTask.customer_name}</p>
                                                {perfData.currentTask.started_at && (
                                                    <p className="text-xs text-white/30 mt-1 flex items-center gap-1">
                                                        <FiClock className="w-3 h-3" />
                                                        Started {new Date(perfData.currentTask.started_at).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {[
                                                { label: 'Total Tasks', value: perfData.summary.total_tasks, sub: 'assigned' },
                                                { label: 'Completed', value: perfData.summary.completed, sub: `${perfData.summary.total_tasks > 0 ? Math.round(perfData.summary.completed / perfData.summary.total_tasks * 100) : 0}% done` },
                                                { label: 'Avg Active Time', value: perfData.summary.avg_active_mins ? `${perfData.summary.avg_active_mins}m` : '—', sub: 'started → done' },
                                                { label: 'Total Active', value: perfData.summary.total_active_mins ? `${Math.round(perfData.summary.total_active_mins / 60)}h` : '—', sub: 'machine hours' },
                                            ].map(({ label, value, sub }) => (
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
                                                {[['Completed', perfData.summary.completed, 'bg-emerald-400'], ['In Progress', perfData.summary.in_progress, 'bg-amber-400'], ['Pending', perfData.summary.pending, 'bg-white/20']].map(([label, count, bar]) => (
                                                    <div key={label} className="flex items-center gap-3">
                                                        <span className="text-xs text-white/40 w-20 shrink-0">{label}</span>
                                                        <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                                                            <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${perfData.summary.total_tasks > 0 ? Math.round(count / perfData.summary.total_tasks * 100) : 0}%` }} />
                                                        </div>
                                                        <span className="text-xs font-mono text-white/40 w-6 text-right">{count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {perfData.monthly?.length > 0 && (
                                            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Monthly Output (last 6 months)</p>
                                                <div ref={chartRef} style={{ height: 180 }} />
                                            </div>
                                        )}

                                        {perfData.recent?.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Recent Completed Tasks</p>
                                                <div className="space-y-1.5">
                                                    {perfData.recent.map(t => (
                                                        <div key={t.id} className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium text-white/70 truncate">{t.name}</p>
                                                                <p className="text-[11px] text-white/25 mt-0.5">{t.order_code} · {t.customer_name}</p>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                {t.active_mins != null ? (
                                                                    <p className="text-xs font-mono text-white/50">{t.active_mins}m active</p>
                                                                ) : (
                                                                    <p className="text-xs text-white/20">—</p>
                                                                )}
                                                                <p className="text-[10px] text-white/20 mt-0.5">{t.completed_at ? new Date(t.completed_at).toLocaleDateString() : ''}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )
                            ) : (
                                <p className="text-center text-white/25 text-sm py-12">No analytics data available.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MultiSelect({ label, options, selectedValues = [], onChange, placeholder = 'Select...' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    const updateCoords = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            });
        }
    };

    const handleToggle = () => {
        if (!isOpen) {
            updateCoords();
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('scroll', updateCoords, true);
            window.addEventListener('resize', updateCoords);
        }
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(o =>
        (o.label || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.sublabel || '').toLowerCase().includes(search.toLowerCase())
    );

    const toggleValue = (val) => {
        const strVal = String(val);
        const currentStrVals = selectedValues.map(v => String(v));
        if (currentStrVals.includes(strVal)) {
            onChange(selectedValues.filter(v => String(v) !== strVal));
        } else {
            onChange([...selectedValues, val]);
        }
    };

    const selectedOptions = options.filter(o => selectedValues.some(v => String(v) === String(o.value)));

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {label && <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>}
            <div
                ref={triggerRef}
                onClick={handleToggle}
                className="min-h-[38px] w-full bg-secondary border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs cursor-pointer flex flex-wrap items-center gap-1 hover:border-white/20 transition-colors"
            >
                {selectedOptions.length === 0 ? (
                    <span className="text-gray-500">{placeholder}</span>
                ) : (
                    selectedOptions.map(o => (
                        <span
                            key={o.value}
                            className="inline-flex items-center gap-1 bg-white/10 border border-white/10 text-white px-2 py-0.5 rounded text-[11px] font-medium"
                        >
                            {o.label}
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleValue(o.value);
                                }}
                                className="hover:text-red-400 cursor-pointer ml-0.5 text-xs font-bold"
                            >
                                ×
                            </span>
                        </span>
                    ))
                )}
            </div>

            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: `${coords.top + 6}px`,
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                    }}
                    className="z-[999] bg-black border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-56"
                >
                    <div className="p-2 border-b border-white/10 bg-white/[0.02]">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="w-full bg-secondary border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-white/30"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="overflow-y-auto p-1 space-y-0.5">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500 text-center">No options found</div>
                        ) : (
                            filteredOptions.map(o => {
                                const isSelected = selectedValues.some(v => String(v) === String(o.value));
                                return (
                                    <div
                                        key={o.value}
                                        onClick={() => toggleValue(o.value)}
                                        className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-white/10 text-white font-semibold' : 'text-gray-300 hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex flex-col">
                                            <span>{o.label}</span>
                                            {o.sublabel && <span className="text-[10px] text-gray-500">{o.sublabel}</span>}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            readOnly
                                            className="rounded border-white/20 bg-secondary text-emerald-500 focus:ring-0 cursor-pointer"
                                        />
                                    </div>
                                );
                            })
                        )}
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
                                        <span className={`font-bold ${
                                            remainingPct <= 15 ? 'text-red-400 animate-pulse' : remainingPct <= 50 ? 'text-amber-400' : 'text-emerald-400'
                                        }`}>{Math.round(remainingPct)}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                remainingPct <= 15 ? 'bg-red-500' : remainingPct <= 50 ? 'bg-amber-500' : 'bg-emerald-500'
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

