"use client";

import { NetworkIcon, Check } from "lucide-react";
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
      <div className="h-10 w-[140px] bg-muted animate-pulse rounded-md" />
    );
  }

  const isMainnet = network === WalletAdapterNetwork.Mainnet;
  const networkLabel = isMainnet ? "Mainnet" : "Devnet";

  const pixelFontStyle = {
    fontFamily: "Retro-computer, 'Courier New', monospace",
    fontWeight: 600,
    letterSpacing: "0.05em",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 hover:bg-primary/10 transition-colors duration-300 cursor-pointer" style={pixelFontStyle}>
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isMainnet ? "bg-primary" : "bg-orange-500"
            )}
          />
          <NetworkIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{networkLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="min-w-[180px] p-2"
        style={pixelFontStyle}
      >
        <DropdownMenuItem
          onClick={() => handleNetworkChange(WalletAdapterNetwork.Mainnet)}
          disabled
          className="flex items-center justify-between py-2.5 px-3 text-base"
        >
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="font-semibold">Mainnet</span>
          </div>
          {isMainnet && <Check className="h-5 w-5" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleNetworkChange(WalletAdapterNetwork.Devnet)}
          className="flex items-center justify-between py-2.5 px-3 text-base"
        >
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="font-semibold">Devnet</span>
          </div>
          {!isMainnet && <Check className="h-5 w-5" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};