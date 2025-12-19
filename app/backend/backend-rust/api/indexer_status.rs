//! Indexer Status endpoint for Vercel serverless
//!
//! GET /api/indexer_status
//! Returns the current status of the Solana indexer
//!
//! Note: In serverless mode, the indexer doesn't run continuously.
//! This endpoint returns a static response indicating serverless mode.

use http::StatusCode;
use serde::Serialize;
use vercel_runtime::{run, service_fn, Error, Request, Response, ResponseBody};

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

    // In serverless mode, the indexer doesn't run continuously
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
