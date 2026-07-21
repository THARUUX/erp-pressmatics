'use client';
import { useState } from 'react';
import { FiX, FiPlusCircle, FiCheck, FiLayers, FiCpu } from 'react-icons/fi';

export default function AddTaskModal({ orders = [], machines = [], initialMachineId = null, initialMachineName = '', onClose, onSuccess }) {
    const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || '');
    const [taskName, setTaskName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedMachineId, setSelectedMachineId] = useState(initialMachineId || '');
    const [estimatedMinutes, setEstimatedMinutes] = useState('');
    const [quantity, setQuantity] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!selectedOrderId) {
            setError('Please select a Sales Order.');
            return;
        }
        if (!taskName.trim()) {
            setError('Please enter a task name.');
            return;
        }

        setSubmitting(true);
        try {
            const chosenMachine = machines.find(m => String(m.id) === String(selectedMachineId));
            const machineName = chosenMachine ? chosenMachine.name : (initialMachineName || null);

            const payload = {
                name: taskName.trim(),
                description: description.trim() || null,
                machine_id: selectedMachineId ? parseInt(selectedMachineId) : null,
                machine_name: machineName,
                estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
                quantity: quantity ? parseFloat(quantity) : null,
            };

            const res = await fetch(`/api/sales-orders/${selectedOrderId}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create manual task');

            if (onSuccess) {
                await onSuccess();
            }
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-slate-950 border border-white/15 rounded-2xl w-full max-w-lg shadow-[0_32px_96px_rgba(0,0,0,0.9)] flex flex-col text-slate-100 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                            <FiPlusCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-extrabold text-white tracking-tight m-0">Add Task Manually</h2>
                            <p className="text-xs text-slate-400 m-0 mt-0.5">Create a custom production task for a sales order</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                    >
                        <FiX className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold">
                            {error}
                        </div>
                    )}

                    {/* Sales Order Selection */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Target Sales Order <span className="text-red-400">*</span>
                        </label>
                        <select
                            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark] cursor-pointer"
                            value={selectedOrderId}
                            onChange={e => setSelectedOrderId(e.target.value)}
                            required
                        >
                            <option value="" disabled>Select a Sales Order...</option>
                            {orders.map(o => (
                                <option key={o.id} value={o.id}>
                                    [{o.code}] {o.customer_name} — {o.estimation_names || 'Sales Order #' + o.id}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Task Name */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Task Name / Description <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Manual Folding, Custom Die-Cutting, Spot UV Prep..."
                            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            value={taskName}
                            onChange={e => setTaskName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Machine Assignment */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Assign Machine / Operation (Optional)
                        </label>
                        <select
                            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark] cursor-pointer"
                            value={selectedMachineId}
                            onChange={e => setSelectedMachineId(e.target.value)}
                        >
                            <option value="">Unassigned / Manual Queue</option>
                            {machines.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.name} ({m.type || 'Machine'})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Quantity & Estimated Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Quantity (Units / Sheets)
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="e.g. 5000"
                                className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                Est. Minutes
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="e.g. 45"
                                className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                value={estimatedMinutes}
                                onChange={e => setEstimatedMinutes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Additional Notes */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Notes / Special Instructions
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Optional operational details for press operators..."
                            className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2 mt-2 pt-4 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                        >
                            <FiCheck className="w-4 h-4" />
                            {submitting ? 'Creating...' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
