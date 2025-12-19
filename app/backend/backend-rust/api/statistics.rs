//! Statistics endpoint for Vercel serverless
//!
//! GET /api/statistics
//! Returns overall statistics including total NFTs, users, and mints

use ascii_art_backend::{
    create_db_pool, AppConfig,
    services::nft_storage::NftStorageService,
};
use http::StatusCode;
use serde_json::json;
use vercel_runtime::{run, service_fn, Error, Request, Response, ResponseBody};

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

    let stats = match nft_storage.get_statistics().await {
        Ok(s) => s,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                &format!("Error fetching statistics: {}", e),
            );
        }
    };

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", "public, max-age=60")
        .body(serde_json::to_string(&stats)?.into())?)
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
