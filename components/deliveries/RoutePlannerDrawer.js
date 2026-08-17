'use client';

import { useState, useEffect } from 'react';
import {
    FiTruck, FiMapPin, FiArrowUp, FiArrowDown,
    FiTrash2, FiZap, FiSave, FiHome, FiAlertTriangle,
    FiSearch, FiPlus, FiCheckCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function RoutePlannerDrawer({
    routeStops = [],
    allDeliveries = [],
    depotLocation = { lat: 6.9271, lng: 79.8612, name: 'Colombo Factory Depot' },
    loadedSavedRouteId = null,
    onDepotLocationUpdate = () => {},
    onAddStop = () => {},
    onReorderStops = () => {},
    onRemoveStop = () => {},
    onLocationUpdate = () => {},
    onPinStop = () => {},
    routeStats = { distanceKm: 0, durationMins: 0 },
    onSaveRoute = () => {}
}) {
    const [routeName, setRouteName] = useState(`Route-${new Date().toISOString().split('T')[0]}`);
    const [routeDate, setRouteDate] = useState(new Date().toISOString().split('T')[0]);
    const [driverName, setDriverName] = useState('');
    const [vehicleNo, setVehicleNo] = useState('');
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Factory Depot Edit State
    const [isEditingDepot, setIsEditingDepot] = useState(false);
    const [depotForm, setDepotForm] = useState({
        name: depotLocation?.name || 'Colombo Factory Depot',
        lat: depotLocation?.lat || 6.9271,
        lng: depotLocation?.lng || 79.8612
    });

    useEffect(() => {
        if (depotLocation && depotLocation.lat && depotLocation.lng) {
            setDepotForm({
                name: depotLocation.name || 'Colombo Factory Depot',
                lat: parseFloat(depotLocation.lat),
                lng: parseFloat(depotLocation.lng)
            });
        }
    }, [depotLocation]);

    // Search and Select Stop States
    const [stopSearchQuery, setStopSearchQuery] = useState('');
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    // Available deliveries not yet in routeStops
    const availableDeliveries = allDeliveries.filter(
        d => !routeStops.some(s => s.id === d.id)
    );

    // Filter available deliveries by search query
    const filteredSearchDeliveries = availableDeliveries.filter(d => {
        if (!stopSearchQuery.trim()) return true;
        const q = stopSearchQuery.toLowerCase();
        return (
            d.sales_order_code?.toLowerCase().includes(q) ||
            d.customer_name?.toLowerCase().includes(q) ||
            d.estimation_name?.toLowerCase().includes(q) ||
            d.delivery_address?.toLowerCase().includes(q)
        );
    });

    // Add a single delivery stop
    const handleSelectStopToAdd = (delivery) => {
        onAddStop(delivery);
        setStopSearchQuery('');
        setShowSearchDropdown(false);
        toast.success(`Added ${delivery.sales_order_code} (${delivery.customer_name}) to route`);
    };

    // Auto-Geocode any stop in the current route missing lat/lng coordinates
    const handleAutoGeocodeAll = async () => {
        const missing = routeStops.filter(s => !s.latitude || !s.longitude);
        if (missing.length === 0) {
            toast.success('All stops already have geocoded coordinates!');
            return;
        }

        setIsGeocoding(true);
        const loadToast = toast.loading(`Geocoding ${missing.length} delivery addresses via OpenStreetMap...`);

        let updatedCount = 0;
        for (const stop of missing) {
            const query = stop.delivery_address || `${stop.customer_name}, Sri Lanka`;
            try {
                const res = await fetch(`/api/deliveries/route-planner/geocode?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.lat && data.lng) {
                        await onLocationUpdate(stop.id, data.lat, data.lng);
                        updatedCount++;
                    }
                }
            } catch (err) {
                console.error(`Geocode error for stop ${stop.id}:`, err);
            }
        }

        setIsGeocoding(false);
        if (updatedCount > 0) {
            toast.success(`Geocoded ${updatedCount} address locations!`, { id: loadToast });
        } else {
            toast.error('Could not auto-geocode addresses. You can click on the map to pin locations manually.', { id: loadToast });
        }
    };

    // Auto-Optimize Stop Sequence using Nearest-Neighbor heuristic
    const handleAutoOptimizeSequence = () => {
        if (routeStops.length < 2) return;

        let unvisited = [...routeStops];
        let currentPos = { lat: depotLocation.lat || 6.9271, lng: depotLocation.lng || 79.8612 };
        let sorted = [];

        while (unvisited.length > 0) {
            let closestIdx = 0;
            let minDistance = Infinity;

            unvisited.forEach((stop, idx) => {
                if (!stop.latitude || !stop.longitude) return;
                const dLat = (stop.latitude - currentPos.lat);
                const dLng = (stop.longitude - currentPos.lng);
                const dist = Math.sqrt(dLat * dLat + dLng * dLng);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestIdx = idx;
                }
            });

            const nextStop = unvisited.splice(closestIdx, 1)[0];
            sorted.push(nextStop);
            if (nextStop.latitude && nextStop.longitude) {
                currentPos = { lat: parseFloat(nextStop.latitude), lng: parseFloat(nextStop.longitude) };
            }
        }

        onReorderStops(sorted);
        toast.success('Stop sequence optimized for shortest driving path!');
    };

    // Move Stop Up or Down
    const moveStop = (index, direction) => {
        const newStops = [...routeStops];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newStops.length) return;

        const temp = newStops[index];
        newStops[index] = newStops[targetIndex];
        newStops[targetIndex] = temp;
        onReorderStops(newStops);
    };

    // Save Daily Route to Database
    const handleSave = async (e) => {
        e.preventDefault();
        if (routeStops.length === 0) {
            toast.error('Please add at least 1 delivery stop to the route');
            return;
        }

        setIsSaving(true);
        try {
            await onSaveRoute({
                route_name: routeName,
                route_date: routeDate,
                driver_name: driverName,
                vehicle_no: vehicleNo,
                stops_data: routeStops,
                total_distance_km: parseFloat(routeStats.distanceKm || 0),
                total_duration_mins: parseInt(routeStats.durationMins || 0)
            });
        } finally {
            setIsSaving(false);
        }
    };

    const unlocatedCount = routeStops.filter(s => !s.latitude || !s.longitude).length;

    return (
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-5 shadow-2xl flex flex-col justify-between h-full">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                            <FiTruck className="text-blue-400" />
                            {loadedSavedRouteId ? `Editing Manifest #${loadedSavedRouteId}` : 'Daily Route Manifest'}
                        </h2>
                        <p className="text-xs text-gray-500">
                            {loadedSavedRouteId ? 'Updating loaded saved delivery route' : 'Search & select deliveries one-by-one'}
                        </p>
                    </div>
                    {unlocatedCount > 0 && (
                        <button
                            onClick={handleAutoGeocodeAll}
                            disabled={isGeocoding}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <FiZap className={isGeocoding ? 'animate-spin' : ''} />
                            Fetch Pins ({unlocatedCount})
                        </button>
                    )}
                </div>

                {/* Search & Select Deliveries One by One */}
                <div className="relative">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                        Search &amp; Add Delivery Stop
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={stopSearchQuery}
                            onFocus={() => setShowSearchDropdown(true)}
                            onChange={e => {
                                setStopSearchQuery(e.target.value);
                                setShowSearchDropdown(true);
                            }}
                            placeholder="Type SO code, customer name, or item (e.g. SO-0187)..."
                            className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white outline-none focus:border-blue-500/50 transition-colors"
                        />
                        <FiSearch className="absolute left-3 top-3 text-gray-400 w-3.5 h-3.5" />
                        {stopSearchQuery && (
                            <button
                                type="button"
                                onClick={() => setStopSearchQuery('')}
                                className="absolute right-3 top-2.5 text-gray-500 hover:text-white text-xs"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showSearchDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0d0d0d] border border-white/15 rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-white/5">
                            {filteredSearchDeliveries.length === 0 ? (
                                <div className="p-3 text-center text-xs text-gray-500">
                                    {availableDeliveries.length === 0
                                        ? 'All available deliveries added to route'
                                        : 'No matching pending deliveries found'}
                                </div>
                            ) : (
                                filteredSearchDeliveries.map(item => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSelectStopToAdd(item)}
                                        className="w-full text-left p-2.5 hover:bg-blue-600/10 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white group-hover:text-blue-300 truncate">
                                                    {item.customer_name}
                                                </span>
                                                <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0">
                                                    {item.sales_order_code}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-400 truncate mt-0.5">
                                                {item.estimation_name}
                                            </div>
                                            <div className="text-[10px] text-gray-500 truncate">
                                                📍 {item.delivery_address || 'Default Address'}
                                            </div>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-1 text-xs text-blue-400 font-bold opacity-80 group-hover:opacity-100">
                                            <FiPlus /> Add
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Factory Depot Info & Edit Controls */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <FiHome className="text-emerald-400 text-lg shrink-0" />
                            <div className="min-w-0">
                                <strong className="text-white block truncate">{depotLocation.name || 'Colombo Factory Depot'}</strong>
                                <span className="text-[10px] text-emerald-400 font-mono">
                                    Lat: {parseFloat(depotLocation.lat || 0).toFixed(6)}, Lng: {parseFloat(depotLocation.lng || 0).toFixed(6)}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setDepotForm({
                                    name: depotLocation.name || 'Colombo Factory Depot',
                                    lat: depotLocation.lat,
                                    lng: depotLocation.lng
                                });
                                setIsEditingDepot(prev => !prev);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 transition-all shrink-0 cursor-pointer"
                        >
                            {isEditingDepot ? 'Cancel' : 'Edit Factory'}
                        </button>
                    </div>

                    {/* Inline Edit Form */}
                    {isEditingDepot && (
                        <div className="pt-2 border-t border-emerald-500/20 space-y-2">
                            <div>
                                <label className="block text-[9px] font-bold text-gray-400 uppercase">Factory Depot Name</label>
                                <input
                                    type="text"
                                    value={depotForm.name}
                                    onChange={e => setDepotForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[9px] font-bold text-gray-400 uppercase">Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={depotForm.lat}
                                        onChange={e => setDepotForm(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-gray-400 uppercase">Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={depotForm.lng}
                                        onChange={e => setDepotForm(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    onDepotLocationUpdate(depotForm);
                                    setIsEditingDepot(false);
                                }}
                                className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-opacity cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                            >
                                <FiSave className="w-3.5 h-3.5" />
                                Save Factory Location to DB
                            </button>
                        </div>
                    )}
                </div>

                {/* Route Form Fields */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Route Name</label>
                        <input
                            type="text"
                            value={routeName}
                            onChange={e => setRouteName(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Delivery Date</label>
                        <input
                            type="date"
                            value={routeDate}
                            onChange={e => setRouteDate(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Driver Name</label>
                        <input
                            type="text"
                            placeholder="e.g. John Doe"
                            value={driverName}
                            onChange={e => setDriverName(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Vehicle No.</label>
                        <input
                            type="text"
                            placeholder="e.g. WP-CAB-8940"
                            value={vehicleNo}
                            onChange={e => setVehicleNo(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                        />
                    </div>
                </div>

                {/* Route Live Statistics */}
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-bold">Stops</span>
                        <span className="text-base font-bold text-white font-mono">{routeStops.length}</span>
                    </div>
                    <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-bold">Est. Distance</span>
                        <span className="text-base font-bold text-blue-400 font-mono">{routeStats.distanceKm} km</span>
                    </div>
                    <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-bold">Driving Time</span>
                        <span className="text-base font-bold text-emerald-400 font-mono">{routeStats.durationMins} mins</span>
                    </div>
                </div>

                {/* Sequence Controls */}
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Stop Sequence</span>
                    <button
                        type="button"
                        onClick={handleAutoOptimizeSequence}
                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                        <FiZap /> Auto-Optimize Order
                    </button>
                </div>

                {/* Stops List */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {routeStops.length === 0 ? (
                        <div className="py-8 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-xl">
                            Search and select deliveries above to build today's route
                        </div>
                    ) : (
                        routeStops.map((stop, idx) => {
                            const hasCoords = stop.latitude && stop.longitude;
                            return (
                                <div
                                    key={stop.id}
                                    className="bg-black/30 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-white/20 transition-all"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                                            {idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white truncate">{stop.customer_name}</span>
                                                <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                                    {stop.sales_order_code}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-400 truncate mt-0.5">
                                                {stop.delivery_address || 'Default Address'}
                                            </div>
                                            {!hasCoords && (
                                                <span className="text-[9px] text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                                                    <FiAlertTriangle className="shrink-0" />
                                                    No location pinned yet
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action icons */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => onPinStop(stop)}
                                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                                            title="Pin on Map"
                                        >
                                            <FiMapPin className="w-3.5 h-3.5" />
                                            Pin
                                        </button>
                                        <button
                                            onClick={() => moveStop(idx, -1)}
                                            disabled={idx === 0}
                                            className="p-1 text-gray-500 hover:text-white disabled:opacity-20 cursor-pointer"
                                            title="Move Stop Up"
                                        >
                                            <FiArrowUp />
                                        </button>
                                        <button
                                            onClick={() => moveStop(idx, 1)}
                                            disabled={idx === routeStops.length - 1}
                                            className="p-1 text-gray-500 hover:text-white disabled:opacity-20 cursor-pointer"
                                            title="Move Stop Down"
                                        >
                                            <FiArrowDown />
                                        </button>
                                        <button
                                            onClick={() => onRemoveStop(stop.id)}
                                            className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
                                            title="Remove Stop"
                                        >
                                            <FiTrash2 />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-white/10 flex gap-3">
                <button
                    onClick={handleSave}
                    disabled={isSaving || routeStops.length === 0}
                    className="flex-1 bg-white text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                    <FiSave className="w-4 h-4" />
                    {isSaving 
                        ? (loadedSavedRouteId ? 'Updating Manifest...' : 'Saving Route...') 
                        : (loadedSavedRouteId ? 'Update Route Manifest' : 'Save Daily Route')}
                </button>
            </div>
        </div>
    );
}
