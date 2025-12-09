// Shared constants for the MagicPlace application
// These values should match the smart contract and be used across the frontend

// Canvas configuration (must match smart contract)
export const CANVAS_RES = 524288; // 2^19 - pixels per dimension
export const SHARD_DIMENSION = 128; // 128×128 pixels per shard
export const SHARDS_PER_DIM = CANVAS_RES / SHARD_DIMENSION; // 4096 shards per dimension
export const TILE_SIZE = 512; // Standard tile size
export const MAX_REGION_SIZE = 10000; // Maximum pixels in a region query

// Map configuration
export const DEFAULT_MAP_CENTER: [number, number] = [37.757, -122.4376]; // San Francisco
export const DEFAULT_MAP_ZOOM = 7;
export const MIN_MAP_ZOOM = 3;
export const MAX_MAP_ZOOM = 18;
export const PIXEL_SELECT_ZOOM = 15; // Zoom level when clicking a pixel

// Throttling
export const MAP_MOVE_THROTTLE_MS = 500;

// Special transparent/erase color - placing this sets the pixel to 0 (unset)
// Displayed with a checkered pattern in the UI
export const TRANSPARENT_COLOR = 'TRANSPARENT';

// 4-bit color palette - 15 colors (indexes 1-15 in contract, 0 = transparent)
// Selected for visual diversity and full spectrum coverage
export const PRESET_COLORS = [
    '#000000', // 1: Black
    '#FFFFFF', // 2: White
    '#FF0000', // 3: Red
    '#00FF00', // 4: Green
    '#0000FF', // 5: Blue
    '#FFFF00', // 6: Yellow
    '#FF00FF', // 7: Magenta
    '#00FFFF', // 8: Cyan
    '#FF8000', // 9: Orange
    '#8000FF', // 10: Purple
    '#00FF80', // 11: Mint
    '#FF0080', // 12: Pink
    '#808080', // 13: Gray
    '#804000', // 14: Brown
    '#008080', // 15: Teal
] as const;

// Web Mercator projection limits
export const MAX_LATITUDE = 85.05112878;
