import { UserLevel, UserShardStatus } from "../../utils/api";

/**
 * Calculate shard progress percentage
 */
export function calculateShardProgress(shardStatus: UserShardStatus | null): number {
  return shardStatus ? (shardStatus.totalShards / 6) * 100 : 0;
}

/**
 * Calculate level progress percentage
 */
export function calculateLevelProgress(level: UserLevel | null): number {
  if (!level) return 0;
  
  if (level.nextLevelMints > 0) {
    return (level.experience / (level.experience + level.nextLevelMints)) * 100;
  }
  
  return level.nextLevelMints === 0 ? 100 : 0;
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

