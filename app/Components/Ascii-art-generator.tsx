"use client";
import { useAsciiStore } from "./store/ascii-store";
import { AsciiActions } from "./AsciiActions";
import { MintButton } from "./MintButton";
import { UserLevelCard } from "./UserLevelCard";
import { AsciiCanvas } from "./AsciiCanvas";
import { useUserLevelData } from "./hooks/useUserLevelData";

const AsciiGenerator = () => {
  const { asciiOutput, zoom } = useAsciiStore();
  const { shardStatus, userLevel, isLoading, error, connected, mounted } = useUserLevelData();

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-background flex justify-center">
      <div className="w-full max-w-3xl flex flex-col">
        <div className="flex flex-col gap-8">
          {/* User Shard Card - shown when wallet is connected */}
          {connected && mounted && (
            <UserLevelCard 
              level={userLevel}
              isLoading={isLoading} 
              shardStatus={shardStatus} 
              error={error} 
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
