'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { 
    FiDollarSign, FiCalendar, FiPlus, FiEye, FiCheck, 
    FiTrash2, FiAlertCircle, FiSettings, FiEdit, FiX, FiDownload, FiChevronUp, FiChevronDown
} from 'react-icons/fi';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender
} from '@tanstack/react-table';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { numericOperatorFilterFn } from '@/lib/numericFilter';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function ColumnFilter({ column }) {
    const val = column.getFilterValue() ?? '';
    return (
        <input 
            value={val} 
            onChange={e => column.setFilterValue(e.target.value)} 
            placeholder="Filter…"
            onClick={e => e.stopPropagation()}
            className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/30 font-normal" 
        />
    );
}

export default function PayrollPage() {
    const [tab, setTab] = useState('runs'); // 'runs', 'generate', 'config'
    const [runs, setRuns] = useState([]);
    const [employees, setEmployees] = useState([]); // For Quick Config
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Run Generator Settings
    const [genYear, setGenYear] = useState(new Date().getFullYear());
    const [genMonth, setGenMonth] = useState(new Date().getMonth() + 1); // 1-12
    const [activeRun, setActiveRun] = useState(null); // Current run loaded in detail view
    const [activeRunPayslips, setActiveRunPayslips] = useState([]);
    const [warnings, setWarnings] = useState([]);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [previewPayslip, setPreviewPayslip] = useState(null);
    
    // Quick Config Local Changes State
    const [configChanges, setConfigChanges] = useState({}); // empId -> changes object
    const [columnFilters, setColumnFilters] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [exportingPdf, setExportingPdf] = useState(false);

    const handleExportPDF = async () => {
        setExportingPdf(true);
        try {
            const visibleCols = table.getVisibleLeafColumns()
                .filter(col => col.id !== 'actions')
                .map(col => ({
                    key: col.id || col.columnDef.accessorKey,
                    header: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
                }));

            const filteredRows = table.getFilteredRowModel().rows.map(row => {
                const run = row.original;
                return {
                    ...run,
                    period: `${MONTHS[run.month - 1]} ${run.year}`,
                    outlay: run.total_payroll_amount
                };
            });

            const res = await fetch('/api/pdf/dynamic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Payroll History Report',
                    subtitle: 'Exported Payroll Runs List (Customized & Filtered)',
                    columns: visibleCols.map(c => c.key === 'period' ? { key: 'period', header: 'Payroll Period' } : c.key === 'total_payroll_amount' ? { key: 'outlay', header: 'Total Outlay' } : c),
                    rows: filteredRows,
                    currency: 'LKR'
                })
            });

            if (!res.ok) {
                toast.error('Failed to generate PDF');
                setExportingPdf(false);
                return;
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll_history_report_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Export PDF error:', error);
            toast.error('An error occurred while generating PDF');
        } finally {
            setExportingPdf(false);
        }
    };

    const handleExportPayslipsPDF = async () => {
        if (!activeRun) return;
        setExportingPdf(true);
        try {
            const cols = [
                { key: 'employee_name', header: 'Employee' },
                { key: 'pay_type', header: 'Pay Type' },
                { key: 'base_salary', header: 'Base Salary' },
                { key: 'total_hours_worked', header: 'Hours Worked' },
                { key: 'overtime_hours', header: 'OT Hours' },
                { key: 'overtime_pay', header: 'OT Pay' },
                { key: 'allowances', header: 'Allowances' },
                { key: 'deductions', header: 'Deductions' },
                { key: 'net_pay', header: 'Net Pay' }
            ];

            const res = await fetch('/api/pdf/dynamic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Payroll Sheet - ${MONTHS[activeRun.month - 1]} ${activeRun.year}`,
                    subtitle: `Status: ${activeRun.status.toUpperCase()} | Total Outlay: LKR ${activeRunPayslips.reduce((acc, p) => acc + parseFloat(p.net_pay), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                    columns: cols,
                    rows: activeRunPayslips,
                    currency: 'LKR'
                })
            });

            if (!res.ok) {
                toast.error('Failed to generate PDF');
                setExportingPdf(false);
                return;
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payslips_sheet_${MONTHS[activeRun.month - 1]}_${activeRun.year}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            console.error('Export PDF error:', error);
            toast.error('An error occurred while generating PDF');
        } finally {
            setExportingPdf(false);
        }
    };

    const SortIcon = ({ dir }) => {
        if (!dir) return <span className="opacity-20 text-zinc-500">⇅</span>;
        return dir === 'asc' ? <FiChevronUp className="w-3.5 h-3.5 text-white" /> : <FiChevronDown className="w-3.5 h-3.5 text-white" />;
    };

    const columns = useMemo(() => [
        {
            id: 'period',
            header: 'Payroll Period',
            accessorFn: run => `${MONTHS[run.month - 1]} ${run.year}`,
            cell: ({ row }) => (
                <span className="font-semibold text-white">
                    {MONTHS[row.original.month - 1]} {row.original.year}
                </span>
            )
        },
        {
            accessorKey: 'employee_count',
            header: 'Employees Paid',
            filterFn: numericOperatorFilterFn,
            cell: ({ getValue }) => <span className="text-zinc-300">{getValue()} employees</span>
        },
        {
            accessorKey: 'total_payroll_amount',
            header: 'Total Outlay',
            filterFn: numericOperatorFilterFn,
            cell: ({ getValue }) => (
                <span className="font-mono font-bold text-white">
                    LKR {parseFloat(getValue() || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ getValue }) => (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                    getValue() === 'paid' 
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                        : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                }`}>
                    {getValue()}
                </span>
            )
        },
        {
            accessorKey: 'created_at',
            header: 'Created At',
            cell: ({ getValue }) => (
                <span className="text-zinc-500 font-mono">
                    {new Date(getValue()).toLocaleDateString()}
                </span>
            )
        },
        {
            id: 'actions',
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const run = row.original;
                return (
                    <div className="flex gap-2 justify-end">
                        <button 
                            onClick={() => loadRunDetails(run.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg transition-all cursor-pointer"
                        >
                            <FiEye className="w-3.5 h-3.5" /> Details
                        </button>
                        {run.status === 'draft' && (
                            <button 
                                onClick={() => finalizePayrollRun(run.id, 'paid')}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all cursor-pointer"
                            >
                                <FiCheck className="w-3.5 h-3.5" /> Finalize (Paid)
                            </button>
                        )}
                        <button 
                            onClick={() => deletePayrollRun(run.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer animate-colors"
                            title="Delete payroll run"
                        >
                            <FiTrash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            }
        }
    ], []);

    const table = useReactTable({
        data: runs,
        columns,
        state: {
            columnFilters,
            columnVisibility,
        },
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: {
                pageSize: 15
            }
        }
    });

    const loadRuns = async () => {
        try {
            const res = await fetch('/api/payroll/runs');
            const data = await res.json();
            if (res.ok) {
                setRuns(Array.isArray(data) ? data : []);
            }
        } catch {
            toast.error('Failed to load payroll history');
        }
    };

    const loadEmployees = async () => {
        try {
            const res = await fetch('/api/employees');
            const data = await res.json();
            if (res.ok) {
                setEmployees(Array.isArray(data) ? data : []);
            }
        } catch {
            toast.error('Failed to load employees list');
        }
    };

    const loadAll = async () => {
        setLoading(true);
        if (tab === 'runs') {
            await loadRuns();
        } else if (tab === 'config') {
            await loadEmployees();
            setConfigChanges({});
        }
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, [tab]);

    const runPayrollCalculation = async () => {
        setSaving(true);
        setWarnings([]);
        try {
            const res = await fetch('/api/payroll/runs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year: parseInt(genYear, 10), month: parseInt(genMonth, 10) })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Payroll generated successfully as Draft!');
                setWarnings(data.warnings || []);
                // Load details of this new run
                await loadRunDetails(data.payrollRunId);
                setTab('runs'); // Go back to runs to view detail
            } else {
                toast.error(data.error || 'Failed to generate payroll');
            }
        } catch {
            toast.error('Error initiating payroll generation');
        } finally {
            setSaving(false);
        }
    };

    const loadRunDetails = async (runId) => {
        try {
            const res = await fetch(`/api/payroll/runs/${runId}`);
            const data = await res.json();
            if (res.ok) {
                setActiveRun(data.run);
                setActiveRunPayslips(data.payslips);
                setShowDetailModal(true);
            } else {
                toast.error(data.error || 'Failed to fetch details');
            }
        } catch {
            toast.error('Error fetching details');
        }
    };

    const finalizePayrollRun = async (runId, targetStatus) => {
        if (targetStatus === 'paid' && !confirm('Are you sure you want to mark this payroll as PAID? This will lock the payslips.')) return;
        
        try {
            const res = await fetch(`/api/payroll/runs/${runId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: targetStatus })
            });
            if (res.ok) {
                toast.success(`Payroll marked as ${targetStatus.toUpperCase()}!`);
                if (showDetailModal) {
                    // Refresh modal
                    await loadRunDetails(runId);
                }
                loadRuns();
            } else {
                const d = await res.json();
                toast.error(d.error || 'Failed to update run status');
            }
        } catch {
            toast.error('Error updating run status');
        }
    };

    const deletePayrollRun = async (runId) => {
        if (!confirm('Are you sure you want to delete this payroll run? This will delete all calculated payslips for this period.')) return;

        try {
            const res = await fetch(`/api/payroll/runs/${runId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success('Payroll run deleted successfully');
                setShowDetailModal(false);
                loadRuns();
            } else {
                const d = await res.json();
                toast.error(d.error || 'Failed to delete run');
            }
        } catch {
            toast.error('Error deleting run');
        }
    };

    // Handle Quick Config change updates locally
    const handleConfigChange = (empId, field, value) => {
        setConfigChanges(prev => {
            const empChanges = prev[empId] || {};
            return {
                ...prev,
                [empId]: {
                    ...empChanges,
                    [field]: value
                }
            };
        });
    };

    const saveQuickConfig = async () => {
        const changedIds = Object.keys(configChanges);
        if (changedIds.length === 0) {
            toast.error('No configuration changes to save');
            return;
        }

        setSaving(true);
        let errorCount = 0;

        for (const empId of changedIds) {
            const originalEmp = employees.find(e => e.id === parseInt(empId, 10));
            const updates = configChanges[empId];
            if (!originalEmp) continue;

            const payload = {
                name: originalEmp.name, // required by backend
                job_title: originalEmp.job_title,
                department: originalEmp.department,
                phone: originalEmp.phone,
                email: originalEmp.email,
                date_of_birth: originalEmp.date_of_birth ? originalEmp.date_of_birth.slice(0,10) : null,
                date_joined: originalEmp.date_joined ? originalEmp.date_joined.slice(0,10) : null,
                shift: originalEmp.shift,
                status: originalEmp.status,
                notes: originalEmp.notes,
                ...updates
            };

            try {
                const res = await fetch(`/api/employees/${empId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) errorCount++;
            } catch {
                errorCount++;
            }
        }

        if (errorCount === 0) {
            toast.success('All configurations saved successfully!');
            setConfigChanges({});
            loadEmployees();
        } else {
            toast.error(`Failed to save ${errorCount} configurations`);
        }
        setSaving(false);
    };

    // Custom payslip individual override adjustments inside modal
    const [editingPayslipId, setEditingPayslipId] = useState(null);
    const [overrideForm, setOverrideForm] = useState({ allowances: 0, deductions: 0 });

    const startOverride = (payslip) => {
        setEditingPayslipId(payslip.id);
        setOverrideForm({
            allowances: payslip.allowances,
            deductions: payslip.deductions
        });
    };

    const savePayslipOverride = async (payslipId) => {
        try {
            const res = await fetch(`/api/payroll/runs/${activeRun.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payslipUpdates: [{
                        id: payslipId,
                        allowances: parseFloat(overrideForm.allowances) || 0,
                        deductions: parseFloat(overrideForm.deductions) || 0
                    }]
                })
            });
            if (res.ok) {
                toast.success('Payslip adjusted successfully');
                setEditingPayslipId(null);
                await loadRunDetails(activeRun.id);
                loadRuns();
            } else {
                const d = await res.json();
                toast.error(d.error || 'Failed to save adjustment');
            }
        } catch {
            toast.error('Error saving adjustment');
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter text-white">Payroll Management</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Configure pay structures, generate monthly payroll from attendance, and manage payslips.
                    </p>
                </div>
                <div className="flex gap-1 bg-black/30 border border-white/10 p-1 rounded-xl">
                    <button 
                        onClick={() => setTab('runs')} 
                        className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                            tab === 'runs' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Payroll Runs
                    </button>
                    <button 
                        onClick={() => setTab('generate')} 
                        className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                            tab === 'generate' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Run Payroll
                    </button>
                    <button 
                        onClick={() => setTab('config')} 
                        className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                            tab === 'config' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Pay Config
                    </button>
                </div>
            </div>

            {/* TAB: RUNS (HISTORY) */}
            {tab === 'runs' && (
                <div className="space-y-4">
                    <div className="flex justify-end gap-3">
                        <ColumnToggle table={table} />
                        <button
                            onClick={handleExportPDF}
                            disabled={exportingPdf}
                            className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-4 py-2 rounded-xl text-sm font-semibold hover:border-white/20 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <FiDownload className="w-4 h-4" /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
                        </button>
                    </div>
                    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <tr key={headerGroup.id} className="border-b border-white/10 bg-white/[0.02]">
                                            {headerGroup.headers.map(header => {
                                                const isSortable = header.column.getCanSort();
                                                return (
                                                    <th 
                                                        key={header.id} 
                                                        onClick={header.column.getToggleSortingHandler()}
                                                        className={`p-4 text-xs font-bold uppercase tracking-wider text-zinc-400 select-none ${
                                                            isSortable ? 'cursor-pointer hover:text-white' : ''
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                                            {isSortable && (
                                                                <SortIcon dir={header.column.getIsSorted()} />
                                                            )}
                                                        </div>
                                                        {header.column.getCanFilter() && <ColumnFilter column={header.column} />}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-zinc-500">Loading payroll history...</td>
                                        </tr>
                                    ) : table.getRowModel().rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-zinc-500">No payroll periods calculated yet. Click Run Payroll to generate.</td>
                                        </tr>
                                    ) : (
                                        table.getRowModel().rows.map(row => (
                                            <tr key={row.id} className="hover:bg-white/[0.01] transition-colors">
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="p-4">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: GENERATE PAYROLL */}
            {tab === 'generate' && (
                <div className="max-w-xl mx-auto bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <FiCalendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">Run Payroll Period</h3>
                            <p className="text-zinc-500 text-xs">Run wage calculations based on employee hours and configure profiles.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Year</label>
                            <select 
                                value={genYear} 
                                onChange={e => setGenYear(parseInt(e.target.value, 10))}
                                className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"
                            >
                                <option value="2026">2026</option>
                                <option value="2025">2025</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Month</label>
                            <select 
                                value={genMonth} 
                                onChange={e => setGenMonth(parseInt(e.target.value, 10))}
                                className="w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white outline-none [color-scheme:dark]"
                            >
                                {MONTHS.map((m, idx) => (
                                    <option key={m} value={idx + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {warnings.length > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <FiAlertCircle className="w-4 h-4" /> Calculations completed with warnings ({warnings.length}):
                            </h4>
                            <div className="max-h-24 overflow-y-auto pr-1 text-[10px] text-amber-300 font-mono space-y-1">
                                {warnings.map((w, idx) => <p key={idx}>{w}</p>)}
                            </div>
                        </div>
                    )}

                    <div className="pt-2 border-t border-white/5 flex gap-2">
                        <button 
                            onClick={runPayrollCalculation}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-zinc-200 disabled:opacity-50 transition-all cursor-pointer"
                        >
                            {saving && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                            Generate Period Payroll
                        </button>
                    </div>
                </div>
            )}

            {/* TAB: PAY RATES CONFIG (QUICK CONFIG) */}
            {tab === 'config' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-black/30 border border-white/10 p-4 rounded-2xl">
                        <p className="text-xs text-zinc-400">
                            Perform quick inline adjustments on employee pay values. Don&apos;t forget to click save when done.
                        </p>
                        <button 
                            onClick={saveQuickConfig}
                            disabled={saving || Object.keys(configChanges).length === 0}
                            className="bg-white text-black px-5 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-all"
                        >
                            {saving && <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                            Save Configurations
                        </button>
                    </div>

                    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/[0.02]">
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Employee</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Pay Type</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Monthly Salary (LKR)</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Hourly Rate (LKR)</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Allowances (LKR)</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Deductions (LKR)</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">OT Multiplier</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Std Hours / Day</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {employees.map(emp => {
                                        const localUpdates = configChanges[emp.id] || {};
                                        
                                        const payType = localUpdates.pay_type !== undefined ? localUpdates.pay_type : (emp.pay_type || 'monthly');
                                        const baseSalary = localUpdates.base_salary !== undefined ? localUpdates.base_salary : (emp.base_salary || 0);
                                        const hourlyRate = localUpdates.hourly_rate !== undefined ? localUpdates.hourly_rate : (emp.hourly_rate || 0);
                                        const allowances = localUpdates.allowances !== undefined ? localUpdates.allowances : (emp.allowances || 0);
                                        const deductions = localUpdates.deductions !== undefined ? localUpdates.deductions : (emp.deductions || 0);
                                        const otMult = localUpdates.ot_rate_multiplier !== undefined ? localUpdates.ot_rate_multiplier : (emp.ot_rate_multiplier || 1.5);
                                        const stdHours = localUpdates.standard_working_hours !== undefined ? localUpdates.standard_working_hours : (emp.standard_working_hours || 8);

                                        const isChanged = Object.keys(localUpdates).length > 0;

                                        return (
                                            <tr key={emp.id} className={`transition-colors hover:bg-white/[0.01] ${isChanged ? 'bg-indigo-500/5' : ''}`}>
                                                <td className="p-4 font-semibold text-white">
                                                    {emp.name}
                                                    <span className="block text-[10px] text-zinc-500 font-mono mt-0.5">{emp.employee_id} ({emp.job_title})</span>
                                                </td>
                                                <td className="p-2">
                                                    <select 
                                                        value={payType}
                                                        onChange={e => handleConfigChange(emp.id, 'pay_type', e.target.value)}
                                                        className="px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer"
                                                    >
                                                        <option value="monthly">monthly</option>
                                                        <option value="hourly">hourly</option>
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        value={baseSalary}
                                                        disabled={payType === 'hourly'}
                                                        onChange={e => handleConfigChange(emp.id, 'base_salary', parseFloat(e.target.value) || 0)}
                                                        className="w-24 px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30 disabled:opacity-20 disabled:cursor-not-allowed"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        value={hourlyRate}
                                                        onChange={e => handleConfigChange(emp.id, 'hourly_rate', parseFloat(e.target.value) || 0)}
                                                        className="w-24 px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        value={allowances}
                                                        onChange={e => handleConfigChange(emp.id, 'allowances', parseFloat(e.target.value) || 0)}
                                                        className="w-24 px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        value={deductions}
                                                        onChange={e => handleConfigChange(emp.id, 'deductions', parseFloat(e.target.value) || 0)}
                                                        className="w-24 px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        step="0.1"
                                                        value={otMult}
                                                        onChange={e => handleConfigChange(emp.id, 'ot_rate_multiplier', parseFloat(e.target.value) || 1.5)}
                                                        className="w-16 px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input 
                                                        type="number"
                                                        step="0.5"
                                                        value={stdHours}
                                                        onChange={e => handleConfigChange(emp.id, 'standard_working_hours', parseFloat(e.target.value) || 8)}
                                                        className="w-16 px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: RUN DETAILS & INDIVIDUAL PAYSLIP ADJUSTER */}
            {showDetailModal && activeRun && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowDetailModal(false)}>
                    <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07] bg-white/[0.01]">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span>Payroll Sheets:</span>
                                    <span className="text-zinc-400 font-semibold">{MONTHS[activeRun.month - 1]} {activeRun.year}</span>
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                        activeRun.status === 'paid' 
                                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                                            : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
                                    }`}>
                                        {activeRun.status}
                                    </span>
                                </h3>
                                <p className="text-xs text-zinc-500 mt-0.5">Calculated total outlay: LKR {activeRunPayslips.reduce((acc, p) => acc + parseFloat(p.net_pay), 0).toLocaleString(undefined, { minimumFractionDigits:2 })}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleExportPayslipsPDF}
                                    disabled={exportingPdf}
                                    className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:border-white/20 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <FiDownload className="w-3.5 h-3.5" /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
                                </button>
                                <button onClick={() => setShowDetailModal(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 cursor-pointer"><FiX /></button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/[0.02]">
                                            <th className="p-3 font-bold uppercase text-zinc-400">Employee</th>
                                            <th className="p-3 font-bold uppercase text-zinc-400">Pay Type</th>
                                            <th className="p-3 font-bold uppercase text-zinc-400">Base Salary / Hourly Rate</th>
                                            <th className="p-3 font-bold uppercase text-zinc-400 text-center">Hours Worked</th>
                                            <th className="p-3 font-bold uppercase text-zinc-400 text-center">OT Hours</th>
                                            <th className="p-3 font-bold uppercase text-zinc-400">OT Pay</th>
                                            <th className="p-3 font-bold uppercase text-zinc-400">Allowances</th>
                                            <th className="p-3 font-bold uppercase text-zinc-400">Deductions</th>
                                            <th className="p-3 font-bold uppercase text-zinc-400">Net Pay</th>
                                            <th className="p-3 font-bold uppercase text-zinc-400 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {activeRunPayslips.map(ps => {
                                            const isEditingThis = editingPayslipId === ps.id;
                                            
                                            return (
                                                <tr key={ps.id} className="hover:bg-white/[0.01]">
                                                    <td className="p-3 font-semibold text-white">
                                                        {ps.employee_name}
                                                        <span className="block text-[9px] text-zinc-500 font-mono">{ps.erp_code} ({ps.job_title})</span>
                                                    </td>
                                                    <td className="p-3 text-zinc-400">{ps.pay_type}</td>
                                                    <td className="p-3 text-zinc-300 font-mono">
                                                        LKR {ps.pay_type === 'monthly' ? parseFloat(ps.base_salary).toLocaleString() : parseFloat(ps.hourly_rate).toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-center font-mono text-zinc-300">{parseFloat(ps.total_hours_worked).toFixed(1)} hrs</td>
                                                    <td className="p-3 text-center font-mono text-zinc-300">{parseFloat(ps.overtime_hours).toFixed(1)} hrs</td>
                                                    <td className="p-3 font-mono text-zinc-300">LKR {parseFloat(ps.overtime_pay).toLocaleString(undefined, { minimumFractionDigits:2 })}</td>
                                                    
                                                    {/* Allowances Column */}
                                                    <td className="p-2">
                                                        {isEditingThis ? (
                                                            <input 
                                                                type="number"
                                                                value={overrideForm.allowances}
                                                                onChange={e => setOverrideForm(p => ({ ...p, allowances: e.target.value }))}
                                                                className="w-20 px-2 py-0.5 bg-black border border-white/20 rounded text-white text-xs"
                                                            />
                                                        ) : (
                                                            <span className="font-mono text-zinc-300">LKR {parseFloat(ps.allowances).toLocaleString(undefined, { minimumFractionDigits:2 })}</span>
                                                        )}
                                                    </td>

                                                    {/* Deductions Column */}
                                                    <td className="p-2">
                                                        {isEditingThis ? (
                                                            <input 
                                                                type="number"
                                                                value={overrideForm.deductions}
                                                                onChange={e => setOverrideForm(p => ({ ...p, deductions: e.target.value }))}
                                                                className="w-20 px-2 py-0.5 bg-black border border-white/20 rounded text-white text-xs"
                                                            />
                                                        ) : (
                                                            <span className="font-mono text-zinc-300">LKR {parseFloat(ps.deductions).toLocaleString(undefined, { minimumFractionDigits:2 })}</span>
                                                        )}
                                                    </td>

                                                    {/* Net Pay Column */}
                                                    <td className="p-3 font-mono font-bold text-white">
                                                        LKR {parseFloat(ps.net_pay).toLocaleString(undefined, { minimumFractionDigits:2 })}
                                                    </td>
                                                    
                                                    {/* Actions */}
                                                    <td className="p-3 text-right">
                                                        <div className="flex gap-1 justify-end">
                                                            <button 
                                                                onClick={() => setPreviewPayslip(ps)}
                                                                className="p-1 bg-white/5 border border-white/10 text-zinc-400 hover:text-white rounded hover:bg-white/10 cursor-pointer transition-colors"
                                                                title="Preview Payslip"
                                                            >
                                                                <FiEye className="w-3.5 h-3.5" />
                                                            </button>
                                                            {activeRun.status === 'draft' && (
                                                                isEditingThis ? (
                                                                    <>
                                                                        <button 
                                                                            onClick={() => savePayslipOverride(ps.id)}
                                                                            className="p-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/20 cursor-pointer"
                                                                            title="Save adjustments"
                                                                        >
                                                                            <FiCheck className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => setEditingPayslipId(null)}
                                                                            className="p-1 bg-white/5 border border-white/10 text-zinc-400 rounded hover:bg-white/10 cursor-pointer"
                                                                            title="Cancel"
                                                                        >
                                                                            <FiX className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button 
                                                                        onClick={() => startOverride(ps)}
                                                                        className="p-1 bg-white/5 border border-white/10 text-zinc-400 rounded hover:bg-white/10 cursor-pointer"
                                                                        title="Override Allowance/Deduction"
                                                                    >
                                                                        <FiEdit className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex gap-2 justify-between items-center px-6 py-4 border-t border-white/[0.07] bg-white/[0.01]">
                            <div>
                                {activeRun.status === 'draft' && (
                                    <button 
                                        onClick={() => deletePayrollRun(activeRun.id)}
                                        className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                                    >
                                        <FiTrash2 className="w-4 h-4" /> Delete / Rollback Run
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowDetailModal(false)} className="px-5 py-2 rounded-xl border border-white/10 text-gray-400 text-xs font-semibold hover:bg-white/5 cursor-pointer">Close</button>
                                {activeRun.status === 'draft' && (
                                    <button 
                                        onClick={() => finalizePayrollRun(activeRun.id, 'paid')}
                                        className="flex items-center gap-1 bg-white text-black hover:bg-zinc-200 px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                                    >
                                        <FiCheck className="w-4 h-4" /> Lock & Finalize Payroll
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL: PAYSLIP PREVIEW & PRINT ── */}
            {previewPayslip && (
                <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setPreviewPayslip(null)}>
                    <style dangerouslySetInnerHTML={{__html: `
                        @media print {
                            body * {
                                visibility: hidden;
                            }
                            #payslip-print-area, #payslip-print-area * {
                                visibility: visible;
                            }
                            #payslip-print-area {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                background: white !important;
                                color: black !important;
                            }
                            #payslip-print-area button, #payslip-print-area .no-print {
                                display: none !important;
                            }
                        }
                    `}} />
                    
                    <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] bg-white/[0.01] shrink-0 no-print">
                            <h3 className="text-sm font-bold text-white">Payslip Preview</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                                >
                                    Print / Save PDF
                                </button>
                                <button onClick={() => setPreviewPayslip(null)} className="p-1 rounded-lg hover:bg-white/10 text-gray-400 cursor-pointer"><FiX className="w-4 h-4" /></button>
                            </div>
                        </div>

                        {/* Printable Area */}
                        <div id="payslip-print-area" className="flex-1 overflow-y-auto p-8 space-y-6 bg-black text-white print:bg-white print:text-black">
                            {/* Company Branding */}
                            <div className="text-center space-y-1 pb-4 border-b border-white/10 print:border-black/10">
                                <h2 className="text-xl font-bold tracking-wider uppercase text-white print:text-black">Pressmatics (Pvt) Ltd</h2>
                                <p className="text-[10px] text-zinc-400 print:text-zinc-600">No. 45, Temple Road, Colombo, Sri Lanka</p>
                                <p className="text-xs font-semibold text-white print:text-black mt-2">
                                    PAY SLIP — {MONTHS[activeRun.month - 1].toUpperCase()} {activeRun.year}
                                </p>
                            </div>

                            {/* Employee Metadata */}
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="space-y-1">
                                    <p className="text-zinc-500 print:text-zinc-600">Employee Name:</p>
                                    <p className="font-bold text-white print:text-black">{previewPayslip.employee_name}</p>
                                    
                                    <p className="text-zinc-500 print:text-zinc-600 pt-2">Designation:</p>
                                    <p className="text-zinc-300 print:text-zinc-700">{previewPayslip.job_title || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-zinc-500 print:text-zinc-600">Employee ID / Code:</p>
                                    <p className="font-mono text-white print:text-black font-semibold">{previewPayslip.erp_code}</p>

                                    <p className="text-zinc-500 print:text-zinc-600 pt-2">Department:</p>
                                    <p className="text-zinc-300 print:text-zinc-700">{previewPayslip.department || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Earnings vs Deductions Table */}
                            <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-white/10 print:border-black/10 text-xs">
                                
                                {/* Earnings (Left) */}
                                <div className="space-y-3">
                                    <h4 className="font-bold text-white print:text-black uppercase tracking-wider text-[10px] border-b border-white/5 print:border-black/5 pb-1">Earnings</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400 print:text-zinc-600">Basic / Base Rate:</span>
                                            <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.base_salary || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400 print:text-zinc-600">BR Allowance 1:</span>
                                            <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.br1 || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-400 print:text-zinc-600">BR Allowance 2:</span>
                                            <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.br2 || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                        {parseFloat(previewPayslip.overtime_pay || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">Normal Overtime ({parseFloat(previewPayslip.overtime_hours || 0).toFixed(1)} hrs):</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.overtime_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        {parseFloat(previewPayslip.double_overtime_pay || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">Double Overtime ({parseFloat(previewPayslip.double_overtime_hours || 0).toFixed(1)} hrs):</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.double_overtime_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        {parseFloat(previewPayslip.allowances || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">Other Allowances:</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.allowances || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between pt-2 border-t border-dashed border-white/10 print:border-black/10 font-bold text-white print:text-black">
                                            <span>Gross Salary:</span>
                                            <span className="font-mono">LKR {parseFloat(previewPayslip.gross_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Deductions (Right) */}
                                <div className="space-y-3">
                                    <h4 className="font-bold text-white print:text-black uppercase tracking-wider text-[10px] border-b border-white/5 print:border-black/5 pb-1">Deductions</h4>
                                    <div className="space-y-2">
                                        {parseFloat(previewPayslip.no_pay_deduction || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">No-Pay Deduction:</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.no_pay_deduction || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        {parseFloat(previewPayslip.late_deduction_pay || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">Late Arriving Penalty:</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.late_deduction_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        {parseFloat(previewPayslip.advance_deduction || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">Salary Advance:</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.advance_deduction || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        {parseFloat(previewPayslip.loan_deduction || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">Loan Repayment:</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.loan_deduction || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        {parseFloat(previewPayslip.epf_employee || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">EPF Employee (8%):</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.epf_employee || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        {parseFloat(previewPayslip.paye_tax || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">PAYE Tax / APIT:</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.paye_tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        {parseFloat(previewPayslip.deductions || 0) > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-zinc-400 print:text-zinc-600">Other Deductions:</span>
                                                <span className="font-mono text-zinc-200 print:text-zinc-800">LKR {parseFloat(previewPayslip.deductions || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between pt-2 border-t border-dashed border-white/10 print:border-black/10 font-bold text-white print:text-black">
                                            <span>Total Deductions:</span>
                                            <span className="font-mono">LKR {(
                                                parseFloat(previewPayslip.no_pay_deduction || 0) +
                                                parseFloat(previewPayslip.late_deduction_pay || 0) +
                                                parseFloat(previewPayslip.advance_deduction || 0) +
                                                parseFloat(previewPayslip.loan_deduction || 0) +
                                                parseFloat(previewPayslip.epf_employee || 0) +
                                                parseFloat(previewPayslip.paye_tax || 0) +
                                                parseFloat(previewPayslip.deductions || 0)
                                            ).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Net Salary Summary */}
                            <div className="flex justify-between items-center bg-white/5 print:bg-black/5 rounded-xl p-4 border border-white/10 print:border-black/10 mt-6">
                                <span className="text-sm font-bold text-white print:text-black">Net Salary Payable:</span>
                                <span className="text-xl font-bold font-mono text-white print:text-black">LKR {parseFloat(previewPayslip.net_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>

                            {/* Employer Contributions */}
                            {(parseFloat(previewPayslip.epf_employer || 0) > 0 || parseFloat(previewPayslip.etf_employer || 0) > 0) && (
                                <div className="pt-4 border-t border-white/10 print:border-black/10 text-[10px] text-zinc-500 print:text-zinc-600 space-y-1">
                                    <p className="font-bold uppercase tracking-wider text-[9px] text-zinc-400 print:text-zinc-700 mb-1">Employer Contributions (Not Deducted from Net Pay)</p>
                                    <div className="flex justify-between">
                                        <span>EPF Employer Share (12%):</span>
                                        <span className="font-mono">LKR {parseFloat(previewPayslip.epf_employer || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>ETF Employer Share (3%):</span>
                                        <span className="font-mono">LKR {parseFloat(previewPayslip.etf_employer || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    </div>
                                </div>
                            )}

                            {/* Signature Sign-offs */}
                            <div className="grid grid-cols-2 gap-8 pt-12 text-[10px] text-zinc-500 print:text-zinc-700">
                                <div className="text-center space-y-4">
                                    <div className="border-t border-white/20 print:border-black/20 pt-1">Prepared By</div>
                                </div>
                                <div className="text-center space-y-4">
                                    <div className="border-t border-white/20 print:border-black/20 pt-1">Employee Signature</div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 flex justify-end shrink-0 no-print">
                            <button onClick={() => setPreviewPayslip(null)} className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-semibold cursor-pointer">
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
