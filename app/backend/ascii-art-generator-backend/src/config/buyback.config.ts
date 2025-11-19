import { registerAs } from '@nestjs/config';

export default registerAs('buyback', () => ({
      enabled: process.env.BUYBACK_ENABLED === 'true',
      thresholdSOL: parseFloat(process.env.BUYBACK_THRESHOLD_SOL || '0.1'),
      maxAmountSOL: parseFloat(process.env.BUYBACK_MAX_AMOUNT_SOL || '10.0'),
      slippageBps: parseInt(process.env.BUYBACK_SLIPPAGE_BPS || '100'),
      checkIntervalMs: parseInt(process.env.BUYBACK_CHECK_INTERVAL_MS || '3600000'),
      retryAttempts: parseInt(process.env.BUYBACK_RETRY_ATTEMPTS || '3'),
      retryDelayMs: parseInt(process.env.BUYBACK_RETRY_DELAY_MS || '5000'),
      authorityKeypairPath: process.env.AUTHORITY_KEYPAIR_PATH,
      authorityPrivateKey: process.env.AUTHORITY_PRIVATE_KEY,
  buybackTokenMint: process.env.BUYBACK_TOKEN_MINT || 'AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm',
}));