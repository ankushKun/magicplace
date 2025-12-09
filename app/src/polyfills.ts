/**
 * Polyfills for browser environment
 * This file must be imported FIRST before any other modules
 */

import { Buffer } from "buffer";

// Make Buffer available globally (required by Solana/MagicBlock packages)
// @ts-ignore
globalThis.Buffer = Buffer;
// @ts-ignore
window.Buffer = Buffer;

// Make process available globally (required by some packages)
if (typeof globalThis.process === "undefined") {
    // @ts-ignore
    globalThis.process = { env: {} };
}

console.log("[Polyfills] Buffer and process polyfills loaded");
