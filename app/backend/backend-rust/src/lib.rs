//! ASCII Art Generator Backend Library
//!
//! This library provides shared functionality for both the standalone server
//! and Vercel serverless functions.

pub mod config;
pub mod error;
pub mod models;
pub mod services;

// Re-export commonly used types
pub use config::{AppConfig, DatabaseConfig, SolanaConfig};
pub use error::{AppError, AppResult};

use deadpool_postgres::{Config, Pool, Runtime};
use std::sync::Arc;
use tokio_postgres_rustls::MakeRustlsConnect;

/// Custom TLS verifier that accepts all certificates (for Supabase compatibility)
#[derive(Debug)]
pub struct NoVerifier;

impl rustls::client::danger::ServerCertVerifier for NoVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::RSA_PKCS1_SHA256,
            rustls::SignatureScheme::RSA_PKCS1_SHA384,
            rustls::SignatureScheme::RSA_PKCS1_SHA512,
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
            rustls::SignatureScheme::ECDSA_NISTP521_SHA512,
            rustls::SignatureScheme::RSA_PSS_SHA256,
            rustls::SignatureScheme::RSA_PSS_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA512,
            rustls::SignatureScheme::ED25519,
        ]
    }
}

/// Create a database connection pool with TLS support
/// This function should be called within an async context (e.g., inside a handler)
pub async fn create_db_pool(db_config: &DatabaseConfig) -> Result<Pool, Box<dyn std::error::Error>> {
    // Initialize TLS crypto provider
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

    let mut pg_config = Config::new();
    pg_config.host = Some(db_config.host.clone());
    pg_config.port = Some(db_config.port);
    pg_config.user = Some(db_config.username.clone());
    pg_config.password = Some(db_config.password.clone());
    pg_config.dbname = Some(db_config.name.clone());

    // Configure TLS for Supabase
    // Create TLS config builder function to reuse
    let tls_config_builder = || {
        rustls::ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(NoVerifier))
            .with_no_client_auth()
    };
    
    let tls_config = tls_config_builder();
    let tls = MakeRustlsConnect::new(tls_config);

    // Try to use None first to let deadpool detect the current runtime
    // If that fails, recreate the TLS connector and fall back to Tokio1
    // This avoids creating a new runtime that might conflict with vercel_runtime
    let pool = match pg_config.create_pool(None, tls) {
        Ok(p) => p,
        Err(_) => {
            // Fallback to Tokio1 if None doesn't work
            // Recreate TLS connector since it was moved
            let tls_config_fallback = tls_config_builder();
            let tls_fallback = MakeRustlsConnect::new(tls_config_fallback);
            pg_config
                .create_pool(Some(Runtime::Tokio1), tls_fallback)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?
        }
    };

    Ok(pool)
}

/// CORS headers for Vercel serverless functions
pub fn cors_headers() -> Vec<(&'static str, &'static str)> {
    vec![
        ("Access-Control-Allow-Origin", "*"),
        ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
        ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
        ("Access-Control-Max-Age", "86400"),
        ("Content-Type", "application/json"),
    ]
}

/// Check if origin is allowed for CORS
pub fn is_origin_allowed(origin: Option<&str>) -> bool {
    match origin {
        None => true, // Allow requests without origin (Postman, mobile apps, etc.)
        Some(origin) => {
            // Allow Vercel deployments
            if origin.ends_with(".vercel.app") {
                return true;
            }
            // Allow localhost in development
            if origin.starts_with("http://localhost:") || origin.starts_with("http://127.0.0.1:") {
                return true;
            }
            // Allow configured frontend URL
            if let Ok(frontend_url) = std::env::var("FRONTEND_URL") {
                if frontend_url.split(',').any(|url| url.trim() == origin) {
                    return true;
                }
            }
            false
        }
    }
}

