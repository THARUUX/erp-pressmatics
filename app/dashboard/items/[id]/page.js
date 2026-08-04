'use client';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { FiSave, FiArrowLeft, FiPlus, FiFileText, FiAlertCircle, FiPackage, FiCpu, FiCopy, FiHelpCircle, FiDownload } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { useSettings } from '@/components/SettingsContext';
import EstimationComponentForm from '../components/EstimationComponentForm';
import ImpositionVisualizer from '../components/ImpositionVisualizer';

/* ── Quotation Progress ──────────────────────────────────────────────────────── */
function QuotationProgress({ visible, progress, label }) {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 z-[9997] bg-black/65 backdrop-blur-lg flex items-center justify-center">
            <div className="bg-[#0f0f0f]/95 border border-white/10 rounded-2xl p-10 w-80 shadow-[0_24px_64px_rgba(0,0,0,0.6)] text-center">
                <div className="flex items-center justify-center mb-5">
                    <div className="relative flex items-center justify-center w-16 h-16">
                        <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 64 64" fill="none">
                            <circle cx="32" cy="32" r="28" stroke="url(#qGradItemsEdit)" strokeWidth="3" strokeLinecap="round" strokeDasharray="120 60" />
                            <defs>
                                <linearGradient id="qGradItemsEdit" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#10b981" />
                                    <stop offset="100%" stopColor="#34d399" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="relative z-10 w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
                            <FiFileText size={18} className="text-emerald-400" />
                        </div>
                    </div>
                </div>
                <div className="text-white font-bold text-base mb-1">Creating Quotation</div>
                <div className="text-gray-500 text-sm mb-6">{label}</div>
                <div className="bg-white/8 rounded-full h-1.5 overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-400"
                        style={{ width: `${progress}%` }} />
                </div>
                <div className="text-gray-600 text-xs">{progress}%</div>
            </div>
        </div>
    );
}

export default function EditQuotationPage({ params }) {
    const unwrappedParams = use(params);
    const id = unwrappedParams.id;
    const router = useRouter();
    const { settings } = useSettings();
    const currency = settings.currency;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [creatingQuotation, setCreatingQuotation] = useState(false);
    const [qProgress, setQProgress] = useState(0);
    const [qLabel, setQLabel] = useState('');
    const [quotationShortages, setQuotationShortages] = useState(null);

    // Resources
    const [machines, setMachines] = useState([]);
    const [papers, setPapers] = useState([]);
    const [availableFinishings, setAvailableFinishings] = useState([]);
    const [sfgInventory, setSfgInventory] = useState([]); // SFG/Assets items
    const [staticsInventory, setStaticsInventory] = useState([]); // Statics items
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
    const [markupAmountInput, setMarkupAmountInput] = useState('');
    const [afterMarkupInput, setAfterMarkupInput] = useState('');
    const [globalFinishings, setGlobalFinishings] = useState([]);
    const [globalFinishingSearch, setGlobalFinishingSearch] = useState('');
    const [showGlobalFinishingSuggestions, setShowGlobalFinishingSuggestions] = useState(false);

    // Bulk Variations Generator state
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showInstructionsModal, setShowInstructionsModal] = useState(false);
    const [bulkMethod, setBulkMethod] = useState('list'); // 'list' | 'helper'
    const [bulkPageCounts, setBulkPageCounts] = useState('');
    const [bulkPageList, setBulkPageList] = useState('');
    const [bulkNamingPattern, setBulkNamingPattern] = useState('[Original] - [Pages]pg');
    const [bulkDescPattern, setBulkDescPattern] = useState('[Original]');
    const [generatingBulk, setGeneratingBulk] = useState(false);
    const [bulkProgressCurrent, setBulkProgressCurrent] = useState(0);
    const [bulkProgressTotal, setBulkProgressTotal] = useState(0);
    const [bulkSelectedComponentId, setBulkSelectedComponentId] = useState('');
    const [bulkQuantities, setBulkQuantities] = useState('');
    const [bulkMarkupRates, setBulkMarkupRates] = useState('');

    useEffect(() => {
        if (showBulkModal) {
            const pComps = components.filter(c => c.type === 'offset' || c.type === 'digital');
            if (pComps.length > 0 && !bulkSelectedComponentId) {
                setBulkSelectedComponentId(pComps[0].id);
            }
        }
    }, [showBulkModal, components, bulkSelectedComponentId]);

    useEffect(() => {
        const baseTotal = grandTotal + globalFinishings.reduce((a, b) => a + (parseFloat(b.total_cost) || 0), 0);
        if (typeof document === 'undefined' || document.activeElement?.id !== 'markup-amount-input') {
            const calculated = baseTotal * (parseFloat(markupPercent) / 100 || 0);
            setMarkupAmountInput(calculated > 0 ? calculated.toFixed(2) : '');
        }
        if (typeof document === 'undefined' || document.activeElement?.id !== 'after-markup-input') {
            const calculatedAfter = baseTotal * (1 + (parseFloat(markupPercent) / 100 || 0));
            setAfterMarkupInput(calculatedAfter > 0 ? calculatedAfter.toFixed(2) : '');
        }
    }, [grandTotal, globalFinishings, markupPercent]);

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
                const [machinesRes, finishingsRes, papersRes, customersRes, sfgRes, staticsRes] = await Promise.all([
                    fetch('/api/machines').then(r => r.json()),
                    fetch('/api/finishings').then(r => r.json()),
                    fetch('/api/inventory?category=Paper').then(r => r.json()),
                    fetch('/api/customers').then(r => r.json()),
                    fetch('/api/inventory?category=SFG').then(r => r.json()),
                    fetch('/api/inventory?category=Statics').then(r => r.json())
                ]);

                setMachines(Array.isArray(machinesRes) ? machinesRes : []);
                setAvailableFinishings(Array.isArray(finishingsRes) ? finishingsRes : []);
                setPapers(Array.isArray(papersRes) ? papersRes : (papersRes?.items ?? []));
                setCustomers(Array.isArray(customersRes) ? customersRes : []);
                setSfgInventory(Array.isArray(sfgRes) ? sfgRes : []);
                setStaticsInventory(Array.isArray(staticsRes) ? staticsRes : []);

                // Fetch Item
                const itemRes = await fetch(`/api/items/${id}`);
                const data = await itemRes.json();

                if (!itemRes.ok || data.error || !data.item) {
                    console.error('Failed to load item:', data?.error || 'Unknown error');
                    toast.error('Failed to load item data.');
                    return;
                }

                // Data structure: { item, components: [ ... ], globalFinishings: [ ... ] }
                const { item, components: fetchedComponents, globalFinishings: fetchedGlobalFinishings } = data;

                setCustomerName(item.customer_name);
                setCustomerId(item.customer_id);
                setEstimationName(item.estimation_name || ''); // Load
                setJobDescription(item.job_description);
                setQuantity(item.quantity);
                setMarkupPercent(item.markup_percent != null ? parseFloat(item.markup_percent).toFixed(5) : '0.00000');

                // Map Global Finishings
                let globalFinishingCost = 0;
                if (fetchedGlobalFinishings && Array.isArray(fetchedGlobalFinishings)) {
                    setGlobalFinishings(fetchedGlobalFinishings.map((f, i) => {
                        const cost = parseFloat(f.total_cost || 0);
                        globalFinishingCost += cost;
                        return {
                            ...f,
                            id: f.id || `gf-${i}`,
                            unit_cost: parseFloat(f.unit_cost),
                            total_cost: cost,
                            time_per_unit: parseFloat(f.time_per_unit),
                            total_time: parseFloat(f.total_time),
                            is_machine: f.is_machine === 1
                        };
                    }));
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
                        customPlateCount: comp.custom_plate_count != null ? comp.custom_plate_count : '',
                        isBB: !!comp.is_bb,
                        customSheetFactor: comp.custom_sheet_factor != null ? comp.custom_sheet_factor : ''
                    },
                    finishings: comp.finishings.map((f, i) => ({
                        ...f,
                        id: f.id || `f-${i}`,
                        unit_cost: parseFloat(f.unit_cost),
                        time_per_unit: parseFloat(f.time_per_unit),
                    })),
                    services: (comp.services || []).map((s, i) => ({
                        ...s,
                        id: s.id || `svc-${i}`,
                        rate: parseFloat(s.rate),
                        multiply_by: parseFloat(s.multiply_by),
                        total_cost: parseFloat(s.total_cost)
                    })),
                    sfgLines: (comp.sfgLines || []).map(sl => ({
                        ...sl,
                        id: sl.id || `sfg-db-${sl.db_id || Math.random()}`,
                        quantity: parseFloat(sl.quantity) || 0,
                        unit_price: parseFloat(sl.unit_price) || 0,
                        total_price: parseFloat(sl.total_price) || 0,
                    })),
                    staticsLines: (comp.staticsLines || []).map(sl => ({
                        ...sl,
                        id: sl.id || `statics-db-${sl.db_id || Math.random()}`,
                        quantity: parseFloat(sl.quantity) || 0,
                        unit_price: parseFloat(sl.unit_price) || 0,
                        total_price: parseFloat(sl.total_price) || 0,
                    }))
                }));

                setComponents(mappedComps);

                const pct = item.markup_percent != null ? parseFloat(item.markup_percent) : 0;
                const totalBeforeMarkup = parseFloat(item.total_amount || 0) / (1 + pct / 100);
                const subTotal = totalBeforeMarkup - globalFinishingCost;
                setGrandTotal(subTotal);

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

    const addComponent = (customName = null) => {
        setComponents(prev => {
            const name = customName || `Component ${prev.length + 1}`;
            const newComps = [...prev, {
                id: Date.now() + Math.random(),
                name: name,
                type: 'offset',
                quantity: quantity,
                params: {
                    machineId: '',
                    pages: 1, ups: 1, sides: 1, size: 'A4', colorsFront: 4, colorsBack: 0,
                    paperCostPerSheet: 0, plateCostPerUnit: 0, impressionCostPerUnit: 0, wastagePercent: 5, digitalImpressionCost: 0,
                    paperId: null, paperName: '',
                    paperWidthCm: '', paperHeightCm: '',
                    compWidthCm: 21.0, compHeightCm: 29.7,
                    cutWidthCm: '', cutHeightCm: '',
                    bleedMm: 0,
                    digitalPricePerSqCm: '', colorQuality: '',
                    customImpressions: '',
                    customWastageSheets: '',
                    customPlateCount: ''
                },
                finishings: [],
                sfgLines: [],
                staticsLines: [],
                services: []
            }];
            setActiveTab(prev.length);
            return newComps;
        });
    };

    // Keyboard Shortcuts for adding components with specific names
    useEffect(() => {
        const handleGlobalKeys = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                return;
            }

            if (e.altKey && e.shiftKey) {
                const key = e.key.toLowerCase();
                if (key === 'm') {
                    e.preventDefault();
                    addComponent('Main');
                    toast.success('Added "Main" Component');
                } else if (key === 'c') {
                    e.preventDefault();
                    addComponent('Cover');
                    toast.success('Added "Cover" Component');
                } else if (key === 'i') {
                    e.preventDefault();
                    addComponent('Inner');
                    toast.success('Added "Inner" Component');
                } else if (key === 'f') {
                    e.preventDefault();
                    addComponent('Finishings');
                    toast.success('Added "Finishings" Component');
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeys);
        return () => window.removeEventListener('keydown', handleGlobalKeys);
    }, [machines, quantity]);

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
            finishings: compToCopy.finishings.map(f => ({ ...f, id: `f-${Date.now()}-${Math.random()}` })),
            sfgLines: (compToCopy.sfgLines || []).map(sl => ({ ...sl, id: `sfg-${Date.now()}-${Math.random()}` })),
            staticsLines: (compToCopy.staticsLines || []).map(sl => ({ ...sl, id: `statics-${Date.now()}-${Math.random()}` })),
            services: (compToCopy.services || []).map(s => ({ ...s, id: `svc-emp-${Date.now()}-${Math.random()}` }))
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

            comp.finishings = [...(comp.finishings || []), { ...item, quantity: qty, total_cost: total, total_time: totalTime }];

            newComps[index] = comp;
            return newComps;
        });
    };

    const removeFinishingFromComponent = (index, finishingId) => {
        setComponents(prev => {
            const newComps = [...prev];
            const comp = { ...newComps[index] };
            comp.finishings = (comp.finishings || []).filter(f => f.id !== finishingId);
            newComps[index] = comp;
            return newComps;
        });
    };

    // Zero out printing-specific costs for non-Cover/non-Inner components
    const normalizeComponent = (c) => {
        const isCoverOrInner = (c.name || '').toLowerCase().includes('cover') || (c.name || '').toLowerCase().includes('inner') || (c.name || '').toLowerCase().includes('main');
        const isPrintComponent = c.type === 'offset' || c.type === 'digital' || (!c.type && isCoverOrInner);
        if (isPrintComponent) return c;
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
                        makeReadyMinutes: selectedMachine ? selectedMachine.make_ready_minutes : 0,
                        setup_minutes_per_plate: selectedMachine ? selectedMachine.setup_minutes_per_plate : 0,
                        custom_make_ready_minutes: norm.params.customMakeReadyMinutes || norm.params.custom_make_ready_minutes || null,
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

    const saveEstimation = async () => {
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
                    makeReadyMinutes: selectedMachine ? selectedMachine.make_ready_minutes : 0,
                    setup_minutes_per_plate: selectedMachine ? selectedMachine.setup_minutes_per_plate : 0,
                    custom_make_ready_minutes: norm.params.customMakeReadyMinutes || norm.params.custom_make_ready_minutes || null,
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
            return true;
        } else {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Update Failed');
        }
    };

    const handleUpdate = async () => {
        setSaving(true);
        try {
            const ok = await saveEstimation();
            if (ok) {
                router.push('/dashboard/items');
            } else {
                toast.error("Update Failed");
            }
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Update Failed");
        } finally {
            setSaving(false);
        }
    };

    const getPrintComponents = () => {
        return components.filter(c => c.type === 'offset' || c.type === 'digital');
    };

    const escapeCSVField = (val) => {
        const strVal = String(val == null ? '' : val).trim();
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n') || strVal.includes('\t') || strVal.includes('|')) {
            return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
    };

    const splitCSVLine = (line, separator) => {
        const parts = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim());
        return parts.map(p => {
            let s = p;
            if (s.startsWith('"') && s.endsWith('"')) {
                s = s.slice(1, -1);
            }
            return s.replace(/""/g, '"');
        });
    };

    const buildBulkHeaderRow = (pComps) => {
        const headers = ["Name", "Quantity", "Markup %"];
        pComps.forEach(c => {
            headers.push(`${c.name} Pages`);
            headers.push(`${c.name} Colors Front`);
            headers.push(`${c.name} Colors Back`);
            headers.push(`${c.name} Ups`);
            headers.push(`${c.name} Sides`);
            headers.push(`${c.name} Machine ID`);
            headers.push(`${c.name} Paper ID`);
        });
        headers.push("Description");
        return headers.map(escapeCSVField).join(', ');
    };

    const buildActiveEstimationRow = (pComps) => {
        const rowParts = [];
        rowParts.push(escapeCSVField(estimationName || 'Estimation'));
        rowParts.push(quantity);
        rowParts.push(markupPercent);
        pComps.forEach(c => {
            rowParts.push(c.params.pages || c.params.sides || 0);
            rowParts.push(c.params.colorsFront || 0);
            rowParts.push(c.params.colorsBack || 0);
            rowParts.push(c.params.ups || 1);
            rowParts.push(c.params.sides || 1);
            rowParts.push(c.params.machineId || '');
            rowParts.push(c.params.paperId || '');
        });
        rowParts.push(escapeCSVField(jobDescription || ''));
        return rowParts.join(', ');
    };

    const handleLoadActiveAsTemplate = () => {
        const pComps = getPrintComponents();
        const header = buildBulkHeaderRow(pComps);
        const row = buildActiveEstimationRow(pComps);
        setBulkPageList(`${header}\n${row}`);
        setBulkMethod('list');
        toast.success("Loaded current item configuration as a template!");
    };

    const parseBulkText = (text) => {
        if (!text) return [];
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const pComps = getPrintComponents();
        let headerLine = lines[0];
        let separator = ',';
        if (headerLine.includes('\t')) separator = '\t';
        else if (headerLine.includes('|')) separator = '|';
        
        const tokens = splitCSVLine(headerLine.toLowerCase(), separator);
        const hasHeader = tokens.includes('name') || 
                          ((tokens.includes('quantity') || tokens.includes('qty')) && 
                           (tokens.includes('markup %') || tokens.includes('markup') || tokens.includes('markup percent') || tokens.some(t => t.endsWith('pages'))));
        
        let dataLines = lines;
        let headers = [];
        const colMap = {
            nameIdx: -1,
            qtyIdx: -1,
            markupIdx: -1,
            descIdx: -1,
            compFields: {}
        };

        if (hasHeader) {
            let separator = ',';
            if (headerLine.includes('\t')) separator = '\t';
            else if (headerLine.includes('|')) separator = '|';
            
            headers = splitCSVLine(headerLine, separator);
            dataLines = lines.slice(1);

            headers.forEach((h, idx) => {
                const hl = h.toLowerCase();
                if (hl === 'name') colMap.nameIdx = idx;
                else if (hl === 'quantity' || hl === 'qty') colMap.qtyIdx = idx;
                else if (hl === 'markup %' || hl === 'markup' || hl === 'markup percent') colMap.markupIdx = idx;
                else if (hl === 'description' || hl === 'desc') colMap.descIdx = idx;
                else {
                    pComps.forEach(c => {
                        const cNameLower = c.name.toLowerCase();
                        if (hl.startsWith(cNameLower)) {
                            let suffix = hl.substring(cNameLower.length).trim();
                            suffix = suffix.replace(/^[-_\s]+/, '');
                            if (!colMap.compFields[c.id]) {
                                colMap.compFields[c.id] = {};
                            }
                            if (suffix === 'pages') colMap.compFields[c.id].pages = idx;
                            else if (suffix === 'colors front' || suffix === 'colorsfront' || suffix === 'colors_front' || suffix === 'front colors') colMap.compFields[c.id].colorsFront = idx;
                            else if (suffix === 'colors back' || suffix === 'colorsback' || suffix === 'colors_back' || suffix === 'back colors') colMap.compFields[c.id].colorsBack = idx;
                            else if (suffix === 'ups') colMap.compFields[c.id].ups = idx;
                            else if (suffix === 'sides') colMap.compFields[c.id].sides = idx;
                            else if (suffix === 'machine id' || suffix === 'machineid' || suffix === 'machine_id' || suffix === 'machine') colMap.compFields[c.id].machineId = idx;
                            else if (suffix === 'paper id' || suffix === 'paperid' || suffix === 'paper_id' || suffix === 'paper') colMap.compFields[c.id].paperId = idx;
                        }
                    });
                }
            });
        }

        return dataLines.map((line) => {
            let separator = ',';
            if (line.includes('\t')) {
                separator = '\t';
            } else if (line.includes('|')) {
                separator = '|';
            } else {
                separator = ',';
            }
            const parts = splitCSVLine(line, separator);

            let name = '';
            let qty = parseInt(quantity);
            let markup = parseFloat(markupPercent || 0);
            let desc = jobDescription;
            const compPages = [];

            if (hasHeader) {
                if (colMap.nameIdx !== -1) name = parts[colMap.nameIdx] || '';
                if (colMap.qtyIdx !== -1) {
                    let qtyVal = parseInt(parts[colMap.qtyIdx]);
                    if (!isNaN(qtyVal)) qty = qtyVal;
                }
                if (colMap.markupIdx !== -1) {
                    let markupVal = parseFloat(parts[colMap.markupIdx]);
                    if (!isNaN(markupVal)) markup = markupVal;
                }
                
                pComps.forEach(c => {
                    const fields = colMap.compFields[c.id] || {};
                    let pVal = fields.pages !== undefined ? parseInt(parts[fields.pages]) : NaN;
                    let fallbackPages = parseInt(c.params.pages) || parseInt(c.params.sides) || 0;
                    
                    let cColorsFront = fields.colorsFront !== undefined ? parseInt(parts[fields.colorsFront]) : undefined;
                    let cColorsBack = fields.colorsBack !== undefined ? parseInt(parts[fields.colorsBack]) : undefined;
                    let cUps = fields.ups !== undefined ? parseInt(parts[fields.ups]) : undefined;
                    let cSides = fields.sides !== undefined ? parseInt(parts[fields.sides]) : undefined;
                    let cMachineId = fields.machineId !== undefined ? parts[fields.machineId] : undefined;
                    let cPaperId = fields.paperId !== undefined ? parts[fields.paperId] : undefined;

                    compPages.push({
                        componentId: c.id,
                        componentName: c.name,
                        pages: isNaN(pVal) ? fallbackPages : pVal,
                        colorsFront: cColorsFront !== undefined && !isNaN(cColorsFront) ? cColorsFront : c.params.colorsFront,
                        colorsBack: cColorsBack !== undefined && !isNaN(cColorsBack) ? cColorsBack : c.params.colorsBack,
                        ups: cUps !== undefined && !isNaN(cUps) ? cUps : c.params.ups,
                        sides: cSides !== undefined && !isNaN(cSides) ? cSides : c.params.sides,
                        machineId: cMachineId !== undefined ? cMachineId : c.params.machineId,
                        paperId: cPaperId !== undefined ? cPaperId : c.params.paperId
                    });
                });

                if (colMap.descIdx !== -1) {
                    desc = parts[colMap.descIdx] || '';
                }
            } else {
                name = parts[0] || '';
                let qtyVal = parseInt(parts[1]);
                qty = isNaN(qtyVal) ? parseInt(quantity) : qtyVal;

                let pageStartIdx = 2;
                if (parts.length >= pComps.length + 4) {
                    let markupVal = parseFloat(parts[2]);
                    markup = isNaN(markupVal) ? parseFloat(markupPercent || 0) : markupVal;
                    pageStartIdx = 3;
                } else {
                    pageStartIdx = 2;
                }

                const totalComps = pComps.length;
                let colsPerComp = 1;
                if (parts.length >= pageStartIdx + totalComps * 7) {
                    colsPerComp = 7;
                }

                let colIdx = pageStartIdx;
                pComps.forEach(c => {
                    if (colsPerComp === 7) {
                        let pVal = parseInt(parts[colIdx]);
                        let cColorsFront = parseInt(parts[colIdx + 1]);
                        let cColorsBack = parseInt(parts[colIdx + 2]);
                        let cUps = parseInt(parts[colIdx + 3]);
                        let cSides = parseInt(parts[colIdx + 4]);
                        let cMachineId = parts[colIdx + 5];
                        let cPaperId = parts[colIdx + 6];

                        let fallbackPages = parseInt(c.params.pages) || parseInt(c.params.sides) || 0;

                        compPages.push({
                            componentId: c.id,
                            componentName: c.name,
                            pages: isNaN(pVal) ? fallbackPages : pVal,
                            colorsFront: isNaN(cColorsFront) ? c.params.colorsFront : cColorsFront,
                            colorsBack: isNaN(cColorsBack) ? c.params.colorsBack : cColorsBack,
                            ups: isNaN(cUps) ? c.params.ups : cUps,
                            sides: isNaN(cSides) ? c.params.sides : cSides,
                            machineId: cMachineId !== undefined ? cMachineId : c.params.machineId,
                            paperId: cPaperId !== undefined ? cPaperId : c.params.paperId
                        });
                        colIdx += 7;
                    } else {
                        let pVal = parseInt(parts[colIdx]);
                        let fallback = parseInt(c.params.pages) || parseInt(c.params.sides) || 0;
                        compPages.push({
                            componentId: c.id,
                            componentName: c.name,
                            pages: isNaN(pVal) ? fallback : pVal,
                            colorsFront: c.params.colorsFront,
                            colorsBack: c.params.colorsBack,
                            ups: c.params.ups,
                            sides: c.params.sides,
                            machineId: c.params.machineId,
                            paperId: c.params.paperId
                        });
                        colIdx++;
                    }
                });

                if (parts.length > colIdx) {
                    desc = parts.slice(colIdx).join(separator).trim();
                } else {
                    desc = jobDescription;
                }
            }

            if (!name) {
                const pageStr = compPages.map(cp => `${cp.pages}pg`).join('-');
                name = `${estimationName || 'Estimation'} - ${pageStr}`;
            }

            return {
                name,
                qty,
                markup,
                pages: compPages,
                description: desc
            };
        });
    };

    const handleGenerateTemplate = () => {
        const pComps = getPrintComponents();
        if (pComps.length === 0) {
            toast.error("No print components found in this estimation.");
            return;
        }

        const targetComp = pComps.find(c => c.id === bulkSelectedComponentId) || pComps[0];
        
        let pList = bulkPageCounts
            .split(',')
            .map(p => parseInt(p.trim()))
            .filter(p => !isNaN(p) && p > 0);
        
        if (pList.length === 0) {
            toast.error("Please enter a valid list of page counts.");
            return;
        }

        let qList = bulkQuantities
            .split(',')
            .map(q => parseInt(q.trim()))
            .filter(q => !isNaN(q) && q > 0);
        if (qList.length === 0) {
            qList = [parseInt(quantity)];
        }

        let mList = bulkMarkupRates
            ? bulkMarkupRates.split(',').map(m => parseFloat(m.trim())).filter(m => !isNaN(m))
            : [parseFloat(markupPercent || 0)];
        if (mList.length === 0) {
            mList = [parseFloat(markupPercent || 0)];
        }

        const headerRow = buildBulkHeaderRow(pComps);
        let csvRows = [headerRow];
        const maxLen = Math.max(pList.length, qList.length, mList.length);
        for (let i = 0; i < maxLen; i++) {
            const p = pList[Math.min(i, pList.length - 1)];
            const q = qList[Math.min(i, qList.length - 1)];
            const m = mList[Math.min(i, mList.length - 1)];

            const rowParts = [];
            let name = bulkNamingPattern
                .replace('[Original]', estimationName || 'Estimation')
                .replace('[Pages]', p)
                .replace('[Qty]', q)
                .replace('[Markup]', m);
            
            let desc = bulkDescPattern
                .replace('[Original]', jobDescription || '')
                .replace('[Pages]', p)
                .replace('[Qty]', q)
                .replace('[Markup]', m);
            
            rowParts.push(escapeCSVField(name));
            rowParts.push(q);
            rowParts.push(m);

            pComps.forEach(c => {
                if (c.id === targetComp.id) {
                    rowParts.push(p);
                    rowParts.push(c.params.colorsFront || 0);
                    rowParts.push(c.params.colorsBack || 0);
                    rowParts.push(c.params.ups || 1);
                    rowParts.push(c.params.sides || 1);
                    rowParts.push(c.params.machineId || '');
                    rowParts.push(c.params.paperId || '');
                } else {
                    rowParts.push(c.params.pages || c.params.sides || 0);
                    rowParts.push(c.params.colorsFront || 0);
                    rowParts.push(c.params.colorsBack || 0);
                    rowParts.push(c.params.ups || 1);
                    rowParts.push(c.params.sides || 1);
                    rowParts.push(c.params.machineId || '');
                    rowParts.push(c.params.paperId || '');
                }
            });

            rowParts.push(escapeCSVField(desc || ''));
            csvRows.push(rowParts.join(', '));
        }

        setBulkPageList(csvRows.join('\n'));
        setBulkMethod('list');
        toast.success(`Generated ${csvRows.length - 1} rows in the editor!`);
    };

    const updateRowCell = (rowIndex, field, value, subIndex = null, subField = 'pages') => {
        const parsed = parseBulkText(bulkPageList);
        if (!parsed[rowIndex]) return;

        if (field === 'name') {
            parsed[rowIndex].name = value;
        } else if (field === 'qty') {
            parsed[rowIndex].qty = value === '' ? '' : (parseInt(value) || 0);
        } else if (field === 'markup') {
            parsed[rowIndex].markup = value === '' ? '' : (parseFloat(value) || 0);
        } else if (field === 'description') {
            parsed[rowIndex].description = value;
        } else if (field === 'pages' && subIndex !== null) {
            if (parsed[rowIndex].pages[subIndex]) {
                if (subField === 'pages' || subField === 'colorsFront' || subField === 'colorsBack' || subField === 'ups' || subField === 'sides') {
                    parsed[rowIndex].pages[subIndex][subField] = value === '' ? '' : (parseInt(value) || 0);
                } else {
                    parsed[rowIndex].pages[subIndex][subField] = value;
                }
            }
        }

        // Convert parsed rows back to text format
        const pComps = getPrintComponents();
        const header = buildBulkHeaderRow(pComps);
        const rows = parsed.map(row => {
            const rowParts = [];
            rowParts.push(escapeCSVField(row.name));
            rowParts.push(row.qty);
            rowParts.push(row.markup);
            pComps.forEach(pc => {
                const pObj = row.pages.find(p => p.componentId === pc.id || p.componentName === pc.name);
                if (pObj) {
                    rowParts.push(pObj.pages);
                    rowParts.push(pObj.colorsFront);
                    rowParts.push(pObj.colorsBack);
                    rowParts.push(pObj.ups);
                    rowParts.push(pObj.sides);
                    rowParts.push(pObj.machineId || '');
                    rowParts.push(pObj.paperId || '');
                } else {
                    rowParts.push('', '', '', '', '', '', '');
                }
            });
            rowParts.push(escapeCSVField(row.description));
            return rowParts.join(', ');
        });

        setBulkPageList([header, ...rows].join('\n'));
    };

    const handleExportCSV = () => {
        const parsed = parseBulkText(bulkPageList);
        if (parsed.length === 0) {
            toast.error("No variations to export.");
            return;
        }
        const pComps = getPrintComponents();
        const headerRow = buildBulkHeaderRow(pComps);
        const headers = splitCSVLine(headerRow, ',');
        
        const rows = parsed.map(row => {
            const line = [];
            line.push(escapeCSVField(row.name));
            line.push(row.qty);
            line.push(row.markup);
            pComps.forEach(pc => {
                const pObj = row.pages.find(p => p.componentId === pc.id || p.componentName === pc.name);
                if (pObj) {
                    line.push(pObj.pages);
                    line.push(pObj.colorsFront);
                    line.push(pObj.colorsBack);
                    line.push(pObj.ups);
                    line.push(pObj.sides);
                    line.push(escapeCSVField(pObj.machineId || ''));
                    line.push(escapeCSVField(pObj.paperId || ''));
                } else {
                    line.push('', '', '', '', '', '', '');
                }
            });
            line.push(escapeCSVField(row.description));

            return line.join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${estimationName || 'estimations'}_variations_preview.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getCutSheetDimensions = (W, H, factor) => {
        const f = parseFloat(factor) || 1.0;
        if (f <= 1.0) return { width: W, height: H };

        const num = Math.round(f);
        let bestCols = 1;
        let bestRows = num;
        let minDifference = Infinity;

        for (let c = 1; c <= num; c++) {
            if (num % c === 0) {
                const r = num / c;
                const origRatio = W / H;
                const cutRatio = (W / c) / (H / r);
                const diff = Math.abs(origRatio - cutRatio);
                if (diff < minDifference) {
                    minDifference = diff;
                    bestCols = c;
                    bestRows = r;
                }
            }
        }

        let finalW, finalH;
        if (W >= H) {
            const div1 = Math.max(bestCols, bestRows);
            const div2 = Math.min(bestCols, bestRows);
            finalW = W / div1;
            finalH = H / div2;
        } else {
            const div1 = Math.max(bestCols, bestRows);
            const div2 = Math.min(bestCols, bestRows);
            finalW = W / div2;
            finalH = H / div1;
        }

        return {
            width: Math.round(finalW * 100) / 100,
            height: Math.round(finalH * 100) / 100
        };
    };

    const handleBulkGenerate = async () => {
        const parsedRows = parseBulkText(bulkPageList);
        if (parsedRows.length === 0) {
            toast.error("No variations found to generate. Please paste or enter rows in the list editor.");
            return;
        }

        if (parsedRows.length > 500) {
            toast.error("Maximum 500 variations allowed in one batch.");
            return;
        }

        if (!(await confirmDialog(`Generate and calculate ${parsedRows.length} estimation variations? This will create new entries in your estimations directory.`, { confirmLabel: 'Generate' }))) {
            return;
        }

        setShowBulkModal(false);
        setGeneratingBulk(true);
        setBulkProgressCurrent(0);
        setBulkProgressTotal(parsedRows.length);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < parsedRows.length; i++) {
            const row = parsedRows[i];
            try {
                const updatedComponents = components.map(c => {
                    const rowPagesObj = row.pages.find(rp => rp.componentId === c.id || rp.componentName === c.name);
                    if (rowPagesObj) {
                        const machine = machines.find(m => String(m.id) === String(rowPagesObj.machineId));
                        const paper = papers.find(p => String(p.id) === String(rowPagesObj.paperId));

                        let paperCost = c.params.paperCostPerSheet;
                        if (paper) {
                            paperCost = parseFloat(paper.unit_cost) || parseFloat(paper.cost_per_sheet) || 0;
                        }

                        const factor = machine ? parseFloat(machine.sheet_factor) : null;
                        const paperW = paper ? (parseFloat(paper.width_cm) || 0) : (parseFloat(c.params.paperWidthCm) || 0);
                        const paperH = paper ? (parseFloat(paper.height_cm) || 0) : (parseFloat(c.params.paperHeightCm) || 0);
                        const cutDims = getCutSheetDimensions(paperW, paperH, factor);

                        return {
                            ...c,
                            quantity: row.qty,
                            params: {
                                ...c.params,
                                pages: rowPagesObj.pages,
                                colorsFront: rowPagesObj.colorsFront,
                                colorsBack: rowPagesObj.colorsBack,
                                ups: rowPagesObj.ups,
                                sides: rowPagesObj.sides,
                                machineId: rowPagesObj.machineId || null,
                                paperId: rowPagesObj.paperId || null,
                                paperName: paper ? paper.name : c.params.paperName,
                                paperWidthCm: paperW,
                                paperHeightCm: paperH,
                                paperCostPerSheet: paperCost,
                                cutWidthCm: cutDims.width,
                                cutHeightCm: cutDims.height,
                                plateCostPerUnit: machine ? (parseFloat(machine.plate_cost) || 0) : (parseFloat(c.params.plateCostPerUnit) || 0),
                            }
                        };
                    }
                    return {
                        ...c,
                        quantity: row.qty
                    };
                });

                const payloadComponents = updatedComponents.map(c => {
                    const norm = normalizeComponent(c);
                    const selectedMachine = machines.find(m => String(m.id) === String(norm.params.machineId));
                    const selectedPaper = papers.find(m => String(m.id) === String(norm.params.paperId));
                    return {
                        ...norm,
                        params: {
                            ...norm.params,
                            machineSheetFactor: selectedMachine ? selectedMachine.sheet_factor : 1.0,
                            machineSpeed: selectedMachine ? selectedMachine.speed : 0,
                            machineSpeedUnit: selectedMachine ? selectedMachine.speed_unit : 'Sheets/Hr',
                            makeReadyMinutes: selectedMachine ? selectedMachine.make_ready_minutes : 0,
                            setup_minutes_per_plate: selectedMachine ? selectedMachine.setup_minutes_per_plate : 0,
                            custom_make_ready_minutes: norm.params.customMakeReadyMinutes || norm.params.custom_make_ready_minutes || null,
                            impressionCostPerUnit: norm.type === 'digital' ? norm.params.digitalImpressionCost : norm.params.impressionCostPerUnit,
                            pages: norm.name === 'Cover' ? norm.params.sides : norm.params.pages,
                            paperWidthCm: selectedPaper ? (parseFloat(selectedPaper.width_cm) || 0) : (parseFloat(norm.params.paperWidthCm) || 0),
                            paperHeightCm: selectedPaper ? (parseFloat(selectedPaper.height_cm) || 0) : (parseFloat(norm.params.paperHeightCm) || 0),
                        }
                    };
                });

                const calcRes = await fetch('/api/items/calculate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ components: payloadComponents })
                });

                if (!calcRes.ok) throw new Error("Calculation failed");
                const calcData = await calcRes.json();

                if (calcData.results) {
                    calcData.results.forEach((r, idx) => {
                        if (r && r.computedFinishings) {
                            payloadComponents[idx].finishings = r.computedFinishings;
                        }
                    });
                }

                const saveRes = await fetch('/api/items/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customer_name: customerName,
                        customer_id: customerId,
                        estimation_name: row.name,
                        job_description: row.description,
                        quantity: row.qty,
                        components: payloadComponents,
                        markup_percent: row.markup,
                        global_finishings: globalFinishings
                    })
                });

                if (saveRes.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                console.error(`Failed to generate variation ${row.name}:`, err);
                failCount++;
            }

            setBulkProgressCurrent(prev => prev + 1);
        }

        setGeneratingBulk(false);
        if (successCount > 0) {
            toast.success(`Successfully generated ${successCount} variations!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
            router.push('/dashboard/items');
        } else {
            toast.error("Failed to generate variations.");
        }
    };

    const handleConvertToQuote = async (ignoreStock = false) => {
        setSaving(true);

        try {
            setCreatingQuotation(true);
            setQProgress(10);
            setQLabel('Updating estimation...');
            await saveEstimation();

            setQProgress(20);
            setQLabel('Initializing...');

            const stages = [
                { pct: 35, label: 'Connecting to database...' },
                { pct: 55, label: 'Fetching customer details...' },
                { pct: 70, label: 'Creating quotation container...' },
                { pct: 85, label: 'Linking item to quotation...' },
                { pct: 95, label: 'Finalising...' }
            ];

            let si = 0;
            const tick = setInterval(() => {
                if (si < stages.length) {
                    setQProgress(stages[si].pct);
                    setQLabel(stages[si].label);
                    si++;
                }
            }, 300);

            const res = await fetch('/api/quotations/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: customerName || 'Generic Customer',
                    customer_id: customerId || null,
                    selected_item_ids: [id],
                    ignore_stock_warning: ignoreStock
                })
            });

            const d = await res.json();
            clearInterval(tick);

            if (res.ok && d.quotationId) {
                setQProgress(100);
                setQLabel('Redirecting to quotation...');
                await new Promise(r => setTimeout(r, 600));
                setCreatingQuotation(false);
                router.push(`/dashboard/quotations/${d.quotationId}`);
            } else if (res.status === 422 && d.error === 'insufficient_stock') {
                setCreatingQuotation(false);
                setQuotationShortages(d.shortages);
            } else {
                setCreatingQuotation(false);
                toast.error(d.error || 'Failed to create quotation');
            }

        } catch (error) {
            setCreatingQuotation(false);
            console.error(error);
            toast.error(error.message || 'Error creating quotation');
        } finally {
            setSaving(false);
        }
    };

    // Keyboard Shortcuts for actions (calculate, update, convert to quote)
    useEffect(() => {
        const handleActionKeys = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                return;
            }

            if (e.altKey && e.shiftKey) {
                const key = e.key.toLowerCase();
                if (key === 'x') {
                    e.preventDefault();
                    handleCalculate();
                } else if (key === 's') {
                    e.preventDefault();
                    handleUpdate();
                } else if (key === 'q') {
                    e.preventDefault();
                    handleConvertToQuote(false);
                }
            }
        };

        window.addEventListener('keydown', handleActionKeys);
        return () => window.removeEventListener('keydown', handleActionKeys);
    }, [handleCalculate, handleUpdate, handleConvertToQuote]);

    if (loading) return <div className="p-8 text-white">Loading...</div>;

    const baseTotal = grandTotal + globalFinishings.reduce((a, b) => a + (parseFloat(b.total_cost) || 0), 0);

    return (
        <div className="min-h-screen bg-transparent text-white p-4 md:p-8">
            <QuotationProgress visible={creatingQuotation} progress={qProgress} label={qLabel} />

            {/* ── Bulk Instructions Modal ─────────────────────────────────── */}
            {showInstructionsModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-2 mb-4">
                            <FiHelpCircle className="w-5 h-5 text-emerald-400" />
                            <h2 className="text-lg font-bold text-white">How Bulk Page Generation Works</h2>
                        </div>

                        <div className="space-y-4 text-xs text-gray-300 leading-relaxed max-h-96 overflow-y-auto pr-1">
                            <p>
                                Use this tool to generate dozens or hundreds of variations of this estimation with different page counts automatically.
                            </p>

                            <div className="border-l-2 border-emerald-500/50 pl-3 py-1 space-y-2">
                                <h4 className="font-semibold text-white font-bold">1. Select Page Count Method</h4>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li><strong>Range:</strong> Creates variations using a start page, end page, and step interval (e.g. from 16 to 128 in steps of 8 creates: 16, 24, 32, ... 128).</li>
                                    <li><strong>Specific List:</strong> Enter specific page counts separated by commas (e.g. <code className="text-emerald-400">16, 24, 48, 96</code>).</li>
                                </ul>
                            </div>

                            <div className="border-l-2 border-emerald-500/50 pl-3 py-1 space-y-2">
                                <h4 className="font-semibold text-white font-bold">2. Naming Pattern</h4>
                                <p>
                                    Customize the output names using placeholders:
                                </p>
                                <ul className="list-disc pl-4 space-y-1">
                                    <li><code className="text-emerald-400">[Original]</code> inserts this estimation's current name.</li>
                                    <li><code className="text-emerald-400">[Pages]</code> inserts the specific variation's page count.</li>
                                </ul>
                            </div>

                            <div className="border-l-2 border-emerald-500/50 pl-3 py-1 space-y-2">
                                <h4 className="font-semibold text-white font-bold">3. Component Target</h4>
                                <p>
                                    The generator updates page parameters for all non-Cover components. Cover components retain their sides/cover settings.
                                </p>
                            </div>

                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-300 text-[11px]">
                                <strong>Note:</strong> Each variation is fully calculated (running the pricing engine for sheets, plates, and finishings) before saving. This guarantees accurate costs!
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                type="button"
                                onClick={() => setShowInstructionsModal(false)}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bulk Page Variations Modal ───────────────────────────────── */}
            {showBulkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-4xl shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-bold text-white">Bulk Generate Variations</h2>
                            <button
                                type="button"
                                onClick={() => setShowInstructionsModal(true)}
                                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                            >
                                <FiHelpCircle size={14} /> Help & Instructions
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            Generate variations with custom names, quantities, descriptions, and page counts per component.
                        </p>

                        {/* Tab Headers */}
                        <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                            <button
                                type="button"
                                onClick={() => setBulkMethod('list')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${bulkMethod === 'list'
                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                1. List Editor / Excel Paste
                            </button>
                            <button
                                type="button"
                                onClick={() => setBulkMethod('helper')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${bulkMethod === 'helper'
                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                2. Auto-Generate Helper
                            </button>
                        </div>

                        {bulkMethod === 'list' ? (
                            <div className="space-y-4 text-xs">
                                <div>
                                    <div className="text-gray-400 mb-1 font-semibold uppercase tracking-wider text-[10px]">
                                        Expected Columns (Comma or Tab Separated):
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-2.5 rounded-lg font-mono text-[10px] text-emerald-300">
                                        Name | Qty | Markup % | {getPrintComponents().map(c => `${c.name} Pages`).join(' | ')} | Description
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-1">
                                        Tip: You can copy-paste directly from Microsoft Excel or Google Sheets. Leave any column blank to use the original value.
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-gray-400 font-semibold">Enter / Paste Rows:</label>
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={handleLoadActiveAsTemplate}
                                                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold hover:underline"
                                            >
                                                Load Current as Template
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setBulkPageList('')}
                                                className="text-[10px] text-red-400 hover:text-red-300 font-semibold hover:underline"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        rows={6}
                                        value={bulkPageList}
                                        onChange={e => setBulkPageList(e.target.value)}
                                        placeholder={`e.g. paste Excel rows with headers or raw values here...`}
                                        className="w-full bg-secondary text-white border border-white/10 rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-white/30"
                                    />
                                </div>

                                {/* Preview Grid */}
                                {parseBulkText(bulkPageList).length > 0 && (
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <div className="text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                                                Parsed Spreadsheet Preview ({parseBulkText(bulkPageList).length} rows):
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleExportCSV}
                                                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 hover:underline"
                                            >
                                                <FiDownload size={12} /> Export CSV / Excel
                                            </button>
                                        </div>
                                        <div className="border border-white/10 rounded-lg overflow-x-auto max-h-60 overflow-y-auto">
                                            <table className="w-full text-[11px] text-left border-collapse min-w-[1000px]">
                                                <thead>
                                                    <tr className="bg-white/5 border-b border-white/10 text-gray-400 font-semibold">
                                                        <th className="p-2 border-r border-white/10 w-48">Name</th>
                                                        <th className="p-2 border-r border-white/10 text-right w-16">Qty</th>
                                                        <th className="p-2 border-r border-white/10 text-right w-16">Markup %</th>
                                                        {getPrintComponents().flatMap(c => [
                                                            <th key={`${c.id}-pages`} className="p-2 border-r border-white/10 text-right w-16 whitespace-nowrap">{c.name} Pages</th>,
                                                            <th key={`${c.id}-colors`} className="p-2 border-r border-white/10 text-center w-20 whitespace-nowrap">{c.name} Colors (F/B)</th>,
                                                            <th key={`${c.id}-ups`} className="p-2 border-r border-white/10 text-center w-20 whitespace-nowrap">{c.name} Ups/Sides</th>,
                                                            <th key={`${c.id}-machine`} className="p-2 border-r border-white/10 text-left w-28 whitespace-nowrap">{c.name} Machine</th>,
                                                            <th key={`${c.id}-paper`} className="p-2 border-r border-white/10 text-left w-36 whitespace-nowrap">{c.name} Paper</th>
                                                        ])}
                                                        <th className="p-2">Description</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {parseBulkText(bulkPageList).map((row, rIdx) => (
                                                        <tr key={rIdx} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                            <td className="p-1 border-r border-white/10">
                                                                <input
                                                                    type="text"
                                                                    value={row.name}
                                                                    onChange={e => updateRowCell(rIdx, 'name', e.target.value)}
                                                                    className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-white rounded outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-1 border-r border-white/10">
                                                                <input
                                                                    type="number"
                                                                    value={row.qty}
                                                                    onChange={e => updateRowCell(rIdx, 'qty', e.target.value)}
                                                                    className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-white rounded text-right font-mono outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-1 border-r border-white/10">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={row.markup}
                                                                    onChange={e => updateRowCell(rIdx, 'markup', e.target.value)}
                                                                    className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-white rounded text-right font-mono outline-none"
                                                                />
                                                            </td>
                                                            {row.pages.map((p, pIdx) => (
                                                                <React.Fragment key={pIdx}>
                                                                    {/* Pages */}
                                                                    <td className="p-1 border-r border-white/10">
                                                                        <input
                                                                            type="number"
                                                                            value={p.pages}
                                                                            onChange={e => updateRowCell(rIdx, 'pages', e.target.value, pIdx, 'pages')}
                                                                            className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-emerald-400 rounded text-right font-mono outline-none"
                                                                        />
                                                                    </td>
                                                                    {/* Colors F/B */}
                                                                    <td className="p-1 border-r border-white/10">
                                                                        <div className="flex items-center gap-1 font-mono">
                                                                            <input
                                                                                type="number"
                                                                                placeholder="F"
                                                                                value={p.colorsFront}
                                                                                onChange={e => updateRowCell(rIdx, 'pages', e.target.value, pIdx, 'colorsFront')}
                                                                                className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-white rounded text-center outline-none"
                                                                            />
                                                                            <span className="text-gray-600">/</span>
                                                                            <input
                                                                                type="number"
                                                                                placeholder="B"
                                                                                value={p.colorsBack}
                                                                                onChange={e => updateRowCell(rIdx, 'pages', e.target.value, pIdx, 'colorsBack')}
                                                                                className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-white rounded text-center outline-none"
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    {/* Ups/Sides */}
                                                                    <td className="p-1 border-r border-white/10">
                                                                        <div className="flex items-center gap-1 font-mono">
                                                                            <input
                                                                                type="number"
                                                                                placeholder="U"
                                                                                value={p.ups}
                                                                                onChange={e => updateRowCell(rIdx, 'pages', e.target.value, pIdx, 'ups')}
                                                                                className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-white rounded text-center outline-none"
                                                                            />
                                                                            <span className="text-gray-600">/</span>
                                                                            <input
                                                                                type="number"
                                                                                placeholder="S"
                                                                                value={p.sides}
                                                                                onChange={e => updateRowCell(rIdx, 'pages', e.target.value, pIdx, 'sides')}
                                                                                className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-white rounded text-center outline-none"
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    {/* Machine Selection */}
                                                                    <td className="p-1 border-r border-white/10">
                                                                        <select
                                                                            value={p.machineId || ''}
                                                                            onChange={e => updateRowCell(rIdx, 'pages', e.target.value, pIdx, 'machineId')}
                                                                            className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-white rounded outline-none"
                                                                        >
                                                                            <option value="" className="bg-secondary text-white">Select Machine</option>
                                                                            {machines.map(m => (
                                                                                <option key={m.id} value={m.id} className="bg-secondary text-white">
                                                                                    {m.name}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </td>
                                                                    {/* Paper Selection */}
                                                                    <td className="p-1 border-r border-white/10">
                                                                        <select
                                                                            value={p.paperId || ''}
                                                                            onChange={e => updateRowCell(rIdx, 'pages', e.target.value, pIdx, 'paperId')}
                                                                            className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-white rounded outline-none"
                                                                        >
                                                                            <option value="" className="bg-secondary text-white">Select Paper</option>
                                                                            {papers.map(pa => (
                                                                                <option key={pa.id} value={pa.id} className="bg-secondary text-white">
                                                                                    {pa.name}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </td>
                                                                </React.Fragment>
                                                            ))}
                                                            <td className="p-1">
                                                                <input
                                                                    type="text"
                                                                    value={row.description}
                                                                    onChange={e => updateRowCell(rIdx, 'description', e.target.value)}
                                                                    className="w-full bg-transparent focus:bg-white/5 border border-transparent focus:border-white/10 px-1 py-0.5 text-xs text-gray-300 rounded outline-none"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 text-xs">
                                <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-gray-400 leading-relaxed">
                                    Use this helper to quickly generate a range of values for one component.
                                    Once generated, it will be loaded into the <strong>List Editor</strong> where you can inspect, customize, or paste additional details before executing.
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 mb-1 font-semibold">Component to Vary:</label>
                                        <select
                                            value={bulkSelectedComponentId}
                                            onChange={e => setBulkSelectedComponentId(e.target.value)}
                                            className="w-full bg-secondary border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-white/30 text-xs"
                                        >
                                            {getPrintComponents().map(c => (
                                                <option key={c.id} value={c.id}>{c.name} (currently {c.params.pages || c.params.sides || 0}pg)</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-1 font-semibold">Page Counts (comma separated):</label>
                                        <Input
                                            value={bulkPageCounts}
                                            onChange={e => setBulkPageCounts(e.target.value)}
                                            placeholder="e.g. 16, 24, 32, 48, 64, 80, 96, 128"
                                            className="bg-secondary border-white/10 text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 mb-1 font-semibold">Quantities (comma separated list):</label>
                                        <Input
                                            value={bulkQuantities}
                                            onChange={e => setBulkQuantities(e.target.value)}
                                            placeholder={`e.g. 500, 1000, 2000 (defaults to current: ${quantity})`}
                                            className="bg-secondary border-white/10 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-1 font-semibold">Markup % Rates (comma separated list):</label>
                                        <Input
                                            value={bulkMarkupRates}
                                            onChange={e => setBulkMarkupRates(e.target.value)}
                                            placeholder={`e.g. 10, 15, 20 (defaults to current: ${markupPercent}%)`}
                                            className="bg-secondary border-white/10 text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-400 mb-1 font-semibold">Naming Pattern:</label>
                                        <Input
                                            value={bulkNamingPattern}
                                            onChange={e => setBulkNamingPattern(e.target.value)}
                                            placeholder="[Original] - [Pages]pg"
                                            className="bg-secondary border-white/10 text-xs"
                                        />
                                        <span className="text-[10px] text-gray-500 mt-1 block">
                                            Placeholders: <code className="text-emerald-400">[Original]</code>, <code className="text-emerald-400">[Pages]</code>, <code className="text-emerald-400">[Qty]</code>, <code className="text-emerald-400">[Markup]</code>
                                        </span>
                                    </div>

                                    <div>
                                        <label className="block text-gray-400 mb-1 font-semibold">Description Pattern:</label>
                                        <Input
                                            value={bulkDescPattern}
                                            onChange={e => setBulkDescPattern(e.target.value)}
                                            placeholder="e.g. [Original] - [Pages]pg"
                                            className="bg-secondary border-white/10 text-xs"
                                        />
                                        <span className="text-[10px] text-gray-500 mt-1 block">
                                            Placeholders: <code className="text-emerald-400">[Original]</code>, <code className="text-emerald-400">[Pages]</code>, <code className="text-emerald-400">[Qty]</code>, <code className="text-emerald-400">[Markup]</code>
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleGenerateTemplate}
                                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors"
                                >
                                    Generate & Load into Editor
                                </button>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6 border-t border-white/10 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowBulkModal(false)}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-gray-300 transition-colors"
                            >
                                Close
                            </button>
                            {bulkMethod === 'list' && (
                                <button
                                    type="button"
                                    onClick={handleBulkGenerate}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold text-white transition-colors"
                                >
                                    Generate Variations
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bulk Progress Overlay ───────────────────────────────────────── */}
            {generatingBulk && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="bg-[#0f0f0f] border border-emerald-500/20 rounded-2xl p-8 w-full max-w-md text-center shadow-2xl">
                        <div className="flex items-center justify-center mb-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                        </div>
                        <h3 className="text-md font-bold text-white mb-2">Generating Page Variations...</h3>
                        <p className="text-xs text-gray-400 mb-4">
                            Calculating machine sheet usage, plates, and costs for page variation {bulkProgressCurrent} of {bulkProgressTotal}.
                        </p>

                        <div className="w-full bg-white/5 rounded-full h-2.5 mb-2 overflow-hidden border border-white/10">
                            <div
                                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${(bulkProgressCurrent / bulkProgressTotal) * 100}%` }}
                            />
                        </div>

                        <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                            <span>{Math.round((bulkProgressCurrent / bulkProgressTotal) * 100)}%</span>
                            <span>{bulkProgressCurrent} / {bulkProgressTotal}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Stock Shortage Warning Modal ───────────────────────────────── */}
            {quotationShortages && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#0f0f0f] border border-amber-500/30 rounded-2xl p-8 w-full max-w-lg shadow-2xl shadow-amber-950/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <FiAlertCircle className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Stock Shortage Warning</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Warning: There is insufficient stock for the following items</p>
                            </div>
                        </div>
                        <div className="mt-5 rounded-xl overflow-hidden border border-white/[0.07] max-h-60 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-white/[0.04] border-b border-white/[0.07]">
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Item</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Required</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Available</th>
                                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-amber-500/70">Short</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quotationShortages.map((s, i) => (
                                        <tr key={i} className={`border-b border-white/[0.04] ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.type === 'sfg'
                                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                                    : s.type === 'statics'
                                                        ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                                                        : s.type === 'plate'
                                                            ? 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20'
                                                            : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                                                    }`}>
                                                    <FiPackage className="w-2.5 h-2.5" />
                                                    {s.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-200 font-medium text-xs text-left">{s.name}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{s.required}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{s.available}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-amber-400">{s.shortfall}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-400 mt-4 text-left">Do you want to create the quotation anyway?</p>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setQuotationShortages(null);
                                }}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setQuotationShortages(null);
                                    handleConvertToQuote(true);
                                }}
                                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-xl text-sm font-semibold text-black transition-colors font-bold"
                            >
                                Create Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/items">
                        <Button className="bg-transparent border text-white border-white/10 hover:bg-white/10 p-2"><FiArrowLeft className='text-white' /></Button>
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
                                <textarea rows={4} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className="bg-secondary w-full px-4 py-3 rounded-lg border-white/10" />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {components.map((comp, idx) => {
                                        const tags = [];
                                        // const machine = machines.find(m => m.id == comp.params.machineId);
                                        const compName = comp.name || `Component ${idx + 1}`;

                                        // if (machine && comp.params.ups > 0) {
                                        //     const factor = (machine.sheet_factor || 1) * (parseInt(comp.params.ups) || 1);
                                        //     const sizeMap = { 1: 'A1', 2: 'A2', 4: 'A3', 8: 'A4', 16: 'A5', 32: 'A6', 64: 'A7', 128: 'A8' };
                                        //     if (sizeMap[factor]) tags.push(`${compName} - ${sizeMap[factor]}`);
                                        // }
                                        if (!comp.name.includes("Cover")) {
                                            if (comp.params.size) tags.push(`Size - ${comp.params.size}`);
                                        }
                                        if (comp.params.paperName) tags.push(`${compName} - ${comp.params.paperName}`);
                                        if (!comp.name.includes("Cover")) {
                                            if (parseInt(comp.params.pages) > 1) tags.push(`${comp.params.pages} Pages`);
                                        }
                                        const totalColors = (parseInt(comp.params.colorsFront) || 0) || parseInt(comp.params.colors) || 0;
                                        if (totalColors > 0) tags.push(`${totalColors} Colors`);
                                        if (comp.params.sides) tags.push(`${comp.params.sides == 1 ? "Single Side" : "Both sides"}`);
                                        if (comp.finishings) {
                                            comp.finishings.forEach(f => {
                                                tags.push(f.name);
                                            });
                                        }

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
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${activeTab === idx
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
                            onClick={() => addComponent()}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-transparent border border-dashed border-white/20 text-gray-400 hover:border-white/40 hover:text-white transition-all flex items-center gap-1.5"
                        >
                            <FiPlus className="text-xs" /> Add Tab
                        </button>

                        <div className="flex flex-wrap gap-1.5 border-l border-white/10 pl-2.5">
                            {[
                                { name: 'Main', key: 'M' },
                                { name: 'Cover', key: 'C' },
                                { name: 'Inner', key: 'I' },
                                { name: 'Finishings', key: 'F' }
                            ].map(item => (
                                <button
                                    key={item.name}
                                    type="button"
                                    onClick={() => addComponent(item.name)}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-300 transition-all flex items-center gap-1.5"
                                    title={`Add ${item.name} Component (Alt+Shift+${item.key})`}
                                >
                                    <FiPlus className="text-[10px]" />
                                    <span>{item.name}</span>
                                    <kbd className="text-[9px] text-gray-500 font-mono bg-black/40 px-1.5 py-0.5 rounded">⌥⇧{item.key}</kbd>
                                </button>
                            ))}
                        </div>
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
                            sfgInventory={sfgInventory}
                            staticsInventory={staticsInventory}
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
                                                        <span>{f.name} ({f.quantity}) {Number(f.total_time) > 0 && <span className="text-blue-300 text-[10px] ml-1">({Number(f.total_time).toFixed(2)} h)</span>}</span>
                                                        <span>{currency}{Number(f.total_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                                <div className="mb-4 text-xs space-y-3">
                                    <div className="flex items-center gap-10 w-full">
                                        <label className="text-gray-400 uppercase tracking-widest text-nowrap w-24">Before Markup</label>
                                        <div className="w-1/2 text-left text-xs font-semibold py-1">
                                            {currency}{baseTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-5 w-full">
                                        <label className="text-gray-400 uppercase tracking-widest text-nowrap w-24">Markup %</label>
                                        <div className="flex items-center w-1/2 bg-black/20 rounded border border-white/10 px-2 h-8">
                                            <input
                                                id="markup-percent-input"
                                                type="text"
                                                value={markupPercent}
                                                onChange={e => setMarkupPercent(e.target.value)}
                                                onBlur={() => {
                                                    const pct = parseFloat(markupPercent) || 0;
                                                    setMarkupPercent(pct.toFixed(5));
                                                }}
                                                className="w-full bg-transparent text-left text-xs outline-none text-white py-1"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-5 w-full">
                                        <label className="text-gray-400 uppercase tracking-widest text-nowrap w-24">Markup Amt</label>
                                        <div className="flex items-center w-1/2 bg-black/20 rounded border border-white/10 px-2 h-8">
                                            <span className="text-gray-500 mr-1">{currency}</span>
                                            <input
                                                id="markup-amount-input"
                                                type="text"
                                                value={markupAmountInput}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setMarkupAmountInput(val);
                                                    const amt = parseFloat(val) || 0;
                                                    if (baseTotal > 0) {
                                                        const pct = (amt / baseTotal) * 100;
                                                        setMarkupPercent(pct.toFixed(5));
                                                    } else {
                                                        setMarkupPercent('0.00000');
                                                    }
                                                }}
                                                onBlur={() => {
                                                    const amt = parseFloat(markupAmountInput) || 0;
                                                    setMarkupAmountInput(amt > 0 ? amt.toFixed(2) : '');
                                                }}
                                                className="w-full bg-transparent text-left text-xs outline-none text-white py-1"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-5 w-full">
                                        <label className="text-gray-400 uppercase tracking-widest text-nowrap w-24">After Markup</label>
                                        <div className="flex items-center w-1/2 bg-black/20 rounded border border-white/10 px-2 h-8">
                                            <span className="text-gray-500 mr-1">{currency}</span>
                                            <input
                                                id="after-markup-input"
                                                type="text"
                                                value={afterMarkupInput}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setAfterMarkupInput(val);
                                                    const amt = parseFloat(val) || 0;
                                                    if (baseTotal > 0) {
                                                        const pct = ((amt - baseTotal) / baseTotal) * 100;
                                                        setMarkupPercent(pct.toFixed(5));
                                                    } else {
                                                        setMarkupPercent('0.00000');
                                                    }
                                                }}
                                                onBlur={() => {
                                                    const amt = parseFloat(afterMarkupInput) || 0;
                                                    setAfterMarkupInput(amt > 0 ? amt.toFixed(2) : '');
                                                }}
                                                className="w-full bg-transparent text-left text-xs outline-none text-white py-1"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Grand Total</div>
                                <div className="text-2xl font-bold flex justify-between items-end">
                                    <span>Estimate</span>
                                    <span>
                                        {currency}
                                        {(
                                            //baseTotal * (1 + (parseFloat(markupPercent) / 100 || 0))
                                            parseFloat(afterMarkupInput || 0)
                                        ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 space-y-3">
                                <Button onClick={handleCalculate} disabled={calculating} className="w-full bg-white text-black hover:bg-gray-200">
                                    {calculating ? 'Calculating...' : 'Calculate Estimation'}
                                </Button>
                                <Button
                                    onClick={handleUpdate}
                                    disabled={saving || creatingQuotation}
                                    isLoading={saving}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-[0_4px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_4px_25px_rgba(99,102,241,0.4)] border border-blue-400/20 transition-all duration-300"
                                >
                                    {!saving && <FiSave className="w-4 h-4 mr-2" />}
                                    Update Estimation
                                </Button>
                                <Button
                                    onClick={() => handleConvertToQuote(false)}
                                    disabled={saving || calculating || creatingQuotation}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_25px_rgba(20,184,166,0.4)] border border-emerald-500/30 transition-all duration-300"
                                >
                                    <FiFileText className="w-4 h-4" />
                                    Convert to Quote
                                </Button>
                                <div className="flex gap-2 items-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowBulkModal(true)}
                                        className="flex-1 py-2 px-4 rounded-lg text-xs font-semibold bg-emerald-950/30 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-all duration-300 flex items-center justify-center gap-2"
                                    >
                                        <FiCopy size={14} className="text-emerald-500" />
                                        Bulk Generate
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowInstructionsModal(true)}
                                        className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                        title="How to use Bulk Generator"
                                    >
                                        <FiHelpCircle size={16} />
                                    </button>
                                </div>
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
                        {components[activeTab]?.type === 'offset' && !components[activeTab]?.name?.includes("Finishing") && (
                            <section className="bg-black/60 p-6 rounded-xl border border-white/20 shadow-2xl">
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
