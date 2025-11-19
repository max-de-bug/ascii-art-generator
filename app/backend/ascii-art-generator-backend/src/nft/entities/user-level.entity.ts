import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  VersionColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * User Level Entity
 * Tracks user level based on NFT mint count
 */
@Entity('user_levels')
export class UserLevel {
  @PrimaryColumn({ type: 'varchar', length: 44 })
  walletAddress: string; // User's wallet address (Pubkey)

  @Column({ type: 'int', default: 0 })
  totalMints: number; // Total number of NFTs minted

  @Column({ type: 'int', default: 1 })
  level: number; // Current level (1-10)

  @Column({ type: 'int', default: 0 })
  experience: number; // Current experience points

  @Column({ type: 'int', default: 5 })
  nextLevelMints: number; // Mints needed for next level

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @VersionColumn({ default: 1 })
  version: number; // Optimistic locking version

  // Relationship to User (one-to-one, shared primary key)
  @OneToOne(() => User, (user) => user.userLevel, {
    cascade: false,
  })
  user?: User;
}

/**
 * Level configuration
 * Define how many mints are needed for each level
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
  { level: 10, mintsRequired: 1000 }, // Level 10: 1000+ mints
];

/**
 * Calculate level based on mint count
 */
export function calculateLevel(mintCount: number): {
  level: number;
  experience: number;
  nextLevelMints: number;
} {
  for (let i = LEVEL_CONFIG.length - 1; i >= 0; i--) {
    if (mintCount >= LEVEL_CONFIG[i].mintsRequired) {
      const currentLevel = LEVEL_CONFIG[i].level;
      const nextLevel = i < LEVEL_CONFIG.length - 1 ? LEVEL_CONFIG[i + 1].level : currentLevel;
      const nextLevelMints = i < LEVEL_CONFIG.length - 1 ? LEVEL_CONFIG[i + 1].mintsRequired : mintCount;
      const experience = mintCount - LEVEL_CONFIG[i].mintsRequired;
      const experienceNeeded = i < LEVEL_CONFIG.length - 1
        ? LEVEL_CONFIG[i + 1].mintsRequired - LEVEL_CONFIG[i].mintsRequired
        : 1;

      return {
        level: currentLevel,
        experience,
        nextLevelMints: nextLevelMints - mintCount,
      };
    }
  }

  return {
    level: 1,
    experience: mintCount,
    nextLevelMints: 5 - mintCount,
  };
}

