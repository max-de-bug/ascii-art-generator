"use client";
import { useAsciiStore } from "./store/ascii-store";
import { AsciiActions } from "./AsciiActions";
import { MintButton } from "./MintButton";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getUserProfile, type UserProfile } from "../utils/api";
import { UserLevelCard } from "./UserLevelCard";

const AsciiGenerator = () => {
  const { asciiOutput, zoom } = useAsciiStore();
  const { connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user profile for level card
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery<UserProfile>({
    queryKey: ["userProfile", publicKey?.toString()],
    queryFn: () => getUserProfile(publicKey!.toString()),
    enabled: !!connected && !!publicKey && mounted,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const userLevel = profile?.userLevel || null;

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-background flex justify-center">
      <div className="w-full max-w-3xl flex flex-col">
        <div className="flex flex-col gap-8">
          {/* User Level Card - shown when wallet is connected */}
          {connected && mounted && (
            <UserLevelCard 
              isLoading={isLoading} 
              userLevel={userLevel} 
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

          <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden flex items-center justify-center">
            <div className="overflow-auto w-full h-full p-8 flex items-center justify-center">
              <pre
                className="font-mono text-foreground leading-tight whitespace-pre select-all text-center"
                style={{
                  fontSize: `${(zoom[0] / 100) * 12}px`,
                  fontFamily: '"Geist Mono", monospace',
                  fontWeight: 600,
                  letterSpacing: "-0.5px",
                  lineHeight: "1.1",
                }}
              >
                {asciiOutput ? (
                  <code>{asciiOutput}</code>
                ) : (
                  <span className="text-muted-foreground/40">
                    Generate ASCII art
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>
        <MintButton />
      </div>
    </main>
  );
};

export default AsciiGenerator;
