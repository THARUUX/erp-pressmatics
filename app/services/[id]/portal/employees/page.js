'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
    FiUsers, FiPlus, FiTrash2, FiEdit2, FiCheck, FiX,
    FiClock, FiExternalLink, FiDollarSign, FiBriefcase, FiUserCheck, FiTag, FiSearch
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function DedicatedEmployeesPage({ params }) {
    const { id } = use(params);
    const [service, setService] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [systemEmployees, setSystemEmployees] = useState([]);
    const [taskCounts, setTaskCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [filterText, setFilterText] = useState('');

    // New employee inline form
    const [newEmp, setNewEmp] = useState({
        employee_name: '',
        default_rate_unit: 'per hour',
        rate: ''
    });
    const [isAdding, setIsAdding] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [portalRes, planningRes, sysEmpsRes] = await Promise.all([
                fetch(`/api/services/${id}/portal`),
                fetch(`/api/services/${id}/planning`),
                fetch(`/api/employees`).catch(() => null)
            ]);

            const portalData = await portalRes.json();
            const planningData = planningRes.ok ? await planningRes.json() : {};
            let sysEmps = [];
            if (sysEmpsRes && sysEmpsRes.ok) {
                const sysData = await sysEmpsRes.json();
                sysEmps = Array.isArray(sysData) ? sysData : (sysData.employees || []);
            }

            const currentService = portalData.service || planningData.service || null;
            const currentEmps = portalData.service?.employees || planningData.service?.employees || [];

            setService(currentService);
            setEmployees(currentEmps);
            setSystemEmployees(sysEmps);

            // Count tasks per employee from planning tasks
            const counts = {};
            (planningData.tasks || []).forEach(t => {
                if (t.assigned_to) {
                    counts[t.assigned_to] = (counts[t.assigned_to] || 0) + 1;
                }
            });
            setTaskCounts(counts);
        } catch (err) {
            toast.error(err.message || 'Error loading employee data');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSaveAll = async (updatedEmployeesList) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/services/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: service?.name || '',
                    description: service?.description || '',
                    employees: updatedEmployeesList
                })
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error || 'Failed to save employees');

            toast.success('Employee list updated');
            setEmployees(updatedEmployeesList);
            setIsAdding(false);
            setNewEmp({ employee_name: '', default_rate_unit: 'per hour', rate: '' });
            setEditingIndex(null);
        } catch (err) {
            toast.error(err.message || 'Error saving employees');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateEmployee = (e) => {
        e.preventDefault();
        if (!newEmp.employee_name.trim()) {
            toast.error('Employee name is required');
            return;
        }
        const exists = employees.some(e => e.employee_name.toLowerCase() === newEmp.employee_name.trim().toLowerCase());
        if (exists) {
            toast.error(`"${newEmp.employee_name.trim()}" is already assigned to this service.`);
            return;
        }
        const updated = [
            ...employees,
            {
                employee_name: newEmp.employee_name.trim(),
                default_rate_unit: newEmp.default_rate_unit,
                rate: parseFloat(newEmp.rate) || 0
            }
        ];
        handleSaveAll(updated);
    };

    const handleRemoveEmployee = (index) => {
        const empName = employees[index]?.employee_name;
        if (!confirm(`Are you sure you want to remove employee "${empName}" from this service?`)) return;
        const updated = employees.filter((_, i) => i !== index);
        handleSaveAll(updated);
    };

    const handleUpdateRow = (index, field, value) => {
        const updated = [...employees];
        updated[index] = { ...updated[index], [field]: value };
        setEmployees(updated);
    };

    const handleSaveRow = () => {
        const valid = employees.filter(e => e.employee_name && e.employee_name.trim() !== '');
        handleSaveAll(valid);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.employee_name.toLowerCase().includes(filterText.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen text-zinc-400">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin mb-3" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto bg-[#09090b] text-zinc-100 min-h-screen">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <FiUsers className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">
                                Employee Management
                            </h1>
                            <p className="text-zinc-400 text-xs mt-0.5">
                                {service?.name || 'Service'} · Assigned Service Technicians &amp; Rates
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                        <FiPlus size={16} /> Add New Employee
                    </button>
                </div>
            </div>

            {/* KPI Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">Total Service Staff</span>
                        <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <FiUserCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white">{employees.length}</div>
                    <div className="text-xs text-zinc-400 mt-1">Assigned service technicians</div>
                </div>

                <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">Hourly Rate Staff</span>
                        <div className="p-2 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <FiClock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {employees.filter(e => (e.default_rate_unit || 'per hour') === 'per hour').length}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">Time-tracked billing rate</div>
                </div>

                <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">Unit / Job Staff</span>
                        <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <FiTag className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {employees.filter(e => (e.default_rate_unit || 'per hour') !== 'per hour').length}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">Fixed unit billing rate</div>
                </div>
            </div>

            {/* Add Employee Form Drawer */}
            {isAdding && (
                <form
                    onSubmit={handleCreateEmployee}
                    className="bg-[#0e0e12] border border-indigo-500/30 rounded-2xl p-6 space-y-4 shadow-xl"
                >
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <FiPlus className="text-indigo-400" /> Add Employee to {service?.name || 'Service'}
                        </h3>
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <FiX size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                                Employee Name *
                            </label>
                            {systemEmployees.length > 0 && (
                                <select
                                    onChange={e => {
                                        if (e.target.value) {
                                            setNewEmp(prev => ({ ...prev, employee_name: e.target.value }));
                                        }
                                    }}
                                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-2 text-xs text-white mb-2 focus:outline-none cursor-pointer"
                                >
                                    <option value="" className="bg-zinc-900">-- Quick select system employee --</option>
                                    {systemEmployees.map(se => (
                                        <option key={se.id || se.name} value={se.name || se.employee_name} className="bg-zinc-900">
                                            {se.name || se.employee_name}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <input
                                type="text"
                                value={newEmp.employee_name}
                                onChange={e => setNewEmp({ ...newEmp, employee_name: e.target.value })}
                                placeholder="Type or select employee name..."
                                required
                                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                                Default Billing Rate Unit
                            </label>
                            <select
                                value={newEmp.default_rate_unit}
                                onChange={e => setNewEmp({ ...newEmp, default_rate_unit: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="per hour" className="bg-zinc-900">per hour</option>
                                <option value="per form" className="bg-zinc-900">per form</option>
                                <option value="per item" className="bg-zinc-900">per item</option>
                                <option value="per job" className="bg-zinc-900">per job</option>
                                <option value="per page" className="bg-zinc-900">per page</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                                Default Rate (LKR)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={newEmp.rate}
                                onChange={e => setNewEmp({ ...newEmp, rate: e.target.value })}
                                placeholder="e.g. 1500.00"
                                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-2 text-xs text-white font-mono placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-xs text-zinc-300 font-semibold transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-md text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Employee'}
                        </button>
                    </div>
                </form>
            )}

            {/* Employees Directory Table */}
            <div className="bg-[#0e0e12] border border-zinc-800/80 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/30">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Assigned Employees Directory ({employees.length})
                        </h3>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-3.5 h-3.5" />
                            <input
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                                placeholder="Search employees..."
                                className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700/80 rounded-md text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        {editingIndex !== null && (
                            <button
                                onClick={handleSaveRow}
                                disabled={saving}
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <FiCheck size={14} /> Save All Edits
                            </button>
                        )}
                    </div>
                </div>

                {filteredEmployees.length === 0 ? (
                    <div className="text-center py-16 text-zinc-400">
                        <FiUsers className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
                        <p className="text-sm">
                            {filterText ? 'No matching employees found.' : `No employees assigned to ${service?.name || 'this service'} yet.`}
                        </p>
                        {!filterText && (
                            <button
                                onClick={() => setIsAdding(true)}
                                className="mt-4 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 rounded-md text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer"
                            >
                                <FiPlus size={14} /> Add First Employee
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-widest font-mono text-[10px] border-b border-zinc-800/80">
                                <tr>
                                    <th className="px-6 py-3.5">Employee Name</th>
                                    <th className="px-6 py-3.5">Billing Rate Unit</th>
                                    <th className="px-6 py-3.5">Rate (LKR)</th>
                                    <th className="px-6 py-3.5">Assigned Tasks</th>
                                    <th className="px-6 py-3.5">Active Workspace</th>
                                    <th className="px-6 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {filteredEmployees.map((emp, index) => {
                                    const origIndex = employees.indexOf(emp);
                                    const isEditing = editingIndex === origIndex;
                                    const workspaceUrl = `/services/${id}/planning/employees/${encodeURIComponent(emp.employee_name)}`;
                                    const assignedCount = taskCounts[emp.employee_name] || 0;

                                    return (
                                        <tr key={index} className="hover:bg-zinc-800/40 transition-colors">
                                            {/* Name */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={emp.employee_name || ''}
                                                        onChange={e => handleUpdateRow(origIndex, 'employee_name', e.target.value)}
                                                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white w-full focus:outline-none focus:border-indigo-500"
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
                                                            {emp.employee_name ? emp.employee_name.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                        <span className="font-bold text-white text-sm">
                                                            {emp.employee_name}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Rate Unit */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <select
                                                        value={emp.default_rate_unit || 'per hour'}
                                                        onChange={e => handleUpdateRow(origIndex, 'default_rate_unit', e.target.value)}
                                                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                                                    >
                                                        <option value="per hour" className="bg-zinc-900">per hour</option>
                                                        <option value="per form" className="bg-zinc-900">per form</option>
                                                        <option value="per item" className="bg-zinc-900">per item</option>
                                                        <option value="per job" className="bg-zinc-900">per job</option>
                                                        <option value="per page" className="bg-zinc-900">per page</option>
                                                    </select>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[11px] font-medium">
                                                        {emp.default_rate_unit || 'per hour'}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Rate */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={emp.rate || 0}
                                                        onChange={e => handleUpdateRow(origIndex, 'rate', e.target.value)}
                                                        className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white font-mono w-28 focus:outline-none focus:border-indigo-500"
                                                    />
                                                ) : (
                                                    <span className="font-mono font-bold text-emerald-400 text-sm">
                                                        LKR {Number(emp.rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Assigned Tasks */}
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono text-xs font-semibold">
                                                    {assignedCount} task{assignedCount !== 1 ? 's' : ''}
                                                </span>
                                            </td>

                                            {/* Workspace Link */}
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={workspaceUrl}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all"
                                                >
                                                    Open Workspace <FiExternalLink size={12} />
                                                </Link>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isEditing ? (
                                                        <button
                                                            onClick={() => setEditingIndex(null)}
                                                            className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                                            title="Done editing row"
                                                        >
                                                            <FiCheck size={16} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setEditingIndex(origIndex)}
                                                            className="p-1.5 text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                                                            title="Edit Employee"
                                                        >
                                                            <FiEdit2 size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleRemoveEmployee(origIndex)}
                                                        className="p-1.5 text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                                        title="Remove Employee"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
