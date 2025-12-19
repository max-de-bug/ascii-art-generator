//! Buybacks endpoint for Vercel serverless
//!
//! GET /api/buybacks?limit=<num>&offset=<num>
//! Returns a paginated list of buyback events

use ascii_art_backend::{
    create_db_pool, AppConfig,
    models::buyback_event::BuybackEventResponse,
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

    // Parse query parameters
    let url = req.uri().to_string();
    let limit: i64 = extract_query_param(&url, "limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(50)
        .min(100);
    let offset: i64 = extract_query_param(&url, "offset")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

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

    let events = match nft_storage.get_buyback_events(limit, offset).await {
        Ok(e) => e,
        Err(e) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                &format!("Error fetching buyback events: {}", e),
            );
        }
    };

    let response: Vec<BuybackEventResponse> = events.into_iter().map(|e| e.into()).collect();

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
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
