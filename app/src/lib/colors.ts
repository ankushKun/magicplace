// Color utility functions for MagicPlace

/**
 * Convert RGB values to uint32 color format
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns uint32 color value
 */
export function rgbToUint32(r: number, g: number, b: number): number {
    // Use >>> 0 to ensure the result is a positive 32-bit integer
    return (((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF)) >>> 0;
}

/**
 * Convert uint32 color to RGB object
 * @param color uint32 color value (number or bigint)
 * @returns Object with r, g, b components (0-255)
 */
export function uint32ToRgb(color: number | bigint): { r: number; g: number; b: number } {
    // Convert BigInt to number if necessary
    const colorNum = typeof color === 'bigint' ? Number(color) : color;
    return {
        r: (colorNum >> 16) & 0xFF,
        g: (colorNum >> 8) & 0xFF,
        b: colorNum & 0xFF,
    };
}

/**
 * Convert uint32 color to hex string
 * @param color uint32 color value (number or bigint)
 * @returns Hex color string (e.g., "#FF0000")
 */
export function uint32ToHex(color: number | bigint): string {
    const rgb = uint32ToRgb(color);
    return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex string to uint32 color
 * Note: Black (#000000) is converted to 0x010101 to distinguish from transparent (0)
 * @param hex Hex color string (e.g., "#FF0000" or "FF0000")
 * @returns uint32 color value
 */
export function hexToUint32(hex: string): number {
    const cleaned = hex.replace('#', '');
    const r = parseInt(cleaned.substring(0, 2), 16) || 0;
    const g = parseInt(cleaned.substring(2, 4), 16) || 0;
    const b = parseInt(cleaned.substring(4, 6), 16) || 0;
    const color = Number(rgbToUint32(r, g, b));
    // Convert black (0) to near-black (0x010101) since 0 means transparent/unset
    return color === 0 ? 0x010101 : color;
}

/**
 * Parse a color string (hex) to rgba for CSS
 * @param hex Hex color string
 * @param alpha Alpha value (0-1)
 * @returns rgba CSS string
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
    const cleaned = hex.replace('#', '');
    const r = parseInt(cleaned.substring(0, 2), 16) || 0;
    const g = parseInt(cleaned.substring(2, 4), 16) || 0;
    const b = parseInt(cleaned.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
