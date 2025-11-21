import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { NftStorageService } from './nft-storage.service';

/**
 * Service to monitor buyback transaction status
 * Verifies that buyback transactions are confirmed and successful
 */
@Injectable()
export class BuybackMonitorService {
  private readonly logger = new Logger(BuybackMonitorService.name);
  private connection: Connection;
  private monitoringIntervalId: NodeJS.Timeout | null = null;
  private readonly MONITOR_INTERVAL_MS = 60000; // Check every minute
  private readonly MAX_CONFIRMATION_WAIT = 5 * 60 * 1000; // 5 minutes

  constructor(
    private configService: ConfigService,
    private storageService: NftStorageService,
  ) {
    const network = this.configService.get<string>(
      'solana.network',
      'mainnet-beta',
    );
    const rpcUrl =
      network === 'devnet'
        ? this.configService.get<string>('solana.rpcUrlDevnet')
        : this.configService.get<string>('solana.rpcUrl');

    if (!rpcUrl) {
      throw new Error('Missing Solana RPC URL configuration');
    }

    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Start monitoring buyback transactions
   */
  startMonitoring() {
    if (this.monitoringIntervalId) {
      this.logger.warn('Buyback monitoring already started');
      return;
    }

    this.logger.log('Starting buyback transaction monitoring');

    this.monitoringIntervalId = setInterval(() => {
      this.checkPendingBuybacks().catch((error) => {
        this.logger.error('Error checking pending buybacks:', error);
      });
    }, this.MONITOR_INTERVAL_MS);

    // Check immediately
    this.checkPendingBuybacks().catch((error) => {
      this.logger.error('Error in initial buyback check:', error);
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringIntervalId) {
      clearInterval(this.monitoringIntervalId);
      this.monitoringIntervalId = null;
      this.logger.log('Stopped buyback transaction monitoring');
    }
  }

  /**
   * Check pending buyback transactions
   */
  private async checkPendingBuybacks() {
    try {
      // Get recent buyback events (last hour)
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      const events = await this.storageService.getBuybackEvents(100, 0);

      const recentEvents = events.filter(
        (event) => event.timestamp >= oneHourAgo,
      );

      for (const event of recentEvents) {
        await this.verifyBuybackTransaction(event.transactionSignature);
      }
    } catch (error) {
      this.logger.error('Error checking pending buybacks:', error);
    }
  }

  /**
   * Verify a buyback transaction
   */
  async verifyBuybackTransaction(signature: string): Promise<boolean> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) {
        this.logger.warn(`Transaction not found: ${signature}`);
        return false;
      }

      if (transaction.meta?.err) {
        this.logger.error(
          `Buyback transaction failed: ${signature}`,
          transaction.meta.err,
        );
        return false;
      }

      // Transaction is confirmed and successful
      this.logger.debug(`Buyback transaction verified: ${signature}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error verifying buyback transaction ${signature}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Monitor a specific buyback transaction until confirmed
   */
  async monitorBuybackTransaction(
    signature: string,
    timeout: number = this.MAX_CONFIRMATION_WAIT,
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds

    return new Promise((resolve) => {
      const checkTransaction = async () => {
        try {
          const verified = await this.verifyBuybackTransaction(signature);

          if (verified) {
            resolve(true);
            return;
          }

          if (Date.now() - startTime > timeout) {
            this.logger.warn(
              `Buyback transaction ${signature} not confirmed within timeout`,
            );
            resolve(false);
            return;
          }

          setTimeout(checkTransaction, checkInterval);
        } catch (error) {
          this.logger.error(
            `Error monitoring buyback transaction ${signature}:`,
            error,
          );
          resolve(false);
        }
      };

      checkTransaction();
    });
  }
}
