'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiCheckCircle, FiPackage, FiAlertTriangle, FiSearch, FiRefreshCw,
    FiPrinter, FiBox, FiPlus, FiTrash2, FiLayers, FiCheck, FiX,
    FiFileText, FiTag, FiBarChart2, FiShield, FiSliders
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';

export default function QualityPackingPage() {
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState([]);
    const [inspections, setInspections] = useState([]);
    const [boxes, setBoxes] = useState([]);

    const [activeTab, setActiveTab] = useState('qc'); // 'qc' | 'packing'
    const [searchQuery, setSearchQuery] = useState('');
    const [qcFilter, setQcFilter] = useState('all'); // 'all' | 'pending' | 'passed' | 'failed'

    // QC Inspection Modal state
    const [showQcModal, setShowQcModal] = useState(false);
    const [selectedOrderForQc, setSelectedOrderForQc] = useState(null);
    const [qcForm, setQcForm] = useState({
        status: 'Passed',
        sample_size: 10,
        passed_qty: 0,
        failed_qty: 0,
        defect_category: '',
        inspector_name: 'Quality Tech',
        notes: '',
    });

    // Auto-Box / Pack Generator Modal state
    const [showPackModal, setShowPackModal] = useState(false);
    const [selectedOrderForPack, setSelectedOrderForPack] = useState(null);
    const [packForm, setPackForm] = useState({
        total_quantity: 0,
        qty_per_box: 250,
        package_type: 'Box',
        weight_kg: 2.5,
        notes: '',
        packed_by: 'Packing Operator',
    });

    // Label Preview & Print Modal state
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [selectedBoxForLabel, setSelectedBoxForLabel] = useState(null);
    const [batchLabelsOrder, setBatchLabelsOrder] = useState(null);

    const printAreaRef = useRef(null);

    const [companyInfo, setCompanyInfo] = useState({
        name: 'PRESSMATICS PRINTERS',
        address: '123 Industrial Zone, Colombo 03',
        phone: '+94 11 234 5678',
        email: 'info@pressmatics.com'
    });

    useEffect(() => {
        loadData();
        fetchCompanySettings();
    }, []);

    async function fetchCompanySettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data && !data.error) {
                setCompanyInfo({
                    name: data.company_name || data.site_title || 'PRESSMATICS PRINTERS',
                    address: data.company_address || data.address || '123 Industrial Zone, Colombo 03',
                    phone: data.company_phone || data.phone || '+94 11 234 5678',
                    email: data.company_email || data.email || 'info@pressmatics.com',
                });
            }
        } catch (e) {
            console.error('Failed to fetch company settings:', e);
        }
    }

    async function loadData() {
        setLoading(true);
        try {
            const res = await fetch(`/api/quality-packing?t=${Date.now()}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setOrders(data.orders || []);
            setInspections(data.inspections || []);
            setBoxes(data.boxes || []);
        } catch (err) {
            toast.error('Failed to load quality & packing data');
        } finally {
            setLoading(false);
        }
    }

    // Helper map of inspections per order
    const getOrderQcStatus = (orderId) => {
        const orderInspections = inspections.filter(i => i.sales_order_id === orderId);
        if (orderInspections.length === 0) return { status: 'Pending', icon: FiAlertTriangle, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
        const hasFailed = orderInspections.some(i => i.status === 'Failed');
        if (hasFailed) return { status: 'Failed', icon: FiX, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
        return { status: 'Passed', icon: FiCheckCircle, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    };

    // Helper map of boxes per order
    const getOrderBoxes = (orderId) => {
        return boxes.filter(b => b.sales_order_id === orderId);
    };

    const getOrderPackedQty = (orderId) => {
        const orderBoxes = getOrderBoxes(orderId);
        return orderBoxes.reduce((acc, b) => acc + (b.quantity || 0), 0);
    };

    // Filtered list of orders
    const filteredOrders = orders.filter(ord => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = !query ||
            (ord.code && ord.code.toLowerCase().includes(query)) ||
            (ord.customer_name && ord.customer_name.toLowerCase().includes(query)) ||
            (ord.estimation_names && ord.estimation_names.toLowerCase().includes(query));

        if (!matchesSearch) return false;

        const qcStatus = getOrderQcStatus(ord.id).status.toLowerCase();
        if (qcFilter === 'pending') return qcStatus === 'pending';
        if (qcFilter === 'passed') return qcStatus === 'passed';
        if (qcFilter === 'failed') return qcStatus === 'failed';

        return true;
    });

    // Handle QC submission
    const handleOpenQcModal = (order) => {
        setSelectedOrderForQc(order);
        setQcForm({
            status: 'Passed',
            sample_size: Math.min(50, order.quantity || 10),
            passed_qty: order.quantity || 0,
            failed_qty: 0,
            defect_category: '',
            inspector_name: 'Quality Tech',
            notes: '',
        });
        setShowQcModal(true);
    };

    const handleSaveQc = async (e) => {
        e.preventDefault();
        if (!selectedOrderForQc) return;

        try {
            const res = await fetch('/api/quality-packing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sales_order_id: selectedOrderForQc.id,
                    sales_order_code: selectedOrderForQc.code,
                    customer_name: selectedOrderForQc.customer_name,
                    item_name: selectedOrderForQc.estimation_names || 'Printed Item',
                    ...qcForm,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success('Quality inspection logged!');
            setShowQcModal(false);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Error saving inspection');
        }
    };

    // Handle Auto-Packing submission
    const handleOpenPackModal = (order) => {
        setSelectedOrderForPack(order);
        const orderBoxes = getOrderBoxes(order.id);
        const packedSoFar = getOrderPackedQty(order.id);
        const remaining = Math.max(0, (order.quantity || 0) - packedSoFar);

        setPackForm({
            total_quantity: remaining > 0 ? remaining : (order.quantity || 100),
            qty_per_box: Math.min(500, remaining || order.quantity || 100),
            package_type: 'Box',
            weight_kg: 2.5,
            notes: '',
            packed_by: 'Packing Operator',
        });
        setShowPackModal(true);
    };

    const handleGenerateBoxes = async (e) => {
        e.preventDefault();
        if (!selectedOrderForPack) return;

        try {
            const res = await fetch('/api/quality-packing/boxes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'batch_auto_pack',
                    sales_order_id: selectedOrderForPack.id,
                    sales_order_code: selectedOrderForPack.code,
                    customer_name: selectedOrderForPack.customer_name,
                    item_name: selectedOrderForPack.estimation_names || 'Printed Product',
                    ...packForm,
                }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success(data.message || 'Packing boxes generated!');
            setShowPackModal(false);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Error generating boxes');
        }
    };

    const handleDeleteBox = async (boxId) => {
        if (!confirm('Are you sure you want to delete this packing box?')) return;
        try {
            const res = await fetch(`/api/quality-packing/boxes?id=${boxId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success('Box deleted');
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to delete box');
        }
    };

    // Print label action
    const handlePrintSingleLabel = (box) => {
        setSelectedBoxForLabel(box);
        setBatchLabelsOrder(null);
        setShowLabelModal(true);
    };

    const handlePrintBatchLabels = (order) => {
        const orderBoxes = getOrderBoxes(order.id);
        if (orderBoxes.length === 0) {
            toast.error('No packing boxes created for this job yet');
            return;
        }
        setBatchLabelsOrder(order);
        setSelectedBoxForLabel(null);
        setShowLabelModal(true);
    };

    const triggerBrowserPrint = () => {
        window.print();
    };

    // Stats calculations
    const totalOrdersCount = orders.length;
    const passedInspectionsCount = inspections.filter(i => i.status === 'Passed').length;
    const failedInspectionsCount = inspections.filter(i => i.status === 'Failed').length;
    const totalInspections = inspections.length;
    const passRate = totalInspections > 0 ? Math.round((passedInspectionsCount / totalInspections) * 100) : 100;
    const totalBoxesCount = boxes.length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 print:p-0 print:m-0 print:max-w-none">
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
                        <span className="p-2.5 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
                            <FiShield className="w-6 h-6" />
                        </span>
                        Quality Control & Packing
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Inspect production output, manage package box lots, and generate printable barcode labels.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-gray-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active Jobs</p>
                        <h3 className="text-2xl font-bold text-white mt-1">{totalOrdersCount}</h3>
                    </div>
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                        <FiFileText className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">QC Pass Rate</p>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">{passRate}%</h3>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                        <FiCheckCircle className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Boxes Packed</p>
                        <h3 className="text-2xl font-bold text-purple-400 mt-1">{totalBoxesCount}</h3>
                    </div>
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                        <FiBox className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Defect Logs</p>
                        <h3 className="text-2xl font-bold text-rose-400 mt-1">{failedInspectionsCount}</h3>
                    </div>
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                        <FiAlertTriangle className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-2.5 rounded-2xl print:hidden">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('qc')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'qc'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <FiShield className="w-4 h-4" />
                        1. Quality Inspection Hub
                    </button>

                    <button
                        onClick={() => setActiveTab('packing')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'packing'
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <FiPackage className="w-4 h-4" />
                        2. Packing & Label Station
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 px-2">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search orders, customers, items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    {activeTab === 'qc' && (
                        <select
                            value={qcFilter}
                            onChange={(e) => setQcFilter(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="all" className="bg-gray-900">All QC Status</option>
                            <option value="pending" className="bg-gray-900">Pending</option>
                            <option value="passed" className="bg-gray-900">Passed</option>
                            <option value="failed" className="bg-gray-900">Failed</option>
                        </select>
                    )}
                </div>
            </div>

            {/* TAB CONTENT 1: Quality Control Hub */}
            {activeTab === 'qc' && (
                <div className="space-y-6 print:hidden">
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <FiCheckCircle className="text-emerald-400" />
                                Quality Inspection Queue
                            </h3>
                            <span className="text-xs text-gray-400 font-mono">{filteredOrders.length} orders found</span>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-gray-400">Loading quality queue...</div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">No jobs match the inspection criteria.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                            <th className="py-3.5 px-4">Order Code</th>
                                            <th className="py-3.5 px-4">Customer</th>
                                            <th className="py-3.5 px-4">Item / Estimation</th>
                                            <th className="py-3.5 px-4">Order Qty</th>
                                            <th className="py-3.5 px-4">QC Status</th>
                                            <th className="py-3.5 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm text-gray-200">
                                        {filteredOrders.map((ord) => {
                                            const qc = getOrderQcStatus(ord.id);
                                            const StatusIcon = qc.icon;
                                            return (
                                                <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                                                        {ord.code}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-medium text-white">
                                                        {ord.customer_name || 'N/A'}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-gray-300 max-w-xs truncate">
                                                        {ord.estimation_names || 'Printed Product'}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-mono font-semibold">
                                                        {(ord.quantity || 0).toLocaleString()} pcs
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${qc.color}`}>
                                                            <StatusIcon className="w-3.5 h-3.5" />
                                                            {qc.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-right">
                                                        <button
                                                            onClick={() => handleOpenQcModal(ord)}
                                                            className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg text-indigo-300 text-xs font-semibold transition-all cursor-pointer"
                                                        >
                                                            Log Inspection
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT 2: Packing & Label Station */}
            {activeTab === 'packing' && (
                <div className="space-y-6 print:hidden">
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <FiBox className="text-purple-400" />
                                Packing & Box Lot Station
                            </h3>
                            <span className="text-xs text-gray-400 font-mono">{filteredOrders.length} ready jobs</span>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center text-gray-400">Loading packing queue...</div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="p-12 text-center text-gray-400">No jobs available for packing.</div>
                        ) : (
                            <div className="divide-y divide-white/10">
                                {filteredOrders.map((ord) => {
                                    const orderBoxes = getOrderBoxes(ord.id);
                                    const packedQty = getOrderPackedQty(ord.id);
                                    const totalQty = ord.quantity || 0;
                                    const isFullyPacked = packedQty >= totalQty && totalQty > 0;

                                    return (
                                        <div key={ord.id} className="p-5 hover:bg-white/[0.01] transition-colors space-y-4">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono font-bold text-lg text-indigo-400">{ord.code}</span>
                                                        <span className="text-sm font-semibold text-white">{ord.customer_name}</span>
                                                        {isFullyPacked ? (
                                                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                                                                Fully Packed
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold">
                                                                Packing in Progress
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {ord.estimation_names || 'Printed Product'} &bull; Ordered: <strong className="text-white">{totalQty.toLocaleString()} pcs</strong> &bull; Packed: <strong className="text-purple-300">{packedQty.toLocaleString()} pcs</strong>
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenPackModal(ord)}
                                                        className="px-3.5 py-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded-xl text-purple-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                                                    >
                                                        <FiPlus className="w-3.5 h-3.5" />
                                                        Generate / Add Boxes
                                                    </button>

                                                    {orderBoxes.length > 0 && (
                                                        <button
                                                            onClick={() => handlePrintBatchLabels(ord)}
                                                            className="px-3.5 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                                                        >
                                                            <FiPrinter className="w-3.5 h-3.5" />
                                                            Print All Labels ({orderBoxes.length})
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Existing Boxes Grid */}
                                            {orderBoxes.length > 0 && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                                                    {orderBoxes.map((box) => (
                                                        <div key={box.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between space-y-3">
                                                            <div>
                                                                <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                                                                    <span>BOX {box.box_number} OF {box.total_boxes}</span>
                                                                    <span className="text-gray-400 font-normal">{box.package_type || 'Box'}</span>
                                                                </div>
                                                                <div className="text-lg font-bold text-white mt-1">
                                                                    {(box.quantity || 0).toLocaleString()} <span className="text-xs font-normal text-gray-400">pcs</span>
                                                                </div>
                                                                {box.weight_kg > 0 && (
                                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                                        Weight: {box.weight_kg} kg
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                                                <button
                                                                    onClick={() => handlePrintSingleLabel(box)}
                                                                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white transition-all flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <FiTag className="w-3 h-3 text-indigo-400" />
                                                                    Label
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteBox(box.id)}
                                                                    className="p-1 text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                                                                    title="Delete Box"
                                                                >
                                                                    <FiTrash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 1: QC Inspection Modal */}
            <AnimatePresence>
                {showQcModal && selectedOrderForQc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-gray-900 border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-5 text-white"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <FiShield className="text-emerald-400" />
                                        Log Quality Inspection
                                    </h3>
                                    <p className="text-xs text-gray-400">{selectedOrderForQc.code} &bull; {selectedOrderForQc.customer_name}</p>
                                </div>
                                <button onClick={() => setShowQcModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveQc} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Inspection Status</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setQcForm({ ...qcForm, status: 'Passed' })}
                                            className={`p-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${qcForm.status === 'Passed'
                                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                                                    : 'bg-white/5 border-white/10 text-gray-400'
                                                }`}
                                        >
                                            <FiCheckCircle className="w-4 h-4" />
                                            PASSED QC
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setQcForm({ ...qcForm, status: 'Failed' })}
                                            className={`p-3 rounded-xl border font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${qcForm.status === 'Failed'
                                                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                                                    : 'bg-white/5 border-white/10 text-gray-400'
                                                }`}
                                        >
                                            <FiX className="w-4 h-4" />
                                            FAILED / REWORK
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Passed Quantity</label>
                                        <input
                                            type="number"
                                            value={qcForm.passed_qty}
                                            onChange={(e) => setQcForm({ ...qcForm, passed_qty: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Failed / Reject Qty</label>
                                        <input
                                            type="number"
                                            value={qcForm.failed_qty}
                                            onChange={(e) => setQcForm({ ...qcForm, failed_qty: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                {qcForm.status === 'Failed' && (
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Defect Category</label>
                                        <select
                                            value={qcForm.defect_category}
                                            onChange={(e) => setQcForm({ ...qcForm, defect_category: e.target.value })}
                                            className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                                        >
                                            <option value="">Select Defect Category...</option>
                                            <option value="Bleed / Trim Alignment">Bleed / Trim Alignment</option>
                                            <option value="Color Match / Density">Color Match / Density</option>
                                            <option value="Smudge / Printing Defect">Smudge / Printing Defect</option>
                                            <option value="Finishing / Lamination Error">Finishing / Lamination Error</option>
                                            <option value="Paper Stock Damage">Paper Stock Damage</option>
                                            <option value="Shortage / Miscount">Shortage / Miscount</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Inspector Notes</label>
                                    <textarea
                                        rows={3}
                                        value={qcForm.notes}
                                        onChange={(e) => setQcForm({ ...qcForm, notes: e.target.value })}
                                        placeholder="Add inspection observations, color proofs checked, sample test details..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setShowQcModal(false)}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-gray-300 cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-emerald-600/30 cursor-pointer"
                                    >
                                        Save Inspection
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL 2: Auto Box Lot Generator Modal */}
            <AnimatePresence>
                {showPackModal && selectedOrderForPack && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-gray-900 border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-5 text-white"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <FiBox className="text-purple-400" />
                                        Auto-Generate Packing Boxes
                                    </h3>
                                    <p className="text-xs text-gray-400">{selectedOrderForPack.code} &bull; {selectedOrderForPack.customer_name}</p>
                                </div>
                                <button onClick={() => setShowPackModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleGenerateBoxes} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Total Quantity to Pack</label>
                                        <input
                                            type="number"
                                            value={packForm.total_quantity}
                                            onChange={(e) => setPackForm({ ...packForm, total_quantity: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Qty Per Box / Bundle</label>
                                        <input
                                            type="number"
                                            value={packForm.qty_per_box}
                                            onChange={(e) => setPackForm({ ...packForm, qty_per_box: parseInt(e.target.value) || 1 })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Package Type</label>
                                        <select
                                            value={packForm.package_type}
                                            onChange={(e) => setPackForm({ ...packForm, package_type: e.target.value })}
                                            className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                                        >
                                            <option value="Box">Standard Box</option>
                                            <option value="Bundle">Paper Bundle</option>
                                            <option value="Pallet">Pallet</option>
                                            <option value="Envelope">Envelope / Pouch</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Approx Weight per Box (kg)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={packForm.weight_kg}
                                            onChange={(e) => setPackForm({ ...packForm, weight_kg: parseFloat(e.target.value) || 0 })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                                        />
                                    </div>
                                </div>

                                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-300 flex items-center justify-between">
                                    <span>Calculated Box Count:</span>
                                    <strong className="text-base font-bold text-white">
                                        {Math.ceil((packForm.total_quantity || 0) / (packForm.qty_per_box || 1))} BOXES
                                    </strong>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setShowPackModal(false)}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-gray-300 cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-purple-600/30 cursor-pointer"
                                    >
                                        Generate Boxes & Labels
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL 3: Printable Thermal Label Generator & Preview */}
            <AnimatePresence>
                {showLabelModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto print:static print:bg-white print:p-0">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-gray-900 border border-white/15 rounded-2xl max-w-2xl w-full p-6 space-y-6 text-white print:border-none print:p-0 print:m-0 print:bg-white print:text-black print:max-w-none"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3 print:hidden">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <FiTag className="text-emerald-400" />
                                        Print Package Label
                                    </h3>
                                    <p className="text-xs text-gray-400">High-resolution 4&quot; x 6&quot; thermal sticker preview</p>
                                </div>
                                <button onClick={() => setShowLabelModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Label Content Container */}
                            <div ref={printAreaRef} className="space-y-6 print:space-y-4">
                                {batchLabelsOrder ? (
                                    getOrderBoxes(batchLabelsOrder.id).map((b) => (
                                        <LabelCard key={b.id} box={b} order={batchLabelsOrder} companyInfo={companyInfo} />
                                    ))
                                ) : selectedBoxForLabel ? (
                                    <LabelCard box={selectedBoxForLabel} order={orders.find(o => o.id === selectedBoxForLabel.sales_order_id)} companyInfo={companyInfo} />
                                ) : null}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 print:hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowLabelModal(false)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-gray-300 cursor-pointer"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={triggerBrowserPrint}
                                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                                >
                                    <FiPrinter className="w-4 h-4" />
                                    Print Label(s) Now
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Sub-component for individual Label render
function LabelCard({ box, order, companyInfo }) {
    if (!box || !order) return null;

    const companyName = companyInfo?.name || 'PRESSMATICS PRINTERS';
    const companyAddress = companyInfo?.address || '';
    const companyContact = [companyInfo?.phone && `TEL: ${companyInfo.phone}`, companyInfo?.email].filter(Boolean).join(' | ');

    return (
        <div className="bg-white text-black p-6 rounded-xl border-4 border-black font-sans shadow-2xl max-w-lg mx-auto print:max-w-none print:shadow-none print:rounded-none print:border-4 print:page-break-after-always">
            {/* Label Header */}
            <div className="border-b-4 border-black pb-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-black tracking-tighter uppercase leading-none">{companyName}</h2>
                    {companyAddress && (
                        <p className="text-[10px] font-bold text-gray-800 uppercase mt-0.5 leading-tight">{companyAddress}</p>
                    )}
                    {companyContact && (
                        <p className="text-[9px] font-mono font-medium text-gray-700 mt-0.5">{companyContact}</p>
                    )}
                </div>
                <div className="text-right shrink-0">
                    <span className="inline-block border-2 border-black bg-black text-white px-2 py-0.5 text-xs font-extrabold uppercase">
                        PASSED QC
                    </span>
                    <p className="text-[9px] font-mono mt-0.5">{new Date().toLocaleDateString()}</p>
                </div>
            </div>

            {/* Main Order Details */}
            <div className="py-4 space-y-3 border-b-4 border-black">
                <div>
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Customer Name</span>
                    <h3 className="text-lg font-black leading-tight uppercase">{order.customer_name || 'VALUED CUSTOMER'}</h3>
                </div>

                <div>
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Item Description</span>
                    <p className="text-sm font-bold leading-snug">{box.item_name || order.estimation_names || 'Printed Product'}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Job Code</span>
                        <p className="text-base font-mono font-black">{order.code}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Package Type</span>
                        <p className="text-base font-bold">{box.package_type || 'Box'}</p>
                    </div>
                </div>
            </div>

            {/* Box Number & Quantity Banner */}
            <div className="py-4 grid grid-cols-2 gap-4 border-b-4 border-black bg-gray-50 -mx-6 px-6">
                <div>
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Box Sequence</span>
                    <h1 className="text-3xl font-black leading-none">
                        {box.box_number} <span className="text-sm font-normal text-gray-600">of {box.total_boxes}</span>
                    </h1>
                </div>

                <div>
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Net Pack Quantity</span>
                    <h1 className="text-3xl font-black leading-none text-emerald-700">
                        {(box.quantity || 0).toLocaleString()} <span className="text-sm font-normal text-gray-600">PCS</span>
                    </h1>
                </div>
            </div>

            {/* Footer Barcode Representation & Stamp */}
            <div className="pt-4 flex items-center justify-between">
                <div>
                    {/* Simulated Barcode */}
                    <div className="h-10 w-44 bg-black flex items-center justify-center text-white text-[10px] font-mono tracking-widest">
                        ||||||||||||||||||||||||||||||
                    </div>
                    <span className="text-[9px] font-mono block mt-1 text-center">{order.code}-B{box.box_number}</span>
                </div>

                <div className="text-right">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-black flex flex-col items-center justify-center text-[8px] font-bold uppercase leading-tight text-center">
                        <span>INSPECTED</span>
                        <span className="text-[10px] font-black">OK</span>
                        <span>PRESSMATICS</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
