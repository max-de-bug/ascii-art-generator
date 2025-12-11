use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde::Serialize;
use std::fmt;

/// Application error types
#[derive(Debug)]
pub enum AppError {
    /// Database errors
    Database(String),

    /// Solana RPC errors
    SolanaRpc(String),

    /// Not found errors
    NotFound(String),

    /// Validation errors
    Validation(String),

    /// Internal server errors
    Internal(String),

    /// Rate limit exceeded
    RateLimitExceeded,

    /// Configuration errors
    Config(String),

    /// Serialization/deserialization errors
    Serialization(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Database(msg) => write!(f, "Database error: {}", msg),
            AppError::SolanaRpc(msg) => write!(f, "Solana RPC error: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AppError::Validation(msg) => write!(f, "Validation error: {}", msg),
            AppError::Internal(msg) => write!(f, "Internal error: {}", msg),
            AppError::RateLimitExceeded => write!(f, "Rate limit exceeded"),
            AppError::Config(msg) => write!(f, "Configuration error: {}", msg),
            AppError::Serialization(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

/// Error response structure for JSON responses
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<String>,
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::SolanaRpc(_) => StatusCode::SERVICE_UNAVAILABLE,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::RateLimitExceeded => StatusCode::TOO_MANY_REQUESTS,
            AppError::Config(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Serialization(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let error_type = match self {
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::SolanaRpc(_) => "SOLANA_RPC_ERROR",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::Internal(_) => "INTERNAL_ERROR",
            AppError::RateLimitExceeded => "RATE_LIMIT_EXCEEDED",
            AppError::Config(_) => "CONFIG_ERROR",
            AppError::Serialization(_) => "SERIALIZATION_ERROR",
        };

        let response = ErrorResponse {
            error: error_type.to_string(),
            message: self.to_string(),
            details: None,
        };

        HttpResponse::build(self.status_code()).json(response)
    }
}

// Implement conversions from common error types

impl From<solana_client::client_error::ClientError> for AppError {
    fn from(err: solana_client::client_error::ClientError) -> Self {
        AppError::SolanaRpc(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Internal(format!("HTTP request failed: {}", err))
    }
}

/// Result type alias for AppError
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = AppError::NotFound("User not found".to_string());
        assert_eq!(err.to_string(), "Not found: User not found");
    }

    #[test]
    fn test_error_status_codes() {
        assert_eq!(
            AppError::NotFound("test".to_string()).status_code(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            AppError::Validation("test".to_string()).status_code(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            AppError::RateLimitExceeded.status_code(),
            StatusCode::TOO_MANY_REQUESTS
        );
    }
}
