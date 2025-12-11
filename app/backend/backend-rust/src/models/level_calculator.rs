//! ZENITH Shard System
//!
//! A shard-based progression system inspired by competitive achievement systems.
//! Users earn shards by completing specific achievements, and need 6 shards to attain ZENITH.

use serde::{Deserialize, Serialize};

/// Shard requirement types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShardRequirementType {
    MintCount,
    CollectionSize,
    RecentMints,
    UniqueMints,
    SpecialEvent,
    Mystery,
}

/// Loss condition operator
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LossOperator {
    Below,
}

/// Shard requirement configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShardRequirement {
    #[serde(rename = "type")]
    pub requirement_type: ShardRequirementType,
    pub value: Option<i32>,
    pub days: Option<i32>,
}

/// Loss condition configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LossCondition {
    #[serde(rename = "type")]
    pub condition_type: ShardRequirementType,
    pub value: i32,
    pub operator: LossOperator,
    pub days: Option<i32>,
}

/// Shard configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShardConfig {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub description: String,
    pub requirement: ShardRequirement,
    pub can_be_lost: bool,
    pub loss_condition: Option<LossCondition>,
}

/// Global shard configuration
pub static SHARD_CONFIG: once_cell::sync::Lazy<Vec<ShardConfig>> =
    once_cell::sync::Lazy::new(|| {
        vec![
            ShardConfig {
                id: "quartz".to_string(),
                name: "Quartz Shard".to_string(),
                emoji: "⚪".to_string(),
                description: "Mint 50 ASCII art NFTs".to_string(),
                requirement: ShardRequirement {
                    requirement_type: ShardRequirementType::MintCount,
                    value: Some(50),
                    days: None,
                },
                can_be_lost: false,
                loss_condition: None,
            },
            ShardConfig {
                id: "amethyst".to_string(),
                name: "Amethyst Shard".to_string(),
                emoji: "🟣".to_string(),
                description: "Maintain a collection of at least 10 NFTs".to_string(),
                requirement: ShardRequirement {
                    requirement_type: ShardRequirementType::CollectionSize,
                    value: Some(10),
                    days: None,
                },
                can_be_lost: true,
                loss_condition: Some(LossCondition {
                    condition_type: ShardRequirementType::CollectionSize,
                    value: 10,
                    operator: LossOperator::Below,
                    days: None,
                }),
            },
            ShardConfig {
                id: "ruby".to_string(),
                name: "Ruby Shard".to_string(),
                emoji: "🔴".to_string(),
                description: "Mint at least 5 NFTs in the last 30 days".to_string(),
                requirement: ShardRequirement {
                    requirement_type: ShardRequirementType::RecentMints,
                    value: Some(5),
                    days: Some(30),
                },
                can_be_lost: true,
                loss_condition: Some(LossCondition {
                    condition_type: ShardRequirementType::RecentMints,
                    value: 5,
                    operator: LossOperator::Below,
                    days: Some(30),
                }),
            },
            ShardConfig {
                id: "sapphire".to_string(),
                name: "Sapphire Shard".to_string(),
                emoji: "🔵".to_string(),
                description: "Mint 100 total NFTs".to_string(),
                requirement: ShardRequirement {
                    requirement_type: ShardRequirementType::MintCount,
                    value: Some(100),
                    days: None,
                },
                can_be_lost: false,
                loss_condition: None,
            },
            ShardConfig {
                id: "emerald".to_string(),
                name: "Emerald Shard".to_string(),
                emoji: "🟢".to_string(),
                description: "Mint 25 NFTs with unique ASCII art (no duplicates)".to_string(),
                requirement: ShardRequirement {
                    requirement_type: ShardRequirementType::UniqueMints,
                    value: Some(25),
                    days: None,
                },
                can_be_lost: false,
                loss_condition: None,
            },
            ShardConfig {
                id: "obsidian".to_string(),
                name: "Obsidian Shard".to_string(),
                emoji: "⚫".to_string(),
                description: "Mystery - Rare achievement".to_string(),
                requirement: ShardRequirement {
                    requirement_type: ShardRequirementType::Mystery,
                    value: None,
                    days: None,
                },
                can_be_lost: false,
                loss_condition: None,
            },
        ]
    });

/// Shard data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Shard {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub description: String,
    pub earned: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub earned_at: Option<chrono::DateTime<chrono::Utc>>,
    pub can_be_lost: bool,
}

/// User shard status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserShardStatus {
    pub shards: Vec<Shard>,
    pub total_shards: i32,
    pub has_zenith: bool,
    pub shards_needed_for_zenith: i32,
}

/// User statistics for shard eligibility checking
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserStats {
    pub total_mints: i32,
    pub collection_size: i32,
    pub recent_mints: i32, // Mints in last 30 days
    pub unique_mints: i32, // NFTs with unique ASCII art
    pub mint_history: Vec<chrono::DateTime<chrono::Utc>>, // Dates of all mints
}

/// Level data structure (for database compatibility)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelData {
    pub wallet_address: String,
    pub total_mints: i32,
    pub level: i32,
    pub experience: i32,
    pub next_level_mints: i32,
}

/// Check if user is eligible for a specific shard
pub fn check_shard_eligibility(shard_id: &str, user_stats: &UserStats) -> bool {
    let shard = SHARD_CONFIG.iter().find(|s| s.id == shard_id);

    match shard {
        None => false,
        Some(shard) => {
            let req = &shard.requirement;

            match req.requirement_type {
                ShardRequirementType::MintCount => {
                    if let Some(value) = req.value {
                        user_stats.total_mints >= value
                    } else {
                        false
                    }
                }
                ShardRequirementType::CollectionSize => {
                    if let Some(value) = req.value {
                        user_stats.collection_size >= value
                    } else {
                        false
                    }
                }
                ShardRequirementType::RecentMints => {
                    if let Some(value) = req.value {
                        user_stats.recent_mints >= value
                    } else {
                        false
                    }
                }
                ShardRequirementType::UniqueMints => {
                    if let Some(value) = req.value {
                        user_stats.unique_mints >= value
                    } else {
                        false
                    }
                }
                ShardRequirementType::SpecialEvent | ShardRequirementType::Mystery => false,
            }
        }
    }
}

/// Check if a shard should be lost based on loss conditions
pub fn check_shard_loss(shard_id: &str, user_stats: &UserStats) -> bool {
    let shard = SHARD_CONFIG.iter().find(|s| s.id == shard_id);

    match shard {
        None => false,
        Some(shard) => {
            if !shard.can_be_lost {
                return false;
            }

            if let Some(condition) = &shard.loss_condition {
                match condition.condition_type {
                    ShardRequirementType::CollectionSize => {
                        if condition.operator == LossOperator::Below {
                            return user_stats.collection_size < condition.value;
                        }
                    }
                    ShardRequirementType::RecentMints => {
                        if condition.operator == LossOperator::Below {
                            return user_stats.recent_mints < condition.value;
                        }
                    }
                    _ => return false,
                }
            }

            false
        }
    }
}

/// Calculate user's shard status
pub fn calculate_shard_status(user_stats: &UserStats, earned_shards: &[String]) -> UserShardStatus {
    let shards: Vec<Shard> = SHARD_CONFIG
        .iter()
        .map(|config| {
            let is_earned = earned_shards.contains(&config.id);

            // Check if shard should be lost
            let mut should_have_shard = is_earned;
            if is_earned && config.can_be_lost {
                should_have_shard = !check_shard_loss(&config.id, user_stats);
            }

            // Check if user is eligible for shard (if not already earned)
            let is_eligible = should_have_shard || check_shard_eligibility(&config.id, user_stats);

            Shard {
                id: config.id.clone(),
                name: config.name.clone(),
                emoji: config.emoji.clone(),
                description: config.description.clone(),
                earned: is_eligible && should_have_shard,
                earned_at: None,
                can_be_lost: config.can_be_lost,
            }
        })
        .collect();

    let total_shards = shards.iter().filter(|s| s.earned).count() as i32;
    let required_shards = 6;
    let has_zenith = total_shards >= required_shards;
    let shards_needed_for_zenith = (required_shards - total_shards).max(0);

    UserShardStatus {
        shards,
        total_shards,
        has_zenith,
        shards_needed_for_zenith,
    }
}

/// Get shard configuration by ID
pub fn get_shard_config(shard_id: &str) -> Option<&ShardConfig> {
    SHARD_CONFIG.iter().find(|s| s.id == shard_id)
}

/// Get all shard configurations
pub fn get_all_shard_configs() -> &'static Vec<ShardConfig> {
    &SHARD_CONFIG
}

/// Check if user has ZENITH status
pub fn has_zenith(status: &UserShardStatus) -> bool {
    status.has_zenith
}

/// Calculate user level based on mint count
/// This is kept for database schema compatibility, but level progression
/// is now handled by the shard system
pub fn calculate_level(mint_count: i32) -> LevelData {
    LevelData {
        wallet_address: String::new(),
        total_mints: mint_count,
        level: 1,
        experience: mint_count,
        next_level_mints: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shard_config_initialization() {
        let config = get_all_shard_configs();
        assert_eq!(config.len(), 6);

        let quartz = get_shard_config("quartz").unwrap();
        assert_eq!(quartz.name, "Quartz Shard");
        assert!(!quartz.can_be_lost);
    }

    #[test]
    fn test_check_shard_eligibility_mint_count() {
        let stats = UserStats {
            total_mints: 50,
            collection_size: 5,
            recent_mints: 2,
            unique_mints: 10,
            mint_history: vec![],
        };

        assert!(check_shard_eligibility("quartz", &stats));
        assert!(!check_shard_eligibility("sapphire", &stats)); // Requires 100 mints
    }

    #[test]
    fn test_check_shard_eligibility_collection_size() {
        let stats = UserStats {
            total_mints: 15,
            collection_size: 10,
            recent_mints: 2,
            unique_mints: 5,
            mint_history: vec![],
        };

        assert!(check_shard_eligibility("amethyst", &stats));
    }

    #[test]
    fn test_check_shard_loss() {
        let stats = UserStats {
            total_mints: 50,
            collection_size: 5, // Below 10 required
            recent_mints: 2,    // Below 5 required
            unique_mints: 10,
            mint_history: vec![],
        };

        assert!(check_shard_loss("amethyst", &stats));
        assert!(check_shard_loss("ruby", &stats));
        assert!(!check_shard_loss("quartz", &stats)); // Can't be lost
    }

    #[test]
    fn test_calculate_shard_status() {
        let stats = UserStats {
            total_mints: 100,
            collection_size: 15,
            recent_mints: 6,
            unique_mints: 25,
            mint_history: vec![],
        };

        let earned = vec![
            "quartz".to_string(),
            "amethyst".to_string(),
            "ruby".to_string(),
            "sapphire".to_string(),
            "emerald".to_string(),
        ];

        let status = calculate_shard_status(&stats, &earned);

        // Should have all earned shards since stats meet requirements
        assert_eq!(status.total_shards, 5);
        assert!(!status.has_zenith); // Need 6 shards
        assert_eq!(status.shards_needed_for_zenith, 1);
    }

    #[test]
    fn test_has_zenith() {
        let status = UserShardStatus {
            shards: vec![],
            total_shards: 6,
            has_zenith: true,
            shards_needed_for_zenith: 0,
        };

        assert!(has_zenith(&status));

        let status_no_zenith = UserShardStatus {
            shards: vec![],
            total_shards: 4,
            has_zenith: false,
            shards_needed_for_zenith: 2,
        };

        assert!(!has_zenith(&status_no_zenith));
    }

    #[test]
    fn test_calculate_level() {
        let level_data = calculate_level(50);
        assert_eq!(level_data.total_mints, 50);
        assert_eq!(level_data.level, 1);
        assert_eq!(level_data.experience, 50);
    }
}

