'use client';
import { useState, useRef } from 'react';
import { FiUpload, FiDownload, FiX, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const REQUIRED_COLS = ['name', 'category'];
const ALL_COLS = ['name', 'category', 'type', 'uom', 'unit_cost', 'stock_quantity', 'min_stock', 'width_cm', 'height_cm'];
const TEMPLATE_CSV = ALL_COLS.join(',') + '\nA4 Bond 80gsm,Paper,OFFSET,Sheet,2.50,500,50,29.7,21\nCyan Ink,Ink,,Ltr,850,10,2,,';

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).filter(l => l.trim()).map(line => {
        const vals = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i]?.trim() ?? ''; });
        return obj;
    });
}

export default function BulkUploadModal({ onClose, onDone }) {
    const fileRef = useRef();
    const [rows, setRows] = useState([]);
    const [errors, setErrors] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFile = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const parsed = parseCSV(ev.target.result);
                const errs = [];
                parsed.forEach((r, i) => {
                    REQUIRED_COLS.forEach(c => { if (!r[c]) errs.push(`Row ${i + 2}: missing "${c}"`); });
                });
                setRows(parsed);
                setErrors(errs);
            } catch { toast.error('Failed to parse CSV'); }
        };
        reader.readAsText(file);
    };

    const handleUpload = async () => {
        if (!rows.length || errors.length) return;
        setUploading(true);
        try {
            const res = await fetch('/api/inventory/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: rows }),
            });
            const data = await res.json();
            setResult(data);
            if (data.inserted > 0) { toast.success(`${data.inserted} items uploaded`); onDone(); }
            if (data.errors > 0) toast.error(`${data.errors} rows failed`);
        } catch { toast.error('Upload failed'); }
        finally { setUploading(false); }
    };

    const downloadTemplate = () => {
        const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'inventory_template.csv'; a.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                    <div>
                        <h2 className="text-base font-semibold text-white">Bulk Upload</h2>
                        <p className="text-xs text-white/35 mt-0.5">Upload a CSV file to add multiple inventory items at once</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"><FiX /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Template download */}
                    <button onClick={downloadTemplate}
                        className="flex items-center gap-2 text-xs text-white/50 hover:text-white border border-white/[0.08] hover:border-white/20 px-3 py-2 rounded-xl transition-all">
                        <FiDownload className="w-3.5 h-3.5" /> Download CSV Template
                    </button>

                    {/* File input */}
                    <div
                        onClick={() => fileRef.current?.click()}
                        className="border-2 border-dashed border-white/[0.08] hover:border-white/20 rounded-xl p-8 text-center cursor-pointer transition-colors group">
                        <FiUpload className="w-8 h-8 text-white/20 group-hover:text-white/40 mx-auto mb-3 transition-colors" />
                        <p className="text-sm text-white/40 group-hover:text-white/60 transition-colors">Click to select a CSV file</p>
                        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                    </div>

                    {/* Validation errors */}
                    {errors.length > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-1">
                            <p className="text-xs font-semibold text-red-400 flex items-center gap-2"><FiAlertTriangle /> {errors.length} validation error(s)</p>
                            {errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-400/70">{e}</p>)}
                            {errors.length > 5 && <p className="text-xs text-red-400/50">…and {errors.length - 5} more</p>}
                        </div>
                    )}

                    {/* Preview */}
                    {rows.length > 0 && errors.length === 0 && (
                        <div>
                            <p className="text-xs text-white/40 mb-2">{rows.length} rows ready to import</p>
                            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-white/[0.03] border-b border-white/[0.05]">
                                            {ALL_COLS.map(c => <th key={c} className="px-3 py-2 text-left text-white/35 uppercase tracking-wider font-semibold">{c}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {rows.slice(0, 10).map((r, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02]">
                                                {ALL_COLS.map(c => <td key={c} className="px-3 py-2 text-white/60 font-mono">{r[c] || '—'}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {rows.length > 10 && <p className="text-center text-xs text-white/25 py-2">…{rows.length - 10} more rows not shown</p>}
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-white/70">
                                <FiCheckCircle className="text-white/60" />
                                {result.inserted} inserted · {result.errors} failed
                            </div>
                            {result.errorDetails?.map((e, i) => (
                                <p key={i} className="text-xs text-red-400/70">Row {e.row}: {e.error} ({e.name})</p>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-white/[0.06]">
                    <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/[0.08] text-sm text-white/50 hover:text-white hover:border-white/20 transition-all">Cancel</button>
                    <button
                        onClick={handleUpload}
                        disabled={!rows.length || errors.length > 0 || uploading}
                        className="flex-1 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-30 transition-all">
                        {uploading ? 'Uploading…' : `Upload ${rows.length} Items`}
                    </button>
                </div>
            </div>
        </div>
    );
}
