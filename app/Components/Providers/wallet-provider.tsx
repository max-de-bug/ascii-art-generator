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

// Suppress MetaMask and duplicate wallet key errors
// These are non-critical warnings from wallet adapter detecting multiple wallet sources
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // Suppress MetaMask connection errors (non-critical for Solana wallets)
    if (message.includes('MetaMask') || message.includes('Failed to connect to MetaMask')) {
      return;
    }
    // Suppress duplicate key warnings for wallet adapters (browser may register same wallet twice)
    if (message.includes('Encountered two children with the same key') && 
        (message.includes('MetaMask') || message.includes('wallet'))) {
      return;
    }
    originalError.apply(console, args);
  };
}

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
