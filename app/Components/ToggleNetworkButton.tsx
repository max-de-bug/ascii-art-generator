"use client";

import { NetworkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetwork } from "./Providers/network-provider";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const ToggleNetworkButton = () => {
  const { network, toggleNetwork } = useNetwork();
  const { disconnect, connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = async () => {
    const newNetwork =
      network === WalletAdapterNetwork.Mainnet
        ? WalletAdapterNetwork.Devnet
        : WalletAdapterNetwork.Mainnet;
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
      <Button variant="outline" disabled>
        <NetworkIcon />
        <span>Switch Network</span>
      </Button>
    );
  }

  const networkLabel =
    network === WalletAdapterNetwork.Mainnet ? "Mainnet" : "Devnet";

  return (
    <Button variant="outline" onClick={handleToggle} disabled>
      <NetworkIcon className="mr-2 h-4 w-4" />
      <span>{networkLabel}</span>
    </Button>
  );
};