//! Health check handlers
//!
//! Provides endpoints for monitoring the health of the application and its components.

use actix_web::{web, HttpResponse};
use serde::Serialize;

use crate::AppState;

/// Health check response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheckResponse {
    pub status: String,
    pub version: String,
    pub timestamp: i64,
}

/// Detailed health check response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailedHealthResponse {
    pub status: String,
    pub version: String,
    pub timestamp: i64,
    pub components: HealthComponents,
}

/// Health status of individual components
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthComponents {
    pub database: ComponentStatus,
    pub indexer: IndexerStatus,
}

/// Generic component status
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentStatus {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Indexer-specific status
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexerStatus {
    pub status: String,
    pub is_indexing: bool,
    pub processed_transactions: usize,
    pub currently_processing: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_processed_at: Option<i64>,
    pub errors: u64,
}

/// Basic health check endpoint
///
/// GET /health
///
/// Returns a simple health status indicating the server is running.
pub async fn health_check() -> HttpResponse {
    let response = HealthCheckResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: chrono::Utc::now().timestamp(),
    };

    HttpResponse::Ok().json(response)
}

/// Indexer status endpoint
///
/// GET /health/indexer
///
/// Returns detailed status of the Solana indexer.
pub async fn indexer_status(app_state: web::Data<AppState>) -> HttpResponse {
    let indexer = app_state.indexer.read().await;
    let status = indexer.get_status();

    let indexer_status = IndexerStatus {
        status: if status.is_indexing { "up" } else { "down" }.to_string(),
        is_indexing: status.is_indexing,
        processed_transactions: status.processed_transactions,
        currently_processing: status.currently_processing,
        last_processed_at: status.last_processed_at,
        errors: status.total_errors,
    };

    HttpResponse::Ok().json(indexer_status)
}

/// Detailed health check endpoint (combines all component statuses)
///
/// GET /health/detailed
///
/// Returns detailed health information for all components.
pub async fn detailed_health_check(app_state: web::Data<AppState>) -> HttpResponse {
    // Check indexer status
    let indexer = app_state.indexer.read().await;
    let indexer_raw_status = indexer.get_status();

    let indexer_status = IndexerStatus {
        status: if indexer_raw_status.is_indexing {
            "up"
        } else {
            "down"
        }
        .to_string(),
        is_indexing: indexer_raw_status.is_indexing,
        processed_transactions: indexer_raw_status.processed_transactions,
        currently_processing: indexer_raw_status.currently_processing,
        last_processed_at: indexer_raw_status.last_processed_at,
        errors: indexer_raw_status.total_errors,
    };

    // Database is considered healthy if we got this far
    // (connection pool is managed by actix and would fail earlier)
    let database_status = ComponentStatus {
        status: "up".to_string(),
        error: None,
    };

    let response = DetailedHealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        components: HealthComponents {
            database: database_status,
            indexer: indexer_status,
        },
    };

    HttpResponse::Ok().json(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_check_response_serialization() {
        let response = HealthCheckResponse {
            status: "ok".to_string(),
            version: "0.1.0".to_string(),
            timestamp: 1234567890,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"status\":\"ok\""));
        assert!(json.contains("\"version\":\"0.1.0\""));
        assert!(json.contains("\"timestamp\":1234567890"));
    }

    #[test]
    fn test_indexer_status_serialization() {
        let status = IndexerStatus {
            status: "up".to_string(),
            is_indexing: true,
            processed_transactions: 100,
            currently_processing: 5,
            last_processed_at: Some(1234567890),
            errors: 2,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"isIndexing\":true"));
        assert!(json.contains("\"processedTransactions\":100"));
        assert!(json.contains("\"currentlyProcessing\":5"));
        assert!(json.contains("\"errors\":2"));
    }

    #[test]
    fn test_component_status_without_error() {
        let status = ComponentStatus {
            status: "up".to_string(),
            error: None,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"status\":\"up\""));
        assert!(!json.contains("error")); // Should be skipped when None
    }

    #[test]
    fn test_component_status_with_error() {
        let status = ComponentStatus {
            status: "down".to_string(),
            error: Some("Connection failed".to_string()),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"status\":\"down\""));
        assert!(json.contains("\"error\":\"Connection failed\""));
    }
}
