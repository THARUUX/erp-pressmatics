'use client';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { useSettings } from '@/components/SettingsContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import {
    FiSettings, FiBriefcase, FiFileText, FiHash, FiTrash2,
    FiSave, FiAlertTriangle, FiCheckCircle,
} from 'react-icons/fi';

/* ── Reusable field primitives ────────────────────────────────────────────── */
function Field({ label, hint, children }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
            {children}
            {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
        </div>
    );
}
function TextInput({ value, onChange, placeholder, type = 'text', className = '' }) {
    return (
        <input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder}
            className={`w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 placeholder-gray-600 transition-colors ${className}`} />
    );
}
function TextArea({ value, onChange, placeholder, rows = 4 }) {
    return (
        <textarea value={value ?? ''} onChange={onChange} placeholder={placeholder} rows={rows}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 placeholder-gray-600 font-mono transition-colors resize-none" />
    );
}
function SectionCard({ title, icon: Icon, children }) {
    return (
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.07] bg-black/20">
                <div className="p-2 rounded-lg bg-white/5"><Icon className="w-4 h-4 text-gray-400" /></div>
                <h2 className="text-sm font-semibold text-white">{title}</h2>
            </div>
            <div className="p-5 space-y-5">{children}</div>
        </div>
    );
}

/* ── Tab config ───────────────────────────────────────────────────────────── */
const TABS = [
    { key: 'general',  label: 'General',       icon: FiSettings  },
    { key: 'company',  label: 'Company',        icon: FiBriefcase  },
    { key: 'documents',label: 'Documents',      icon: FiFileText  },
    { key: 'ids',      label: 'ID Templates',   icon: FiHash      },
    { key: 'data',     label: 'Data Management',icon: FiTrash2    },
];

/* ── Data Management table list ───────────────────────────────────────────── */
const DATA_TABLES = [
    { key: 'customers',    label: 'Customers',    desc: 'All customer records',              hasSeq: true,  danger: 'high' },
    { key: 'quotations',   label: 'Quotations',   desc: 'All quotations + line items',       hasSeq: true,  danger: 'high' },
    { key: 'invoices',     label: 'Invoices',     desc: 'All invoices and payments',         hasSeq: false, danger: 'high' },
    { key: 'sales_orders', label: 'Sales Orders', desc: 'All sales orders and tasks',        hasSeq: false, danger: 'high' },
    { key: 'machine_tasks',label: 'Machine Tasks',desc: 'All production task records',       hasSeq: false, danger: 'medium' },
    { key: 'papers',       label: 'Papers',       desc: 'All paper/stock configurations',   hasSeq: false, danger: 'medium' },
];

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDateOnly(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toISOString().split('T')[0];
    } catch {
        return '';
    }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
    const { settings, updateSetting } = useSettings();
    const [tab, setTab] = useState('general');
    const [saving, setSaving] = useState(false);

    // Data Management
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [selectedTables, setSelectedTables] = useState([]);
    const [deleteMode, setDeleteMode] = useState('date'); // 'all' or 'date'
    const [beforeDate, setBeforeDate] = useState('');
    const [resetSequences, setResetSequences] = useState(true);
    const [executingClear, setExecutingClear] = useState(false);

    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const res = await fetch('/api/admin/clear-table');
            const data = await res.json();
            if (res.ok) {
                setStats(data.stats);
            } else {
                toast.error('Failed to load table stats');
            }
        } catch (err) {
            toast.error('Network error loading stats');
        } finally {
            setLoadingStats(false);
        }
    };

    useEffect(() => {
        if (tab === 'data') {
            fetchStats();
        }
    }, [tab]);

    const toggleRow = (key) => {
        if (selectedTables.includes(key)) {
            setSelectedTables(prev => prev.filter(k => k !== key));
        } else {
            setSelectedTables(prev => [...prev, key]);
        }
    };

    const handleExecuteClear = async () => {
        const tableLabels = selectedTables.map(k => DATA_TABLES.find(t => t.key === k)?.label).join(', ');
        let confirmMsg = '';
        if (deleteMode === 'date') {
            confirmMsg = `This will permanently delete records created BEFORE ${beforeDate} from the following tables: ${tableLabels}.\n\nThis action CANNOT be undone.`;
        } else {
            confirmMsg = `This will permanently delete ALL records from the following tables: ${tableLabels}.\n\nThis action CANNOT be undone and will reset the selected databases.`;
        }

        const confirmed = await confirmDialog(confirmMsg, {
            danger: true,
            confirmLabel: 'Proceed to Delete'
        });
        if (!confirmed) return;

        const typedConfirm = prompt("To confirm deletion, please type the word 'DELETE':");
        if (typedConfirm !== 'DELETE') {
            toast.error('Deletion cancelled. Confirmation text did not match.');
            return;
        }

        setExecutingClear(true);
        try {
            let successCount = 0;
            let totalDeleted = 0;
            let errors = [];

            for (const tableKey of selectedTables) {
                try {
                    const res = await fetch('/api/admin/clear-table', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            table: tableKey,
                            resetSequence: resetSequences,
                            beforeDate: deleteMode === 'date' ? beforeDate : null
                        })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        successCount++;
                        totalDeleted += data.deleted || 0;
                    } else {
                        errors.push(`${tableKey}: ${data.error || 'Unknown error'}`);
                    }
                } catch {
                    errors.push(`${tableKey}: Network error`);
                }
            }

            if (successCount === selectedTables.length) {
                toast.success(`Successfully deleted ${totalDeleted} records across ${successCount} tables.`);
            } else if (successCount > 0) {
                toast.success(`Deleted ${totalDeleted} records. Failed on some tables: ${errors.join(', ')}`);
            } else {
                toast.error(`Failed to delete records: ${errors.join(', ')}`);
            }

            fetchStats();
            setSelectedTables([]);
        } finally {
            setExecutingClear(false);
        }
    };

    // General
    const [currency, setCurrency] = useState('');
    const [taxRate, setTaxRate]   = useState('');
    const [theme, setTheme]       = useState('default');
    const [pageLimit, setPageLimit] = useState('10');

    // Company
    const [companyName, setCompanyName]           = useState('');
    const [companyAddress, setCompanyAddress]     = useState('');
    const [companyVatReg, setCompanyVatReg]       = useState('');
    const [companyLogo, setCompanyLogo]           = useState('');
    const [companySignature, setCompanySignature] = useState('');

    // Documents
    const [defaultTerms, setDefaultTerms]               = useState('');
    const [defaultInvoiceNotes, setDefaultInvoiceNotes] = useState('');
    const [showGrandTotal, setShowGrandTotal]           = useState(true);

    // ID Templates
    const [template, setTemplate]           = useState('');
    const [seq, setSeq]                     = useState('');
    const [custIdTemplate, setCustIdTemplate] = useState('');
    const [custIdSeq, setCustIdSeq]           = useState('');
    const [quoteIdTemplate, setQuoteIdTemplate] = useState('');
    const [quoteIdSeq, setQuoteIdSeq]           = useState('');

    useEffect(() => {
        setCurrency(settings.currency || 'LKR');
        setTaxRate(settings.default_tax_percentage || '0');
        setTheme(settings.system_theme || 'default');
        setPageLimit(settings.list_item_limit || '10');
        setCompanyName(settings.company_name || '');
        setCompanyAddress(settings.company_address || '');
        setCompanyVatReg(settings.company_vat_reg || '');
        setCompanyLogo(settings.company_logo || '');
        setCompanySignature(settings.company_signature || '');
        setDefaultTerms(settings.default_terms || '');
        setDefaultInvoiceNotes(settings.default_invoice_notes || '');
        setShowGrandTotal(settings.show_grand_total !== 'false');
        setTemplate(settings.item_code_template || 'INV-{0000}');
        setSeq(settings.item_code_seq || '1000');
        setCustIdTemplate(settings.customer_id_template || 'CUST-{000}');
        setCustIdSeq(settings.customer_id_seq || '1');
        setQuoteIdTemplate(settings.quotation_id_template || 'QTN-{0000}');
        setQuoteIdSeq(settings.quotation_id_seq || '1');
    }, [settings]);

    const handleImageUpload = (setter) => (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB'); return; }
        const reader = new FileReader();
        reader.onloadend = () => setter(reader.result);
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        const updates = [
            ['currency', currency], ['default_tax_percentage', taxRate],
            ['system_theme', theme], ['list_item_limit', pageLimit],
            ['company_name', companyName], ['company_address', companyAddress],
            ['company_vat_reg', companyVatReg], ['company_logo', companyLogo],
            ['company_signature', companySignature], ['default_terms', defaultTerms],
            ['default_invoice_notes', defaultInvoiceNotes],
            ['show_grand_total', showGrandTotal ? 'true' : 'false'],
            ['item_code_template', template], ['item_code_seq', seq],
            ['customer_id_template', custIdTemplate], ['customer_id_seq', custIdSeq],
            ['quotation_id_template', quoteIdTemplate], ['quotation_id_seq', quoteIdSeq],
        ];
        let ok = true;
        for (const [key, val] of updates) { if (!(await updateSetting(key, val))) ok = false; }
        ok ? toast.success('Settings saved') : toast.error('Some settings failed to save');
        setSaving(false);
    };

    return (
        <div className="text-white w-full">
            {/* ── Page header ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Settings</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Configure your ERP system preferences</p>
                </div>
                {tab !== 'data' && (
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50">
                        <FiSave className="w-4 h-4" />
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                )}
            </div>

            {/* ── Tab bar ───────────────────────────────────────────────── */}
            <div className="flex gap-1 mb-6 bg-black/30 border border-white/10 rounded-2xl p-1">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 flex-1 justify-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all
                            ${tab === t.key ? 'bg-white text-black shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                        <t.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════════ */}
            {/* GENERAL TAB */}
            {tab === 'general' && (
                <div className="space-y-4">
                    <SectionCard title="Currency & Display" icon={FiSettings}>
                        <div className="grid sm:grid-cols-2 gap-5">
                            <Field label="Currency Symbol / Code" hint="Used in all price displays (e.g. LKR, $, €)">
                                <TextInput value={currency} onChange={e => setCurrency(e.target.value)} placeholder="LKR" />
                            </Field>
                            <Field label="Default Tax Rate (%)" hint="Applied by default on new quotations and invoices">
                                <TextInput type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="0" />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard title="System" icon={FiSettings}>
                        <div className="grid sm:grid-cols-2 gap-5">
                            <Field label="UI Theme">
                                <select value={theme} onChange={e => setTheme(e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/30 transition-colors">
                                    <option value="default">Default Dark</option>
                                    <option value="light">Light Mode</option>
                                    <option value="blue">Deep Blue</option>
                                    <option value="midnight">Midnight</option>
                                </select>
                            </Field>
                            <Field label="List Items Per Page" hint="Default rows shown per page in list views">
                                <TextInput type="number" value={pageLimit} onChange={e => setPageLimit(e.target.value)} placeholder="10" />
                            </Field>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* COMPANY TAB */}
            {tab === 'company' && (
                <div className="space-y-4">
                    <SectionCard title="Company Info" icon={FiBriefcase}>
                        <div className="grid sm:grid-cols-2 gap-5">
                            <Field label="Company Name">
                                <TextInput value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Pressmatics Ltd." />
                            </Field>
                            <Field label="VAT Registration No." hint="Shown on invoices for VAT-registered customers">
                                <TextInput value={companyVatReg} onChange={e => setCompanyVatReg(e.target.value)} placeholder="VAT123456789" />
                            </Field>
                            <Field label="Company Address" className="sm:col-span-2">
                                <TextInput value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="123 Main St, Colombo" />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard title="Brand Assets" icon={FiBriefcase}>
                        {/* Logo */}
                        <Field label="Company Logo" hint="Used on printed documents. Max 2MB.">
                            <div className="flex items-center gap-4">
                                {companyLogo && (
                                    <div className="relative group flex-shrink-0">
                                        <img src={companyLogo} alt="Logo" className="h-14 w-auto object-contain bg-white rounded-lg p-1.5" />
                                        <button onClick={() => setCompanyLogo('')}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                                            ✕
                                        </button>
                                    </div>
                                )}
                                <input type="file" accept="image/*" onChange={handleImageUpload(setCompanyLogo)}
                                    className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer" />
                            </div>
                        </Field>

                        {/* Signature */}
                        <Field label="Signature Image" hint="Appears on printed invoices and quotations. Max 2MB.">
                            <div className="flex items-center gap-4">
                                {companySignature && (
                                    <div className="relative group flex-shrink-0">
                                        <img src={companySignature} alt="Signature" className="h-14 w-auto object-contain bg-white rounded-lg p-1.5" />
                                        <button onClick={() => setCompanySignature('')}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                                            ✕
                                        </button>
                                    </div>
                                )}
                                <input type="file" accept="image/*" onChange={handleImageUpload(setCompanySignature)}
                                    className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer" />
                            </div>
                        </Field>
                    </SectionCard>
                </div>
            )}

            {/* DOCUMENTS TAB */}
            {tab === 'documents' && (
                <div className="space-y-4">
                    <SectionCard title="Document Defaults" icon={FiFileText}>
                        <Field label="Default Quotation Terms & Conditions">
                            <TextArea value={defaultTerms} onChange={e => setDefaultTerms(e.target.value)}
                                placeholder="e.g. Prices valid for 30 days. Subject to change without notice." />
                        </Field>
                        <Field label="Default Invoice Notes / Payment Terms">
                            <TextArea value={defaultInvoiceNotes} onChange={e => setDefaultInvoiceNotes(e.target.value)}
                                placeholder="e.g. Payment due within 30 days of invoice date." />
                        </Field>
                        <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                            <div className="relative">
                                <input type="checkbox" id="show_gt" checked={showGrandTotal} onChange={e => setShowGrandTotal(e.target.checked)}
                                    className="sr-only" />
                                <div onClick={() => setShowGrandTotal(v => !v)}
                                    className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${showGrandTotal ? 'bg-white' : 'bg-white/10'}`}>
                                    <div className={`w-4 h-4 bg-black rounded-full mt-0.5 transition-transform ${showGrandTotal ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                                </div>
                            </div>
                            <label htmlFor="show_gt" className="text-sm text-gray-300 cursor-pointer" onClick={() => setShowGrandTotal(v => !v)}>
                                Show Grand Total section on printed documents
                            </label>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* ID TEMPLATES TAB */}
            {tab === 'ids' && (
                <div className="space-y-4">
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3 text-xs text-blue-300">
                        Use <code className="bg-white/10 px-1 rounded">{'{000}'}</code> for zero-padded sequences or <code className="bg-white/10 px-1 rounded">{'{SEQ}'}</code> for raw numbers.
                        The sequence counter increments with each new record.
                    </div>

                    <SectionCard title="Item Code (Estimation)" icon={FiHash}>
                        <div className="grid sm:grid-cols-2 gap-5">
                            <Field label="Template" hint="e.g. INV-{0000} → INV-0001">
                                <TextInput value={template} onChange={e => setTemplate(e.target.value)} placeholder="INV-{0000}" />
                            </Field>
                            <Field label="Next Sequence Number">
                                <TextInput type="number" value={seq} onChange={e => setSeq(e.target.value)} placeholder="1000" />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard title="Customer ID" icon={FiHash}>
                        <div className="grid sm:grid-cols-2 gap-5">
                            <Field label="Template" hint="e.g. CUST-{000} → CUST-001">
                                <TextInput value={custIdTemplate} onChange={e => setCustIdTemplate(e.target.value)} placeholder="CUST-{000}" />
                            </Field>
                            <Field label="Next Sequence Number">
                                <TextInput type="number" value={custIdSeq} onChange={e => setCustIdSeq(e.target.value)} placeholder="1" />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard title="Quotation ID" icon={FiHash}>
                        <div className="grid sm:grid-cols-2 gap-5">
                            <Field label="Template" hint="e.g. QTN-{0000} → QTN-0001">
                                <TextInput value={quoteIdTemplate} onChange={e => setQuoteIdTemplate(e.target.value)} placeholder="QTN-{0000}" />
                            </Field>
                            <Field label="Next Sequence Number">
                                <TextInput type="number" value={quoteIdSeq} onChange={e => setQuoteIdSeq(e.target.value)} placeholder="1" />
                            </Field>
                        </div>
                    </SectionCard>
                </div>
            )}

            {/* DATA MANAGEMENT TAB */}
            {tab === 'data' && (
                <div className="space-y-4">
                    {/* Warning banner */}
                    <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-2xl px-5 py-4">
                        <FiAlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-red-300 font-semibold text-sm">Danger Zone</p>
                            <p className="text-red-400/70 text-xs mt-1">
                                Deleting database records is permanent. <strong>This action cannot be undone.</strong>{' '}
                                Make sure to double check your selected tables and filters before executing.
                            </p>
                        </div>
                    </div>

                    {/* Table sizes display */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] bg-black/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-red-500/10"><FiTrash2 className="w-4 h-4 text-red-400" /></div>
                                <h2 className="text-sm font-semibold text-white">Database Tables</h2>
                            </div>
                            <button type="button" onClick={fetchStats} className="text-xs font-semibold text-gray-400 hover:text-white transition-colors bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
                                Refresh Sizes
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/[0.05] bg-white/[0.01]">
                                        <th className="p-4 w-12 text-center">
                                            <input type="checkbox" checked={selectedTables.length === DATA_TABLES.length} 
                                                onChange={(e) => setSelectedTables(e.target.checked ? DATA_TABLES.map(t => t.key) : [])}
                                                className="rounded border-white/20 bg-black/30 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer" />
                                        </th>
                                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Table / Contents</th>
                                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Rows</th>
                                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Size</th>
                                        <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Date Range</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {DATA_TABLES.map(t => {
                                        const tableStat = stats?.[t.key];
                                        const isSelected = selectedTables.includes(t.key);
                                        return (
                                            <tr key={t.key} 
                                                onClick={() => toggleRow(t.key)}
                                                className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer select-none ${isSelected ? 'bg-white/[0.01]' : ''}`}>
                                                <td className="p-4 text-center">
                                                    <input type="checkbox" checked={isSelected} readOnly className="rounded border-white/20 bg-black/30 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer" />
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-semibold text-sm text-white">{t.label}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
                                                </td>
                                                <td className="p-4 text-sm text-right font-mono text-white">
                                                    {loadingStats ? (
                                                        <span className="text-gray-600 animate-pulse">loading...</span>
                                                    ) : (
                                                        tableStat ? Number(tableStat.count).toLocaleString() : '0'
                                                    )}
                                                </td>
                                                <td className="p-4 text-sm text-right font-mono text-white">
                                                    {loadingStats ? (
                                                        <span className="text-gray-600 animate-pulse">loading...</span>
                                                    ) : (
                                                        tableStat ? formatBytes(tableStat.sizeBytes) : '0 B'
                                                    )}
                                                </td>
                                                <td className="p-4 text-xs text-center font-mono text-gray-400">
                                                    {loadingStats ? (
                                                        <span className="text-gray-600 animate-pulse">loading...</span>
                                                    ) : (
                                                        tableStat && tableStat.count > 0 ? (
                                                            <span>
                                                                {formatDateOnly(tableStat.minDate)} <span className="text-gray-600">to</span> {formatDateOnly(tableStat.maxDate)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">—</span>
                                                        )
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Deletion Options */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-5">
                        <h3 className="text-sm font-semibold text-white">Deletion Options</h3>
                        
                        <div className="grid sm:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Delete Mode</label>
                                <div className="flex gap-2 p-1 bg-black/30 border border-white/10 rounded-xl">
                                    <button type="button" onClick={() => setDeleteMode('date')}
                                        className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition-all ${deleteMode === 'date' ? 'bg-white text-black' : 'text-gray-500 hover:text-gray-300'}`}>
                                        Before Specific Date
                                    </button>
                                    <button type="button" onClick={() => setDeleteMode('all')}
                                        className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition-all ${deleteMode === 'all' ? 'bg-white text-black' : 'text-gray-500 hover:text-gray-300'}`}>
                                        Clear Everything (Reset)
                                    </button>
                                </div>
                            </div>

                            {deleteMode === 'date' ? (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Delete Records Created Before</label>
                                    <input type="date" value={beforeDate} onChange={e => setBeforeDate(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-colors [color-scheme:dark]" />
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="relative mt-5">
                                        <input type="checkbox" id="reset_seq" checked={resetSequences} onChange={e => setResetSequences(e.target.checked)}
                                            className="sr-only" />
                                        <div onClick={() => setResetSequences(v => !v)}
                                            className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${resetSequences ? 'bg-white' : 'bg-white/10'}`}>
                                            <div className={`w-4 h-4 bg-black rounded-full mt-0.5 transition-transform ${resetSequences ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                                        </div>
                                    </div>
                                    <label htmlFor="reset_seq" className="text-sm text-gray-300 cursor-pointer mt-5" onClick={() => setResetSequences(v => !v)}>
                                        Reset ID sequence counters (Customers & Quotations)
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={handleExecuteClear}
                                disabled={selectedTables.length === 0 || (deleteMode === 'date' && !beforeDate) || executingClear}
                                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-red-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-red-500/10 cursor-pointer">
                                {executingClear ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <FiTrash2 className="w-4 h-4" />
                                )}
                                {executingClear ? 'Deleting Data...' : 'Delete Selected Records'}
                            </button>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl px-5 py-4">
                        <FiCheckCircle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                        <p className="text-gray-600 text-xs leading-relaxed">
                            Tables with linked records (e.g. Quotations contain line items) will automatically cascade-clear related child records to maintain database integrity.
                            Clearing "Customers" with reset sequence will also reset Customer ID and Quotation ID sequences if the option is enabled.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
