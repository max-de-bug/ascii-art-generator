import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { UserLevel } from './user-level.entity';

/**
 * User Entity
 * Stores general user information identified by wallet address
 */
@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 44 })
  walletAddress: string; // User's wallet address (Pubkey) - primary identifier

  @Column({ type: 'varchar', length: 100, nullable: true })
  displayName: string | null; // Optional display name

  @Column({ type: 'text', nullable: true })
  bio: string | null; // Optional bio/description

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null; // Optional avatar URL

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null; // Optional email (if user provides)

  @Column({ type: 'json', nullable: true })
  preferences: Record<string, any> | null; // User preferences/settings

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationship to UserLevel (one-to-one, shared primary key)
  @OneToOne(() => UserLevel, (userLevel) => userLevel.user, {
    cascade: false,
  })
  @JoinColumn({ name: 'walletAddress' })
  userLevel?: UserLevel;
}
