import * as Joi from 'joi';

/**
 * Configuration validation schema
 * Validates all environment variables on startup
 */
export const validationSchema = Joi.object({
  // Server
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  // Solana Configuration
  SOLANA_RPC_URL: Joi.string().uri().optional(),
  SOLANA_RPC_URL_MAINNET: Joi.string().uri().optional(),
  SOLANA_RPC_URL_DEVNET: Joi.string().uri().optional(),
  SOLANA_PROGRAM_ID: Joi.string().length(44).optional(),
  SOLANA_NETWORK: Joi.string()
    .valid('mainnet-beta', 'devnet', 'testnet')
    .default('mainnet-beta'),
  SOLANA_COMMITMENT: Joi.string()
    .valid('processed', 'confirmed', 'finalized')
    .default('confirmed'),

  // Buyback Configuration
  BUYBACK_ENABLED: Joi.string()
    .valid('true', 'false')
    .default('false'),
  BUYBACK_THRESHOLD_SOL: Joi.number().min(0).default(0.1),
  BUYBACK_MAX_AMOUNT_SOL: Joi.number().min(0).default(10.0),
  BUYBACK_SLIPPAGE_BPS: Joi.number().min(0).max(10000).default(100),
  BUYBACK_CHECK_INTERVAL_MS: Joi.number().min(1000).default(3600000),
  BUYBACK_RETRY_ATTEMPTS: Joi.number().min(1).max(10).default(3),
  BUYBACK_RETRY_DELAY_MS: Joi.number().min(100).default(5000),
  AUTHORITY_KEYPAIR_PATH: Joi.string().optional(),
  AUTHORITY_PRIVATE_KEY: Joi.string().optional(),
  BUYBACK_TOKEN_MINT: Joi.string().length(44).optional(),

  // Frontend
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number().min(1).default(60),
  RATE_LIMIT_MAX: Joi.number().min(1).default(100),
  RATE_LIMIT_STRICT_TTL: Joi.number().min(1).default(60),
  RATE_LIMIT_STRICT_MAX: Joi.number().min(1).default(10),
  RATE_LIMIT_VERY_STRICT_TTL: Joi.number().min(1).default(60),
  RATE_LIMIT_VERY_STRICT_MAX: Joi.number().min(1).default(5),
});

