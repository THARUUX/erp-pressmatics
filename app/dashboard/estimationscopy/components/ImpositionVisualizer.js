'use client';
import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiMaximize2, FiX, FiCheckCircle, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function ImpositionVisualizer({
    ups = 1,
    sheetWidthCm,
    sheetHeightCm,
    paperWidthCm,
    paperHeightCm,
    compWidthCm,
    compHeightCm,
    bleedMm
}) {
    const [expanded, setExpanded] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [orientationOverride, setOrientationOverride] = useState(null); // 'standard', 'rotated', or null (auto)

    useEffect(() => {
        setMounted(true);
    }, []);

    // Calculate layout parameters and grid arrangement
    // Replace the internal logic of your useMemo hook with this optimized calculation engine:
    const layout = useMemo(() => {
        const W = parseFloat(sheetWidthCm || paperWidthCm) || 59.4; // Updated default to your A1 Width
        const H = parseFloat(sheetHeightCm || paperHeightCm) || 84.1; // Updated default to your A1 Height
        const cW = parseFloat(compWidthCm) || 14.8;  // Updated default to your A5 Width
        const cH = parseFloat(compHeightCm) || 21.0;  // Updated default to your A5 Height
        const bleed = (parseFloat(bleedMm) != null ? parseFloat(bleedMm) : 3.0) / 10; // convert mm to cm
        const safeUps = Math.max(1, parseInt(ups) || 1);

        const itemW = cW + (2 * bleed);
        const itemH = cH + (2 * bleed);

        // Structural orientations to test
        const options = [
            { name: 'Standard', itemW, itemH, compW: cW, compH: cH, rotated: false },
            { name: 'Rotated (90°)', itemW: itemH, itemH: itemW, compW: cH, compH: cW, rotated: true }
        ];

        let best = null;
        let bestScore = -Infinity;

        for (const opt of options) {
            // Strategy: Test varying column limits to see which configuration packs sequentially best
            for (let cols = 1; cols <= safeUps; cols++) {
                let totalWidthNeeded = 0;
                let totalHeightNeeded = 0;
                let totalOverflowAmount = 0;
                let fits = true;

                // Calculate exact placements dynamically instead of judging by a perfect square bounding box
                for (let i = 0; i < safeUps; i++) {
                    const colIdx = i % cols;
                    const rowIdx = Math.floor(i / cols);

                    const itemRightEdge = (colIdx + 1) * opt.itemW;
                    const itemBottomEdge = (rowIdx + 1) * opt.itemH;

                    // Track true actual boundaries used by the active items
                    if (itemRightEdge > totalWidthNeeded) totalWidthNeeded = itemRightEdge;
                    if (itemBottomEdge > totalHeightNeeded) totalHeightNeeded = itemBottomEdge;

                    // Check if this specific item clips out of the physical paper dimensions
                    if (itemRightEdge > W || itemBottomEdge > H) {
                        fits = false;
                        const overW = Math.max(0, itemRightEdge - W);
                        const overH = Math.max(0, itemBottomEdge - H);
                        totalOverflowAmount += (overW + overH);
                    }
                }

                // Scoring system: Prioritize fitting, then penalize excessive footprint/waste
                let score = 0;
                if (fits) {
                    // If it fits, score it higher if it leaves compact, usable remnants on the sheet
                    score = 10000 - (totalWidthNeeded * totalHeightNeeded);
                } else {
                    // If it overflows, penalize strictly based on the exact amount of clipping space
                    score = -10000 - (totalOverflowAmount * 100);
                }

                if (best === null || score > bestScore) {
                    bestScore = score;
                    best = {
                        ...opt,
                        cols,
                        rows: Math.ceil(safeUps / cols),
                        gridW: totalWidthNeeded,
                        gridH: totalHeightNeeded,
                        fits
                    };
                }
            }
        }

        // Manual override handling
        if (orientationOverride) {
            const opt = options.find(o => o.name.toLowerCase().includes(orientationOverride));
            if (opt) {
                let bestForOpt = null;
                let bestScoreForOpt = -Infinity;

                for (let cols = 1; cols <= safeUps; cols++) {
                    let totalWidthNeeded = 0;
                    let totalHeightNeeded = 0;
                    let fits = true;

                    for (let i = 0; i < safeUps; i++) {
                        const colIdx = i % cols;
                        const rowIdx = Math.floor(i / cols);
                        const itemRightEdge = (colIdx + 1) * opt.itemW;
                        const itemBottomEdge = (rowIdx + 1) * opt.itemH;

                        if (itemRightEdge > totalWidthNeeded) totalWidthNeeded = itemRightEdge;
                        if (itemBottomEdge > totalHeightNeeded) totalHeightNeeded = itemBottomEdge;
                        if (itemRightEdge > W || itemBottomEdge > H) fits = false;
                    }

                    let score = fits ? (10000 - (totalWidthNeeded * totalHeightNeeded)) : -10000;

                    if (bestForOpt === null || score > bestScoreForOpt) {
                        bestScoreForOpt = score;
                        bestForOpt = {
                            ...opt,
                            cols,
                            rows: Math.ceil(safeUps / cols),
                            gridW: totalWidthNeeded,
                            gridH: totalHeightNeeded,
                            fits
                        };
                    }
                }
                if (bestForOpt) best = bestForOpt;
            }
        }

        const singleCompArea = cW * cH;
        const totalCompArea = safeUps * singleCompArea;
        const sheetArea = W * H;
        const utilizationPercent = Math.min(100, (totalCompArea / sheetArea) * 100);
        const wastePercent = 100 - utilizationPercent;

        return {
            W, H, cW, cH, bleed,
            utilizationPercent,
            wastePercent,
            autoSelectedName: best ? best.name : 'Standard',
            ...best
        };
    }, [sheetWidthCm, sheetHeightCm, paperWidthCm, paperHeightCm, compWidthCm, compHeightCm, bleedMm, ups, orientationOverride]);

    const GridSVGDisplay = ({ isLarge = false }) => {
        const svgW = isLarge ? 800 : 450;
        const svgH = isLarge ? 500 : 300;

        const { W, H, cols, rows, itemW, itemH, compW, compH, bleed, fits } = layout;

        // Calculate scale factor to fit paper sheet inside SVG viewport with 50px margins
        const padding = isLarge ? 60 : 40;
        const scaleX = (svgW - padding * 2) / W;
        const scaleY = (svgH - padding * 2) / H;
        const scale = Math.min(scaleX, scaleY);

        const renderedW = W * scale;
        const renderedH = H * scale;

        const offsetX = (svgW - renderedW) / 2;
        const offsetY = (svgH - renderedH) / 2;

        // Grid coordinates centered on paper sheet
        const gridW = cols * itemW;
        const gridH = rows * itemH;
        const renderedGridW = gridW * scale;
        const renderedGridH = gridH * scale;

        const gridX = offsetX + (renderedW - renderedGridW) / 2;
        const gridY = offsetY + (renderedH - renderedGridH) / 2;

        return (
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="bg-white/5 border border-white/5 rounded-lg select-none"
            >
                <defs>
                    {/* Diagonal stripes warning pattern for overflow */}
                    <pattern id="warningPattern" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="3" />
                    </pattern>
                    {/* Finished comp background gradient */}
                    <linearGradient id="compGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(59, 130, 246, 0.25)" />
                        <stop offset="100%" stopColor="rgba(37, 99, 235, 0.1)" />
                    </linearGradient>
                </defs>

                {/* 1. Paper Sheet Background */}
                <rect
                    x={offsetX}
                    y={offsetY}
                    width={renderedW}
                    height={renderedH}
                    fill="rgba(255, 255, 255, 0.05)"
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth="1.5"
                    rx="3"
                />

                {/* Grid watermark inside sheet */}
                <g opacity="0.15">
                    {Array.from({ length: 10 }).map((_, idx) => (
                        <line
                            key={`grid-x-${idx}`}
                            x1={offsetX + (renderedW / 10) * idx}
                            y1={offsetY}
                            x2={offsetX + (renderedW / 10) * idx}
                            y2={offsetY + renderedH}
                            stroke="white"
                            strokeWidth="0.5"
                        />
                    ))}
                    {Array.from({ length: 10 }).map((_, idx) => (
                        <line
                            key={`grid-y-${idx}`}
                            x1={offsetX}
                            y1={offsetY + (renderedH / 10) * idx}
                            x2={offsetX + renderedW}
                            y2={offsetY + (renderedH / 10) * idx}
                            stroke="white"
                            strokeWidth="0.5"
                        />
                    ))}
                </g>

                {/* 2. Paper Sheet Dimensions */}
                {/* Horizontal width arrow */}
                <g stroke="rgba(156, 163, 175, 0.6)" strokeWidth="1">
                    <line x1={offsetX} y1={offsetY - 15} x2={offsetX + renderedW} y2={offsetY - 15} />
                    <line x1={offsetX} y1={offsetY - 20} x2={offsetX} y2={offsetY - 10} />
                    <line x1={offsetX + renderedW} y1={offsetY - 20} x2={offsetX + renderedW} y2={offsetY - 10} />
                </g>
                <text
                    x={offsetX + renderedW / 2}
                    y={offsetY - 25}
                    fill="#9ca3af"
                    textAnchor="middle"
                    className="text-[10px] font-medium font-mono"
                >
                    {W.toFixed(1)} cm
                </text>

                {/* Vertical height arrow */}
                <g stroke="rgba(156, 163, 175, 0.6)" strokeWidth="1">
                    <line x1={offsetX - 15} y1={offsetY} x2={offsetX - 15} y2={offsetY + renderedH} />
                    <line x1={offsetX - 20} y1={offsetY} x2={offsetX - 10} y2={offsetY} />
                    <line x1={offsetX - 20} y1={offsetY + renderedH} x2={offsetX - 10} y2={offsetY + renderedH} />
                </g>
                <text
                    x={offsetX - 25}
                    y={offsetY + renderedH / 2}
                    fill="#9ca3af"
                    textAnchor="middle"
                    transform={`rotate(-90 ${offsetX - 25} ${offsetY + renderedH / 2})`}
                    className="text-[10px] font-medium font-mono"
                >
                    {H.toFixed(1)} cm
                </text>

                {/* 3. Grid of Ups */}
                {Array.from({ length: ups }).map((_, i) => {
                    const colIdx = i % cols;
                    const rowIdx = Math.floor(i / cols);

                    const cellX = gridX + colIdx * itemW * scale;
                    const cellY = gridY + rowIdx * itemH * scale;
                    const cellW = itemW * scale;
                    const cellH = itemH * scale;

                    // Check if this particular cell is overflowed outside paper sheet
                    const cellOverflow =
                        cellX + cellW > offsetX + renderedW + 0.1 ||
                        cellY + cellH > offsetY + renderedH + 0.1 ||
                        cellX < offsetX - 0.1 ||
                        cellY < offsetY - 0.1;

                    // Inset finished dimensions
                    const finX = cellX + bleed * scale;
                    const finY = cellY + bleed * scale;
                    const finW = compW * scale;
                    const finH = compH * scale;

                    return (
                        <g key={`up-${i}`} className="transition-all duration-300">
                            {/* Outer boundary representing cut sheet size (including bleed) */}
                            <rect
                                x={cellX}
                                y={cellY}
                                width={cellW}
                                height={cellH}
                                fill={cellOverflow ? "url(#warningPattern)" : "rgba(255, 255, 255, 0.01)"}
                                stroke="rgba(255, 255, 255, 0.05)"
                                strokeWidth="0.5"
                            />

                            {/* Bleed line (dashed) */}
                            <rect
                                x={cellX}
                                y={cellY}
                                width={cellW}
                                height={cellH}
                                fill="none"
                                stroke={cellOverflow ? "rgba(239, 68, 68, 0.6)" : "rgba(245, 158, 11, 0.4)"}
                                strokeWidth="0.75"
                                strokeDasharray="3,3"
                            />

                            {/* Finished composition area */}
                            <rect
                                x={finX}
                                y={finY}
                                width={finW}
                                height={finH}
                                fill="url(#compGradient)"
                                stroke={cellOverflow ? "#ef4444" : "#3b82f6"}
                                strokeWidth="1"
                                rx="1"
                            />

                            {/* Up index text */}
                            <text
                                x={finX + finW / 2}
                                y={finY + finH / 2 + 4}
                                fill={cellOverflow ? "#fca5a5" : "#93c5fd"}
                                textAnchor="middle"
                                className="font-bold font-mono text-[11px]"
                            >
                                Up {i + 1}
                            </text>

                            {/* Crop/Bleed Marks at corners of finished bounds */}
                            {/* Top-left crop mark */}
                            <path
                                d={`M ${finX} ${finY - 5} L ${finX} ${finY - 12} M ${finX - 5} ${finY} L ${finX - 12} ${finY}`}
                                stroke={cellOverflow ? "rgba(239, 68, 68, 0.7)" : "rgba(255, 255, 255, 0.4)"}
                                strokeWidth="0.75"
                            />
                            {/* Top-right crop mark */}
                            <path
                                d={`M ${finX + finW} ${finY - 5} L ${finX + finW} ${finY - 12} M ${finX + finW + 5} ${finY} L ${finX + finW + 12} ${finY}`}
                                stroke={cellOverflow ? "rgba(239, 68, 68, 0.7)" : "rgba(255, 255, 255, 0.4)"}
                                strokeWidth="0.75"
                            />
                            {/* Bottom-left crop mark */}
                            <path
                                d={`M ${finX} ${finY + finH + 5} L ${finX} ${finY + finH + 12} M ${finX - 5} ${finY + finH} L ${finX - 12} ${finY + finH}`}
                                stroke={cellOverflow ? "rgba(239, 68, 68, 0.7)" : "rgba(255, 255, 255, 0.4)"}
                                strokeWidth="0.75"
                            />
                            {/* Bottom-right crop mark */}
                            <path
                                d={`M ${finX + finW} ${finY + finH + 5} L ${finX + finW} ${finY + finH + 12} M ${finX + finW + 5} ${finY + finH} L ${finX + fillW + 12} ${finY + finH}`}
                                stroke={cellOverflow ? "rgba(239, 68, 68, 0.7)" : "rgba(255, 255, 255, 0.4)"}
                                strokeWidth="0.75"
                            />

                            {/* Dimension indicators on the first item */}
                            {i === 0 && (
                                <>
                                    {/* Finished comp width label inside */}
                                    <text
                                        x={finX + finW / 2}
                                        y={finY + 12}
                                        fill="rgba(255, 255, 255, 0.45)"
                                        textAnchor="middle"
                                        className="text-[8px] font-sans font-medium"
                                    >
                                        {compW.toFixed(1)} cm
                                    </text>
                                    {/* Finished comp height label inside */}
                                    <text
                                        x={finX + 8}
                                        y={finY + finH / 2}
                                        fill="rgba(255, 255, 255, 0.45)"
                                        textAnchor="start"
                                        className="text-[8px] font-sans font-medium"
                                        transform={`rotate(-90 ${finX + 8} ${finY + finH / 2})`}
                                    >
                                        {compH.toFixed(1)} cm
                                    </text>
                                </>
                            )}
                        </g>
                    );
                })}

                {/* 4. Overlay if whole layout does not fit */}
                {!fits && (
                    <rect
                        x={offsetX}
                        y={offsetY}
                        width={renderedW}
                        height={renderedH}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                        className="animate-pulse"
                    />
                )}
            </svg>
        );
    };

    return (
        <>
            <div className="w-full bg-white/60 backdrop-blur-xl border border-white/10 rounded-xl p-5 shadow-2xl relative">
                {/* Visualizer Header */}
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h4 className="text-sm font-bold text-gray-200 tracking-wide uppercase">Imposition Planner</h4>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{layout.cols}x{layout.rows} Grid ({layout.rotated ? 'Rotated' : 'Standard'})</p>
                    </div>

                    <div className="flex gap-2">
                        {/* Orientation toggles */}
                        <div className="bg-black/50 border border-white/10 rounded-lg p-0.5 flex">
                            <button
                                type="button"
                                onClick={() => setOrientationOverride(orientationOverride === 'standard' ? null : 'standard')}
                                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                                    orientationOverride === 'standard'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                                title="Force standard portrait layout"
                            >
                                Std
                            </button>
                            <button
                                type="button"
                                onClick={() => setOrientationOverride(orientationOverride === 'rotated' ? null : 'rotated')}
                                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                                    orientationOverride === 'rotated'
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                                title="Force rotated landscape layout"
                            >
                                Rot
                            </button>
                        </div>

                        {/* Maximize Button */}
                        <button
                            type="button"
                            onClick={() => setExpanded(true)}
                            className="bg-white/5 border border-white/10 p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <FiMaximize2 className="text-sm" />
                        </button>
                    </div>
                </div>

                {/* SVG Visualizer Container */}
                <div className="w-full aspect-[1.5/1] relative mb-4">
                    <GridSVGDisplay />
                </div>

                {/* Performance / Plan Details */}
                <div className="grid grid-cols-3 gap-2 bg-black/40 border border-white/10 rounded-lg p-3 text-center mb-1">
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">Utilization</div>
                        <div className={`text-sm font-bold mt-0.5 ${layout.fits ? 'text-emerald-400' : 'text-yellow-400'}`}>
                            {layout.utilizationPercent.toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">Waste</div>
                        <div className="text-sm font-bold text-gray-300 mt-0.5">
                            {layout.wastePercent.toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">Bleed</div>
                        <div className="text-sm font-bold text-amber-500 mt-0.5">
                            {parseFloat(bleedMm || 3).toFixed(1)} mm
                        </div>
                    </div>
                </div>

                {/* Error/Warning Notifications */}
                {!layout.fits && (
                    <div className="mt-3 flex items-start gap-2 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded-lg p-2.5">
                        <FiAlertTriangle className="text-red-400 shrink-0 mt-0.5 text-sm" />
                        <div>
                            <span className="font-semibold text-red-200">Layout Overflows Paper Sheet</span>
                            <p className="text-[11px] text-red-400 mt-0.5">The required imposition grid dimensions ({(layout.gridW || 0).toFixed(1)} x {(layout.gridH || 0).toFixed(1)} cm) exceed sheet boundaries. Adjust size or layout.</p>
                        </div>
                    </div>
                )}
                {layout.fits && (
                    <div className="mt-3 flex items-center gap-2 bg-emerald-950/30 border border-emerald-500/10 text-emerald-300 text-xs rounded-lg p-2.5">
                        <FiCheckCircle className="text-emerald-400 shrink-0 text-sm" />
                        <span>Imposition sheet plan fits correctly.</span>
                    </div>
                )}
            </div>

            {/* Modal Overlay via Portal */}
            {mounted && createPortal(
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-6"
                            onClick={() => setExpanded(false)}
                        >
                            <button
                                type="button"
                                onClick={() => setExpanded(false)}
                                className="absolute top-6 right-6 bg-white/5 border border-white/10 hover:bg-white/10 text-white p-3 rounded-full text-xl z-50 transition-colors"
                            >
                                <FiX />
                            </button>

                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                className="w-full max-w-5xl bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">
                                            Interactive Imposition Specification Plan
                                        </h2>
                                        <p className="text-sm text-gray-400 mt-1">
                                            {layout.cols} columns x {layout.rows} rows arrangement with standard crop marks and bleeds.
                                        </p>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setOrientationOverride(orientationOverride === 'standard' ? null : 'standard')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                                                orientationOverride === 'standard'
                                                    ? 'bg-blue-600 border-blue-500 text-white'
                                                    : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                                            }`}
                                        >
                                            <FiRefreshCw className={orientationOverride === 'standard' ? "animate-spin" : ""} /> Standard
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOrientationOverride(orientationOverride === 'rotated' ? null : 'rotated')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                                                orientationOverride === 'rotated'
                                                    ? 'bg-blue-600 border-blue-500 text-white'
                                                    : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                                            }`}
                                        >
                                            <FiRefreshCw className={orientationOverride === 'rotated' ? "animate-spin" : ""} /> Rotated (90°)
                                        </button>
                                    </div>
                                </div>

                                <div className="w-full aspect-[1.6/1] bg-black/45 rounded-xl border border-white/5 p-4 relative">
                                    <GridSVGDisplay isLarge={true} />
                                </div>

                                <div className="grid sm:grid-cols-4 gap-4 bg-black/40 border border-white/10 rounded-xl p-4 text-center">
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-widest">Paper Area</div>
                                        <div className="text-lg font-bold text-white mt-1">
                                            {layout.W.toFixed(1)} x {layout.H.toFixed(1)} cm
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-widest">Component Size</div>
                                        <div className="text-lg font-bold text-blue-400 mt-1">
                                            {layout.cW.toFixed(1)} x {layout.cH.toFixed(1)} cm
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-widest">Bleed Area</div>
                                        <div className="text-lg font-bold text-amber-500 mt-1">
                                            +{parseFloat(bleedMm || 3).toFixed(1)} mm
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-widest">Sheet Efficiency</div>
                                        <div className={`text-lg font-bold mt-1 ${layout.fits ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {layout.utilizationPercent.toFixed(1)}%
                                        </div>
                                    </div>
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
