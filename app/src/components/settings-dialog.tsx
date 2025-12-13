import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { getNickname, setNickname as saveNickname } from "@/hooks/use-gun-presence";
import { useRpcSettings, DEFAULT_SOLANA_RPC, DEFAULT_MAGICBLOCK_RPC } from "@/hooks/use-rpc-settings";
import { toast } from "sonner";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const [nickname, setNickname] = useState("");
    const [solanaRpc, setSolanaRpcLocal] = useState("");
    const [magicblockRpc, setMagicblockRpcLocal] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const { 
        solanaRpc: storedSolanaRpc, 
        magicblockRpc: storedMagicblockRpc, 
        setSolanaRpc, 
        setMagicblockRpc,
        resetToDefaults 
    } = useRpcSettings();

    useEffect(() => {
        if (open) {
            setNickname(getNickname() || "");
            setSolanaRpcLocal(storedSolanaRpc);
            setMagicblockRpcLocal(storedMagicblockRpc);
        }
    }, [open, storedSolanaRpc, storedMagicblockRpc]);

    const handleSave = () => {
        // Save nickname
        const trimmedNickname = nickname.trim();
        saveNickname(trimmedNickname || null);
        
        // Check if RPC settings changed
        const rpcChanged = solanaRpc !== storedSolanaRpc || magicblockRpc !== storedMagicblockRpc;
        
        // Save RPC settings
        setSolanaRpc(solanaRpc);
        setMagicblockRpc(magicblockRpc);
        
        if (rpcChanged) {
            toast.success("Settings saved. Refresh the page to apply RPC changes.");
        } else {
            toast.success("Settings saved");
        }
        onOpenChange(false);
    };

    const handleResetRpc = () => {
        setSolanaRpcLocal(DEFAULT_SOLANA_RPC);
        setMagicblockRpcLocal(DEFAULT_MAGICBLOCK_RPC);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-white text-slate-900">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription>
                        Make changes to your profile and network settings.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Nickname */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nickname" className="text-right">
                            Nickname
                        </Label>
                        <Input
                            id="nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="col-span-3"
                            maxLength={20}
                            placeholder="Display name"
                        />
                    </div>
                    
                    {/* Advanced Settings Toggle */}
                    <div className="border-t pt-4 mt-2">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2"
                                className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                            >
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <span className="font-medium">Advanced Settings</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                                Devnet
                            </span>
                        </button>
                    </div>
                    
                    {/* Advanced RPC Settings */}
                    {showAdvanced && (
                        <div className="space-y-4 pl-2 border-l-2 border-slate-100 ml-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-xs text-slate-400">
                                Configure custom RPC endpoints. Changes require a page refresh.
                            </p>
                            
                            {/* Solana RPC */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="solana-rpc" className="text-right text-sm">
                                    Solana RPC
                                </Label>
                                <Input
                                    id="solana-rpc"
                                    value={solanaRpc}
                                    onChange={(e) => setSolanaRpcLocal(e.target.value)}
                                    className="col-span-3 font-mono text-xs"
                                    placeholder={DEFAULT_SOLANA_RPC}
                                />
                            </div>
                            
                            {/* MagicBlock RPC */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="magicblock-rpc" className="text-right text-sm">
                                    MagicBlock
                                </Label>
                                <Input
                                    id="magicblock-rpc"
                                    value={magicblockRpc}
                                    onChange={(e) => setMagicblockRpcLocal(e.target.value)}
                                    className="col-span-3 font-mono text-xs"
                                    placeholder={DEFAULT_MAGICBLOCK_RPC}
                                />
                            </div>
                            
                            {/* Reset Button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={handleResetRpc}
                                    className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
                                >
                                    Reset to defaults
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSave}>Save changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
