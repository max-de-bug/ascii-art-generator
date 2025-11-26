/**
 * ZENITH Shard System
 *
 * A shard-based progression system inspired by competitive achievement systems.
 * Users earn shards by completing specific achievements, and need 6 shards to attain ZENITH.
 */

import { UserLevel } from "../entities/user-level.entity";

/**
 * Shard types and their requirements
 * Each shard represents a different achievement path
 */
export const SHARD_CONFIG = [
  {
    id: 'quartz',
    name: 'Quartz Shard',
    emoji: '⚪',
    description: 'Mint 50 ASCII art NFTs',
    requirement: {
      type: 'mint_count',
      value: 50,
    },
    canBeLost: false,
    lossCondition: null,
  },
  {
    id: 'amethyst',
    name: 'Amethyst Shard',
    emoji: '🟣',
    description: 'Maintain a collection of at least 10 NFTs',
    requirement: {
      type: 'collection_size',
      value: 10,
    },
    canBeLost: true,
    lossCondition: {
      type: 'collection_size',
      value: 10,
      operator: 'below', // Lost if collection drops below 10
    },
  },
  {
    id: 'ruby',
    name: 'Ruby Shard',
    emoji: '🔴',
    description: 'Mint at least 5 NFTs in the last 30 days',
    requirement: {
      type: 'recent_mints',
      value: 5,
      days: 30,
    },
    canBeLost: true,
    lossCondition: {
      type: 'recent_mints',
      value: 5,
      days: 30,
      operator: 'below', // Lost if recent mints drop below 5
    },
  },
  {
    id: 'sapphire',
    name: 'Sapphire Shard',
    emoji: '🔵',
    description: 'Mint 100 total NFTs',
    requirement: {
      type: 'mint_count',
      value: 100,
    },
    canBeLost: false,
    lossCondition: null,
  },
  {
    id: 'emerald',
    name: 'Emerald Shard',
    emoji: '🟢',
    description: 'Mint 25 NFTs with unique ASCII art (no duplicates)',
    requirement: {
      type: 'unique_mints',
      value: 25,
    },
    canBeLost: false,
    lossCondition: null,
  },
  {
    id: 'obsidian',
    name: 'Obsidian Shard',
    emoji: '⚫',
    description: 'Mystery - Rare achievement',
    requirement: {
      type: 'mystery',
      value: null, // Hidden criteria
    },
    canBeLost: false,
    lossCondition: null,
  },
] as const;

/**
 * Shard requirement types
 */
export type ShardRequirementType =
  | 'mint_count'
  | 'collection_size'
  | 'recent_mints'
  | 'unique_mints'
  | 'special_event'
  | 'mystery';

/**
 * Shard data structure
 */
export interface Shard {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earned: boolean;
  earnedAt?: Date;
  canBeLost: boolean;
}

/**
 * User shard status
 */
export interface UserShardStatus {
  shards: Shard[];
  totalShards: number;
  hasZenith: boolean;
  shardsNeededForZenith: number;
}

/**
 * User statistics for shard eligibility checking
 */
export interface UserStats {
  totalMints: number;
  collectionSize: number;
  recentMints: number; // Mints in last 30 days
  uniqueMints: number; // NFTs with unique ASCII art
  mintHistory: Date[]; // Dates of all mints
}

/**
 * Check if user is eligible for a specific shard
 */
export function checkShardEligibility(
  shardId: string,
  userStats: UserStats,
): boolean {
  const shard = SHARD_CONFIG.find((s) => s.id === shardId);
  if (!shard) return false;

  const req = shard.requirement;

  switch (req.type) {
    case 'mint_count':
      return userStats.totalMints >= req.value;

    case 'collection_size':
      return userStats.collectionSize >= req.value;

    case 'recent_mints':
      return userStats.recentMints >= req.value;

    case 'unique_mints':
      return userStats.uniqueMints >= req.value;
    default:
      return false;
  }
}

/**
 * Check if a shard should be lost based on loss conditions
 */
export function checkShardLoss(
  shardId: string,
  userStats: UserStats,
): boolean {
  const shard = SHARD_CONFIG.find((s) => s.id === shardId);
  if (!shard || !shard.canBeLost || !shard.lossCondition) return false;

  const condition = shard.lossCondition;

  switch (condition.type) {
    case 'collection_size':
      if (condition.operator === 'below') {
        return userStats.collectionSize < condition.value;
      }
      break;

    case 'recent_mints':
      if (condition.operator === 'below') {
        return userStats.recentMints < condition.value;
      }
      break;

    default:
      return false;
  }

  return false;
}

/**
 * Calculate user's shard status
 */
export function calculateShardStatus(
  userStats: UserStats,
  earnedShards: string[] = [], // Array of shard IDs user has earned
): UserShardStatus {
  const shards: Shard[] = SHARD_CONFIG.map((config) => {
    const isEarned = earnedShards.includes(config.id);

    // Check if shard should be lost
    let shouldHaveShard = isEarned;
    if (isEarned && config.canBeLost) {
      shouldHaveShard = !checkShardLoss(config.id, userStats);
    }

    // Check if user is eligible for shard (if not already earned)
    const isEligible = shouldHaveShard || checkShardEligibility(config.id, userStats);

    return {
      id: config.id,
      name: config.name,
      emoji: config.emoji,
      description: config.description,
      earned: isEligible && shouldHaveShard,
      canBeLost: config.canBeLost,
    };
  });

  const totalShards = shards.filter((s) => s.earned).length;
  const requiredShards = 6;
  const hasZenith = totalShards >= requiredShards;
  const shardsNeededForZenith = Math.max(0, requiredShards - totalShards);

  return {
    shards,
    totalShards,
    hasZenith,
    shardsNeededForZenith,
  };
}

/**
 * Get shard configuration by ID
 */
export function getShardConfig(shardId: string) {
  return SHARD_CONFIG.find((s) => s.id === shardId);
}

/**
 * Get all shard configurations
 */
export function getAllShardConfigs() {
  return SHARD_CONFIG;
}

/**
 * Check if user has ZENITH status
 */
export function hasZenith(status: UserShardStatus): boolean {
  return status.hasZenith;
}


export function calculateLevel(mintCount: number): UserLevel {
  // Return minimal data - level progression is now handled by shards
  // This is kept only for database schema compatibility
  return {
    walletAddress: '',
    totalMints: mintCount,
    level: 1,
    experience: mintCount,
    nextLevelMints: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  };
}

