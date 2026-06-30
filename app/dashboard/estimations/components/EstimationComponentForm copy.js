'use client';

import { useState, useEffect } from 'react';
import { FiTrash2, FiCopy } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { RiPrinterFill, RiSideBarLine, RiLayoutGridLine, RiPagesLine, RiSpeedUpLine } from 'react-icons/ri'; // Feel free to map your preferred icon library

function getCutSheetDimensions(W, H, factor) {
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
}

export default function EstimationComponentForm({
    index,
    data,
    machines,
    papers,
    finishings: availableFinishings,
    sfgInventory = [], // SFG/Assets inventory items
    onChange, // (index, field, value)
    onRemove, // (index)
    onCopy, // (index)
    onAddFinishing, // (index, finishingItem)
    onRemoveFinishing, // (index, finishingId)
    calculationResult, // New prop
    currency
}) {
    const { params, type, finishings: selectedFinishings } = data;
    const sfgLines = data.sfgLines || [];
    const isSFGComponent = (data.name || '').includes('Assets') || (data.name || '').includes('SFG');

    // Local state for searches (keep UI responsive)
    const [paperSearch, setPaperSearch] = useState(params.paperName || '');
    const [showPaperSuggestions, setShowPaperSuggestions] = useState(false);

    const [finishingSearch, setFinishingSearch] = useState('');
    const [showFinishingSuggestions, setShowFinishingSuggestions] = useState(false);

    // SFG line search
    const [sfgSearch, setSfgSearch] = useState('');
    const [showSfgSuggestions, setShowSfgSuggestions] = useState(false);

    const addSfgLine = (item) => {
        const newLine = {
            id: `sfg-${Date.now()}-${Math.random()}`,
            inventory_item_id: item.id,
            item_name: item.name,
            item_code: item.item_code || '',
            quantity: 1,
            unit_price: parseFloat(item.unit_cost) || 0,
            total_price: parseFloat(item.unit_cost) || 0,
            stock_quantity: item.stock_quantity,
            uom: item.uom || 'Unit',
        };
        onChange(index, 'sfgLines', [...sfgLines, newLine]);
    };

    const updateSfgLine = (lineId, field, value) => {
        const updated = sfgLines.map(l => {
            if (l.id !== lineId) return l;
            const qty = field === 'quantity' ? (parseFloat(value) || 0) : (parseFloat(l.quantity) || 0);
            const price = field === 'unit_price' ? (parseFloat(value) || 0) : (parseFloat(l.unit_price) || 0);
            return { ...l, [field]: value, total_price: qty * price };
        });
        onChange(index, 'sfgLines', updated);
    };

    const removeSfgLine = (lineId) => {
        onChange(index, 'sfgLines', sfgLines.filter(l => l.id !== lineId));
    };
    const [pendingFinishing, setPendingFinishing] = useState({
        id: null, name: '', time_per_unit: 0, unit_cost: 0,
        is_machine: false, machine_id: null, cost_unit: 'Unit', variants: [],
        speed: null, speed_unit: ''
    });
    const [selectedVariantId, setSelectedVariantId] = useState('');

    // Local isBB state — gives immediate visual feedback independent of parent re-render cycle
    const [isBB, setIsBB] = useState(!!params.isBB);
    useEffect(() => { setIsBB(!!params.isBB); }, [params.isBB]);
    const handleIsBBToggle = () => {
        const next = !isBB;
        setIsBB(next);
        onChange(index, 'params', { ...params, isBB: next });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let newParams = { ...params, [name]: value };
        // For Cover components, pages must always equal sides (the input is display-only)
        if (data.name === 'Cover' && name === 'sides') {
            newParams.pages = value;
        }
        // When switching to Both Sides, default colorsBack to match colorsFront if still 0
        if (name === 'sides' && parseInt(value) === 2 && !parseInt(params.colorsBack)) {
            newParams.colorsBack = params.colorsFront ?? 4;
        }
        if(name === 'sides' && parseInt(value) === 1){
            newParams.colorsBack = 0
        }
        if (name === 'paperWidthCm' || name === 'paperHeightCm') {
            const paperW = parseFloat(name === 'paperWidthCm' ? value : params.paperWidthCm) || 0;
            const paperH = parseFloat(name === 'paperHeightCm' ? value : params.paperHeightCm) || 0;
            const machine = machines.find(m => m.id == params.machineId);
            const factor = machine ? parseFloat(machine.sheet_factor) || 1.0 : 1.0;
            const cutDims = getCutSheetDimensions(paperW, paperH, factor);
            newParams.cutWidthCm = cutDims.width;
            newParams.cutHeightCm = cutDims.height;
        }
        if (name === 'size') {
            const size = value;
            switch (size) {
                case 'A1':
                    newParams.compWidthCm = 84.1;
                    newParams.compHeightCm = 59.4;
                    break;
                case 'A2':
                    newParams.compWidthCm = 59.4;
                    newParams.compHeightCm = 42;
                    break;
                case 'A3':
                    newParams.compWidthCm = 29.7;
                    newParams.compHeightCm = 42;
                    break;
                case 'A4':
                    newParams.compWidthCm = 21;
                    newParams.compHeightCm = 29.7;
                    break;
                case 'A5':
                    newParams.compWidthCm = 14.8;
                    newParams.compHeightCm = 21;
                    break;
                case 'A6':
                    newParams.compWidthCm = 10.5;
                    newParams.compHeightCm = 14.8;
                    break;
            }
        }

        onChange(index, 'params', newParams);
    };

    const updateParam = (key, value) => {
        onChange(index, 'params', { ...params, [key]: value });
    };

    return (
        <section className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 relative">
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <button
                    onClick={() => onCopy(index)}
                    title="Copy Component"
                    className="text-gray-400 hover:text-white p-2 transition-colors"
                >
                    <FiCopy className="text-base" />
                </button>
                {index > 0 && (
                    <button
                        onClick={() => onRemove(index)}
                        title="Delete Component"
                        className="text-red-400 hover:text-red-300 p-2 transition-colors"
                    >
                        <FiTrash2 className="text-base" />
                    </button>
                )}
            </div>

            <div className="mb-4 border-b border-white/10 pb-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-md font-semibold text-gray-300">Specifications</h3>
                    <div className="flex bg-black/50 rounded-lg p-1 border mr-20 border-white/10">
                        <button
                            onClick={() => onChange(index, 'type', 'offset')}
                            className={`px-3 py-1 rounded text-xs ${type === 'offset' ? 'bg-white text-black' : 'text-gray-400'}`}
                        >Offset</button>
                        <button
                            onClick={() => onChange(index, 'type', 'digital')}
                            className={`px-3 py-1 rounded text-xs ${type === 'digital' ? 'bg-white text-black' : 'text-gray-400'}`}
                        >Digital</button>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-2">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Component Name</label>
                        <Input
                            value={data.name}
                            onChange={(e) => onChange(index, 'name', e.target.value)}
                            className="bg-secondary border-white/10"
                            placeholder="e.g. Cover, Inner Pages"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                        <Input
                            type="number"
                            value={data.quantity}
                            onChange={(e) => onChange(index, 'quantity', e.target.value)}
                            className="bg-secondary border-white/10"
                        />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                {(data.name.includes('Inner') || data.name.includes('Cover')) || data.name.includes('Main') && (
                    <>
                        {/* 1. Print Sides */}
                        <div className="bg-gradient-to-b from-white/[0.07] to-transparent backdrop-blur-lg p-5 rounded-2xl border border-white/10 flex flex-col gap-4 shadow-2xl">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-xs font-medium text-gray-400 tracking-wide">Output Type</span>
                                <div className="p-1.5 rounded-md bg-white/5 text-gray-300">
                                    <RiSideBarLine className="text-lg" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-2xl font-semibold text-white tracking-tight truncate">
                                    {data.sidesVal === 2 ? 'Double-Sided (2/2)' : 'Single-Sided (1/0)'}
                                </h4>
                                <p className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span> {data.sidesVal} {data.sidesVal === 1 ? 'Surface' : 'Surfaces'}
                                </p>
                            </div>
                        </div>
            
                        {/* 2. Ups (Imposition) */}
                        <div className="bg-gradient-to-b from-white/[0.07] to-transparent backdrop-blur-lg p-5 rounded-2xl border border-white/10 flex flex-col gap-4 shadow-2xl">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-xs font-medium text-gray-400 tracking-wide">Imposition Arrangement</span>
                                <div className="p-1.5 rounded-md bg-white/5 text-gray-300">
                                    <RiLayoutGridLine className="text-lg" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-2xl font-semibold text-white tracking-tight truncate">
                                    {params.ups || 1}-Up 
                                </h4>
                                <p className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> Layout
                                </p>
                            </div>
                        </div>
            
                        {/* 3. Pages */}
                        {/* <div className="bg-gradient-to-b from-white/[0.07] to-transparent backdrop-blur-lg p-5 rounded-2xl border border-white/10 flex flex-col gap-4 shadow-2xl">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-xs font-medium text-gray-400 tracking-wide">Document Volume</span>
                                <div className="p-1.5 rounded-md bg-white/5 text-gray-300">
                                    <RiPagesLine className="text-lg" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-2xl font-semibold text-white tracking-tight truncate">
                                    {(data.pagesVal || 0).toLocaleString()} Pages
                                </h4>
                                <p className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> Content Base
                                </p>
                            </div>
                        </div> */}
            
                        {/* 4. Impression Rate */}
                        <div className="bg-gradient-to-b from-white/[0.07] to-transparent backdrop-blur-lg p-5 rounded-2xl border border-white/10 flex flex-col gap-4 shadow-2xl">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-xs font-medium text-gray-400 tracking-wide">Unit Pricing</span>
                                <div className="p-1.5 rounded-md bg-white/5 text-gray-300">
                                    <RiSpeedUpLine className="text-lg" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-2xl font-semibold text-white tracking-tight truncate">
                                    {parseFloat(params.impressionCostPerUnit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                </h4>
                                <p className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> {currency}
                                </p>
                            </div>
                        </div>
                    </>
                )}

    
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left: Input Form */}
                <div className="lg:col-span-2 space-y-6">
                    {type === 'offset' && !data.name.includes("Finishing") && (
                        <>
                        <div className="grid md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Machine</label>
                                <select
                                    name="machineId"
                                    value={params.machineId}
                                    onChange={(e) => {
                                        const mId = e.target.value;
                                        const machine = machines.find(m => m.id == mId);
                                        const paperW = parseFloat(params.paperWidthCm) || 0;
                                        const paperH = parseFloat(params.paperHeightCm) || 0;
                                        const factor = machine ? parseFloat(machine.sheet_factor) || 1.0 : 1.0;
                                        const cutDims = getCutSheetDimensions(paperW, paperH, factor);

                                        // Update both params in one go to avoid race conditions with closure state
                                        onChange(index, 'params', {
                                            ...params,
                                            machineId: mId,
                                            plateCostPerUnit: machine ? machine.plate_cost : params.plateCostPerUnit,
                                            cutWidthCm: cutDims.width,
                                            cutHeightCm: cutDims.height
                                        });
                                    }}
                                    className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                                >
                                    <option value="">Select Machine</option>
                                    {machines.filter(m => m.type === 'offset').map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Sides</label>
                                <select name="sides" value={params.sides} onChange={handleChange} className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                                    <option value="1">One Side</option>
                                    <option value="2">Both Sides</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Comp Size</label>
                                <select name="size" value={params.size} onChange={handleChange} className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                                    <option value="A1">A1</option>
                                    <option value="A2">A2</option>
                                    <option value="A3">A3</option>
                                    <option value="A4">A4</option>
                                    <option value="A5">A5</option>
                                    <option value="A6">A6</option>
                                    <option value="Custom">Custom</option>
                                </select>
                            </div>
                            <div className={!data.name.includes("Cover") ? "" : 'opacity-40 pointer-events-none'}><label className="block text-sm text-gray-400 mb-1">Pages <span className={(data.name.includes('Cover') || data.name.includes('Inner') && !isBB && !data.name.includes('Main')) ? 'text-xs text-red-600' : 'hidden'} >{params.pages % (params.sides * params.ups) != 0 ? 'You may need B&B' : ''}</span></label><Input disabled={data.name === "Cover"} type="number" name="pages" value={data.name === "Cover" ? params.sides : params.pages} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            <div><label className="block text-sm text-gray-400 mb-1">Ups</label><Input type="number" name="ups" value={params.ups} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            <div className={(data.name.includes('Cover') || data.name.includes('Inner')) ? '' : 'hidden'}>
                                <label className="block text-sm text-gray-400 mb-1">
                                    Press Ups
                                    {params.customSheetFactor && (
                                        <button type="button" onClick={() => updateParam('customSheetFactor', '')} className="ml-2 text-[10px] text-amber-400 hover:text-amber-300">↩ auto</button>
                                    )}
                                </label>
                                <Input
                                    type="number"
                                    name="customSheetFactor"
                                    value={params.customSheetFactor || '1'}
                                    onChange={handleChange}
                                    className={`bg-secondary border-white/10 ${params.customSheetFactor ? 'border-amber-500/50 text-amber-300' : ''}`}
                                    placeholder={String(machines.find(m => m.id == params.machineId)?.sheet_factor || 'Auto')}
                                    min="1"
                                    step="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Front Colours</label>
                                <Input type="number" name="colorsFront" value={params.colorsFront ?? 4} onChange={handleChange} className="bg-secondary border-white/10" min="0" />
                            </div>
                            <div className={parseInt(params.sides) === 2 ? '' : 'opacity-40 pointer-events-none'}>
                                <label className="block text-sm text-gray-400 mb-1">Back Colours {parseInt(params.sides) !== 2 && <span className="text-xs text-gray-600">(single-sided)</span>}</label>
                                <Input type="number" name="colorsBack" value={params.colorsBack ?? 0} onChange={handleChange} className="bg-secondary border-white/10" min="0" disabled={parseInt(params.sides) !== 2} />
                            </div>
                            <div><label className="block text-sm text-gray-400 mb-1">Wastage Cut Sheets</label><Input type="number" name="wastagePercent" value={params.wastagePercent} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Sets / Wastage Sheets</label>
                                <Input
                                    type="number"
                                    name="customWastageSheets"
                                    value={params.customWastageSheets != null ? params.customWastageSheets : ''}
                                    onChange={handleChange}
                                    className="bg-secondary border-white/10"
                                    placeholder={calculationResult ? String(calculationResult.wastageSheets) : 'Auto-calculated'}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Impressions</label>
                                <Input
                                    type="number"
                                    name="customImpressions"
                                    value={params.customImpressions || ''}
                                    onChange={handleChange}
                                    className="bg-secondary border-white/10"
                                    placeholder={calculationResult ? String(calculationResult.printedSheets) : 'Auto-calculated'}
                                />
                            </div>
                            {(data.name?.toLowerCase().includes('cover') || data.name?.toLowerCase().includes('inner')) && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Plate Count</label>
                                    <Input
                                        type="number"
                                        name="customPlateCount"
                                        value={params.customPlateCount != null ? params.customPlateCount : ''}
                                        onChange={handleChange}
                                        className={`bg-secondary border-white/10 ${params.customPlateCount != null && params.customPlateCount !== '' ? 'border-amber-500/50 text-amber-300' : ''}`}
                                        placeholder={calculationResult ? String(calculationResult.plateCount) : 'Auto-calculated'}
                                    />
                                </div>
                            )}
                            {data.name?.includes('Inner') || data.name?.includes('Main') && (
                                <div className="bg-gradient-to-b from-white/[0.07] to-transparent backdrop-blur-lg px-5 py-2h-full justify-center rounded-2xl border border-white/10 flex flex-col  shadow-2xl">
                                    <div className="flex justify-between items-center w-full">
                                        <p className="text-[xs] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> {isBB ? '1' : Math.ceil(params.pages / (params.sides * params.ups))} Forms
                                        </p>
                                        <div className="p-1.5 rounded-md bg-white/5 text-gray-300">
                                            <RiPagesLine className="text-lg" />
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-medium text-gray-400 tracking-wide">Total Volume</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* B&B toggle — only for Inner components */}
                        {(data.name?.includes('Inner') || data.name?.includes('Cover')) || data.name?.includes('Main') && (
                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={handleIsBBToggle}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                                        isBB
                                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                                    }`}
                                >
                                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${isBB ? 'bg-amber-500 border-amber-500 text-black' : 'border-white/30'}`}>
                                        {isBB ? '✓' : ''}
                                    </span>
                                    B&amp;B
                                </button>
                                <span className="text-xs text-gray-500">
                                    {isBB ? 'Plate count locked to 1 (Back-to-Back)' : 'Enable for Back-to-Back printing'}
                                </span>
                            </div>
                        )}
                        </>
                    )}

                    {type === 'digital' &&(
                        <>
                            <div className="grid md:grid-cols-4 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Machine</label>
                                    <select
                                        name="machineId"
                                        value={params.machineId || ''}
                                        onChange={(e) => {
                                            const mId = e.target.value;
                                            const machine = machines.find(m => m.id == mId);
                                            let pricePerSqCm = 0;
                                            if (machine) {
                                                if (params.colorQuality === 'max') pricePerSqCm = machine.digital_price_max;
                                                else if (params.colorQuality === 'medium') pricePerSqCm = machine.digital_price_medium;
                                                else if (params.colorQuality === 'min') pricePerSqCm = machine.digital_price_min;
                                                else {
                                                    // Default if no quality selected yet
                                                    pricePerSqCm = machine.digital_price_max;
                                                    updateParam('colorQuality', 'max');
                                                }
                                            }
                                            onChange(index, 'params', {
                                                ...params,
                                                machineId: mId,
                                                digitalPricePerSqCm: pricePerSqCm || 0
                                            });
                                        }}
                                        className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                                    >
                                        <option value="">Select Machine</option>
                                        {machines.filter(m => m.type === 'digital').map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Color Quality</label>
                                    <select
                                        name="colorQuality"
                                        value={params.colorQuality || 'max'}
                                        onChange={(e) => {
                                            const quality = e.target.value;
                                            const machine = machines.find(m => m.id == params.machineId);
                                            let pricePerSqCm = params.digitalPricePerSqCm;
                                            if (machine) {
                                                if (quality === 'max') pricePerSqCm = machine.digital_price_max;
                                                else if (quality === 'medium') pricePerSqCm = machine.digital_price_medium;
                                                else if (quality === 'min') pricePerSqCm = machine.digital_price_min;
                                            }
                                            onChange(index, 'params', {
                                                ...params,
                                                colorQuality: quality,
                                                digitalPricePerSqCm: pricePerSqCm || 0
                                            });
                                        }}
                                        className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                                    >
                                        <option value="max">Max</option>
                                        <option value="medium">Medium</option>
                                        <option value="min">Min</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Sides</label>
                                    <select name="sides" value={params.sides || '1'} onChange={handleChange} className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                                        <option value="1">One Side</option>
                                        <option value="2">Both Sides</option>
                                    </select>
                                </div>
                                <div><label className="block text-sm text-gray-400 mb-1">Copies/Ups</label><Input type="number" name="ups" value={params.ups} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Comp Size</label>
                                    <select name="size" value={params.size || ''} onChange={handleChange} className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                                        <option value="">Custom</option>
                                        <option value="A1">A1</option>
                                        <option value="A2">A2</option>
                                        <option value="A3">A3</option>
                                        <option value="A4">A4</option>
                                        <option value="A5">A5</option>
                                        <option value="A6">A6</option>
                                    </select>
                                </div>
                                <div><label className="block text-sm text-gray-400 mb-1">Comp Width (cm)</label><Input type="number" name="compWidthCm" value={params.compWidthCm || ''} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Comp Height (cm)</label><Input type="number" name="compHeightCm" value={params.compHeightCm || ''} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            </div>

                            <h3 className="text-md font-semibold text-gray-300 mb-3 border-t border-white/10 pt-4">Materials</h3>
                            <div className="grid md:grid-cols-2 gap-4 mb-6">
                                <div className="md:col-span-2 relative">
                                    <label className="block text-sm text-gray-400 mb-1">Select Paper</label>
                                    <div className="relative">
                                        <Input
                                            value={paperSearch}
                                            onChange={(e) => {
                                                setPaperSearch(e.target.value);
                                                setShowPaperSuggestions(true);
                                            }}
                                            onFocus={() => setShowPaperSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowPaperSuggestions(false), 200)}
                                            placeholder="Type to search digital paper..."
                                            className="bg-secondary border-white/10"
                                        />
                                        {showPaperSuggestions && (
                                            <ul className="absolute z-50 w-full bg-secondary border border-white/10 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                                                {papers.filter(p => {
                                                    const pType = (p.type || '').toUpperCase();
                                                    return pType !== 'OFFSET' && p.name.toLowerCase().includes(paperSearch.toLowerCase());
                                                }).map(p => (
                                                    <li key={p.id} onClick={() => {
                                                        onChange(index, 'params', {
                                                            ...params,
                                                            paperCostPerSheet: p.unit_cost,
                                                            paperId: p.id,
                                                            paperName: p.name,
                                                            paperWidthCm: p.width_cm || 0,
                                                            paperHeightCm: p.height_cm || 0
                                                        });
                                                        setPaperSearch(p.name);
                                                        setShowPaperSuggestions(false);
                                                    }} className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between">
                                                        <span>{p.name} {p.width_cm && p.height_cm ? `(${p.width_cm}x${p.height_cm}cm)` : ''}</span>
                                                        <span>{currency}{parseFloat(p.unit_cost).toFixed(4)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                                <div><label className="block text-sm text-gray-400 mb-1">Paper Cost/Sheet</label><Input type="number" name="paperCostPerSheet" value={params.paperCostPerSheet} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Print Cost / sq(cm)</label><Input type="number" name="digitalPricePerSqCm" value={params.digitalPricePerSqCm} onChange={handleChange} className="bg-secondary border-white/10 disabled:opacity-50" disabled /></div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Print Cost / Unit</label>
                                    <Input
                                        type="number"
                                        value={((parseFloat(params.paperWidthCm) || 0) * (parseFloat(params.paperHeightCm) || 0) * (parseFloat(params.digitalPricePerSqCm) || 0) * (parseInt(params.sides) || 1)).toFixed(4)}
                                        className="bg-secondary border-white/10 disabled:opacity-50"
                                        disabled
                                    />
                                </div>
                                <div><label className="block text-sm text-gray-400 mb-1">Width (cm)</label><Input type="number" name="paperWidthCm" value={params.paperWidthCm} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Height (cm)</label><Input type="number" name="paperHeightCm" value={params.paperHeightCm} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            </div>
                        </>
                    )}
                    {type === 'offset' && !data.name.includes("Finishing") && (
                        <>
                            <h3 className="text-md font-semibold text-gray-300 mb-3 border-t border-white/10 pt-4">Materials & Dimensions</h3>
                            <div className="grid md:grid-cols-3 gap-4 mb-6">
                                <div className="md:col-span-2 relative">
                                    <label className="block text-sm text-gray-400 mb-1">Select Paper</label>
                                    <div className="relative">
                                        <Input
                                            value={paperSearch}
                                            onChange={(e) => {
                                                setPaperSearch(e.target.value);
                                                setShowPaperSuggestions(true);
                                            }}
                                            onFocus={() => setShowPaperSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowPaperSuggestions(false), 200)}
                                            placeholder="Type to search paper..."
                                            className="bg-secondary border-white/10"
                                        />
                                        {showPaperSuggestions && (
                                            <ul className="absolute z-50 w-full bg-secondary border border-white/10 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                                                {papers.filter(p => {
                                                    const pType = (p.type || '').toUpperCase();
                                                    return (pType === 'OFFSET' || pType === 'BOTH') && p.name.toLowerCase().includes(paperSearch.toLowerCase());
                                                }).map(p => (
                                                    <li key={p.id} onClick={() => {
                                                        const paperW = p.width_cm || 0;
                                                        const paperH = p.height_cm || 0;
                                                        const machine = machines.find(m => m.id == params.machineId);
                                                        const factor = machine ? parseFloat(machine.sheet_factor) || 1.0 : 1.0;
                                                        const cutDims = getCutSheetDimensions(paperW, paperH, factor);

                                                        onChange(index, 'params', { 
                                                            ...params, 
                                                            paperCostPerSheet: p.unit_cost, 
                                                            paperId: p.id, 
                                                            paperName: p.name,
                                                            paperWidthCm: paperW,
                                                            paperHeightCm: paperH,
                                                            cutWidthCm: cutDims.width,
                                                            cutHeightCm: cutDims.height
                                                        });
                                                        setPaperSearch(p.name);
                                                        setShowPaperSuggestions(false);
                                                    }} className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between">
                                                        <span>{p.name} {p.width_cm && p.height_cm ? `(${p.width_cm}x${p.height_cm}cm)` : ''}</span><span>{currency}{parseFloat(p.unit_cost).toFixed(4)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                                <div className=""><label className="block text-sm text-gray-400 mb-1">Paper Cost/Sheet</label><Input type="number" name="paperCostPerSheet" value={params.paperCostPerSheet} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div className=''><label className="block text-sm text-gray-400 mb-1">Plate Cost/Unit</label><Input type="number" name="plateCostPerUnit" value={params.plateCostPerUnit} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Impression Cost</label><Input type="number" name="impressionCostPerUnit" value={params.impressionCostPerUnit} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Paper Width (cm)</label><Input type="number" name="paperWidthCm" value={params.paperWidthCm || ''} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Paper Height (cm)</label><Input type="number" name="paperHeightCm" value={params.paperHeightCm || ''} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Cut Sheet Width (cm)</label><Input type="number" name="cutWidthCm" value={params.cutWidthCm || ''} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Cut Sheet Height (cm)</label><Input type="number" name="cutHeightCm" value={params.cutHeightCm || ''} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Finished Comp Width (cm)</label><Input type="number" name="compWidthCm" value={params.compWidthCm || ''} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Finished Comp Height (cm)</label><Input type="number" name="compHeightCm" value={params.compHeightCm || ''} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div className="hidden"><label className="block text-sm text-gray-400 mb-1">Bleed (mm)</label><Input type="number" name="bleedMm" value={params.bleedMm || ''} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            </div>
                        </>
                    )}
                    {type === 'digital' && (
                        <></> /* Digital form materials are now handled above to avoid duplicate Materials heading */
                    )}

                    <div>
                        <h3 className={`text-md font-semibold text-gray-300 mb-3 border-t border-white/10 pt-4 ${data.name.includes("Finishing") ? 'hidden' : ''}`}>Finishings</h3>
                        <div className="bg-white/5 p-4 rounded-lg mb-4 border border-white/10">
                            <div className="grid md:grid-cols-12  gap-3 mb-3">
                                <div className="md:col-span-8 relative">
                                    <Input value={finishingSearch} onChange={(e) => { setFinishingSearch(e.target.value); setShowFinishingSuggestions(true); setPendingFinishing(p => ({ ...p, name: e.target.value })); }} onFocus={() => setShowFinishingSuggestions(true)} onBlur={() => setTimeout(() => setShowFinishingSuggestions(false), 200)} placeholder="Add Finishing..." className="bg-secondary border-white/10 text-sm py-1.5" />
                                    {showFinishingSuggestions && (
                                        <ul className="absolute z-50 w-full bg-secondary border border-white/10 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-xl">
                                            {availableFinishings.filter(f => f.name.toLowerCase().includes(finishingSearch.toLowerCase())).map(f => (
                                                <li key={f.id} onClick={() => {
                                                    setFinishingSearch(f.name);
                                                    setPendingFinishing({
                                                        id: f.id,
                                                        name: f.name,
                                                        unit_cost: parseFloat(f.unit_cost),
                                                        time_per_unit: 0,
                                                        is_machine: f.is_machine === 1,
                                                        machine_id: f.machine_id,
                                                        cost_unit: f.cost_unit || 'Unit',
                                                        variants: f.variants || [],
                                                        speed: f.speed,
                                                        speed_unit: f.speed_unit,
                                                        forms: 1
                                                    });
                                                    setSelectedVariantId('');
                                                    setShowFinishingSuggestions(false);
                                                }} className="px-3 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between"><span>{f.name}</span><span>{currency}{f.unit_cost}</span></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className={pendingFinishing.cost_unit === "Form" ? "md:col-span-2" : "md:col-span-2 hidden"}>
                                    <Input type="number" value={pendingFinishing.forms != null ? pendingFinishing.forms : ''} onChange={(e) => setPendingFinishing(p => ({ ...p, forms: parseInt(e.target.value) || 0 }))} className="bg-secondary border-white/10 text-sm py-1.5" placeholder="Forms" />
                                </div>
                                <div className="md:col-span-2">
                                    <Input type="number" value={pendingFinishing.unit_cost} onChange={(e) => setPendingFinishing(p => ({ ...p, unit_cost: parseFloat(e.target.value) || 0 }))} className="bg-secondary border-white/10 text-sm py-1.5" placeholder="Cost" />
                                </div>
                                <div className="md:col-span-2">
                                    <Button onClick={() => { if (!pendingFinishing.name) return; onAddFinishing(index, { ...pendingFinishing, id: Date.now() }); setFinishingSearch(''); setPendingFinishing({ id: null, name: '', unit_cost: 0, time_per_unit: 0, is_machine: false, cost_unit: 'Unit', variants: [], forms: 1 }); }} className="w-full bg-white text-black text-sm py-1.5 flex justify-center items-center px-0">Add</Button>
                                </div>
                            </div>
                            {pendingFinishing.variants && pendingFinishing.variants.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {pendingFinishing.variants.map(v => (
                                        <button key={v.id} onClick={() => { setSelectedVariantId(v.id); setPendingFinishing(p => ({ ...p, name: `${p.name.split(' - ')[0]} - ${v.name}`, unit_cost: parseFloat(v.unit_cost) })); }} className={`px-2 py-0.5 text-xs rounded border ${selectedVariantId === v.id ? 'bg-blue-600 border-blue-500' : 'border-white/20'}`}>{v.name}</button>
                                    ))}
                                </div>
                            )}
                            <div className="space-y-2 mt-4">
                                {selectedFinishings.map((f, i) => (
                                    <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/5 p-3 rounded border border-white/10 text-sm gap-2">
                                        <span className="flex-1 break-all pr-4">
                                            {f.name}
                                            {f.cost_unit === 'Form' && f.forms != null && (
                                                <span className="text-xs text-blue-400 ml-1.5">({f.forms} Forms)</span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-4 shrink-0">
                                            {f.total_time > 0 && (
                                                <span className="text-blue-300 text-xs">{f.total_time.toFixed(2)} hrs</span>
                                            )}
                                            <span className="text-gray-400 font-mono w-20 text-right">{currency}{(Number(f.total_cost) || 0).toFixed(2)}</span>
                                            <button onClick={() => onRemoveFinishing(index, f.id)} className="text-red-400 hover:text-red-300 transition-colors p-1">&times;</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── SFG / Assets Section ── */}
                    {isSFGComponent && (
                        <div className="mt-6 border-t border-amber-500/20 pt-5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">SFG / Assets</span>
                                <h3 className="text-md font-semibold text-gray-300">Inventory Stock Lines</h3>
                            </div>

                            {/* Search & Add */}
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-3">
                                <div className="relative">
                                    <Input
                                        value={sfgSearch}
                                        onChange={(e) => { setSfgSearch(e.target.value); setShowSfgSuggestions(true); }}
                                        onFocus={() => setShowSfgSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowSfgSuggestions(false), 200)}
                                        placeholder="Search SFG / Asset inventory item..."
                                        className="bg-black/30 border-amber-500/30 text-sm"
                                    />
                                    {showSfgSuggestions && (
                                        <ul className="absolute z-50 w-full bg-gray-900 border border-white/10 rounded-lg mt-1 max-h-52 overflow-y-auto shadow-2xl">
                                            {sfgInventory
                                                .filter(i => i.name.toLowerCase().includes(sfgSearch.toLowerCase()))
                                                .map(item => (
                                                    <li
                                                        key={item.id}
                                                        onClick={() => {
                                                            addSfgLine(item);
                                                            setSfgSearch('');
                                                            setShowSfgSuggestions(false);
                                                        }}
                                                        className="px-4 py-2.5 hover:bg-amber-500/10 cursor-pointer text-sm flex justify-between items-center gap-4 border-b border-white/5 last:border-0"
                                                    >
                                                        <div>
                                                            <div className="text-white font-medium">{item.name}</div>
                                                            <div className="text-[10px] text-gray-500 font-mono">{item.item_code}</div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className="text-amber-400 font-mono text-xs">{currency}{parseFloat(item.unit_cost).toFixed(4)}</div>
                                                            <div className="text-[10px] text-gray-500">Stock: {item.stock_quantity} {item.uom}</div>
                                                        </div>
                                                    </li>
                                                ))
                                            }
                                            {sfgInventory.filter(i => i.name.toLowerCase().includes(sfgSearch.toLowerCase())).length === 0 && (
                                                <li className="px-4 py-3 text-gray-500 text-sm italic">No SFG items found</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* Lines Table */}
                            {sfgLines.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-widest text-gray-500 px-2 mb-1">
                                        <span className="col-span-4">Item</span>
                                        <span className="col-span-2 text-center">Stock</span>
                                        <span className="col-span-2 text-center">Qty</span>
                                        <span className="col-span-2 text-right">Unit Price</span>
                                        <span className="col-span-1 text-right">Total</span>
                                        <span className="col-span-1"></span>
                                    </div>
                                    {sfgLines.map((line) => (
                                        <div key={line.id} className="grid grid-cols-12 gap-2 items-center bg-black/30 border border-amber-500/10 rounded-lg px-3 py-2">
                                            <div className="col-span-4">
                                                <div className="text-sm text-white font-medium truncate">{line.item_name}</div>
                                                {line.item_code && <div className="text-[10px] text-gray-500 font-mono">{line.item_code}</div>}
                                            </div>
                                            <div className="col-span-2 text-center">
                                                <span className={`text-xs font-mono ${
                                                    (line.stock_quantity || 0) <= 0 ? 'text-red-400' :
                                                    (line.stock_quantity || 0) < (line.quantity || 0) ? 'text-amber-400' : 'text-emerald-400'
                                                }`}>{line.stock_quantity ?? '–'} {line.uom}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    type="number" min="0" step="1"
                                                    value={line.quantity}
                                                    onChange={e => updateSfgLine(line.id, 'quantity', e.target.value)}
                                                    className="bg-black/40 border-white/10 text-center text-sm h-8 py-1"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <Input
                                                    type="number" min="0" step="0.0001"
                                                    value={line.unit_price}
                                                    onChange={e => updateSfgLine(line.id, 'unit_price', e.target.value)}
                                                    className="bg-black/40 border-white/10 text-right text-sm h-8 py-1"
                                                />
                                            </div>
                                            <div className="col-span-1 text-right">
                                                <span className="text-sm text-amber-300 font-mono">
                                                    {currency}{(parseFloat(line.total_price) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="col-span-1 flex justify-end">
                                                <button onClick={() => removeSfgLine(line.id)} className="text-red-400 hover:text-red-300 transition-colors p-1" title="Remove">&times;</button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center px-3 pt-2 border-t border-amber-500/20">
                                        <span className="text-xs text-amber-400/70 uppercase tracking-widest">SFG Subtotal</span>
                                        <span className="text-sm font-bold text-amber-300 font-mono">
                                            {currency}{sfgLines.reduce((a, l) => a + (parseFloat(l.total_price) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-6 text-gray-600 italic text-sm border border-dashed border-amber-500/15 rounded-xl">
                                    No SFG/Asset items added yet — search above to add stock lines
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Calculation Stats */}
                <div className="lg:col-span-1 border-white/10 lg:pl-6 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Calculation</h4>
                    {calculationResult ? (
                        <div className="space-y-4 text-sm">
                            {type === 'offset' && (
                                <>
                                    <div className="bg-white/5 p-3 rounded space-y-2">
                                        <div className="flex justify-between text-gray-300">
                                            <span>Impressions:</span>
                                            <span className="font-mono text-white text-right">
                                                {calculationResult.printedSheets.toLocaleString()}
                                                {calculationResult.customImpressions && (
                                                    <span className="text-xs text-blue-400 ml-1.5 font-sans">(Custom)</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-gray-300"><span>Plate Count:</span> <span className="font-mono text-white">{calculationResult.plateCount.toLocaleString()}</span></div>
                                        <div className="flex justify-between text-gray-300"><span>Printed Sheets:</span> <span className="font-mono text-white">{parseFloat(calculationResult.cutSheets).toFixed(0)}</span></div>
                                        <div className="flex justify-between text-gray-300">
                                            <span>Wastage Sheets:</span>
                                            <span className="font-mono text-white text-right">
                                                {calculationResult.wastageSheets.toLocaleString()}
                                                {calculationResult.customWastageSheets != null && (
                                                    <span className="text-xs text-blue-400 ml-1.5 font-sans">(Custom)</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-gray-300 border-t border-white/10 pt-2"><span>Total Sheets:</span> <span className="font-mono font-bold text-white">{calculationResult.totalSheetsRequired.toLocaleString()}</span></div>
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <div className="flex justify-between text-gray-400"><span>Paper Cost:</span> <span>{currency}{(calculationResult.costs.paper || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                        <div className="flex justify-between text-gray-400"><span>Plate Cost:</span> <span>{currency}{(calculationResult.costs.plate || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                        <div className="flex justify-between text-gray-400"><span>Print Cost:</span> <span>{currency}{(calculationResult.costs.printing || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                    </div>
                                </>
                            )}
                            {type === 'digital' && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-gray-400"><span>Papers Used:</span> <span className="font-mono text-white">{calculationResult.printedSheets}</span></div>
                                    <div className="flex justify-between text-gray-400"><span>Paper Cost:</span> <span>{currency}{(calculationResult.costs.paper || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                    <div className="flex justify-between text-gray-400"><span>Print Cost:</span> <span>{currency}{(calculationResult.costs.printing || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                </div>
                            )}

                            <div className="flex justify-between text-gray-400 pt-2 border-t border-white/10"><span>Finishings:</span> <span>{currency}{(calculationResult.costs.finishing || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                            <div className="flex justify-between text-white font-bold pt-2 border-t border-white/20 text-lg">
                                <span>Subtotal:</span>
                                <span>{currency}{calculationResult.costs.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            {calculationResult.time && calculationResult.time.total > 0 && (
                                <div className="mt-2 pt-2 border-t border-white/10 space-y-1 text-xs">
                                    {calculationResult.time.printing > 0 && (
                                        <div className="flex justify-between text-gray-400">
                                            <span>Printing Time:</span>
                                            <span>{calculationResult.time.printing.toFixed(2)} Hrs</span>
                                        </div>
                                    )}
                                    {calculationResult.time.finishing > 0 && (
                                        <div className="flex justify-between text-gray-400">
                                            <span>Finishing Time:</span>
                                            <span>{calculationResult.time.finishing.toFixed(2)} Hrs</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-blue-300 font-semibold pt-1">
                                        <span>Total Time:</span>
                                        <span>{calculationResult.time.total.toFixed(2)} Hrs</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 py-8 italic text-xs">
                            Update details and click Calculate to see breakdown.
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
