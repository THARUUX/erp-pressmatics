'use client';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { useSettings } from '@/components/SettingsContext';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import {
    FiSettings, FiBriefcase, FiFileText, FiHash, FiTrash2,
    FiSave, FiAlertTriangle, FiCheckCircle, FiList, FiPlus, FiX,
    FiArrowUp, FiArrowDown, FiMessageSquare, FiAward, FiGift, FiEdit2,
    FiDollarSign
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
    { key: 'tasks',    label: 'Tasks',          icon: FiList      },
    { key: 'whatsapp', label: 'WhatsApp',       icon: FiMessageSquare },
    { key: 'loyalty',  label: 'Loyalty Program',icon: FiAward },
    { key: 'payroll',  label: 'Payroll & Tax',  icon: FiDollarSign },
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

const getTaskTypeBadge = (key) => {
    if (['prepress', 'service', 'plate_making', 'offset_printing', 'digital_printing', 'finishing', 'quality_check', 'packing', 'delivery'].includes(key)) {
        return <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-wider">System</span>;
    }
    if (key.startsWith('machine_')) {
        return <span className="bg-purple-500/10 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 uppercase tracking-wider">Machine</span>;
    }
    if (key.startsWith('finishing_')) {
        return <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider">Finishing</span>;
    }
    return <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider">Custom</span>;
};

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

    // Tasks Configuration
    const [taskConfigs, setTaskConfigs] = useState([]);
    const [machines, setMachines] = useState([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [savingTasks, setSavingTasks] = useState(false);

    const fetchTaskConfigs = async () => {
        setLoadingTasks(true);
        try {
            const res = await fetch('/api/settings/tasks');
            const data = await res.json();
            if (res.ok) {
                const sorted = (data.configs || []).sort((a, b) => a.display_order - b.display_order);
                setTaskConfigs(sorted);
                setMachines(data.machines || []);
            } else {
                toast.error('Failed to load task configurations');
            }
        } catch (err) {
            toast.error('Error fetching task configurations');
        } finally {
            setLoadingTasks(false);
        }
    };

    useEffect(() => {
        if (tab === 'data') {
            fetchStats();
        } else if (tab === 'tasks') {
            fetchTaskConfigs();
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

    // WhatsApp Configuration Settings
    const [whatsappEnabled, setWhatsappEnabled] = useState(false);
    const [whatsappAutoSendOrder, setWhatsappAutoSendOrder] = useState(false);
    const [whatsappAutoSendDispatch, setWhatsappAutoSendDispatch] = useState(false);
    const [whatsappAutoSendReady, setWhatsappAutoSendReady] = useState(false);
    const [whatsappTemplateOrder, setWhatsappTemplateOrder] = useState('');
    const [whatsappTemplateDispatch, setWhatsappTemplateDispatch] = useState('');
    const [whatsappTemplateReady, setWhatsappTemplateReady] = useState('');
    const [whatsappTemplateWelcome, setWhatsappTemplateWelcome] = useState('');
    const [whatsappTemplateQuote, setWhatsappTemplateQuote]     = useState('');

    // WhatsApp Live State (microservice polling)
    const [whatsappStatus, setWhatsappStatus] = useState('LOADING');
    const [whatsappQr, setWhatsappQr] = useState(null);
    const [whatsappProfile, setWhatsappProfile] = useState(null);

    const [testNumber, setTestNumber] = useState('');
    const [testMessage, setTestMessage] = useState('This is a test message from Pressmatics ERP!');
    const [sendingTest, setSendingTest] = useState(false);

    // Loyalty Program Configuration
    const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
    const [loyaltyRewards, setLoyaltyRewards] = useState([]);
    
    // Reward Item Editor Inputs
    const [rewardId, setRewardId] = useState('');
    const [rewardTitle, setRewardTitle] = useState('');
    const [rewardCost, setRewardCost] = useState('');
    const [rewardDesc, setRewardDesc] = useState('');
    
    // Payroll & Tax Settings
    const [epfEmployeePct, setEpfEmployeePct] = useState('8');
    const [epfEmployerPct, setEpfEmployerPct] = useState('12');
    const [etfEmployerPct, setEtfEmployerPct] = useState('3');
    const [br1Amount, setBr1Amount]           = useState('0');
    const [br2Amount, setBr2Amount]           = useState('0');
    const [payeTaxEnabled, setPayeTaxEnabled] = useState(false);
    const [payeTaxBrackets, setPayeTaxBrackets] = useState([]);

    const fetchWhatsappStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            if (res.ok) {
                const data = await res.json();
                setWhatsappStatus(data.state);
                setWhatsappQr(data.qr);
                setWhatsappProfile(data.profile);
            } else {
                setWhatsappStatus('OFFLINE');
            }
        } catch (err) {
            setWhatsappStatus('OFFLINE');
        }
    };

    useEffect(() => {
        if (tab === 'whatsapp') {
            fetchWhatsappStatus();
            const interval = setInterval(() => {
                fetchWhatsappStatus();
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [tab]);

    const handleConnectWhatsapp = async () => {
        try {
            setWhatsappStatus('CONNECTING');
            const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
            if (res.ok) {
                fetchWhatsappStatus();
            } else {
                toast.error('Failed to initiate connection');
            }
        } catch {
            toast.error('Failed to initiate connection');
        }
    };

    const handleDisconnectWhatsapp = async () => {
        const confirmed = await confirmDialog('Are you sure you want to disconnect WhatsApp and clear the session?', {
            danger: true,
            confirmLabel: 'Disconnect'
        });
        if (!confirmed) return;

        try {
            setWhatsappStatus('LOADING');
            const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
            if (res.ok) {
                toast.success('WhatsApp disconnected');
                fetchWhatsappStatus();
            } else {
                toast.error('Failed to disconnect');
            }
        } catch {
            toast.error('Failed to disconnect');
        }
    };

    const handleSendTestMessage = async () => {
        if (!testNumber.trim() || !testMessage.trim()) {
            toast.error('Please specify both test phone number and message content');
            return;
        }
        setSendingTest(true);
        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: testNumber.trim(), message: testMessage.trim() })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Test WhatsApp message sent successfully!');
            } else {
                toast.error(data.error || 'Failed to send test message');
            }
        } catch {
            toast.error('Network error sending test message');
        } finally {
            setSendingTest(false);
        }
    };

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

        setWhatsappEnabled(settings.whatsapp_enabled === 'true');
        setWhatsappAutoSendOrder(settings.whatsapp_auto_send_order === 'true');
        setWhatsappAutoSendDispatch(settings.whatsapp_auto_send_dispatch === 'true');
        setWhatsappAutoSendReady(settings.whatsapp_auto_send_ready === 'true');
        setWhatsappTemplateOrder(settings.whatsapp_template_order || 'Hello {customer_name}, your order {order_code} has been successfully created. View status: {portal_link}');
        setWhatsappTemplateDispatch(settings.whatsapp_template_dispatch || 'Hello {customer_name}, your order {order_code} is now ready/delivered. View status: {portal_link}');
        setWhatsappTemplateReady(settings.whatsapp_template_ready || 'Hi {customer_name}, your order {order_code} is completed and ready for pickup/delivery! Thank you for choosing Pressmatics.');
        setWhatsappTemplateWelcome(settings.whatsapp_template_welcome || 'Hello {customer_name}, welcome to Pressmatics ERP. You can access your portal here: {portal_link}');
        setWhatsappTemplateQuote(settings.whatsapp_template_quote || 'Hello {customer_name}, here is your quotation {quote_code} for {quote_amount}. You can view it here: {portal_link}');

        // Initialize Loyalty settings
        setLoyaltyEnabled(settings.loyalty_enabled !== 'false');
        try {
            const parsedRewards = settings.loyalty_rewards ? JSON.parse(settings.loyalty_rewards) : [
                { id: 'v5', title: '5% Off Voucher', cost: 500, desc: 'Receive a 5% discount code valid for your next print order.' },
                { id: 'v10', title: '10% Off Voucher', cost: 1000, desc: 'Receive a 10% discount code valid for your next print order.' },
                { id: 'v20', title: '20% Off Voucher', cost: 1800, desc: 'Receive a 20% discount code valid for your next print order.' },
                { id: 'vfree', title: 'Free Delivery', cost: 300, desc: 'Waive the shipping/handling fee on your next print delivery.' }
            ];
            setLoyaltyRewards(parsedRewards);
        } catch (e) {
            setLoyaltyRewards([]);
        }

        // Initialize Payroll & Tax settings
        setEpfEmployeePct(settings.epf_employee_pct || '8');
        setEpfEmployerPct(settings.epf_employer_pct || '12');
        setEtfEmployerPct(settings.etf_employer_pct || '3');
        setBr1Amount(settings.br1_amount || '0');
        setBr2Amount(settings.br2_amount || '0');
        setPayeTaxEnabled(settings.paye_tax_enabled === 'true');
        try {
            setPayeTaxBrackets(settings.paye_tax_brackets ? JSON.parse(settings.paye_tax_brackets) : [
                { min: 0, max: 100000, rate: 0 },
                { min: 100000, max: 140000, rate: 6 },
                { min: 140000, max: 180000, rate: 12 },
                { min: 180000, max: 220000, rate: 18 },
                { min: 220000, max: 260000, rate: 24 },
                { min: 260000, max: 300000, rate: 30 },
                { min: 300000, max: 99999999, rate: 36 }
            ]);
        } catch {
            setPayeTaxBrackets([]);
        }
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
            ['whatsapp_enabled', whatsappEnabled ? 'true' : 'false'],
            ['whatsapp_auto_send_order', whatsappAutoSendOrder ? 'true' : 'false'],
            ['whatsapp_auto_send_dispatch', whatsappAutoSendDispatch ? 'true' : 'false'],
            ['whatsapp_auto_send_ready', whatsappAutoSendReady ? 'true' : 'false'],
            ['whatsapp_template_order', whatsappTemplateOrder],
            ['whatsapp_template_dispatch', whatsappTemplateDispatch],
            ['whatsapp_template_ready', whatsappTemplateReady],
            ['whatsapp_template_welcome', whatsappTemplateWelcome],
            ['whatsapp_template_quote', whatsappTemplateQuote],
            ['loyalty_enabled', loyaltyEnabled ? 'true' : 'false'],
            ['loyalty_rewards', JSON.stringify(loyaltyRewards)],
            ['epf_employee_pct', epfEmployeePct],
            ['epf_employer_pct', epfEmployerPct],
            ['etf_employer_pct', etfEmployerPct],
            ['br1_amount', br1Amount],
            ['br2_amount', br2Amount],
            ['paye_tax_enabled', payeTaxEnabled ? 'true' : 'false'],
            ['paye_tax_brackets', JSON.stringify(payeTaxBrackets)],
        ];
        let ok = true;
        for (const [key, val] of updates) { if (!(await updateSetting(key, val))) ok = false; }
        if (ok) {
            toast.success('Settings saved successfully');
        }
        setSaving(false);
    };

    const handleSaveTasks = async () => {
        setSavingTasks(true);
        try {
            const res = await fetch('/api/settings/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configs: taskConfigs })
            });
            if (res.ok) {
                toast.success('Task configurations saved successfully');
                fetchTaskConfigs();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save task configurations');
            }
        } catch (err) {
            toast.error('Error saving task configurations');
        } finally {
            setSavingTasks(false);
        }
    };

    const moveConfig = (index, direction) => {
        const newConfigs = [...taskConfigs];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newConfigs.length) return;
        
        const temp = newConfigs[index];
        newConfigs[index] = newConfigs[targetIndex];
        newConfigs[targetIndex] = temp;
        
        // Re-assign display_orders based on the new array index (index * 10)
        newConfigs.forEach((c, idx) => {
            c.display_order = (idx + 1) * 10;
        });
        
        setTaskConfigs(newConfigs);
    };

    return (
        <div className="text-white w-full">
            {/* ── Page header ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Settings</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Configure your ERP system preferences</p>
                </div>
                {tab !== 'data' && tab !== 'tasks' && (
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50">
                        <FiSave className="w-4 h-4" />
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                )}
                {tab === 'tasks' && (
                    <button onClick={handleSaveTasks} disabled={savingTasks || loadingTasks}
                        className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50">
                        <FiSave className="w-4 h-4" />
                        {savingTasks ? 'Saving…' : 'Save Task Configs'}
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

            {/* TASKS TAB */}
            {tab === 'tasks' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl px-5 py-4 bg-black/20">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5"><FiList className="w-4 h-4 text-gray-400" /></div>
                            <div>
                                <h2 className="text-sm font-semibold text-white">Default Task Templates</h2>
                                <p className="text-xs text-gray-500 mt-0.5 font-medium">Configure default tasks generated for new sales orders, their execution order, and whether they separate for Back-to-Back (BB) jobs.</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => {
                            const newOrder = taskConfigs.length ? Math.max(...taskConfigs.map(c => c.display_order)) + 10 : 10;
                            setTaskConfigs([...taskConfigs, {
                                task_key: 'custom',
                                name: 'New Default Task',
                                description: 'Custom default task description',
                                display_order: newOrder,
                                is_bb_separated: 0,
                                estimated_minutes: null,
                                is_enabled: 1
                            }]);
                        }} className="flex items-center gap-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-xl transition-all cursor-pointer">
                            <FiPlus className="w-3.5 h-3.5" />
                            Add Default Task
                        </button>
                    </div>

                    {loadingTasks ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
                            <span className="text-xs font-medium">Loading configurations...</span>
                        </div>
                    ) : (
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/[0.05] bg-white/[0.01]">
                                            <th className="p-4 w-16 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Active</th>
                                            <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                                            <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Task Name / Label</th>
                                            <th className="p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</th>
                                            <th className="p-4 w-44 text-xs font-semibold text-gray-400 uppercase tracking-wider">Assigned Machine</th>
                                            <th className="p-4 w-32 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Order</th>
                                            <th className="p-4 w-28 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">BB Separate</th>
                                            <th className="p-4 w-32 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Est. Mins</th>
                                            <th className="p-4 w-12 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {taskConfigs.map((c, index) => (
                                            <tr key={index} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                                                <td className="p-4 text-center">
                                                    <input type="checkbox" checked={c.is_enabled === 1}
                                                        onChange={(e) => {
                                                            const copy = [...taskConfigs];
                                                            copy[index].is_enabled = e.target.checked ? 1 : 0;
                                                            setTaskConfigs(copy);
                                                        }}
                                                        className="rounded border-white/20 bg-black/30 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer" />
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    {getTaskTypeBadge(c.task_key)}
                                                </td>
                                                <td className="p-4">
                                                    <input type="text" value={c.name}
                                                        onChange={(e) => {
                                                            const copy = [...taskConfigs];
                                                            copy[index].name = e.target.value;
                                                            setTaskConfigs(copy);
                                                        }}
                                                        className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30 w-full transition-colors" />
                                                </td>
                                                <td className="p-4">
                                                    <input type="text" value={c.description || ''}
                                                        onChange={(e) => {
                                                            const copy = [...taskConfigs];
                                                            copy[index].description = e.target.value;
                                                            setTaskConfigs(copy);
                                                        }}
                                                        placeholder="Optional description"
                                                        className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30 w-full transition-colors placeholder-gray-700" />
                                                </td>
                                                <td className="p-4">
                                                    {c.task_key.startsWith('machine_') ? (
                                                        <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-md font-semibold uppercase tracking-wider">Auto-Bound</span>
                                                    ) : (
                                                        <select value={c.machine_id || ''}
                                                            onChange={(e) => {
                                                                const copy = [...taskConfigs];
                                                                copy[index].machine_id = e.target.value === '' ? null : parseInt(e.target.value);
                                                                setTaskConfigs(copy);
                                                            }}
                                                            className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-white/30 w-full max-w-[170px] transition-colors cursor-pointer">
                                                            <option value="" className="bg-[#18181b] text-gray-400">None (Dynamic)</option>
                                                            {machines.map(m => (
                                                                <option key={m.id} value={m.id} className="bg-[#18181b] text-white">
                                                                    {m.name} ({m.type})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button type="button" onClick={() => moveConfig(index, -1)} disabled={index === 0}
                                                            className="p-1 hover:bg-white/5 disabled:opacity-20 rounded-lg text-gray-400 hover:text-white transition-all cursor-pointer">
                                                            <FiArrowUp className="w-3.5 h-3.5" />
                                                        </button>
                                                        <input type="number" value={c.display_order}
                                                            onChange={(e) => {
                                                                const copy = [...taskConfigs];
                                                                copy[index].display_order = parseInt(e.target.value) || 0;
                                                                setTaskConfigs(copy.sort((a, b) => a.display_order - b.display_order));
                                                            }}
                                                            className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-white/30 w-12 text-center transition-colors font-mono" />
                                                        <button type="button" onClick={() => moveConfig(index, 1)} disabled={index === taskConfigs.length - 1}
                                                            className="p-1 hover:bg-white/5 disabled:opacity-20 rounded-lg text-gray-400 hover:text-white transition-all cursor-pointer">
                                                            <FiArrowDown className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex justify-center">
                                                        <input type="checkbox" checked={c.is_bb_separated === 1}
                                                            onChange={(e) => {
                                                                const copy = [...taskConfigs];
                                                                copy[index].is_bb_separated = e.target.checked ? 1 : 0;
                                                                setTaskConfigs(copy);
                                                            }}
                                                            className="rounded border-white/20 bg-black/30 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer" />
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <input type="number" value={c.estimated_minutes ?? ''}
                                                        onChange={(e) => {
                                                            const copy = [...taskConfigs];
                                                            copy[index].estimated_minutes = e.target.value === '' ? null : parseInt(e.target.value);
                                                            setTaskConfigs(copy);
                                                        }}
                                                        placeholder="Auto"
                                                        className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30 w-20 text-center transition-colors font-mono placeholder-gray-600" />
                                                </td>
                                                <td className="p-4 text-center">
                                                    {c.task_key === 'custom' ? (
                                                        <button type="button" onClick={() => {
                                                            setTaskConfigs(prev => prev.filter((_, idx) => idx !== index));
                                                        }} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-white/5 rounded-lg transition-colors">
                                                            <FiX className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-gray-600 uppercase">System</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* WHATSAPP TAB */}
            {tab === 'whatsapp' && (
                <div className="space-y-6">
                    {/* Header Card / Status Indicator */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h2 className="text-lg font-bold text-white">WhatsApp Integration Status</h2>
                                <p className="text-gray-500 text-xs mt-1">
                                    Link your phone number to automatically send messages on status updates and templates.
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                {whatsappStatus === 'CONNECTED' && (
                                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Connected: {whatsappProfile?.name} (+{whatsappProfile?.number})
                                    </span>
                                )}
                                {whatsappStatus === 'CONNECTING' && (
                                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                                        <span className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                        Initializing Connection...
                                    </span>
                                )}
                                {whatsappStatus === 'QR' && (
                                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                                        Scan QR Code below
                                    </span>
                                )}
                                {whatsappStatus === 'DISCONNECTED' && (
                                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                                        Disconnected
                                    </span>
                                )}
                                {whatsappStatus === 'OFFLINE' && (
                                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
                                        WhatsApp Service Offline (Port 5001)
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Connection interface */}
                        <div className="mt-6 border-t border-white/[0.08] pt-6">
                            {whatsappStatus === 'OFFLINE' && (
                                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-center">
                                    <p className="text-sm text-red-300 font-semibold">WhatsApp Daemon service is not running.</p>
                                    <p className="text-xs text-red-400/70 mt-1">Please start the service by running <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono">node whatsapp/server.js</code> on the backend.</p>
                                </div>
                            )}

                            {whatsappStatus === 'DISCONNECTED' && (
                                <div className="text-center py-6">
                                    <button type="button" onClick={handleConnectWhatsapp}
                                        className="bg-white text-black px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer">
                                        Link WhatsApp Account
                                    </button>
                                </div>
                            )}

                            {whatsappStatus === 'QR' && whatsappQr && (
                                <div className="flex flex-col items-center justify-center py-6">
                                    <div className="bg-white p-4 rounded-2xl shadow-xl">
                                        <img src={whatsappQr} alt="WhatsApp QR Code" className="w-56 h-56" />
                                    </div>
                                    <p className="text-sm text-gray-300 font-semibold mt-4">Scan the QR code with WhatsApp on your phone</p>
                                    <p className="text-xs text-gray-500 mt-1">Open WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a Device.</p>
                                </div>
                            )}

                            {whatsappStatus === 'CONNECTING' && (
                                <div className="text-center py-10">
                                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
                                    <p className="text-xs text-gray-400">Negotiating WhatsApp servers connection...</p>
                                </div>
                            )}

                            {whatsappStatus === 'CONNECTED' && (
                                <div className="flex flex-col items-center justify-center py-6">
                                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-5 w-full max-w-md">
                                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-xl font-bold text-emerald-400">
                                            {whatsappProfile?.name?.charAt(0) || 'W'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{whatsappProfile?.name}</p>
                                            <p className="text-xs text-gray-400 mt-0.5 font-mono">+{whatsappProfile?.number}</p>
                                        </div>
                                        <button type="button" onClick={handleDisconnectWhatsapp}
                                            className="px-4 py-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-semibold transition-colors cursor-pointer">
                                            Disconnect
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Messaging Rules Card */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Automated Notification Rules</h3>
                        
                        <div className="grid sm:grid-cols-2 gap-6 pt-2">
                            {/* Master toggle */}
                            <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                                <div>
                                    <p className="text-sm font-semibold text-white">Enable WhatsApp Notifications</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Allow the system to send automatic text alerts.</p>
                                </div>
                                <div className="relative">
                                    <input type="checkbox" id="wa_enabled" checked={whatsappEnabled} onChange={e => setWhatsappEnabled(e.target.checked)} className="sr-only" />
                                    <div onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                                        className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${whatsappEnabled ? 'bg-white' : 'bg-white/10'}`}>
                                        <div className={`w-4 h-4 bg-black rounded-full mt-0.5 transition-transform ${whatsappEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Order Created */}
                            <div className={`flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl transition-opacity ${!whatsappEnabled && 'opacity-40 pointer-events-none'}`}>
                                <div>
                                    <p className="text-sm font-semibold text-white">Send on Order Created</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Send a confirmation when a Sales Order is generated.</p>
                                </div>
                                <div className="relative">
                                    <input type="checkbox" id="wa_auto_order" checked={whatsappAutoSendOrder} onChange={e => setWhatsappAutoSendOrder(e.target.checked)} className="sr-only" />
                                    <div onClick={() => setWhatsappAutoSendOrder(!whatsappAutoSendOrder)}
                                        className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${whatsappAutoSendOrder ? 'bg-white' : 'bg-white/10'}`}>
                                        <div className={`w-4 h-4 bg-black rounded-full mt-0.5 transition-transform ${whatsappAutoSendOrder ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Order Dispatch */}
                            <div className={`flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl transition-opacity ${!whatsappEnabled && 'opacity-40 pointer-events-none'}`}>
                                <div>
                                    <p className="text-sm font-semibold text-white">Send on Completion/Delivery</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Notify the customer when status is marked "Delivered".</p>
                                </div>
                                <div className="relative">
                                    <input type="checkbox" id="wa_auto_dispatch" checked={whatsappAutoSendDispatch} onChange={e => setWhatsappAutoSendDispatch(e.target.checked)} className="sr-only" />
                                    <div onClick={() => setWhatsappAutoSendDispatch(!whatsappAutoSendDispatch)}
                                        className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${whatsappAutoSendDispatch ? 'bg-white' : 'bg-white/10'}`}>
                                        <div className={`w-4 h-4 bg-black rounded-full mt-0.5 transition-transform ${whatsappAutoSendDispatch ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Order Ready */}
                            <div className={`flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl transition-opacity ${!whatsappEnabled && 'opacity-40 pointer-events-none'}`}>
                                <div>
                                    <p className="text-sm font-semibold text-white">Send on Order Ready</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Notify the customer when all tasks are completed and order is "Ready".</p>
                                </div>
                                <div className="relative">
                                    <input type="checkbox" id="wa_auto_ready" checked={whatsappAutoSendReady} onChange={e => setWhatsappAutoSendReady(e.target.checked)} className="sr-only" />
                                    <div onClick={() => setWhatsappAutoSendReady(!whatsappAutoSendReady)}
                                        className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${whatsappAutoSendReady ? 'bg-white' : 'bg-white/10'}`}>
                                        <div className={`w-4 h-4 bg-black rounded-full mt-0.5 transition-transform ${whatsappAutoSendReady ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Customize Templates Card */}
                    <div className={`bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6 transition-opacity ${!whatsappEnabled && 'opacity-40 pointer-events-none'}`}>
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Message Templates</h3>
                            <p className="text-xs text-gray-500 mt-1 font-medium">
                                Customize the notification content. Placeholders: <code className="bg-white/10 px-1 rounded text-white font-mono">{`{customer_name}`}</code>, <code className="bg-white/10 px-1 rounded text-white font-mono">{`{order_code}`}</code>, <code className="bg-white/10 px-1 rounded text-white font-mono">{`{quote_code}`}</code>, <code className="bg-white/10 px-1 rounded text-white font-mono">{`{quote_amount}`}</code>, <code className="bg-white/10 px-1 rounded text-white font-mono">{`{portal_link}`}</code>, <code className="bg-white/10 px-1 rounded text-white font-mono">{`{order_status}`}</code>, <code className="bg-white/10 px-1 rounded text-white font-mono">{`{delivery_date}`}</code>.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <Field label="Sales Order Created Template">
                                <TextArea value={whatsappTemplateOrder} onChange={e => setWhatsappTemplateOrder(e.target.value)} placeholder="Enter template text..." />
                            </Field>
                            
                            <Field label="Sales Order Delivered/Dispatched Template">
                                <TextArea value={whatsappTemplateDispatch} onChange={e => setWhatsappTemplateDispatch(e.target.value)} placeholder="Enter template text..." />
                            </Field>

                            <Field label="Sales Order Ready Template">
                                <TextArea value={whatsappTemplateReady} onChange={e => setWhatsappTemplateReady(e.target.value)} placeholder="Enter template text..." />
                            </Field>

                            <Field label="Customer Welcome/Registration Greeting Template">
                                <TextArea value={whatsappTemplateWelcome} onChange={e => setWhatsappTemplateWelcome(e.target.value)} placeholder="Enter welcome template text..." />
                            </Field>

                            <Field label="Quotation Shared Template">
                                <TextArea value={whatsappTemplateQuote} onChange={e => setWhatsappTemplateQuote(e.target.value)} placeholder="Enter quote template text..." />
                            </Field>
                        </div>
                    </div>

                    {/* Direct Test Message Card */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Test WhatsApp Connection</h3>
                            <p className="text-xs text-gray-500 mt-1 font-medium">
                                Send a live text message directly to check if the connection is functional.
                            </p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5">
                            <Field label="Test Phone Number" hint="e.g. +94771234567 or 0771234567">
                                <TextInput value={testNumber} onChange={e => setTestNumber(e.target.value)} placeholder="0771234567" />
                            </Field>
                            <Field label="Message Text">
                                <TextInput value={testMessage} onChange={e => setTestMessage(e.target.value)} placeholder="Test message contents" />
                            </Field>
                        </div>

                        <div className="flex justify-end">
                            <button type="button" onClick={handleSendTestMessage} disabled={sendingTest || whatsappStatus !== 'CONNECTED'}
                                className="bg-white text-black px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer">
                                {sendingTest ? 'Sending...' : 'Send Test Message'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LOYALTY TAB */}
            {tab === 'loyalty' && (
                <div className="space-y-4">
                    <SectionCard title="Loyalty & Rewards Program Configuration" icon={FiAward}>
                        <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                            <div className="relative">
                                <input type="checkbox" id="loyalty_enb" checked={loyaltyEnabled} onChange={e => setLoyaltyEnabled(e.target.checked)}
                                    className="sr-only" />
                                <div onClick={() => setLoyaltyEnabled(v => !v)}
                                    className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${loyaltyEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                                    <div className={`w-4 h-4 bg-black rounded-full mt-0.5 transition-transform ${loyaltyEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                                </div>
                            </div>
                            <label htmlFor="loyalty_enb" className="text-sm text-gray-300 cursor-pointer" onClick={() => setLoyaltyEnabled(v => !v)}>
                                Enable Loyalty Points Program in Customer Portal
                            </label>
                        </div>
                    </SectionCard>

                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Available Rewards</h3>
                                <p className="text-xs text-gray-500 mt-1 font-medium">
                                    Configure the reward vouchers that customers can redeem with their loyalty points.
                                </p>
                            </div>
                        </div>

                        {/* List of rewards */}
                        <div className="space-y-3">
                            {loyaltyRewards.map((reward) => (
                                <div key={reward.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 border border-white/10 rounded-xl bg-black/20">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-white">{reward.title}</span>
                                            <span className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                                                {reward.cost} points
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400">{reward.desc}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRewardId(reward.id);
                                                setRewardTitle(reward.title);
                                                setRewardCost(String(reward.cost));
                                                setRewardDesc(reward.desc);
                                            }}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                                            title="Edit Reward"
                                        >
                                            <FiEdit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLoyaltyRewards(prev => prev.filter(r => r.id !== reward.id));
                                                toast.success('Reward removed from list (remember to Save Changes)');
                                            }}
                                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                            title="Delete Reward"
                                        >
                                            <FiX className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {loyaltyRewards.length === 0 && (
                                <p className="text-sm italic text-gray-500 text-center py-4">No rewards configured. Add a reward below.</p>
                            )}
                        </div>

                        {/* Add/Edit Reward Form */}
                        <div className="pt-4 border-t border-white/5 space-y-4">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                {rewardId ? 'Edit Selected Reward' : 'Add New Reward'}
                            </h4>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <Field label="Reward Title">
                                    <TextInput value={rewardTitle} onChange={e => setRewardTitle(e.target.value)} placeholder="e.g. 15% Off Voucher" />
                                </Field>
                                <Field label="Points Cost">
                                    <TextInput type="number" value={rewardCost} onChange={e => setRewardCost(e.target.value)} placeholder="e.g. 1500" />
                                </Field>
                                <Field label="Description" className="sm:col-span-2">
                                    <TextInput value={rewardDesc} onChange={e => setRewardDesc(e.target.value)} placeholder="e.g. Receive a 15% discount code valid for your next print order." />
                                </Field>
                            </div>

                            <div className="flex justify-end gap-2">
                                {rewardId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRewardId('');
                                            setRewardTitle('');
                                            setRewardCost('');
                                            setRewardDesc('');
                                        }}
                                        className="px-4 py-2 border border-white/10 hover:bg-white/5 text-xs font-semibold rounded-xl transition-all cursor-pointer text-gray-400"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!rewardTitle.trim() || !rewardCost.trim() || !rewardDesc.trim()) {
                                            toast.error('All reward fields are required!');
                                            return;
                                        }
                                        const costNum = parseInt(rewardCost, 10);
                                        if (isNaN(costNum) || costNum <= 0) {
                                            toast.error('Points cost must be a valid positive integer!');
                                            return;
                                        }

                                        if (rewardId) {
                                            // Edit existing
                                            setLoyaltyRewards(prev => prev.map(r => r.id === rewardId ? { id: r.id, title: rewardTitle.trim(), cost: costNum, desc: rewardDesc.trim() } : r));
                                            toast.success('Reward updated in list (remember to Save Changes)');
                                        } else {
                                            // Add new
                                            const newId = `vcustom_${Date.now()}`;
                                            setLoyaltyRewards(prev => [...prev, { id: newId, title: rewardTitle.trim(), cost: costNum, desc: rewardDesc.trim() }]);
                                            toast.success('Reward added to list (remember to Save Changes)');
                                        }

                                        // Reset inputs
                                        setRewardId('');
                                        setRewardTitle('');
                                        setRewardCost('');
                                        setRewardDesc('');
                                    }}
                                    className="bg-white text-black px-4 py-2 text-xs font-semibold rounded-xl hover:bg-gray-100 transition-all cursor-pointer"
                                >
                                    {rewardId ? 'Apply Updates' : 'Add Reward'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAYROLL TAB */}
            {tab === 'payroll' && (
                <div className="space-y-4">
                    <SectionCard title="EPF & ETF Percentages" icon={FiDollarSign}>
                        <div className="grid sm:grid-cols-3 gap-5">
                            <Field label="EPF Employee Deduction (%)" hint="Default percentage deducted from employee salary (typically 8%)">
                                <TextInput type="number" value={epfEmployeePct} onChange={e => setEpfEmployeePct(e.target.value)} placeholder="8" />
                            </Field>
                            <Field label="EPF Employer Contribution (%)" hint="Default percentage added by employer (typically 12%)">
                                <TextInput type="number" value={epfEmployerPct} onChange={e => setEpfEmployerPct(e.target.value)} placeholder="12" />
                            </Field>
                            <Field label="ETF Employer Contribution (%)" hint="Default percentage added by employer (typically 3%)">
                                <TextInput type="number" value={etfEmployerPct} onChange={e => setEtfEmployerPct(e.target.value)} placeholder="3" />
                            </Field>
                        </div>
                    </SectionCard>

                    <SectionCard title="Budgetary Relief Allowances (BR1 & BR2)" icon={FiDollarSign}>
                        <div className="grid sm:grid-cols-2 gap-5">
                            <Field label="BR1 Amount (LKR)" hint="Budgetary Relief 1 added to basic salary for calculations">
                                <TextInput type="number" value={br1Amount} onChange={e => setBr1Amount(e.target.value)} placeholder="0.00" />
                            </Field>
                            <Field label="BR2 Amount (LKR)" hint="Budgetary Relief 2 added to basic salary for calculations">
                                <TextInput type="number" value={br2Amount} onChange={e => setBr2Amount(e.target.value)} placeholder="0.00" />
                            </Field>
                        </div>
                    </SectionCard>

                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">PAYE Tax Configuration</h3>
                                <p className="text-xs text-gray-500 mt-1 font-medium">
                                    Configure tax brackets dynamically applied on gross monthly salaries.
                                </p>
                            </div>
                            <div className="relative">
                                <input type="checkbox" id="paye_enb" checked={payeTaxEnabled} onChange={e => setPayeTaxEnabled(e.target.checked)} className="sr-only" />
                                <div onClick={() => setPayeTaxEnabled(!payeTaxEnabled)}
                                    className={`w-10 h-5 rounded-full cursor-pointer transition-colors ${payeTaxEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                                    <div className={`w-4 h-4 bg-black rounded-full mt-0.5 transition-transform ${payeTaxEnabled ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                                </div>
                            </div>
                        </div>

                        {payeTaxEnabled && (
                            <div className="space-y-4 pt-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-white uppercase">Tax Brackets</span>
                                    <button type="button" onClick={() => {
                                        setPayeTaxBrackets(prev => [...prev, { min: 0, max: 0, rate: 0 }]);
                                    }} className="flex items-center gap-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-1.5 rounded-xl transition-all cursor-pointer">
                                        <FiPlus className="w-3.5 h-3.5" />
                                        Add Bracket
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {payeTaxBrackets.map((bracket, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row items-center gap-4 bg-black/20 border border-white/10 p-3 rounded-xl">
                                            <div className="flex-1 w-full">
                                                <label className="block text-[10px] text-gray-400 font-semibold mb-1 uppercase">Min Salary (LKR)</label>
                                                <input type="number" value={bracket.min}
                                                    onChange={(e) => {
                                                        const copy = [...payeTaxBrackets];
                                                        copy[index].min = parseFloat(e.target.value) || 0;
                                                        setPayeTaxBrackets(copy);
                                                    }}
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30 transition-colors" />
                                            </div>
                                            <div className="flex-1 w-full">
                                                <label className="block text-[10px] text-gray-400 font-semibold mb-1 uppercase">Max Salary (LKR)</label>
                                                <input type="number" value={bracket.max}
                                                    onChange={(e) => {
                                                        const copy = [...payeTaxBrackets];
                                                        copy[index].max = parseFloat(e.target.value) || 0;
                                                        setPayeTaxBrackets(copy);
                                                    }}
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30 transition-colors" />
                                            </div>
                                            <div className="w-full sm:w-28">
                                                <label className="block text-[10px] text-gray-400 font-semibold mb-1 uppercase">Rate (%)</label>
                                                <input type="number" value={bracket.rate}
                                                    onChange={(e) => {
                                                        const copy = [...payeTaxBrackets];
                                                        copy[index].rate = parseFloat(e.target.value) || 0;
                                                        setPayeTaxBrackets(copy);
                                                    }}
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-white/30 transition-colors" />
                                            </div>
                                            <div className="pt-4">
                                                <button type="button" onClick={() => {
                                                    setPayeTaxBrackets(prev => prev.filter((_, idx) => idx !== index));
                                                }} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer">
                                                    <FiX className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {payeTaxBrackets.length === 0 && (
                                        <p className="text-xs italic text-gray-500 text-center py-2">No tax brackets defined. Add a bracket to start taxing.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
