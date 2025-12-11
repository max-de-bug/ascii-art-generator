use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// User Entity
/// Stores general user information identified by wallet address
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    /// User's wallet address (Solana Pubkey) - primary identifier
    pub wallet_address: String,

    /// Optional display name
    pub display_name: Option<String>,

    /// Optional bio/description
    pub bio: Option<String>,

    /// Optional avatar URL
    pub avatar: Option<String>,

    /// Optional email (if user provides)
    pub email: Option<String>,

    /// User preferences/settings stored as JSON
    pub preferences: Option<serde_json::Value>,

    /// Record creation timestamp
    pub created_at: DateTime<Utc>,

    /// Record update timestamp
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a new User
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUser {
    pub wallet_address: String,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub avatar: Option<String>,
    pub email: Option<String>,
    pub preferences: Option<serde_json::Value>,
}

/// DTO for updating a User
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUser {
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub avatar: Option<String>,
    pub email: Option<String>,
    pub preferences: Option<serde_json::Value>,
}

/// DTO for User response (API output)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub wallet_address: String,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub avatar: Option<String>,
    pub email: Option<String>,
    pub preferences: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        UserResponse {
            wallet_address: user.wallet_address,
            display_name: user.display_name,
            bio: user.bio,
            avatar: user.avatar,
            email: user.email,
            preferences: user.preferences,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}

impl User {
    /// Create a new User with minimal information
    pub fn new(wallet_address: String) -> CreateUser {
        CreateUser {
            wallet_address,
            display_name: None,
            bio: None,
            avatar: None,
            email: None,
            preferences: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_user() {
        let create_user = User::new("test_wallet_address".to_string());
        assert_eq!(create_user.wallet_address, "test_wallet_address");
        assert!(create_user.display_name.is_none());
        assert!(create_user.bio.is_none());
    }

    #[test]
    fn test_user_response_from_user() {
        let user = User {
            wallet_address: "wallet123".to_string(),
            display_name: Some("Test User".to_string()),
            bio: Some("A test user bio".to_string()),
            avatar: None,
            email: Some("test@example.com".to_string()),
            preferences: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let response: UserResponse = user.into();
        assert_eq!(response.wallet_address, "wallet123");
        assert_eq!(response.display_name, Some("Test User".to_string()));
        assert_eq!(response.email, Some("test@example.com".to_string()));
    }
}
