import { registerAs } from '@nestjs/config';

export default registerAs('solana', () => ({
  // RPC endpoints
  rpcUrl:
    process.env.SOLANA_RPC_URL ||
    process.env.SOLANA_RPC_URL_MAINNET ||
    'https://api.mainnet-beta.solana.com',
  rpcUrlDevnet:
    process.env.SOLANA_RPC_URL_DEVNET ||
    'https://api.devnet.solana.com',
  
  // Program ID from your Anchor program
  programId:
    process.env.SOLANA_PROGRAM_ID ||
    '56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt',
  
  // Network (mainnet-beta or devnet)
  network: process.env.SOLANA_NETWORK || 'mainnet-beta',
  
  // Commitment level
  commitment: (process.env.SOLANA_COMMITMENT || 'confirmed') as 'processed' | 'confirmed' | 'finalized',
}));

