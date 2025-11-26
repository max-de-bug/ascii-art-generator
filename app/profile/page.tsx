"use client";

import { PageLayout } from "../Components/PageLayout";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet} from "lucide-react";
import { getUserProfile, getUserShardStatus, getUserLevel, type UserProfile, type UserShardStatus, type UserLevel } from "../utils/api";
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

  // Fetch user profile for NFTs
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useQuery<UserProfile>({
    queryKey: ["userProfile", publicKey?.toString()],
    queryFn: () => getUserProfile(publicKey!.toString()),
    enabled: !!connected && !!publicKey && mounted,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Fetch user shard status
  const {
    data: shardStatus,
    isLoading: isLoadingShards,
    error: shardError,
    refetch: refetchShards,
  } = useQuery<UserShardStatus>({
    queryKey: ["userShardStatus", publicKey?.toString()],
    queryFn: () => getUserShardStatus(publicKey!.toString()),
    enabled: !!connected && !!publicKey && mounted,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Fetch user level
  const {
    data: userLevel,
    isLoading: isLoadingLevel,
    error: levelError,
    refetch: refetchLevel,
  } = useQuery<UserLevel>({
    queryKey: ["userLevel", publicKey?.toString()],
    queryFn: () => getUserLevel(publicKey!.toString()),
    enabled: !!connected && !!publicKey && mounted,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const nfts = profile?.nfts || [];
  const isLoading = isLoadingProfile || isLoadingShards || isLoadingLevel;
  const error = profileError || shardError || levelError;
  const refetch = () => {
    refetchShards();
    refetchLevel();
  };

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
                isLoading={isLoadingShards || isLoadingLevel} 
                shardStatus={shardStatus || null} 
                level={userLevel || null}
                error={error} 
                refetch={refetch} 
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
