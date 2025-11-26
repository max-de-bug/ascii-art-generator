import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NftStorageService } from '../services/nft-storage.service';
import { SolanaIndexerService } from '../services/solana-indexer.service';

@Controller('nft')
export class NftController {
  constructor(
    private readonly nftStorage: NftStorageService,
    private readonly indexer: SolanaIndexerService,
  ) {}

  /**
   * Get indexer status
   */
  @Get('indexer/status')
  getIndexerStatus() {
    return this.indexer.getStatus();
  }

  /**
   * Get all NFTs for a user (by wallet address)
   */
  @Get('user/:walletAddress')
  async getUserNfts(@Param('walletAddress') walletAddress: string) {
    const nfts = await this.nftStorage.getNftsByMinter(walletAddress);
    const userLevel = await this.nftStorage.getUserLevel(walletAddress);

    return {
      walletAddress,
      nfts,
      userLevel, // Can be null if user has no NFTs
      totalNfts: nfts.length,
    };
  }

  /**
   * Get user level
   * Returns null if user has no NFTs (level was removed)
   */
  @Get('user/:walletAddress/level')
  async getUserLevel(@Param('walletAddress') walletAddress: string) {
    const level = await this.nftStorage.getUserLevel(walletAddress);
    // Return null if user has no NFTs (level was removed)
    return level;
  }

  /**
   * Get user shard status
   */
  @Get('user/:walletAddress/shard-status')
  async getUserShardStatus(@Param('walletAddress') walletAddress: string) {
    return this.nftStorage.getUserShardStatus(walletAddress);
  }

  /**
   * Get NFT by mint address
   */
  @Get('mint/:mintAddress')
  async getNftByMint(@Param('mintAddress') mintAddress: string) {
    return this.nftStorage.getNftByMint(mintAddress);
  }

  /**
   * Get statistics
   * Stricter rate limit due to expensive database aggregation
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Get('statistics')
  async getStatistics() {
    return this.nftStorage.getStatistics();
  }

  /**
   * Get buyback events
   */
  @Get('buybacks')
  async getBuybackEvents(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.nftStorage.getBuybackEvents(limitNum, offsetNum);
  }

  /**
   * Get buyback statistics
   * Stricter rate limit due to expensive database aggregation
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @Get('buybacks/statistics')
  async getBuybackStatistics() {
    return this.nftStorage.getBuybackStatistics();
  }
}
