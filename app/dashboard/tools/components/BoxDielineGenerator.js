'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiBox, FiDownload, FiPrinter, FiSend, FiRefreshCw,
    FiSliders, FiCheck, FiInfo, FiLayers, FiMaximize2, FiCopy,
    FiSearch, FiGrid, FiFeather, FiDisc, FiHexagon, FiHeart, FiPackage,
    FiHelpCircle, FiEye, FiLoader, FiX
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { TEMPLATEMAKER_MODELS } from './template_models_data';
import { TemplateIconsSprite, BoxModelIcon } from './TemplateIconsSprite';

const MODEL_CATEGORIES = [
    { id: 'all', name: 'All Templates', icon: FiGrid },
    { id: 'cartons', name: 'Folding Cartons', icon: FiBox },
    { id: 'bags', name: 'Bags & Envelopes', icon: FiFeather },
    { id: 'cylindrical', name: 'Cylindrical & Cones', icon: FiDisc },
    { id: 'polygonal', name: 'Polygonal & Pyramids', icon: FiHexagon },
    { id: 'specialty', name: 'Specialty & Gift Boxes', icon: FiHeart },
];

export default function BoxDielineGenerator() {
    const router = useRouter();

    // ==========================================
    // STATE: UI & Model Selection
    // ==========================================
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [unit, setUnit] = useState('mm'); // 'mm' | 'cm' | 'inch'
    const [modelId, setModelId] = useState('cardbox');
    const [showDiagram, setShowDiagram] = useState(true);
    const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);

    const currentModel = useMemo(() => TEMPLATEMAKER_MODELS[modelId] || TEMPLATEMAKER_MODELS['cardbox'], [modelId]);

    // Model-specific parameter state dictionary
    const [paramValues, setParamValues] = useState(() => {
        const init = {};
        if (currentModel && currentModel.inputs) {
            currentModel.inputs.forEach(inp => {
                init[inp.name] = parseFloat(inp.default) || 0;
            });
        }
        return init;
    });

    // Actual generated SVG template and dimensions state
    const [generatedSvg, setGeneratedSvg] = useState('');
    const [flatWidth, setFlatWidth] = useState(0);
    const [flatHeight, setFlatHeight] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [downloadingFormat, setDownloadingFormat] = useState('');

    // Sync state when selected model changes
    useEffect(() => {
        const nextModel = TEMPLATEMAKER_MODELS[modelId];
        if (nextModel && nextModel.inputs) {
            const nextVals = {};
            nextModel.inputs.forEach(inp => {
                nextVals[inp.name] = parseFloat(inp.default) || 0;
            });
            setParamValues(nextVals);
        }
    }, [modelId]);

    // Fetch actual generated 2D dieline SVG template from API
    const fetchActualTemplate = useCallback(async () => {
        setIsLoading(true);
        try {
            const payload = {
                modelId,
                requestType: 'PREVIEW',
                params: {
                    UNITS: unit,
                    ...paramValues,
                },
            };

            const res = await fetch('/api/tools/dieline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success) {
                setGeneratedSvg(data.svg);
                if (data.widthMm) setFlatWidth(data.widthMm);
                if (data.heightMm) setFlatHeight(data.heightMm);
            } else {
                toast.error(data.error || 'Failed to generate template dieline');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [modelId, paramValues, unit]);

    // Debounced fetch whenever parameters change
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchActualTemplate();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchActualTemplate]);

    // Handle parameter value updates
    const handleParamChange = (name, val) => {
        const num = parseFloat(val) || 0;
        setParamValues(prev => ({
            ...prev,
            [name]: num
        }));
    };

    // Filtered Catalog
    const catalogList = useMemo(() => Object.values(TEMPLATEMAKER_MODELS), []);
    const filteredCatalog = useMemo(() => {
        return catalogList.filter(m => {
            const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
            const matchesQuery = !searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.desc.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesQuery;
        });
    }, [catalogList, selectedCategory, searchQuery]);

    // Export handlers
    const handleExportFile = async (fileType) => {
        setDownloadingFormat(fileType);
        try {
            const payload = {
                modelId,
                requestType: 'DOWNLOAD',
                fileType,
                params: {
                    UNITS: unit,
                    ...paramValues,
                },
            };

            const res = await fetch('/api/tools/dieline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Download failed');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dieline-${modelId}.${fileType}`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`Exported ${currentModel.title} ${fileType.toUpperCase()}!`);
        } catch (err) {
            toast.error(`Failed to export ${fileType.toUpperCase()}`);
            console.error(err);
        } finally {
            setDownloadingFormat('');
        }
    };

    const handleSendToEstimation = () => {
        const w = Math.round(flatWidth) || 200;
        const h = Math.round(flatHeight) || 150;

        const sheetData = {
            widthMm: w,
            heightMm: h,
            modelId,
            modelName: currentModel.title,
        };
        sessionStorage.setItem('pressmatics_dieline_sheet', JSON.stringify(sheetData));
        toast.success(`Flat Size (${w}x${h} mm) sent to Print Estimation!`);
        router.push('/dashboard/items?tab=estimation');
    };

    return (
        <div className="space-y-6 print:p-0 print:m-0">
            <TemplateIconsSprite />

            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl print:hidden">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                        <BoxModelIcon modelId={modelId} className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                            Packaging Box Dieline Generator
                        </h2>
                        <p className="text-xs text-gray-400">
                            Full 39+ box models with live parametric SVG dieline nets & official diagrams.
                        </p>
                    </div>
                </div>

                {/* Category Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto bg-white/5 p-1 rounded-xl border border-white/10">
                    {MODEL_CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        const active = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${active ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Template Catalog Grid */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl space-y-4 print:hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-80">
                        <FiSearch className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search 39+ box models..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                        />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                        Showing <span className="text-white font-bold">{filteredCatalog.length}</span> of {catalogList.length} Box Models
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {filteredCatalog.map(m => {
                        const active = m.id === modelId;
                        return (
                            <button
                                key={m.id}
                                onClick={() => setModelId(m.id)}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer group relative overflow-hidden ${active ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' : 'bg-white/5 hover:bg-white/10 border-white/5 text-gray-300'}`}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className={`p-1 rounded-lg border shrink-0 transition-colors ${active ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-400 group-hover:text-white group-hover:bg-white/10'}`}>
                                        <BoxModelIcon modelId={m.id} className="w-10 h-10" />
                                    </div>
                                    <span className="text-xs font-bold truncate flex-1">{m.title}</span>
                                    {active && <FiCheck className="text-emerald-400 shrink-0 w-3.5 h-3.5" />}
                                </div>
                                {/* <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">{m.desc || m.title}</p> */}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Interactive Work Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
                {/* Left Column: Official Diagram SVG & Model-Specific Inputs */}
                <div className="lg:col-span-5 space-y-4 print:hidden">
                    {/* Official Diagram SVG Card */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                <FiEye /> Parameter Diagram: {currentModel.title}
                            </h3>
                            <div className="flex items-center gap-2">
                                {showDiagram && (
                                    <button
                                        onClick={() => setIsDiagramModalOpen(true)}
                                        className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-all flex items-center gap-1 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30"
                                        title="View Enlarged Diagram"
                                    >
                                        <FiMaximize2 className="w-3 h-3" /> Enlarge
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowDiagram(!showDiagram)}
                                    className="text-xs text-gray-400 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    {showDiagram ? 'Hide' : 'Show'} Diagram
                                </button>
                            </div>
                        </div>

                        {showDiagram && currentModel.diagramSvg && (
                            <div
                                onClick={() => setIsDiagramModalOpen(true)}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40 p-3 rounded-xl flex items-center justify-center overflow-hidden max-h-[220px] relative group cursor-pointer transition-all"
                                title="Click to view enlarged diagram"
                            >
                                <div
                                    className="w-full h-full text-emerald-400 font-sans [&_svg]:max-h-[200px] [&_svg]:w-full [&_svg]:h-auto [&_path]:stroke-emerald-400/80 [&_text]:fill-emerald-400 [&_text]:font-bold"
                                    dangerouslySetInnerHTML={{ __html: currentModel.diagramSvg }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white font-semibold backdrop-blur-[1px]">
                                    <FiMaximize2 className="w-4 h-4 text-emerald-400" /> Click to Enlarge
                                </div>
                            </div>
                        )}
                        <p className="text-[11px] text-gray-400 leading-normal">{currentModel.desc}</p>
                    </div>

                    {/* Model-Specific Inputs Form */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                <FiSliders /> Model Inputs ({currentModel.inputs.length})
                            </h3>
                            {/* Unit Switcher */}
                            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 text-xs">
                                <button
                                    onClick={() => setUnit('mm')}
                                    className={`px-2 py-0.5 rounded font-semibold transition-all ${unit === 'mm' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}
                                >
                                    mm
                                </button>
                                <button
                                    onClick={() => setUnit('cm')}
                                    className={`px-2 py-0.5 rounded font-semibold transition-all ${unit === 'cm' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}
                                >
                                    cm
                                </button>
                                <button
                                    onClick={() => setUnit('inch')}
                                    className={`px-2 py-0.5 rounded font-semibold transition-all ${unit === 'inch' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}
                                >
                                    inch
                                </button>
                            </div>
                        </div>

                        {/* Input Grid */}
                        <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                            {currentModel.inputs.map(inp => {
                                const currentVal = paramValues[inp.name] !== undefined ? paramValues[inp.name] : (parseFloat(inp.default) || 0);

                                return (
                                    <div key={inp.name} className="space-y-1">
                                        <label className="block text-[10px] font-semibold text-gray-300 uppercase truncate" title={inp.label}>
                                            {inp.label}
                                        </label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={currentVal}
                                            onChange={(e) => handleParamChange(inp.name, e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono text-center focus:outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Prepress Bounding Box Summary */}
                    <div className="bg-emerald-950/40 border border-emerald-500/30 p-5 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Unfolded Sheet Flat Size</span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded font-semibold">Prepress Size</span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                            <span className="text-2xl font-black text-white tracking-tight">
                                {Math.round(flatWidth)} × {Math.round(flatHeight)} <span className="text-xs font-normal text-emerald-300">mm</span>
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                                ({(flatWidth / 25.4).toFixed(2)}″ × {(flatHeight / 25.4).toFixed(2)}″)
                            </span>
                        </div>

                        <button
                            onClick={handleSendToEstimation}
                            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <FiSend className="w-4 h-4" />
                            Send Flat Size to Print Estimation
                        </button>
                    </div>
                </div>

                {/* Right Panel: Live SVG Dieline Canvas & Exporters */}
                <div className="lg:col-span-7 space-y-4">
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl print:hidden">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                                <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span> Cut Line
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                                <span className="w-3 h-3 rounded border border-dashed border-sky-400 bg-sky-950 inline-block"></span> Crease / Fold
                            </div>
                            {isLoading && (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-pulse">
                                    <FiLoader className="animate-spin w-3.5 h-3.5" /> Updating Template...
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleExportFile('svg')}
                                disabled={downloadingFormat === 'svg'}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                            >
                                <FiDownload className="w-3.5 h-3.5" /> SVG
                            </button>
                            <button
                                onClick={() => handleExportFile('dxf')}
                                disabled={downloadingFormat === 'dxf'}
                                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/20 disabled:opacity-50"
                            >
                                <FiDownload className="w-3.5 h-3.5" /> CAD (DXF)
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-white/10"
                            >
                                <FiPrinter className="w-3.5 h-3.5" /> Print / PDF
                            </button>
                        </div>
                    </div>

                    {/* Live Generated Template SVG Net Canvas */}
                    <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl min-h-[580px] flex items-center justify-center">
                        {isLoading && !generatedSvg && (
                            <div className="flex flex-col items-center gap-3 text-emerald-400">
                                <FiLoader className="w-8 h-8 animate-spin" />
                                <span className="text-xs font-semibold">Generating 2D Box Template Dieline...</span>
                            </div>
                        )}

                        {generatedSvg && (
                            <div
                                className="w-full h-auto max-h-[620px] flex items-center justify-center drop-shadow-2xl select-none [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-h-[600px]"
                                dangerouslySetInnerHTML={{ __html: generatedSvg }}
                            />
                        )}
                    </div>
                </div>
            </div>
            {/* Large Parameter Diagram Modal */}
            <AnimatePresence>
                {isDiagramModalOpen && currentModel?.diagramSvg && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 print:hidden"
                        onClick={() => setIsDiagramModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-neutral-900 border border-white/15 p-6 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col space-y-4 shadow-2xl relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                    <FiEye className="w-4 h-4" />
                                    <span>Parameter Diagram: {currentModel.title}</span>
                                </div>
                                <button
                                    onClick={() => setIsDiagramModalOpen(false)}
                                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer border border-white/10"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="bg-black/60 border border-white/10 p-6 rounded-2xl flex-1 flex items-center justify-center overflow-auto min-h-[380px] max-h-[65vh]">
                                <div
                                    className="w-full h-full max-w-3xl text-emerald-300 font-sans [&_svg]:max-h-[60vh] [&_svg]:w-full [&_svg]:h-auto [&_path]:stroke-emerald-400 [&_text]:fill-white [&_text]:font-bold [&_text]:text-base"
                                    dangerouslySetInnerHTML={{ __html: currentModel.diagramSvg }}
                                />
                            </div>

                            <p className="text-xs text-gray-400 text-center leading-relaxed">{currentModel.desc}</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
