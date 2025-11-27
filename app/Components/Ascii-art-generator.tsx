"use client";
import { useAsciiStore } from "./store/ascii-store";
import { AsciiActions } from "./AsciiActions";
import { MintButton } from "./MintButton";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, memo } from "react";
import { getUserShardStatus, type UserShardStatus } from "../utils/api";
import { UserLevelCard } from "./UserLevelCard";
import { getUserLevel, type UserLevel } from "../utils/api";
import { useSphereAnimation } from "./hooks/useSphereAnimation";

// Memoized canvas component to prevent unnecessary rerenders
const AsciiCanvas = memo(({ asciiOutput, zoom }: { asciiOutput: string; zoom: number[] }) => {
  const fontSize = useMemo(() => `${(zoom[0] / 100) * 12}px`, [zoom]);
  const showAnimation = !asciiOutput;
  const { frame: sphereFrame, textFrame, isInitialized } = useSphereAnimation(showAnimation, "O.ASCII Art generator");
  
  return (
    <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden flex items-center justify-center">
      <div className="overflow-auto w-full h-full p-8 flex items-center justify-center">
        <pre
          className="font-mono text-foreground leading-tight whitespace-pre select-all text-center"
          style={{
            fontSize,
            fontFamily: '"Geist Mono", monospace',
            fontWeight: 600,
            letterSpacing: "-0.5px",
            lineHeight: "1.1",
          }}
        >
          {asciiOutput ? (
            <code>{asciiOutput}</code>
          ) : isInitialized && sphereFrame ? (
            <code>
              {sphereFrame}
              <br />
              <br />
              {textFrame}
            </code>
          ) : (
            <span className="text-muted-foreground/40">
              Generate ASCII art
            </span>
          )}
        </pre>
      </div>
    </div>
  );
});

AsciiCanvas.displayName = "AsciiCanvas";

const AsciiGenerator = () => {
  const { asciiOutput, zoom } = useAsciiStore();
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
  } = useQuery<UserLevel | null>({
    queryKey: ["userLevel", publicKey?.toString()],
    queryFn: () => getUserLevel(publicKey!.toString()),
    enabled: !!connected && !!publicKey && mounted,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: false, // Don't retry on error to avoid repeated JSON parse errors
  });

  const isLoading = isLoadingShards || isLoadingLevel;
  const error = shardError || levelError;
  const refetch = () => {
    refetchShards();
    refetchLevel();
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-background flex justify-center">
      <div className="w-full max-w-3xl flex flex-col">
        <div className="flex flex-col gap-8">
          {/* User Shard Card - shown when wallet is connected */}
          {connected && mounted && (
            <UserLevelCard 
              level={userLevel ?? null}
              isLoading={isLoading} 
              shardStatus={shardStatus ?? null} 
              error={error} 
              refetch={refetch} 
            />
          )}
          
          <AsciiActions asciiOutput={asciiOutput} />
          <div>
            <h1 
              className="text-4xl font-bold text-foreground mb-2"
              style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, letterSpacing: "0.05em" }}
            >
              ASCII Art
            </h1>
            <p 
              className="text-muted-foreground text-sm"
              style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", letterSpacing: "0.03em" }}
            >
              Your generated artwork
            </p>
          </div>

          <AsciiCanvas asciiOutput={asciiOutput} zoom={zoom} />
        </div>
        <MintButton />
      </div>
    </main>
  );
};

export default AsciiGenerator;
