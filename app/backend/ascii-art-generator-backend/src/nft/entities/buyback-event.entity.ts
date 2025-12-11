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
export class BuybackEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 88, unique: true, name: 'transaction_signature' })
  @Index()
  transactionSignature: string; // Transaction signature

  @Column({ type: 'bigint', name: 'amount_sol' })
  amountSol: number; // Amount of SOL swapped (in lamports)

  @Column({ type: 'bigint', name: 'token_amount' })
  tokenAmount: number; // Amount of tokens received (in token's smallest unit)

  @Column({ type: 'bigint' })
  @Index()
  timestamp: number; // Unix timestamp from event

  @Column({ type: 'bigint' })
  slot: number; // Solana slot number

  @Column({ type: 'bigint', nullable: true, name: 'block_time' })
  blockTime: number | null; // Block time from transaction

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
