import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JupiterIntegrationService } from '../jupiter-integration.service';

// Mock fetch
global.fetch = jest.fn();

describe('JupiterIntegrationService', () => {
  let service: JupiterIntegrationService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JupiterIntegrationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JupiterIntegrationService>(JupiterIntegrationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getQuote', () => {
    it('should fetch quote from Jupiter API', async () => {
      const mockQuote = {
        outAmount: '1000000',
        priceImpactPct: '0.1',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuote,
      });

      const result = await service.getQuote(
        'So11111111111111111111111111111111111111112',
        'AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm',
        1000000000,
        100,
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('quote-api.jup.ag/v6/quote'),
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(result).toEqual(mockQuote);
    });

    it('should throw error on API failure', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        text: async () => 'Invalid input',
      });

      await expect(
        service.getQuote(
          'So11111111111111111111111111111111111111112',
          'AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm',
          1000000000,
          100,
        ),
      ).rejects.toThrow('Jupiter quote failed');
    });
  });

  describe('getSwapTransaction', () => {
    it('should fetch swap transaction from Jupiter API', async () => {
      const mockQuote = { outAmount: '1000000' };
      const mockSwapResponse = {
        swapTransaction: 'base64encodedtransaction',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSwapResponse,
      });

      const result = await service.getSwapTransaction(
        mockQuote,
        'testPublicKey123',
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('quote-api.jup.ag/v6/swap'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteResponse: mockQuote,
            userPublicKey: 'testPublicKey123',
            wrapAndUnwrapSol: true,
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: 'auto',
          }),
        }),
      );
      expect(result).toEqual(mockSwapResponse);
    });
  });

  describe('calculateMinimumOutput', () => {
    it('should calculate minimum output with 1% slippage', () => {
      const expectedOutput = BigInt(1000000);
      const slippageBps = 100; // 1%
      const result = service.calculateMinimumOutput(
        expectedOutput,
        slippageBps,
      );

      // 1000000 * (10000 - 100) / 10000 = 990000
      expect(result).toBe(BigInt(990000));
    });

    it('should calculate minimum output with 0.5% slippage', () => {
      const expectedOutput = BigInt(1000000);
      const slippageBps = 50; // 0.5%
      const result = service.calculateMinimumOutput(
        expectedOutput,
        slippageBps,
      );

      // 1000000 * (10000 - 50) / 10000 = 995000
      expect(result).toBe(BigInt(995000));
    });

    it('should calculate minimum output with 5% slippage', () => {
      const expectedOutput = BigInt(1000000);
      const slippageBps = 500; // 5%
      const result = service.calculateMinimumOutput(
        expectedOutput,
        slippageBps,
      );

      // 1000000 * (10000 - 500) / 10000 = 950000
      expect(result).toBe(BigInt(950000));
    });

    it('should handle zero slippage', () => {
      const expectedOutput = BigInt(1000000);
      const slippageBps = 0;
      const result = service.calculateMinimumOutput(
        expectedOutput,
        slippageBps,
      );

      expect(result).toBe(expectedOutput);
    });
  });
});
