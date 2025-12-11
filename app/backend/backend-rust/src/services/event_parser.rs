//! Event Parser Service
//!
//! Parses Anchor events from Solana transactions, including MintEvent and BuybackEvent.
//! Uses Borsh deserialization to decode event data from transaction logs.

use borsh::{BorshDeserialize, BorshSerialize};
use solana_sdk::pubkey::Pubkey;
use solana_transaction_status::{
    option_serializer::OptionSerializer, EncodedConfirmedTransactionWithStatusMeta,
    UiTransactionStatusMeta,
};
use std::io::Read;
use tracing::{debug, warn};

use crate::models::buyback_event::BuybackEventData;
use crate::models::nft::MintEvent;

/// Anchor event discriminator (first 8 bytes of SHA256("event:<EventName>"))
const MINT_EVENT_DISCRIMINATOR: [u8; 8] = [62, 73, 213, 84, 217, 70, 37, 55];
const BUYBACK_EVENT_DISCRIMINATOR: [u8; 8] = [73, 203, 66, 140, 17, 155, 53, 84];

/// Raw MintEvent structure for Borsh deserialization
#[derive(Debug, Clone, BorshSerialize, BorshDeserialize)]
pub struct RawMintEvent {
    pub minter: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub timestamp: i64,
}

/// Raw BuybackEvent structure for Borsh deserialization
#[derive(Debug, Clone, BorshSerialize, BorshDeserialize)]
pub struct RawBuybackEvent {
    pub amount_sol: u64,
    pub token_amount: u64,
    pub timestamp: i64,
}

/// Event Parser Service
///
/// Responsible for parsing Anchor events from Solana transaction logs.
/// Supports both MintEvent and BuybackEvent types.
#[derive(Debug, Clone)]
pub struct EventParserService {
    program_id: String,
}

impl EventParserService {
    /// Create a new EventParserService
    pub fn new(program_id: String) -> Self {
        debug!("[EventParser] Initialized for program: {}", program_id);
        Self { program_id }
    }

    /// Parse MintEvent from a transaction
    ///
    /// Anchor events are emitted in the program logs with format:
    /// "Program data: <base64_encoded_event_data>"
    pub fn parse_mint_event(
        &self,
        transaction: &EncodedConfirmedTransactionWithStatusMeta,
    ) -> Option<MintEvent> {
        let meta = transaction.transaction.meta.as_ref()?;

        let log_messages = self.extract_log_messages(meta);

        debug!(
            "[EventParser] Parsing MintEvent from transaction with {} log messages",
            log_messages.len()
        );

        // Track if we're inside our program's execution context
        let mut is_our_program = false;

        for (i, log) in log_messages.iter().enumerate() {
            // Check if this log indicates our program was invoked
            if log.contains(&format!("Program {} invoke", self.program_id)) {
                is_our_program = true;
                debug!(
                    "[EventParser] Found our program invocation at log index {}",
                    i
                );
            }

            // Reset flag when program returns
            if log.contains(&format!("Program {} success", self.program_id)) {
                is_our_program = false;
            }

            // Only process "Program data:" logs that come from our program
            if log.contains("Program data:") && is_our_program {
                debug!(
                    "[EventParser] Found \"Program data:\" log at index {} (from our program)",
                    i
                );

                if let Some(event) = self.try_parse_mint_event_from_log(log) {
                    return Some(event);
                }
            }
        }

        // Fallback to manual parsing
        self.parse_mint_event_fallback(&log_messages, transaction)
    }

    /// Parse BuybackEvent from a transaction
    pub fn parse_buyback_event(
        &self,
        transaction: &EncodedConfirmedTransactionWithStatusMeta,
    ) -> Option<BuybackEventData> {
        let meta = transaction.transaction.meta.as_ref()?;
        let log_messages = self.extract_log_messages(meta);

        let mut is_our_program = false;

        for log in &log_messages {
            if log.contains(&format!("Program {} invoke", self.program_id)) {
                is_our_program = true;
            }

            if log.contains(&format!("Program {} success", self.program_id)) {
                is_our_program = false;
            }

            if log.contains("Program data:") && is_our_program {
                if let Some(event) = self.try_parse_buyback_event_from_log(log) {
                    return Some(event);
                }
            }
        }

        // Fallback parsing
        self.parse_buyback_event_fallback(&log_messages)
    }

    /// Try to parse a MintEvent from a single log entry
    fn try_parse_mint_event_from_log(&self, log: &str) -> Option<MintEvent> {
        // Extract base64 encoded data
        let data_part = log.strip_prefix("Program data: ")?;
        let data_part = data_part.trim();

        debug!(
            "[EventParser] Extracted base64 data (first 100 chars): {}...",
            &data_part[..data_part.len().min(100)]
        );

        // Decode base64 to buffer
        let data = match base64::decode(data_part) {
            Ok(d) => d,
            Err(e) => {
                warn!("[EventParser] Failed to decode base64: {}", e);
                return None;
            }
        };

        debug!("[EventParser] Decoded buffer length: {} bytes", data.len());

        // Check discriminator (first 8 bytes)
        if data.len() < 8 {
            debug!("[EventParser] Data too short for discriminator");
            return None;
        }

        let discriminator: [u8; 8] = data[..8].try_into().ok()?;

        if discriminator != MINT_EVENT_DISCRIMINATOR {
            debug!("[EventParser] Discriminator mismatch, not a MintEvent");
            return None;
        }

        // Deserialize the event data (skip discriminator)
        match RawMintEvent::try_from_slice(&data[8..]) {
            Ok(raw_event) => {
                debug!("[EventParser] ✓ Successfully decoded MintEvent");
                Some(MintEvent {
                    minter: raw_event.minter.to_string(),
                    mint: raw_event.mint.to_string(),
                    name: raw_event.name,
                    symbol: raw_event.symbol,
                    uri: raw_event.uri,
                    timestamp: raw_event.timestamp,
                })
            }
            Err(e) => {
                warn!("[EventParser] Failed to deserialize MintEvent: {}", e);
                None
            }
        }
    }

    /// Try to parse a BuybackEvent from a single log entry
    fn try_parse_buyback_event_from_log(&self, log: &str) -> Option<BuybackEventData> {
        let data_part = log.strip_prefix("Program data: ")?;
        let data_part = data_part.trim();

        let data = base64::decode(data_part).ok()?;

        if data.len() < 8 {
            return None;
        }

        let discriminator: [u8; 8] = data[..8].try_into().ok()?;

        if discriminator != BUYBACK_EVENT_DISCRIMINATOR {
            return None;
        }

        match RawBuybackEvent::try_from_slice(&data[8..]) {
            Ok(raw_event) => {
                debug!("[EventParser] ✓ Successfully decoded BuybackEvent");
                Some(BuybackEventData {
                    amount_sol: raw_event.amount_sol as i64,
                    token_amount: raw_event.token_amount as i64,
                    timestamp: raw_event.timestamp,
                })
            }
            Err(e) => {
                warn!("[EventParser] Failed to deserialize BuybackEvent: {}", e);
                None
            }
        }
    }

    /// Fallback parser for MintEvent when Anchor decoder fails
    /// Parses transaction logs manually to extract event data
    fn parse_mint_event_fallback(
        &self,
        log_messages: &[String],
        transaction: &EncodedConfirmedTransactionWithStatusMeta,
    ) -> Option<MintEvent> {
        debug!("[EventParser] Using fallback parser for MintEvent");

        let mut found_mint_instruction = false;
        let mut name: Option<String> = None;
        let mut symbol: Option<String> = None;
        let mut uri: Option<String> = None;

        for log in log_messages {
            // Look for mint instruction invocation
            if log.contains("Instruction: Mint")
                || log.contains("Instruction: mint")
                || log.contains("mint_nft")
            {
                found_mint_instruction = true;
            }

            // Try to extract metadata from logs
            if found_mint_instruction {
                if let Some(n) = Self::extract_field_from_log(log, "name") {
                    name = Some(n);
                }
                if let Some(s) = Self::extract_field_from_log(log, "symbol") {
                    symbol = Some(s);
                }
                if let Some(u) = Self::extract_field_from_log(log, "uri") {
                    uri = Some(u);
                }
            }
        }

        // If we found metadata, try to construct the event
        if found_mint_instruction && name.is_some() && symbol.is_some() {
            // Try to extract minter and mint from transaction accounts
            let (minter, mint) = self.extract_accounts_from_transaction(transaction)?;

            let timestamp = chrono::Utc::now().timestamp();

            return Some(MintEvent {
                minter,
                mint,
                name: name.unwrap_or_default(),
                symbol: symbol.unwrap_or_default(),
                uri: uri.unwrap_or_default(),
                timestamp,
            });
        }

        None
    }

    /// Fallback parser for BuybackEvent
    fn parse_buyback_event_fallback(&self, log_messages: &[String]) -> Option<BuybackEventData> {
        let mut sol_amount: Option<i64> = None;
        let mut token_amount: Option<i64> = None;

        for log in log_messages {
            // Look for buyback-related log patterns
            if log.contains("buyback") || log.contains("Buyback") || log.contains("swap") {
                // Try to extract amounts from log
                if let Some(sol) = Self::extract_lamports_from_log(log) {
                    sol_amount = Some(sol);
                }
                if let Some(tokens) = Self::extract_tokens_from_log(log) {
                    token_amount = Some(tokens);
                }
            }
        }

        if sol_amount.is_some() && token_amount.is_some() {
            return Some(BuybackEventData {
                amount_sol: sol_amount.unwrap(),
                token_amount: token_amount.unwrap(),
                timestamp: chrono::Utc::now().timestamp(),
            });
        }

        None
    }

    /// Extract log messages from transaction metadata
    fn extract_log_messages(&self, meta: &UiTransactionStatusMeta) -> Vec<String> {
        match &meta.log_messages {
            OptionSerializer::Some(logs) => logs.clone(),
            _ => vec![],
        }
    }

    /// Extract a field value from a log line
    fn extract_field_from_log(log: &str, field: &str) -> Option<String> {
        // Try pattern: field: "value" or field: value
        let patterns = [
            format!("{}: \"", field),
            format!("{}=\"", field),
            format!("{}: ", field),
            format!("{}=", field),
        ];

        for pattern in &patterns {
            if let Some(start) = log.find(pattern) {
                let value_start = start + pattern.len();
                let remaining = &log[value_start..];

                // Find end delimiter
                let end = remaining
                    .find('"')
                    .or_else(|| remaining.find(','))
                    .or_else(|| remaining.find(' '))
                    .unwrap_or(remaining.len());

                let value = remaining[..end].trim().to_string();
                if !value.is_empty() {
                    return Some(value);
                }
            }
        }

        None
    }

    /// Extract lamports amount from a log line
    fn extract_lamports_from_log(log: &str) -> Option<i64> {
        // Look for patterns like "amount: 1000000000" or "lamports: 500000000"
        let patterns = ["lamports: ", "amount: ", "sol: "];

        for pattern in &patterns {
            if let Some(start) = log.to_lowercase().find(pattern) {
                let value_start = start + pattern.len();
                let remaining = &log[value_start..];

                let end = remaining
                    .find(|c: char| !c.is_ascii_digit())
                    .unwrap_or(remaining.len());

                if let Ok(amount) = remaining[..end].parse::<i64>() {
                    return Some(amount);
                }
            }
        }

        None
    }

    /// Extract token amount from a log line
    fn extract_tokens_from_log(log: &str) -> Option<i64> {
        // Look for patterns like "tokens: 5000000" or "tokenAmount: 1000000"
        let patterns = ["tokens: ", "tokenAmount: ", "token_amount: "];

        for pattern in &patterns {
            if let Some(start) = log.to_lowercase().find(&pattern.to_lowercase()) {
                let value_start = start + pattern.len();
                let remaining = &log[value_start..];

                let end = remaining
                    .find(|c: char| !c.is_ascii_digit())
                    .unwrap_or(remaining.len());

                if let Ok(amount) = remaining[..end].parse::<i64>() {
                    return Some(amount);
                }
            }
        }

        None
    }

    /// Extract minter and mint addresses from transaction
    fn extract_accounts_from_transaction(
        &self,
        transaction: &EncodedConfirmedTransactionWithStatusMeta,
    ) -> Option<(String, String)> {
        // This is a simplified extraction - in production, you'd parse the
        // actual instruction data and account keys more carefully
        let transaction_data = &transaction.transaction.transaction;

        // Try to get account keys from the decoded transaction
        match transaction_data {
            solana_transaction_status::EncodedTransaction::Json(ui_tx) => {
                match &ui_tx.message {
                    solana_transaction_status::UiMessage::Parsed(parsed) => {
                        // First account is typically the payer/minter
                        let minter = parsed.account_keys.first()?.pubkey.clone();
                        // For mint, we'd need to look at the specific instruction
                        // This is a placeholder - actual implementation would be more complex
                        let mint = parsed.account_keys.get(1)?.pubkey.clone();
                        return Some((minter, mint));
                    }
                    solana_transaction_status::UiMessage::Raw(raw) => {
                        let minter = raw.account_keys.first()?.clone();
                        let mint = raw.account_keys.get(1)?.clone();
                        return Some((minter, mint));
                    }
                }
            }
            solana_transaction_status::EncodedTransaction::LegacyBinary(_data) => {
                // Decode base64/base58 and parse manually
                // This is complex and depends on encoding
                debug!(
                    "[EventParser] Legacy/Binary transaction format, skipping account extraction"
                );
            }
            solana_transaction_status::EncodedTransaction::Binary(_data, _encoding) => {
                debug!("[EventParser] Binary transaction format, skipping account extraction");
            }
            _ => {}
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_parser_creation() {
        let parser =
            EventParserService::new("56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt".to_string());
        assert_eq!(
            parser.program_id,
            "56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt"
        );
    }

    #[test]
    fn test_extract_field_from_log() {
        let log = "name: \"Test NFT\", symbol: \"TEST\"";
        assert_eq!(
            EventParserService::extract_field_from_log(log, "name"),
            Some("Test NFT".to_string())
        );
        assert_eq!(
            EventParserService::extract_field_from_log(log, "symbol"),
            Some("TEST".to_string())
        );
    }

    #[test]
    fn test_extract_lamports_from_log() {
        let log = "amount: 1000000000 lamports transferred";
        assert_eq!(
            EventParserService::extract_lamports_from_log(log),
            Some(1000000000)
        );

        let log2 = "lamports: 500000000";
        assert_eq!(
            EventParserService::extract_lamports_from_log(log2),
            Some(500000000)
        );
    }

    #[test]
    fn test_extract_tokens_from_log() {
        let log = "tokens: 5000000 received";
        assert_eq!(
            EventParserService::extract_tokens_from_log(log),
            Some(5000000)
        );
    }

    #[test]
    fn test_raw_mint_event_serialization() {
        let event = RawMintEvent {
            minter: Pubkey::new_unique(),
            mint: Pubkey::new_unique(),
            name: "Test".to_string(),
            symbol: "TST".to_string(),
            uri: "https://example.com".to_string(),
            timestamp: 1234567890,
        };

        let serialized = borsh::to_vec(&event).unwrap();
        let deserialized = RawMintEvent::try_from_slice(&serialized).unwrap();

        assert_eq!(event.name, deserialized.name);
        assert_eq!(event.symbol, deserialized.symbol);
        assert_eq!(event.uri, deserialized.uri);
        assert_eq!(event.timestamp, deserialized.timestamp);
    }
}
