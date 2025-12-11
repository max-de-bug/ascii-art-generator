import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * NFT Entity
 * Represents a minted ASCII art NFT
 */
@Entity('nfts')
@Index(['mint'])
export class NFT {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 44, unique: true })
  mint: string; // Mint address (Pubkey)

  @Column({ type: 'varchar', length: 44 })
  @Index()
  minter: string; // Minter wallet address (Pubkey)

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  symbol: string;

  @Column({ type: 'text' })
  uri: string; // Metadata URI (IPFS)

  @Column({ type: 'varchar', length: 88, unique: true, name: 'transaction_signature' })
  @Index()
  transactionSignature: string;

  @Column({ type: 'bigint' })
  slot: number;

  @Column({ type: 'bigint', nullable: true, name: 'block_time' })
  blockTime: number | null;

  @Column({ type: 'bigint' })
  timestamp: number; // Unix timestamp from event

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
