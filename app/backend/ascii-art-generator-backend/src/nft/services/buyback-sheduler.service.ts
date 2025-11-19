import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { BuybackExecutorService } from './buyback-executor.service';

@Injectable()
export class BuybackSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BuybackSchedulerService.name);
  private connection: Connection;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private failureCount = 0;
  private readonly MAX_FAILURES = 5;

  constructor(
    private configService: ConfigService,
    private executorService: BuybackExecutorService
  ) {
    const network = this.configService.get<string>('solana.network', 'mainnet-beta');
    const rpcUrl = network === 'devnet' 
      ? this.configService.get<string>('solana.rpcUrlDevnet')
      : this.configService.get<string>('solana.rpcUrl');
    
    if (!rpcUrl) {
      throw new Error('Missing Solana RPC URL configuration');
    }
    
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  async onModuleInit() {
    if (!this.configService.get<boolean>('buyback.enabled')) {
      this.logger.log('Buyback service is disabled');
      return;
    }

    await this.executorService.initializeProgram();

    const checkInterval =
      this.configService.get<number>('buyback.checkIntervalMs') || 3600000;

    this.logger.log(
      `Starting buyback scheduler (checking every ${checkInterval / 1000 / 60} minutes)`
    );

    this.intervalId = setInterval(() => {
      this.checkAndExecuteBuyback().catch((error) => {
        this.logger.error('Error in scheduled buyback check:', error);
      });
    }, checkInterval);

    // Check immediately on startup
    await this.checkAndExecuteBuyback();
  }

  async onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.logger.log('Buyback scheduler stopped');
    }
  }

  async checkAndExecuteBuyback(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Buyback check already running, skipping...');
      return;
    }

    // Circuit breaker
    if (this.failureCount >= this.MAX_FAILURES) {
      this.logger.error('Circuit breaker open, skipping buyback');
      return;
    }

    this.isRunning = true;

    try {
      const thresholdSOL =
        this.configService.get<number>('buyback.thresholdSOL') || 0.1;
      const thresholdLamports = thresholdSOL * 1_000_000_000;

      const programId = new PublicKey(
        this.configService.get<string>('solana.programId') ||
        '56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt'
      );

      const [feeVault] = PublicKey.findProgramAddressSync(
        [Buffer.from('fee_vault')],
        programId
      );

      const balance = await this.connection.getBalance(feeVault);
      const balanceSOL = balance / 1_000_000_000;

      this.logger.debug(
        `Fee vault balance: ${balanceSOL} SOL (threshold: ${thresholdSOL} SOL)`
      );

      if (balance < thresholdLamports) {
        this.logger.debug('Balance below threshold, skipping buyback');
        return;
      }

      const maxBuybackSOL =
        this.configService.get<number>('buyback.maxAmountSOL') || 10.0;
      const amountToSwap = Math.min(balanceSOL, maxBuybackSOL);
      const amountLamports = Math.floor(amountToSwap * 1_000_000_000);

      this.logger.log(
        `Executing buyback: ${amountToSwap} SOL (balance: ${balanceSOL} SOL)`
      );

      await this.executorService.executeBuybackWithRetry(amountLamports);
      this.failureCount = 0; // Reset on success
    } catch (error) {
      this.failureCount++;
      this.logger.error('Error executing buyback:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async manualBuyback(amountSOL: number): Promise<string> {
    const amountLamports = Math.floor(amountSOL * 1_000_000_000);
    return await this.executorService.executeBuybackWithRetry(amountLamports);
  }
}