'use client';

import { useState, useRef, useCallback } from 'react';
import {
    FiDownload, FiUpload, FiX, FiCheck, FiAlertCircle,
    FiChevronLeft, FiLoader,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

/* ── Config per entity type ─────────────────────────────────────────────── */
const CONFIGS = {
    customers: {
        title: 'Customers',
        endpoint: '/api/customers/bulk-update',
        fileName: 'customers',
        columns: [
            { key: 'id',            label: 'id (DO NOT CHANGE)' },
            { key: 'code',          label: 'code' },
            { key: 'name',          label: 'name' },
            { key: 'email',         label: 'email' },
            { key: 'phone',         label: 'phone' },
            { key: 'address',       label: 'address' },
            { key: 'category',      label: 'category' },
            { key: 'is_vat',        label: 'is_vat (0 or 1)' },
            { key: 'vat_number',    label: 'vat_number' },
            { key: 'contact_name',  label: 'contact_name' },
            { key: 'contact_role',  label: 'contact_role' },
            { key: 'contact_email', label: 'contact_email' },
            { key: 'contact_phone', label: 'contact_phone' },
        ],
        previewCols: ['id', 'name', 'email', 'phone', 'category'],
    },
    suppliers: {
        title: 'Suppliers',
        endpoint: '/api/suppliers/bulk-update',
        fileName: 'suppliers',
        columns: [
            { key: 'id',            label: 'id (DO NOT CHANGE)' },
            { key: 'code',          label: 'code' },
            { key: 'name',          label: 'name' },
            { key: 'email',         label: 'email' },
            { key: 'phone',         label: 'phone' },
            { key: 'address',       label: 'address' },
            { key: 'contact_name',  label: 'contact_name' },
            { key: 'contact_email', label: 'contact_email' },
            { key: 'contact_phone', label: 'contact_phone' },
            { key: 'payment_terms', label: 'payment_terms' },
            { key: 'credit_limit',  label: 'credit_limit' },
            { key: 'notes',         label: 'notes' },
        ],
        previewCols: ['id', 'name', 'email', 'phone', 'payment_terms'],
    },
    inventory: {
        title: 'Inventory Items',
        endpoint: '/api/inventory/bulk-update',
        fileName: 'inventory',
        columns: [
            { key: 'id',          label: 'id (DO NOT CHANGE)' },
            { key: 'item_code',   label: 'item_code' },
            { key: 'name',        label: 'name' },
            { key: 'type',        label: 'type' },
            { key: 'unit_cost',   label: 'unit_cost' },
            { key: 'min_stock',   label: 'min_stock' },
            { key: 'uom',         label: 'uom' },
            { key: 'description', label: 'description' },
        ],
        previewCols: ['id', 'name', 'type', 'unit_cost', 'uom'],
    },
    employees: {
        title: 'Employees',
        endpoint: '/api/employees/bulk-update',
        fileName: 'employees',
        columns: [
            { key: 'id',            label: 'id (DO NOT CHANGE)' },
            { key: 'employee_id',   label: 'employee_id' },
            { key: 'name',          label: 'name' },
            { key: 'job_title',     label: 'job_title' },
            { key: 'department',    label: 'department' },
            { key: 'phone',         label: 'phone' },
            { key: 'email',         label: 'email' },
            { key: 'date_of_birth', label: 'date_of_birth' },
            { key: 'date_joined',   label: 'date_joined' },
            { key: 'shift',         label: 'shift' },
            { key: 'status',        label: 'status' },
            { key: 'pay_type',      label: 'pay_type' },
            { key: 'base_salary',   label: 'base_salary' },
            { key: 'hourly_rate',   label: 'hourly_rate' },
            { key: 'allowances',    label: 'allowances' },
            { key: 'deductions',    label: 'deductions' },
            { key: 'ot_rate_multiplier', label: 'ot_rate_multiplier' },
            { key: 'standard_working_hours', label: 'standard_working_hours' },
            { key: 'notes',         label: 'notes' },
        ],
        previewCols: ['id', 'name', 'job_title', 'department', 'email'],
    },
};

/* ── Export helper (uses xlsx loaded dynamically) ───────────────────────── */
async function exportToExcel(data, config) {
    const XLSX = await import('xlsx');
    const headers = config.columns.map(c => c.label);
    const rows = data.map(row => config.columns.map(c => {
        const v = row[c.key];
        return v !== undefined && v !== null ? v : '';
    }));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Style first column (id) with a note width
    ws['!cols'] = config.columns.map((_, i) => ({ wch: i === 0 ? 22 : 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.title);
    XLSX.writeFile(wb, `${config.fileName}_bulk_edit.xlsx`);
}

/* ── Parse uploaded xlsx/csv ────────────────────────────────────────────── */
async function parseFile(file, config) {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Build key map: label → key (strip the "(DO NOT CHANGE)" suffix etc.)
    const labelToKey = {};
    config.columns.forEach(c => {
        labelToKey[c.label] = c.key;
        labelToKey[c.key]   = c.key; // also accept raw key names
    });

    return rawRows.map(raw => {
        const obj = {};
        for (const [col, val] of Object.entries(raw)) {
            const key = labelToKey[col] || labelToKey[col.trim()];
            if (key) obj[key] = val;
        }
        return obj;
    });
}

/* ── Diff: which rows actually changed ─────────────────────────────────── */
function detectChanges(uploaded, originalData, config) {
    const originalMap = {};
    originalData.forEach(r => { originalMap[r.id] = r; });

    return uploaded.map(row => {
        const id = parseInt(row.id);
        const orig = originalMap[id];
        if (!orig) return { ...row, _status: 'not_found' };

        const changed = config.columns.some(c => {
            if (c.key === 'id') return false;
            const a = String(orig[c.key] ?? '');
            const b = String(row[c.key] ?? '');
            return a !== b;
        });
        return { ...row, _status: changed ? 'changed' : 'unchanged' };
    });
}

const STEPS = ['Export & Edit', 'Upload', 'Preview', 'Result'];

/* ═══════════════════════════════════════════════════════════════════════════ */
export function BulkEditModal({ type = 'customers', data = [], onClose, onComplete }) {
    const [step, setStep]           = useState(0);
    const [dragging, setDragging]   = useState(false);
    const [rows, setRows]           = useState([]);  // parsed + diffed rows
    const [updating, setUpdating]   = useState(false);
    const [result, setResult]       = useState(null);
    const fileRef = useRef();

    const config = CONFIGS[type] || CONFIGS.customers;
    const changedRows  = rows.filter(r => r._status === 'changed');
    const unknownRows  = rows.filter(r => r._status === 'not_found');

    /* ── File handling ─────────────────────────────────────────────────── */
    const processFile = useCallback(async (file) => {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            toast.error('Please upload an .xlsx, .xls, or .csv file');
            return;
        }
        try {
            const parsed = await parseFile(file, config);
            if (!parsed.length) { toast.error('No rows found in file'); return; }
            const diffed = detectChanges(parsed, data, config);
            setRows(diffed);
            setStep(2);
        } catch (e) {
            console.error(e);
            toast.error('Could not read file — make sure it is a valid Excel/CSV file');
        }
    }, [config, data]);

    const onDrop = useCallback((e) => {
        e.preventDefault(); setDragging(false);
        processFile(e.dataTransfer.files[0]);
    }, [processFile]);

    /* ── Batch update ──────────────────────────────────────────────────── */
    const handleUpdate = async () => {
        if (!changedRows.length) return;
        setUpdating(true);
        try {
            const res = await fetch(config.endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: changedRows }),
            });
            const data = await res.json();
            if (res.ok) { setResult(data); setStep(3); }
            else toast.error(data.error || 'Update failed');
        } catch {
            toast.error('Network error during update');
        } finally {
            setUpdating(false);
        }
    };

    /* ── UI ────────────────────────────────────────────────────────────── */
    return (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] w-full max-w-2xl flex flex-col max-h-[90vh]">

                {/* Title bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] flex-shrink-0">
                    <div>
                        <h2 className="text-white font-semibold text-lg">Bulk Edit {config.title}</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Export → edit in Excel → re-upload to update</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                        <FiX size={16} />
                    </button>
                </div>

                {/* Step pills */}
                {step < 3 && (
                    <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.07] flex-shrink-0 overflow-x-auto">
                        {STEPS.map((s, i) => (
                            <div key={s} className="flex items-center gap-2 shrink-0">
                                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${i === step ? 'bg-white text-black' : i < step ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                                    {i < step ? <FiCheck size={11} /> : <span>{i + 1}</span>}
                                    {s}
                                </div>
                                {i < STEPS.length - 1 && <span className="text-gray-700 text-xs">›</span>}
                            </div>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">

                    {/* STEP 0 — Export & Edit */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 space-y-3">
                                <p className="text-blue-300 text-sm font-semibold">How it works</p>
                                <ol className="text-gray-400 text-sm space-y-1.5 list-decimal list-inside">
                                    <li>Download the current list as an Excel file</li>
                                    <li>Edit any cells you want (keep the <span className="font-mono text-white/70 bg-white/5 px-1 rounded">id</span> column unchanged)</li>
                                    <li>Save and re-upload the file here</li>
                                    <li>Only changed rows will be updated</li>
                                </ol>
                            </div>
                            <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.08] rounded-xl px-5 py-4">
                                <div>
                                    <p className="text-white text-sm font-medium">{data.length} {config.title} ready to export</p>
                                    <p className="text-gray-500 text-xs mt-0.5">{config.fileName}_bulk_edit.xlsx</p>
                                </div>
                                <button
                                    onClick={() => exportToExcel(data, config)}
                                    className="flex items-center gap-2 text-sm bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl transition-colors font-medium"
                                >
                                    <FiDownload size={14} /> Export Excel
                                </button>
                            </div>
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
                                <FiAlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                                <p className="text-amber-300/80 text-xs">Do <strong>not</strong> change the <span className="font-mono bg-white/5 px-1 rounded">id</span> column — it is used to match each row to the correct record.</p>
                            </div>
                        </div>
                    )}

                    {/* STEP 1 — Upload */}
                    {step === 1 && (
                        <div
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={onDrop}
                            onClick={() => fileRef.current?.click()}
                            className={`relative border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all ${dragging ? 'border-white/40 bg-white/5 scale-[1.01]' : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'}`}
                        >
                            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                                onChange={e => processFile(e.target.files[0])} />
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${dragging ? 'bg-white/10' : 'bg-white/5'}`}>
                                <FiUpload className="w-7 h-7 text-gray-400" />
                            </div>
                            <p className="text-white font-medium mb-1">Drop your edited file here</p>
                            <p className="text-gray-500 text-sm">or click to browse</p>
                            <p className="text-gray-700 text-xs mt-3">.xlsx · .xls · .csv supported</p>
                        </div>
                    )}

                    {/* STEP 2 — Preview */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
                                    {changedRows.length} rows will be updated
                                </span>
                                <span className="text-xs bg-white/5 text-gray-500 border border-white/10 px-2.5 py-1 rounded-full">
                                    {rows.filter(r => r._status === 'unchanged').length} unchanged (skipped)
                                </span>
                                {unknownRows.length > 0 && (
                                    <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full">
                                        {unknownRows.length} id not found (skipped)
                                    </span>
                                )}
                            </div>
                            {changedRows.length === 0 ? (
                                <div className="text-center py-10 text-gray-500 text-sm">
                                    No changes detected — the uploaded file matches the current data.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-black/30 border-b border-white/[0.06]">
                                                {config.previewCols.map(k => (
                                                    <th key={k} className="px-3 py-2.5 text-left text-gray-500 font-medium uppercase tracking-wider">{k}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {changedRows.slice(0, 30).map((row, i) => (
                                                <tr key={i} className="border-b border-white/[0.04] bg-emerald-500/[0.02]">
                                                    {config.previewCols.map(k => (
                                                        <td key={k} className={`px-3 py-2.5 ${k === 'id' ? 'font-mono text-gray-500' : k === 'name' ? 'text-white font-medium' : 'text-gray-400'}`}>
                                                            {String(row[k] ?? '—')}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                            {changedRows.length > 30 && (
                                                <tr><td colSpan={config.previewCols.length} className="px-3 py-2.5 text-center text-gray-600">…and {changedRows.length - 30} more rows</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3 — Result */}
                    {step === 3 && result && (
                        <div className="text-center py-6 space-y-4">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                                <FiCheck className="w-9 h-9 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-white">{result.updated}</p>
                                <p className="text-gray-400 text-sm mt-1">{config.title.toLowerCase()} updated successfully</p>
                            </div>
                            {result.skipped?.length > 0 && (
                                <p className="text-gray-500 text-xs">{result.skipped.length} row(s) skipped</p>
                            )}
                            {result.failed?.length > 0 && (
                                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-left">
                                    <p className="text-red-400 text-sm font-medium mb-2">{result.failed.length} row(s) failed:</p>
                                    {result.failed.map((f, i) => (
                                        <p key={i} className="text-red-300 text-xs">id {f.id}: {f.error}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.07] flex-shrink-0">
                    <div>
                        {step === 1 && (
                            <button onClick={() => setStep(0)} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
                                <FiChevronLeft size={15} /> Back
                            </button>
                        )}
                        {step === 2 && (
                            <button onClick={() => { setStep(1); setRows([]); }} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
                                <FiChevronLeft size={15} /> Back
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        {step < 3 && (
                            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
                                Cancel
                            </button>
                        )}
                        {step === 0 && (
                            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors">
                                Next — Upload File
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                disabled={updating || changedRows.length === 0}
                                onClick={handleUpdate}
                                className="flex items-center gap-2 px-5 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {updating ? (
                                    <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />Updating…</>
                                ) : (
                                    <>Update {changedRows.length} {config.title}</>
                                )}
                            </button>
                        )}
                        {step === 3 && (
                            <button onClick={() => { onComplete?.(); onClose(); }} className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-400 transition-colors">
                                <FiCheck size={14} /> Done
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
