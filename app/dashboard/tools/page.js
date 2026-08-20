'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    FiTool, FiTag, FiBookOpen, FiBox, FiDroplet, FiSearch,
    FiPrinter, FiRefreshCw, FiCopy, FiCheck, FiInfo, FiSliders,
    FiLayers, FiTruck, FiAlertCircle, FiMaximize2, FiSquare, FiPackage
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import BoxDielineGenerator from './components/BoxDielineGenerator';

export default function ToolsPage() {
    const [activeTab, setActiveTab] = useState('dieline'); // 'dieline' | 'labels' | 'spine' | 'paper' | 'ink'

    // ==========================================
    // TOOL 1: Sales Order Label Generator State
    // ==========================================
    const [salesOrders, setSalesOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [orderSearch, setOrderSearch] = useState('');
    const [labelData, setLabelData] = useState({
        order_code: 'SO-2026-0842',
        customer_name: 'Pressmatics Global Ltd',
        delivery_address: '123 Industrial Zone, Colombo 03, Sri Lanka',
        phone: '+94 77 123 4567',
        item_name: 'Custom Product Catalog 2026',
        box_number: 1,
        total_boxes: 5,
        quantity: 500,
        weight_kg: 4.5,
        package_type: 'Box',
        shipping_method: 'Express Courier',
        is_fragile: false,
        is_waterproof: true,
        qc_approved: true,
        notes: 'Handle with care. Keep in dry area.',
    });

    const [companyInfo, setCompanyInfo] = useState({
        name: 'PRESSMATICS PRINTERS',
        address: '123 Industrial Zone, Colombo 03',
        phone: '+94 11 234 5678',
        email: 'info@pressmatics.com'
    });

    const [labelConfig, setLabelConfig] = useState({
        showCompanyHeader: true,
        showOrderCode: true,
        showCustomerDetails: true,
        showItemDescription: true,
        showBoxSequence: true,
        showPackQuantity: true,
        showSpecialHandling: true,
        showBarcode: true,
        showQCBadge: true,
        showCustomNotes: true,

        // Sheet Paper
        sheetSize: 'A4', // 'A4' | 'A3' | 'SRA3' | 'Single'
        sheetWidthMm: 210,
        sheetHeightMm: 297,

        // Label Size
        labelPreset: '100x150', // '100x150' | '100x75' | '105x148' | '70x36' | '210x297' | 'custom'
        labelWidthMm: 100,
        labelHeightMm: 150,

        // Bleed Controls
        bleedMm: 3,
        showCropMarks: true,

        // Layout Theme & Border Styling Controls
        layoutTheme: 'modern', // 'modern' (Clean Minimalist) | 'industrial' (Bold High Contrast)
        showBorder: true,
        borderWidthPx: 1,
        borderStyle: 'solid',
        borderColor: '#475569',
        borderOpacity: 25, // 15%, 25%, 40%, 65%, 100%

        // Grid Imposition
        presetGrid: '4', // '1' | '2' | '4' | '8' | '10' | '24' | 'auto' | 'custom'
        gridCols: 2,
        gridRows: 2,
        totalLabelsToPrint: 4,
        autoSequentialBoxes: true,
    });

    const handleSheetSizeChange = (size) => {
        let sw = 210, sh = 297;
        if (size === 'A3') { sw = 297; sh = 420; }
        else if (size === 'SRA3') { sw = 320; sh = 450; }
        else if (size === 'Single') { sw = 100; sh = 150; }

        setLabelConfig(prev => {
            const nextSw = sw;
            const nextSh = sh;
            const bleed = Math.max(0, prev.bleedMm || 0);
            const cellW = prev.labelWidthMm + (2 * bleed);
            const cellH = prev.labelHeightMm + (2 * bleed);
            let cols = prev.gridCols;
            let rows = prev.gridRows;

            if (prev.presetGrid === 'auto') {
                cols = Math.max(1, Math.floor(nextSw / cellW));
                rows = Math.max(1, Math.floor(nextSh / cellH));
            }

            return {
                ...prev,
                sheetSize: size,
                sheetWidthMm: nextSw,
                sheetHeightMm: nextSh,
                gridCols: cols,
                gridRows: rows,
                totalLabelsToPrint: cols * rows,
            };
        });
    };

    const handleLabelPresetChange = (preset) => {
        let lw = 100, lh = 150;
        if (preset === '100x75') { lw = 100; lh = 75; }
        else if (preset === '105x148') { lw = 105; lh = 148; }
        else if (preset === '70x36') { lw = 70; lh = 36; }
        else if (preset === '210x297') { lw = 210; lh = 297; }

        setLabelConfig(prev => {
            const nextLw = preset === 'custom' ? prev.labelWidthMm : lw;
            const nextLh = preset === 'custom' ? prev.labelHeightMm : lh;
            const bleed = Math.max(0, prev.bleedMm || 0);
            const cellW = nextLw + (2 * bleed);
            const cellH = nextLh + (2 * bleed);
            let cols = prev.gridCols;
            let rows = prev.gridRows;

            if (prev.presetGrid === 'auto') {
                cols = Math.max(1, Math.floor(prev.sheetWidthMm / cellW));
                rows = Math.max(1, Math.floor(prev.sheetHeightMm / cellH));
            }

            return {
                ...prev,
                labelPreset: preset,
                labelWidthMm: nextLw,
                labelHeightMm: nextLh,
                gridCols: cols,
                gridRows: rows,
                totalLabelsToPrint: cols * rows,
            };
        });
    };

    const handleGridPresetChange = (preset) => {
        let cols = 2, rows = 2;
        if (preset === 'auto') {
            const sw = labelConfig.sheetWidthMm;
            const sh = labelConfig.sheetHeightMm;
            const bleed = Math.max(0, labelConfig.bleedMm || 0);
            const cellW = Math.max(10, labelConfig.labelWidthMm) + (2 * bleed);
            const cellH = Math.max(10, labelConfig.labelHeightMm) + (2 * bleed);
            cols = Math.max(1, Math.floor(sw / cellW));
            rows = Math.max(1, Math.floor(sh / cellH));
        } else if (preset === '1') { cols = 1; rows = 1; }
        else if (preset === '2') { cols = 1; rows = 2; }
        else if (preset === '4') { cols = 2; rows = 2; }
        else if (preset === '8') { cols = 2; rows = 4; }
        else if (preset === '10') { cols = 2; rows = 5; }
        else if (preset === '24') { cols = 3; rows = 8; }

        setLabelConfig(prev => ({
            ...prev,
            presetGrid: preset,
            gridCols: cols,
            gridRows: rows,
            totalLabelsToPrint: preset === 'custom' ? prev.totalLabelsToPrint : cols * rows,
        }));
    };

    const getImpositionData = () => {
        const sw = parseFloat(labelConfig.sheetWidthMm) || 210;
        const sh = parseFloat(labelConfig.sheetHeightMm) || 297;
        const lw = Math.max(10, parseFloat(labelConfig.labelWidthMm) || 100);
        const lh = Math.max(10, parseFloat(labelConfig.labelHeightMm) || 150);
        const bleed = Math.max(0, parseFloat(labelConfig.bleedMm) || 0);

        const cellWidth = lw + (2 * bleed);
        const cellHeight = lh + (2 * bleed);

        const maxCols = Math.max(1, Math.floor(sw / cellWidth));
        const maxRows = Math.max(1, Math.floor(sh / cellHeight));
        const autoMaxUps = maxCols * maxRows;

        let cols = labelConfig.gridCols;
        let rows = labelConfig.gridRows;

        if (labelConfig.presetGrid === 'auto') {
            cols = maxCols;
            rows = maxRows;
        }

        const totalPlannedUps = cols * rows;
        const requiredWidth = cols * cellWidth;
        const requiredHeight = rows * cellHeight;
        const fits = requiredWidth <= sw + 0.5 && requiredHeight <= sh + 0.5;

        const totalLabelArea = cellWidth * cellHeight * totalPlannedUps;
        const totalSheetArea = sw * sh;
        const utilizationPercent = Math.min(100, (totalLabelArea / totalSheetArea) * 100);

        return {
            sw, sh, lw, lh, bleed,
            cellWidth, cellHeight,
            maxCols, maxRows, autoMaxUps,
            cols, rows, totalPlannedUps,
            requiredWidth, requiredHeight,
            fits, utilizationPercent
        };
    };

    useEffect(() => {
        fetchSalesOrders();
        fetchCompanySettings();
    }, []);

    async function fetchCompanySettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data && !data.error) {
                setCompanyInfo({
                    name: data.company_name || data.site_title || 'PRESSMATICS PRINTERS',
                    address: data.company_address || data.address || '123 Industrial Zone, Colombo 03',
                    phone: data.company_phone || data.phone || '+94 11 234 5678',
                    email: data.company_email || data.email || 'info@pressmatics.com',
                });
            }
        } catch (e) {
            console.error('Failed to fetch company settings:', e);
        }
    }

    async function fetchSalesOrders(search = '') {
        setLoadingOrders(true);
        try {
            const res = await fetch(`/api/tools/sales-orders?search=${encodeURIComponent(search)}`);
            const data = await res.json();
            if (Array.isArray(data?.orders)) {
                setSalesOrders(data.orders);
            } else if (Array.isArray(data)) {
                setSalesOrders(data);
            } else {
                setSalesOrders([]);
            }
        } catch (e) {
            console.error('Failed to fetch sales orders:', e);
            setSalesOrders([]);
        } finally {
            setLoadingOrders(false);
        }
    }

    const handleSelectSalesOrder = (so) => {
        const phoneNo = so.customer_phone || so.customer_contact_phone || '';
        setLabelData((prev) => ({
            ...prev,
            order_code: so.code || prev.order_code,
            customer_name: so.customer_name || prev.customer_name,
            phone: phoneNo || prev.phone,
            delivery_address: so.customer_address || prev.delivery_address,
            item_name: so.estimation_names || prev.item_name,
            quantity: so.quantity || prev.quantity,
        }));
        toast.success(`Loaded details for ${so.code}`);
    };

    const handlePrintLabel = () => {
        window.print();
    };

    // ==========================================
    // TOOL 2: Book Spine Thickness Calculator State
    // ==========================================
    const PAPER_PRESETS = [
        { name: '60 GSM Newsprint / Cream', gsm: 60, bulk: 1.5 },
        { name: '70 GSM Woodfree / Cream Book', gsm: 70, bulk: 1.4 },
        { name: '80 GSM Offset / Bond', gsm: 80, bulk: 1.25 },
        { name: '100 GSM Matt Art Paper', gsm: 100, bulk: 1.0 },
        { name: '128 GSM Gloss Art Paper', gsm: 128, bulk: 0.9 },
        { name: '150 GSM Matt Art Paper', gsm: 150, bulk: 0.88 },
        { name: '250 GSM Art Board', gsm: 250, bulk: 1.1 },
        { name: '300 GSM Art Card', gsm: 300, bulk: 1.1 },
    ];

    const [spineCalc, setSpineCalc] = useState({
        page_count: 192, // Total pages
        selected_paper: 1, // index in PAPER_PRESETS (70 GSM Woodfree)
        custom_gsm: 70,
        custom_bulk: 1.4,
        is_custom_paper: false,
        cover_gsm: 300,
        cover_bulk: 1.1,
        binding_type: 'perfect', // 'perfect' | 'saddle' | 'hardcover'
        hardcover_board_mm: 2.0, // Greyboard thickness for hardcover per side
    });

    // Calculate Spine Thickness
    const calculateSpine = () => {
        const pages = Math.max(2, parseInt(spineCalc.page_count) || 0);
        const sheets = pages / 2;

        const gsm = spineCalc.is_custom_paper ? spineCalc.custom_gsm : PAPER_PRESETS[spineCalc.selected_paper].gsm;
        const bulk = spineCalc.is_custom_paper ? spineCalc.custom_bulk : PAPER_PRESETS[spineCalc.selected_paper].bulk;

        // Single sheet thickness in mm: (GSM / 1000) * Bulk Factor
        const singleSheetMm = (gsm / 1000) * bulk;

        let innerSpineMm = sheets * singleSheetMm;

        // Cover thickness (2 sides)
        const coverSingleMm = (spineCalc.cover_gsm / 1000) * spineCalc.cover_bulk;
        let coverTotalMm = coverSingleMm * 2;

        let bindingAllowanceMm = 0;
        if (spineCalc.binding_type === 'perfect') {
            bindingAllowanceMm = 0.5; // Hot melt / PUR glue layer
        } else if (spineCalc.binding_type === 'hardcover') {
            bindingAllowanceMm = (spineCalc.hardcover_board_mm * 2) + 1.0; // Two greyboards + hinge joint
        } else if (spineCalc.binding_type === 'saddle') {
            bindingAllowanceMm = 0.1;
        }

        const totalSpineMm = innerSpineMm + coverTotalMm + bindingAllowanceMm;
        const totalSpineInches = totalSpineMm / 25.4;

        return {
            sheets,
            singleSheetMm,
            innerSpineMm,
            totalSpineMm,
            totalSpineInches,
        };
    };

    const spineResults = calculateSpine();

    // ==========================================
    // TOOL 3: Paper Weight & Ream Calculator State
    // ==========================================
    const [paperCalc, setPaperCalc] = useState({
        preset_size: '23x36', // '23x36' | '25x36' | '24x34' | 'A4' | 'A3' | 'SRA3' | 'custom'
        width_inch: 23,
        length_inch: 36,
        gsm: 128,
        sheet_count: 10000,
    });

    const handlePresetChange = (preset) => {
        let w = 23, l = 36;
        if (preset === '25x36') { w = 25; l = 36; }
        else if (preset === '24x34') { w = 24; l = 34; }
        else if (preset === 'A4') { w = 8.27; l = 11.69; }
        else if (preset === 'A3') { w = 11.69; l = 16.54; }
        else if (preset === 'SRA3') { w = 12.6; l = 17.7; }
        setPaperCalc(prev => ({ ...prev, preset_size: preset, width_inch: w, length_inch: l }));
    };

    const calculatePaperWeight = () => {
        const w = parseFloat(paperCalc.width_inch) || 0;
        const l = parseFloat(paperCalc.length_inch) || 0;
        const gsm = parseFloat(paperCalc.gsm) || 0;
        const sheets = parseInt(paperCalc.sheet_count) || 0;

        // Area of 1 sheet in square meters
        const areaSqMeters = (w * 0.0254) * (l * 0.0254);
        const weightPerSheetKg = areaSqMeters * (gsm / 1000);
        const totalWeightKg = weightPerSheetKg * sheets;
        const totalReams = sheets / 500;
        const weightPerReamKg = weightPerSheetKg * 500;
        const totalWeightLbs = totalWeightKg * 2.20462;

        return {
            areaSqMeters,
            totalReams,
            weightPerReamKg,
            totalWeightKg,
            totalWeightLbs,
            tonnes: totalWeightKg / 1000,
        };
    };

    const paperResults = calculatePaperWeight();

    // ==========================================
    // TOOL 4: Ink Consumption Estimator State
    // ==========================================
    const [inkCalc, setInkCalc] = useState({
        impressions: 25000,
        width_inch: 23,
        length_inch: 36,
        cyan_cov: 15,
        magenta_cov: 25,
        yellow_cov: 10,
        black_cov: 40,
    });

    const calculateInkUsage = () => {
        const imp = parseInt(inkCalc.impressions) || 0;
        const w = parseFloat(inkCalc.width_inch) || 0;
        const l = parseFloat(inkCalc.length_inch) || 0;
        const areaSqMeters = (w * 0.0254) * (l * 0.0254);
        const totalAreaSqM = areaSqMeters * imp;

        // Average ink coverage factor: 100% coverage = ~1.6 grams of dry ink per sq meter
        const inkGramsPerSqM100 = 1.6;

        const cKg = (totalAreaSqM * (inkCalc.cyan_cov / 100) * inkGramsPerSqM100) / 1000;
        const mKg = (totalAreaSqM * (inkCalc.magenta_cov / 100) * inkGramsPerSqM100) / 1000;
        const yKg = (totalAreaSqM * (inkCalc.yellow_cov / 100) * inkGramsPerSqM100) / 1000;
        const kKg = (totalAreaSqM * (inkCalc.black_cov / 100) * inkGramsPerSqM100) / 1000;

        const totalInkKg = cKg + mKg + yKg + kKg;

        return {
            cKg, mKg, yKg, kKg, totalInkKg
        };
    };

    const inkResults = calculateInkUsage();

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 print:p-0 print:m-0 print:max-w-none">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
                        <span className="p-2.5 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
                            <FiTool className="w-6 h-6" />
                        </span>
                        Pressmatics Prepress & Utility Tools
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Professional printing calculators, spine thickness estimator, and sales order thermal label generator.
                    </p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto bg-black/40 backdrop-blur-xl border border-white/10 p-2 rounded-2xl print:hidden">
                <button
                    onClick={() => setActiveTab('dieline')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'dieline'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <FiPackage className="w-4 h-4" />
                    Packaging Box Dieline Generator
                </button>

                <button
                    onClick={() => setActiveTab('labels')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'labels'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <FiTag className="w-4 h-4" />
                    Sales Order Label Generator
                </button>

                <button
                    onClick={() => setActiveTab('spine')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'spine'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <FiBookOpen className="w-4 h-4" />
                    Book Spine Thickness Calculator
                </button>

                <button
                    onClick={() => setActiveTab('paper')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'paper'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <FiBox className="w-4 h-4" />
                    Paper Ream & Weight Calculator
                </button>

                <button
                    onClick={() => setActiveTab('ink')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'ink'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <FiDroplet className="w-4 h-4" />
                    Ink Usage Estimator
                </button>
            </div>

            {/* TAB 0: PACKAGING BOX DIELINE GENERATOR */}
            {activeTab === 'dieline' && <BoxDielineGenerator />}

            {/* TAB 1: SALES ORDER LABEL GENERATOR */}
            {activeTab === 'labels' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
                    {/* Left Controls & Configuration Column */}
                    <div className="lg:col-span-5 space-y-5 print:hidden">
                        {/* 1. Live SO Quick Picker */}
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl space-y-3">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                                <FiSearch /> Quick Load Sales Order
                            </h3>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by SO code, customer, estimation name..."
                                    value={orderSearch}
                                    onChange={(e) => {
                                        setOrderSearch(e.target.value);
                                        fetchSalesOrders(e.target.value);
                                    }}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1">
                                {loadingOrders ? (
                                    <p className="text-xs text-gray-500 py-2 text-center">Searching orders...</p>
                                ) : !Array.isArray(salesOrders) || salesOrders.length === 0 ? (
                                    <p className="text-xs text-gray-500 py-2 text-center">No orders found.</p>
                                ) : (
                                    salesOrders.map((so, idx) => (
                                        <button
                                            key={so?.id || idx}
                                            type="button"
                                            onClick={() => handleSelectSalesOrder(so)}
                                            className="w-full text-left p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all flex items-center justify-between cursor-pointer group"
                                        >
                                            <div className="min-w-0 flex-1 pr-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-indigo-400">{so?.code || 'N/A'}</span>
                                                    <span className="text-xs font-medium text-white truncate">{so?.customer_name || 'N/A'}</span>
                                                </div>
                                                {so?.estimation_names && (
                                                    <p className="text-[11px] text-gray-400 truncate mt-0.5 group-hover:text-gray-200">
                                                        {so.estimation_names}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 shrink-0">
                                                Load
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* 2. Label Details Form */}
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
                                <FiSliders /> Customize Label Details
                            </h3>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Order Code</label>
                                    <input
                                        type="text"
                                        value={labelData.order_code}
                                        onChange={(e) => setLabelData({ ...labelData, order_code: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Package Type</label>
                                    <select
                                        value={labelData.package_type}
                                        onChange={(e) => setLabelData({ ...labelData, package_type: e.target.value })}
                                        className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                        <option value="Box">Standard Box</option>
                                        <option value="Bundle">Paper Bundle</option>
                                        <option value="Pallet">Pallet Shipment</option>
                                        <option value="Envelope">Envelope / Pouch</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Customer Name</label>
                                    <input
                                        type="text"
                                        value={labelData.customer_name}
                                        onChange={(e) => setLabelData({ ...labelData, customer_name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Customer Phone</label>
                                    <input
                                        type="text"
                                        value={labelData.phone}
                                        onChange={(e) => setLabelData({ ...labelData, phone: e.target.value })}
                                        placeholder="e.g. +94 77 123 4567"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Delivery Address</label>
                                <textarea
                                    rows={2}
                                    value={labelData.delivery_address}
                                    onChange={(e) => setLabelData({ ...labelData, delivery_address: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Job / Item Description</label>
                                <input
                                    type="text"
                                    value={labelData.item_name}
                                    onChange={(e) => setLabelData({ ...labelData, item_name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Box #</label>
                                    <input
                                        type="number"
                                        value={labelData.box_number}
                                        onChange={(e) => setLabelData({ ...labelData, box_number: parseInt(e.target.value) || 1 })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Total Boxes</label>
                                    <input
                                        type="number"
                                        value={labelData.total_boxes}
                                        onChange={(e) => setLabelData({ ...labelData, total_boxes: parseInt(e.target.value) || 1 })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Pack Qty</label>
                                    <input
                                        type="number"
                                        value={labelData.quantity}
                                        onChange={(e) => setLabelData({ ...labelData, quantity: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelData.is_fragile}
                                        onChange={(e) => setLabelData({ ...labelData, is_fragile: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    FRAGILE / HANDLE WITH CARE
                                </label>
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelData.is_waterproof}
                                        onChange={(e) => setLabelData({ ...labelData, is_waterproof: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    KEEP DRY / WATERPROOF
                                </label>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Custom Notes / Special Instructions</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Handle with care. Deliver to loading bay 2."
                                    value={labelData.notes || ''}
                                    onChange={(e) => setLabelData({ ...labelData, notes: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* 3. Field Inclusion Selector (What to include in the label) */}
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl space-y-3">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                                <FiLayers /> Included Label Fields
                            </h3>
                            <p className="text-xs text-gray-400">Choose which sections should appear on printed labels:</p>

                            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showCompanyHeader}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showCompanyHeader: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    Company Header
                                </label>

                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showOrderCode}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showOrderCode: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    Sales Order #
                                </label>

                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showCustomerDetails}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showCustomerDetails: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    Customer & Address
                                </label>

                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showItemDescription}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showItemDescription: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    Job / Item Name
                                </label>

                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showBoxSequence}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showBoxSequence: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    Box Sequence (1 of N)
                                </label>

                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showPackQuantity}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showPackQuantity: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    Pack Quantity
                                </label>

                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showSpecialHandling}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showSpecialHandling: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    Fragile / Keep Dry
                                </label>

                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showBarcode}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showBarcode: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    Barcode / Serial
                                </label>

                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showQCBadge}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showQCBadge: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    QC Verified Stamp
                                </label>

                                <label className="flex items-center gap-2 text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.showCustomNotes}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, showCustomNotes: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                    />
                                    Custom Notes Field
                                </label>
                            </div>
                        </div>

                        {/* 4. Sheet Size & Ups Imposition Planner */}
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                <FiBox /> Sheet Size & Label Dimension Imposition
                            </h3>

                            {/* Paper Size & Label Size Presets */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Sheet Paper Size</label>
                                    <select
                                        value={labelConfig.sheetSize}
                                        onChange={(e) => handleSheetSizeChange(e.target.value)}
                                        className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                        <option value="A4">A4 Sheet (210 x 297 mm)</option>
                                        <option value="A3">A3 Sheet (297 x 420 mm)</option>
                                        <option value="SRA3">SRA3 Sheet (320 x 450 mm)</option>
                                        <option value="Single">Single Roll (100 x 150 mm)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Label Dimension Size</label>
                                    <select
                                        value={labelConfig.labelPreset}
                                        onChange={(e) => handleLabelPresetChange(e.target.value)}
                                        className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                        <option value="100x150">100 x 150 mm (4x6&quot; Thermal Shipping)</option>
                                        <option value="100x75">100 x 75 mm (4x3&quot; Box Tag)</option>
                                        <option value="105x148">105 x 148 mm (A6 Sticker)</option>
                                        <option value="70x36">70 x 36 mm (Address Tag)</option>
                                        <option value="210x297">210 x 297 mm (A4 Full Sheet)</option>
                                        <option value="custom">Custom Dimensions (W x H mm)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Custom Label Dimensions Inputs */}
                            <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Label Width (mm)</label>
                                    <input
                                        type="number"
                                        min="10"
                                        max="500"
                                        value={labelConfig.labelWidthMm}
                                        onChange={(e) => {
                                            const w = Math.max(10, parseFloat(e.target.value) || 100);
                                            setLabelConfig(prev => ({ ...prev, labelWidthMm: w, labelPreset: 'custom' }));
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Label Height (mm)</label>
                                    <input
                                        type="number"
                                        min="10"
                                        max="500"
                                        value={labelConfig.labelHeightMm}
                                        onChange={(e) => {
                                            const h = Math.max(10, parseFloat(e.target.value) || 150);
                                            setLabelConfig(prev => ({ ...prev, labelHeightMm: h, labelPreset: 'custom' }));
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                                    />
                                </div>
                            </div>

                            {/* Imposition Grid Selection */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Grid Imposition Preset</label>
                                    <select
                                        value={labelConfig.presetGrid}
                                        onChange={(e) => handleGridPresetChange(e.target.value)}
                                        className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                        <option value="auto">Auto-Fit Max (Fit to Sheet)</option>
                                        <option value="1">1 Label per Sheet (1x1)</option>
                                        <option value="2">2 Labels per Sheet (1x2)</option>
                                        <option value="4">4 Labels per Sheet (2x2)</option>
                                        <option value="8">8 Labels per Sheet (2x4)</option>
                                        <option value="10">10 Labels per Sheet (2x5)</option>
                                        <option value="24">24 Labels per Sheet (3x8)</option>
                                        <option value="custom">Custom Grid (Cols x Rows)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Labels On Sheet</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="48"
                                        value={labelConfig.totalLabelsToPrint}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, totalLabelsToPrint: Math.max(1, parseInt(e.target.value) || 1) })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            {labelConfig.presetGrid === 'custom' && (
                                <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Columns</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="6"
                                            value={labelConfig.gridCols}
                                            onChange={(e) => {
                                                const c = Math.max(1, parseInt(e.target.value) || 1);
                                                setLabelConfig(prev => ({ ...prev, gridCols: c, totalLabelsToPrint: c * prev.gridRows }));
                                            }}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Rows</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="12"
                                            value={labelConfig.gridRows}
                                            onChange={(e) => {
                                                const r = Math.max(1, parseInt(e.target.value) || 1);
                                                setLabelConfig(prev => ({ ...prev, gridRows: r, totalLabelsToPrint: prev.gridCols * r }));
                                            }}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-1">
                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={labelConfig.autoSequentialBoxes}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, autoSequentialBoxes: e.target.checked })}
                                        className="rounded bg-white/10 border-white/20 text-emerald-600 focus:ring-0"
                                    />
                                    Auto Sequential Box # Increment
                                </label>
                            </div>

                            {/* Imposition Calculation Summary */}
                            {(() => {
                                const imp = getImpositionData();
                                return (
                                    <div className="space-y-2">
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                                            <span>Planned Imposition:</span>
                                            <strong className="font-mono">
                                                {imp.cols} x {imp.rows} = {imp.totalPlannedUps} Ups ({imp.lw}x{imp.lh}mm + {imp.bleed}mm Bleed) on {labelConfig.sheetSize}
                                            </strong>
                                        </div>

                                        {!imp.fits && (
                                            <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2 font-medium">
                                                <span>⚠️ Layout grid ({imp.requiredWidth.toFixed(0)} x {imp.requiredHeight.toFixed(0)} mm) exceeds {labelConfig.sheetSize} paper bounds!</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <button
                                onClick={handlePrintLabel}
                                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl font-bold text-sm text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                                <FiPrinter className="w-4 h-4" />
                                Print Imposition Sheet ({labelConfig.totalLabelsToPrint} Ups)
                            </button>
                        </div>

                        {/* 5. Bleeds, Layout Theme & Border Customizer */}
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                                <FiMaximize2 /> Layout Theme, Bleeds & Border Customizer
                            </h3>

                            {/* Layout Preset Theme Selector */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Select Label Layout Style</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setLabelConfig({ ...labelConfig, layoutTheme: 'modern' })}
                                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${labelConfig.layoutTheme === 'modern'
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        ✨ Modern Clean Tag
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLabelConfig({ ...labelConfig, layoutTheme: 'industrial' })}
                                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${labelConfig.layoutTheme === 'industrial'
                                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        🏷️ Industrial Shipping
                                    </button>
                                </div>
                            </div>

                            {/* Bleed Controls */}
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Bleed Margin (mm)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        step="0.5"
                                        value={labelConfig.bleedMm}
                                        onChange={(e) => setLabelConfig({ ...labelConfig, bleedMm: Math.max(0, parseFloat(e.target.value) || 0) })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Crop Marks</label>
                                    <div className="pt-2">
                                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={labelConfig.showCropMarks}
                                                onChange={(e) => setLabelConfig({ ...labelConfig, showCropMarks: e.target.checked })}
                                                className="rounded bg-white/10 border-white/20 text-amber-600 focus:ring-0"
                                            />
                                            Show Cut / Trim Lines
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Border Customization */}
                            <div className="pt-2 border-t border-white/10 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={labelConfig.showBorder}
                                            onChange={(e) => setLabelConfig({ ...labelConfig, showBorder: e.target.checked })}
                                            className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                                        />
                                        Enable Sticker Outer Border
                                    </label>
                                </div>

                                {labelConfig.showBorder && (
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Border Opacity</label>
                                            <select
                                                value={labelConfig.borderOpacity}
                                                onChange={(e) => setLabelConfig({ ...labelConfig, borderOpacity: parseInt(e.target.value) || 25 })}
                                                className="w-full bg-gray-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                                            >
                                                <option value="15">15% (Ultra Soft)</option>
                                                <option value="25">25% (Clean Light)</option>
                                                <option value="40">40% (Medium)</option>
                                                <option value="65">65% (Strong)</option>
                                                <option value="100">100% (Solid)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Thickness & Style</label>
                                            <div className="grid grid-cols-2 gap-1">
                                                <select
                                                    value={labelConfig.borderWidthPx}
                                                    onChange={(e) => setLabelConfig({ ...labelConfig, borderWidthPx: parseInt(e.target.value) || 1 })}
                                                    className="w-full bg-gray-900 border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer font-mono"
                                                >
                                                    <option value="1">1 px</option>
                                                    <option value="2">2 px</option>
                                                    <option value="3">3 px</option>
                                                </select>
                                                <select
                                                    value={labelConfig.borderStyle}
                                                    onChange={(e) => setLabelConfig({ ...labelConfig, borderStyle: e.target.value })}
                                                    className="w-full bg-gray-900 border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                                                >
                                                    <option value="solid">Solid</option>
                                                    <option value="dashed">Dashed</option>
                                                    <option value="dotted">Dotted</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Imposition Sheet Live Preview - STICKY PANEL */}
                    <div className="lg:col-span-7 sticky top-6 self-start print:w-full print:m-0">
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl space-y-4 print:p-0 print:border-none print:bg-white">
                            {(() => {
                                const imp = getImpositionData();
                                return (
                                    <>
                                        {/* Header & Badges */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
                                            <div>
                                                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-200 flex items-center gap-2">
                                                    <FiTag /> Imposition Sheet Live Preview ({labelConfig.sheetSize} - {imp.totalPlannedUps} Ups)
                                                </h3>
                                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                                    Paper: {imp.sw}×{imp.sh}mm | Label: {imp.lw}×{imp.lh}mm (+{imp.bleed}mm Bleed) | Theme: <span className="capitalize text-emerald-400 font-semibold">{labelConfig.layoutTheme}</span>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${imp.fits
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                                                    }`}>
                                                    {imp.fits ? '✓ Fits Sheet' : '⚠️ Overflows'}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                    {imp.utilizationPercent.toFixed(1)}% Utilized
                                                </span>
                                            </div>
                                        </div>

                                        {/* Printable Realistic Imposition Sheet */}
                                        <div className="bg-white text-black p-4 rounded-xl border-2 border-slate-300 font-sans shadow-2xl relative print:border-none print:p-0 print:m-0 print:shadow-none">
                                            {/* Sheet Ruler / Dimension Labels */}
                                            <div className="flex justify-between items-center text-[9px] font-mono font-bold text-gray-400 border-b border-dashed border-gray-200 pb-1 mb-2 print:hidden">
                                                <span>↔ PAPER WIDTH: {imp.sw} mm</span>
                                                <span>↕ PAPER HEIGHT: {imp.sh} mm</span>
                                                <span>BLEED: {imp.bleed} mm</span>
                                                <span>GRID: {imp.cols} × {imp.rows}</span>
                                            </div>

                                            {/* Tiled Grid of Labels */}
                                            <div
                                                className="grid gap-2 print:gap-1"
                                                style={{
                                                    gridTemplateColumns: `repeat(${imp.cols}, minmax(0, 1fr))`
                                                }}
                                            >
                                                {Array.from({ length: labelConfig.totalLabelsToPrint }).map((_, idx) => {
                                                    const currentBoxNum = labelConfig.autoSequentialBoxes
                                                        ? ((idx % (labelData.total_boxes || 1)) + 1)
                                                        : labelData.box_number;

                                                    const isCompact = imp.cols >= 3 || imp.totalPlannedUps > 8;
                                                    const isModern = labelConfig.layoutTheme === 'modern';

                                                    // Compute subtle border with low opacity
                                                    const opacityVal = (labelConfig.borderOpacity ?? 25) / 100;
                                                    const borderCss = labelConfig.showBorder
                                                        ? `${labelConfig.borderWidthPx || 1}px ${labelConfig.borderStyle || 'solid'} rgba(71, 85, 105, ${opacityVal})`
                                                        : 'none';

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`bg-white font-sans flex flex-col justify-between relative transition-all ${isModern ? '' : 'rounded-none'
                                                                } ${isCompact ? 'p-1.5 space-y-1 text-[8px]' : 'p-2.5 space-y-1.5 text-xs'
                                                                }`}
                                                            style={{
                                                                minHeight: isCompact ? '90px' : '160px',
                                                                border: borderCss,
                                                            }}
                                                        >
                                                            {/* Cut / Trim Dashed Line Overlay if Crop Marks or Bleeds Enabled */}
                                                            {(labelConfig.showCropMarks || imp.bleed > 0) && (
                                                                <div
                                                                    className="absolute border border-dashed border-gray-300 pointer-events-none opacity-30 print:border-gray-400"
                                                                    style={{
                                                                        top: `${Math.max(1, imp.bleed)}px`,
                                                                        bottom: `${Math.max(1, imp.bleed)}px`,
                                                                        left: `${Math.max(1, imp.bleed)}px`,
                                                                        right: `${Math.max(1, imp.bleed)}px`,
                                                                    }}
                                                                />
                                                            )}

                                                            {/* Header */}
                                                            {labelConfig.showCompanyHeader && (
                                                                <div className={`pb-1 flex items-start justify-between gap-1 ${isModern ? 'border-b border-gray-100' : 'border-b border-black pb-0.5'
                                                                    }`}>
                                                                    <div className="min-w-0 flex-1">
                                                                        <h2 className={`uppercase tracking-tight leading-none ${isModern
                                                                            ? (isCompact ? 'text-[9px] font-bold text-slate-800' : 'text-xs font-bold text-slate-900')
                                                                            : (isCompact ? 'text-[10px] font-black' : 'text-xs font-black')
                                                                            }`}>
                                                                            {companyInfo.name}
                                                                        </h2>
                                                                        {companyInfo.address && !isCompact && (
                                                                            <p className="text-[8px] font-medium text-gray-500 uppercase mt-0.5 truncate">{companyInfo.address}</p>
                                                                        )}
                                                                    </div>
                                                                    <span className={`px-1.5 py-0.5 text-[7px] font-extrabold uppercase shrink-0 ${isModern
                                                                        ? 'bg-slate-100 text-slate-700 rounded-md border border-slate-200/60'
                                                                        : 'bg-black text-white'
                                                                        }`}>
                                                                        {labelData.shipping_method || 'EXPRESS'}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Customer */}
                                                            {labelConfig.showCustomerDetails && (
                                                                <div className={`pb-1 ${isModern ? 'border-b border-gray-100' : 'border-b border-black pb-0.5'}`}>
                                                                    <span className="text-[7px] font-bold uppercase text-gray-400 block tracking-wider">SHIP TO:</span>
                                                                    <h3 className={`uppercase leading-tight truncate ${isModern
                                                                        ? (isCompact ? 'text-[9px] font-bold text-slate-800' : 'text-xs font-bold text-slate-900')
                                                                        : (isCompact ? 'text-[9px] font-black' : 'text-xs font-black')
                                                                        }`}>
                                                                        {labelData.customer_name}
                                                                    </h3>
                                                                    {labelData.delivery_address && (
                                                                        <p className="font-normal text-gray-600 leading-tight truncate text-[8px] mt-0.5">{labelData.delivery_address}</p>
                                                                    )}
                                                                    {labelData.phone && <p className="font-mono text-[8px] text-gray-500 mt-0.5">TEL: {labelData.phone}</p>}
                                                                </div>
                                                            )}

                                                            {/* Job Description */}
                                                            {labelConfig.showItemDescription && (
                                                                <div className={`pb-1 ${isModern ? 'border-b border-gray-100' : 'border-b border-black pb-0.5'}`}>
                                                                    <span className="text-[7px] font-bold uppercase text-gray-400 block tracking-wider">JOB ITEM:</span>
                                                                    <p className="font-semibold text-slate-800 truncate leading-tight text-[8px]">{labelData.item_name}</p>
                                                                </div>
                                                            )}

                                                            {/* Order Code & Package Type */}
                                                            {labelConfig.showOrderCode && (
                                                                <div className={`grid grid-cols-2 gap-1 pb-1 ${isModern ? 'border-b border-gray-100' : 'border-b border-black pb-0.5'}`}>
                                                                    <div>
                                                                        <span className="text-[7px] font-bold uppercase text-gray-400 block">SO #</span>
                                                                        <p className="font-mono font-bold text-slate-900 truncate text-[8px]">{labelData.order_code}</p>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[7px] font-bold uppercase text-gray-400 block">TYPE</span>
                                                                        <p className="font-semibold text-slate-800 truncate text-[8px]">{labelData.package_type}</p>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Box Sequence & Quantity */}
                                                            {(labelConfig.showBoxSequence || labelConfig.showPackQuantity) && (
                                                                <div className={`grid grid-cols-2 gap-1 p-1 ${isModern
                                                                    ? 'bg-slate-50/80 border border-slate-200/50 rounded-md'
                                                                    : 'bg-gray-100 p-1 border border-black rounded'
                                                                    }`}>
                                                                    {labelConfig.showBoxSequence && (
                                                                        <div>
                                                                            <span className="text-[7px] font-bold uppercase text-gray-400 block">BOX</span>
                                                                            <h3 className={`font-bold text-slate-900 leading-none ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                                                                {currentBoxNum} <span className="text-[8px] font-normal text-gray-500">/ {labelData.total_boxes}</span>
                                                                            </h3>
                                                                        </div>
                                                                    )}

                                                                    {labelConfig.showPackQuantity && (
                                                                        <div>
                                                                            <span className="text-[7px] font-bold uppercase text-gray-400 block">QTY</span>
                                                                            <h3 className={`font-extrabold leading-none text-emerald-700 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                                                                {(labelData.quantity || 0).toLocaleString()} <span className="text-[8px] font-normal text-gray-500">PCS</span>
                                                                            </h3>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Custom Notes */}
                                                            {labelConfig.showCustomNotes && labelData.notes && (
                                                                <div className="p-1 bg-amber-50/80 border border-amber-200/60 rounded text-[8px] font-medium text-amber-900 truncate">
                                                                    📌 {labelData.notes}
                                                                </div>
                                                            )}

                                                            {/* Special Handling */}
                                                            {labelConfig.showSpecialHandling && (labelData.is_fragile || labelData.is_waterproof) && (
                                                                <div className={`font-bold text-[7px] uppercase tracking-wider p-0.5 text-center flex justify-around ${isModern ? 'bg-amber-100/60 text-amber-900 rounded border border-amber-200/50' : 'bg-black text-white font-black'
                                                                    }`}>
                                                                    {labelData.is_fragile && <span>⚠️ FRAGILE</span>}
                                                                    {labelData.is_waterproof && <span>☔ KEEP DRY</span>}
                                                                </div>
                                                            )}

                                                            {/* Barcode & QC Stamp */}
                                                            {(labelConfig.showBarcode || labelConfig.showQCBadge) && (
                                                                <div className="pt-0.5 flex items-center justify-between gap-1">
                                                                    {labelConfig.showBarcode && (
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className={`h-4 w-full flex items-center justify-center text-[6px] font-mono tracking-widest ${isModern ? 'bg-slate-900 text-slate-100 rounded' : 'bg-black text-white'
                                                                                }`}>
                                                                                ||||||||||||||||||||||||||||
                                                                            </div>
                                                                            <span className="text-[6px] font-mono block text-center truncate text-gray-500 mt-0.5">
                                                                                {labelData.order_code}-B{currentBoxNum}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {labelConfig.showQCBadge && (
                                                                        <div className={`w-5 h-5 rounded-full border border-dashed flex flex-col items-center justify-center text-[4px] font-bold uppercase text-center leading-none shrink-0 ${isModern ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-black text-black'
                                                                            }`}>
                                                                            <span>QC</span>
                                                                            <span className="font-extrabold text-[5px]">OK</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: BOOK SPINE THICKNESS CALCULATOR */}
            {activeTab === 'spine' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Spine Calculator Inputs */}
                    <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl space-y-5">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <FiBookOpen className="text-indigo-400" />
                            Book Spine Parameter Inputs
                        </h3>

                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                                Inner Page Count (Total Pages)
                            </label>
                            <input
                                type="number"
                                step="2"
                                value={spineCalc.page_count}
                                onChange={(e) => setSpineCalc({ ...spineCalc, page_count: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">Total pages in book ({spineResults.sheets} printed leaf sheets)</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                                Inner Paper Stock Preset
                            </label>
                            <select
                                value={spineCalc.selected_paper}
                                onChange={(e) => setSpineCalc({ ...spineCalc, selected_paper: parseInt(e.target.value) })}
                                className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                                {PAPER_PRESETS.map((preset, idx) => (
                                    <option key={idx} value={idx}>
                                        {preset.name} (Bulk: {preset.bulk})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Binding Method</label>
                                <select
                                    value={spineCalc.binding_type}
                                    onChange={(e) => setSpineCalc({ ...spineCalc, binding_type: e.target.value })}
                                    className="w-full bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                    <option value="perfect">Perfect Binding (Hot Melt / PUR)</option>
                                    <option value="saddle">Saddle Stitch (Staple)</option>
                                    <option value="hardcover">Hardcover / Case Bound</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Cover Stock (GSM)</label>
                                <input
                                    type="number"
                                    value={spineCalc.cover_gsm}
                                    onChange={(e) => setSpineCalc({ ...spineCalc, cover_gsm: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                />
                            </div>
                        </div>

                        {spineCalc.binding_type === 'hardcover' && (
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Hardcover Greyboard Thickness (mm per side)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={spineCalc.hardcover_board_mm}
                                    onChange={(e) => setSpineCalc({ ...spineCalc, hardcover_board_mm: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                />
                            </div>
                        )}
                    </div>

                    {/* Spine Calculation Results & Visual Diagram */}
                    <div className="lg:col-span-6 space-y-5">
                        {/* Result Cards */}
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Calculated Book Spine Thickness</h3>

                            <div className="flex items-baseline gap-3">
                                <span className="text-4xl font-extrabold text-emerald-400 font-mono">
                                    {spineResults.totalSpineMm.toFixed(2)} <span className="text-xl text-gray-400 font-sans">mm</span>
                                </span>
                                <span className="text-lg font-mono text-gray-400">
                                    ({spineResults.totalSpineInches.toFixed(3)} inches)
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 pt-2 text-xs divide-x divide-white/10 border-t border-white/10">
                                <div className="pt-2">
                                    <span className="text-gray-500 block">Total Sheets</span>
                                    <strong className="text-white text-sm font-mono">{spineResults.sheets}</strong>
                                </div>
                                <div className="pt-2 pl-3">
                                    <span className="text-gray-500 block">Sheet Thickness</span>
                                    <strong className="text-white text-sm font-mono">{spineResults.singleSheetMm.toFixed(3)} mm</strong>
                                </div>
                                <div className="pt-2 pl-3">
                                    <span className="text-gray-500 block">Inner Block Width</span>
                                    <strong className="text-white text-sm font-mono">{spineResults.innerSpineMm.toFixed(2)} mm</strong>
                                </div>
                            </div>
                        </div>

                        {/* Visual Spine Diagram */}
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl space-y-3">
                            <h4 className="text-xs font-bold uppercase text-gray-400">Book Cover Layout Spine Visualizer</h4>
                            <div className="py-6 flex items-center justify-center bg-gray-950 border border-white/10 rounded-xl">
                                <div className="flex items-center gap-4">
                                    {/* Back Cover */}
                                    <div className="w-24 h-36 bg-indigo-900/40 border-2 border-indigo-500/50 rounded-l-md flex items-center justify-center text-xs font-bold text-indigo-300">
                                        Back Cover
                                    </div>

                                    {/* Spine */}
                                    <div
                                        className="h-36 bg-emerald-500/30 border-2 border-emerald-400 flex flex-col items-center justify-center px-2 transition-all text-center shadow-lg shadow-emerald-500/20"
                                        style={{ width: `${Math.max(40, spineResults.totalSpineMm * 4)}px` }}
                                    >
                                        <span className="text-[10px] font-mono font-bold text-emerald-300 rotate-90 whitespace-nowrap block">
                                            SPINE: {spineResults.totalSpineMm.toFixed(2)} mm
                                        </span>
                                    </div>

                                    {/* Front Cover */}
                                    <div className="w-24 h-36 bg-indigo-900/40 border-2 border-indigo-500/50 rounded-r-md flex items-center justify-center text-xs font-bold text-indigo-300">
                                        Front Cover
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: PAPER REAM & WEIGHT CALCULATOR */}
            {activeTab === 'paper' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl space-y-5">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <FiBox className="text-purple-400" />
                            Paper Dimensions & GSM
                        </h3>

                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Standard Size Presets</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['23x36', '25x36', '24x34', 'A4', 'A3', 'SRA3'].map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => handlePresetChange(preset)}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${paperCalc.preset_size === preset
                                            ? 'bg-purple-600 border-purple-500 text-white'
                                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                            }`}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Width (Inches)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={paperCalc.width_inch}
                                    onChange={(e) => setPaperCalc({ ...paperCalc, width_inch: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Length (Inches)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={paperCalc.length_inch}
                                    onChange={(e) => setPaperCalc({ ...paperCalc, length_inch: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Paper GSM</label>
                                <input
                                    type="number"
                                    value={paperCalc.gsm}
                                    onChange={(e) => setPaperCalc({ ...paperCalc, gsm: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Total Sheet Count</label>
                                <input
                                    type="number"
                                    value={paperCalc.sheet_count}
                                    onChange={(e) => setPaperCalc({ ...paperCalc, sheet_count: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Total Paper Weight & Tonnage</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                                <span className="text-xs text-purple-300 uppercase font-semibold block">Total Weight (KG)</span>
                                <h2 className="text-3xl font-extrabold text-white mt-1 font-mono">{paperResults.totalWeightKg.toFixed(1)} <span className="text-sm font-normal text-gray-400">kg</span></h2>
                            </div>
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                <span className="text-xs text-indigo-300 uppercase font-semibold block">Total Reams</span>
                                <h2 className="text-3xl font-extrabold text-white mt-1 font-mono">{paperResults.totalReams.toFixed(1)} <span className="text-sm font-normal text-gray-400">reams</span></h2>
                            </div>
                        </div>

                        <div className="space-y-2 pt-3 text-xs divide-y divide-white/10">
                            <div className="flex justify-between py-1 text-gray-300">
                                <span>Total Tonnage:</span>
                                <strong className="font-mono text-white">{paperResults.tonnes.toFixed(3)} Tonnes</strong>
                            </div>
                            <div className="flex justify-between py-1 text-gray-300">
                                <span>Weight in Pounds (lbs):</span>
                                <strong className="font-mono text-white">{paperResults.totalWeightLbs.toFixed(1)} lbs</strong>
                            </div>
                            <div className="flex justify-between py-1 text-gray-300">
                                <span>Weight per Ream (500 sheets):</span>
                                <strong className="font-mono text-white">{paperResults.weightPerReamKg.toFixed(2)} kg</strong>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: INK USAGE ESTIMATOR */}
            {activeTab === 'ink' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl space-y-5">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            <FiDroplet className="text-blue-400" />
                            Ink Coverage Parameters
                        </h3>

                        <div>
                            <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Total Impressions (Press Sheets)</label>
                            <input
                                type="number"
                                value={inkCalc.impressions}
                                onChange={(e) => setInkCalc({ ...inkCalc, impressions: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Sheet Width (in)</label>
                                <input
                                    type="number"
                                    value={inkCalc.width_inch}
                                    onChange={(e) => setInkCalc({ ...inkCalc, width_inch: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Sheet Length (in)</label>
                                <input
                                    type="number"
                                    value={inkCalc.length_inch}
                                    onChange={(e) => setInkCalc({ ...inkCalc, length_inch: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="block text-xs font-semibold uppercase text-gray-400">CMYK Ink Coverage (%)</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-xs text-cyan-400 font-bold block mb-1">Cyan %</span>
                                    <input
                                        type="number"
                                        value={inkCalc.cyan_cov}
                                        onChange={(e) => setInkCalc({ ...inkCalc, cyan_cov: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-cyan-950/40 border border-cyan-500/30 rounded-xl px-3 py-2 text-sm text-cyan-200 focus:outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <span className="text-xs text-pink-400 font-bold block mb-1">Magenta %</span>
                                    <input
                                        type="number"
                                        value={inkCalc.magenta_cov}
                                        onChange={(e) => setInkCalc({ ...inkCalc, magenta_cov: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-pink-950/40 border border-pink-500/30 rounded-xl px-3 py-2 text-sm text-pink-200 focus:outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <span className="text-xs text-yellow-400 font-bold block mb-1">Yellow %</span>
                                    <input
                                        type="number"
                                        value={inkCalc.yellow_cov}
                                        onChange={(e) => setInkCalc({ ...inkCalc, yellow_cov: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-yellow-950/40 border border-yellow-500/30 rounded-xl px-3 py-2 text-sm text-yellow-200 focus:outline-none font-mono"
                                    />
                                </div>
                                <div>
                                    <span className="text-xs text-gray-300 font-bold block mb-1">Key (Black) %</span>
                                    <input
                                        type="number"
                                        value={inkCalc.black_cov}
                                        onChange={(e) => setInkCalc({ ...inkCalc, black_cov: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none font-mono"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Required Ink Quantity (KG)</h3>

                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                            <span className="text-xs text-blue-300 uppercase font-semibold block">Total Offset Ink</span>
                            <h2 className="text-3xl font-extrabold text-white mt-1 font-mono">{inkResults.totalInkKg.toFixed(2)} <span className="text-sm font-normal text-gray-400">kg</span></h2>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl">
                                <span className="text-xs text-cyan-400 font-semibold block">Cyan Ink</span>
                                <h4 className="text-lg font-bold text-white font-mono">{inkResults.cKg.toFixed(2)} kg</h4>
                            </div>
                            <div className="p-3 bg-pink-950/40 border border-pink-500/30 rounded-xl">
                                <span className="text-xs text-pink-400 font-semibold block">Magenta Ink</span>
                                <h4 className="text-lg font-bold text-white font-mono">{inkResults.mKg.toFixed(2)} kg</h4>
                            </div>
                            <div className="p-3 bg-yellow-950/40 border border-yellow-500/30 rounded-xl">
                                <span className="text-xs text-yellow-400 font-semibold block">Yellow Ink</span>
                                <h4 className="text-lg font-bold text-white font-mono">{inkResults.yKg.toFixed(2)} kg</h4>
                            </div>
                            <div className="p-3 bg-gray-800 border border-gray-600 rounded-xl">
                                <span className="text-xs text-gray-300 font-semibold block">Black Ink</span>
                                <h4 className="text-lg font-bold text-white font-mono">{inkResults.kKg.toFixed(2)} kg</h4>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
