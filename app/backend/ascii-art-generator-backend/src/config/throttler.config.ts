import { registerAs } from '@nestjs/config';

export default registerAs('throttler', () => ({
  // Global rate limit (requests per time window)
  ttl: parseInt(process.env.RATE_LIMIT_TTL || '60'), // Time window in seconds (default: 60 seconds)
  limit: parseInt(process.env.RATE_LIMIT_MAX || '100'), // Max requests per time window (default: 100)

  // Stricter limits for specific endpoints
  strict: {
    ttl: parseInt(process.env.RATE_LIMIT_STRICT_TTL || '60'),
    limit: parseInt(process.env.RATE_LIMIT_STRICT_MAX || '10'), // Stricter limit (default: 10 per minute)
  },

  // Very strict limits for expensive operations
  veryStrict: {
    ttl: parseInt(process.env.RATE_LIMIT_VERY_STRICT_TTL || '60'),
    limit: parseInt(process.env.RATE_LIMIT_VERY_STRICT_MAX || '5'), // Very strict (default: 5 per minute)
  },
}));
