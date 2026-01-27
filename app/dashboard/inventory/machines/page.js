'use client';

import { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiSearch, FiEdit2, FiX } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function MachinesPage() {
    const [machines, setMachines] = useState([]);
    const [plates, setPlates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
        plate_id: ''
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
                alert(data.error || 'Operation failed');
            }
        } catch (error) {
            console.error(error);
            alert('An error occurred');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this machine?")) return;
        try {
            const res = await fetch(`/api/machines/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchMachines();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete');
            }
        } catch (error) {
            console.error(error);
            alert('Failed to delete');
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
            plate_id: item.plate_id || ''
        });
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setPlateSearch('');
        setFormData({ name: '', type: 'offset', sheet_factor: 1.0, speed: 10000, speed_unit: 'Sheets/Hr', plate_id: '' });
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
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">
                                        {formData.type === 'finishing' ? 'Speed (Units/Hr)' : 'Speed (Sheets/Hr)'}
                                    </label>
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex w-full items-center rounded-lg border border-white/10 bg-secondary focus-within:ring-2 focus-within:ring-white/20 transition-all">
                                            <input
                                                type="number"
                                                value={formData.speed}
                                                onChange={e => setFormData(prev => ({ ...prev, speed: e.target.value }))}
                                                placeholder="10000"
                                                className="flex-1 bg-transparent border-none px-4 py-2.5 text-white outline-none placeholder:text-gray-500"
                                            />
                                            <div className="h-6 w-px bg-white/10"></div>
                                            <select
                                                className="bg-transparent border-none text-sm text-gray-300 focus:text-white outline-none px-3 py-2 cursor-pointer hover:text-white transition-colors"
                                                value={formData.speed_unit}
                                                onChange={e => setFormData(prev => ({ ...prev, speed_unit: e.target.value }))}
                                            >
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
                                            <Input
                                                value={plateSearch}
                                                onChange={(e) => {
                                                    setPlateSearch(e.target.value);
                                                    setShowPlateSuggestions(true);
                                                    if (e.target.value === '') setFormData(prev => ({ ...prev, plate_id: '' }));
                                                }}
                                                onFocus={() => setShowPlateSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowPlateSuggestions(false), 200)}
                                                placeholder="Search plate..."
                                                className="bg-secondary border-white/10"
                                            />
                                            {showPlateSuggestions && (
                                                <ul className="absolute z-50 w-full bg-[#1a1a1a] border border-white/10 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                                                    {plates
                                                        .filter(p => p.name.toLowerCase().includes(plateSearch.toLowerCase()))
                                                        .map(p => (
                                                            <li
                                                                key={p.id}
                                                                onClick={() => {
                                                                    setFormData(prev => ({ ...prev, plate_id: p.id }));
                                                                    setPlateSearch(p.name);
                                                                    setShowPlateSuggestions(false);
                                                                }}
                                                                className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between"
                                                            >
                                                                <span>{p.name}</span>
                                                                <span className="text-gray-400 text-xs mt-0.5">Cost: {p.unit_cost}</span>
                                                            </li>
                                                        ))
                                                    }
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
                                <input
                                    type="text"
                                    placeholder="Search machines..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-secondary/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-white/30"
                                />
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
                                                        {item.type === 'offset' && (
                                                            <>
                                                                <span>Factor: {item.sheet_factor} | Speed: {item.speed.toLocaleString()} {item.speed_unit === 'Units/Hr' ? 'uph' : 'sph'}</span>
                                                                {item.plate_name && <span className="text-yellow-500/80 text-xs">Plate: {item.plate_name}</span>}
                                                            </>
                                                        )}
                                                        {/* Legacy handle if needed */}
                                                        {item.type === 'image' && <span>Digital Press | {item.speed.toLocaleString()} {item.speed_unit === 'Units/Hr' ? 'uph' : 'sph'}</span>}
                                                        {item.type === 'digital' && <span>Digital Press | {item.speed.toLocaleString()} {item.speed_unit === 'Units/Hr' ? 'uph' : 'sph'}</span>}
                                                        {item.type === 'finishing' && <span>Finishing Equipment | {item.speed.toLocaleString()} uph</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(item)}
                                                        className="p-2 text-gray-400 hover:text-white transition-colors"
                                                        title="Edit"
                                                    >
                                                        <FiEdit2 />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
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
        </div>
    );
}
