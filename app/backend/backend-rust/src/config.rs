use serde::Deserialize;
use std::env;

/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub solana: SolanaConfig,
    pub buyback: BuybackConfig,
    pub rate_limit: RateLimitConfig,
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub frontend_url: String,
    pub node_env: String,
}

#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub name: String,
    pub run_migrations: bool,
    pub drop_schema: bool,
}

#[derive(Debug, Clone)]
pub struct SolanaConfig {
    pub rpc_url: String,
    pub rpc_url_devnet: String,
    pub program_id: String,
    pub network: String,
    pub commitment: String,
}

#[derive(Debug, Clone)]
pub struct BuybackConfig {
    pub enabled: bool,
    pub threshold_sol: f64,
    pub max_amount_sol: f64,
    pub slippage_bps: u32,
    pub check_interval_ms: u64,
    pub retry_attempts: u32,
    pub retry_delay_ms: u64,
    pub authority_keypair_path: Option<String>,
    pub authority_private_key: Option<String>,
    pub buyback_token_mint: String,
}

#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub ttl: u64,
    pub limit: u32,
    pub strict_ttl: u64,
    pub strict_limit: u32,
    pub very_strict_ttl: u64,
    pub very_strict_limit: u32,
}

impl AppConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(AppConfig {
            server: ServerConfig::from_env()?,
            database: DatabaseConfig::from_env()?,
            solana: SolanaConfig::from_env()?,
            buyback: BuybackConfig::from_env()?,
            rate_limit: RateLimitConfig::from_env()?,
        })
    }

    /// Get the appropriate RPC URL based on network
    pub fn get_rpc_url(&self) -> &str {
        if self.solana.network == "devnet" {
            &self.solana.rpc_url_devnet
        } else {
            &self.solana.rpc_url
        }
    }
}

impl ServerConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(ServerConfig {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3001".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidValue("PORT".to_string()))?,
            frontend_url: env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            node_env: env::var("NODE_ENV").unwrap_or_else(|_| "development".to_string()),
        })
    }
}

impl DatabaseConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(DatabaseConfig {
            host: env::var("DB_HOST")
                .map_err(|_| ConfigError::MissingEnvVar("DB_HOST".to_string()))?,
            port: env::var("DB_PORT")
                .unwrap_or_else(|_| "5432".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidValue("DB_PORT".to_string()))?,
            username: env::var("DB_USERNAME")
                .map_err(|_| ConfigError::MissingEnvVar("DB_USERNAME".to_string()))?,
            password: env::var("DB_PASSWORD")
                .map_err(|_| ConfigError::MissingEnvVar("DB_PASSWORD".to_string()))?,
            name: env::var("DB_NAME")
                .map_err(|_| ConfigError::MissingEnvVar("DB_NAME".to_string()))?,
            run_migrations: env::var("RUN_MIGRATIONS")
                .map(|v| v == "true")
                .unwrap_or(true),
            drop_schema: env::var("DROP_SCHEMA")
                .map(|v| v == "true")
                .unwrap_or(false),
        })
    }
}

impl SolanaConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(SolanaConfig {
            rpc_url: env::var("SOLANA_RPC_URL")
                .or_else(|_| env::var("SOLANA_RPC_URL_MAINNET"))
                .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".to_string()),
            rpc_url_devnet: env::var("SOLANA_RPC_URL_DEVNET")
                .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string()),
            program_id: env::var("SOLANA_PROGRAM_ID")
                .unwrap_or_else(|_| "56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt".to_string()),
            network: env::var("SOLANA_NETWORK").unwrap_or_else(|_| "mainnet-beta".to_string()),
            commitment: env::var("SOLANA_COMMITMENT").unwrap_or_else(|_| "confirmed".to_string()),
        })
    }
}

impl BuybackConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(BuybackConfig {
            enabled: env::var("BUYBACK_ENABLED")
                .map(|v| v == "true")
                .unwrap_or(false),
            threshold_sol: env::var("BUYBACK_THRESHOLD_SOL")
                .unwrap_or_else(|_| "0.1".to_string())
                .parse()
                .unwrap_or(0.1),
            max_amount_sol: env::var("BUYBACK_MAX_AMOUNT_SOL")
                .unwrap_or_else(|_| "10.0".to_string())
                .parse()
                .unwrap_or(10.0),
            slippage_bps: env::var("BUYBACK_SLIPPAGE_BPS")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
            check_interval_ms: env::var("BUYBACK_CHECK_INTERVAL_MS")
                .unwrap_or_else(|_| "3600000".to_string())
                .parse()
                .unwrap_or(3600000),
            retry_attempts: env::var("BUYBACK_RETRY_ATTEMPTS")
                .unwrap_or_else(|_| "3".to_string())
                .parse()
                .unwrap_or(3),
            retry_delay_ms: env::var("BUYBACK_RETRY_DELAY_MS")
                .unwrap_or_else(|_| "5000".to_string())
                .parse()
                .unwrap_or(5000),
            authority_keypair_path: env::var("AUTHORITY_KEYPAIR_PATH").ok(),
            authority_private_key: env::var("AUTHORITY_PRIVATE_KEY").ok(),
            buyback_token_mint: env::var("BUYBACK_TOKEN_MINT")
                .unwrap_or_else(|_| "AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm".to_string()),
        })
    }
}

impl RateLimitConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(RateLimitConfig {
            ttl: env::var("RATE_LIMIT_TTL")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .unwrap_or(60),
            limit: env::var("RATE_LIMIT_MAX")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
            strict_ttl: env::var("RATE_LIMIT_STRICT_TTL")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .unwrap_or(60),
            strict_limit: env::var("RATE_LIMIT_STRICT_MAX")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
            very_strict_ttl: env::var("RATE_LIMIT_VERY_STRICT_TTL")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .unwrap_or(60),
            very_strict_limit: env::var("RATE_LIMIT_VERY_STRICT_MAX")
                .unwrap_or_else(|_| "5".to_string())
                .parse()
                .unwrap_or(5),
        })
    }
}

/// Configuration error types
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing required environment variable: {0}")]
    MissingEnvVar(String),

    #[error("Invalid value for environment variable: {0}")]
    InvalidValue(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_solana_config() {
        // Clear any existing env vars for clean test
        env::remove_var("SOLANA_RPC_URL");
        env::remove_var("SOLANA_NETWORK");

        let config = SolanaConfig::from_env().unwrap();
        assert_eq!(config.network, "mainnet-beta");
        assert_eq!(config.commitment, "confirmed");
    }

    #[test]
    fn test_rate_limit_defaults() {
        let config = RateLimitConfig::from_env().unwrap();
        assert_eq!(config.ttl, 60);
        assert_eq!(config.limit, 100);
    }
}

