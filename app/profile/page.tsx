"use client";

import { PageLayout } from "../Components/PageLayout";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Loader2, Trophy, Image as ImageIcon } from "lucide-react";
import { getUserProfile, type UserProfile } from "../utils/api";
import Link from "next/link";

export default function ProfilePage() {
  const { connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use TanStack Query for data fetching
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery<UserProfile>({
    queryKey: ["userProfile", publicKey?.toString()],
    queryFn: () => getUserProfile(publicKey!.toString()),
    enabled: !!connected && !!publicKey && mounted,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute to catch new mints
  });

  const nfts = profile?.nfts || [];
  const userLevel = profile?.userLevel || null;

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
        <main className="flex-1 p-6 space-y-6">
          <h1 className="text-3xl font-bold">Profile</h1>

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
            <>
              {/* Wallet Address Card */}
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Wallet Address
                </p>
                <p className="font-mono text-sm break-all">
                  {publicKey?.toString()}
                </p>
              </div>

              {/* User Level Card */}
              {isLoading ? (
                <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : userLevel ? (
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-3">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">Level {userLevel.level}</h2>
                        <p className="text-sm text-muted-foreground">
                          {userLevel.totalMints} NFTs minted
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Next level in
                      </p>
                      <p className="text-lg font-semibold">
                        {userLevel.nextLevelMints} mints
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-muted rounded-full h-2 mb-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (userLevel.experience / Math.max(userLevel.nextLevelMints, 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {userLevel.experience} / {userLevel.nextLevelMints + userLevel.experience} experience
                  </p>
                </div>
              ) : null}

              {/* Error Message */}
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">
                    {error instanceof Error
                      ? error.message
                      : "Failed to load profile"}
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="mt-2 text-sm text-primary hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* NFT Collection */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Your ASCII Art Collection
                </h2>

                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border bg-card p-4 animate-pulse"
                      >
                        <div className="aspect-square bg-muted rounded-lg mb-3" />
                        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : nfts.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-8 text-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-2">
                      No NFTs minted yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Start minting ASCII art to build your collection!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nfts.map((nft) => (
                      <Link
                        key={nft.mint}
                        href={`https://solscan.io/token/${nft.mint}?cluster=mainnet-beta`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-border bg-card p-4 hover:border-primary transition-colors"
                      >
                        <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                          <ImageIcon className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold mb-1 truncate">{nft.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {nft.symbol}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {new Date(nft.blockTime ? nft.blockTime * 1000 : nft.createdAt).toLocaleDateString()}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </PageLayout>
  );
}
