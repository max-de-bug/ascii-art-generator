import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Buyback Event Entity
 * Tracks buyback transactions when fees are swapped for buyback tokens
 */
@Entity('buyback_events')
@Index(['timestamp'])
@Index(['transactionSignature'], { unique: true })
export class BuybackEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 88, unique: true })
  @Index()
  transactionSignature: string; // Transaction signature

  @Column({ type: 'bigint' })
  amountSol: number; // Amount of SOL swapped (in lamports)

  @Column({ type: 'bigint' })
  tokenAmount: number; // Amount of tokens received (in token's smallest unit)

  @Column({ type: 'bigint' })
  @Index()
  timestamp: number; // Unix timestamp from event

  @Column({ type: 'bigint' })
  slot: number; // Solana slot number

  @Column({ type: 'bigint', nullable: true })
  blockTime: number | null; // Block time from transaction

  @CreateDateColumn()
  createdAt: Date;
}
