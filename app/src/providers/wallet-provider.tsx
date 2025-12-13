import { useMemo, type ReactNode } from "react";
import {
    ConnectionProvider,
    WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { useRpcSettings, getWsEndpoint } from "@/hooks/use-rpc-settings";

interface WalletProviderProps {
    children: ReactNode;
}

/**
 * Wallet Provider that wraps the Solana wallet adapter providers.
 * Configured for Devnet by default, but respects user RPC settings.
 */
export function WalletProvider({ children }: WalletProviderProps) {
    const { solanaRpc } = useRpcSettings();
    
    // Convert HTTP endpoint to WebSocket endpoint for subscriptions
    const wsEndpoint = useMemo(() => {
        return getWsEndpoint(solanaRpc);
    }, [solanaRpc]);

    const config = useMemo(
        () => ({
            wsEndpoint,
            commitment: "confirmed" as const,
        }),
        [wsEndpoint]
    );

    return (
        <ConnectionProvider endpoint={solanaRpc} config={config}>
            <SolanaWalletProvider wallets={[]} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    );
}
