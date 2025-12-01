import { UserLevel, UserShardStatus } from "../../utils/api";

/**
 * Calculate shard progress percentage
 */
export function calculateShardProgress(shardStatus: UserShardStatus | null): number {
  return shardStatus ? (shardStatus.totalShards / 6) * 100 : 0;
}

/**
 * Calculate level progress percentage
 * Progress is based on experience (mints in current level) vs total mints needed for next level
 * 
 * Formula: experience / (experience + nextLevelMints) * 100
 * 
 * Example:
 * - 1 mint: experience=1, nextLevelMints=4 → 1/5 = 20%
 * - 2 mints: experience=2, nextLevelMints=3 → 2/5 = 40%
 * - 3 mints: experience=3, nextLevelMints=2 → 3/5 = 60%
 * - 4 mints: experience=4, nextLevelMints=1 → 4/5 = 80%
 * - 5 mints: experience=0, nextLevelMints=5 → 0/5 = 0% (level up!)
 */
export function calculateLevelProgress(level: UserLevel | null): number {
  if (!level) return 0;
  
  // If already at max level or nextLevelMints is 0, show 100%
  if (level.nextLevelMints === 0) {
    return 100;
  }
  
  // Calculate progress: experience / (experience + nextLevelMints) * 100
  // This shows how much of the current level is completed
  const totalMintsForNextLevel = level.experience + level.nextLevelMints;
  
  if (totalMintsForNextLevel === 0) {
    return 0;
  }
  
  const progress = (level.experience / totalMintsForNextLevel) * 100;
  
  // Ensure progress is between 0 and 100
  return Math.min(Math.max(progress, 0), 100);
}

/**
 * Get earned shards from shard status
 */
export function getEarnedShards(shardStatus: UserShardStatus | null) {
  return shardStatus?.shards.filter(s => s.earned) || [];
}

/**
 * Information about the next shard that can be earned based on mint count
 */
export interface NextShardInfo {
  shardName: string;
  shardEmoji: string;
  mintsNeeded: number;
}

/**
 * Calculate mints needed for next shard based on mint_count requirements
 * This matches the backend SHARD_CONFIG for mint_count type shards
 */
export function calculateMintsToNextShard(
  shardStatus: UserShardStatus | null,
  level: UserLevel | null
): NextShardInfo | null {
  if (!shardStatus || !level || shardStatus.hasZenith) {
    return null;
  }

  // All shards from backend that are based on mint_count (sorted by requirement value)
  // This matches the backend SHARD_CONFIG structure
  const mintCountShards = [
    { id: 'quartz', required: 50 },
    { id: 'sapphire', required: 100 },
  ];

  // Find the next unearned shard with mint_count requirement
  // Use the actual shard data from shardStatus which comes from backend
  for (const mintShard of mintCountShards) {
    const shardData = shardStatus.shards.find(s => s.id === mintShard.id);
    if (shardData && !shardData.earned && level.totalMints < mintShard.required) {
      const mintsNeeded = mintShard.required - level.totalMints;
      return {
        shardName: shardData.name.replace(' Shard', ''), // Remove " Shard" suffix
        shardEmoji: shardData.emoji,
        mintsNeeded,
      };
    }
  }

  return null;
}

