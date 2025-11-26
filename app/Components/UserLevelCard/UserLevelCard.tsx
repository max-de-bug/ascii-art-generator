import { Loader2, Sparkles } from "lucide-react"
import { UserLevel, UserShardStatus } from "../../utils/api";
import {
  calculateShardProgress,
  calculateLevelProgress,
  getEarnedShards,
  calculateMintsToNextShard,
} from "./utils";

interface UserLevelCardProps {
    isLoading: boolean;
    shardStatus: UserShardStatus;
    error: Error | null;
    refetch: () => void;
    level: UserLevel | null;
}

export const UserLevelCard = ( { isLoading, shardStatus, error, refetch, level }: UserLevelCardProps ) => {
  const earnedShards = getEarnedShards(shardStatus);
  const shardProgress = calculateShardProgress(shardStatus);
  
  // Create default level when user has no NFTs (level 1, 0 mints)
  const defaultLevel: UserLevel = {
    walletAddress: '',
    totalMints: 0,
    level: 1,
    experience: 0,
    nextLevelMints: 5, // Default mints needed for next level
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const displayLevel = level || defaultLevel;
  const levelProgress = calculateLevelProgress(displayLevel);
  const nextShardInfo = calculateMintsToNextShard(shardStatus, displayLevel);

  return (
    <>
    {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : shardStatus ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Shards & Icon */}
            <div className="flex items-center gap-2.5">
              <div className="rounded-full bg-primary/10 p-1.5">
                {shardStatus.hasZenith ? (
                  <Sparkles className="h-4 w-4 text-primary" />
                ) : (
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {shardStatus.hasZenith ? 'ZENITH' : 'Shards'}
                  </span>
                  <span className="text-lg font-bold">
                    {shardStatus.totalShards}/6
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {earnedShards.slice(0, 6).map((shard) => (
                    <span key={shard.id} className="text-xs" title={shard.name}>
                      {shard.emoji}
                    </span>
                  ))}
                  {earnedShards.length === 0 && (
                    <span className="text-xs text-muted-foreground">No shards yet</span>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Dual Progress Bars */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Shard Progress */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">
                    {shardStatus.totalShards} of 6 shards
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {shardStatus.hasZenith 
                      ? 'ZENITH achieved!' 
                      : `${shardStatus.shardsNeededForZenith} to ZENITH`}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      shardStatus.hasZenith ? 'bg-primary' : 'bg-primary'
                    }`}
                    style={{
                      width: `${Math.min(shardProgress, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Level Progress - Always shown, even with 0 NFTs */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground">
                    Level {displayLevel.level} • {displayLevel.totalMints} mints
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {shardStatus.hasZenith 
                      ? 'ZENITH achieved!'
                      : nextShardInfo
                      ? `${nextShardInfo.mintsNeeded} mints to ${nextShardInfo.shardEmoji} ${nextShardInfo.shardName}`
                      : displayLevel.nextLevelMints > 0
                      ? `${displayLevel.nextLevelMints} to next level`
                      : 'Max level'}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all bg-secondary"
                    style={{
                      width: `${Math.min(levelProgress, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load profile"}
            </p>
            <button
              onClick={() => refetch()}
              className="text-xs text-primary hover:underline whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </>
  );
};

