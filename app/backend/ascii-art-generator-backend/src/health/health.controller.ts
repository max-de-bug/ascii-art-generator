import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { 
  HealthCheck, 
  HealthCheckService, 
  MemoryHealthIndicator, 
  DiskHealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { SolanaIndexerService } from '../nft/services/solana-indexer.service';
import { BuybackSchedulerService } from '../nft/services/buyback-sheduler.service';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private indexer: SolanaIndexerService,
    private buybackScheduler: BuybackSchedulerService,
    private configService: ConfigService,
  ) {}

  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute for health checks
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Memory check - warn if using more than 1GB
      () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024),
      // Disk check - warn if using more than 90% of disk
      () => this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
      // Indexer status
      () => this.checkIndexer(),
      // Buyback status
      () => this.checkBuyback(),
    ]);
  }

  @Get('indexer')
  @HealthCheck()
  checkIndexer() {
    try {
      const status = this.indexer.getStatus();
      const result: HealthIndicatorResult = {
        indexer: {
          status: status.isIndexing ? 'up' : 'down',
          isIndexing: status.isIndexing,
          processedTransactions: status.processedTransactions,
          currentlyProcessing: status.currentlyProcessing,
          lastProcessedAt: status.metrics.lastProcessedAt,
          errors: status.metrics.totalErrors,
        },
      };
      return result;
    } catch (error) {
      const result: HealthIndicatorResult = {
        indexer: {
          status: 'down',
          error: error instanceof Error ? error.message : String(error),
        },
      };
      return result;
    }
  }

  @Get('buyback')
  @HealthCheck()
  checkBuyback() {
    try {
      const enabled = this.configService.get<boolean>('buyback.enabled', false);
      const result: HealthIndicatorResult = {
        buyback: {
          status: enabled ? 'up' : 'down',
          enabled,
        },
      };
      return result;
    } catch (error) {
      const result: HealthIndicatorResult = {
        buyback: {
          status: 'down',
          error: error instanceof Error ? error.message : String(error),
        },
      };
      return result;
    }
  }
}

