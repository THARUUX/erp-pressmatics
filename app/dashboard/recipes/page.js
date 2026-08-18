'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiBookOpen, FiPlus, FiSearch, FiRefreshCw, FiEdit, FiTrash2,
    FiCopy, FiPrinter, FiX, FiCheckCircle, FiDollarSign, FiLayers,
    FiSliders, FiBox, FiClock, FiFileText, FiInfo, FiChevronRight,
    FiTrendingUp, FiCheck, FiAlertCircle
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';

export default function ProductRecipesPage() {
    const [recipes, setRecipes] = useState([]);
    const [inventoryItems, setInventoryItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedStatus, setSelectedStatus] = useState('All');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState('info'); // info | materials | steps | costing
    const [editingRecipeId, setEditingRecipeId] = useState(null);

    // Print Modal state
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedRecipeDetail, setSelectedRecipeDetail] = useState(null);
    const printAreaRef = useRef(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        category: 'Packaging',
        status: 'Draft',
        yield_quantity: 100,
        target_margin_pct: 35,
        target_selling_price: 0,
        overhead_cost: 0,
        description: '',
        materials: [],
        steps: [],
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [recipesRes, inventoryRes] = await Promise.all([
                fetch(`/api/recipes?t=${Date.now()}`),
                fetch(`/api/inventory?t=${Date.now()}`),
            ]);

            const recipesData = await recipesRes.json();
            const inventoryData = await inventoryRes.json();

            if (recipesData.recipes) setRecipes(recipesData.recipes);
            if (Array.isArray(inventoryData)) setInventoryItems(inventoryData);
        } catch (err) {
            console.error('Error loading recipes data:', err);
            toast.error('Failed to load recipes data');
        } finally {
            setLoading(false);
        }
    }

    const openCreateModal = () => {
        setEditingRecipeId(null);
        setFormData({
            name: '',
            category: 'Packaging',
            status: 'Draft',
            yield_quantity: 100,
            target_margin_pct: 35,
            target_selling_price: 0,
            overhead_cost: 0,
            description: '',
            materials: [
                { inventory_item_id: '', material_name: 'Raw Paper / Board', quantity: 100, uom: 'Sheets', unit_cost: 45, wastage_pct: 5, notes: '' },
            ],
            steps: [
                { step_number: 1, step_name: 'Pre-press & Plate Making', work_center: 'Pre-press', labor_hours: 0.5, hourly_rate: 1500, setup_cost: 500, instructions: 'Verify artwork bleed & generate CTP plates' },
                { step_number: 2, step_name: 'Offset Printing', work_center: 'Pressroom', labor_hours: 1.0, hourly_rate: 3500, setup_cost: 1200, instructions: 'Run 4-Color process printing' },
            ],
        });
        setActiveTab('info');
        setShowModal(true);
    };

    const openEditModal = async (recipeId) => {
        try {
            const res = await fetch(`/api/recipes/${recipeId}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setEditingRecipeId(recipeId);
            setFormData({
                name: data.recipe.name || '',
                category: data.recipe.category || 'Packaging',
                status: data.recipe.status || 'Draft',
                yield_quantity: data.recipe.yield_quantity || 1,
                target_margin_pct: data.recipe.target_margin_pct || 30,
                target_selling_price: data.recipe.target_selling_price || 0,
                overhead_cost: data.recipe.overhead_cost || 0,
                description: data.recipe.description || '',
                materials: data.materials || [],
                steps: data.steps || [],
            });
            setActiveTab('info');
            setShowModal(true);
        } catch (err) {
            toast.error(err.message || 'Failed to fetch recipe details');
        }
    };

    const handleDuplicateRecipe = async (recipeId) => {
        try {
            const res = await fetch(`/api/recipes/${recipeId}/duplicate`, { method: 'POST' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success(`Duplicated recipe as ${data.name}`);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to duplicate recipe');
        }
    };

    const handleDeleteRecipe = async (recipeId) => {
        if (!confirm('Are you sure you want to delete this recipe formulation?')) return;
        try {
            const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success('Recipe deleted successfully');
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to delete recipe');
        }
    };

    const handleOpenPrintModal = async (recipeId) => {
        try {
            const res = await fetch(`/api/recipes/${recipeId}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setSelectedRecipeDetail(data);
            setShowPrintModal(true);
        } catch (err) {
            toast.error('Failed to load recipe sheet for printing');
        }
    };

    // Save recipe submission
    const handleSaveRecipe = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('Please enter a Recipe Name');
            return;
        }

        try {
            const method = editingRecipeId ? 'PUT' : 'POST';
            const url = editingRecipeId ? `/api/recipes/${editingRecipeId}` : '/api/recipes';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            toast.success(editingRecipeId ? 'Recipe updated successfully!' : 'New product recipe created!');
            setShowModal(false);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Failed to save recipe');
        }
    };

    // Material row helpers
    const handleAddMaterialRow = () => {
        setFormData(prev => ({
            ...prev,
            materials: [
                ...prev.materials,
                { inventory_item_id: '', material_name: '', quantity: 1, uom: 'Unit', unit_cost: 0, wastage_pct: 0, notes: '' },
            ],
        }));
    };

    const handleSelectInventoryItem = (index, itemId) => {
        const item = inventoryItems.find(i => String(i.id) === String(itemId));
        setFormData(prev => {
            const updated = [...prev.materials];
            if (item) {
                updated[index] = {
                    ...updated[index],
                    inventory_item_id: item.id,
                    material_name: item.name,
                    uom: item.uom || 'Unit',
                    unit_cost: parseFloat(item.unit_cost) || 0,
                };
            } else {
                updated[index].inventory_item_id = '';
            }
            return { ...prev, materials: updated };
        });
    };

    const handleRemoveMaterialRow = (index) => {
        setFormData(prev => ({
            ...prev,
            materials: prev.materials.filter((_, idx) => idx !== index),
        }));
    };

    // Step row helpers
    const handleAddStepRow = () => {
        setFormData(prev => {
            const nextStepNum = prev.steps.length + 1;
            return {
                ...prev,
                steps: [
                    ...prev.steps,
                    { step_number: nextStepNum, step_name: '', work_center: 'Pressroom', labor_hours: 0.5, hourly_rate: 1500, setup_cost: 0, instructions: '' },
                ],
            };
        });
    };

    const handleRemoveStepRow = (index) => {
        setFormData(prev => ({
            ...prev,
            steps: prev.steps.filter((_, idx) => idx !== index),
        }));
    };

    // Live Calculation Summary
    const calcTotalMaterialCost = () => {
        return formData.materials.reduce((acc, m) => {
            const qty = parseFloat(m.quantity) || 0;
            const cost = parseFloat(m.unit_cost) || 0;
            const scrap = parseFloat(m.wastage_pct) || 0;
            return acc + (qty * cost * (1 + scrap / 100));
        }, 0);
    };

    const calcTotalLaborCost = () => {
        return formData.steps.reduce((acc, s) => {
            const hrs = parseFloat(s.labor_hours) || 0;
            const rate = parseFloat(s.hourly_rate) || 0;
            const setup = parseFloat(s.setup_cost) || 0;
            return acc + (hrs * rate) + setup;
        }, 0);
    };

    const totalMatCost = calcTotalMaterialCost();
    const totalLabCost = calcTotalLaborCost();
    const overheadVal = parseFloat(formData.overhead_cost) || 0;
    const totalBatchCost = totalMatCost + totalLabCost + overheadVal;
    const yieldQty = Math.max(1, parseInt(formData.yield_quantity) || 1);
    const unitCost = totalBatchCost / yieldQty;

    const marginPct = parseFloat(formData.target_margin_pct) || 0;
    const suggestedSellingPrice = marginPct < 100 ? unitCost / (1 - marginPct / 100) : unitCost * 1.5;
    const totalSuggestedBatchPrice = suggestedSellingPrice * yieldQty;
    const projectedBatchProfit = totalSuggestedBatchPrice - totalBatchCost;

    // Filter recipes
    const filteredRecipes = recipes.filter(r => {
        const matchesQuery = !searchQuery ||
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.recipe_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.category && r.category.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCat = selectedCategory === 'All' || r.category === selectedCategory;
        const matchesStat = selectedStatus === 'All' || r.status === selectedStatus;

        return matchesQuery && matchesCat && matchesStat;
    });

    const statusBadgeColors = {
        Approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        'In Testing': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        Draft: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
        Archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-none">
            {/* Top Bar / Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
                        <span className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
                            <FiBookOpen className="w-6 h-6" />
                        </span>
                        Product Recipes & Costing Generator
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Develop testing formulations, configure material BOMs, map production routing steps, and generate accurate unit costs.
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
                    <button
                        onClick={openCreateModal}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <FiPlus className="w-4 h-4" />
                        Create New Recipe
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Formulations</p>
                        <h3 className="text-2xl font-bold text-white mt-1">{recipes.length}</h3>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                        <FiBookOpen className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Approved Products</p>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                            {recipes.filter(r => r.status === 'Approved').length}
                        </h3>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                        <FiCheckCircle className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">In R&D Testing</p>
                        <h3 className="text-2xl font-bold text-amber-400 mt-1">
                            {recipes.filter(r => r.status === 'In Testing').length}
                        </h3>
                    </div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                        <FiSliders className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Avg Target Margin</p>
                        <h3 className="text-2xl font-bold text-teal-300 mt-1">
                            {recipes.length > 0
                                ? Math.round(recipes.reduce((acc, r) => acc + (parseFloat(r.target_margin_pct) || 0), 0) / recipes.length)
                                : 35}%
                        </h3>
                    </div>
                    <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-teal-400">
                        <FiTrendingUp className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Controls Bar: Search & Filter */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl print:hidden">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search recipe by product name, code (REC-0001), category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                        <option value="All" className="bg-gray-900">All Categories</option>
                        <option value="Packaging" className="bg-gray-900">Packaging</option>
                        <option value="Commercial Printing" className="bg-gray-900">Commercial Printing</option>
                        <option value="Publishing" className="bg-gray-900">Publishing</option>
                        <option value="Specialty" className="bg-gray-900">Specialty Products</option>
                        <option value="General" className="bg-gray-900">General</option>
                    </select>

                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                        <option value="All" className="bg-gray-900">All Statuses</option>
                        <option value="Draft" className="bg-gray-900">Draft</option>
                        <option value="In Testing" className="bg-gray-900">In Testing</option>
                        <option value="Approved" className="bg-gray-900">Approved</option>
                        <option value="Archived" className="bg-gray-900">Archived</option>
                    </select>
                </div>
            </div>

            {/* Recipes Grid */}
            {loading ? (
                <div className="p-16 text-center text-gray-400 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl">
                    <FiRefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-400 mb-3" />
                    Loading recipes and product formulations...
                </div>
            ) : filteredRecipes.length === 0 ? (
                <div className="p-16 text-center text-gray-400 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl space-y-3">
                    <FiBookOpen className="w-12 h-12 text-gray-600 mx-auto" />
                    <h3 className="text-lg font-bold text-white">No product recipes found</h3>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                        Get started by creating your first product recipe with raw materials and process routing!
                    </p>
                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
                    >
                        + Create Recipe Now
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print:hidden">
                    {filteredRecipes.map((r) => {
                        const batchCost = parseFloat(r.total_batch_cost) || 0;
                        const unitCostVal = parseFloat(r.unit_cost) || 0;
                        const targetMargin = parseFloat(r.target_margin_pct) || 0;
                        const yieldQ = parseInt(r.yield_quantity) || 1;
                        const suggestedUnitSell = targetMargin < 100 ? unitCostVal / (1 - targetMargin / 100) : unitCostVal * 1.5;

                        return (
                            <motion.div
                                key={r.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-black/40 backdrop-blur-xl border border-white/10 hover:border-emerald-500/40 rounded-2xl p-5 space-y-4 transition-all hover:shadow-xl hover:shadow-emerald-500/10 group flex flex-col justify-between"
                            >
                                <div className="space-y-3">
                                    {/* Card Top */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="font-mono text-xs font-bold text-emerald-400 block">{r.recipe_code}</span>
                                            <h3 className="text-lg font-bold text-white leading-tight group-hover:text-emerald-300 transition-colors">
                                                {r.name}
                                            </h3>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold shrink-0 ${statusBadgeColors[r.status] || 'bg-gray-500/20 text-gray-300'}`}>
                                            {r.status}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span className="px-2 py-0.5 bg-white/5 rounded-md border border-white/10 font-medium">{r.category}</span>
                                        <span>&bull;</span>
                                        <span>Yield: <strong className="text-white font-mono">{yieldQ.toLocaleString()} pcs</strong></span>
                                    </div>

                                    {r.description && (
                                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                            {r.description}
                                        </p>
                                    )}

                                    {/* Costing Summary Pill Box */}
                                    <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] text-gray-500 font-semibold uppercase block">Est. Unit Cost</span>
                                            <span className="text-base font-bold font-mono text-emerald-400">
                                                Rs. {unitCostVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500 font-semibold uppercase block">Rec. Selling Price</span>
                                            <span className="text-base font-bold font-mono text-teal-300">
                                                Rs. {suggestedUnitSell.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* BOM & Routing Count Indicators */}
                                    <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                                        <span className="flex items-center gap-1.5">
                                            <FiBox className="text-emerald-400 w-3.5 h-3.5" />
                                            {r.materials_count || 0} Materials
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <FiLayers className="text-teal-400 w-3.5 h-3.5" />
                                            {r.steps_count || 0} Process Steps
                                        </span>
                                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                                            {targetMargin}% Margin
                                        </span>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => openEditModal(r.id)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-colors cursor-pointer"
                                            title="Edit Recipe & Costing"
                                        >
                                            <FiEdit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDuplicateRecipe(r.id)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer"
                                            title="Duplicate Formulation"
                                        >
                                            <FiCopy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleOpenPrintModal(r.id)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-gray-300 hover:text-teal-400 transition-colors cursor-pointer"
                                            title="Print Costing Sheet"
                                        >
                                            <FiPrinter className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => handleDeleteRecipe(r.id)}
                                        className="p-2 hover:bg-rose-500/20 rounded-lg text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                                        title="Delete Recipe"
                                    >
                                        <FiTrash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* RECIPE BUILDER MODAL */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="bg-black border border-white/15 rounded-2xl max-w-4xl w-full my-8 p-6 space-y-6 text-white shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <FiBookOpen className="text-emerald-400" />
                                        {editingRecipeId ? 'Edit Product Recipe & Costing' : 'Create New Product Recipe'}
                                    </h3>
                                    <p className="text-xs text-gray-400">Configure raw material allocations, labor rates, and profit margin analysis.</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                                    <FiX className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Tabs Navigation */}
                            <div className="flex items-center gap-2 border-b border-white/10 pb-3 shrink-0">
                                {[
                                    { id: 'info', label: '1. Basic Info', icon: FiFileText },
                                    { id: 'materials', label: `2. Materials BOM (${formData.materials.length})`, icon: FiBox },
                                    { id: 'steps', label: `3. Process Steps (${formData.steps.length})`, icon: FiLayers },
                                    { id: 'costing', label: '4. Financial Breakdown', icon: FiDollarSign },
                                ].map((tab) => {
                                    const TabIcon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === tab.id
                                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <TabIcon className="w-4 h-4" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Modal Body / Scrollable Content */}
                            <form id="recipeForm" onSubmit={handleSaveRecipe} className="space-y-6 overflow-y-auto pr-1 flex-1">
                                {/* TAB 1: Basic Info */}
                                {activeTab === 'info' && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Product / Recipe Name *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder="e.g. Custom Premium Gift Box"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-semibold"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Category</label>
                                                <select
                                                    value={formData.category}
                                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                                                >
                                                    <option value="Packaging">Packaging</option>
                                                    <option value="Commercial Printing">Commercial Printing</option>
                                                    <option value="Publishing">Publishing</option>
                                                    <option value="Specialty">Specialty Products</option>
                                                    <option value="General">General</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Formulation Status</label>
                                                <select
                                                    value={formData.status}
                                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                                                >
                                                    <option value="Draft">Draft</option>
                                                    <option value="In Testing">In Testing (R&D)</option>
                                                    <option value="Approved">Approved for Production</option>
                                                    <option value="Archived">Archived</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Yield Quantity (Batch Size)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={formData.yield_quantity}
                                                    onChange={(e) => setFormData({ ...formData, yield_quantity: parseInt(e.target.value) || 1 })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Target Margin %</label>
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={formData.target_margin_pct}
                                                    onChange={(e) => setFormData({ ...formData, target_margin_pct: parseFloat(e.target.value) || 0 })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Recipe Description & Notes</label>
                                            <textarea
                                                rows={3}
                                                placeholder="Enter product specification details, finishing requirements, paper grade specifications..."
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: Materials BOM */}
                                {activeTab === 'materials' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                    <FiBox className="text-emerald-400" /> Bill of Materials (Raw Materials & Supplies)
                                                </h4>
                                                <p className="text-xs text-gray-400">Select stock items from inventory or type custom material names.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddMaterialRow}
                                                className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <FiPlus className="w-3.5 h-3.5" /> Add Material
                                            </button>
                                        </div>

                                        {formData.materials.length === 0 ? (
                                            <div className="p-8 text-center text-gray-400 border border-dashed border-white/10 rounded-xl">
                                                No materials added yet. Click &quot;Add Material&quot; to begin building your BOM.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {formData.materials.map((mat, idx) => {
                                                    const qty = parseFloat(mat.quantity) || 0;
                                                    const cost = parseFloat(mat.unit_cost) || 0;
                                                    const wastage = parseFloat(mat.wastage_pct) || 0;
                                                    const rowTotal = (qty * cost) * (1 + wastage / 100);

                                                    return (
                                                        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                                                <div className="md:col-span-4">
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Pick Stock Item (Optional)</label>
                                                                    <select
                                                                        value={mat.inventory_item_id || ''}
                                                                        onChange={(e) => handleSelectInventoryItem(idx, e.target.value)}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                                                                    >
                                                                        <option value="">-- Custom Material --</option>
                                                                        {inventoryItems.map(inv => (
                                                                            <option key={inv.id} value={inv.id}>
                                                                                {inv.name} (Rs. {inv.unit_cost}/{inv.uom || 'Unit'})
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>

                                                                <div className="md:col-span-4">
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Material Name *</label>
                                                                    <input
                                                                        type="text"
                                                                        required
                                                                        value={mat.material_name}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.materials];
                                                                            updated[idx].material_name = e.target.value;
                                                                            setFormData({ ...formData, materials: updated });
                                                                        }}
                                                                        placeholder="e.g. 300gsm Art Board"
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                                                                    />
                                                                </div>

                                                                <div className="md:col-span-3">
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">UOM</label>
                                                                    <input
                                                                        type="text"
                                                                        value={mat.uom}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.materials];
                                                                            updated[idx].uom = e.target.value;
                                                                            setFormData({ ...formData, materials: updated });
                                                                        }}
                                                                        placeholder="Sheets, kg, m"
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                                                                    />
                                                                </div>

                                                                <div className="md:col-span-1 text-right flex justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveMaterialRow(idx)}
                                                                        className="p-1.5 text-gray-500 hover:text-rose-400 transition-colors cursor-pointer mt-4"
                                                                        title="Remove Material"
                                                                    >
                                                                        <FiTrash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 items-center pt-1 border-t border-white/5">
                                                                <div>
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Quantity Used</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={mat.quantity}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.materials];
                                                                            updated[idx].quantity = parseFloat(e.target.value) || 0;
                                                                            setFormData({ ...formData, materials: updated });
                                                                        }}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Unit Cost (Rs)</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={mat.unit_cost}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.materials];
                                                                            updated[idx].unit_cost = parseFloat(e.target.value) || 0;
                                                                            setFormData({ ...formData, materials: updated });
                                                                        }}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Scrap / Wastage %</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.5"
                                                                        value={mat.wastage_pct}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.materials];
                                                                            updated[idx].wastage_pct = parseFloat(e.target.value) || 0;
                                                                            setFormData({ ...formData, materials: updated });
                                                                        }}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                                                                    />
                                                                </div>

                                                                <div className="text-right">
                                                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Subtotal Cost</span>
                                                                    <span className="text-xs font-mono font-bold text-emerald-400">
                                                                        Rs. {rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs">
                                            <span className="text-gray-300">Total Material Allocation Cost:</span>
                                            <strong className="text-sm font-mono font-bold text-emerald-300">
                                                Rs. {totalMatCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </strong>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 3: Process Steps & Instructions */}
                                {activeTab === 'steps' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                    <FiLayers className="text-teal-400" /> Manufacturing Routing & Step Instructions
                                                </h4>
                                                <p className="text-xs text-gray-400">Define machine operations, setup fees, labor hours, and technical instructions.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddStepRow}
                                                className="px-3 py-1.5 bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/40 rounded-lg text-teal-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <FiPlus className="w-3.5 h-3.5" /> Add Process Step
                                            </button>
                                        </div>

                                        {formData.steps.length === 0 ? (
                                            <div className="p-8 text-center text-gray-400 border border-dashed border-white/10 rounded-xl">
                                                No process steps defined. Click &quot;Add Process Step&quot; to configure routing.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {formData.steps.map((step, idx) => {
                                                    const hrs = parseFloat(step.labor_hours) || 0;
                                                    const rate = parseFloat(step.hourly_rate) || 0;
                                                    const setup = parseFloat(step.setup_cost) || 0;
                                                    const stepTotal = (hrs * rate) + setup;

                                                    return (
                                                        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                                                <div className="md:col-span-1">
                                                                    <span className="w-7 h-7 bg-teal-500/20 border border-teal-500/30 rounded-lg text-teal-300 font-mono text-xs font-bold flex items-center justify-center">
                                                                        #{idx + 1}
                                                                    </span>
                                                                </div>

                                                                <div className="md:col-span-6">
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Operation / Step Name *</label>
                                                                    <input
                                                                        type="text"
                                                                        required
                                                                        value={step.step_name}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.steps];
                                                                            updated[idx].step_name = e.target.value;
                                                                            setFormData({ ...formData, steps: updated });
                                                                        }}
                                                                        placeholder="e.g. Thermal Lamination, Die Cutting"
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 font-semibold"
                                                                    />
                                                                </div>

                                                                <div className="md:col-span-4">
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Work Center / Machine</label>
                                                                    <input
                                                                        type="text"
                                                                        value={step.work_center}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.steps];
                                                                            updated[idx].work_center = e.target.value;
                                                                            setFormData({ ...formData, steps: updated });
                                                                        }}
                                                                        placeholder="e.g. Heidelberg XL-105"
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                                                                    />
                                                                </div>

                                                                <div className="md:col-span-1 text-right flex justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveStepRow(idx)}
                                                                        className="p-1.5 text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                                                                        title="Remove Step"
                                                                    >
                                                                        <FiTrash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-center pt-1 border-t border-white/5">
                                                                <div>
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Setup / Make-Ready Cost</label>
                                                                    <input
                                                                        type="number"
                                                                        step="100"
                                                                        value={step.setup_cost}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.steps];
                                                                            updated[idx].setup_cost = parseFloat(e.target.value) || 0;
                                                                            setFormData({ ...formData, steps: updated });
                                                                        }}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-teal-500"
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Labor Hours</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.1"
                                                                        value={step.labor_hours}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.steps];
                                                                            updated[idx].labor_hours = parseFloat(e.target.value) || 0;
                                                                            setFormData({ ...formData, steps: updated });
                                                                        }}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-teal-500"
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Hourly Rate (Rs/hr)</label>
                                                                    <input
                                                                        type="number"
                                                                        step="100"
                                                                        value={step.hourly_rate}
                                                                        onChange={(e) => {
                                                                            const updated = [...formData.steps];
                                                                            updated[idx].hourly_rate = parseFloat(e.target.value) || 0;
                                                                            setFormData({ ...formData, steps: updated });
                                                                        }}
                                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-teal-500"
                                                                    />
                                                                </div>

                                                                <div className="text-right">
                                                                    <span className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Step Labor Subtotal</span>
                                                                    <span className="text-xs font-mono font-bold text-teal-300">
                                                                        Rs. {stepTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <input
                                                                    type="text"
                                                                    value={step.instructions || ''}
                                                                    onChange={(e) => {
                                                                        const updated = [...formData.steps];
                                                                        updated[idx].instructions = e.target.value;
                                                                        setFormData({ ...formData, steps: updated });
                                                                    }}
                                                                    placeholder="Operator instructions, tension settings, color density targets..."
                                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-teal-500"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-center justify-between text-xs">
                                            <span className="text-gray-300">Total Labor & Processing Operations Cost:</span>
                                            <strong className="text-sm font-mono font-bold text-teal-300">
                                                Rs. {totalLabCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </strong>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 4: Costing Breakdown */}
                                {activeTab === 'costing' && (
                                    <div className="space-y-5">
                                        <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
                                            <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
                                                <FiDollarSign className="text-emerald-400" /> Cost Summary & Profitability Analyzer
                                            </h4>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Material Cost</span>
                                                    <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                                                        Rs. {totalMatCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                                                        Rs. {(totalMatCost / yieldQty).toFixed(2)} / unit
                                                    </span>
                                                </div>

                                                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Labor & Processing</span>
                                                    <span className="text-xl font-bold font-mono text-teal-400 mt-1 block">
                                                        Rs. {totalLabCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
                                                        Rs. {(totalLabCost / yieldQty).toFixed(2)} / unit
                                                    </span>
                                                </div>

                                                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                                                    <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Overhead Allowance (Rs)</label>
                                                    <input
                                                        type="number"
                                                        step="100"
                                                        value={formData.overhead_cost}
                                                        onChange={(e) => setFormData({ ...formData, overhead_cost: parseFloat(e.target.value) || 0 })}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* Key Financial Indicators */}
                                            <div className="p-5 bg-gradient-to-br from-emerald-950/60 to-teal-950/60 border border-emerald-500/30 rounded-2xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <span className="text-xs text-emerald-300 font-semibold uppercase block">Total Batch Cost ({yieldQty} pcs)</span>
                                                    <h2 className="text-2xl font-black font-mono text-white mt-1">
                                                        Rs. {totalBatchCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </h2>
                                                </div>

                                                <div>
                                                    <span className="text-xs text-emerald-300 font-semibold uppercase block">Unit Cost (Per Piece)</span>
                                                    <h2 className="text-2xl font-black font-mono text-emerald-400 mt-1">
                                                        Rs. {unitCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </h2>
                                                </div>

                                                <div>
                                                    <span className="text-xs text-emerald-300 font-semibold uppercase block">Rec. Unit Selling Price</span>
                                                    <h2 className="text-2xl font-black font-mono text-teal-300 mt-1">
                                                        Rs. {suggestedSellingPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </h2>
                                                </div>

                                                <div>
                                                    <span className="text-xs text-emerald-300 font-semibold uppercase block">Est. Batch Profit</span>
                                                    <h2 className="text-2xl font-black font-mono text-amber-400 mt-1">
                                                        Rs. {projectedBatchProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </h2>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>

                            {/* Modal Footer Controls */}
                            <div className="flex items-center justify-between pt-4 border-t border-white/10 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-gray-300 cursor-pointer"
                                >
                                    Cancel
                                </button>

                                <div className="flex items-center gap-3">
                                    {activeTab !== 'info' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (activeTab === 'costing') setActiveTab('steps');
                                                else if (activeTab === 'steps') setActiveTab('materials');
                                                else if (activeTab === 'materials') setActiveTab('info');
                                            }}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-gray-300 cursor-pointer"
                                        >
                                            Back
                                        </button>
                                    )}

                                    {activeTab !== 'costing' ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (activeTab === 'info') setActiveTab('materials');
                                                else if (activeTab === 'materials') setActiveTab('steps');
                                                else if (activeTab === 'steps') setActiveTab('costing');
                                            }}
                                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold text-white cursor-pointer flex items-center gap-1"
                                        >
                                            Next Step <FiChevronRight />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            form="recipeForm"
                                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center gap-2"
                                        >
                                            <FiCheck className="w-4 h-4" />
                                            {editingRecipeId ? 'Update Recipe' : 'Save Product Recipe'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* PRINT / EXPORT COSTING SHEET MODAL */}
            <AnimatePresence>
                {showPrintModal && selectedRecipeDetail && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto print:static print:bg-white print:p-0">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-black border border-white/15 rounded-2xl max-w-3xl w-full p-6 space-y-6 text-white print:border-none print:p-0 print:m-0 print:bg-white print:text-black print:max-w-none"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3 print:hidden">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <FiPrinter className="text-emerald-400" />
                                        Product Recipe Specification & Costing Sheet
                                    </h3>
                                    <p className="text-xs text-gray-400">Formal technical formulation report and BOM breakdown.</p>
                                </div>
                                <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Printable Report Document */}
                            <div ref={printAreaRef} className="bg-white text-black p-8 rounded-xl border border-gray-300 font-sans space-y-6 print:border-none print:p-0">
                                {/* Report Header */}
                                <div className="border-b-2 border-black pb-4 flex items-center justify-between">
                                    <div>
                                        <h1 className="text-2xl font-black uppercase tracking-tight text-emerald-800">PRESSMATICS PRINTERS</h1>
                                        <p className="text-xs font-bold uppercase text-gray-600">Product Recipe & Formulation Sheet</p>
                                    </div>
                                    <div className="text-right font-mono">
                                        <span className="text-lg font-black text-emerald-700 block">{selectedRecipeDetail.recipe.recipe_code}</span>
                                        <span className="text-xs text-gray-500">Date: {new Date(selectedRecipeDetail.recipe.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                {/* Product Info Summary */}
                                <div className="grid grid-cols-2 gap-4 text-xs border-b border-gray-300 pb-4">
                                    <div>
                                        <span className="text-gray-500 font-bold uppercase block">Product Name:</span>
                                        <h2 className="text-base font-bold text-black uppercase">{selectedRecipeDetail.recipe.name}</h2>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 font-bold uppercase block">Category & Status:</span>
                                        <p className="text-sm font-semibold">{selectedRecipeDetail.recipe.category} &bull; {selectedRecipeDetail.recipe.status}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 font-bold uppercase block">Batch Yield Quantity:</span>
                                        <p className="text-sm font-mono font-bold">{selectedRecipeDetail.recipe.yield_quantity} PCS</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 font-bold uppercase block">Unit Cost:</span>
                                        <p className="text-sm font-mono font-bold text-emerald-700">
                                            Rs. {parseFloat(selectedRecipeDetail.recipe.unit_cost || 0).toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Materials Table */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-2">Bill of Materials (BOM)</h3>
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-black bg-emerald-50 text-emerald-950 font-bold uppercase">
                                                <th className="py-2 px-3">Material Name</th>
                                                <th className="py-2 px-3 text-right">Qty</th>
                                                <th className="py-2 px-3 text-right">UOM</th>
                                                <th className="py-2 px-3 text-right">Unit Cost</th>
                                                <th className="py-2 px-3 text-right">Scrap %</th>
                                                <th className="py-2 px-3 text-right">Total Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {selectedRecipeDetail.materials.map(m => (
                                                <tr key={m.id}>
                                                    <td className="py-2 px-3 font-medium">{m.material_name}</td>
                                                    <td className="py-2 px-3 font-mono text-right">{m.quantity}</td>
                                                    <td className="py-2 px-3 text-right">{m.uom}</td>
                                                    <td className="py-2 px-3 font-mono text-right">Rs. {parseFloat(m.unit_cost).toFixed(2)}</td>
                                                    <td className="py-2 px-3 font-mono text-right">{m.wastage_pct}%</td>
                                                    <td className="py-2 px-3 font-mono font-bold text-right">Rs. {parseFloat(m.total_cost).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Process Routing Steps */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-2">Manufacturing Routing & Instructions</h3>
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-black bg-emerald-50 text-emerald-950 font-bold uppercase">
                                                <th className="py-2 px-3">Step</th>
                                                <th className="py-2 px-3">Operation / Work Center</th>
                                                <th className="py-2 px-3">Instructions</th>
                                                <th className="py-2 px-3 text-right">Labor Hrs</th>
                                                <th className="py-2 px-3 text-right">Total Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {selectedRecipeDetail.steps.map(s => (
                                                <tr key={s.id}>
                                                    <td className="py-2 px-3 font-mono font-bold">#{s.step_number}</td>
                                                    <td className="py-2 px-3 font-semibold">{s.step_name} ({s.work_center})</td>
                                                    <td className="py-2 px-3 text-gray-600">{s.instructions || 'N/A'}</td>
                                                    <td className="py-2 px-3 font-mono text-right">{s.labor_hours} hrs</td>
                                                    <td className="py-2 px-3 font-mono font-bold text-right">Rs. {parseFloat(s.total_cost).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 print:hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowPrintModal(false)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium text-gray-300 cursor-pointer"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                                >
                                    <FiPrinter className="w-4 h-4" />
                                    Print Recipe Sheet
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
