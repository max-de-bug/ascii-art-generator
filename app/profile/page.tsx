"use client";

import { PageLayout } from "../components/PageLayout";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";

export default function ProfilePage() {
  const { connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <PageLayout>
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 p-6">
            <div className="h-96 bg-muted animate-pulse rounded-lg" />
          </main>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-6">
          <h1 className="text-3xl font-bold mb-6">Profile</h1>

          {!connected ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
              <div className="rounded-full bg-muted p-6">
                <Wallet className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Connect Your Wallet</h2>
                <p className="text-muted-foreground max-w-md">
                  To view your ASCII art collection and manage your profile,
                  please connect your Solana wallet.
                </p>
              </div>
              <div className="wallet-adapter-button-wrapper">
                <WalletMultiButton />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Wallet Address
                </p>
                <p className="font-mono text-sm break-all">
                  {publicKey?.toString()}
                </p>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Your ASCII Art Collection
                </h2>
                <p className="text-muted-foreground">
                  Your saved ASCII art pieces will appear here.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </PageLayout>
  );
}
