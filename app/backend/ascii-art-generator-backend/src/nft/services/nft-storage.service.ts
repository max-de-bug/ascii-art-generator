import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey, Commitment } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { NFT } from '../entities/nft.entity';
import { UserLevel } from '../entities/user-level.entity';
import {
  calculateLevel,
  calculateShardStatus,
  UserStats,
  UserShardStatus,
} from '../utils/level-calculator';
import { BuybackEvent } from '../entities/buyback-event.entity';

/**
 * NFT Storage Service
 * Stores NFTs and user level data using TypeORM
 */
@Injectable()
export class NftStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NftStorageService.name);
  private connection: Connection;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Cleanup every 24 hours (less frequent)
  private readonly BATCH_SIZE = 50; // Process 50 NFTs at a time to avoid rate limits
  private readonly VERIFICATION_AGE_DAYS = 7; // Only check NFTs that haven't been verified in 7+ days

  constructor(
    @InjectRepository(NFT)
    private readonly nftRepository: Repository<NFT>,
    @InjectRepository(UserLevel)
    private readonly userLevelRepository: Repository<UserLevel>,
    @InjectRepository(BuybackEvent)
    private readonly buybackEventRepository: Repository<BuybackEvent>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    // Initialize Solana connection for ownership verification
    const network = this.configService.get<string>(
      'solana.network',
      'mainnet-beta',
    );
    const rpcUrl =
      network === 'devnet'
        ? this.configService.get<string>('solana.rpcUrlDevnet')
        : this.configService.get<string>('solana.rpcUrl');

    const commitment = this.configService.get<Commitment>(
      'solana.commitment',
      'confirmed',
    );

    if (rpcUrl) {
      this.connection = new Connection(rpcUrl, commitment);
      this.logger.log(
        `Initialized Solana connection for ownership verification. Network: ${network}, RPC: ${rpcUrl.substring(0, 30)}...`,
      );
    } else {
      this.logger.warn(
        'Solana RPC URL not configured. Ownership verification will be disabled.',
      );
    }
  }

  async onModuleInit() {
    // Start periodic cleanup of burned NFTs
    this.startCleanupInterval();
  }

  async onModuleDestroy() {
    this.stopCleanupInterval();
  }

  /**
   * Start periodic cleanup interval to remove burned NFTs from database
   */
  private startCleanupInterval(): void {
    if (this.cleanupIntervalId !== null) {
      return; // Already started
    }

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupBurnedNfts().catch((error) => {
        this.logger.error('[NftStorage] Error during burned NFTs cleanup:', error);
      });
    }, this.CLEANUP_INTERVAL_MS);

    this.logger.log(
      `[NftStorage] Started periodic cleanup of burned NFTs (every ${this.CLEANUP_INTERVAL_MS / 1000 / 60 / 60} hours)`,
    );
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      this.logger.log('[NftStorage] Stopped periodic cleanup of burned NFTs');
    }
  }

  /**
   * Clean up burned NFTs from database
   * Only checks NFTs that haven't been verified recently (older than VERIFICATION_AGE_DAYS)
   * This is more efficient than checking all NFTs every time
   */
  async cleanupBurnedNfts(): Promise<void> {
    if (!this.connection) {
      this.logger.warn(
        '[NftStorage] Solana connection not available. Skipping burned NFTs cleanup.',
      );
      return;
    }

    this.logger.log('[NftStorage] Starting cleanup of burned NFTs...');

    try {
      // Only check NFTs that haven't been verified recently
      // Use updatedAt as a proxy for "last verified" (it gets updated when we check ownership)
      const verificationThreshold = new Date();
      verificationThreshold.setDate(
        verificationThreshold.getDate() - this.VERIFICATION_AGE_DAYS,
      );

      let offset = 0;
      let totalRemoved = 0;
      let totalChecked = 0;
      let hasMore = true;

      while (hasMore) {
        // Only fetch NFTs that haven't been updated recently
        // This means they haven't been verified in a while
        const nfts = await this.nftRepository.find({
          where: {
            updatedAt: LessThan(verificationThreshold),
          },
          take: this.BATCH_SIZE,
          skip: offset,
          order: { updatedAt: 'ASC' }, // Check oldest first
        });

        if (nfts.length === 0) {
          hasMore = false;
          break; // No more NFTs to check
        }

        this.logger.debug(
          `[NftStorage] Checking batch of ${nfts.length} NFTs (offset: ${offset}, older than ${this.VERIFICATION_AGE_DAYS} days)`,
        );

        // Check ownership for each NFT in the batch
        const ownershipChecks = await Promise.all(
          nfts.map(async (nft) => {
            const isOwned = await this.isNftOwnedByWallet(nft.mint, nft.minter);
            // Update the NFT's updatedAt timestamp to mark it as verified
            // This prevents checking it again until VERIFICATION_AGE_DAYS passes
            if (isOwned) {
              nft.updatedAt = new Date();
              await this.nftRepository.save(nft);
            }
            return { nft, isOwned };
          }),
        );

        // Remove NFTs that are no longer owned
        const toRemove = ownershipChecks.filter((check) => !check.isOwned);

        if (toRemove.length > 0) {
          // Delete each NFT individually
          for (const check of toRemove) {
            await this.nftRepository.remove(check.nft);
            this.logger.log(
              `[NftStorage] Removed burned NFT: ${check.nft.mint} (${check.nft.name}) from minter: ${check.nft.minter}`,
            );
          }

          totalRemoved += toRemove.length;

          // Update user levels for affected minters
          // Use a database transaction to ensure atomicity
          const affectedMinters = new Set(
            toRemove.map((check) => check.nft.minter),
          );
          
          for (const minter of affectedMinters) {
            try {
              await this.recalculateUserLevel(minter);
              this.logger.log(
                `[NftStorage] ✓ Updated user level for minter: ${minter} after NFT removal`,
              );
            } catch (error) {
              this.logger.warn(
                `[NftStorage] Failed to update user level for minter: ${minter}`,
                error,
              );
            }
          }
        }

        totalChecked += nfts.length;
        offset += this.BATCH_SIZE;

        // Add a small delay between batches to avoid rate limits
        if (nfts.length === this.BATCH_SIZE) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        }

        // Limit total checks per run to avoid long-running operations
        if (totalChecked >= 1000) {
          this.logger.log(
            `[NftStorage] Reached check limit (1000 NFTs). Will continue in next run.`,
          );
          break;
        }
      }

      this.logger.log(
        `[NftStorage] ✓ Cleanup complete: Checked ${totalChecked} NFTs, removed ${totalRemoved} burned NFTs`,
      );
    } catch (error) {
      this.logger.error('[NftStorage] Error during burned NFTs cleanup:', error);
      throw error;
    }
  }

  /**
   * Save an NFT
   * Uses database transaction to ensure atomicity
   */
  async saveNft(nft: Partial<NFT>): Promise<NFT> {
    if (!nft.mint) {
      throw new Error('NFT mint address is required');
    }

    // Use database transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if NFT already exists
      const existing = await queryRunner.manager.findOne(NFT, {
        where: { mint: nft.mint },
      });

      if (existing) {
        // If NFT already exists, verify it's still owned by the minter
        // If not owned, we should remove it (it was burned/transferred)
        if (nft.minter) {
          const isOwned = await this.isNftOwnedByWallet(
            nft.mint,
            nft.minter,
          );
          if (!isOwned) {
            this.logger.log(
              `NFT ${nft.mint} exists in database but is no longer owned by ${nft.minter}, removing from database`,
            );
            await queryRunner.manager.remove(NFT, existing);
            await queryRunner.commitTransaction();
            await queryRunner.release();
            // Return null or throw to indicate it was removed
            throw new Error('NFT no longer owned, removed from database');
          }
        }
        this.logger.debug(`NFT already exists: ${nft.mint}`);
        await queryRunner.release();
        return existing;
      }

      // Save NFT (timestamps are handled by @CreateDateColumn and @UpdateDateColumn)
      this.logger.log(
        `[NftStorage] Saving new NFT: ${nft.mint} for minter: ${nft.minter}`,
      );
      const savedNft = await queryRunner.manager.save(NFT, nft);
      this.logger.log(
        `[NftStorage] NFT saved with ID: ${savedNft.id}, mint: ${savedNft.mint}`,
      );

      // Update user level within the same transaction
      if (nft.minter) {
        this.logger.log(
          `[NftStorage] Updating user level for minter: ${nft.minter}`,
        );
        await this.updateUserLevelInTransaction(queryRunner, nft.minter);
        this.logger.log(
          `[NftStorage] User level updated for minter: ${nft.minter}`,
        );
      }

      // Commit transaction
      await queryRunner.commitTransaction();
      this.logger.log(
        `[NftStorage] ✓ Successfully saved NFT: ${nft.mint} for minter: ${nft.minter}`,
      );

      return savedNft;
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error saving NFT ${nft.mint}`, error);
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  /**
   * Get NFT by mint address
   */
  async getNftByMint(mint: string): Promise<NFT | null> {
    return this.nftRepository.findOne({
      where: { mint },
    });
  }

  /**
   * Check if transaction signature was already processed
   * Checks both NFT and BuybackEvent tables
   */
  async isTransactionProcessed(transactionSignature: string): Promise<boolean> {
    const [nftCount, buybackCount] = await Promise.all([
      this.nftRepository.count({
        where: { transactionSignature },
      }),
      this.buybackEventRepository.count({
        where: { transactionSignature },
      }),
    ]);
    return nftCount > 0 || buybackCount > 0;
  }

  /**
   * Check if a specific NFT is currently owned by a wallet address
   */
  async isNftOwnedByWallet(
    mintAddress: string,
    walletAddress: string,
  ): Promise<boolean> {
    if (!this.connection) {
      this.logger.warn(
        `Solana connection not available for ownership verification. Returning false (not owned) for safety.`,
      );
      // If connection not available, return false to be safe (don't show NFTs we can't verify)
      return false;
    }

    try {
      const mint = new PublicKey(mintAddress);
      const owner = new PublicKey(walletAddress);

      // Get the associated token account address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mint,
        owner,
      );

      this.logger.debug(
        `Checking ownership: NFT ${mintAddress}, ATA: ${associatedTokenAddress.toString()}, Owner: ${walletAddress}`,
      );

      // Check if the token account exists and has balance
      const tokenAccount = await this.connection.getParsedAccountInfo(
        associatedTokenAddress,
        'confirmed',
      );

      if (!tokenAccount.value) {
        this.logger.log(
          `Token account ${associatedTokenAddress.toString()} does not exist for NFT ${mintAddress} - NOT OWNED (likely burned)`,
        );
        return false; // Account doesn't exist = not owned
      }

      // Check if account data exists (might be closed/burned)
      if (!tokenAccount.value.data) {
        this.logger.log(
          `Token account ${associatedTokenAddress.toString()} is closed (burned) for NFT ${mintAddress} - NOT OWNED`,
        );
        return false; // Account is closed = not owned
      }

      // Check if it's a token account and has balance > 0
      const parsedInfo = tokenAccount.value.data;
      if (
        'parsed' in parsedInfo &&
        parsedInfo.program === 'spl-token' &&
        parsedInfo.parsed.type === 'account'
      ) {
        const tokenInfo = parsedInfo.parsed.info;
        const tokenAmount = tokenInfo.tokenAmount;
        const tokenOwner = tokenInfo.owner;
        
        // CRITICAL: Verify the token account owner matches the wallet we're checking
        // This prevents false positives when NFT is transferred to another wallet
        const ownerMatches = tokenOwner === walletAddress;
        
        // Log full token account details
        this.logger.log(
          `Token account details for NFT ${mintAddress}: owner="${tokenOwner}", wallet="${walletAddress}", ownerMatches=${ownerMatches}, amount="${tokenAmount.amount}", decimals=${tokenAmount.decimals}, uiAmount=${tokenAmount.uiAmount}`,
        );

        // NFTs have amount = 1 and decimals = 0
        // Must check amount is exactly '1' (not '0' for burned NFTs)
        // AND verify the owner matches the wallet we're checking
        const isOwned =
          ownerMatches &&
          tokenAmount.decimals === 0 &&
          tokenAmount.amount === '1' &&
          tokenAmount.uiAmount === 1 &&
          tokenAmount.uiAmountString === '1';

        if (isOwned) {
          this.logger.log(
            `✓ NFT ${mintAddress} is OWNED by ${walletAddress}`,
          );
        } else {
          if (!ownerMatches) {
            this.logger.log(
              `✗ NFT ${mintAddress} is NOT OWNED by ${walletAddress} - token account owner is "${tokenOwner}" (transferred)`,
            );
          } else {
            this.logger.log(
              `✗ NFT ${mintAddress} is NOT OWNED by ${walletAddress} - amount is "${tokenAmount.amount}" (expected "1")`,
            );
          }
        }

        return isOwned;
      }

      return false;
    } catch (error) {
      this.logger.warn(
        `Error verifying ownership for NFT ${mintAddress} by ${walletAddress}:`,
        error,
      );
      // On error, return false to be safe (don't show NFTs we can't verify)
      // This prevents showing NFTs when there's a connection issue
      return false;
    }
  }

  /**
   * Get all NFTs owned by a wallet address (filters out transferred/burned NFTs)
   */
  private async getOwnedNftMints(
    walletAddress: string,
  ): Promise<Set<string>> {
    if (!this.connection) {
      this.logger.warn(
        `Solana connection not available for ownership verification. Wallet: ${walletAddress}`,
      );
      // If connection not available, return empty set (will show no NFTs)
      return new Set();
    }

    try {
      const owner = new PublicKey(walletAddress);

      // Get all token accounts owned by this wallet
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        owner,
        {
          programId: TOKEN_PROGRAM_ID,
        },
      );

      // Extract mint addresses of NFTs (tokens with amount = 1 and decimals = 0)
      const ownedMints = new Set<string>();
      for (const accountInfo of tokenAccounts.value) {
        // Skip if account is closed (burned NFTs have closed token accounts)
        if (!accountInfo.account.data) {
          continue; // Account is closed/burned
        }

        const parsedInfo = accountInfo.account.data;
        if (
          'parsed' in parsedInfo &&
          parsedInfo.program === 'spl-token' &&
          parsedInfo.parsed.type === 'account'
        ) {
          const tokenAmount = parsedInfo.parsed.info.tokenAmount;
          // NFTs have amount = 1 and decimals = 0
          // Also check that amount is exactly '1' (not '0' for burned NFTs)
          if (
            tokenAmount.decimals === 0 &&
            tokenAmount.amount === '1' &&
            tokenAmount.uiAmount === 1 &&
            tokenAmount.uiAmountString === '1'
          ) {
            const mint = parsedInfo.parsed.info.mint;
            ownedMints.add(mint);
          } else {
            // Log if we found a token account with 0 amount (burned)
            if (tokenAmount.decimals === 0 && tokenAmount.amount === '0') {
              this.logger.debug(
                `Found burned NFT token account for mint: ${parsedInfo.parsed.info.mint}`,
              );
            }
          }
        }
      }

      this.logger.debug(
        `Found ${ownedMints.size} owned NFTs for wallet ${walletAddress} (checked ${tokenAccounts.value.length} token accounts)`,
      );
      return ownedMints;
    } catch (error) {
      this.logger.error(
        `Error fetching owned NFTs for wallet ${walletAddress}:`,
        error,
      );
      // On error, return empty set (will show no NFTs to be safe)
      return new Set();
    }
  }

  /**
   * Get all NFTs for a user (only NFTs still owned by the user)
   */
  async getNftsByMinter(minter: string): Promise<NFT[]> {
    // Get all NFTs minted by this user
    const allNfts = await this.nftRepository.find({
      where: { minter },
      order: { createdAt: 'DESC' }, // Sort by creation date (newest first)
    });

    this.logger.debug(
      `Found ${allNfts.length} total NFTs minted by ${minter} in database`,
    );

    if (allNfts.length === 0) {
      return [];
    }

    // Verify ownership for each NFT individually (more accurate than getting all token accounts)
    // This ensures we only check our specific NFTs, not NFTs from other collections
    this.logger.log(
      `Verifying ownership for ${allNfts.length} NFTs for wallet ${minter}`,
    );

    const ownershipChecks = await Promise.all(
      allNfts.map(async (nft) => {
        const owned = await this.isNftOwnedByWallet(nft.mint, minter);
        this.logger.log(
          `NFT ${nft.mint} (${nft.name}): Ownership check result = ${owned}`,
        );
        return { nft, owned };
      }),
    );

    // Log all results
    const ownedCount = ownershipChecks.filter((c) => c.owned).length;
    const notOwnedCount = ownershipChecks.filter((c) => !c.owned).length;
    this.logger.log(
      `Ownership verification complete: ${ownedCount} owned, ${notOwnedCount} not owned`,
    );

    // Separate owned and burned NFTs
    const burnedNfts = ownershipChecks
      .filter(({ owned }) => !owned)
      .map(({ nft }) => nft);

    // Immediately remove burned NFTs from database
    if (burnedNfts.length > 0) {
      this.logger.log(
        `[NftStorage] Removing ${burnedNfts.length} burned/transferred NFTs from database for ${minter}`,
      );
      
      // Remove burned NFTs from database
      for (const burnedNft of burnedNfts) {
        try {
          await this.nftRepository.remove(burnedNft);
          this.logger.log(
            `[NftStorage] ✓ Removed burned NFT: ${burnedNft.mint} (${burnedNft.name}) from database`,
          );
        } catch (error) {
          this.logger.warn(
            `[NftStorage] Failed to remove burned NFT ${burnedNft.mint}:`,
            error,
          );
        }
      }

      // Recalculate user level after removing burned NFTs
      try {
        await this.recalculateUserLevel(minter);
        this.logger.log(
          `[NftStorage] ✓ Updated user level for ${minter} after removing burned NFTs`,
        );
      } catch (error) {
        this.logger.warn(
          `[NftStorage] Failed to update user level for ${minter}:`,
          error,
        );
      }
    }

    // Filter to only NFTs still owned by the user
    const ownedNfts = ownershipChecks
      .filter(({ nft, owned }) => {
        if (!owned) {
          this.logger.debug(
            `FILTERED OUT: NFT ${nft.mint} (${nft.name}) - NOT OWNED by ${minter} (removed from DB)`,
          );
        } else {
          this.logger.debug(
            `KEEPING: NFT ${nft.mint} (${nft.name}) - OWNED by ${minter}`,
          );
        }
        return owned;
      })
      .map(({ nft }) => nft);

    this.logger.debug(
      `Returning ${ownedNfts.length} owned NFTs for ${minter} (removed ${burnedNfts.length} burned/transferred NFTs from database)`,
    );

    return ownedNfts;
  }

  /**
   * Get user level (always recalculates based on current database state)
   * Returns null if user has no NFTs (level was removed)
   */
  async getUserLevel(walletAddress: string): Promise<UserLevel | null> {
    return this.recalculateUserLevel(walletAddress);
  }

  /**
   * Recalculate and update user level based on current NFT state
   * This ensures levels are always accurate after NFTs are burned/removed
   * Returns null if user has no NFTs (level was removed)
   */
  private async recalculateUserLevel(walletAddress: string): Promise<UserLevel | null> {
    // Count total NFTs minted by this user (including burned ones still in DB)
    // This represents the user's mint history
    const totalMints = await this.nftRepository.count({
      where: { minter: walletAddress },
    });

    // Calculate level based on total mints
    const levelData = calculateLevel(totalMints);

    // Find or create user level
    let userLevel = await this.userLevelRepository.findOne({
      where: { walletAddress },
    });

    if (!userLevel) {
      // Create new user level if doesn't exist
      this.logger.log(
        `[NftStorage] Creating new user level for ${walletAddress}: level ${levelData.level}, ${totalMints} mints`,
      );
      userLevel = this.userLevelRepository.create({
        walletAddress,
        totalMints,
        level: levelData.level,
        experience: levelData.experience,
        nextLevelMints: levelData.nextLevelMints,
      });
    } else {
      // Update existing user level with recalculated values
      const previousLevel = userLevel.level;
      userLevel.totalMints = totalMints;
      userLevel.level = levelData.level;
      userLevel.experience = levelData.experience;
      userLevel.nextLevelMints = levelData.nextLevelMints;
      
      this.logger.log(
        `[NftStorage] Recalculated user level for ${walletAddress}: level ${levelData.level} (was ${previousLevel}), ${totalMints} mints`,
      );
    }

    // If user has no NFTs (totalMints = 0), remove the level record
    // This keeps the database clean and matches the behavior where NFTs disappear
    if (totalMints === 0 && userLevel) {
      await this.userLevelRepository.remove(userLevel);
      this.logger.log(
        `[NftStorage] Removed user level for ${walletAddress} (no NFTs remaining)`,
      );
      return null; // User has no level when they have no NFTs
    }

    // Save the updated user level (only if totalMints > 0)
    if (totalMints > 0) {
      userLevel = await this.userLevelRepository.save(userLevel);
    }

    return userLevel;
  }

  /**
   * Get user shard status
   */
  async getUserShardStatus(walletAddress: string): Promise<UserShardStatus> {
    // Get owned NFTs (filters out transferred/burned NFTs)
    const ownedNfts = await this.getNftsByMinter(walletAddress);
    const collectionSize = ownedNfts.length;

    // Get total mints (all NFTs ever minted by this user, regardless of ownership)
    // This is used for mint_count based shards
    const totalMints = await this.nftRepository.count({
      where: { minter: walletAddress },
    });

    // Calculate recent mints (last 30 days) - based on owned NFTs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentMints = ownedNfts.filter(
      (nft) => nft.createdAt && new Date(nft.createdAt) >= thirtyDaysAgo,
    ).length;

    // Calculate unique mints (by ASCII art content - simplified, assuming all are unique for now)
    // In a real implementation, you'd compare the actual ASCII art content
    const uniqueMints = collectionSize;

    const userStats: UserStats = {
      totalMints, // Total ever minted (for mint_count shards)
      collectionSize, // Currently owned (for collection_size shards)
      recentMints, // Recent owned mints
      uniqueMints, // Unique owned mints
      mintHistory: ownedNfts
        .map((nft) => (nft.createdAt ? new Date(nft.createdAt) : new Date()))
        .sort((a, b) => b.getTime() - a.getTime()),
    };

    // Auto-earn shards based on eligibility
    const earnedShards: string[] = [];
    const shardStatus = calculateShardStatus(userStats, earnedShards);

    // Check which shards should be earned
    shardStatus.shards.forEach((shard) => {
      if (shard.earned && !earnedShards.includes(shard.id)) {
        earnedShards.push(shard.id);
      }
    });

    // Recalculate with earned shards
    return calculateShardStatus(userStats, earnedShards);
  }

  /**
   * Update user level after minting (within transaction)
   * Uses pessimistic locking to prevent race conditions within transaction
   */
  private async updateUserLevelInTransaction(
    queryRunner: any,
    walletAddress: string,
  ): Promise<void> {
    // Count NFTs for this user (within transaction)
    const mintCount = await queryRunner.manager.count(NFT, {
      where: { minter: walletAddress },
    });

    this.logger.log(
      `[NftStorage] User ${walletAddress} has ${mintCount} total mints (counting within transaction)`,
    );

    const levelData = calculateLevel(mintCount);

    // Find user level with pessimistic lock (within transaction)
    // Pessimistic lock prevents concurrent modifications
    let userLevel = await queryRunner.manager.findOne(UserLevel, {
      where: { walletAddress },
      lock: { mode: 'pessimistic_write' },
    });

    const previousLevel = userLevel?.level || 0;

    if (!userLevel) {
      // Create new user level
      this.logger.log(
        `[NftStorage] Creating new user level for ${walletAddress}: level ${levelData.level}, ${mintCount} mints`,
      );
      userLevel = queryRunner.manager.create(UserLevel, {
        walletAddress,
        totalMints: mintCount,
        level: levelData.level,
        experience: levelData.experience,
        nextLevelMints: levelData.nextLevelMints,
        version: 1,
      });
    } else {
      // Update existing user level
      this.logger.log(
        `[NftStorage] Updating user level for ${walletAddress}: level ${levelData.level} (was ${previousLevel}), ${mintCount} mints`,
      );
      userLevel.totalMints = mintCount;
      userLevel.level = levelData.level;
      userLevel.experience = levelData.experience;
      userLevel.nextLevelMints = levelData.nextLevelMints;
    }

    await queryRunner.manager.save(UserLevel, userLevel);
    this.logger.log(
      `[NftStorage] ✓ User level saved for ${walletAddress}: level ${levelData.level}, ${mintCount} mints`,
    );

    if (levelData.level > previousLevel) {
      this.logger.log(
        `[NftStorage] 🎉 User ${walletAddress} leveled up from ${previousLevel} to ${levelData.level}!`,
      );
    }
  }

  /**
   * Save a buyback event
   */
  async saveBuybackEvent(
    buyback: Partial<BuybackEvent>,
  ): Promise<BuybackEvent> {
    try {
      if (!buyback.transactionSignature) {
        throw new Error('Buyback event transaction signature is required');
      }

      // Check if buyback event already exists
      const existing = await this.buybackEventRepository.findOne({
        where: { transactionSignature: buyback.transactionSignature },
      });

      if (existing) {
        this.logger.debug(
          `Buyback event already exists: ${buyback.transactionSignature}`,
        );
        return existing;
      }

      // Save buyback event (timestamps are handled by @CreateDateColumn)
      const savedBuyback = await this.buybackEventRepository.save(buyback);

      this.logger.log(`Saved buyback event: ${buyback.transactionSignature}`);
      return savedBuyback;
    } catch (error) {
      this.logger.error(
        `Error saving buyback event ${buyback.transactionSignature}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get buyback events (with pagination)
   */
  async getBuybackEvents(
    limit: number = 50,
    offset: number = 0,
  ): Promise<BuybackEvent[]> {
    return this.buybackEventRepository.find({
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get buyback statistics
   */
  async getBuybackStatistics() {
    const [totalBuybacks, buybackEvents] = await Promise.all([
      this.buybackEventRepository.count(),
      this.buybackEventRepository.find(),
    ]);

    const totalSolSwapped = buybackEvents.reduce(
      (sum, event) => sum + Number(event.amountSol),
      0,
    );

    const totalTokensReceived = buybackEvents.reduce(
      (sum, event) => sum + Number(event.tokenAmount),
      0,
    );

    return {
      totalBuybacks,
      totalSolSwapped,
      totalTokensReceived,
    };
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    const [totalNfts, totalUsers, userLevels, buybackStats] = await Promise.all(
      [
      this.nftRepository.count(),
      this.userLevelRepository.count(),
      this.userLevelRepository.find(),
      this.getBuybackStatistics(),
      ],
    );

    const totalMints = userLevels.reduce(
      (sum, level) => sum + level.totalMints,
      0,
    );

    return {
      totalNfts,
      totalUsers,
      totalMints,
      buybacks: buybackStats,
    };
  }
}
