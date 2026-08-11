'use client';

import { useState, useEffect } from 'react';
import { FiX, FiPlus, FiTrash2, FiUser, FiCheck, FiDollarSign } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ManageEmployeesModal({
    isOpen,
    onClose,
    serviceId,
    onSaved
}) {
    const [employees, setEmployees] = useState([]);
    const [serviceName, setServiceName] = useState('');
    const [serviceDescription, setServiceDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && serviceId) {
            fetchService();
        }
    }, [isOpen, serviceId]);

    const fetchService = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/services/${serviceId}`);
            if (!res.ok) throw new Error('Failed to fetch service details');
            const data = await res.json();
            setServiceName(data.name || '');
            setServiceDescription(data.description || '');
            setEmployees(data.employees || []);
        } catch (err) {
            toast.error(err.message || 'Error loading employees');
        } finally {
            setLoading(false);
        }
    };

    const handleEmployeeChange = (index, field, value) => {
        const updated = [...employees];
        updated[index] = { ...updated[index], [field]: value };
        setEmployees(updated);
    };

    const handleAddEmployee = () => {
        setEmployees([
            ...employees,
            { employee_name: '', default_rate_unit: 'per hour', rate: 0 }
        ]);
    };

    const handleRemoveEmployee = (index) => {
        const updated = employees.filter((_, i) => i !== index);
        setEmployees(updated);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        const validEmployees = employees.filter(e => e.employee_name && e.employee_name.trim() !== '');

        setSaving(true);
        try {
            const res = await fetch(`/api/services/${serviceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: serviceName,
                    description: serviceDescription,
                    employees: validEmployees
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save employees');

            toast.success('Service employees updated successfully!');
            if (onSaved) onSaved();
            onClose();
        } catch (err) {
            toast.error(err.message || 'Error saving employees');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#0e0e11] border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200">
                            <FiUser size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">Manage Service Employees</h3>
                            <p className="text-xs text-zinc-400">Add, edit, or remove employees and rates for this service</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-zinc-400">
                            <div className="w-7 h-7 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
                        </div>
                    ) : (
                        <form id="manage-employees-form" onSubmit={handleSave} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                    Assigned Employees ({employees.length})
                                </label>
                                <button
                                    type="button"
                                    onClick={handleAddEmployee}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <FiPlus size={14} /> Add Employee
                                </button>
                            </div>

                            {employees.length === 0 ? (
                                <div className="text-center py-10 border border-dashed border-zinc-800 rounded-md bg-zinc-900/20">
                                    <FiUser size={24} className="mx-auto text-zinc-600 mb-2" />
                                    <p className="text-xs text-zinc-400">No employees assigned to this service yet.</p>
                                    <button
                                        type="button"
                                        onClick={handleAddEmployee}
                                        className="mt-3 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-md text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                        <FiPlus size={12} /> Add First Employee
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {employees.map((emp, index) => (
                                        <div
                                            key={index}
                                            className="grid grid-cols-12 gap-2 items-center bg-zinc-900/60 border border-zinc-800 rounded-md p-3 hover:border-zinc-700 transition-all"
                                        >
                                            {/* Employee Name */}
                                            <div className="col-span-5">
                                                <label className="text-[9px] uppercase font-bold text-zinc-400 block mb-1">
                                                    Employee Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={emp.employee_name || ''}
                                                    onChange={e => handleEmployeeChange(index, 'employee_name', e.target.value)}
                                                    placeholder="e.g. John Doe"
                                                    required
                                                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
                                                />
                                            </div>

                                            {/* Rate Unit */}
                                            <div className="col-span-4">
                                                <label className="text-[9px] uppercase font-bold text-zinc-400 block mb-1">
                                                    Rate Unit
                                                </label>
                                                <select
                                                    value={emp.default_rate_unit || 'per hour'}
                                                    onChange={e => handleEmployeeChange(index, 'default_rate_unit', e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 cursor-pointer"
                                                >
                                                    <option value="per hour" className="bg-zinc-900">per hour</option>
                                                    <option value="per form" className="bg-zinc-900">per form</option>
                                                    <option value="per item" className="bg-zinc-900">per item</option>
                                                    <option value="per job" className="bg-zinc-900">per job</option>
                                                    <option value="per page" className="bg-zinc-900">per page</option>
                                                </select>
                                            </div>

                                            {/* Rate */}
                                            <div className="col-span-2">
                                                <label className="text-[9px] uppercase font-bold text-zinc-400 block mb-1">
                                                    Rate (LKR)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={emp.rate || 0}
                                                    onChange={e => handleEmployeeChange(index, 'rate', e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-zinc-500"
                                                />
                                            </div>

                                            {/* Delete Action */}
                                            <div className="col-span-1 flex justify-end pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEmployee(index)}
                                                    title="Remove Employee"
                                                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="manage-employees-form"
                        disabled={saving || loading}
                        className="px-5 py-2 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-bold rounded-md text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                        {saving ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <FiCheck size={14} /> Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
