'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiArrowLeft, FiPlus } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { useSettings } from '@/components/SettingsContext';
import EstimationComponentForm from '../components/EstimationComponentForm';
import ImpositionVisualizer from '../components/ImpositionVisualizer';

export default function NewQuotationPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency;
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [shouldAutoCalc, setShouldAutoCalc] = useState(false); // Flag to enable auto-calc only after initial load/interaction

    // Resources
    const [machines, setMachines] = useState([]);
    const [papers, setPapers] = useState([]);
    const [availableFinishings, setAvailableFinishings] = useState([]);
    const [customers, setCustomers] = useState([]); // List of all customers
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

    // Global Form Data
    const [customerName, setCustomerName] = useState(''); // Display value (name) - Client Name
    const [customerId, setCustomerId] = useState(null);   // ID value (optional)
    const [estimationName, setEstimationName] = useState(''); // New: Estimation Name
    const [jobDescription, setJobDescription] = useState('');
    const [quantity, setQuantity] = useState(1000); // Global Quantity

    // Components List
    const [components, setComponents] = useState([
        {
            id: Date.now(),
            name: 'Main',
            type: 'offset',
            quantity: 1000, // Per component quantity (default to global)
            params: {
                machineId: '',
                pages: 1,
                ups: 1,
                sides: 1,
                colors: 4,
                paperCostPerSheet: 0,
                plateCostPerUnit: 0,
                impressionCostPerUnit: 0,
                wastagePercent: 5,
                digitalImpressionCost: 0,
                paperId: null,
                paperName: ''
            },
            finishings: []
        }
    ]);

    const [calculationResults, setCalculationResults] = useState([]);
    const [grandTotal, setGrandTotal] = useState(0);

    // Global Extras
    const [markupPercent, setMarkupPercent] = useState(0);
    const [globalFinishings, setGlobalFinishings] = useState([]);

    const addGlobalFinishing = (item) => {
        const qty = parseInt(quantity) || 1; // Default to global quantity
        setGlobalFinishings(prev => [...prev, {
            ...item,
            id: Date.now(), // Client-side ID
            quantity: qty,
            total_cost: qty * (item.unit_cost || 0),
            total_time: qty * (item.time_per_unit || 0)
        }]);
    };

    const removeGlobalFinishing = (timestampId) => {
        setGlobalFinishings(prev => prev.filter(f => f.id !== timestampId));
    };

    const updateGlobalFinishing = (id, newTotal) => {
        const val = parseFloat(newTotal) || 0;
        setGlobalFinishings(prev => prev.map(f => {
            if (f.id === id) {
                const qty = f.quantity || 1;
                return {
                    ...f,
                    total_cost: val,
                    unit_cost: val / qty // Recalculate unit cost so backend math works
                };
            }
            return f;
        }));
    };

    useEffect(() => {
        Promise.all([
            fetch('/api/machines').then(res => res.json()),
            fetch('/api/finishings').then(res => res.json()),
            fetch('/api/inventory?category=Paper').then(res => res.json()),
            fetch('/api/customers').then(res => res.json())
        ]).then(([machinesData, finishingsData, papersData, customersData]) => {
            // Safety check: ensure data are arrays
            const safeMachines = Array.isArray(machinesData) ? machinesData : [];
            const safeFinishings = Array.isArray(finishingsData) ? finishingsData : [];
            const safePapers = Array.isArray(papersData) ? papersData : [];
            const safeCustomers = Array.isArray(customersData) ? customersData : [];

            setMachines(safeMachines);
            setAvailableFinishings(safeFinishings);
            setPapers(safePapers);
            setCustomers(safeCustomers);

            // Set default machine for first component
            const firstOffset = safeMachines.find(m => m.type === 'offset');
            if (firstOffset) {
                setComponents(prev => {
                    const newComps = [...prev];
                    newComps[0].params.machineId = firstOffset.id;
                    newComps[0].params.plateCostPerUnit = firstOffset.plate_cost;
                    return newComps;
                });
            }
        }).catch(err => console.error("Failed to load data", err));
    }, []);

    // Sync Component Quantities with Global (Optional, purely UX helper)
    const handleGlobalQuantityChange = (val) => {
        setQuantity(val);
        setComponents(prev => prev.map(c => {
            const qty = parseInt(val) || 0;
            const updatedFinishings = c.finishings.map(f => ({
                ...f,
                quantity: qty,
                total_cost: qty * (f.unit_cost || 0),
                total_time: qty * (f.time_per_unit || 0)
            }));

            return {
                ...c,
                quantity: val,
                finishings: updatedFinishings
            };
        }));
    };

    const addComponent = () => {
        setComponents(prev => [...prev, {
            id: Date.now(),
            name: `Component ${prev.length + 1}`,
            type: 'offset',
            quantity: quantity,
            params: {
                machineId: machines.find(m => m.type === 'offset')?.id || '',
                pages: 1,
                ups: 1,
                sides: 1,
                colors: 4,
                paperCostPerSheet: 0,
                plateCostPerUnit: machines.find(m => m.type === 'offset')?.plate_cost || 0,
                impressionCostPerUnit: 0,
                wastagePercent: 5,
                digitalImpressionCost: 0,
                paperId: null,
                paperName: ''
            },
            finishings: []
        }]);
    };

    const removeComponent = (index) => {
        if (components.length <= 1) return;
        setComponents(prev => prev.filter((_, i) => i !== index));
    };

    const updateComponent = (index, field, value) => {
        setComponents(prev => {
            const newComps = [...prev];
            const comp = { ...newComps[index], [field]: value };

            if (field === 'quantity') {
                const qty = parseInt(value) || 0;
                comp.finishings = comp.finishings.map(f => ({
                    ...f,
                    quantity: qty,
                    total_cost: qty * (f.unit_cost || 0),
                    total_time: qty * (f.time_per_unit || 0)
                }));
            }

            newComps[index] = comp;
            return newComps;
        });
    };

    const addFinishingToComponent = (index, item) => {
        setComponents(prev => {
            const newComps = [...prev];
            // Create shallow copy of the specific component to avoid direct mutation
            const comp = { ...newComps[index] };

            const qty = parseInt(comp.quantity) || 0;
            const total = qty * item.unit_cost;
            const totalTime = qty * item.time_per_unit;

            comp.finishings = [...comp.finishings, {
                ...item,
                quantity: qty,
                total_cost: total,
                total_time: totalTime
            }];

            newComps[index] = comp;
            return newComps;
        });
    };

    const removeFinishingFromComponent = (index, finishingId) => {
        setComponents(prev => {
            const newComps = [...prev];
            const comp = { ...newComps[index] };
            comp.finishings = comp.finishings.filter(f => f.id !== finishingId);
            newComps[index] = comp;
            return newComps;
        });
    };

    const handleCalculate = async () => {
        setCalculating(true);
        try {
            // Prepare payload
            // Map params to include machineSheetFactor which is needed for calculation but not state
            const payloadComponents = components.map(c => {
                const selectedMachine = machines.find(m => m.id == c.params.machineId);
                return {
                    ...c,
                    params: {
                        ...c.params,
                        machineSheetFactor: selectedMachine ? selectedMachine.sheet_factor : 1.0,
                        machineSpeed: selectedMachine ? selectedMachine.speed : 0,
                        machineSpeedUnit: selectedMachine ? selectedMachine.speed_unit : 'Sheets/Hr',
                        impressionCostPerUnit: c.type === 'digital' ? c.params.digitalImpressionCost : c.params.impressionCostPerUnit
                    }
                };
            });

            const res = await fetch('/api/items/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ components: payloadComponents })
            });
            const data = await res.json();

            if (data.results) {
                setCalculationResults(data.results);
                setGrandTotal(data.costs.total);

                // Update computed finishings back to state?
                // Yes, backend might update costs/quantities based on logic
                // But managing this sync with local state array can be tricky.
                // For now, let's just trust the result display. 
                // However, user might save right after.
                // Let's update the components state with computed finishings?
                // data.results is array matching input order usually?
                // Yes.
                const updatedComps = [...components];
                data.results.forEach((r, i) => {
                    if (r && r.computedFinishings) {
                        updatedComps[i].finishings = r.computedFinishings;
                    }
                });
                setComponents(updatedComps);
            }

        } catch (error) {
            console.error("Calc Error:", error);
            alert("Calculation failed");
        } finally {
            setCalculating(false);
        }
    };



    const handleSave = async () => {
        if (grandTotal === 0 && !calculationResults.length) {
            await handleCalculate(); // Ensure calc run
        }
        setLoading(true);
        try {
            const payloadComponents = components.map(c => {
                const selectedMachine = machines.find(m => m.id == c.params.machineId);
                return {
                    ...c,
                    params: {
                        ...c.params,
                        machineSheetFactor: selectedMachine ? selectedMachine.sheet_factor : 1.0,
                        machineSpeed: selectedMachine ? selectedMachine.speed : 0,
                        machineSpeedUnit: selectedMachine ? selectedMachine.speed_unit : 'Sheets/Hr',
                        impressionCostPerUnit: c.type === 'digital' ? c.params.digitalImpressionCost : c.params.impressionCostPerUnit
                    }
                };
            });

            const res = await fetch('/api/items/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: customerName,
                    customer_id: customerId,
                    estimation_name: estimationName,
                    job_description: jobDescription,
                    job_description: jobDescription,
                    quantity: quantity, // Global
                    components: payloadComponents,
                    markup_percent: markupPercent,
                    global_finishings: globalFinishings
                })
            });

            if (res.ok) {
                router.push('/dashboard/items');
            } else {
                alert("Save Failed");
            }
        } catch (error) {
            console.error(error);
            alert("Save Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/items">
                        <Button className="bg-transparent border border-white/10 hover:bg-white/10 p-2"><FiArrowLeft /></Button>
                    </Link>
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Auto-Generated Code</div>
                        <h1 className="text-2xl font-bold tracking-tighter">New Estimation</h1>
                    </div>
                </div>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info */}
                    <section className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10">
                        <h2 className="text-lg font-semibold mb-4 border-b border-white/10 pb-2">Estimation Details</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Customer Name (Client)</label>
                                <div className="relative">
                                    <Input
                                        value={customerName}
                                        onChange={(e) => {
                                            setCustomerName(e.target.value);
                                            setCustomerId(null);
                                            setShowCustomerSuggestions(true);
                                        }}
                                        onFocus={() => setShowCustomerSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                                        className="bg-secondary border-white/10"
                                        placeholder="Search Client..."
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
                                                <li className="px-4 py-2 text-gray-500 text-sm italic">New customer</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Estimation Name / Title</label>
                                <Input value={estimationName} onChange={(e) => setEstimationName(e.target.value)} className="bg-secondary border-white/10" placeholder="e.g. Annual Report" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Total Quantity</label>
                                <Input type="number" value={quantity} onChange={(e) => handleGlobalQuantityChange(e.target.value)} className="bg-secondary border-white/10" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm text-gray-400 mb-1">Description</label>
                                <Input value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className="bg-secondary border-white/10" />
                                {/* Tags Generator */}
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {components.map((comp, idx) => {
                                        // Generate summary tags for each component
                                        const tags = [];
                                        const machine = machines.find(m => m.id == comp.params.machineId);
                                        const compName = comp.name || `Component ${idx + 1}`;

                                        // Limit tags to avoid clutter
                                        if (machine && comp.params.ups > 0) {
                                            const factor = (machine.sheet_factor || 1) * (parseInt(comp.params.ups) || 1);
                                            const sizeMap = { 1: 'A1', 2: 'A2', 4: 'A3', 8: 'A4', 16: 'A5', 32: 'A6', 64: 'A7', 128: 'A8' };
                                            if (sizeMap[factor]) tags.push(`${compName} - ${sizeMap[factor]}`);
                                        }
                                        if (comp.params.paperName) tags.push(`${compName} - ${comp.params.paperName}`);
                                        if (parseInt(comp.params.pages) > 1) tags.push(`${compName} - ${comp.params.pages} Pages`);
                                        if (parseInt(comp.params.colors) > 0) tags.push(`${compName} - ${comp.params.colors} Colors`);

                                        return tags.map((t, i) => (
                                            <span
                                                key={`${idx}-${i}`}
                                                onClick={() => {
                                                    setJobDescription(prev => prev ? `${prev}, ${t}` : t);
                                                }}
                                                className="px-2 py-0.5 bg-white/5 rounded text-[10px] uppercase tracking-wider text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
                                            >
                                                {t}
                                            </span>
                                        ));
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Components List */}
                    {components.map((comp, index) => (
                        <EstimationComponentForm
                            key={comp.id}
                            index={index}
                            data={comp}
                            machines={machines}
                            papers={papers}
                            finishings={availableFinishings}
                            onChange={updateComponent}
                            onRemove={removeComponent}
                            onAddFinishing={addFinishingToComponent}
                            onRemoveFinishing={removeFinishingFromComponent}
                            calculationResult={calculationResults[index]}
                            currency={currency}
                        />
                    ))}

                    <Button onClick={addComponent} className="w-full py-4 border-dashed border-2 border-white/20 bg-transparent hover:bg-white/5 text-gray-400 flex justify-center items-center gap-2">
                        <FiPlus /> Add Another Component (e.g. Cover)
                    </Button>
                </div>

                {/* Summary Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="sticky top-8 space-y-4">
                        <section className="bg-black/60 backdrop-blur-xl p-6 rounded-xl border border-white/20 shadow-2xl">
                            <h2 className="text-xl font-bold mb-4">Estimate Summary</h2>

                            {calculationResults.length > 0 ? (
                                <div className="space-y-4">
                                    {/* Component Subtotals (Collapsed/Simplified) */}
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider border-b border-white/10 pb-1">Components</h3>
                                        {calculationResults.map((res, i) => (
                                            <div key={i} className="flex justify-between text-sm">
                                                <span className="text-gray-300">{res.component_name}</span>
                                                <span className="text-white">{currency}{res.costs.total.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Detailed Breakdown */}
                                    <div className="pt-4 border-t border-white/10 space-y-3">
                                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider border-b border-white/10 pb-1">Detailed Breakdown</h3>

                                        {/* Paper & Plates */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Total Paper ({calculationResults.reduce((acc, r) => acc + (parseFloat(r.fullSheetsUsed) || 0), 0).toFixed(1)} Sheets)</span>
                                                <span>{currency}{calculationResults.reduce((acc, r) => acc + (r.costs.paper || 0), 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Total Plates ({calculationResults.reduce((acc, r) => acc + (parseFloat(r.plateCount) || 0), 0).toFixed(1)})</span>
                                                <span>{currency}{calculationResults.reduce((acc, r) => acc + (r.costs.plate || 0), 0).toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Finishings Breakdown */}
                                        {calculationResults.some(r => r.computedFinishings && r.computedFinishings.length > 0) && (
                                            <div className="space-y-1 pt-2 border-t border-white/5">
                                                <h4 className="text-xs text-gray-500 font-semibold mb-1">Finishings</h4>
                                                {calculationResults.flatMap(r => r.computedFinishings || []).map((f, idx) => (
                                                    <div key={idx} className="flex justify-between text-xs text-gray-300 pl-2 border-l-2 border-white/10">
                                                        <span>{f.name} ({f.quantity}) {f.total_time > 0 && <span className="text-blue-300 text-[10px] ml-1">({f.total_time.toFixed(2)} h)</span>}</span>
                                                        <span>{currency}{f.total_cost.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between text-sm pt-1 font-medium">
                                                    <span className="text-gray-400">Total Finishing</span>
                                                    <span>{currency}{calculationResults.reduce((acc, r) => acc + (r.costs.finishing || 0), 0).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Others / Printing */}
                                        <div className="space-y-1 pt-2 border-t border-white/5">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Printing / Others</span>
                                                <span>{currency}{calculationResults.reduce((acc, r) => acc + (r.costs.printing || 0), 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grand Total */}
                                    <div className="bg-white/10 p-4 rounded-lg mt-4 border border-white/20">
                                        {/* Global Finishings Section */}
                                        <div className="mb-4 border-b border-white/10 pb-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="text-xs text-gray-400 uppercase tracking-widest">Global Finishings</div>
                                                <div className="relative group">
                                                    <button className="text-xs text-blue-300 hover:text-white flex items-center gap-1">
                                                        <FiPlus /> Add
                                                    </button>
                                                    {/* Simple Dropdown for adding */}
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-white/20 rounded-md shadow-xl hidden group-hover:block z-50 max-h-48 overflow-y-auto">
                                                        {availableFinishings.map(f => (
                                                            <div
                                                                key={f.id}
                                                                onClick={() => addGlobalFinishing(f)}
                                                                className="px-3 py-2 text-xs hover:bg-white/10 cursor-pointer flex justify-between"
                                                            >
                                                                <span>{f.name}</span>
                                                                <span>{currency}{parseFloat(f.unit_cost).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            {globalFinishings.length > 0 ? (
                                                <div className="space-y-1">
                                                    {globalFinishings.map(gf => (
                                                        <div key={gf.id} className="flex justify-between items-center text-xs text-gray-300">
                                                            <div className="flex gap-2 items-center">
                                                                <button onClick={() => removeGlobalFinishing(gf.id)} className="text-red-400 hover:text-red-300">x</button>
                                                                <span>{gf.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-gray-500">{currency}</span>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={gf.total_cost}
                                                                    onChange={e => updateGlobalFinishing(gf.id, e.target.value)}
                                                                    className="w-20 h-6 text-right text-xs bg-black/20 border-white/10 p-1"
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between text-xs font-semibold pt-1 text-gray-400">
                                                        <span>Global Subtotal</span>
                                                        <span>{currency}{globalFinishings.reduce((a, b) => a + (parseFloat(b.total_cost) || 0), 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ) : <div className="text-xs text-gray-500 italic">None added</div>}
                                        </div>

                                        {/* Markup Section */}
                                        <div className="mb-4 text-xs">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-gray-400 uppercase tracking-widest">Markup %</label>
                                                <Input
                                                    type="number"
                                                    value={markupPercent}
                                                    onChange={e => setMarkupPercent(e.target.value)}
                                                    className="w-16 h-6 text-right text-xs bg-black/20 border-white/10 p-1"
                                                />
                                            </div>
                                            {parseFloat(markupPercent) > 0 && (
                                                <div className="flex justify-between text-gray-300">
                                                    <span>Markup Amount</span>
                                                    <span>{currency}{((grandTotal + globalFinishings.reduce((a, b) => a + b.total_cost, 0)) * (parseFloat(markupPercent) / 100 || 0)).toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Grand Total</div>
                                        <div className="text-2xl font-bold flex justify-between items-end">
                                            <span>Start Estimate</span>
                                            <span>
                                                {currency}
                                                {(
                                                    (grandTotal + globalFinishings.reduce((a, b) => a + b.total_cost, 0)) *
                                                    (1 + (parseFloat(markupPercent) / 100 || 0))
                                                ).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">Click calculate to see result</div>
                            )}

                            <div className="mt-6 space-y-3">
                                <Button onClick={handleCalculate} disabled={calculating} className="w-full bg-white text-black hover:bg-gray-200">
                                    {calculating ? 'Calculating...' : 'Calculate Quote'}
                                </Button>
                                <Button onClick={handleSave} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                                    {loading ? 'Saving...' : 'Save Quotation'}
                                </Button>
                            </div>
                        </section>

                        {/* Imposition Plans */}
                        {components.filter(c => c.type === 'offset' && c.params.ups > 0).map((comp, i) => (
                            <section key={comp.id || i} className="bg-black/60 backdrop-blur-xl p-6 rounded-xl border border-white/20 shadow-2xl">
                                <h3 className="text-md font-bold mb-4 text-gray-300 flex justify-between">
                                    <span>Planning: {comp.name}</span>
                                    <span className="text-xs font-normal text-gray-500 self-center">{comp.params.paperName}</span>
                                </h3>
                                <ImpositionVisualizer ups={comp.params.ups} />
                            </section>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
