use anchor_lang::prelude::*;
use std::str::FromStr;

// Default constants (used for initialization)
pub const DEFAULT_BUYBACK_TOKEN_MINT_STR: &str = "AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm";
pub const DEFAULT_MINT_FEE_LAMPORTS: u64 = 10_000_000; // 0.01 SOL
pub const DEFAULT_AUTHORITY_STR: &str = "95VKqkiYBhyjHGoEx63MqhdUGkTK5wvF7yP1Kv8rnoWe";

// System constants (compile-time, zero runtime cost)
pub const JUPITER_PROGRAM_ID_STR: &str = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
pub const WSOL_MINT_STR: &str = "So11111111111111111111111111111111111111112";

// Validation constants
pub const MIN_ASCII_LENGTH: u32 = 1;
pub const MAX_ASCII_LENGTH: u32 = 50000;
pub const MAX_NAME_LENGTH: usize = 32; // Metaplex standard
pub const MAX_SYMBOL_LENGTH: usize = 10; // Metaplex standard
pub const MAX_URI_LENGTH: usize = 200; // Reasonable limit for IPFS URIs
pub const MIN_BUYBACK_AMOUNT: u64 = 100_000_000; // 0.1 SOL minimum

/// Get Jupiter program ID
pub fn jupiter_program_id() -> Pubkey {
    Pubkey::from_str(JUPITER_PROGRAM_ID_STR).unwrap()
}

/// Get WSOL mint address
pub fn wsol_mint() -> Pubkey {
    Pubkey::from_str(WSOL_MINT_STR).unwrap()
}

