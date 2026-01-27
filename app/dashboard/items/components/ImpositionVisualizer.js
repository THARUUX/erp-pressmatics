'use client';
import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiMaximize2, FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function ImpositionVisualizer({ ups = 1 }) {
    const [expanded, setExpanded] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Determine grid layout
    const { cols, rows } = useMemo(() => {
        const u = parseInt(ups) || 1;
        if (u === 1) return { cols: 1, rows: 1 };
        let bestR = 1;
        for (let r = 1; r <= Math.sqrt(u); r++) {
            if (u % r === 0) {
                bestR = r;
            }
        }
        return { cols: u / bestR, rows: bestR };
    }, [ups]);

    const GridDisplay = ({ isLarge = false }) => (
        <div
            className={`w-full aspect-[1.414/1] bg-gray-200 relative shadow-lg rounded-sm overflow-hidden ${isLarge ? 'max-w-4xl' : ''}`}
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: isLarge ? '4px' : '2px',
                padding: isLarge ? '8px' : '4px'
            }}
        >
            {Array.from({ length: parseInt(ups) || 1 }).map((_, i) => (
                <div
                    key={i}
                    className={`relative bg-white flex items-center justify-center font-mono overflow-hidden text-gray-300 ${isLarge ? 'text-lg' : 'text-[10px]'}`}
                >
                    <div className="absolute inset-[2px] border border-blue-200 bg-blue-50/50 flex items-center justify-center">
                        <div className={`absolute border border-dashed border-red-300 opacity-60 ${isLarge ? 'inset-1' : 'inset-0'}`}></div>
                        <span>{i + 1}</span>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <>
            <div
                onClick={() => setExpanded(true)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col items-center justify-center relative group cursor-pointer hover:bg-white/10 transition-colors"
            >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <FiMaximize2 className="text-gray-400" />
                </div>
                <div className="text-xs text-gray-400 mb-2 w-full flex justify-between uppercase tracking-wider">
                    <span>Imposition Plan</span>
                    <span>{cols}x{rows} Layout</span>
                </div>

                <GridDisplay />

                <div className="w-full mt-3 flex justify-between text-[10px] text-gray-500">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-50 border border-blue-200"></div> Page</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 border border-dashed border-red-300"></div> Bleed</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 bg-gray-200"></div> Waste</div>
                </div>
            </div>

            {/* Modal Overlay via Portal */}
            {mounted && createPortal(
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-8"
                            onClick={() => setExpanded(false)}
                        >
                            <button onClick={() => setExpanded(false)} className="absolute top-8 right-8 text-white hover:text-gray-300 p-2 text-2xl z-50">
                                <FiX />
                            </button>

                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="w-full max-w-5xl flex flex-col items-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h2 className="text-2xl text-white font-bold mb-4">{cols}x{rows} Imposition Layout</h2>
                                <GridDisplay isLarge={true} />
                                <div className="mt-6 flex gap-8 text-gray-400">
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-50 border border-blue-200"></div> Finished Page</div>
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 border border-dashed border-red-300"></div> Bleed Margin</div>
                                    <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-200"></div> Cut Sheet Waste</div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
