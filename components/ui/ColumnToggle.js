'use client';

import { useState, useRef, useEffect } from 'react';
import { FiColumns, FiCheck } from 'react-icons/fi';

/**
 * Drop-in column visibility toggle for any TanStack table instance.
 * Usage:
 *   <ColumnToggle table={table} />
 */
export function ColumnToggle({ table }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleable = table.getAllLeafColumns().filter(col => col.getCanHide());
    const visibleCount = toggleable.filter(col => col.getIsVisible()).length;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm border transition-colors ${
                    open
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
                title="Toggle columns"
            >
                <FiColumns className="w-4 h-4" />
                <span className="hidden sm:inline">Columns</span>
                <span className="bg-white/10 text-xs px-1.5 py-0.5 rounded-full tabular-nums">
                    {visibleCount}/{toggleable.length}
                </span>
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] p-2 min-w-[180px] animate-[fadeUp_0.14s_ease]">
                    {/* All / None shortcuts */}
                    <div className="flex gap-1 mb-2 px-1">
                        <button
                            onClick={() => table.toggleAllColumnsVisible(true)}
                            className="flex-1 text-xs py-1 px-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            All
                        </button>
                        <button
                            onClick={() => table.toggleAllColumnsVisible(false)}
                            className="flex-1 text-xs py-1 px-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            None
                        </button>
                    </div>

                    <div className="border-t border-white/[0.06] mb-1" />

                    {toggleable.map(col => {
                        const isVisible = col.getIsVisible();
                        return (
                            <label
                                key={col.id}
                                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white/[0.05] transition-colors group"
                            >
                                <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={col.getToggleVisibilityHandler()}
                                    className="sr-only"
                                />
                                {/* Custom checkbox */}
                                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                    isVisible
                                        ? 'bg-white border-white'
                                        : 'bg-transparent border-white/20 group-hover:border-white/40'
                                }`}>
                                    {isVisible && <FiCheck className="w-2.5 h-2.5 text-black stroke-[3]" />}
                                </span>
                                <span className={`text-sm capitalize transition-colors ${isVisible ? 'text-white' : 'text-gray-500'}`}>
                                    {typeof col.columnDef.header === 'string'
                                        ? col.columnDef.header
                                        : col.id}
                                </span>
                            </label>
                        );
                    })}
                </div>
            )}

            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
