# ASCII Art Generator Backend (Rust)

A high-performance Rust backend for indexing Solana transactions and tracking NFT mints with a user leveling system. This is a rewrite of the original NestJS backend in Rust for improved performance and reliability.

## Features

- ✅ **Solana Transaction Indexer**: Listens to real-time transactions from your Anchor program
- ✅ **MintEvent Parsing**: Extracts NFT mint events from Solana transactions using Borsh deserialization
- ✅ **User Leveling System**: Calculates user levels based on NFT mint count
- ✅ **ZENITH Shard System**: Achievement-based progression with collectible shards
- ✅ **REST API**: High-performance endpoints built with Actix-web
- ✅ **Real-time Indexing**: Polling-based indexing for live updates
- ✅ **Burned NFT Cleanup**: Automatic removal of burned NFTs from the database
- ✅ **Jupiter DEX Integration**: Support for buyback functionality via Jupiter API
- ✅ **PostgreSQL Database**: Robust data persistence with SQLx

## Requirements

- Rust 1.70+ (install via [rustup](https://rustup.rs/))
- PostgreSQL 14+
- Solana RPC endpoint (mainnet or devnet)

## Setup

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. Clone and Navigate

```bash
cd app/backend/backend-rust
```

### 3. Configure Environment Variables

Copy the example environment file and customize it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password_here
DB_NAME=ascii_art_generator

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_PROGRAM_ID=56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt
SOLANA_NETWORK=mainnet-beta
SOLANA_COMMITMENT=confirmed

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:3000
```

**For Production**, use a dedicated RPC provider:
- [QuickNode](https://www.quicknode.com/)
- [Helius](https://www.helius.dev/)
- [Alchemy](https://www.alchemy.com/)

### 4. Create Database

```bash
# PostgreSQL
createdb ascii_art_generator

# Or using psql
psql -U postgres -c "CREATE DATABASE ascii_art_generator;"
```

### 5. Build and Run

```bash
# Development (with hot reload)
cargo watch -x run

# Or standard run
cargo run

# Production build
cargo build --release
./target/release/ascii-art-generator-backend
```

The server will start on `http://localhost:3001` and the indexer will automatically begin listening to transactions.

## API Endpoints

### Health Check
```
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "timestamp": 1234567890
}
```

### Get Indexer Status
```
GET /nft/indexer/status
```

Response:
```json
{
  "isIndexing": true,
  "programId": "56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt",
  "processedTransactions": 150,
  "currentlyProcessing": 2,
  "totalErrors": 0
}
```

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

### Get User Shard Status
```
GET /nft/user/:walletAddress/shard-status
```

Response:
```json
{
  "shards": [
    {
      "id": "quartz",
      "name": "Quartz Shard",
      "emoji": "⚪",
      "description": "Mint 50 ASCII art NFTs",
      "earned": false,
      "canBeLost": false
    }
  ],
  "totalShards": 0,
  "hasZenith": false,
  "shardsNeededForZenith": 6
}
```

### Get NFT by Mint Address
```
GET /nft/mint/:mintAddress
```

### Get Statistics
```
GET /nft/statistics
```

### Get Buyback Events
```
GET /nft/buybacks?limit=50&offset=0
```

### Get Buyback Statistics
```
GET /nft/buybacks/statistics
```

## ZENITH Shard System

Users earn shards by completing specific achievements. 6 shards are needed to attain ZENITH status.

| Shard | Name | Description | Can Be Lost |
|-------|------|-------------|-------------|
| ⚪ | Quartz | Mint 50 ASCII art NFTs | No |
| 🟣 | Amethyst | Maintain collection of 10+ NFTs | Yes |
| 🔴 | Ruby | Mint 5+ NFTs in last 30 days | Yes |
| 🔵 | Sapphire | Mint 100 total NFTs | No |
| 🟢 | Emerald | Mint 25 unique NFTs | No |
| ⚫ | Obsidian | Mystery achievement | No |

## Project Structure

```
backend-rust/
├── Cargo.toml              # Dependencies and project config
├── .env.example            # Example environment variables
├── migrations/             # SQLx database migrations
│   └── 20240101000000_initial.sql
└── src/
    ├── main.rs             # Application entry point
    ├── config.rs           # Configuration management
    ├── error.rs            # Error types and handling
    ├── handlers/           # HTTP request handlers
    │   ├── mod.rs
    │   ├── health.rs       # Health check endpoints
    │   └── nft.rs          # NFT-related endpoints
    ├── models/             # Data models and entities
    │   ├── mod.rs
    │   ├── nft.rs          # NFT entity
    │   ├── user.rs         # User entity
    │   ├── user_level.rs   # User level entity
    │   ├── buyback_event.rs # Buyback event entity
    │   └── level_calculator.rs # ZENITH shard system
    └── services/           # Business logic services
        ├── mod.rs
        ├── event_parser.rs     # Anchor event parsing
        ├── nft_storage.rs      # Database operations
        ├── solana_indexer.rs   # Blockchain indexing
        └── jupiter_integration.rs # Jupiter DEX API
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Server port | `3001` |
| `DB_HOST` | PostgreSQL host | Required |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | PostgreSQL username | Required |
| `DB_PASSWORD` | PostgreSQL password | Required |
| `DB_NAME` | PostgreSQL database name | Required |
| `SOLANA_RPC_URL` | Solana mainnet RPC URL | `https://api.mainnet-beta.solana.com` |
| `SOLANA_PROGRAM_ID` | Anchor program ID | Required |
| `SOLANA_NETWORK` | Network (mainnet-beta/devnet) | `mainnet-beta` |
| `SOLANA_COMMITMENT` | Commitment level | `confirmed` |
| `FRONTEND_URL` | CORS allowed origins | `http://localhost:3000` |
| `RUST_LOG` | Log level filter | `info` |

### Logging

Configure logging with the `RUST_LOG` environment variable:

```bash
# Default info level
RUST_LOG=info

# Debug level for all crates
RUST_LOG=debug

# Specific crate levels
RUST_LOG=info,sqlx=warn,actix_web=debug
```

## Development

### Run Tests

```bash
# Run all tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_name
```

### Watch Mode

Install cargo-watch for hot reloading:

```bash
cargo install cargo-watch
cargo watch -x run
```

### Database Migrations

Migrations are run automatically on startup if `RUN_MIGRATIONS=true`.

To run manually:

```bash
# Install sqlx-cli
cargo install sqlx-cli

# Run migrations
sqlx migrate run

# Revert last migration
sqlx migrate revert
```

## Production Deployment

### Build Release Binary

```bash
cargo build --release
```

The optimized binary will be at `./target/release/ascii-art-generator-backend`.

### Docker (Optional)

```dockerfile
FROM rust:1.75-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/ascii-art-generator-backend /usr/local/bin/
CMD ["ascii-art-generator-backend"]
```

### Performance Tuning

The release build is optimized with:
- LTO (Link-Time Optimization)
- Single codegen unit
- Maximum optimization level

For even better performance, consider:
- Connection pooling (already configured)
- Redis caching for frequently accessed data
- Load balancing with multiple instances

## Troubleshooting

### Indexer not starting

- Check RPC endpoint is accessible
- Verify program ID is correct
- Check network matches your deployment
- Review logs with `RUST_LOG=debug`

### Database connection errors

- Verify PostgreSQL is running
- Check connection credentials
- Ensure database exists
- Check firewall rules

### Events not being parsed

- Verify transaction format matches expected structure
- Check logs for parsing errors with `RUST_LOG=debug`
- Ensure program emits events correctly
- Verify Borsh serialization matches Anchor IDL

### High memory usage

- Reduce `max_cache_size` in indexer configuration
- Lower `CLEANUP_INTERVAL_MS` for more frequent cleanup
- Monitor with `htop` or similar tools

## Migration from Node.js Backend

The Rust backend is API-compatible with the original NestJS backend. To migrate:

1. Set up the Rust backend with the same database
2. Run migrations (tables are compatible)
3. Update your frontend's API URL to point to the Rust backend
4. The indexer will continue from where it left off

## License

UNLICENSED - Private repository

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `cargo test`
5. Run clippy: `cargo clippy`
6. Submit a pull request