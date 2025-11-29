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
            // The decoder expects a hex string
            let event: any;
            try {
              // Try decoding with hex string (most common and reliable format)
              event = this.coder.events.decode(data.toString('hex'));
            } catch (hexError: any) {
              this.logger.debug(`[EventParser] Hex decode failed: ${hexError.message}`);
              try {
                // Try with base64 string directly (fallback)
                event = this.coder.events.decode(encodedData);
              } catch (base64DecodeError: any) {
                this.logger.warn(
                  `[EventParser] Both hex and base64 decode failed. Hex: ${hexError.message}, Base64: ${base64DecodeError.message}`,
                );
                // Log the first few bytes for debugging
                this.logger.debug(`[EventParser] First 20 bytes (hex): ${data.slice(0, 20).toString('hex')}`);
                this.logger.debug(`[EventParser] Data length: ${data.length} bytes`);
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

    // Look for "Instruction: MintAsciiNft" log which indicates a mint transaction
    let foundMintInstruction = false;
    for (const log of logMessages) {
      if (
        log.includes('Instruction: MintAsciiNft') ||
        log.includes('Minted ASCII NFT') ||
        log.includes('Minted and verified ASCII NFT') ||
        log.includes('mint_ascii_nft')
      ) {
        foundMintInstruction = true;
        this.logger.log(`[EventParser] Found mint instruction log in fallback: ${log}`);
        break;
      }
    }

    if (!foundMintInstruction) {
      return null;
    }

    // Try to extract event data from "Program data:" log
    let name = 'ASCII Art';
    let symbol = 'ASCII';
    let uri = '';
    
    for (const log of logMessages) {
      if (log.includes('Program data:')) {
        try {
          const match = log.match(/Program data: (.+)/);
          if (match) {
            const encodedData = match[1];
            // Try to decode the base64 data to extract event information
            const data = Buffer.from(encodedData, 'base64');
            // The event data structure: discriminator (8 bytes) + event data
            // After discriminator, we might find name, symbol, uri
            // For now, we'll extract what we can from the transaction accounts
            this.logger.debug(`[EventParser] Found Program data log, will extract from accounts`);
          }
        } catch (e) {
          // Ignore decode errors, we'll use defaults
        }
      }
      
      // Extract name, symbol, uri from log if available
        const nameMatch =
          log.match(/Minted (?:and verified )?ASCII NFT: ([^(]+)/) ||
          log.match(/Minted ASCII NFT: ([^(]+)/);
      if (nameMatch) {
        name = nameMatch[1].trim();
      }
        const symbolMatch = log.match(/\(([^)]+)\)/);
      if (symbolMatch) {
        symbol = symbolMatch[1];
      }
        const uriMatch = log.match(/URI: (.+)/);
      if (uriMatch) {
        uri = uriMatch[1];
      }
    }

        // Get accounts from transaction to extract minter and mint
        const accountKeys = transaction.transaction.message.accountKeys || [];

    // Get transaction signers - the first account is typically the payer/minter
    // For ParsedMessage, we can't access header, so we use the first account
    // In Solana transactions, the first account is almost always the fee payer/signer
    const minter = accountKeys[0]?.pubkey?.toString() || 
                   (typeof accountKeys[0] === 'string' ? accountKeys[0] : accountKeys[0]?.toString()) ||
                   null;

    // Mint account is usually in the instruction accounts
    // For mint_ascii_nft, the mint is typically at index 6 in the accounts array
        let mint: string | null = null;

    // Look for mint in instruction accounts (more reliable than balance checks)
    // Instruction accounts can be either PublicKey objects or indices into accountKeys
    const instructions =
      transaction.transaction.message.instructions || [];
    for (const instruction of instructions) {
      if ('accounts' in instruction) {
        const accounts = instruction.accounts as any[];
        // Try different indices where mint might be located
        // Index 6 is common for mint_ascii_nft instruction (after config, payer, tokenMetadataProgram, systemProgram, rent, mintAuthority)
        if (accounts.length > 6) {
          const accountRef = accounts[6];
          if (accountRef !== undefined && accountRef !== null) {
            // If it's a number, it's an index into accountKeys
            if (typeof accountRef === 'number') {
              const accountKey = accountKeys[accountRef];
              if (accountKey) {
                mint = accountKey.pubkey?.toString() || accountKey.toString();
                this.logger.log(`[EventParser] Found mint at instruction account index 6 (accountKeys[${accountRef}]): ${mint}`);
                break;
              }
            } else {
              // It's already a PublicKey or string
              mint = typeof accountRef === 'string' 
                ? accountRef 
                : accountRef.toString();
              this.logger.log(`[EventParser] Found mint at instruction account index 6: ${mint}`);
              break;
            }
          }
        }
        // Fallback: try index 5 (mint might be at index 5)
        if (!mint && accounts.length > 5) {
          const accountRef = accounts[5];
          if (accountRef !== undefined && accountRef !== null) {
            if (typeof accountRef === 'number') {
              const accountKey = accountKeys[accountRef];
              if (accountKey) {
                mint = accountKey.pubkey?.toString() || accountKey.toString();
                this.logger.log(`[EventParser] Found mint at instruction account index 5 (accountKeys[${accountRef}]): ${mint}`);
                break;
              }
            } else {
              mint = typeof accountRef === 'string' 
                ? accountRef 
                : accountRef.toString();
              this.logger.log(`[EventParser] Found mint at instruction account index 5: ${mint}`);
              break;
            }
          }
        }
      }
    }

    // Fallback: Check pre and post balances to find new accounts (the mint)
    if (!mint) {
        const preBalances = transaction.meta?.preBalances || [];
        const postBalances = transaction.meta?.postBalances || [];

        for (let i = 0; i < accountKeys.length; i++) {
          const account = accountKeys[i];
          // New accounts have 0 pre-balance and non-zero post-balance
          if (preBalances[i] === 0 && postBalances[i] > 0) {
          const potentialMint = account.pubkey?.toString() || account.toString();
          // Skip system accounts and known program accounts
          if (!potentialMint.includes('11111111111111111111111111111111') && 
              !potentialMint.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')) {
            mint = potentialMint;
            this.logger.log(`[EventParser] Found mint via balance check: ${mint}`);
                break;
              }
            }
          }
        }

    if (minter && mint) {
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
        `[EventParser] Could not extract all required fields. minter: ${minter}, mint: ${mint}`,
          );
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
