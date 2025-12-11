use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// UserLevel Entity
/// Tracks user level and experience based on NFT mints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserLevel {
    /// User's wallet address (Solana Pubkey) - primary key
    pub wallet_address: String,

    /// Total number of NFTs minted
    pub total_mints: i32,

    /// Current level (1-10)
    pub level: i32,

    /// Current experience points
    pub experience: i32,

    /// Mints needed for next level
    pub next_level_mints: i32,

    /// Record creation timestamp
    pub created_at: DateTime<Utc>,

    /// Record update timestamp
    pub updated_at: DateTime<Utc>,

    /// Optimistic locking version
    pub version: i32,
}

/// DTO for creating a new UserLevel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserLevel {
    pub wallet_address: String,
    pub total_mints: i32,
    pub level: i32,
    pub experience: i32,
    pub next_level_mints: i32,
}

/// DTO for updating a UserLevel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserLevel {
    pub total_mints: i32,
    pub level: i32,
    pub experience: i32,
    pub next_level_mints: i32,
}

/// DTO for UserLevel response (API output)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserLevelResponse {
    pub wallet_address: String,
    pub total_mints: i32,
    pub level: i32,
    pub experience: i32,
    pub next_level_mints: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<UserLevel> for UserLevelResponse {
    fn from(user_level: UserLevel) -> Self {
        UserLevelResponse {
            wallet_address: user_level.wallet_address,
            total_mints: user_level.total_mints,
            level: user_level.level,
            experience: user_level.experience,
            next_level_mints: user_level.next_level_mints,
            created_at: user_level.created_at,
            updated_at: user_level.updated_at,
        }
    }
}

impl UserLevel {
    /// Create a new UserLevel with default values
    pub fn new(wallet_address: String) -> CreateUserLevel {
        CreateUserLevel {
            wallet_address,
            total_mints: 0,
            level: 1,
            experience: 0,
            next_level_mints: 5,
        }
    }

    /// Create a UserLevel from level calculation data
    pub fn from_level_data(
        wallet_address: String,
        total_mints: i32,
        level: i32,
        experience: i32,
        next_level_mints: i32,
    ) -> CreateUserLevel {
        CreateUserLevel {
            wallet_address,
            total_mints,
            level,
            experience,
            next_level_mints,
        }
    }
}

impl Default for CreateUserLevel {
    fn default() -> Self {
        CreateUserLevel {
            wallet_address: String::new(),
            total_mints: 0,
            level: 1,
            experience: 0,
            next_level_mints: 5,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_user_level() {
        let create_user_level = UserLevel::new("test_wallet_address".to_string());
        assert_eq!(create_user_level.wallet_address, "test_wallet_address");
        assert_eq!(create_user_level.total_mints, 0);
        assert_eq!(create_user_level.level, 1);
        assert_eq!(create_user_level.experience, 0);
        assert_eq!(create_user_level.next_level_mints, 5);
    }

    #[test]
    fn test_user_level_response_from_user_level() {
        let user_level = UserLevel {
            wallet_address: "wallet123".to_string(),
            total_mints: 10,
            level: 3,
            experience: 10,
            next_level_mints: 10,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            version: 1,
        };

        let response: UserLevelResponse = user_level.into();
        assert_eq!(response.wallet_address, "wallet123");
        assert_eq!(response.total_mints, 10);
        assert_eq!(response.level, 3);
        assert_eq!(response.experience, 10);
        assert_eq!(response.next_level_mints, 10);
    }

    #[test]
    fn test_from_level_data() {
        let create_user_level = UserLevel::from_level_data("wallet456".to_string(), 25, 4, 5, 15);

        assert_eq!(create_user_level.wallet_address, "wallet456");
        assert_eq!(create_user_level.total_mints, 25);
        assert_eq!(create_user_level.level, 4);
        assert_eq!(create_user_level.experience, 5);
        assert_eq!(create_user_level.next_level_mints, 15);
    }

    #[test]
    fn test_default_create_user_level() {
        let default = CreateUserLevel::default();
        assert_eq!(default.wallet_address, "");
        assert_eq!(default.total_mints, 0);
        assert_eq!(default.level, 1);
        assert_eq!(default.experience, 0);
        assert_eq!(default.next_level_mints, 5);
    }
}
