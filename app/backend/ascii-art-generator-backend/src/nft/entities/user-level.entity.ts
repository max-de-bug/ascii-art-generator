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
 * UserLevel Entity
 * Tracks user level and experience based on NFT mints
 *
 * Note: Level calculation logic is in src/nft/utils/level-calculator.ts
 */
@Entity('user_levels')
export class UserLevel {
  @PrimaryColumn({ type: 'varchar', length: 44, name: 'wallet_address' })
  walletAddress: string; // User's wallet address (Pubkey)

  @Column({ type: 'int', default: 0, name: 'total_mints' })
  totalMints: number; // Total number of NFTs minted

  @Column({ type: 'int', default: 1 })
  level: number; // Current level (1-10)

  @Column({ type: 'int', default: 0 })
  experience: number; // Current experience points

  @Column({ type: 'int', default: 5, name: 'next_level_mints' })
  nextLevelMints: number; // Mints needed for next level

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @VersionColumn({ default: 1 })
  version: number; // Optimistic locking version

  // Relationship to User (one-to-one, shared primary key)
  @OneToOne(() => User, (user) => user.userLevel, {
    cascade: false,
  })
  user?: User;
}
