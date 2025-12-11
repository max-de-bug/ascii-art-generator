
use solana_client::rpc_client::RpcClient;
use solana_client::rpc_config::RpcTransactionConfig;
use solana_sdk::{commitment_config::CommitmentConfig, pubkey::Pubkey, signature::Signature};
use solana_transaction_status::{EncodedConfirmedTransactionWithStatusMeta, UiTransactionEncoding};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use crate::services::event_parser::EventParserService;
use crate::services::nft_storage::NftStorageService;

/// Indexer status information
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexerStatus {
    pub is_indexing: bool,
    pub program_id: String,
    pub subscription_id: Option<u64>,
    pub connection: String,
    pub processed_transactions: usize,
    pub currently_processing: usize,
    pub max_cache_size: usize,
    pub cache_utilization: f64,
    pub total_errors: u64,
    pub total_retries: u64,
    pub last_processed_at: Option<i64>,
    pub configuration: IndexerConfiguration,
}

/// Indexer configuration details
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexerConfiguration {
    pub max_concurrent_processing: usize,
    pub polling_interval_ms: u64,
    pub max_retries: u32,
    pub cache_retention_hours: u64,
}

/// Internal metrics tracking
struct IndexerMetrics {
    total_processed: u64,
    total_errors: u64,
    total_retries: u64,
    last_processed_at: Option<Instant>,
}

/// Solana Indexer Service
///
/// Responsible for:
/// - Subscribing to program logs via WebSocket
/// - Polling for recent transactions
/// - Processing transactions and extracting events
/// - Backfilling historical transactions on startup
pub struct SolanaIndexerService {
    config: AppConfig,
    rpc_client: RpcClient,
    program_id: Pubkey,
    event_parser: Arc<EventParserService>,
    nft_storage: Arc<NftStorageService>,

    // State
    is_indexing: Arc<RwLock<bool>>,
    processed_signatures: Arc<RwLock<HashMap<String, Instant>>>,
    processing_signatures: Arc<RwLock<std::collections::HashSet<String>>>,
    metrics: Arc<RwLock<IndexerMetrics>>,

    // Configuration constants
    max_cache_size: usize,
    cache_retention_ms: u64,
    polling_interval_ms: u64,
    backfill_limit: usize,
    poll_limit: usize,
    max_retries: u32,
    retry_delay_ms: u64,
    max_concurrent_processing: usize,
    rate_limit_delay_ms: u64,
}

impl SolanaIndexerService {
    /// Create a new SolanaIndexerService
    pub async fn new(
        config: AppConfig,
        event_parser: Arc<EventParserService>,
        nft_storage: Arc<NftStorageService>,
    ) -> AppResult<Self> {
        let rpc_url = config.get_rpc_url();

        if rpc_url.is_empty() {
            return Err(AppError::Config(
                "Missing Solana RPC URL configuration".to_string(),
            ));
        }

        let commitment = match config.solana.commitment.as_str() {
            "processed" => CommitmentConfig::processed(),
            "confirmed" => CommitmentConfig::confirmed(),
            "finalized" => CommitmentConfig::finalized(),
            _ => CommitmentConfig::confirmed(),
        };

        let rpc_client = RpcClient::new_with_commitment(rpc_url.to_string(), commitment);

        let program_id = Pubkey::from_str(&config.solana.program_id)
            .map_err(|e| AppError::Config(format!("Invalid program ID: {}", e)))?;

        info!("Initialized indexer for program: {}", program_id);
        info!("RPC URL: {}", rpc_url);
        info!("Network: {}", config.solana.network);

        Ok(Self {
            config,
            rpc_client,
            program_id,
            event_parser,
            nft_storage,
            is_indexing: Arc::new(RwLock::new(false)),
            processed_signatures: Arc::new(RwLock::new(HashMap::new())),
            processing_signatures: Arc::new(RwLock::new(std::collections::HashSet::new())),
            metrics: Arc::new(RwLock::new(IndexerMetrics {
                total_processed: 0,
                total_errors: 0,
                total_retries: 0,
                last_processed_at: None,
            })),
            max_cache_size: 100_000,
            cache_retention_ms: 24 * 60 * 60 * 1000, // 24 hours
            polling_interval_ms: 30_000,             // 30 seconds
            backfill_limit: 20,
            poll_limit: 20,
            max_retries: 5,
            retry_delay_ms: 2000,
            max_concurrent_processing: 3,
            rate_limit_delay_ms: 100,
        })
    }

    /// Start the indexing process
    pub async fn start_indexing(&mut self) -> AppResult<()> {
        {
            let mut is_indexing = self.is_indexing.write().await;
            if *is_indexing {
                warn!("Indexer is already running");
                return Ok(());
            }
            *is_indexing = true;
        }

        info!("Starting Solana indexer...");

        // Backfill recent transactions
        if let Err(e) = self.backfill_recent_transactions().await {
            warn!("Error during backfill: {}", e);
        }

        // Start polling loop
        self.start_polling().await;

        // Start cache cleanup task
        self.start_cleanup_task().await;

        info!("Indexer started successfully");
        Ok(())
    }

    /// Stop the indexing process
    pub async fn stop_indexing(&mut self) {
        info!("Stopping indexer...");

        let mut is_indexing = self.is_indexing.write().await;
        *is_indexing = false;

        info!("Indexer stopped");
    }

    /// Get current indexer status
    pub fn get_status(&self) -> IndexerStatus {
        let is_indexing = futures::executor::block_on(async { *self.is_indexing.read().await });

        let processed_count =
            futures::executor::block_on(async { self.processed_signatures.read().await.len() });

        let processing_count =
            futures::executor::block_on(async { self.processing_signatures.read().await.len() });

        let metrics = futures::executor::block_on(async { self.metrics.read().await.clone() });

        let last_processed_timestamp = metrics.last_processed_at.map(|instant| {
            let elapsed = instant.elapsed();
            chrono::Utc::now().timestamp() - elapsed.as_secs() as i64
        });

        IndexerStatus {
            is_indexing,
            program_id: self.program_id.to_string(),
            subscription_id: None,
            connection: self.config.get_rpc_url().to_string(),
            processed_transactions: processed_count,
            currently_processing: processing_count,
            max_cache_size: self.max_cache_size,
            cache_utilization: processed_count as f64 / self.max_cache_size as f64,
            total_errors: metrics.total_errors,
            total_retries: metrics.total_retries,
            last_processed_at: last_processed_timestamp,
            configuration: IndexerConfiguration {
                max_concurrent_processing: self.max_concurrent_processing,
                polling_interval_ms: self.polling_interval_ms,
                max_retries: self.max_retries,
                cache_retention_hours: self.cache_retention_ms / 1000 / 60 / 60,
            },
        }
    }

    /// Backfill recent transactions on startup
    async fn backfill_recent_transactions(&self) -> AppResult<()> {
        info!("Backfilling recent transactions...");

        // Use spawn_blocking for blocking RPC client call
        let rpc_url = self.config.get_rpc_url().to_string();
        let program_id = self.program_id;
        let signatures = tokio::task::spawn_blocking(move || {
            let client = RpcClient::new(rpc_url);
            client.get_signatures_for_address(&program_id)
        })
        .await
        .map_err(|e| AppError::SolanaRpc(format!("Task join error: {}", e)))?
        .map_err(|e| AppError::SolanaRpc(e.to_string()))?;

        let mut processed = 0;
        let mut skipped = 0;

        for sig_info in signatures.iter().take(self.backfill_limit) {
            let signature = &sig_info.signature;

            // Check if already processed
            if self.is_signature_processed(signature).await {
                skipped += 1;
                continue;
            }

            // Check database
            if self.nft_storage.is_transaction_processed(signature).await? {
                self.add_processed_signature(signature).await;
                skipped += 1;
                continue;
            }

            // Process transaction
            if let Err(e) = self.process_signature(signature).await {
                warn!("Error processing transaction {}: {}", signature, e);
            } else {
                processed += 1;
            }

            // Rate limiting
            tokio::time::sleep(Duration::from_millis(self.rate_limit_delay_ms)).await;
        }

        info!(
            "Backfill complete. Processed: {}, Skipped: {}",
            processed, skipped
        );
        Ok(())
    }

    /// Start the polling loop for new transactions
    async fn start_polling(&self) {
        let is_indexing = Arc::clone(&self.is_indexing);
        let processed_signatures = Arc::clone(&self.processed_signatures);
        let processing_signatures = Arc::clone(&self.processing_signatures);
        let metrics = Arc::clone(&self.metrics);
        let nft_storage = Arc::clone(&self.nft_storage);
        let event_parser = Arc::clone(&self.event_parser);
        let program_id = self.program_id;
        let rpc_url = self.config.get_rpc_url().to_string();
        let poll_limit = self.poll_limit;
        let polling_interval_ms = self.polling_interval_ms;
        let rate_limit_delay_ms = self.rate_limit_delay_ms;
        let max_retries = self.max_retries;
        let retry_delay_ms = self.retry_delay_ms;

        tokio::spawn(async move {
            loop {
                // Check if we should stop
                if !*is_indexing.read().await {
                    break;
                }

                // Poll for new transactions using spawn_blocking
                let rpc_url_clone = rpc_url.clone();
                let program_id_clone = program_id;
                let signatures_result = tokio::task::spawn_blocking(move || {
                    let client = RpcClient::new(rpc_url_clone);
                    client.get_signatures_for_address(&program_id_clone)
                })
                .await;

                match signatures_result {
                    Ok(Ok(signatures)) => {
                        for sig_info in signatures.iter().take(poll_limit) {
                            let signature = &sig_info.signature;

                            // Check if already processed
                            {
                                let processed = processed_signatures.read().await;
                                if processed.contains_key(signature) {
                                    continue;
                                }
                            }

                            // Check if currently processing
                            {
                                let processing = processing_signatures.read().await;
                                if processing.contains(signature) {
                                    continue;
                                }
                            }

                            // Mark as processing
                            {
                                let mut processing = processing_signatures.write().await;
                                processing.insert(signature.clone());
                            }

                            // Process transaction with retries
                            let mut success = false;
                            for attempt in 0..max_retries {
                                match Self::fetch_and_process_transaction(
                                    &rpc_url,
                                    signature,
                                    &program_id,
                                    &event_parser,
                                    &nft_storage,
                                )
                                .await
                                {
                                    Ok(_) => {
                                        success = true;
                                        break;
                                    }
                                    Err(e) => {
                                        if attempt < max_retries - 1 {
                                            let mut m = metrics.write().await;
                                            m.total_retries += 1;
                                            tokio::time::sleep(Duration::from_millis(
                                                retry_delay_ms * (attempt as u64 + 1),
                                            ))
                                            .await;
                                        } else {
                                            warn!(
                                                "Failed to process {} after {} attempts: {}",
                                                signature, max_retries, e
                                            );
                                        }
                                    }
                                }
                            }

                            // Update metrics and caches
                            {
                                let mut processing = processing_signatures.write().await;
                                processing.remove(signature);
                            }

                            if success {
                                let mut processed = processed_signatures.write().await;
                                processed.insert(signature.clone(), Instant::now());

                                let mut m = metrics.write().await;
                                m.total_processed += 1;
                                m.last_processed_at = Some(Instant::now());
                            } else {
                                let mut m = metrics.write().await;
                                m.total_errors += 1;
                            }

                            // Rate limiting
                            tokio::time::sleep(Duration::from_millis(rate_limit_delay_ms)).await;
                        }
                    }
                    Ok(Err(e)) => {
                        warn!("Error polling for signatures: {}", e);
                    }
                    Err(e) => {
                        warn!("Error joining spawn_blocking task: {}", e);
                    }
                }

                // Wait before next poll
                tokio::time::sleep(Duration::from_millis(polling_interval_ms)).await;
            }
        });
    }

    /// Fetch and process a single transaction
    async fn fetch_and_process_transaction(
        rpc_url: &str,
        signature: &str,
        program_id: &Pubkey,
        event_parser: &EventParserService,
        nft_storage: &NftStorageService,
    ) -> AppResult<()> {
        let sig = Signature::from_str(signature)
            .map_err(|e| AppError::Validation(format!("Invalid signature: {}", e)))?;

        // Use spawn_blocking for blocking RPC call
        let rpc_url_owned = rpc_url.to_string();
        let sig_clone = sig;
        let transaction = tokio::task::spawn_blocking(move || {
            let client = RpcClient::new(rpc_url_owned);
            let config = RpcTransactionConfig {
                encoding: Some(UiTransactionEncoding::Json),
                commitment: Some(CommitmentConfig::confirmed()),
                max_supported_transaction_version: Some(0),
            };
            client.get_transaction_with_config(&sig_clone, config)
        })
        .await
        .map_err(|e| AppError::SolanaRpc(format!("Task join error: {}", e)))?
        .map_err(|e| AppError::SolanaRpc(e.to_string()))?;

        // Process the transaction
        Self::process_transaction(
            &transaction,
            signature,
            program_id,
            event_parser,
            nft_storage,
        )
        .await
    }

    /// Process a transaction and extract events
    async fn process_transaction(
        transaction: &EncodedConfirmedTransactionWithStatusMeta,
        signature: &str,
        _program_id: &Pubkey,
        event_parser: &EventParserService,
        nft_storage: &NftStorageService,
    ) -> AppResult<()> {
        let slot = transaction.slot;
        let block_time = transaction.block_time;

        // Try to parse MintEvent
        if let Some(mint_event) = event_parser.parse_mint_event(transaction) {
            info!("Found MintEvent in transaction {}", signature);

            let create_nft =
                mint_event.to_create_nft(signature.to_string(), slot as i64, block_time);

            nft_storage.save_nft(create_nft).await?;
        }

        // Try to parse BuybackEvent
        if let Some(buyback_event) = event_parser.parse_buyback_event(transaction) {
            info!("Found BuybackEvent in transaction {}", signature);

            let create_buyback = buyback_event.to_create_buyback_event(
                signature.to_string(),
                slot as i64,
                block_time,
            );

            nft_storage.save_buyback_event(create_buyback).await?;
        }

        Ok(())
    }

    /// Process a single signature
    async fn process_signature(&self, signature: &str) -> AppResult<()> {
        Self::fetch_and_process_transaction(
            self.config.get_rpc_url(),
            signature,
            &self.program_id,
            &self.event_parser,
            &self.nft_storage,
        )
        .await
    }

    /// Check if a signature has been processed
    async fn is_signature_processed(&self, signature: &str) -> bool {
        let processed = self.processed_signatures.read().await;
        processed.contains_key(signature)
    }

    /// Add a signature to the processed cache
    async fn add_processed_signature(&self, signature: &str) {
        let mut processed = self.processed_signatures.write().await;
        processed.insert(signature.to_string(), Instant::now());

        // Cleanup if cache is too large
        if processed.len() > self.max_cache_size {
            let target_size = self.max_cache_size * 3 / 4;
            let mut entries: Vec<_> = processed.iter().map(|(k, v)| (k.clone(), *v)).collect();
            entries.sort_by(|a, b| a.1.cmp(&b.1));

            let to_remove = entries.len() - target_size;
            for (key, _) in entries.into_iter().take(to_remove) {
                processed.remove(&key);
            }
        }
    }

    /// Start cache cleanup task
    async fn start_cleanup_task(&self) {
        let processed_signatures = Arc::clone(&self.processed_signatures);
        let cache_retention_ms = self.cache_retention_ms;

        tokio::spawn(async move {
            let cleanup_interval = Duration::from_secs(60 * 60); // Every hour

            loop {
                tokio::time::sleep(cleanup_interval).await;

                let now = Instant::now();
                let retention_duration = Duration::from_millis(cache_retention_ms);

                let mut processed = processed_signatures.write().await;
                processed
                    .retain(|_, timestamp| now.duration_since(*timestamp) < retention_duration);

                debug!(
                    "Cache cleanup complete. Remaining entries: {}",
                    processed.len()
                );
            }
        });
    }
}

impl Clone for IndexerMetrics {
    fn clone(&self) -> Self {
        IndexerMetrics {
            total_processed: self.total_processed,
            total_errors: self.total_errors,
            total_retries: self.total_retries,
            last_processed_at: self.last_processed_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_indexer_status_serialization() {
        let status = IndexerStatus {
            is_indexing: true,
            program_id: "test_program".to_string(),
            subscription_id: Some(123),
            connection: "https://api.mainnet-beta.solana.com".to_string(),
            processed_transactions: 100,
            currently_processing: 5,
            max_cache_size: 100000,
            cache_utilization: 0.001,
            total_errors: 2,
            total_retries: 10,
            last_processed_at: Some(1234567890),
            configuration: IndexerConfiguration {
                max_concurrent_processing: 3,
                polling_interval_ms: 30000,
                max_retries: 5,
                cache_retention_hours: 24,
            },
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"isIndexing\":true"));
        assert!(json.contains("\"processedTransactions\":100"));
        assert!(json.contains("\"totalErrors\":2"));
    }

    #[test]
    fn test_indexer_configuration_defaults() {
        let config = IndexerConfiguration {
            max_concurrent_processing: 3,
            polling_interval_ms: 30000,
            max_retries: 5,
            cache_retention_hours: 24,
        };

        assert_eq!(config.max_concurrent_processing, 3);
        assert_eq!(config.polling_interval_ms, 30000);
        assert_eq!(config.max_retries, 5);
        assert_eq!(config.cache_retention_hours, 24);
    }
}
