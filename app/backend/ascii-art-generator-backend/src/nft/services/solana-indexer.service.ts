import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  Commitment,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';
import { Idl } from '@coral-xyz/anchor';
import { EventParserService } from './event-parser.service';
import { NftStorageService } from './nft-storage.service';
import { NFT } from '../entities/nft.entity';
import { BuybackEvent } from '../entities/buyback-event.entity';
import idl from '../../../../../idl/ascii.json';
/**
 * Solana Indexer Service
 * Listens to Solana transactions and indexes MintEvent
 */
@Injectable()
export class SolanaIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SolanaIndexerService.name);
  private connection: Connection;
  private programId: PublicKey;
  private subscriptionId: number | null = null;
  private isIndexing = false;
  // Map<signature, timestamp> - tracks when signature was processed to enable cleanup
  private processedSignatures: Map<string, number> = new Map();
  // Set<signature> - tracks signatures currently being processed to prevent race conditions
  private processingSignatures: Set<string> = new Set();
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private pollingIntervalId: NodeJS.Timeout | null = null;
  private websocketMonitorIntervalId: NodeJS.Timeout | null = null;

  // Cache configuration (reasonable defaults)
  private readonly MAX_CACHE_SIZE = 100000; // Max 100k signatures in memory
  private readonly CACHE_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours retention
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Cleanup every hour

  // Indexer configuration
  private readonly POLLING_INTERVAL_MS = 30000; // Poll every 30 seconds
  private readonly BACKFILL_LIMIT = 100; // Process last 100 transactions on startup
  private readonly POLL_LIMIT = 10; // Poll last 10 transactions
  private readonly MAX_RETRIES = 3; // Max retry attempts for RPC calls
  private readonly RETRY_DELAY_MS = 1000; // Initial retry delay (exponential backoff)
  private readonly MAX_CONCURRENT_PROCESSING = 10; // Max concurrent transaction processing
  private readonly INITIALIZATION_DELAY_MS = 2000; // Delay before starting indexer

  // Metrics
  private metrics = {
    totalProcessed: 0,
    totalErrors: 0,
    totalRetries: 0,
    lastProcessedAt: null as Date | null,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly eventParser: EventParserService,
    private readonly nftStorage: NftStorageService,
  ) {
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

    if (!rpcUrl) {
      throw new Error('Missing Solana RPC URL configuration');
    }

    this.connection = new Connection(rpcUrl, commitment);

    const programIdStr =
      this.configService.get<string>('solana.programId') ||
      '56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt';

    this.programId = new PublicKey(programIdStr);

    this.logger.log(
      `Initialized indexer for program: ${this.programId.toBase58()}`,
    );
    this.logger.log(`RPC URL: ${rpcUrl}`);
    this.logger.log(`Network: ${network}`);
  }

  async onModuleInit() {
    // Load IDL and initialize event parser
    await this.loadIdl();

    // Start indexing after a short delay to ensure everything is initialized
    setTimeout(() => {
      this.startIndexing();
    }, this.INITIALIZATION_DELAY_MS);
  }

  /**
   * Load the program IDL and initialize the event parser
   */
  private async loadIdl(): Promise<void> {
    try {
      // Type assertion
      this.eventParser.setIdl(idl as Idl);
      this.logger.log('Loaded IDL from import');
    } catch (error) {
      this.logger.error('Failed to load IDL', error);
    }
  }
  async onModuleDestroy() {
    await this.stopIndexing();
    this.stopCleanupInterval();
    this.stopPolling();
    this.stopWebSocketMonitoring();
  }

  /**
   * Start indexing transactions
   */
  private async startIndexing() {
    if (this.isIndexing) {
      this.logger.warn('Indexer is already running');
      return;
    }

    this.logger.log('Starting Solana transaction indexer...');
    this.isIndexing = true;

    try {
      // Subscribe to logs for our program
      this.subscriptionId = this.connection.onLogs(
        this.programId,
        async (logs, context) => {
          await this.processLogs(logs, context);
        },
        'confirmed',
      );

      this.logger.log(
        `Subscribed to program logs. Subscription ID: ${this.subscriptionId}`,
      );

      // Backfill: Process recent transactions
      await this.backfillRecentTransactions();

      // Start polling for missed transactions
      this.startPolling();

      // Start periodic cleanup to prevent memory leak
      this.startCleanupInterval();

      // Setup WebSocket reconnection monitoring
      this.monitorWebSocketConnection();
    } catch (error) {
      this.logger.error('Failed to start indexer', error);
      this.isIndexing = false;
    }
  }

  /**
   * Stop indexing
   */
  async stopIndexing() {
    if (!this.isIndexing) {
      return;
    }

    this.logger.log('Stopping indexer...');
    this.isIndexing = false;

    if (this.subscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.subscriptionId);
        this.logger.log('Removed log subscription');
      } catch (error) {
        this.logger.error('Error removing subscription', error);
      }
      this.subscriptionId = null;
    }

    // Stop cleanup interval
    this.stopCleanupInterval();

    // Stop polling interval
    this.stopPolling();

    // Stop WebSocket monitoring
    this.stopWebSocketMonitoring();
  }

  /**
   * Process logs from program
   */
  private async processLogs(logs: any, context: any) {
    const signature = logs?.signature;

    // Validate signature exists
    if (!signature) {
      this.logger.warn('Received logs without signature', logs);
      return;
    }

    // Skip if currently processing (prevent race conditions)
    if (this.processingSignatures.has(signature)) {
      return;
    }

    // Check in-memory cache first (fast)
    if (this.processedSignatures.has(signature)) {
      return;
    }

    // Check database to see if already processed (handles restarts)
    const isProcessed = await this.nftStorage.isTransactionProcessed(signature);
    if (isProcessed) {
      this.addProcessedSignature(signature); // Add to cache
      return;
    }

    // Check concurrency limit
    if (this.processingSignatures.size >= this.MAX_CONCURRENT_PROCESSING) {
      this.logger.debug(
        `Concurrency limit reached (${this.MAX_CONCURRENT_PROCESSING}), queuing signature ${signature}`,
      );
      // Queue for later processing (simple implementation - in production, use a proper queue)
      setTimeout(() => this.processLogs(logs, context), 1000);
      return;
    }

    this.processingSignatures.add(signature);

    try {
      // Get the full transaction with retry logic
      const transaction = await this.retryRpcCall(
        () =>
          this.connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed',
          }),
        `getParsedTransaction(${signature})`,
      );

      if (!transaction) {
        this.logger.warn(`Transaction not found: ${signature}`);
        this.processingSignatures.delete(signature);
        return;
      }

      await this.processTransaction(transaction, signature, context.slot);
      this.addProcessedSignature(signature);
      this.metrics.totalProcessed++;
      this.metrics.lastProcessedAt = new Date();
    } catch (error) {
      this.metrics.totalErrors++;
      this.logger.error(
        `Error processing logs for signature ${signature}`,
        error,
      );
    } finally {
      this.processingSignatures.delete(signature);
    }
  }

  /**
   * Process a transaction and extract events (MintEvent or BuybackEvent)
   */
  private async processTransaction(
    transaction: ParsedTransactionWithMeta,
    signature: string,
    slot: number,
  ) {
    try {
      // Check if transaction was successful
      if (transaction.meta?.err) {
        this.logger.debug(
          `Transaction failed: ${signature}`,
          transaction.meta.err,
        );
        return;
      }

      // Try to parse MintEvent first
      const mintEvent = this.eventParser.parseMintEvent(transaction);
      if (mintEvent) {
        // Create NFT entity (id, createdAt, updatedAt will be auto-generated by TypeORM)
        const nft: Partial<NFT> = {
          mint: mintEvent.mint,
          minter: mintEvent.minter,
          name: mintEvent.name,
          symbol: mintEvent.symbol,
          uri: mintEvent.uri,
          transactionSignature: signature,
          slot,
          blockTime: transaction.blockTime ?? null,
          timestamp: mintEvent.timestamp,
        };

        // Save NFT
        await this.nftStorage.saveNft(nft);

        this.logger.log(
          `Indexed NFT: ${mintEvent.name} (${mintEvent.mint}) minted by ${mintEvent.minter}`,
        );
        return;
      }

      // Try to parse BuybackEvent
      const buybackEvent = this.eventParser.parseBuybackEvent(transaction);
      if (buybackEvent) {
        // Create BuybackEvent entity
        const buyback: Partial<BuybackEvent> = {
          transactionSignature: signature,
          amountSol: buybackEvent.amountSol,
          tokenAmount: buybackEvent.tokenAmount,
          timestamp: buybackEvent.timestamp,
          slot,
          blockTime: transaction.blockTime ?? null,
        };

        // Save buyback event
        await this.nftStorage.saveBuybackEvent(buyback);

        this.logger.log(
          `Indexed Buyback: ${buybackEvent.amountSol} SOL swapped for ${buybackEvent.tokenAmount} tokens`,
        );
        return;
      }

      // No recognized event found, skip
      this.logger.debug(
        `No MintEvent or BuybackEvent found in transaction ${signature}`,
      );
    } catch (error) {
      this.logger.error(`Error processing transaction ${signature}`, error);
    }
  }

  /**
   * Backfill recent transactions
   * Only processes transactions that aren't already in the database
   */
  private async backfillRecentTransactions() {
    try {
      this.logger.log('Backfilling recent transactions...');

      const signatures = await this.retryRpcCall(
        () =>
          this.connection.getSignaturesForAddress(
            this.programId,
            { limit: this.BACKFILL_LIMIT },
            'confirmed',
          ),
        'getSignaturesForAddress(backfill)',
      );

      let processed = 0;
      let skipped = 0;
      for (const sigInfo of signatures) {
        // Check in-memory cache first
        if (this.processedSignatures.has(sigInfo.signature)) {
          skipped++;
          continue;
        }

        // Check database to avoid reprocessing (important after restarts)
        const isProcessed = await this.nftStorage.isTransactionProcessed(
          sigInfo.signature,
        );
        if (isProcessed) {
          this.addProcessedSignature(sigInfo.signature); // Add to cache
          skipped++;
          continue;
        }

        // Check concurrency limit
        if (this.processingSignatures.size >= this.MAX_CONCURRENT_PROCESSING) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // Wait before continuing
          continue;
        }

        if (this.processingSignatures.has(sigInfo.signature)) {
          continue;
        }

        this.processingSignatures.add(sigInfo.signature);

        try {
          const transaction = await this.retryRpcCall(
            () =>
              this.connection.getParsedTransaction(sigInfo.signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed',
              }),
            `getParsedTransaction(backfill ${sigInfo.signature})`,
          );

          if (transaction) {
            await this.processTransaction(
              transaction,
              sigInfo.signature,
              sigInfo.slot,
            );
            this.addProcessedSignature(sigInfo.signature);
            this.metrics.totalProcessed++;
            processed++;
          }
        } catch (error) {
          this.metrics.totalErrors++;
          this.logger.warn(
            `Error backfilling transaction ${sigInfo.signature}`,
            error,
          );
        } finally {
          this.processingSignatures.delete(sigInfo.signature);
        }
      }

      this.logger.log(
        `Backfilled ${processed} transactions (skipped ${skipped} already processed)`,
      );
    } catch (error) {
      this.logger.error('Error backfilling transactions', error);
    }
  }

  /**
   * Start polling for missed transactions
   */
  private startPolling(): void {
    if (this.pollingIntervalId !== null) {
      return; // Already started
    }

    this.pollingIntervalId = setInterval(async () => {
      if (!this.isIndexing) return;

      try {
        await this.pollRecentTransactions();
      } catch (error) {
        this.metrics.totalErrors++;
        this.logger.error('Error polling recent transactions', error);
      }
    }, this.POLLING_INTERVAL_MS);

    this.logger.log(
      `Started polling interval (every ${this.POLLING_INTERVAL_MS / 1000} seconds)`,
    );
  }

  /**
   * Stop polling interval
   */
  private stopPolling(): void {
    if (this.pollingIntervalId !== null) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
      this.logger.log('Stopped polling interval');
    }
  }

  /**
   * Poll for recent transactions
   */
  private async pollRecentTransactions() {
    try {
      const signatures = await this.retryRpcCall(
        () =>
          this.connection.getSignaturesForAddress(
            this.programId,
            { limit: this.POLL_LIMIT },
            'confirmed',
          ),
        'getSignaturesForAddress(poll)',
      );

      for (const sigInfo of signatures) {
        // Skip if currently processing
        if (this.processingSignatures.has(sigInfo.signature)) {
          continue;
        }

        // Check in-memory cache
        if (this.processedSignatures.has(sigInfo.signature)) {
          continue;
        }

        // Check database (safety net for missed transactions)
        const isProcessed = await this.nftStorage.isTransactionProcessed(
          sigInfo.signature,
        );
        if (isProcessed) {
          this.addProcessedSignature(sigInfo.signature); // Add to cache
          continue;
        }

        // Check concurrency limit
        if (this.processingSignatures.size >= this.MAX_CONCURRENT_PROCESSING) {
          break; // Skip remaining transactions, will be picked up in next poll
        }

        this.processingSignatures.add(sigInfo.signature);

        try {
          const transaction = await this.retryRpcCall(
            () =>
              this.connection.getParsedTransaction(sigInfo.signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed',
              }),
            `getParsedTransaction(poll ${sigInfo.signature})`,
          );

          if (transaction) {
            await this.processTransaction(
              transaction,
              sigInfo.signature,
              sigInfo.slot,
            );
            this.addProcessedSignature(sigInfo.signature);
            this.metrics.totalProcessed++;
          }
        } catch (error) {
          this.metrics.totalErrors++;
          this.logger.warn(
            `Error polling transaction ${sigInfo.signature}`,
            error,
          );
        } finally {
          this.processingSignatures.delete(sigInfo.signature);
        }
      }
    } catch (error) {
      this.metrics.totalErrors++;
      this.logger.error('Error polling recent transactions', error);
    }
  }

  /**
   * Add a processed signature with timestamp
   * Automatically evicts oldest entries if cache exceeds max size
   */
  private addProcessedSignature(signature: string): void {
    const now = Date.now();

    // If cache is full, evict oldest entries first
    if (this.processedSignatures.size >= this.MAX_CACHE_SIZE) {
      this.cleanupOldEntries(true); // Force cleanup to make space
    }

    this.processedSignatures.set(signature, now);
  }

  /**
   * Start periodic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupIntervalId !== null) {
      return; // Already started
    }

    this.cleanupIntervalId = setInterval(() => {
      if (!this.isIndexing) return;
      this.cleanupOldEntries(false);
    }, this.CLEANUP_INTERVAL_MS);

    this.logger.log(
      `Started cache cleanup interval (every ${this.CLEANUP_INTERVAL_MS / 1000 / 60} minutes)`,
    );
  }

  /**
   * Stop cleanup interval
   */
  private stopCleanupInterval(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      this.logger.log('Stopped cache cleanup interval');
    }
  }

  /**
   * Clean up old entries from cache
   * @param force - If true, evicts entries even if not expired (used when cache is full)
   */
  private cleanupOldEntries(force: boolean): void {
    const now = Date.now();
    const beforeSize = this.processedSignatures.size;
    let removed = 0;

    // Sort by timestamp to evict oldest first
    const entries = Array.from(this.processedSignatures.entries());

    if (force) {
      // Force mode: evict oldest entries to make space (keep 90% of max)
      const targetSize = Math.floor(this.MAX_CACHE_SIZE * 0.9);
      const toRemove = entries
        .sort((a, b) => a[1] - b[1]) // Sort by timestamp (oldest first)
        .slice(0, Math.max(0, beforeSize - targetSize));

      for (const [signature] of toRemove) {
        this.processedSignatures.delete(signature);
        removed++;
      }
    } else {
      // Normal cleanup: remove expired entries only
      for (const [signature, timestamp] of entries) {
        if (now - timestamp > this.CACHE_RETENTION_MS) {
          this.processedSignatures.delete(signature);
          removed++;
        }
      }
    }

    if (removed > 0) {
      const afterSize = this.processedSignatures.size;
      this.logger.log(
        `Cache cleanup: removed ${removed} entries (${beforeSize} → ${afterSize})`,
      );
    }
  }

  /**
   * Retry RPC call with exponential backoff
   */
  private async retryRpcCall<T>(
    fn: () => Promise<T>,
    operation: string,
    retries: number = 0,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries >= this.MAX_RETRIES) {
        this.logger.error(
          `Max retries (${this.MAX_RETRIES}) exceeded for ${operation}`,
          error,
        );
        throw error;
      }

      const delay = this.RETRY_DELAY_MS * Math.pow(2, retries); // Exponential backoff
      this.metrics.totalRetries++;
      this.logger.warn(
        `RPC call failed for ${operation}, retrying in ${delay}ms (attempt ${retries + 1}/${this.MAX_RETRIES})`,
        error,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryRpcCall(fn, operation, retries + 1);
    }
  }

  /**
   * Monitor WebSocket connection and attempt reconnection if needed
   */
  private monitorWebSocketConnection(): void {
    if (this.websocketMonitorIntervalId !== null) {
      return; // Already started
    }

    // Check connection health periodically
    this.websocketMonitorIntervalId = setInterval(
      async () => {
        if (!this.isIndexing) return;

        try {
          // Simple health check - try to get slot
          await this.retryRpcCall(
            () => this.connection.getSlot('confirmed'),
            'getSlot(healthCheck)',
          );
        } catch (error) {
          this.logger.error(
            'WebSocket connection health check failed, attempting reconnection',
            error,
          );

          // Attempt to restart indexing
          try {
            if (this.subscriptionId !== null) {
              await this.connection.removeOnLogsListener(this.subscriptionId);
              this.subscriptionId = null;
            }

            // Restart subscription
            this.subscriptionId = this.connection.onLogs(
              this.programId,
              async (logs, context) => {
                await this.processLogs(logs, context);
              },
              'confirmed',
            );

            this.logger.log(
              `Reconnected WebSocket subscription. New ID: ${this.subscriptionId}`,
            );
          } catch (reconnectError) {
            this.logger.error('Failed to reconnect WebSocket', reconnectError);
          }
        }
      },
      5 * 60 * 1000,
    ); // Check every 5 minutes

    this.logger.log(
      'Started WebSocket connection monitoring (every 5 minutes)',
    );
  }

  /**
   * Stop WebSocket monitoring interval
   */
  private stopWebSocketMonitoring(): void {
    if (this.websocketMonitorIntervalId !== null) {
      clearInterval(this.websocketMonitorIntervalId);
      this.websocketMonitorIntervalId = null;
      this.logger.log('Stopped WebSocket monitoring interval');
    }
  }

  /**
   * Get indexer status
   */
  getStatus() {
    return {
      isIndexing: this.isIndexing,
      programId: this.programId.toBase58(),
      subscriptionId: this.subscriptionId,
      connection: this.connection.rpcEndpoint,
      processedTransactions: this.processedSignatures.size,
      currentlyProcessing: this.processingSignatures.size,
      maxCacheSize: this.MAX_CACHE_SIZE,
      cacheUtilization: `${((this.processedSignatures.size / this.MAX_CACHE_SIZE) * 100).toFixed(1)}%`,
      metrics: {
        ...this.metrics,
        lastProcessedAt: this.metrics.lastProcessedAt?.toISOString() || null,
      },
      configuration: {
        maxConcurrentProcessing: this.MAX_CONCURRENT_PROCESSING,
        pollingIntervalMs: this.POLLING_INTERVAL_MS,
        maxRetries: this.MAX_RETRIES,
        cacheRetentionHours: this.CACHE_RETENTION_MS / (60 * 60 * 1000),
      },
    };
  }
}
