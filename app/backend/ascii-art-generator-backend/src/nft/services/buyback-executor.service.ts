import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  VersionedTransaction,
  SystemProgram,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as path from 'path';
import { JupiterIntegrationService } from './jupiter-integration.service';
import { NftStorageService } from './nft-storage.service';
import { BuybackMonitorService } from './buyback-monitor.service';
// IDL will be loaded dynamically to avoid build-time issues
let IDL: any;

@Injectable()
export class BuybackExecutorService {
  private readonly logger = new Logger(BuybackExecutorService.name);
  private connection: Connection;
  private program: Program;
  private authorityKeypair: Keypair;

  constructor(
    private configService: ConfigService,
    private jupiterService: JupiterIntegrationService,
    private storageService: NftStorageService,
    private monitorService: BuybackMonitorService,
  ) {
    this.initializeConnection();
    this.loadAuthorityKeypair();
  }

  private initializeConnection() {
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

  private loadAuthorityKeypair() {
    const privateKey = this.configService.get<string>(
      'buyback.authorityPrivateKey',
    );

    if (privateKey) {
      const keypairArray = JSON.parse(privateKey);
      this.authorityKeypair = Keypair.fromSecretKey(
        new Uint8Array(keypairArray),
      );
      this.logger.log('Loaded authority keypair from environment variable');
    } else {
      throw new Error(
        'AUTHORITY_KEYPAIR_PATH or AUTHORITY_PRIVATE_KEY must be set in environment',
      );
    }
  }

  async initializeProgram() {
    if (this.program) {
      this.logger.debug('Program already initialized');
      return;
    }

    const programIdStr =
      this.configService.get<string>('solana.programId') ||
      '56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt';

    // Load IDL dynamically
    if (!IDL) {
      const idlPath = path.join(
        __dirname,
        '../../../../../Components/smartcontracts/ascii/target/idl/ascii.json',
      );

      if (!fs.existsSync(idlPath)) {
        throw new Error(
          `IDL not found at ${idlPath}. Please run 'anchor build' first.`,
        );
      }

      IDL = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
    }

    const wallet: Wallet = {
      publicKey: this.authorityKeypair.publicKey,
      payer: this.authorityKeypair,
      signTransaction: async <T extends Transaction | VersionedTransaction>(
        tx: T,
      ): Promise<T> => {
        if (tx instanceof VersionedTransaction) {
          tx.sign([this.authorityKeypair]);
        } else {
          tx.sign(this.authorityKeypair);
        }
        return tx;
      },
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(
        txs: T[],
      ): Promise<T[]> => {
        return Promise.all(
          txs.map(async (tx) => {
            if (tx instanceof VersionedTransaction) {
              tx.sign([this.authorityKeypair]);
            } else {
              tx.sign(this.authorityKeypair);
            }
            return tx;
          }),
        );
      },
    };

    const provider = new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
    });

    this.program = new Program(IDL, provider);
    this.logger.log(`Initialized Anchor program: ${programIdStr}`);
  }

  /**
   * Execute buyback with retry logic
   */
  async executeBuybackWithRetry(
    amountLamports: number,
    maxRetries: number = 3,
  ): Promise<string> {
    const retryAttempts =
      this.configService.get<number>('buyback.retryAttempts') || maxRetries;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        this.logger.log(`Buyback attempt ${attempt}/${retryAttempts}`);
        return await this.executeBuyback(amountLamports);
      } catch (error) {
        this.logger.warn(`Buyback attempt ${attempt} failed:`, error);

        if (attempt === retryAttempts) {
          await this.logBuybackAttempt({
            amount: amountLamports,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        const delay =
          this.configService.get<number>('buyback.retryDelayMs') || 5000;
        await this.delay(delay);
      }
    }

    throw new Error('All buyback attempts failed');
  }

  /**
   * Execute buyback
   */
  private async executeBuyback(amountLamports: number): Promise<string> {
    // Ensure program is initialized
    if (!this.program) {
      await this.initializeProgram();
    }
    // Get addresses
    const buybackTokenMint = new PublicKey(
      this.configService.get<string>('buyback.buybackTokenMint') ||
        'AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm',
    );
    const wsolMint = new PublicKey(
      'So11111111111111111111111111111111111111112',
    );
    const jupiterProgramId = new PublicKey(
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    );

    // Get Jupiter quote
    const quote = await this.jupiterService.getQuote(
      wsolMint.toString(),
      buybackTokenMint.toString(),
      amountLamports,
      this.configService.get<number>('buyback.slippageBps') || 100,
    );

    if (!quote.outAmount) {
      throw new Error('Invalid quote from Jupiter');
    }

    // Calculate minimum output
    const expectedOutput = BigInt(quote.outAmount);
    const slippageBps =
      this.configService.get<number>('buyback.slippageBps') || 100;
    const minimumOutput = this.jupiterService.calculateMinimumOutput(
      expectedOutput,
      slippageBps,
    );

    this.logger.log(
      `Quote: ${expectedOutput} tokens (min: ${minimumOutput} with ${slippageBps / 100}% slippage)`,
    );

    // Get swap transaction
    const swapResponse = await this.jupiterService.getSwapTransaction(
      quote,
      this.authorityKeypair.publicKey.toString(),
    );

    if (!swapResponse.swapTransaction) {
      throw new Error('Failed to get swap transaction from Jupiter');
    }

    // Parse transaction and extract instruction
    const swapTransactionBuf = Buffer.from(
      swapResponse.swapTransaction,
      'base64',
    );
    const { VersionedTransaction } = require('@solana/web3.js');
    const deserializedTx = VersionedTransaction.deserialize(swapTransactionBuf);
    const message = deserializedTx.message;

    const compiledInstructions = message.compiledInstructions;
    const jupiterInstructionIndex = compiledInstructions.findIndex(
      (ix: any) => {
        const programIdIndex = ix.programIdIndex;
        const programId = message.staticAccountKeys[programIdIndex];
        return programId && programId.equals(jupiterProgramId);
      },
    );

    if (jupiterInstructionIndex === -1) {
      throw new Error('Jupiter swap instruction not found in transaction');
    }

    const jupiterIx = compiledInstructions[jupiterInstructionIndex];
    const instructionData = Buffer.from(jupiterIx.data);

    // Get token accounts
    const wsolAccount = await getAssociatedTokenAddress(
      wsolMint,
      this.authorityKeypair.publicKey,
    );
    const buybackTokenAccount = await getAssociatedTokenAddress(
      buybackTokenMint,
      this.authorityKeypair.publicKey,
    );

    // Derive fee vault
    const programId = this.program.programId;
    const [feeVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_vault')],
      programId,
    );

    // Execute buyback
    const signature = await this.program.methods
      .executeBuyback(
        new BN(amountLamports),
        Array.from(instructionData),
        new BN(minimumOutput.toString()),
      )
      .accounts({
        authority: this.authorityKeypair.publicKey,
        feeVault: feeVault,
        wsolAccount: wsolAccount,
        buybackTokenAccount: buybackTokenAccount,
        jupiterProgram: jupiterProgramId,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: PublicKey.default,
      })
      .remainingAccounts(
        jupiterIx.accountKeyIndexes.map((idx: number) => {
          const accountKey = message.staticAccountKeys[idx];
          return {
            pubkey: accountKey,
            isSigner: idx < message.header.numRequiredSigners,
            isWritable:
              idx <
                message.header.numRequiredSigners +
                  message.header.numReadonlySignedAccounts ||
              (idx >=
                message.header.numRequiredSigners +
                  message.header.numReadonlySignedAccounts &&
                idx <
                  message.staticAccountKeys.length -
                    message.header.numReadonlyUnsignedAccounts),
          };
        }),
      )
      .rpc();

    // Log success
    await this.logBuybackAttempt({
      amount: amountLamports,
      status: 'success',
      signature: signature,
    });

    this.logger.log(`Buyback executed successfully: ${signature}`);

    // Monitor transaction confirmation (non-blocking)
    this.monitorService
      .monitorBuybackTransaction(signature)
      .then((confirmed) => {
        if (confirmed) {
          this.logger.log(`Buyback transaction confirmed: ${signature}`);
        } else {
          this.logger.warn(`Buyback transaction not confirmed: ${signature}`);
        }
      })
      .catch((error) => {
        this.logger.error(
          `Error monitoring buyback transaction ${signature}:`,
          error,
        );
      });

    return signature;
  }

  /**
   * Log buyback attempt to database
   */
  private async logBuybackAttempt(params: {
    amount: number;
    status: 'success' | 'failed';
    error?: string;
    signature?: string;
  }): Promise<void> {
    try {
      if (params.status === 'success' && params.signature) {
        // Get transaction details
        const tx = await this.connection.getTransaction(params.signature, {
          commitment: 'confirmed',
        });

        await this.storageService.saveBuybackEvent({
          transactionSignature: params.signature,
          amountSol: params.amount,
          tokenAmount: 0, // Will be updated from event parsing
          timestamp: Math.floor(Date.now() / 1000),
          slot: tx?.slot || 0,
          blockTime: tx?.blockTime || null,
        });
      }
    } catch (error) {
      this.logger.error('Error logging buyback attempt:', error);
      // Don't throw - logging failure shouldn't break buyback
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
