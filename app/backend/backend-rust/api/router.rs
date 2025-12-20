//! Unified router for all API endpoints
//! 
//! This single binary handles all API routes to minimize memory usage during compilation

use ascii_art_backend::{
    create_db_pool, AppConfig,
    models::{buyback_event::BuybackEventResponse, nft::NftResponse, user_level::UserLevelResponse},
    services::nft_storage::NftStorageService,
};
use chrono;
use http::StatusCode;
use serde::Serialize;
use serde_json::json;
use vercel_runtime::{run, service_fn, Error, Request, Response, ResponseBody};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthCheckResponse {
    status: String,
    version: String,
    timestamp: i64,
    runtime: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct IndexerStatusResponse {
    status: String,
    is_indexing: bool,
    processed_transactions: usize,
    currently_processing: usize,
    last_processed_at: Option<i64>,
    errors: u64,
    mode: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserNftsResponse {
    wallet_address: String,
    nfts: Vec<NftResponse>,
    user_level: Option<UserLevelResponse>,
    total_nfts: usize,
}

fn main() -> Result<(), Error> {
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        handle.block_on(run(service_fn(handler)))
    } else {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .map_err(|e| Error::from(format!("Failed to create runtime: {}", e)))?;
        rt.block_on(run(service_fn(handler)))
    }
}

async fn handler(req: Request) -> Result<Response<ResponseBody>, Error> {
    // Handle CORS preflight
    if req.method() == "OPTIONS" {
        return Ok(Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header("Access-Control-Allow-Origin", "*")
            .header("Access-Control-Allow-Methods", "GET, OPTIONS")
            .header("Access-Control-Allow-Headers", "Content-Type")
            .header("Access-Control-Max-Age", "86400")
            .body("".into())?);
    }

    let path = req.uri().path();
    let url = req.uri().to_string();

    // Route to appropriate handler
    if path.contains("health") {
        handle_health().await
    } else if path.contains("indexer_status") || path.contains("indexer/status") {
        handle_indexer_status().await
    } else if path.contains("user_nfts") || (path.contains("user/") && !path.contains("level") && !path.contains("shard")) {
        handle_user_nfts(&url).await
    } else if path.contains("nft_by_mint") || path.contains("mint/") {
        handle_nft_by_mint(&url).await
    } else if path.contains("user_level") || (path.contains("user/") && path.contains("level")) {
        handle_user_level(&url).await
    } else if path.contains("shard_status") || path.contains("shard-status") {
        handle_shard_status(&url).await
    } else if path.contains("buybacks") {
        handle_buybacks(&url).await
    } else if path.contains("statistics") || path.contains("stats") {
        handle_statistics().await
    } else {
        // Default to health check
        handle_health().await
    }
}

async fn handle_health() -> Result<Response<ResponseBody>, Error> {
    let response = HealthCheckResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        runtime: "vercel-rust".to_string(),
    };

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(serde_json::to_string(&response)?.into())?)
}

async fn handle_indexer_status() -> Result<Response<ResponseBody>, Error> {
    let response = IndexerStatusResponse {
        status: "serverless".to_string(),
        is_indexing: false,
        processed_transactions: 0,
        currently_processing: 0,
        last_processed_at: None,
        errors: 0,
        mode: "vercel-serverless".to_string(),
        message: "Indexer runs as a separate service. This endpoint is for API-only mode.".to_string(),
    };

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(serde_json::to_string(&response)?.into())?)
}

async fn handle_user_nfts(url: &str) -> Result<Response<ResponseBody>, Error> {
    let wallet_address = extract_query_param(url, "wallet")
        .or_else(|| extract_path_param(url, "user"))
        .unwrap_or_default();

    if wallet_address.len() < 32 || wallet_address.len() > 44 {
        return error_response(StatusCode::BAD_REQUEST, "VALIDATION_ERROR", "Invalid wallet address");
    }

    let (config, pool) = init_db().await?;
    let nft_storage = NftStorageService::new(pool, config).await
        .map_err(|e| Error::from(format!("Service error: {}", e)))?;

    let nfts = nft_storage.get_nfts_by_minter(&wallet_address).await
        .map_err(|e| Error::from(format!("Database error: {}", e)))?;
    let user_level = nft_storage.get_user_level(&wallet_address).await
        .map_err(|e| Error::from(format!("Database error: {}", e)))?;

    let nft_responses: Vec<NftResponse> = nfts.iter().map(|n| n.clone().into()).collect();
    let total_nfts = nft_responses.len();

    let response = UserNftsResponse {
        wallet_address: wallet_address.clone(),
        nfts: nft_responses,
        user_level: user_level.map(|l| l.into()),
        total_nfts,
    };

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(serde_json::to_string(&response)?.into())?)
}

async fn handle_nft_by_mint(url: &str) -> Result<Response<ResponseBody>, Error> {
    let mint_address = extract_query_param(url, "mint")
        .or_else(|| extract_path_param(url, "mint"))
        .unwrap_or_default();

    if mint_address.len() < 32 || mint_address.len() > 44 {
        return error_response(StatusCode::BAD_REQUEST, "VALIDATION_ERROR", "Invalid mint address");
    }

    let (config, pool) = init_db().await?;
    let nft_storage = NftStorageService::new(pool, config).await
        .map_err(|e| Error::from(format!("Service error: {}", e)))?;

    let nft = nft_storage.get_nft_by_mint(&mint_address).await
        .map_err(|e| Error::from(format!("Database error: {}", e)))?;

    match nft {
        Some(nft) => {
            let response: NftResponse = nft.into();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(serde_json::to_string(&response)?.into())?)
        }
        None => Ok(Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header("Content-Type", "application/json")
            .header("Access-Control-Allow-Origin", "*")
            .body(json!({"error": "NOT_FOUND", "message": "NFT not found"}).to_string().into())?),
    }
}

async fn handle_user_level(url: &str) -> Result<Response<ResponseBody>, Error> {
    let wallet_address = extract_query_param(url, "wallet")
        .or_else(|| extract_path_param(url, "user"))
        .unwrap_or_default();

    if wallet_address.len() < 32 || wallet_address.len() > 44 {
        return error_response(StatusCode::BAD_REQUEST, "VALIDATION_ERROR", "Invalid wallet address");
    }

    let (config, pool) = init_db().await?;
    let nft_storage = NftStorageService::new(pool, config).await
        .map_err(|e| Error::from(format!("Service error: {}", e)))?;

    let user_level = nft_storage.get_user_level(&wallet_address).await
        .map_err(|e| Error::from(format!("Database error: {}", e)))?;

    match user_level {
        Some(level) => {
            let response: UserLevelResponse = level.into();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(serde_json::to_string(&response)?.into())?)
        }
        None => Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "application/json")
            .header("Access-Control-Allow-Origin", "*")
            .body("null".into())?),
    }
}

async fn handle_shard_status(url: &str) -> Result<Response<ResponseBody>, Error> {
    let wallet_address = extract_query_param(url, "wallet")
        .or_else(|| extract_path_param(url, "user"))
        .unwrap_or_default();

    if wallet_address.len() < 32 || wallet_address.len() > 44 {
        return error_response(StatusCode::BAD_REQUEST, "VALIDATION_ERROR", "Invalid wallet address");
    }

    let (config, pool) = init_db().await?;
    let nft_storage = NftStorageService::new(pool, config).await
        .map_err(|e| Error::from(format!("Service error: {}", e)))?;

    let shard_status = nft_storage.get_user_shard_status(&wallet_address).await
        .map_err(|e| Error::from(format!("Database error: {}", e)))?;

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(serde_json::to_string(&shard_status)?.into())?)
}

async fn handle_statistics() -> Result<Response<ResponseBody>, Error> {
    let (config, pool) = init_db().await?;
    let nft_storage = NftStorageService::new(pool, config).await
        .map_err(|e| Error::from(format!("Service error: {}", e)))?;

    let stats = nft_storage.get_statistics().await
        .map_err(|e| Error::from(format!("Database error: {}", e)))?;

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", "public, max-age=60")
        .body(serde_json::to_string(&stats)?.into())?)
}

async fn handle_buybacks(url: &str) -> Result<Response<ResponseBody>, Error> {
    let limit: i64 = extract_query_param(url, "limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(50)
        .min(100);
    let offset: i64 = extract_query_param(url, "offset")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let (config, pool) = init_db().await?;
    let nft_storage = NftStorageService::new(pool, config).await
        .map_err(|e| Error::from(format!("Service error: {}", e)))?;

    let events = nft_storage.get_buyback_events(limit, offset).await
        .map_err(|e| Error::from(format!("Database error: {}", e)))?;

    let response: Vec<BuybackEventResponse> = events.into_iter().map(|e| e.into()).collect();

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(serde_json::to_string(&response)?.into())?)
}

async fn init_db() -> Result<(AppConfig, deadpool_postgres::Pool), Error> {
    let config = AppConfig::from_env()
        .map_err(|e| Error::from(format!("Config error: {}", e)))?;
    let pool = create_db_pool(&config.database).await
        .map_err(|e| Error::from(format!("Database error: {}", e)))?;
    Ok((config, pool))
}

fn extract_query_param(url: &str, param: &str) -> Option<String> {
    url.split('?')
        .nth(1)
        .and_then(|query| {
            query.split('&').find_map(|pair| {
                let mut parts = pair.split('=');
                if parts.next()? == param {
                    parts.next().map(|v| v.to_string())
                } else {
                    None
                }
            })
        })
}

fn extract_path_param(url: &str, key: &str) -> Option<String> {
    let path = url.split('?').next()?;
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    
    if let Some(idx) = segments.iter().position(|s| *s == key) {
        if idx + 1 < segments.len() {
            return Some(segments[idx + 1].to_string());
        }
    }
    None
}

fn error_response(status: StatusCode, error_type: &str, message: &str) -> Result<Response<ResponseBody>, Error> {
    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(json!({"error": error_type, "message": message}).to_string().into())?)
}

