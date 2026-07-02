'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiClock, FiDollarSign, FiPercent, FiX, FiBriefcase, FiActivity } from 'react-icons/fi';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useSettings } from '@/components/SettingsContext';

export default function ServicesPage() {
    const { settings } = useSettings();
    const currency = settings?.currency || 'LKR';

    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [employees, setEmployees] = useState([]);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/services');
            if (res.ok) {
                const data = await res.json();
                setServices(data);
            } else {
                toast.error('Failed to load services');
            }
        } catch (error) {
            console.error('Fetch services error:', error);
            toast.error('Failed to load services');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const openCreateModal = () => {
        setEditingService(null);
        setName('');
        setDescription('');
        setEmployees([{ employee_name: '', default_rate_unit: 'per hour', rate: 0 }]);
        setShowModal(true);
    };

    const openEditModal = (service) => {
        setEditingService(service);
        setName(service.name);
        setDescription(service.description);
        setEmployees(service.employees.length > 0 ? [...service.employees] : [{ employee_name: '', default_rate_unit: 'per hour', rate: 0 }]);
        setShowModal(true);
    };

    const handleAddEmployeeRow = () => {
        setEmployees(prev => [...prev, { employee_name: '', default_rate_unit: 'per hour', rate: 0 }]);
    };

    const handleRemoveEmployeeRow = (index) => {
        setEmployees(prev => prev.filter((_, i) => i !== index));
    };

    const handleEmployeeChange = (index, field, value) => {
        setEmployees(prev => prev.map((emp, i) => {
            if (i === index) {
                return { ...emp, [field]: value };
            }
            return emp;
        }));
    };

    const handleDeleteService = async (service) => {
        if (!(await confirmDialog(`Are you sure you want to delete service "${service.name}"? This action cannot be undone.`, { danger: true, confirmLabel: 'Delete' }))) return;
        try {
            const res = await fetch(`/api/services/${service.id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Service deleted successfully');
                fetchServices();
            } else {
                toast.error('Failed to delete service');
            }
        } catch (error) {
            console.error('Delete service error:', error);
            toast.error('Failed to delete service');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Service name is required');
            return;
        }

        // Validate employees
        const validEmployees = employees.filter(emp => emp.employee_name.trim() !== '');

        const payload = {
            name,
            description,
            employees: validEmployees.map(emp => ({
                employee_name: emp.employee_name,
                default_rate_unit: emp.default_rate_unit,
                rate: parseFloat(emp.rate) || 0
            }))
        };

        try {
            const url = editingService ? `/api/services/${editingService.id}` : '/api/services';
            const method = editingService ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success(editingService ? 'Service updated' : 'Service created');
                setShowModal(false);
                fetchServices();
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error || 'Failed to save service');
            }
        } catch (error) {
            console.error('Save service error:', error);
            toast.error('Failed to save service');
        }
    };

    return (
        <div className="text-white space-y-6">
            {/* Header */}
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter flex items-center gap-3">
                        Services Management
                    </h1>
                    <p className="text-gray-500 text-sm mt-1.5 ml-1">
                        Configure business services and employee billing rates
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
                >
                    <FiPlus className="w-4 h-4" /> New Service
                </button>
            </header>

            {/* List */}
            {loading ? (
                <div className="py-24 text-center text-gray-500 animate-pulse">Loading services…</div>
            ) : services.length === 0 ? (
                <div className="py-24 text-center space-y-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl">
                    <FiBriefcase className="w-12 h-12 text-gray-700 mx-auto" />
                    <p className="text-gray-500 text-sm">No services configured yet</p>
                    <button
                        onClick={openCreateModal}
                        className="mt-2 inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm px-4 py-2 rounded-xl transition-colors"
                    >
                        <FiPlus className="w-4 h-4" /> Create your first service
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map(service => (
                        <div
                            key={service.id}
                            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col justify-between hover:border-white/20 transition-all group"
                        >
                            <div>
                                <div className="flex justify-between items-start gap-4 mb-2">
                                    <h3 className="text-lg font-bold text-white tracking-tight">{service.name}</h3>
                                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEditModal(service)}
                                            title="Edit Service"
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                        >
                                            <FiEdit2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteService(service)}
                                            title="Delete Service"
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-gray-400 text-xs line-clamp-2 mb-4 h-8">{service.description || 'No description provided.'}</p>
                            </div>

                            <div className="border-t border-white/[0.06] pt-4 mt-2">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">
                                    <FiUsers className="w-3.5 h-3.5" /> Assigned Employees
                                </div>
                                {service.employees.length === 0 ? (
                                    <p className="text-gray-600 text-xs italic mb-4">No employees assigned</p>
                                ) : (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 mb-4">
                                        {service.employees.map(emp => (
                                            <div key={emp.id} className="flex justify-between items-center text-xs bg-white/[0.02] border border-white/[0.04] rounded-lg p-2">
                                                <span className="font-medium text-gray-300">{emp.employee_name}</span>
                                                <span className="text-white/80 font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                                                    {currency} {emp.rate.toFixed(2)} <span className="text-gray-500 text-[10px]">/{emp.default_rate_unit === 'per hour' ? 'hr' : emp.default_rate_unit === 'per job' ? 'job' : 'unit'}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                <Link
                                    href={`/dashboard/services/${service.id}/planning`}
                                    className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white text-xs font-semibold py-2.5 rounded-xl transition-all"
                                >
                                    <FiActivity className="w-3.5 h-3.5 text-white/60" /> Planning &amp; Reports
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-black/20">
                            <h2 className="text-lg font-bold tracking-tight">
                                {editingService ? 'Edit Service' : 'Create New Service'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Service Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Graphic Designing, Plate Making"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 placeholder-gray-600"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Enter service details..."
                                        rows={3}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 placeholder-gray-600 resize-none"
                                    />
                                </div>
                            </div>

                            {/* Employees Rates Setup */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                                        <FiUsers /> Employees & Rates Configuration
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleAddEmployeeRow}
                                        className="text-xs bg-white/5 border border-white/10 text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1"
                                    >
                                        <FiPlus /> Add Employee
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {employees.map((emp, index) => (
                                        <div key={index} className="flex gap-3 items-center bg-black/20 border border-white/[0.04] p-3 rounded-xl">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={emp.employee_name}
                                                    onChange={e => handleEmployeeChange(index, 'employee_name', e.target.value)}
                                                    placeholder="Employee Name"
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-white/30 placeholder-gray-600"
                                                    required
                                                />
                                            </div>
                                            <div className="w-32">
                                                <select
                                                    value={emp.default_rate_unit}
                                                    onChange={e => handleEmployeeChange(index, 'default_rate_unit', e.target.value)}
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-white/30"
                                                >
                                                    <option value="per hour">Per Hour</option>
                                                    <option value="per job">Per Job</option>
                                                    <option value="per unit">Per Unit</option>
                                                </select>
                                            </div>
                                            <div className="w-28 flex items-center bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus-within:border-white/30">
                                                <span className="text-gray-500 mr-1">{currency}</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={emp.rate}
                                                    onChange={e => handleEmployeeChange(index, 'rate', e.target.value)}
                                                    placeholder="Rate"
                                                    className="w-full bg-transparent border-none text-right outline-none"
                                                    required
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveEmployeeRow(index)}
                                                disabled={employees.length <= 1}
                                                className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                            >
                                                <FiX size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-transparent border border-white/10 text-gray-300 hover:border-white/20 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-xl text-xs font-semibold transition-colors"
                                >
                                    {editingService ? 'Save Changes' : 'Create Service'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
