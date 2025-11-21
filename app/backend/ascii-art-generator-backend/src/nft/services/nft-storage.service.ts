import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NFT } from '../entities/nft.entity';
import { UserLevel } from '../entities/user-level.entity';
import { calculateLevel } from '../utils/level-calculator';
import { BuybackEvent } from '../entities/buyback-event.entity';

/**
 * NFT Storage Service
 * Stores NFTs and user level data using TypeORM
 */
@Injectable()
export class NftStorageService {
  private readonly logger = new Logger(NftStorageService.name);

  constructor(
    @InjectRepository(NFT)
    private readonly nftRepository: Repository<NFT>,
    @InjectRepository(UserLevel)
    private readonly userLevelRepository: Repository<UserLevel>,
    @InjectRepository(BuybackEvent)
    private readonly buybackEventRepository: Repository<BuybackEvent>,
    private readonly dataSource: DataSource,
  ) {}

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
        this.logger.debug(`NFT already exists: ${nft.mint}`);
        await queryRunner.release();
        return existing;
      }

      // Save NFT (timestamps are handled by @CreateDateColumn and @UpdateDateColumn)
      const savedNft = await queryRunner.manager.save(NFT, nft);

      // Update user level within the same transaction
      if (nft.minter) {
        await this.updateUserLevelInTransaction(queryRunner, nft.minter);
      }

      // Commit transaction
      await queryRunner.commitTransaction();
      this.logger.log(`Saved NFT: ${nft.mint} for minter: ${nft.minter}`);

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
   * Get all NFTs for a user
   */
  async getNftsByMinter(minter: string): Promise<NFT[]> {
    return this.nftRepository.find({
      where: { minter },
      order: { createdAt: 'DESC' }, // Sort by creation date (newest first)
    });
  }

  /**
   * Get user level
   */
  async getUserLevel(walletAddress: string): Promise<UserLevel> {
    let userLevel = await this.userLevelRepository.findOne({
      where: { walletAddress },
    });

    if (!userLevel) {
      // Create new user level if doesn't exist
      const mintCount = await this.nftRepository.count({
        where: { minter: walletAddress },
      });
      const levelData = calculateLevel(mintCount);

      userLevel = this.userLevelRepository.create({
        walletAddress,
        totalMints: mintCount,
        level: levelData.level,
        experience: levelData.experience,
        nextLevelMints: levelData.nextLevelMints,
      });

      userLevel = await this.userLevelRepository.save(userLevel);
    }

    return userLevel;
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
      userLevel.totalMints = mintCount;
      userLevel.level = levelData.level;
      userLevel.experience = levelData.experience;
      userLevel.nextLevelMints = levelData.nextLevelMints;
    }

    await queryRunner.manager.save(UserLevel, userLevel);

    if (levelData.level > previousLevel) {
      this.logger.log(
        `User ${walletAddress} leveled up to ${levelData.level}!`,
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
