import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getUserShardStatus, getUserLevel, type UserShardStatus, type UserLevel } from "../../utils/api";

export function useUserLevelData() {
  const { connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user shard status for shard card
  const {
    data: shardStatus,
    isLoading: isLoadingShards,
    error: shardError,
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
  } = useQuery<UserLevel | null>({
    queryKey: ["userLevel", publicKey?.toString()],
    queryFn: () => getUserLevel(publicKey!.toString()),
    enabled: !!connected && !!publicKey && mounted,
    staleTime: 3 * 1000, // 3s stale time for faster updates
    refetchInterval: 10 * 1000, // Refetch every 10s to catch updates faster
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Always refetch when component mounts
    retry: false, // Don't retry on error to avoid repeated JSON parse errors
  });

  return {
    shardStatus: shardStatus ?? null,
    userLevel: userLevel ?? null,
    isLoading: isLoadingShards || isLoadingLevel,
    error: shardError || levelError,
    connected,
    mounted,
  };
}

