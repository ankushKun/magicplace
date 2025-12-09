import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN, setProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { type Counter } from "../idl/counter";
import IDL from "../idl/counter.json";
import { useSessionKeyManager } from "@magicblock-labs/gum-react-sdk";

// Note: @magicblock-labs/ephemeral-rollups-sdk is imported dynamically to avoid
// Buffer not defined errors during module initialization

// Counter account data structure
interface CounterAccount {
    count: bigint;
    authority: PublicKey;
}

// Ephemeral Rollup endpoints - configurable via environment
const ER_ENDPOINT = "https://devnet.magicblock.app";
const ER_WS_ENDPOINT = "wss://devnet.magicblock.app";

// Delegation status
export type DelegationStatus = "undelegated" | "delegated" | "checking";

/**
 * Hook to interact with the Counter program on Solana.
 * Provides real-time updates via WebSocket subscriptions.
 * Supports MagicBlock Ephemeral Rollups for delegation, commit, and undelegation.
 */
export function useCounterProgram() {
    const { connection } = useConnection();
    const wallet = useWallet();

    const [counterPubkey, setCounterPubkeyState] = useState<PublicKey | null>(() => {
        // Derive PDA from wallet public key if connected
        return null;
    });

    const [counterAccount, setCounterAccount] = useState<CounterAccount | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDelegating, setIsDelegating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [delegationStatus, setDelegationStatus] = useState<DelegationStatus>("checking");
    const [erCounterValue, setErCounterValue] = useState<bigint | null>(null);

    // Base layer Anchor provider and program
    const program = useMemo(() => {
        if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
            return null;
        }

        const provider = new AnchorProvider(
            connection,
            {
                publicKey: wallet.publicKey,
                signTransaction: wallet.signTransaction,
                signAllTransactions: wallet.signAllTransactions,
            },
            { commitment: "confirmed" }
        );

        setProvider(provider);

        return new Program<Counter>(IDL as Counter, provider);
    }, [connection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

    // Ephemeral Rollup connection and provider
    const erConnection = useMemo(() => {
        return new Connection(ER_ENDPOINT, {
            wsEndpoint: ER_WS_ENDPOINT,
            commitment: "confirmed",
        });
    }, []);

    const erProvider = useMemo(() => {
        if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
            return null;
        }

        return new AnchorProvider(
            erConnection,
            {
                publicKey: wallet.publicKey,
                signTransaction: wallet.signTransaction,
                signAllTransactions: wallet.signAllTransactions,
            },
            { commitment: "confirmed" }
        );
    }, [erConnection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

    const erProgram = useMemo(() => {
        if (!erProvider) {
            return null;
        }

        return new Program<Counter>(IDL as Counter, erProvider);
    }, [erProvider]);

    // Session Key Manager
    // Session Key Manager
    const sessionWallet = useSessionKeyManager(
        wallet as any,
        connection,
        "devnet"
    );

    const { sessionToken, createSession: sdkCreateSession, isLoading: isSessionLoading } = sessionWallet;

    const createSession = useCallback(async () => {
        return await sdkCreateSession(new PublicKey(IDL.address));
    }, [sdkCreateSession]);

    // Derive PDA from wallet public key
    const derivePDA = useCallback((authority: PublicKey) => {
        const [pda] = PublicKey.findProgramAddressSync(
            [authority.toBuffer()],
            new PublicKey(IDL.address)
        );
        return pda;
    }, []);

    // Auto-derive counter PDA when wallet connects
    useEffect(() => {
        if (wallet.publicKey) {
            const pda = derivePDA(wallet.publicKey);
            setCounterPubkeyState(pda);
        } else {
            setCounterPubkeyState(null);
        }
    }, [wallet.publicKey, derivePDA]);

    // Fetch counter account data from base layer
    const fetchCounterAccount = useCallback(async () => {
        if (!program || !counterPubkey) {
            setCounterAccount(null);
            return;
        }

        try {
            const account = await program.account.counter.fetch(counterPubkey);
            setCounterAccount({
                count: BigInt(account.count.toString()),
                authority: account.authority,
            });
            setError(null);
        } catch (err) {
            // This is expected when the counter hasn't been initialized yet
            console.debug("Counter account not found (this is normal for new wallets):", err);
            setCounterAccount(null);
            // Only set error for unexpected errors, not "account does not exist"
            if (err instanceof Error && !err.message.includes("Account does not exist") && !err.message.includes("could not find account")) {
                setError(err.message);
            }
        }
    }, [program, counterPubkey]);

    // Delegation Program address - when an account is delegated, its owner changes to this
    const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

    // Check if account is delegated by checking the account owner on base layer
    const checkDelegationStatus = useCallback(async () => {
        if (!counterPubkey) {
            setDelegationStatus("checking");
            return;
        }

        try {
            setDelegationStatus("checking");

            // Get account info from base layer to check the owner
            const accountInfo = await connection.getAccountInfo(counterPubkey);

            if (!accountInfo) {
                // Account doesn't exist yet
                setDelegationStatus("undelegated");
                setErCounterValue(null);
                return;
            }

            // Check if the account owner is the delegation program
            const isDelegated = accountInfo.owner.equals(DELEGATION_PROGRAM_ID);

            if (isDelegated) {
                setDelegationStatus("delegated");
                // Try to fetch the counter value from ER
                if (erProgram) {
                    try {
                        const account = await erProgram.account.counter.fetch(counterPubkey);
                        setErCounterValue(BigInt(account.count.toString()));
                    } catch {
                        // Couldn't fetch from ER, but it's still delegated
                        console.debug("Couldn't fetch counter from ER");
                    }
                }
            } else {
                setDelegationStatus("undelegated");
                setErCounterValue(null);
            }
        } catch (err) {
            console.debug("Error checking delegation status:", err);
            setDelegationStatus("undelegated");
            setErCounterValue(null);
        }
    }, [counterPubkey, connection, erProgram]);

    // Subscribe to base layer account changes via WebSocket
    useEffect(() => {
        if (!program || !counterPubkey) {
            return;
        }

        fetchCounterAccount();
        checkDelegationStatus();

        const subscriptionId = connection.onAccountChange(
            counterPubkey,
            async (accountInfo) => {
                try {
                    const decoded = program.coder.accounts.decode("counter", accountInfo.data);
                    setCounterAccount({
                        count: BigInt(decoded.count.toString()),
                        authority: decoded.authority,
                    });
                    setError(null);
                    // Recheck delegation status when base layer changes
                    checkDelegationStatus();
                } catch (err) {
                    console.error("Failed to decode account data:", err);
                }
            },
            "confirmed"
        );

        return () => {
            connection.removeAccountChangeListener(subscriptionId);
        };
    }, [program, counterPubkey, connection, fetchCounterAccount, checkDelegationStatus]);

    // Subscribe to ER account changes when delegated
    useEffect(() => {
        if (!erProgram || !counterPubkey || delegationStatus !== "delegated") {
            return;
        }

        const subscriptionId = erConnection.onAccountChange(
            counterPubkey,
            async (accountInfo) => {
                try {
                    const decoded = erProgram.coder.accounts.decode("counter", accountInfo.data);
                    setErCounterValue(BigInt(decoded.count.toString()));
                } catch (err) {
                    console.error("Failed to decode ER account data:", err);
                }
            },
            "confirmed"
        );

        return () => {
            erConnection.removeAccountChangeListener(subscriptionId);
        };
    }, [erProgram, counterPubkey, erConnection, delegationStatus]);

    // Initialize a new counter (uses PDA derived from wallet)
    const initialize = useCallback(async (): Promise<string> => {
        if (!program || !wallet.publicKey) {
            throw new Error("Wallet not connected");
        }

        setIsLoading(true);
        setError(null);

        try {
            const tx = await program.methods
                .initialize()
                .accounts({
                    authority: wallet.publicKey,
                })
                .rpc();

            // PDA is already set from wallet connection
            await fetchCounterAccount();
            return tx;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to initialize counter";
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [program, wallet.publicKey, fetchCounterAccount]);

    // Increment the counter (on base layer)
    const increment = useCallback(async (): Promise<string> => {
        if (!program || !wallet.publicKey || !counterPubkey) {
            throw new Error("Counter not initialized");
        }

        setIsLoading(true);
        setError(null);

        try {
            const tx = await program.methods
                .increment()
                .accounts({
                    counter: counterPubkey,
                    signer: wallet.publicKey,
                    sessionToken: null,
                } as any)
                .rpc();

            return tx;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to increment counter";
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [program, wallet.publicKey, counterPubkey]);

    const performErAction = useCallback(async (
        methodBuilder: any,
        actionName: string
    ): Promise<string> => {
        if (!program || !erProvider || !wallet.publicKey || !counterPubkey) {
            throw new Error("Counter not initialized or not delegated");
        }

        setIsLoading(true);
        setError(null);

        try {
            // Check if we have a valid session
            const hasSession = sessionToken != null && sessionWallet != null;
            const signer = hasSession ? sessionWallet.publicKey : wallet.publicKey;

            // Build accounts
            const accounts: any = {
                counter: counterPubkey,
                signer: signer,
                sessionToken: hasSession ? sessionToken : null,
            };

            // Build transaction using base program structure but targeted at ER accounts
            let tx = await methodBuilder
                .accounts(accounts)
                .transaction();

            // Set up for ER connection
            tx.feePayer = wallet.publicKey;
            tx.recentBlockhash = (await erConnection.getLatestBlockhash()).blockhash;

            if (hasSession && sessionWallet && sessionWallet.signTransaction) {
                // If using session, session wallet signs
                // But who pays for fees? wallet.publicKey is feePayer.
                // If wallet.publicKey is feePayer, it MUST sign.
                // But we want to avoid main wallet popup.
                // So feePayer should be sessionWallet?
                // Session keys usually have some SOL topup.
                // "createSession" usually tops up.
                // So let's try using sessionWallet as feePayer.
                tx.feePayer = sessionWallet.publicKey;
                tx = await sessionWallet.signTransaction(tx);
            } else {
                tx = await erProvider.wallet.signTransaction(tx);
            }

            // Send using raw connection
            const txHash = await erConnection.sendRawTransaction(tx.serialize(), {
                skipPreflight: true,
            });
            await erConnection.confirmTransaction(txHash, "confirmed");

            // Refresh ER counter value
            if (erProgram) {
                try {
                    const account = await erProgram.account.counter.fetch(counterPubkey);
                    setErCounterValue(BigInt(account.count.toString()));
                } catch {
                    // Ignore fetch errors
                }
            }

            return txHash;
        } catch (err) {
            const message = err instanceof Error ? err.message : `Failed to ${actionName} on ER`;
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [program, erProvider, erConnection, erProgram, wallet.publicKey, counterPubkey, sessionToken, sessionWallet]);

    // Increment the counter on Ephemeral Rollup
    const incrementOnER = useCallback(async (): Promise<string> => {
        if (!program) throw new Error("Program not loaded");
        return performErAction(program.methods.increment(), "increment");
    }, [program, performErAction]);

    // Decrement the counter on Ephemeral Rollup
    const decrementOnER = useCallback(async (): Promise<string> => {
        if (!program) throw new Error("Program not loaded");
        return performErAction(program.methods.decrement(), "decrement");
    }, [program, performErAction]);

    // Set the counter to a specific value on Ephemeral Rollup
    const setOnER = useCallback(async (value: number): Promise<string> => {
        if (!program) throw new Error("Program not loaded");
        return performErAction(program.methods.set(new BN(value)), "set");
    }, [program, performErAction]);

    // Decrement the counter (on base layer)
    const decrement = useCallback(async (): Promise<string> => {
        if (!program || !wallet.publicKey || !counterPubkey) {
            throw new Error("Counter not initialized");
        }

        setIsLoading(true);
        setError(null);

        try {
            const tx = await program.methods
                .decrement()
                .accounts({
                    counter: counterPubkey,
                    signer: wallet.publicKey,
                    sessionToken: null,
                } as any)
                .rpc();

            return tx;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to decrement counter";
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [program, wallet.publicKey, counterPubkey]);

    // Set the counter to a specific value (on base layer)
    const set = useCallback(async (value: number): Promise<string> => {
        if (!program || !wallet.publicKey || !counterPubkey) {
            throw new Error("Counter not initialized");
        }

        setIsLoading(true);
        setError(null);

        try {
            const tx = await program.methods
                .set(new BN(value))
                .accounts({
                    counter: counterPubkey,
                    signer: wallet.publicKey,
                    sessionToken: null,
                } as any)
                .rpc();

            return tx;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to set counter";
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [program, wallet.publicKey, counterPubkey]);

    // ========================================
    // Ephemeral Rollups Functions
    // ========================================

    // Delegate the counter to Ephemeral Rollups
    const delegate = useCallback(async (): Promise<string> => {
        if (!program || !wallet.publicKey) {
            throw new Error("Wallet not connected");
        }

        setIsLoading(true);
        setIsDelegating(true);
        setError(null);

        try {
            const tx = await program.methods
                .delegate()
                .accounts({
                    payer: wallet.publicKey,
                })
                .rpc({
                    skipPreflight: true,
                });

            // Wait a bit for delegation to propagate
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Recheck delegation status
            await checkDelegationStatus();

            return tx;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delegate counter";
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
            setIsDelegating(false);
        }
    }, [program, wallet.publicKey, checkDelegationStatus]);

    // Commit state from ER to base layer (runs on ER)
    const commit = useCallback(async (): Promise<string> => {
        if (!program || !erProvider || !wallet.publicKey || !counterPubkey) {
            throw new Error("Counter not initialized or not delegated");
        }

        setIsLoading(true);
        setError(null);

        try {
            // Build transaction using base program
            let tx = await program.methods
                .commit()
                .accounts({
                    payer: wallet.publicKey,
                })
                .transaction();

            // Set up for ER connection
            tx.feePayer = wallet.publicKey;
            tx.recentBlockhash = (await erConnection.getLatestBlockhash()).blockhash;
            tx = await erProvider.wallet.signTransaction(tx);

            // Send using raw connection
            const txHash = await erConnection.sendRawTransaction(tx.serialize(), {
                skipPreflight: true,
            });
            await erConnection.confirmTransaction(txHash, "confirmed");

            // Try to get the commitment signature on base layer
            try {
                // Dynamic import to avoid Buffer issues at module load time
                const { GetCommitmentSignature } = await import("@magicblock-labs/ephemeral-rollups-sdk");
                const txCommitSgn = await GetCommitmentSignature(txHash, erConnection);
                console.log("Commit signature on base layer:", txCommitSgn);
            } catch {
                console.log("GetCommitmentSignature not available (might be expected on localnet)");
            }

            // Refresh base layer counter value
            await fetchCounterAccount();

            return txHash;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to commit counter";
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [program, erProvider, erConnection, wallet.publicKey, counterPubkey, fetchCounterAccount]);

    // Undelegate the counter from ER (runs on ER)
    const undelegate = useCallback(async (): Promise<string> => {
        if (!program || !erProvider || !wallet.publicKey || !counterPubkey) {
            throw new Error("Counter not initialized or not delegated");
        }

        setIsLoading(true);
        setError(null);

        try {
            // Build transaction using base program
            let tx = await program.methods
                .undelegate()
                .accounts({
                    payer: wallet.publicKey,
                })
                .transaction();

            // Set up for ER connection
            tx.feePayer = wallet.publicKey;
            tx.recentBlockhash = (await erConnection.getLatestBlockhash()).blockhash;
            tx = await erProvider.wallet.signTransaction(tx);

            // Send using raw connection
            const txHash = await erConnection.sendRawTransaction(tx.serialize(), {
                skipPreflight: true,
            });
            await erConnection.confirmTransaction(txHash, "confirmed");

            // Wait for undelegation to propagate
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Update state
            setDelegationStatus("undelegated");
            setErCounterValue(null);

            // Refresh base layer counter value
            await fetchCounterAccount();

            return txHash;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to undelegate counter";
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [program, erProvider, erConnection, wallet.publicKey, counterPubkey, fetchCounterAccount]);

    return {
        program,
        counterAccount,
        counterPubkey,
        isLoading,
        isDelegating,
        error,
        // Base layer operations
        initialize,
        increment,
        decrement,
        set,
        // Ephemeral Rollups operations
        delegate,
        commit,
        undelegate,
        incrementOnER,
        decrementOnER,
        setOnER,
        // Delegation status
        delegationStatus,
        erCounterValue,
        // Utilities
        refetch: fetchCounterAccount,
        checkDelegation: checkDelegationStatus,
        // Session
        createSession,
        sessionToken,
        isSessionLoading,
    };
};
