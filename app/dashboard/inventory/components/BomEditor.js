'use client';
import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiTrash2, FiSearch } from 'react-icons/fi';

export default function BomEditor({ bomLines, onChange }) {
    const [allItems, setAllItems] = useState([]);
    const [search, setSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        fetch('/api/inventory')
            .then(r => r.json())
            .then(d => setAllItems(Array.isArray(d) ? d : []))
            .catch(() => {});
    }, []);

    const filtered = allItems.filter(i =>
        (i.name?.toLowerCase().includes(search.toLowerCase()) ||
         i.item_code?.toLowerCase().includes(search.toLowerCase())) &&
        !bomLines.find(b => b.component_item_id === i.id)
    );

    const addLine = (item) => {
        onChange([...bomLines, {
            component_item_id: item.id,
            component_name: item.name,
            component_code: item.item_code,
            component_uom: item.uom,
            component_stock: item.stock_quantity,
            component_unit_cost: item.unit_cost,
            component_category: item.category,
            quantity: 1,
            notes: ''
        }]);
        setSearch('');
        setShowSuggestions(false);
    };

    const removeLine = (idx) => {
        onChange(bomLines.filter((_, i) => i !== idx));
    };

    const updateLine = (idx, field, val) => {
        onChange(bomLines.map((l, i) => i === idx ? { ...l, [field]: val } : l));
    };

    return (
        <div className="space-y-3">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Bill of Materials</p>

            {/* Component search */}
            <div className="relative" ref={searchRef}>
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="Search inventory to add component…"
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20"
                />
                {showSuggestions && search && filtered.length > 0 && (
                    <ul className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-56 overflow-y-auto">
                        {filtered.slice(0, 20).map(item => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onMouseDown={() => addLine(item)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/[0.06] transition-colors text-left"
                                >
                                    <span>
                                        <span className="text-white font-medium">{item.name}</span>
                                        <span className="ml-2 text-white/30 text-xs font-mono">{item.item_code}</span>
                                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">{item.category}</span>
                                    </span>
                                    <span className="text-xs text-white/30 font-mono">{item.stock_quantity} {item.uom}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* BOM lines table */}
            {bomLines.length > 0 && (
                <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-white/[0.03] border-b border-white/[0.06]">
                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-white/35 uppercase tracking-wider">Component</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-white/35 uppercase tracking-wider w-28">Qty / Unit</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-white/35 uppercase tracking-wider w-28">In Stock</th>
                                <th className="px-3 py-2 w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {bomLines.map((line, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02]">
                                    <td className="px-3 py-2">
                                        <p className="text-sm text-white font-medium">{line.component_name}</p>
                                        <p className="text-[10px] text-white/30 font-mono">{line.component_code} · {line.component_category}</p>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                min="0.0001"
                                                step="0.0001"
                                                value={line.quantity}
                                                onChange={e => updateLine(idx, 'quantity', e.target.value)}
                                                className="w-20 bg-black/40 border border-white/10 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-white/20"
                                            />
                                            <span className="text-xs text-white/30">{line.component_uom}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`font-mono text-sm ${line.component_stock <= 0 ? 'text-red-400' : 'text-white/50'}`}>
                                            {line.component_stock} {line.component_uom}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <button
                                            type="button"
                                            onClick={() => removeLine(idx)}
                                            className="p-1 text-white/20 hover:text-red-400 rounded transition-colors"
                                        >
                                            <FiTrash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {bomLines.length === 0 && (
                <div className="text-center py-6 border border-dashed border-white/[0.07] rounded-xl text-white/20 text-sm">
                    No components added yet. Search above to add BOM lines.
                </div>
            )}
        </div>
    );
}
