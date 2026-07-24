'use client';
import { useState, useEffect } from 'react';
import { FiX, FiPlusCircle, FiCheck, FiLayers, FiCpu, FiChevronDown } from 'react-icons/fi';

// Premium Searchable Dropdown (Combobox) component
function SearchableSelect({ value, onChange, options, placeholder, clearLabel }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const selectedOption = options.find(o => String(o.value) === String(value));

    const filteredOptions = options.filter(o => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            (o.label || '').toLowerCase().includes(search) ||
            (o.sublabel || '').toLowerCase().includes(search)
        );
    });

    const displayValue = isOpen ? searchTerm : (selectedOption ? selectedOption.label : '');

    return (
        <div className="relative w-full">
            {/* Input / Trigger */}
            <div
                className="relative flex items-center cursor-pointer"
                onClick={() => {
                    if (!isOpen) {
                        setSearchTerm('');
                        setIsOpen(true);
                    }
                }}
            >
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => {
                        if (!isOpen) setIsOpen(true);
                        setSearchTerm(e.target.value);
                    }}
                    placeholder={selectedOption ? selectedOption.label : placeholder}
                    className="w-full bg-black border border-white/15 rounded-xl pl-3 pr-10 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer transition-all"
                />
                <div className="absolute right-3 flex items-center gap-1.5 text-slate-400">
                    {value && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setSearchTerm('');
                                setIsOpen(false);
                            }}
                            className="hover:text-white p-0.5 transition-colors"
                        >
                            <FiX className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <FiChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Click Outside Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[99999]"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute left-0 right-0 mt-1.5 z-[100000] bg-black border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-60">
                    <div className="overflow-y-auto py-1 scrollbar-thin">
                        {clearLabel && (
                            <button
                                type="button"
                                onClick={() => {
                                    onChange('');
                                    setIsOpen(false);
                                }}
                                className={`w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors border-b border-white/5 flex flex-col ${!value ? 'text-emerald-400 font-bold bg-white/[0.02]' : 'text-slate-400'
                                    }`}
                            >
                                <span>{clearLabel}</span>
                            </button>
                        )}

                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-slate-500 text-center">
                                No matches found
                            </div>
                        ) : (
                            filteredOptions.map(o => {
                                const isSelected = String(o.value) === String(value);
                                return (
                                    <button
                                        key={o.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(o.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors flex flex-col gap-0.5 ${isSelected ? 'text-emerald-400 font-bold bg-white/[0.02]' : 'text-slate-300'
                                            }`}
                                    >
                                        <span className="truncate">{o.label}</span>
                                        {o.sublabel && (
                                            <span className="text-[10px] text-slate-500 truncate font-normal">
                                                {o.sublabel}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AddTaskModal({
    orders = [],
    machines = [],
    initialMachineId = null,
    initialMachineName = '',
    isFinishing = false,
    onClose,
    onSuccess
}) {
    const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id || '');
    const [taskName, setTaskName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedMachineId, setSelectedMachineId] = useState(initialMachineId || '');
    const [estimatedMinutes, setEstimatedMinutes] = useState('');
    const [quantity, setQuantity] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const qtyVal = parseFloat(quantity);
        if (isNaN(qtyVal) || qtyVal <= 0) return;

        const chosenMachine = machines.find(m => String(m.id) === String(selectedMachineId));
        if (chosenMachine) {
            const speed = parseFloat(chosenMachine.speed) || 0;
            const makeReady = parseFloat(chosenMachine.make_ready_minutes) || 0;
            if (speed > 0) {
                const mins = Math.ceil((qtyVal / speed) * 60) + makeReady;
                setEstimatedMinutes(String(mins));
            }
        }
    }, [selectedMachineId, quantity, machines]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!taskName.trim()) {
            setError('Please enter a task name.');
            return;
        }

        setSubmitting(true);
        try {
            const chosenMachine = machines.find(m => String(m.id) === String(selectedMachineId));
            const machineName = chosenMachine ? chosenMachine.name : (initialMachineName || null);

            // Format task name using 3-part structure for proper display
            const categoryName = chosenMachine ? chosenMachine.name : (isFinishing ? 'Manual' : 'Machine');
            const chosenOrder = orders.find(o => String(o.id) === String(selectedOrderId));
            const orderCode = chosenOrder ? (chosenOrder.code || 'SO') : 'GENERAL';
            const finalTaskName = `${categoryName} — ${taskName.trim()} — ${orderCode}`;

            const payload = {
                name: finalTaskName,
                description: description.trim() || null,
                machine_id: isFinishing ? null : (selectedMachineId ? parseInt(selectedMachineId) : null),
                machine_name: isFinishing ? null : machineName,
                estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
                quantity: quantity ? parseFloat(quantity) : null,
            };

            const targetSO = selectedOrderId || 'unassigned';
            const res = await fetch(`/api/sales-orders/${targetSO}/tasks`, {
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

    // Prepare options for searchable select components
    const orderOptions = orders
        .filter(o => o.id !== null)
        .map(o => ({
            value: o.id,
            label: `[${o.code}] ${o.customer_name}`,
            sublabel: o.estimation_names || `Sales Order #${o.id}`
        }));

    const machineOptions = machines.map(m => ({
        value: m.id,
        label: m.name,
        sublabel: m.type || (isFinishing ? 'Finishing Operation' : 'Machine')
    }));

    return (
        <div
            className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-black/20 backdrop-blur-lg border border-white/15 rounded-2xl w-full max-w-lg shadow-[0_32px_96px_rgba(0,0,0,0.9)] flex flex-col text-slate-100 overflow-hidden"
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
                            Target Sales Order (Optional)
                        </label>
                        <SearchableSelect
                            value={selectedOrderId}
                            onChange={setSelectedOrderId}
                            options={orderOptions}
                            placeholder="Search by Sales Order, Customer, or Estimate..."
                            clearLabel="None / Standalone Task (No Sales Order)"
                        />
                    </div>

                    {/* Task Name */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Task Name / Description <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Manual Folding, Custom Die-Cutting, Spot UV Prep..."
                            className="w-full bg-black border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                            value={taskName}
                            onChange={e => setTaskName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Machine or Operation Assignment */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            {isFinishing ? 'Assign Finishing Operation (Optional)' : 'Assign Machine (Optional)'}
                        </label>
                        <SearchableSelect
                            value={selectedMachineId}
                            onChange={setSelectedMachineId}
                            options={machineOptions}
                            placeholder={isFinishing ? 'Search finishing operations...' : 'Search machines...'}
                            clearLabel="Unassigned / Manual Queue"
                        />
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
                                className="w-full bg-black border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                                className="w-full bg-black border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
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
                            className="w-full bg-black border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
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
