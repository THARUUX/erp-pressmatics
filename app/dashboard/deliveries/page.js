'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
} from '@tanstack/react-table';
import { ColumnToggle } from '@/components/ui/ColumnToggle';
import { dateOperatorFilterFn } from '@/lib/dateFilter';
import RoutePlannerDrawer from '@/components/deliveries/RoutePlannerDrawer';
import toast from 'react-hot-toast';
import {
    FiSearch, FiTruck, FiClock, FiPackage, FiCheckCircle, 
    FiAlertTriangle, FiX, FiChevronDown, FiChevronUp, 
    FiRefreshCw, FiBookOpen, FiUser, FiDownload,
    FiChevronsLeft, FiChevronLeft, FiChevronRight, FiChevronsRight,
    FiMap, FiList, FiCalendar, FiPlus, FiEdit2, FiTrash2, FiEye, FiPlay, FiMapPin
} from 'react-icons/fi';

import EditAddressLocationModal from '@/components/deliveries/EditAddressLocationModal';

const DeliveryRouteMap = dynamic(() => import('@/components/deliveries/DeliveryRouteMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[600px] rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-gray-400 gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
            Loading MapLibre GL Map...
        </div>
    )
});

const STATUS_COLORS = {
    'Pending': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'Partially Delivered': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Delivered': 'bg-green-500/20 text-green-300 border-green-500/30',
};

function StatusBadge({ status }) {
    const cls = STATUS_COLORS[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${cls}`}>
            {status}
        </span>
    );
}

function SortIcon({ dir }) {
    if (!dir) return <span className="opacity-20 text-xs">⇅</span>;
    return dir === 'asc' ? <FiChevronUp className="w-3 h-3" /> : <FiChevronDown className="w-3 h-3" />;
}

function ColFilter({ column }) {
    const val = column.getFilterValue() ?? '';
    const isDateCol = column.id === 'so_delivery_date';
    const placeholder = isDateCol
        ? "Date (>=2026-08-01, today)..."
        : "Filter…";

    return (
        <input
            value={val}
            onChange={e => column.setFilterValue(e.target.value)}
            placeholder={placeholder}
            onClick={e => e.stopPropagation()}
            className="w-full mt-1.5 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/30 font-normal normal-case"
        />
    );
}

function PagBtn({ children, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
            {children}
        </button>
    );
}

export default function DeliveriesPage() {
    // View Mode: 'queue' | 'route-planner' | 'saved-routes'
    const [viewMode, setViewMode] = useState('queue');

    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('All');
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [rowSelection, setRowSelection] = useState({});
    const [syncLoading, setSyncLoading] = useState(false);

    // Route Planner States
    const [routeStops, setRouteStops] = useState([]);
    const [selectedStopId, setSelectedStopId] = useState(null);
    const [routeStats, setRouteStats] = useState({ distanceKm: 0, durationMins: 0 });
    const [savedRoutes, setSavedRoutes] = useState([]);
    const [loadingSavedRoutes, setLoadingSavedRoutes] = useState(false);
    const [pinModeStop, setPinModeStop] = useState(null);

    // Saved Route View & Edit Modals State
    const [viewingSavedRoute, setViewingSavedRoute] = useState(null);
    const [editingSavedRoute, setEditingSavedRoute] = useState(null);
    const [loadedSavedRouteId, setLoadedSavedRouteId] = useState(null);
    const [isSubmittingRouteEdit, setIsSubmittingRouteEdit] = useState(false);

    // Shared Factory Depot Location State (with Database persistence)
    const [depotLocation, setDepotLocation] = useState({
        lat: 6.9271,
        lng: 79.8612,
        name: 'Colombo Factory Depot'
    });

    // Fetch shared factory depot location from database
    const fetchFactoryDepot = useCallback(async () => {
        try {
            const res = await fetch('/api/deliveries/factory-location');
            if (res.ok) {
                const data = await res.json();
                if (data && data.lat && data.lng) {
                    setDepotLocation({
                        lat: parseFloat(data.lat),
                        lng: parseFloat(data.lng),
                        name: data.name || 'Colombo Factory Depot'
                    });
                }
            }
        } catch (e) {
            console.error('Error fetching factory depot location:', e);
        }
    }, []);

    const handleUpdateDepotLocation = async (newDepot) => {
        setDepotLocation(newDepot);
        try {
            const res = await fetch('/api/deliveries/factory-location', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDepot)
            });
            if (res.ok) {
                toast.success('Factory Depot location saved to database for all users!');
                fetchFactoryDepot();
            } else {
                toast.error('Failed to save factory depot location');
            }
        } catch (e) {
            console.error('Error saving factory depot location to database:', e);
            toast.error('Error saving factory depot location');
        }
    };

    // Modal & Form States
    const [dispatchModalDelivery, setDispatchModalDelivery] = useState(null);
    const [dispatchedQuantity, setDispatchedQuantity] = useState('');
    const [booksPerParcel, setBooksPerParcel] = useState(50);
    const [carrierName, setCarrierName] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);

    // Edit Address Modal States
    const [addressModalDelivery, setAddressModalDelivery] = useState(null);
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);

    // Expanded Accordion State
    const [expandedDeliveryId, setExpandedDeliveryId] = useState(null);

    // Fetch all deliveries
    const fetchDeliveries = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/deliveries');
            if (res.ok) {
                const data = await res.json();
                setDeliveries(data.deliveries || []);
            } else {
                toast.error('Failed to load delivery queue');
            }
        } catch (error) {
            console.error('Fetch deliveries error:', error);
            toast.error('An error occurred while loading deliveries');
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch saved routes
    const fetchSavedRoutes = useCallback(async () => {
        setLoadingSavedRoutes(true);
        try {
            const res = await fetch('/api/deliveries/routes');
            if (res.ok) {
                const data = await res.json();
                setSavedRoutes(data.routes || []);
            }
        } catch (err) {
            console.error('Fetch routes error:', err);
        } finally {
            setLoadingSavedRoutes(false);
        }
    }, []);

    useEffect(() => {
        fetchDeliveries();
        fetchFactoryDepot();
    }, [fetchDeliveries, fetchFactoryDepot]);

    useEffect(() => {
        if (viewMode === 'saved-routes') {
            fetchSavedRoutes();
        }
    }, [viewMode, fetchSavedRoutes]);

    // Manual sync ready & in-production orders
    const handleSync = async () => {
        setSyncLoading(true);
        const loadToast = toast.loading('Scanning for ready & in-production sales orders...');
        try {
            const res = await fetch('/api/deliveries', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                toast.success(data.message || 'Delivery queue synced successfully', { id: loadToast });
                fetchDeliveries();
            } else {
                toast.error('Sync failed', { id: loadToast });
            }
        } catch (error) {
            console.error('Sync error:', error);
            toast.error('An error occurred during sync', { id: loadToast });
        } finally {
            setSyncLoading(false);
        }
    };

    // Open Dispatch Modal
    const openDispatchModal = (delivery) => {
        setDispatchModalDelivery(delivery);
        setDispatchedQuantity(delivery.total_quantity - delivery.delivered_quantity);
        setBooksPerParcel(delivery.books_per_parcel || 50);
        setCarrierName('');
        setTrackingNumber('');
        setNotes('');
    };

    // Handle Preview Download
    const handlePreviewDownload = () => {
        if (!dispatchModalDelivery) return;
        const qty = parseInt(dispatchedQuantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error('Dispatched quantity must be greater than 0 to preview');
            return;
        }
        const remaining = dispatchModalDelivery.total_quantity - dispatchModalDelivery.delivered_quantity;
        if (qty > remaining) {
            toast.error(`Dispatched quantity cannot exceed remaining balance of ${remaining} items`);
            return;
        }
        const url = `/api/deliveries/dispatches/preview/pdf?deliveryId=${dispatchModalDelivery.id}&dispatched_quantity=${qty}&books_per_parcel=${booksPerParcel}&carrier_name=${encodeURIComponent(carrierName)}&tracking_number=${encodeURIComponent(trackingNumber)}&notes=${encodeURIComponent(notes)}`;
        window.open(url, '_blank');
    };

    // Handle Dispatch Submission
    const handleLogDispatch = async (e) => {
        e.preventDefault();
        if (!dispatchModalDelivery) return;

        const qty = parseInt(dispatchedQuantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error('Dispatched quantity must be greater than 0');
            return;
        }

        const remaining = dispatchModalDelivery.total_quantity - dispatchModalDelivery.delivered_quantity;
        if (qty > remaining) {
            toast.error(`Dispatched quantity cannot exceed remaining balance of ${remaining} items`);
            return;
        }

        setIsSubmittingDispatch(true);
        try {
            const res = await fetch(`/api/deliveries/${dispatchModalDelivery.id}/dispatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dispatched_quantity: qty,
                    books_per_parcel: booksPerParcel,
                    carrier_name: carrierName,
                    tracking_number: trackingNumber,
                    notes
                })
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(
                    data.order_delivered 
                        ? 'Dispatch logged! Sales Order fully delivered.' 
                        : 'Dispatch shipment logged successfully'
                );
                setDispatchModalDelivery(null);
                fetchDeliveries();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to log dispatch');
            }
        } catch (error) {
            console.error('Log dispatch error:', error);
            toast.error('An error occurred while logging dispatch');
        } finally {
            setIsSubmittingDispatch(false);
        }
    };

    const openAddressModal = (delivery) => {
        setAddressModalDelivery(delivery);
        setDeliveryAddress(delivery.delivery_address || '');
    };

    const handleSaveAddress = async (e) => {
        e.preventDefault();
        if (!addressModalDelivery) return;

        setIsSubmittingAddress(true);
        try {
            const res = await fetch(`/api/deliveries/${addressModalDelivery.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delivery_address: deliveryAddress })
            });

            if (res.ok) {
                toast.success('Delivery address updated successfully');
                setAddressModalDelivery(null);
                fetchDeliveries();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to update delivery address');
            }
        } catch (error) {
            console.error('Update address error:', error);
            toast.error('An error occurred while updating delivery address');
        } finally {
            setIsSubmittingAddress(false);
        }
    };

    // Update location lat/lng for a delivery item
    const handleLocationUpdate = async (deliveryId, lat, lng) => {
        try {
            const res = await fetch(`/api/deliveries/${deliveryId}/location`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude: lat, longitude: lng })
            });
            if (res.ok) {
                setDeliveries(prev => prev.map(d => d.id === deliveryId ? { ...d, latitude: lat, longitude: lng } : d));
                setRouteStops(prev => prev.map(s => s.id === deliveryId ? { ...s, latitude: lat, longitude: lng } : s));
                setEditingSavedRoute(prev => {
                    if (!prev) return null;
                    const stops = (prev.stops_data || []).map(s => s.id === deliveryId ? { ...s, latitude: lat, longitude: lng } : s);
                    return { ...prev, stops_data: stops };
                });
                setViewingSavedRoute(prev => {
                    if (!prev) return null;
                    const stops = (prev.stops_data || []).map(s => s.id === deliveryId ? { ...s, latitude: lat, longitude: lng } : s);
                    return { ...prev, stops_data: stops };
                });
            }
        } catch (err) {
            console.error('Location update error:', err);
        }
    };

    // Batch fetch/geocode delivery locations for ALL items in queue
    const handleFetchAllLocations = async () => {
        const missingItems = deliveries.filter(d => !d.latitude || !d.longitude);
        const targetItems = missingItems.length > 0 ? missingItems : deliveries;

        if (targetItems.length === 0) {
            toast.success('No delivery items found in queue');
            return;
        }

        const loadToast = toast.loading(`Fetching map locations for ${targetItems.length} delivery items...`);
        let updatedCount = 0;

        for (const item of targetItems) {
            const query = item.delivery_address || `${item.customer_name}, Sri Lanka`;
            try {
                const res = await fetch(`/api/deliveries/route-planner/geocode?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.lat && data.lng) {
                        await handleLocationUpdate(item.id, data.lat, data.lng);
                        updatedCount++;
                    }
                }
            } catch (err) {
                console.error(`Geocode error for item ${item.id}:`, err);
            }
        }

        if (updatedCount > 0) {
            toast.success(`Fetched locations for ${updatedCount} delivery items!`, { id: loadToast });
            fetchDeliveries();
        } else {
            toast.error('Could not auto-fetch locations. Click "Pin" on any item to set location manually on map.', { id: loadToast });
        }
    };

    // Add single delivery item to route planner
    const handleAddSingleToRoute = (delivery) => {
        setLoadedSavedRouteId(null);
        const existing = routeStops.some(s => s.id === delivery.id);
        if (!existing) {
            setRouteStops(prev => [...prev, delivery]);
            toast.success(`Added ${delivery.sales_order_code} to Route Planner`);
        }
        setViewMode('route-planner');
    };

    // Quick Action to start daily delivery route planning with selected or all pending items
    const handleStartDailyRoutePlanning = () => {
        setLoadedSavedRouteId(null);
        const selectedItems = Object.keys(rowSelection).filter(k => rowSelection[k]).length > 0
            ? table.getSelectedRowModel().rows.map(r => r.original)
            : [];

        if (selectedItems.length > 0) {
            const existingIds = new Set(routeStops.map(s => s.id));
            const newStops = selectedItems.filter(item => !existingIds.has(item.id));
            setRouteStops(prev => [...prev, ...newStops]);
            toast.success(`Loaded ${selectedItems.length} selected items into Route Planner`);
        } else if (routeStops.length === 0) {
            const pendingOrReady = deliveries.filter(d => d.status !== 'Delivered');
            if (pendingOrReady.length > 0) {
                setRouteStops(pendingOrReady);
                toast.success(`Loaded ${pendingOrReady.length} pending deliveries into Route Planner!`);
            } else {
                toast.error('No pending delivery jobs available to plan');
            }
        }
        setViewMode('route-planner');
    };

    // Add selected items from table to route planner
    const handleAddSelectedToRoute = () => {
        const selectedIds = Object.keys(rowSelection).filter(k => rowSelection[k]);
        if (selectedIds.length === 0) {
            toast.error('Please select at least one delivery item using the checkboxes');
            return;
        }

        const selectedItems = table.getSelectedRowModel().rows.map(r => r.original);
        
        // Append unique non-duplicate items
        const existingIds = new Set(routeStops.map(s => s.id));
        const newStops = selectedItems.filter(item => !existingIds.has(item.id));

        if (newStops.length === 0) {
            toast.error('Selected items are already in the route planner');
            return;
        }

        setRouteStops(prev => [...prev, ...newStops]);
        setViewMode('route-planner');
        toast.success(`Added ${newStops.length} items to Route Planner!`);
    };

    // Save Daily Route Callback (Updates existing manifest if loadedSavedRouteId is present, or creates a new one)
    const handleSaveDailyRoute = async (routeData) => {
        try {
            const isEditingExisting = Boolean(loadedSavedRouteId);
            const url = isEditingExisting 
                ? `/api/deliveries/routes/${loadedSavedRouteId}` 
                : '/api/deliveries/routes';
            const method = isEditingExisting ? 'PUT' : 'POST';

            const payload = {
                ...routeData,
                depot_address: depotLocation.name || 'Colombo Factory Depot',
                depot_latitude: depotLocation.lat || 6.9271,
                depot_longitude: depotLocation.lng || 79.8612
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success(
                    isEditingExisting 
                        ? 'Saved Delivery Route Manifest updated successfully!' 
                        : 'Daily Delivery Route saved successfully!'
                );
                setLoadedSavedRouteId(null);
                fetchSavedRoutes();
                setViewMode('saved-routes');
            } else {
                toast.error('Failed to save daily route');
            }
        } catch (err) {
            console.error('Save route error:', err);
            toast.error('An error occurred while saving route');
        }
    };

    // Delete Saved Route
    const handleDeleteSavedRoute = async (routeId, routeName) => {
        if (!confirm(`Are you sure you want to delete the saved route "${routeName}"?`)) return;
        try {
            const res = await fetch(`/api/deliveries/routes/${routeId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Saved delivery route deleted successfully!');
                fetchSavedRoutes();
                if (viewingSavedRoute?.id === routeId) setViewingSavedRoute(null);
                if (editingSavedRoute?.id === routeId) setEditingSavedRoute(null);
                if (loadedSavedRouteId === routeId) setLoadedSavedRouteId(null);
            } else {
                toast.error('Failed to delete route');
            }
        } catch (err) {
            console.error('Delete route error:', err);
            toast.error('An error occurred while deleting route');
        }
    };

    // Update Saved Route Details
    const handleUpdateSavedRoute = async (e) => {
        e.preventDefault();
        if (!editingSavedRoute) return;

        setIsSubmittingRouteEdit(true);
        try {
            const formattedDate = editingSavedRoute.route_date
                ? new Date(editingSavedRoute.route_date).toISOString().split('T')[0]
                : null;

            const res = await fetch(`/api/deliveries/routes/${editingSavedRoute.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    route_name: editingSavedRoute.route_name,
                    route_date: formattedDate,
                    driver_name: editingSavedRoute.driver_name,
                    vehicle_no: editingSavedRoute.vehicle_no,
                    status: editingSavedRoute.status,
                    depot_address: depotLocation.name,
                    depot_latitude: depotLocation.lat,
                    depot_longitude: depotLocation.lng,
                    stops_data: editingSavedRoute.stops_data
                })
            });

            if (res.ok) {
                toast.success('Route manifest details updated successfully!');
                setEditingSavedRoute(null);
                fetchSavedRoutes();
            } else {
                toast.error('Failed to update route details');
            }
        } catch (err) {
            console.error('Update route error:', err);
            toast.error('Error updating route details');
        } finally {
            setIsSubmittingRouteEdit(false);
        }
    };

    // Load Saved Route back into Interactive Map Planner
    const handleLoadRouteToPlanner = (route) => {
        let stops = route.stops_data;
        if (typeof stops === 'string') {
            try { stops = JSON.parse(stops); } catch (e) { stops = []; }
        }
        if (stops && Array.isArray(stops) && stops.length > 0) {
            setLoadedSavedRouteId(route.id);
            setRouteStops(stops);
            if (route.depot_latitude && route.depot_longitude) {
                const newDepot = {
                    lat: parseFloat(route.depot_latitude),
                    lng: parseFloat(route.depot_longitude),
                    name: route.depot_address || 'Colombo Factory Depot'
                };
                setDepotLocation(newDepot);
            }
            setViewMode('route-planner');
            setViewingSavedRoute(null);
            setEditingSavedRoute(null);
            toast.success(`Loaded "${route.route_name}" into Route Planner (Editing Manifest #${route.id})`);
        } else {
            toast.error('Route has no valid stops data to load');
        }
    };

    // Filter deliveries based on status tab selection
    const filteredDeliveries = useMemo(() => {
        return deliveries.filter(d => {
            if (statusFilter === 'All') return true;
            if (['Pending', 'Partially Delivered', 'Delivered'].includes(statusFilter)) {
                return d.status === statusFilter;
            }
            if (['In Production', 'Ready'].includes(statusFilter)) {
                return d.sales_order_status === statusFilter;
            }
            return true;
        });
    }, [deliveries, statusFilter]);

    // Status Tab counts
    const statusCounts = useMemo(() => {
        let pending = 0;
        let partial = 0;
        let delivered = 0;
        let inProd = 0;
        let ready = 0;

        deliveries.forEach(d => {
            if (d.status === 'Pending') pending++;
            else if (d.status === 'Partially Delivered') partial++;
            else if (d.status === 'Delivered') delivered++;

            if (d.sales_order_status === 'In Production') inProd++;
            else if (d.sales_order_status === 'Ready') ready++;
        });

        return {
            all: deliveries.length,
            pending,
            partial,
            delivered,
            inProd,
            ready,
        };
    }, [deliveries]);

    // Derived Statistics for Cards
    const stats = useMemo(() => {
        let pendingCount = 0;
        let partialCount = 0;
        let totalParcels = 0;

        deliveries.forEach(d => {
            if (d.status === 'Pending') pendingCount++;
            else if (d.status === 'Partially Delivered') partialCount++;

            if (d.dispatches && Array.isArray(d.dispatches)) {
                d.dispatches.forEach(disp => {
                    totalParcels += (disp.parcels_count || 0);
                });
            }
        });

        return { pendingCount, partialCount, totalParcels };
    }, [deliveries]);

    // Dynamic preview of parcels
    const previewParcels = useMemo(() => {
        const qty = parseInt(dispatchedQuantity) || 0;
        const per = parseInt(booksPerParcel) || 1;
        return Math.ceil(qty / per);
    }, [dispatchedQuantity, booksPerParcel]);

    // TanStack Table Columns
    const columns = useMemo(() => [
        {
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={table.getToggleAllPageRowsSelectedHandler()}
                    className="rounded border-white/10 bg-white/5 text-white focus:ring-0 cursor-pointer"
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    checked={row.getIsSelected()}
                    onChange={row.getToggleSelectedHandler()}
                    onClick={e => e.stopPropagation()}
                    className="rounded border-white/10 bg-white/5 text-white focus:ring-0 cursor-pointer"
                />
            ),
            size: 40,
            enableSorting: false,
            enableColumnFilter: false,
        },
        {
            accessorKey: 'sales_order_code',
            id: 'sales_order_code',
            header: 'SO Code',
            size: 130,
            cell: ({ row }) => {
                const d = row.original;
                return (
                    <div className="flex flex-col gap-1.5 items-start">
                        <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/5 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                            {d.sales_order_code}
                        </span>
                        {d.sales_order_status && (
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                                d.sales_order_status === 'In Production'
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                    : d.sales_order_status === 'Ready'
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            }`}>
                                {d.sales_order_status}
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'customer_name',
            id: 'customer_name',
            header: 'Customer',
            cell: ({ row }) => {
                const d = row.original;
                return (
                    <div>
                        <div className="font-semibold text-white">
                            {d.customer_name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                            <span className="truncate max-w-[200px]" title={d.delivery_address || 'No custom address set (falls back to default customer address)'}>
                                {d.delivery_address || 'Default Customer Address'}
                            </span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); openAddressModal(d); }}
                                className="text-blue-400 hover:text-blue-300 font-bold hover:underline cursor-pointer"
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'estimation_name',
            id: 'estimation_name',
            header: 'Estimation Item',
            cell: ({ getValue }) => <span className="text-white/80">{getValue()}</span>
        },
        {
            accessorKey: 'so_delivery_date',
            id: 'so_delivery_date',
            header: 'Delivery Date',
            size: 130,
            filterFn: dateOperatorFilterFn,
            cell: ({ getValue }) => {
                const val = getValue();
                return (
                    <span className="text-xs text-orange-300">
                        {val ? new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                    </span>
                );
            }
        },
        {
            id: 'progress',
            header: 'Progress',
            size: 160,
            accessorFn: row => (row.total_quantity > 0 ? (row.delivered_quantity / row.total_quantity) * 100 : 0),
            cell: ({ row }) => {
                const d = row.original;
                const pct = d.total_quantity > 0 ? (d.delivered_quantity / d.total_quantity) * 100 : 0;
                return (
                    <div className="space-y-1 min-w-[140px]">
                        <div className="flex justify-between text-[11px] font-mono text-gray-400">
                            <span>{d.delivered_quantity.toLocaleString()} / {d.total_quantity.toLocaleString()}</span>
                            <span>{Math.round(pct)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'status',
            id: 'status',
            header: 'Status',
            size: 130,
            cell: ({ getValue }) => (
                <div className="text-center">
                    <StatusBadge status={getValue()} />
                </div>
            )
        },
        {
            id: 'actions',
            header: 'Actions',
            size: 150,
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ row }) => {
                const d = row.original;
                const isExpanded = expandedDeliveryId === d.id;
                return (
                    <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => handleAddSingleToRoute(d)}
                            title="Plan this stop on route map"
                            className="px-2.5 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-xs text-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                            <FiMap className="w-3.5 h-3.5" /> Map
                        </button>
                        {d.dispatches && d.dispatches.length > 0 && (
                            <button
                                onClick={() => setExpandedDeliveryId(isExpanded ? null : d.id)}
                                className="px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                            >
                                {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                                Log ({d.dispatches.length})
                            </button>
                        )}
                        {d.status !== 'Delivered' && (
                            <button
                                onClick={() => openDispatchModal(d)}
                                className="px-3 py-1.5 rounded-lg bg-white hover:opacity-90 text-black text-xs font-bold transition-all cursor-pointer"
                            >
                                Log Dispatch
                            </button>
                        )}
                    </div>
                );
            }
        }
    ], [expandedDeliveryId]);

    // TanStack Table Instance
    const table = useReactTable({
        data: filteredDeliveries,
        columns,
        state: { globalFilter, columnVisibility, columnFilters, rowSelection },
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    });

    const { pageIndex, pageSize } = table.getState().pagination;
    const pageCount = table.getPageCount();

    const selectedRowsCount = Object.keys(rowSelection).filter(k => rowSelection[k]).length;

    return (
        <div className="text-white space-y-6">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter">Deliveries &amp; Dispatch</h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        Manage parcels, daily MapLibre GL route planning, and carrier tracking.
                    </p>
                </div>

                <div className="flex gap-3 items-center flex-wrap">
                    {/* View Mode Switcher */}
                    <div className="bg-black/30 backdrop-blur border border-white/10 p-1 rounded-xl flex gap-1">
                        <button
                            onClick={() => setViewMode('queue')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                viewMode === 'queue' ? 'bg-white text-black font-bold shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <FiList /> Delivery Queue
                        </button>
                        <button
                            onClick={() => setViewMode('route-planner')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                viewMode === 'route-planner' ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <FiMap /> Route Planner
                            {routeStops.length > 0 && (
                                <span className="bg-white/20 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                                    {routeStops.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setViewMode('saved-routes')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                viewMode === 'saved-routes' ? 'bg-emerald-600 text-white font-bold shadow-md' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <FiCalendar /> Saved Manifests
                        </button>
                    </div>

                    <button
                        onClick={handleStartDailyRoutePlanning}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-lg transition-all cursor-pointer"
                    >
                        <FiMap className="w-4 h-4" />
                        Plan Daily Route
                    </button>

                    <button
                        onClick={handleSync}
                        disabled={syncLoading}
                        className="flex items-center gap-2 bg-white text-black font-semibold px-4 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />
                        Sync Queue
                    </button>
                </div>
            </header>

            {/* View Mode 1: Table Queue View */}
            {viewMode === 'queue' && (
                <>
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: 'Pending Deliveries', value: stats.pendingCount, icon: FiClock, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
                            { label: 'Partially Dispatched', value: stats.partialCount, icon: FiTruck, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                            { label: 'Total Parcels Dispatched', value: stats.totalParcels, icon: FiPackage, color: 'text-green-400 bg-green-500/10 border-green-500/20' }
                        ].map(s => (
                            <div key={s.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-4 shadow-xl">
                                <div className={`p-3 rounded-xl border ${s.color}`}><s.icon className="w-5 h-5" /></div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-0.5">{s.label}</div>
                                    <div className="text-2xl font-bold">{s.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Status Tabs & Selection Actions */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/10 pb-4">
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: 'All', label: 'All Items', count: statusCounts.all },
                                { key: 'Pending', label: 'Pending Delivery', count: statusCounts.pending },
                                { key: 'Partially Delivered', label: 'Partially Delivered', count: statusCounts.partial },
                                { key: 'Delivered', label: 'Fully Delivered', count: statusCounts.delivered },
                                { key: 'In Production', label: 'In Production Jobs', count: statusCounts.inProd },
                                { key: 'Ready', label: 'Ready Jobs', count: statusCounts.ready }
                            ].map(tab => {
                                const isActive = statusFilter === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setStatusFilter(tab.key)}
                                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                                            isActive
                                                ? 'bg-white text-black border-white shadow-lg'
                                                : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                                            isActive ? 'bg-black/20 text-black font-extrabold' : 'bg-white/10 text-gray-400'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search columns..."
                                    value={globalFilter}
                                    onChange={e => setGlobalFilter(e.target.value)}
                                    className="bg-black/30 backdrop-blur border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs w-52 outline-none focus:border-white/30 placeholder-gray-600"
                                />
                            </div>
                            <ColumnToggle table={table} />
                            {selectedRowsCount > 0 && (
                                <button
                                    onClick={handleAddSelectedToRoute}
                                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-lg transition-all cursor-pointer animate-pulse"
                                >
                                    <FiPlus /> Add ({selectedRowsCount}) to Route
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Queue Table */}
                    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        {loading ? (
                            <div className="py-20 text-center text-gray-500 flex items-center justify-center gap-2">
                                <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
                                Loading delivery queue...
                            </div>
                        ) : filteredDeliveries.length === 0 ? (
                            <div className="py-24 text-center">
                                <FiTruck className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                                <p className="text-gray-500">No delivery items found for the selected filter</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        {table.getHeaderGroups().map(hg => (
                                            <tr key={hg.id} className="border-b border-white/[0.06] bg-black/20 text-xs font-bold uppercase tracking-widest text-gray-500">
                                                {hg.headers.map(h => (
                                                    <th key={h.id} style={{ width: h.getSize() }} className="px-5 py-4 text-left select-none">
                                                        {h.column.getCanSort() ? (
                                                            <button
                                                                onClick={h.column.getToggleSortingHandler()}
                                                                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                                                            >
                                                                {flexRender(h.column.columnDef.header, h.getContext())}
                                                                <SortIcon dir={h.column.getIsSorted()} />
                                                            </button>
                                                        ) : flexRender(h.column.columnDef.header, h.getContext())}
                                                        {h.column.getCanFilter() && <ColFilter column={h.column} />}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody>
                                        {table.getRowModel().rows.map(row => {
                                            const d = row.original;
                                            const isExpanded = expandedDeliveryId === d.id;

                                            return (
                                                <Fragment key={row.id}>
                                                    <tr
                                                        className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                                                            isExpanded ? 'bg-white/[0.02]' : ''
                                                        }`}
                                                    >
                                                        {row.getVisibleCells().map(cell => (
                                                            <td key={cell.id} className="px-5 py-4 align-middle">
                                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                            </td>
                                                        ))}
                                                    </tr>

                                                    {/* Historic Dispatch Logs Expanded Row */}
                                                    {isExpanded && d.dispatches && d.dispatches.length > 0 && (
                                                        <tr className="bg-black/30 border-b border-white/[0.04]">
                                                            <td colSpan={columns.length} className="px-8 py-4">
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                                                                        <FiBookOpen className="text-emerald-400" />
                                                                        Dispatch Shipments for {d.estimation_name}
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                        {d.dispatches.map(disp => (
                                                                            <div key={disp.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2">
                                                                                <div className="flex justify-between items-start gap-4">
                                                                                    <div>
                                                                                        <span className="font-bold text-emerald-400 block text-xs">{disp.dispatched_quantity.toLocaleString()} Books shipped</span>
                                                                                        <span className="text-gray-500 text-[10px]">{new Date(disp.dispatched_at).toLocaleString()}</span>
                                                                                    </div>
                                                                                    <a
                                                                                        href={`/api/deliveries/dispatches/${disp.id}/pdf`}
                                                                                        download
                                                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-[10px] font-bold transition-all shrink-0"
                                                                                    >
                                                                                        <FiDownload className="w-3.5 h-3.5" />
                                                                                        Delivery Note
                                                                                    </a>
                                                                                </div>
                                                                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                                                                                    <div>
                                                                                        <span className="text-gray-600 block text-[9px] uppercase font-bold">Parcels Created</span>
                                                                                        <span className="text-white font-mono">{disp.parcels_count} parcels</span>
                                                                                    </div>
                                                                                    {disp.carrier_name && (
                                                                                        <div>
                                                                                            <span className="text-gray-600 block text-[9px] uppercase font-bold">Carrier / Driver</span>
                                                                                            <span className="text-white truncate block">{disp.carrier_name}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                {disp.tracking_number && (
                                                                                    <div className="text-xs text-gray-400 border-t border-white/5 pt-1.5">
                                                                                        <span className="text-gray-600 block text-[9px] uppercase font-bold">Waybill / Tracking</span>
                                                                                        <span className="text-blue-400 font-mono select-all">{disp.tracking_number}</span>
                                                                                    </div>
                                                                                )}
                                                                                {disp.notes && (
                                                                                    <div className="text-xs text-gray-400 border-t border-white/5 pt-1.5">
                                                                                        <span className="text-gray-600 block text-[9px] uppercase font-bold">Notes</span>
                                                                                        <p className="text-gray-300 italic">{disp.notes}</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {!loading && filteredDeliveries.length > 0 && (
                            <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06] bg-black/20 flex-wrap gap-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>Rows per page:</span>
                                    <select
                                        value={pageSize}
                                        onChange={e => table.setPageSize(Number(e.target.value))}
                                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-300 outline-none"
                                    >
                                        {[10, 15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <span className="text-xs text-gray-500">
                                    Page <strong className="text-gray-300">{pageIndex + 1}</strong> of{' '}
                                    <strong className="text-gray-300">{pageCount || 1}</strong>
                                    {' · '}{table.getFilteredRowModel().rows.length} total items
                                </span>
                                <div className="flex items-center gap-1">
                                    <PagBtn onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                                        <FiChevronsLeft className="w-3.5 h-3.5" />
                                    </PagBtn>
                                    <PagBtn onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                                        <FiChevronLeft className="w-3.5 h-3.5" />
                                    </PagBtn>
                                    {Array.from({ length: pageCount }, (_, i) => i)
                                        .filter(i => Math.abs(i - pageIndex) <= 2)
                                        .map(i => (
                                            <button
                                                key={i}
                                                onClick={() => table.setPageIndex(i)}
                                                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                                    i === pageIndex ? 'bg-white text-black font-bold' : 'text-gray-400 hover:bg-white/10'
                                                }`}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    <PagBtn onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                                        <FiChevronRight className="w-3.5 h-3.5" />
                                    </PagBtn>
                                    <PagBtn onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}>
                                        <FiChevronsRight className="w-3.5 h-3.5" />
                                    </PagBtn>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* View Mode 2: Interactive MapLibre GL Route Planner */}
            {viewMode === 'route-planner' && (
                <div className="space-y-4">
                    {/* Route Planner Header Info */}
                    <div className="bg-black/30 border border-white/10 rounded-2xl px-4 py-3 flex justify-between items-center text-xs text-gray-400 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>Showing <strong>{routeStops.length}</strong> delivery stops on MapLibre GL map</span>
                        </div>
                        <span className="text-[11px] text-gray-500">
                            Search &amp; select pending deliveries one by one in the Route Manifest panel on the right.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        <div className="lg:col-span-2">
                            <DeliveryRouteMap
                                depotLocation={depotLocation}
                                stops={routeStops}
                                selectedStopId={selectedStopId}
                                onStopSelect={stop => setSelectedStopId(stop.id)}
                                onLocationUpdate={handleLocationUpdate}
                                onDepotLocationUpdate={handleUpdateDepotLocation}
                                onRouteCalculated={setRouteStats}
                                pinModeStop={pinModeStop}
                                setPinModeStop={setPinModeStop}
                                onFetchAllLocations={handleFetchAllLocations}
                            />
                        </div>
                        <div className="h-full">
                            <RoutePlannerDrawer
                                routeStops={routeStops}
                                allDeliveries={deliveries}
                                depotLocation={depotLocation}
                                loadedSavedRouteId={loadedSavedRouteId}
                                onDepotLocationUpdate={handleUpdateDepotLocation}
                                onAddStop={delivery => setRouteStops(prev => prev.some(s => s.id === delivery.id) ? prev : [...prev, delivery])}
                                onReorderStops={setRouteStops}
                                onRemoveStop={id => setRouteStops(prev => prev.filter(s => s.id !== id))}
                                onLocationUpdate={handleLocationUpdate}
                                onPinStop={stop => setPinModeStop(stop)}
                                routeStats={routeStats}
                                onSaveRoute={handleSaveDailyRoute}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* View Mode 3: Saved Route Manifests History */}
            {viewMode === 'saved-routes' && (
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="p-5 border-b border-white/10 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold">Saved Daily Delivery Route Manifests</h2>
                            <p className="text-xs text-gray-500">Historical dispatch routes and driver assignment records</p>
                        </div>
                        <button
                            onClick={fetchSavedRoutes}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <FiRefreshCw className={`w-4 h-4 ${loadingSavedRoutes ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {loadingSavedRoutes ? (
                        <div className="py-20 text-center text-gray-500 flex items-center justify-center gap-2">
                            <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/50 animate-spin" />
                            Loading saved routes...
                        </div>
                    ) : savedRoutes.length === 0 ? (
                        <div className="py-20 text-center text-gray-500">
                            <FiCalendar className="w-10 h-10 mx-auto mb-2 text-gray-700" />
                            No daily delivery routes saved yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-white/[0.06] bg-black/20 text-xs font-bold uppercase tracking-widest text-gray-500">
                                        <th className="px-5 py-4 text-left">Route Name</th>
                                        <th className="px-5 py-4 text-left">Scheduled Date</th>
                                        <th className="px-5 py-4 text-left">Driver &amp; Vehicle</th>
                                        <th className="px-5 py-4 text-center">Status</th>
                                        <th className="px-5 py-4 text-center">Stops</th>
                                        <th className="px-5 py-4 text-center">Est. Distance / Time</th>
                                        <th className="px-5 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {savedRoutes.map(r => {
                                        let stops = r.stops_data;
                                        if (typeof stops === 'string') {
                                            try { stops = JSON.parse(stops); } catch (e) { stops = []; }
                                        }
                                        const stopCount = Array.isArray(stops) ? stops.length : 0;
                                        const routeStatus = r.status || 'Planned';

                                        const statusBadgeCls =
                                            routeStatus === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                            routeStatus === 'In Progress' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                            routeStatus === 'Cancelled' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                            'bg-amber-500/20 text-amber-300 border-amber-500/30';

                                        return (
                                            <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                                                <td className="px-5 py-4 font-bold text-white">
                                                    <button
                                                        onClick={() => setViewingSavedRoute(r)}
                                                        className="hover:underline text-left cursor-pointer"
                                                    >
                                                        {r.route_name}
                                                    </button>
                                                </td>
                                                <td className="px-5 py-4 text-xs text-gray-400 font-mono">
                                                    {r.route_date ? new Date(r.route_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="text-white font-semibold text-xs">{r.driver_name || 'Unassigned'}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">{r.vehicle_no || '—'}</div>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${statusBadgeCls}`}>
                                                        {routeStatus}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg text-xs font-mono font-bold">
                                                        {stopCount} Stops
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-center text-xs font-mono text-gray-300">
                                                    {r.total_distance_km || 0} km · {r.total_duration_mins || 0} mins
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setViewingSavedRoute(r)}
                                                            title="View Route Details & Stops"
                                                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
                                                        >
                                                            <FiEye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleLoadRouteToPlanner(r)}
                                                            title="Load Route into Map Planner"
                                                            className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-colors cursor-pointer"
                                                        >
                                                            <FiMap className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingSavedRoute(r)}
                                                            title="Edit Route Details"
                                                            className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/20 transition-colors cursor-pointer"
                                                        >
                                                            <FiEdit2 className="w-4 h-4" />
                                                        </button>
                                                        <a
                                                            href={`/api/deliveries/routes/${r.id}/pdf`}
                                                            download
                                                            title="Download Manifest PDF"
                                                            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 transition-colors cursor-pointer"
                                                        >
                                                            <FiDownload className="w-4 h-4" />
                                                        </a>
                                                        <button
                                                            onClick={() => handleDeleteSavedRoute(r.id, r.route_name)}
                                                            title="Delete Saved Route"
                                                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-colors cursor-pointer"
                                                        >
                                                            <FiTrash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Log Dispatch Modal */}
            {dispatchModalDelivery && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                    <FiTruck className="w-4 h-4 text-white/60" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white text-sm">Log Dispatch Shipment</h3>
                                    <p className="text-xs text-white/30">{dispatchModalDelivery.sales_order_code} · {dispatchModalDelivery.customer_name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDispatchModalDelivery(null)}
                                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white transition-colors cursor-pointer"
                            >
                                <FiX />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleLogDispatch} className="p-6 space-y-4 flex-1">
                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Estimation Item</label>
                                <div className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-medium select-none">
                                    {dispatchModalDelivery.estimation_name}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">
                                        Qty to Dispatch (Max {dispatchModalDelivery.total_quantity - dispatchModalDelivery.delivered_quantity})
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max={dispatchModalDelivery.total_quantity - dispatchModalDelivery.delivered_quantity}
                                        value={dispatchedQuantity}
                                        onChange={e => setDispatchedQuantity(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Books per Parcel</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={booksPerParcel}
                                        onChange={e => setBooksPerParcel(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                            </div>

                            {/* Parcels Preview Banner */}
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
                                <FiPackage className="w-5 h-5 text-emerald-400 shrink-0" />
                                <div className="text-xs">
                                    <span className="font-bold text-white">Parcel Calculation:</span> This shipment will consist of{' '}
                                    <span className="font-bold text-emerald-400 font-mono text-sm">{previewParcels}</span> parcels{' '}
                                    <span className="text-white/40">({dispatchedQuantity} books / {booksPerParcel} books per box).</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Carrier / Driver Name</label>
                                    <input
                                        type="text"
                                        value={carrierName}
                                        onChange={e => setCarrierName(e.target.value)}
                                        placeholder="e.g. Acme Logistics, John"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Waybill / Tracking No.</label>
                                    <input
                                        type="text"
                                        value={trackingNumber}
                                        onChange={e => setTrackingNumber(e.target.value)}
                                        placeholder="e.g. TRK984024"
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Shipment Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="e.g. Box 1-4 loaded, remaining tomorrow."
                                    rows={3}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-white/30 resize-none"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={() => setDispatchModalDelivery(null)}
                                    className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs text-white/70 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePreviewDownload}
                                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <FiDownload className="w-3.5 h-3.5" />
                                    Download Preview
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingDispatch}
                                    className="px-5 py-2 bg-white text-black font-bold rounded-xl text-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmittingDispatch ? 'Saving...' : 'Submit Shipment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Address & Location Modal */}
            {addressModalDelivery && (
                <EditAddressLocationModal
                    delivery={addressModalDelivery}
                    onClose={() => setAddressModalDelivery(null)}
                    onSaveSuccess={() => {
                        fetchDeliveries();
                    }}
                />
            )}

            {/* View Saved Route Manifest Detail Modal */}
            {viewingSavedRoute && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                    <div className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                                    <FiTruck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">{viewingSavedRoute.route_name}</h3>
                                    <p className="text-xs text-gray-400 flex items-center gap-2">
                                        <span>Scheduled: {viewingSavedRoute.route_date ? new Date(viewingSavedRoute.route_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span>
                                        <span>·</span>
                                        <span>{viewingSavedRoute.driver_name || 'Unassigned Driver'}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingSavedRoute(null)}
                                className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content Body */}
                        <div className="p-6 overflow-y-auto space-y-5 flex-1">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Vehicle</span>
                                    <span className="text-sm font-semibold text-white font-mono">{viewingSavedRoute.vehicle_no || 'Unassigned'}</span>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Est. Driving Distance</span>
                                    <span className="text-sm font-bold text-emerald-400 font-mono">{viewingSavedRoute.total_distance_km} km</span>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Est. Duration</span>
                                    <span className="text-sm font-bold text-blue-400 font-mono">{viewingSavedRoute.total_duration_mins} mins</span>
                                </div>
                            </div>

                            {/* Depot Location */}
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between text-xs">
                                <div>
                                    <span className="text-[10px] font-extrabold uppercase text-emerald-400 block">Factory Depot Location</span>
                                    <span className="text-white font-medium">{viewingSavedRoute.depot_address || 'Colombo Factory Depot'}</span>
                                </div>
                                <span className="text-gray-400 font-mono text-[11px]">
                                    [{viewingSavedRoute.depot_latitude}, {viewingSavedRoute.depot_longitude}]
                                </span>
                            </div>

                            {/* Stops List with Re-Pin Options */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Delivery Stops ({(viewingSavedRoute.stops_data || []).length})
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => handleLoadRouteToPlanner(viewingSavedRoute)}
                                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                        <FiMapPin className="w-3.5 h-3.5" /> Re-Pin All on Map
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {(viewingSavedRoute.stops_data || []).map((stop, index) => (
                                        <div key={stop.id || index} className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                                                    {index + 1}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-white text-xs truncate">{stop.customer_name}</div>
                                                    <div className="text-[11px] text-gray-400 mt-0.5 truncate">{stop.delivery_address || 'No address specified'}</div>
                                                    <div className="text-[10px] text-gray-500 mt-1 font-mono flex items-center gap-2">
                                                        <span>Order: {stop.sales_order_code}</span>
                                                        <span>·</span>
                                                        <span>Qty: {stop.total_quantity - stop.delivered_quantity} units</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {stop.latitude && stop.longitude ? (
                                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono px-2 py-0.5 rounded">
                                                        Pinned [{parseFloat(stop.latitude).toFixed(4)}, {parseFloat(stop.longitude).toFixed(4)}]
                                                    </span>
                                                ) : (
                                                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-semibold px-2 py-0.5 rounded">
                                                        No Pin
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setAddressModalDelivery(stop)}
                                                    className="px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                    <FiMapPin className="w-3 h-3" /> Re-Pin Location
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setEditingSavedRoute(viewingSavedRoute);
                                        setViewingSavedRoute(null);
                                    }}
                                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <FiEdit2 className="w-3.5 h-3.5" />
                                    Edit Details
                                </button>
                                <button
                                    onClick={() => handleDeleteSavedRoute(viewingSavedRoute.id, viewingSavedRoute.route_name)}
                                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <FiTrash2 className="w-3.5 h-3.5" />
                                    Delete Manifest
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <a
                                    href={`/api/deliveries/routes/${viewingSavedRoute.id}/pdf`}
                                    download
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <FiDownload className="w-3.5 h-3.5" />
                                    Download PDF
                                </a>
                                <button
                                    onClick={() => handleLoadRouteToPlanner(viewingSavedRoute)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-blue-600/20"
                                >
                                    <FiMap className="w-3.5 h-3.5" />
                                    Load in Route Planner
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Saved Route Manifest Detail Modal */}
            {editingSavedRoute && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                    <div className="w-full max-w-xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                                    <FiEdit2 className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-white text-sm">Edit Route Manifest Details</h3>
                            </div>
                            <button
                                onClick={() => setEditingSavedRoute(null)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleUpdateSavedRoute} className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Route Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingSavedRoute.route_name || ''}
                                    onChange={e => setEditingSavedRoute({ ...editingSavedRoute, route_name: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Scheduled Route Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={editingSavedRoute.route_date ? new Date(editingSavedRoute.route_date).toISOString().split('T')[0] : ''}
                                        onChange={e => setEditingSavedRoute({ ...editingSavedRoute, route_date: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Route Status</label>
                                    <select
                                        value={editingSavedRoute.status || 'Planned'}
                                        onChange={e => setEditingSavedRoute({ ...editingSavedRoute, status: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    >
                                        <option value="Planned">Planned</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Driver Name</label>
                                    <input
                                        type="text"
                                        value={editingSavedRoute.driver_name || ''}
                                        onChange={e => setEditingSavedRoute({ ...editingSavedRoute, driver_name: e.target.value })}
                                        placeholder="e.g. Kamal Perera"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Vehicle Registration No.</label>
                                    <input
                                        type="text"
                                        value={editingSavedRoute.vehicle_no || ''}
                                        onChange={e => setEditingSavedRoute({ ...editingSavedRoute, vehicle_no: e.target.value })}
                                        placeholder="e.g. WP CAB-9482"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                    />
                                </div>
                            </div>

                            {/* Stops Re-Pin Section */}
                            <div className="pt-2 border-t border-white/10">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Route Stops Location Pins</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const r = editingSavedRoute;
                                            setEditingSavedRoute(null);
                                            handleLoadRouteToPlanner(r);
                                        }}
                                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                        <FiMap className="w-3.5 h-3.5" /> Re-Pin All on Route Map Planner
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {(editingSavedRoute.stops_data || []).map((stop, idx) => (
                                        <div key={stop.id || idx} className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
                                            <div className="min-w-0">
                                                <strong className="text-white block truncate">{stop.customer_name}</strong>
                                                <span className="text-[10px] text-gray-400 truncate block">{stop.delivery_address || 'No address'}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setAddressModalDelivery(stop)}
                                                className="px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                                            >
                                                <FiMapPin className="w-3 h-3" /> Re-Pin Location
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setEditingSavedRoute(null)}
                                    className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs text-white/70 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingRouteEdit}
                                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition-opacity disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmittingRouteEdit ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}


