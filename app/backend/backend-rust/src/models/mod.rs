//! Data models for the ASCII Art Generator backend
//!
//! This module contains all the database entities and data transfer objects
//! used throughout the application.

pub mod nft;
pub mod user;
pub mod user_level;
pub mod buyback_event;
pub mod level_calculator;

// Re-export commonly used types
pub use nft::Nft;
pub use user::User;
pub use user_level::UserLevel;
pub use buyback_event::BuybackEvent;
pub use level_calculator::{
    calculate_level, calculate_shard_status, check_shard_eligibility, check_shard_loss,
    Shard, ShardConfig, UserShardStatus, UserStats, SHARD_CONFIG,
};
