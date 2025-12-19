//! Health check endpoint for Vercel serverless
//!
//! GET /api/health
//! Returns server health status

use serde::Serialize;
use vercel_runtime::{run, service_fn, Error, Request, Response, ResponseBody};
use http::StatusCode;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthCheckResponse {
    status: String,
    version: String,
    timestamp: i64,
    runtime: String,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}

async fn handler(_req: Request) -> Result<Response<ResponseBody>, Error> {
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
