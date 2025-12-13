/**
 * Server-side reverse geocoding with persistent database cache
 * Uses the same logic as the frontend but stores cache in SQLite
 */

import db from "./db";
import { globalPxToLatLon } from "../lib/projection";

// Grid precision for caching (in degrees)
const LAND_GRID_PRECISION = 0.1;  // ~11km at equator
const OCEAN_GRID_PRECISION = 1.0; // ~111km at equator

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds

interface NominatimResponse {
    address?: {
        city?: string;
        town?: string;
        village?: string;
        hamlet?: string;
        municipality?: string;
        county?: string;
        state?: string;
        country?: string;
        ocean?: string;
        sea?: string;
        bay?: string;
        water?: string;
    };
    display_name?: string;
    name?: string;
    type?: string;
    error?: string;
}

/**
 * Get grid-based cache key
 */
function getGridKey(lat: number, lon: number, precision: number = LAND_GRID_PRECISION): string {
    const gridLat = Math.round(lat / precision) * precision;
    const gridLon = Math.round(lon / precision) * precision;
    return `${gridLat.toFixed(2)},${gridLon.toFixed(2)}`;
}

/**
 * Get all nearby grid keys (current + 8 surrounding)
 */
function getNearbyGridKeys(lat: number, lon: number, precision: number = LAND_GRID_PRECISION): string[] {
    const keys: string[] = [];
    const offsets = [-precision, 0, precision];
    
    for (const latOffset of offsets) {
        for (const lonOffset of offsets) {
            const gridLat = Math.round((lat + latOffset) / precision) * precision;
            const gridLon = Math.round((lon + lonOffset) / precision) * precision;
            keys.push(`${gridLat.toFixed(2)},${gridLon.toFixed(2)}`);
        }
    }
    
    return keys;
}

/**
 * Check database cache for nearby location
 */
function findCachedLocation(lat: number, lon: number): string | null {
    // Check exact grid cell first
    const exactKey = getGridKey(lat, lon);
    const exact = db.prepare('SELECT location_name FROM location_cache WHERE grid_key = ?').get(exactKey) as { location_name: string } | undefined;
    if (exact) {
        return exact.location_name;
    }
    
    // Check nearby grid cells
    const nearbyKeys = getNearbyGridKeys(lat, lon);
    for (const key of nearbyKeys) {
        const cached = db.prepare('SELECT location_name FROM location_cache WHERE grid_key = ?').get(key) as { location_name: string } | undefined;
        if (cached) {
            return cached.location_name;
        }
    }
    
    // Check with ocean precision
    const oceanKey = getGridKey(lat, lon, OCEAN_GRID_PRECISION);
    const oceanCached = db.prepare('SELECT location_name FROM location_cache WHERE grid_key = ?').get(oceanKey) as { location_name: string } | undefined;
    if (oceanCached) {
        return oceanCached.location_name;
    }
    
    return null;
}

/**
 * Store location in database cache
 */
function cacheLocation(lat: number, lon: number, locationName: string, isWaterBody: boolean): void {
    const precision = isWaterBody ? OCEAN_GRID_PRECISION : LAND_GRID_PRECISION;
    const key = getGridKey(lat, lon, precision);
    
    try {
        db.prepare(`
            INSERT OR REPLACE INTO location_cache (grid_key, location_name, is_water_body, created_at)
            VALUES (?, ?, ?, ?)
        `).run(key, locationName, isWaterBody ? 1 : 0, Date.now());
    } catch (e) {
        // Ignore cache errors
    }
}

/**
 * Wait for rate limit
 */
async function waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
    }
    lastRequestTime = Date.now();
}

/**
 * Get ocean name based on coordinates (fallback)
 */
function getOceanName(lat: number, lon: number): string {
    let oceanName = 'International Waters';
    
    if (lon > 100 || lon < -100) {
        oceanName = lat > 0 ? 'North Pacific Ocean' : 'South Pacific Ocean';
    } else if (lon > -80 && lon < 0) {
        oceanName = lat > 0 ? 'North Atlantic Ocean' : 'South Atlantic Ocean';
    } else if (lon > 20 && lon < 100 && lat < 25) {
        oceanName = 'Indian Ocean';
    } else if (lat > 66) {
        oceanName = 'Arctic Ocean';
    } else if (lat < -60) {
        oceanName = 'Southern Ocean';
    }
    
    // Cache with ocean precision
    cacheLocation(lat, lon, oceanName, true);
    
    return oceanName;
}

/**
 * Get location name for coordinates with persistent caching
 */
export async function getLocationNameCached(lat: number, lon: number): Promise<string> {
    // Check database cache first
    const cached = findCachedLocation(lat, lon);
    if (cached) {
        return cached;
    }
    
    try {
        await waitForRateLimit();
        
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'MagicPlace/1.0 (https://magicplace.app)',
            },
        });
        
        if (!response.ok) {
            return getOceanName(lat, lon);
        }
        
        const data: NominatimResponse = await response.json();
        
        if (data.error) {
            return getOceanName(lat, lon);
        }
        
        // Check for water body
        const waterBodyName = 
            data.address?.ocean ||
            data.address?.sea ||
            data.address?.bay ||
            data.address?.water ||
            (data.type === 'ocean' || data.type === 'sea' ? data.name : null);
        
        if (waterBodyName) {
            cacheLocation(lat, lon, waterBodyName, true);
            return waterBodyName;
        }
        
        if (!data.address) {
            return getOceanName(lat, lon);
        }
        
        // Get land place name
        const placeName = 
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.hamlet ||
            data.address.municipality ||
            data.address.county ||
            data.address.state ||
            data.address.country ||
            'Unknown location';
        
        // Build location string
        let locationName = placeName;
        const country = data.address.country;
        const region = data.address.state || data.address.county;
        
        if (country === 'United States' && region) {
            locationName = `${placeName}, ${region}`;
        } else if (country && placeName !== country) {
            locationName = `${placeName}, ${country}`;
        }
        
        cacheLocation(lat, lon, locationName, false);
        return locationName;
        
    } catch (error) {
        console.warn('Geocoding failed:', error);
        return getOceanName(lat, lon);
    }
}

/**
 * Get location name for pixel coordinates (convenience function)
 */
export async function getLocationForPixel(px: number, py: number): Promise<string> {
    const { lat, lon } = globalPxToLatLon(px, py);
    return getLocationNameCached(lat, lon);
}

/**
 * Get location name for shard coordinates (convenience function)
 */
export async function getLocationForShard(shardX: number, shardY: number, shardDimension: number): Promise<string> {
    const centerPx = (shardX + 0.5) * shardDimension;
    const centerPy = (shardY + 0.5) * shardDimension;
    const { lat, lon } = globalPxToLatLon(centerPx, centerPy);
    return getLocationNameCached(lat, lon);
}
