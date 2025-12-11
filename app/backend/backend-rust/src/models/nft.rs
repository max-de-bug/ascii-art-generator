use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// NFT Entity
/// Represents a minted ASCII art NFT stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Nft {
    /// Unique identifier (UUID)
    pub id: Uuid,

    /// Mint address (Solana Pubkey, 44 chars)
    pub mint: String,

    /// Minter wallet address (Solana Pubkey)
    pub minter: String,

    /// NFT name
    pub name: String,

    /// NFT symbol
    pub symbol: String,

    /// Metadata URI (IPFS)
    pub uri: String,

    /// Transaction signature (88 chars)
    pub transaction_signature: String,

    /// Solana slot number
    pub slot: i64,

    /// Block time from transaction (optional)
    pub block_time: Option<i64>,

    /// Unix timestamp from event
    pub timestamp: i64,

    /// Record creation timestamp
    pub created_at: DateTime<Utc>,

    /// Record update timestamp
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a new NFT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNft {
    pub mint: String,
    pub minter: String,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub transaction_signature: String,
    pub slot: i64,
    pub block_time: Option<i64>,
    pub timestamp: i64,
}

/// DTO for NFT response (API output)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NftResponse {
    pub id: String,
    pub mint: String,
    pub minter: String,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub transaction_signature: String,
    pub slot: i64,
    pub block_time: Option<i64>,
    pub timestamp: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Nft> for NftResponse {
    fn from(nft: Nft) -> Self {
        NftResponse {
            id: nft.id.to_string(),
            mint: nft.mint,
            minter: nft.minter,
            name: nft.name,
            symbol: nft.symbol,
            uri: nft.uri,
            transaction_signature: nft.transaction_signature,
            slot: nft.slot,
            block_time: nft.block_time,
            timestamp: nft.timestamp,
            created_at: nft.created_at,
            updated_at: nft.updated_at,
        }
    }
}

/// Response for user NFTs endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserNftsResponse {
    pub wallet_address: String,
    pub nfts: Vec<NftResponse>,
    pub user_level: Option<super::user_level::UserLevelResponse>,
    pub total_nfts: usize,
}

/// MintEvent data parsed from Solana transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MintEvent {
    pub minter: String,
    pub mint: String,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub timestamp: i64,
}

impl MintEvent {
    /// Convert MintEvent to CreateNft DTO
    pub fn to_create_nft(
        &self,
        transaction_signature: String,
        slot: i64,
        block_time: Option<i64>,
    ) -> CreateNft {
        CreateNft {
            mint: self.mint.clone(),
            minter: self.minter.clone(),
            name: self.name.clone(),
            symbol: self.symbol.clone(),
            uri: self.uri.clone(),
            transaction_signature,
            slot,
            block_time,
            timestamp: self.timestamp,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mint_event_to_create_nft() {
        let event = MintEvent {
            minter: "minter123".to_string(),
            mint: "mint456".to_string(),
            name: "Test NFT".to_string(),
            symbol: "TEST".to_string(),
            uri: "https://example.com/metadata.json".to_string(),
            timestamp: 1234567890,
        };

        let create_nft = event.to_create_nft("sig789".to_string(), 100, Some(1234567890));

        assert_eq!(create_nft.mint, "mint456");
        assert_eq!(create_nft.minter, "minter123");
        assert_eq!(create_nft.transaction_signature, "sig789");
        assert_eq!(create_nft.slot, 100);
    }
}
