'use client';

import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function CustomerSuggestInput({
    value = '',
    onChange,
    customerPhone = '',
    customerEmail = '',
    customerAddress = '',
    placeholder = 'Search or enter customer name...',
    required = false,
    disabled = false
}) {
    const [customers, setCustomers] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [creating, setCreating] = useState(false);
    const wrapperRef = useRef(null);

    // Fetch customers
    const fetchCustomers = async () => {
        try {
            const res = await fetch('/api/customers');
            const data = await res.json();
            if (Array.isArray(data)) {
                setCustomers(data);
            }
        } catch (e) {
            console.error('Failed to load customers:', e);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    // Filter suggestions when value changes
    useEffect(() => {
        if (!value.trim()) {
            setSuggestions([]);
            return;
        }
        const filtered = customers.filter(c =>
            c.name.toLowerCase().includes(value.toLowerCase())
        );
        setSuggestions(filtered);

        // Check if current value matches an existing customer name exactly
        const exactMatch = customers.find(c => c.name.toLowerCase() === value.trim().toLowerCase());
        if (exactMatch) {
            setSelectedId(exactMatch.id);
        } else {
            setSelectedId(null);
        }
    }, [value, customers]);

    // Handle click outside to close suggestions
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectSuggestion = (c) => {
        setSelectedId(c.id);
        setShowSuggestions(false);
        onChange({
            name: c.name,
            id: c.id,
            phone: c.phone || '',
            email: c.email || '',
            address: c.address || ''
        });
    };

    const handleCreateCustomer = async () => {
        if (!value.trim()) {
            toast.error('Customer name is required');
            return;
        }
        setCreating(true);
        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: value.trim(),
                    phone: customerPhone || null,
                    email: customerEmail || null,
                    address: customerAddress || null
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Customer "${value}" created successfully!`);
                
                // Refresh customer list so autocomplete is aware of it
                await fetchCustomers();

                // Select the new customer
                onChange({
                    name: value.trim(),
                    id: data.id,
                    phone: customerPhone,
                    email: customerEmail,
                    address: customerAddress
                });
                setSelectedId(data.id);
            } else {
                toast.error(data.error || 'Failed to create customer');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error creating customer');
        } finally {
            setCreating(false);
        }
    };

    const hasExactMatch = customers.some(c => c.name.toLowerCase() === value.trim().toLowerCase());
    const showCreateButton = value.trim().length > 0 && !selectedId && !hasExactMatch;

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        required={required}
                        disabled={disabled}
                        value={value}
                        onChange={e => {
                            onChange({
                                name: e.target.value,
                                id: null,
                                phone: customerPhone,
                                email: customerEmail,
                                address: customerAddress
                            });
                            setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        placeholder={placeholder}
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                        <ul className="absolute z-50 w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-52 overflow-y-auto divide-y divide-zinc-900">
                            {suggestions.map(c => (
                                <li
                                    key={c.id}
                                    onClick={() => handleSelectSuggestion(c)}
                                    className="px-4 py-2.5 text-xs hover:bg-zinc-800/80 cursor-pointer flex justify-between items-center text-zinc-300 hover:text-white"
                                >
                                    <div>
                                        <p className="font-semibold">{c.name}</p>
                                        <p className="text-[10px] text-zinc-500">{c.phone || c.email || 'No contact details'}</p>
                                    </div>
                                    {selectedId === c.id && <FiCheck className="text-emerald-400" />}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {showCreateButton && (
                    <button
                        type="button"
                        onClick={handleCreateCustomer}
                        disabled={creating}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                        <FiPlus size={14} />
                        {creating ? 'Creating...' : 'Create Customer'}
                    </button>
                )}
            </div>
        </div>
    );
}
