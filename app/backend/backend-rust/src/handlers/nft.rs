//! NFT-related handlers
//!
//! Provides endpoints for NFT operations, user profiles, and statistics.

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::models::{
    buyback_event::{BuybackEventResponse, BuybackStatistics},
    nft::{NftResponse, UserNftsResponse},
    user_level::UserLevelResponse,
    UserShardStatus,
};
use crate::AppState;

/// Query parameters for pagination
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Statistics response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatisticsResponse {
    pub total_nfts: i64,
    pub total_users: i64,
    pub total_mints: i64,
    pub buybacks: BuybackStatistics,
}

/// Get indexer status
///
/// GET /nft/indexer/status
///
/// Returns the current status of the Solana indexer.
pub async fn get_indexer_status(app_state: web::Data<AppState>) -> HttpResponse {
    let indexer = app_state.indexer.read().await;
    let status = indexer.get_status();
    HttpResponse::Ok().json(status)
}

/// Get user NFTs and level
///
/// GET /nft/user/{wallet_address}
///
/// Returns all NFTs owned by a user along with their level information.
pub async fn get_user_nfts(
    app_state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let wallet_address = path.into_inner();

    // Validate wallet address (basic validation)
    if wallet_address.len() < 32 || wallet_address.len() > 44 {
        return Err(AppError::Validation("Invalid wallet address".to_string()));
    }

    let nfts = app_state
        .nft_storage
        .get_nfts_by_minter(&wallet_address)
        .await?;

    let user_level = app_state
        .nft_storage
        .get_user_level(&wallet_address)
        .await?;

    let nft_responses: Vec<NftResponse> = nfts.into_iter().map(|nft| nft.into()).collect();
    let total_nfts = nft_responses.len();

    let response = UserNftsResponse {
        wallet_address,
        nfts: nft_responses,
        user_level: user_level.map(|ul| ul.into()),
        total_nfts,
    };

    Ok(HttpResponse::Ok().json(response))
}

/// Get user level
///
/// GET /nft/user/{wallet_address}/level
///
/// Returns the level information for a user.
/// Returns null if user has no NFTs (level was removed).
pub async fn get_user_level(
    app_state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let wallet_address = path.into_inner();

    // Validate wallet address
    if wallet_address.len() < 32 || wallet_address.len() > 44 {
        return Err(AppError::Validation("Invalid wallet address".to_string()));
    }

    let user_level = app_state
        .nft_storage
        .get_user_level(&wallet_address)
        .await?;

    match user_level {
        Some(level) => {
            let response: UserLevelResponse = level.into();
            Ok(HttpResponse::Ok().json(response))
        }
        None => Ok(HttpResponse::Ok().json(serde_json::Value::Null)),
    }
}

/// Get user shard status
///
/// GET /nft/user/{wallet_address}/shard-status
///
/// Returns the shard status for a user (ZENITH progression system).
pub async fn get_user_shard_status(
    app_state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let wallet_address = path.into_inner();

    // Validate wallet address
    if wallet_address.len() < 32 || wallet_address.len() > 44 {
        return Err(AppError::Validation("Invalid wallet address".to_string()));
    }

    let shard_status: UserShardStatus = app_state
        .nft_storage
        .get_user_shard_status(&wallet_address)
        .await?;

    Ok(HttpResponse::Ok().json(shard_status))
}

/// Get NFT by mint address
///
/// GET /nft/mint/{mint_address}
///
/// Returns details of a specific NFT by its mint address.
pub async fn get_nft_by_mint(
    app_state: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let mint_address = path.into_inner();

    // Validate mint address
    if mint_address.len() < 32 || mint_address.len() > 44 {
        return Err(AppError::Validation("Invalid mint address".to_string()));
    }

    let nft = app_state.nft_storage.get_nft_by_mint(&mint_address).await?;

    match nft {
        Some(nft) => {
            let response: NftResponse = nft.into();
            Ok(HttpResponse::Ok().json(response))
        }
        None => Err(AppError::NotFound(format!(
            "NFT with mint {} not found",
            mint_address
        ))),
    }
}

/// Get statistics
///
/// GET /nft/statistics
///
/// Returns overall statistics including total NFTs, users, and mints.
/// Has stricter rate limiting due to expensive database aggregation.
pub async fn get_statistics(app_state: web::Data<AppState>) -> Result<HttpResponse, AppError> {
    let stats = app_state.nft_storage.get_statistics().await?;
    Ok(HttpResponse::Ok().json(stats))
}

/// Get buyback events
///
/// GET /nft/buybacks
///
/// Returns a paginated list of buyback events.
/// Query params: limit (default: 50), offset (default: 0)
pub async fn get_buyback_events(
    app_state: web::Data<AppState>,
    query: web::Query<PaginationQuery>,
) -> Result<HttpResponse, AppError> {
    let limit = query.limit.unwrap_or(50).min(100); // Max 100
    let offset = query.offset.unwrap_or(0);

    let events = app_state
        .nft_storage
        .get_buyback_events(limit, offset)
        .await?;

    let response: Vec<BuybackEventResponse> = events.into_iter().map(|e| e.into()).collect();

    Ok(HttpResponse::Ok().json(response))
}

/// Get buyback statistics
///
/// GET /nft/buybacks/statistics
///
/// Returns aggregated buyback statistics.
/// Has stricter rate limiting due to expensive database aggregation.
pub async fn get_buyback_statistics(
    app_state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let stats = app_state.nft_storage.get_buyback_statistics().await?;
    Ok(HttpResponse::Ok().json(stats))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pagination_query_defaults() {
        let query = PaginationQuery {
            limit: None,
            offset: None,
        };
        assert!(query.limit.is_none());
        assert!(query.offset.is_none());
    }

    #[test]
    fn test_statistics_response_serialization() {
        let response = StatisticsResponse {
            total_nfts: 1000,
            total_users: 50,
            total_mints: 1500,
            buybacks: BuybackStatistics {
                total_buybacks: 10,
                total_sol_swapped: 5_000_000_000, // 5 SOL
                total_tokens_received: 1_000_000,
            },
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"totalNfts\":1000"));
        assert!(json.contains("\"totalUsers\":50"));
        assert!(json.contains("\"totalMints\":1500"));
        assert!(json.contains("\"totalBuybacks\":10"));
    }
}

