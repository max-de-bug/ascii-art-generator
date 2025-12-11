//! Services for the ASCII Art Generator backend
//!
//! This module contains all the business logic services including:
//! - Event parsing from Solana transactions
//! - NFT storage and retrieval
//! - Solana blockchain indexing
//! - Jupiter DEX integration for buybacks

pub mod event_parser;
pub mod jupiter_integration;
pub mod nft_storage;
pub mod solana_indexer;

// Re-export commonly used types
pub use event_parser::EventParserService;
pub use jupiter_integration::JupiterIntegrationService;
pub use nft_storage::NftStorageService;
pub use solana_indexer::SolanaIndexerService;

