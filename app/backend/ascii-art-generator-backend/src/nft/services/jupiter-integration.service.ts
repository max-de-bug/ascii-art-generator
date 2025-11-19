import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JupiterIntegrationService {
  private readonly logger = new Logger(JupiterIntegrationService.name);
  // ✅ Valid Jupiter API v6 endpoint
  private readonly apiBase = 'https://quote-api.jup.ag/v6';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get swap quote from Jupiter API
   * 
   * @param inputMint - Input token mint address (e.g., WSOL)
   * @param outputMint - Output token mint address (e.g., buyback token)
   * @param amount - Amount in lamports
   * @param slippageBps - Slippage in basis points (default: 100 = 1%)
   * @returns Quote response with expected output amount
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 100
  ): Promise<any> {
    try {
      const url = `${this.apiBase}/quote?` +
        `inputMint=${inputMint}&` +
        `outputMint=${outputMint}&` +
        `amount=${amount}&` +
        `slippageBps=${slippageBps}`;

      this.logger.debug(`Fetching Jupiter quote: ${inputMint} → ${outputMint}, amount: ${amount}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter quote failed: ${response.statusText} - ${errorText}`);
      }

      const quote = await response.json();
      this.logger.debug(`Jupiter quote received: ${quote.outAmount} tokens`);
      
      return quote;
    } catch (error) {
      this.logger.error('Error fetching Jupiter quote:', error);
      throw error;
    }
  }

  /**
   * Get swap transaction from Jupiter API
   * 
   * @param quoteResponse - Quote response from getQuote()
   * @param userPublicKey - Public key of the user executing the swap
   * @returns Swap transaction (base64 encoded)
   */
  async getSwapTransaction(
    quoteResponse: any,
    userPublicKey: string
  ): Promise<any> {
    try {
      const response = await fetch(`${this.apiBase}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true, // Automatically wrap/unwrap SOL
          dynamicComputeUnitLimit: true, // Optimize compute units
          prioritizationFeeLamports: 'auto', // Auto-calculate priority fee
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter swap failed: ${response.statusText} - ${errorText}`);
      }

      const swapResponse = await response.json();
      this.logger.debug('Jupiter swap transaction received');
      
      return swapResponse;
    } catch (error) {
      this.logger.error('Error getting Jupiter swap transaction:', error);
      throw error;
    }
  }

  /**
   * Calculate minimum output with slippage protection
   * 
   * @param expectedOutput - Expected output from quote
   * @param slippageBps - Slippage in basis points
   * @returns Minimum acceptable output amount
   */
  calculateMinimumOutput(expectedOutput: bigint, slippageBps: number): bigint {
    const slippageMultiplier = BigInt(10000 - slippageBps);
    return (expectedOutput * slippageMultiplier) / BigInt(10000);
  }
}

