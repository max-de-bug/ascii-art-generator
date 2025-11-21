import { Test, TestingModule } from '@nestjs/testing';
import { EventParserService } from '../event-parser.service';
import { ParsedTransactionWithMeta } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

describe('EventParserService', () => {
  let service: EventParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventParserService],
    }).compile();

    service = module.get<EventParserService>(EventParserService);
  });

  describe('parseMintEvent', () => {
    it('should parse mint event from logs', () => {
      // Use valid Solana public keys (System Program and a valid test key)
      const transaction: ParsedTransactionWithMeta = {
        transaction: {
          message: {
            accountKeys: [
              {
                pubkey: new PublicKey('11111111111111111111111111111111'), // System Program (valid)
              },
              {
                pubkey: new PublicKey(
                  'So11111111111111111111111111111111111111112',
                ), // WSOL (valid)
              },
            ],
            instructions: [],
          },
        },
        meta: {
          logMessages: [
            'Program log: Instruction: MintAsciiNft',
            'Program log: Minted ASCII NFT: Test Art (TEST), URI: https://ipfs.io/test',
          ],
          preBalances: [0, 0],
          postBalances: [0, 1000000],
        },
        blockTime: Math.floor(Date.now() / 1000),
      } as any;

      const result = service.parseMintEvent(transaction);

      expect(result).toBeDefined();
      if (result) {
        expect(result.name).toBe('Test Art');
        expect(result.symbol).toBe('TEST');
        expect(result.uri).toBe('https://ipfs.io/test');
      }
    });

    it('should return null if no mint event found', () => {
      const transaction: ParsedTransactionWithMeta = {
        transaction: {
          message: {
            accountKeys: [],
            instructions: [],
          },
        },
        meta: {
          logMessages: ['Program log: Some other instruction'],
          preBalances: [],
          postBalances: [],
        },
      } as any;

      const result = service.parseMintEvent(transaction);

      expect(result).toBeNull();
    });

    it('should handle missing log messages', () => {
      const transaction: ParsedTransactionWithMeta = {
        transaction: {
          message: {
            accountKeys: [],
            instructions: [],
          },
        },
        meta: {
          logMessages: null,
        },
      } as any;

      const result = service.parseMintEvent(transaction);

      expect(result).toBeNull();
    });
  });

  describe('parseBuybackEvent', () => {
    it('should parse buyback event from logs', () => {
      const transaction: ParsedTransactionWithMeta = {
        transaction: {
          message: {
            accountKeys: [],
            instructions: [],
          },
        },
        meta: {
          logMessages: [
            'Program log: Buyback executed: 1 SOL swapped for 5000000 tokens',
          ],
        },
        blockTime: Math.floor(Date.now() / 1000),
      } as any;

      const result = service.parseBuybackEvent(transaction);

      expect(result).toBeDefined();
      if (result) {
        expect(result.amountSol).toBe(1);
        expect(result.tokenAmount).toBe(5000000);
      }
    });

    it('should return null if no buyback event found', () => {
      const transaction: ParsedTransactionWithMeta = {
        transaction: {
          message: {
            accountKeys: [],
            instructions: [],
          },
        },
        meta: {
          logMessages: ['Program log: Some other instruction'],
        },
      } as any;

      const result = service.parseBuybackEvent(transaction);

      expect(result).toBeNull();
    });

    it('should handle missing blockTime', () => {
      const transaction: ParsedTransactionWithMeta = {
        transaction: {
          message: {
            accountKeys: [],
            instructions: [],
          },
        },
        meta: {
          logMessages: [
            'Program log: Buyback executed: 1 SOL swapped for 5000000 tokens',
          ],
        },
        blockTime: null,
      } as any;

      const result = service.parseBuybackEvent(transaction);

      expect(result).toBeDefined();
      if (result) {
        expect(result.timestamp).toBeGreaterThan(0);
      }
    });
  });
});
