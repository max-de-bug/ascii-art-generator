-- Initial migration for ASCII Art Generator Backend (Rust)
-- Creates all necessary tables for NFTs, users, user levels, and buyback events

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- NFTs table
-- Stores minted ASCII art NFTs
CREATE TABLE IF NOT EXISTS nfts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mint VARCHAR(44) UNIQUE NOT NULL,
    minter VARCHAR(44) NOT NULL,
    name VARCHAR(255) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    uri TEXT NOT NULL,
    transaction_signature VARCHAR(88) UNIQUE NOT NULL,
    slot BIGINT NOT NULL,
    block_time BIGINT,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for NFTs table
CREATE INDEX IF NOT EXISTS idx_nfts_mint ON nfts(mint);
CREATE INDEX IF NOT EXISTS idx_nfts_minter ON nfts(minter);
CREATE INDEX IF NOT EXISTS idx_nfts_transaction_signature ON nfts(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_nfts_created_at ON nfts(created_at);
CREATE INDEX IF NOT EXISTS idx_nfts_updated_at ON nfts(updated_at);

-- Users table
-- Stores general user information identified by wallet address
CREATE TABLE IF NOT EXISTS users (
    wallet_address VARCHAR(44) PRIMARY KEY,
    display_name VARCHAR(100),
    bio TEXT,
    avatar VARCHAR(500),
    email VARCHAR(100),
    preferences JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User levels table
-- Tracks user level and experience based on NFT mints
CREATE TABLE IF NOT EXISTS user_levels (
    wallet_address VARCHAR(44) PRIMARY KEY,
    total_mints INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    experience INTEGER NOT NULL DEFAULT 0,
    next_level_mints INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1
);

-- Index for user levels
CREATE INDEX IF NOT EXISTS idx_user_levels_level ON user_levels(level);
CREATE INDEX IF NOT EXISTS idx_user_levels_total_mints ON user_levels(total_mints);

-- Buyback events table
-- Tracks buyback transactions when fees are swapped for buyback tokens
CREATE TABLE IF NOT EXISTS buyback_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_signature VARCHAR(88) UNIQUE NOT NULL,
    amount_sol BIGINT NOT NULL,
    token_amount BIGINT NOT NULL,
    timestamp BIGINT NOT NULL,
    slot BIGINT NOT NULL,
    block_time BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for buyback events table
CREATE INDEX IF NOT EXISTS idx_buyback_events_transaction_signature ON buyback_events(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_buyback_events_timestamp ON buyback_events(timestamp);

-- User shards table (optional - for tracking earned shards)
CREATE TABLE IF NOT EXISTS user_shards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(44) NOT NULL,
    shard_id VARCHAR(50) NOT NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(wallet_address, shard_id)
);

-- Index for user shards
CREATE INDEX IF NOT EXISTS idx_user_shards_wallet_address ON user_shards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_shards_shard_id ON user_shards(shard_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_nfts_updated_at ON nfts;
CREATE TRIGGER update_nfts_updated_at
    BEFORE UPDATE ON nfts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_levels_updated_at ON user_levels;
CREATE TRIGGER update_user_levels_updated_at
    BEFORE UPDATE ON user_levels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
