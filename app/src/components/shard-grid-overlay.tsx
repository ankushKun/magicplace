import { useEffect, useRef, useState } from 'react';
import { useMap as useLeafletMap } from 'react-leaflet';
import * as L from 'leaflet';
import { SHARD_DIMENSION, SHARDS_PER_DIM, CANVAS_RES } from '../constants';
import { globalPxToLatLon } from '../lib/projection';

interface ShardGridOverlayProps {
    visible: boolean;
    onAggregatedChange?: (isAggregated: boolean) => void;
}

/**
 * Renders a visual overlay showing the shard grid boundaries on the map.
 * Each shard is 1024×1024 pixels, with 256 shards per dimension.
 */
export function ShardGridOverlay({ visible, onAggregatedChange }: ShardGridOverlayProps) {
    const map = useLeafletMap();
    const gridLayerRef = useRef<L.LayerGroup | null>(null);
    const labelsLayerRef = useRef<L.LayerGroup | null>(null);
    const [visibleShards, setVisibleShards] = useState<{ x: number; y: number }[]>([]);

    // Create the grid layer once
    useEffect(() => {
        if (!gridLayerRef.current) {
            gridLayerRef.current = L.layerGroup();
        }
        if (!labelsLayerRef.current) {
            labelsLayerRef.current = L.layerGroup();
        }

        return () => {
            if (gridLayerRef.current) {
                gridLayerRef.current.clearLayers();
                map.removeLayer(gridLayerRef.current);
            }
            if (labelsLayerRef.current) {
                labelsLayerRef.current.clearLayers();
                map.removeLayer(labelsLayerRef.current);
            }
        };
    }, [map]);

    // Toggle visibility
    useEffect(() => {
        if (!gridLayerRef.current || !labelsLayerRef.current) return;

        if (visible) {
            gridLayerRef.current.addTo(map);
            labelsLayerRef.current.addTo(map);
        } else {
            map.removeLayer(gridLayerRef.current);
            map.removeLayer(labelsLayerRef.current);
        }
    }, [visible, map]);

    // Update grid based on map view
    useEffect(() => {
        if (!visible) return;

        const updateGrid = () => {
            if (!gridLayerRef.current || !labelsLayerRef.current) return;

            const bounds = map.getBounds();
            const zoom = map.getZoom();

            // Clear existing layers
            gridLayerRef.current.clearLayers();
            labelsLayerRef.current.clearLayers();

            // Convert bounds to pixel coordinates
            const nw = bounds.getNorthWest();
            const se = bounds.getSouthEast();

            // Simple approach: calculate shard range based on lat/lon to pixel conversion
            // We'll use a coarse estimation for visible shards

            // Get pixel bounds (approximately)
            const pxNW = latLonToShardCoords(nw.lat, nw.lng);
            const pxSE = latLonToShardCoords(se.lat, se.lng);

            const minShardX = Math.max(0, Math.floor(pxNW.shardX));
            const maxShardX = Math.min(SHARDS_PER_DIM - 1, Math.ceil(pxSE.shardX));
            const minShardY = Math.max(0, Math.floor(pxNW.shardY));
            const maxShardY = Math.min(SHARDS_PER_DIM - 1, Math.ceil(pxSE.shardY));

            // Only show individual shards when zoomed in enough
            // With 128×128 shards (2048 per dimension), we need high zoom to see them
            const isZoomedInEnough = zoom >= 10;
            
            // Notify parent about aggregation state
            onAggregatedChange?.(!isZoomedInEnough);
            
            // Don't draw grid when not zoomed in enough
            if (!isZoomedInEnough) {
                setVisibleShards([]);
                return;
            }
            
            // Limit visible shards for performance - step calculation removed, strict zoom threshold used
            const step = 1;

            const newVisibleShards: { x: number; y: number }[] = [];

            // Draw shard boundaries
            for (let sy = minShardY; sy <= maxShardY; sy += step) {
                for (let sx = minShardX; sx <= maxShardX; sx += step) {
                    newVisibleShards.push({ x: sx, y: sy });

                    // Calculate shard bounds in lat/lon
                    const px1 = sx * SHARD_DIMENSION;
                    const py1 = sy * SHARD_DIMENSION;
                    const px2 = Math.min((sx + step) * SHARD_DIMENSION, CANVAS_RES);
                    const py2 = Math.min((sy + step) * SHARD_DIMENSION, CANVAS_RES);

                    const { lat: lat1, lon: lon1 } = globalPxToLatLon(px1, py1);
                    const { lat: lat2, lon: lon2 } = globalPxToLatLon(px2, py2);

                    // Draw rectangle for shard
                    const rect = L.rectangle(
                        [
                            [Math.min(lat1, lat2), Math.min(lon1, lon2)],
                            [Math.max(lat1, lat2), Math.max(lon1, lon2)],
                        ],
                        {
                            color: '#3b82f6',
                            weight: zoom >= 10 ? 2 : 1,
                            opacity: 0.6,
                            fillColor: '#3b82f6',
                            fillOpacity: 0.05,
                            interactive: false,
                        }
                    );
                    gridLayerRef.current!.addLayer(rect);

                    // Add label if zoomed in enough
                    if (zoom >= 8 && step === 1) {
                        const centerLat = (lat1 + lat2) / 2;
                        const centerLon = (lon1 + lon2) / 2;

                        const label = L.divIcon({
                            html: `<div class="shard-label" style="
                                background: rgba(59, 130, 246, 0.9);
                                color: white;
                                padding: 2px 6px;
                                border-radius: 4px;
                                font-size: 10px;
                                font-weight: 600;
                                white-space: nowrap;
                                font-family: monospace;
                                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                            ">(${sx}, ${sy})</div>`,
                            className: 'shard-label-container',
                            iconSize: [60, 20],
                            iconAnchor: [30, 10],
                        });

                        const marker = L.marker([centerLat, centerLon], {
                            icon: label,
                            interactive: false,
                        });
                        labelsLayerRef.current!.addLayer(marker);
                    }
                }
            }

            setVisibleShards(newVisibleShards);
        };

        // Initial update
        updateGrid();

        // Update on map move/zoom
        map.on('moveend', updateGrid);
        map.on('zoomend', updateGrid);

        return () => {
            map.off('moveend', updateGrid);
            map.off('zoomend', updateGrid);
        };
    }, [visible, map]);

    return null;
}

/**
 * Convert lat/lon to shard coordinates
 */
function latLonToShardCoords(lat: number, lon: number): { shardX: number; shardY: number } {
    // Use Mercator projection to get pixel coordinates
    const x = (lon + 180) / 360;
    const latRad = (lat * Math.PI) / 180;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;

    const px = x * CANVAS_RES;
    const py = y * CANVAS_RES;

    return {
        shardX: px / SHARD_DIMENSION,
        shardY: py / SHARD_DIMENSION,
    };
}

export default ShardGridOverlay;
