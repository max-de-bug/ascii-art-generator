# ASCII Art Generator Backend

NestJS backend for indexing Solana transactions and tracking NFT mints with user leveling system.

## Features

- ✅ **Solana Transaction Indexer**: Listens to real-time transactions from your Anchor program
- ✅ **MintEvent Parsing**: Extracts NFT mint events from Solana transactions
- ✅ **User Leveling System**: Calculates user levels based on NFT mint count
- ✅ **REST API**: Endpoints to fetch user NFTs and levels
- ✅ **Real-time Indexing**: WebSocket subscriptions for live updates

## Setup

### 1. Install Dependencies

```bash
cd app/backend/ascii-art-generator-backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the backend directory:

```env
# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_RPC_URL_DEVNET=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt
SOLANA_NETWORK=mainnet-beta
SOLANA_COMMITMENT=confirmed

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**For Production**, use a dedicated RPC provider:
- QuickNode: https://www.quicknode.com/
- Helius: https://www.helius.dev/
- Alchemy: https://www.alchemy.com/

Example:
```env
SOLANA_RPC_URL=https://your-quicknode-url.solana-mainnet.quiknode.pro/your-api-key/
```

### 3. Start the Server

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The server will start on `http://localhost:3001` and the indexer will automatically begin listening to transactions.

## API Endpoints

### Get User Profile (NFTs + Level)
```
GET /nft/user/:walletAddress
```

Response:
```json
{
  "walletAddress": "string",
  "nfts": [...],
  "userLevel": {
    "walletAddress": "string",
    "totalMints": 5,
    "level": 2,
    "experience": 2,
    "nextLevelMints": 3
  },
  "totalNfts": 5
}
```

### Get User Level
```
GET /nft/user/:walletAddress/level
```

### Get NFT by Mint Address
```
GET /nft/mint/:mintAddress
```

### Get Indexer Status
```
GET /nft/indexer/status
```

### Get Statistics
```
GET /nft/statistics
```

## User Leveling System

Levels are calculated based on total NFT mints:

| Level | Mints Required | Range |
|-------|---------------|-------|
| 1 | 0 | 0-4 mints |
| 2 | 5 | 5-9 mints |
| 3 | 10 | 10-19 mints |
| 4 | 20 | 20-39 mints |
| 5 | 40 | 40-79 mints |
| 6 | 80 | 80-149 mints |
| 7 | 150 | 150-249 mints |
| 8 | 250 | 250-499 mints |
| 9 | 500 | 500-999 mints |
| 10 | 1000 | 1000+ mints |

## How It Works

1. **Indexer Service** (`SolanaIndexerService`):
   - Subscribes to Solana program logs via WebSocket
   - Processes transactions in real-time
   - Parses `MintEvent` from transaction logs

2. **Event Parser** (`EventParserService`):
   - Extracts event data from transaction logs
   - Parses Anchor event structures
   - Handles base58 decoding

3. **Storage Service** (`NftStorageService`):
   - Stores NFTs in memory (replace with database for production)
   - Tracks user mint counts
   - Calculates user levels

4. **REST API**:
   - Exposes endpoints for frontend
   - Returns user NFTs and levels
   - Provides indexer status

## Frontend Integration

The frontend profile page (`app/profile/page.tsx`) fetches data from:

```
GET http://localhost:3001/nft/user/:walletAddress
```

Make sure to set the `NEXT_PUBLIC_API_URL` environment variable in your frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Production Considerations

### Database Integration

Replace in-memory storage with a database:

1. **PostgreSQL + Prisma**:
```bash
npm install @prisma/client prisma
npx prisma init
```

2. **MongoDB + Mongoose**:
```bash
npm install @nestjs/mongoose mongoose
```

3. **TypeORM + PostgreSQL**:
```bash
npm install @nestjs/typeorm typeorm pg
```

### Error Handling

- Add retry logic for RPC calls
- Implement transaction queuing
- Add error monitoring (Sentry, etc.)

### Performance

- Use database indexes on `minter` and `mint` fields
- Implement caching (Redis)
- Add rate limiting to API endpoints

## Troubleshooting

### Indexer not starting

- Check RPC endpoint is accessible
- Verify program ID is correct
- Check network matches your deployment

### Events not being parsed

- Verify transaction format matches expected structure
- Check logs for parsing errors
- Ensure program emits events correctly

### API returning empty data

- Check if indexer has processed transactions
- Verify wallet address is correct
- Check indexer status endpoint
