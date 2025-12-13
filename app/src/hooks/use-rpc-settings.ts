import { create } from 'zustand';

// Default RPC endpoints
export const DEFAULT_SOLANA_RPC = "https://api.devnet.solana.com";
export const DEFAULT_MAGICBLOCK_RPC = "https://devnet.magicblock.app";

// Local storage keys
const SOLANA_RPC_KEY = "magicplace_solana_rpc";
const MAGICBLOCK_RPC_KEY = "magicplace_magicblock_rpc";

// Helper to get initial value from localStorage
function getStoredValue(key: string, defaultValue: string): string {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const stored = localStorage.getItem(key);
        return stored || defaultValue;
    } catch {
        return defaultValue;
    }
}

// Helper to set value in localStorage
function setStoredValue(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignore storage errors
    }
}

interface RpcSettingsState {
    solanaRpc: string;
    magicblockRpc: string;
    setSolanaRpc: (url: string) => void;
    setMagicblockRpc: (url: string) => void;
    resetToDefaults: () => void;
}

export const useRpcSettings = create<RpcSettingsState>((set) => ({
    solanaRpc: getStoredValue(SOLANA_RPC_KEY, DEFAULT_SOLANA_RPC),
    magicblockRpc: getStoredValue(MAGICBLOCK_RPC_KEY, DEFAULT_MAGICBLOCK_RPC),
    
    setSolanaRpc: (url: string) => {
        const trimmed = url.trim() || DEFAULT_SOLANA_RPC;
        setStoredValue(SOLANA_RPC_KEY, trimmed);
        set({ solanaRpc: trimmed });
    },
    
    setMagicblockRpc: (url: string) => {
        const trimmed = url.trim() || DEFAULT_MAGICBLOCK_RPC;
        setStoredValue(MAGICBLOCK_RPC_KEY, trimmed);
        set({ magicblockRpc: trimmed });
    },
    
    resetToDefaults: () => {
        setStoredValue(SOLANA_RPC_KEY, DEFAULT_SOLANA_RPC);
        setStoredValue(MAGICBLOCK_RPC_KEY, DEFAULT_MAGICBLOCK_RPC);
        set({ 
            solanaRpc: DEFAULT_SOLANA_RPC, 
            magicblockRpc: DEFAULT_MAGICBLOCK_RPC 
        });
    },
}));

// Helper to derive WebSocket endpoint from HTTP endpoint
export function getWsEndpoint(httpEndpoint: string): string {
    return httpEndpoint.replace("https://", "wss://").replace("http://", "ws://");
}
