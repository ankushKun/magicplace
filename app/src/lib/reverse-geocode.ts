/**
 * Reverse geocoding utility using OpenStreetMap Nominatim API
 * Converts lat/lon coordinates to place names (including oceans and seas)
 * 
 * Features aggressive spatial caching to minimize API calls:
 * - Grid-based cache: nearby coordinates share the same cached value
 * - Land areas: ~11km grid (0.1 degree precision)
 * - Ocean areas: ~111km grid (1 degree precision)
 */

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
        // Ocean/water body fields
        ocean?: string;
        sea?: string;
        bay?: string;
        water?: string;
        natural?: string;
    };
    display_name?: string;
    name?: string; // Direct name field (often has ocean names)
    type?: string; // Type of feature (e.g., "ocean", "sea")
    error?: string;
}

interface PlaceInfo {
    name: string; // Most specific place name (city/town/village/ocean)
    region?: string; // State/county
    country?: string;
    fullName: string; // Full display name
    isWaterBody: boolean; // True if this is an ocean, sea, etc.
}

// Grid-based cache for location names (indexed by grid cell)
// Key format: "lat,lon" rounded to grid precision
const geocodeCache = new Map<string, PlaceInfo>();

// Quick string cache: maps grid key directly to location name string
const locationNameCache = new Map<string, string>();

// LocalStorage key for persisting cache
const CACHE_STORAGE_KEY = 'magicplace_geocode_cache';
// Cache version - increment when format changes to invalidate old cache
const CACHE_VERSION = 4; // v4: 2km grid precision
const CACHE_VERSION_KEY = 'magicplace_geocode_cache_version';

// Load cache from localStorage on initialization
function loadCacheFromStorage(): void {
    if (typeof window === 'undefined') return; // SSR guard
    
    try {
        // Check cache version - if outdated, clear it
        const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
        if (storedVersion !== String(CACHE_VERSION)) {
            console.log(`📍 Cache version changed (${storedVersion} -> ${CACHE_VERSION}), clearing old cache`);
            localStorage.removeItem(CACHE_STORAGE_KEY);
            localStorage.setItem(CACHE_VERSION_KEY, String(CACHE_VERSION));
            return;
        }
        
        const stored = localStorage.getItem(CACHE_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as Record<string, string>;
            Object.entries(parsed).forEach(([key, name]) => {
                locationNameCache.set(key, name);
            });
            console.log(`📍 Loaded ${locationNameCache.size} cached locations from storage`);
        }
    } catch (e) {
        // Ignore parse errors
    }
}

// Save cache to localStorage
function saveCacheToStorage(): void {
    if (typeof window === 'undefined') return; // SSR guard
    
    try {
        const obj: Record<string, string> = {};
        locationNameCache.forEach((value, key) => {
            obj[key] = value;
        });
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        // Ignore storage errors (quota exceeded, etc.)
    }
}

// Initialize cache from storage
loadCacheFromStorage();

// Rate limiting: Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

// Grid precision for caching (in degrees)
// 0.02 degrees ≈ 2.2km at equator - more precise city lookups
const LAND_GRID_PRECISION = 0.02;
// 1 degree ≈ 111km at equator - good for oceans
const OCEAN_GRID_PRECISION = 1.0;

/**
 * Get a grid-based cache key for coordinates
 * Groups nearby coordinates to the same grid cell
 */
function getGridKey(lat: number, lon: number, precision: number = LAND_GRID_PRECISION): string {
    const gridLat = Math.round(lat / precision) * precision;
    const gridLon = Math.round(lon / precision) * precision;
    return `${gridLat.toFixed(2)},${gridLon.toFixed(2)}`;
}

/**
 * Get all nearby grid keys to check cache
 * Returns current cell and 8 surrounding cells
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
 * Check if a cached location is nearby - returns cached value if found
 * Checks both in-memory cache and localStorage-loaded cache
 */
function findNearbyCache(lat: number, lon: number): { place: PlaceInfo | null; name: string | null } {
    // First check the exact grid cell
    const exactKey = getGridKey(lat, lon);
    if (geocodeCache.has(exactKey)) {
        return { 
            place: geocodeCache.get(exactKey)!, 
            name: locationNameCache.get(exactKey) || null 
        };
    }
    // Check locationNameCache even if PlaceInfo isn't cached (loaded from storage)
    if (locationNameCache.has(exactKey)) {
        return { 
            place: null, 
            name: locationNameCache.get(exactKey)! 
        };
    }
    
    // Check nearby grid cells
    const nearbyKeys = getNearbyGridKeys(lat, lon);
    for (const key of nearbyKeys) {
        if (geocodeCache.has(key)) {
            return { 
                place: geocodeCache.get(key)!, 
                name: locationNameCache.get(key) || null 
            };
        }
        if (locationNameCache.has(key)) {
            return { 
                place: null, 
                name: locationNameCache.get(key)! 
            };
        }
    }
    
    // Also check with ocean precision for water bodies
    const oceanKey = getGridKey(lat, lon, OCEAN_GRID_PRECISION);
    if (geocodeCache.has(oceanKey)) {
        return { 
            place: geocodeCache.get(oceanKey)!, 
            name: locationNameCache.get(oceanKey) || null 
        };
    }
    if (locationNameCache.has(oceanKey)) {
        return { 
            place: null, 
            name: locationNameCache.get(oceanKey)! 
        };
    }
    
    return { place: null, name: null };
}

/**
 * Store a location in both caches and persist to localStorage
 */
function cacheLocation(lat: number, lon: number, place: PlaceInfo, locationName: string): void {
    const precision = place.isWaterBody ? OCEAN_GRID_PRECISION : LAND_GRID_PRECISION;
    const key = getGridKey(lat, lon, precision);
    geocodeCache.set(key, place);
    locationNameCache.set(key, locationName);
    
    // Persist to localStorage (debounced via async)
    saveCacheToStorage();
}

/**
 * Wait for rate limit if needed
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
 * Reverse geocode coordinates to get place name (including oceans/seas)
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @returns PlaceInfo with name details, or null if lookup fails
 */
export async function reverseGeocode(lat: number, lon: number): Promise<PlaceInfo | null> {
    // Check cache first (including nearby cells)
    const cached = findNearbyCache(lat, lon);
    if (cached.place) {
        return cached.place;
    }
    
    try {
        // Wait for rate limit
        await waitForRateLimit();
        
        // Use zoom=18 for maximum detail (city/town level)
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'MagicPlace/1.0 (https://magicplace.app)', // Required by Nominatim ToS
            },
        });
        
        if (!response.ok) {
            console.warn(`Nominatim API error: ${response.status}`);
            return null;
        }
        
        const data: NominatimResponse = await response.json();
        
        // Check for error response (common for ocean coordinates)
        if (data.error) {
            // For ocean areas, Nominatim often returns an error
            return {
                name: "Secret Location",
                region: undefined,
                country: undefined,
                fullName: "Secret Location",
                isWaterBody: false,
            };
        }

        // Check if we got a water body
        const waterBodyName = 
            data.address?.ocean ||
            data.address?.sea ||
            data.address?.bay ||
            data.address?.water ||
            (data.type === 'ocean' || data.type === 'sea' ? data.name : null);

        if (waterBodyName) {
            const placeInfo: PlaceInfo = {
                name: waterBodyName,
                region: undefined,
                country: undefined,
                fullName: data.display_name || waterBodyName,
                isWaterBody: true,
            };
            cacheLocation(lat, lon, placeInfo, waterBodyName);
            return placeInfo;
        }
        
        if (!data.address) {
            return {
                name: "Secret Location",
                region: undefined,
                country: undefined,
                fullName: "Secret Location",
                isWaterBody: false,
            }
        }
        
        // Get the most specific land place name available (city-level)
        const cityName = 
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.hamlet ||
            data.address.municipality ||
            null;
        
        // Get region/state level
        const regionName = data.address.state || data.address.county || null;
        
        // Get country
        const countryName = data.address.country || null;
        
        // Build the display name - prioritize "City, Country/State" format
        let displayName: string;
        
        if (cityName) {
            // We have a city - format as "City, Country" or "City, State" for US
            if (countryName === 'United States' && regionName) {
                displayName = `${cityName}, ${regionName}`;
            } else if (countryName) {
                displayName = `${cityName}, ${countryName}`;
            } else if (regionName) {
                displayName = `${cityName}, ${regionName}`;
            } else {
                displayName = cityName;
            }
        } else if (regionName) {
            // No city, but have region - format as "Region, Country"
            if (countryName && regionName !== countryName) {
                displayName = `${regionName}, ${countryName}`;
            } else {
                displayName = regionName;
            }
        } else if (countryName) {
            // Only country available
            displayName = countryName;
        } else {
            displayName = 'Unknown location';
        }
        
        const placeInfo: PlaceInfo = {
            name: cityName || regionName || countryName || 'Unknown location',
            region: regionName || undefined,
            country: countryName || undefined,
            fullName: data.display_name || displayName,
            isWaterBody: false,
        };
        
        // Cache the result with the properly formatted display name
        cacheLocation(lat, lon, placeInfo, displayName);
        
        return placeInfo;
    } catch (error) {
        console.warn('Reverse geocoding failed:', error);
        return null;
    }
}

/**
 * Get a short, human-readable location string
 * Uses aggressive caching to minimize API calls
 * 
 * @param lat Latitude in degrees  
 * @param lon Longitude in degrees
 * @returns A short location string like "Tokyo, Japan" or "Pacific Ocean"
 */
export async function getLocationName(lat: number, lon: number): Promise<string> {
    // Check quick string cache first (including nearby cells)
    const cached = findNearbyCache(lat, lon);
    if (cached.name) {
        return cached.name;
    }
    
    const place = await reverseGeocode(lat, lon);
    
    if (!place) {
        return "Secret Location"
    }

    // Water bodies don't need country suffix
    if (place.isWaterBody) {
        return place.name;
    }
    
    // Build a concise name: "City, Country" or "City, State" for US
    let locationName: string;
    
    if (place.name && place.name !== place.country && place.name !== place.region) {
        // We have a specific city/town name
        if (place.country === 'United States' && place.region) {
            locationName = `${place.name}, ${place.region}`;
        } else if (place.country) {
            locationName = `${place.name}, ${place.country}`;
        } else if (place.region) {
            locationName = `${place.name}, ${place.region}`;
        } else {
            locationName = place.name;
        }
    } else if (place.region && place.region !== place.country) {
        // Only region available
        if (place.country) {
            locationName = `${place.region}, ${place.country}`;
        } else {
            locationName = place.region;
        }
    } else {
        // Fallback to whatever we have
        locationName = place.country || place.name || 'Unknown location';
    }
    
    return locationName;
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getCacheStats(): { entries: number; size: string } {
    return {
        entries: geocodeCache.size,
        size: `${locationNameCache.size} location strings cached`
    };
}
