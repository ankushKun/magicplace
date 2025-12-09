import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { useMap, type PixelData } from '../hooks/use-map';
import { hexToUint32, uint32ToHex } from '../lib/colors';
import { latLonToGlobalPx, globalPxToLatLon } from '../lib/projection';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ShardGridOverlay } from './shard-grid-overlay';
import type { Map as LeafletMap } from 'leaflet';
import {
    PRESET_COLORS,
    TRANSPARENT_COLOR,
    DEFAULT_MAP_CENTER,
    DEFAULT_MAP_ZOOM,
    MIN_MAP_ZOOM,
    MAX_MAP_ZOOM,
    MAP_MOVE_THROTTLE_MS,
    PIXEL_SELECT_ZOOM,
} from '../constants';
import { WalletConnect } from './wallet-connect';
import { Button } from './ui/button';
import { Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePopSound } from '../hooks/use-pop-sound';

// Icons as inline SVGs
const PaintBrushIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
        <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </svg>
);

const GridIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
);

const ShareIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16,6 12,2 8,6" />
        <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
);

const ChevronIcon = ({ direction = 'down' }: { direction?: 'up' | 'down' }) => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-transform ${direction === 'up' ? 'rotate-180' : ''}`}
    >
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const CompassIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
    </svg>
);

// Component to handle map events
function MapEventsHandler({ onMapClick, onMapReady, onMoveEnd, onZoomEnd, onMouseMove, onMouseOut }: {
    onMapClick: (lat: number, lng: number) => void;
    onMapReady: (map: LeafletMap) => void;
    onMoveEnd: () => void;
    onZoomEnd?: () => void;
    onMouseMove?: (lat: number, lng: number) => void;
    onMouseOut?: () => void;
}) {
    const map = useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
        mousemove: (e) => {
            onMouseMove?.(e.latlng.lat, e.latlng.lng);
        },
        mouseout: () => {
            onMouseOut?.();
        },
        moveend: () => {
            onMoveEnd();
        },
        zoomend: () => {
            onZoomEnd?.();
        },
    });

    useEffect(() => {
        onMapReady(map);
    }, [map, onMapReady]);

    return null;
}

// LocalStorage key for persisting map view
const MAP_VIEW_STORAGE_KEY = 'magicplace-map-view';

interface SavedMapView {
    center: [number, number];
    zoom: number;
}

function getSavedMapView(): SavedMapView | null {
    try {
        const saved = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.center && typeof parsed.zoom === 'number') {
                return parsed;
            }
        }
    } catch (e) {
        // Ignore parsing errors
    }
    return null;
}

function saveMapView(center: [number, number], zoom: number) {
    try {
        localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify({ center, zoom }));
    } catch (e) {
        // Ignore storage errors
    }
}

function Color({color, selected, onClick}: {color: string, selected: boolean, onClick: () => void}) {
    return <Button className="w-full h-10" style={{backgroundColor: color}} onClick={onClick} variant={selected ? "default" : "outline"}></Button>
}

export function PixelCanvas() {
    const {
        mapRef,
        selectedPixel,
        hoveredPixel,
        placedPixelCount,
        localPixels,
        focusOnPixel,
        handleMapClick,
        handleMapHover,
        handleMapHoverOut,
        updateSelectedHighlightColor,
        initializeMap,
        updateMarker,
        removeMarker,
    } = useMap();

    // Load saved map view from localStorage
    const savedMapView = useMemo(() => getSavedMapView(), []);
    const initialCenter = savedMapView?.center ?? DEFAULT_MAP_CENTER;
    const initialZoom = savedMapView?.zoom ?? DEFAULT_MAP_ZOOM;

    const lastMoveTimeRef = useRef<number>(0);
    const throttledAction = useCallback(() => {
        const now = Date.now();
        if (now - lastMoveTimeRef.current < MAP_MOVE_THROTTLE_MS) return;
        lastMoveTimeRef.current = now;
        // Could add tile loading here if needed
    }, []);

    // Save map view to localStorage when it changes
    const saveCurrentMapView = useCallback(() => {
        if (mapRef.current) {
            const center = mapRef.current.getCenter();
            const zoom = mapRef.current.getZoom();
            saveMapView([center.lat, center.lng], zoom);
        }
    }, [mapRef]);

    const [selectedColor, setSelectedColor] = useState<string>(PRESET_COLORS[0]);
    const [showRecentPixels, setShowRecentPixels] = useState(true);
    const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
    const [currentZoom, setCurrentZoom] = useState(DEFAULT_MAP_ZOOM);
    const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
    const [showShardGrid, setShowShardGrid] = useState(false);
    const [shardsAggregated, setShardsAggregated] = useState(false);

    // Force crosshair cursor on map container
    useEffect(() => {
        if (mapRef.current) {
            const container = mapRef.current.getContainer();
            container.style.cursor = 'crosshair';
            // Also set on all child elements that Leaflet might override
            const style = document.createElement('style');
            style.textContent = `
                .leaflet-container, .leaflet-container * { cursor: crosshair !important; }
                .leaflet-grab { cursor: crosshair !important; }
                .leaflet-dragging .leaflet-grab { cursor: crosshair !important; }
            `;
            document.head.appendChild(style);
            return () => {
                document.head.removeChild(style);
            };
        }
    }, [mapRef.current]);

    // Update highlight color when selected color changes
    useEffect(() => {
        if (selectedPixel) {
            updateSelectedHighlightColor(selectedColor === TRANSPARENT_COLOR ? '#ffffff' : selectedColor);
        }
    }, [selectedColor, selectedPixel, updateSelectedHighlightColor]);

    // Pop sound for pixel placement
    const { playPop } = usePopSound();

    // Place pixel at coordinates
    const handlePlacePixelAt = useCallback((px: number, py: number) => {
        const isTransparent = selectedColor === TRANSPARENT_COLOR;
        // Transparent = 0 (unset), all other colors go through hexToUint32
        const color = isTransparent ? 0 : hexToUint32(selectedColor);

        if (isTransparent) {
            removeMarker(`${px},${py}`);
        } else {
            updateMarker(px, py, color);
        }
        
        // Play pop sound
        playPop();
    }, [selectedColor, updateMarker, removeMarker, playPop]);

    // Place pixel at selected location
    const handlePlacePixel = useCallback(() => {
        if (!selectedPixel) return;
        handlePlacePixelAt(selectedPixel.px, selectedPixel.py);
    }, [selectedPixel, handlePlacePixelAt]);

    // Instant place on map click when zoomed in
    const handleInstantMapClick = useCallback((lat: number, lng: number) => {
        const { px, py } = latLonToGlobalPx(lat, lng);

        // Check if we should instant place or just select
        const isZoomedIn = currentZoom >= PIXEL_SELECT_ZOOM;

        if (isZoomedIn) {
            // Instant place!
            handlePlacePixelAt(px, py);
        }

        // Always update selection
        handleMapClick(lat, lng, selectedColor === TRANSPARENT_COLOR ? '#ffffff' : selectedColor);
    }, [currentZoom, handlePlacePixelAt, handleMapClick, selectedColor]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'Enter' && selectedPixel) {
                e.preventDefault();
                handlePlacePixel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedPixel, handlePlacePixel]);

    // Copy share link
    const handleShare = useCallback(() => {
        if (!selectedPixel) {
            alert('Select a pixel first');
            return;
        }
        const shareUrl = `${window.location.origin}?px=${selectedPixel.px}&py=${selectedPixel.py}`;
        navigator.clipboard.writeText(shareUrl);
        alert('Link copied!');
    }, [selectedPixel]);

    return (
        <div className="h-screen w-screen overflow-hidden bg-slate-900 relative">
            {/* Full-screen Map */}
            <MapContainer
                center={initialCenter}
                zoom={initialZoom}
                minZoom={MIN_MAP_ZOOM}
                maxZoom={MAX_MAP_ZOOM}
                className="w-full h-full cursor-crosshair [&_.leaflet-grab]:cursor-crosshair [&_.leaflet-dragging]:cursor-crosshair"
                zoomControl={false}
                worldCopyJump={false}
                maxBounds={[[-90, -180], [90, 180]]}
                maxBoundsViscosity={1.0}
                attributionControl={false}
                scrollWheelZoom={true}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    noWrap={true}
                />
                <MapEventsHandler
                    onMapClick={handleInstantMapClick}
                    onMapReady={(map) => {
                        initializeMap(map);
                        setCurrentZoom(map.getZoom());
                    }}
                    onMoveEnd={() => {
                        throttledAction();
                        saveCurrentMapView();
                    }}
                    onZoomEnd={() => {
                        throttledAction();
                        saveCurrentMapView();
                        if (mapRef.current) {
                            setCurrentZoom(mapRef.current.getZoom());
                        }
                    }}
                    onMouseMove={(lat, lng) => handleMapHover(lat, lng, selectedColor === TRANSPARENT_COLOR ? '#ffffff' : selectedColor)}
                    onMouseOut={handleMapHoverOut}
                />
                <ShardGridOverlay 
                    visible={showShardGrid} 
                    onAggregatedChange={setShardsAggregated}
                />
            </MapContainer>

            {/* Shard Grid Zoom Hint */}
            {showShardGrid && shardsAggregated && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
                    <div className="bg-blue-500/95 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            <line x1="11" y1="8" x2="11" y2="14"/>
                            <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                        <span>Zoom in to see individual shards</span>
                    </div>
                </div>
            )}

            {/* Top Left - Zoom Controls */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-40">
                <button
                    onClick={() => mapRef.current?.zoomIn()}
                    className="w-8 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors font-bold text-lg"
                >
                    +
                </button>
                <button
                    onClick={() => mapRef.current?.zoomOut()}
                    className="w-8 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors font-bold text-lg"
                >
                    −
                </button>
                <button
                    onClick={() => {
                        if (localPixels.length > 0 && mapRef.current) {
                            const bounds = mapRef.current.getBounds();

                            // Filter placed pixels that are NOT in the current view
                            const pixelsOutsideView = localPixels.filter(pixel => {
                                const { lat, lon } = globalPxToLatLon(pixel.px, pixel.py);
                                return !bounds.contains([lat, lon]);
                            });

                            // Pick from pixels outside view, or any pixel if all are visible
                            const targetPixels = pixelsOutsideView.length > 0 ? pixelsOutsideView : localPixels;
                            const randomPixel = targetPixels[Math.floor(Math.random() * targetPixels.length)];
                            if(!randomPixel) return;
                            focusOnPixel(randomPixel.px, randomPixel.py);
                        } else if (localPixels.length === 0) {
                            alert('No pixels placed yet. Be the first to place a pixel!');
                        }
                    }}
                    className="w-8 h-8 bg-white rounded-lg shadow-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors"
                    title="Explore placed pixels"
                >
                    <CompassIcon />
                </button>
                <button
                    onClick={() => setShowShardGrid(!showShardGrid)}
                    className={`w-8 h-8 rounded-lg shadow-lg flex items-center justify-center transition-colors ${
                        showShardGrid 
                            ? 'bg-blue-500 text-white hover:bg-blue-600' 
                            : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    title="Toggle shard grid"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="3" y1="15" x2="21" y2="15" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                        <line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                </button>
            </div>

            {/* Top Right - Info */}
            <div className="absolute top-4 right-4 flex items-center gap-3 z-40">

                {/* Pixels Count - Toggle for Recent Pixels */}
                <button
                    onClick={() => setShowRecentPixels(!showRecentPixels)}
                    className={`backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 transition-colors ${showRecentPixels
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-white/90 text-slate-700 hover:bg-white'
                        }`}
                    title="Toggle recent pixels"
                >
                    <GridIcon />
                    <span>{placedPixelCount.toLocaleString()}</span>
                </button>

                <WalletConnect onMenuOpenChange={setIsWalletMenuOpen} />
            </div>

            {/* Recent Pixels Panel */}
            {showRecentPixels && !isWalletMenuOpen && (
                <div className="absolute top-16 right-4 w-72 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl z-40 max-h-96 overflow-hidden">
                    <div className="p-3 border-b border-slate-200 font-semibold text-slate-700 flex items-center justify-between">
                        <span>Recent Pixels</span>
                        <button onClick={() => setShowRecentPixels(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <div className="overflow-y-auto max-h-80">
                        {localPixels.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-sm">
                                No pixels placed yet. Click on the map to start painting!
                            </div>
                        ) : (
                            localPixels.slice(0, 20).map((pixel) => {
                                const isTransparent = pixel.color === 0;
                                return (
                                    <div
                                        key={`${pixel.px}-${pixel.py}-${pixel.timestamp}`}
                                        className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3 border-b border-slate-100 last:border-0"
                                        onClick={() => {
                                            focusOnPixel(pixel.px, pixel.py);
                                        }}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-lg shadow-inner border border-slate-200"
                                            style={isTransparent ? {
                                                backgroundImage: `
                          linear-gradient(45deg, #ccc 25%, transparent 25%),
                          linear-gradient(-45deg, #ccc 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #ccc 75%),
                          linear-gradient(-45deg, transparent 75%, #ccc 75%)
                        `,
                                                backgroundSize: '8px 8px',
                                                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                                                backgroundColor: '#fff'
                                            } : { backgroundColor: uint32ToHex(pixel.color) }}
                                        />
                                        <div>
                                            <div className="text-sm font-medium text-slate-700">
                                                ({pixel.px}, {pixel.py})
                                                {isTransparent && <span className="text-slate-400 ml-1 text-xs">(erased)</span>}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                Local pixel
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Bottom Toolbar */}
            <div className="absolute bottom-0 left-0 right-0 z-40 p-4">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                        {/* Toolbar Header */}
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between w-full">
                            <div className="flex items-center gap-3 w-full">
                                <button
                                    onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
                                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
                                >
                                    <ChevronIcon direction={isToolbarExpanded ? 'down' : 'up'} />
                                </button>
                                <div className="flex items-center gap-2 text-slate-700 font-medium">
                                    <PaintBrushIcon />
                                    <span>Paint pixel</span>
                                    {(hoveredPixel || selectedPixel) && (
                                        <span className="text-slate-400 text-sm font-mono">
                                            ({(hoveredPixel || selectedPixel)!.px}, {(hoveredPixel || selectedPixel)!.py})
                                        </span>
                                    )}
                                </div>
                                <div className='grow'/>
                                <Button variant={"ghost"} size={"icon"} className={cn("", selectedColor === TRANSPARENT_COLOR && "bg-slate-100")} onClick={() => setSelectedColor(TRANSPARENT_COLOR)}>
                                    <Eraser/>
                                </Button>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Share Button */}
                                <button
                                    onClick={handleShare}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Share location"
                                >
                                    <ShareIcon />
                                </button>
                            </div>
                        </div>

                        {/* Color Palette */}
                        {isToolbarExpanded && (
                            <div className="p-4">
                                {/* Two rows of 16 colors each */}
                                <div className="grid grid-cols-16 gap-1.5 mb-4">
                                    {
                                        PRESET_COLORS.map((color) => {
                                            return <Color key={color} color={color} selected={selectedColor === color} onClick={() => setSelectedColor(color)}/>
                                        })
                                    }
                                </div>
                            </div>
                        )}

                        {/* Paint Button */}
                        <div className="px-4 pb-4">
                            <button
                                onClick={handlePlacePixel}
                                disabled={!selectedPixel}
                                className="w-full relative overflow-hidden bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-[0.99]"
                            >
                                <div className="relative flex items-center justify-center gap-3">
                                    <PaintBrushIcon />
                                    <span>
                                        {!selectedPixel ? 'Select a pixel' : 'Paint'}
                                    </span>
                                </div>
                            </button>

                            {/* Help text */}
                            <div className="mt-2 text-center text-xs text-slate-400">
                                {currentZoom >= PIXEL_SELECT_ZOOM ? (
                                    <span className="text-emerald-500">Click to paint instantly!</span>
                                ) : (
                                    <span>Zoom in to paint on click</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Debug Panel - only visible in development */}
            {import.meta.env.DEV && (
                <div className="absolute bottom-4 left-4 z-50 bg-black/80 text-white text-xs font-mono px-3 py-2 rounded-lg">
                    <div>Zoom: {currentZoom.toFixed(1)}</div>
                </div>
            )}
        </div>
    );
}

export default PixelCanvas;
