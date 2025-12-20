//! User Info endpoints for Vercel serverless
//!
//! GET /api/user_level?wallet=<address> - User level
//! GET /api/user_shard_status?wallet=<address> - User shard status

use ascii_art_backend::{
    create_db_pool, AppConfig,
    models::user_level::UserLevelResponse,
    services::nft_storage::NftStorageService,
};
use http::StatusCode;
use serde_json::json;
use vercel_runtime::{run, service_fn, Error, Request, Response, ResponseBody};

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

    // Parse wallet address from query or path
    let url = req.uri().to_string();
    let path = req.uri().path();
    let wallet_address = extract_query_param(&url, "wallet")
        .or_else(|| extract_path_param(&url))
        .unwrap_or_default();

    // Validate wallet address
    if wallet_address.len() < 32 || wallet_address.len() > 44 {
        return error_response(
            StatusCode::BAD_REQUEST,
            "VALIDATION_ERROR",
            "Invalid wallet address",
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

    let pool = match create_db_pool(&config.database).await {
        Ok(p) => p,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                &format!("Database connection error: {}", e),
            );
        }
    };

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

    // Route based on path
    if path.contains("shard_status") || path.contains("shard-status") {
        // User shard status endpoint
        let shard_status = match nft_storage.get_user_shard_status(&wallet_address).await {
            Ok(s) => s,
            Err(e) => {
                return error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "DATABASE_ERROR",
                    &format!("Error fetching shard status: {}", e),
                );
            }
        };

        Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "application/json")
            .header("Access-Control-Allow-Origin", "*")
            .body(serde_json::to_string(&shard_status)?.into())?)
    } else {
        // User level endpoint (default)
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

fn extract_path_param(url: &str) -> Option<String> {
    let path = url.split('?').next()?;
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    
    if let Some(user_idx) = segments.iter().position(|s| *s == "user") {
        if user_idx + 1 < segments.len() {
            let wallet = segments[user_idx + 1];
            if wallet != "level" && wallet != "shard-status" && wallet != "shard_status" {
                return Some(wallet.to_string());
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

