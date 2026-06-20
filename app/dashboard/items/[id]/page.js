'use client';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { FiSave, FiArrowLeft, FiPlus } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { useSettings } from '@/components/SettingsContext';
import EstimationComponentForm from '../components/EstimationComponentForm';
import ImpositionVisualizer from '../components/ImpositionVisualizer';

export default function EditQuotationPage({ params }) {
    const unwrappedParams = use(params);
    const id = unwrappedParams.id;
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [calculating, setCalculating] = useState(false);

    // Resources
    const [machines, setMachines] = useState([]);
    const [papers, setPapers] = useState([]);
    const [availableFinishings, setAvailableFinishings] = useState([]);
    const [customers, setCustomers] = useState([]); // List of all customers
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

    // Data
    const [customerName, setCustomerName] = useState('');
    const [customerId, setCustomerId] = useState(null);
    const [estimationName, setEstimationName] = useState(''); // New
    const [jobDescription, setJobDescription] = useState('');
    const [quantity, setQuantity] = useState(1000); // Global

    const [components, setComponents] = useState([]);
    const [activeTab, setActiveTab] = useState(0);
    const [calculationResults, setCalculationResults] = useState([]);
    const [grandTotal, setGrandTotal] = useState(0);

    // Global Extras
    const [markupPercent, setMarkupPercent] = useState(0);
    const [globalFinishings, setGlobalFinishings] = useState([]);
    const [globalFinishingSearch, setGlobalFinishingSearch] = useState('');
    const [showGlobalFinishingSuggestions, setShowGlobalFinishingSuggestions] = useState(false);

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

    // Fetch Data
    useEffect(() => {
        const loadData = async () => {
            try {
                const [machinesRes, finishingsRes, papersRes, customersRes] = await Promise.all([
                    fetch('/api/machines').then(r => r.json()),
                    fetch('/api/finishings').then(r => r.json()),
                    fetch('/api/inventory?category=Paper').then(r => r.json()),
                    fetch('/api/customers').then(r => r.json())
                ]);

                setMachines(Array.isArray(machinesRes) ? machinesRes : []);
                setAvailableFinishings(Array.isArray(finishingsRes) ? finishingsRes : []);
                setPapers(Array.isArray(papersRes) ? papersRes : (papersRes?.items ?? []));
                setCustomers(Array.isArray(customersRes) ? customersRes : []);

                // Fetch Item
                const itemRes = await fetch(`/api/items/${id}`);
                const data = await itemRes.json();

                // Data structure: { item, components: [ ... ], globalFinishings: [ ... ] }
                const { item, components: fetchedComponents, globalFinishings: fetchedGlobalFinishings } = data;

                setCustomerName(item.customer_name);
                setCustomerId(item.customer_id);
                setEstimationName(item.estimation_name || ''); // Load
                setJobDescription(item.job_description);
                setQuantity(item.quantity);
                setMarkupPercent(item.markup_percent || 0);

                // Map Global Finishings
                if (fetchedGlobalFinishings && Array.isArray(fetchedGlobalFinishings)) {
                    setGlobalFinishings(fetchedGlobalFinishings.map((f, i) => ({
                        ...f,
                        id: f.id || `gf-${i}`,
                        unit_cost: parseFloat(f.unit_cost),
                        total_cost: parseFloat(f.total_cost || 0),
                        time_per_unit: parseFloat(f.time_per_unit),
                        total_time: parseFloat(f.total_time),
                        is_machine: f.is_machine === 1
                    })));
                }

                // Map fetched components to state structure
                const mappedComps = fetchedComponents.map(comp => ({
                    id: comp.id,
                    code: item.code, // Pass code for display
                    name: comp.component_name || 'Main',
                    type: comp.type || (comp.machine_id ? 'offset' : 'digital'),
                    quantity: item.quantity,
                    params: {
                        machineId: comp.machine_id || '',
                        pages: comp.pages || 1,
                        ups: comp.ups || 1,
                        sides: comp.sides || 1,
                        size: comp.size || 'A4',
                        colors: comp.colors || 4,
                        colorsFront: comp.colors_front ?? comp.colors ?? 4,
                        colorsBack: comp.colors_back ?? 0,
                        paperCostPerSheet: comp.paper_cost_per_sheet || 0,
                        plateCostPerUnit: comp.plate_cost_unit || 0,
                        impressionCostPerUnit: comp.impression_cost_unit || 0,
                        wastagePercent: comp.wastage_percent || 0,
                        digitalImpressionCost: comp.impression_cost_unit || 0, // Maps to same col
                        paperId: comp.paper_id || null,
                        paperName: comp.paper_name || '',
                        paperWidthCm: comp.paper_width_cm || '',
                        paperHeightCm: comp.paper_height_cm || '',
                        compWidthCm: comp.comp_width_cm != null ? comp.comp_width_cm : 21.0,
                        compHeightCm: comp.comp_height_cm != null ? comp.comp_height_cm : 29.7,
                        cutWidthCm: comp.cut_width_cm != null ? comp.cut_width_cm : (comp.paper_width_cm || ''),
                        cutHeightCm: comp.cut_height_cm != null ? comp.cut_height_cm : (comp.paper_height_cm || ''),
                        bleedMm: comp.bleed_mm != null ? comp.bleed_mm : 0,
                        digitalPricePerSqCm: comp.digital_price_per_sq_cm || '',
                        colorQuality: comp.color_quality || '',
                        customImpressions: comp.custom_impressions || '',
                        customWastageSheets: comp.custom_wastage_sheets != null ? comp.custom_wastage_sheets : '',
                        isBB: !!comp.is_bb,
                        customSheetFactor: comp.custom_sheet_factor != null ? comp.custom_sheet_factor : ''
                    },
                    finishings: comp.finishings.map((f, i) => ({
                        ...f,
                        id: f.id || `f-${i}`,
                        unit_cost: parseFloat(f.unit_cost),
                        time_per_unit: parseFloat(f.time_per_unit),
                    }))
                }));

                setComponents(mappedComps);
                setGrandTotal(parseFloat(item.total_amount || 0));

                setLoading(false);
            } catch (error) {
                console.error(error);
                toast.error("Failed to load");
                router.push('/dashboard/items');
            }
        };
        loadData();
    }, [id, router]);

    // ... Shared Logic with New Page ...

    // ... Handlers ...
    const handleGlobalQuantityChange = (val) => {
        setQuantity(val);
        setComponents(prev => prev.map(c => ({ ...c, quantity: val })));
    };

    const addComponent = () => {
        setComponents(prev => {
            const newComps = [...prev, {
                id: Date.now(),
                name: `Component ${prev.length + 1}`,
                type: 'offset',
                quantity: quantity,
                params: {
                    machineId: machines.find(m => m.type === 'offset')?.id || '',
                    pages: 1, ups: 1, sides: 1, size: 'A4', colorsFront: 4, colorsBack: 0,
                    paperCostPerSheet: 0, plateCostPerUnit: 0, impressionCostPerUnit: 0, wastagePercent: 5, digitalImpressionCost: 0,
                    paperId: null, paperName: '',
                    paperWidthCm: '', paperHeightCm: '', 
                    compWidthCm: 21.0, compHeightCm: 29.7,
                    cutWidthCm: '', cutHeightCm: '',
                    bleedMm: 0,
                    digitalPricePerSqCm: '', colorQuality: '',
                    customImpressions: '',
                    customWastageSheets: ''
                },
                finishings: []
            }];
            setActiveTab(prev.length);
            return newComps;
        });
    };

    const removeComponent = (index) => {
        if (components.length <= 1) return;
        setComponents(prev => {
            const filtered = prev.filter((_, i) => i !== index);
            setActiveTab(current => {
                if (current >= filtered.length) {
                    return Math.max(0, filtered.length - 1);
                }
                return current;
            });
            return filtered;
        });
    };

    const copyComponent = (index) => {
        const compToCopy = components[index];
        const copiedComp = {
            ...compToCopy,
            id: Date.now() + Math.random(),
            name: `${compToCopy.name} (Copy)`,
            params: { ...compToCopy.params },
            finishings: compToCopy.finishings.map(f => ({ ...f, id: `f-${Date.now()}-${Math.random()}` }))
        };
        setComponents(prev => {
            const newComps = [...prev];
            newComps.splice(index + 1, 0, copiedComp);
            return newComps;
        });
        setActiveTab(index + 1);
    };

    const updateComponent = (index, field, value) => {
        setComponents(prev => {
            const newComps = [...prev];
            newComps[index] = { ...newComps[index], [field]: value };
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

            comp.finishings = [...comp.finishings, { ...item, quantity: qty, total_cost: total, total_time: totalTime }];

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

    // Zero out printing-specific costs for non-Cover/non-Inner components
    const normalizeComponent = (c) => {
        const isCoverOrInner = (c.name || '').includes('Cover') || (c.name || '').includes('Inner');
        if (isCoverOrInner) return c;
        return {
            ...c,
            params: {
                ...c.params,
                machineId: '',
                plateCostPerUnit: 0,
                impressionCostPerUnit: 0,
            }
        };
    };

    const handleCalculate = async () => {
        setCalculating(true);
        try {
            const payloadComponents = components.map(c => {
                const norm = normalizeComponent(c);
                const selectedMachine = machines.find(m => m.id == norm.params.machineId);
                const selectedPaper = papers.find(m => m.id == norm.params.paperId);
                console.log(norm);
                return {
                    ...norm,
                    params: {
                        ...norm.params,
                        machineSheetFactor: selectedMachine ? selectedMachine.sheet_factor : 1.0,
                        machineSpeed: selectedMachine ? selectedMachine.speed : 0,
                        machineSpeedUnit: selectedMachine ? selectedMachine.speed_unit : 'Sheets/Hr',
                        impressionCostPerUnit: norm.type === 'digital' ? norm.params.digitalImpressionCost : norm.params.impressionCostPerUnit,
                        pages: norm.name === 'Cover' ? norm.params.sides : norm.params.pages,
                        paperWidthCm: selectedPaper ? selectedPaper.width : 0,
                        paperHeightCm: selectedPaper ? selectedPaper.height : 0,
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
            toast.error("Calculation failed");
        } finally {
            setCalculating(false);
        }
    };

    const handleUpdate = async () => {
        setSaving(true);
        try {
            const payloadComponents = components.map(c => {
                const norm = normalizeComponent(c);
                const selectedMachine = machines.find(m => m.id == norm.params.machineId);
                return {
                    ...norm,
                    params: {
                        ...norm.params,
                        machineSheetFactor: selectedMachine ? selectedMachine.sheet_factor : 1.0,
                        machineSpeed: selectedMachine ? selectedMachine.speed : 0,
                        machineSpeedUnit: selectedMachine ? selectedMachine.speed_unit : 'Sheets/Hr',
                        impressionCostPerUnit: norm.type === 'digital' ? norm.params.digitalImpressionCost : norm.params.impressionCostPerUnit,
                        pages: norm.name === 'Cover' ? norm.params.sides : norm.params.pages
                    }
                };
            });

            const res = await fetch(`/api/items/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: customerName,
                    customer_id: customerId,
                    estimation_name: estimationName,
                    job_description: jobDescription,
                    quantity: quantity,
                    components: payloadComponents,
                    markup_percent: markupPercent,
                    global_finishings: globalFinishings
                })
            });

            if (res.ok) {
                router.push('/dashboard/items');
            } else {
                toast.error("Update Failed");
            }
        } catch (error) {
            console.error(error);
            toast.error("Update Failed");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/items">
                        <Button className="bg-transparent border text-white border-white/10 hover:bg-white/10 p-2"><FiArrowLeft className='text-white'/></Button>
                    </Link>
                    <div>
                        <div className="text-xs text-blue-400 font-mono mb-0.5">{components[0]?.code}</div>
                        <h1 className="text-2xl font-bold tracking-tighter">Edit Estimation</h1>
                    </div>
                </div>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
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
                                                        onClick={async () => {
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
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {components.map((comp, idx) => {
                                        const tags = [];
                                        const machine = machines.find(m => m.id == comp.params.machineId);
                                        const compName = comp.name || `Component ${idx + 1}`;

                                        if (machine && comp.params.ups > 0) {
                                            const factor = (machine.sheet_factor || 1) * (parseInt(comp.params.ups) || 1);
                                            const sizeMap = { 1: 'A1', 2: 'A2', 4: 'A3', 8: 'A4', 16: 'A5', 32: 'A6', 64: 'A7', 128: 'A8' };
                                            if (sizeMap[factor]) tags.push(`${compName} - ${sizeMap[factor]}`);
                                        }
                                        if (comp.params.paperName) tags.push(`${compName} - ${comp.params.paperName}`);
                                        if (parseInt(comp.params.pages) > 1) tags.push(`${compName} - ${comp.params.pages} Pages`);
                                        const totalColors = (parseInt(comp.params.colorsFront) || 0) + (parseInt(comp.params.colorsBack) || 0) || parseInt(comp.params.colors) || 0;
                                        if (totalColors > 0) tags.push(`${compName} - ${totalColors} Colors`);

                                        return tags.map((t, i) => (
                                            <span
                                                key={`${idx}-${i}`}
                                                onClick={async () => {
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

                    {/* Component Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-3">
                        {components.map((comp, idx) => (
                            <button
                                key={comp.id || idx}
                                onClick={async () => setActiveTab(idx)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                                    activeTab === idx
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 border border-blue-500'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                                }`}
                            >
                                <span>{comp.name || `Component ${idx + 1}`}</span>
                                {components.length > 1 && (
                                    <span
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (await confirmDialog(`Are you sure you want to delete ${comp.name || `Component ${idx + 1}`}?`)) {
                                                removeComponent(idx);
                                            }
                                        }}
                                        className="text-gray-400 hover:text-red-400 transition-colors ml-1 text-xs px-1"
                                        title="Delete Component"
                                    >
                                        &times;
                                    </span>
                                )}
                            </button>
                        ))}
                        <button
                            onClick={addComponent}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-transparent border border-dashed border-white/20 text-gray-400 hover:border-white/40 hover:text-white transition-all flex items-center gap-1.5"
                        >
                            <FiPlus className="text-xs" /> Add Tab
                        </button>
                    </div>

                    {/* Active Component Form */}
                    {components[activeTab] && (
                        <EstimationComponentForm
                            key={components[activeTab].id}
                            index={activeTab}
                            data={components[activeTab]}
                            machines={machines}
                            papers={papers}
                            finishings={availableFinishings}
                            onChange={updateComponent}
                            onRemove={removeComponent}
                            onCopy={copyComponent}
                            onAddFinishing={addFinishingToComponent}
                            onRemoveFinishing={removeFinishingFromComponent}
                            calculationResult={calculationResults[activeTab]}
                            currency={currency}
                        />
                    )}
                </div>

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
                                                <span className="text-white">{currency}{res.costs.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                                                <span>{currency}{calculationResults.reduce((acc, r) => acc + (r.costs.paper || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Total Plates ({calculationResults.reduce((acc, r) => acc + (parseFloat(r.plateCount) || 0), 0).toFixed(1)})</span>
                                                <span>{currency}{calculationResults.reduce((acc, r) => acc + (r.costs.plate || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>

                                        {/* Finishings Breakdown */}
                                        {calculationResults.some(r => r.computedFinishings && r.computedFinishings.length > 0) && (
                                            <div className="space-y-1 pt-2 border-t border-white/5">
                                                <h4 className="text-xs text-gray-500 font-semibold mb-1">Finishings</h4>
                                                {calculationResults.flatMap(r => r.computedFinishings || []).map((f, idx) => (
                                                    <div key={idx} className="flex justify-between text-xs text-gray-300 pl-2 border-l-2 border-white/10">
                                                        <span>{f.name} ({f.quantity}) {f.total_time > 0 && <span className="text-blue-300 text-[10px] ml-1">({f.total_time.toFixed(2)} h)</span>}</span>
                                                        <span>{currency}{f.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                ))}
                                                <div className="flex justify-between text-sm pt-1 font-medium">
                                                    <span className="text-gray-400">Total Finishing</span>
                                                    <span>{currency}{calculationResults.reduce((acc, r) => acc + (r.costs.finishing || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Others / Printing */}
                                        <div className="space-y-1 pt-2 border-t border-white/5">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-400">Printing / Others</span>
                                                <span>{currency}{calculationResults.reduce((acc, r) => acc + (r.costs.printing || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    <div className="text-xl font-bold mb-2">Total: {currency}{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    <div className="text-xs">Click calculate to see breakdown</div>
                                </div>
                            )}

                            {/* Grand Total & Global Finishings (Always Visible) */}
                            <div className="bg-white/10 p-4 rounded-lg mt-4 border border-white/20">
                                {/* Global Finishings Section */}
                                <div className="mb-4 border-b border-white/10 pb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-xs text-gray-400 uppercase tracking-widest">Global Finishings</div>
                                        <div className="relative">
                                            <Input
                                                value={globalFinishingSearch}
                                                onChange={(e) => {
                                                    setGlobalFinishingSearch(e.target.value);
                                                    setShowGlobalFinishingSuggestions(true);
                                                }}
                                                onFocus={() => setShowGlobalFinishingSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowGlobalFinishingSuggestions(false), 200)}
                                                placeholder="Search global finishings..."
                                                className="w-48 bg-black/40 border-white/10 text-xs py-1.5"
                                            />
                                            {showGlobalFinishingSuggestions && (
                                                <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 border border-white/20 rounded-md shadow-xl z-50 max-h-48 overflow-y-auto">
                                                    {availableFinishings.filter(f => f.name.toLowerCase().includes(globalFinishingSearch.toLowerCase())).map(f => (
                                                        <div
                                                            key={f.id}
                                                            onClick={async () => {
                                                                addGlobalFinishing(f);
                                                                setGlobalFinishingSearch('');
                                                                setShowGlobalFinishingSuggestions(false);
                                                            }}
                                                            className="px-3 py-2 text-xs hover:bg-blue-600 cursor-pointer flex justify-between items-center transition-colors"
                                                        >
                                                            <span className="truncate pr-2 border-r border-white/10">{f.name}</span>
                                                            <span className="pl-2 shrink-0">{currency}{parseFloat(f.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                    ))}
                                                    {availableFinishings.filter(f => f.name.toLowerCase().includes(globalFinishingSearch.toLowerCase())).length === 0 && (
                                                        <div className="px-3 py-2 text-xs text-gray-500 italic">No matches found</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {globalFinishings.length > 0 ? (
                                        <div className="space-y-1">
                                            {globalFinishings.map(gf => (
                                                <div key={gf.id} className="flex justify-between items-center text-xs text-gray-300">
                                                    <div className="flex gap-2 items-center">
                                                        <button onClick={async () => removeGlobalFinishing(gf.id)} className="text-red-400 hover:text-red-300">x</button>
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
                                                <span>{currency}{globalFinishings.reduce((a, b) => a + (parseFloat(b.total_cost) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    ) : <div className="text-xs text-gray-500 italic">None added</div>}
                                </div>

                                {/* Markup Section */}
                                <div className="mb-4 text-xs">
                                    <div className="flex justify-between items-center w-full mb-1">
                                        <label className="text-gray-400 uppercase tracking-widest text-nowrap">Markup %</label>
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
                                            <span>{currency}{((grandTotal + globalFinishings.reduce((a, b) => a + b.total_cost, 0)) * (parseFloat(markupPercent) / 100 || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Grand Total</div>
                                <div className="text-2xl font-bold flex justify-between items-end">
                                    <span>Estimate</span>
                                    <span>
                                        {currency}
                                        {(
                                            (grandTotal + globalFinishings.reduce((a, b) => a + b.total_cost, 0)) *
                                            (1 + (parseFloat(markupPercent) / 100 || 0))
                                        ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 space-y-3">
                                <Button onClick={handleCalculate} disabled={calculating} className="w-full bg-white text-black hover:bg-gray-200">
                                    {calculating ? 'Calculating...' : 'Calculate Estimation'}
                                </Button>
                                <Button onClick={handleUpdate} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                                    <FiSave className="mr-2" /> {saving ? 'Saving...' : 'Update Estimation'}
                                </Button>
                            </div>
                        </section>

                        

                        {/* Imposition Plans */}
                        {/* {components.filter(c => c.type === 'offset' && c.params.ups > 0).map((comp, i) => (
                            <section key={comp.id || i} className="bg-black/60 backdrop-blur-xl p-6 rounded-xl border border-white/20 shadow-2xl">
                                <h3 className="text-md font-bold mb-4 text-gray-300 flex justify-between">
                                    <span>Planning: {comp.name}</span>
                                    <span className="text-xs font-normal text-gray-500 self-center">{comp.params.paperName}</span>
                                </h3>
                                <ImpositionVisualizer ups={comp.params.ups} />
                            </section>
                        ))} */}
                        {components[activeTab].type === 'offset'  && components[activeTab].name !== "Finishing" && (
                            <section className="bg-black/60 backdrop-blur-xl p-6 rounded-xl border border-white/20 shadow-2xl">
                                <h3 className="text-md font-bold mb-4 text-gray-300 flex justify-between">
                                    <span>Planning: {components[activeTab].name}</span>
                                    <span className="text-xs font-normal text-gray-500 self-center">{components[activeTab].params.paperName}</span>
                                </h3>
                                <ImpositionVisualizer 
                                    ups={components[activeTab].params.ups}
                                    sheetWidthCm={components[activeTab].params.cutWidthCm || components[activeTab].params.paperWidthCm}
                                    sheetHeightCm={components[activeTab].params.cutHeightCm || components[activeTab].params.paperHeightCm}
                                    compWidthCm={components[activeTab].params.compWidthCm}
                                    compHeightCm={components[activeTab].params.compHeightCm}
                                    bleedMm={components[activeTab].params.bleedMm}
                                />
                            </section>
                        )}
                    </div>
                </div>
            <div className="sticky bottom-4 w-full z-50 ">
                <Button
                    onClick={handleCalculate}
                    disabled={calculating}
                    className="px-20 backdrop-blur-[2px] border-[1px] border-white/20 bg-white/5 text-white  hover:text-black hover:bg-gray-200 shadow-lg"
                >
                    {calculating ? 'Calculating...' : 'Calculate'}
                </Button>
            </div>
            </div>

        </div>
    );
}
