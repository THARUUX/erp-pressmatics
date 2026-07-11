'use client';
import { confirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel,
    getFilteredRowModel, getPaginationRowModel, flexRender,
} from '@tanstack/react-table';
import {
    FiPlus, FiEdit2, FiTrash2, FiX, FiCopy, FiAlertTriangle,
    FiClock, FiSearch, FiChevronUp, FiChevronDown, FiChevronsLeft,
    FiChevronsRight, FiChevronLeft, FiChevronRight, FiUpload, FiGrid,
    FiDollarSign, FiBox, FiPenTool, FiCheckCircle, FiDownload
} from 'react-icons/fi';
import { FiMaximize } from 'react-icons/fi';
import { numericOperatorFilterFn } from '@/lib/numericFilter';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSettings } from '@/components/SettingsContext';
import BulkUploadModal from '@/components/inventory/BulkUploadModal';
import { BulkEditModal } from '@/components/ui/BulkEditModal';
import BomEditor from './components/BomEditor';

const CATEGORIES = ['Paper', 'Plate', 'Ink', 'SFG', 'RM', 'FG', 'Statics', 'BOM Waiting List'];
const BOM_CATEGORIES = ['SFG', 'FG'];
const EMPTY_FORM = { name: '', item_code: '', category: 'Paper', type: '', uom: 'Sheet', unit_cost: 0, stock_quantity: 0, min_stock: 0, width_cm: '', height_cm: '', description: '', is_active: 1 };

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

export default function InventoryPage() {
    const { settings } = useSettings();
    const currency = settings.currency;
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('Paper');
    const [globalFilter, setGlobalFilter] = useState('');
    const [sorting, setSorting] = useState([]);
    const [rowSelection, setRowSelection] = useState({});
    const [columnFilters, setColumnFilters] = useState([]);
    const [exportingPdf, setExportingPdf] = useState(false);

    const handleExportPDF = async () => {
        setExportingPdf(true);
        try {
            const visibleCols = table.getVisibleLeafColumns()
                .filter(col => col.id !== 'select' && col.id !== 'actions')
                .map(col => ({
                    key: col.id || col.columnDef.accessorKey,
                    header: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id
                }));

            const filteredRows = table.getFilteredRowModel().rows.map(row => row.original);

            const res = await fetch('/api/pdf/dynamic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Inventory Stock Report',
                    subtitle: `Category: ${activeCategory} - Filtered Stock Items`,
                    columns: visibleCols,
                    rows: filteredRows,
                    currency: currency
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
            a.download = `inventory_${activeCategory.toLowerCase()}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
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

    const [deleteProgress, setDeleteProgress] = useState(null); // { current, total, currentName }
    const [showAdd, setShowAdd] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [restockItem, setRestockItem] = useState(null);
    const [restockData, setRestockData] = useState({ quantity: 0, notes: '' });
    const [historyItem, setHistoryItem] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [bomLines, setBomLines] = useState([]);
    const [restockBom, setRestockBom] = useState([]);
    const [qrItem, setQrItem] = useState(null); // { id, name, item_code } for QR modal
    const [qrDataUrl, setQrDataUrl] = useState('');

    const [waitingList, setWaitingList] = useState([]);
    const [waitingListLoading, setWaitingListLoading] = useState(true);
    const [issuingWaitingId, setIssuingWaitingId] = useState(null);
    const [selectedWaitingItem, setSelectedWaitingItem] = useState(null);
    const [waitingIssueModalQty, setWaitingIssueModalQty] = useState('');

    const fetchWaitingList = async () => {
        setWaitingListLoading(true);
        try {
            const res = await fetch('/api/inventory/bom-waiting-list');
            if (res.ok) {
                const data = await res.json();
                setWaitingList(data);
            }
        } catch (error) {
            console.error("Error fetching BOM waiting list:", error);
        } finally {
            setWaitingListLoading(false);
        }
    };

    const handleIssueWaitingStock = async (item, qtyVal) => {
        const qty = parseFloat(qtyVal);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Please enter a valid positive quantity");
            return;
        }

        setIssuingWaitingId(item.id);
        try {
            const res = await fetch(`/api/sales-orders/${item.sales_order_id}/bom/issue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bom_id: item.id, quantity: qty })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Stock issued successfully!");
                setSelectedWaitingItem(null);
                await fetchWaitingList();
            } else {
                toast.error(data.error || "Failed to issue stock");
            }
        } catch (error) {
            console.error("Error issuing stock:", error);
            toast.error("An error occurred while issuing stock");
        } finally {
            setIssuingWaitingId(null);
        }
    };

    const handlePrintIssueNote = (item, qtyVal) => {
        const qty = parseFloat(qtyVal) || 0;
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            toast.error("Please allow popups to print the issue note.");
            return;
        }

        const remaining = Math.max(0, parseFloat(item.required_qty) - parseFloat(item.issued_qty));

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Stock Issue Note - ${item.sales_order_code}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #111;
                        margin: 0;
                        padding: 40px;
                        font-size: 14px;
                        line-height: 1.5;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #111;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .logo-title h1 {
                        margin: 0;
                        font-size: 24px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        font-weight: 800;
                    }
                    .logo-title p {
                        margin: 4px 0 0 0;
                        font-size: 11px;
                        color: #666;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .doc-info {
                        text-align: right;
                    }
                    .doc-info h2 {
                        margin: 0;
                        font-size: 20px;
                        color: #059669;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                    }
                    .doc-info p {
                        margin: 5px 0 0 0;
                        font-size: 12px;
                        color: #444;
                    }
                    .section-title {
                        font-size: 12px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 10px;
                        color: #666;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 4px;
                    }
                    .grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 30px;
                        margin-bottom: 30px;
                    }
                    .info-list {
                        margin: 0;
                        padding: 0;
                        list-style: none;
                    }
                    .info-list li {
                        margin-bottom: 8px;
                        display: flex;
                    }
                    .info-list li span.label {
                        font-weight: 600;
                        width: 140px;
                        color: #555;
                        flex-shrink: 0;
                    }
                    .info-list li span.val {
                        color: #111;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 30px 0;
                    }
                    th {
                        background: #f4f4f5;
                        font-weight: 700;
                        text-transform: uppercase;
                        font-size: 11px;
                        letter-spacing: 0.5px;
                        padding: 10px 12px;
                        border: 1px solid #e4e4e7;
                        text-align: left;
                    }
                    td {
                        padding: 12px;
                        border: 1px solid #e4e4e7;
                        color: #3f3f46;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .highlight-row {
                        background: #f0fdf4;
                        font-weight: 600;
                    }
                    .highlight-row td {
                        color: #0f766e;
                    }
                    .footer-sig {
                        margin-top: 80px;
                        display: flex;
                        justify-content: space-between;
                        gap: 50px;
                    }
                    .sig-block {
                        flex: 1;
                        text-align: center;
                    }
                    .sig-line {
                        border-top: 1px solid #111;
                        margin-top: 50px;
                        padding-top: 8px;
                        font-size: 12px;
                        font-weight: 600;
                        text-transform: uppercase;
                        color: #444;
                    }
                    .print-btn-container {
                        margin-top: 30px;
                        text-align: center;
                    }
                    .print-btn {
                        background: #10b981;
                        color: white;
                        border: none;
                        padding: 10px 24px;
                        font-size: 14px;
                        font-weight: 600;
                        border-radius: 6px;
                        cursor: pointer;
                        box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.1);
                        transition: background 0.2s;
                    }
                    .print-btn:hover {
                        background: #059669;
                    }
                    @media print {
                        .print-btn-container {
                            display: none;
                        }
                        body {
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-title">
                        <h1>Pressmatics ERP</h1>
                        <p>Inventory & Production Control System</p>
                    </div>
                    <div class="doc-info">
                        <h2>STOCK ISSUE NOTE</h2>
                        <p>Date: ${new Date().toLocaleString()}</p>
                    </div>
                </div>

                <div class="grid">
                    <div>
                        <div class="section-title">Job & Order Details</div>
                        <ul class="info-list">
                            <li><span class="label">Sales Order Code:</span><span class="val" style="font-weight:bold;">${item.sales_order_code}</span></li>
                            <li><span class="label">Customer Name:</span><span class="val">${item.customer_name}</span></li>
                            <li><span class="label">Order Date:</span><span class="val">${new Date(item.order_date).toLocaleDateString()}</span></li>
                            <li><span class="label">Order Status:</span><span class="val">${item.sales_order_status}</span></li>
                        </ul>
                    </div>
                    <div>
                        <div class="section-title">Warehouse Details</div>
                        <ul class="info-list">
                            <li><span class="label">Issue Note ID:</span><span class="val">ISN-${Date.now().toString().slice(-6)}</span></li>
                            <li><span class="label">Material Type:</span><span class="val" style="text-transform: uppercase;">${item.component_type}</span></li>
                            <li><span class="label">Available Stock:</span><span class="val">${parseFloat(item.available_qty).toFixed(2)} ${item.uom}</span></li>
                        </ul>
                    </div>
                </div>

                <div class="section-title">Material Issuance Summary</div>
                <table>
                    <thead>
                        <tr>
                            <th>Material Name</th>
                            <th>Item Code</th>
                            <th class="text-right">Total Required</th>
                            <th class="text-right">Already Issued</th>
                            <th class="text-right">Remaining Needed</th>
                            <th class="text-right">Quantity to Issue Now</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>${item.component_name}</strong></td>
                            <td><code>${item.item_code || '—'}</code></td>
                            <td class="text-right">${parseFloat(item.required_qty).toFixed(2)} ${item.uom}</td>
                            <td class="text-right">${parseFloat(item.issued_qty).toFixed(2)} ${item.uom}</td>
                            <td class="text-right">${remaining.toFixed(2)} ${item.uom}</td>
                            <td class="text-right" style="font-weight: bold; font-size: 15px; color: #047857;">${qty.toFixed(2)} ${item.uom}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer-sig">
                    <div class="sig-block">
                        <div class="sig-line">Issued By (Store Keeper Signature)</div>
                    </div>
                    <div class="sig-block">
                        <div class="sig-line">Approved By (Supervisor Signature)</div>
                    </div>
                    <div class="sig-block">
                        <div class="sig-line">Received By (Production / Dept Signature)</div>
                    </div>
                </div>

                <div class="print-btn-container">
                    <button class="print-btn" onclick="window.print()">Print This Document</button>
                </div>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const fetchItems = () => {
        setLoading(true);
        fetch(`/api/inventory?category=${activeCategory}`)
            .then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
            .catch(() => setLoading(false));
    };
    useEffect(() => {
        setRowSelection({});
        if (activeCategory === 'BOM Waiting List') {
            fetchWaitingList();
        } else {
            fetchItems();
        }
    }, [activeCategory]);

    const openQrModal = async (item) => {
        setQrItem(item);
        setQrDataUrl('');
        try {
            const QRCode = (await import('qrcode')).default;
            const url = `${window.location.origin}/statics/${item.id}`;
            const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#ffffff', light: '#00000000' } });
            setQrDataUrl(dataUrl);
        } catch (e) { console.error('QR error', e); }
    };

    /* ── TanStack Table columns ── */
    const columns = useMemo(() => [
        {
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    checked={table.getIsAllPageRowsSelected()}
                    ref={(el) => {
                        if (el) el.indeterminate = table.getIsSomePageRowsSelected();
                    }}
                    onChange={table.getToggleAllPageRowsSelectedHandler()}
                    className="rounded border-white/10 bg-white/5 text-white focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer"
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    checked={row.getIsSelected()}
                    onChange={row.getToggleSelectedHandler()}
                    onClick={e => e.stopPropagation()}
                    className="rounded border-white/10 bg-white/5 text-white focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer"
                />
            ),
            size: 40,
            enableSorting: false,
            enableColumnFilter: false,
        },
        {
            accessorKey: 'item_code', header: 'Code', size: 100,
            cell: ({ row, getValue }) => (
                <span className="font-mono text-xs text-white/50">
                    {getValue()}
                    {row.original.is_active === 0 && <span className="ml-2 text-[9px] bg-red-500/20 text-red-300 px-1 rounded uppercase">Inactive</span>}
                </span>
            ),
        },
        {
            accessorKey: 'name', header: 'Name',
            cell: ({ row, getValue }) => {
                const low = row.original.stock_quantity < (row.original.min_stock || 0);
                return (
                    <div>
                        <p className="text-sm font-medium text-white">{getValue()}</p>
                        {low && <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5"><FiAlertTriangle className="w-3 h-3" />Low stock · min {row.original.min_stock}</p>}
                    </div>
                );
            },
        },
        { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => <span className="text-sm text-white/50">{getValue()}</span> },
        { accessorKey: 'uom',  header: 'UoM',  cell: ({ getValue }) => <span className="text-xs text-white/40 font-mono">{getValue()}</span> },
        {
            id: 'stock_or_status', header: 'Stock / Status', size: 110,
            accessorFn: row => row.stock_quantity,
            filterFn: numericOperatorFilterFn,
            cell: ({ row }) => {
                const item = row.original;
                if (item.category === 'Statics') {
                    const active = item.is_active === 1;
                    return (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-red-500/10 text-red-400 border-red-500/25'
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            {active ? 'Active' : 'Inactive'}
                        </span>
                    );
                }
                const low = item.stock_quantity < (item.min_stock || 0);
                return <span className={`font-mono font-semibold ${low ? 'text-red-400' : 'text-white'}`}>{item.stock_quantity}</span>;
            },
        },
        { accessorKey: 'min_stock', header: 'Min', size: 70,
            filterFn: numericOperatorFilterFn,
            cell: ({ row, getValue }) => row.original.category === 'Statics' ? null :
                <span className="font-mono text-white/35 text-sm">{getValue() || 0}</span>
        },
        {
            accessorKey: 'unit_cost', header: 'Unit Cost', size: 110,
            filterFn: numericOperatorFilterFn,
            cell: ({ getValue }) => <span className="font-mono text-white/70 text-sm">{currency}{parseFloat(getValue()).toFixed(4)}</span>,
        },
        {
            id: 'actions', header: '', size: 180, enableSorting: false,
            cell: ({ row }) => {
                const item = row.original;
                const isStatics = item.category === 'Statics';
                return (
                    <div className="flex items-center justify-end gap-1">
                        {isStatics ? (
                            <button onClick={() => openQrModal(item)} className="px-2 py-1 text-[11px] rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-400 hover:text-violet-300 transition-all font-medium">QR</button>
                        ) : (
                            <>
                                <button onClick={() => handleOpenRestock(item)} className="px-2 py-1 text-[11px] rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all">Restock</button>
                                <button onClick={() => handleViewHistory(item)} className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.05]"><FiClock className="w-3.5 h-3.5" /></button>
                            </>
                        )}
                        <button onClick={() => handleCopy(item)}  className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.05]"><FiCopy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleEdit(item)}  className="p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-lg hover:bg-white/[0.05]"><FiEdit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-white/20 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/[0.07]"><FiTrash2 className="w-3.5 h-3.5" /></button>
                    </div>
                );
            },
        },
    ], [currency]);

    const table = useReactTable({
        data: items,
        columns,
        state: { globalFilter, sorting, rowSelection, columnFilters },
        onGlobalFilterChange: setGlobalFilter,
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    const selectedIds = useMemo(() => {
        return table.getSelectedRowModel().flatRows.map(row => row.original.id);
    }, [rowSelection, items, table]);

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!(await confirmDialog(`Delete ${selectedIds.length} selected item(s)?`, { danger: true, confirmLabel: 'Delete' }))) return;

        const total = selectedIds.length;
        let deleted = 0;
        const failed = [];

        // Build a name map for progress display
        const nameMap = {};
        table.getSelectedRowModel().flatRows.forEach(row => {
            nameMap[row.original.id] = row.original.name;
        });

        for (let i = 0; i < selectedIds.length; i++) {
            const id = selectedIds[i];
            setDeleteProgress({ current: i + 1, total, currentName: nameMap[id] || `Item #${id}` });
            try {
                const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
                if (res.ok) { deleted++; }
                else { failed.push(nameMap[id] || id); }
            } catch { failed.push(nameMap[id] || id); }
        }

        setDeleteProgress(null);
        setRowSelection({});
        fetchItems();

        if (failed.length > 0) {
            toast.error(`Deleted ${deleted} item(s). ${failed.length} could not be deleted.`);
        } else {
            toast.success(`${deleted} item(s) deleted successfully`);
        }
    };

    /* ── Handlers ── */
    const handleViewHistory = async (item) => {
        setHistoryItem(item); setLoadingHistory(true);
        const res = await fetch(`/api/inventory/${item.id}/history`);
        setHistoryData(res.ok ? await res.json() : []);
        setLoadingHistory(false);
    };
    const handleSubmit = async () => {
        const url = isEditing ? `/api/inventory/${editId}` : '/api/inventory';
        const cat = isEditing ? formData.category : activeCategory;
        const res = await fetch(url, { method: isEditing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, category: cat }) });
        if (!res.ok) { toast.error('Operation failed'); return; }
        const data = await res.json();
        const savedId = isEditing ? editId : data.id;
        // Save BOM for SF/FG items
        if (BOM_CATEGORIES.includes(cat) && savedId) {
            await fetch(`/api/inventory/${savedId}/bom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lines: bomLines })
            });
        }
        resetForm();
        fetchItems();
    };
    const handleRestock = async () => {
        const res = await fetch('/api/inventory/restock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: restockItem.id, ...restockData }) });
        if (res.ok) {
            const d = await res.json();
            if (d.bomWarnings?.length > 0) toast.error('Warning: ' + d.bomWarnings[0], { duration: 6000 });
            setRestockItem(null); setRestockData({ quantity: 0, notes: '' }); setRestockBom([]);
            fetchItems();
        } else toast.error('Restock failed');
    };
    const handleDelete = async (id) => {
        if (!(await confirmDialog('Delete this item?'))) return;
        const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
        if (res.ok) fetchItems(); else { const d = await res.json(); toast.error(d.error || 'Failed'); }
    };
    const handleEdit = (item) => {
        setIsEditing(true); setEditId(item.id);
        setFormData({ name: item.name, item_code: item.item_code || '', category: item.category, type: item.type, uom: item.uom || 'Sheet', unit_cost: item.unit_cost, stock_quantity: item.stock_quantity, min_stock: item.min_stock || 0, width_cm: item.width_cm || '', height_cm: item.height_cm || '', description: item.description || '', is_active: item.is_active != null ? item.is_active : 1 });
        setBomLines([]);
        if (BOM_CATEGORIES.includes(item.category)) {
            fetch(`/api/inventory/${item.id}/bom`).then(r => r.json()).then(d => setBomLines(Array.isArray(d) ? d : []));
        }
        setShowAdd(true);
    };
    const handleCopy = (item) => { setIsEditing(false); setEditId(null); setFormData({ ...item, name: `${item.name} (Copy)`, item_code: '' }); setBomLines([]); setShowAdd(true); };
    const resetForm = () => { setShowAdd(false); setIsEditing(false); setEditId(null); setFormData({ ...EMPTY_FORM, category: activeCategory }); setBomLines([]); };
    const handleOpenRestock = async (item) => {
        setRestockItem(item);
        setRestockBom([]);
        if (BOM_CATEGORIES.includes(item.category)) {
            const r = await fetch(`/api/inventory/${item.id}/bom`);
            if (r.ok) setRestockBom(await r.json());
        }
    };
    const f = (k, v) => setFormData(p => ({ ...p, [k]: v }));

    const stats = useMemo(() => {
        const totalItems = items.length;
        const totalValue = items.reduce((acc, item) => acc + (Number(item.stock_quantity || 0) * Number(item.unit_cost || 0)), 0);
        const lowStock = items.filter(item => item.category !== 'Statics' && item.stock_quantity < (item.min_stock || 0)).length;
        return { totalItems, totalValue, lowStock };
    }, [items]);

    const lowStockCount = stats.lowStock;

    const waitingStats = useMemo(() => {
        if (activeCategory !== 'BOM Waiting List') return { totalPending: 0, shortages: 0, ready: 0 };
        const totalPending = waitingList.length;
        let shortages = 0;
        let ready = 0;
        waitingList.forEach(item => {
            const remaining = parseFloat(item.required_qty) - parseFloat(item.issued_qty);
            const available = parseFloat(item.available_qty || 0);
            if (available < remaining) {
                shortages++;
            } else {
                ready++;
            }
        });
        return { totalPending, shortages, ready };
    }, [waitingList, activeCategory]);

    return (
        <div className="text-white space-y-6">
            {/* ── Bulk Delete Progress Modal ── */}
            {deleteProgress && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#111]/95 border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-8 h-8 rounded-full border-2 border-red-500/50 border-t-red-400 animate-spin shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-white">Deleting items…</p>
                                <p className="text-xs text-white/40 mt-0.5 truncate max-w-[220px]">{deleteProgress.currentName}</p>
                            </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden mb-3">
                            <div
                                className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-white/30">
                            <span>{deleteProgress.current} of {deleteProgress.total}</span>
                            <span>{Math.round((deleteProgress.current / deleteProgress.total) * 100)}%</span>
                        </div>
                    </div>
                </div>
            )}
            {/* QR Modal for Statics */}
            {qrItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setQrItem(null)}>
                    <div className="bg-[#0d0d1a] border border-violet-500/20 rounded-2xl p-8 w-full max-w-xs shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                        <p className="text-[10px] text-violet-400 uppercase tracking-widest font-bold mb-1">Statics QR Code</p>
                        <p className="text-white font-semibold text-sm mb-1 truncate">{qrItem.name}</p>
                        <p className="font-mono text-[11px] text-white/30 mb-5">{qrItem.item_code}</p>
                        {qrDataUrl ? (
                            <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 mx-auto rounded-xl" />
                        ) : (
                            <div className="w-48 h-48 mx-auto rounded-xl bg-white/5 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border-2 border-violet-500/50 border-t-violet-400 animate-spin" />
                            </div>
                        )}
                        <p className="text-[10px] text-white/20 mt-4 break-all">{typeof window !== 'undefined' ? `${window.location.origin}/statics/${qrItem.id}` : ''}</p>
                        <button onClick={() => setQrItem(null)} className="mt-5 w-full py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 text-sm transition-all">Close</button>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Inventory</h1>
                    {activeCategory === 'BOM Waiting List' ? (
                        waitingStats.shortages > 0 && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><FiAlertTriangle className="w-3 h-3" />{waitingStats.shortages} items with stock shortages in the waiting list</p>
                    ) : (
                        lowStockCount > 0 && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><FiAlertTriangle className="w-3 h-3" />{lowStockCount} low stock item(s) in {activeCategory}</p>
                    )}
                </div>
                {activeCategory !== 'BOM Waiting List' && (
                    <div className="flex gap-2">
                        <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-sm text-white/60 hover:text-white transition-all">
                            <FiUpload className="w-4 h-4" /> Bulk Upload
                        </button>
                        <button onClick={() => setShowBulkEdit(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-sm text-white/60 hover:text-white transition-all">
                            <FiPenTool className="w-4 h-4" /> Bulk Edit
                        </button>
                        {!showAdd && (
                            <button onClick={() => { resetForm(); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all">
                                <FiPlus className="w-4 h-4" /> Add Item
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
                {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => { setActiveCategory(cat); setGlobalFilter(''); }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-white text-black' : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'}`}>
                        {cat}
                    </button>
                ))}
            </div>

            {/* Stats */}
            {activeCategory === 'BOM Waiting List' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { label: 'Total Pending Allocations', value: waitingStats.totalPending, icon: FiBox, color: 'text-indigo-400' },
                        { label: 'Ready to Issue', value: waitingStats.ready, icon: FiCheckCircle, color: 'text-emerald-400' },
                        { label: 'Shortage Items', value: waitingStats.shortages, icon: FiAlertTriangle, color: 'text-red-400' },
                    ].map(s => (
                        <div key={s.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
                            <div className={`p-3 rounded-xl bg-white/5 ${s.color}`}><s.icon className="w-5 h-5" /></div>
                            <div>
                                <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
                                <div className="text-xl font-bold">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { label: `Total ${activeCategory} Items`, value: stats.totalItems, prefix: '', icon: FiBox, color: 'text-indigo-400' },
                        { label: `${activeCategory} Stock Value`, value: Number(stats.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }), prefix: `${currency || 'LKR'} `, icon: FiDollarSign, color: 'text-emerald-400' },
                        { label: 'Low Stock Items', value: stats.lowStock, prefix: '', icon: FiAlertTriangle, color: 'text-red-400' },
                    ].map(s => (
                        <div key={s.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
                            <div className={`p-3 rounded-xl bg-white/5 ${s.color}`}><s.icon className="w-5 h-5" /></div>
                            <div>
                                <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
                                <div className="text-xl font-bold">{s.prefix}{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

                    {/* Add/Edit form */}
            {showAdd && (
                <div className="bg-black/50 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold">{isEditing ? 'Edit Item' : `Add ${activeCategory}`}</h2>
                        <button onClick={resetForm} className="p-1 text-white/30 hover:text-white"><FiX /></button>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        <Input label="Item Code" value={formData.item_code} onChange={e => f('item_code', e.target.value)} placeholder="Auto-generated" className="bg-black/40 border-white/10" />
                        <Input label="Name" value={formData.name} onChange={e => f('name', e.target.value)} className="bg-black/40 border-white/10" />
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-400">Type</label>
                            {activeCategory === 'Paper' ? (
                                <select value={formData.type} onChange={e => f('type', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20">
                                    <option value="">Select type</option>
                                    <option>OFFSET</option><option>DIGITAL</option><option>BOTH</option>
                                </select>
                            ) : (
                                <input list="type-list" value={formData.type} onChange={e => f('type', e.target.value)} placeholder="Type…" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                            )}
                            <datalist id="type-list"><option value="Art"/><option value="Bond"/><option value="Gloss"/><option value="Offset Plate"/><option value="Cyan"/><option value="Magenta"/></datalist>
                        </div>
                        {activeCategory === 'Paper' && <>
                            <Input label="Width (cm)" type="number" step="0.01" value={formData.width_cm} onChange={e => f('width_cm', e.target.value)} className="bg-black/40 border-white/10" />
                            <Input label="Height (cm)" type="number" step="0.01" value={formData.height_cm} onChange={e => f('height_cm', e.target.value)} className="bg-black/40 border-white/10" />
                        </>}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-gray-400">UoM</label>
                            <input list="uom-list" value={formData.uom} onChange={e => f('uom', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                            <datalist id="uom-list"><option value="Sheet"/><option value="Kg"/><option value="Ltr"/><option value="Unit"/><option value="Packet"/></datalist>
                        </div>
                        <Input label="Unit Cost" type="number" step="0.00001" value={formData.unit_cost} onChange={e => f('unit_cost', e.target.value)} className="bg-black/40 border-white/10" />
                        {activeCategory !== 'Statics' && <>
                            {isEditing ? null : <Input label="Stock Qty" type="number" value={formData.stock_quantity} onChange={e => f('stock_quantity', e.target.value)} className="bg-black/40 border-white/10" />}
                            <Input label="Min Stock" type="number" value={formData.min_stock} onChange={e => f('min_stock', e.target.value)} className="bg-black/40 border-white/10" />
                        </>}
                        {activeCategory === 'Statics' && (
                            <div className="flex flex-col gap-1.5 justify-end">
                                <label className="text-sm font-medium text-gray-400">Status</label>
                                <button type="button"
                                    onClick={() => f('is_active', formData.is_active ? 0 : 1)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                                        formData.is_active
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                                    }`}>
                                    <span className={`w-2 h-2 rounded-full ${formData.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    {formData.is_active ? 'Active' : 'Inactive'}
                                </button>
                            </div>
                        )}
                        <div className="flex items-end">
                            <Button onClick={handleSubmit} className="w-full bg-white text-black hover:bg-gray-100 h-[44px] text-sm font-semibold">{isEditing ? 'Update' : 'Save'}</Button>
                        </div>
                    </div>
                    {/* Description for Statics */}
                    {activeCategory === 'Statics' && (
                        <div className="mt-3">
                            <label className="text-sm font-medium text-gray-400 block mb-1.5">Description</label>
                            <textarea
                                rows={3}
                                value={formData.description}
                                onChange={e => f('description', e.target.value)}
                                placeholder="Describe this asset…"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none text-sm"
                            />
                        </div>
                    )}
                    {/* BOM Editor — only for SF / FG */}
                    {BOM_CATEGORIES.includes(isEditing ? formData.category : activeCategory) && (
                        <div className="mt-5 pt-5 border-t border-white/[0.06]">
                            <BomEditor bomLines={bomLines} onChange={setBomLines} />
                        </div>
                    )}
                </div>
            )}

            {activeCategory === 'BOM Waiting List' ? (
                <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-5 border-b border-white/[0.05] flex justify-between items-center flex-wrap gap-3 bg-white/[0.01]">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Pending BOM Material Allocations</h2>
                            <p className="text-xs text-white/35 mt-0.5">Issues pending across all active Sales Orders</p>
                        </div>
                        <button
                            onClick={fetchWaitingList}
                            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                        >
                            <FiClock className="w-3.5 h-3.5" /> Refresh List
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Order</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Material / Component</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Type</th>
                                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Required</th>
                                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Issued</th>
                                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Remaining</th>
                                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Available Stock</th>
                                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider">Status</th>
                                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-white/35 uppercase tracking-wider w-[240px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {waitingListLoading ? (
                                    <tr><td colSpan="9" className="py-16 text-center text-white/25 text-sm animate-pulse">Loading waiting list...</td></tr>
                                ) : waitingList.length === 0 ? (
                                    <tr><td colSpan="9" className="py-16 text-center text-white/25 text-sm italic">No pending material issuances found!</td></tr>
                                ) : (
                                    waitingList.map((item) => {
                                        const req = parseFloat(item.required_qty);
                                        const issued = parseFloat(item.issued_qty);
                                        const remaining = Math.max(0, req - issued);
                                        const available = parseFloat(item.available_qty || 0);

                                        const isFullyIssued = remaining === 0;
                                        const isPartiallyIssued = issued > 0 && remaining > 0;
                                        const isPending = issued === 0;

                                        return (
                                            <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <a
                                                        href={`/dashboard/sales-orders/${item.sales_order_id}`}
                                                        className="font-semibold text-white hover:text-emerald-400 transition-colors text-sm block"
                                                    >
                                                        {item.sales_order_code}
                                                    </a>
                                                    <span className="text-[10px] text-white/30 block mt-0.5 truncate max-w-[150px]" title={item.customer_name}>{item.customer_name}</span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <p className="font-semibold text-white text-sm">{item.component_name}</p>
                                                    {item.item_code && (
                                                        <p className="text-xs text-white/30 mt-0.5 font-mono">{item.item_code}</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                                        item.component_type === 'paper' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                                                        item.component_type === 'plate' ? 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20' :
                                                        item.component_type === 'sfg' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                                                        'bg-violet-500/10 text-violet-300 border-violet-500/20'
                                                    }`}>
                                                        {item.component_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-right font-mono text-sm text-white font-medium">{req} {item.uom}</td>
                                                <td className="px-4 py-3.5 text-right font-mono text-sm text-emerald-400 font-medium">{issued} {item.uom}</td>
                                                <td className="px-4 py-3.5 text-right font-mono text-sm text-white/55">{remaining} {item.uom}</td>
                                                <td className="px-4 py-3.5 text-right font-mono text-sm">
                                                    <span className={available < remaining ? 'text-red-400 font-semibold' : 'text-white/60'}>
                                                        {available} {item.uom}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                        isFullyIssued ? 'bg-emerald-500/15 text-emerald-400' :
                                                        isPartiallyIssued ? 'bg-amber-500/15 text-amber-400' :
                                                        'bg-white/10 text-white/50'
                                                    }`}>
                                                        {isFullyIssued ? 'Fully Issued' : isPartiallyIssued ? 'Partial' : 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 text-right">
                                                    {!isFullyIssued ? (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedWaitingItem(item);
                                                                setWaitingIssueModalQty(String(remaining));
                                                            }}
                                                            className="bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                                        >
                                                            Issue Stock
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-white/25 italic">No actions pending</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <>
                    {/* Table toolbar */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-xs">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
                                placeholder="Search name, code, type…"
                                className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20" />
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExportPDF}
                                disabled={exportingPdf}
                                className="flex items-center gap-2 bg-black/30 border border-white/10 text-gray-300 px-3 py-1.5 rounded-xl text-xs font-semibold hover:border-white/20 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <FiDownload className="w-3.5 h-3.5" /> {exportingPdf ? 'Exporting...' : 'Export PDF'}
                            </button>
                            {selectedIds.length > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-2 bg-red-950/40 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-red-900/40 hover:border-red-500/50 hover:text-red-300 transition-all shadow-lg shadow-red-950/20"
                                >
                                    <FiTrash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.length})
                                </button>
                            )}
                            <p className="text-xs text-white/30 shrink-0">{table.getFilteredRowModel().rows.length} items</p>
                        </div>
                    </div>

                    {/* TanStack Table */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/[0.07] rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    {table.getHeaderGroups().map(hg => (
                                        <tr key={hg.id} className="border-b border-white/[0.06] bg-white/[0.02]">
                                            {hg.headers.map(header => (
                                                <th key={header.id} style={{ width: header.getSize() }}
                                                    className="px-4 py-3 text-left text-[11px] font-semibold text-white/35 uppercase tracking-wider select-none">
                                                    {header.column.getCanSort() ? (
                                                        <button onClick={header.column.getToggleSortingHandler()} className="flex items-center gap-1 hover:text-white/70 transition-colors">
                                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                                            {header.column.getIsSorted() === 'asc' ? <FiChevronUp className="w-3 h-3" /> : header.column.getIsSorted() === 'desc' ? <FiChevronDown className="w-3 h-3" /> : <span className="w-3" />}
                                                        </button>
                                                    ) : flexRender(header.column.columnDef.header, header.getContext())}
                                                    {header.column.getCanFilter() && <ColumnFilter column={header.column} />}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {loading ? (
                                        <tr><td colSpan={columns.length} className="py-16 text-center text-white/25 text-sm">Loading…</td></tr>
                                    ) : table.getRowModel().rows.length === 0 ? (
                                        <tr><td colSpan={columns.length} className="py-16 text-center text-white/25 text-sm">No items found in {activeCategory}</td></tr>
                                    ) : table.getRowModel().rows.map(row => {
                                        const low = row.original.stock_quantity < (row.original.min_stock || 0);
                                        const inactive = row.original.is_active === 0;
                                        return (
                                            <tr key={row.id} className={`hover:bg-white/[0.02] transition-colors ${low ? 'bg-red-500/[0.04]' : ''} ${inactive ? 'opacity-50' : ''}`}>
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="px-4 py-3">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {table.getPageCount() > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05]">
                                <div className="flex items-center gap-1">
                                    <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/[0.06] text-white/40 hover:text-white transition-all"><FiChevronsLeft className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/[0.06] text-white/40 hover:text-white transition-all"><FiChevronLeft className="w-3.5 h-3.5" /></button>
                                    <span className="text-xs text-white/35 px-2">Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
                                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/[0.06] text-white/40 hover:text-white transition-all"><FiChevronRight className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-white/[0.06] text-white/40 hover:text-white transition-all"><FiChevronsRight className="w-3.5 h-3.5" /></button>
                                </div>
                                <select value={table.getState().pagination.pageSize} onChange={e => table.setPageSize(Number(e.target.value))}
                                    className="text-xs bg-black/40 border border-white/[0.07] rounded-lg px-2 py-1.5 text-white/40 focus:outline-none">
                                    {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Restock Modal */}
            {restockItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-base font-semibold mb-1">Restock</h2>
                        <p className="text-xs text-white/40 mb-5">{restockItem.name}</p>
                        <div className="space-y-4">
                            <Input label="Quantity to Add" type="number" autoFocus value={restockData.quantity} onChange={e => setRestockData(p => ({ ...p, quantity: e.target.value }))} className="bg-black/40 border-white/10" />
                            <Input label="Notes / Reference" value={restockData.notes} onChange={e => setRestockData(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. PO #123" className="bg-black/40 border-white/10" />
                            {/* BOM deduction preview */}
                            {restockBom.length > 0 && (
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-2">
                                    <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">BOM — Components to deduct</p>
                                    {restockBom.map((line, i) => {
                                        const deduct = parseFloat(line.quantity) * (parseFloat(restockData.quantity) || 0);
                                        const insufficient = deduct > parseFloat(line.component_stock || 0);
                                        return (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <span className="text-white/70">{line.component_name}</span>
                                                <span className={`font-mono ${insufficient ? 'text-red-400' : 'text-white/50'}`}>
                                                    -{deduct.toFixed(4)} {line.component_uom}
                                                    {insufficient && <span className="ml-1 text-[10px] text-red-400">(low!)</span>}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button onClick={() => setRestockItem(null)} className="flex-1 bg-transparent border border-white/10 hover:bg-white/5">Cancel</Button>
                            <Button onClick={handleRestock} className="flex-1 bg-white text-black hover:bg-white/90">Save</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stock Issue Modal */}
            {selectedWaitingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-base font-semibold text-white">Issue Stock</h2>
                                <p className="text-xs text-white/40 mt-0.5">Sales Order: {selectedWaitingItem.sales_order_code}</p>
                            </div>
                            <button onClick={() => setSelectedWaitingItem(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><FiX /></button>
                        </div>

                        <div className="space-y-4 flex-1">
                            {/* Job Details Card */}
                            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/40">Customer Name:</span>
                                    <span className="text-white font-medium">{selectedWaitingItem.customer_name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/40">Order Date:</span>
                                    <span className="text-white font-medium">{new Date(selectedWaitingItem.order_date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-white/40">Material Component:</span>
                                    <span className="text-white font-medium">{selectedWaitingItem.component_name}</span>
                                </div>
                                {selectedWaitingItem.item_code && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-white/40">Item Code:</span>
                                        <span className="font-mono text-white font-medium">{selectedWaitingItem.item_code}</span>
                                    </div>
                                )}
                            </div>

                            {/* Stock Metrics Card */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/[0.01] border border-white/[0.04] rounded-lg p-3">
                                    <p className="text-[10px] text-white/35 uppercase font-bold tracking-wider">Required</p>
                                    <p className="text-lg font-semibold font-mono text-white mt-1">
                                        {parseFloat(selectedWaitingItem.required_qty)} <span className="text-xs text-white/40">{selectedWaitingItem.uom}</span>
                                    </p>
                                </div>
                                <div className="bg-white/[0.01] border border-white/[0.04] rounded-lg p-3">
                                    <p className="text-[10px] text-white/35 uppercase font-bold tracking-wider">Already Issued</p>
                                    <p className="text-lg font-semibold font-mono text-emerald-400 mt-1">
                                        {parseFloat(selectedWaitingItem.issued_qty)} <span className="text-xs text-emerald-400/60">{selectedWaitingItem.uom}</span>
                                    </p>
                                </div>
                                <div className="bg-white/[0.01] border border-white/[0.04] rounded-lg p-3">
                                    <p className="text-[10px] text-white/35 uppercase font-bold tracking-wider">Remaining Needed</p>
                                    <p className="text-lg font-semibold font-mono text-amber-400 mt-1">
                                        {Math.max(0, parseFloat(selectedWaitingItem.required_qty) - parseFloat(selectedWaitingItem.issued_qty))} <span className="text-xs text-amber-400/60">{selectedWaitingItem.uom}</span>
                                    </p>
                                </div>
                                <div className="bg-white/[0.01] border border-white/[0.04] rounded-lg p-3">
                                    <p className="text-[10px] text-white/35 uppercase font-bold tracking-wider">Available Stock</p>
                                    <p className="text-lg font-semibold font-mono text-white mt-1">
                                        {parseFloat(selectedWaitingItem.available_qty)} <span className="text-xs text-white/40">{selectedWaitingItem.uom}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Warning if stock is insufficient */}
                            {parseFloat(selectedWaitingItem.available_qty) < (parseFloat(selectedWaitingItem.required_qty) - parseFloat(selectedWaitingItem.issued_qty)) && (
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.04] text-red-400 text-xs">
                                    <FiAlertTriangle className="flex-shrink-0 w-4 h-4" />
                                    <span>Warning: Available stock is less than the remaining required quantity.</span>
                                </div>
                            )}

                            {/* Input for Quantity to Issue */}
                            <Input
                                label="Quantity to Issue Now"
                                type="number"
                                step="any"
                                min="0.0001"
                                max={Math.max(0, parseFloat(selectedWaitingItem.required_qty) - parseFloat(selectedWaitingItem.issued_qty))}
                                value={waitingIssueModalQty}
                                onChange={e => setWaitingIssueModalQty(e.target.value)}
                                className="bg-black/40 border-white/10"
                                autoFocus
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2.5 mt-6">
                            <Button
                                onClick={() => setSelectedWaitingItem(null)}
                                className="flex-1 bg-transparent border border-white/10 hover:bg-white/5 text-white"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => handlePrintIssueNote(selectedWaitingItem, waitingIssueModalQty)}
                                className="flex-1 bg-white/[0.06] border border-white/10 hover:bg-white/10 text-white flex items-center justify-center gap-1.5"
                            >
                                Print Note
                            </Button>
                            <Button
                                onClick={() => handleIssueWaitingStock(selectedWaitingItem, waitingIssueModalQty)}
                                disabled={
                                    issuingWaitingId === selectedWaitingItem.id ||
                                    !waitingIssueModalQty ||
                                    parseFloat(waitingIssueModalQty) <= 0 ||
                                    parseFloat(waitingIssueModalQty) > parseFloat(selectedWaitingItem.available_qty) ||
                                    parseFloat(waitingIssueModalQty) > (parseFloat(selectedWaitingItem.required_qty) - parseFloat(selectedWaitingItem.issued_qty))
                                }
                                className="flex-1 bg-emerald-500 text-black hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                            >
                                {issuingWaitingId === selectedWaitingItem.id ? 'Issuing...' : 'Confirm Issue'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {historyItem && !restockItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-5">
                            <div><h2 className="text-base font-semibold">Transaction History</h2><p className="text-xs text-white/40 mt-0.5">{historyItem.name}</p></div>
                            <button onClick={() => setHistoryItem(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"><FiX /></button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-sm border-collapse">
                                <thead className="sticky top-0">
                                    <tr className="bg-[#111] border-b border-white/[0.06]">
                                        {['Date', 'Type', 'Qty', 'Notes'].map(h => <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold text-white/35 uppercase tracking-wider">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {loadingHistory ? <tr><td colSpan={4} className="py-8 text-center text-white/25">Loading…</td></tr>
                                        : historyData.length === 0 ? <tr><td colSpan={4} className="py-8 text-center text-white/25">No transactions found.</td></tr>
                                            : historyData.map(log => (
                                                <tr key={log.id} className="hover:bg-white/[0.02]">
                                                    <td className="px-3 py-2.5 text-xs text-white/40">{new Date(log.created_at).toLocaleString()}</td>
                                                    <td className="px-3 py-2.5"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${log.type === 'issue_note' ? 'bg-white/[0.06] text-white/60 border-white/[0.1]' : 'bg-white/[0.03] text-white/40 border-white/[0.06]'}`}>{log.type.replace('_', ' ')}</span></td>
                                                    <td className={`px-3 py-2.5 font-mono font-semibold ${log.quantity > 0 ? 'text-white' : 'text-red-400'}`}>{log.quantity > 0 ? '+' : ''}{parseFloat(log.quantity)}</td>
                                                    <td className="px-3 py-2.5 text-sm text-white/50">{log.notes}</td>
                                                </tr>
                                            ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulk && <BulkUploadModal onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); fetchItems(); }} />}

            {/* Bulk Edit Modal */}
            {showBulkEdit && (
                <BulkEditModal
                    type="inventory"
                    data={items}
                    onClose={() => setShowBulkEdit(false)}
                    onComplete={() => { fetchItems(); toast.success('Inventory updated!'); }}
                />
            )}
        </div>
    );
}
