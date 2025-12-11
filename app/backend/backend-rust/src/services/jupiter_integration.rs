//! Jupiter Integration Service
//!
//! Provides integration with Jupiter DEX API for token swaps.
//! Used for buyback functionality to swap SOL for the buyback token.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, warn};

use crate::config::AppConfig;
use crate::error::{AppError, AppResult};

/// Jupiter API v6 base URL
const JUPITER_API_BASE: &str = "https://quote-api.jup.ag/v6";

/// Quote response from Jupiter API
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteResponse {
    pub input_mint: String,
    pub in_amount: String,
    pub output_mint: String,
    pub out_amount: String,
    pub other_amount_threshold: String,
    pub swap_mode: String,
    pub slippage_bps: u32,
    pub price_impact_pct: String,
    pub route_plan: Vec<RoutePlan>,
    #[serde(default)]
    pub context_slot: Option<u64>,
    #[serde(default)]
    pub time_taken: Option<f64>,
}

/// Route plan details
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutePlan {
    pub swap_info: SwapInfo,
    pub percent: u32,
}

/// Swap information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapInfo {
    pub amm_key: String,
    pub label: Option<String>,
    pub input_mint: String,
    pub output_mint: String,
    pub in_amount: String,
    pub out_amount: String,
    pub fee_amount: String,
    pub fee_mint: String,
}

/// Swap request to Jupiter API
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapRequest {
    pub quote_response: QuoteResponse,
    pub user_public_key: String,
    pub wrap_and_unwrap_sol: bool,
    pub dynamic_compute_unit_limit: bool,
    pub prioritization_fee_lamports: String,
}

/// Swap response from Jupiter API
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwapResponse {
    pub swap_transaction: String,
    #[serde(default)]
    pub last_valid_block_height: Option<u64>,
    #[serde(default)]
    pub prioritization_fee_lamports: Option<u64>,
}

/// Jupiter Integration Service
///
/// Handles communication with Jupiter DEX API for:
/// - Getting swap quotes
/// - Building swap transactions
/// - Calculating minimum output with slippage protection
#[derive(Debug, Clone)]
pub struct JupiterIntegrationService {
    client: Client,
    api_base: String,
}

impl JupiterIntegrationService {
    /// Create a new JupiterIntegrationService
    pub fn new(_config: &AppConfig) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        debug!("[Jupiter] Initialized Jupiter integration service");

        Self {
            client,
            api_base: JUPITER_API_BASE.to_string(),
        }
    }

    /// Get swap quote from Jupiter API
    ///
    /// # Arguments
    /// * `input_mint` - Input token mint address (e.g., WSOL)
    /// * `output_mint` - Output token mint address (e.g., buyback token)
    /// * `amount` - Amount in lamports (smallest unit)
    /// * `slippage_bps` - Slippage in basis points (100 = 1%)
    ///
    /// # Returns
    /// Quote response with expected output amount
    pub async fn get_quote(
        &self,
        input_mint: &str,
        output_mint: &str,
        amount: u64,
        slippage_bps: u32,
    ) -> AppResult<QuoteResponse> {
        let url = format!(
            "{}/quote?inputMint={}&outputMint={}&amount={}&slippageBps={}",
            self.api_base, input_mint, output_mint, amount, slippage_bps
        );

        debug!(
            "[Jupiter] Fetching quote: {} → {}, amount: {}",
            input_mint, output_mint, amount
        );

        let response = self
            .client
            .get(&url)
            .header("Content-Type", "application/json")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Jupiter quote request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!(
                "[Jupiter] Quote request failed: {} - {}",
                status, error_text
            );
            return Err(AppError::Internal(format!(
                "Jupiter quote failed: {} - {}",
                status, error_text
            )));
        }

        let quote: QuoteResponse = response.json().await.map_err(|e| {
            AppError::Serialization(format!("Failed to parse Jupiter quote response: {}", e))
        })?;

        debug!("[Jupiter] Quote received: {} tokens out", quote.out_amount);

        Ok(quote)
    }

    /// Get swap transaction from Jupiter API
    ///
    /// # Arguments
    /// * `quote_response` - Quote response from get_quote()
    /// * `user_public_key` - Public key of the user executing the swap
    ///
    /// # Returns
    /// Swap response with base64 encoded transaction
    pub async fn get_swap_transaction(
        &self,
        quote_response: QuoteResponse,
        user_public_key: &str,
    ) -> AppResult<SwapResponse> {
        let url = format!("{}/swap", self.api_base);

        let request = SwapRequest {
            quote_response,
            user_public_key: user_public_key.to_string(),
            wrap_and_unwrap_sol: true,
            dynamic_compute_unit_limit: true,
            prioritization_fee_lamports: "auto".to_string(),
        };

        debug!(
            "[Jupiter] Getting swap transaction for user: {}",
            user_public_key
        );

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Jupiter swap request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!("[Jupiter] Swap request failed: {} - {}", status, error_text);
            return Err(AppError::Internal(format!(
                "Jupiter swap failed: {} - {}",
                status, error_text
            )));
        }

        let swap_response: SwapResponse = response.json().await.map_err(|e| {
            AppError::Serialization(format!("Failed to parse Jupiter swap response: {}", e))
        })?;

        debug!("[Jupiter] Swap transaction received");

        Ok(swap_response)
    }

    /// Calculate minimum output with slippage protection
    ///
    /// # Arguments
    /// * `expected_output` - Expected output from quote
    /// * `slippage_bps` - Slippage in basis points (100 = 1%)
    ///
    /// # Returns
    /// Minimum acceptable output amount
    pub fn calculate_minimum_output(&self, expected_output: u64, slippage_bps: u32) -> u64 {
        let slippage_multiplier = 10000 - slippage_bps as u64;
        (expected_output * slippage_multiplier) / 10000
    }

    /// Parse the out_amount from a quote response as u64
    pub fn parse_out_amount(quote: &QuoteResponse) -> AppResult<u64> {
        quote
            .out_amount
            .parse::<u64>()
            .map_err(|e| AppError::Validation(format!("Invalid out_amount in quote: {}", e)))
    }

    /// Get a quote and calculate minimum output in one call
    pub async fn get_quote_with_minimum(
        &self,
        input_mint: &str,
        output_mint: &str,
        amount: u64,
        slippage_bps: u32,
    ) -> AppResult<(QuoteResponse, u64)> {
        let quote = self
            .get_quote(input_mint, output_mint, amount, slippage_bps)
            .await?;
        let expected_output = Self::parse_out_amount(&quote)?;
        let minimum_output = self.calculate_minimum_output(expected_output, slippage_bps);
        Ok((quote, minimum_output))
    }
}

/// Common token mint addresses
pub mod token_mints {
    /// Wrapped SOL mint address
    pub const WSOL: &str = "So11111111111111111111111111111111111111112";

    /// Native SOL (same as WSOL for Jupiter)
    pub const SOL: &str = "So11111111111111111111111111111111111111112";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_minimum_output() {
        let config = AppConfig::from_env().unwrap_or_else(|_| {
            // Create a minimal config for testing
            panic!("Config required for test")
        });
        let service = JupiterIntegrationService::new(&config);

        // Test with 1% slippage (100 bps)
        let expected = 1_000_000u64;
        let minimum = service.calculate_minimum_output(expected, 100);
        assert_eq!(minimum, 990_000); // 99% of expected

        // Test with 0.5% slippage (50 bps)
        let minimum_half = service.calculate_minimum_output(expected, 50);
        assert_eq!(minimum_half, 995_000); // 99.5% of expected

        // Test with 0% slippage
        let minimum_zero = service.calculate_minimum_output(expected, 0);
        assert_eq!(minimum_zero, expected);
    }

    #[test]
    fn test_parse_out_amount() {
        let quote = QuoteResponse {
            input_mint: "input".to_string(),
            in_amount: "1000000".to_string(),
            output_mint: "output".to_string(),
            out_amount: "5000000".to_string(),
            other_amount_threshold: "4950000".to_string(),
            swap_mode: "ExactIn".to_string(),
            slippage_bps: 100,
            price_impact_pct: "0.01".to_string(),
            route_plan: vec![],
            context_slot: None,
            time_taken: None,
        };

        let amount = JupiterIntegrationService::parse_out_amount(&quote).unwrap();
        assert_eq!(amount, 5000000);
    }

    #[test]
    fn test_quote_response_deserialization() {
        let json = r#"{
            "inputMint": "So11111111111111111111111111111111111111112",
            "inAmount": "1000000000",
            "outputMint": "AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm",
            "outAmount": "5000000",
            "otherAmountThreshold": "4950000",
            "swapMode": "ExactIn",
            "slippageBps": 100,
            "priceImpactPct": "0.01",
            "routePlan": []
        }"#;

        let quote: QuoteResponse = serde_json::from_str(json).unwrap();
        assert_eq!(quote.input_mint, token_mints::WSOL);
        assert_eq!(quote.in_amount, "1000000000");
        assert_eq!(quote.out_amount, "5000000");
        assert_eq!(quote.slippage_bps, 100);
    }

    #[test]
    fn test_swap_request_serialization() {
        let quote = QuoteResponse {
            input_mint: "input".to_string(),
            in_amount: "1000000".to_string(),
            output_mint: "output".to_string(),
            out_amount: "5000000".to_string(),
            other_amount_threshold: "4950000".to_string(),
            swap_mode: "ExactIn".to_string(),
            slippage_bps: 100,
            price_impact_pct: "0.01".to_string(),
            route_plan: vec![],
            context_slot: None,
            time_taken: None,
        };

        let request = SwapRequest {
            quote_response: quote,
            user_public_key: "test_pubkey".to_string(),
            wrap_and_unwrap_sol: true,
            dynamic_compute_unit_limit: true,
            prioritization_fee_lamports: "auto".to_string(),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"userPublicKey\":\"test_pubkey\""));
        assert!(json.contains("\"wrapAndUnwrapSol\":true"));
        assert!(json.contains("\"dynamicComputeUnitLimit\":true"));
        assert!(json.contains("\"prioritizationFeeLamports\":\"auto\""));
    }
}
