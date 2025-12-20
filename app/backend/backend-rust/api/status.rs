//! Status endpoints for Vercel serverless
//!
//! GET /api/health - Health check
//! GET /api/indexer_status - Indexer status

use http::StatusCode;
use serde::Serialize;
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
    
    // Route based on path
    if path.contains("indexer_status") || path.contains("indexer/status") {
        // Indexer status endpoint
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
    } else {
        // Health check endpoint (default)
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
            .header("Access-Control-Allow-Methods", "GET, OPTIONS")
            .header("Access-Control-Allow-Headers", "Content-Type")
            .body(serde_json::to_string(&response)?.into())?)
    }
}

