"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

type NetworkContextType = {
  network: WalletAdapterNetwork;
  setNetwork: (network: WalletAdapterNetwork) => void;
  toggleNetwork: () => void;
};

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

const NETWORK_STORAGE_KEY = "solana-network";

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<WalletAdapterNetwork>(() => {
    // Initialize from localStorage or default to mainnet
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
      if (stored === "devnet") {
        return WalletAdapterNetwork.Devnet;
      }
      if (stored === "mainnet") {
        return WalletAdapterNetwork.Mainnet;
      }
    }
    return WalletAdapterNetwork.Mainnet;
  });

  // Save to localStorage when network changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const networkString =
        network === WalletAdapterNetwork.Devnet ? "devnet" : "mainnet";
      localStorage.setItem(NETWORK_STORAGE_KEY, networkString);
    }
  }, [network]);

  const setNetwork = (newNetwork: WalletAdapterNetwork) => {
    setNetworkState(newNetwork);
  };

  const toggleNetwork = () => {
    setNetworkState((current) =>
      current === WalletAdapterNetwork.Mainnet
        ? WalletAdapterNetwork.Devnet
        : WalletAdapterNetwork.Mainnet
    );
  };

  return (
    <NetworkContext.Provider value={{ network, setNetwork, toggleNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}

