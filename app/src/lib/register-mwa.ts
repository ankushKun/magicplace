/**
 * Mobile Wallet Adapter (MWA) registration for web apps.
 * 
 * This registers MWA as a wallet option that automatically adapts to the user's device:
 * - Mobile Web/PWA: Connects locally to wallet apps on the same device via Android Intents
 * - Desktop: Can connect remotely via QR code scanning (requires remoteHostAuthority)
 * 
 * Import this file early in your app's entry point to ensure MWA registers before
 * the wallet adapter initializes.
 * 
 * @see https://docs.solanamobile.com/mobile-wallet-adapter/web-installation
 */

import {
    createDefaultAuthorizationCache,
    createDefaultChainSelector,
    createDefaultWalletNotFoundHandler,
    registerMwa,
} from '@solana-mobile/wallet-standard-mobile';

// Only run in browser environment
if (typeof window !== 'undefined') {
    registerMwa({
        appIdentity: {
            name: 'pixels.earth',
            uri: window.location.origin,
            // App icon shown in wallet connection dialogs
            icon: '/icon-192.png',
        },
        // Cache authorization to avoid re-prompting users
        authorizationCache: createDefaultAuthorizationCache(),
        // Supported chains - using devnet for now
        chains: ['solana:devnet'],
        // Default chain selector UI
        chainSelector: createDefaultChainSelector(),
        // Default handler when no compatible wallet is found
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
        // Optional: Enable remote connection for desktop users via QR code
        // Requires a reflector server endpoint (Solana Mobile is working on a public one)
        // remoteHostAuthority: 'wss://your-reflector-server.com',
    });
}

export {};
