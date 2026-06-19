'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiSave, FiArrowLeft, FiPlus, FiCheck } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { useSettings } from '@/components/SettingsContext';

export default function NewQuotationContainerPage() {
    const { settings } = useSettings();
    const currency = settings.currency || '$';
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Header Data
    const [customerName, setCustomerName] = useState('');
    const [customerId, setCustomerId] = useState(null); // Selected Customer ID

    // Autocomplete Data
    const [customers, setCustomers] = useState([]);
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

    // Items Selection
    const [availableItems, setAvailableItems] = useState([]);
    const [selectedItemIds, setSelectedItemIds] = useState([]);

    useEffect(() => {
        // Fetch Customers
        fetch('/api/customers').then(res => res.json()).then(setCustomers).catch(console.error);

        // Initial Fetch of Items (Optional: or wait for selection?)
        // Let's fetch all initially if no customer selected, or empty?
        // User requested: "filter the list... when select the customer"
        // So initially maybe show all or show none? 
        // Showing all is good default behavior, filtering adds constraint.
        fetchItems();
    }, []);

    useEffect(() => {
        // Refetch items when customerId changes
        fetchItems(customerId);
    }, [customerId]);

    const fetchItems = (cId = null) => {
        let url = '/api/items';
        if (cId) url += `?customer_id=${cId}`;
        // We want all items for selection, so we might want to increase limit or handle pagination.
        // For now, let's request a high limit to get most items, or we should implement scrolling/pagination in the UI.
        // Let's just default to what the API gives, but maybe boost limit if possible.
        // API defaults to 20. That's small.
        url += (cId ? '&' : '?') + 'limit=100';

        fetch(url)
            .then(res => res.json())
            .then(data => {
                // API returns { items: [], pagination: {} }
                if (data.items && Array.isArray(data.items)) {
                    setAvailableItems(data.items);
                } else if (Array.isArray(data)) {
                    // Fallback in case API changes back to array
                    setAvailableItems(data);
                } else {
                    console.error("Expected array or { items: [] } from /api/items, got:", data);
                    setAvailableItems([]);
                }
            })
            .catch(err => {
                console.error(err);
                setAvailableItems([]);
            });
    };

    const toggleItem = (id) => {
        if (selectedItemIds.includes(id)) {
            setSelectedItemIds(prev => prev.filter(item => item !== id));
        } else {
            setSelectedItemIds(prev => [...prev, id]);
        }
    };

    const handleSave = async () => {
        if (!customerName || selectedItemIds.length === 0) {
            alert("Please enter customer name and select at least one item.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/quotations/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: customerName,
                    customer_id: customerId,
                    selected_item_ids: selectedItemIds
                })
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/dashboard/quotations/${data.quotationId}/edit`);
            } else {
                alert('Failed to save quotation.');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate total on the fly for display
    const currentTotal = availableItems
        .filter(item => selectedItemIds.includes(item.id))
        .reduce((sum, item) => sum + parseFloat(item.total_amount), 0);

    return (
        <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/quotations">
                        <Button className="bg-transparent border border-white/10 hover:bg-white/10 p-2">
                            <FiArrowLeft />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tighter">Create Master Quotation</h1>
                </div>
                <Button onClick={handleSave} disabled={loading} className="bg-white text-black hover:bg-gray-200">
                    {loading ? 'Saving...' : 'Finalize Quotation'}
                </Button>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column: Selection */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="bg-black/40 relative z-20 backdrop-blur-md p-6 rounded-xl border border-white/10">
                        <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">Client Details</h2>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Customer Name</label>
                            <div className="relative z-10">
                                <Input
                                    value={customerName}
                                    onChange={(e) => {
                                        setCustomerName(e.target.value);
                                        setCustomerId(null);
                                        setShowCustomerSuggestions(true);
                                        // fetchItems(null); // Optionally reset filter on typing? No, let them search matching names.
                                    }}
                                    onFocus={() => setShowCustomerSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                                    className="bg-secondary border-white/10"
                                    placeholder="Search or Enter Client Name"
                                />
                                {showCustomerSuggestions && (
                                    <ul className="absolute z-50 w-full bg-secondary border border-white/10 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                                        {customers
                                            .filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()))
                                            .map(c => (
                                                <li
                                                    key={c.id}
                                                    onClick={() => {
                                                        setCustomerName(c.name);
                                                        setCustomerId(c.id);
                                                        setShowCustomerSuggestions(false);
                                                    }}
                                                    className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between"
                                                >
                                                    <span>{c.name}</span>
                                                    <span className="text-gray-500 text-xs">{c.phone || c.email}</span>
                                                </li>
                                            ))}
                                        {customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).length === 0 && customerName && (
                                            <li className="px-4 py-2 text-gray-500 text-sm italic">New customer (won't be saved to database automatically)</li>
                                        )}
                                    </ul>
                                )}
                            </div>
                            {customerId && <p className="text-green-400 text-xs mt-1">✔ Customer selected. Showing their items.</p>}
                        </div>
                    </section>

                    <section className="bg-black/40 backdrop-blur-md p-6 relative z-10 rounded-xl border border-white/10">
                        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                            <h2 className="text-lg font-semibold">Select Job Estimations</h2>
                            <Link href="/dashboard/items/new">
                                <span className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1">
                                    <FiPlus /> Create New Estimation
                                </span>
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {availableItems.length === 0 && <p className="text-gray-500 text-sm">No estimations found.</p>}
                            {availableItems.map(item => {
                                const isSelected = selectedItemIds.includes(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleItem(item.id)}
                                        className={`p-4 rounded-lg border cursor-pointer transition-all flex justify-between items-center ${isSelected
                                            ? 'bg-white/10 border-white text-white'
                                            : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-white border-white' : 'border-gray-500'}`}>
                                                {isSelected && <FiCheck className="text-black text-xs" />}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">{item.estimation_name || item.job_description || 'Untitled'}</div>
                                                <div className="text-xs text-gray-400">{item.code} - {item.customer_name} ({item.quantity} units)</div>
                                            </div>
                                        </div>
                                        <div className="font-mono">
                                            {currency}{parseFloat(item.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                {/* Right Column: Summary */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8 bg-black/60 backdrop-blur-xl p-6 rounded-xl border border-white/20 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Quote Summary</h2>
                        <div className="space-y-2 mb-4">
                            {availableItems
                                .filter(item => selectedItemIds.includes(item.id))
                                .map((item, idx) => (
                                    <div key={item.id} className="flex justify-between text-sm text-gray-300">
                                        <span>{idx + 1}. {item.job_description}</span>
                                        <span>${parseFloat(item.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                ))
                            }
                        </div>
                        <div className="border-t border-white/20 pt-4 flex justify-between text-xl font-bold text-white">
                            <span>Total</span>
                            <span>{currency}{currentTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
