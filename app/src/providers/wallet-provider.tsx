import { useMemo, type ReactNode } from "react";
import {
    ConnectionProvider,
    WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

// Devnet RPC endpoint
const DEVNET_ENDPOINT = "https://api.devnet.solana.com";

interface WalletProviderProps {
    children: ReactNode;
}

/**
 * Wallet Provider that wraps the Solana wallet adapter providers.
 * Configured for Devnet by default.
 */
export function WalletProvider({ children }: WalletProviderProps) {
    // Convert HTTP endpoint to WebSocket endpoint for subscriptions
    const wsEndpoint = useMemo(() => {
        return DEVNET_ENDPOINT.replace("https://", "wss://");
    }, []);

    const config = useMemo(
        () => ({
            wsEndpoint,
            commitment: "confirmed" as const,
        }),
        [wsEndpoint]
    );

    return (
        <ConnectionProvider endpoint={DEVNET_ENDPOINT} config={config}>
            <SolanaWalletProvider wallets={[]} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    );
}
