'use client';
import { useState, useEffect } from 'react';
import { FiClock } from 'react-icons/fi';
import { LuCalculator } from 'react-icons/lu';

/**
 * Safely evaluates math expressions like 1.5*60, 45+30, 2*60+15, 120/2.
 */
export function evaluateTimeExpression(input) {
    if (input == null) return null;
    const str = String(input).trim();
    if (!str) return null;

    // Strip characters that are not digits, basic operators, decimal point, parentheses, or whitespace
    const clean = str.replace(/[^0-9+\-*/().\s]/g, '').trim();
    if (!clean) return null;

    try {
        const result = new Function(`"use strict"; return (${clean});`)();
        if (typeof result === 'number' && !isNaN(result) && isFinite(result) && result >= 0) {
            return Math.round(result * 100) / 100;
        }
    } catch {
        // Safe fallback if syntax is incomplete while typing
    }
    return null;
}

export function formatMinutesToDuration(totalMinutes) {
    if (totalMinutes == null || isNaN(totalMinutes) || totalMinutes < 0) return '';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

export default function EstimatedTimeInput({
    value = '',
    onChange,
    label = 'Estimated Time',
    showPresets = true,
    compact = false,
    className = ''
}) {
    const [rawInput, setRawInput] = useState(value != null ? String(value) : '');
    const [hrs, setHrs] = useState('');
    const [mins, setMins] = useState('');

    const evaluated = evaluateTimeExpression(rawInput);

    // Sync hr and min converters whenever rawInput changes
    useEffect(() => {
        const total = evaluateTimeExpression(rawInput);
        if (total !== null && total >= 0) {
            const h = Math.floor(total / 60);
            const m = Math.round(total % 60);
            setHrs(h > 0 ? String(h) : '');
            setMins(m > 0 ? String(m) : (h === 0 && total === 0 ? '0' : ''));
        } else if (!rawInput) {
            setHrs('');
            setMins('');
        }
    }, [rawInput]);

    // Handle typing or calculations in raw expression field
    const handleRawChange = (val) => {
        setRawInput(val);
        const evald = evaluateTimeExpression(val);
        if (onChange) {
            onChange(evald !== null ? String(evald) : val);
        }
    };

    // Handle typing in Hr / Min converter inputs
    const handleHrMinChange = (newHrStr, newMinStr) => {
        setHrs(newHrStr);
        setMins(newMinStr);

        const h = parseFloat(newHrStr) || 0;
        const m = parseFloat(newMinStr) || 0;
        const total = Math.round((h * 60 + m) * 100) / 100;
        const resultStr = total > 0 ? String(total) : '';

        setRawInput(resultStr);
        if (onChange) {
            onChange(resultStr);
        }
    };

    const presets = [
        { label: '15m', mins: 15 },
        { label: '30m', mins: 30 },
        { label: '45m', mins: 45 },
        { label: '1h', mins: 60 },
        { label: '1.5h', mins: 90 },
        { label: '2h', mins: 120 },
        { label: '3h', mins: 180 },
        { label: '4h', mins: 240 },
    ];

    if (compact) {
        return (
            <div className={`space-y-1.5 ${className}`}>
                <div className="flex items-center justify-between">
                    {label && <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>}
                    {evaluated !== null && (
                        <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            = {evaluated}m {formatMinutesToDuration(evaluated) && `(${formatMinutesToDuration(evaluated)})`}
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    <input
                        type="text"
                        value={rawInput}
                        onChange={e => handleRawChange(e.target.value)}
                        placeholder="Minutes / math (e.g. 1.5*60)"
                        className="col-span-2 bg-black border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg px-1.5">
                        <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={hrs}
                            onChange={e => handleHrMinChange(e.target.value, mins)}
                            className="w-full bg-transparent text-[11px] text-white font-mono outline-none text-right pr-0.5"
                        />
                        <span className="text-[9px] text-gray-500 font-bold">h</span>
                        <input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="0"
                            value={mins}
                            onChange={e => handleHrMinChange(hrs, e.target.value)}
                            className="w-full bg-transparent text-[11px] text-white font-mono outline-none text-right pr-0.5 ml-1"
                        />
                        <span className="text-[9px] text-gray-500 font-bold">m</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-2.5 ${className}`}>
            {label && (
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <FiClock className="text-amber-400 w-3.5 h-3.5" /> {label}
                    </label>
                    {evaluated !== null && (
                        <span className="text-xs font-mono text-amber-300 font-bold bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-lg shadow-sm">
                            = {evaluated} mins {formatMinutesToDuration(evaluated) && `(${formatMinutesToDuration(evaluated)})`}
                        </span>
                    )}
                </div>
            )}

            {/* Calculations input */}
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <LuCalculator className="w-3.5 h-3.5" />
                </div>
                <input
                    type="text"
                    value={rawInput}
                    onChange={e => handleRawChange(e.target.value)}
                    placeholder="Type total minutes or math (e.g. 1.5*60, 45+30, 2*60+15)"
                    className="w-full bg-black/60 border border-white/15 rounded-xl pl-9 pr-4 py-2 text-xs text-white font-mono placeholder:text-gray-500 focus:outline-none focus:border-amber-500 transition-all shadow-inner"
                />
            </div>

            {/* Hr and Min converters */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-2.5">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Converter</span>
                    <span className="text-[9px] text-gray-500 font-normal">Hours &amp; Minutes</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500/50">
                        <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={hrs}
                            onChange={e => handleHrMinChange(e.target.value, mins)}
                            className="w-full bg-transparent text-xs text-white font-mono outline-none text-right pr-1"
                        />
                        <span className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider pl-1">hr</span>
                    </div>
                    <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500/50">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            placeholder="0"
                            value={mins}
                            onChange={e => handleHrMinChange(hrs, e.target.value)}
                            className="w-full bg-transparent text-xs text-white font-mono outline-none text-right pr-1"
                        />
                        <span className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider pl-1">min</span>
                    </div>
                </div>
            </div>

            {/* Quick Presets */}
            {showPresets && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {presets.map(p => (
                        <button
                            key={p.label}
                            type="button"
                            onClick={() => handleRawChange(String(p.mins))}
                            className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                evaluated === p.mins
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-sm'
                                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
