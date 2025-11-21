/**
 * Level Calculator Utility
 *
 * Calculates user levels based on NFT mint count
 * Separated from entity for better code organization
 */

/**
 * Level configuration
 * Defines mint requirements for each level
 */
export const LEVEL_CONFIG = [
  { level: 1, mintsRequired: 0 }, // Level 1: 0-4 mints
  { level: 2, mintsRequired: 5 }, // Level 2: 5-9 mints
  { level: 3, mintsRequired: 10 }, // Level 3: 10-19 mints
  { level: 4, mintsRequired: 20 }, // Level 4: 20-39 mints
  { level: 5, mintsRequired: 40 }, // Level 5: 40-79 mints
  { level: 6, mintsRequired: 80 }, // Level 6: 80-149 mints
  { level: 7, mintsRequired: 150 }, // Level 7: 150-249 mints
  { level: 8, mintsRequired: 250 }, // Level 8: 250-499 mints
  { level: 9, mintsRequired: 500 }, // Level 9: 500-999 mints
  { level: 10, mintsRequired: 1000 }, // Level 10: 1000+ mints (max level)
] as const;

/**
 * Result of level calculation
 */
export interface LevelCalculationResult {
  /** Current level (1-10) */
  level: number;
  /** Experience points in current level */
  experience: number;
  /** Mints needed to reach next level */
  nextLevelMints: number;
}

/**
 * Calculate user level based on total mint count
 *
 * @param mintCount - Total number of NFTs minted by the user
 * @returns Level calculation result with level, experience, and next level requirements
 *
 * @example
 * ```typescript
 * const result = calculateLevel(15);
 * // Returns: { level: 3, experience: 5, nextLevelMints: 5 }
 * // User is level 3 (10-19 mints), has 5 experience in this level, needs 5 more mints to reach level 4
 * ```
 */
export function calculateLevel(mintCount: number): LevelCalculationResult {
  // Iterate from highest level down to find appropriate level
  for (let i = LEVEL_CONFIG.length - 1; i >= 0; i--) {
    if (mintCount >= LEVEL_CONFIG[i].mintsRequired) {
      const currentLevelConfig = LEVEL_CONFIG[i];
      const nextLevelConfig = LEVEL_CONFIG[i + 1];
      const isMaxLevel = i === LEVEL_CONFIG.length - 1;

      if (isMaxLevel) {
        // Max level reached - no next level
        return {
          level: currentLevelConfig.level,
          experience: mintCount - currentLevelConfig.mintsRequired,
          nextLevelMints: 0, // No next level
        };
      }

      // Calculate experience within current level
      const experience = mintCount - currentLevelConfig.mintsRequired;

      // Calculate mints needed for next level
      const nextLevelMints = nextLevelConfig.mintsRequired - mintCount;

      return {
        level: currentLevelConfig.level,
        experience,
        nextLevelMints,
      };
    }
  }

  // Default: Level 1 (0-4 mints)
  return {
    level: 1,
    experience: mintCount,
    nextLevelMints: LEVEL_CONFIG[1].mintsRequired - mintCount, // 5 - mintCount
  };
}

/**
 * Get level configuration by level number
 *
 * @param level - Level number (1-10)
 * @returns Level configuration or null if level doesn't exist
 */
export function getLevelConfig(
  level: number,
): (typeof LEVEL_CONFIG)[number] | null {
  return LEVEL_CONFIG.find((config) => config.level === level) || null;
}

/**
 * Get maximum level
 *
 * @returns Maximum achievable level
 */
export function getMaxLevel(): number {
  return LEVEL_CONFIG[LEVEL_CONFIG.length - 1].level;
}

/**
 * Check if user leveled up
 *
 * @param oldMintCount - Previous mint count
 * @param newMintCount - New mint count
 * @returns True if user leveled up, false otherwise
 */
export function hasLeveledUp(
  oldMintCount: number,
  newMintCount: number,
): boolean {
  const oldLevel = calculateLevel(oldMintCount).level;
  const newLevel = calculateLevel(newMintCount).level;
  return newLevel > oldLevel;
}

/**
 * Get progress percentage to next level
 *
 * @param mintCount - Current mint count
 * @returns Progress percentage (0-100)
 */
export function getLevelProgress(mintCount: number): number {
  const result = calculateLevel(mintCount);

  if (result.nextLevelMints === 0) {
    return 100; // Max level reached
  }

  const totalMintsForLevel = result.experience + result.nextLevelMints;
  const progress = (result.experience / totalMintsForLevel) * 100;

  return Math.min(100, Math.max(0, progress));
}
