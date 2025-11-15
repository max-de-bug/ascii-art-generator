"use client";

import { useMemo, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  LedgerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useNetwork } from "./network-provider";

// Import wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";

interface WalletContextProviderProps {
  children: ReactNode;
}

export function WalletContextProvider({
  children,
}: WalletContextProviderProps) {
  // Get network from NetworkProvider
  const { network } = useNetwork();
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // Configure wallets - ensure no duplicates
  const wallets = useMemo(() => {
    const walletAdapters = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
    ];
    
    // Deduplicate wallets by name to prevent React key conflicts
    const uniqueWallets = walletAdapters.filter(
      (wallet, index, self) =>
        index === self.findIndex((w) => w.name === wallet.name)
    );
    
    return uniqueWallets;
  }, []);

  return (
    <ConnectionProvider 
      endpoint={endpoint} 
      config={{ commitment: "confirmed" }}
      key={network}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect
        key={network} // Ensure WalletProvider remounts with network change
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
