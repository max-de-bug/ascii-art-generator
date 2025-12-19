//! User NFTs endpoint for Vercel serverless
//!
//! GET /api/user_nfts?wallet=<address>
//! Returns all NFTs owned by a user along with their level information

use ascii_art_backend::{
    create_db_pool, AppConfig,
    models::{nft::NftResponse, user_level::UserLevelResponse},
    services::nft_storage::NftStorageService,
};
use http::StatusCode;
use serde::Serialize;
use serde_json::json;
use vercel_runtime::{run, service_fn, Error, Request, Response, ResponseBody};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct UserNftsResponse {
    wallet_address: String,
    nfts: Vec<NftResponse>,
    user_level: Option<UserLevelResponse>,
    total_nfts: usize,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
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

    // Parse query parameters
    let url = req.uri().to_string();
    let wallet_address = extract_query_param(&url, "wallet")
        .or_else(|| extract_path_param(&url, "user"))
        .unwrap_or_default();

    // Validate wallet address
    if wallet_address.len() < 32 || wallet_address.len() > 44 {
        return error_response(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "Invalid wallet address. Please provide a valid Solana wallet address.",
        );
    }

    // Initialize configuration and database
    let config = match AppConfig::from_env() {
        Ok(c) => c,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "CONFIG_ERROR",
                &format!("Configuration error: {}", e),
            );
        }
    };

    let pool = match create_db_pool(&config.database) {
        Ok(p) => p,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                &format!("Database connection error: {}", e),
            );
        }
    };

    // Create storage service and fetch data
    let nft_storage = match NftStorageService::new(pool, config).await {
        Ok(s) => s,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "SERVICE_ERROR",
                &format!("Service initialization error: {}", e),
            );
        }
    };

    let nfts = match nft_storage.get_nfts_by_minter(&wallet_address).await {
        Ok(n) => n,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                &format!("Error fetching NFTs: {}", e),
            );
        }
    };

    let user_level = match nft_storage.get_user_level(&wallet_address).await {
        Ok(ul) => ul,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                &format!("Error fetching user level: {}", e),
            );
        }
    };

    let nft_responses: Vec<NftResponse> = nfts.into_iter().map(|nft| nft.into()).collect();
    let total_nfts = nft_responses.len();

    let response = UserNftsResponse {
        wallet_address,
        nfts: nft_responses,
        user_level: user_level.map(|ul| ul.into()),
        total_nfts,
    };

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, OPTIONS")
        .header("Access-Control-Allow-Headers", "Content-Type")
        .body(serde_json::to_string(&response)?.into())?)
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

fn extract_path_param(url: &str, segment_name: &str) -> Option<String> {
    let path = url.split('?').next()?;
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    
    if let Some(idx) = segments.iter().position(|s| *s == segment_name) {
        if idx + 1 < segments.len() {
            let next = segments[idx + 1];
            // Make sure it's not another path segment
            if next != "level" && next != "shard-status" {
                return Some(next.to_string());
            }
        }
    }
    
    None
}

fn error_response(
    status: StatusCode,
    error_type: &str,
    message: &str,
) -> Result<Response<ResponseBody>, Error> {
    Ok(Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(
            json!({
                "error": error_type,
                "message": message
            })
            .to_string()
            .into(),
        )?)
}
