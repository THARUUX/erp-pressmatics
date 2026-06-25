'use client';

import { useState, useRef, useCallback } from 'react';
import {
    FiUpload, FiX, FiDownload, FiCheck, FiAlertCircle,
    FiChevronRight, FiChevronLeft, FiUsers, FiLoader,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

/* ── CSV parser (no dependencies) ────────────────────────────────────────── */
function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
    if (lines.length < 2) return { headers: [], rows: [] };

    const parseRow = (line) => {
        const result = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
            else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
            else cur += ch;
        }
        result.push(cur.trim());
        return result;
    };

    const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(l => {
        const vals = parseRow(l);
        return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] ?? '' }), {});
    });
    return { headers, rows };
}

/* ── Auto-detect column mapping ──────────────────────────────────────────── */
const FIELD_ALIASES = {
    name:       ['name', 'customer name', 'company', 'company name', 'client', 'full name'],
    email:      ['email', 'e-mail', 'email address', 'mail'],
    phone:      ['phone', 'telephone', 'mobile', 'contact', 'phone number', 'tel'],
    address:    ['address', 'street', 'location', 'street address'],
    is_vat:     ['vat', 'is_vat', 'tax', 'vat registered', 'vat status'],
    vat_number: ['vat number', 'vat_number', 'vat no', 'tax number', 'tax id'],
    contact_name:  ['contact name', 'contact person', 'contact_name', 'contact_person', 'representative'],
    contact_phone: ['contact phone', 'contact_phone', 'contact mobile', 'contact_phone_number'],
    contact_email: ['contact email', 'contact_email', 'contact e-mail'],
    contact_role:  ['contact role', 'contact_role', 'designation', 'role', 'contact designation'],
};

function autoMap(headers) {
    const mapping = { name: '', email: '', phone: '', address: '', is_vat: '', vat_number: '', contact_name: '', contact_phone: '', contact_email: '', contact_role: '' };
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        const match = headers.find(h => aliases.includes(h.toLowerCase()));
        if (match) mapping[field] = match;
    }
    return mapping;
}

/* ── Template CSV ─────────────────────────────────────────────────────────── */
function downloadTemplate() {
    const csv = 'Name,Email,Phone,Address,Is VAT (yes/no),VAT Number,Contact Name,Contact Role,Contact Email,Contact Phone\nAcme Corp,info@acme.com,+1 555-0100,123 Main St,yes,VAT123456,John Doe,Purchasing Manager,john@acme.com,+1 555-0199\nGlobal Ltd,hello@global.io,+44 20 1234 5678,456 High Road,no,,,,,\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'customers_template.csv' });
    a.click(); URL.revokeObjectURL(url);
}

/* ── Field config for mapping UI ─────────────────────────────────────────── */
const FIELDS = [
    { key: 'name',       label: 'Name *',      required: true },
    { key: 'email',      label: 'Email',        required: false },
    { key: 'phone',      label: 'Phone',        required: false },
    { key: 'address',    label: 'Address',      required: false },
    { key: 'is_vat',     label: 'VAT Status',   required: false },
    { key: 'vat_number', label: 'VAT Number',   required: false },
    { key: 'contact_name',  label: 'Contact Name',  required: false },
    { key: 'contact_role',  label: 'Contact Role',  required: false },
    { key: 'contact_email', label: 'Contact Email', required: false },
    { key: 'contact_phone', label: 'Contact Phone', required: false },
];

const STEPS = ['Upload', 'Map Columns', 'Preview & Import'];

/* ═══════════════════════════════════════════════════════════════════════════ */
export function BulkImportModal({ onClose, onComplete }) {
    const [step, setStep]           = useState(0);
    const [dragging, setDragging]   = useState(false);
    const [parsed, setParsed]       = useState(null); // { headers, rows }
    const [mapping, setMapping]     = useState({});
    const [importing, setImporting] = useState(false);
    const [result, setResult]       = useState(null);  // { imported, failed }
    const fileRef = useRef();

    /* ── File handling ─────────────────────────────────────────────────────── */
    const processFile = useCallback((file) => {
        if (!file || !file.name.match(/\.(csv|txt)$/i)) {
            toast.error('Please upload a .csv file'); return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const parsed = parseCSV(e.target.result);
            if (parsed.headers.length === 0) { toast.error('Could not parse file — is it a valid CSV?'); return; }
            setParsed(parsed);
            setMapping(autoMap(parsed.headers));
            setStep(1);
        };
        reader.readAsText(file);
    }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault(); setDragging(false);
        processFile(e.dataTransfer.files[0]);
    }, [processFile]);

    /* ── Build preview rows ───────────────────────────────────────────────── */
    const mapped = parsed?.rows.map(row => ({
        name:       mapping.name       ? row[mapping.name]       : '',
        email:      mapping.email      ? row[mapping.email]      : '',
        phone:      mapping.phone      ? row[mapping.phone]      : '',
        address:    mapping.address    ? row[mapping.address]    : '',
        is_vat:     mapping.is_vat     ? /^(yes|true|1)$/i.test(row[mapping.is_vat]) : false,
        vat_number: mapping.vat_number ? row[mapping.vat_number] : '',
        contact_name:  mapping.contact_name  ? row[mapping.contact_name]  : '',
        contact_role:  mapping.contact_role  ? row[mapping.contact_role]  : '',
        contact_email: mapping.contact_email ? row[mapping.contact_email] : '',
        contact_phone: mapping.contact_phone ? row[mapping.contact_phone] : '',
    })) ?? [];

    const validRows    = mapped.filter(r => r.name?.trim());
    const invalidCount = mapped.length - validRows.length;

    /* ── Import ────────────────────────────────────────────────────────────── */
    const handleImport = async () => {
        setImporting(true);
        try {
            const res = await fetch('/api/customers/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customers: validRows }),
            });
            const data = await res.json();
            if (res.ok) {
                setResult(data);
                setStep(3);
            } else {
                toast.error(data.error || 'Import failed');
            }
        } catch {
            toast.error('Network error during import');
        } finally {
            setImporting(false);
        }
    };

    /* ── UI ────────────────────────────────────────────────────────────────── */
    return (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] w-full max-w-2xl flex flex-col max-h-[90vh]">
                {/* ── Title bar ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] flex-shrink-0">
                    <div>
                        <h2 className="text-white font-semibold text-lg">Bulk Import Customers</h2>
                        <p className="text-gray-500 text-xs mt-0.5">CSV file · columns auto-detected</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                        <FiX size={16} />
                    </button>
                </div>

                {/* ── Step pills ────────────────────────────────────────────── */}
                {step < 3 && (
                    <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.07] flex-shrink-0">
                        {STEPS.map((s, i) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${i === step ? 'bg-white text-black' : i < step ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                                    {i < step ? <FiCheck size={11} /> : <span>{i + 1}</span>}
                                    {s}
                                </div>
                                {i < STEPS.length - 1 && <span className="text-gray-700 text-xs">›</span>}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Content ───────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* STEP 0 — Upload ─────────────────────────────────────── */}
                    {step === 0 && (
                        <div className="space-y-4">
                            {/* Template download */}
                            <div className="flex items-center justify-between bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
                                <div>
                                    <p className="text-blue-300 text-sm font-medium">First time?</p>
                                    <p className="text-gray-500 text-xs mt-0.5">Download our CSV template to get started</p>
                                </div>
                                <button onClick={downloadTemplate}
                                    className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-colors">
                                    <FiDownload size={12} /> Template
                                </button>
                            </div>

                            {/* Drop zone */}
                            <div
                                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                                onClick={() => fileRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${dragging ? 'border-white/40 bg-white/5 scale-[1.01]' : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'}`}
                            >
                                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                                    onChange={e => processFile(e.target.files[0])} />
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${dragging ? 'bg-white/10' : 'bg-white/5'}`}>
                                    <FiUpload className="w-7 h-7 text-gray-400" />
                                </div>
                                <p className="text-white font-medium mb-1">Drop your CSV here</p>
                                <p className="text-gray-500 text-sm">or click to browse files</p>
                                <p className="text-gray-700 text-xs mt-3">.csv · .txt supported</p>
                            </div>

                            {/* Format hint */}
                            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                                <p className="text-gray-400 text-xs font-medium mb-2 uppercase tracking-wider">Expected columns</p>
                                <div className="flex flex-wrap gap-2">
                                    {['Name *', 'Email', 'Phone', 'Address', 'Is VAT', 'VAT Number'].map(f => (
                                        <span key={f} className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded-full">{f}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 1 — Column mapping ─────────────────────────────── */}
                    {step === 1 && parsed && (
                        <div className="space-y-4">
                            <p className="text-gray-400 text-sm">
                                Found <strong className="text-white">{parsed.rows.length} rows</strong> with <strong className="text-white">{parsed.headers.length} columns</strong>. Map each CSV column to a customer field.
                            </p>
                            <div className="space-y-2">
                                {FIELDS.map(field => (
                                    <div key={field.key} className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
                                        <div className="w-32 flex-shrink-0">
                                            <span className="text-sm text-white">{field.label}</span>
                                        </div>
                                        <div className="text-gray-700 text-xs">←</div>
                                        <select
                                            value={mapping[field.key] || ''}
                                            onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-white/30"
                                        >
                                            <option value="">{field.required ? '— required —' : '— skip —'}</option>
                                            {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                        {mapping[field.key] ? (
                                            <FiCheck size={14} className="text-emerald-400 flex-shrink-0" />
                                        ) : (
                                            <div className="w-3.5 h-3.5 flex-shrink-0" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            {!mapping.name && (
                                <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
                                    <FiAlertCircle size={14} /> Map the <strong>Name</strong> column to continue
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2 — Preview ────────────────────────────────────── */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-gray-400 text-sm">
                                    <strong className="text-emerald-400">{validRows.length}</strong> valid rows ready to import
                                    {invalidCount > 0 && <span className="text-red-400 ml-2">· {invalidCount} skipped (no name)</span>}
                                </p>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-black/30 border-b border-white/[0.06]">
                                            {['Name', 'Email', 'Phone', 'Address', 'VAT'].map(h => (
                                                <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-medium uppercase tracking-wider">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {validRows.slice(0, 20).map((row, i) => (
                                            <tr key={i} className={`border-b border-white/[0.04] ${i % 2 === 1 ? 'bg-white/[0.01]' : ''}`}>
                                                <td className="px-3 py-2.5 text-white font-medium">{row.name}</td>
                                                <td className="px-3 py-2.5 text-gray-400">{row.email || '—'}</td>
                                                <td className="px-3 py-2.5 text-gray-400">{row.phone || '—'}</td>
                                                <td className="px-3 py-2.5 text-gray-500 truncate max-w-[120px]">{row.address || '—'}</td>
                                                <td className="px-3 py-2.5">
                                                    {row.is_vat
                                                        ? <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">VAT</span>
                                                        : <span className="text-gray-700">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                        {validRows.length > 20 && (
                                            <tr>
                                                <td colSpan={5} className="px-3 py-2.5 text-center text-gray-600 text-xs">
                                                    … and {validRows.length - 20} more rows
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* STEP 3 — Result ─────────────────────────────────────── */}
                    {step === 3 && result && (
                        <div className="text-center py-6 space-y-4">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                                <FiUsers className="w-9 h-9 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-white">{result.imported}</p>
                                <p className="text-gray-400 text-sm mt-1">customers imported successfully</p>
                            </div>
                            {result.failed?.length > 0 && (
                                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-left">
                                    <p className="text-red-400 text-sm font-medium mb-2">
                                        {result.failed.length} row{result.failed.length !== 1 ? 's' : ''} failed:
                                    </p>
                                    {result.failed.map((f, i) => (
                                        <p key={i} className="text-red-300 text-xs">Row {f.row}: {f.error}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer actions ────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.07] flex-shrink-0">
                    {/* Left */}
                    <div>
                        {step === 1 && (
                            <button onClick={() => { setStep(0); setParsed(null); }}
                                className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
                                <FiChevronLeft size={15} /> Back
                            </button>
                        )}
                        {step === 2 && (
                            <button onClick={() => setStep(1)}
                                className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
                                <FiChevronLeft size={15} /> Back
                            </button>
                        )}
                    </div>

                    {/* Right */}
                    <div className="flex gap-3">
                        {step < 3 && (
                            <button onClick={onClose}
                                className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
                                Cancel
                            </button>
                        )}

                        {step === 1 && (
                            <button
                                disabled={!mapping.name}
                                onClick={() => setStep(2)}
                                className="flex items-center gap-2 px-5 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                Preview <FiChevronRight size={14} />
                            </button>
                        )}

                        {step === 2 && (
                            <button
                                disabled={importing || validRows.length === 0}
                                onClick={handleImport}
                                className="flex items-center gap-2 px-5 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                {importing ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        Importing…
                                    </>
                                ) : (
                                    <>Import {validRows.length} customers</>
                                )}
                            </button>
                        )}

                        {step === 3 && (
                            <button
                                onClick={() => { onComplete?.(); onClose(); }}
                                className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-400 transition-colors">
                                <FiCheck size={14} /> Done
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
