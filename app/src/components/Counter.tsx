import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useCounterProgram, type DelegationStatus } from "../hooks/use-counter-program";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

// Badge component for delegation status
function StatusBadge({ status }: { status: DelegationStatus }) {
    const styles: Record<DelegationStatus, { bg: string; text: string; label: string }> = {
        undelegated: { bg: "bg-gray-100", text: "text-gray-900", label: "Base Layer" },
        delegated: { bg: "bg-black", text: "text-white", label: "Delegated to ER" },
        checking: { bg: "bg-gray-100", text: "text-gray-500", label: "Checking..." },
    };

    const style = styles[status];

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
            {style.label}
        </span>
    );
}

export function Counter() {
    const { publicKey, connected } = useWallet();
    const {
        counterAccount,
        counterPubkey,
        isLoading,
        error,
        initialize,
        increment,
        decrement,
        set,
        // ER operations
        delegate,
        commit,
        undelegate,
        incrementOnER,
        decrementOnER,
        setOnER,
        delegationStatus,
        erCounterValue,
        checkDelegation,
        createSession,
        sessionToken,
        isSessionLoading,
        isDelegating,
    } = useCounterProgram();

    const [setValue, setSetValue] = useState("");
    const [lastTxSignature, setLastTxSignature] = useState<string | null>(null);

    // Handle actions with tx signature tracking
    const handleAction = async (action: () => Promise<string>, actionName: string) => {
        try {
            const tx = await action();
            setLastTxSignature(tx);
            console.log(`${actionName} successful:`, tx);
        } catch (err) {
            console.error(`${actionName} failed:`, err);
        }
    };

    // Handle increment
    const handleIncrement = async () => {
        if (delegationStatus === "delegated") {
            await handleAction(incrementOnER, "Increment on ER");
        } else {
            await handleAction(increment, "Increment");
        }
    };

    // Handle decrement
    const handleDecrement = async () => {
        if (delegationStatus === "delegated") {
            await handleAction(decrementOnER, "Decrement on ER");
        } else {
            await handleAction(decrement, "Decrement");
        }
    };

    // Handle set value
    const handleSet = async () => {
        const value = parseInt(setValue, 10);
        if (isNaN(value) || value < 0) return;

        if (delegationStatus === "delegated") {
            await handleAction(() => setOnER(value), "Set on ER");
        } else {
            await handleAction(() => set(value), "Set");
        }
        setSetValue("");
    };

    // Get explorer URL
    const getExplorerUrl = (address: string, type: "address" | "tx" = "address") => {
        return `https://explorer.solana.com/${type}/${address}?cluster=devnet`;
    };

    // Determine which counter value to display and check if zero
    const displayValue = delegationStatus === "delegated" && erCounterValue !== null
        ? erCounterValue
        : counterAccount?.count;

    const isValueZero = displayValue !== undefined && displayValue === 0n;

    return (
        <div className="max-w-lg mx-auto space-y-4">
            {/* Not connected state */}
            {!connected || !publicKey ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-gray-500">
                            Connect your wallet to interact with the Counter program
                        </p>
                    </CardContent>
                </Card>
            ) : !counterAccount ? (
                /* No counter initialized state */
                <Card>
                    <CardHeader>
                        <CardTitle>Initialize Counter</CardTitle>
                        {counterPubkey && (
                            <p className="text-xs font-mono text-gray-500 break-all">
                                PDA: {counterPubkey.toBase58()}
                            </p>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Each wallet has its own counter derived from your public key.
                        </p>
                        <Button
                            onClick={() => handleAction(initialize, "Initialize")}
                            disabled={isLoading}
                            className="w-full"
                        >
                            {isLoading ? "Creating..." : "Initialize Counter"}
                        </Button>

                        {error && (
                            <div className="p-3 rounded bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium">
                                {error}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                /* Counter interface */
                <>
                    {/* Counter Display Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Counter</CardTitle>
                                <StatusBadge status={delegationStatus} />
                            </div>
                            <p className="text-xs font-mono text-gray-500 break-all">
                                {counterPubkey?.toBase58()}
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Counter display */}
                            <div className="text-center py-6">
                                <div className="text-7xl font-bold text-gray-900">
                                    {displayValue !== undefined ? displayValue.toString() : "..."}
                                </div>
                                <p className="text-gray-500 mt-2">
                                    {delegationStatus === "delegated"
                                        ? "Value on Ephemeral Rollup"
                                        : "Value on Base Layer"}
                                </p>
                                {delegationStatus === "delegated" && counterAccount && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        Base layer: {counterAccount.count.toString()}
                                    </p>
                                )}
                            </div>

                            {/* Common Operations */}
                            <div className="space-y-4">
                                {/* Action buttons */}
                                <div className="flex justify-center gap-4">
                                    <Button
                                        onClick={handleDecrement}
                                        disabled={isLoading || isValueZero}
                                        variant="outline"
                                        size="lg"
                                        className="text-gray-900"
                                    >
                                        −
                                    </Button>
                                    <Button
                                        onClick={handleIncrement}
                                        disabled={isLoading}
                                        size="lg"
                                        className="bg-black text-white hover:bg-gray-800"
                                    >
                                        +
                                    </Button>
                                </div>

                                {/* Set value input */}
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder={`Set value${delegationStatus === "delegated" ? " on ER" : ""}...`}
                                        value={setValue}
                                        onChange={(e) => setSetValue(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSet()}
                                    />
                                    <Button
                                        onClick={handleSet}
                                        disabled={isLoading || !setValue || parseInt(setValue, 10) < 0}
                                        variant="secondary"
                                        className="bg-gray-100 text-gray-900 hover:bg-gray-200"
                                    >
                                        Set
                                    </Button>
                                </div>
                            </div>

                            {/* Divider with label */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-gray-500">
                                        Ephemeral Rollup Actions
                                    </span>
                                </div>
                            </div>

                            {/* Ephemeral Rollup Actions */}
                            <div className="space-y-3">
                                {delegationStatus === "checking" ? (
                                    <div className="text-center py-2">
                                        <p className="text-sm text-gray-500">Checking delegation status...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            onClick={() => handleAction(delegate, "Delegate")}
                                            disabled={isLoading || delegationStatus === "delegated"}
                                            className="col-span-2 bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isDelegating ? "Delegating..." : "Delegate to ER"}
                                        </Button>

                                        {delegationStatus === "delegated" && !sessionToken && (
                                            <Button
                                                onClick={() => handleAction(async () => {
                                                    await createSession();
                                                    return "Session Created";
                                                }, "Create Session")}
                                                disabled={isSessionLoading || isLoading}
                                                className="col-span-2 bg-gray-900 text-white border-2 border-gray-900"
                                            >
                                                {isSessionLoading ? "Creating Session..." : "Enable Seamless Mode ⚡"}
                                            </Button>
                                        )}

                                        <Button
                                            onClick={() => handleAction(commit, "Commit")}
                                            disabled={isLoading || delegationStatus !== "delegated"}
                                            variant="outline"
                                            className="border-gray-300 text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Commit
                                        </Button>

                                        <Button
                                            onClick={() => handleAction(undelegate, "Undelegate")}
                                            disabled={isLoading || delegationStatus !== "delegated"}
                                            variant="outline"
                                            className="border-gray-300 text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Undelegate
                                        </Button>
                                    </div>
                                )}

                                {sessionToken && delegationStatus === "delegated" && (
                                    <div className="text-center">
                                        <p className="text-xs text-green-600 font-medium">
                                            ⚡ Seamless Mode Active
                                        </p>
                                    </div>
                                )}

                                <Button
                                    onClick={() => checkDelegation()}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-xs text-gray-400"
                                    disabled={isLoading}
                                >
                                    Refresh Status
                                </Button>
                            </div>

                            {/* Error display */}
                            {error && (
                                <div className="p-3 rounded bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {/* Last transaction */}
                            {lastTxSignature && (
                                <div className="pt-2 border-t">
                                    <p className="text-xs text-gray-500 mb-1">Last Transaction</p>
                                    <a
                                        href={getExplorerUrl(lastTxSignature, "tx")}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-mono text-gray-600 hover:underline break-all"
                                    >
                                        {lastTxSignature.slice(0, 20)}...{lastTxSignature.slice(-20)}
                                    </a>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
