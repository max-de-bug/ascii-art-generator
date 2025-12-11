use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpResponse, HttpServer};
use deadpool_postgres::{Config, Pool, Runtime};
use std::sync::Arc;
use tokio_postgres_rustls::MakeRustlsConnect;
use tokio::sync::RwLock;
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use prometheus::{Encoder, Gauge, IntGauge, Opts, Registry, TextEncoder};

mod config;
mod error;
mod handlers;
mod models;
mod services;

use config::AppConfig;
use services::{
    event_parser::EventParserService, nft_storage::NftStorageService,
    solana_indexer::SolanaIndexerService,
};


#[derive(Debug)]
struct NoVerifier;

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

/// Application state shared across handlers
pub struct AppState {
    pub nft_storage: Arc<NftStorageService>,
    pub indexer: Arc<RwLock<SolanaIndexerService>>,
    pub config: AppConfig,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing/logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tokio_postgres=warn,actix_web=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    dotenvy::dotenv().ok();
    let config = AppConfig::from_env().expect("Failed to load configuration");

    info!("Starting ASCII Art Generator Backend (Rust)");
    info!("Network: {}", config.solana.network);
    info!("Program ID: {}", config.solana.program_id);

    // Initialize database connection pool using deadpool-postgres with TLS
    let mut pg_config = Config::new();
    pg_config.host = Some(config.database.host.clone());
    pg_config.port = Some(config.database.port);
    pg_config.user = Some(config.database.username.clone());
    pg_config.password = Some(config.database.password.clone());
    pg_config.dbname = Some(config.database.name.clone());

    // Configure TLS for Supabase connection (using aws-lc-rs crypto provider)
    // Note: Supabase uses certs that may not be in standard root stores,
    // so we use a custom verifier that accepts all certificates (like NestJS with rejectUnauthorized: false)
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    
    let tls_config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoVerifier))
        .with_no_client_auth();
    let tls = MakeRustlsConnect::new(tls_config);

    let pool = pg_config
        .create_pool(Some(Runtime::Tokio1), tls)
        .expect("Failed to create database pool");

    // Test database connection
    {
        let client = pool.get().await.expect("Failed to get database connection");
        client
            .simple_query("SELECT 1")
            .await
            .expect("Failed to execute test query");
        info!("Connected to PostgreSQL database");
    }

    // Run migrations if enabled
    if config.database.run_migrations {
        run_migrations(&pool).await.expect("Failed to run migrations");
        info!("Database migrations completed");
    }

    // Initialize services
    let event_parser = Arc::new(EventParserService::new(config.solana.program_id.clone()));

    let nft_storage = Arc::new(
        NftStorageService::new(pool.clone(), config.clone())
            .await
            .expect("Failed to initialize NFT storage service"),
    );

    let indexer = Arc::new(RwLock::new(
        SolanaIndexerService::new(
            config.clone(),
            event_parser,
            Arc::clone(&nft_storage),
        )
        .await
        .expect("Failed to initialize Solana indexer"),
    ));

    // Start the indexer in background
    {
        let indexer_clone = Arc::clone(&indexer);
        tokio::spawn(async move {
            let mut indexer = indexer_clone.write().await;
            if let Err(e) = indexer.start_indexing().await {
                warn!("Failed to start indexer: {}", e);
            }
        });
    }

    // Start cleanup task for burned NFTs
    {
        let storage_clone = Arc::clone(&nft_storage);
        tokio::spawn(async move {
            storage_clone.start_cleanup_task().await;
        });
    }

    // Create application state
    let app_state = web::Data::new(AppState {
        nft_storage,
        indexer,
        config: config.clone(),
    });

    // Get allowed origins for CORS
    let allowed_origins: Vec<String> = config
        .server
        .frontend_url
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();

    info!(
        "Starting server on http://{}:{}",
        config.server.host, config.server.port
    );
    info!("CORS allowed origins: {:?}", allowed_origins);

    let server_host = config.server.host.clone();
    let server_port = config.server.port;

    HttpServer::new(move || {
        // Configure CORS
        let cors = configure_cors(&allowed_origins);

        App::new()
            .app_data(app_state.clone())
            .wrap(cors)
            .wrap(Logger::default())
            // Health endpoints
            .route("/health", web::get().to(handlers::health::health_check))
            .route(
                "/health/indexer",
                web::get().to(handlers::health::indexer_status),
            )
            // Prometheus metrics endpoint
            .route("/metrics", web::get().to(metrics_handler))
            // NFT endpoints
            .service(
                web::scope("/nft")
                    .route(
                        "/indexer/status",
                        web::get().to(handlers::nft::get_indexer_status),
                    )
                    .route(
                        "/user/{wallet_address}",
                        web::get().to(handlers::nft::get_user_nfts),
                    )
                    .route(
                        "/user/{wallet_address}/level",
                        web::get().to(handlers::nft::get_user_level),
                    )
                    .route(
                        "/user/{wallet_address}/shard-status",
                        web::get().to(handlers::nft::get_user_shard_status),
                    )
                    .route(
                        "/mint/{mint_address}",
                        web::get().to(handlers::nft::get_nft_by_mint),
                    )
                    .route(
                        "/statistics",
                        web::get().to(handlers::nft::get_statistics),
                    )
                    .route("/buybacks", web::get().to(handlers::nft::get_buyback_events))
                    .route(
                        "/buybacks/statistics",
                        web::get().to(handlers::nft::get_buyback_statistics),
                    ),
            )
            // Root endpoint
            .route("/", web::get().to(handlers::root))
    })
    .bind((server_host, server_port))?
    .run()
    .await
}

/// Run database migrations
async fn run_migrations(pool: &Pool) -> Result<(), Box<dyn std::error::Error>> {
    let client = pool.get().await?;

    // Step 1: Enable UUID extension
    client.batch_execute(r#"
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    "#).await?;

    // Step 2: Create tables if they don't exist (minimal schema)
    client.batch_execute(r#"
        -- NFTs table (minimal - columns will be added separately)
        CREATE TABLE IF NOT EXISTS nfts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            mint VARCHAR(44) UNIQUE NOT NULL,
            minter VARCHAR(44) NOT NULL,
            name VARCHAR(255) NOT NULL,
            symbol VARCHAR(50) NOT NULL,
            uri TEXT NOT NULL,
            slot BIGINT NOT NULL DEFAULT 0,
            timestamp BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            wallet_address VARCHAR(44) PRIMARY KEY,
            display_name VARCHAR(100),
            bio TEXT,
            avatar VARCHAR(500),
            email VARCHAR(100),
            preferences JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- User levels table
        CREATE TABLE IF NOT EXISTS user_levels (
            wallet_address VARCHAR(44) PRIMARY KEY,
            total_mints INTEGER NOT NULL DEFAULT 0,
            level INTEGER NOT NULL DEFAULT 1,
            experience INTEGER NOT NULL DEFAULT 0,
            next_level_mints INTEGER NOT NULL DEFAULT 5,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            version INTEGER NOT NULL DEFAULT 1
        );

        -- Buyback events table
        CREATE TABLE IF NOT EXISTS buyback_events (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            amount_sol BIGINT NOT NULL DEFAULT 0,
            token_amount BIGINT NOT NULL DEFAULT 0,
            timestamp BIGINT NOT NULL DEFAULT 0,
            slot BIGINT NOT NULL DEFAULT 0,
            block_time BIGINT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- User shards table
        CREATE TABLE IF NOT EXISTS user_shards (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            wallet_address VARCHAR(44) NOT NULL,
            shard_id VARCHAR(50) NOT NULL,
            earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(wallet_address, shard_id)
        );
    "#).await?;

    // Step 3: Add missing columns to existing tables (idempotent)
    // Using DO blocks to safely add columns if they don't exist
    client.batch_execute(r#"
        -- Add transaction_signature to nfts if missing
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'nfts' AND column_name = 'transaction_signature'
            ) THEN
                ALTER TABLE nfts ADD COLUMN transaction_signature VARCHAR(88);
            END IF;
        END $$;

        -- Add block_time to nfts if missing
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'nfts' AND column_name = 'block_time'
            ) THEN
                ALTER TABLE nfts ADD COLUMN block_time BIGINT;
            END IF;
        END $$;

        -- Add transaction_signature to buyback_events if missing
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'buyback_events' AND column_name = 'transaction_signature'
            ) THEN
                ALTER TABLE buyback_events ADD COLUMN transaction_signature VARCHAR(88);
            END IF;
        END $$;
    "#).await?;

    // Step 4: Create indexes (only if the column exists)
    // We check column existence before creating indexes
    client.batch_execute(r#"
        -- Basic indexes that should always work
        CREATE INDEX IF NOT EXISTS idx_nfts_mint ON nfts(mint);
        CREATE INDEX IF NOT EXISTS idx_nfts_minter ON nfts(minter);
        CREATE INDEX IF NOT EXISTS idx_nfts_created_at ON nfts(created_at);
        CREATE INDEX IF NOT EXISTS idx_nfts_updated_at ON nfts(updated_at);

        CREATE INDEX IF NOT EXISTS idx_user_levels_level ON user_levels(level);
        CREATE INDEX IF NOT EXISTS idx_user_levels_total_mints ON user_levels(total_mints);

        CREATE INDEX IF NOT EXISTS idx_buyback_events_timestamp ON buyback_events(timestamp);

        CREATE INDEX IF NOT EXISTS idx_user_shards_wallet_address ON user_shards(wallet_address);
        CREATE INDEX IF NOT EXISTS idx_user_shards_shard_id ON user_shards(shard_id);
    "#).await?;

    // Step 5: Create indexes on columns that might have been added
    // These are wrapped in DO blocks to handle cases where column might not exist
    client.batch_execute(r#"
        -- Index on transaction_signature for nfts (if column exists)
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'nfts' AND column_name = 'transaction_signature'
            ) THEN
                CREATE INDEX IF NOT EXISTS idx_nfts_transaction_signature ON nfts(transaction_signature);
            END IF;
        END $$;

        -- Index on transaction_signature for buyback_events (if column exists)
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'buyback_events' AND column_name = 'transaction_signature'
            ) THEN
                CREATE INDEX IF NOT EXISTS idx_buyback_events_transaction_signature ON buyback_events(transaction_signature);
            END IF;
        END $$;
    "#).await?;

    info!("Database migrations completed successfully");
    Ok(())
}


/// Prometheus metrics endpoint
async fn metrics_handler(app_state: web::Data<AppState>) -> HttpResponse {
    // Read indexer status
    let indexer = app_state.indexer.read().await;
    let status = indexer.get_status();

    // Create a fresh registry for this scrape
    let registry = Registry::new();

    // Gauges for integer metrics
    let is_indexing = IntGauge::with_opts(Opts::new(
        "indexer_is_indexing",
        "Whether the indexer is running (1) or stopped (0)",
    ))
    .unwrap();
    is_indexing.set(if status.is_indexing { 1 } else { 0 });
    registry.register(Box::new(is_indexing)).ok();

    let processed = IntGauge::with_opts(Opts::new(
        "indexer_processed_transactions",
        "Number of processed transactions currently tracked in cache",
    ))
    .unwrap();
    processed.set(status.processed_transactions as i64);
    registry.register(Box::new(processed)).ok();

    let currently_processing = IntGauge::with_opts(Opts::new(
        "indexer_currently_processing",
        "Number of transactions currently being processed",
    ))
    .unwrap();
    currently_processing.set(status.currently_processing as i64);
    registry.register(Box::new(currently_processing)).ok();

    let total_errors = IntGauge::with_opts(Opts::new(
        "indexer_total_errors",
        "Cumulative number of processing errors",
    ))
    .unwrap();
    total_errors.set(status.total_errors as i64);
    registry.register(Box::new(total_errors)).ok();

    let total_retries = IntGauge::with_opts(Opts::new(
        "indexer_total_retries",
        "Cumulative number of RPC retries",
    ))
    .unwrap();
    total_retries.set(status.total_retries as i64);
    registry.register(Box::new(total_retries)).ok();

    // Float gauge for cache utilization
    let cache_utilization = Gauge::with_opts(Opts::new(
        "indexer_cache_utilization",
        "Cache utilization fraction between 0.0 and 1.0",
    ))
    .unwrap();
    cache_utilization.set(status.cache_utilization as f64);
    registry.register(Box::new(cache_utilization)).ok();

    // Last processed timestamp (unix seconds), if available
    if let Some(ts) = status.last_processed_at {
        let last_processed = IntGauge::with_opts(Opts::new(
            "indexer_last_processed_unix",
            "Estimated unix timestamp of the last processed transaction",
        ))
        .unwrap();
        last_processed.set(ts);
        registry.register(Box::new(last_processed)).ok();
    }

    // Encode metrics to Prometheus text format
    let encoder = TextEncoder::new();
    let metric_families = registry.gather();
    let mut buf = Vec::new();
    if let Err(e) = encoder.encode(&metric_families, &mut buf) {
        return HttpResponse::InternalServerError()
            .body(format!("failed to encode metrics: {}", e));
    }

    HttpResponse::Ok()
        .content_type(encoder.format_type())
        .body(buf)
}

/// Configure CORS based on allowed origins

fn configure_cors(allowed_origins: &[String]) -> Cors {
    let mut cors = Cors::default()
        .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
        .allowed_headers(vec![
            actix_web::http::header::CONTENT_TYPE,
            actix_web::http::header::AUTHORIZATION,
            actix_web::http::header::ACCEPT,
            actix_web::http::header::ORIGIN,
        ])
        .expose_headers(vec![
            actix_web::http::header::CONTENT_LENGTH,
            actix_web::http::header::CONTENT_TYPE,
        ])
        .supports_credentials()
        .max_age(86400); // 24 hours

    for origin in allowed_origins {
        cors = cors.allowed_origin(origin);
    }

    // Allow Vercel deployments
    cors = cors.allowed_origin_fn(|origin, _req_head| {
        if let Ok(origin_str) = origin.to_str() {
            origin_str.ends_with(".vercel.app") || origin_str.contains("vercel.app")
        } else {
            false
        }
    });

    cors
}
