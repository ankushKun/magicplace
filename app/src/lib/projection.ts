// Web Mercator projection utilities for global pixel canvas
import { CANVAS_RES, TILE_SIZE, MAX_LATITUDE } from '../constants';

// Re-export constants for backwards compatibility
export { CANVAS_RES, TILE_SIZE, MAX_LATITUDE as MAX_LAT };

/**
 * Clamp latitude to valid Web Mercator range
 */
export function clampLat(lat: number): number {
    return Math.max(Math.min(lat, MAX_LATITUDE), -MAX_LATITUDE);
}

/**
 * Convert lat/lon to normalized Mercator coordinates (0..1)
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @returns Normalized x, y in [0, 1] range
 */
export function llToMercator(lat: number, lon: number): { x: number; y: number } {
    lat = clampLat(lat);
    const x = (lon + 180) / 360;
    const latRad = (lat * Math.PI) / 180;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
    return { x, y };
}

/**
 * Convert normalized Mercator coordinates back to lat/lon
 * @param x Normalized x coordinate (0..1)
 * @param y Normalized y coordinate (0..1)
 * @returns Latitude and longitude in degrees
 */
export function mercatorToLL(x: number, y: number): { lat: number; lon: number } {
    const lon = x * 360 - 180;
    const n = Math.PI - 2 * Math.PI * y;
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat, lon };
}

/**
 * Convert normalized Mercator coordinates to global pixel coordinates
 * @param x Normalized x (0..1)
 * @param y Normalized y (0..1)
 * @param canvasRes Canvas resolution (default: CANVAS_RES)
 * @returns Global pixel coordinates
 */
export function mercatorToGlobalPx(
    x: number,
    y: number,
    canvasRes: number = CANVAS_RES
): { px: number; py: number } {
    return {
        px: Math.floor(x * canvasRes),
        py: Math.floor(y * canvasRes),
    };
}

/**
 * Convert lat/lon directly to global pixel coordinates
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param canvasRes Canvas resolution (default: CANVAS_RES)
 * @returns Global pixel coordinates
 */
export function latLonToGlobalPx(
    lat: number,
    lon: number,
    canvasRes: number = CANVAS_RES
): { px: number; py: number } {
    const { x, y } = llToMercator(lat, lon);
    return mercatorToGlobalPx(x, y, canvasRes);
}

/**
 * Convert global pixel coordinates back to lat/lon
 * @param px Global x pixel coordinate
 * @param py Global y pixel coordinate
 * @param canvasRes Canvas resolution (default: CANVAS_RES)
 * @returns Latitude and longitude in degrees
 */
export function globalPxToLatLon(
    px: number,
    py: number,
    canvasRes: number = CANVAS_RES
): { lat: number; lon: number } {
    const x = px / canvasRes;
    const y = py / canvasRes;
    return mercatorToLL(x, y);
}

/**
 * Get tile coordinates for a global pixel
 * @param px Global x pixel coordinate
 * @param py Global y pixel coordinate
 * @param tileSize Tile size (default: TILE_SIZE)
 * @returns Tile coordinates and local pixel within tile
 */
export function getTileCoords(
    px: number,
    py: number,
    tileSize: number = TILE_SIZE
): {
    tileX: number;
    tileY: number;
    localX: number;
    localY: number;
} {
    const tileX = Math.floor(px / tileSize);
    const tileY = Math.floor(py / tileSize);
    const localX = px % tileSize;
    const localY = py % tileSize;
    return { tileX, tileY, localX, localY };
}

/**
 * Get global pixel coordinates from tile coordinates and local position
 * @param tileX Tile x coordinate
 * @param tileY Tile y coordinate
 * @param localX Local x within tile
 * @param localY Local y within tile
 * @param tileSize Tile size (default: TILE_SIZE)
 * @returns Global pixel coordinates
 */
export function tileToGlobalPx(
    tileX: number,
    tileY: number,
    localX: number,
    localY: number,
    tileSize: number = TILE_SIZE
): { px: number; py: number } {
    return {
        px: tileX * tileSize + localX,
        py: tileY * tileSize + localY,
    };
}

/**
 * Get all tiles that intersect with a lat/lon bounding box
 * @param bounds Leaflet LatLngBounds or similar
 * @param tileSize Tile size (default: TILE_SIZE)
 * @returns Array of tile coordinates
 */
export function getTilesInBounds(
    bounds: { north: number; south: number; east: number; west: number },
    tileSize: number = TILE_SIZE
): Array<{ tileX: number; tileY: number }> {
    const { px: minPx, py: minPy } = latLonToGlobalPx(bounds.north, bounds.west);
    const { px: maxPx, py: maxPy } = latLonToGlobalPx(bounds.south, bounds.east);

    const startTileX = Math.floor(minPx / tileSize);
    const endTileX = Math.floor(maxPx / tileSize);
    const startTileY = Math.floor(minPy / tileSize);
    const endTileY = Math.floor(maxPy / tileSize);

    const tiles: Array<{ tileX: number; tileY: number }> = [];
    for (let ty = startTileY; ty <= endTileY; ty++) {
        for (let tx = startTileX; tx <= endTileX; tx++) {
            tiles.push({ tileX: tx, tileY: ty });
        }
    }

    return tiles;
}

/**
 * Calculate the appropriate zoom level based on map zoom
 * For now, we use a single zoom level (0) since CANVAS_RES is fixed
 * @param mapZoom Leaflet map zoom level
 * @returns Canvas zoom level (always 0 for single-resolution canvas)
 */
export function getCanvasZoom(mapZoom: number): number {
    // With a fixed CANVAS_RES, we don't need multiple zoom levels
    // All pixels are at zoom level 0
    return 0;
}
