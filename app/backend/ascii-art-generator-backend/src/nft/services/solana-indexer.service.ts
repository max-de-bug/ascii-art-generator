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
import idl from '../../../../../Components/smartcontracts/ascii/target/idl/ascii.json';
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
  private readonly BACKFILL_LIMIT = 20; // Process last 20 transactions on startup (reduced to avoid rate limits)
  private readonly POLL_LIMIT = 5; // Poll last 5 transactions (reduced to avoid rate limits)
  private readonly MAX_RETRIES = 5; // Max retry attempts for RPC calls (increased for 429 handling)
  private readonly RETRY_DELAY_MS = 2000; // Initial retry delay (increased for rate limit handling)
  private readonly MAX_CONCURRENT_PROCESSING = 3; // Max concurrent transaction processing (reduced to avoid rate limits)
  private readonly INITIALIZATION_DELAY_MS = 2000; // Delay before starting indexer
  private readonly RATE_LIMIT_DELAY_MS = 100; // Delay between requests to avoid rate limits
  private readonly BACKFILL_BATCH_DELAY_MS = 500; // Delay between backfill batches

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
      'DvGwWxoj4k1BQfRoEL18CNYnZ8XYZp1xYHSgBZdvaCKT'; // Updated to match frontend

    this.programId = new PublicKey(programIdStr);
    
    this.logger.log(
      `[Indexer] Program ID configured: ${this.programId.toBase58()}`,
    );

    this.logger.log(
      `Initialized indexer for program: ${this.programId.toBase58()}`,
    );
    this.logger.log(`RPC URL: ${rpcUrl}`);
    this.logger.log(`Network: ${network}`);
  }

  async onModuleInit() {
    // Load IDL and initialize event parser (reloads on each startup to get latest version)
    await this.loadIdl();

    // Start indexing after a short delay to ensure everything is initialized
    setTimeout(() => {
      this.startIndexing();
    }, this.INITIALIZATION_DELAY_MS);
  }

  /**
   * Load the program IDL and initialize the event parser
   * Dynamically imports IDL to ensure it's up to date after program upgrades
   */
  private async loadIdl(): Promise<void> {
    try {
      // Dynamically import IDL to get the latest version after program upgrades
      const idlModule = await import('../../../../../Components/smartcontracts/ascii/target/idl/ascii.json');
      const latestIdl = (idlModule.default || idlModule) as Idl;
      
      // Initialize event parser with latest IDL
      this.eventParser.setIdl(latestIdl, this.programId.toBase58());
      this.logger.log(`[Indexer] ✓ Loaded and initialized IDL with ${latestIdl.events?.length || 0} event(s) for program: ${this.programId.toBase58()}`);
    } catch (error: any) {
      this.logger.error('[Indexer] Failed to load IDL dynamically', error);
      // Fallback to static import if dynamic import fails
      try {
        this.eventParser.setIdl(idl as Idl, this.programId.toBase58());
        this.logger.warn('[Indexer] Using fallback static IDL import');
      } catch (fallbackError) {
        this.logger.error('[Indexer] Fallback IDL load also failed', fallbackError);
      }
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
      this.logger.log(
        `[Indexer] Setting up WebSocket subscription for program: ${this.programId.toString()}`,
      );
      
      try {
        this.subscriptionId = this.connection.onLogs(
          this.programId,
          async (logs, context) => {
            this.logger.log(
              `[WebSocket] ✓ Received logs for program ${this.programId.toString()}, signature: ${logs?.signature || 'unknown'}, slot: ${context?.slot || 'unknown'}`,
            );
            await this.processLogs(logs, context);
          },
          'confirmed',
        );

        this.logger.log(
          `[Indexer] ✓ Successfully subscribed to program logs for ${this.programId.toString()}. Subscription ID: ${this.subscriptionId}`,
        );
      } catch (subscriptionError: any) {
        this.logger.error(
          `[Indexer] ✗ Failed to create WebSocket subscription: ${subscriptionError.message}`,
          subscriptionError.stack,
        );
        throw subscriptionError;
      }

      // Verify subscription is active
      if (this.subscriptionId === null || this.subscriptionId === undefined) {
        throw new Error('WebSocket subscription failed - subscriptionId is null');
      }
      this.logger.log(
        `[Indexer] WebSocket subscription verified. ID: ${this.subscriptionId}`,
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

    this.logger.log(
      `[Indexer] Processing transaction ${signature} (slot: ${context.slot})`,
    );

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
      const txLogMessages = transaction.meta?.logMessages || [];
      this.logger.log(
        `[Indexer] Attempting to parse MintEvent from transaction ${signature}. Log count: ${txLogMessages.length}`,
      );
      
      // Log first few logs to see what we're working with
      if (txLogMessages.length > 0) {
        const sampleLogs = txLogMessages.slice(0, 10).join(' | ');
        this.logger.debug(
          `[Indexer] Sample logs from transaction: ${sampleLogs.substring(0, 500)}`,
        );
      }
      
      const mintEvent = this.eventParser.parseMintEvent(transaction);
      if (mintEvent) {
        this.logger.log(
          `[Indexer] ✓ Found MintEvent: ${mintEvent.name} (${mintEvent.mint}) minted by ${mintEvent.minter}`,
        );
        
        // For very recent mints (within 2 minutes), skip ownership check
        // The token account may not be propagated yet, but we know it was just minted
        // For older transactions, verify ownership to prevent indexing burned/transferred NFTs
        const transactionAge = transaction.blockTime
          ? Date.now() / 1000 - transaction.blockTime
          : 0;
        const isRecentMint = transactionAge < 300; // 5 minutes
        
        let isOwned = false;
        if (isRecentMint) {
          // Retry ownership check for recent mints (token account propagation delay)
          this.logger.debug(
            `[Indexer] Recent mint detected (${Math.round(transactionAge)}s old), retrying ownership check...`,
          );
          for (let attempt = 0; attempt < 3; attempt++) {
            isOwned = await this.nftStorage.isNftOwnedByWallet(
              mintEvent.mint,
              mintEvent.minter,
            );
            if (isOwned) {
              this.logger.debug(
                `[Indexer] Ownership verified on attempt ${attempt + 1} for NFT ${mintEvent.mint}`,
              );
              break;
            }
            if (attempt < 2) {
              // Wait 2 seconds before retry (except on last attempt)
              await new Promise((resolve) => setTimeout(resolve, 2000));
              this.logger.debug(
                `[Indexer] Ownership check failed, retrying... (attempt ${attempt + 2}/3)`,
              );
            }
          }
        } else {
          // For older transactions, check once
          isOwned = await this.nftStorage.isNftOwnedByWallet(
            mintEvent.mint,
            mintEvent.minter,
          );
        }

        if (!isOwned) {
          this.logger.warn(
            `[Indexer] ✗ Skipping NFT ${mintEvent.mint} - no longer owned by minter ${mintEvent.minter} (likely burned/transferred)`,
          );
          return;
        }

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

        // Save NFT (will check ownership and remove if not owned)
        try {
          this.logger.log(
            `[Indexer] Saving NFT to database: ${mintEvent.name} (${mintEvent.mint}) for minter: ${mintEvent.minter}`,
          );
          const savedNft = await this.nftStorage.saveNft(nft);
          this.logger.log(
            `[Indexer] ✓ Successfully indexed NFT: ${mintEvent.name} (${mintEvent.mint}) minted by ${mintEvent.minter}. Database ID: ${savedNft.id}`,
          );
        } catch (error: any) {
          // If saveNft throws "NFT no longer owned", that's expected - just skip
          if (error.message?.includes('no longer owned')) {
            this.logger.debug(
              `[Indexer] Skipped indexing NFT ${mintEvent.mint} - was removed from database (no longer owned)`,
            );
          } else {
            this.logger.error(
              `[Indexer] ✗ Error saving NFT ${mintEvent.mint} to database: ${error.message}`,
              error.stack,
            );
            throw error; // Re-throw other errors
          }
        }
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
      // Log transaction details for debugging if it's from our program
      const accountKeys = transaction.transaction.message.accountKeys || [];
      const logMessages = transaction.meta?.logMessages || [];
      const hasProgramAccount = accountKeys.some(
        (acc) => acc.pubkey?.toString() === this.programId.toString(),
      );
      
      if (hasProgramAccount) {
        // Check if transaction actually invoked our program
        const programLogs = logMessages.filter((log) =>
          log.includes(this.programId.toString()),
        );
        
        if (programLogs.length > 0) {
          this.logger.debug(
            `Transaction ${signature} invoked our program but no MintEvent or BuybackEvent found. Log count: ${logMessages.length}, Program logs: ${programLogs.length}`,
          );
          // Log first few program logs for debugging
          if (programLogs.length > 0) {
            this.logger.debug(
              `Program logs: ${programLogs.slice(0, 5).join(' | ')}`,
            );
          }
        }
      }
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
      
      // Process in smaller batches with delays to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < signatures.length; i += batchSize) {
        const batch = signatures.slice(i, i + batchSize);
        
        for (const sigInfo of batch) {
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
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before continuing
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

        // Add delay between batches to avoid rate limits (except for last batch)
        if (i + batchSize < signatures.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.BACKFILL_BATCH_DELAY_MS),
          );
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
   * Handles 429 rate limit errors with longer delays
   */
  private async retryRpcCall<T>(
    fn: () => Promise<T>,
    operation: string,
    retries: number = 0,
  ): Promise<T> {
    try {
      // Add small delay before each request to avoid rate limits
      if (retries === 0) {
        await new Promise((resolve) => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS));
      }
      return await fn();
    } catch (error: any) {
      // Check if it's a rate limit error (429)
      const isRateLimitError =
        error?.message?.includes('429') ||
        error?.message?.includes('Too Many Requests') ||
        error?.statusCode === 429 ||
        error?.code === 429;

      if (retries >= this.MAX_RETRIES) {
        this.logger.error(
          `Max retries (${this.MAX_RETRIES}) exceeded for ${operation}`,
          error,
        );
        throw error;
      }

      // Use longer delay for rate limit errors
      const baseDelay = isRateLimitError
        ? this.RETRY_DELAY_MS * 5 // 10 seconds for rate limits
        : this.RETRY_DELAY_MS;
      const delay = baseDelay * Math.pow(2, retries); // Exponential backoff
      
      this.metrics.totalRetries++;
      this.logger.warn(
        `RPC call failed for ${operation}${isRateLimitError ? ' (rate limited)' : ''}, retrying in ${delay}ms (attempt ${retries + 1}/${this.MAX_RETRIES})`,
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
