//! NFT Storage Service
//!
//! Handles all database operations for NFTs, users, and user levels.
//! Includes ownership verification and cleanup of burned NFTs.

use chrono::{Duration, Utc};
use deadpool_postgres::Pool;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_postgres::Row;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use crate::models::{
    buyback_event::{BuybackEvent, BuybackStatistics, CreateBuybackEvent},
    calculate_shard_status,
    nft::{CreateNft, Nft},
    user_level::UserLevel,
    UserShardStatus, UserStats,
};

/// Statistics response structure
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Statistics {
    pub total_nfts: i64,
    pub total_users: i64,
    pub total_mints: i64,
    pub buybacks: BuybackStatistics,
}

/// NFT Storage Service
///
/// Manages all database operations for NFTs, user levels, and buyback events.
/// Also handles periodic cleanup of burned NFTs.
pub struct NftStorageService {
    pool: Pool,
    config: AppConfig,
    rpc_client: Option<RpcClient>,
    cleanup_running: Arc<RwLock<bool>>,
}

impl NftStorageService {
    /// Configuration constants
    const CLEANUP_INTERVAL_MS: u64 = 60 * 60 * 1000; // 1 hour
    const BATCH_SIZE: i64 = 50;
    const VERIFICATION_AGE_DAYS: i64 = 1;
    const CONCURRENT_OWNERSHIP_CHECKS: usize = 10;
    const RPC_DELAY_MS: u64 = 50;

    /// Create a new NftStorageService
    pub async fn new(pool: Pool, config: AppConfig) -> AppResult<Self> {
        let rpc_url = config.get_rpc_url();

        let rpc_client = if !rpc_url.is_empty() {
            Some(RpcClient::new(rpc_url.to_string()))
        } else {
            warn!("Solana RPC URL not configured. Ownership verification will be disabled.");
            None
        };

        info!(
            "Initialized NFT Storage Service. Network: {}, RPC: {}...",
            config.solana.network,
            &rpc_url[..rpc_url.len().min(30)]
        );

        Ok(Self {
            pool,
            config,
            rpc_client,
            cleanup_running: Arc::new(RwLock::new(false)),
        })
    }

    /// Start the periodic cleanup task for burned NFTs
    pub async fn start_cleanup_task(self: Arc<Self>) {
        info!(
            "Starting periodic cleanup of burned NFTs (every {} hours)",
            Self::CLEANUP_INTERVAL_MS / 1000 / 60 / 60
        );

        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(
            Self::CLEANUP_INTERVAL_MS,
        ));

        loop {
            interval.tick().await;

            let service = Arc::clone(&self);
            if let Err(e) = service.cleanup_burned_nfts().await {
                error!("Error during burned NFTs cleanup: {}", e);
            }
        }
    }

    /// Cleanup burned NFTs from the database
    pub async fn cleanup_burned_nfts(&self) -> AppResult<()> {
        // Check if cleanup is already running
        {
            let mut running = self.cleanup_running.write().await;
            if *running {
                debug!("Cleanup already running, skipping...");
                return Ok(());
            }
            *running = true;
        }

        let verification_threshold = Utc::now() - Duration::days(Self::VERIFICATION_AGE_DAYS);

        let mut offset: i64 = 0;
        let mut total_removed = 0;
        let mut total_checked = 0;

        info!("Starting burned NFT cleanup...");

        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        loop {
            // Get batch of NFTs to check
            let rows = client
                .query(
                    "SELECT id, mint, minter, name, symbol, uri, transaction_signature, slot, block_time, timestamp, created_at, updated_at
                     FROM nfts WHERE updated_at < $1 ORDER BY updated_at ASC LIMIT $2 OFFSET $3",
                    &[&verification_threshold, &Self::BATCH_SIZE, &offset],
                )
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;

            if rows.is_empty() {
                break;
            }

            let batch_size = rows.len();
            total_checked += batch_size;

            // Check ownership in chunks
            let mut to_remove: Vec<Uuid> = Vec::new();

            for row in &rows {
                let nft = Self::row_to_nft(row)?;
                if self.rpc_client.is_some() {
                    match self.is_nft_owned_by_wallet(&nft.mint, &nft.minter).await {
                        Ok(false) => {
                            to_remove.push(nft.id);
                        }
                        Err(e) => {
                            warn!("Error checking ownership for {}: {}", nft.mint, e);
                        }
                        _ => {}
                    }
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(Self::RPC_DELAY_MS)).await;
            }

            // Remove burned NFTs
            if !to_remove.is_empty() {
                // Get affected minters before deletion
                let minter_rows = client
                    .query(
                        "SELECT DISTINCT minter FROM nfts WHERE id = ANY($1)",
                        &[&to_remove],
                    )
                    .await
                    .map_err(|e| AppError::Database(e.to_string()))?;

                let affected_minters: Vec<String> = minter_rows
                    .iter()
                    .map(|r| r.get::<_, String>(0))
                    .collect();

                // Delete NFTs
                let deleted = client
                    .execute("DELETE FROM nfts WHERE id = ANY($1)", &[&to_remove])
                    .await
                    .map_err(|e| AppError::Database(e.to_string()))?;

                total_removed += deleted as usize;

                // Recalculate levels for affected users
                for minter in affected_minters {
                    if let Err(e) = self.recalculate_user_level(&minter).await {
                        warn!("Failed to recalculate level for {}: {}", minter, e);
                    }
                }
            }

            offset += Self::BATCH_SIZE;

            if batch_size < Self::BATCH_SIZE as usize {
                break;
            }
        }

        info!(
            "Burned NFT cleanup complete. Checked: {}, Removed: {}",
            total_checked, total_removed
        );

        // Reset running flag
        {
            let mut running = self.cleanup_running.write().await;
            *running = false;
        }

        Ok(())
    }

    /// Check if an NFT is owned by a specific wallet
    pub async fn is_nft_owned_by_wallet(&self, mint: &str, owner: &str) -> AppResult<bool> {
        let client = self
            .rpc_client
            .as_ref()
            .ok_or_else(|| AppError::Config("RPC client not configured".to_string()))?;

        let mint_pubkey = Pubkey::from_str(mint)
            .map_err(|e| AppError::Validation(format!("Invalid mint address: {}", e)))?;
        let owner_pubkey = Pubkey::from_str(owner)
            .map_err(|e| AppError::Validation(format!("Invalid owner address: {}", e)))?;

        // Get associated token address
        let ata =
            spl_associated_token_account::get_associated_token_address(&owner_pubkey, &mint_pubkey);

        // Check token account
        match client.get_token_account_balance(&ata) {
            Ok(balance) => {
                let amount: u64 = balance.amount.parse().unwrap_or(0);
                Ok(amount > 0)
            }
            Err(_) => Ok(false),
        }
    }

    /// Save a new NFT to the database
    pub async fn save_nft(&self, nft: CreateNft) -> AppResult<Nft> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        // Check if NFT already exists
        let existing = client
            .query_opt(
                "SELECT id, mint, minter, name, symbol, uri, transaction_signature, slot, block_time, timestamp, created_at, updated_at
                 FROM nfts WHERE mint = $1",
                &[&nft.mint],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        if let Some(row) = existing {
            debug!("NFT {} already exists, skipping", nft.mint);
            return Self::row_to_nft(&row);
        }

        // Verify ownership if RPC client is available
        if self.rpc_client.is_some() {
            match self.is_nft_owned_by_wallet(&nft.mint, &nft.minter).await {
                Ok(true) => {}
                Ok(false) => {
                    warn!(
                        "NFT {} not owned by minter {}, skipping",
                        nft.mint, nft.minter
                    );
                    return Err(AppError::Validation("NFT not owned by minter".to_string()));
                }
                Err(e) => {
                    warn!("Could not verify ownership for {}: {}", nft.mint, e);
                    // Continue anyway - ownership check is best-effort
                }
            }
        }

        let id = Uuid::new_v4();
        let now = Utc::now();

        let row = client
            .query_one(
                "INSERT INTO nfts (id, mint, minter, name, symbol, uri, transaction_signature, slot, block_time, timestamp, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 RETURNING id, mint, minter, name, symbol, uri, transaction_signature, slot, block_time, timestamp, created_at, updated_at",
                &[
                    &id,
                    &nft.mint,
                    &nft.minter,
                    &nft.name,
                    &nft.symbol,
                    &nft.uri,
                    &nft.transaction_signature,
                    &nft.slot,
                    &nft.block_time,
                    &nft.timestamp,
                    &now,
                    &now,
                ],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let saved_nft = Self::row_to_nft(&row)?;

        info!(
            "Saved new NFT: {} (mint: {}, minter: {})",
            saved_nft.name, saved_nft.mint, saved_nft.minter
        );

        // Update user level
        if let Err(e) = self.recalculate_user_level(&nft.minter).await {
            warn!("Failed to update user level for {}: {}", nft.minter, e);
        }

        Ok(saved_nft)
    }

    /// Get NFT by mint address
    pub async fn get_nft_by_mint(&self, mint: &str) -> AppResult<Option<Nft>> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        let row = client
            .query_opt(
                "SELECT id, mint, minter, name, symbol, uri, transaction_signature, slot, block_time, timestamp, created_at, updated_at
                 FROM nfts WHERE mint = $1",
                &[&mint],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        match row {
            Some(r) => Ok(Some(Self::row_to_nft(&r)?)),
            None => Ok(None),
        }
    }

    /// Get all NFTs for a specific minter
    pub async fn get_nfts_by_minter(&self, minter: &str) -> AppResult<Vec<Nft>> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        let rows = client
            .query(
                "SELECT id, mint, minter, name, symbol, uri, transaction_signature, slot, block_time, timestamp, created_at, updated_at
                 FROM nfts WHERE minter = $1 ORDER BY created_at DESC",
                &[&minter],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        rows.iter().map(Self::row_to_nft).collect()
    }

    /// Check if a transaction has already been processed
    pub async fn is_transaction_processed(&self, signature: &str) -> AppResult<bool> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        let nft_row = client
            .query_one(
                "SELECT COUNT(*) as count FROM nfts WHERE transaction_signature = $1",
                &[&signature],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let nft_count: i64 = nft_row.get(0);

        let buyback_row = client
            .query_one(
                "SELECT COUNT(*) as count FROM buyback_events WHERE transaction_signature = $1",
                &[&signature],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let buyback_count: i64 = buyback_row.get(0);

        Ok(nft_count > 0 || buyback_count > 0)
    }

    /// Get user level
    pub async fn get_user_level(&self, wallet_address: &str) -> AppResult<Option<UserLevel>> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        let row = client
            .query_opt(
                "SELECT wallet_address, total_mints, level, experience, next_level_mints, created_at, updated_at, version
                 FROM user_levels WHERE wallet_address = $1",
                &[&wallet_address],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        match row {
            Some(r) => Ok(Some(Self::row_to_user_level(&r)?)),
            None => Ok(None),
        }
    }

    /// Recalculate and update user level based on current mint count
    async fn recalculate_user_level(&self, wallet_address: &str) -> AppResult<()> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        // Get total mints for user
        let row = client
            .query_one(
                "SELECT COUNT(*) FROM nfts WHERE minter = $1",
                &[&wallet_address],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let total_mints: i64 = row.get(0);

        if total_mints == 0 {
            // Remove user level if no NFTs
            client
                .execute(
                    "DELETE FROM user_levels WHERE wallet_address = $1",
                    &[&wallet_address],
                )
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            return Ok(());
        }

        let level_data = crate::models::calculate_level(total_mints as i32);

        // Upsert user level
        client
            .execute(
                "INSERT INTO user_levels (wallet_address, total_mints, level, experience, next_level_mints, created_at, updated_at, version)
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 1)
                 ON CONFLICT (wallet_address)
                 DO UPDATE SET
                     total_mints = $2,
                     level = $3,
                     experience = $4,
                     next_level_mints = $5,
                     updated_at = NOW(),
                     version = user_levels.version + 1",
                &[
                    &wallet_address,
                    &(total_mints as i32),
                    &level_data.level,
                    &level_data.experience,
                    &level_data.next_level_mints,
                ],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// Get user shard status
    pub async fn get_user_shard_status(&self, wallet_address: &str) -> AppResult<UserShardStatus> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        // Get owned NFTs
        let nfts = self.get_nfts_by_minter(wallet_address).await?;
        let collection_size = nfts.len() as i32;

        // Get total mints (historical)
        let row = client
            .query_one(
                "SELECT COUNT(*) FROM nfts WHERE minter = $1",
                &[&wallet_address],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let total_mints: i64 = row.get(0);

        // Get recent mints (last 30 days)
        let thirty_days_ago = Utc::now() - Duration::days(30);
        let recent_row = client
            .query_one(
                "SELECT COUNT(*) FROM nfts WHERE minter = $1 AND created_at > $2",
                &[&wallet_address, &thirty_days_ago],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let recent_mints: i64 = recent_row.get(0);

        // Get unique mints (simplified - in production would check actual uniqueness)
        let unique_mints = collection_size;

        let user_stats = UserStats {
            total_mints: total_mints as i32,
            collection_size,
            recent_mints: recent_mints as i32,
            unique_mints,
            mint_history: vec![], // Would need to populate if needed
        };

        // Calculate shard status (no earned shards stored yet - would need separate table)
        let earned_shards: Vec<String> = vec![];
        let shard_status = calculate_shard_status(&user_stats, &earned_shards);

        Ok(shard_status)
    }

    /// Save a buyback event
    pub async fn save_buyback_event(&self, event: CreateBuybackEvent) -> AppResult<BuybackEvent> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        // Check if event already exists
        let existing = client
            .query_opt(
                "SELECT id, transaction_signature, amount_sol, token_amount, timestamp, slot, block_time, created_at
                 FROM buyback_events WHERE transaction_signature = $1",
                &[&event.transaction_signature],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        if let Some(row) = existing {
            debug!(
                "Buyback event {} already exists, skipping",
                event.transaction_signature
            );
            return Self::row_to_buyback_event(&row);
        }

        let id = Uuid::new_v4();
        let now = Utc::now();

        let row = client
            .query_one(
                "INSERT INTO buyback_events (id, transaction_signature, amount_sol, token_amount, timestamp, slot, block_time, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id, transaction_signature, amount_sol, token_amount, timestamp, slot, block_time, created_at",
                &[
                    &id,
                    &event.transaction_signature,
                    &event.amount_sol,
                    &event.token_amount,
                    &event.timestamp,
                    &event.slot,
                    &event.block_time,
                    &now,
                ],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let saved_event = Self::row_to_buyback_event(&row)?;

        info!(
            "Saved buyback event: {} SOL -> {} tokens",
            event.amount_sol as f64 / 1_000_000_000.0,
            event.token_amount
        );

        Ok(saved_event)
    }

    /// Get buyback events with pagination
    pub async fn get_buyback_events(
        &self,
        limit: i64,
        offset: i64,
    ) -> AppResult<Vec<BuybackEvent>> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        let rows = client
            .query(
                "SELECT id, transaction_signature, amount_sol, token_amount, timestamp, slot, block_time, created_at
                 FROM buyback_events ORDER BY timestamp DESC LIMIT $1 OFFSET $2",
                &[&limit, &offset],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        rows.iter().map(Self::row_to_buyback_event).collect()
    }

    /// Get buyback statistics
    pub async fn get_buyback_statistics(&self) -> AppResult<BuybackStatistics> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        let count_row = client
            .query_one("SELECT COUNT(*) FROM buyback_events", &[])
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let total_buybacks: i64 = count_row.get(0);

        let sol_row = client
            .query_one(
                "SELECT COALESCE(SUM(amount_sol), 0) FROM buyback_events",
                &[],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let total_sol: i64 = sol_row.get(0);

        let tokens_row = client
            .query_one(
                "SELECT COALESCE(SUM(token_amount), 0) FROM buyback_events",
                &[],
            )
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let total_tokens: i64 = tokens_row.get(0);

        Ok(BuybackStatistics {
            total_buybacks,
            total_sol_swapped: total_sol,
            total_tokens_received: total_tokens,
        })
    }

    /// Get overall statistics
    pub async fn get_statistics(&self) -> AppResult<Statistics> {
        let client = self.pool.get().await.map_err(|e| AppError::Database(e.to_string()))?;

        let nfts_row = client
            .query_one("SELECT COUNT(*) FROM nfts", &[])
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let total_nfts: i64 = nfts_row.get(0);

        let users_row = client
            .query_one("SELECT COUNT(DISTINCT minter) FROM nfts", &[])
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let total_users: i64 = users_row.get(0);

        let buyback_stats = self.get_buyback_statistics().await?;

        Ok(Statistics {
            total_nfts,
            total_users,
            total_mints: total_nfts,
            buybacks: buyback_stats,
        })
    }

    // Helper functions to convert database rows to structs

    fn row_to_nft(row: &Row) -> AppResult<Nft> {
        Ok(Nft {
            id: row.get("id"),
            mint: row.get("mint"),
            minter: row.get("minter"),
            name: row.get("name"),
            symbol: row.get("symbol"),
            uri: row.get("uri"),
            transaction_signature: row.get("transaction_signature"),
            slot: row.get("slot"),
            block_time: row.get("block_time"),
            timestamp: row.get("timestamp"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    fn row_to_user_level(row: &Row) -> AppResult<UserLevel> {
        Ok(UserLevel {
            wallet_address: row.get("wallet_address"),
            total_mints: row.get("total_mints"),
            level: row.get("level"),
            experience: row.get("experience"),
            next_level_mints: row.get("next_level_mints"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            version: row.get("version"),
        })
    }

    fn row_to_buyback_event(row: &Row) -> AppResult<BuybackEvent> {
        Ok(BuybackEvent {
            id: row.get("id"),
            transaction_signature: row.get("transaction_signature"),
            amount_sol: row.get("amount_sol"),
            token_amount: row.get("token_amount"),
            timestamp: row.get("timestamp"),
            slot: row.get("slot"),
            block_time: row.get("block_time"),
            created_at: row.get("created_at"),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_statistics_serialization() {
        let stats = Statistics {
            total_nfts: 100,
            total_users: 10,
            total_mints: 150,
            buybacks: BuybackStatistics {
                total_buybacks: 5,
                total_sol_swapped: 5_000_000_000,
                total_tokens_received: 1_000_000,
            },
        };

        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("\"totalNfts\":100"));
        assert!(json.contains("\"totalUsers\":10"));
        assert!(json.contains("\"totalMints\":150"));
    }
}
