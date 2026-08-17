'use client';

import { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
    FiX, FiMapPin, FiSearch, FiCheck, FiNavigation,
    FiCrosshair, FiAlertTriangle, FiInfo, FiTrash2
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const DARK_MAP_STYLE = {
    version: 8,
    sources: {
        'carto-dark': {
            type: 'raster',
            tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        }
    },
    layers: [
        {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19
        }
    ]
};

export default function EditAddressLocationModal({
    delivery,
    onClose = () => {},
    onSaveSuccess = () => {}
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);

    const [address, setAddress] = useState(delivery?.delivery_address || '');
    const [lat, setLat] = useState(delivery?.latitude ? parseFloat(delivery.latitude) : null);
    const [lng, setLng] = useState(delivery?.longitude ? parseFloat(delivery.longitude) : null);

    // Location Search & GPS States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLocatingUser, setIsLocatingUser] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Default map center (Sri Lanka Colombo or existing lat/lng)
    const initialLat = lat || 6.9271;
    const initialLng = lng || 79.8612;

    // Helper to create marker DOM element
    const createMarkerElement = () => {
        const markerEl = document.createElement('div');
        markerEl.className = 'cursor-grab active:cursor-grabbing';
        markerEl.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-blue-600 text-white border-2 border-white shadow-xl flex items-center justify-center font-bold text-xs transition-transform duration-200 hover:scale-125">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>
        `;
        return markerEl;
    };

    // Initialize Map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: DARK_MAP_STYLE,
            center: [initialLng, initialLat],
            zoom: lat && lng ? 13 : 11,
            attributionControl: false
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        mapRef.current = map;

        map.on('load', () => {
            map.resize();
        });

        // Add Marker if coordinates exist
        if (lat && lng) {
            const markerEl = createMarkerElement();
            const marker = new maplibregl.Marker({ element: markerEl, draggable: true })
                .setLngLat([lng, lat])
                .addTo(map);

            marker.on('dragend', () => {
                const lngLat = marker.getLngLat();
                setLat(parseFloat(lngLat.lat.toFixed(6)));
                setLng(parseFloat(lngLat.lng.toFixed(6)));
            });

            markerRef.current = marker;
        }

        // Click map to set/update pin
        map.on('click', (e) => {
            const newLat = parseFloat(e.lngLat.lat.toFixed(6));
            const newLng = parseFloat(e.lngLat.lng.toFixed(6));
            setLat(newLat);
            setLng(newLng);

            if (markerRef.current) {
                markerRef.current.setLngLat([newLng, newLat]);
            } else {
                const markerEl = createMarkerElement();
                const marker = new maplibregl.Marker({ element: markerEl, draggable: true })
                    .setLngLat([newLng, newLat])
                    .addTo(map);

                marker.on('dragend', () => {
                    const pos = marker.getLngLat();
                    setLat(parseFloat(pos.lat.toFixed(6)));
                    setLng(parseFloat(pos.lng.toFixed(6)));
                });

                markerRef.current = marker;
            }
        });

        return () => {
            map.remove();
        };
    }, []);

    // Clear Location Pin completely
    const handleClearPin = () => {
        setLat(null);
        setLng(null);
        if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
        }
        toast.success('Location pin removed');
    };

    // Perform Location Search
    const handleSearchLocation = async (e) => {
        e?.preventDefault();
        const q = searchQuery || address;
        if (!q.trim()) {
            toast.error('Please enter a place or address to search');
            return;
        }

        setIsSearching(true);
        setSearchResults([]);
        try {
            const res = await fetch(`/api/deliveries/route-planner/geocode?q=${encodeURIComponent(q)}&limit=5`);
            if (res.ok) {
                const data = await res.json();
                const results = data.results || (data.lat ? [{ lat: data.lat, lng: data.lng, display_name: data.display_name }] : []);
                if (results.length > 0) {
                    setSearchResults(results);
                    selectSearchResult(results[0]);
                } else {
                    toast.error('No matching locations found for search query');
                }
            } else {
                toast.error('Location search failed');
            }
        } catch (err) {
            console.error('Location search error:', err);
            toast.error('An error occurred during location search');
        } finally {
            setIsSearching(false);
        }
    };

    // Select Location from Search Results
    const selectSearchResult = (item) => {
        setLat(item.lat);
        setLng(item.lng);
        setSearchResults([]);
        if (item.display_name && !address) {
            setAddress(item.display_name);
        }

        if (mapRef.current) {
            mapRef.current.flyTo({ center: [item.lng, item.lat], zoom: 14 });
            if (markerRef.current) {
                markerRef.current.setLngLat([item.lng, item.lat]);
            } else {
                const markerEl = createMarkerElement();
                const marker = new maplibregl.Marker({ element: markerEl, draggable: true })
                    .setLngLat([item.lng, item.lat])
                    .addTo(mapRef.current);

                marker.on('dragend', () => {
                    const pos = marker.getLngLat();
                    setLat(parseFloat(pos.lat.toFixed(6)));
                    setLng(parseFloat(pos.lng.toFixed(6)));
                });

                markerRef.current = marker;
            }
        }
        toast.success(`Location set to [${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}]`);
    };

    // Fetch Browser User Geolocation (GPS)
    const handleUseCurrentLocation = () => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setIsLocatingUser(true);
        const loadToast = toast.loading('Detecting your current GPS location...');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const userLat = parseFloat(position.coords.latitude.toFixed(6));
                const userLng = parseFloat(position.coords.longitude.toFixed(6));

                setLat(userLat);
                setLng(userLng);
                setIsLocatingUser(false);

                if (mapRef.current) {
                    mapRef.current.flyTo({ center: [userLng, userLat], zoom: 15 });
                    if (markerRef.current) {
                        markerRef.current.setLngLat([userLng, userLat]);
                    } else {
                        const markerEl = createMarkerElement();
                        const marker = new maplibregl.Marker({ element: markerEl, draggable: true })
                            .setLngLat([userLng, userLat])
                            .addTo(mapRef.current);

                        marker.on('dragend', () => {
                            const pos = marker.getLngLat();
                            setLat(parseFloat(pos.lat.toFixed(6)));
                            setLng(parseFloat(pos.lng.toFixed(6)));
                        });

                        markerRef.current = marker;
                    }
                }

                // Reverse geocode to populate address if empty
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}`, {
                        headers: { 'User-Agent': 'ERP-Pressmatics/1.0 DeliveryPlanner' }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.display_name && !address) {
                            setAddress(data.display_name);
                        }
                    }
                } catch (e) {
                    console.error('Reverse geocode error:', e);
                }

                toast.success(`Current GPS location detected! [${userLat.toFixed(4)}, ${userLng.toFixed(4)}]`, { id: loadToast });
            },
            (error) => {
                setIsLocatingUser(false);
                console.error('Geolocation error:', error);
                toast.error(`Could not detect location: ${error.message}`, { id: loadToast });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // Save Delivery Address & Coordinates
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/deliveries/${delivery.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    delivery_address: address,
                    latitude: lat,
                    longitude: lng
                })
            });

            if (res.ok) {
                toast.success('Delivery address & map location saved!');
                onSaveSuccess();
                onClose();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save delivery location');
            }
        } catch (err) {
            console.error('Save address & location error:', err);
            toast.error('An error occurred while saving details');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-xl bg-[#0a0a0a] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                            <FiMapPin className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white text-sm">Edit Delivery Address &amp; Location Pin</h3>
                            <p className="text-xs text-white/30">{delivery?.sales_order_code} · {delivery?.customer_name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white transition-colors cursor-pointer"
                    >
                        <FiX />
                    </button>
                </div>

                {/* Form & Map Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    {/* Delivery Address Text */}
                    <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Delivery Address Text</label>
                        <textarea
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            placeholder="Enter delivery address..."
                            rows={2}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/30 resize-none font-sans"
                        />
                    </div>

                    {/* Location Search Bar & My Location Button */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] font-bold text-white/40 uppercase">
                                Search Location or Use Current GPS
                            </label>
                            <button
                                type="button"
                                onClick={handleUseCurrentLocation}
                                disabled={isLocatingUser}
                                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                                <FiCrosshair className={isLocatingUser ? 'animate-spin' : ''} />
                                {isLocatingUser ? 'Detecting GPS...' : 'Use My Current Location'}
                            </button>
                        </div>

                        <div className="flex gap-2 relative">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Type city, street, or landmark (e.g. Kandy Town, Nugegoda)..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-white/30"
                                />
                                <FiSearch className="absolute left-3 top-2.5 text-gray-500 w-3.5 h-3.5" />
                            </div>
                            <button
                                type="button"
                                onClick={handleSearchLocation}
                                disabled={isSearching}
                                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                            >
                                <FiNavigation className={isSearching ? 'animate-spin' : ''} />
                                {isSearching ? 'Searching...' : 'Search'}
                            </button>
                        </div>

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="mt-2 bg-black/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-40 overflow-y-auto">
                                {searchResults.map((res, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => selectSearchResult(res)}
                                        className="w-full text-left px-3 py-2 hover:bg-white/10 text-xs border-b border-white/5 last:border-0 flex items-start gap-2 cursor-pointer transition-colors"
                                    >
                                        <FiMapPin className="text-blue-400 shrink-0 mt-0.5" />
                                        <span className="text-gray-300 truncate">{res.display_name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Map Picker Container */}
                    <div className="relative w-full h-[240px] rounded-xl overflow-hidden border border-white/10 shadow-inner bg-black/50">
                        <div ref={mapContainerRef} className="w-full h-full" />
                        <div className="absolute top-2 left-2 z-10 bg-black/80 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] text-gray-300 border border-white/10 flex items-center gap-1.5">
                            <FiInfo className="text-blue-400" />
                            <span>Click map or drag marker to set location</span>
                        </div>
                    </div>

                    {/* Coordinates Badge & Remove Pin Option */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-medium">Pinned Location:</span>
                        {lat && lng ? (
                            <div className="flex items-center gap-2">
                                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg font-mono font-bold flex items-center gap-1">
                                    <FiMapPin /> Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleClearPin}
                                    className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all font-semibold flex items-center gap-1 cursor-pointer text-xs"
                                    title="Remove location pin"
                                >
                                    <FiTrash2 /> Remove Pin
                                </button>
                            </div>
                        ) : (
                            <span className="text-amber-400 text-[11px] font-semibold flex items-center gap-1">
                                <FiAlertTriangle /> No coordinates set (click map above to pin)
                            </span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-white/[0.06]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs text-white/70 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 bg-white text-black font-bold rounded-xl text-xs hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-lg"
                        >
                            <FiCheck className="w-4 h-4" />
                            {isSubmitting ? 'Saving...' : 'Save Location & Address'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
