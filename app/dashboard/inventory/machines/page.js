'use client';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlus, FiTrash2, FiSearch, FiEdit2, FiX, FiActivity, FiClock, FiBarChart2 } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function MachinesPage() {
    const [machines, setMachines] = useState([]);
    const [plates, setPlates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [perfMachine, setPerfMachine] = useState(null);   // machine whose panel is open
    const [perfData, setPerfData]       = useState(null);
    const [perfLoading, setPerfLoading] = useState(false);
    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    const openPerf = useCallback(async (machine) => {
        setPerfMachine(machine);
        setPerfData(null);
        setPerfLoading(true);
        try {
            const res  = await fetch(`/api/machines/${machine.id}/performance`);
            const data = await res.json();
            setPerfData(data);
        } catch { toast.error('Failed to load analytics'); }
        finally { setPerfLoading(false); }
    }, []);

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
                    { name: 'Tasks Done', type: 'bar', data: perfData.monthly.map(m => m.tasks_done), itemStyle: { color: 'rgba(255,255,255,0.4)', borderRadius: [4,4,0,0] } },
                    { name: 'Avg Mins', type: 'line', yAxisIndex: 0, data: perfData.monthly.map(m => m.avg_mins), lineStyle: { color: 'rgba(255,255,255,0.2)' }, itemStyle: { color: 'rgba(255,255,255,0.3)' }, smooth: true, symbol: 'circle', symbolSize: 5 },
                ],
            });
        });
        return () => { if (chartInstance.current) { chartInstance.current.dispose(); chartInstance.current = null; } };
    }, [perfData]);


    // Plate Autocomplete State
    const [plateSearch, setPlateSearch] = useState('');
    const [showPlateSuggestions, setShowPlateSuggestions] = useState(false);

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'offset',
        sheet_factor: 1.0,
        speed: 10000,
        speed_unit: 'Sheets/Hr',
        plate_id: '',
        digital_price_max: 0,
        digital_price_medium: 0,
        digital_price_min: 0
    });

    useEffect(() => {
        fetchMachines();
        fetchPlates();
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
            setMachines(data);
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
                if (method === 'POST') fetchMachines(); // Refresh list to get plate name join
                else {
                    // Optimistic update or refresh
                    fetchMachines();
                }
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
            sheet_factor: item.sheet_factor,
            speed: item.speed,
            speed_unit: item.speed_unit || 'Sheets/Hr',
            plate_id: item.plate_id || '',
            digital_price_max: item.digital_price_max || 0,
            digital_price_medium: item.digital_price_medium || 0,
            digital_price_min: item.digital_price_min || 0
        });
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setPlateSearch('');
        setFormData({ name: '', type: 'offset', sheet_factor: 1.0, speed: 10000, speed_unit: 'Sheets/Hr', plate_id: '', digital_price_max: 0, digital_price_medium: 0, digital_price_min: 0 });
    };

    const filtered = machines.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="text-white">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter mb-2">Machines</h1>
                    <p className="text-gray-400">Manage press machines and configurations</p>
                </div>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Form */}
                <div className="lg:col-span-1">
                    <section className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 sticky top-8">
                        <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-2">{isEditing ? <FiEdit2 /> : <FiPlus />} {isEditing ? 'Edit Machine' : 'Add Machine'}</span>
                            {isEditing && (
                                <button onClick={resetForm} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1">
                                    <FiX /> Cancel
                                </button>
                            )}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Machine Name</label>
                                <Input
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Heidelberg SM 74"
                                    required
                                    className="bg-secondary border-white/10"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Type</label>
                                    <select
                                        className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                        value={formData.type}
                                        onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                    >
                                        <option value="offset">Offset Machine</option>
                                        <option value="digital">Digital Machine</option>
                                        <option value="finishing">Finishing Machine</option>
                                        <option value="prepress">Prepress</option>
                                    </select>
                                </div>
                                {formData.type === 'offset' && (
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Sheet Factor</label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={formData.sheet_factor}
                                            onChange={e => setFormData(prev => ({ ...prev, sheet_factor: e.target.value }))}
                                            placeholder="1.0"
                                            className="bg-secondary border-white/10"
                                        />
                                    </div>
                                )}
                                {formData.type === 'digital' && (
                                    <>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Max Colored Price (per sq cm)</label>
                                            <Input type="number" step="0.01" value={formData.digital_price_max} onChange={e => setFormData(prev => ({ ...prev, digital_price_max: e.target.value }))} placeholder="0.00" className="bg-secondary border-white/10" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Medium Coloured Price (per sq cm)</label>
                                            <Input type="number" step="0.01" value={formData.digital_price_medium} onChange={e => setFormData(prev => ({ ...prev, digital_price_medium: e.target.value }))} placeholder="0.00" className="bg-secondary border-white/10" />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Min Coloured Price (per sq cm)</label>
                                            <Input type="number" step="0.01" value={formData.digital_price_min} onChange={e => setFormData(prev => ({ ...prev, digital_price_min: e.target.value }))} placeholder="0.00" className="bg-secondary border-white/10" />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">
                                        {formData.type === 'finishing' ? 'Speed (Units/Hr)' : 'Speed (Sheets/Hr)'}
                                    </label>
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex w-full items-center rounded-lg border border-white/10 bg-secondary focus-within:ring-2 focus-within:ring-white/20 transition-all">
                                            <input type="number" value={formData.speed} onChange={e => setFormData(prev => ({ ...prev, speed: e.target.value }))} placeholder="10000" className="flex-1 bg-transparent border-none px-4 py-2.5 text-white outline-none placeholder:text-gray-500" />
                                            <div className="h-6 w-px bg-white/10"></div>
                                            <select className="bg-transparent border-none text-sm text-gray-300 focus:text-white outline-none px-3 py-2 cursor-pointer hover:text-white transition-colors" value={formData.speed_unit} onChange={e => setFormData(prev => ({ ...prev, speed_unit: e.target.value }))}>
                                                <option value="Sheets/Hr" className="bg-[#1a1a1a] text-white">Sheets/Hr</option>
                                                <option value="Units/Hr" className="bg-[#1a1a1a] text-white">Units/Hr</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                {formData.type === 'offset' && (
                                    <div className="relative">
                                        <label className="block text-sm text-gray-400 mb-1">Default Plate</label>
                                        <div className="relative">
                                            <Input value={plateSearch} onChange={(e) => { setPlateSearch(e.target.value); setShowPlateSuggestions(true); if (e.target.value === '') setFormData(prev => ({ ...prev, plate_id: '' })); }} onFocus={() => setShowPlateSuggestions(true)} onBlur={() => setTimeout(() => setShowPlateSuggestions(false), 200)} placeholder="Search plate..." className="bg-secondary border-white/10" />
                                            {showPlateSuggestions && (
                                                <ul className="absolute z-50 w-full bg-[#1a1a1a] border border-white/10 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                                                    {plates.filter(p => p.name.toLowerCase().includes(plateSearch.toLowerCase())).map(p => (
                                                        <li key={p.id} onClick={async () => { setFormData(prev => ({ ...prev, plate_id: p.id })); setPlateSearch(p.name); setShowPlateSuggestions(false); }} className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between">
                                                            <span>{p.name}</span>
                                                            <span className="text-gray-400 text-xs mt-0.5">Cost: {p.unit_cost}</span>
                                                        </li>
                                                    ))}
                                                    {plates.filter(p => p.name.toLowerCase().includes(plateSearch.toLowerCase())).length === 0 && (
                                                        <li className="px-4 py-2 text-gray-500 text-sm">No plates found</li>
                                                    )}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button type="submit" className={`w-full text-black hover:bg-gray-200 mt-2 ${isEditing ? 'bg-yellow-400 hover:bg-yellow-500' : 'bg-white'}`}>
                                {isEditing ? 'Update Machine' : 'Add Machine'}
                            </Button>
                        </form>
                    </section>
                </div>

                {/* List */}
                <div className="lg:col-span-2">
                    <div className="bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex gap-4">
                            <div className="relative flex-1">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" placeholder="Search machines..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-secondary/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-white/30" />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 text-gray-400 text-sm">
                                        <th className="p-4 font-medium">Machine Name</th>
                                        <th className="p-4 font-medium">Details</th>
                                        <th className="p-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="3" className="p-8 text-center text-gray-500">Loading...</td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan="3" className="p-8 text-center text-gray-500">No machines found</td></tr>
                                    ) : (
                                        filtered.map(item => (
                                            <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="p-4 font-medium">{item.name}</td>
                                                <td className="p-4 text-sm text-gray-400">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded w-max opacity-70 mb-1">{item.type?.replace('_', ' ')}</span>
                                                        {item.type === 'offset' && (<><span>Factor: {item.sheet_factor} | Speed: {item.speed.toLocaleString()} {item.speed_unit === 'Units/Hr' ? 'uph' : 'sph'}</span>{item.plate_name && <span className="text-yellow-500/80 text-xs">Plate: {item.plate_name}</span>}</>)}
                                                        {item.type === 'digital' && (<><span>Digital Press | {item.speed.toLocaleString()} sph</span><span className="text-yellow-500/80 text-xs">Rates: Max {item.digital_price_max} | Med {item.digital_price_medium} | Min {item.digital_price_min}</span></>)}
                                                        {item.type === 'finishing' && <span>Finishing Equipment | {item.speed.toLocaleString()} uph</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => openPerf(item)}
                                                            className="p-2 text-white/30 hover:text-white/70 transition-colors" title="Performance Analytics">
                                                            <FiBarChart2 />
                                                        </button>
                                                        <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-white transition-colors" title="Edit"><FiEdit2 /></button>
                                                        <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-500 hover:text-red-400 transition-colors" title="Delete"><FiTrash2 /></button>
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
            </div>

            {/* ── Performance Analytics Panel ─────────────────────────────────────── */}
            {perfMachine && (
                <div className="fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => { setPerfMachine(null); setPerfData(null); }} />
                    {/* Slide-in panel */}
                    <div className="w-full max-w-2xl bg-[#0a0a0a] border-l border-white/[0.08] flex flex-col overflow-hidden shadow-2xl">
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                    <FiActivity className="w-4 h-4 text-white/50" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{perfMachine.name}</p>
                                    <p className="text-xs text-white/30 capitalize">{perfMachine.type} · Performance Analytics</p>
                                </div>
                            </div>
                            <button onClick={() => { setPerfMachine(null); setPerfData(null); }} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white transition-all"><FiX /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                            {perfLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
                                </div>
                            ) : perfData ? (
                                <>
                                    {/* Currently running */}
                                    {perfData.currentTask && (
                                        <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl p-4">
                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FiActivity className="w-3 h-3" />Currently Running</p>
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

                                    {/* KPI cards */}
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

                                    {/* Status breakdown */}
                                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                        <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Task Status Breakdown</p>
                                        <div className="space-y-2">
                                            {[['Completed', perfData.summary.completed, 'bg-white/50'],['In Progress', perfData.summary.in_progress, 'bg-white/25'],['Pending', perfData.summary.pending, 'bg-white/10']].map(([label, count, bar]) => (
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

                                    {/* Monthly chart */}
                                    {perfData.monthly?.length > 0 && (
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider mb-3">Monthly Output (last 6 months)</p>
                                            <div ref={chartRef} style={{ height: 180 }} />
                                        </div>
                                    )}

                                    {/* Recent tasks */}
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

