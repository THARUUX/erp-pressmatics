'use client';
import { useState, useEffect } from 'react';

/* ─── Module-level singleton (like react-hot-toast) ───────────────────────── */
let _resolve = null;
let _setState = null;

/**
 * Drop-in async replacement for window.confirm().
 * Call from any async event handler:
 *   if (!(await confirmDialog('Delete this?', { danger: true, confirmLabel: 'Delete' }))) return;
 */
export function confirmDialog(message, options = {}) {
    return new Promise((resolve) => {
        _resolve = resolve;
        if (_setState) _setState({ message, ...options });
    });
}

/* ─── Container – mount once in dashboard layout ──────────────────────────── */
export function ConfirmDialogContainer() {
    const [state, setState] = useState(null);

    useEffect(() => {
        _setState = (s) => setState(s);
        return () => { _setState = null; };
    }, []);

    const handleClose = (result) => {
        if (_resolve) { _resolve(result); _resolve = null; }
        setState(null);
    };

    if (!state) return null;

    return (
        <div
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-md flex items-center justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(false); }}
        >
            <div className="bg-[#0f0f0f]/95 border border-white/10 rounded-2xl p-7 max-w-[420px] w-[90%] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-[fadeUp_0.18s_ease]">
                {state.title && (
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{state.title}</p>
                )}
                <p className="text-white text-[15px] mb-6 leading-relaxed">{state.message}</p>
                <div className="flex gap-2.5 justify-end">
                    <button
                        onClick={() => handleClose(false)}
                        className="px-5 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-[#aaa] text-sm transition-colors hover:bg-white/10"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleClose(true)}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            state.danger
                                ? 'bg-red-500/80 text-white hover:bg-red-500'
                                : 'bg-white/90 text-black hover:bg-white'
                        }`}
                    >
                        {state.confirmLabel || 'Confirm'}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(12px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
