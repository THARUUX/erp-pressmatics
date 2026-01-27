'use client';

import { useState } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function EstimationComponentForm({
    index,
    data,
    machines,
    papers,
    finishings: availableFinishings,
    onChange, // (index, field, value)
    onRemove, // (index)
    onAddFinishing, // (index, finishingItem)
    onRemoveFinishing, // (index, finishingId)
    calculationResult, // New prop
    currency
}) {
    const { params, type, finishings: selectedFinishings } = data;

    // Local state for searches (keep UI responsive)
    const [paperSearch, setPaperSearch] = useState(params.paperName || '');
    const [showPaperSuggestions, setShowPaperSuggestions] = useState(false);

    const [finishingSearch, setFinishingSearch] = useState('');
    const [showFinishingSuggestions, setShowFinishingSuggestions] = useState(false);
    const [pendingFinishing, setPendingFinishing] = useState({
        id: null, name: '', time_per_unit: 0, unit_cost: 0,
        is_machine: false, machine_id: null, cost_unit: 'Unit', variants: [],
        speed: null, speed_unit: ''
    });
    const [selectedVariantId, setSelectedVariantId] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        onChange(index, 'params', { ...params, [name]: value });
    };

    const updateParam = (key, value) => {
        onChange(index, 'params', { ...params, [key]: value });
    };

    return (
        <section className="bg-black/40 backdrop-blur-md p-6 rounded-xl border border-white/10 mb-6 relative">
            <div className="absolute top-4 right-4 z-10">
                {index > 0 && (
                    <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-300 p-2">
                        <FiTrash2 />
                    </button>
                )}
            </div>

            <div className="mb-4 border-b border-white/10 pb-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-md font-semibold text-gray-300">Specifications</h3>
                    <div className="flex bg-black/50 rounded-lg p-1 border border-white/10">
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

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left: Input Form */}
                <div className="lg:col-span-2">
                    {type === 'offset' && (
                        <div className="grid md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Machine</label>
                                <select
                                    name="machineId"
                                    value={params.machineId}
                                    onChange={(e) => {
                                        const mId = e.target.value;
                                        const machine = machines.find(m => m.id == mId);
                                        // Update both params in one go to avoid race conditions with closure state
                                        onChange(index, 'params', {
                                            ...params,
                                            machineId: mId,
                                            plateCostPerUnit: machine ? machine.plate_cost : params.plateCostPerUnit
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
                            <div><label className="block text-sm text-gray-400 mb-1">Pages</label><Input type="number" name="pages" value={params.pages} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            <div><label className="block text-sm text-gray-400 mb-1">Ups</label><Input type="number" name="ups" value={params.ups} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Sides</label>
                                <select name="sides" value={params.sides} onChange={handleChange} className="w-full bg-secondary border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30">
                                    <option value="1">One Side</option>
                                    <option value="2">Both Sides</option>
                                </select>
                            </div>
                            <div><label className="block text-sm text-gray-400 mb-1">Colors</label><Input type="number" name="colors" value={params.colors} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            <div><label className="block text-sm text-gray-400 mb-1">Wastage %</label><Input type="number" name="wastagePercent" value={params.wastagePercent} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                        </div>
                    )}

                    {type === 'digital' && (
                        <div className="grid md:grid-cols-2 gap-4 mb-6">
                            <div><label className="block text-sm text-gray-400 mb-1">Ups</label><Input type="number" name="ups" value={params.ups} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                        </div>
                    )}

                    <h3 className="text-md font-semibold text-gray-300 mb-3 border-t border-white/10 pt-4">Materials</h3>
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                        {type === 'offset' && (
                            <>
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
                                                {papers.filter(p => p.name.toLowerCase().includes(paperSearch.toLowerCase())).map(p => (
                                                    <li key={p.id} onClick={() => {
                                                        onChange(index, 'params', { ...params, paperCostPerSheet: p.unit_cost, paperId: p.id, paperName: p.name });
                                                        setPaperSearch(p.name);
                                                        setShowPaperSuggestions(false);
                                                    }} className="px-4 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between">
                                                        <span>{p.name}</span><span>{currency}{parseFloat(p.unit_cost).toFixed(4)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                                <div><label className="block text-sm text-gray-400 mb-1">Paper Cost/Sheet</label><Input type="number" name="paperCostPerSheet" value={params.paperCostPerSheet} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Plate Cost/Unit</label><Input type="number" name="plateCostPerUnit" value={params.plateCostPerUnit} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                                <div><label className="block text-sm text-gray-400 mb-1">Impression Cost</label><Input type="number" name="impressionCostPerUnit" value={params.impressionCostPerUnit} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                            </>
                        )}
                        {type === 'digital' && (
                            <div><label className="block text-sm text-gray-400 mb-1">Click Cost</label><Input type="number" name="digitalImpressionCost" value={params.digitalImpressionCost} onChange={handleChange} className="bg-secondary border-white/10" /></div>
                        )}
                    </div>

                    <h3 className="text-md font-semibold text-gray-300 mb-3 border-t border-white/10 pt-4">Finishings</h3>
                    <div className="bg-white/5 p-4 rounded-lg mb-4 border border-white/10">
                        <div className="grid md:grid-cols-4 gap-3 mb-3">
                            <div className="md:col-span-2 relative">
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
                                                    speed_unit: f.speed_unit
                                                });
                                                setSelectedVariantId('');
                                                setShowFinishingSuggestions(false);
                                            }} className="px-3 py-2 hover:bg-white/10 cursor-pointer text-sm flex justify-between"><span>{f.name}</span><span>{currency}{f.unit_cost}</span></li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <Input type="number" value={pendingFinishing.unit_cost} onChange={(e) => setPendingFinishing(p => ({ ...p, unit_cost: parseFloat(e.target.value) || 0 }))} className="bg-secondary border-white/10 text-sm py-1.5" placeholder="Cost" />
                            <Button onClick={() => { if (!pendingFinishing.name) return; onAddFinishing(index, { ...pendingFinishing, id: Date.now() }); setFinishingSearch(''); setPendingFinishing({ id: null, name: '', unit_cost: 0, time_per_unit: 0, is_machine: false, cost_unit: 'Unit', variants: [] }); }} className="bg-white text-black text-sm py-1.5">Add</Button>
                        </div>
                        {pendingFinishing.variants && pendingFinishing.variants.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {pendingFinishing.variants.map(v => (
                                    <button key={v.id} onClick={() => { setSelectedVariantId(v.id); setPendingFinishing(p => ({ ...p, name: `${p.name.split(' - ')[0]} - ${v.name}`, unit_cost: parseFloat(v.unit_cost) })); }} className={`px-2 py-0.5 text-xs rounded border ${selectedVariantId === v.id ? 'bg-blue-600 border-blue-500' : 'border-white/20'}`}>{v.name}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        {selectedFinishings.map((f, i) => (
                            <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/10 text-sm">
                                <span>{f.name}</span>
                                <div className="flex items-center gap-3">
                                    {f.total_time > 0 && (
                                        <span className="text-blue-300 text-xs mr-2">{f.total_time.toFixed(2)} hrs</span>
                                    )}
                                    <span className="text-gray-400">{currency}{(Number(f.total_cost) || 0).toFixed(2)}</span>
                                    <button onClick={() => onRemoveFinishing(index, f.id)} className="text-red-400">&times;</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Calculation Stats */}
                <div className="lg:col-span-1 border-l border-white/10 pl-6 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Calculation</h4>
                    {calculationResult ? (
                        <div className="space-y-4 text-sm">
                            {type === 'offset' && (
                                <>
                                    <div className="bg-white/5 p-3 rounded space-y-2">
                                        <div className="flex justify-between text-gray-300"><span>Impressions:</span> <span className="font-mono text-white">{calculationResult.printedSheets}</span></div>
                                        <div className="flex justify-between text-gray-300"><span>Plate Count:</span> <span className="font-mono text-white">{calculationResult.plateCount}</span></div>
                                        <div className="flex justify-between text-gray-300"><span>Cut Sheets:</span> <span className="font-mono text-white">{parseFloat(calculationResult.cutSheets).toFixed(0)}</span></div>
                                        <div className="flex justify-between text-gray-300"><span>Wastage:</span> <span className="font-mono text-white">{calculationResult.wastageSheets}</span></div>
                                        <div className="flex justify-between text-gray-300 border-t border-white/10 pt-2"><span>Total Sheets:</span> <span className="font-mono font-bold text-white">{calculationResult.totalSheetsRequired}</span></div>
                                    </div>

                                    <div className="space-y-2 pt-2">
                                        <div className="flex justify-between text-gray-400"><span>Paper Cost:</span> <span>{currency}{calculationResult.costs.paper.toFixed(2)}</span></div>
                                        <div className="flex justify-between text-gray-400"><span>Plate Cost:</span> <span>{currency}{calculationResult.costs.plate.toFixed(2)}</span></div>
                                        <div className="flex justify-between text-gray-400"><span>Print Cost:</span> <span>{currency}{calculationResult.costs.printing.toFixed(2)}</span></div>
                                    </div>
                                </>
                            )}
                            {type === 'digital' && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-gray-400"><span>Printed Sheets:</span> <span className="font-mono text-white">{calculationResult.printedSheets}</span></div>
                                    <div className="flex justify-between text-gray-400"><span>Print Cost:</span> <span>{currency}{calculationResult.costs.printing.toFixed(2)}</span></div>
                                </div>
                            )}

                            <div className="flex justify-between text-gray-400 pt-2 border-t border-white/10"><span>Finishings:</span> <span>{currency}{calculationResult.costs.finishing.toFixed(2)}</span></div>
                            <div className="flex justify-between text-white font-bold pt-2 border-t border-white/20 text-lg">
                                <span>Subtotal:</span>
                                <span>{currency}{calculationResult.costs.total.toFixed(2)}</span>
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
