"use client";

import { PageLayout } from "../Components/PageLayout";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet} from "lucide-react";
import { getUserProfile, type UserProfile } from "../utils/api";
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
              <WalletAddressCard publicKey={publicKey} />

              {/* User Level Card */}
              <UserLevelCard isLoading={isLoading} userLevel={userLevel} error={error} refetch={refetch} />

              {/* NFT Collection */}
              <NFTCollection isLoading={isLoading} nfts={nfts} />
            </>
          )}
        </main>
      </div>
    </PageLayout>
  );
}
