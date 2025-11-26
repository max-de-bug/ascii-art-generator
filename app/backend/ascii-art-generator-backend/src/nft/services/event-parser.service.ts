import { Injectable, Logger } from '@nestjs/common';
import { PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { BorshCoder, Idl, Event } from '@coral-xyz/anchor';
import bs58 from 'bs58';

/**
 * MintEvent interface matching the Rust struct
 */
interface MintEvent {
  minter: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  timestamp: number;
}

/**
 * BuybackEvent interface matching the Rust struct
 */
interface BuybackEvent {
  amountSol: number;
  tokenAmount: number;
  timestamp: number;
}

/**
 * Service to parse Anchor events from Solana transactions using Anchor's BorshCoder
 */
@Injectable()
export class EventParserService {
  private readonly logger = new Logger(EventParserService.name);
  private coder: BorshCoder | null = null;
  private idl: Idl | null = null;
  private programId: string | null = null;

  /**
   * Set the IDL for event parsing
   * This should be called with your program's IDL after service initialization
   */
  setIdl(idl: Idl, programId?: string): void {
    this.idl = idl;
    this.coder = new BorshCoder(idl);
    this.programId = programId || null;
    this.logger.log(`[EventParser] Anchor event parser initialized with IDL${programId ? ` for program: ${programId}` : ''}`);
  }

  /**
   * Parse MintEvent from transaction using Anchor's event decoder
   *
   * Anchor events are emitted in the program logs with format:
   * "Program data: <base64_encoded_event_data>"
   */
  parseMintEvent(transaction: ParsedTransactionWithMeta): MintEvent | null {
    const logMessages = transaction.meta?.logMessages || [];
    this.logger.debug(
      `[EventParser] Parsing MintEvent from transaction with ${logMessages.length} log messages`,
    );

    if (!this.coder) {
      this.logger.warn(
        '[EventParser] Event parser not initialized with IDL. Call setIdl() first. Using fallback parser.',
      );
      return this.parseMintEventFallback(transaction);
    }

    try {
      // Anchor events are in logs with format: "Program data: <base64_data>"
      // We need to find "Program data:" logs that come from our program
      // In Solana logs, program-specific logs appear after "Program <program_id> invoke"
      let isOurProgram = false;
      for (let i = 0; i < logMessages.length; i++) {
        const log = logMessages[i];
        
        // Check if this log indicates our program was invoked
        if (this.programId && log.includes(`Program ${this.programId} invoke`)) {
          isOurProgram = true;
          this.logger.debug(`[EventParser] Found our program invocation at log index ${i}`);
        }
        
        // Reset flag when program returns
        if (this.programId && log.includes(`Program ${this.programId} success`)) {
          isOurProgram = false;
        }
        
        // Only process "Program data:" logs that come from our program
        if (log.includes('Program data:') && (isOurProgram || !this.programId)) {
          this.logger.debug(`[EventParser] Found "Program data:" log at index ${i}${isOurProgram ? ' (from our program)' : ''}, attempting to decode`);
          try {
            // Extract base64 encoded data
            const match = log.match(/Program data: (.+)/);
            if (!match) {
              this.logger.debug(`[EventParser] No match found for "Program data:" pattern`);
              continue;
            }

            const encodedData = match[1];
            this.logger.debug(`[EventParser] Extracted base64 data (first 100 chars): ${encodedData.substring(0, 100)}...`);

            // Decode base64 to buffer
            let data: Buffer;
            try {
              data = Buffer.from(encodedData, 'base64');
              this.logger.debug(`[EventParser] Decoded buffer length: ${data.length} bytes`);
            } catch (base64Error: any) {
              this.logger.warn(`[EventParser] Failed to decode base64: ${base64Error.message}`);
              continue;
            }

            // Use Anchor's event decoder
            // Anchor events are encoded with discriminator + data
            // The decoder expects the full buffer including discriminator
            let event: any;
            try {
              // Try decoding with hex string (most common format)
              event = this.coder.events.decode(data.toString('hex'));
            } catch (hexError: any) {
              this.logger.debug(`[EventParser] Hex decode failed: ${hexError.message}`);
              try {
                // Try with base64 string directly
                event = this.coder.events.decode(encodedData);
              } catch (base64DecodeError: any) {
                this.logger.warn(
                  `[EventParser] Both hex and base64 decode failed. Hex: ${hexError.message}, Base64: ${base64DecodeError.message}`,
                );
                // Log the first few bytes for debugging
                this.logger.debug(`[EventParser] First 20 bytes (hex): ${data.slice(0, 20).toString('hex')}`);
                continue;
              }
            }

            if (!event) {
              this.logger.debug(`[EventParser] Decoder returned null/undefined`);
              continue;
            }

            this.logger.debug(`[EventParser] Decoded event name: ${event.name}`);

            // Check if this is a MintEvent
            if (event.name === 'MintEvent' || event.name === 'mintEvent') {
              this.logger.log(`[EventParser] ✓ Successfully decoded MintEvent using Anchor decoder`);
              const eventData = event.data;

              return {
                minter: eventData.minter.toString(),
                mint: eventData.mint.toString(),
                name: eventData.name,
                symbol: eventData.symbol,
                uri: eventData.uri,
                timestamp: eventData.timestamp.toNumber
                  ? eventData.timestamp.toNumber()
                  : eventData.timestamp,
              };
            } else {
              this.logger.debug(`[EventParser] Decoded event is not MintEvent: ${event.name}`);
            }
          } catch (error: any) {
            // Not an event we recognize, continue
            this.logger.warn(
              `[EventParser] Could not decode event from log: ${log.substring(0, 200)}... Error: ${error.message || error}`,
            );
            if (error.stack) {
              this.logger.debug(`[EventParser] Error stack: ${error.stack}`);
            }
            continue;
          }
        }
      }

      // Fallback to manual parsing if Anchor decoder fails
      return this.parseMintEventFallback(transaction);
    } catch (error) {
      this.logger.error('Error parsing MintEvent from transaction', error);
      return null;
    }
  }

  /**
   * Fallback parser for MintEvent when Anchor decoder is not available or fails
   * Parses transaction logs manually
   */
  private parseMintEventFallback(
    transaction: ParsedTransactionWithMeta,
  ): MintEvent | null {
    return this.parseMintEventFromLogs(transaction);
  }

  /**
   * Parse MintEvent from transaction logs
   *
   * Anchor programs emit events using emit!() macro which creates log entries.
   * The event data is encoded and included in the logs.
   */
  private parseMintEventFromLogs(
    transaction: ParsedTransactionWithMeta,
  ): MintEvent | null {
    const logMessages = transaction.meta?.logMessages || [];

    // Look for logs that might contain event information
    // Anchor events might appear as:
    // - "Program data: <base58_data>"
    // - Or in instruction data logs

    this.logger.debug(
      `[EventParser] Using fallback parser. Checking ${logMessages.length} logs for mint-related messages`,
    );

    for (const log of logMessages) {
      // Look for mint-related logs - the actual log says "Minted and verified ASCII NFT"
      if (
        log.includes('Minted ASCII NFT') ||
        log.includes('Minted and verified ASCII NFT') ||
        log.includes('mint_ascii_nft')
      ) {
        this.logger.debug(`[EventParser] Found mint-related log in fallback: ${log}`);
        // Try to extract information from log message
        // Log format: "Minted and verified ASCII NFT: {name} ({symbol}), URI: {uri}"
        const nameMatch =
          log.match(/Minted (?:and verified )?ASCII NFT: ([^(]+)/) ||
          log.match(/Minted ASCII NFT: ([^(]+)/);
        const symbolMatch = log.match(/\(([^)]+)\)/);
        const uriMatch = log.match(/URI: (.+)/);

        // Get accounts from transaction to extract minter and mint
        const accountKeys = transaction.transaction.message.accountKeys || [];

        // First account is usually the signer (minter)
        const minter = accountKeys[0]?.pubkey?.toString();

        // Mint account is usually in the accounts array
        // We need to find the mint address - it's typically a new account created
        let mint: string | null = null;

        // Check pre and post balances to find new accounts (the mint)
        const preBalances = transaction.meta?.preBalances || [];
        const postBalances = transaction.meta?.postBalances || [];

        for (let i = 0; i < accountKeys.length; i++) {
          const account = accountKeys[i];
          // New accounts have 0 pre-balance and non-zero post-balance
          if (preBalances[i] === 0 && postBalances[i] > 0) {
            // This might be the mint account
            mint = account.pubkey?.toString() || null;
            break;
          }
        }

        // Alternative: Look for mint in instruction accounts
        if (!mint) {
          const instructions =
            transaction.transaction.message.instructions || [];
          for (const instruction of instructions) {
            if ('accounts' in instruction) {
              const accounts = instruction.accounts as any[];
              // The mint is typically the first writable account after the payer
              if (accounts.length > 1) {
                mint = accounts[1]?.toString();
                break;
              }
            }
          }
        }

        if (minter && mint && nameMatch) {
          const name = nameMatch[1].trim();
          const symbol = symbolMatch ? symbolMatch[1] : 'ASCII';
          const uri = uriMatch ? uriMatch[1] : '';
          const timestamp = transaction.blockTime
            ? transaction.blockTime
            : Math.floor(Date.now() / 1000);

          this.logger.log(
            `[EventParser] ✓ Parsed MintEvent from logs: ${name} (${mint}) minted by ${minter}`,
          );

          return {
            minter,
            mint,
            name,
            symbol,
            uri,
            timestamp,
          };
        } else {
          this.logger.warn(
            `[EventParser] Could not extract all required fields. minter: ${minter}, mint: ${mint}, nameMatch: ${!!nameMatch}`,
          );
        }
      }
    }

    return null;
  }

  /**
   * Parse BuybackEvent from transaction using Anchor's event decoder
   */
  parseBuybackEvent(
    transaction: ParsedTransactionWithMeta,
  ): BuybackEvent | null {
    if (!this.coder) {
      this.logger.warn(
        'Event parser not initialized with IDL. Call setIdl() first.',
      );
      return this.parseBuybackEventFallback(transaction);
    }

    try {
      const logMessages = transaction.meta?.logMessages || [];

      // Anchor events are in logs with format: "Program data: <base64_data>"
      for (const log of logMessages) {
        if (log.includes('Program data:')) {
          try {
            // Extract base64 encoded data
            const match = log.match(/Program data: (.+)/);
            if (!match) continue;

            const encodedData = match[1];

            // Decode base64 to buffer
            const data = Buffer.from(encodedData, 'base64');

            // Use Anchor's event decoder
            const event = this.coder.events.decode(data.toString('hex'));

            if (!event) continue;

            // Check if this is a BuybackEvent
            if (
              event.name === 'BuybackEvent' ||
              event.name === 'buybackEvent'
            ) {
              const eventData = event.data;

              return {
                amountSol: eventData.amountSol.toNumber
                  ? eventData.amountSol.toNumber()
                  : eventData.amountSol,
                tokenAmount: eventData.tokenAmount.toNumber
                  ? eventData.tokenAmount.toNumber()
                  : eventData.tokenAmount,
                timestamp: eventData.timestamp.toNumber
                  ? eventData.timestamp.toNumber()
                  : eventData.timestamp,
              };
            }
          } catch (error) {
            // Not an event we recognize, continue
            this.logger.debug(`Could not decode event from log: ${log}`, error);
            continue;
          }
        }
      }

      // Fallback to manual parsing if Anchor decoder fails
      return this.parseBuybackEventFallback(transaction);
    } catch (error) {
      this.logger.error('Error parsing BuybackEvent from transaction', error);
      return null;
    }
  }

  /**
   * Fallback parser for BuybackEvent
   */
  private parseBuybackEventFallback(
    transaction: ParsedTransactionWithMeta,
  ): BuybackEvent | null {
    try {
      const logMessages = transaction.meta?.logMessages || [];

      // Look for buyback execution log
      // Format: "Buyback executed: {amount} SOL swapped for {tokenAmount} tokens"
      for (const log of logMessages) {
        if (log.includes('Buyback executed:') || log.includes('buyback')) {
          // Extract amounts from log message
          const solMatch = log.match(/(\d+\.?\d*) SOL/);
          const tokenMatch = log.match(/(\d+\.?\d*) tokens/);

          if (solMatch && tokenMatch) {
            const amountSol = parseFloat(solMatch[1]);
            const tokenAmount = parseFloat(tokenMatch[1]);
            const timestamp = transaction.blockTime
              ? transaction.blockTime
              : Math.floor(Date.now() / 1000);

            return {
              amountSol,
              tokenAmount,
              timestamp,
            };
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        'Error parsing BuybackEvent from transaction (fallback)',
        error,
      );
      return null;
    }
  }
}
