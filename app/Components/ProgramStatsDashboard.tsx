"use client";

import { useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useNetwork } from "./Providers/network-provider";
import { getProgramId } from "./utils/network-config";
import { fetchProgramStats, formatLamportsToSol, formatNumber } from "./utils/fetch-program-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const ProgramStatsDashboard = () => {
  const { connection } = useConnection();
  const { network } = useNetwork();
  const programId = getProgramId(network);

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["programStats", programId.toString(), network],
    queryFn: () => fetchProgramStats(connection, programId),
    enabled: !!connection && !!programId,
    staleTime: 30 * 1000, // Refresh every 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Program Statistics</CardTitle>
          <CardDescription>Loading statistics from blockchain...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Program Statistics</CardTitle>
          <CardDescription>Error loading statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load statistics"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Program Statistics</CardTitle>
          <CardDescription>Program not initialized</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The program configuration has not been initialized yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Program Statistics</CardTitle>
          <CardDescription>
            Real-time statistics from the on-chain program
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Mints */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total NFTs Minted</p>
              <p className="text-2xl font-bold">{formatNumber(stats.totalMints)}</p>
            </div>

            {/* Total Fees Collected */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Fees Collected</p>
              <p className="text-2xl font-bold">{formatLamportsToSol(stats.totalFeesCollected)} SOL</p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(stats.totalFeesCollected)} lamports
              </p>
            </div>

            {/* Total Buybacks */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Buybacks</p>
              <p className="text-2xl font-bold">{formatNumber(stats.totalBuybacksExecuted)}</p>
            </div>

            {/* Total Tokens Bought Back */}
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Tokens Bought</p>
              <p className="text-2xl font-bold">{formatNumber(stats.totalTokensBoughtBack)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Details */}
      <Card>
        <CardHeader>
          <CardTitle>Program Configuration</CardTitle>
          <CardDescription>Current program settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Mint Fee</p>
              <p className="text-lg font-semibold">{formatLamportsToSol(stats.mintFee)} SOL</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Min Buyback Amount</p>
              <p className="text-lg font-semibold">{formatLamportsToSol(stats.minBuybackAmount)} SOL</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Authority</p>
              <p className="text-sm font-mono break-all">{stats.authority}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Treasury</p>
              <p className="text-sm font-mono break-all">{stats.treasury}</p>
            </div>

            <div className="space-y-1 md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">Buyback Token Mint</p>
              <p className="text-sm font-mono break-all">{stats.buybackTokenMint}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};



