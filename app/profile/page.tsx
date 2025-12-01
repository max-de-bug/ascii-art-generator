"use client";

import { PageLayout } from "../Components/PageLayout";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet} from "lucide-react";
import { getUserProfile, getUserShardStatus, type UserProfile, type UserShardStatus, type UserLevel } from "../utils/api";
import { UserLevelCard } from "../Components/UserLevelCard";
import { NFTCollection } from "../Components/NFTCollection";
import { WalletAddressCard } from "../Components/walletAddressCard";

export default function ProfilePage() {
  const { connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user profile for NFTs (includes userLevel, so no separate call needed)
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useQuery<UserProfile>({
    queryKey: ["userProfile", publicKey?.toString()],
    queryFn: () => getUserProfile(publicKey!.toString()),
    enabled: !!connected && !!publicKey && mounted,
    staleTime: 3 * 1000, // Reduced to 3s for faster updates
    refetchInterval: 10 * 1000, // Reduced to 10s to catch updates faster
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Always refetch when component mounts
    gcTime: 5 * 60 * 1000, // Keep cached data for 5 minutes
  });

  // Fetch user shard status (fetched in parallel with profile)
  const {
    data: shardStatus,
    isLoading: isLoadingShards,
    error: shardError,
  } = useQuery<UserShardStatus>({
    queryKey: ["userShardStatus", publicKey?.toString()],
    queryFn: () => getUserShardStatus(publicKey!.toString()),
    enabled: !!connected && !!publicKey && mounted,
    staleTime: 3 * 1000, // Reduced to 3s for faster updates
    refetchInterval: 10 * 1000, // Reduced to 10s to catch updates faster
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Always refetch when component mounts
    gcTime: 5 * 60 * 1000, // Keep cached data for 5 minutes
  });

  // Extract userLevel from profile (no separate API call needed)
  const userLevel = profile?.userLevel || null;

  const nfts = profile?.nfts || [];
  const isLoading = isLoadingProfile || isLoadingShards;
  const error = profileError || shardError;

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
              <WalletAddressCard publicKey={publicKey} />

              {/* User Shard Card */}
              <UserLevelCard 
                isLoading={isLoadingShards || isLoadingProfile} 
                shardStatus={shardStatus || null} 
                level={userLevel}
                error={error} 
              />

              {/* NFT Collection */}
              <NFTCollection isLoading={isLoading} nfts={nfts} />
            </>
          )}
        </main>
      </div>
    </PageLayout>
  );
}
