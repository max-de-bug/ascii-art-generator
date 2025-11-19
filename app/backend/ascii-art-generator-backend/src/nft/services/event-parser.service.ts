import { Injectable, Logger } from '@nestjs/common';
import { PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
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
 * Service to parse Anchor events from Solana transactions
 */
@Injectable()
export class EventParserService {
  private readonly logger = new Logger(EventParserService.name);

  /**
   * Parse MintEvent from transaction
   * 
   * Anchor events are emitted in the program logs.
   * We look for logs containing "Program data:" which contains the event data.
   */
  parseMintEvent(transaction: ParsedTransactionWithMeta): MintEvent | null {
    try {
      const logMessages = transaction.meta?.logMessages || [];

      // Look for event data in logs
      for (const log of logMessages) {
        if (log.includes('Program data:')) {
          try {
            // Extract base58 encoded data
            const match = log.match(/Program data: (.+)/);
            if (!match) continue;

            const encodedData = match[1];
            
            // Try to parse as base58
            try {
              const decoded = bs58.decode(encodedData);
              
              // Anchor events have an 8-byte discriminator
              // Then the event data follows
              // For MintEvent: discriminator + minter(32) + mint(32) + name + symbol + uri + timestamp(8)
              
              // Alternative: Look for event in transaction instructions
              // Since Anchor events might be in instruction data
              return this.parseMintEventFromInstruction(transaction);
            } catch (decodeError) {
              // Not base58, might be hex or other format
              continue;
            }
          } catch (error) {
            this.logger.debug(`Error parsing log: ${log}`, error);
            continue;
          }
        }
      }

      // Try parsing from instruction data as fallback
      return this.parseMintEventFromInstruction(transaction);
    } catch (error) {
      this.logger.error('Error parsing MintEvent from transaction', error);
      return null;
    }
  }

  /**
   * Parse MintEvent from transaction instruction data
   * 
   * This method extracts event data from the transaction structure.
   * Anchor programs emit events via emit!() which appear in logs.
   */
  private parseMintEventFromInstruction(
    transaction: ParsedTransactionWithMeta,
  ): MintEvent | null {
    try {
      // Look for mint instruction in the transaction
      const instructions = transaction.transaction.message.instructions || [];

      for (const instruction of instructions) {
        // Check if this is our program instruction
        if ('programId' in instruction) {
          const programId = (instruction.programId as PublicKey).toString();
          
          // Check if instruction has accounts (mint instruction should have mint, minter, etc.)
          if ('accounts' in instruction && Array.isArray(instruction.accounts)) {
            const accounts = (instruction.accounts as PublicKey[]).map(acc => acc.toString());
            
            // Mint instruction typically has: mint, minter, mint_authority, etc.
            if (accounts.length >= 2) {
              // Try to extract data from parsed instruction
              if ('parsed' in instruction && instruction.parsed) {
                const parsed = instruction.parsed as any;
                
                // If we have parsed instruction data, extract from there
                // This depends on how Anchor parses the instruction
              }
            }
          }
        }
      }

      // Since Anchor events are in logs, try parsing from logs more carefully
      return this.parseMintEventFromLogs(transaction);
    } catch (error) {
      this.logger.error('Error parsing MintEvent from instruction', error);
      return null;
    }
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
    
    for (const log of logMessages) {
      // Look for mint-related logs
      if (log.includes('Minted ASCII NFT') || log.includes('mint_ascii_nft')) {
        // Try to extract information from log message
        // Log format: "Minted ASCII NFT: {name} ({symbol}), URI: {uri}"
        const nameMatch = log.match(/Minted ASCII NFT: ([^(]+)/);
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
          const instructions = transaction.transaction.message.instructions || [];
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
          const timestamp = transaction.blockTime ? transaction.blockTime : Math.floor(Date.now() / 1000);

          return {
            minter,
            mint,
            name,
            symbol,
            uri,
            timestamp,
          };
        }
      }
    }

    return null;
  }

  /**
   * Parse BuybackEvent from transaction
   * 
   * Looks for buyback-related logs in the transaction
   */
  parseBuybackEvent(transaction: ParsedTransactionWithMeta): BuybackEvent | null {
    try {
      const logMessages = transaction.meta?.logMessages || [];

      // Look for buyback execution log
      // Format: "Buyback executed: {amount} SOL swapped for {tokenAmount} tokens"
      for (const log of logMessages) {
        if (log.includes('Buyback executed:') || log.includes('buyback')) {
          // Extract amounts from log message
          // Format: "Buyback executed: {amount} SOL swapped for {tokenAmount} tokens"
          const solMatch = log.match(/Buyback executed: (\d+) SOL/);
          const tokenMatch = log.match(/swapped for (\d+) tokens/);

          if (solMatch && tokenMatch) {
            const amountSol = parseInt(solMatch[1], 10);
            const tokenAmount = parseInt(tokenMatch[1], 10);
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
      this.logger.error('Error parsing BuybackEvent from transaction', error);
      return null;
    }
  }
}

