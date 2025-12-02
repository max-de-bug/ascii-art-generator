"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNetwork } from "./Providers/network-provider";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const ToggleNetworkButton = () => {
  const { network, toggleNetwork } = useNetwork();
  const { disconnect, connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNetworkChange = async (newNetwork: WalletAdapterNetwork) => {
    if (newNetwork === network) return;

    const networkLabel = newNetwork === WalletAdapterNetwork.Mainnet ? "Mainnet" : "Devnet";

    // Disconnect wallet when switching networks
    if (connected) {
      await disconnect();
      toast.info("Wallet disconnected for network switch");
    }

    toggleNetwork();
    toast.success(`Switched to ${networkLabel}`);
  };

  if (!mounted) {
    return (
      <div className="h-10 w-[120px] bg-muted animate-pulse rounded-sm" />
    );
  }

  const isMainnet = network === WalletAdapterNetwork.Mainnet;
  const networkLabel = isMainnet ? "Mainnet" : "Devnet";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          className={cn(
            "gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer border-0",
            "bg-zinc-900 dark:bg-zinc-800 text-white",
            "hover:bg-zinc-800 dark:hover:bg-zinc-700",
            "hover:[text-shadow:0_0_8px_currentColor]"
          )}
          style={{ 
            fontFamily: "var(--font-pixel), var(--font-press-start), monospace", 
            fontWeight: 600, 
            letterSpacing: "0.05em",
            boxShadow: "inset 0px -2px 1px rgba(0, 0, 0, 0.3), inset 0px 2px 1px rgba(255, 255, 255, 0.1)"
          }}
        >
          <div
            className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              isMainnet ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-zinc-200 shadow-[0_0_6px_rgba(255,255,255,0.6)]"
            )}
          />
          <span>{networkLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="min-w-[160px] p-1.5 bg-zinc-900 dark:bg-zinc-800 border-zinc-700"
        style={{ 
          fontFamily: "var(--font-pixel), var(--font-press-start), monospace",
          letterSpacing: "0.03em"
        }}
      >
        <DropdownMenuItem
          onClick={() => handleNetworkChange(WalletAdapterNetwork.Mainnet)}
          disabled
          className={cn(
            "flex items-center justify-between py-2 px-3 text-xs uppercase cursor-pointer rounded-sm",
            "text-zinc-400 opacity-50",
            isMainnet && "bg-zinc-800/50"
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Mainnet</span>
          </div>
          {isMainnet && <Check className="h-4 w-4 text-emerald-400" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleNetworkChange(WalletAdapterNetwork.Devnet)}
          className={cn(
            "flex items-center justify-between py-2 px-3 text-xs uppercase cursor-pointer rounded-sm",
            "text-white hover:bg-zinc-700/50 transition-colors",
            !isMainnet && "bg-zinc-800/50"
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-zinc-200" />
            <span>Devnet</span>
          </div>
          {!isMainnet && <Check className="h-4 w-4 text-zinc-200" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};