'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import toast from 'react-hot-toast';
import { FiMapPin, FiHome, FiZap, FiCrosshair, FiSearch, FiCheck, FiX } from 'react-icons/fi';

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

export default function DeliveryRouteMap({
    depotLocation = { lat: 6.9271, lng: 79.8612, name: 'Colombo Factory Depot' },
    stops = [],
    selectedStopId = null,
    onStopSelect = () => {},
    onLocationUpdate = () => {},
    onDepotLocationUpdate = () => {},
    onRouteCalculated = () => {},
    pinModeStop = null,
    setPinModeStop = () => {},
    onFetchAllLocations = () => {}
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const searchMarkerRef = useRef(null);

    const [mapIsLoaded, setMapIsLoaded] = useState(false);
    const [pinModeDepot, setPinModeDepot] = useState(false);
    const [isLocatingGPS, setIsLocatingGPS] = useState(false);

    // Map Search Location States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchMenu, setShowSearchMenu] = useState(false);
    const [activeSearchLocation, setActiveSearchLocation] = useState(null);

    // Prev Stats Ref to prevent infinite update depth loop
    const prevStatsRef = useRef({ distanceKm: null, durationMins: null });

    const emitRouteCalculated = useCallback((newStats) => {
        if (
            prevStatsRef.current.distanceKm !== newStats.distanceKm ||
            prevStatsRef.current.durationMins !== newStats.durationMins
        ) {
            prevStatsRef.current = newStats;
            onRouteCalculated(newStats);
        }
    }, [onRouteCalculated]);

    // Initialize MapLibre GL Map
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: DARK_MAP_STYLE,
            center: [depotLocation.lng || 79.8612, depotLocation.lat || 6.9271],
            zoom: 11
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
            setMapIsLoaded(true);
        });

        // ResizeObserver to handle container resizing
        const resizeObserver = new ResizeObserver(() => {
            map.resize();
        });
        resizeObserver.observe(mapContainerRef.current);

        mapRef.current = map;

        return () => {
            resizeObserver.disconnect();
            map.remove();
        };
    }, []);

    // Handle Map Click for Pinning Locations
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const handleMapClick = (e) => {
            const lat = parseFloat(e.lngLat.lat.toFixed(6));
            const lng = parseFloat(e.lngLat.lng.toFixed(6));

            if (pinModeDepot) {
                onDepotLocationUpdate({ lat, lng, name: depotLocation.name || 'Factory Depot' });
                setPinModeDepot(false);
                toast.success(`Factory Depot location updated to [${lat}, ${lng}]`);
            } else if (pinModeStop) {
                onLocationUpdate(pinModeStop.id, lat, lng);
                setPinModeStop(null);
                toast.success(`Location set for ${pinModeStop.customer_name}`);
            }
        };

        map.on('click', handleMapClick);
        return () => {
            map.off('click', handleMapClick);
        };
    }, [pinModeDepot, pinModeStop, depotLocation.name, onDepotLocationUpdate, onLocationUpdate, setPinModeStop]);

    // Update cursor style when pin modes are active
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (pinModeDepot || pinModeStop) {
            map.getCanvas().style.cursor = 'crosshair';
        } else {
            map.getCanvas().style.cursor = '';
        }
    }, [pinModeDepot, pinModeStop]);

    // Perform Address Search via Geocoding API
    const handleSearchLocations = async (query) => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowSearchMenu(false);
            return;
        }

        setIsSearching(true);
        setShowSearchMenu(true);
        try {
            const res = await fetch(`/api/deliveries/route-planner/geocode?q=${encodeURIComponent(query)}&limit=5`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(Array.isArray(data) ? data : (data.results || []));
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            console.error('Search location error:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Fly to Selected Search Location
    const handleSelectSearchLocation = (item) => {
        const map = mapRef.current;
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng);

        if (!map || isNaN(lat) || isNaN(lng)) return;

        setActiveSearchLocation({ lat, lng, display_name: item.display_name });
        setShowSearchMenu(false);

        // Fly smoothly to location
        map.flyTo({ center: [lng, lat], zoom: 14, speed: 1.2 });

        // Add visual search marker
        if (searchMarkerRef.current) {
            searchMarkerRef.current.remove();
        }

        const el = document.createElement('div');
        el.className = 'cursor-pointer';
        el.innerHTML = '<div class="w-7 h-7 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-white shadow-2xl animate-pulse transition-transform duration-200 hover:scale-125">📍</div>';

        searchMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);

        toast.success(`Map centered to ${item.display_name.split(',')[0]}`);
    };

    // Clear search marker
    const handleClearSearchMarker = () => {
        if (searchMarkerRef.current) {
            searchMarkerRef.current.remove();
            searchMarkerRef.current = null;
        }
        setActiveSearchLocation(null);
        setSearchQuery('');
    };

    // Render Markers & Calculate Driving Route (OSRM)
    const updateMapRouteAndMarkers = useCallback(async () => {
        const map = mapRef.current;
        if (!map || !mapIsLoaded) return;

        // Clear existing markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        // 1. Factory Depot Marker (Green)
        const depotEl = document.createElement('div');
        depotEl.className = 'cursor-grab';
        depotEl.title = depotLocation.name || 'Factory Depot (Drag to adjust)';
        depotEl.innerHTML = `
            <div class="w-9 h-9 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center text-white shadow-xl transition-transform duration-200 hover:scale-125">
                <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 00-1 1m-6 0h6"/>
                </svg>
            </div>
        `;

        const depotMarker = new maplibregl.Marker({ element: depotEl, draggable: true })
            .setLngLat([depotLocation.lng, depotLocation.lat])
            .addTo(map);

        depotMarker.on('dragend', () => {
            const lngLat = depotMarker.getLngLat();
            const lat = parseFloat(lngLat.lat.toFixed(6));
            const lng = parseFloat(lngLat.lng.toFixed(6));
            onDepotLocationUpdate({ lat, lng, name: depotLocation.name || 'Colombo Factory Depot' });
            toast.success(`Factory Depot moved to [${lat}, ${lng}]`);
        });

        markersRef.current.push(depotMarker);

        // 2. Delivery Stops Markers (Blue/Amber)
        const stopsWithCoords = stops.map(s => {
            const rawLat = s.latitude !== undefined && s.latitude !== null ? s.latitude : s.lat;
            const rawLng = s.longitude !== undefined && s.longitude !== null ? s.longitude : s.lng;
            return {
                ...s,
                latitude: (rawLat !== null && rawLat !== undefined) ? parseFloat(rawLat) : null,
                longitude: (rawLng !== null && rawLng !== undefined) ? parseFloat(rawLng) : null
            };
        }).filter(s => s.latitude !== null && !isNaN(s.latitude) && s.longitude !== null && !isNaN(s.longitude));

        stopsWithCoords.forEach((stop, idx) => {
            const isSelected = selectedStopId === stop.id;
            const stopEl = document.createElement('div');
            stopEl.className = 'cursor-grab';
            stopEl.title = `${stop.customer_name} (${stop.sales_order_code}) - Drag to move`;
            stopEl.innerHTML = `
                <div class="w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center text-white border-2 border-white shadow-lg transition-transform duration-200 hover:scale-125 ${
                    isSelected ? 'bg-amber-500 ring-4 ring-amber-500/30' : 'bg-blue-600'
                }">${idx + 1}</div>
            `;

            stopEl.addEventListener('click', (e) => {
                e.stopPropagation();
                onStopSelect(stop);
            });

            const stopMarker = new maplibregl.Marker({ element: stopEl, draggable: true })
                .setLngLat([stop.longitude, stop.latitude])
                .addTo(map);

            stopMarker.on('dragend', () => {
                const lngLat = stopMarker.getLngLat();
                const lat = parseFloat(lngLat.lat.toFixed(6));
                const lng = parseFloat(lngLat.lng.toFixed(6));
                onLocationUpdate(stop.id, lat, lng);
                toast.success(`Updated location for ${stop.customer_name}`);
            });

            markersRef.current.push(stopMarker);
        });

        // 3. Ensure Route Source & Layers exist on Map
        if (!map.getSource('route')) {
            map.addSource('route', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            map.addLayer({
                id: 'route-line-casing',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#064e3b',
                    'line-width': 11,
                    'line-opacity': 0.7
                }
            });

            map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#10b981',
                    'line-width': 6,
                    'line-opacity': 1.0
                }
            });
        }

        if (stopsWithCoords.length === 0) {
            map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
            emitRouteCalculated({ distanceKm: '0.0', durationMins: 0 });
            return;
        }

        const depotLat = parseFloat(depotLocation?.lat) || 6.9271;
        const depotLng = parseFloat(depotLocation?.lng) || 79.8612;

        const coordinates = [
            `${depotLng},${depotLat}`,
            ...stopsWithCoords.map(s => `${s.longitude},${s.latitude}`)
        ].join(';');

        try {
            const res = await fetch(`/api/deliveries/route-planner/osrm?coords=${encodeURIComponent(coordinates)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.geometry) {
                    const geojson = {
                        type: 'FeatureCollection',
                        features: [
                            {
                                type: 'Feature',
                                properties: {},
                                geometry: data.geometry
                            }
                        ]
                    };

                    if (map.getSource('route')) {
                        map.getSource('route').setData(geojson);
                    }

                    // Fit map bounds to encompass all stops and depot
                    try {
                        const bounds = new maplibregl.LngLatBounds();
                        bounds.extend([depotLng, depotLat]);
                        stopsWithCoords.forEach(s => bounds.extend([s.longitude, s.latitude]));
                        map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
                    } catch (boundsErr) {
                        console.warn('Could not fit bounds:', boundsErr);
                    }

                    emitRouteCalculated({
                        distanceKm: (data.distanceMeters / 1000).toFixed(1),
                        durationMins: Math.round(data.durationSeconds / 60)
                    });
                }
            }
        } catch (error) {
            console.error('OSRM route fetch error:', error);
        }
    }, [mapIsLoaded, depotLocation, stops, selectedStopId, onStopSelect, emitRouteCalculated, onDepotLocationUpdate, onLocationUpdate]);

    useEffect(() => {
        updateMapRouteAndMarkers();
    }, [updateMapRouteAndMarkers]);

    // Handle User Geolocation in Planner
    const handleGetUserLocationInPlanner = () => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setIsLocatingGPS(true);
        const loadToast = toast.loading('Detecting your current GPS location...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = parseFloat(position.coords.latitude.toFixed(6));
                const userLng = parseFloat(position.coords.longitude.toFixed(6));
                setIsLocatingGPS(false);

                if (mapRef.current) {
                    mapRef.current.flyTo({
                        center: [userLng, userLat],
                        zoom: 15,
                        speed: 1.2
                    });
                }

                onDepotLocationUpdate({
                    lat: userLat,
                    lng: userLng,
                    name: 'My Current Location (Factory)'
                });

                toast.success(`Set Factory Depot to your current GPS position [${userLat.toFixed(4)}, ${userLng.toFixed(4)}]`, { id: loadToast });
            },
            (error) => {
                setIsLocatingGPS(false);
                console.error('Geolocation error:', error);
                toast.error(`Could not detect location: ${error.message}`, { id: loadToast });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    return (
        <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/40">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Top Toolbar Overlay */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 items-center">
                {/* Location Search Input */}
                <div className="relative min-w-[240px]">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                handleSearchLocations(e.target.value);
                            }}
                            onFocus={() => {
                                if (searchResults.length > 0) setShowSearchMenu(true);
                            }}
                            placeholder="Search location/address on map..."
                            className="w-full bg-black/80 backdrop-blur-md border border-white/20 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white outline-none focus:border-blue-400 font-medium shadow-xl"
                        />
                        <FiSearch className="absolute left-2.5 top-2.5 text-gray-400 w-3.5 h-3.5" />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={handleClearSearchMarker}
                                className="absolute right-2.5 top-2 text-gray-400 hover:text-white text-xs"
                            >
                                <FiX className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Search Suggestions Dropdown */}
                    {showSearchMenu && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d0d0d] border border-white/15 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto divide-y divide-white/5">
                            {isSearching ? (
                                <div className="p-2.5 text-center text-xs text-gray-400">Searching OpenStreetMap...</div>
                            ) : searchResults.length === 0 ? (
                                <div className="p-2.5 text-center text-xs text-gray-500">No matching places found</div>
                            ) : (
                                searchResults.map((item, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleSelectSearchLocation(item)}
                                        className="w-full text-left p-2 hover:bg-blue-600/20 text-xs text-gray-200 hover:text-white transition-colors truncate cursor-pointer"
                                    >
                                        📍 {item.display_name}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <button
                    onClick={() => {
                        setPinModeDepot(prev => !prev);
                        setPinModeStop(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg backdrop-blur-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                        pinModeDepot
                            ? 'bg-emerald-500 text-black border-white animate-pulse'
                            : 'bg-black/70 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                >
                    <FiHome />
                    {pinModeDepot ? 'Click Map to Set Factory' : 'Pin Factory Location'}
                </button>

                <button
                    onClick={handleGetUserLocationInPlanner}
                    disabled={isLocatingGPS}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg backdrop-blur-md bg-black/70 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                    <FiCrosshair className={isLocatingGPS ? 'animate-spin' : ''} />
                    {isLocatingGPS ? 'Locating...' : 'Use My GPS Location'}
                </button>

                <button
                    onClick={onFetchAllLocations}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg backdrop-blur-md bg-black/70 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                    <FiZap className="text-blue-400" />
                    Fetch All Delivery Locations
                </button>
            </div>

            {/* Active Search Result Banner */}
            {activeSearchLocation && (
                <div className="absolute top-16 left-4 z-10 bg-purple-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2">
                    <FiMapPin />
                    <span className="max-w-[280px] truncate">{activeSearchLocation.display_name}</span>
                    <button
                        onClick={() => {
                            onDepotLocationUpdate({
                                lat: activeSearchLocation.lat,
                                lng: activeSearchLocation.lng,
                                name: activeSearchLocation.display_name.split(',')[0]
                            });
                            toast.success('Set Factory Depot to searched location');
                        }}
                        className="bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded text-[10px] uppercase font-extrabold cursor-pointer shrink-0"
                    >
                        Set Factory Here
                    </button>
                </div>
            )}

            {/* Pin Mode Active Notification Banners */}
            {pinModeDepot && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-emerald-500 text-black px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
                    <FiHome />
                    <span>Click anywhere on the map to pin Factory Depot location</span>
                    <button
                        onClick={() => setPinModeDepot(false)}
                        className="bg-black/20 hover:bg-black/40 text-black px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {pinModeStop && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-amber-500 text-black px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
                    <FiMapPin />
                    <span>Click anywhere on the map to set location for <strong>{pinModeStop.customer_name}</strong></span>
                    <button
                        onClick={() => setPinModeStop(null)}
                        className="bg-black/20 hover:bg-black/40 text-black px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold cursor-pointer"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Quick Map Legend */}
            <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl text-[11px] text-gray-300 flex items-center gap-4 shadow-lg flex-wrap">
                <div className="flex items-center gap-1.5">
                    <FiHome className="text-emerald-400" />
                    <span>Factory (Draggable)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-600 border border-white flex items-center justify-center text-[10px] font-bold text-white">1</span>
                    <span>Stops (Draggable)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-6 h-1 bg-blue-500 rounded" />
                    <span>OSRM Driving Route</span>
                </div>
            </div>
        </div>
    );
}
