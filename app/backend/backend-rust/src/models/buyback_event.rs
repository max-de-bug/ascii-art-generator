use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// BuybackEvent Entity
/// Tracks buyback transactions when fees are swapped for buyback tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuybackEvent {
    /// Unique identifier (UUID)
    pub id: Uuid,

    /// Transaction signature (88 chars)
    pub transaction_signature: String,

    /// Amount of SOL swapped (in lamports)
    pub amount_sol: i64,

    /// Amount of tokens received (in token's smallest unit)
    pub token_amount: i64,

    /// Unix timestamp from event
    pub timestamp: i64,

    /// Solana slot number
    pub slot: i64,

    /// Block time from transaction
    pub block_time: Option<i64>,

    /// Record creation timestamp
    pub created_at: DateTime<Utc>,
}

/// DTO for creating a new BuybackEvent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBuybackEvent {
    pub transaction_signature: String,
    pub amount_sol: i64,
    pub token_amount: i64,
    pub timestamp: i64,
    pub slot: i64,
    pub block_time: Option<i64>,
}

/// DTO for BuybackEvent response (API output)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuybackEventResponse {
    pub id: String,
    pub transaction_signature: String,
    pub amount_sol: i64,
    pub token_amount: i64,
    pub timestamp: i64,
    pub slot: i64,
    pub block_time: Option<i64>,
    pub created_at: DateTime<Utc>,
}

impl From<BuybackEvent> for BuybackEventResponse {
    fn from(event: BuybackEvent) -> Self {
        BuybackEventResponse {
            id: event.id.to_string(),
            transaction_signature: event.transaction_signature,
            amount_sol: event.amount_sol,
            token_amount: event.token_amount,
            timestamp: event.timestamp,
            slot: event.slot,
            block_time: event.block_time,
            created_at: event.created_at,
        }
    }
}

/// Buyback statistics response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuybackStatistics {
    pub total_buybacks: i64,
    pub total_sol_swapped: i64,
    pub total_tokens_received: i64,
}

impl Default for BuybackStatistics {
    fn default() -> Self {
        BuybackStatistics {
            total_buybacks: 0,
            total_sol_swapped: 0,
            total_tokens_received: 0,
        }
    }
}

/// BuybackEvent data parsed from Solana transaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuybackEventData {
    pub amount_sol: i64,
    pub token_amount: i64,
    pub timestamp: i64,
}

impl BuybackEventData {
    /// Convert BuybackEventData to CreateBuybackEvent DTO
    pub fn to_create_buyback_event(
        &self,
        transaction_signature: String,
        slot: i64,
        block_time: Option<i64>,
    ) -> CreateBuybackEvent {
        CreateBuybackEvent {
            transaction_signature,
            amount_sol: self.amount_sol,
            token_amount: self.token_amount,
            timestamp: self.timestamp,
            slot,
            block_time,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_buyback_event_response_from_event() {
        let event = BuybackEvent {
            id: Uuid::new_v4(),
            transaction_signature: "test_signature_123".to_string(),
            amount_sol: 1_000_000_000, // 1 SOL in lamports
            token_amount: 5_000_000,
            timestamp: 1234567890,
            slot: 100,
            block_time: Some(1234567890),
            created_at: Utc::now(),
        };

        let response: BuybackEventResponse = event.clone().into();
        assert_eq!(response.id, event.id.to_string());
        assert_eq!(response.transaction_signature, "test_signature_123");
        assert_eq!(response.amount_sol, 1_000_000_000);
        assert_eq!(response.token_amount, 5_000_000);
        assert_eq!(response.timestamp, 1234567890);
        assert_eq!(response.slot, 100);
        assert_eq!(response.block_time, Some(1234567890));
    }

    #[test]
    fn test_buyback_event_data_to_create() {
        let data = BuybackEventData {
            amount_sol: 500_000_000, // 0.5 SOL
            token_amount: 2_500_000,
            timestamp: 1234567890,
        };

        let create = data.to_create_buyback_event("sig123".to_string(), 200, Some(1234567890));

        assert_eq!(create.transaction_signature, "sig123");
        assert_eq!(create.amount_sol, 500_000_000);
        assert_eq!(create.token_amount, 2_500_000);
        assert_eq!(create.slot, 200);
        assert_eq!(create.block_time, Some(1234567890));
    }

    #[test]
    fn test_buyback_statistics_default() {
        let stats = BuybackStatistics::default();
        assert_eq!(stats.total_buybacks, 0);
        assert_eq!(stats.total_sol_swapped, 0);
        assert_eq!(stats.total_tokens_received, 0);
    }
}
